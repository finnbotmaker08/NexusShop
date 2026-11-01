"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isVerifiedAdmin } from "@/lib/admin";
import { sendStoreEmail } from "@/lib/email";

async function requireResellerAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isVerifiedAdmin(user)) redirect("/login");
  return { supabase, actor: user! };
}

export async function inviteReseller(formData: FormData) {
  const { actor } = await requireResellerAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const discordId = String(formData.get("discord_id") ?? "").trim();
  const membership = String(formData.get("membership") ?? "");
  const validDiscordId = /^[0-9]{17,20}$/.test(discordId)
    && BigInt(discordId) > BigInt("0")
    && BigInt(discordId) <= BigInt("18446744073709551615");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !validDiscordId || !["basic", "premium"].includes(membership)) {
    redirect("/admin/resellers?error=input");
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    redirect("/admin/resellers?error=config-supabase");
  }
  if (!process.env.GMAIL_USER?.trim() || !process.env.GMAIL_APP_PASSWORD?.trim()) {
    redirect("/admin/resellers?error=config-email");
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
  let siteUrl: URL;
  try {
    siteUrl = new URL(baseUrl ?? "");
  } catch {
    redirect("/admin/resellers?error=config-url");
  }
  if (siteUrl.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && siteUrl.hostname === "localhost")) {
    redirect("/admin/resellers?error=config-url");
  }
  const redirectTo = new URL("/auth/reseller-callback", siteUrl).href;

  let admin: ReturnType<typeof createSupabaseAdminClient>;
  try {
    admin = createSupabaseAdminClient();
  } catch (error) {
    console.error("Reseller invitation Supabase configuration is invalid:", error);
    redirect("/admin/resellers?error=config-supabase");
  }

  const { data: existingProfile, error: existingProfileError } = await admin
    .from("reseller_profiles")
    .select("user_id, account_status")
    .eq("email", email)
    .maybeSingle();
  if (existingProfileError) {
    console.error("Could not check for an existing reseller profile:", existingProfileError.message);
    redirect("/admin/resellers?error=database");
  }
  // Existing accounts need a magic link; new accounts need a genuine invite.
  let authUser: { id: string } | null = null;
  for (let page = 1; !authUser; page += 1) {
    const { data, error: usersError } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (usersError) {
      console.error("Could not check for an existing Supabase Auth user:", usersError.message);
      redirect("/admin/resellers?error=auth-users");
    }
    authUser = data.users.find((candidate) => candidate.email?.toLowerCase() === email) ?? null;
    if (authUser || data.users.length < 1000) break;
  }
  const linkType = authUser ? "magiclink" : "invite";
  const { data: generated, error: generateError } = await admin.auth.admin.generateLink({
    type: linkType, email, options: { redirectTo },
  });
  if (generateError) {
    console.error("Supabase could not create reseller access link:", generateError.message);
    redirect(authUser || existingProfile ? "/admin/resellers?error=invite-existing" : "/admin/resellers?error=invite");
  }
  if (!generated?.user || !generated.properties.action_link) {
    console.error("Reseller invitation link was missing user or action link data.");
    redirect("/admin/resellers?error=invite-existing");
  }
  if (existingProfile && generated.user.id !== existingProfile.user_id) {
    console.error("Reseller access link returned a different Auth user than the saved profile.");
    redirect("/admin/resellers?error=profile");
  }
  const actionLink = generated.properties.action_link;
  const profileValues = {
    email,
    discord_id: discordId,
    membership,
    account_status: existingProfile?.account_status === "active" ? "active" : "invited",
    invited_at: new Date().toISOString(),
    invitation_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };
  const profileWrite = existingProfile
    ? admin.from("reseller_profiles").update(profileValues).eq("user_id", generated.user.id)
    : admin.from("reseller_profiles").upsert({ user_id: generated.user.id, ...profileValues }, { onConflict: "user_id" });
  const { error: profileError } = await profileWrite;
  if (profileError) {
    console.error("Reseller profile could not be saved:", profileError.message);
    redirect("/admin/resellers?error=profile");
  }
  try {
    await sendStoreEmail({
      dedupeKey: `reseller-invite/${generated.user.id}/${Date.now()}`,
      recipient: email,
      subject: "Set your Nexus Suppliers reseller portal password",
      heading: existingProfile?.account_status === "active" ? "Set or reset your reseller portal password" : "Your reseller portal is ready to activate",
        message: "Use the secure, one-time link below to set a password just for the reseller portal. This will not change the password for your regular Nexus Suppliers account.",
      details: [`Membership: ${membership === "premium" ? "Premium" : "Basic"}`, `Discord user ID: ${discordId}`],
      actionUrl: actionLink,
      actionLabel: "Set reseller password",
    });
  } catch (error) {
    console.error("Reseller invitation email failed:", error);
    redirect("/admin/resellers?error=email");
  }
  const { error: auditError } = await admin.from("reseller_audit_log").insert({ actor_id: actor.id, reseller_id: generated.user.id, action: existingProfile ? "invitation_resent" : "invited", details: { membership, link_type: linkType } });
  if (auditError) console.error("Reseller invitation audit event could not be saved:", auditError.message);
  revalidatePath("/admin/resellers");
  redirect("/admin/resellers?notice=invited");
}

export async function updateResellerMembership(formData: FormData) {
  const { actor } = await requireResellerAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const membership = String(formData.get("membership") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !["basic", "premium"].includes(membership)) redirect("/admin/resellers?error=input");
  const admin = createSupabaseAdminClient();
  const { data: prior } = await admin.from("reseller_profiles").select("membership").eq("user_id", userId).maybeSingle();
  const { error } = await admin.from("reseller_profiles").update({ membership, updated_at: new Date().toISOString() }).eq("user_id", userId);
  if (error) {
    console.error("Membership update failed:", error.message);
    redirect("/admin/resellers?error=save");
  }
  await admin.from("reseller_audit_log").insert({ actor_id: actor.id, reseller_id: userId, action: "membership_changed", details: { from: prior?.membership, to: membership } });
  revalidatePath("/admin/resellers");
  revalidatePath("/reseller/dashboard");
  redirect("/admin/resellers?notice=updated");
}

export async function setResellerStatus(formData: FormData) {
  const { actor } = await requireResellerAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !["active", "blocked", "revoked"].includes(status)) redirect("/admin/resellers?error=input");
  const admin = createSupabaseAdminClient();
  const { data: prior, error: lookupError } = await admin.from("reseller_profiles").select("account_status").eq("user_id", userId).maybeSingle();
  if (lookupError || !prior || (status === "active" && prior.account_status === "invited")) redirect("/admin/resellers?error=save");
  const { error } = await admin.from("reseller_profiles").update({ account_status: status, updated_at: new Date().toISOString() }).eq("user_id", userId);
  if (error) {
    console.error("Reseller status update failed:", error.message);
    redirect("/admin/resellers?error=save");
  }
  if (status !== "active") {
    const { error: sessionsError } = await admin.from("reseller_portal_sessions").delete().eq("user_id", userId);
    if (sessionsError) console.error("Reseller sessions could not be revoked:", sessionsError.message);
  }
  await admin.from("reseller_audit_log").insert({ actor_id: actor.id, reseller_id: userId, action: `status_${status}`, details: { from: prior.account_status, to: status } });
  revalidatePath("/admin/resellers");
  redirect("/admin/resellers?notice=updated");
}

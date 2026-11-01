"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createResellerSession, hashResellerPassword, verifyResellerPassword } from "@/lib/reseller-session";

export async function resellerSignIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 1 || password.length > 128) {
    redirect("/reseller/login?error=credentials");
  }

  const admin = createSupabaseAdminClient();
  const { data: profile, error } = await admin
    .from("reseller_profiles")
    .select("user_id, account_status, portal_password_hash")
    .eq("email", email)
    .maybeSingle();
  if (error || !profile || profile.account_status !== "active" || !profile.portal_password_hash) {
    redirect("/reseller/login?error=credentials");
  }
  if (!(await verifyResellerPassword(password, profile.portal_password_hash))) {
    redirect("/reseller/login?error=credentials");
  }
  await createResellerSession(profile.user_id);
  redirect("/reseller/dashboard");
}

export async function setResellerPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  if (password.length < 12 || password.length > 128 || password !== confirmation) {
    redirect("/reseller/activate?error=password");
  }
  const supabase = await createSupabaseServerClient(true);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/reseller/login?error=activation");
  if (!user.email_confirmed_at || !user.email) redirect("/reseller/login?error=activation");

  const admin = createSupabaseAdminClient();
  const { data: profile, error: lookupError } = await admin
    .from("reseller_profiles")
    .select("email, account_status, invitation_expires_at, activated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (lookupError || !profile || profile.email.toLowerCase() !== user.email.toLowerCase()
    || !["invited", "active"].includes(profile.account_status)
    || (profile.account_status === "invited" && new Date(profile.invitation_expires_at) <= new Date())) {
    redirect("/reseller/activate?error=activation");
  }

  const portalPasswordHash = await hashResellerPassword(password);
  const { error: saveError } = await admin.from("reseller_profiles").update({
    portal_password_hash: portalPasswordHash,
    account_status: "active",
    activated_at: profile.activated_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", user.id);
  if (saveError) {
    console.error("Reseller-only password could not be saved:", saveError.message);
    redirect("/reseller/activate?error=activation");
  }

  await createResellerSession(user.id);
  await supabase.auth.signOut({ scope: "local" });
  redirect("/reseller/dashboard");
}

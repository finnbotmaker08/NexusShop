"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isVerifiedAdmin } from "@/lib/admin";

async function authorizedAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isVerifiedAdmin(user)) redirect("/login");
  return user!;
}

export async function saveResellerReward(formData: FormData) {
  const actor = await authorizedAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const instructions = String(formData.get("instructions") ?? "").trim();
  const image = String(formData.get("image_url") ?? "").trim();
  const membership = String(formData.get("membership_required") ?? "");
  const type = String(formData.get("reward_type") ?? "");
  const stockText = String(formData.get("stock") ?? "").trim();
  const limitText = String(formData.get("claim_limit") ?? "1");
  const stock = stockText === "" ? null : Number(stockText);
  const claimLimit = Number(limitText);
  if (title.length < 2 || title.length > 120 || description.length > 4000 || instructions.length > 4000 || !["basic", "premium"].includes(membership) || !["manual", "digital", "product_key"].includes(type) || (stock !== null && (!Number.isInteger(stock) || stock < 0 || stock > 100000)) || !Number.isInteger(claimLimit) || claimLimit !== 1) redirect("/admin/rewards?error=input");
  let imageUrl: string | null = null;
  if (image) {
    try { const parsed = new URL(image); if (parsed.protocol !== "https:") throw new Error(); imageUrl = parsed.href; }
    catch { redirect("/admin/rewards?error=input"); }
  }
  const startsAt = String(formData.get("starts_at") ?? "").trim();
  const endsAt = String(formData.get("ends_at") ?? "").trim();
  const dateValue = (value: string) => { if (!value) return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? "invalid" : date.toISOString(); };
  const startDate = dateValue(startsAt);
  const endDate = dateValue(endsAt);
  if (startDate === "invalid" || endDate === "invalid" || (startDate && endDate && startDate >= endDate)) redirect("/admin/rewards?error=input");
  const values = { title, description, instructions, image_url: imageUrl, membership_required: membership, reward_type: type, stock, claim_limit: claimLimit, starts_at: startDate, ends_at: endDate, is_active: formData.get("is_active") === "on", updated_at: new Date().toISOString() };
  const admin = createSupabaseAdminClient();
  const result = id
    ? await admin.from("reseller_rewards").update(values).eq("id", id).select("id").maybeSingle()
    : await admin.from("reseller_rewards").insert(values).select("id").single();
  if (result.error || !result.data) {
    console.error("Reseller reward save failed:", result.error?.message);
    redirect("/admin/rewards?error=save");
  }
  await admin.from("reseller_audit_log").insert({ actor_id: actor.id, action: id ? "reward_updated" : "reward_created", details: { reward_id: result.data.id, title } });
  revalidatePath("/admin/rewards");
  revalidatePath("/reseller/dashboard");
  redirect("/admin/rewards?notice=saved");
}

export async function deleteResellerReward(formData: FormData) {
  const actor = await authorizedAdmin();
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/admin/rewards?error=input");
  const admin = createSupabaseAdminClient();
  const { count, error: countError } = await admin.from("reseller_claims").select("id", { count: "exact", head: true }).eq("reward_id", id);
  if (countError || (count ?? 0) > 0) redirect("/admin/rewards?error=claimed");
  const { data: deleted, error } = await admin.from("reseller_rewards").delete().eq("id", id).select("id,title").maybeSingle();
  if (error || !deleted) { console.error("Reward deletion failed:", error?.message); redirect("/admin/rewards?error=save"); }
  await admin.from("reseller_audit_log").insert({ actor_id: actor.id, action: "reward_deleted", details: { reward_id: id, title: deleted.title } });
  revalidatePath("/admin/rewards");
  redirect("/admin/rewards?notice=deleted");
}

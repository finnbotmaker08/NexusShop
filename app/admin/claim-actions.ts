"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isVerifiedAdmin } from "@/lib/admin";

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isVerifiedAdmin(user)) redirect("/login");
  return { supabase, user: user! };
}

export async function findResellerClaim(formData: FormData) {
  await requireAdmin();
  const key = String(formData.get("claim_key") ?? "").trim();
  if (key.length < 30 || key.length > 100) redirect("/admin/claims?error=invalid");
  const hash = createHash("sha256").update(key).digest("hex");
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("reseller_claims").select("id").eq("claim_key_hash", hash).maybeSingle();
  if (error || !data) redirect("/admin/claims?error=notfound");
  redirect(`/admin/claims?id=${data.id}`);
}

export async function changeResellerClaimStatus(formData: FormData) {
  const { supabase } = await requireAdmin();
  const claimId = String(formData.get("claim_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(claimId) || !["approved", "rejected", "delivered", "revoked"].includes(status)) redirect("/admin/claims?error=invalid");
  const { error } = await supabase.rpc("update_reseller_claim_status", {
    p_claim_id: claimId, p_status: status, p_reason: status === "rejected" ? reason : null,
  });
  if (error) {
    console.error("Reseller claim status update rejected:", error.message);
    redirect(`/admin/claims?id=${claimId}&error=transition`);
  }
  revalidatePath("/admin/claims");
  revalidatePath("/reseller/dashboard");
  redirect(`/admin/claims?id=${claimId}&notice=updated`);
}

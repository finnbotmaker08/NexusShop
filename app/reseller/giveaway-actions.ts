"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getResellerSession } from "@/lib/reseller-session";

export async function enterGiveaway(formData: FormData) {
  const giveawayId = String(formData.get("giveaway_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(giveawayId)) redirect("/reseller/dashboard?giveaway=error#giveaways");
  const session = await getResellerSession();
  if (!session) redirect("/reseller/login");
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("enter_reseller_giveaway_for_user", {
    p_reseller_id: session.userId,
    p_giveaway_id: giveawayId,
  });
  if (error) {
    console.error("Giveaway entry rejected:", error.message);
    redirect("/reseller/dashboard?giveaway=error#giveaways");
  }
  revalidatePath("/reseller/dashboard");
  redirect("/reseller/dashboard?giveaway=entered#giveaways");
}

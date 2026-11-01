"use server";

import { createHash, randomBytes } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getResellerSession } from "@/lib/reseller-session";

export type ClaimState = { key?: string; error?: string };

export async function claimReward(_previous: ClaimState, formData: FormData): Promise<ClaimState> {
  const rewardId = String(formData.get("reward_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(rewardId)) return { error: "This reward could not be identified." };
  const session = await getResellerSession();
  if (!session) return { error: "Sign in to claim a reward." };
  const key = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(key).digest("hex");
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("claim_reseller_reward_for_user", {
    p_reseller_id: session.userId,
    p_reward_id: rewardId,
    p_key_hash: hash,
  });
  if (error) {
    console.error("Reseller reward claim rejected:", error.message);
    return { error: "This reward is unavailable, already claimed, or not included in your membership." };
  }
  return { key };
}

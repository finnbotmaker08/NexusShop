"use client";

import { useActionState } from "react";
import { claimReward, type ClaimState } from "@/app/reseller/reward-actions";

const initialState: ClaimState = {};

export function ClaimRewardButton({ rewardId }: { rewardId: string }) {
  const [state, action, pending] = useActionState(claimReward, initialState);
  return <div className="mt-4">
    {state.key ? <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.05] p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-100/70">Save this key now · shown once</p><code className="mt-2 block break-all text-xs text-white">{state.key}</code><button type="button" onClick={() => navigator.clipboard.writeText(state.key!)} className="mt-2 rounded-lg border border-white/10 px-3 py-1.5 text-[10px] text-white/65 hover:bg-white/[0.06]">Copy key</button><p className="mt-2 text-[10px] leading-4 text-white/45">Open a support ticket and include this claim key. Approval does not mean the reward has been delivered.</p></div> : <form action={action}><input type="hidden" name="reward_id" value={rewardId} /><button disabled={pending} className="rounded-lg border border-violet-300/20 bg-violet-300/[0.07] px-3.5 py-2 text-xs font-semibold text-violet-100 transition hover:bg-violet-300/[0.13] disabled:opacity-50">{pending ? "Creating claim…" : "Claim reward"}</button>{state.error ? <p role="alert" className="mt-2 text-[11px] text-rose-200/80">{state.error}</p> : null}</form>}
  </div>;
}

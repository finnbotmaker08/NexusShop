import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Gift } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isVerifiedAdmin } from "@/lib/admin";
import { deleteResellerReward, saveResellerReward } from "@/app/admin/reward-actions";

export const metadata = { title: "Reseller rewards" };
export const dynamic = "force-dynamic";

const field = "mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-300/40";
const label = "block text-[11px] text-white/50";

type RewardFormData = {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  reward_type: string;
  membership_required: string;
  stock: number | null;
  instructions: string;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

function RewardFields({ reward }: { reward?: RewardFormData }) {
  return <>
    {reward?.id ? <input type="hidden" name="id" value={reward.id}/> : null}
    <label className={label}>Title<input className={field} name="title" minLength={2} maxLength={120} defaultValue={reward?.title ?? ""} required/></label>
    <label className={label}>Description<input className={field} name="description" maxLength={4000} defaultValue={reward?.description ?? ""}/></label>
    <label className={label}>Image URL (HTTPS)<input className={field} name="image_url" type="url" defaultValue={reward?.image_url ?? ""}/></label>
    <label className={label}>Reward type<select className={field} name="reward_type" defaultValue={reward?.reward_type ?? "manual"}><option value="manual">Manual delivery</option><option value="digital">Digital</option><option value="product_key">Product key</option></select></label>
    <label className={label}>Membership<select className={field} name="membership_required" defaultValue={reward?.membership_required ?? "basic"}><option value="basic">Basic</option><option value="premium">Premium</option></select></label>
    <label className={label}>Available stock (blank = unlimited)<input className={field} name="stock" type="number" min="0" max="100000" defaultValue={reward?.stock ?? ""}/></label>
    <label className={label}>Claims per reseller<input className={field} name="claim_limit" type="number" min="1" max="1" defaultValue="1" readOnly/></label>
    <label className={label}>Starts at<input className={field} name="starts_at" type="datetime-local" defaultValue={typeof reward?.starts_at === "string" ? reward.starts_at.slice(0,16) : ""}/></label>
    <label className={label}>Ends at<input className={field} name="ends_at" type="datetime-local" defaultValue={typeof reward?.ends_at === "string" ? reward.ends_at.slice(0,16) : ""}/></label>
    <label className={`${label} sm:col-span-2`}>Instructions<textarea className={field} name="instructions" rows={3} maxLength={4000} defaultValue={reward?.instructions ?? ""}/></label>
    <label className="inline-flex items-center gap-2 text-xs text-white/60 sm:col-span-2"><input name="is_active" type="checkbox" defaultChecked={reward ? reward.is_active === true : true}/> Published / available to eligible resellers</label>
  </>;
}

export default async function AdminRewardsPage({ searchParams }: PageProps<"/admin/rewards">) {
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!isVerifiedAdmin(user)) redirect("/login");
  const params = await searchParams;
  const admin = createSupabaseAdminClient();
  const { data: rewards, error } = await admin.from("reseller_rewards").select("id,title,description,image_url,reward_type,membership_required,stock,claim_limit,instructions,is_active,starts_at,ends_at,created_at").order("created_at", { ascending: false });
  return <main className="reseller-page min-h-screen bg-[#070707] px-5 py-8 text-white sm:px-8"><div className="mx-auto max-w-6xl"><Link href="/admin" className="inline-flex items-center gap-2 text-xs text-white/45 hover:text-white"><ArrowLeft className="h-4 w-4"/> Admin workspace</Link><div className="mt-8 flex items-center gap-3"><Gift className="h-6 w-6 text-violet-200"/><div><p className="text-[10px] font-bold uppercase tracking-[0.23em] text-violet-200/55">Control center</p><h1 className="mt-1 text-3xl font-semibold">Rewards</h1></div></div>{params.error ? <p role="alert" className="mt-4 text-sm text-rose-200">{params.error === "claimed" ? "This reward has claim history and cannot be deleted." : "The reward could not be saved. Check the fields and migration."}</p> : null}{params.notice ? <p role="status" className="mt-4 text-sm text-emerald-200">Reward saved.</p> : null}
    <section className="mt-6 rounded-3xl border border-white/[0.08] bg-[#0c0c0c] p-5 sm:p-7"><h2 className="font-semibold">Add a reward</h2><form action={saveResellerReward} className="mt-4 grid gap-4 sm:grid-cols-2"><RewardFields/><button className="rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold hover:bg-violet-400 sm:col-span-2">Create reward</button></form></section>
    <section className="mt-6 space-y-4">{error ? <p className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-5 text-sm text-amber-100/70">Apply the reseller database migration to manage rewards.</p> : rewards?.length ? rewards.map((reward) => <article key={reward.id} className="rounded-3xl border border-white/[0.08] bg-[#0c0c0c] p-5 sm:p-7"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{reward.title}</h2><p className="mt-1 text-[10px] uppercase tracking-wider text-white/40">{reward.membership_required} · {reward.reward_type} · {reward.is_active ? "Published" : "Paused"} · {reward.stock === null ? "Unlimited" : `${reward.stock} in stock`}</p></div><form action={deleteResellerReward}><input type="hidden" name="id" value={reward.id}/><button className="rounded-lg border border-rose-200/10 px-3 py-2 text-[10px] text-rose-100/65 hover:bg-rose-400/[0.06]">Delete if unclaimed</button></form></div><form action={saveResellerReward} className="grid gap-4 sm:grid-cols-2"><RewardFields reward={reward}/><button className="rounded-xl border border-white/10 px-4 py-3 text-xs font-semibold hover:bg-white/[0.05] sm:col-span-2">Save reward</button></form></article>) : <p className="rounded-2xl border border-dashed border-white/10 p-7 text-center text-sm text-white/40">No rewards configured.</p>}</section>
  </div></main>;
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, Gift, Headphones, Package, ShieldCheck, Ticket } from "lucide-react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getResellerSession } from "@/lib/reseller-session";
import { ClaimRewardButton } from "@/app/reseller/dashboard/claim-reward-button";
import { enterGiveaway } from "@/app/reseller/giveaway-actions";

export const metadata = { title: "Reseller dashboard" };
export const dynamic = "force-dynamic";

const nav = [
  { href: "#overview", label: "Overview", icon: ShieldCheck },
  { href: "#purchases", label: "My Purchases", icon: Package },
  { href: "#rewards", label: "Rewards & Claims", icon: Gift },
  { href: "#giveaways", label: "Giveaways", icon: Ticket },
  { href: "/reseller/dashboard/support", label: "Support Center", icon: Headphones },
];

function getCurrentTime() {
  return Date.now();
}

export default async function ResellerDashboardPage() {
  const session = await getResellerSession();
  if (!session) redirect("/reseller/login");
  const admin = createSupabaseAdminClient();

  const [{ data: orders, error: orderError }, { data: claims }, { data: rewards }, { data: tickets }, { data: giveaways }, { data: entries }] = await Promise.all([
    admin.from("store_orders").select("id, order_number, status, currency, total_amount_minor, items, created_at").eq("user_id", session.userId).order("created_at", { ascending: false }).limit(8),
    admin.from("reseller_claims").select("id, status, created_at, reward:reseller_rewards(title)").eq("reseller_id", session.userId).order("created_at", { ascending: false }).limit(8),
    admin.from("reseller_rewards").select("id, title, description, membership_required, stock, starts_at, ends_at").eq("is_active", true).order("created_at", { ascending: false }),
    admin.from("reseller_tickets").select("id, subject, status, priority, updated_at").eq("reseller_id", session.userId).not("status", "in", "(closed,resolved)").order("updated_at", { ascending: false }).limit(8),
    admin.from("reseller_giveaways").select("id, title, reward, ends_at, starts_at, allowed_memberships").eq("status", "active").order("ends_at", { ascending: true }),
    admin.from("reseller_giveaway_entries").select("giveaway_id").eq("reseller_id", session.userId),
  ]);
  const now = getCurrentTime();
  const availableRewards = (rewards ?? []).filter((reward) =>
    (session.membership === "premium" || reward.membership_required === "basic")
    && (!reward.starts_at || new Date(reward.starts_at).getTime() <= now)
    && (!reward.ends_at || new Date(reward.ends_at).getTime() > now));
  const availableGiveaways = (giveaways ?? []).filter((giveaway) =>
    giveaway.allowed_memberships.includes(session.membership)
    && (!giveaway.starts_at || new Date(giveaway.starts_at).getTime() <= now)
    && (!giveaway.ends_at || new Date(giveaway.ends_at).getTime() > now));
  const pendingClaims = (claims ?? []).filter((claim) => claim.status === "pending").length;
  const itemCount = (orders ?? []).reduce((sum, order) => sum + (Array.isArray(order.items) ? order.items.reduce((subtotal, item) => subtotal + (typeof item === "object" && item && "quantity" in item && typeof item.quantity === "number" ? item.quantity : 0), 0) : 0), 0);
  const date = (value: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));

  return <main className="store-page reseller-page min-h-screen text-white"><header className="border-b border-white/[0.07] bg-black/20"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4 sm:px-8"><Link href="/reseller" className="font-bold tracking-[0.18em]">VENTEX <span className="font-normal tracking-normal text-white/40">Reseller</span></Link><form action="/reseller/signout" method="post"><button className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white/65 hover:bg-white/[0.05]">Sign out</button></form></div></header>
    <div className="mx-auto grid max-w-7xl gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[230px_1fr] lg:py-12"><aside className="h-fit rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-400/10 font-bold text-violet-100">{session.email[0]?.toUpperCase()}</div><p className="mt-4 truncate text-sm font-semibold">{session.email}</p><p className="mt-1 text-xs text-white/40">Discord · {session.discordId}</p><span className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${session.membership === "premium" ? "bg-violet-300/10 text-violet-200" : "bg-white/[0.07] text-white/65"}`}><BadgeCheck className="h-3 w-3" />{session.membership}</span><nav className="mt-6 space-y-1 border-t border-white/[0.07] pt-4">{nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-xs text-white/55 transition hover:bg-white/[0.05] hover:text-white"><Icon className="h-4 w-4" />{label}</Link>)}</nav></aside>
      <div className="min-w-0 space-y-8"><section id="overview"><p className="text-[10px] font-bold uppercase tracking-[0.24em] text-violet-200/55">Private reseller area</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Welcome to your portal</h1><p className="mt-2 text-sm text-white/45">Membership active · joined {date(session.activatedAt ?? session.invitedAt)}</p><div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Purchases", String(itemCount)], ["Available rewards", String(availableRewards.length)], ["Pending claims", String(pendingClaims)], ["Open tickets", String(tickets?.length ?? 0)]].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5"><p className="text-xs text-white/40">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}</div></section>
      <section id="purchases" className="scroll-mt-8 rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6"><div className="flex items-center justify-between"><h2 className="font-semibold">My purchases</h2><Link href="/account" className="text-xs text-violet-200 hover:text-white">Order details</Link></div>{orderError ? <p className="mt-4 text-sm text-amber-100/70">Purchase history could not be loaded right now.</p> : orders?.length ? <div className="mt-4 divide-y divide-white/[0.06]">{orders.map((order) => <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm font-medium">{order.order_number}</p><p className="mt-1 text-xs text-white/40">{date(order.created_at)} · {order.status}</p></div><p className="text-sm text-white/65">{new Intl.NumberFormat("en-IE", { style: "currency", currency: order.currency }).format(Number(order.total_amount_minor) / 100)}</p></div>)}</div> : <p className="mt-4 rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/40">Purchases linked to this account will appear here.</p>}</section>
      <section id="rewards" className="scroll-mt-8"><div className="flex items-center justify-between"><h2 className="font-semibold">Rewards & claims</h2><span className="text-xs text-white/40">{session.membership} eligible</span></div>{availableRewards.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{availableRewards.map((reward) => <article key={reward.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5"><p className="font-medium">{reward.title}</p><p className="mt-2 text-xs leading-5 text-white/45">{reward.description || "Details will be provided when this reward is claimed."}</p><p className="mt-4 text-[10px] uppercase tracking-wider text-violet-200/60">{reward.membership_required} reward {reward.stock === null ? "· available" : `· ${reward.stock} left`}</p><ClaimRewardButton rewardId={reward.id} /></article>)}</div> : <p className="mt-4 rounded-2xl border border-dashed border-white/10 p-6 text-sm text-white/40">No rewards are currently available for your membership.</p>}</section>
      <section id="giveaways" className="scroll-mt-8 rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6"><h2 className="font-semibold">Giveaways</h2>{availableGiveaways.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{availableGiveaways.map((giveaway) => { const entered = (entries ?? []).some((entry) => entry.giveaway_id === giveaway.id); return <article key={giveaway.id} className="rounded-2xl border border-white/[0.07] p-4"><p className="font-medium">{giveaway.title}</p><p className="mt-1 text-xs text-white/45">{giveaway.reward}</p>{giveaway.ends_at ? <p className="mt-3 text-[10px] text-white/35">Ends {date(giveaway.ends_at)}</p> : null}{entered ? <p className="mt-4 text-xs text-emerald-200/70">You are entered.</p> : <form action={enterGiveaway} className="mt-4"><input type="hidden" name="giveaway_id" value={giveaway.id}/><button className="rounded-lg border border-violet-300/20 px-3.5 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-300/[0.07]">Enter giveaway</button></form>}</article>; })}</div> : <p className="mt-3 text-sm text-white/40">There are no active giveaways at the moment.</p>}</section>
      </div></div>
  </main>;
}

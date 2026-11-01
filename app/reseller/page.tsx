import Link from "next/link";
import { ArrowRight, BadgeCheck, Headphones, ShieldCheck, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const plans = [
  { name: "Basic", price: "€1,50", points: ["Private reseller dashboard", "Purchase history", "Basic rewards", "Reseller support"] },
  { name: "Premium", price: "€8", points: ["Everything in Basic", "Premium-only rewards", "Priority support", "Custom server, domain and boosts"] },
];

export const metadata = { title: "Reseller Portal" };

export default function ResellerLandingPage() {
  return <><SiteHeader /><main className="store-page reseller-page min-h-[70vh] text-white"><section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
    <div className="max-w-3xl"><p className="inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-300/[0.06] px-3 py-1.5 text-xs text-violet-100/80"><Sparkles className="h-3.5 w-3.5" /> Nexus Suppliers reseller program</p><h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl">Your business, with a little more behind it.</h1><p className="mt-5 max-w-2xl text-base leading-7 text-white/55">A private place to manage eligible purchases, rewards and support after your reseller plan has been approved.</p>
      <div className="mt-8 flex flex-wrap gap-3"><Link href="/reseller/login" className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-400">Login to Portal <ArrowRight className="h-4 w-4" /></Link><a href="#plans" className="rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-white/70 hover:bg-white/[0.04]">View Plans</a></div>
      <p className="mt-5 flex items-center gap-2 text-xs text-white/40"><ShieldCheck className="h-4 w-4" /> Access is enabled by Nexus Suppliers after purchase review and manual approval.</p>
    </div>
    <div id="plans" className="mt-16 grid gap-4 md:grid-cols-2">{plans.map((plan, index) => <article key={plan.name} className={`rounded-3xl border ${index ? "border-violet-300/20 bg-violet-950/20" : "border-white/[0.08] bg-white/[0.025]"} p-6 sm:p-8`}><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{plan.name}</h2>{index ? <span className="rounded-full border border-violet-300/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-violet-200">Premium</span> : <BadgeCheck className="h-5 w-5 text-white/40" />}</div><p className="mt-4 text-4xl font-semibold">{plan.price}<span className="ml-2 text-sm font-normal text-white/40">one-time</span></p><ul className="mt-6 space-y-3">{plan.points.map((point) => <li key={point} className="flex gap-2 text-sm text-white/60"><span className="text-violet-300">✓</span>{point}</li>)}</ul></article>)}</div>
    <div className="mt-8 grid gap-4 rounded-3xl border border-white/[0.07] bg-black/20 p-6 md:grid-cols-2"><div><h2 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-violet-300" /> Account activation</h2><p className="mt-2 text-sm leading-6 text-white/45">After you purchase a plan, share your email and Discord ID with Nexus Suppliers support. We review the purchase, create your account and email a secure activation link. You set your own password.</p></div><div><h2 className="flex items-center gap-2 text-sm font-semibold"><Headphones className="h-4 w-4 text-violet-300" /> Need help?</h2><p className="mt-2 text-sm leading-6 text-white/45">Contact our <Link className="text-violet-200 hover:text-white" href="/support">support team</Link> if you have questions about a plan or activation.</p></div></div>
  </section></main><SiteFooter /></>;
}

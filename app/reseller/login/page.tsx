import Link from "next/link";
import { redirect } from "next/navigation";
import { resellerSignIn } from "@/app/reseller/actions";
import { getResellerSession } from "@/lib/reseller-session";

export const metadata = { title: "Reseller login" };

export default async function ResellerLoginPage({ searchParams }: PageProps<"/reseller/login">) {
  if (await getResellerSession()) redirect("/reseller/dashboard");
  const query = await searchParams;
  const error = query.error;
  return <main className="store-page reseller-page flex min-h-screen items-center justify-center px-5 py-14 text-white"><section className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-[#0c0c13]/90 p-7 shadow-2xl sm:p-9"><Link href="/reseller" className="text-xs text-white/40 hover:text-white">← Reseller Portal</Link><p className="mt-8 text-[10px] font-bold uppercase tracking-[0.25em] text-violet-200/60">VENTEX member access</p><h1 className="mt-2 text-3xl font-semibold">Welcome back</h1><p className="mt-2 text-sm leading-6 text-white/45">Sign in with the separate password you created for the reseller portal.</p>{error ? <p role="alert" className="mt-5 rounded-xl border border-rose-300/15 bg-rose-300/[0.06] p-3 text-xs text-rose-100/80">We could not sign you in. Check your reseller email and portal password. If this is your first time, open the activation link VENTEX emailed to you.</p> : null}<form action={resellerSignIn} className="mt-6 space-y-4"><label className="block text-xs text-white/55">Email<input className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-violet-300/40" name="email" type="email" autoComplete="username" required /></label><label className="block text-xs text-white/55">Reseller portal password<input className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-violet-300/40" name="password" type="password" autoComplete="current-password" required /></label><button className="w-full rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold hover:bg-violet-400">Sign in securely</button></form><p className="mt-5 text-center text-xs text-white/40">Need help? <Link href="/support" className="text-violet-200 hover:text-white">Contact support</Link></p></section></main>;
}

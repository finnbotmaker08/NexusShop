import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { setResellerPassword } from "@/app/reseller/actions";

export const metadata = { title: "Set reseller portal password" };

export default async function ResellerActivatePage({ searchParams }: PageProps<"/reseller/activate">) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || !user.email_confirmed_at) redirect("/reseller/login?error=activation");

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("reseller_profiles")
    .select("email, account_status, invitation_expires_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile || profile.email.toLowerCase() !== user.email.toLowerCase()
    || !["invited", "active"].includes(profile.account_status)
    || (profile.account_status === "invited" && new Date(profile.invitation_expires_at) <= new Date())) {
    redirect("/reseller/login?error=activation");
  }

  const query = await searchParams;
  const isSetup = profile.account_status === "invited";
  return <main className="store-page reseller-page flex min-h-screen items-center justify-center px-5 py-14 text-white"><section className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-[#0c0c13]/90 p-7 sm:p-9"><Link href="/reseller" className="text-xs text-white/40 hover:text-white">← VENTEX</Link><h1 className="mt-8 text-3xl font-semibold">{isSetup ? "Activate reseller portal" : "Set reseller portal password"}</h1><p className="mt-2 text-sm leading-6 text-white/45">Create a separate password for the reseller portal. Your existing shop and Supabase password will not change.</p>{query.error ? <p role="alert" className="mt-4 text-xs text-rose-200">The password did not match or the reseller password could not be saved. Please try again or contact support.</p> : null}<form action={setResellerPassword} className="mt-6 space-y-4"><label className="block text-xs text-white/55">New reseller portal password<input className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm" name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></label><label className="block text-xs text-white/55">Confirm password<input className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm" name="confirmation" type="password" minLength={12} maxLength={128} autoComplete="new-password" required /></label><button className="w-full rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold hover:bg-violet-400">{isSetup ? "Create password and activate" : "Save new portal password"}</button></form></section></main>;
}

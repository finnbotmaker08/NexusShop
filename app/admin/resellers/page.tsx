import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isVerifiedAdmin } from "@/lib/admin";
import { inviteReseller, setResellerStatus, updateResellerMembership } from "@/app/admin/reseller-actions";

export const metadata = { title: "Reseller management" };
export const dynamic = "force-dynamic";

const input = "mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-3 text-sm text-white outline-none focus:border-violet-300/40";

export default async function AdminResellersPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!isVerifiedAdmin(user)) redirect("/login");

  const admin = createSupabaseAdminClient();
  const [{ data: profiles, error }, params] = await Promise.all([
    admin
      .from("reseller_profiles")
      .select("user_id, email, discord_id, membership, account_status, invited_at, activated_at")
      .order("invited_at", { ascending: false })
      .limit(200),
    searchParams,
  ]);

  const notice =
    params.notice === "invited"
      ? "Invitation sent."
      : params.notice === "updated"
      ? "Reseller updated."
      : null;

  const errorMessages: Record<string, string> = {
    input: "Controleer het e-mailadres, Basic/Premium en het Discord User ID. Gebruik de numerieke ID, geen gebruikersnaam.",
    "config-supabase": "Supabase-configuratie ontbreekt: controleer NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY.",
    "config-email": "E-mailconfiguratie ontbreekt: controleer GMAIL_USER en GMAIL_APP_PASSWORD.",
    "config-url": "NEXT_PUBLIC_SITE_URL moet een geldige HTTPS-site-URL zijn. Voeg /auth/reseller-callback ook toe aan Supabase Auth → URL Configuration → Redirect URLs.",
    database: "De resellerdatabase kon niet worden gelezen. Controleer of de reseller-migratie op het juiste Supabase-project is toegepast.",
    "auth-users": "Supabase kon de bestaande Auth-gebruikers niet controleren. Controleer de service-role-configuratie en probeer opnieuw.",
    invite: "Supabase kon geen veilige uitnodigingslink maken. Controleer Auth → Users en de Supabase Auth-configuratie.",
    "invite-existing": "Supabase kon geen veilige magic link voor deze bestaande gebruiker maken. Controleer de e-mailprovider, Auth-instellingen en redirect-URL en probeer daarna opnieuw.",
    profile: "De Auth-link is gemaakt, maar het resellerprofiel kon niet veilig worden opgeslagen. Controleer de migratie en of dit e-mailadres al aan een ander resellerprofiel hangt.",
    email: "Het resellerprofiel is bewaard als uitnodiging, maar de mail kon niet worden verstuurd. Controleer Gmail en de store_email_outbox-migratie en verstuur daarna opnieuw.",
    "already-active": "Dit e-mailadres heeft al een actieve reselleraccount.",
    save: "De resellerwijziging kon niet worden opgeslagen. Vernieuw de pagina en controleer de status.",
  };

  const errorCode = typeof params.error === "string" ? params.error : undefined;
  const errorText = errorCode ? errorMessages[errorCode] ?? "Onbekende fout. Vernieuw de pagina en controleer de serverlog voor de technische oorzaak." : null;

  return (
    <main className="reseller-page min-h-screen bg-[#070707] px-5 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin" className="inline-flex items-center gap-2 text-xs text-white/45 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Admin workspace
        </Link>
        
        <div className="mt-8 flex items-end gap-3">
          <Users className="mb-1 h-6 w-6 text-violet-200" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.23em] text-violet-200/55">Control center</p>
            <h1 className="mt-1 text-3xl font-semibold">Resellers</h1>
          </div>
        </div>

        {notice ? <p role="status" className="mt-5 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.05] p-3 text-sm text-emerald-100">{notice}</p> : null}
        {errorText ? <p role="alert" className="mt-5 rounded-xl border border-rose-300/15 bg-rose-300/[0.05] p-3 text-sm text-rose-100">{errorText}</p> : null}

        <section className="mt-7 rounded-3xl border border-white/[0.08] bg-[#0c0c0c] p-5 sm:p-7">
          <h2 className="text-lg font-semibold">Add reseller</h2>
          <p className="mt-1 text-xs text-white/40">Creates or renews a reseller portal access link. Existing shop accounts and their passwords stay unchanged.</p>
          <form action={inviteReseller} className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-white/55">Email
              <input className={input} name="email" type="email" autoComplete="off" maxLength={254} required />
            </label>
            <label className="text-xs text-white/55">Discord User ID
              <input className={input} name="discord_id" inputMode="numeric" pattern="[0-9]{17,20}" minLength={17} maxLength={20} placeholder="Bijv. 123456789012345678" aria-describedby="discord-id-help" required />
              <span id="discord-id-help" className="mt-1 block text-[11px] leading-5 text-white/35">Geen gebruikersnaam. Discord: Settings → Advanced → Developer Mode aanzetten, daarna rechtsklik op de gebruiker → Copy User ID.</span>
            </label>
            <label className="text-xs text-white/55">Membership
              <select className={input} name="membership" defaultValue="basic">
                <option value="basic">Basic · €1,50</option>
                <option value="premium">Premium · €8</option>
              </select>
            </label>
            <div className="flex items-end">
              <button className="w-full rounded-xl bg-violet-500 px-4 py-3 text-sm font-semibold hover:bg-violet-400 transition">Add reseller and send password link</button>
            </div>
          </form>
        </section>

        <section className="mt-7 rounded-3xl border border-white/[0.08] bg-[#0c0c0c] p-5 sm:p-7">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Reseller accounts</h2>
            <span className="text-xs text-white/35">{profiles?.length ?? 0} shown</span>
          </div>

          {error ? (
            <p className="mt-4 text-sm text-amber-100/70">Reseller table is unavailable. Apply migrations `20261009000000_reseller_portal.sql` and `20261017000000_reseller_portal_credentials.sql` in Supabase first.</p>
          ) : profiles?.length ? (
            <div className="mt-4 space-y-3">
              {profiles.map((profile) => (
                <article key={profile.user_id} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-all text-sm font-semibold">{profile.email}</p>
                      <p className="mt-1 text-xs text-white/40">
                        Discord {profile.discord_id} · Invited {profile.invited_at ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(profile.invited_at)) : "N/A"}
                      </p>
                      <span className="mt-2 inline-flex rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] uppercase tracking-wider text-white/60">
                        {profile.account_status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <form action={updateResellerMembership} className="flex gap-2">
                        <input type="hidden" name="user_id" value={profile.user_id} />
                        <select className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-xs" name="membership" defaultValue={profile.membership}>
                          <option value="basic">Basic</option>
                          <option value="premium">Premium</option>
                        </select>
                        <button className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/[0.05]">Save</button>
                      </form>
                      <form action={setResellerStatus} className="flex gap-2">
                        <input type="hidden" name="user_id" value={profile.user_id} />
                        <select className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-xs" name="status" defaultValue={profile.account_status === "active" ? "blocked" : "active"}>
                          <option value="active">Activate</option>
                          <option value="blocked">Block</option>
                          <option value="revoked">Revoke</option>
                        </select>
                        <button className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/[0.05]">Apply</button>
                      </form>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-5 rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/40">No reseller accounts yet.</p>
          )}
        </section>

        <p className="mt-5 text-xs leading-5 text-white/35">For safety, internal account changes are recorded in the reseller audit log. Purchase history continues to use the existing shop orders.</p>
      </div>
    </main>
  );
}
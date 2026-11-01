import Image from "next/image";
import { ArrowUpRight, MessageCircle, Wrench } from "lucide-react";
import { fetchStoreSettings } from "@/lib/storefront";
import { isValidDiscordInvite } from "@/lib/storefront";

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const { settings } = await fetchStoreSettings();

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070707] px-5 py-16 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_72%)]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.045] blur-[120px]" />
      <div className="relative w-full max-w-xl text-center">
        <div className="relative mx-auto h-16 w-32 overflow-hidden rounded-lg border border-white/10">
          <Image
            src="/ns.jpg"
            alt="Nexus Suppliers"
            fill
            sizes="128px"
            className="object-cover"
          />
        </div>
        <div className="mx-auto mt-9 inline-flex items-center gap-2 rounded-full border border-amber-200/15 bg-amber-100/[0.04] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-100/70">
          <Wrench className="h-3.5 w-3.5" />
          A little refresh
        </div>
        <h1 className="mt-6 text-4xl font-semibold tracking-[-0.05em] sm:text-6xl">
          Back in a moment.
        </h1>
        <p className="mx-auto mt-5 max-w-md text-sm leading-6 text-white/45">
          {settings.maintenance_message}
        </p>
        <p className="mt-4 text-xs text-white/30">
          We are making a few improvements behind the scenes.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {isValidDiscordInvite(settings.discord_server_url) &&
          settings.discord_server_url ? (
            <a
              href={settings.discord_server_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-bold text-black transition hover:bg-white/90"
            >
              <MessageCircle className="h-4 w-4" />
              Main Discord
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          ) : null}
          {isValidDiscordInvite(settings.discord_support_url) &&
          settings.discord_support_url ? (
            <a
              href={settings.discord_support_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold text-white/75 transition hover:bg-white/[0.08]"
            >
              <MessageCircle className="h-4 w-4" />
              Discord support
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </div>
    </main>
  );
}

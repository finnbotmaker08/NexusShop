import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { fetchStoreSettings, isValidDiscordInvite } from "@/lib/storefront";

export async function SiteFooter() {
  const { settings } = await fetchStoreSettings();

  return (
    <footer className="relative isolate overflow-hidden border-t border-white/[0.07] bg-[#070b13]">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(ellipse_at_15%_0%,rgba(34,92,197,0.12),transparent_58%)]" />
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[minmax(0,1fr)_auto] md:gap-16 md:py-16">
        <div className="max-w-sm">
          <Link href="/" aria-label="Nexus Suppliers home" className="inline-flex items-center gap-3">
            <span className="relative block h-10 w-10 overflow-hidden rounded-xl border border-blue-300/15 bg-[#050812]">
              <Image
                src="/ns.jpg"
                alt=""
                fill
                sizes="40px"
                className="object-cover"
              />
            </span>
            <span>
              <span className="block text-sm font-black tracking-[0.19em] text-white">
                NEXUS SUPPLIERS
              </span>
              <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.2em] text-blue-200/50">
                Digital suppliers
              </span>
            </span>
          </Link>
          <p className="mt-5 max-w-xs text-sm leading-6 text-white/45">
            Digital upgrades, without the extra noise. Browse the store, keep
            track of your orders, and reach out when you need help.
          </p>
          <p className="mt-4 inline-flex items-center gap-2 text-[11px] font-medium text-white/35">
            <Sparkles className="h-3.5 w-3.5 text-blue-300/70" />
            Made for your next level.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-10 gap-y-8 sm:grid-cols-3">
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-100/55">
              Explore
            </h2>
            <div className="mt-4 flex flex-col gap-3 text-sm text-white/55">
              <Link href="/products" className="transition hover:text-white">
                Shop all
              </Link>
              <Link href="/cart" className="transition hover:text-white">
                Shopping cart
              </Link>
              <Link href="/support" className="transition hover:text-white">
                Support
              </Link>
            </div>
          </div>
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-100/55">
              Your account
            </h2>
            <div className="mt-4 flex flex-col gap-3 text-sm text-white/55">
              <Link href="/account" className="transition hover:text-white">
                My orders
              </Link>
              <Link href="/account/login" className="transition hover:text-white">
                Sign in
              </Link>
              <Link href="/terms" className="transition hover:text-white">
                Terms
              </Link>
              <Link href="/privacy" className="transition hover:text-white">
                Privacy
              </Link>
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-100/55">
              Find us
            </h2>
            <div className="mt-4 flex flex-col gap-3 text-sm text-white/55">
              {settings.discord_server_url &&
              isValidDiscordInvite(settings.discord_server_url) ? (
                <a
                  href={settings.discord_server_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 transition hover:text-white"
                >
                  <MessageCircle className="h-3.5 w-3.5 text-blue-200/70" />
                  Community Discord <ArrowUpRight className="h-3 w-3" />
                </a>
              ) : null}
              {settings.discord_support_url &&
              isValidDiscordInvite(settings.discord_support_url) ? (
                <a
                  href={settings.discord_support_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 transition hover:text-white"
                >
                  <MessageCircle className="h-3.5 w-3.5 text-blue-200/70" />
                  Discord support <ArrowUpRight className="h-3 w-3" />
                </a>
              ) : null}
              <Link
                href="/account"
                className="inline-flex items-center gap-2 transition hover:text-white"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-blue-200/70" />
                Order dashboard
              </Link>
              <Link
                href="/login"
                className="transition hover:text-white"
              >
                Store management
              </Link>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-white/[0.06] bg-black/15">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-5 text-[11px] text-white/35 sm:px-8 md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} Nexus Suppliers. All rights reserved.</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-300 shadow-[0_0_10px_rgba(96,165,250,0.7)]" />
            Digital, done beautifully.
          </span>
        </div>
      </div>
    </footer>
  );
}

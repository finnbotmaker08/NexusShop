import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Headphones,
  LayoutGrid,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { CartCountLink } from "@/components/cart-count-link";
import { fetchStoreSettings, isValidDiscordInvite } from "@/lib/storefront";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Shop", icon: LayoutGrid },
  { href: "/support", label: "Support", icon: Headphones },
];

export async function SiteHeader({ active }: { active?: string }) {
  const { settings } = await fetchStoreSettings();
  const communityInvite =
    settings.discord_server_url &&
    isValidDiscordInvite(settings.discord_server_url)
      ? settings.discord_server_url
      : null;

  return (
    <>
      <div className="relative overflow-hidden border-b border-blue-300/10 bg-[#0c172b]">
        <div className="store-glow-drift pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(47,112,240,0.18),transparent_65%)]" />
        <div className="mx-auto flex min-h-9 max-w-7xl items-center justify-center gap-2 px-4 text-center text-[11px] font-medium tracking-wide text-blue-50/70">
          <Sparkles className="h-3.5 w-3.5 text-blue-200" />
          <span>Digital upgrades, without the extra noise.</span>
          {communityInvite ? (
            <a
              href={communityInvite}
              target="_blank"
              rel="noreferrer"
              className="ml-1 inline-flex items-center gap-1 font-semibold text-white transition hover:text-blue-200"
            >
              Join Discord <ArrowUpRight className="h-3 w-3" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : null}
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#070a12]/90 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Link
            href="/"
            aria-label="Nexus Suppliers home"
            className="group flex min-w-0 items-center gap-3"
          >
            <span className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-blue-200/20 bg-[#050812] shadow-[0_0_28px_rgba(37,99,235,0.24)] ring-1 ring-white/[0.04]">
              <Image
                src="/ns.jpg"
                alt=""
                fill
                priority
                sizes="40px"
                className="object-cover transition duration-300 group-hover:scale-110"
              />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-black tracking-[0.19em] text-white">
                NEXUS SUPPLIERS
              </span>
              <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.2em] text-blue-200/50">
                Digital suppliers
              </span>
            </span>
          </Link>

          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-1 rounded-2xl border border-white/[0.07] bg-[#080d17]/80 p-1 shadow-inner shadow-white/[0.02] md:flex"
          >
            {navigation.map((item) => {
              const isActive = active === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`store-nav-link inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-medium transition ${
                    isActive
                      ? "store-nav-link-active bg-blue-500/15 text-blue-100 shadow-[inset_0_0_0_1px_rgba(125,177,255,0.09)]"
                      : "text-white/55 hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/reseller"
              className="hidden rounded-xl px-3 py-2 text-[13px] font-medium text-white/60 transition hover:text-white lg:inline-flex"
            >
              Reseller Portal
            </Link>
            <Link
              href="/account"
              className="hidden rounded-xl px-3 py-2 text-[13px] font-medium text-white/60 transition hover:text-white sm:inline-flex"
            >
              My orders
            </Link>
            <CartCountLink />
            <Link
              href="/products"
              className="group inline-flex items-center gap-2 rounded-xl border border-blue-300/20 bg-gradient-to-b from-blue-400 to-blue-600 px-4 py-2.5 text-[12px] font-bold text-white shadow-[0_7px_25px_rgba(37,99,235,0.28),inset_0_1px_0_rgba(255,255,255,0.18)] transition hover:-translate-y-0.5 hover:from-blue-300 hover:to-blue-500 sm:px-5 sm:text-[13px]"
            >
              Browse shop
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
        <nav
          aria-label="Mobile navigation"
          className="flex gap-2 overflow-x-auto border-t border-white/[0.05] bg-[#080d17]/70 px-4 py-2.5 md:hidden"
        >
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs transition ${
                  isActive
                    ? "bg-blue-500/15 font-semibold text-blue-100"
                    : "text-white/50 hover:text-white"
                }`}
              >
                {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/reseller"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-white/50 transition hover:text-white"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Reseller Portal
          </Link>
          <Link
            href="/account"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-white/50 transition hover:text-white"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            My orders
          </Link>
          {settings.discord_support_url &&
          isValidDiscordInvite(settings.discord_support_url) ? (
            <a
              href={settings.discord_support_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-white/50 transition hover:text-white"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Discord
            </a>
          ) : null}
        </nav>
      </header>
    </>
  );
}

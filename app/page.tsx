import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Headphones,
  Layers3,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { FadeIn } from "@/components/animated";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { StoreProductCard } from "@/components/store-product-card";
import {
  fetchCategories,
  fetchProducts,
  isValidDiscordInvite,
} from "@/lib/storefront";
import { fetchStoreSettings } from "@/lib/storefront";

export default async function HomePage() {
  const [{ products, configured, error }, { categories }, { settings }] =
    await Promise.all([fetchProducts(), fetchCategories(), fetchStoreSettings()]);
  const featuredProducts = products.slice(0, 3);
  const supportInvite =
    settings.discord_support_url &&
    isValidDiscordInvite(settings.discord_support_url)
      ? settings.discord_support_url
      : null;

  return (
    <main className="store-page relative isolate overflow-hidden text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[48rem] bg-[radial-gradient(ellipse_at_78%_25%,rgba(33,101,238,0.15),transparent_36%),radial-gradient(ellipse_at_15%_40%,rgba(18,65,157,0.1),transparent_32%)]" />
      <SiteHeader active="/" />

      <section className="relative isolate border-b border-white/[0.06]">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_75%_38%,rgba(28,89,227,0.2),transparent_37%),radial-gradient(ellipse_at_15%_8%,rgba(32,87,191,0.12),transparent_32%)]" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:linear-gradient(to_bottom,black,transparent_82%)]" />

        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20 lg:grid-cols-[1.02fr_0.98fr] lg:gap-8 lg:pb-28 lg:pt-24">
          <div className="relative z-10">
            <FadeIn className="inline-flex items-center gap-2 rounded-full border border-blue-200/15 bg-blue-400/[0.07] px-3.5 py-2 text-[11px] font-semibold text-blue-100/80">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-300 opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-300" />
              </span>
              A fresh way to shop digital
            </FadeIn>

            <FadeIn y={16} delay={0.04} className="mt-7 max-w-3xl">
              <h1 className="text-[clamp(3.5rem,8vw,6.8rem)] font-black leading-[0.91] tracking-[-0.075em]">
                <span className="block">Your next</span>
                <span className="store-gradient-text mt-2 block bg-gradient-to-r from-[#f8fbff] via-[#b9d5ff] to-[#478dff] bg-clip-text pb-2 text-transparent">
                  level starts here.
                </span>
              </h1>
            </FadeIn>

            <FadeIn y={16} delay={0.08} className="mt-6 max-w-xl">
              <p className="text-[15px] leading-7 text-slate-300/70 sm:text-base">
                Explore Nitro, boosts and digital extras in a store built to
                keep the good stuff easy to find. Pick what fits, check out,
                and follow your order from your account.
              </p>
            </FadeIn>

            <FadeIn
              y={16}
              delay={0.12}
              className="mt-8 flex flex-col gap-3 sm:flex-row"
            >
              <Link
                href="/products"
                className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-blue-300/20 bg-gradient-to-b from-blue-400 to-blue-600 px-6 py-3 text-sm font-bold text-white shadow-[0_12px_32px_rgba(37,99,235,0.25),inset_0_1px_0_rgba(255,255,255,0.17)] transition hover:-translate-y-0.5 hover:from-blue-300 hover:to-blue-500"
              >
                Explore the shop
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/account"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-6 py-3 text-sm font-semibold text-white/75 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
              >
                <Layers3 className="h-4 w-4 text-blue-200/70" />
                View my orders
              </Link>
            </FadeIn>

            <FadeIn y={12} delay={0.17} className="mt-8 flex flex-wrap gap-x-5 gap-y-2">
              {[
                { icon: ShieldCheck, label: "Protected checkout" },
                { icon: BadgeCheck, label: "Order tracking" },
                { icon: Headphones, label: "Real support" },
              ].map(({ icon: Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 text-xs font-medium text-slate-300/55"
                >
                  <Icon className="h-3.5 w-3.5 text-blue-300/80" />
                  {label}
                </span>
              ))}
            </FadeIn>
          </div>

          <FadeIn
            y={20}
            delay={0.1}
            className="relative mx-auto w-full max-w-[530px] lg:ml-auto"
          >
            <div className="store-glow-drift absolute -inset-8 -z-10 rounded-full bg-blue-500/15 blur-[80px]" />
            <div className="store-float relative overflow-hidden rounded-[2rem] border border-blue-200/15 bg-[linear-gradient(145deg,rgba(36,83,159,0.2),rgba(9,13,23,0.95)_42%)] p-2 shadow-[0_40px_100px_rgba(0,0,0,0.5),0_0_70px_rgba(35,105,232,0.11)]">
              <div className="relative aspect-[1.18] overflow-hidden rounded-[1.55rem] bg-[#03050a]">
                <Image
                  src="/ns.jpg"
                  alt="Nexus Suppliers digital products"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 530px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#070a12]/95 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-blue-200/75">
                        Welcome to Nexus Suppliers
                      </p>
                      <p className="mt-2 text-xl font-extrabold tracking-tight sm:text-2xl">
                        Good things, made simple.
                      </p>
                    </div>
                    <Link
                      href="/products"
                      aria-label="Browse Nexus Suppliers products"
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white backdrop-blur-md transition hover:bg-blue-500"
                    >
                      <ArrowUpRight className="h-5 w-5" />
                    </Link>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-white/[0.05] bg-[#090e18]/65 px-3 py-3 sm:px-4">
                <span className="inline-flex items-center gap-2 text-xs font-medium text-white/55">
                  <Sparkles className="h-3.5 w-3.5 text-blue-300" />
                  Nitro, boosts &amp; digital extras
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/30">
                  Nexus Suppliers store
                </span>
              </div>
            </div>
            {featuredProducts[0] ? (
              <Link
                href={`/products/${featuredProducts[0].slug ?? featuredProducts[0].id}`}
                className="absolute -bottom-5 left-2 right-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#111827]/95 p-3 shadow-[0_22px_55px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:-bottom-6 sm:left-8 sm:right-8 sm:p-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-200/10 bg-blue-400/10 text-blue-200">
                  <Sparkles className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[9px] font-bold uppercase tracking-[0.19em] text-blue-200/65">
                    Explore the catalog
                  </span>
                  <span className="mt-0.5 block truncate text-sm font-bold text-white">
                    {featuredProducts[0].name}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-white/55" />
              </Link>
            ) : null}
          </FadeIn>
        </div>
      </section>

      {categories.length > 0 ? (
        <section className="relative border-b border-white/[0.06] bg-[#090d16]/85">
          <FadeIn y={8}>
            <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 sm:px-8 md:flex-row md:items-center md:justify-between">
              <p className="shrink-0 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                Browse a category
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:justify-end">
                {categories.slice(0, 6).map((category) => (
                  <Link
                    key={category.id}
                    href={`/products?category=${encodeURIComponent(category.slug)}`}
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-2.5 text-xs font-semibold text-white/65 transition hover:-translate-y-0.5 hover:border-blue-300/25 hover:bg-blue-400/[0.07] hover:text-blue-100"
                  >
                    {category.name}
                    <ArrowUpRight className="h-3 w-3 text-blue-200/50" />
                  </Link>
                ))}
                <Link
                  href="/products"
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-blue-300/15 bg-blue-500/10 px-3.5 py-2.5 text-xs font-bold text-blue-100 transition hover:bg-blue-500/20"
                >
                  All products <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </FadeIn>
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
        <FadeIn>
          <div className="mb-8 flex flex-col gap-5 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-blue-200/65">
                <span className="h-px w-6 bg-blue-300/50" />
                Straight from the catalog
              </p>
              <h2 className="text-3xl font-extrabold tracking-[-0.045em] sm:text-4xl">
                Find your next favorite.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/45">
                Browse the products currently available in the Nexus Suppliers store.
              </p>
            </div>
            <Link
              href="/products"
              className="group inline-flex items-center gap-2 self-start rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-white/65 transition hover:border-blue-200/25 hover:text-white sm:self-auto"
            >
              View all products
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </FadeIn>

        {error ? (
          <div
            role="alert"
            className="rounded-3xl border border-red-300/15 bg-red-300/[0.05] p-8 text-center"
          >
            <h3 className="text-xl font-semibold">Shop temporarily unavailable</h3>
            <p className="mt-2 text-sm text-white/45">
              The live catalog could not be loaded. Please try again in a moment.
            </p>
          </div>
        ) : !configured ? (
          <div className="rounded-3xl border border-blue-200/10 bg-blue-100/[0.025] p-8 text-center">
            <h3 className="text-xl font-semibold">The shop is getting ready</h3>
            <p className="mt-2 text-sm text-white/45">
              Products will appear here as soon as the catalog is connected.
            </p>
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-10 text-center">
            <Sparkles className="mx-auto h-7 w-7 text-blue-200/70" />
            <h3 className="mt-4 text-xl font-bold">New products are on the way</h3>
            <p className="mt-2 text-sm text-white/45">
              Check back soon to see what is new in the store.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featuredProducts.map((product, index) => (
              <FadeIn key={product.id} delay={index * 0.05}>
                <StoreProductCard product={product} />
              </FadeIn>
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 sm:pb-24">
        <FadeIn>
          <div className="store-panel relative overflow-hidden rounded-[2rem] p-6 sm:p-10 lg:p-12">
            <div className="pointer-events-none absolute -right-16 -top-32 h-80 w-80 rounded-full bg-blue-500/15 blur-[80px]" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.022)_1px,transparent_1px)] bg-[size:42px_42px] [mask-image:linear-gradient(to_right,transparent,black)]" />
            <div className="relative flex flex-col gap-7 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl">
                <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-blue-200/70">
                  <Headphones className="h-3.5 w-3.5" />
                  Need a hand?
                </p>
                <h2 className="mt-3 text-2xl font-extrabold tracking-[-0.04em] sm:text-3xl">
                  Questions before you buy?
                </h2>
                <p className="mt-3 text-sm leading-6 text-white/50">
                  Get in touch before checkout, or find your order and delivery
                  details in your customer account.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/account"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.08]"
                >
                  My orders <ArrowUpRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/support"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-400"
                >
                  Contact support <ArrowRight className="h-4 w-4" />
                </Link>
                {supportInvite ? (
                  <a
                    href={supportInvite}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-white/65 transition hover:border-white/20 hover:text-white"
                  >
                    Discord <ArrowUpRight className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      <SiteFooter />
    </main>
  );
}

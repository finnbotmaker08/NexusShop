import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowRight, ShoppingCart, Sparkles } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CartAddButton } from "@/components/cart-add-button";
import {
  fetchProductBySlug,
  formatPrice,
  getEffectiveProductPrice,
} from "@/lib/storefront";

export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { product, configured, error } = await fetchProductBySlug(slug);

  if (!product) {
    if (configured && !error) {
      notFound();
    }

    return (
      <main className="store-page text-white">
        <SiteHeader active="/products" />

        <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.04] text-3xl">
            <Sparkles className="h-8 w-8 text-white/70" />
          </div>
          <h1 className="mt-6 text-4xl font-black">
            {error ? "Product unavailable" : "Catalog connection needed"}
          </h1>
          <p className="mt-3 text-white/45">
            {error
              ? "The product could not be loaded. Please try again later."
              : "Connect Supabase or return to the catalog to find an active product."}
          </p>
          <Link
            href="/products"
            className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-bold text-black transition hover:bg-white/90"
          >
            Explore products <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <SiteFooter />
      </main>
    );
  }

  const effectivePrice = getEffectiveProductPrice(product);
  const isOnSale =
    effectivePrice !== null &&
    product.price !== null &&
    Number(effectivePrice) < Number(product.price);

  return (
    <main className="store-page text-white">
      <SiteHeader active="/products" />

      <section className="relative isolate mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-20">
        <div className="pointer-events-none absolute left-0 top-0 -z-10 h-[32rem] w-[32rem] rounded-full bg-blue-500/[0.09] blur-[140px]" />
        <div className="relative flex aspect-[1.08] items-center justify-center overflow-hidden rounded-[2rem] border border-blue-200/10 bg-[radial-gradient(ellipse_at_50%_35%,rgba(37,99,235,0.24),transparent_65%),linear-gradient(145deg,#111c31,#090c14_68%)] shadow-[0_30px_90px_rgba(0,0,0,0.35),0_0_60px_rgba(37,99,235,0.08)]">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name ?? "Product image"}
              fill
              unoptimized
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover transition duration-700 hover:scale-[1.025]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:40px_40px]">
              <span className="flex h-24 w-24 items-center justify-center rounded-[1.7rem] border border-blue-200/15 bg-blue-400/[0.08] text-blue-100/80 shadow-[0_0_65px_rgba(37,99,235,0.15)]">
                <Sparkles className="h-10 w-10" />
              </span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#070a12]/30 to-transparent" />
          <Link
            href="/products"
            className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#070a12]/70 px-3.5 py-2.5 text-xs font-semibold text-white/75 backdrop-blur-xl transition hover:border-blue-200/30 hover:text-white"
          >
            <ArrowRight className="h-3.5 w-3.5 rotate-180" />
            Back to shop
          </Link>
        </div>

        <div className="store-enter flex flex-col justify-center py-2">
          <span className="w-fit rounded-full border border-blue-200/15 bg-blue-400/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-100/75">
            {product.category ?? "Digital Product"}
          </span>

          <h1 className="mt-5 text-4xl font-black tracking-[-0.055em] md:text-6xl">
            {product.name ?? "Untitled product"}
          </h1>

          <p className="mt-5 max-w-xl text-[15px] leading-7 text-white/55">
            {product.description ?? "No description available for this product yet."}
          </p>

          {product.delivery_description ? (
            <div className="mt-7 rounded-2xl border border-white/[0.08] bg-[#0c111b]/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.17em] text-white/40">
                Delivery details
              </p>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-white/60">
                {product.delivery_description}
              </p>
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-4xl font-black tracking-tight text-white">
              {formatPrice(effectivePrice)}
            </span>
            {isOnSale ? (
              <>
                <span className="text-lg text-white/35 line-through">
                  {formatPrice(product.price)}
                </span>
                <span className="rounded-full border border-blue-200/15 bg-blue-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-blue-100/80">
                  Sale
                </span>
              </>
            ) : null}
          </div>

          <div className="mt-7 rounded-2xl border border-white/[0.08] bg-[#0c111b]/80 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/50">Availability</span>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-white/70">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-400/10 text-blue-200">
                  <ShoppingCart className="h-3.5 w-3.5" />
                </span>
                {product.stock === null || product.stock === undefined
                  ? "Digital product"
                  : product.stock > 0
                    ? `${product.stock} available`
                    : "Out of stock"}
              </span>
            </div>
          </div>

          {product.stock === 0 ? (
            <button
              type="button"
              disabled
              className="mt-6 inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-6 py-4 text-center font-bold text-white/35"
            >
              Currently unavailable
            </button>
          ) : (
            <div className="mt-6 space-y-3">
              {product.slug ? (
                <CartAddButton productSlug={product.slug} />
              ) : (
                <Link
                  href={`/checkout?product=${product.id}`}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-6 py-4 text-center font-bold text-white shadow-[0_12px_32px_rgba(37,99,235,0.2)] transition hover:bg-blue-400"
                >
                  Continue to checkout <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <Link
                href="/cart"
                className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.025] px-5 py-3 text-sm font-semibold text-white/70 transition hover:border-white/20 hover:text-white"
              >
                View cart
              </Link>
            </div>
          )}
          {product.external_url ? (
            <a
              href={product.external_url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center justify-center gap-2 text-sm text-white/45 transition hover:text-white"
            >
              Visit product destination <ArrowRight className="h-4 w-4" />
            </a>
          ) : null}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

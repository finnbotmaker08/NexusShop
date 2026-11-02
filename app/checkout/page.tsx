import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { PaddlePurchaseButton } from "@/components/paddle-purchase-button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { fetchProductBySlug, formatPrice } from "@/lib/storefront";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; checkout?: string }>;
}) {
  const { product: slug, checkout } = await searchParams;
  const { product, error } = slug
    ? await fetchProductBySlug(slug)
    : { product: null, error: null };
  const summary = product ?? null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const checkoutSignInUrl = summary
    ? `/account/login?returnTo=${encodeURIComponent(
        `/checkout?product=${summary.slug ?? summary.id}`,
      )}`
    : "/account/login";

  return (
    <main className="store-page text-white">
      <SiteHeader active="/products" />

      <section className="mx-auto grid max-w-6xl gap-8 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="store-panel rounded-3xl p-6 sm:p-8">
          <p className="store-eyebrow">Checkout</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">
            Nearly yours.
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-white/45">
            Review your selection and continue to Paddle&apos;s secure hosted
            checkout. Your order only appears as paid after Paddle confirms it.
          </p>

          {checkout === "success" ? (
            <div className="mt-8 flex items-start gap-3 rounded-2xl border border-blue-200/15 bg-blue-100/[0.04] p-5 text-sm text-blue-100/75">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                Checkout returned successfully. We&apos;re waiting for the
                provider&apos;s payment confirmation; check your account for
                the verified order status.
              </p>
            </div>
          ) : null}

          {summary ? (
            user ? (
              <div className="mt-7">
                <PaddlePurchaseButton productSlug={summary.slug ?? String(summary.id)} />
              </div>
            ) : (
              <Link
                href={checkoutSignInUrl}
                className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 px-6 py-4 text-center font-bold text-white transition hover:bg-blue-400"
              >
                Sign in to continue <ArrowRight className="h-4 w-4" />
              </Link>
            )
          ) : (
            <div className="mt-8 rounded-2xl border border-amber-200/10 bg-amber-100/[0.035] p-5">
              <p className="font-semibold text-white/85">No product selected</p>
              <p className="mt-1 text-sm leading-6 text-white/45">
                Choose a product from the catalog to see its details here.
              </p>
            </div>
          )}

          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/20 p-4">
            <ShieldCheck className="h-5 w-5 shrink-0 text-white/55" />
            <p className="text-xs leading-5 text-white/40">
              Card details are entered on Paddle&apos;s hosted checkout, not on
              Nexus Suppliers.
            </p>
          </div>

          <Link
            href="/products"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-white/90"
          >
            Continue browsing <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <aside className="store-panel rounded-3xl p-6">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/35">
            Your selection
          </p>

          {summary ? (
            <>
              <div className="mt-6 flex items-center gap-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                  {summary.image_url ? (
                    <Image
                      src={summary.image_url}
                      alt={summary.name ?? "Product"}
                      fill
                      unoptimized
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <span className="text-2xl">🚀</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold">{summary.name ?? "Product"}</p>
                  <p className="text-sm text-white/45">{summary.category ?? "Digital product"}</p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-white/[0.08] pt-5">
                <span className="text-sm text-white/50">Listed price (tax may apply)</span>
                <span className="text-lg font-semibold">
                  {formatPrice(summary.price)}
                </span>
              </div>
            </>
          ) : (
            <div className="mt-8 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
              <p className="text-lg font-semibold">
                {error ? "Product could not be loaded" : "No product selected"}
              </p>
              <p className="mt-2 text-sm text-white/45">
                {error
                  ? "Please return to the catalog and try again."
                  : "Choose a product from the catalog to see its details here."}
              </p>
              <Link href="/products" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-white/80 hover:text-white">
                Browse products <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </aside>
      </section>
      <SiteFooter />
    </main>
  );
}

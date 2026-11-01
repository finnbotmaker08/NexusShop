import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Package } from "lucide-react";
import {
  formatPrice,
  getEffectiveProductPrice,
  type StorefrontProduct,
} from "@/lib/storefront";

export function StoreProductCard({
  product,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
}: {
  product: StorefrontProduct;
  sizes?: string;
}) {
  const price = getEffectiveProductPrice(product);
  const hasSale =
    price !== null &&
    product.price !== null &&
    Number(price) < Number(product.price);
  const unavailable = product.stock === 0;

  return (
    <Link
      href={`/products/${product.slug ?? product.id}`}
      className="store-card group relative flex h-full flex-col overflow-hidden rounded-[1.4rem] border border-white/[0.08] bg-[linear-gradient(155deg,#101a2b,#090e18_72%)] shadow-[0_10px_35px_rgba(0,0,0,0.14)] transition duration-300 hover:-translate-y-1 hover:border-blue-300/30 hover:shadow-[0_24px_55px_rgba(0,0,0,0.34),0_0_35px_rgba(37,99,235,0.1)]"
    >
      <div className="relative isolate aspect-[1.42] overflow-hidden bg-[radial-gradient(ellipse_at_50%_35%,rgba(37,99,235,0.2),transparent_65%),linear-gradient(145deg,#111c31,#090c14_68%)]">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name ?? "Digital product"}
            fill
            unoptimized
            sizes={sizes}
            className="object-cover transition duration-700 group-hover:scale-[1.06]"
          />
        ) : (
          <>
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:30px_30px]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-200/15 bg-blue-400/[0.08] text-blue-100/80 shadow-[0_0_40px_rgba(37,99,235,0.12)]">
                <Package className="h-7 w-7" />
              </span>
            </div>
          </>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b111d] via-[#0b111d]/5 to-black/5" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-blue-950/15 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <div className="absolute left-4 top-4 flex max-w-[calc(100%-2rem)] flex-wrap gap-2">
          <span className="rounded-full border border-white/10 bg-[#080c15]/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-white/80 shadow-[0_4px_16px_rgba(0,0,0,0.18)] backdrop-blur-md">
            {product.category || "Digital"}
          </span>
          {hasSale ? (
            <span className="rounded-full border border-blue-200/20 bg-blue-500/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
              On sale
            </span>
          ) : null}
        </div>
        <span
          className={`absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-semibold backdrop-blur-md ${
            unavailable
              ? "border-red-200/15 bg-red-400/10 text-red-100/75"
              : "border-emerald-200/15 bg-emerald-400/10 text-emerald-100/80"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              unavailable ? "bg-red-300/70" : "store-available-dot bg-emerald-300"
            }`}
          />
          {unavailable ? "Out of stock" : "Available"}
        </span>
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
        <h2 className="line-clamp-1 text-[17px] font-bold tracking-tight text-white transition group-hover:text-blue-100">
          {product.name ?? "Untitled product"}
        </h2>
        <p className="mt-2 line-clamp-2 min-h-10 text-[13px] leading-5 text-white/45">
          {product.short_description ||
            product.description ||
            "Explore the product details and delivery information."}
        </p>
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-white/[0.07] pt-4">
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.15em] text-white/35">
              Starting at
            </span>
            <span className="mt-1 block text-lg font-extrabold tracking-tight text-white">
              {formatPrice(price)}
            </span>
            {hasSale ? (
              <span className="text-xs text-white/35 line-through">
                {formatPrice(product.price)}
              </span>
            ) : null}
          </div>
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-300/15 bg-blue-500/[0.08] text-blue-100 transition group-hover:border-blue-300/35 group-hover:bg-blue-500 group-hover:text-white">
            <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

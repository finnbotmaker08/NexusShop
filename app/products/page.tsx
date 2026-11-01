import Link from "next/link";
import { ArrowRight, PackageSearch, Search, SlidersHorizontal } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { StoreProductCard } from "@/components/store-product-card";
import { FadeIn } from "@/components/animated";
import {
  fetchCategories,
  fetchProducts,
  getEffectiveProductPrice,
} from "@/lib/storefront";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    q?: string;
    availability?: string;
    minPrice?: string;
    maxPrice?: string;
    sort?: string;
  }>;
}) {
  const {
    category: selectedSlug,
    q,
    availability,
    minPrice: minPriceParam,
    maxPrice: maxPriceParam,
    sort,
  } = await searchParams;
  const [{ categories }, allProducts] = await Promise.all([
    fetchCategories(),
    fetchProducts(),
  ]);
  const selectedCategory = categories.find(
    (category) => category.slug === selectedSlug,
  );
  const { products: catalogProducts, error, configured } = selectedCategory
    ? await fetchProducts(selectedCategory.name)
    : allProducts;
  const query = (q ?? "").trim().slice(0, 100).toLocaleLowerCase();
  const minPrice = minPriceParam ? Number(minPriceParam) : null;
  const maxPrice = maxPriceParam ? Number(maxPriceParam) : null;
  let products = catalogProducts.filter((product) => {
    const price = Number(getEffectiveProductPrice(product));
    const matchesQuery =
      !query ||
      [product.name, product.category, product.short_description, product.description]
        .some((value) => value?.toLocaleLowerCase().includes(query));
    const matchesMin = minPrice === null || !Number.isFinite(minPrice) || price >= minPrice;
    const matchesMax = maxPrice === null || !Number.isFinite(maxPrice) || price <= maxPrice;
    const matchesAvailability =
      availability === "available"
        ? product.stock === null || product.stock === undefined || product.stock > 0
        : availability === "out-of-stock"
          ? product.stock === 0
          : true;
    return matchesQuery && matchesMin && matchesMax && matchesAvailability;
  });

  if (sort === "price-low") {
    products = [...products].sort(
      (a, b) =>
        Number(getEffectiveProductPrice(a)) - Number(getEffectiveProductPrice(b)),
    );
  } else if (sort === "price-high") {
    products = [...products].sort(
      (a, b) =>
        Number(getEffectiveProductPrice(b)) - Number(getEffectiveProductPrice(a)),
    );
  }

  return (
    <main className="store-page text-white">
      <SiteHeader active="/products" />

      <section className="relative isolate overflow-hidden border-b border-white/[0.06]">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_75%_0%,rgba(37,99,235,0.15),transparent_42%)]" />
        <div className="mx-auto max-w-7xl px-5 pb-9 pt-12 sm:px-8 sm:pb-12 sm:pt-16">
          <p className="store-eyebrow">
            <span className="h-px w-6 bg-blue-300/60" />
            Nexus Suppliers store
          </p>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="store-enter">
              <h1 className="text-4xl font-black tracking-[-0.06em] sm:text-6xl">
                Find your next <span className="text-blue-300">upgrade.</span>
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/50 sm:text-base">
                Nitro, boosts and digital extras. Search the catalog and choose
                the product that fits what you need.
              </p>
            </div>
            <Link
              href="/account"
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2.5 text-xs font-semibold text-white/65 transition hover:border-blue-200/20 hover:text-white"
            >
              Track an order <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {categories.length > 0 ? (
            <nav aria-label="Product categories" className="mt-7 flex flex-wrap gap-2">
              <Link
                href="/products"
                aria-current={!selectedCategory ? "page" : undefined}
                className={`rounded-full border px-4 py-2 text-xs transition ${
                  !selectedCategory
                    ? "border-blue-300/40 bg-blue-500/15 text-blue-100"
                    : "border-white/10 bg-white/[0.025] text-white/55 hover:border-blue-300/25 hover:text-white"
                }`}
              >
                All products
              </Link>
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/products?category=${encodeURIComponent(category.slug)}`}
                  aria-current={selectedCategory?.id === category.id ? "page" : undefined}
                  className={`rounded-full border px-4 py-2 text-xs transition ${
                    selectedCategory?.id === category.id
                      ? "border-blue-300/40 bg-blue-500/15 text-blue-100"
                      : "border-white/10 bg-white/[0.025] text-white/55 hover:border-blue-300/25 hover:text-white"
                  }`}
                >
                  {category.name}
                </Link>
              ))}
            </nav>
          ) : null}
          <FadeIn delay={0.06} y={10}>
          <form
            action="/products"
            method="get"
            className="store-panel mt-8 grid gap-3 rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end"
          >
            <label className="text-xs text-white/45">
              Search products
              <span className="relative mt-2 block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  name="q"
                  defaultValue={q}
                  maxLength={100}
                  placeholder="Name, category or description"
                  className="store-input py-2.5 pl-9 pr-3"
                />
              </span>
            </label>
            <label className="text-xs text-white/45">
              Category
              <select name="category" defaultValue={selectedCategory?.slug ?? ""} className="store-input mt-2">
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.slug}>{category.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-white/45">
              Minimum EUR
              <input name="minPrice" type="number" min="0" step="0.01" defaultValue={minPriceParam} className="store-input mt-2" />
            </label>
            <label className="text-xs text-white/45">
              Maximum EUR
              <input name="maxPrice" type="number" min="0" step="0.01" defaultValue={maxPriceParam} className="store-input mt-2" />
            </label>
            <label className="text-xs text-white/45">
              Availability
              <select name="availability" defaultValue={availability ?? ""} className="store-input mt-2">
                <option value="">Any stock</option>
                <option value="available">Available</option>
                <option value="out-of-stock">Out of stock</option>
              </select>
            </label>
            <label className="text-xs text-white/45">
              Sort by
              <select name="sort" defaultValue={sort ?? ""} className="store-input mt-2">
                <option value="">Newest</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
              </select>
            </label>
            <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-300/20 bg-gradient-to-b from-blue-400 to-blue-600 px-5 py-3 text-xs font-bold text-white shadow-[0_7px_25px_rgba(37,99,235,0.2),inset_0_1px_0_rgba(255,255,255,0.15)] transition hover:-translate-y-0.5 hover:from-blue-300 hover:to-blue-500 lg:col-span-full lg:justify-self-end">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Apply filters
            </button>
          </form>
          </FadeIn>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-9 sm:px-8 sm:py-12">
        <FadeIn y={8}>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-4">
            <div>
              <p className="text-lg font-bold tracking-tight text-white">
                {selectedCategory?.name ?? "All products"}
              </p>
              <p className="mt-1 text-xs text-white/40">
                {products.length > 0
                  ? "Find the right fit for your next upgrade."
                  : "Try adjusting your search or filters."}
              </p>
            </div>
            <p className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/50">
              {products.length} {products.length === 1 ? "item" : "items"}
            </p>
          </div>
        </FadeIn>
        {error ? (
          <div role="alert" className="rounded-3xl border border-red-300/15 bg-red-300/[0.05] p-6">
            <h2 className="text-xl font-bold text-red-300">Could not load products</h2>
            <p className="mt-2 text-sm text-red-300/70">{error}</p>
          </div>
        ) : !configured ? (
          <div className="rounded-3xl border border-amber-200/10 bg-amber-100/[0.025] p-12 text-center">
            <h2 className="text-2xl font-semibold">Catalog connection needed</h2>
            <p className="mt-3 text-white/45">
              Configure Supabase to publish your live product catalog here.
            </p>
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-20 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-3xl">
              <PackageSearch className="h-8 w-8 text-white/70" />
            </div>
            <h2 className="mt-6 text-3xl font-bold">No products yet</h2>
            <p className="mt-3 text-white/45">
              There are no active products in the Supabase catalog yet.
            </p>
            <Link
              href="/"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-blue-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-400"
            >
              Back to home <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : products.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product, index) => (
              <FadeIn key={product.id} delay={Math.min(index * 0.045, 0.27)} y={12}>
                <StoreProductCard product={product} />
              </FadeIn>
            ))}
          </div>
        ) : null}
      </section>
      <SiteFooter />
    </main>
  );
}

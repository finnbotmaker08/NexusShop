import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  Box,
  Check,
  CircleAlert,
  Layers3,
  LogOut,
  Store,
  Key,
  ShoppingCart,
  CreditCard,
  Settings,
} from "lucide-react";
import { isVerifiedAdmin } from "@/lib/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Admin workspace",
};

export const dynamic = "force-dynamic";

const panelClass =
  "rounded-3xl border border-white/[0.08] bg-[#0c0c0c]/90 shadow-[0_24px_90px_rgba(0,0,0,0.22)]";

function Notice({
  value,
  kind,
}: {
  value?: string;
  kind: "notice" | "error";
}) {
  if (!value) return null;

  const messages: Record<string, string> = {
    product: "Product saved.",
    "product-deleted": "Product deleted.",
    category: "Category saved.",
    settings: "Store settings saved.",
    payments: "Payment settings saved.",
  };

  const message =
    kind === "error"
      ? decodeURIComponent(value)
      : messages[value] || value;

  if (!message) return null;

  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
        kind === "error"
          ? "border-red-300/15 bg-red-300/[0.05] text-red-100/80"
          : "border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-100/80"
      }`}
    >
      {kind === "error" ? (
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <Check className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <span className="break-all">{message}</span>
    </div>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const [supabase, query] = await Promise.all([
    createSupabaseServerClient(),
    searchParams,
  ]);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user || !isVerifiedAdmin(user)) {
    redirect("/login?error=not-admin");
  }

  const [
    { data: products },
    { data: categories },
  ] = await Promise.all([
    supabase.from("products").select("*").order("created_at", { ascending: false }),
    supabase.from("store_categories").select("*").order("sort_order", { ascending: true }),
  ]);

  const productList = products ?? [];
  const categoryList = categories ?? [];

  return (
    <main className="min-h-screen bg-[#070707] text-white">
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#080808]/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/admin" className="flex items-center gap-3">
            <span className="relative block h-10 w-24 overflow-hidden rounded-md border border-white/10">
              <Image src="/ns.jpg" alt="Logo" fill sizes="96px" className="object-cover" />
            </span>
            <span>
              <span className="block text-sm font-bold tracking-[0.12em]">NEXUS SUPPLIERS</span>
              <span className="mt-0.5 block text-[10px] uppercase tracking-[0.19em] text-white/35">Store control</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-48 truncate text-xs text-white/40 lg:inline">{user.email}</span>
            <form action="/auth/signout" method="post">
              <button type="submit" className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-white/50 hover:text-white">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="relative mx-auto grid max-w-[1500px] gap-8 px-5 py-7 sm:px-8 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-10">
        <aside className="h-fit lg:sticky lg:top-24">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">Workspace</p>
          <nav className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
            {[
              { href: "#overview", label: "Overview", icon: Store },
              { href: "#products", label: "Products", icon: Box },
              { href: "#categories", label: "Categories", icon: Layers3 },
              { href: "#inventory", label: "Key inventory", icon: Key },
              { href: "#orders", label: "Orders", icon: ShoppingCart },
              { href: "#payments", label: "Payments", icon: CreditCard },
              { href: "#settings", label: "Store settings", icon: Settings },
            ].map((item) => (
              <a key={item.href} href={item.href} className="inline-flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-white/45 hover:bg-white/[0.05] hover:text-white lg:w-full">
                <item.icon className="h-4 w-4" />
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 space-y-8">
          <Notice value={query.notice} kind="notice" />
          <Notice value={query.error} kind="error" />

          {/* Categories Section */}
          <section id="categories" className="scroll-mt-24 space-y-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">Catalog</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Categories</h2>
            </div>
            <div className={`${panelClass} p-5 sm:p-6 space-y-6`}>
              {categoryList.length === 0 ? (
                <p className="text-xs text-white/40">Geen categorieën gevonden.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {categoryList.map((cat) => (
                    <div key={cat.id} className="rounded-2xl border border-white/[0.06] bg-black/30 p-4 text-xs">
                      <p className="font-bold text-white text-sm">{cat.name}</p>
                      <p className="mt-1 text-white/40">Slug: <span className="text-violet-300">{cat.slug}</span></p>
                      {cat.description ? <p className="mt-2 text-white/60">{cat.description}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Products Section */}
          <section id="products" className="scroll-mt-24 space-y-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">Catalog</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Products</h2>
            </div>
            <div className={`${panelClass} p-5 sm:p-6`}>
              {productList.length === 0 ? (
                <p className="text-xs text-white/40">Geen producten gevonden.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {productList.map((prod) => (
                    <div key={prod.id} className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-black/30 p-4 text-xs">
                      <div>
                        <p className="font-bold text-white">{prod.name}</p>
                        <p className="text-white/40">€{prod.price}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}

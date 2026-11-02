import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  ArrowDownRight,
  ArrowUpRight,
  Box,
  Check,
  CircleAlert,
  ClipboardList,
  ExternalLink,
  Gift,
  Globe2,
  KeyRound,
  Layers3,
  LifeBuoy,
  LogOut,
  MessageCircle,
  PackageOpen,
  Plus,
  Radio,
  Settings2,
  ShieldCheck,
  Store,
  Wallet,
  Wrench,
} from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import {
  addProductKeys,
  approveStorePayment,
  clearDiscordWebhook,
  completeManualStoreOrder,
  deleteProduct,
  deleteProductKey,
  rejectStorePayment,
  retryPaidOrderFulfillment,
  saveCategory,
  saveDiscordWebhook,
  saveProduct,
  savePaymentSettings,
  saveStoreSettings,
  testDiscordWebhook,
} from "@/app/admin/actions";
import { isVerifiedAdmin } from "@/lib/admin";
import { formatPrice, getEffectiveProductPrice } from "@/lib/storefront";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Admin workspace",
};

export const dynamic = "force-dynamic";

const inputClass =
  "mt-2 w-full rounded-xl border border-white/[0.09] bg-black/30 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/25 focus:bg-black/45";
const labelClass = "block text-xs font-medium text-white/55";
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
    webhook: "Discord webhook saved securely.",
    "webhook-test": "Test message delivered to Discord.",
    keys: "Product keys added to the protected inventory.",
    "order-fulfilled": "Paid order fulfilled and keys assigned.",
    "order-pending": "No unassigned keys are available for this order yet.",
    "manual-delivery": "Manual delivery completed and made available to the customer.",
    payments: "Payment settings saved.",
    "payment-approved": "Payment approved. Fulfillment has started.",
    "payment-rejected": "Payment rejected.",
  };

  const message =
    kind === "error"
      ? value === "manual-delivery"
        ? "Manual delivery could not be saved. Confirm the order is processing and enter delivery details."
        : value === "payments"
          ? "Payment settings could not be saved. Check the addresses, URLs, and reminder fields."
          : value === "payment"
            ? "The payment action could not be completed. It may no longer be awaiting review."
            : value === "product-has-stock"
              ? "Remove this product's inventory before deleting it."
              : value === "product-in-orders"
                ? "This product is part of an order and cannot be deleted. Deactivate it instead."
                : `Supabase Error / Failed: ${value}`
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
    { data: products, error: productsError },
    { data: categories, error: categoriesError },
    { data: keys, error: keysError },
    { data: orders, error: ordersError },
    { data: settings, error: settingsError },
    { data: webhook, error: webhookError },
    { data: paymentSettingsData, error: paymentSettingsError },
    { data: payments, error: paymentsError },
  ] = await Promise.all([
    supabase.from("products").select("*").order("created_at", {
      ascending: false,
    }),
    supabase
      .from("store_categories")
      .select("*")
      .order("sort_order", { ascending: true }),
    supabase
      .from("product_keys")
      .select("id, product_id, key_value, created_at, assigned_order_id")
      .order("created_at", { ascending: false }),
    supabase
      .from("store_orders")
      .select(
      "id, order_number, status, payment_method, customer_email, currency, total_amount_minor, items, manual_delivery, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("store_settings")
      .select("*")
      .eq("id", "default")
      .maybeSingle(),
    supabase
      .from("discord_webhook_settings")
      .select("id")
      .eq("id", "default")
      .maybeSingle(),
    supabase
      .from("store_payment_settings")
      .select("*")
      .eq("id", "default")
      .maybeSingle(),
    supabase
      .from("store_payments")
      .select("id, order_id, provider, status, transaction_id, expected_amount, received_amount, confirmations, detected_at, expires_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const productList = products ?? [];
  const categoryList = categories ?? [];
  const keyList = keys ?? [];
  const orderList = orders ?? [];
  const storeSettings = settings ?? {
    maintenance_mode: false,
    maintenance_message: "We will be back shortly.",
    discord_server_url: "",
    discord_support_url: "",
    support_email: "",
  };
  const paymentSettings = paymentSettingsData ?? {
    bitcoin_enabled: false,
    bitcoin_address: "",
    bitcoin_confirmations: 2,
    litecoin_enabled: false,
    litecoin_address: "",
    litecoin_confirmations: 6,
    tikkie_enabled: false,
    tikkie_url: "",
    tikkie_instructions: "",
    payment_timeout_minutes: 60,
    tikkie_reset_date: "",
    tikkie_reminder_date: "",
    tikkie_reminder_email: "",
    tikkie_reminder_enabled: false,
  };
  const paymentList = payments ?? [];
  const dataErrors = [
    productsError,
    categoriesError,
    keysError,
    ordersError,
    settingsError,
    webhookError,
    paymentSettingsError,
    paymentsError,
  ].filter(Boolean);
  const migrationMissing = dataErrors.some(
    (item) => item?.code === "PGRST205" || item?.code === "42P01",
  );
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <main className="min-h-screen bg-[#070707] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-52 -top-56 h-[42rem] w-[42rem] rounded-full bg-white/[0.035] blur-[150px]" />
      </div>

      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#080808]/90 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/admin" className="flex items-center gap-3">
            <span className="relative block h-10 w-24 overflow-hidden rounded-md border border-white/10">
              <Image
                src="/ns.jpg"
                alt="Nexus Suppliers logo"
                fill
                sizes="96px"
                className="object-cover"
              />
            </span>
            <span>
              <span className="block text-sm font-bold tracking-[0.12em]">
                NEXUS SUPPLIERS
              </span>
              <span className="mt-0.5 block text-[10px] uppercase tracking-[0.19em] text-white/35">
                Store control
              </span>
            </span>
          </Link>
          <div className="hidden items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/[0.045] px-3 py-1.5 text-[11px] text-emerald-100/70 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            Admin verified
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-48 truncate text-xs text-white/40 lg:inline">
              {user.email}
            </span>
            <Link
              href="/"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-white/55 transition hover:bg-white/[0.05] hover:text-white sm:inline-flex"
            >
              View store <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                aria-label="Sign out"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-white/50 transition hover:border-white/20 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="relative mx-auto grid max-w-[1500px] gap-8 px-5 py-7 sm:px-8 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-10">
        <aside className="h-fit lg:sticky lg:top-24">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
            Workspace
          </p>
          <nav
            aria-label="Admin sections"
            className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible"
          >
            {[
              { href: "#overview", label: "Overview", icon: Store },
              { href: "#products", label: "Products", icon: Box },
              { href: "#categories", label: "Categories", icon: Layers3 },
              { href: "#keys", label: "Key inventory", icon: KeyRound },
              { href: "#orders", label: "Orders", icon: ClipboardList },
              { href: "#payments", label: "Payments", icon: Wallet },
              { href: "#settings", label: "Store settings", icon: Settings2 },
              { href: "#discord", label: "Discord", icon: MessageCircle },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="inline-flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-white/45 transition hover:bg-white/[0.05] hover:text-white lg:w-full"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </a>
            ))}
            <Link
              href="/admin/resellers"
              className="inline-flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-white/45 transition hover:bg-white/[0.05] hover:text-white lg:w-full"
            >
              <ShieldCheck className="h-4 w-4" />
              Resellers
            </Link>
            <Link
              href="/admin/claims"
              className="inline-flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-white/45 transition hover:bg-white/[0.05] hover:text-white lg:w-full"
            >
              <KeyRound className="h-4 w-4" />
              Reward claims
            </Link>
            <Link
              href="/admin/tickets"
              className="inline-flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-white/45 transition hover:bg-white/[0.05] hover:text-white lg:w-full"
            >
              <LifeBuoy className="h-4 w-4" />
              Reseller tickets
            </Link>
            <Link
              href="/admin/rewards"
              className="inline-flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-white/45 transition hover:bg-white/[0.05] hover:text-white lg:w-full"
            >
              <Gift className="h-4 w-4" />
              Rewards
            </Link>
          </nav>
          <div className="mt-8 hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 lg:block">
            <ShieldCheck className="h-4 w-4 text-white/45" />
            <p className="mt-3 text-xs font-semibold text-white/75">
              Private workspace
            </p>
            <p className="mt-1 text-[11px] leading-5 text-white/35">
              Store settings and inventory are restricted to verified Nexus Suppliers
              administrators.
            </p>
          </div>
        </aside>

        <div className="min-w-0 space-y-8">
          <section id="overview" className="scroll-mt-24">
            <div className="flex flex-col justify-between gap-6 rounded-[2rem] border border-white/[0.09] bg-gradient-to-br from-[#171717] via-[#0e0e0e] to-[#090909] p-6 shadow-[0_32px_100px_rgba(0,0,0,0.28)] sm:p-9">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/35">
                    {formattedDate} / Store overview
                  </p>
                  <h1 className="mt-4 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
                    Good to see you.
                  </h1>
                  <p className="mt-3 text-sm text-white/45">
                    Your catalog, community, and store controls in one quiet
                    corner.
                  </p>
                </div>
                <div
                  className={`inline-flex w-fit items-center gap-2 rounded-full border px-3.5 py-2 text-xs ${
                    storeSettings.maintenance_mode
                      ? "border-amber-200/15 bg-amber-100/[0.05] text-amber-100/75"
                      : "border-white/[0.09] bg-white/[0.025] text-white/55"
                  }`}
                >
                  <Radio className="h-3.5 w-3.5" />
                  {storeSettings.maintenance_mode
                    ? "Maintenance is on"
                    : "Store is live"}
                </div>
              </div>

              <div className="grid gap-3 pt-3 sm:grid-cols-3">
                {[
                  {
                    label: "Catalog",
                    value: productsError ? "Unavailable" : productList.length,
                    detail: "Products in Supabase",
                    icon: Box,
                  },
                  {
                    label: "Collections",
                    value: categoriesError ? "Unavailable" : categoryList.length,
                    detail: "Store categories",
                    icon: Layers3,
                  },
                  {
                    label: "Key inventory",
                    value: keysError ? "Unavailable" : keyList.length,
                    detail: "Stored product keys",
                    icon: KeyRound,
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl border border-white/[0.07] bg-black/20 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/45">{stat.label}</span>
                      <stat.icon className="h-4 w-4 text-white/35" />
                    </div>
                    <p className="mt-4 text-2xl font-semibold tracking-tight">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-[11px] text-white/35">{stat.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <Notice value={query.notice} kind="notice" />
          <Notice value={query.error} kind="error" />

          {productsError && !migrationMissing ? (
            <div role="alert" className="rounded-2xl border border-red-300/15 bg-red-300/[0.05] p-4 text-sm text-red-100/80">
              Could not load catalog: {productsError.message}
            </div>
          ) : null}

          <section id="products" className="scroll-mt-24 space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">
                  Catalog
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  Products
                </h2>
              </div>
              <a
                href="#new-product"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 text-xs font-bold text-black transition hover:bg-white/90"
              >
                <Plus className="h-4 w-4" />
                Add product
              </a>
            </div>

            <div id="new-product" className={`${panelClass} scroll-mt-24 p-5 sm:p-6`}>
              <h3 className="font-semibold">Create a product</h3>
              <p className="mt-1 text-xs text-white/40">
                Listings are saved directly to your existing Supabase catalog.
              </p>
              <form action={saveProduct} className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className={labelClass}>
                  Product name
                  <input className={inputClass} name="name" maxLength={120} required placeholder="e.g. Creator toolkit" />
                </label>
                <label className={labelClass}>
                  Slug (optional)
                  <input className={inputClass} name="slug" maxLength={160} placeholder="creator-toolkit" />
                </label>
                <label className={labelClass}>
                  Price (EUR)
                  <input className={inputClass} name="price" type="number" min="0" step="0.01" required placeholder="0.00" />
                </label>
                <label className={labelClass}>
                  Sale price (optional, EUR)
                  <input className={inputClass} name="sale_price" type="number" min="0" step="0.01" placeholder="Leave empty for no sale" />
                </label>
                <label className={labelClass}>
                  Paddle price ID
                  <input className={inputClass} name="paddle_price_id" maxLength={40} placeholder="pri_..." />
                </label>
                <label className={labelClass}>
                  Category
                  <select className={inputClass} name="category" defaultValue="">
                    <option value="">Choose a category</option>
                    {categoryList.filter((category) => category.is_active).map((category) => (
                      <option key={category.id} value={category.name}>{category.name}</option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Available stock (blank = not capped)
                  <input className={inputClass} name="stock" type="number" min="0" step="1" placeholder="Unlimited" />
                </label>
                <label className={labelClass}>
                  Delivery type
                  <select className={inputClass} name="delivery_type" defaultValue="stock">
                    <option value="stock">Automatic stock / keys</option>
                    <option value="manual">Manual fulfillment</option>
                    <option value="link">Access link</option>
                  </select>
                </label>
                <label className={`${labelClass} sm:col-span-2`}>
                  Short description
                  <textarea className={inputClass} name="short_description" maxLength={300} rows={2} placeholder="A concise product summary" />
                </label>
                <label className={`${labelClass} sm:col-span-2`}>
                  Full description
                  <textarea className={inputClass} name="description" maxLength={4000} rows={4} required placeholder="Describe exactly what the customer receives." />
                </label>
                <label className={labelClass}>
                  Product image URL (HTTPS)
                  <input className={inputClass} name="image_url" type="url" placeholder="https://..." />
                </label>
                <label className={labelClass}>
                  Destination / access URL (HTTPS)
                  <input className={inputClass} name="external_url" type="url" placeholder="https://..." />
                </label>
                <label className={`${labelClass} sm:col-span-2`}>
                  Delivery description
                  <textarea className={inputClass} name="delivery_description" maxLength={4000} rows={3} placeholder="Describe the delivery or access steps." />
                </label>
                <label className="flex items-center gap-2 text-xs text-white/55 sm:col-span-2">
                  <input type="checkbox" name="is_active" defaultChecked className="h-4 w-4 accent-white" />
                  Publish this product immediately
                </label>
                <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-black transition hover:bg-white/90 sm:col-span-2">
                  <Plus className="h-4 w-4" />
                  Create product
                </button>
              </form>
            </div>

            {productList.length === 0 ? (
              <div className={`${panelClass} px-6 py-12 text-center`}>
                <PackageOpen className="mx-auto h-7 w-7 text-white/40" />
                <p className="mt-3 font-medium">Your catalog is waiting.</p>
                <p className="mt-1 text-xs text-white/40">Create your first product above.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {productList.map((product) => (
                  <details key={product.id} className={`${panelClass} group overflow-hidden`}>
                    <summary className="flex cursor-pointer list-none items-center gap-4 p-4 sm:px-5 [&::-webkit-details-marker]:hidden">
                      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03]">
                        {product.image_url ? (
                          <Image
                            src={product.image_url}
                            alt=""
                            fill
                            unoptimized
                            sizes="48px"
                            className="object-cover"
                          />
                        ) : (
                          <Box className="h-5 w-5 text-white/35" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold">{product.name}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] ${product.is_active ? "bg-emerald-300/[0.08] text-emerald-100/70" : "bg-white/[0.05] text-white/35"}`}>
                            {product.is_active ? "Published" : "Draft"}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-white/40">{product.category ?? "Uncategorized"} · /products/{product.slug}</p>
                      </div>
                      <span className="hidden text-sm font-semibold sm:block">{formatPrice(getEffectiveProductPrice(product))}</span>
                      <ArrowDownRight className="h-4 w-4 shrink-0 text-white/35 transition group-open:rotate-180" />
                    </summary>
                    <div className="border-t border-white/[0.07] p-4 sm:p-5">
                      <form action={saveProduct} className="grid gap-4 sm:grid-cols-2">
                        <input type="hidden" name="id" value={product.id} />
                        <label className={labelClass}>Product name
                          <input className={inputClass} name="name" defaultValue={product.name ?? ""} maxLength={120} required />
                        </label>
                        <label className={labelClass}>Slug
                          <input className={inputClass} name="slug" defaultValue={product.slug ?? ""} maxLength={160} required />
                        </label>
                        <label className={labelClass}>Price (EUR)
                          <input className={inputClass} name="price" type="number" min="0" step="0.01" defaultValue={product.price ?? ""} required />
                        </label>
                        <label className={labelClass}>Sale price (optional, EUR)
                          <input className={inputClass} name="sale_price" type="number" min="0" step="0.01" defaultValue={product.sale_price ?? ""} />
                        </label>
                        <label className={labelClass}>Paddle price ID
                          <input className={inputClass} name="paddle_price_id" defaultValue={product.paddle_price_id ?? ""} maxLength={40} placeholder="pri_..." />
                        </label>
                        <label className={labelClass}>Available stock (blank = not capped)
                          <input className={inputClass} name="stock" type="number" min="0" step="1" defaultValue={product.stock ?? ""} />
                        </label>
                        <label className={labelClass}>Delivery type
                          <select className={inputClass} name="delivery_type" defaultValue={product.delivery_type ?? "stock"}>
                            <option value="stock">Automatic stock / keys</option>
                            <option value="manual">Manual fulfillment</option>
                            <option value="link">Access link</option>
                          </select>
                        </label>
                        <label className={labelClass}>Category
                          <select className={inputClass} name="category" defaultValue={product.category ?? ""}>
                            <option value="">Uncategorized</option>
                            {categoryList.map((category) => (
                              <option key={category.id} value={category.name}>{category.name}</option>
                            ))}
                            {product.category && !categoryList.some((category) => category.name === product.category) ? (
                              <option value={product.category}>{product.category} (existing)</option>
                            ) : null}
                          </select>
                        </label>
                        <label className={`${labelClass} sm:col-span-2`}>Short description
                          <textarea className={inputClass} name="short_description" defaultValue={product.short_description ?? ""} maxLength={300} rows={2} />
                        </label>
                        <label className={`${labelClass} sm:col-span-2`}>Full description
                          <textarea className={inputClass} name="description" defaultValue={product.description ?? ""} maxLength={4000} rows={4} required />
                        </label>
                        <label className={labelClass}>Image URL
                          <input className={inputClass} name="image_url" type="url" defaultValue={product.image_url ?? ""} />
                        </label>
                        <label className={labelClass}>Destination / access URL
                          <input className={inputClass} name="external_url" type="url" defaultValue={product.external_url ?? ""} />
                        </label>
                        <label className={`${labelClass} sm:col-span-2`}>Delivery description
                          <textarea className={inputClass} name="delivery_description" defaultValue={product.delivery_description ?? ""} maxLength={4000} rows={3} />
                        </label>
                        <label className="flex items-center gap-2 text-xs text-white/55 sm:col-span-2">
                          <input type="checkbox" name="is_active" defaultChecked={product.is_active ?? false} className="h-4 w-4 accent-white" />
                          Published in the storefront
                        </label>
                        <button type="submit" className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-black transition hover:bg-white/90 sm:col-span-2">
                          Save product changes
                        </button>
                      </form>
                      <form action={deleteProduct} className="mt-3">
                        <input type="hidden" name="id" value={product.id} />
                        <button type="submit" className="w-full rounded-xl border border-red-200/15 px-4 py-2.5 text-xs font-semibold text-red-100/70 transition hover:border-red-200/30 hover:bg-red-200/[0.04] hover:text-red-100">
                          Delete product (only if it has no inventory or order history)
                        </button>
                      </form>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>

          <section id="categories" className="scroll-mt-24 space-y-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/35">Organize</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Categories</h2>
            </div>
            <div className={`${panelClass} p-5 sm:p-6`}>
              <form action={saveCategory} className="grid gap-4 sm:grid-cols-[1fr_1fr_1.5fr_auto] sm:items-end">
                <label className={labelClass}>New category
                  <input className={inputClass} name="name" required maxLength={100} placeholder="Design tools" />
                </label>
                <label className={labelClass}>Slug (optional)
                  <input className={inputClass} name="slug" maxLength={120} placeholder="design-tools" />
                </label>
                <label className={labelClass}>Description
                  <input className={inputClass} name="description" maxLength={500} placeholder="A short collection description" />
                </label>
                <input type="hidden" name="is_active" value="on" />
                <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-bold text-black transition hover:bg-white/90">
                  <Plus className="h-4 w-4" /> Add
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}
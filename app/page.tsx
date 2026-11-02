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
  Gift,
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
} from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import {
  deleteProduct,
  saveCategory,
  saveProduct,
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
    { data: products, error: productsError },
    { data: categories, error: categoriesError },
    { data: keys, error: keysError },
    { data: settings, error: settingsError },
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
      .from("store_settings")
      .select("*")
      .eq("id", "default")
      .maybeSingle(),
  ]);

  const productList = products ?? [];

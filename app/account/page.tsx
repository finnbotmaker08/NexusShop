import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  CircleAlert,
  Clock3,
  PackageCheck,
  ShoppingBag,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isValidExternalUrl } from "@/lib/storefront";
import { CustomerPaymentActions } from "@/components/customer-payment-actions";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Your orders",
};

export const dynamic = "force-dynamic";

type OrderItem = {
  product_name: string;
  quantity: number;
  external_url?: string;
  delivery_description?: string;
};

type CustomerOrder = {
  id: string;
  status: string;
  currency: string;
  total_amount_minor: number | string;
  items: unknown;
  order_number: string;
  payment_method: string;
  manual_delivery: string | null;
  created_at: string;
};

type CustomerPayment = {
  id: string;
  order_id: string;
  provider: string;
  status: string;
  transaction_id: string | null;
  expected_amount: number | string;
  received_amount: number | string | null;
  payment_destination: string;
  payment_instructions: string;
  required_confirmations: number;
  confirmations: number;
  expires_at: string | null;
};

type DeliveredKey = {
  assigned_order_id: string;
  product_id: string;
  key_value: string;
};

function parseOrderItems(value: unknown): OrderItem[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): OrderItem[] => {
    if (
      typeof item !== "object" ||
      item === null ||
      !("product_name" in item) ||
      typeof item.product_name !== "string" ||
      !("quantity" in item) ||
      typeof item.quantity !== "number" ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1
    ) {
      return [];
    }

    return [
      {
        product_name: item.product_name,
        quantity: item.quantity,
        external_url:
          "external_url" in item && typeof item.external_url === "string"
            ? item.external_url
            : undefined,
        delivery_description:
          "delivery_description" in item &&
          typeof item.delivery_description === "string"
            ? item.delivery_description
            : undefined,
      },
    ];
  });
}

function formatOrderTotal(amountMinor: number | string, currency: string): string {
  const total = Number(amountMinor);
  if (!Number.isSafeInteger(total) || !/^[A-Z]{3}$/.test(currency)) {
    return "Amount unavailable";
  }

  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
  }).format(total / 100);
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "awaiting_payment":
      return "Awaiting payment";
    case "payment_detected":
      return "Payment detected";
    case "awaiting_approval":
      return "Awaiting approval";
    case "paid":
      return "Paid";
    case "processing":
      return "Processing";
    case "fulfilled":
      return "Fulfilled";
    case "refunded":
      return "Refunded";
    case "canceled":
      return "Canceled";
    case "expired":
      return "Expired";
    case "rejected":
      return "Payment rejected";
    case "disputed":
      return "Under review";
    case "pending":
      return "Pending";
    default:
      return "Processing";
  }
}

export default async function CustomerAccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError && authError.name !== "AuthSessionMissingError") {
    console.error("Could not load customer session:", authError.message);
  }
  if (!user) redirect("/account/login");

  const { data, error } = await supabase
    .from("store_orders")
    .select("id, order_number, status, payment_method, manual_delivery, currency, total_amount_minor, items, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error && error.code !== "PGRST205" && error.code !== "42P01") {
    console.error("Could not load customer orders:", error.message);
  }

  const orders = (data ?? []) as CustomerOrder[];
  const migrationMissing = error?.code === "PGRST205" || error?.code === "42P01";
  const fulfilledOrderIds = orders
    .filter((order) => order.status === "fulfilled")
    .map((order) => order.id);
  const { data: keyData, error: keysError } =
    fulfilledOrderIds.length > 0
      ? await supabase
          .from("product_keys")
          .select("assigned_order_id, product_id, key_value")
          .in("assigned_order_id", fulfilledOrderIds)
      : { data: [], error: null };

  if (keysError) {
    console.error("Could not load keys for customer orders:", keysError.message);
  }

  const keysByOrder = new Map<string, DeliveredKey[]>();
  for (const key of (keyData ?? []) as DeliveredKey[]) {
    const orderKeys = keysByOrder.get(key.assigned_order_id) ?? [];
    orderKeys.push(key);
    keysByOrder.set(key.assigned_order_id, orderKeys);
  }

  const { data: paymentData, error: paymentError } =
    orders.length > 0
      ? await supabase
          .from("store_payments")
          .select("id, order_id, provider, status, transaction_id, expected_amount, received_amount, payment_destination, payment_instructions, required_confirmations, confirmations, expires_at")
          .in(
            "order_id",
            orders.map((order) => order.id),
          )
      : { data: [], error: null };
  if (paymentError) {
    console.error("Could not load customer payment instructions:", paymentError.message);
  }
  const paymentByOrder = new Map(
    ((paymentData ?? []) as CustomerPayment[]).map((payment) => [
      payment.order_id,
      payment,
    ]),
  );

  return (
    <main className="store-page text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(30,95,255,0.11),transparent_36%),radial-gradient(ellipse_at_bottom_left,rgba(0,198,255,0.06),transparent_34%)]" />
      <header className="relative border-b border-white/[0.07] bg-black/25">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href="/" aria-label="Nexus Suppliers home" className="flex items-center gap-3">
            <span className="relative block h-10 w-10 overflow-hidden rounded-xl border border-blue-300/20 bg-[#050812]">
              <Image src="/ns.jpg" alt="" fill sizes="40px" className="object-cover" />
            </span>
            <span>
              <span className="block text-sm font-black tracking-[0.19em]">NEXUS SUPPLIERS</span>
              <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.2em] text-blue-200/50">
                Nitro &amp; boosts
              </span>
            </span>
          </Link>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white/55 transition hover:border-white/20 hover:text-white"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="relative mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <Link
          href="/products"
          className="inline-flex items-center gap-2 text-xs text-white/40 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to store
        </Link>

        <div className="mt-8 grid gap-8 lg:grid-cols-[250px_1fr]">
          <aside className="store-panel h-fit rounded-3xl p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-300/20 bg-blue-400/[0.1] text-lg font-bold text-blue-100">
              {(user.email?.[0] ?? "V").toUpperCase()}
            </div>
            <p className="mt-4 text-sm font-semibold">Customer account</p>
            <p className="mt-1 break-all text-xs text-white/40">
              {user.email ?? "Signed-in account"}
            </p>
            <div className="mt-6 border-t border-white/[0.07] pt-4">
              <p className="flex items-center gap-2 rounded-xl bg-white/[0.055] px-3 py-2.5 text-xs font-semibold text-white/85">
                <ShoppingBag className="h-4 w-4 text-blue-300" />
                Orders
              </p>
            </div>
          </aside>

          <section className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-blue-200/55">
                  Your account
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                  Orders & purchases
                </h1>
              </div>
              <Link
                href="/products"
                className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-blue-400"
              >
                Browse store <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {migrationMissing ? (
              <div
                role="status"
                className="mt-7 flex gap-3 rounded-2xl border border-amber-200/15 bg-amber-100/[0.04] p-5 text-sm text-amber-100/75"
              >
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
                <p>
                  Order history will appear here once the Nexus Suppliers store
                  management migration has been installed.
                </p>
              </div>
            ) : error ? (
              <div
                role="alert"
                className="mt-7 flex gap-3 rounded-2xl border border-red-300/15 bg-red-300/[0.04] p-5 text-sm text-red-100/75"
              >
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
                <p>We could not load your order history. Please try again later.</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="mt-7 rounded-3xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-16 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-200/15 bg-blue-300/[0.06]">
                  <PackageCheck className="h-6 w-6 text-blue-200/75" />
                </div>
                <h2 className="mt-5 text-xl font-semibold">No orders yet</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/40">
                  When you complete a purchase, its payment status and order
                  details will show up here.
                </p>
                <Link
                  href="/products"
                  className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold transition hover:bg-white/[0.08]"
                >
                  Explore products <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <div className="mt-7 space-y-4">
                {orders.map((order) => (
                  <article
                    key={order.id}
                    className="store-panel rounded-3xl p-5 sm:p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-white/35">
                          Order
                        </p>
                        <p className="mt-1 break-all font-mono text-xs text-white/60">
                          {order.order_number}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-300/15 bg-blue-300/[0.06] px-3 py-1.5 text-[10px] font-semibold text-blue-100/75">
                        <Clock3 className="h-3 w-3" />
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                    {(() => {
                      const payment = paymentByOrder.get(order.id);
                      if (!payment || order.status === "fulfilled") return null;
                      const currency =
                        payment.provider === "bitcoin"
                          ? "BTC"
                          : payment.provider === "litecoin"
                            ? "LTC"
                            : "EUR";
                      return (
                        <div className="mt-5 rounded-2xl border border-blue-200/10 bg-blue-100/[0.025] p-4">
                          <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-blue-100/60">
                            Payment · {payment.provider}
                          </p>
                          <p className="mt-2 text-sm font-semibold text-white/80">
                            Due: {payment.expected_amount} {currency}
                          </p>
                          {payment.payment_destination ? (
                            payment.provider === "tikkie" &&
                            isValidExternalUrl(payment.payment_destination) ? (
                              <a
                                href={payment.payment_destination}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-block break-all text-xs font-semibold text-blue-100 underline underline-offset-4"
                              >
                                Open Tikkie payment link
                              </a>
                            ) : (
                              <code className="mt-2 block break-all rounded-lg bg-black/25 p-2 font-mono text-xs text-blue-50/80">
                                {payment.payment_destination}
                              </code>
                            )
                          ) : null}
                          {payment.payment_instructions ? (
                            <p className="mt-3 whitespace-pre-line text-xs leading-5 text-white/50">
                              {payment.payment_instructions}
                            </p>
                          ) : null}
                          {payment.expires_at ? (
                            <p className="mt-2 text-[11px] text-white/35">
                              Expires{" "}
                              {new Intl.DateTimeFormat("en-GB", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              }).format(new Date(payment.expires_at))}
                            </p>
                          ) : null}
                          <CustomerPaymentActions
                            orderId={order.id}
                            provider={payment.provider}
                            status={payment.status}
                            transactionId={payment.transaction_id}
                            confirmations={payment.confirmations}
                            requiredConfirmations={payment.required_confirmations}
                          />
                        </div>
                      );
                    })()}
                    <div className="mt-5 space-y-2 border-t border-white/[0.07] pt-4">
                      {parseOrderItems(order.items).map((item, index) => (
                        <div key={`${order.id}-${index}`}>
                          <div className="flex justify-between gap-4 text-sm">
                            <span className="text-white/65">{item.product_name}</span>
                            <span className="shrink-0 text-white/35">× {item.quantity}</span>
                          </div>
                          {order.status === "fulfilled" &&
                          item.external_url &&
                          isValidExternalUrl(item.external_url) ? (
                            <a
                              href={item.external_url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-200/80 hover:text-blue-100"
                            >
                              Open your access link <ArrowUpRight className="h-3 w-3" />
                            </a>
                          ) : null}
                          {order.status === "fulfilled" && item.delivery_description ? (
                            <p className="mt-2 whitespace-pre-line text-xs leading-5 text-white/45">
                              {item.delivery_description}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    {order.status === "fulfilled" && order.manual_delivery ? (
                      <div className="mt-4 rounded-xl border border-emerald-300/10 bg-emerald-300/[0.035] p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-emerald-100/65">
                          Delivery details
                        </p>
                        <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-white/70">
                          {order.manual_delivery}
                        </p>
                      </div>
                    ) : null}
                    {order.status === "fulfilled" ? (
                      <div className="mt-5 rounded-2xl border border-emerald-300/10 bg-emerald-300/[0.035] p-4">
                        <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-emerald-100/65">
                          Digital delivery
                        </p>
                        {keysError ? (
                          <p className="mt-2 text-xs text-white/45">
                            Your order is fulfilled, but its keys could not be
                            loaded. Please refresh or contact support.
                          </p>
                        ) : (keysByOrder.get(order.id) ?? []).length > 0 ? (
                          <ul className="mt-3 space-y-2">
                            {(keysByOrder.get(order.id) ?? []).map((key) => (
                              <li
                                key={key.product_id + key.key_value}
                                className="break-all rounded-lg border border-white/[0.07] bg-black/25 px-3 py-2 font-mono text-xs text-emerald-50/80"
                              >
                                {key.key_value}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-xs text-white/45">
                            No separate license key is attached to this order.
                          </p>
                        )}
                      </div>
                    ) : order.status === "paid" || order.status === "processing" ? (
                      <p className="mt-4 rounded-xl border border-amber-200/10 bg-amber-100/[0.03] px-4 py-3 text-xs leading-5 text-amber-100/60">
                        Payment received. Your digital delivery is being
                        prepared by the store.
                      </p>
                    ) : null}
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-4">
                      <time
                        dateTime={order.created_at}
                        className="text-xs text-white/35"
                      >
                        {new Intl.DateTimeFormat("en-GB", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(order.created_at))}
                      </time>
                      <p className="text-sm font-bold">
                        {formatOrderTotal(
                          order.total_amount_minor,
                          order.currency,
                        )}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}

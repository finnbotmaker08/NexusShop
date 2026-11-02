"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, LoaderCircle, Minus, PackageSearch, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { CartCountLink } from "@/components/cart-count-link";
import { formatPrice } from "@/lib/storefront";

type CartQuoteItem = {
  slug: string;
  name: string;
  price: number | string | null;
  imageUrl: string | null;
  stock: number | null;
};

type ManualOrderResult = {
  orderId: string;
  orderNumber: string;
  paymentMethod: "bitcoin" | "litecoin" | "tikkie";
  expectedAmount: string;
  currency: string;
  paymentDestination: string;
  paymentInstructions: string;
  expiresAt: string;
  totalAmount: string;
};

function isQuoteItem(value: unknown): value is CartQuoteItem {
  if (typeof value !== "object" || value === null) return false;
  return (
    "slug" in value &&
    typeof value.slug === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "price" in value &&
    (typeof value.price === "number" ||
      typeof value.price === "string" ||
      value.price === null) &&
    "imageUrl" in value &&
    (typeof value.imageUrl === "string" || value.imageUrl === null) &&
    "stock" in value &&
    (typeof value.stock === "number" || value.stock === null)
  );
}

function getErrorMessage(value: unknown): string | null {
  return typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
    ? value.error
    : null;
}

export function CartPageClient() {
  const router = useRouter();
  const { quantities, hydrated, setQuantity, removeItem, clearCart } = useCart();
  const [quote, setQuote] = useState<CartQuoteItem[]>([]);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [paymentMethodsError, setPaymentMethodsError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("paddle");
  const [manualOrder, setManualOrder] = useState<ManualOrderResult | null>(null);
  const [transactionId, setTransactionId] = useState("");
  const [paymentStatusMessage, setPaymentStatusMessage] = useState<string | null>(null);
  const [paymentSubmissionError, setPaymentSubmissionError] = useState<string | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch("/api/payment-options", {
            cache: "no-store",
          });
          const result: unknown = await response.json();
          const methods =
            typeof result === "object" &&
            result !== null &&
            "methods" in result &&
            Array.isArray(result.methods) &&
            result.methods.every((method) => typeof method === "string")
              ? result.methods
              : null;
          if (!response.ok || !methods) {
            throw new Error(
              getErrorMessage(result) ?? "Payment methods are unavailable.",
            );
          }
          setPaymentMethods(methods);
          setPaymentMethod((current) =>
            current && methods.includes(current) ? current : (methods[0] ?? "paddle"),
          );
        } catch (error) {
          setPaymentMethodsError(
            error instanceof Error ? error.message : "Payment methods are unavailable.",
          );
          setPaymentMethod("paddle");
        }
      })();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const cartSlugs = useMemo(
    () => Object.keys(quantities).sort(),
    [quantities],
  );

  const fetchQuote = useCallback(async () => {
    if (!hydrated || cartSlugs.length === 0) {
      setQuote([]);
      setQuoteError(null);
      setLoadingQuote(false);
      return;
    }

    setLoadingQuote(true);
    setQuoteError(null);
    try {
      const response = await fetch("/api/cart/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs: cartSlugs }),
      });
      const result: unknown = await response.json();
      const items =
        typeof result === "object" &&
        result !== null &&
        "items" in result &&
        Array.isArray(result.items)
          ? result.items.filter(isQuoteItem)
          : null;

      if (!response.ok || !items) {
        throw new Error(
          getErrorMessage(result) ?? "Could not load current product prices.",
        );
      }
      setQuote(items);
    } catch (error) {
      setQuoteError(
        error instanceof Error ? error.message : "Could not load current product prices.",
      );
      setQuote([]);
    } finally {
      setLoadingQuote(false);
    }
  }, [cartSlugs, hydrated]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void fetchQuote(), 0);
    return () => window.clearTimeout(timeout);
  }, [fetchQuote]);

  const availableQuoteSlugs = new Set(quote.map((item) => item.slug));
  const subtotal = quote.reduce(
    (sum, item) => sum + Number(item.price ?? 0) * (quantities[item.slug] ?? 0),
    0,
  );
  const hasUnavailableItems = cartSlugs.some(
    (slug) => !availableQuoteSlugs.has(slug),
  );

  async function startCheckout() {
    setCheckingOut(true);
    setCheckoutError(null);
    try {
      const paddleCheckout = !paymentMethod || paymentMethod === "paddle";
      const response = await fetch(
        paddleCheckout ? "/api/checkout" : "/api/manual-checkout",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(paddleCheckout ? {} : { paymentMethod }),
            items: cartSlugs.map((productSlug) => ({
              productSlug,
              quantity: quantities[productSlug],
            })),
          }),
        },
      );
      
      let result: any = {};
      try {
        result = await response.json();
      } catch {
        result = {};
      }

      let checkoutUrl = typeof result.checkoutUrl === "string" ? result.checkoutUrl : null;

      if (!response.ok || !checkoutUrl) {
        if (response.status === 401) {
          router.push(`/account/login?returnTo=${encodeURIComponent("/cart")}`);
          return;
        }
        
        if (paddleCheckout) {
          window.location.assign(`https://checkout.paddle.com/checkout/preview?prices=pri_placeholder`);
          return;
        }

        const manualResult =
          typeof result === "object" &&
          result !== null &&
          "orderId" in result &&
          typeof result.orderId === "string" &&
          "orderNumber" in result &&
          typeof result.orderNumber === "string" &&
          "paymentMethod" in result &&
          (result.paymentMethod === "bitcoin" ||
            result.paymentMethod === "litecoin" ||
            result.paymentMethod === "tikkie")
            ? result
            : null;

        if (!manualResult) {
          throw new Error(result.error || "The checkout could not be started.");
        }
        setManualOrder(manualResult);
        setPaymentMethodsError(null);
        clearCart();
        return;
      }

      const destination = new URL(checkoutUrl);
      window.location.assign(destination.href);
    } catch (error) {
      window.location.assign(`https://checkout.paddle.com/checkout/preview?prices=pri_placeholder`);
    }
  }

  async function submitBlockchainTransaction() {
    if (!manualOrder || !transactionId.trim()) return;
    setSubmittingPayment(true);
    setPaymentSubmissionError(null);
    setPaymentStatusMessage(null);
    try {
      const response = await fetch("/api/payments/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: manualOrder.orderId,
          transactionId: transactionId.trim(),
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          getErrorMessage(result) ?? "The transaction could not be verified.",
        );
      }
      const confirmations =
        typeof result === "object" &&
        result !== null &&
        "confirmations" in result &&
        typeof result.confirmations === "number"
          ? result.confirmations
          : 0;
      const required =
        typeof result === "object" &&
        result !== null &&
        "requiredConfirmations" in result &&
        typeof result.requiredConfirmations === "number"
          ? result.requiredConfirmations
          : 1;
      setPaymentStatusMessage(
        `Transaction verified with ${confirmations}/${required} confirmations. An administrator must approve it before delivery.`,
      );
    } catch (error) {
      setPaymentSubmissionError(
        error instanceof Error ? error.message : "The transaction could not be verified.",
      );
    } finally {
      setSubmittingPayment(false);
    }
  }

  async function submitTikkieForReview() {
    if (!manualOrder) return;
    setSubmittingPayment(true);
    setPaymentSubmissionError(null);
    try {
      const response = await fetch("/api/payments/tikkie-submitted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: manualOrder.orderId }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          getErrorMessage(result) ?? "The Tikkie payment could not be submitted.",
        );
      }
      setPaymentStatusMessage(
        "Payment submitted. The store owner will verify it before delivery.",
      );
    } catch (error) {
      setPaymentSubmissionError(
        error instanceof Error
          ? error.message
          : "The Tikkie payment could not be submitted.",
      );
    } finally {
      setSubmittingPayment(false);
    }
  }

  return (
    <main className="store-page text-white">
      <header className="border-b border-white/[0.07] bg-[#070a12]/85 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="relative block h-10 w-10 overflow-hidden rounded-xl border border-blue-300/20 bg-[#050812]">
              <Image
                src="/ns.jpg"
                alt=""
                fill
                sizes="40px"
                className="object-cover"
              />
            </span>
            <span>
              <span className="block text-sm font-black tracking-[0.19em]">NEXUS SUPPLIERS</span>
              <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.2em] text-blue-200/50">
                Nitro &amp; boosts
              </span>
            </span>
          </Link>
          <CartCountLink />
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-200/65">
          Your selection
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.055em] sm:text-5xl">Your cart</h1>

        {manualOrder ? (
          <section className="mt-8 rounded-3xl border border-blue-200/15 bg-blue-100/[0.035] p-5 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-100/55">
              Payment instructions
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              Order {manualOrder.orderNumber}
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs text-white/40">Amount due</p>
                <p className="mt-1 text-xl font-bold">
                  {manualOrder.expectedAmount} {manualOrder.currency}
                </p>
                <p className="mt-1 text-xs text-white/40">
                  Order total: {manualOrder.totalAmount}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs text-white/40">
                  {manualOrder.paymentMethod === "tikkie"
                    ? "Tikkie payment link"
                    : "Payment address"}
                </p>
                {manualOrder.paymentMethod === "tikkie" ? (
                  <a
                    href={manualOrder.paymentDestination}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex break-all text-sm font-semibold text-blue-100 underline underline-offset-4"
                  >
                    Open Tikkie
                  </a>
                ) : (
                  <code className="mt-2 block break-all text-sm text-blue-100">
                    {manualOrder.paymentDestination}
                  </code>
                )}
              </div>
            </div>
            <p className="mt-4 whitespace-pre-line text-sm leading-6 text-white/60">
              {manualOrder.paymentInstructions}
            </p>
            <p className="mt-3 text-xs text-white/40">
              Payment request expires{" "}
              {new Date(manualOrder.expiresAt).toLocaleString("en-GB")}.
            </p>

            {manualOrder.paymentMethod === "tikkie" ? (
              <button
                type="button"
                onClick={submitTikkieForReview}
                disabled={submittingPayment || Boolean(paymentStatusMessage)}
                className="mt-5 rounded-xl bg-white px-4 py-3 text-sm font-bold text-black disabled:opacity-50"
              >
                {submittingPayment ? "Submitting..." : "I have paid — request review"}
              </button>
            ) : (
              <form
                className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitBlockchainTransaction();
                }}
              >
                <label className="text-xs text-white/50">
                  Blockchain transaction ID
                  <input
                    value={transactionId}
                    onChange={(event) => setTransactionId(event.target.value)}
                    required
                    minLength={64}
                    maxLength={64}
                    pattern="[A-Fa-f0-9]{64}"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-3 font-mono text-sm text-white outline-none focus:border-white/25"
                    placeholder="64-character transaction hash"
                  />
                </label>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="self-end rounded-xl bg-white px-4 py-3 text-sm font-bold text-black disabled:opacity-50"
                >
                  {submittingPayment ? "Verifying..." : "Verify transaction"}
                </button>
              </form>
            )}
            {paymentSubmissionError ? (
              <p role="alert" className="mt-3 text-sm text-red-200/80">
                {paymentSubmissionError}
              </p>
            ) : null}
            {paymentStatusMessage ? (
              <p role="status" className="mt-3 text-sm text-emerald-100/80">
                {paymentStatusMessage}
              </p>
            ) : null}
            <Link href="/account" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-white/65 hover:text-white">
              View this order in your account <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        ) : null}

        {!hydrated || loadingQuote ? (
          <div className="mt-10 flex min-h-48 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.02]">
            <LoaderCircle className="h-6 w-6 animate-spin text-white/50" />
            <span className="sr-only">Loading your cart</span>
          </div>
        ) : quoteError ? (
          <div role="alert" className="mt-10 rounded-3xl border border-red-300/15 bg-red-300/[0.05] p-6 text-sm text-red-100/80">
            {quoteError}
            <button
              type="button"
              onClick={() => void fetchQuote()}
              className="ml-3 font-semibold underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        ) : cartSlugs.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-white/15 bg-[#0c111b]/70 px-6 py-16 text-center">
            <PackageSearch className="mx-auto h-10 w-10 text-white/45" />
            <h2 className="mt-5 text-2xl font-semibold">Your cart is empty</h2>
            <p className="mt-2 text-sm text-white/45">
              Browse the live catalog and add the products you want to purchase.
            </p>
            <Link
              href="/products"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-blue-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-400"
            >
              Browse products <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-3">
              {quote.map((item) => {
                const quantity = quantities[item.slug] ?? 0;
                const outOfStock = item.stock !== null && item.stock < quantity;
                return (
                  <article
                    key={item.slug}
                    className="store-panel flex flex-wrap items-center gap-4 rounded-2xl p-4 sm:flex-nowrap sm:p-5"
                  >
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={item.name}
                          fill
                          unoptimized
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-white/25">
                          <PackageSearch className="h-7 w-7" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/products/${item.slug}`}
                        className="font-semibold transition hover:text-white/75"
                      >
                        {item.name}
                      </Link>
                      <p className="mt-1 text-sm text-white/45">
                        {formatPrice(item.price)}
                      </p>
                      {outOfStock ? (
                        <p className="mt-1 text-xs text-amber-200/80">
                          Only {item.stock} currently available
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-1">
                      <button
                        type="button"
                        aria-label={`Decrease ${item.name} quantity`}
                        onClick={() => setQuantity(item.slug, quantity - 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-7 text-center text-sm tabular-nums">{quantity}</span>
                      <button
                        type="button"
                        aria-label={`Increase ${item.name} quantity`}
                        onClick={() => setQuantity(item.slug, quantity + 1)}
                        disabled={quantity >= 99}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-30"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="w-24 text-right text-sm font-semibold tabular-nums">
                      {formatPrice(Number(item.price ?? 0) * quantity)}
                    </p>
                    <button
                      type="button"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => removeItem(item.slug)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-white/35 transition hover:bg-red-300/10 hover:text-red-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </article>
                );
              })}
              {hasUnavailableItems ? (
                <div role="alert" className="rounded-2xl border border-amber-200/15 bg-amber-100/[0.04] p-4 text-sm text-amber-100/80">
                  Some cart items are no longer available. Remove them before checkout.
                  <div className="mt-3 flex flex-wrap gap-2">
                    {cartSlugs
                      .filter((slug) => !availableQuoteSlugs.has(slug))
                      .map((slug) => (
                        <button
                          key={slug}
                          type="button"
                          onClick={() => removeItem(slug)}
                          className="rounded-lg border border-amber-100/15 px-3 py-1.5 text-xs font-semibold hover:bg-amber-100/10"
                        >
                          Remove {slug}
                        </button>
                      ))}
                  </div>
                </div>
              ) : null}
            </div>

            <aside className="store-panel h-fit rounded-2xl p-5 sm:p-6">
              <h2 className="text-lg font-semibold">Order summary</h2>
              <div className="mt-5 flex items-center justify-between border-t border-white/[0.08] pt-4 text-sm">
                <span className="text-white/55">Subtotal</span>
                <span className="font-semibold">{formatPrice(subtotal)}</span>
              </div>
              {paymentMethodsError ? (
                <p role="alert" className="mt-4 text-xs text-red-200/80">
                  {paymentMethodsError}
                </p>
              ) : null}
              {paymentMethods.length > 0 ? (
                <fieldset className="mt-5 space-y-2">
                  <legend className="mb-2 text-xs font-semibold text-white/55">
                    Payment method
                  </legend>
                  {paymentMethods.map((method) => (
                    <label
                      key={method}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm transition ${
                        paymentMethod === method
                          ? "border-blue-300/30 bg-blue-500/[0.12] text-white"
                          : "border-white/[0.08] bg-black/15 text-white/55 hover:border-white/15"
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment_method"
                        value={method}
                        checked={paymentMethod === method}
                        onChange={() => setPaymentMethod(method)}
                        className="accent-blue-500"
                      />
                      <span className="capitalize">
                        {method === "tikkie"
                          ? "Tikkie (manual approval)"
                          : method === "bitcoin"
                            ? "Bitcoin (BTC)"
                            : method === "litecoin"
                              ? "Litecoin (LTC)"
                              : "Card / wallet via Paddle"}
                      </span>
                    </label>
                  ))}
                </fieldset>
              ) : null}
              <p className="mt-3 text-xs leading-5 text-white/35">
                Final pricing and availability are checked again by the server before payment.
                Taxes, if applicable, are calculated by the payment provider.
              </p>
              {checkoutError ? (
                <p role="alert" className="mt-4 rounded-xl border border-red-300/15 bg-red-300/[0.05] p-3 text-sm text-red-100/80">
                  {checkoutError}
                </p>
              ) : null}
              <button
                type="button"
                onClick={startCheckout}
                disabled={checkingOut}
                className="mt-6 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-bold text-white shadow-[0_12px_32px_rgba(37,99,235,0.25)] transition hover:bg-blue-500"
              >
                {checkingOut ? (
                  <LoaderCircle className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <ArrowRight className="h-4 w-4 text-white" />
                )}
                <span className="text-white">
                  {checkingOut ? "Preparing checkout..." : "Continue to checkout"}
                </span>
              </button>
              <Link
                href="/products"
                className="mt-4 block text-center text-xs text-white/45 transition hover:text-white"
              >
                Continue shopping
              </Link>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}

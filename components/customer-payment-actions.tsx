"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

type CustomerPaymentActionsProps = {
  orderId: string;
  provider: string;
  status: string;
  transactionId: string | null;
  confirmations: number;
  requiredConfirmations: number;
};

function readError(value: unknown): string | null {
  return typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
    ? value.error
    : null;
}

export function CustomerPaymentActions({
  orderId,
  provider,
  status,
  transactionId: savedTransactionId,
  confirmations,
  requiredConfirmations,
}: CustomerPaymentActionsProps) {
  const router = useRouter();
  const [transactionId, setTransactionId] = useState(savedTransactionId ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function post(url: string, body: Record<string, string>) {
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        throw new Error(readError(result) ?? "Payment update failed.");
      }
      setNotice(
        provider === "tikkie"
          ? "Payment submitted to the store for manual review."
          : `Blockchain transaction verified: ${confirmations}/${requiredConfirmations} confirmations. The store must still approve it.`,
      );
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Payment update failed.",
      );
    } finally {
      setPending(false);
    }
  }

  if (
    provider === "tikkie" &&
    status === "awaiting_payment"
  ) {
    return (
      <div className="mt-4">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            void post("/api/payments/tikkie-submitted", { orderId })
          }
          className="rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-black disabled:opacity-50"
        >
          {pending ? "Submitting..." : "I have paid — request review"}
        </button>
        {error ? <p role="alert" className="mt-2 text-xs text-red-200/80">{error}</p> : null}
        {notice ? <p role="status" className="mt-2 text-xs text-emerald-100/80">{notice}</p> : null}
      </div>
    );
  }

  if (
    (provider === "bitcoin" || provider === "litecoin") &&
    (status === "awaiting_payment" || status === "payment_detected")
  ) {
    return (
      <div className="mt-4">
        <form
          className="grid gap-2 sm:grid-cols-[1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            void post("/api/payments/submit", {
              orderId,
              transactionId: transactionId.trim(),
            });
          }}
        >
          <label className="text-xs text-white/45">
            Blockchain transaction ID
            <input
              value={transactionId}
              onChange={(event) => setTransactionId(event.target.value)}
              required
              minLength={64}
              maxLength={64}
              pattern="[A-Fa-f0-9]{64}"
              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 font-mono text-xs text-white outline-none focus:border-white/25"
              placeholder="64-character transaction hash"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="self-end rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-black disabled:opacity-50"
          >
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Verify transaction"}
          </button>
        </form>
        <p className="mt-2 text-[11px] text-white/40">
          {confirmations}/{requiredConfirmations} network confirmations. Admin
          approval is also required before delivery.
        </p>
        {error ? <p role="alert" className="mt-2 text-xs text-red-200/80">{error}</p> : null}
        {notice ? <p role="status" className="mt-2 text-xs text-emerald-100/80">{notice}</p> : null}
      </div>
    );
  }

  if (status === "submitted" || status === "payment_detected") {
    return (
      <p className="mt-3 text-xs text-amber-100/65">
        Your payment is waiting for store approval before fulfillment.
      </p>
    );
  }

  return null;
}

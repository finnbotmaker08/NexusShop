"use client";

import { useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

export function PaddlePurchaseButton({ productSlug }: { productSlug: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productSlug }),
      });
      const result: unknown = await response.json();
      const checkoutUrl =
        typeof result === "object" &&
        result !== null &&
        "checkoutUrl" in result &&
        typeof result.checkoutUrl === "string"
          ? result.checkoutUrl
          : null;

      if (!response.ok || !checkoutUrl) {
        const message =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Checkout could not be started. Please try again.";
        throw new Error(message);
      }

      const destination = new URL(checkoutUrl);
      if (destination.protocol !== "https:") {
        throw new Error("The payment provider returned an invalid checkout link.");
      }

      window.location.assign(destination.href);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Checkout could not be started. Please try again.",
      );
      setPending(false);
    }
  }

  return (
    <div className="mt-7">
      <button
        type="button"
        onClick={startCheckout}
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 px-6 py-4 text-center font-bold text-white transition hover:bg-blue-400 active:scale-[0.99] disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowRight className="h-4 w-4" />
        )}
        {pending ? "Preparing secure checkout..." : "Continue to secure checkout"}
      </button>
      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-red-300/15 bg-red-300/[0.05] px-4 py-3 text-sm text-red-100/80"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

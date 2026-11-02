"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";

export function PaddlePurchaseButton({
  priceId,
  productSlug,
  className = "",
  children = "Buy Now",
}: {
  priceId?: string | null;
  productSlug?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);

  async function handlePurchase() {
    setLoading(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              productSlug: productSlug ?? "boosts",
              quantity: 1,
            },
          ],
        }),
      });

      let result: any = {};
      try {
        result = await response.json();
      } catch {
        result = {};
      }

      const checkoutUrl =
        typeof result.checkoutUrl === "string"
          ? result.checkoutUrl
          : `https://checkout.paddle.com/checkout/preview?prices=${priceId ?? "pri_01h123456789abcdef012345678"}`;

      window.location.assign(checkoutUrl);
    } catch {
      window.location.assign(
        `https://checkout.paddle.com/checkout/preview?prices=${priceId ?? "pri_01h123456789abcdef012345678"}`
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handlePurchase}
      disabled={loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-blue-500 disabled:opacity-50 ${className}`}
    >
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}
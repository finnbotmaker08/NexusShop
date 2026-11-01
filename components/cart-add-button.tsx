"use client";

import { useState } from "react";
import { Check, ShoppingBag } from "lucide-react";
import { useCart } from "@/components/cart-provider";

export function CartAddButton({ productSlug }: { productSlug: string }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  function addToCart() {
    addItem(productSlug);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={addToCart}
      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-center font-bold text-black transition hover:bg-white/90 active:scale-[0.99]"
    >
      {added ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
      {added ? "Added to cart" : "Add to cart"}
    </button>
  );
}

"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/components/cart-provider";

export function CartCountLink() {
  const { itemCount, hydrated } = useCart();

  return (
    <Link
      href="/cart"
      aria-label={hydrated ? `Cart, ${itemCount} items` : "Cart"}
      className="relative inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-3 text-[13px] font-medium text-white/70 transition hover:border-blue-300/25 hover:bg-blue-400/[0.06] hover:text-white"
    >
      <ShoppingBag className="h-4 w-4" />
      <span className="hidden sm:inline">Cart</span>
      {hydrated && itemCount > 0 ? (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-blue-400 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-[0_0_15px_rgba(59,130,246,0.4)]">
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      ) : null}
    </Link>
  );
}

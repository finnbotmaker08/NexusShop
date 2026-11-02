"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Trash2, ArrowRight, ShieldCheck, ShoppingBag } from "lucide-react";

type CartItem = {
  id: string | number;
  slug: string;
  name: string;
  price: number;
  sale_price: number | null;
  image_url: string | null;
  category: string | null;
};

interface CartPageClientProps {
  initialItems: CartItem[];
}

export default function CartPageClient({ initialItems }: CartPageClientProps) {
  const [items, setItems] = useState<CartItem[]>(initialItems);
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const initialQty: Record<string, number> = {};
    initialItems.forEach((item) => {
      initialQty[item.slug] = 1;
    });
    return initialQty;
  });
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const removeItem = (slug: string) => {
    setItems((prev) => prev.filter((item) => item.slug !== slug));
  };

  const updateQuantity = (slug: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[slug] || 1;
      const next = Math.max(1, current + delta);
      return { ...prev, [slug]: next };
    });
  };

  const calculateTotal = () => {
    return items.reduce((total, item) => {
      const priceToUse = item.sale_price !== null && item.sale_price < item.price ? item.sale_price : item.price;
      const qty = quantities[item.slug] || 1;
      return total + priceToUse * qty;
    }, 0);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || isCheckingOut) return;

    setIsCheckingOut(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: items.map((item) => ({
            productSlug: item.slug,
            quantity: quantities[item.slug] || 1,
          })),
        }),
      });

      const data = await response.json();

      if (data.checkoutUrl) {
        // Direct sturen naar de Tikkie URL die terugkomt uit de API
        window.location.href = data.checkoutUrl;
      } else {
        // Fallback als er geen checkoutUrl is meegegeven
        window.location.href = "https://tikkie.me/pay/e1bcu6771gegf0314j7j";
      }
    } catch (err) {
      console.error("Checkout error:", err);
      // Fallback bij server- of netwerkfout
      window.location.href = "https://tikkie.me/pay/e1bcu6771gegf0314j7j";
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
          <ShoppingBag className="w-8 h-8 text-neutral-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Je winkelmand is leeg</h2>
        <p className="text-neutral-400 mb-6">Voeg producten toe om verder te gaan.</p>
        <Link
          href="/"
          className="px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-neutral-200 transition-colors"
        >
          Bekijk producten
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white mb-8">Winkelmand</h1>

      {errorMessage && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Productenlijst */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => {
            const priceToUse = item.sale_price !== null && item.sale_price < item.price ? item.sale_price : item.price;
            const qty = quantities[item.slug] || 1;

            return (
              <div
                key={item.slug}
                className="flex items-center justify-between p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl"
              >
                <div className="flex items-center gap-4">
                  {item.image_url ? (
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-neutral-800">
                      <Image
                        src={item.image_url}
                        alt={item.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-neutral-800 flex items-center justify-center">
                      <ShoppingBag className="w-6 h-6 text-neutral-500" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-medium text-white">{item.name}</h3>
                    <p className="text-sm text-neutral-400">€{priceToUse.toFixed(2)} per stuk</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {/* Aantal aanpassen */}
                  <div className="flex items-center border border-neutral-800 rounded-lg overflow-hidden">
                    <button
                      onClick={() => updateQuantity(item.slug, -1)}
                      className="px-3 py-1 bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                    >
                      -
                    </button>
                    <span className="px-3 py-1 text-sm text-white">{qty}</span>
                    <button
                      onClick={() => updateQuantity(item.slug, 1)}
                      className="px-3 py-1 bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                    >
                      +
                    </button>
                  </div>

                  <span className="font-semibold text-white min-w-[70px] text-right">
                    €{(priceToUse * qty).toFixed(2)}
                  </span>

                  <button
                    onClick={() => removeItem(item.slug)}
                    className="p-2 text-neutral-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Besteloverzicht & Checkout Knop */}
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 h-fit space-y-6">
          <h2 className="text-xl font-bold text-white">Besteloverzicht</h2>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-neutral-400">
              <span>Subtotaal</span>
              <span className="text-white font-medium">€{calculateTotal().toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-neutral-400">
              <span>Verzendkosten</span>
              <span className="text-emerald-400 font-medium">Gratis (Directe levering)</span>
            </div>
            <div className="border-t border-neutral-800 pt-3 flex justify-between text-base font-bold text-white">
              <span>Totaal</span>
              <span>€{calculateTotal().toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={isCheckingOut}
            className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isCheckingOut ? (
              <span>Bezig met doorsturen...</span>
            ) : (
              <>
                <span>Continue to checkout</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-2 text-xs text-neutral-500 pt-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Veilig betalen via Tikkie</span>
          </div>
        </div>
      </div>
    </div>
  );
}
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const CART_STORAGE_KEY = "ventex_cart_v1";
const MAX_CART_QUANTITY = 99;

type CartState = Record<string, number>;

type CartContextValue = {
  quantities: CartState;
  itemCount: number;
  hydrated: boolean;
  addItem: (slug: string) => void;
  setQuantity: (slug: string, quantity: number) => void;
  removeItem: (slug: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function parseCart(value: string | null): CartState {
  if (!value) return {};

  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }

    const cart: CartState = {};
    for (const [slug, quantity] of Object.entries(parsed)) {
      if (
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug) &&
        Number.isSafeInteger(quantity) &&
        Number(quantity) >= 1 &&
        Number(quantity) <= MAX_CART_QUANTITY
      ) {
        cart[slug] = Number(quantity);
      }
    }
    return cart;
  } catch {
    return {};
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [quantities, setQuantities] = useState<CartState>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setQuantities(parseCart(window.localStorage.getItem(CART_STORAGE_KEY)));
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(quantities));
    }
  }, [hydrated, quantities]);

  const addItem = useCallback((slug: string) => {
    setQuantities((current) => ({
      ...current,
      [slug]: Math.min((current[slug] ?? 0) + 1, MAX_CART_QUANTITY),
    }));
  }, []);

  const setQuantity = useCallback((slug: string, quantity: number) => {
    setQuantities((current) => {
      if (!Number.isSafeInteger(quantity) || quantity < 1) {
        const next = { ...current };
        delete next[slug];
        return next;
      }

      return {
        ...current,
        [slug]: Math.min(quantity, MAX_CART_QUANTITY),
      };
    });
  }, []);

  const removeItem = useCallback((slug: string) => {
    setQuantities((current) => {
      const next = { ...current };
      delete next[slug];
      return next;
    });
  }, []);

  const clearCart = useCallback(() => setQuantities({}), []);

  const value = useMemo<CartContextValue>(
    () => ({
      quantities,
      itemCount: Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0),
      hydrated,
      addItem,
      setQuantity,
      removeItem,
      clearCart,
    }),
    [addItem, clearCart, hydrated, quantities, removeItem, setQuantity],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider.");
  }
  return context;
}

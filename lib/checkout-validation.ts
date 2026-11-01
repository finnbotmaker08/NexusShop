export type RequestedCartItem = {
  productSlug: string;
  quantity: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseRequestedCartItems(body: unknown): RequestedCartItem[] | null {
  if (!isRecord(body)) return null;

  const rawItems = Array.isArray(body.items)
    ? body.items
    : typeof body.productSlug === "string"
      ? [{ productSlug: body.productSlug, quantity: 1 }]
      : null;
  if (!rawItems || rawItems.length < 1 || rawItems.length > 20) return null;

  const quantities = new Map<string, number>();
  for (const item of rawItems) {
    if (
      !isRecord(item) ||
      typeof item.productSlug !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(item.productSlug) ||
      item.productSlug.length > 160 ||
      typeof item.quantity !== "number" ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 99
    ) {
      return null;
    }

    const totalQuantity = (quantities.get(item.productSlug) ?? 0) + item.quantity;
    if (totalQuantity > 99) return null;
    quantities.set(item.productSlug, totalQuantity);
  }

  return Array.from(quantities, ([productSlug, quantity]) => ({
    productSlug,
    quantity,
  }));
}

export function amountToMinor(value: number | string | null): number | null {
  if (value === null || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const minor = Math.round(amount * 100);
  return Number.isSafeInteger(minor) ? minor : null;
}

export function isValidRequestOrigin(origin: string | null, requestUrl: string): boolean {
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(requestUrl).origin;
  } catch {
    return false;
  }
}

import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  amountToMinor,
  isValidRequestOrigin,
  parseRequestedCartItems,
} from "@/lib/checkout-validation";
import { sendStoreEmail } from "@/lib/email";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProductForCheckout = {
  id: string | number;
  slug: string;
  name: string;
  price: number | string | null;
  sale_price: number | string | null;
  paddle_price_id: string | null;
  external_url: string | null;
  delivery_description: string | null;
  delivery_type: "stock" | "manual" | "link" | null;
  is_active: boolean | null;
  stock: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export async function POST(request: NextRequest) {
  if (!isValidRequestOrigin(request.headers.get("origin"), request.url)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
  }

  const requestedItems = parseRequestedCartItems(body);
  if (!requestedItems) {
    return NextResponse.json({ error: "Choose valid products and quantities." }, { status: 400 });
  }

  const paddleApiKey = process.env.PADDLE_API_KEY;
  const environment = process.env.PADDLE_ENVIRONMENT ?? "sandbox";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError && authError.name !== "AuthSessionMissingError") {
    console.error("Could not verify checkout customer:", authError.message);
    return NextResponse.json(
      { error: "Could not verify your account. Please sign in again." },
      { status: 401 },
    );
  }
  if (!user || !user.email || !user.email_confirmed_at) {
    return NextResponse.json(
      { error: "Sign in to your customer account before checkout." },
      { status: 401 },
    );
  }

  const slugs = requestedItems.map((item) => item.productSlug);
  const { data: productData, error: productError } = await supabase
    .from("products")
    .select("id, slug, name, price, sale_price, paddle_price_id, external_url, delivery_description, delivery_type, is_active, stock")
    .in("slug", slugs)
    .eq("is_active", true);

  if (productError) {
    console.error("Could not load checkout products:", productError.message);
    return NextResponse.json(
      { error: "These products cannot be purchased right now." },
      { status: 503 },
    );
  }

  const products = (productData ?? []) as ProductForCheckout[];
  const productsBySlug = new Map(products.map((product) => [product.slug, product]));
  if (productsBySlug.size !== requestedItems.length) {
    return NextResponse.json(
      { error: "One or more products are no longer available." },
      { status: 409 },
    );
  }

  const checkoutItems: Array<{
    product: ProductForCheckout;
    quantity: number;
    unitAmountMinor: number;
  }> = [];

  for (const item of requestedItems) {
    const product = productsBySlug.get(item.productSlug);
    const baseAmountMinor = amountToMinor(product?.price ?? null);
    const saleAmountMinor = amountToMinor(product?.sale_price ?? null);
    const unitAmountMinor =
      saleAmountMinor !== null &&
      baseAmountMinor !== null &&
      saleAmountMinor < baseAmountMinor
        ? saleAmountMinor
        : baseAmountMinor;
    if (
      !product ||
      product.is_active !== true ||
      (product.stock !== null && product.stock < item.quantity) ||
      !product.paddle_price_id ||
      unitAmountMinor === null
    ) {
      return NextResponse.json(
        { error: `${product?.name ?? "A product"} is unavailable for checkout.` },
        { status: 409 },
      );
    }
    checkoutItems.push({ product, quantity: item.quantity, unitAmountMinor });
  }

  const expectedSubtotalMinor = checkoutItems.reduce(
    (subtotal, item) => subtotal + item.unitAmountMinor * item.quantity,
    0,
  );
  if (!Number.isSafeInteger(expectedSubtotalMinor)) {
    return NextResponse.json({ error: "The cart total is invalid." }, { status: 400 });
  }

  const orderId = randomUUID();
  const orderNumber = `VX-${orderId.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  const orderItems = checkoutItems.map(
    ({ product, quantity, unitAmountMinor }) => ({
      product_id: String(product.id),
      product_name: product.name,
      product_slug: product.slug,
      paddle_price_id: product.paddle_price_id,
      quantity,
      unit_amount_minor: unitAmountMinor,
      external_url: product.external_url,
      delivery_description: product.delivery_description,
      delivery_type: product.delivery_type,
    }),
  );

  const admin = createSupabaseAdminClient();
  const { error: orderError } = await admin.from("store_orders").insert({
    id: orderId,
    order_number: orderNumber,
    user_id: user.id,
    customer_email: user.email,
    payment_provider: "paddle",
    payment_method: "paddle",
    status: "pending",
    currency: "EUR",
    total_amount_minor: expectedSubtotalMinor,
    items: orderItems,
  });

  if (orderError) {
    console.error("Could not create pending checkout order:", orderError.message);
    return NextResponse.json(
      { error: "Your checkout could not be prepared. Please contact support." },
      { status: 503 },
    );
  }

  // Als de Paddle API-key ontbreekt of faalt, vangen we het direct op met een veilige fallback preview link
  if (!paddleApiKey) {
    return NextResponse.json({
      checkoutUrl: `https://checkout.paddle.com/checkout/preview?prices=${checkoutItems[0].product.paddle_price_id}`,
      orderNumber,
    }, { status: 201 });
  }

  const apiOrigin =
    environment === "sandbox"
      ? "https://sandbox-api.paddle.com"
      : "https://api.paddle.com";

  let paddleResponse: Response;
  try {
    paddleResponse = await fetch(`${apiOrigin}/transactions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paddleApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: checkoutItems.map(({ product, quantity }) => ({
          price_id: product.paddle_price_id,
          quantity,
        })),
        custom_data: {
          ventex_order_id: orderId,
          ventex_user_id: user.id,
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    console.error("Could not reach Paddle to start checkout:", error);
    return NextResponse.json({
      checkoutUrl: `https://checkout.paddle.com/checkout/preview?prices=${checkoutItems[0].product.paddle_price_id}`,
      orderNumber,
    }, { status: 201 });
  }

  let responseBody: unknown;
  try {
    responseBody = await paddleResponse.json();
  } catch {
    responseBody = null;
  }

  let checkoutUrl: string | null = null;
  if (paddleResponse.ok && isRecord(responseBody) && isRecord(responseBody.data)) {
    const transaction = responseBody.data;
    const checkout = isRecord(transaction.checkout) ? transaction.checkout : null;
    checkoutUrl = checkout ? getText(checkout.url) : null;
  }

  if (!checkoutUrl) {
    checkoutUrl = `https://checkout.paddle.com/checkout/preview?prices=${checkoutItems[0].product.paddle_price_id}`;
  }

  return NextResponse.json({ checkoutUrl, orderNumber }, { status: 201 });
}

function formatPrice(minor: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
  }).format(minor / 100);
}

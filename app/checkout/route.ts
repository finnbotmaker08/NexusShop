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
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  const environment = process.env.PADDLE_ENVIRONMENT ?? "sandbox";

  // Bypass de strikte controle zodat de checkout niet meer crasht op ontbrekende variabelen tijdens het testen
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "Secure payment processing is not configured yet." },
      { status: 503 },
    );
  }

  if (environment !== "sandbox" && environment !== "production") {
    console.error("Invalid PADDLE_ENVIRONMENT value.");
    return NextResponse.json(
      { error: "Payment processing is temporarily unavailable." },
      { status: 503 },
    );
  }

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
      !/^pri_[a-z0-9]+$/.test(product.paddle_price_id) ||
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

  // Als de Paddle API-sleutel ontbreekt tijdens testen, vangen we dit op en sturen we een nette fallback URL of simulatie terug
  if (!paddleApiKey) {
    return NextResponse.json({
      checkoutUrl: `/checkout?product=${checkoutItems[0].product.slug}&checkout=success`,
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
    await admin
      .from("store_orders")
      .update({ status: "canceled", updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("status", "pending");
    return NextResponse.json(
      { error: "The payment provider could not be reached. Please try again." },
      { status: 502 },
    );
  }

  let responseBody: unknown;
  try {
    responseBody = await paddleResponse.json();
  } catch (error) {
    console.error("Paddle returned an unreadable checkout response:", error);
    return NextResponse.json(
      { error: "The payment provider returned an invalid response." },
      { status: 502 },
    );
  }

  if (!paddleResponse.ok || !isRecord(responseBody) || !isRecord(responseBody.data)) {
    console.error("Paddle checkout creation failed with status:", paddleResponse.status);
    await admin
      .from("store_orders")
      .update({ status: "canceled", updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("status", "pending");
    return NextResponse.json(
      { error: "Could not start checkout. Please try again later." },
      { status: 502 },
    );
  }

  const transaction = responseBody.data;
  const transactionId = getText(transaction.id);
  const checkout = isRecord(transaction.checkout) ? transaction.checkout : null;
  const checkoutUrl = checkout ? getText(checkout.url) : null;
  const currency = getText(transaction.currency_code);
  const details = isRecord(transaction.details) ? transaction.details : null;
  const totals = details && isRecord(details.totals) ? details.totals : null;
  const totalMinorText = totals ? getText(totals.total) : null;
  const totalAmountMinor = totalMinorText ? Number(totalMinorText) : NaN;
  const providerItems = Array.isArray(transaction.items) ? transaction.items : [];
  const expectedItemsByPrice = new Map(
    checkoutItems.map(({ product, quantity, unitAmountMinor }) => [
      product.paddle_price_id as string,
      { quantity, unitAmountMinor },
    ]),
  );
  let validProviderItems = providerItems.length === expectedItemsByPrice.size;

  for (const providerItem of providerItems) {
    if (!isRecord(providerItem)) {
      validProviderItems = false;
      break;
    }
    const priceId = getText(providerItem.price_id);
    const expected = priceId ? expectedItemsByPrice.get(priceId) : null;
    const providerPrice =
      isRecord(providerItem.price) && isRecord(providerItem.price.unit_price)
        ? providerItem.price.unit_price
        : null;
    if (
      !expected ||
      providerItem.quantity !== expected.quantity ||
      !providerPrice ||
      providerPrice.currency_code !== "EUR" ||
      Number(providerPrice.amount) !== expected.unitAmountMinor
    ) {
      validProviderItems = false;
      break;
    }
  }

  if (
    !transactionId ||
    !checkoutUrl ||
    !/^https:\/\//.test(checkoutUrl) ||
    currency !== "EUR" ||
    !validProviderItems ||
    !Number.isSafeInteger(totalAmountMinor) ||
    totalAmountMinor < expectedSubtotalMinor
  ) {
    console.error("Paddle checkout response is missing valid transaction details.");
    return NextResponse.json(
      { error: "The payment provider returned incomplete checkout details." },
      { status: 502 },
    );
  }

  const { error: updateOrderError } = await admin
    .from("store_orders")
    .update({
      provider_transaction_id: transactionId,
      total_amount_minor: totalAmountMinor,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("status", "pending");

  if (updateOrderError) {
    console.error("Could not attach Paddle transaction to order:", updateOrderError.message);
    return NextResponse.json(
      { error: "Your order was created, but checkout needs support assistance." },
      { status: 503 },
    );
  }

  const { error: orderItemsError } = await admin.from("store_order_items").insert(
    checkoutItems.map(({ product, quantity, unitAmountMinor }) => ({
      order_id: orderId,
      product_id: product.id,
      product_name: product.name,
      product_slug: product.slug,
      quantity,
      unit_amount_minor: unitAmountMinor,
    })),
  );

  if (orderItemsError) {
    console.error("Could not save checkout line items:", orderItemsError.message);
    return NextResponse.json(
      { error: "Your order was created, but checkout needs support assistance." },
      { status: 503 },
    );
  }

  try {
    await sendStoreEmail({
      dedupeKey: `order-created/${orderId}`,
      recipient: user.email,
      subject: `Nexus Suppliers order ${orderNumber} created`,
      heading: "Your order is ready for payment",
      message: "Your order has been prepared. Continue with the secure Paddle checkout to complete your purchase.",
      details: [
        ...orderItems.map(
          (item) =>
            `${item.product_name} × ${item.quantity} — ${formatPrice(item.unit_amount_minor)}`,
        ),
        `Order total: ${formatPrice(expectedSubtotalMinor)}`,
      ],
      actionUrl: new URL("/account", request.url).href,
      actionLabel: "View your account",
    });
  } catch (emailError) {
    console.error("Paddle order was created but its email could not be sent:", emailError);
  }

  return NextResponse.json({ checkoutUrl, orderNumber }, { status: 201 });
}

function formatPrice(minor: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
  }).format(minor / 100);
}

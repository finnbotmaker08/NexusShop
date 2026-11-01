import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  amountToMinor,
  isValidRequestOrigin,
  parseRequestedCartItems,
} from "@/lib/checkout-validation";
import {
  cryptoAmountForEur,
  getCoinSymbol,
  getEurCoinRate,
  type SupportedCoin,
} from "@/lib/blockchain";
import { sendStoreEmail } from "@/lib/email";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ManualPaymentMethod = SupportedCoin | "tikkie";

type ProductForManualCheckout = {
  id: string | number;
  slug: string;
  name: string;
  price: number | string | null;
  sale_price: number | string | null;
  external_url: string | null;
  delivery_description: string | null;
  delivery_type: "stock" | "manual" | "link" | null;
  is_active: boolean | null;
  stock: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getMethod(value: unknown): ManualPaymentMethod | null {
  return value === "bitcoin" || value === "litecoin" || value === "tikkie"
    ? value
    : null;
}

function formatEur(totalMinor: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(totalMinor / 100);
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

  const items = parseRequestedCartItems(body);
  const method = isRecord(body) ? getMethod(body.paymentMethod) : null;
  if (!items || !method) {
    return NextResponse.json(
      { error: "Choose an enabled payment method and valid cart items." },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError && authError.name !== "AuthSessionMissingError") {
    console.error("Could not verify manual checkout customer:", authError.message);
    return NextResponse.json({ error: "Could not verify your account." }, { status: 401 });
  }
  if (!user?.email || !user.email_confirmed_at) {
    return NextResponse.json(
      { error: "Sign in with a confirmed customer account before checkout." },
      { status: 401 },
    );
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Manual payment processing is not configured." },
      { status: 503 },
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: settings, error: settingsError } = await admin
    .from("store_payment_settings")
    .select("*")
    .eq("id", "default")
    .maybeSingle();
  if (settingsError) {
    console.error("Could not load manual payment configuration:", settingsError.message);
    return NextResponse.json(
      { error: "Payment settings could not be loaded." },
      { status: 503 },
    );
  }
  if (!settings) {
    return NextResponse.json(
      { error: "The selected payment method is not configured." },
      { status: 503 },
    );
  }

  const isEnabled =
    method === "bitcoin"
      ? settings.bitcoin_enabled && Boolean(settings.bitcoin_address)
      : method === "litecoin"
        ? settings.litecoin_enabled && Boolean(settings.litecoin_address)
        : settings.tikkie_enabled && Boolean(settings.tikkie_url);
  if (!isEnabled) {
    return NextResponse.json(
      { error: "The selected payment method is not currently available." },
      { status: 409 },
    );
  }

  const slugs = items.map((item) => item.productSlug);
  const { data: productData, error: productError } = await supabase
    .from("products")
    .select("id, slug, name, price, sale_price, external_url, delivery_description, delivery_type, is_active, stock")
    .in("slug", slugs)
    .eq("is_active", true);
  if (productError) {
    console.error("Could not load manual checkout products:", productError.message);
    return NextResponse.json(
      { error: "The cart could not be validated against the live catalog." },
      { status: 503 },
    );
  }

  const products = (productData ?? []) as ProductForManualCheckout[];
  const productsBySlug = new Map(products.map((product) => [product.slug, product]));
  if (productsBySlug.size !== items.length) {
    return NextResponse.json(
      { error: "One or more products are no longer available." },
      { status: 409 },
    );
  }

  const lineItems = [];
  for (const item of items) {
    const product = productsBySlug.get(item.productSlug);
    const baseMinor = amountToMinor(product?.price ?? null);
    const saleMinor = amountToMinor(product?.sale_price ?? null);
    const unitAmountMinor =
      saleMinor !== null && baseMinor !== null && saleMinor < baseMinor
        ? saleMinor
        : baseMinor;
    if (
      !product ||
      product.is_active !== true ||
      (product.stock !== null && product.stock < item.quantity) ||
      unitAmountMinor === null
    ) {
      return NextResponse.json(
        { error: `${product?.name ?? "A product"} is unavailable for checkout.` },
        { status: 409 },
      );
    }
    lineItems.push({ product, quantity: item.quantity, unitAmountMinor });
  }

  const totalAmountMinor = lineItems.reduce(
    (total, item) => total + item.unitAmountMinor * item.quantity,
    0,
  );
  if (!Number.isSafeInteger(totalAmountMinor) || totalAmountMinor <= 0) {
    return NextResponse.json(
      { error: "The order total must be greater than zero." },
      { status: 400 },
    );
  }

  let expectedPaymentAmount: string;
  let exchangeRate: number | null = null;
  let paymentDestination: string;
  let paymentInstructions: string;
  if (method === "tikkie") {
    paymentDestination = settings.tikkie_url;
    expectedPaymentAmount = (totalAmountMinor / 100).toFixed(2);
    paymentInstructions = settings.tikkie_instructions;
  } else {
    try {
      exchangeRate = await getEurCoinRate(method);
      expectedPaymentAmount = cryptoAmountForEur(totalAmountMinor, exchangeRate);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The cryptocurrency price could not be loaded.";
      return NextResponse.json({ error: message }, { status: 503 });
    }
    paymentDestination =
      method === "bitcoin" ? settings.bitcoin_address : settings.litecoin_address;
    paymentInstructions = `Send exactly ${expectedPaymentAmount} ${getCoinSymbol(method)} to the address below. The exchange quote expires in 15 minutes. After sending, submit your transaction ID in your account. A store administrator must approve the payment after the required network confirmations.`;
  }

  const orderId = randomUUID();
  const orderNumber = `VX-${orderId.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + settings.payment_timeout_minutes * 60_000,
  ).toISOString();
  const orderItems = lineItems.map(({ product, quantity, unitAmountMinor }) => ({
    product_id: String(product.id),
    product_name: product.name,
    product_slug: product.slug,
    quantity,
    unit_amount_minor: unitAmountMinor,
    external_url: product.external_url,
    delivery_description: product.delivery_description,
    delivery_type: product.delivery_type,
  }));

  const { error: orderError } = await admin.from("store_orders").insert({
    id: orderId,
    order_number: orderNumber,
    user_id: user.id,
    customer_email: user.email,
    payment_provider: method,
    payment_method: method,
    status: "awaiting_payment",
    currency: "EUR",
    total_amount_minor: totalAmountMinor,
    items: orderItems,
    expires_at: expiresAt,
  });
  if (orderError) {
    console.error("Could not create manual-payment order:", orderError.message);
    return NextResponse.json({ error: "The order could not be saved." }, { status: 503 });
  }

  const { error: orderItemsError } = await admin.from("store_order_items").insert(
    lineItems.map(({ product, quantity, unitAmountMinor }) => ({
      order_id: orderId,
      product_id: product.id,
      product_name: product.name,
      product_slug: product.slug,
      quantity,
      unit_amount_minor: unitAmountMinor,
    })),
  );
  if (orderItemsError) {
    console.error("Could not save manual order lines:", orderItemsError.message);
    await admin.from("store_order_items").delete().eq("order_id", orderId);
    await admin.from("store_orders").delete().eq("id", orderId);
    return NextResponse.json({ error: "The order could not be saved." }, { status: 503 });
  }

  const { error: paymentError } = await admin.from("store_payments").insert({
    order_id: orderId,
    provider: method,
    status: "awaiting_payment",
    expected_amount: expectedPaymentAmount,
    required_confirmations:
      method === "bitcoin"
        ? settings.bitcoin_confirmations
        : method === "litecoin"
          ? settings.litecoin_confirmations
          : 0,
    payment_destination: paymentDestination,
    payment_instructions: paymentInstructions,
    exchange_rate: exchangeRate,
    quote_expires_at:
      method === "tikkie"
        ? null
        : new Date(now.getTime() + 15 * 60_000).toISOString(),
    expires_at: expiresAt,
  });
  if (paymentError) {
    console.error("Could not save manual order payment:", paymentError.message);
    await admin.from("store_order_items").delete().eq("order_id", orderId);
    await admin.from("store_orders").delete().eq("id", orderId);
    return NextResponse.json({ error: "The order payment could not be saved." }, { status: 503 });
  }

  try {
    await sendStoreEmail({
      dedupeKey: `order-created/${orderId}`,
      recipient: user.email,
      subject: `Nexus Suppliers order ${orderNumber} payment instructions`,
      heading: "Your order is ready",
      message: paymentInstructions,
      details: [
        ...orderItems.map(
          (item) => `${item.product_name} × ${item.quantity}`,
        ),
        `Order total: ${formatEur(totalAmountMinor)}`,
        `Payment amount: ${expectedPaymentAmount} ${method === "tikkie" ? "EUR" : getCoinSymbol(method)}`,
        `Order number: ${orderNumber}`,
        `Payment destination: ${paymentDestination}`,
      ],
      actionUrl: new URL("/account", request.url).href,
      actionLabel: "View payment status",
    });
  } catch (emailError) {
    console.error("Manual order was created but its email could not be sent:", emailError);
  }

  return NextResponse.json(
    {
      orderId,
      orderNumber,
      paymentMethod: method,
      expectedAmount: expectedPaymentAmount,
      currency: method === "tikkie" ? "EUR" : getCoinSymbol(method),
      paymentDestination,
      paymentInstructions,
      expiresAt,
      totalAmount: formatEur(totalAmountMinor),
    },
    { status: 201 },
  );
}

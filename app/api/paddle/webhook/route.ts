import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendStoreEmail } from "@/lib/email";
import { isValidDiscordWebhook } from "@/lib/storefront";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader) return false;

  let timestamp: string | null = null;
  const signatures: string[] = [];

  for (const part of signatureHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;

    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === "ts") timestamp = value;
    if (key === "h1" && /^[a-f0-9]{64}$/i.test(value)) {
      signatures.push(value);
    }
  }

  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) {
    return false;
  }

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (ageSeconds > 300) return false;

  const digest = createHmac("sha256", secret)
    .update(`${timestamp}:${rawBody}`)
    .digest();

  return signatures.some((signature) => {
    const candidate = Buffer.from(signature, "hex");
    return candidate.length === digest.length && timingSafeEqual(candidate, digest);
  });
}

async function releaseDiscordNotificationClaim(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  orderId: string,
  notifiedAt: string,
) {
  const { error } = await admin
    .from("store_orders")
    .update({ discord_notified_at: null })
    .eq("id", orderId)
    .eq("discord_notified_at", notifiedAt);

  if (error) {
    console.error("Could not release Discord notification claim:", error.message);
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Paddle webhook is not configured.");
    return NextResponse.json(
      { error: "Webhook processing is not configured." },
      { status: 503 },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 1_000_000) {
    return NextResponse.json({ error: "Webhook payload is too large." }, { status: 413 });
  }

  const rawBody = await request.text();
  if (!verifyPaddleSignature(rawBody, request.headers.get("paddle-signature"), secret)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  if (!isRecord(event) || !isRecord(event.data)) {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const eventType = event.event_type;
  const data = event.data;
  const admin = createSupabaseAdminClient();

  if (eventType === "adjustment.updated" && data.status === "approved") {
    const transactionId = data.transaction_id;
    const action = data.action;
    const orderStatus =
      action === "refund"
        ? "refunded"
        : action === "chargeback"
          ? "disputed"
          : null;

    if (!orderStatus) return NextResponse.json({ received: true });
    if (typeof transactionId !== "string") {
      return NextResponse.json({ error: "Invalid adjustment." }, { status: 400 });
    }

    const { error } = await admin
      .from("store_orders")
      .update({ status: orderStatus, updated_at: new Date().toISOString() })
      .eq("provider_transaction_id", transactionId)
      .eq("payment_provider", "paddle");

    if (error) {
      console.error("Could not update adjusted Paddle order:", error.message);
      return NextResponse.json({ error: "Order update failed." }, { status: 500 });
    }
    const { data: adjustedOrder, error: adjustedOrderError } = await admin
      .from("store_orders")
      .select("id, order_number, customer_email")
      .eq("provider_transaction_id", transactionId)
      .eq("payment_provider", "paddle")
      .maybeSingle();
    if (adjustedOrderError) {
      console.error("Could not load adjusted order for email:", adjustedOrderError.message);
    } else if (adjustedOrder) {
      try {
        await sendStoreEmail({
          dedupeKey: `payment-${orderStatus}/${adjustedOrder.id}`,
          recipient: adjustedOrder.customer_email,
      subject: `${orderStatus === "refunded" ? "Refund" : "Payment review"} for Nexus Suppliers order ${adjustedOrder.order_number}`,
          heading: orderStatus === "refunded" ? "Your order was refunded" : "Your payment is under review",
          message:
            orderStatus === "refunded"
              ? "The payment provider confirmed a refund for this order."
              : "The payment provider reported a dispute. Please contact support if you need help.",
          details: [`Order: ${adjustedOrder.order_number}`],
          actionUrl: new URL("/account", request.nextUrl.origin).href,
          actionLabel: "View your order",
        });
      } catch (emailError) {
        console.error("Adjusted order was saved but its email could not be sent:", emailError);
      }
    }
    return NextResponse.json({ received: true });
  }

  if (eventType === "transaction.updated" && data.status === "canceled") {
    const transactionId = data.id;
    if (typeof transactionId !== "string") {
      return NextResponse.json({ error: "Invalid transaction." }, { status: 400 });
    }
    const { error } = await admin
      .from("store_orders")
      .update({ status: "canceled", updated_at: new Date().toISOString() })
      .eq("provider_transaction_id", transactionId)
      .eq("payment_provider", "paddle")
      .eq("status", "pending");

    if (error) {
      console.error("Could not cancel Paddle order:", error.message);
      return NextResponse.json({ error: "Order update failed." }, { status: 500 });
    }
    const { data: canceledOrder, error: canceledOrderError } = await admin
      .from("store_orders")
      .select("id, order_number, customer_email, status")
      .eq("provider_transaction_id", transactionId)
      .eq("payment_provider", "paddle")
      .maybeSingle();
    if (canceledOrderError) {
      console.error("Could not load canceled order for email:", canceledOrderError.message);
    } else if (canceledOrder?.status === "canceled") {
      try {
        await sendStoreEmail({
          dedupeKey: `order-canceled/${canceledOrder.id}`,
          recipient: canceledOrder.customer_email,
      subject: `Nexus Suppliers order ${canceledOrder.order_number} was canceled`,
          heading: "Your order was canceled",
          message: "The payment provider canceled this order. No delivery was issued.",
          details: [`Order: ${canceledOrder.order_number}`],
          actionUrl: new URL("/products", request.nextUrl.origin).href,
          actionLabel: "Return to the store",
        });
      } catch (emailError) {
        console.error("Canceled order was saved but its email could not be sent:", emailError);
      }
    }
    return NextResponse.json({ received: true });
  }

  if (eventType !== "transaction.completed") {
    return NextResponse.json({ received: true });
  }

  const transactionId = data.id;
  const transactionStatus = data.status;
  const customData = isRecord(data.custom_data) ? data.custom_data : null;
  const orderId = customData?.ventex_order_id;
  const userId = customData?.ventex_user_id;

  if (
    typeof transactionId !== "string" ||
    transactionStatus !== "completed" ||
    typeof orderId !== "string" ||
    typeof userId !== "string"
  ) {
    return NextResponse.json({ error: "Invalid completed transaction." }, { status: 400 });
  }

  const { data: order, error: orderError } = await admin
    .from("store_orders")
    .select(
      "id, order_number, user_id, customer_email, status, provider_transaction_id, total_amount_minor, currency, items, discord_notified_at",
    )
    .eq("id", orderId)
    .eq("payment_provider", "paddle")
    .maybeSingle();

  if (orderError) {
    console.error("Could not load order for Paddle webhook:", orderError.message);
    return NextResponse.json({ error: "Order lookup failed." }, { status: 500 });
  }
  if (!order) {
    console.error("Paddle webhook referenced an unknown Nexus Suppliers order.");
    return NextResponse.json({ error: "Unknown order." }, { status: 404 });
  }
  if (
    order.user_id !== userId ||
    order.provider_transaction_id !== transactionId
  ) {
    console.error("Paddle transaction did not match its Nexus Suppliers order.");
    return NextResponse.json({ error: "Order validation failed." }, { status: 409 });
  }

  const details = isRecord(data.details) ? data.details : null;
  const totals = details && isRecord(details.totals) ? details.totals : null;
  const totalMinor = totals ? Number(totals.total) : NaN;
  const currency = data.currency_code;
  const orderItems = Array.isArray(order.items) ? order.items : [];
  const eventItems = Array.isArray(data.items) ? data.items : [];
  const expectedItems = orderItems.flatMap((item) =>
    isRecord(item) &&
    typeof item.paddle_price_id === "string" &&
    Number.isSafeInteger(item.quantity) &&
    typeof item.quantity === "number" &&
    item.quantity > 0
      ? [{ priceId: item.paddle_price_id, quantity: item.quantity, item }]
      : [],
  );
  const expectedItemsByPrice = new Map(
    expectedItems.map((item) => [item.priceId, item]),
  );
  let itemsMatch =
    expectedItems.length === orderItems.length &&
    expectedItems.length > 0 &&
    eventItems.length === expectedItems.length;
  for (const item of eventItems) {
    if (!isRecord(item) || typeof item.price_id !== "string") {
      itemsMatch = false;
      break;
    }
    const expected = expectedItemsByPrice.get(item.price_id);
    if (!expected || item.quantity !== expected.quantity) {
      itemsMatch = false;
      break;
    }
    expectedItemsByPrice.delete(item.price_id);
  }

  if (
    !Number.isSafeInteger(totalMinor) ||
    totalMinor !== Number(order.total_amount_minor) ||
    currency !== order.currency ||
    !itemsMatch ||
    expectedItemsByPrice.size !== 0
  ) {
    console.error("Paddle payment details did not match the saved Nexus Suppliers order.");
    return NextResponse.json({ error: "Payment validation failed." }, { status: 409 });
  }
  if (order.status === "refunded" || order.status === "disputed") {
    return NextResponse.json({ received: true });
  }

  if (order.status !== "fulfilled") {
    const { error: paidError } = await admin
      .from("store_orders")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("provider_transaction_id", transactionId)
      .neq("status", "refunded")
      .neq("status", "disputed");

    if (paidError) {
      console.error("Could not mark Paddle order as paid:", paidError.message);
      return NextResponse.json({ error: "Order update failed." }, { status: 500 });
    }

    const { data: fulfilled, error: fulfillmentError } = await admin.rpc(
      "fulfill_store_order",
      { p_order_id: orderId },
    );

    if (fulfillmentError) {
    console.error("Could not fulfill paid Nexus Suppliers order:", fulfillmentError.message);
      return NextResponse.json({ error: "Order fulfillment failed." }, { status: 500 });
    }

    if (fulfilled !== true) {
      console.warn("Paid order has no available key inventory; manual fulfillment is needed.");
    }

    try {
      const accountUrl = new URL("/account", request.nextUrl.origin).href;
      await sendStoreEmail({
        dedupeKey: `payment-approved/${orderId}`,
        recipient: order.customer_email,
      subject: `Payment approved for Nexus Suppliers order ${order.order_number}`,
        heading: "Your payment has been confirmed",
        message:
          fulfilled
            ? "Your payment is confirmed and the digital delivery is now available in your account."
            : "Your payment is confirmed. The store is preparing or manually fulfilling your digital order.",
        details: [
          `Order: ${order.order_number}`,
          `Total: ${new Intl.NumberFormat("en-IE", {
            style: "currency",
            currency: order.currency,
          }).format(Number(order.total_amount_minor) / 100)}`,
        ],
        actionUrl: accountUrl,
        actionLabel: "View your order",
      });
      if (fulfilled) {
        await sendStoreEmail({
          dedupeKey: `order-completed/${orderId}`,
          recipient: order.customer_email,
      subject: `Nexus Suppliers order ${order.order_number} has been delivered`,
          heading: "Your digital order is complete",
          message: "Your digital delivery is now available in your customer account.",
          details: [`Order: ${order.order_number}`],
          actionUrl: accountUrl,
          actionLabel: "View your delivery",
        });
      }
    } catch (emailError) {
      console.error("Paddle payment was processed but its customer email could not be sent:", emailError);
    }
  }

  if (!order.discord_notified_at) {
    const { data: webhookSettings, error: webhookError } = await admin
      .from("discord_webhook_settings")
      .select("webhook_url")
      .eq("id", "default")
      .maybeSingle();

    if (webhookError) {
      console.error("Could not load Discord order notification settings:", webhookError.message);
      return NextResponse.json({ error: "Notification settings unavailable." }, { status: 500 });
    }

    if (webhookSettings?.webhook_url) {
      if (!isValidDiscordWebhook(webhookSettings.webhook_url)) {
        console.error("Stored Discord order webhook URL is invalid.");
        return NextResponse.json({ error: "Notification settings are invalid." }, { status: 500 });
      }

      const notifiedAt = new Date().toISOString();
      const { data: claimedNotification, error: claimError } = await admin
        .from("store_orders")
        .update({ discord_notified_at: notifiedAt })
        .eq("id", orderId)
        .is("discord_notified_at", null)
        .select("id")
        .maybeSingle();

      if (claimError) {
        console.error("Could not reserve order notification:", claimError.message);
        return NextResponse.json({ error: "Notification could not be reserved." }, { status: 500 });
      }

      if (claimedNotification) {
        const itemName = expectedItems
          .map((item) =>
            typeof item.item.product_name === "string"
              ? `${item.item.product_name} × ${item.quantity}`
              : `Digital product × ${item.quantity}`,
          )
          .join("\n")
          .slice(0, 1000);
        const total = new Intl.NumberFormat("en-IE", {
          style: "currency",
          currency: order.currency,
        }).format(Number(order.total_amount_minor) / 100);
        const itemCount = await admin
          .from("product_keys")
          .select("id", { count: "exact", head: true })
          .eq("assigned_order_id", orderId);
        if (itemCount.error) {
          console.error("Could not check order key delivery:", itemCount.error.message);
          await releaseDiscordNotificationClaim(admin, orderId, notifiedAt);
          return NextResponse.json({ error: "Delivery status unavailable." }, { status: 500 });
        }
        const deliveryStatus = itemCount.count
          ? "Keys delivered"
          : "Manual delivery may be needed";

        let discordResponse: Response;
        try {
          discordResponse = await fetch(webhookSettings.webhook_url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              embeds: [
                {
        title: "Nexus Suppliers order paid",
                  description: itemName,
                  color: 0x2878ff,
                  fields: [
                    { name: "Order", value: orderId },
                    { name: "Total", value: total, inline: true },
                    { name: "Delivery", value: deliveryStatus, inline: true },
                  ],
                  timestamp: new Date().toISOString(),
                },
              ],
            }),
            cache: "no-store",
            redirect: "error",
            signal: AbortSignal.timeout(10000),
          });
        } catch (error) {
          console.error("Discord order notification failed:", error);
          await releaseDiscordNotificationClaim(admin, orderId, notifiedAt);
          return NextResponse.json({ error: "Order notification failed." }, { status: 500 });
        }

        if (!discordResponse.ok) {
          console.error("Discord order notification returned status:", discordResponse.status);
          await releaseDiscordNotificationClaim(admin, orderId, notifiedAt);
          return NextResponse.json({ error: "Order notification failed." }, { status: 500 });
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}

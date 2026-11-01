import { NextResponse, type NextRequest } from "next/server";
import {
  verifyBlockCypherTransaction,
  type SupportedCoin,
} from "@/lib/blockchain";
import { isValidRequestOrigin } from "@/lib/checkout-validation";
import { sendStoreEmail } from "@/lib/email";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: NextRequest) {
  if (!isValidRequestOrigin(request.headers.get("origin"), request.url)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid payment submission." }, { status: 400 });
  }
  const orderId =
    isRecord(body) && typeof body.orderId === "string" ? body.orderId : "";
  const transactionId =
    isRecord(body) && typeof body.transactionId === "string"
      ? body.transactionId.trim().toLowerCase()
      : "";
  if (
    !/^[0-9a-f-]{36}$/i.test(orderId) ||
    !/^[0-9a-f]{64}$/.test(transactionId)
  ) {
    return NextResponse.json(
      { error: "Enter a valid order and blockchain transaction ID." },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError && authError.name !== "AuthSessionMissingError") {
    console.error("Could not verify customer for payment submission:", authError.message);
    return NextResponse.json({ error: "Could not verify your account." }, { status: 401 });
  }
  if (!user?.email_confirmed_at) {
    return NextResponse.json({ error: "Sign in before submitting a payment." }, { status: 401 });
  }

  const { data: order, error: orderError } = await supabase
    .from("store_orders")
    .select("id, order_number, user_id, customer_email, status, payment_method, expires_at")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (orderError) {
    console.error("Could not load customer order for payment submission:", orderError.message);
    return NextResponse.json({ error: "Order could not be loaded." }, { status: 503 });
  }
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  if (order.payment_method !== "bitcoin" && order.payment_method !== "litecoin") {
    return NextResponse.json(
      { error: "This order does not use blockchain payment." },
      { status: 409 },
    );
  }
  if (
    order.status !== "awaiting_payment" &&
    order.status !== "payment_detected"
  ) {
    return NextResponse.json(
      { error: "This order is no longer awaiting blockchain payment." },
      { status: 409 },
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: payment, error: paymentError } = await admin
    .from("store_payments")
    .select("id, provider, status, transaction_id, expected_amount, payment_destination, required_confirmations, expires_at")
    .eq("order_id", orderId)
    .maybeSingle();
  if (paymentError) {
    console.error("Could not load payment for blockchain verification:", paymentError.message);
    return NextResponse.json({ error: "Payment could not be loaded." }, { status: 503 });
  }
  if (
    !payment ||
    payment.provider !== order.payment_method ||
    !["awaiting_payment", "payment_detected"].includes(payment.status)
  ) {
    return NextResponse.json({ error: "This payment cannot be updated." }, { status: 409 });
  }
  if (
    payment.transaction_id &&
    payment.transaction_id.toLowerCase() !== transactionId
  ) {
    return NextResponse.json(
      { error: "A different transaction is already linked to this order." },
      { status: 409 },
    );
  }

  const expiry = order.expires_at ?? payment.expires_at;
  if (expiry && Date.parse(expiry) <= Date.now()) {
    const { error: expirePaymentError } = await admin
      .from("store_payments")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", payment.id)
      .in("status", ["awaiting_payment", "payment_detected"]);
    const { error: expireOrderError } = await admin
      .from("store_orders")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .in("status", ["awaiting_payment", "payment_detected"]);
    if (expirePaymentError || expireOrderError) {
      console.error(
        "Could not expire blockchain payment:",
        expirePaymentError?.message ?? expireOrderError?.message,
      );
      return NextResponse.json({ error: "Payment expiration could not be saved." }, { status: 503 });
    }
    return NextResponse.json({ error: "This payment request has expired." }, { status: 410 });
  }

  let verified: { receivedAmount: string; confirmations: number };
  try {
    verified = await verifyBlockCypherTransaction({
      coin: order.payment_method as SupportedCoin,
      transactionId,
      address: payment.payment_destination,
      expectedAmount: payment.expected_amount,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The transaction could not be verified.";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const { data: recorded, error: recordError } = await admin.rpc(
    "record_store_payment_detection",
    {
      p_payment_id: payment.id,
      p_transaction_id: transactionId,
      p_received_amount: verified.receivedAmount,
      p_confirmations: verified.confirmations,
    },
  );
  if (recordError || recorded !== true) {
    if (recordError) {
      console.error("Could not record verified blockchain payment:", recordError.message);
    }
    return NextResponse.json(
      { error: "Verified payment details could not be saved." },
      { status: 503 },
    );
  }

  try {
    await sendStoreEmail({
      dedupeKey: `payment-detected/${orderId}`,
      recipient: order.customer_email,
      subject: `Payment detected for Nexus Suppliers order ${order.order_number}`,
      heading: "Your blockchain payment was detected",
      message: "The transaction was found on the blockchain. The store will wait for the required confirmations and manually approve the payment before delivery.",
      details: [
        `Transaction ID: ${transactionId}`,
        `Confirmations: ${verified.confirmations}`,
      ],
      actionUrl: new URL("/account", request.url).href,
      actionLabel: "Check your order",
    });
  } catch (emailError) {
    console.error("Blockchain payment was recorded but its email could not be sent:", emailError);
  }

  return NextResponse.json({
    status: "payment_detected",
    confirmations: verified.confirmations,
    requiredConfirmations: payment.required_confirmations,
    awaitingAdminApproval: true,
  });
}

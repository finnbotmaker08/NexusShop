import { NextResponse, type NextRequest } from "next/server";
import { isValidRequestOrigin } from "@/lib/checkout-validation";
import { sendStoreEmail } from "@/lib/email";
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
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    return NextResponse.json({ error: "Invalid order." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError && authError.name !== "AuthSessionMissingError") {
    console.error("Could not verify Tikkie customer:", authError.message);
    return NextResponse.json({ error: "Could not verify your account." }, { status: 401 });
  }
  if (!user) {
    return NextResponse.json({ error: "Sign in before submitting payment." }, { status: 401 });
  }

  const { data: order, error: orderError } = await supabase
    .from("store_orders")
    .select("id, order_number, status, customer_email")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (orderError) {
    console.error("Could not load Tikkie order:", orderError.message);
    return NextResponse.json({ error: "Order could not be loaded." }, { status: 503 });
  }
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const { data, error } = await supabase.rpc("submit_tikkie_payment", {
    p_order_id: orderId,
  });
  if (error || data !== true) {
    if (error) console.error("Could not submit Tikkie payment for review:", error.message);
    return NextResponse.json(
      { error: "This Tikkie payment could not be submitted for review." },
      { status: 409 },
    );
  }

  try {
    await sendStoreEmail({
      dedupeKey: `tikkie-submitted/${orderId}`,
      recipient: order.customer_email,
      subject: `Tikkie payment submitted for Nexus Suppliers order ${order.order_number}`,
      heading: "Your payment is awaiting review",
      message: "Your Tikkie payment has been submitted for review. The store owner will verify it before digital delivery.",
      details: [`Order: ${order.order_number}`],
      actionUrl: new URL("/account", request.url).href,
      actionLabel: "Check your order",
    });
  } catch (emailError) {
    console.error("Tikkie submission was recorded but its email could not be sent:", emailError);
  }

  return NextResponse.json({ status: "awaiting_approval" });
}

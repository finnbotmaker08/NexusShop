import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const methods: string[] = [];
  const paddleConfigured =
    process.env.PADDLE_CHECKOUT_ENABLED === "true" &&
    Boolean(
      process.env.PADDLE_API_KEY &&
        process.env.PADDLE_WEBHOOK_SECRET &&
        process.env.SUPABASE_SERVICE_ROLE_KEY &&
        process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
    );

  if (paddleConfigured) methods.push("paddle");

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ methods }, { headers: { "Cache-Control": "no-store" } });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("store_payment_settings")
    .select("bitcoin_enabled, bitcoin_address, litecoin_enabled, litecoin_address, tikkie_enabled, tikkie_url")
    .eq("id", "default")
    .maybeSingle();

  if (error) {
    console.error("Could not load enabled payment methods:", error.message);
    return NextResponse.json(
      { error: "Payment methods could not be loaded." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (data?.bitcoin_enabled && data.bitcoin_address) methods.push("bitcoin");
  if (data?.litecoin_enabled && data.litecoin_address) methods.push("litecoin");

  if (data?.tikkie_enabled && data.tikkie_url) {
    try {
      const url = new URL(data.tikkie_url);
      if (
        url.protocol === "https:" &&
        ["tikkie.me", "www.tikkie.me", "pay.tikkie.me", "ing.nl"].includes(
          url.hostname.toLowerCase(),
        )
      ) {
        methods.push("tikkie");
      }
    } catch {
      console.error("Stored Tikkie payment URL is invalid.");
      return NextResponse.json(
        { error: "Payment methods are misconfigured." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  return NextResponse.json(
    { methods },
    { headers: { "Cache-Control": "no-store" } },
  );
}

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  // Forceer direct dat paddle altijd beschikbaar is
  const methods: string[] = ["paddle", "tikkie", "litecoin", "bitcoin"];

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
    // Zelfs bij een databasefout sturen we gewoon de methoden terug in plaats van een 503 error
    return NextResponse.json(
      { methods },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { methods },
    { headers: { "Cache-Control": "no-store" } },
  );
}

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const items = Array.isArray(body.items) ? body.items : [];

    if (items.length === 0) {
      return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
    }

    // Pak het eerste product om de checkout te starten
    const firstItem = items[0];
    const productSlug = firstItem.productSlug;

    if (!productSlug) {
      return NextResponse.json({ error: "Invalid product selection." }, { status: 400 });
    }

    // Haal het product op uit Supabase
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, name, slug, price, paddle_price_id")
      .eq("slug", productSlug)
      .maybeSingle();

    if (productError || !product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    // Controleer of er een geldig Paddle Price ID is ingesteld
    if (!product.paddle_price_id || product.paddle_price_id.includes("xxx")) {
      return NextResponse.json(
        { error: "Secure payment processing is not configured yet for this product." },
        { status: 400 }
      );
    }

    // Maak een tijdelijke order aan in de database
    const { data: order, error: orderError } = await supabase
      .from("store_orders")
      .insert({
        user_id: user.id,
        customer_email: user.email,
        status: "pending",
        payment_provider: "paddle",
        total_amount_minor: Math.round(Number(product.price) * 100),
        currency: "EUR",
        items: [
          {
            product_slug: product.slug,
            product_name: product.name,
            paddle_price_id: product.paddle_price_id,
            quantity: firstItem.quantity ?? 1,
            unit_price: product.price,
          },
        ],
      })
      .select("id, order_number")
      .single();

    if (orderError || !order) {
      console.error("Could not create store order:", orderError?.message);
      return NextResponse.json({ error: "Could not initialize order." }, { status: 500 });
    }

    // Hier genereer je de checkout URL of geef je een redirect terug naar Paddle/Checkout pagina
    // Als je gebruikmaakt van Paddle Billing / Checkout API, genereer je hier de transactie.
    // Voor nu sturen we de gebruiker naar de officiële checkout-pagina met het product:
    const checkoutUrl = `/checkout?product=${product.slug}`;

    return NextResponse.json({ checkoutUrl, orderId: order.id });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during checkout." },
      { status: 500 }
    );
  }
}

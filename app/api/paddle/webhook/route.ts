import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    
    // Controleer of de gebruiker is ingelogd
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

    // Maak een order aan in de database
    const { data: order, error: orderError } = await supabase
      .from("store_orders")
      .insert({
        user_id: user.id,
        customer_email: user.email,
        status: "pending",
        payment_provider: "paddle",
        total_amount_minor: Math.round(Number(product.price ?? 3.60) * 100),
        currency: "EUR",
        items: [
          {
            product_slug: product.slug,
            product_name: product.name,
            paddle_price_id: product.paddle_price_id || "pri_fallback",
            quantity: firstItem.quantity ?? 1,
            unit_price: product.price ?? 3.60,
          },
        ],
      })
      .select("id, order_number")
      .single();

    if (orderError || !order) {
      console.error("Could not create store order:", orderError?.message);
      return NextResponse.json({ error: "Could not initialize order." }, { status: 500 });
    }

    // Stuur een geldige checkout URL of preview terug naar de frontend
    const priceId = product.paddle_price_id && !product.paddle_price_id.includes("xxx") 
      ? product.paddle_price_id 
      : "pri_placeholder";

    const checkoutUrl = `https://checkout.paddle.com/checkout/preview?prices=${priceId}`;

    return NextResponse.json({ checkoutUrl, orderId: order.id });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during checkout." },
      { status: 500 }
    );
  }
}
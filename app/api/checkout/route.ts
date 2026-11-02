import { NextResponse, type NextRequest } from "next/server";
import { isValidRequestOrigin, parseRequestedCartItems } from "@/lib/checkout-validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ProductForCheckout = {
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
  if (!requestedItems || requestedItems.length === 0) {
    return NextResponse.json({ error: "Choose valid products and quantities." }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const slugs = requestedItems.map((item) => item.productSlug);

  // Haal de external_url (Tikkie link) op uit Supabase
  const { data: productData, error: productError } = await admin
    .from("products")
    .select("id, slug, name, price, sale_price, external_url, delivery_description, delivery_type, is_active, stock")
    .in("slug", slugs)
    .eq("is_active", true);

  if (productError) {
    console.error("Could not load checkout products:", productError.message);
  }

  const products = (productData ?? []) as ProductForCheckout[];
  const firstProduct = products.find((p) => p.external_url) ?? products[0];

  // Zoek naar de Tikkie-link van het product, anders valt hij terug op jouw standaard Tikkie-link
  const tikkieUrl =
    firstProduct?.external_url && firstProduct.external_url.trim() !== ""
      ? firstProduct.external_url
      : "https://tikkie.me/pay/e1bcu6771gegf0314j7j";

  // Stuur de gebruiker direct naar de Tikkie URL
  return NextResponse.json(
    {
      checkoutUrl: tikkieUrl,
    },
    { status: 200 }
  );
}
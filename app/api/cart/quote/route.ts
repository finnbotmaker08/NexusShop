import { NextResponse, type NextRequest } from "next/server";
import { isValidRequestOrigin } from "@/lib/checkout-validation";
import { getSupabaseClient } from "@/lib/storefront";

export async function POST(request: NextRequest) {
  if (!isValidRequestOrigin(request.headers.get("origin"), request.url)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid cart request." }, { status: 400 });
  }

  const slugs =
    typeof body === "object" &&
    body !== null &&
    "slugs" in body &&
    Array.isArray(body.slugs)
      ? body.slugs
      : null;
  if (
    !slugs ||
    slugs.length < 1 ||
    slugs.length > 20 ||
    slugs.some(
      (slug) =>
        typeof slug !== "string" ||
        slug.length > 160 ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug),
    )
  ) {
    return NextResponse.json({ error: "Choose valid products." }, { status: 400 });
  }

  const client = getSupabaseClient();
  if (!client) {
    return NextResponse.json(
      { error: "The product catalog is not connected." },
      { status: 503 },
    );
  }

  const { data, error } = await client
    .from("products")
    .select("slug, name, price, sale_price, image_url, stock")
    .in("slug", [...new Set(slugs)])
    .eq("is_active", true);

  if (error) {
    console.error("Could not load current cart prices:", error.message);
    return NextResponse.json(
      { error: "Current product prices could not be loaded." },
      { status: 503 },
    );
  }

  return NextResponse.json({
    items: (data ?? []).map((product) => ({
      slug: product.slug,
      name: product.name,
      price:
        product.sale_price !== null &&
        Number.isFinite(Number(product.sale_price)) &&
        Number(product.sale_price) >= 0 &&
        Number(product.sale_price) < Number(product.price)
          ? product.sale_price
          : product.price,
      imageUrl: product.image_url,
      stock: product.stock,
    })),
  });
}

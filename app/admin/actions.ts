export async function saveProduct(data: FormData) {
  const supabase = await getAdminClient();
  const id = readText(data, "id", 100);
  const name = readText(data, "name", 120);
  const slug = slugify(readText(data, "slug", 160) || name);
  const shortDescription = readText(data, "short_description", 300);
  const description = readText(data, "description", 4000);
  const category = readText(data, "category", 100);
  const priceValue = readText(data, "price", 30);
  const salePriceValue = readText(data, "sale_price", 30);
  const stockValue = readText(data, "stock", 12);
  const deliveryType = readText(data, "delivery_type", 20);
  const imageUrl = readText(data, "image_url", 2000);
  const externalUrl = readText(data, "external_url", 2000);
  const deliveryDescription = readText(data, "delivery_description", 4000);
  const paddlePriceId = readText(data, "paddle_price_id", 40);
  const active = readCheckbox(data, "is_active");
  const price = Number(priceValue);
  const salePrice = salePriceValue === "" ? null : Number(salePriceValue);
  const stock = stockValue === "" ? null : Number.parseInt(stockValue, 10);

  const values = {
    name,
    slug,
    short_description: shortDescription,
    description,
    price,
    sale_price: salePrice,
    stock,
    delivery_type: deliveryType,
    category: category || null,
    image_url: imageUrl || null,
    external_url: externalUrl || null,
    delivery_description: deliveryDescription,
    paddle_price_id: paddlePriceId || null,
    is_active: active,
  };

  console.log("Gegevens die worden opgeslagen:", values);

  const result = id
    ? await supabase.from("products").update(values).eq("id", id)
    : await supabase.from("products").insert(values);

  if (result.error) {
    console.error("🔴 SUPABASE DATABASE ERROR:", result.error);
    redirect(`/admin?error=${encodeURIComponent(result.error.message)}#products`);
  }

  refreshStorefront();
  redirect("/admin?notice=product#products");
}

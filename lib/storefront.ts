import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type StorefrontProduct = {
  id: string | number;
  slug: string | null;
  name: string | null;
  description: string | null;
  price: number | string | null;
  category: string | null;
  image_url: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  stock?: number | null;
  short_description?: string | null;
  sale_price?: number | string | null;
  delivery_type?: "stock" | "manual" | "link" | null;
  delivery_description?: string | null;
  external_url?: string | null;
  paddle_price_id?: string | null;
};

export type StoreSettings = {
  maintenance_mode: boolean;
  maintenance_message: string;
  discord_server_url: string;
  discord_support_url: string;
  support_email: string;
};

export type StoreCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
};

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  maintenance_mode: false,
  maintenance_message: "We will be back shortly.",
  discord_server_url: "",
  discord_support_url: "",
  support_email: "",
};

export function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function fetchProducts(categoryName?: string): Promise<{
  products: StorefrontProduct[];
  error: string | null;
  configured: boolean;
}> {
  const client = getSupabaseClient();

  if (!client) {
    return { products: [], error: null, configured: false };
  }

  const { data, error } = await client
    .from("products")
    .select("*")
    .eq("is_active", true)
    .match(categoryName ? { category: categoryName } : {})
    .order("created_at", { ascending: false });

  return {
    products: (data ?? []) as StorefrontProduct[],
    error: error?.message ?? null,
    configured: true,
  };
}

export async function fetchCategories(): Promise<{
  categories: StoreCategory[];
  error: string | null;
}> {
  const client = getSupabaseClient();

  if (!client) {
    return { categories: [], error: null };
  }

  const { data, error } = await client
    .from("store_categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  return {
    categories: (data ?? []) as StoreCategory[],
    error: error?.message ?? null,
  };
}

export async function fetchProductBySlug(
  slug: string,
): Promise<{ product: StorefrontProduct | null; error: string | null; configured: boolean }> {
  const client = getSupabaseClient();

  if (!client) {
    return { product: null, error: null, configured: false };
  }

  const { data, error } = await client
    .from("products")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  return {
    product: (data as StorefrontProduct | null) ?? null,
    error: error?.message ?? null,
    configured: true,
  };
}

export async function fetchStoreSettings(): Promise<{
  settings: StoreSettings;
  error: string | null;
  configured: boolean;
}> {
  const client = getSupabaseClient();

  if (!client) {
    return {
      settings: DEFAULT_STORE_SETTINGS,
      error: null,
      configured: false,
    };
  }

  const { data, error } = await client
    .from("store_settings")
    .select(
      "maintenance_mode, maintenance_message, discord_server_url, discord_support_url, support_email",
    )
    .eq("id", "default")
    .maybeSingle();

  return {
    settings: data ?? DEFAULT_STORE_SETTINGS,
    error: error?.message ?? null,
    configured: true,
  };
}

export function formatPrice(value: number | string | null): string {
  if (value === null || value === "") {
    return "Price unavailable";
  }

  const numericValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return "Price unavailable";
  }

  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(numericValue);
}

export function getEffectiveProductPrice(
  product: Pick<StorefrontProduct, "price" | "sale_price">,
): number | string | null {
  if (product.price === null || product.price === "") {
    return product.price;
  }
  const basePrice = Number(product.price);
  const salePrice =
    product.sale_price === null || product.sale_price === undefined
      ? null
      : Number(product.sale_price);

  if (
    salePrice !== null &&
    Number.isFinite(salePrice) &&
    salePrice >= 0 &&
    Number.isFinite(basePrice) &&
    salePrice < basePrice
  ) {
    return salePrice;
  }

  return product.price;
}

export function isValidDiscordInvite(value: string): boolean {
  if (!value) return true;

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const validHost = host === "discord.gg" || host === "discord.com";

    return (
      url.protocol === "https:" &&
      validHost &&
      !url.username &&
      !url.password &&
      (host === "discord.gg" ||
        url.pathname.startsWith("/invite/") ||
        url.pathname.startsWith("/channels/"))
    );
  } catch {
    return false;
  }
}

export function isValidExternalUrl(value: string): boolean {
  if (!value) return true;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function isValidDiscordWebhook(value: string): boolean {
  if (!value) return true;

  try {
    const url = new URL(value);
    const segments = url.pathname.split("/");

    return (
      url.protocol === "https:" &&
      ["discord.com", "discordapp.com"].includes(url.hostname.toLowerCase()) &&
      url.pathname.startsWith("/api/webhooks/") &&
      segments[3]?.length > 0 &&
      segments[4]?.length > 0 &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

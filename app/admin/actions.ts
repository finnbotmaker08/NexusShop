"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isVerifiedAdmin } from "@/lib/admin";
import { sendStoreEmail } from "@/lib/email";
import {
  isValidDiscordInvite,
  isValidDiscordWebhook,
  isValidExternalUrl,
} from "@/lib/storefront";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function readText(data: FormData, key: string, maxLength = 2000): string {
  const value = data.get(key);
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function readCheckbox(data: FormData, key: string): boolean {
  return data.get(key) === "on";
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function getAdminClient() {
  const supabase = await createSupabaseServerClient(true);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !isVerifiedAdmin(user)) {
    redirect("/login?error=not-admin");
  }

  return supabase;
}

function refreshStorefront() {
  revalidatePath("/", "layout");
  revalidatePath("/products/[slug]", "page");
  revalidatePath("/admin");
}

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

  // Correcte validatie voor optionele URL's (leeg is toegestaan, anders moet het geldig zijn)
  const isValidOptionalUrl = (url: string) => url === "" || isValidExternalUrl(url);

  if (
    !name ||
    !slug ||
    !description ||
    !Number.isFinite(price) ||
    price < 0 ||
    (salePrice !== null && (!Number.isFinite(salePrice) || salePrice < 0)) ||
    (stock !== null && (!/^\d+$/.test(stockValue) || !Number.isSafeInteger(stock) || stock < 0)) ||
    !["stock", "manual", "link"].includes(deliveryType) ||
    !isValidOptionalUrl(imageUrl) ||
    !isValidOptionalUrl(externalUrl) ||
    (paddlePriceId !== "" && !/^pri_[a-z0-9]+$/.test(paddlePriceId))
  ) {
    redirect(`/admin?error=product#products`);
  }

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

  const result = id
    ? await supabase.from("products").update(values).eq("id", id)
    : await supabase.from("products").insert(values);

  if (result.error) {
    console.error("Could not save product:", result.error.message);
    redirect(`/admin?error=product#products`);
  }

  refreshStorefront();
  redirect("/admin?notice=product#products");
}

export async function deleteProduct(data: FormData) {
  const supabase = await getAdminClient();
  const id = readText(data, "id", 100);
  if (!id) {
    redirect("/admin?error=product#products");
  }

  const { count, error: keyError } = await supabase
    .from("product_keys")
    .select("id", { count: "exact", head: true })
    .eq("product_id", id);

  if (keyError) {
    console.error("Could not check product inventory before deletion:", keyError.message);
    redirect("/admin?error=product#products");
  }
  if ((count ?? 0) > 0) {
    redirect("/admin?error=product-has-stock#products");
  }

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) {
    console.error("Could not delete product:", error.message);
    redirect("/admin?error=product-in-orders#products");
  }

  refreshStorefront();
  redirect("/admin?notice=product-deleted#products");
}

export async function updateProductStatus(data: FormData) {
  const supabase = await getAdminClient();
  const id = readText(data, "id", 100);
  const isActive = readCheckbox(data, "is_active");

  if (!id) {
    redirect("/admin?error=product#products");
  }

  const { error } = await supabase
    .from("products")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) {
    console.error("Could not update product status:", error.message);
    redirect("/admin?error=product#products");
  }

  refreshStorefront();
  redirect("/admin?notice=product#products");
}

export async function saveCategory(data: FormData) {
  const supabase = await getAdminClient();
  const id = readText(data, "id", 100);
  const name = readText(data, "name", 100);
  const description = readText(data, "description", 500);
  const slug = slugify(readText(data, "slug", 120) || name);
  const isActive = readCheckbox(data, "is_active");

  if (!name || !slug) {
    redirect("/admin?error=category#categories");
  }

  const values = { name, slug, description, is_active: isActive };
  const result = id
    ? await supabase.from("store_categories").update(values).eq("id", id)
    : await supabase.from("store_categories").insert(values);

  if (result.error) {
    console.error("Could not save category:", result.error.message);
    redirect("/admin?error=category#categories");
  }

  refreshStorefront();
  redirect("/admin?notice=category#categories");
}

export async function saveStoreSettings(data: FormData) {
  const supabase = await getAdminClient();
  const discordServerUrl = readText(data, "discord_server_url", 500);
  const discordSupportUrl = readText(data, "discord_support_url", 500);
  const supportEmail = readText(data, "support_email", 254).toLowerCase();
  const maintenanceMessage =
    readText(data, "maintenance_message", 500) || "We will be back shortly.";
  const maintenanceMode = readCheckbox(data, "maintenance_mode");

  if (
    !isValidDiscordInvite(discordServerUrl) ||
    !isValidDiscordInvite(discordSupportUrl) ||
    (supportEmail !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail))
  ) {
    redirect("/admin?error=settings#settings");
  }

  const { error } = await supabase.from("store_settings").upsert(
    {
      id: "default",
      discord_server_url: discordServerUrl,
      discord_support_url: discordSupportUrl,
      support_email: supportEmail,
      maintenance_message: maintenanceMessage,
      maintenance_mode: maintenanceMode,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("Could not save store settings:", error.message);
    redirect("/admin?error=settings#settings");
  }

  refreshStorefront();
  revalidatePath("/support");
  redirect("/admin?notice=settings#settings");
}

export async function savePaymentSettings(data: FormData) {
  const supabase = await getAdminClient();
  const bitcoinEnabled = readCheckbox(data, "bitcoin_enabled");
  const bitcoinAddress = readText(data, "bitcoin_address", 100);
  const bitcoinConfirmations = Number(readText(data, "bitcoin_confirmations", 4));
  const litecoinEnabled = readCheckbox(data, "litecoin_enabled");
  const litecoinAddress = readText(data, "litecoin_address", 100);
  const litecoinConfirmations = Number(readText(data, "litecoin_confirmations", 4));
  const tikkieEnabled = readCheckbox(data, "tikkie_enabled");
  const tikkieUrl = readText(data, "tikkie_url", 500);
  const tikkieInstructions = readText(data, "tikkie_instructions", 2000);
  const timeoutMinutes = Number(readText(data, "payment_timeout_minutes", 6));
  const tikkieResetDate = readText(data, "tikkie_reset_date", 10);
  const tikkieReminderDate = readText(data, "tikkie_reminder_date", 10);
  const tikkieReminderEmail = readText(data, "tikkie_reminder_email", 254).toLowerCase();
  const tikkieReminderEnabled = readCheckbox(data, "tikkie_reminder_enabled");

  const validBitcoinAddress =
    /^(bc1[ac-hj-np-z02-9]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(
      bitcoinAddress,
    );
  const validLitecoinAddress =
    /^(ltc1[ac-hj-np-z02-9]{11,71}|[LM3][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(
      litecoinAddress,
    );

  let validTikkieUrl = !tikkieUrl;
  if (tikkieUrl) {
    try {
      const url = new URL(tikkieUrl);
      validTikkieUrl =
        url.protocol === "https:" &&
        ["tikkie.me", "www.tikkie.me", "pay.tikkie.me", "ing.nl"].includes(
          url.hostname.toLowerCase(),
        ) &&
        !url.username &&
        !url.password;
    } catch {
      validTikkieUrl = false;
    }
  }

  const validDate = (value: string) =>
    value === "" ||
    (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));

  if (
    (bitcoinEnabled && !validBitcoinAddress) ||
    (litecoinEnabled && !validLitecoinAddress) ||
    (tikkieEnabled && (!tikkieUrl || !validTikkieUrl)) ||
    (!tikkieEnabled && tikkieUrl && !validTikkieUrl) ||
    !Number.isInteger(bitcoinConfirmations) ||
    bitcoinConfirmations < 1 ||
    bitcoinConfirmations > 100 ||
    !Number.isInteger(litecoinConfirmations) ||
    litecoinConfirmations < 1 ||
    litecoinConfirmations > 100 ||
    !Number.isInteger(timeoutMinutes) ||
    timeoutMinutes < 5 ||
    timeoutMinutes > 10080 ||
    !validDate(tikkieResetDate) ||
    !validDate(tikkieReminderDate) ||
    (tikkieReminderEnabled &&
      (!tikkieReminderDate ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tikkieReminderEmail)))
  ) {
    redirect("/admin?error=payments#payments");
  }

  const { error } = await supabase.from("store_payment_settings").upsert(
    {
      id: "default",
      bitcoin_enabled: bitcoinEnabled,
      bitcoin_address: bitcoinAddress,
      bitcoin_confirmations: bitcoinConfirmations,
      litecoin_enabled: litecoinEnabled,
      litecoin_address: litecoinAddress,
      litecoin_confirmations: litecoinConfirmations,
      blockchain_provider: "blockcypher",
      tikkie_enabled: tikkieEnabled,
      tikkie_url: tikkieUrl,
      tikkie_instructions: tikkieInstructions,
      payment_timeout_minutes: timeoutMinutes,
      tikkie_reset_date: tikkieResetDate || null,
      tikkie_reminder_date: tikkieReminderDate || null,
      tikkie_reminder_email: tikkieReminderEmail,
      tikkie_reminder_enabled: tikkieReminderEnabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("Could not save payment settings:", error.message);
    redirect("/admin?error=payments#payments");
  }

  revalidatePath("/admin");
  revalidatePath("/cart");
  redirect("/admin?notice=payments#payments");
}

export async function approveStorePayment(data: FormData) {
  const supabase = await getAdminClient();
  const paymentId = readText(data, "payment_id", 36);
  if (!/^[0-9a-f-]{36}$/i.test(paymentId)) {
    redirect("/admin?error=payment#payments");
  }

  const { data: status, error } = await supabase.rpc("approve_store_payment", {
    p_payment_id: paymentId,
  });
  if (error || typeof status !== "string") {
    if (error) console.error("Could not approve customer payment:", error.message);
    redirect("/admin?error=payment#payments");
  }

  const { data: payment, error: paymentError } = await supabase
    .from("store_payments")
    .select("order_id")
    .eq("id", paymentId)
    .maybeSingle();

  const { data: order, error: orderError } = payment
    ? await supabase
        .from("store_orders")
        .select("order_number, customer_email")
        .eq("id", payment.order_id)
        .maybeSingle()
    : { data: null, error: null };

  if (paymentError || orderError) {
    console.error(
      "Payment approved, but notification details could not be loaded:",
      paymentError?.message ?? orderError?.message,
    );
  } else if (payment && order) {
    try {
      const accountUrl = new URL("/account", process.env.NEXT_PUBLIC_SITE_URL);
      await sendStoreEmail({
        dedupeKey: `payment-approved/${payment.order_id}`,
        recipient: order.customer_email,
        subject: `Payment approved for Nexus Suppliers order ${order.order_number}`,
        heading: "Your payment has been approved",
        message:
          status === "fulfilled"
            ? "Your payment is approved and the digital delivery is available in your account."
            : "Your payment is approved. The store is preparing your digital delivery.",
        details: [`Order: ${order.order_number}`, `Status: ${status}`],
        actionUrl: accountUrl.href,
        actionLabel: "View your order",
      });
      if (status === "fulfilled") {
        await sendStoreEmail({
          dedupeKey: `order-completed/${payment.order_id}`,
          recipient: order.customer_email,
          subject: `Nexus Suppliers order ${order.order_number} has been delivered`,
          heading: "Your digital order is complete",
          message: "Your digital delivery is now available in your customer account.",
          details: [`Order: ${order.order_number}`],
          actionUrl: accountUrl.href,
          actionLabel: "View your delivery",
        });
      }
    } catch (emailError) {
      console.error("Payment was approved but its customer email could not be sent:", emailError);
    }
  }

  revalidatePath("/admin");
  revalidatePath("/account");
  redirect(`/admin?notice=payment-approved#payments`);
}

export async function rejectStorePayment(data: FormData) {
  const supabase = await getAdminClient();
  const paymentId = readText(data, "payment_id", 36);
  const reason = readText(data, "reason", 500);
  if (!/^[0-9a-f-]{36}$/i.test(paymentId) || reason.length < 3) {
    redirect("/admin?error=payment#payments");
  }

  const { data: rejected, error } = await supabase.rpc("reject_store_payment", {
    p_payment_id: paymentId,
    p_reason: reason,
  });
  if (error || rejected !== true) {
    if (error) console.error("Could not reject customer payment:", error.message);
    redirect("/admin?error=payment#payments");
  }

  const { data: payment, error: paymentError } = await supabase
    .from("store_payments")
    .select("order_id, rejection_reason")
    .eq("id", paymentId)
    .maybeSingle();

  const { data: order, error: orderError } = payment
    ? await supabase
        .from("store_orders")
        .select("order_number, customer_email")
        .eq("id", payment.order_id)
        .maybeSingle()
    : { data: null, error: null };

  if (paymentError || orderError) {
    console.error(
      "Payment rejected, but notification details could not be loaded:",
      paymentError?.message ?? orderError?.message,
    );
  } else if (payment && order) {
    try {
      await sendStoreEmail({
        dedupeKey: `payment-rejected/${payment.order_id}`,
        recipient: order.customer_email,
        subject: `Payment needs attention for Nexus Suppliers order ${order.order_number}`,
        heading: "Your payment needs attention",
        message: payment.rejection_reason ?? "The store could not approve this payment.",
        details: [`Order: ${order.order_number}`],
        actionUrl: new URL("/account", process.env.NEXT_PUBLIC_SITE_URL).href,
        actionLabel: "Contact support",
      });
    } catch (emailError) {
      console.error("Payment was rejected but its customer email could not be sent:", emailError);
    }
  }

  revalidatePath("/admin");
  revalidatePath("/account");
  redirect("/admin?notice=payment-rejected#payments");
}

export async function saveDiscordWebhook(data: FormData) {
  const supabase = await getAdminClient();
  const webhookUrl = readText(data, "webhook_url", 2000);

  if (!webhookUrl || !isValidDiscordWebhook(webhookUrl)) {
    redirect("/admin?error=webhook#discord");
  }

  const { error } = await supabase.from("discord_webhook_settings").upsert(
    {
      id: "default",
      webhook_url: webhookUrl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("Could not save Discord webhook:", error.message);
    redirect("/admin?error=webhook#discord");
  }

  revalidatePath("/admin");
  redirect("/admin?notice=webhook#discord");
}

export async function clearDiscordWebhook() {
  const supabase = await getAdminClient();
  const { error } = await supabase
    .from("discord_webhook_settings")
    .delete()
    .eq("id", "default");

  if (error) {
    console.error("Could not clear Discord webhook:", error.message);
    redirect("/admin?error=webhook#discord");
  }

  revalidatePath("/admin");
  redirect("/admin?notice=webhook#discord");
}

export async function testDiscordWebhook() {
  const supabase = await getAdminClient();
  const { data, error } = await supabase
    .from("discord_webhook_settings")
    .select("webhook_url")
    .eq("id", "default")
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("Could not load Discord webhook:", error.message);
    redirect("/admin?error=webhook#discord");
  }

  if (!isValidDiscordWebhook(data.webhook_url)) {
    redirect("/admin?error=webhook#discord");
  }

  let response: Response;

  try {
    response = await fetch(data.webhook_url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: "Nexus Suppliers connection test",
            description:
              "Discord notifications are connected. This is a test only; no order was created.",
            color: 0xffffff,
            footer: { text: "Nexus Suppliers · Store management" },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
      cache: "no-store",
      redirect: "error",
    });
  } catch (error) {
    console.error("Discord webhook request failed:", error);
    redirect("/admin?error=webhook#discord");
  }

  if (!response.ok) {
    console.error(
      "Discord webhook returned an error:",
      response.status,
      response.statusText,
    );
    redirect("/admin?error=webhook#discord");
  }

  redirect("/admin?notice=webhook-test#discord");
}

export async function addProductKeys(data: FormData) {
  const supabase = await getAdminClient();
  const productId = readText(data, "product_id", 100);
  const keyLines = readText(data, "keys", 20_000)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (
    !productId ||
    keyLines.length === 0 ||
    keyLines.length > 100 ||
    keyLines.some((key) => key.length > 500)
  ) {
    redirect("/admin?error=keys#keys");
  }

  const { error } = await supabase.from("product_keys").insert(
    [...new Set(keyLines)].map((keyValue) => ({
      product_id: productId,
      key_value: keyValue,
    })),
  );

  if (error) {
    console.error("Could not add product keys:", error.message);
    redirect("/admin?error=keys#keys");
  }

  revalidatePath("/admin");
  redirect("/admin?notice=keys#keys");
}

export async function deleteProductKey(data: FormData) {
  const supabase = await getAdminClient();
  const id = readText(data, "id", 100);

  if (!id) {
    redirect("/admin?error=keys#keys");
  }

  const { data: deletedKey, error } = await supabase
    .from("product_keys")
    .delete()
    .eq("id", id)
    .is("assigned_order_id", null)
    .select("id")
    .maybeSingle();

  if (error || !deletedKey) {
    if (error) console.error("Could not delete product key:", error.message);
    redirect("/admin?error=keys#keys");
  }

  revalidatePath("/admin");
  redirect("/admin?notice=keys#keys");
}

export async function retryPaidOrderFulfillment(data: FormData) {
  const supabase = await getAdminClient();
  const orderId = readText(data, "order_id", 36);

  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    redirect("/admin?error=order#orders");
  }

  const { data: fulfilled, error } = await supabase.rpc("fulfill_store_order", {
    p_order_id: orderId,
  });

  if (error) {
    console.error("Could not retry order fulfillment:", error.message);
    redirect("/admin?error=order#orders");
  }

  revalidatePath("/admin");
  revalidatePath("/account");
  redirect(
    fulfilled
      ? "/admin?notice=order-fulfilled#orders"
      : "/admin?notice=order-pending#orders",
  );
}

export async function completeManualStoreOrder(data: FormData) {
  const supabase = await getAdminClient();
  const orderId = readText(data, "order_id", 36);
  const deliveryContent = readText(data, "delivery_content", 4000);

  if (
    !/^[0-9a-f-]{36}$/i.test(orderId) ||
    deliveryContent.length === 0 ||
    deliveryContent.length > 4000
  ) {
    redirect("/admin?error=manual-delivery#orders");
  }

  const { data: completed, error } = await supabase.rpc(
    "complete_manual_store_order",
    {
      p_order_id: orderId,
      p_delivery_content: deliveryContent,
    },
  );

  if (error || completed !== true) {
    if (error) {
      console.error("Could not complete manual delivery:", error.message);
    }
    redirect("/admin?error=manual-delivery#orders");
  }

  const { data: order, error: orderError } = await supabase
    .from("store_orders")
    .select("order_number, customer_email")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    console.error(
      "Manual delivery completed, but notification details could not be loaded:",
      orderError.message,
    );
  } else if (order) {
    try {
      await sendStoreEmail({
        dedupeKey: `order-completed/${orderId}`,
        recipient: order.customer_email,
        subject: `Nexus Suppliers order ${order.order_number} has been delivered`,
        heading: "Your digital order is complete",
        message: "Your digital delivery is now available in your customer account.",
        details: [`Order: ${order.order_number}`],
        actionUrl: new URL("/account", process.env.NEXT_PUBLIC_SITE_URL).href,
        actionLabel: "View your delivery",
      });
    } catch (emailError) {
      console.error("Manual delivery completed but its customer email could not be sent:", emailError);
    }
  }

  revalidatePath("/admin");
  revalidatePath("/account");
  redirect("/admin?notice=manual-delivery#orders");
}

import "server-only";
import nodemailer from "nodemailer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type StoreEmailOptions = {
  dedupeKey: string;
  recipient: string;
  subject: string;
  heading: string;
  message: string;
  details?: string[];
  actionUrl: string;
  actionLabel: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function formatEmail(options: StoreEmailOptions) {
  const message = escapeHtml(options.message).replace(/\n/g, "<br>");
  const details = (options.details ?? [])
    .map(
      (detail) =>
        `<li style="margin:8px 0;color:#c8ceda">${escapeHtml(detail)}</li>`,
    )
    .join("");
  const actionUrl = escapeHtml(options.actionUrl);
  const actionLabel = escapeHtml(options.actionLabel);
  const html = `<!doctype html><html><body style="margin:0;background:#07090d;color:#f5f7fb;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#07090d;padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#10141c;border:1px solid #262c38;border-radius:20px;overflow:hidden"><tr><td style="padding:28px 32px;border-bottom:1px solid #262c38"><div style="font-size:14px;font-weight:800;letter-spacing:4px">VENTEX</div><div style="margin-top:8px;color:#8791a1;font-size:11px;letter-spacing:2px;text-transform:uppercase">Digital, done beautifully.</div></td></tr><tr><td style="padding:32px"><h1 style="margin:0 0 16px;font-size:24px;line-height:1.3">${escapeHtml(options.heading)}</h1><p style="margin:0;color:#c8ceda;font-size:15px;line-height:1.7">${message}</p>${details ? `<ul style="padding-left:20px;margin:20px 0">${details}</ul>` : ""}<p style="margin:28px 0"><a href="${actionUrl}" style="display:inline-block;border-radius:10px;background:#f5f7fb;padding:13px 18px;color:#10141c;text-decoration:none;font-size:13px;font-weight:700">${actionLabel}</a></p><p style="margin:0;color:#788293;font-size:11px;line-height:1.6">If you did not expect this message, contact VENTEX support.</p></td></tr></table><p style="margin:18px 0 0;color:#636c7a;font-size:11px">VENTEX · Customer notifications</p></td></tr></table></body></html>`;
  const text = [
    options.heading,
    "",
    options.message,
    ...(options.details ?? []),
    "",
    `${options.actionLabel}: ${options.actionUrl}`,
  ].join("\n");

  return { html, text };
}

export async function sendStoreEmail(options: StoreEmailOptions): Promise<void> {
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(options.recipient) ||
    !options.dedupeKey ||
    options.dedupeKey.length > 200
  ) {
    throw new Error("The customer email request contains invalid fields.");
  }

  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  if (!gmailUser || !gmailAppPassword) {
    throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD must be configured for email.");
  }

  let actionUrl: URL;
  try {
    actionUrl = new URL(options.actionUrl);
  } catch {
    throw new Error("A valid Nexus Suppliers account link is required for email.");
  }
  if (
    actionUrl.protocol !== "https:" &&
    !(process.env.NODE_ENV !== "production" && actionUrl.hostname === "localhost")
  ) {
    throw new Error("The Nexus Suppliers email link must use HTTPS.");
  }

  const admin = createSupabaseAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from("store_email_outbox")
    .select("status")
    .eq("dedupe_key", options.dedupeKey)
    .maybeSingle();
  if (lookupError) {
    console.error("Could not check email delivery idempotency:", lookupError.message);
    throw new Error("Email delivery could not be checked.");
  }
  if (existing?.status === "sent") return;

  const { error: claimError } = await admin.from("store_email_outbox").upsert(
    {
      dedupe_key: options.dedupeKey,
      recipient: options.recipient,
      template: options.dedupeKey.split("/")[0],
      status: "queued",
      last_error: null,
    },
    { onConflict: "dedupe_key" },
  );
  if (claimError) {
    console.error("Could not queue transactional email:", claimError.message);
    throw new Error("Email delivery could not be queued.");
  }

  const content = formatEmail(options);
  let messageId: string;
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    });
    const result = await transporter.sendMail({
      from: { name: "Nexus Suppliers", address: gmailUser },
      to: options.recipient,
      subject: options.subject,
      html: content.html,
      text: content.text,
    });
    if (!result.accepted.includes(options.recipient) || !result.messageId) {
      throw new Error("Gmail did not accept the customer email.");
    }
    messageId = result.messageId;
  } catch (error) {
    console.error("Gmail email request failed:", error);
    await admin
      .from("store_email_outbox")
      .update({ status: "failed", last_error: "Provider request failed." })
      .eq("dedupe_key", options.dedupeKey);
    throw new Error("Transactional email could not be sent.");
  }

  const { error: sentError } = await admin
    .from("store_email_outbox")
    .update({
      status: "sent",
      provider_message_id: messageId,
      last_error: null,
      sent_at: new Date().toISOString(),
    })
    .eq("dedupe_key", options.dedupeKey);
  if (sentError) {
    console.error("Could not mark email as sent:", sentError.message);
    throw new Error("Email was accepted but delivery status could not be saved.");
  }
}

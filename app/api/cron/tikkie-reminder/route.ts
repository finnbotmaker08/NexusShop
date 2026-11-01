import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sendStoreEmail } from "@/lib/email";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith("Bearer ")) return false;

  const provided = Buffer.from(authorization.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return (
    provided.length === expected.length &&
    timingSafeEqual(provided, expected)
  );
}

async function sendReminder(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Reminder processing is not configured." },
      { status: 503 },
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: settings, error } = await admin
    .from("store_payment_settings")
    .select("tikkie_reset_date, tikkie_reminder_date, tikkie_reminder_email, tikkie_reminder_enabled")
    .eq("id", "default")
    .maybeSingle();
  if (error) {
    console.error("Could not load Tikkie reminder settings:", error.message);
    return NextResponse.json(
      { error: "Reminder settings could not be loaded." },
      { status: 503 },
    );
  }

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  if (
    !settings?.tikkie_reminder_enabled ||
    !settings.tikkie_reminder_date ||
    settings.tikkie_reminder_date !== today
  ) {
    return NextResponse.json({ sent: false, reason: "No reminder scheduled for today." });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    console.error("NEXT_PUBLIC_SITE_URL is required for the Tikkie reminder link.");
    return NextResponse.json(
      { error: "The reminder link is not configured." },
      { status: 503 },
    );
  }

  try {
    await sendStoreEmail({
      dedupeKey: `tikkie-reset/${today}`,
      recipient: settings.tikkie_reminder_email,
      subject: "Your Tikkie needs to be reset today",
      heading: "Tikkie reset reminder",
      message: "Your Tikkie needs to be reset today. Please update the payment link in your Nexus Suppliers payment settings.",
      details: settings.tikkie_reset_date
        ? [`Configured reset date: ${settings.tikkie_reset_date}`]
        : undefined,
      actionUrl: new URL("/admin#payments", siteUrl).href,
      actionLabel: "Open payment settings",
    });
  } catch (sendError) {
    console.error("Could not send the scheduled Tikkie reminder:", sendError);
    return NextResponse.json(
      { error: "The Tikkie reminder could not be sent." },
      { status: 502 },
    );
  }

  return NextResponse.json({ sent: true, date: today });
}

export async function GET(request: NextRequest) {
  return sendReminder(request);
}

export async function POST(request: NextRequest) {
  return sendReminder(request);
}

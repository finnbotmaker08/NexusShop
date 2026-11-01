"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getResellerSession } from "@/lib/reseller-session";

async function requireSession() {
  const session = await getResellerSession();
  if (!session) redirect("/reseller/login");
  return session;
}

export async function openResellerTicket(formData: FormData) {
  const session = await requireSession();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (subject.length < 3 || subject.length > 160 || body.length < 1 || body.length > 8000) redirect("/reseller/dashboard/support?error=input");

  const admin = createSupabaseAdminClient();
  const { data: ticketId, error } = await admin.rpc("create_reseller_ticket_for_user", {
    p_reseller_id: session.userId,
    p_subject: subject,
    p_body: body,
  });
  if (error || !ticketId) {
    console.error("Reseller ticket creation failed:", error?.message);
    redirect("/reseller/dashboard/support?error=create");
  }
  revalidatePath("/reseller/dashboard");
  redirect(`/reseller/dashboard/support?ticket=${ticketId}&notice=created`);
}

export async function replyToResellerTicket(formData: FormData) {
  const session = await requireSession();
  const ticketId = String(formData.get("ticket_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(ticketId) || body.length < 1 || body.length > 8000) redirect("/reseller/dashboard/support?error=input");

  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("reply_reseller_ticket_for_user", {
    p_reseller_id: session.userId,
    p_ticket_id: ticketId,
    p_body: body,
  });
  if (error) {
    console.error("Reseller ticket reply failed:", error.message);
    redirect(`/reseller/dashboard/support?ticket=${ticketId}&error=reply`);
  }
  revalidatePath("/reseller/dashboard/support");
  redirect(`/reseller/dashboard/support?ticket=${ticketId}&notice=replied`);
}

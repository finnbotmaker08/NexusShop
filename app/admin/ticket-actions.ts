"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isVerifiedAdmin } from "@/lib/admin";

async function getAdminActor() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isVerifiedAdmin(user)) redirect("/login");
  return user!;
}

export async function updateResellerTicket(formData: FormData) {
  const actor = await getAdminActor();
  const ticketId = String(formData.get("ticket_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const priority = String(formData.get("priority") ?? "");
  const allowedStatus = ["open", "in_progress", "waiting_customer", "resolved", "closed"];
  if (!/^[0-9a-f-]{36}$/i.test(ticketId) || !allowedStatus.includes(status) || !["low", "normal", "high", "urgent"].includes(priority)) redirect("/admin/tickets?error=input");
  const admin = createSupabaseAdminClient();
  const { data: prior } = await admin.from("reseller_tickets").select("reseller_id, status, priority").eq("id", ticketId).maybeSingle();
  if (!prior) redirect("/admin/tickets?error=notfound");
  const { error } = await admin.from("reseller_tickets").update({ status, priority, updated_at: new Date().toISOString() }).eq("id", ticketId);
  if (error) { console.error("Ticket update failed:", error.message); redirect(`/admin/tickets?ticket=${ticketId}&error=save`); }
  await admin.from("reseller_audit_log").insert({ actor_id: actor.id, reseller_id: prior.reseller_id, action: "ticket_updated", details: { ticket_id: ticketId, status, priority } });
  revalidatePath("/admin/tickets");
  revalidatePath("/reseller/dashboard/support");
  redirect(`/admin/tickets?ticket=${ticketId}&notice=updated`);
}

export async function replyToResellerTicketAdmin(formData: FormData) {
  const actor = await getAdminActor();
  const ticketId = String(formData.get("ticket_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const isInternal = formData.get("is_internal") === "on";
  if (!/^[0-9a-f-]{36}$/i.test(ticketId) || body.length < 1 || body.length > 8000) redirect("/admin/tickets?error=input");
  const admin = createSupabaseAdminClient();
  const { data: ticket } = await admin.from("reseller_tickets").select("reseller_id,status").eq("id", ticketId).maybeSingle();
  if (!ticket) redirect("/admin/tickets?error=notfound");
  const { error } = await admin.from("reseller_ticket_messages").insert({ ticket_id: ticketId, author_id: actor.id, body, is_internal: isInternal });
  if (error) { console.error("Ticket reply failed:", error.message); redirect(`/admin/tickets?ticket=${ticketId}&error=reply`); }
  if (!isInternal) await admin.from("reseller_tickets").update({ status: "waiting_customer", updated_at: new Date().toISOString() }).eq("id", ticketId);
  await admin.from("reseller_audit_log").insert({ actor_id: actor.id, reseller_id: ticket.reseller_id, action: isInternal ? "ticket_internal_note" : "ticket_reply", details: { ticket_id: ticketId } });
  revalidatePath("/admin/tickets");
  revalidatePath("/reseller/dashboard/support");
  redirect(`/admin/tickets?ticket=${ticketId}&notice=replied`);
}

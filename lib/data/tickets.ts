import "server-only";

import { RECEIPT_LINK_SECONDS } from "@/lib/data/verification";
import { createServerSupabase } from "@/lib/supabase/server";
import { TICKET_SCREENSHOT_BUCKET, ticketIsOpen } from "@/lib/warranty";

// Tickets as the policies give them: a customer gets their own, an admin gets
// all of them. Claims, replacements and replaced credentials are admin-only
// tables, so nothing about the supplier is read on the customer's side, and
// would come back empty if it were.

const TICKET_LIMIT = 20;
const MESSAGE_LIMIT = 200;
const ADMIN_LIST_LIMIT = 100;
const CLOSED_LIST_LIMIT = 30;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const messageColumns = "ticket_messages (id, body, from_seller, created_at)";

// A screenshot link signed now, with the viewer's own token: the storage
// policy decides, as for receipts, and the link dies with the receipt's.
async function screenshotLink(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.storage
    .from(TICKET_SCREENSHOT_BUCKET)
    .createSignedUrl(path, RECEIPT_LINK_SECONDS);
  return error ? null : data.signedUrl;
}

// ───────────────────────────── The customer's side ─────────────────────────────

// Every ticket on one order, newest first, each with its thread.
export async function listOrderTickets(orderId: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("warranty_tickets")
    .select(`id, reason, note, screenshot_path, status, created_at, closed_at, ${messageColumns}`)
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .order("created_at", { referencedTable: "ticket_messages", ascending: true })
    .limit(MESSAGE_LIMIT, { referencedTable: "ticket_messages" })
    .limit(TICKET_LIMIT);
  if (error) throw new Error(`Couldn't load the tickets: ${error.message}`);

  return Promise.all(
    data.map(async ({ screenshot_path, ticket_messages, ...ticket }) => ({
      ...ticket,
      messages: ticket_messages,
      screenshotUrl: await screenshotLink(screenshot_path),
    })),
  );
}
export type OrderTicket = Awaited<ReturnType<typeof listOrderTickets>>[number];

// Whether an order has a ticket waiting on the seller, for the vault page's
// button. Read under the tickets policy, like everything else here.
export async function hasOpenTicket(orderId: string): Promise<boolean> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("warranty_tickets")
    .select("id")
    .eq("order_id", orderId)
    .in("status", ["open", "claimed"])
    .limit(1);
  if (error) throw new Error(`Couldn't load the tickets: ${error.message}`);
  return data.length > 0;
}

// For the vault page: whether a report is waiting on the seller, and how many
// times the login has been replaced. The count changes with every replace, so
// the page can drop a login it showed before the replace.
export async function vaultTicketState(orderId: string): Promise<{ open: boolean; replacements: number }> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("warranty_tickets")
    .select("status")
    .eq("order_id", orderId)
    .limit(TICKET_LIMIT);
  if (error) throw new Error(`Couldn't load the tickets: ${error.message}`);
  return {
    open: data.some((t) => ticketIsOpen(t.status)),
    replacements: data.filter((t) => t.status === "replaced").length,
  };
}

// ───────────────────────────── The seller's side ─────────────────────────────

// The numastore order a support ticket should name: the one the credential in
// the vault now came from. A bought replacement's, newest first, else the
// first purchase. A replacement from a claim keeps the order it was claimed on.
function currentSupplierOrderNumber(
  purchases: { supplier_order_number: string }[],
  replacements: { supplier_order_number: string | null; created_at: string }[],
): string | null {
  const bought = replacements
    .filter((r): r is { supplier_order_number: string; created_at: string } => r.supplier_order_number !== null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return bought[0]?.supplier_order_number ?? purchases[0]?.supplier_order_number ?? null;
}

const listColumns = `id, reason, status, created_at,
  orders!inner (number, product_name, duration_days, warranty_days,
    vault_entries (delivered_at),
    supplier_purchases (supplier_order_number),
    replacements (supplier_order_number, created_at))`;

// Open tickets first, the longest-waiting at the top; then the latest closed.
export async function listTickets() {
  const supabase = await createServerSupabase();
  const [open, closed] = await Promise.all([
    supabase
      .from("warranty_tickets")
      .select(listColumns)
      .in("status", ["open", "claimed"])
      .order("created_at", { ascending: true })
      .limit(ADMIN_LIST_LIMIT),
    supabase
      .from("warranty_tickets")
      .select(listColumns)
      .in("status", ["replaced", "refunded"])
      .order("closed_at", { ascending: false })
      .limit(CLOSED_LIST_LIMIT),
  ]);
  if (open.error) throw new Error(`Couldn't load the tickets: ${open.error.message}`);
  if (closed.error) throw new Error(`Couldn't load the tickets: ${closed.error.message}`);
  const shape = (rows: typeof open.data) =>
    rows.map(({ orders, ...ticket }) => {
      const { vault_entries, supplier_purchases, replacements, ...order } = orders;
      return {
        ...ticket,
        order,
        deliveredAt: vault_entries[0]?.delivered_at ?? null,
        supplierOrderNumber: currentSupplierOrderNumber(supplier_purchases, replacements),
      };
    });
  return { open: shape(open.data), closed: shape(closed.data) };
}
export type TicketListRow = Awaited<ReturnType<typeof listTickets>>["open"][number];

// One ticket with everything the seller decides it from.
export async function getAdminTicket(id: string) {
  if (!uuidPattern.test(id)) return null;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("warranty_tickets")
    .select(
      `id, reason, note, screenshot_path, status, created_at, closed_at, ${messageColumns},
       ticket_claims (supplier_reference, created_at),
       replacements (source, cost, supplier_order_number, created_at),
       orders!inner (id, number, status, price, product_name, duration_days, warranty_days,
         customer_profiles (name, whatsapp),
         payments (method, sender_number, created_at),
         refunds (amount, method, reference, sent_to, created_at),
         vault_entries (kind, delivered_at),
         supplier_purchases (supplier_order_number),
         replacements (supplier_order_number, created_at))`,
    )
    .eq("id", id)
    .order("created_at", { referencedTable: "ticket_messages", ascending: true })
    .limit(MESSAGE_LIMIT, { referencedTable: "ticket_messages" })
    .order("created_at", { referencedTable: "orders.payments", ascending: false })
    .limit(1, { referencedTable: "orders.payments" })
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the ticket: ${error.message}`);
  if (!data) return null;

  const { screenshot_path, ticket_messages, ticket_claims, replacements, orders, ...ticket } = data;
  const { payments, refunds, vault_entries, supplier_purchases, replacements: orderReplacements, ...order } = orders;
  // One claim and one replacement per ticket at most (each keyed by the
  // ticket), but PostgREST may hand them back as lists.
  const claim = Array.isArray(ticket_claims) ? (ticket_claims[0] ?? null) : ticket_claims;
  const replacement = Array.isArray(replacements) ? (replacements[0] ?? null) : replacements;
  return {
    ...ticket,
    messages: ticket_messages,
    screenshotUrl: await screenshotLink(screenshot_path),
    claim,
    replacement,
    order,
    payment: payments[0] ?? null,
    refund: refunds[0] ?? null,
    vault: vault_entries[0] ?? null,
    supplierOrderNumber: currentSupplierOrderNumber(supplier_purchases, orderReplacements),
  };
}
export type AdminTicket = NonNullable<Awaited<ReturnType<typeof getAdminTicket>>>;

// Every credential a replacement took out of this order's vault, with what
// that replacement cost. The ciphertext isn't granted, so it can't be read
// here; the seller sees one only through a recorded reveal.
export async function listReplacedCredentials(orderId: string) {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("replaced_credentials")
    .select("id, kind, replaced_at, replacements (source, cost, supplier_order_number)")
    .eq("order_id", orderId)
    .order("replaced_at", { ascending: false })
    .limit(TICKET_LIMIT);
  if (error) throw new Error(`Couldn't load the replaced credentials: ${error.message}`);
  return data;
}

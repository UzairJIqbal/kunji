import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { RECEIPT_BUCKET } from "@/lib/checkout";
import { createPublicSupabase } from "@/lib/supabase/public";
import { createServerSupabase } from "@/lib/supabase/server";

// As with every other read, the policies decide what comes back. These are
// admin views: a customer calling them would get their own rows only, so the
// pages check viewerSeesAdminRows() before showing anything.

// Long enough to look at the queue and open a receipt, short enough that a
// copied link is dead by the time it could be passed on.
export const RECEIPT_LINK_SECONDS = 10 * 60;

const QUEUE_LIMIT = 100;

// Every payment whose order is waiting on the seller, the longest-waiting
// first. Receipt links are signed now, with the viewer's own token, so the
// storage policy still decides who gets one.
export async function listVerificationQueue() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("payments")
    .select(
      `id, method, transaction_id, sender_number, receipt_path, created_at,
       payment_accounts (account_title, account_number, bank_name),
       orders!inner (id, number, price, product_name, duration_days)`,
    )
    .eq("orders.status", "verifying")
    .order("created_at", { ascending: true })
    .limit(QUEUE_LIMIT);
  if (error) throw new Error(`Couldn't load the queue: ${error.message}`);
  if (data.length === 0) return [];

  const { data: signed, error: signError } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .createSignedUrls(
      data.map((row) => row.receipt_path),
      RECEIPT_LINK_SECONDS,
    );
  if (signError) throw new Error(`Couldn't open the receipts: ${signError.message}`);
  const links = new Map(signed.flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl]] : [])));

  return data.map(({ receipt_path, ...row }) => ({ ...row, receiptUrl: links.get(receipt_path) ?? null }));
}
export type QueueRow = Awaited<ReturnType<typeof listVerificationQueue>>[number];

// ───────────────────────────── One order ─────────────────────────────

const orderNumberPattern = /^[1-9]\d{0,11}$/;
const EVENT_LIMIT = 50;
// The latest reveals are what matter; older ones stay in the table.
const REVEAL_LIMIT = 20;

export async function getAdminOrder(number: string) {
  if (!orderNumberPattern.test(number)) return null;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select(
      `id, number, status, price, product_name, duration_days, warranty_days,
       activation_email, customer_id, created_at,
       customer_profiles (name, whatsapp),
       order_events (id, from_status, to_status, actor_id, created_at),
       payments (method, transaction_id, sender_number, created_at,
                 payment_accounts (account_title, account_number, bank_name)),
       payment_rejections (reason),
       refunds (amount, method, reference, sent_to, created_at),
       plans (product_id, products (account_type), plan_supplier_details (supplier_price, numastore_url)),
       supplier_purchases (supplier_order_number, amount_paid, created_at),
       supply_failures (created_at),
       vault_entries (kind, delivered_at, delivered_by),
       vault_reveals (id, revealed_by, replaced_credential_id, created_at)`,
    )
    .eq("number", Number(number))
    // Moves made in one transaction share a time; the ID keeps their order.
    .order("id", { referencedTable: "order_events" })
    .limit(EVENT_LIMIT, { referencedTable: "order_events" })
    .order("created_at", { referencedTable: "payments", ascending: false })
    .limit(1, { referencedTable: "payments" })
    .limit(1, { referencedTable: "supplier_purchases" })
    .order("created_at", { referencedTable: "vault_reveals", ascending: false })
    .limit(REVEAL_LIMIT, { referencedTable: "vault_reveals" })
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the order: ${error.message}`);
  if (!data) return null;

  // One of each at most (each table's key is the order, and an order is
  // bought once), but PostgREST hands them back as lists.
  const {
    payments,
    payment_rejections,
    refunds,
    plans,
    supplier_purchases,
    supply_failures,
    vault_entries,
    vault_reveals,
    ...order
  } = data;
  return {
    ...order,
    payment: payments[0] ?? null,
    rejection: payment_rejections[0] ?? null,
    refund: refunds[0] ?? null,
    productId: plans.product_id,
    supplier: plans.plan_supplier_details,
    purchase: supplier_purchases[0] ?? null,
    supplyFailure: supply_failures[0] ?? null,
    accountType: plans.products.account_type,
    vault: vault_entries[0] ?? null,
    reveals: vault_reveals,
  };
}

// Who made each move, by the email they sign in with. The customer is named as
// such; a move with no one signed in was made directly on the database.
export async function describeActors(
  actorIds: readonly (string | null)[],
  customerId: string,
): Promise<Map<string, string>> {
  const names = new Map<string, string>([[customerId, "Customer"]]);
  const others = [...new Set(actorIds)].filter((id): id is string => id !== null && id !== customerId);
  if (others.length === 0) return names;

  const clerk = await clerkClient();
  const { data: users } = await clerk.users.getUserList({ userId: others, limit: others.length });
  for (const user of users) {
    names.set(user.id, user.primaryEmailAddress?.emailAddress ?? user.id);
  }
  return names;
}

// ───────────────────────────── Away ─────────────────────────────

export type StoreSettings = { away: boolean; back_at: string | null };

// Read as the public: the banner is the same for everyone.
export async function getStoreSettings(): Promise<StoreSettings> {
  const supabase = createPublicSupabase();
  const { data, error } = await supabase.from("store_settings").select("away, back_at").single();
  if (error) throw new Error(`Couldn't read the store settings: ${error.message}`);
  return data;
}

"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { z } from "zod";
import { MALFORMED, failed, saved } from "@/lib/actions/results";
import { type FormState, idSchema } from "@/lib/catalogue";
import { describeLineProblems, pakistanDateKey, parseStockLines, stockRefusalLabel } from "@/lib/stock";
import { createServerSupabase } from "@/lib/supabase/server";
import { serializeCredential } from "@/lib/vault";
import { credentialFingerprint, encryptCredential } from "@/lib/vault-crypto";

// Stock logins pass through here in plain text and nowhere else: each is
// encrypted and fingerprinted before the database sees it. Nothing here logs,
// no message quotes a line, and no failure carries a database error's own
// text, which can quote the row it refused.

const pasted = z.string({ error: "Paste at least one line" }).max(100_000, "That's too much to paste at once");

export async function addStock(planId: string, prev: FormState, formData: FormData): Promise<FormState> {
  const plan = idSchema.safeParse(planId);
  if (!plan.success) return failed(MALFORMED, prev);
  const text = pasted.safeParse(formData.get("lines"));
  if (!text.success) return failed(text.error.issues[0].message, prev, { lines: [text.error.issues[0].message] });

  // A badly written line stops the whole paste, so the seller fixes it and
  // pastes the lot again rather than working out which half went in.
  const { items, problems } = parseStockLines(text.data, pakistanDateKey(new Date()));
  if (problems.length > 0) {
    const message = `Nothing added. ${describeLineProblems(problems)}.`;
    return failed(message, prev, { lines: ["Fix the lines named above"] });
  }

  let sealed;
  try {
    sealed = items.map((item) => {
      // The ciphertext is sealed to the item's own id, which it keeps when
      // it's delivered, so the id is made here rather than by the database.
      const id = randomUUID();
      return {
        id,
        line: item.line,
        credential: encryptCredential(
          id,
          serializeCredential({ kind: "login", login: item.login, password: item.password }),
        ),
        fingerprint: credentialFingerprint(item.login, item.password),
        supplier_order_number: item.supplierOrderNumber,
        cost: item.cost,
        expires_on: item.expiresOn,
      };
    });
  } catch {
    return failed("Nothing added: the vault key isn't set up on the server.", prev);
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("add_stock", { p_plan_id: plan.data, p_items: sealed });
  if (error?.code === "KJ012") {
    return failed("Nothing added. This product needs the customer's activation email, so it can't be stocked.", prev);
  }
  if (error?.code === "42501") return failed("Nothing added: this account isn't an admin.", prev);
  if (error?.code === "P0002") return failed("Nothing added: this plan no longer exists.", prev);
  if (error) return failed("Nothing added. Nothing was saved; try again.", prev);

  const refused = data.map(({ line, problem }) => ({ line, problem: stockRefusalLabel[problem] ?? "refused" }));
  const added = items.length - refused.length;
  refresh();
  if (refused.length === 0) return saved(`Added ${added}.`, prev);
  // When some went in, the paste is cleared so it can't be sent twice; the
  // message names the lines that didn't.
  const message = `Added ${added}. Refused ${describeLineProblems(refused)}.`;
  return added > 0 ? saved(message, prev) : failed(message, prev);
}

// Only an unsold item: the database refuses one already in a customer's vault,
// including one an approval took a moment before this tap.
export async function removeStockItem(itemId: string, prev: FormState): Promise<FormState> {
  const item = idSchema.safeParse(itemId);
  if (!item.success) return failed(MALFORMED, prev);

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("remove_stock_item", { p_item_id: item.data });
  if (error?.code === "KJ013") {
    refresh();
    return failed("Not removed: it was just delivered to an order.", prev);
  }
  if (error?.code === "42501") return failed("Not removed: this account isn't an admin.", prev);
  if (error?.code === "P0002") {
    refresh();
    return failed("Already removed.", prev);
  }
  if (error) return failed("Not removed. Try again.", prev);

  refresh();
  return saved("Removed.", prev);
}

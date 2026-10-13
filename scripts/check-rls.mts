// Fails if any table outside Supabase's own schemas has row-level security
// off, if a vault entry can be inserted without going through delivery, or if
// a customer can open a ticket on an order whose warranty has ended, or if a
// review can be written by anyone but a delivered order's own customer or
// changed by anyone but its author, or if a customer can reach the seller's
// notification devices or switches, or if stock can be read, added or taken
// by anyone but the seller and approval.
// Runs from the terminal now and in CI later, so it talks to Postgres
// directly rather than through the MCP. Nothing it does is kept: the insert
// attempt runs in a transaction that is always rolled back.
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (.env.local locally, a secret in CI).");
  process.exit(1);
}

const sql = postgres(url, { max: 1, connect_timeout: 10, onnotice: () => {} });

// Supabase manages security in its own schemas; every other schema is ours.
// Kept in step with the exclusion list in the ensure_rls event trigger.
const rows = await sql<{ table: string; rls: boolean; policies: number }[]>`
  select format('%I.%I', n.nspname, c.relname) as table,
         c.relrowsecurity as rls,
         (select count(*) from pg_policy p where p.polrelid = c.oid)::int as policies
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p')
    and n.nspname not in (
      'information_schema', 'auth', 'storage', 'realtime', '_realtime',
      'extensions', 'graphql', 'graphql_public', 'vault', 'pgbouncer', 'net',
      'cron', 'supabase_functions', 'supabase_migrations', '_analytics',
      'pgsodium', 'pgsodium_masks', 'pgmq'
    )
    and left(n.nspname, 3) <> 'pg_'  -- pg_catalog, pg_toast, pg_temp_*
  order by 1
`;

// No tables at all means we're pointed at the wrong database, not that all is well.
if (rows.length === 0) {
  console.error("Found no tables to check. Is DATABASE_URL the right project?");
  process.exit(1);
}

const missing = rows.filter((r) => !r.rls);
for (const r of rows) {
  const state = r.rls ? "ok    " : "NO RLS";
  console.log(`${state}  ${r.table}  (${r.policies} ${r.policies === 1 ? "policy" : "policies"})`);
}

if (missing.length > 0) {
  await sql.end();
  console.error(`\nFAIL: ${missing.length} table(s) without row-level security: ${missing.map((r) => r.table).join(", ")}`);
  process.exit(1);
}
console.log(`\nPASS: all ${rows.length} tables have row-level security on.`);

// ───────────────────────────── Vault entries ─────────────────────────────

// A vault entry is made only by deliver_order, which checks the order is at
// bought. So even the seller, signed in, inserting straight into the table for
// a paid order must be refused for want of permission. Any other outcome
// fails, including having no admin or paid order to try it with: a check that
// can't run doesn't pass.
class RolledBack extends Error {}
let outcome = "did not run";
try {
  await sql.begin(async (tx) => {
    const [admin] = await tx<{ id: string }[]>`select clerk_user_id as id from public.admins limit 1`;
    const [order] = await tx<{ id: string; customer_id: string }[]>`
      select id, customer_id from public.orders where status = 'paid' limit 1
    `;
    if (!admin || !order) {
      outcome = `could not run: needs an admin and a paid order (admin ${admin ? "found" : "missing"}, paid order ${order ? "found" : "missing"})`;
      throw new RolledBack();
    }

    await tx`set local role authenticated`;
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: admin.id, role: "authenticated" })}, true)`;
    try {
      // Well-formed ciphertext, so only a permission can refuse it, not the
      // column's check.
      await tx.savepoint(
        (sp) => sp`
          insert into public.vault_entries (order_id, customer_id, kind, credential)
          values (${order.id}, ${order.customer_id}, 'login', ${`v1:${"A".repeat(60)}`})
        `,
      );
      outcome = "ACCEPTED: the seller inserted a vault entry on a paid order directly";
    } catch (error) {
      const code = error instanceof postgres.PostgresError ? error.code : "unknown";
      outcome = code === "42501" ? "ok" : `refused, but not for permission (${code})`;
    }
    throw new RolledBack();
  });
} catch (error) {
  if (!(error instanceof RolledBack)) {
    await sql.end();
    throw error;
  }
}

if (outcome !== "ok") {
  await sql.end();
  console.error(`\nFAIL: direct vault insert on a paid order: ${outcome}`);
  process.exit(1);
}
console.log("PASS: a direct vault insert on a paid order is refused; only delivery makes entries.");

// ───────────────────────────── Warranty tickets ─────────────────────────────

// The warranty end is the database's to check. A delivered order's delivery
// is moved back past its warranty, inside the rolled-back transaction, and its
// own customer, signed in, inserts a ticket straight into the table. Anything
// but the warranty refusal (KJ009) fails, including there being no delivered
// order with a warranty to try it on.
let ticketOutcome = "did not run";
try {
  await sql.begin(async (tx) => {
    const [order] = await tx<{ id: string; customer_id: string }[]>`
      select o.id, o.customer_id
      from public.orders o
      join public.vault_entries v on v.order_id = o.id
      where o.status in ('delivered', 'replaced') and o.warranty_days > 0
      limit 1
    `;
    if (!order) {
      ticketOutcome = "could not run: needs a delivered order with a warranty";
      throw new RolledBack();
    }
    await tx`
      update public.vault_entries v
      set delivered_at = now() - make_interval(days => o.warranty_days) - interval '1 minute'
      from public.orders o
      where o.id = v.order_id and v.order_id = ${order.id}
    `;

    await tx`set local role authenticated`;
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: order.customer_id, role: "authenticated" })}, true)`;
    try {
      await tx.savepoint(
        (sp) => sp`
          insert into public.warranty_tickets (order_id, customer_id, reason)
          values (${order.id}, ${order.customer_id}, 'login_failed')
        `,
      );
      ticketOutcome = "ACCEPTED: a ticket was opened on an order past its warranty";
    } catch (error) {
      const code = error instanceof postgres.PostgresError ? error.code : "unknown";
      ticketOutcome = code === "KJ009" ? "ok" : `refused, but not for the warranty (${code})`;
    }
    throw new RolledBack();
  });
} catch (error) {
  if (!(error instanceof RolledBack)) {
    await sql.end();
    throw error;
  }
}

if (ticketOutcome !== "ok") {
  await sql.end();
  console.error(`\nFAIL: ticket on an order past its warranty: ${ticketOutcome}`);
  process.exit(1);
}
console.log("PASS: a ticket on an order past its warranty is refused by the database.");

// ───────────────────────────── Reports ─────────────────────────────

// A customer calling each report function directly is refused for permission,
// and reads no planned margin. The seller, the same way, gets rows from each
// that has any, so the refusal is about who's asking, not a function that
// refuses everyone. No customer or admin to try it with fails.
const reportFailures: string[] = [];
try {
  await sql.begin(async (tx) => {
    const [admin] = await tx<{ id: string }[]>`select clerk_user_id as id from public.admins limit 1`;
    const [customer] = await tx<{ id: string }[]>`
      select o.customer_id as id from public.orders o
      where not exists (select 1 from public.admins a where a.clerk_user_id = o.customer_id)
      limit 1
    `;
    if (!admin || !customer) {
      reportFailures.push(
        `could not run: needs an admin and a customer with an order (admin ${admin ? "found" : "missing"}, customer ${customer ? "found" : "missing"})`,
      );
      throw new RolledBack();
    }

    await tx`set local role authenticated`;
    const signIn = (sub: string) =>
      tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub, role: "authenticated" })}, true)`;
    const reports = ["report_products", "report_waiting_times", "report_orders"] as const;
    const call = (sp: postgres.TransactionSql, fn: (typeof reports)[number]) => sp`select * from ${sp("public")}.${sp(fn)}()`;

    await signIn(customer.id);
    for (const fn of reports) {
      try {
        await tx.savepoint((sp) => call(sp, fn));
        reportFailures.push(`a customer calling ${fn}: ACCEPTED`);
      } catch (error) {
        const code = error instanceof postgres.PostgresError ? error.code : "unknown";
        if (code !== "42501") reportFailures.push(`a customer calling ${fn}: refused, but not for permission (${code})`);
      }
    }
    const [margins] = await tx<{ n: number }[]>`select count(*)::int as n from public.order_planned_margins`;
    if (margins.n !== 0) reportFailures.push(`a customer read ${margins.n} planned margins`);

    await signIn(admin.id);
    const [orders] = await tx<{ n: number }[]>`select count(*)::int as n from public.report_orders()`;
    const [all] = await tx<{ n: number }[]>`select count(*)::int as n from public.orders`;
    if (orders.n !== all.n) reportFailures.push(`the seller's all-time report_orders returned ${orders.n} of ${all.n} orders`);
    throw new RolledBack();
  });
} catch (error) {
  if (!(error instanceof RolledBack)) {
    await sql.end();
    throw error;
  }
}

if (reportFailures.length > 0) {
  await sql.end();
  console.error(`\nFAIL: reports:\n  ${reportFailures.join("\n  ")}`);
  process.exit(1);
}
console.log("PASS: a customer calling a report directly is refused; the seller sees every order.");

// ───────────────────────────── Seller notifications ─────────────────────────────

// The seller's devices and switches are admin-only. A device is planted (as
// the database owner, inside the rolled-back transaction) so there is one to
// leak. A customer reads neither table and can't add a device; through the
// narrow door, they get nothing for another customer's order, and for their
// own verifying order only the switches and ciphertext. Dropping a device
// needs its tag, which the door never hands out, so a guessed tag removes
// nothing. The seller reads both tables. No admin or verifying order fails.
const alertFailures: string[] = [];
try {
  await sql.begin(async (tx) => {
    const [admin] = await tx<{ id: string }[]>`select clerk_user_id as id from public.admins limit 1`;
    const [verifying] = await tx<{ id: string; customer_id: string }[]>`
      select o.id, o.customer_id from public.orders o
      where o.status = 'verifying'
        and not exists (select 1 from public.admins a where a.clerk_user_id = o.customer_id)
      limit 1
    `;
    if (!admin || !verifying) {
      alertFailures.push(
        `could not run: needs an admin and a customer's verifying order (admin ${admin ? "found" : "missing"}, verifying ${verifying ? "found" : "missing"})`,
      );
      throw new RolledBack();
    }
    const tag = "a".repeat(64);
    await tx`
      insert into public.push_subscriptions (subscription, endpoint_tag, label, created_by)
      values (${`v1:${"B".repeat(80)}`}, ${tag}, 'planted by check:rls', ${admin.id})
    `;

    await tx`set local role authenticated`;
    const signIn = (sub: string) =>
      tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub, role: "authenticated" })}, true)`;

    await signIn(verifying.customer_id);
    const [devices] = await tx<{ n: number }[]>`select count(*)::int as n from public.push_subscriptions`;
    if (devices.n !== 0) alertFailures.push(`a customer read ${devices.n} push subscriptions`);
    const [settings] = await tx<{ n: number }[]>`select count(*)::int as n from public.seller_alert_settings`;
    if (settings.n !== 0) alertFailures.push("a customer read the notification switches");
    try {
      await tx.savepoint((sp) => sp`
        insert into public.push_subscriptions (subscription, endpoint_tag, label)
        values (${`v1:${"C".repeat(80)}`}, ${"b".repeat(64)}, 'customer')
      `);
      alertFailures.push("a customer added a push subscription: ACCEPTED");
    } catch (error) {
      const code = error instanceof postgres.PostgresError ? error.code : "unknown";
      if (code !== "42501") alertFailures.push(`a customer adding a push subscription: refused, but not for permission (${code})`);
    }

    const own = await tx<{ subscriptions: string[] }[]>`select subscriptions from public.proof_alert_targets(${verifying.id})`;
    if (own.length !== 1) alertFailures.push(`the order's own customer got ${own.length} rows from proof_alert_targets, not 1`);
    else if (!own[0].subscriptions.includes(`v1:${"B".repeat(80)}`) || own[0].subscriptions.some((x) => !x.startsWith("v1:"))) {
      alertFailures.push("proof_alert_targets gave the customer something other than the sealed subscriptions");
    }
    await tx`select public.drop_push_subscription(${verifying.id}, ${"c".repeat(64)})`;

    await signIn("user_checkrlsnobody");
    const other = await tx`select 1 from public.proof_alert_targets(${verifying.id})`;
    if (other.length !== 0) alertFailures.push("another signed-in user got the notification targets for someone's order");
    await tx`select public.drop_push_subscription(${verifying.id}, ${tag})`;

    await signIn(admin.id);
    const [kept] = await tx<{ n: number }[]>`select count(*)::int as n from public.push_subscriptions where endpoint_tag = ${tag}`;
    if (kept.n !== 1) alertFailures.push("a device was removed by someone without its tag or its order");
    const [seen] = await tx<{ n: number }[]>`select count(*)::int as n from public.seller_alert_settings`;
    if (seen.n !== 1) alertFailures.push("the seller can't read the notification switches");
    throw new RolledBack();
  });
} catch (error) {
  if (!(error instanceof RolledBack)) {
    await sql.end();
    throw error;
  }
}

if (alertFailures.length > 0) {
  await sql.end();
  console.error(`\nFAIL: seller notifications:\n  ${alertFailures.join("\n  ")}`);
  process.exit(1);
}
console.log("PASS: the seller's devices and switches are admin-only; a customer sees only ciphertext, for their own verifying order.");

// ───────────────────────────── Reviews ─────────────────────────────

// Straight into the table, the way a forged request or a seed script would:
// SQL with no signed-in user is refused, a verifying order's own customer is
// refused, a delivered order's customer gets one review and no second, and the
// seller (as the database owner, so no policy or grant is in the way, only the
// trigger) can't change its stars. Each attempt must end exactly as expected;
// missing an order to try it on fails too.
const reviewFailures: string[] = [];
try {
  await sql.begin(async (tx) => {
    const [admin] = await tx<{ id: string }[]>`select clerk_user_id as id from public.admins limit 1`;
    const [verifying] = await tx<{ id: string; customer_id: string }[]>`
      select id, customer_id from public.orders where status = 'verifying' limit 1
    `;
    const [delivered] = await tx<{ id: string; customer_id: string }[]>`
      select o.id, o.customer_id
      from public.orders o
      join public.vault_entries v on v.order_id = o.id
      where o.status in ('delivered', 'replaced')
        and not exists (select 1 from public.reviews r where r.order_id = o.id)
      limit 1
    `;
    if (!admin || !verifying || !delivered) {
      reviewFailures.push(
        `could not run: needs an admin, a verifying order and an unreviewed delivered order (admin ${admin ? "found" : "missing"}, verifying ${verifying ? "found" : "missing"}, delivered ${delivered ? "found" : "missing"})`,
      );
      throw new RolledBack();
    }

    const signIn = (sub: string) =>
      tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub, role: "authenticated" })}, true)`;
    // null when it ended as expected, otherwise what went wrong.
    const attempt = async (label: string, expected: string | null, run: (sp: postgres.TransactionSql) => postgres.PendingQuery<postgres.Row[]>) => {
      try {
        await tx.savepoint(run);
        if (expected !== null) reviewFailures.push(`${label}: ACCEPTED`);
      } catch (error) {
        const code = error instanceof postgres.PostgresError ? error.code : "unknown";
        if (code !== expected) reviewFailures.push(`${label}: ${expected === null ? "refused" : "refused, but not as expected"} (${code})`);
      }
    };

    await attempt("a review inserted by SQL with no signed-in user", "42501", (sp) => sp`
      insert into public.reviews (order_id, customer_id, rating)
      values (${delivered.id}, ${delivered.customer_id}, 5)
    `);

    await tx`set local role authenticated`;
    await signIn(verifying.customer_id);
    await attempt("a review on a verifying order", "KJ011", (sp) => sp`
      insert into public.reviews (order_id, customer_id, rating)
      values (${verifying.id}, ${verifying.customer_id}, 5)
    `);

    await signIn(delivered.customer_id);
    const insertDelivered = (sp: postgres.TransactionSql) => sp`
      insert into public.reviews (order_id, customer_id, rating)
      values (${delivered.id}, ${delivered.customer_id}, 4)
    `;
    await attempt("the first review on a delivered order", null, insertDelivered);
    await attempt("a second review on the same order", "23505", insertDelivered);

    await tx`reset role`;
    await signIn(admin.id);
    await attempt("the seller changing a review's stars", "42501", (sp) => sp`
      update public.reviews set rating = 1 where order_id = ${delivered.id}
    `);
    throw new RolledBack();
  });
} catch (error) {
  if (!(error instanceof RolledBack)) {
    await sql.end();
    throw error;
  }
}

if (reviewFailures.length > 0) {
  await sql.end();
  console.error(`\nFAIL: reviews:\n  ${reviewFailures.join("\n  ")}`);
  process.exit(1);
}
console.log("PASS: only a delivered order's own customer can review it, once, and only they can change it.");

// ───────────────────────────── Stock ─────────────────────────────

// Two items are planted (as the database owner) on the plan of a customer's
// order waiting for approval: one held back, one fit to sell. A customer reads
// no stock and can't add any; nobody signed in, the seller included, can
// select a credential or fingerprint or insert a row; the public learns which
// plans are instant and nothing else. Then the seller approves with only the
// held-back item there (nothing taken), and again with the good one: the
// order goes paid, bought, delivered in that one call, and the vault entry
// is the item. A customer can't remove stock; the seller removes the unsold
// item but not the delivered one. No admin or approvable login order fails.
const stockFailures: string[] = [];
try {
  await sql.begin(async (tx) => {
    const [admin] = await tx<{ id: string }[]>`select clerk_user_id as id from public.admins limit 1`;
    const [order] = await tx<{ id: string; customer_id: string; plan_id: string; duration_days: number }[]>`
      select o.id, o.customer_id, o.plan_id, o.duration_days from public.orders o
      where o.status in ('verifying', 'rejected')
        and o.activation_email is null
        and not exists (select 1 from public.admins a where a.clerk_user_id = o.customer_id)
      limit 1
    `;
    if (!admin || !order) {
      stockFailures.push(
        `could not run: needs an admin and a customer's verifying or rejected order without an activation email (admin ${admin ? "found" : "missing"}, order ${order ? "found" : "missing"})`,
      );
      throw new RolledBack();
    }
    const plant = (number: string, fingerprintChar: string, days: number) => tx<{ id: string }[]>`
      insert into public.stock_items (plan_id, credential, fingerprint, supplier_order_number, cost, expires_at)
      values (${order.plan_id}, ${`v1:${"S".repeat(80)}`}, ${fingerprintChar.repeat(64)}, ${number}, 1,
              now() + ${days} * interval '1 day')
      returning id
    `;
    const [heldBack] = await plant("CHECKRLS-HELD", "a", order.duration_days * 0.5);

    const signIn = (sub: string) =>
      tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub, role: "authenticated" })}, true)`;
    const attempt = async (label: string, expected: string, run: (sp: postgres.TransactionSql) => postgres.PendingQuery<postgres.Row[]>) => {
      try {
        await tx.savepoint(run);
        stockFailures.push(`${label}: ACCEPTED`);
      } catch (error) {
        const code = error instanceof postgres.PostgresError ? error.code : "unknown";
        if (code !== expected) stockFailures.push(`${label}: refused, but not as expected (${code})`);
      }
    };

    await tx`set local role anon`;
    const instant = await tx`select * from public.instant_plans(${[order.plan_id]}::uuid[])`;
    if (instant.length !== 0) stockFailures.push("a plan with only a held-back item is offered as instant");
    await tx`reset role`;
    const [good] = await plant("CHECKRLS-GOOD", "b", order.duration_days * 2);
    await tx`set local role anon`;
    const offered = await tx`select * from public.instant_plans(${[order.plan_id]}::uuid[])`;
    if (offered.length > 1 || (offered[0] && Object.keys(offered[0]).sort().join() !== "least_expires_at,plan_id")) {
      stockFailures.push(`the public got more than plan and date from instant_plans: ${JSON.stringify(Object.keys(offered[0] ?? {}))}`);
    }
    await attempt("the public reading stock", "42501", (sp) => sp`select id from public.stock_items`);

    await tx`set local role authenticated`;
    await signIn(order.customer_id);
    const [seen] = await tx<{ n: number }[]>`select count(*)::int as n from public.stock_item_states`;
    if (seen.n !== 0) stockFailures.push(`a customer read ${seen.n} stock items`);
    await attempt("a customer adding stock", "42501", (sp) => sp`
      select * from public.add_stock(${order.plan_id}, '[]'::jsonb)
    `);
    await attempt("a customer approving their own payment", "42501", (sp) => sp`select public.approve_payment(${order.id})`);
    await attempt("a customer removing stock", "42501", (sp) => sp`select public.remove_stock_item(${heldBack.id})`);

    await signIn(admin.id);
    await attempt("the seller selecting a stock credential", "42501", (sp) => sp`select credential from public.stock_items`);
    await attempt("the seller selecting a stock fingerprint", "42501", (sp) => sp`select fingerprint from public.stock_items`);
    await attempt("the seller inserting stock directly", "42501", (sp) => sp`
      insert into public.stock_items (plan_id, credential, fingerprint, supplier_order_number, cost, expires_at)
      values (${order.plan_id}, ${`v1:${"T".repeat(80)}`}, ${"c".repeat(64)}, 'CHECKRLS-DIRECT', 1, now() + interval '400 days')
    `);

    // Only the held-back item: approved, but nothing taken.
    await tx`reset role`;
    await tx`update public.stock_items set expires_at = now() + interval '1 hour' where id = ${good.id}`;
    await tx`set local role authenticated`;
    await tx.savepoint(async (sp) => {
      const [{ delivered }] = await sp<{ delivered: boolean }[]>`select public.approve_payment(${order.id}) as delivered`;
      const [taken] = await sp<{ n: number }[]>`select count(*)::int as n from public.stock_items where order_id is not null and id in (${heldBack.id}, ${good.id})`;
      if (delivered || taken.n !== 0) stockFailures.push("approval took an item held back for being too close to its end");
      throw new RolledBack();
    }).catch((error) => {
      if (!(error instanceof RolledBack)) throw error;
    });
    await tx`reset role`;
    await tx`update public.stock_items set expires_at = now() + ${order.duration_days * 2} * interval '1 day' where id = ${good.id}`;
    await tx`set local role authenticated`;

    const [{ delivered }] = await tx<{ delivered: boolean }[]>`select public.approve_payment(${order.id}) as delivered`;
    // Read back as the owner: which item a vault entry came from isn't granted to anyone.
    await tx`reset role`;
    const [after] = await tx<{ status: string }[]>`select status from public.orders where id = ${order.id}`;
    const moves = await tx<{ to_status: string }[]>`
      select to_status from public.order_events where order_id = ${order.id} order by id desc limit 3
    `;
    const [entry] = await tx<{ stock_item_id: string | null }[]>`select stock_item_id from public.vault_entries where order_id = ${order.id}`;
    if (!delivered || after.status !== "delivered") stockFailures.push(`approving with stock left the order ${after.status}`);
    if (moves.map((m) => m.to_status).reverse().join() !== "paid,bought,delivered") {
      stockFailures.push(`approving with stock recorded ${moves.map((m) => m.to_status).reverse().join(", ")}, not paid, bought, delivered`);
    }
    if (entry?.stock_item_id !== good.id) stockFailures.push("the vault entry isn't the stock item that was taken");

    // The seller removes the unsold one; the delivered one stays.
    await tx`set local role authenticated`;
    await signIn(admin.id);
    await attempt("the seller removing a delivered item", "KJ013", (sp) => sp`select public.remove_stock_item(${good.id})`);
    await tx`select public.remove_stock_item(${heldBack.id})`;
    await tx`reset role`;
    const [left] = await tx<{ n: number }[]>`select count(*)::int as n from public.stock_items where id in (${heldBack.id}, ${good.id})`;
    if (left.n !== 1) stockFailures.push(`removing the unsold item left ${left.n} of the two`);
    throw new RolledBack();
  });
} catch (error) {
  if (!(error instanceof RolledBack)) throw error;
} finally {
  await sql.end();
}

if (stockFailures.length > 0) {
  console.error(`\nFAIL: stock:\n  ${stockFailures.join("\n  ")}`);
  process.exit(1);
}
console.log("PASS: stock is the seller's alone, credentials unreadable; approval delivers a sellable item in one step and holds back the rest; only unsold items can be removed.");

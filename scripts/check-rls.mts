// Fails if any table outside Supabase's own schemas has row-level security
// off, if a vault entry can be inserted without going through delivery, or if
// a customer can open a ticket on an order whose warranty has ended, or if a
// review can be written by anyone but a delivered order's own customer or
// changed by anyone but its author.
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
  if (!(error instanceof RolledBack)) throw error;
} finally {
  await sql.end();
}

if (reviewFailures.length > 0) {
  console.error(`\nFAIL: reviews:\n  ${reviewFailures.join("\n  ")}`);
  process.exit(1);
}
console.log("PASS: only a delivered order's own customer can review it, once, and only they can change it.");

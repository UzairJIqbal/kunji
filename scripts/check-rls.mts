// Fails if any table outside Supabase's own schemas has row-level security
// off. Runs from the terminal now and in CI later, so it talks to Postgres
// directly rather than through the MCP. It reads only the system catalogue.
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
await sql.end();

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
  console.error(`\nFAIL: ${missing.length} table(s) without row-level security: ${missing.map((r) => r.table).join(", ")}`);
  process.exit(1);
}
console.log(`\nPASS: all ${rows.length} tables have row-level security on.`);

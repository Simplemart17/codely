// Codely lives in its own Postgres schema (not `public`) so it can share a
// database with other applications. This name must match:
//   - the `codely` schema in supabase/migrations
//   - the API's exposed schemas (Dashboard → API, or `[api] schemas` in config.toml)
export const DB_SCHEMA = 'codely';

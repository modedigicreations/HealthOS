import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import * as schema from './schema.js';

export type HealthOsDb = NodePgDatabase<typeof schema>;

export function createDbPool(connectionString: string): Pool {
  return new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

export function createDb(pool: Pool): HealthOsDb {
  return drizzle(pool, { schema });
}

export interface TenantSessionContext {
  organizationId: string;
  branchId?: string | null;
  actorId?: string | null;
}

/**
 * Executes a callback inside a PostgreSQL transaction with session-local
 * Row-Level Security (RLS) variables bound via SET LOCAL.
 *
 * Even if a downstream query omits a WHERE organization_id clause, PostgreSQL
 * RLS policies enforce strict tenant isolation.
 */
export async function withTenantContext<T>(
  db: HealthOsDb,
  ctx: TenantSessionContext,
  fn: (tx: HealthOsDb) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.organization_id', ${ctx.organizationId}, true)`);
    if (ctx.branchId) {
      await tx.execute(sql`SELECT set_config('app.branch_id', ${ctx.branchId}, true)`);
    }
    if (ctx.actorId) {
      await tx.execute(sql`SELECT set_config('app.actor_id', ${ctx.actorId}, true)`);
    }
    return fn(tx as unknown as HealthOsDb);
  });
}

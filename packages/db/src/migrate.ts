import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(__dirname, '..');

async function runMigrations() {
  const databaseUrl =
    process.env.DATABASE_URL ??
    'postgresql://healthos:healthos_dev_password@localhost:5432/healthos';

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS healthos_migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const applyDir = async (dirPath: string, prefix: string) => {
      if (!existsSync(dirPath)) return;
      const files = readdirSync(dirPath)
        .filter((f) => f.endsWith('.sql'))
        .sort();

      for (const file of files) {
        const key = `${prefix}/${file}`;
        const { rows } = await pool.query(
          'SELECT 1 FROM healthos_migrations WHERE name = $1',
          [key],
        );
        if (rows.length > 0) {
          console.log(`Skipping already applied: ${key}`);
          continue;
        }

        const sqlText = readFileSync(join(dirPath, file), 'utf8');
        console.log(`Applying migration: ${key}`);
        await pool.query('BEGIN');
        try {
          await pool.query(sqlText);
          await pool.query('INSERT INTO healthos_migrations (name) VALUES ($1)', [key]);
          await pool.query('COMMIT');
        } catch (err) {
          await pool.query('ROLLBACK');
          throw err;
        }
      }
    };

    // 1. Apply generated Drizzle DDL tables first
    await applyDir(join(pkgRoot, 'drizzle'), 'drizzle');
    // 2. Apply HealthOS RLS & immutable audit-log triggers
    await applyDir(join(pkgRoot, 'migrations'), 'rls');

    console.log('All HealthOS PostgreSQL migrations applied successfully.');
  } finally {
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

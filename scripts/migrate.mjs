import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { neon } from "@neondatabase/serverless";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const db = drizzle(sql);

console.log("Running Drizzle migrations...");

try {
  // Bootstrap: ensure the Drizzle migration tracking table exists.
  await sql`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

  // Check if 0000 migration is already tracked in Drizzle's journal.
  const existing0000 = await sql`
    SELECT hash FROM "__drizzle_migrations" WHERE hash = '0000_hard_vin_gonzales'
  `;

  if (existing0000.length === 0) {
    // Check if ANY of the tables created by 0000 already exist in the database.
    // We check 'accounts' because it's the first table in the migration and the
    // one that was causing "already exists" failures on re-deploy.
    const tablesExist = await sql`
      SELECT COUNT(*) as count FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('users', 'accounts', 'sessions', 'generations', 'subscriptions', 'verification_tokens')
    `;

    if (parseInt(tablesExist[0].count) > 0) {
      console.log("Detected existing database schema — marking 0000 migration as already applied...");
      await sql`
        INSERT INTO "__drizzle_migrations" (hash, created_at)
        VALUES ('0000_hard_vin_gonzales', ${Date.now()})
      `;
      console.log("Bootstrap complete.");
    }
  }

  // Check if 0001 migration is already tracked.
  const existing0001 = await sql`
    SELECT hash FROM "__drizzle_migrations" WHERE hash = '0001_ambiguous_blazing_skull'
  `;

  if (existing0001.length === 0) {
    // Check if the tables from 0001 already exist (brands, social_posts, brand_social_insights).
    const tables0001Exist = await sql`
      SELECT COUNT(*) as count FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('brands', 'social_posts', 'brand_social_insights')
    `;

    if (parseInt(tables0001Exist[0].count) > 0) {
      console.log("Detected existing 0001 schema — marking 0001 migration as already applied...");
      await sql`
        INSERT INTO "__drizzle_migrations" (hash, created_at)
        VALUES ('0001_ambiguous_blazing_skull', ${Date.now()})
      `;
      console.log("Bootstrap 0001 complete.");
    }
  }

  await migrate(db, {
    migrationsFolder: join(__dirname, "../drizzle"),
  });
  console.log("All migrations complete.");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
}

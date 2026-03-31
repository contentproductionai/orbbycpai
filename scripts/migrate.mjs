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

// Drizzle's neon-http migrator stores migration records in the "drizzle" schema,
// NOT the "public" schema. The table is drizzle.__drizzle_migrations.
// It checks: if the last recorded created_at < migration.folderMillis, run the migration.
//
// Hashes and folderMillis are derived from the actual migration files:
//   0000: hash=92c8513d..., folderMillis=1773330959791
//   0001: hash=efd82c2c..., folderMillis=1774571040107

const MIGRATIONS = [
  {
    tag: "0000_hard_vin_gonzales",
    hash: "92c8513dfadd7ff5b3a9bdbfc3aad597210bd2d66a95ae7b93b2011ed2d66f67",
    folderMillis: 1773330959791,
    // Tables created by this migration — used to detect if it already ran
    tables: ["users", "accounts", "sessions", "generations", "subscriptions", "verification_tokens"],
  },
  {
    tag: "0001_ambiguous_blazing_skull",
    hash: "efd82c2c89026207cac21a2308bcea9e35811eb2f95e7982dd4a54dc51674147",
    folderMillis: 1774571040107,
    // Tables created by this migration
    tables: ["brands", "social_posts", "brand_social_insights"],
  },
];

try {
  // Ensure the drizzle schema and migrations tracking table exist.
  // This is what Drizzle's migrator creates internally — we mirror it here
  // so we can write bootstrap entries before the migrator runs.
  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

  // For each migration, check if its tables already exist in the database.
  // If they do, the migration has already been applied (possibly via raw SQL
  // before Drizzle tracking was set up). Insert the tracking record so Drizzle
  // won't try to re-run it.
  for (const migration of MIGRATIONS) {
    // Check if already tracked
    const tracked = await sql`
      SELECT id FROM drizzle.__drizzle_migrations
      WHERE hash = ${migration.hash}
    `;

    if (tracked.length > 0) {
      console.log(`Migration ${migration.tag} already tracked — skipping bootstrap.`);
      continue;
    }

    // Check if the tables already exist in the public schema
    const tableList = migration.tables.map((t) => `'${t}'`).join(", ");
    const existing = await sql`
      SELECT COUNT(*) as count FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY(${migration.tables})
    `;

    if (parseInt(existing[0].count) > 0) {
      console.log(`Detected existing schema for ${migration.tag} — marking as already applied...`);
      await sql`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${migration.hash}, ${migration.folderMillis})
      `;
      console.log(`Bootstrap complete for ${migration.tag}.`);
    }
  }

  // Now run Drizzle's migrator. It will check drizzle.__drizzle_migrations and
  // skip any migrations whose folderMillis is already recorded.
  await migrate(db, {
    migrationsFolder: join(__dirname, "../drizzle"),
  });
  console.log("All migrations complete.");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
}

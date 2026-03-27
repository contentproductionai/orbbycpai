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
  await migrate(db, {
    migrationsFolder: join(__dirname, "../drizzle"),
  });
  console.log("All migrations complete.");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
}

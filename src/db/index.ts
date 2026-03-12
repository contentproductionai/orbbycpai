import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Use a placeholder during build time; real URL is injected at runtime by Vercel
const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://placeholder:placeholder@placeholder.neon.tech/placeholder?sslmode=require";

const sql = neon(connectionString);
export const db = drizzle(sql, { schema });
export type DB = typeof db;

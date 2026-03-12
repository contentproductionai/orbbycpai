import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

// Connection pool — reused across requests in serverless edge
const globalForDb = globalThis as unknown as {
  connection: mysql.Pool | undefined;
};

const pool =
  globalForDb.connection ??
  mysql.createPool({
    host: process.env.DB_HOST!,
    port: parseInt(process.env.DB_PORT ?? "3306"),
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.connection = pool;
}

export const db = drizzle(pool, { schema, mode: "default" });
export type DB = typeof db;

import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  int,
  boolean,
  json,
  primaryKey,
  index,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: timestamp("email_verified"),
  image: varchar("image", { length: 255 }),
  passwordHash: varchar("password_hash", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

// ─── NextAuth adapter tables ──────────────────────────────────────────────────

export const accounts = mysqlTable(
  "accounts",
  {
    userId: varchar("user_id", { length: 255 }).notNull(),
    type: varchar("type", { length: 255 }).notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: int("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.provider, table.providerAccountId] }),
    userIdx: index("accounts_user_id_idx").on(table.userId),
  })
);

export const sessions = mysqlTable(
  "sessions",
  {
    sessionToken: varchar("session_token", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    expires: timestamp("expires").notNull(),
  },
  (table) => ({
    userIdx: index("sessions_user_id_idx").on(table.userId),
  })
);

export const verificationTokens = mysqlTable(
  "verification_tokens",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.identifier, table.token] }),
  })
);

// ─── Subscriptions ────────────────────────────────────────────────────────────

export const subscriptions = mysqlTable(
  "subscriptions",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 }).notNull().unique(),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }).unique(),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }).unique(),
    stripePriceId: varchar("stripe_price_id", { length: 255 }),
    // Tier: free | starter | growth | pro
    tier: varchar("tier", { length: 50 }).notNull().default("free"),
    status: varchar("status", { length: 50 }).notNull().default("active"),
    // Limits
    generationsUsed: int("generations_used").notNull().default(0),
    generationsLimit: int("generations_limit").notNull().default(3),
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userIdx: index("subscriptions_user_id_idx").on(table.userId),
  })
);

// ─── Generations ─────────────────────────────────────────────────────────────

export const generations = mysqlTable(
  "generations",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    // Input
    brandUrl: varchar("brand_url", { length: 2048 }).notNull(),
    instagramUrl: varchar("instagram_url", { length: 2048 }),
    // Extracted brand profile (stored as JSON)
    brandProfile: json("brand_profile"),
    // Status: pending | processing | complete | failed
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    errorMessage: text("error_message"),
    // Output: array of image objects { platform, size, url, watermarked }
    images: json("images"),
    // Payment
    paid: boolean("paid").notNull().default(false),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
    downloadUrl: varchar("download_url", { length: 2048 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userIdx: index("generations_user_id_idx").on(table.userId),
    statusIdx: index("generations_status_idx").on(table.status),
    createdIdx: index("generations_created_at_idx").on(table.createdAt),
  })
);

// ─── Relations ───────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ one, many }) => ({
  subscription: one(subscriptions, {
    fields: [users.id],
    references: [subscriptions.userId],
  }),
  generations: many(generations),
  accounts: many(accounts),
  sessions: many(sessions),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export const generationsRelations = relations(generations, ({ one }) => ({
  user: one(users, {
    fields: [generations.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

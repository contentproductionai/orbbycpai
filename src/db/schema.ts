import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  uuid,
  primaryKey,
  index,
  json,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ─── NextAuth adapter tables ──────────────────────────────────────────────────

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.provider, table.providerAccountId] }),
    userIdx: index("accounts_user_id_idx").on(table.userId),
  })
);

export const sessions = pgTable(
  "sessions",
  {
    sessionToken: text("session_token").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => ({
    userIdx: index("sessions_user_id_idx").on(table.userId),
  })
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.identifier, table.token] }),
  })
);

// ─── Subscriptions ────────────────────────────────────────────────────────────

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id").unique(),
    stripeSubscriptionId: text("stripe_subscription_id").unique(),
    stripePriceId: text("stripe_price_id"),
    tier: text("tier").notNull().default("free"),
    status: text("status").notNull().default("active"),
    generationsUsed: integer("generations_used").notNull().default(0),
    generationsLimit: integer("generations_limit").notNull().default(5),
    currentPeriodStart: timestamp("current_period_start", { mode: "date" }),
    currentPeriodEnd: timestamp("current_period_end", { mode: "date" }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("subscriptions_user_id_idx").on(table.userId),
  })
);

/// ─── Brands ─────────────────────────────────────────────────────────────────
// Global brand profile cache — shared across all users, keyed by domain.
// Any profile older than 30 days is treated as stale and re-scraped automatically.
export const brands = pgTable(
  "brands",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    domain: text("domain").notNull().unique(),
    brandUrl: text("brand_url").notNull(),
    brandProfile: jsonb("brand_profile").notNull(),
    scrapedAt: timestamp("scraped_at", { mode: "date" }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    domainIdx: index("brands_domain_idx").on(table.domain),
    scrapedAtIdx: index("brands_scraped_at_idx").on(table.scrapedAt),
  })
);

// ─── Generations ─────────────────────────────────────────────────────────────
export const generations = pgTable(
  "generations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    brandUrl: text("brand_url").notNull(),
    instagramUrl: text("instagram_url"),
    brandId: uuid("brand_id").references(() => brands.id, { onDelete: "set null" }),
    brandProfile: json("brand_profile"),
    status: text("status").notNull().default("pending"),
    errorMessage: text("error_message"),
    images: json("images"),
    paid: boolean("paid").notNull().default(false),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    downloadUrl: text("download_url"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("generations_user_id_idx").on(table.userId),
    statusIdx: index("generations_status_idx").on(table.status),
    createdIdx: index("generations_created_at_idx").on(table.createdAt),
  })
);

// ─── Competitor Comparisons ─────────────────────────────────────────────────
// Stores comparison runs: one primary brand vs up to 3 competitors.
// uspStatements JSONB shape: { [competitorDomain]: "Why primary wins..." }
export const competitorComparisons = pgTable(
  "competitor_comparisons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    primaryBrandDomain: text("primary_brand_domain").notNull(),
    competitorDomains: jsonb("competitor_domains").notNull(), // string[]
    primaryProfile: jsonb("primary_profile").notNull(),
    competitorProfiles: jsonb("competitor_profiles").notNull(), // BrandProfile[]
    uspStatements: jsonb("usp_statements").notNull(), // { [domain]: string }
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("competitor_comparisons_user_id_idx").on(table.userId),
    primaryIdx: index("competitor_comparisons_primary_idx").on(table.primaryBrandDomain),
    createdIdx: index("competitor_comparisons_created_at_idx").on(table.createdAt),
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

export const brandsRelations = relations(brands, ({ many }) => ({
  generations: many(generations),
}));

export const generationsRelations = relations(generations, ({ one }) => ({
  user: one(users, {
    fields: [generations.userId],
    references: [users.id],
  }),
  brand: one(brands, {
    fields: [generations.brandId],
    references: [brands.id],
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

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Generation = typeof generations.$inferSelect;
export type NewGeneration = typeof generations.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;

// ─── social_posts ─────────────────────────────────────────────────────────────
// One row per post per brand. Upsert-safe via unique constraint on
// (brand_id, platform, platform_post_id). data_source distinguishes
// "apify" (pre-auth) from "graph_api" (post-auth).

export const socialPosts = pgTable(
  "social_posts",
  {
    id:             uuid("id").defaultRandom().primaryKey(),
    brandId:        uuid("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
    platform:       text("platform").notNull().default("instagram"),
    platformPostId: text("platform_post_id").notNull(),
    caption:        text("caption"),
    mediaType:      text("media_type"),
    mediaUrl:       text("media_url"),
    permalink:      text("permalink"),
    likesCount:     integer("likes_count"),
    commentsCount:  integer("comments_count"),
    postedAt:       timestamp("posted_at", { mode: "date" }),
    dataSource:     text("data_source").notNull().default("apify"),
    fetchedAt:      timestamp("fetched_at", { mode: "date" }).defaultNow().notNull(),
    createdAt:      timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt:      timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    uniqPost:    unique("social_posts_brand_platform_post_uniq")
                   .on(table.brandId, table.platform, table.platformPostId),
    brandIdx:    index("social_posts_brand_id_idx").on(table.brandId),
    platformIdx: index("social_posts_platform_idx").on(table.platform),
    postedAtIdx: index("social_posts_posted_at_idx").on(table.postedAt),
    sourceIdx:   index("social_posts_data_source_idx").on(table.dataSource),
  })
);

// ─── brand_social_insights ────────────────────────────────────────────────────
// APPEND-ONLY. No updated_at column by design. Each row is one Claude analysis
// run. Rows accumulate — never overwritten or deleted.
//
// insights JSONB v1 shape:
//   copyRegister:       string   — e.g. "punchy and irreverent"
//   activeCampaigns:    string[] — named campaigns detected in captions
//   designMotifs:       string[] — visual patterns EXCLUDING text treatment
//   textTreatments:     string[] — how text is rendered ON the image
//                                  e.g. ["inline highlight bars", "color overlay behind copy",
//                                        "full-bleed type at 80vw", "white text on dark pill"]
//   photoStyle:         string   — compositional description for Nano Banana prompt
//   topPerformingTheme: string | null — null when engagement data unavailable
//   recommendations:    string[] — 3-5 actionable directives for the generation prompt

export const brandSocialInsights = pgTable(
  "brand_social_insights",
  {
    id:            uuid("id").defaultRandom().primaryKey(),
    brandId:       uuid("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
    platform:      text("platform").notNull().default("instagram"),
    postCount:     integer("post_count").notNull(),
    postsFrom:     timestamp("posts_from", { mode: "date" }),
    postsTo:       timestamp("posts_to", { mode: "date" }),
    dataSource:    text("data_source").notNull().default("apify"),
    insights:      jsonb("insights").notNull(),
    promptVersion: text("prompt_version").notNull().default("v1"),
    modelUsed:     text("model_used").notNull(),
    generationId:  uuid("generation_id"),
    analyzedAt:    timestamp("analyzed_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => ({
    brandIdx:                index("brand_social_insights_brand_id_idx").on(table.brandId),
    analyzedAtIdx:           index("brand_social_insights_analyzed_at_idx").on(table.analyzedAt),
    platformIdx:             index("brand_social_insights_platform_idx").on(table.platform),
    promptVersionIdx:        index("brand_social_insights_prompt_version_idx").on(table.promptVersion),
    brandPlatformVersionIdx: index("brand_social_insights_brand_platform_version_idx")
                               .on(table.brandId, table.platform, table.promptVersion),
  })
);

// ─── New relations ────────────────────────────────────────────────────────────

export const socialPostsRelations = relations(socialPosts, ({ one }) => ({
  brand: one(brands, { fields: [socialPosts.brandId], references: [brands.id] }),
}));

export const brandSocialInsightsRelations = relations(brandSocialInsights, ({ one }) => ({
  brand: one(brands, { fields: [brandSocialInsights.brandId], references: [brands.id] }),
}));

// ─── New types ────────────────────────────────────────────────────────────────

export type SocialPost             = typeof socialPosts.$inferSelect;
export type NewSocialPost          = typeof socialPosts.$inferInsert;
export type BrandSocialInsight     = typeof brandSocialInsights.$inferSelect;
export type NewBrandSocialInsight  = typeof brandSocialInsights.$inferInsert;

// ─── NormalizedSocialPost — data-source-agnostic internal interface ───────────
// Both the Apify fetcher and the future Graph API fetcher map to this type.
// The Claude analysis layer only ever receives NormalizedSocialPost[].

export interface NormalizedSocialPost {
  platformPostId: string;
  platform:       "instagram";
  caption:        string | null;
  mediaType:      "IMAGE" | "CAROUSEL_ALBUM" | "VIDEO" | "REEL" | null;
  mediaUrl:       string | null;
  permalink:      string | null;
  likesCount:     number | null;
  commentsCount:  number | null;
  postedAt:       Date | null;
  dataSource:     "apify" | "graph_api";
}

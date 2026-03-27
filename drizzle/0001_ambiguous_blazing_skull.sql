CREATE TABLE "brand_social_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"platform" text DEFAULT 'instagram' NOT NULL,
	"post_count" integer NOT NULL,
	"posts_from" timestamp,
	"posts_to" timestamp,
	"data_source" text DEFAULT 'apify' NOT NULL,
	"insights" jsonb NOT NULL,
	"prompt_version" text DEFAULT 'v1' NOT NULL,
	"model_used" text NOT NULL,
	"generation_id" uuid,
	"analyzed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" text NOT NULL,
	"brand_url" text NOT NULL,
	"brand_profile" jsonb NOT NULL,
	"scraped_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "brands_domain_unique" UNIQUE("domain")
);
--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"platform" text DEFAULT 'instagram' NOT NULL,
	"platform_post_id" text NOT NULL,
	"caption" text,
	"media_type" text,
	"media_url" text,
	"permalink" text,
	"likes_count" integer,
	"comments_count" integer,
	"posted_at" timestamp,
	"data_source" text DEFAULT 'apify' NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "social_posts_brand_platform_post_uniq" UNIQUE("brand_id","platform","platform_post_id")
);
--> statement-breakpoint
ALTER TABLE "generations" ADD COLUMN "brand_id" uuid;--> statement-breakpoint
ALTER TABLE "brand_social_insights" ADD CONSTRAINT "brand_social_insights_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brand_social_insights_brand_id_idx" ON "brand_social_insights" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "brand_social_insights_analyzed_at_idx" ON "brand_social_insights" USING btree ("analyzed_at");--> statement-breakpoint
CREATE INDEX "brand_social_insights_platform_idx" ON "brand_social_insights" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "brand_social_insights_prompt_version_idx" ON "brand_social_insights" USING btree ("prompt_version");--> statement-breakpoint
CREATE INDEX "brand_social_insights_brand_platform_version_idx" ON "brand_social_insights" USING btree ("brand_id","platform","prompt_version");--> statement-breakpoint
CREATE INDEX "brands_domain_idx" ON "brands" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "brands_scraped_at_idx" ON "brands" USING btree ("scraped_at");--> statement-breakpoint
CREATE INDEX "social_posts_brand_id_idx" ON "social_posts" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "social_posts_platform_idx" ON "social_posts" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "social_posts_posted_at_idx" ON "social_posts" USING btree ("posted_at");--> statement-breakpoint
CREATE INDEX "social_posts_data_source_idx" ON "social_posts" USING btree ("data_source");--> statement-breakpoint
ALTER TABLE "generations" ADD CONSTRAINT "generations_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;
-- SDD-015 / ADR-038..040. Additive and forward-only; emergency rollback uses feature flags.
ALTER TABLE "profile" ADD COLUMN "presentation" text;
ALTER TABLE "profile" ADD COLUMN "photo_visibility" text DEFAULT 'private' NOT NULL;
ALTER TABLE "profile" ADD COLUMN "presentation_visibility" text DEFAULT 'private' NOT NULL;
ALTER TABLE "profile" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;
ALTER TABLE "profile" ADD CONSTRAINT "profile_presentation_length_check" CHECK ("presentation" is null or char_length("presentation") between 1 and 500);
ALTER TABLE "profile" ADD CONSTRAINT "profile_photo_visibility_check" CHECK ("photo_visibility" in ('private', 'authenticated', 'public'));
ALTER TABLE "profile" ADD CONSTRAINT "profile_presentation_visibility_check" CHECK ("presentation_visibility" in ('private', 'authenticated', 'public'));
ALTER TABLE "profile" ADD CONSTRAINT "profile_revision_check" CHECK ("revision" > 0);
--> statement-breakpoint
CREATE TABLE "profile_photo_asset" (
  "id" uuid PRIMARY KEY NOT NULL, "account_id" uuid NOT NULL, "provider" text NOT NULL,
  "public_id" text NOT NULL, "provider_asset_id" text, "version" integer, "format" text,
  "bytes" integer, "width" integer, "height" integer, "state" text NOT NULL,
  "upload_expires_at" timestamp with time zone NOT NULL, "activated_at" timestamp with time zone,
  "delete_after" timestamp with time zone, "delete_attempts" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "profile_photo_asset_provider_check" CHECK ("provider" = 'cloudinary'),
  CONSTRAINT "profile_photo_asset_state_check" CHECK ("state" in ('pending', 'active', 'delete_pending'))
);
ALTER TABLE "profile_photo_asset" ADD CONSTRAINT "profile_photo_asset_account_fk" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE cascade;
CREATE UNIQUE INDEX "profile_photo_asset_public_id_unique" ON "profile_photo_asset" ("public_id");
CREATE UNIQUE INDEX "profile_photo_asset_provider_asset_id_unique" ON "profile_photo_asset" ("provider_asset_id");
CREATE UNIQUE INDEX "profile_photo_asset_one_pending_per_account" ON "profile_photo_asset" ("account_id") WHERE "state" = 'pending';
CREATE UNIQUE INDEX "profile_photo_asset_one_active_per_account" ON "profile_photo_asset" ("account_id") WHERE "state" = 'active';
CREATE INDEX "profile_photo_asset_cleanup_index" ON "profile_photo_asset" ("state", "delete_after", "upload_expires_at");
--> statement-breakpoint
CREATE TABLE "profile_media_attempt" (
  "id" uuid PRIMARY KEY NOT NULL, "scope" text NOT NULL, "subject_hash" "bytea" NOT NULL,
  "attempted_at" timestamp with time zone NOT NULL,
  CONSTRAINT "profile_media_attempt_scope_check" CHECK ("scope" in ('account', 'origin'))
);
CREATE INDEX "profile_media_attempt_subject_index" ON "profile_media_attempt" ("scope", "subject_hash", "attempted_at");
CREATE INDEX "profile_media_attempt_retention_index" ON "profile_media_attempt" ("attempted_at");

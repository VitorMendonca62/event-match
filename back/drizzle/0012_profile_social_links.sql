-- SDD-020 / ADR-049. Additive and forward-only; rollback preserves private links.
CREATE TABLE "profile_social_link" (
  "id" uuid PRIMARY KEY NOT NULL,
  "account_id" uuid NOT NULL,
  "provider" text NOT NULL,
  "canonical_identifier" text NOT NULL,
  "position" smallint NOT NULL,
  "visibility" text DEFAULT 'private' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "profile_social_link_provider_check" CHECK ("provider" in ('instagram', 'linkedin', 'x')),
  CONSTRAINT "profile_social_link_identifier_check" CHECK (
    char_length("canonical_identifier") between 1 and 100
    AND "canonical_identifier" !~ '\s'
    AND (
      ("provider" = 'instagram' AND "canonical_identifier" ~ '^[a-z0-9._]{1,30}$')
      OR ("provider" = 'linkedin' AND "canonical_identifier" ~ '^[a-z0-9-]{3,100}$')
      OR ("provider" = 'x' AND "canonical_identifier" ~ '^[a-z0-9_]{1,15}$')
    )
  ),
  CONSTRAINT "profile_social_link_position_check" CHECK ("position" between 1 and 3),
  CONSTRAINT "profile_social_link_visibility_check" CHECK ("visibility" in ('private', 'authenticated', 'public')),
  CONSTRAINT "profile_social_link_account_fk" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX "profile_social_link_account_provider_unique" ON "profile_social_link" USING btree ("account_id", "provider");
--> statement-breakpoint
CREATE UNIQUE INDEX "profile_social_link_account_position_unique" ON "profile_social_link" USING btree ("account_id", "position");

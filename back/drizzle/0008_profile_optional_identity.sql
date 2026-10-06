-- SDD-016 / ADR-043. Additive and forward-only; operational rollback preserves data.
ALTER TABLE "profile" ADD COLUMN "pronoun_selection" text;
ALTER TABLE "profile" ADD COLUMN "custom_pronouns" text;
ALTER TABLE "profile" ADD COLUMN "pronouns_visibility" text DEFAULT 'private' NOT NULL;
ALTER TABLE "profile" ADD COLUMN "profession" text;
ALTER TABLE "profile" ADD COLUMN "profession_visibility" text DEFAULT 'private' NOT NULL;
ALTER TABLE "profile" ADD COLUMN "languages_visibility" text DEFAULT 'private' NOT NULL;
ALTER TABLE "profile" ADD CONSTRAINT "profile_pronoun_selection_check" CHECK ("pronoun_selection" is null or "pronoun_selection" in ('ela_dela', 'ele_dele', 'elu_delu', 'other', 'prefer_not_to_say'));
ALTER TABLE "profile" ADD CONSTRAINT "profile_custom_pronouns_check" CHECK (("pronoun_selection" = 'other' and "custom_pronouns" is not null and char_length("custom_pronouns") between 1 and 40) or ("pronoun_selection" is distinct from 'other' and "custom_pronouns" is null));
ALTER TABLE "profile" ADD CONSTRAINT "profile_pronouns_visibility_check" CHECK ("pronouns_visibility" in ('private', 'authenticated', 'public'));
ALTER TABLE "profile" ADD CONSTRAINT "profile_profession_length_check" CHECK ("profession" is null or char_length("profession") between 1 and 80);
ALTER TABLE "profile" ADD CONSTRAINT "profile_profession_visibility_check" CHECK ("profession_visibility" in ('private', 'authenticated', 'public'));
ALTER TABLE "profile" ADD CONSTRAINT "profile_languages_visibility_check" CHECK ("languages_visibility" in ('private', 'authenticated', 'public'));
ALTER TABLE "profile" ADD CONSTRAINT "profile_pronouns_prefer_private_check" CHECK ("pronoun_selection" is distinct from 'prefer_not_to_say' or "pronouns_visibility" = 'private');
--> statement-breakpoint
CREATE TABLE "language" (
  "code" text PRIMARY KEY NOT NULL,
  "label_pt_br" text NOT NULL,
  "sort_order" integer NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "language_code_check" CHECK ("code" ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$'),
  CONSTRAINT "language_label_pt_br_check" CHECK (char_length(trim("label_pt_br")) > 0)
);
CREATE UNIQUE INDEX "language_sort_order_unique" ON "language" ("sort_order");
CREATE INDEX "language_active_order_index" ON "language" ("active", "sort_order");
INSERT INTO "language" ("code", "label_pt_br", "sort_order") VALUES
  ('pt', 'Português', 10), ('en', 'Inglês', 20), ('es', 'Espanhol', 30), ('bzs', 'Libras', 40),
  ('fr', 'Francês', 50), ('it', 'Italiano', 60), ('de', 'Alemão', 70), ('cmn', 'Mandarim', 80),
  ('ja', 'Japonês', 90), ('ko', 'Coreano', 100), ('ar', 'Árabe', 110), ('ru', 'Russo', 120), ('hi', 'Hindi', 130)
ON CONFLICT ("code") DO UPDATE SET "label_pt_br" = excluded."label_pt_br", "sort_order" = excluded."sort_order", "updated_at" = now();
--> statement-breakpoint
CREATE TABLE "profile_language" (
  "account_id" uuid NOT NULL,
  "language_code" text NOT NULL,
  "selected_at" timestamp with time zone NOT NULL,
  CONSTRAINT "profile_language_pk" PRIMARY KEY ("account_id", "language_code")
);
ALTER TABLE "profile_language" ADD CONSTRAINT "profile_language_account_fk" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE cascade;
ALTER TABLE "profile_language" ADD CONSTRAINT "profile_language_language_fk" FOREIGN KEY ("language_code") REFERENCES "language"("code");
CREATE INDEX "profile_language_language_index" ON "profile_language" ("language_code");

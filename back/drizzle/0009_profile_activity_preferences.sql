-- SDD-017 / ADR-044. Additive and forward-only; operational rollback preserves data.
ALTER TABLE "profile" ADD COLUMN "activity_preferences_visibility" text DEFAULT 'private' NOT NULL;
ALTER TABLE "profile" ADD CONSTRAINT "profile_activity_preferences_visibility_check" CHECK ("activity_preferences_visibility" in ('private', 'authenticated', 'public'));
--> statement-breakpoint
CREATE TABLE "activity_preference" (
  "code" text PRIMARY KEY NOT NULL,
  "label_pt_br" text NOT NULL,
  "sort_order" integer NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "activity_preference_code_check" CHECK ("code" ~ '^[a-z][a-z0-9_]{1,39}$'),
  CONSTRAINT "activity_preference_label_pt_br_check" CHECK (char_length(trim("label_pt_br")) > 0)
);
CREATE UNIQUE INDEX "activity_preference_sort_order_unique" ON "activity_preference" ("sort_order");
CREATE INDEX "activity_preference_active_order_index" ON "activity_preference" ("active", "sort_order");
INSERT INTO "activity_preference" ("code", "label_pt_br", "sort_order") VALUES
  ('outdoor', 'Ao ar livre', 10), ('indoor', 'Ambiente interno', 20),
  ('quiet_setting', 'Ambiente tranquilo', 30), ('lively_setting', 'Ambiente movimentado', 40),
  ('small_group', 'Grupo pequeno', 50), ('medium_group', 'Grupo médio', 60),
  ('light_physical_activity', 'Atividade física leve', 70), ('moderate_physical_activity', 'Atividade física moderada', 80),
  ('cultural_experience', 'Experiência cultural', 90), ('conversation_and_socializing', 'Conversa e socialização', 100),
  ('structured_activity', 'Atividade estruturada', 110), ('spontaneous_activity', 'Atividade espontânea', 120)
ON CONFLICT ("code") DO UPDATE SET "label_pt_br" = excluded."label_pt_br", "sort_order" = excluded."sort_order", "updated_at" = now();
--> statement-breakpoint
CREATE TABLE "profile_activity_preference" (
  "account_id" uuid NOT NULL,
  "preference_code" text NOT NULL,
  "selected_at" timestamp with time zone NOT NULL,
  CONSTRAINT "profile_activity_preference_pk" PRIMARY KEY ("account_id", "preference_code")
);
ALTER TABLE "profile_activity_preference" ADD CONSTRAINT "profile_activity_preference_account_fk" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE cascade;
ALTER TABLE "profile_activity_preference" ADD CONSTRAINT "profile_activity_preference_preference_fk" FOREIGN KEY ("preference_code") REFERENCES "activity_preference"("code");
CREATE INDEX "profile_activity_preference_preference_index" ON "profile_activity_preference" ("preference_code");

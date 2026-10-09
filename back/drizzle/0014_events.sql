-- SDD-025 / ADR-054..061. Forward-only event foundation.
-- Exact coordinates are encrypted by the application adapter; no plaintext location is stored.
ALTER TABLE "municipality" ADD COLUMN "time_zone" text NOT NULL DEFAULT 'America/Sao_Paulo';
--> statement-breakpoint
UPDATE "municipality" SET "time_zone" = CASE
  -- Amazonas and Pará contain municipalities in more than one IANA zone.
  WHEN "code" IN ('1300201', '1300607', '1300706', '1301407', '1301506', '1301654', '1301803', '1301951', '1302306', '1302405', '1303502', '1303908', '1304062') THEN 'America/Eirunepe'
  WHEN "code" IN ('1500404', '1500503', '1500602', '1501006', '1501451', '1501725', '1502855', '1503002', '1503606', '1503754', '1503903', '1504455', '1504802', '1505031', '1505106', '1505304', '1505650', '1505908', '1506005', '1506195', '1506807', '1507979', '1508050', '1508159') THEN 'America/Santarem'
  WHEN "uf_code" = 'AC' THEN 'America/Rio_Branco'
  WHEN "uf_code" = 'AM' THEN 'America/Manaus'
  WHEN "uf_code" = 'AP' THEN 'America/Belem'
  WHEN "uf_code" = 'PA' THEN 'America/Belem'
  WHEN "uf_code" = 'RO' THEN 'America/Porto_Velho'
  WHEN "uf_code" = 'RR' THEN 'America/Boa_Vista'
  WHEN "uf_code" = 'MT' THEN 'America/Cuiaba'
  WHEN "uf_code" = 'MS' THEN 'America/Campo_Grande'
  WHEN "uf_code" = 'TO' THEN 'America/Araguaina'
  WHEN "uf_code" IN ('MA', 'PI', 'CE', 'RN', 'PB') THEN 'America/Fortaleza'
  WHEN "uf_code" IN ('AL', 'SE') THEN 'America/Maceio'
  WHEN "uf_code" = 'BA' THEN 'America/Bahia'
  WHEN "uf_code" = 'PE' THEN 'America/Recife'
  ELSE 'America/Sao_Paulo'
END;
--> statement-breakpoint
CREATE TABLE "event_activity_type" (
  "code" text PRIMARY KEY NOT NULL,
  "label_pt_br" text NOT NULL,
  "sort_order" integer NOT NULL,
  "catalog_version" text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "event_activity_type_code_check" CHECK ("code" ~ '^[a-z][a-z0-9_]{1,59}$'),
  CONSTRAINT "event_activity_type_label_check" CHECK (char_length(trim("label_pt_br")) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "event_activity_type_sort_order_unique" ON "event_activity_type" ("sort_order");
--> statement-breakpoint
CREATE INDEX "event_activity_type_active_order_index" ON "event_activity_type" ("active", "sort_order");
--> statement-breakpoint
INSERT INTO "event_activity_type" ("code", "label_pt_br", "sort_order", "catalog_version") VALUES
  ('cafe_ou_conversa', 'Café ou conversa', 1, 'mvp-1'),
  ('refeicao', 'Refeição', 2, 'mvp-1'),
  ('caminhada', 'Caminhada', 3, 'mvp-1'),
  ('corrida', 'Corrida', 4, 'mvp-1'),
  ('pedalada', 'Pedalada', 5, 'mvp-1'),
  ('pratica_esportiva', 'Prática esportiva', 6, 'mvp-1'),
  ('jogos_de_tabuleiro', 'Jogos de tabuleiro', 7, 'mvp-1'),
  ('sessao_de_videogame', 'Sessão de videogame', 8, 'mvp-1'),
  ('show_musical', 'Show ou apresentação musical', 9, 'mvp-1'),
  ('cinema', 'Cinema', 10, 'mvp-1'),
  ('teatro', 'Teatro', 11, 'mvp-1'),
  ('museu_ou_exposicao', 'Museu ou exposição', 12, 'mvp-1'),
  ('clube_de_leitura', 'Clube de leitura', 13, 'mvp-1'),
  ('pratica_de_idiomas', 'Prática de idiomas', 14, 'mvp-1'),
  ('passeio_cultural', 'Passeio cultural', 15, 'mvp-1'),
  ('atividade_na_natureza', 'Atividade na natureza', 16, 'mvp-1'),
  ('voluntariado', 'Voluntariado', 17, 'mvp-1'),
  ('oficina_criativa', 'Oficina ou atividade criativa', 18, 'mvp-1'),
  ('outro_encontro_informal', 'Outro encontro informal', 19, 'mvp-1')
ON CONFLICT ("code") DO UPDATE SET "label_pt_br" = excluded."label_pt_br", "sort_order" = excluded."sort_order", "catalog_version" = excluded."catalog_version", "active" = excluded."active", "updated_at" = now();
--> statement-breakpoint
CREATE TABLE "event" (
  "id" uuid PRIMARY KEY NOT NULL,
  "host_account_id" uuid NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "activity_type_code" text,
  "title" text,
  "description" text,
  "starts_at_local" timestamp,
  "ends_at_local" timestamp,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "uf_code" char(2),
  "municipality_code" char(7),
  "municipality_name" text,
  "time_zone" text,
  "venue_type" text,
  "non_residential_host_declaration" boolean,
  "capacity" integer,
  "admission_mode" text DEFAULT 'manual_approval' NOT NULL,
  "approximate_latitude" double precision,
  "approximate_longitude" double precision,
  "approximate_radius_meters" integer,
  "official" boolean DEFAULT false NOT NULL,
  "revision" integer DEFAULT 1 NOT NULL,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "event_status_check" CHECK ("status" in ('draft', 'published_open', 'full', 'cancelled', 'completed', 'not_held')),
  CONSTRAINT "event_location_pair_check" CHECK (("uf_code" is null and "municipality_code" is null and "municipality_name" is null and "time_zone" is null) or ("uf_code" is not null and "municipality_code" is not null and "municipality_name" is not null and "time_zone" is not null)),
  CONSTRAINT "event_venue_type_check" CHECK ("venue_type" is null or "venue_type" in ('public_place', 'identifiable_establishment')),
  CONSTRAINT "event_non_residential_declaration_check" CHECK ("non_residential_host_declaration" is null or "non_residential_host_declaration" = true),
  CONSTRAINT "event_capacity_check" CHECK ("capacity" is null or "capacity" between 1 and 12),
  CONSTRAINT "event_admission_mode_check" CHECK ("admission_mode" in ('manual_approval', 'automatic_entry')),
  CONSTRAINT "event_title_length_check" CHECK ("title" is null or char_length(trim("title")) between 1 and 120),
  CONSTRAINT "event_description_length_check" CHECK ("description" is null or char_length(trim("description")) between 1 and 2000),
  CONSTRAINT "event_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "event_approximate_area_check" CHECK (("approximate_latitude" is null and "approximate_longitude" is null and "approximate_radius_meters" is null) or ("approximate_latitude" between -90 and 90 and "approximate_longitude" between -180 and 180 and "approximate_radius_meters" between 200 and 5000)),
  CONSTRAINT "event_published_at_check" CHECK ("status" = 'draft' or ("published_at" is not null and "approximate_latitude" is not null and "approximate_longitude" is not null and "approximate_radius_meters" is not null)),
  CONSTRAINT "event_official_check" CHECK ("official" = false),
  CONSTRAINT "event_activity_type_fk" FOREIGN KEY ("activity_type_code") REFERENCES "event_activity_type"("code"),
  CONSTRAINT "event_municipality_fk" FOREIGN KEY ("uf_code", "municipality_code") REFERENCES "municipality"("uf_code", "code"),
  CONSTRAINT "event_host_account_fk" FOREIGN KEY ("host_account_id") REFERENCES "account"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX "event_host_status_starts_at_index" ON "event" ("host_account_id", "status", "starts_at");
--> statement-breakpoint
CREATE INDEX "event_municipality_status_index" ON "event" ("uf_code", "municipality_code", "status");
--> statement-breakpoint
CREATE INDEX "event_host_published_at_index" ON "event" ("host_account_id", "published_at");
--> statement-breakpoint
CREATE TABLE "event_exact_location" (
  "event_id" uuid PRIMARY KEY NOT NULL,
  "ciphertext" bytea NOT NULL,
  "iv" bytea NOT NULL,
  "auth_tag" bytea NOT NULL,
  "key_version" smallint DEFAULT 1 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "event_exact_location_iv_check" CHECK (octet_length("iv") = 12),
  CONSTRAINT "event_exact_location_auth_tag_check" CHECK (octet_length("auth_tag") = 16),
  CONSTRAINT "event_exact_location_key_version_check" CHECK ("key_version" > 0),
  CONSTRAINT "event_exact_location_event_fk" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "event_audit" (
  "id" uuid PRIMARY KEY NOT NULL,
  "event_id" uuid NOT NULL,
  "actor_account_id" uuid NOT NULL,
  "action" text NOT NULL,
  "changed_fields" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "correlation_id" uuid NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "event_audit_action_check" CHECK ("action" in ('draft_created', 'draft_updated', 'published')),
  CONSTRAINT "event_audit_changed_fields_check" CHECK ("changed_fields" <@ ARRAY['activityTypeCode', 'title', 'description', 'startsAtLocal', 'endsAtLocal', 'ufCode', 'municipalityCode', 'venueType', 'nonResidentialHostDeclaration', 'exactLocation', 'capacity', 'admissionMode', 'status', 'publishedAt', 'approximateArea']::text[]),
  CONSTRAINT "event_audit_actor_account_fk" FOREIGN KEY ("actor_account_id") REFERENCES "account"("id"),
  CONSTRAINT "event_audit_event_fk" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX "event_audit_event_occurred_at_index" ON "event_audit" ("event_id", "occurred_at");

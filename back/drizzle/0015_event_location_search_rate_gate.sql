-- SDD-029 / ADR-064. One operational row gates public Nominatim traffic across backend replicas.
-- It stores no account, event, query, result, or coordinate data.
CREATE TABLE "event_location_search_rate_gate" (
  "key" text PRIMARY KEY NOT NULL,
  "next_allowed_at" timestamp with time zone NOT NULL,
  CONSTRAINT "event_location_search_rate_gate_key_check" CHECK ("key" = 'nominatim')
);
--> statement-breakpoint
INSERT INTO "event_location_search_rate_gate" ("key", "next_allowed_at") VALUES ('nominatim', clock_timestamp());

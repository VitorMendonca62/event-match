-- SDD-018 / ADR-045. Additive and forward-only; operational rollback preserves data.
ALTER TABLE "profile" ADD COLUMN "preferred_distance" text;
ALTER TABLE "profile" ADD CONSTRAINT "profile_preferred_distance_check" CHECK ("preferred_distance" is null or "preferred_distance" in ('up_to_2km', 'up_to_5km', 'up_to_10km', 'up_to_25km', 'same_city'));
--> statement-breakpoint
CREATE TABLE "profile_availability_slot" (
  "account_id" uuid NOT NULL,
  "weekday" text NOT NULL,
  "period" text NOT NULL,
  "selected_at" timestamp with time zone NOT NULL,
  CONSTRAINT "profile_availability_slot_pk" PRIMARY KEY ("account_id", "weekday", "period"),
  CONSTRAINT "profile_availability_slot_weekday_check" CHECK ("weekday" in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')),
  CONSTRAINT "profile_availability_slot_period_check" CHECK ("period" in ('early_hours', 'morning', 'afternoon', 'evening'))
);
ALTER TABLE "profile_availability_slot" ADD CONSTRAINT "profile_availability_slot_account_fk" FOREIGN KEY ("account_id") REFERENCES "account"("id") ON DELETE cascade;
CREATE INDEX "profile_availability_slot_weekday_period_index" ON "profile_availability_slot" ("weekday", "period");

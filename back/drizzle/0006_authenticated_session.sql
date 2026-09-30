-- SDD-013 (ADR-033, ADR-035, ADR-036): additive only. Sessions and login attempts store HMAC digests,
-- never tokens, passwords, contacts, IPs or user-agents; account_status_check is only widened.
-- Fix forward; never narrow the constraint or drop these tables in a destructive down.
CREATE TABLE "authenticated_session" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"token_digest" "bytea" NOT NULL,
	"previous_token_digest" "bytea",
	"previous_valid_until" timestamp with time zone,
	"remembered" boolean NOT NULL,
	"idle_timeout_seconds" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"rotated_at" timestamp with time zone NOT NULL,
	"absolute_expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "authenticated_session_idle_timeout_check" CHECK ("authenticated_session"."idle_timeout_seconds" > 0),
	CONSTRAINT "authenticated_session_deadline_check" CHECK ("authenticated_session"."absolute_expires_at" > "authenticated_session"."created_at"),
	CONSTRAINT "authenticated_session_previous_token_check" CHECK (("authenticated_session"."previous_token_digest" is null) = ("authenticated_session"."previous_valid_until" is null)),
	CONSTRAINT "authenticated_session_digest_length_check" CHECK (octet_length("authenticated_session"."token_digest") = 32)
);
--> statement-breakpoint
CREATE TABLE "authentication_attempt" (
	"id" uuid PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"subject_hash" "bytea" NOT NULL,
	"attempted_at" timestamp with time zone NOT NULL,
	CONSTRAINT "authentication_attempt_scope_check" CHECK ("authentication_attempt"."scope" in ('contact', 'origin'))
);
--> statement-breakpoint
ALTER TABLE "account" DROP CONSTRAINT "account_status_check";--> statement-breakpoint
ALTER TABLE "authenticated_session" ADD CONSTRAINT "authenticated_session_account_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "authenticated_session_token_digest_unique" ON "authenticated_session" USING btree ("token_digest");--> statement-breakpoint
CREATE UNIQUE INDEX "authenticated_session_previous_token_digest_unique" ON "authenticated_session" USING btree ("previous_token_digest") WHERE "authenticated_session"."previous_token_digest" is not null;--> statement-breakpoint
CREATE INDEX "authenticated_session_account_last_seen_index" ON "authenticated_session" USING btree ("account_id","last_seen_at");--> statement-breakpoint
CREATE INDEX "authenticated_session_absolute_expires_at_index" ON "authenticated_session" USING btree ("absolute_expires_at");--> statement-breakpoint
CREATE INDEX "authentication_attempt_subject_index" ON "authentication_attempt" USING btree ("scope","subject_hash","attempted_at");--> statement-breakpoint
CREATE INDEX "authentication_attempt_attempted_at_index" ON "authentication_attempt" USING btree ("attempted_at");--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_status_check" CHECK ("account"."status" in ('account_incomplete', 'active', 'expired', 'age_verification', 'recovery_restricted', 'deactivation_pending', 'deactivated', 'deletion_pending', 'deleted', 'suspended'));
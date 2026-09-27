-- SDD-009 (ADR-021, ADR-024): additive only. Continuation sessions and idempotency store digests,
-- never tokens, birth dates, contacts or secrets. Fix forward; never run a destructive down.
CREATE TABLE "registration_flow_session" (
	"id" uuid PRIMARY KEY NOT NULL,
	"token_digest" "bytea",
	"previous_token_digest" "bytea",
	"previous_valid_until" timestamp with time zone,
	"stage" text NOT NULL,
	"verification_id" uuid,
	"registration_id" uuid,
	"account_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "registration_flow_session_token_digest_unique" UNIQUE("token_digest"),
	CONSTRAINT "registration_flow_session_stage_check" CHECK ("registration_flow_session"."stage" in ('age_eligible', 'verification_pending', 'contact_verified', 'registration_in_progress', 'account_incomplete', 'completed')),
	CONSTRAINT "registration_flow_session_binding_check" CHECK (("registration_flow_session"."stage" = 'age_eligible' and "registration_flow_session"."verification_id" is null and "registration_flow_session"."registration_id" is null and "registration_flow_session"."account_id" is null) or ("registration_flow_session"."stage" = 'verification_pending' and "registration_flow_session"."registration_id" is null and "registration_flow_session"."account_id" is null) or ("registration_flow_session"."stage" = 'contact_verified' and "registration_flow_session"."verification_id" is not null and "registration_flow_session"."registration_id" is null and "registration_flow_session"."account_id" is null) or ("registration_flow_session"."stage" = 'registration_in_progress' and "registration_flow_session"."verification_id" is not null and "registration_flow_session"."registration_id" is not null and "registration_flow_session"."account_id" is null) or ("registration_flow_session"."stage" in ('account_incomplete', 'completed') and "registration_flow_session"."verification_id" is not null and "registration_flow_session"."registration_id" is not null and "registration_flow_session"."account_id" is not null)),
	CONSTRAINT "registration_flow_session_previous_token_check" CHECK (("registration_flow_session"."previous_token_digest" is null) = ("registration_flow_session"."previous_valid_until" is null)),
	CONSTRAINT "registration_flow_session_completed_check" CHECK ("registration_flow_session"."stage" <> 'completed' or ("registration_flow_session"."token_digest" is null and "registration_flow_session"."previous_token_digest" is null and "registration_flow_session"."revoked_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "registration_idempotency" (
	"id" uuid PRIMARY KEY NOT NULL,
	"flow_session_id" uuid NOT NULL,
	"operation" text NOT NULL,
	"key_hash" "bytea" NOT NULL,
	"request_hash" "bytea" NOT NULL,
	"response_body" jsonb,
	"rotates" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registration_idempotency_key_unique" UNIQUE("flow_session_id","operation","key_hash"),
	CONSTRAINT "registration_idempotency_operation_check" CHECK ("registration_idempotency"."operation" in ('contact_request', 'contact_resend', 'contact_confirm', 'password', 'required_data', 'complete')),
	CONSTRAINT "registration_idempotency_outcome_check" CHECK (("registration_idempotency"."completed_at" is null) = ("registration_idempotency"."response_body" is null))
);
--> statement-breakpoint
ALTER TABLE "registration_flow_session" ADD CONSTRAINT "registration_flow_session_registration_id_registration_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registration"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_flow_session" ADD CONSTRAINT "registration_flow_session_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_flow_session" ADD CONSTRAINT "registration_flow_session_verification_fk" FOREIGN KEY ("verification_id") REFERENCES "public"."contact_verification"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_idempotency" ADD CONSTRAINT "registration_idempotency_flow_session_fk" FOREIGN KEY ("flow_session_id") REFERENCES "public"."registration_flow_session"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "registration_flow_session_previous_token_digest_index" ON "registration_flow_session" USING btree ("previous_token_digest");--> statement-breakpoint
CREATE INDEX "registration_flow_session_verification_id_index" ON "registration_flow_session" USING btree ("verification_id");--> statement-breakpoint
CREATE INDEX "registration_flow_session_stage_expires_at_index" ON "registration_flow_session" USING btree ("stage","expires_at");--> statement-breakpoint
CREATE INDEX "registration_idempotency_expires_at_index" ON "registration_idempotency" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_verification_link_token_digest_unique" ON "contact_verification" USING btree ("link_token_digest") WHERE "contact_verification"."link_token_digest" is not null;
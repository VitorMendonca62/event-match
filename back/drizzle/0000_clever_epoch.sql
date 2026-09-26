CREATE TABLE "interest" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"position" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deactivated_at" timestamp with time zone,
	CONSTRAINT "interest_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "account_interest" (
	"account_id" uuid NOT NULL,
	"interest_id" uuid NOT NULL,
	"selected_at" timestamp with time zone NOT NULL,
	CONSTRAINT "account_interest_account_id_interest_id_pk" PRIMARY KEY("account_id","interest_id")
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"region" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_display_name_length_check" CHECK (char_length("profile"."display_name") between 1 and 60),
	CONSTRAINT "profile_region_length_check" CHECK (char_length("profile"."region") between 2 and 80)
);
--> statement-breakpoint
CREATE TABLE "profile_usage_intent" (
	"account_id" uuid NOT NULL,
	"usage_intent" text NOT NULL,
	"selected_at" timestamp with time zone NOT NULL,
	CONSTRAINT "profile_usage_intent_account_id_usage_intent_pk" PRIMARY KEY("account_id","usage_intent"),
	CONSTRAINT "profile_usage_intent_value_check" CHECK ("profile_usage_intent"."usage_intent" in ('friendship', 'activity_company', 'explore_city', 'networking'))
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" uuid PRIMARY KEY NOT NULL,
	"registration_id" uuid NOT NULL,
	"status" text DEFAULT 'account_incomplete' NOT NULL,
	"birth_date" date,
	"last_updated_at" timestamp with time zone NOT NULL,
	"activated_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	CONSTRAINT "account_registration_id_unique" UNIQUE("registration_id"),
	CONSTRAINT "account_status_check" CHECK ("account"."status" in ('account_incomplete', 'active', 'expired')),
	CONSTRAINT "account_active_data_check" CHECK ("account"."status" <> 'active' or ("account"."birth_date" is not null and "account"."activated_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "account_contact" (
	"account_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"contact_hash" "bytea",
	"contact_ciphertext" "bytea",
	"key_version" smallint DEFAULT 1 NOT NULL,
	"confirmed_at" timestamp with time zone NOT NULL,
	"holds_contact" boolean DEFAULT true NOT NULL,
	CONSTRAINT "account_contact_account_id_channel_pk" PRIMARY KEY("account_id","channel"),
	CONSTRAINT "account_contact_channel_check" CHECK ("account_contact"."channel" in ('email', 'whatsapp'))
);
--> statement-breakpoint
CREATE TABLE "account_credential" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"password_hash" text NOT NULL,
	"algorithm" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_verification" (
	"id" uuid PRIMARY KEY NOT NULL,
	"purpose" text NOT NULL,
	"channel" text NOT NULL,
	"contact_hash" "bytea" NOT NULL,
	"contact_ciphertext" "bytea" NOT NULL,
	"key_version" smallint DEFAULT 1 NOT NULL,
	"otp_digest" "bytea" NOT NULL,
	"link_token_digest" "bytea",
	"expires_at" timestamp with time zone NOT NULL,
	"failed_attempts" smallint DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"resend_count" smallint DEFAULT 0 NOT NULL,
	"last_sent_at" timestamp with time zone NOT NULL,
	"delivery_idempotency_key" uuid NOT NULL,
	"whatsapp_consent_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_verification_delivery_key_unique" UNIQUE("delivery_idempotency_key"),
	CONSTRAINT "contact_verification_purpose_check" CHECK ("contact_verification"."purpose" = 'registration'),
	CONSTRAINT "contact_verification_channel_check" CHECK ("contact_verification"."channel" in ('email', 'whatsapp')),
	CONSTRAINT "contact_verification_status_check" CHECK ("contact_verification"."status" in ('open', 'verified', 'consumed', 'expired')),
	CONSTRAINT "contact_verification_failed_attempts_check" CHECK ("contact_verification"."failed_attempts" between 0 and 5),
	CONSTRAINT "contact_verification_resend_count_check" CHECK ("contact_verification"."resend_count" between 0 and 3),
	CONSTRAINT "contact_verification_whatsapp_consent_check" CHECK ("contact_verification"."channel" <> 'whatsapp' or "contact_verification"."whatsapp_consent_at" is not null)
);
--> statement-breakpoint
CREATE TABLE "registration" (
	"id" uuid PRIMARY KEY NOT NULL,
	"verification_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"contact_hash" "bytea",
	"contact_ciphertext" "bytea",
	"password_hash" text,
	"status" text DEFAULT 'registration_in_progress' NOT NULL,
	"last_updated_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"expired_at" timestamp with time zone,
	CONSTRAINT "registration_verification_unique" UNIQUE("verification_id"),
	CONSTRAINT "registration_channel_check" CHECK ("registration"."channel" in ('email', 'whatsapp')),
	CONSTRAINT "registration_status_check" CHECK ("registration"."status" in ('registration_in_progress', 'expired')),
	CONSTRAINT "registration_expired_contact_check" CHECK ("registration"."status" <> 'expired' or "registration"."contact_hash" is null)
);
--> statement-breakpoint
CREATE TABLE "terms_acceptance" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	"context" jsonb NOT NULL,
	CONSTRAINT "terms_acceptance_account_document_unique" UNIQUE("account_id","document_id")
);
--> statement-breakpoint
CREATE TABLE "terms_document" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"version" text NOT NULL,
	"locale" text NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"content_digest" "bytea" NOT NULL,
	"status" text DEFAULT 'placeholder' NOT NULL,
	CONSTRAINT "terms_document_kind_version_locale_unique" UNIQUE("kind","version","locale"),
	CONSTRAINT "terms_document_kind_check" CHECK ("terms_document"."kind" in ('terms', 'privacy', 'community_rules')),
	CONSTRAINT "terms_document_status_check" CHECK ("terms_document"."status" in ('placeholder', 'approved', 'retired'))
);
--> statement-breakpoint
CREATE TABLE "verification_rate_window" (
	"scope" text NOT NULL,
	"subject_hash" "bytea" NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	"resend_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "verification_rate_window_scope_subject_hash_window_start_pk" PRIMARY KEY("scope","subject_hash","window_start"),
	CONSTRAINT "verification_rate_window_scope_check" CHECK ("verification_rate_window"."scope" in ('contact', 'origin')),
	CONSTRAINT "verification_rate_window_counts_check" CHECK ("verification_rate_window"."request_count" >= 0 and "verification_rate_window"."resend_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "account_interest" ADD CONSTRAINT "account_interest_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_interest" ADD CONSTRAINT "account_interest_interest_id_interest_id_fk" FOREIGN KEY ("interest_id") REFERENCES "public"."interest"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_usage_intent" ADD CONSTRAINT "profile_usage_intent_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_registration_id_registration_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registration"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_contact" ADD CONSTRAINT "account_contact_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_credential" ADD CONSTRAINT "account_credential_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration" ADD CONSTRAINT "registration_verification_id_contact_verification_id_fk" FOREIGN KEY ("verification_id") REFERENCES "public"."contact_verification"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terms_acceptance" ADD CONSTRAINT "terms_acceptance_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terms_acceptance" ADD CONSTRAINT "terms_acceptance_document_id_terms_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."terms_document"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_status_updated_at_index" ON "account" USING btree ("status","last_updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "account_contact_holding_contact_unique" ON "account_contact" USING btree ("channel","contact_hash") WHERE "account_contact"."holds_contact";--> statement-breakpoint
CREATE UNIQUE INDEX "contact_verification_open_contact_unique" ON "contact_verification" USING btree ("contact_hash","purpose") WHERE "contact_verification"."status" in ('open', 'verified');--> statement-breakpoint
CREATE INDEX "contact_verification_expires_at_index" ON "contact_verification" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "registration_retained_contact_unique" ON "registration" USING btree ("contact_hash") WHERE "registration"."status" = 'registration_in_progress';--> statement-breakpoint
CREATE INDEX "registration_status_expires_at_index" ON "registration" USING btree ("status","expires_at");
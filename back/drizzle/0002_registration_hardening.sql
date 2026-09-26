ALTER TABLE "registration" DROP CONSTRAINT "registration_expired_contact_check";--> statement-breakpoint
ALTER TABLE "registration" DROP CONSTRAINT "registration_status_check";--> statement-breakpoint
ALTER TABLE "profile" ALTER COLUMN "display_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ALTER COLUMN "region" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "account_credential" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "registration" ADD COLUMN "key_version" smallint;--> statement-breakpoint
-- Backfill (reviewed): rows written before 0002 used key version 1 and closed conversions as 'expired'.
UPDATE "registration" SET "key_version" = 1 WHERE "contact_ciphertext" IS NOT NULL;--> statement-breakpoint
UPDATE "registration" SET "status" = 'converted' WHERE "status" = 'expired' AND "id" IN (SELECT "registration_id" FROM "account");--> statement-breakpoint
UPDATE "registration" SET "expired_at" = NULL WHERE "status" = 'converted';--> statement-breakpoint
ALTER TABLE "account_contact" ADD CONSTRAINT "account_contact_holding_check" CHECK ("account_contact"."holds_contact" = ("account_contact"."contact_hash" is not null and "account_contact"."contact_ciphertext" is not null));--> statement-breakpoint
ALTER TABLE "registration" ADD CONSTRAINT "registration_retained_data_check" CHECK (("registration"."status" = 'registration_in_progress') = ("registration"."contact_hash" is not null and "registration"."contact_ciphertext" is not null and "registration"."key_version" is not null and "registration"."password_hash" is not null));--> statement-breakpoint
ALTER TABLE "registration" ADD CONSTRAINT "registration_status_check" CHECK ("registration"."status" in ('registration_in_progress', 'converted', 'expired'));
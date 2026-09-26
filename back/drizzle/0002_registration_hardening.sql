ALTER TABLE "registration" DROP CONSTRAINT "registration_expired_contact_check";--> statement-breakpoint
ALTER TABLE "registration" DROP CONSTRAINT "registration_status_check";--> statement-breakpoint
ALTER TABLE "profile" ALTER COLUMN "display_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ALTER COLUMN "region" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "account_credential" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "registration" ADD COLUMN "key_version" smallint;--> statement-breakpoint
-- Reviewed data migration: rows written before 0002 used key version 1, closed conversions as
-- 'expired' and only required contact_hash to be NULL on terminal rows. Normalize them before
-- the explicit-branch CHECKs below, which require terminal rows to retain nothing (ADR-017/018).
UPDATE "registration" SET "key_version" = 1 WHERE "status" = 'registration_in_progress';--> statement-breakpoint
UPDATE "registration" SET "status" = 'converted', "expired_at" = NULL WHERE "status" = 'expired' AND "id" IN (SELECT "registration_id" FROM "account" WHERE "status" <> 'expired');
UPDATE "registration" SET "contact_hash" = NULL, "contact_ciphertext" = NULL, "key_version" = NULL, "password_hash" = NULL WHERE "status" <> 'registration_in_progress';--> statement-breakpoint
UPDATE "account_contact" SET "contact_hash" = NULL, "contact_ciphertext" = NULL WHERE NOT "holds_contact";--> statement-breakpoint
ALTER TABLE "account_contact" ADD CONSTRAINT "account_contact_holding_check" CHECK (("account_contact"."holds_contact" and "account_contact"."contact_hash" is not null and "account_contact"."contact_ciphertext" is not null) or (not "account_contact"."holds_contact" and "account_contact"."contact_hash" is null and "account_contact"."contact_ciphertext" is null));--> statement-breakpoint
ALTER TABLE "registration" ADD CONSTRAINT "registration_retained_data_check" CHECK (("registration"."status" = 'registration_in_progress' and "registration"."contact_hash" is not null and "registration"."contact_ciphertext" is not null and "registration"."key_version" is not null and "registration"."password_hash" is not null) or ("registration"."status" <> 'registration_in_progress' and "registration"."contact_hash" is null and "registration"."contact_ciphertext" is null and "registration"."key_version" is null and "registration"."password_hash" is null));--> statement-breakpoint
ALTER TABLE "registration" ADD CONSTRAINT "registration_status_check" CHECK ("registration"."status" in ('registration_in_progress', 'converted', 'expired'));
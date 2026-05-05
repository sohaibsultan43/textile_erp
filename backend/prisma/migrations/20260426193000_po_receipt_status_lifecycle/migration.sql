-- Safer migration for restricted DB roles:
-- avoid RENAME/DROP TYPE operations that require enum ownership.
-- Keep existing enum type and append new values.
ALTER TYPE "PurchaseStatus" ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE "PurchaseStatus" ADD VALUE IF NOT EXISTS 'partially_received';
ALTER TYPE "PurchaseStatus" ADD VALUE IF NOT EXISTS 'complete';

-- Normalize existing rows that still use legacy 'confirmed' state.
UPDATE "purchase_orders"
SET "status" = 'pending'
WHERE "status"::text = 'confirmed';

ALTER TABLE "purchase_orders"
ALTER COLUMN "status" SET DEFAULT 'pending';

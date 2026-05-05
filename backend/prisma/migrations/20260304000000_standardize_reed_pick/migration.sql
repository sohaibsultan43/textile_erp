-- Rename columns in articles table
ALTER TABLE "articles" RENAME COLUMN "reedPickCount" TO "yarnCount";
ALTER TABLE "articles" RENAME COLUMN "construction" TO "contraction";
ALTER TABLE "articles" DROP COLUMN IF EXISTS "width";
ALTER TABLE "articles" DROP COLUMN IF EXISTS "reedPick";

-- Rename columns in purchase_order_items table
ALTER TABLE "purchase_order_items" RENAME COLUMN "reedPickCount" TO "yarnCount";
ALTER TABLE "purchase_order_items" RENAME COLUMN "construction" TO "contraction";
ALTER TABLE "purchase_order_items" DROP COLUMN IF EXISTS "width";
ALTER TABLE "purchase_order_items" DROP COLUMN IF EXISTS "reedPick";

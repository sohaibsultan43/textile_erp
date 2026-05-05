-- AlterTable
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "reedPickCount" TEXT,
ADD COLUMN IF NOT EXISTS "composition" TEXT,
ADD COLUMN IF NOT EXISTS "construction" TEXT,
ADD COLUMN IF NOT EXISTS "width" TEXT;

-- AlterTable
ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "reedPickCount" TEXT,
ADD COLUMN IF NOT EXISTS "composition" TEXT,
ADD COLUMN IF NOT EXISTS "construction" TEXT,
ADD COLUMN IF NOT EXISTS "width" TEXT;

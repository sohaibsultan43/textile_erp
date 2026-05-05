-- Width was dropped by 20260304000000_standardize_reed_pick but the app and Prisma
-- schema still use it for fabric width on articles and PO line items.
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "width" TEXT;
ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "width" TEXT;

-- Align DB column name with Prisma field `constraction`.
-- No-op if column is already `constraction`; safe if still `contraction`.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'articles'
      AND column_name = 'contraction'
  ) THEN
    ALTER TABLE "articles" RENAME COLUMN "contraction" TO "constraction";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'purchase_order_items'
      AND column_name = 'contraction'
  ) THEN
    ALTER TABLE "purchase_order_items" RENAME COLUMN "contraction" TO "constraction";
  END IF;
END $$;

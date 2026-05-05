-- AlterTable
ALTER TABLE "suppliers" ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "suppliers"
ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT,
ADD COLUMN IF NOT EXISTS "bankName" TEXT,
ADD COLUMN IF NOT EXISTS "accountNumber" TEXT,
ADD COLUMN IF NOT EXISTS "accountTitle" TEXT;


-- AlterTable
ALTER TABLE "grns" ADD COLUMN IF NOT EXISTS "warehouseId" TEXT;

-- AddForeignKey
ALTER TABLE "grns" ADD CONSTRAINT "grns_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

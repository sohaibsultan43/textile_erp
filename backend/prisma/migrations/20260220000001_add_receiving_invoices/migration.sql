-- CreateTable
CREATE TABLE IF NOT EXISTS "receiving_invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "billNo" TEXT,
    "poId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "amount" DOUBLE PRECISION NOT NULL,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "paymentTerms" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receiving_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "receiving_invoice_items" (
    "id" TEXT NOT NULL,
    "receivingInvoiceId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "pricePerUnit" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "taxPercent" DOUBLE PRECISION,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lineTotal" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "receiving_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "receiving_invoice_grns" (
    "id" TEXT NOT NULL,
    "receivingInvoiceId" TEXT NOT NULL,
    "grnId" TEXT NOT NULL,

    CONSTRAINT "receiving_invoice_grns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "receiving_invoices_invoiceNumber_key" ON "receiving_invoices"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "receiving_invoice_grns_receivingInvoiceId_grnId_key" ON "receiving_invoice_grns"("receivingInvoiceId", "grnId");

-- AddForeignKey
ALTER TABLE "receiving_invoices" ADD CONSTRAINT "receiving_invoices_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_invoices" ADD CONSTRAINT "receiving_invoices_poId_fkey" FOREIGN KEY ("poId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_invoice_items" ADD CONSTRAINT "receiving_invoice_items_receivingInvoiceId_fkey" FOREIGN KEY ("receivingInvoiceId") REFERENCES "receiving_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_invoice_items" ADD CONSTRAINT "receiving_invoice_items_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_invoice_grns" ADD CONSTRAINT "receiving_invoice_grns_receivingInvoiceId_fkey" FOREIGN KEY ("receivingInvoiceId") REFERENCES "receiving_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receiving_invoice_grns" ADD CONSTRAINT "receiving_invoice_grns_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "grns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

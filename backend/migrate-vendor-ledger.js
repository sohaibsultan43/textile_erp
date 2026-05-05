const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Starting Vendor Ledger migration (flipping to standard AP accounting)...');
    console.log('Standard AP: Credit = liability increase (GRNs/Invoices), Debit = liability decrease (Payments)\n');

    const suppliers = await prisma.supplier.findMany();

    for (const supplier of suppliers) {
        const supplierId = supplier.id;
        console.log(`Processing Supplier: ${supplier.name}`);

        // 1. Fetch all GRNs for this supplier and backfill missing entries
        const grns = await prisma.gRN.findMany({
            where: { supplierId },
            include: { items: true }
        });

        for (const grn of grns) {
            const existingEntry = await prisma.vendorLedger.findFirst({
                where: { referenceType: 'grn', referenceId: grn.id }
            });

            if (!existingEntry) {
                const po = await prisma.purchaseOrder.findUnique({
                    where: { id: grn.poId },
                    include: { items: true }
                });
                if (!po) continue;

                let grnTotalValue = 0;
                grn.items.forEach(item => {
                    const poItem = po.items.find(pi => pi.articleId === item.articleId);
                    const pricePerUnit = poItem ? poItem.pricePerUnit : 0;
                    grnTotalValue += (item.receivedQuantity * pricePerUnit);
                });

                if (grnTotalValue > 0) {
                    await prisma.vendorLedger.create({
                        data: {
                            supplierId,
                            entryType: 'credit', // GRN = liability increase
                            amount: grnTotalValue,
                            balance: 0, // will be corrected below
                            referenceType: 'grn',
                            referenceId: grn.id,
                            referenceNumber: grn.grnNumber,
                            description: `Goods Received - ${grn.grnNumber}`,
                            date: new Date(grn.receivedAt),
                            createdBy: grn.receivedBy
                        }
                    });
                    console.log(`  Created missing ledger entry for GRN: ${grn.grnNumber}`);
                }
            }
        }

        // 2. Flip existing entries that have the wrong entryType
        const allEntries = await prisma.vendorLedger.findMany({
            where: { supplierId },
            orderBy: [{ date: 'asc' }, { createdAt: 'asc' }]
        });

        for (const entry of allEntries) {
            const isGrnOrInvoice = entry.referenceType === 'grn' || entry.referenceType === 'receiving_invoice';
            const isPayment = entry.referenceType === 'payment';

            if (isGrnOrInvoice && entry.entryType !== 'credit') {
                await prisma.vendorLedger.update({
                    where: { id: entry.id },
                    data: { entryType: 'credit' }
                });
                console.log(`  Flipped GRN/Invoice entry ${entry.referenceNumber || entry.id} to credit`);
            } else if (isPayment && entry.entryType !== 'debit') {
                await prisma.vendorLedger.update({
                    where: { id: entry.id },
                    data: { entryType: 'debit' }
                });
                console.log(`  Flipped Payment entry ${entry.referenceNumber || entry.id} to debit`);
            }
        }

        // 3. Reload all entries after flipping and recalculate running balances
        const updatedEntries = await prisma.vendorLedger.findMany({
            where: { supplierId },
            orderBy: [{ date: 'asc' }, { createdAt: 'asc' }]
        });

        let runningBalance = 0;
        for (const entry of updatedEntries) {
            // Credit increases balance (owed), Debit decreases (paid)
            runningBalance += entry.entryType === 'credit' ? entry.amount : -entry.amount;

            if (Math.abs(entry.balance - runningBalance) > 0.001) {
                await prisma.vendorLedger.update({
                    where: { id: entry.id },
                    data: { balance: runningBalance }
                });
                console.log(`  Updated balance for entry ${entry.referenceNumber || entry.id} → ${runningBalance.toFixed(2)}`);
            }
        }

        console.log(`  ✓ Done. Final balance for ${supplier.name}: PKR ${runningBalance.toFixed(2)}\n`);
    }

    console.log('Migration finished successfully.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

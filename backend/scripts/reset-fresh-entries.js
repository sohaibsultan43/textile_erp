const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CONFIRM_FLAG = '--confirm-reset';
const INCLUDE_USERS_FLAG = '--include-users';
const KEEP_CONFIG_FLAG = '--keep-system-config';

const args = new Set(process.argv.slice(2));
const confirmed = args.has(CONFIRM_FLAG);
const includeUsers = args.has(INCLUDE_USERS_FLAG);
const keepSystemConfig = args.has(KEEP_CONFIG_FLAG);

if (!confirmed) {
  console.error(
    [
      'Reset aborted: missing confirmation flag.',
      `Run: node backend/scripts/reset-fresh-entries.js ${CONFIRM_FLAG}`,
      `Optional flags: ${INCLUDE_USERS_FLAG} ${KEEP_CONFIG_FLAG}`,
    ].join('\n')
  );
  process.exit(1);
}

async function main() {
  console.log('Starting fresh-entry reset...');
  console.log(`- include users: ${includeUsers ? 'yes' : 'no'}`);
  console.log(`- keep system config: ${keepSystemConfig ? 'yes' : 'no'}`);

  // Delete in dependency-safe order.
  await prisma.$transaction(async (tx) => {
    await tx.receivingInvoiceItem.deleteMany();
    await tx.receivingInvoiceGRN.deleteMany();
    await tx.receivingInvoice.deleteMany();

    await tx.vendorLedger.deleteMany();
    await tx.invoice.deleteMany();
    await tx.gatePassItem.deleteMany();
    await tx.gatePass.deleteMany();

    await tx.materialReceiptItem.deleteMany();
    await tx.materialReceipt.deleteMany();
    await tx.materialIssueItem.deleteMany();
    await tx.materialIssue.deleteMany();
    await tx.productionOrderItem.deleteMany();
    await tx.productionOrder.deleteMany();

    await tx.voucherLine.deleteMany();
    await tx.voucher.deleteMany();
    await tx.lFormRow.deleteMany();
    await tx.lForm.deleteMany();
    await tx.dyeingReceive.deleteMany();
    await tx.dyeingJob.deleteMany();

    await tx.qualityInspectionItem.deleteMany();
    await tx.qualityInspection.deleteMany();
    await tx.gRNItem.deleteMany();
    await tx.gRN.deleteMany();

    await tx.deliverySchedule.deleteMany();
    await tx.purchaseOrderItem.deleteMany();
    await tx.purchaseOrder.deleteMany();

    await tx.saleOrderItem.deleteMany();
    await tx.saleOrder.deleteMany();
    await tx.stockRequisitionItem.deleteMany();
    await tx.stockRequisition.deleteMany();

    await tx.stockItem.deleteMany();
    await tx.article.deleteMany();
    await tx.customer.deleteMany();
    await tx.supplier.deleteMany();
    await tx.location.deleteMany();
    await tx.process.deleteMany();

    if (!keepSystemConfig) {
      await tx.systemConfig.deleteMany();
    }
    if (includeUsers) {
      await tx.user.deleteMany();
    }
  });

  console.log('Fresh-entry reset complete.');
}

main()
  .catch((error) => {
    console.error('Fresh-entry reset failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

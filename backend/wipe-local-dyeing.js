/**
 * Wipe all dyeing flow data from LOCAL database
 * Run: node wipe-local-dyeing.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('[*] Connecting to local database...');
  
  try {
    // Count current rows
    const counts = await prisma.$transaction([
      prisma.voucherLine.count(),
      prisma.voucher.count(),
      prisma.lFormRow.count(),
      prisma.lForm.count(),
      prisma.dyeingReceive.count(),
      prisma.dyeingJob.count(),
    ]);

    console.log('\n[*] Current row counts:');
    console.log(`    voucher_lines:   ${counts[0]}`);
    console.log(`    vouchers:        ${counts[1]}`);
    console.log(`    l_form_rows:     ${counts[2]}`);
    console.log(`    l_forms:         ${counts[3]}`);
    console.log(`    dyeing_receives: ${counts[4]}`);
    console.log(`    dyeing_jobs:     ${counts[5]}`);

    const totalRows = counts.reduce((sum, c) => sum + c, 0);
    
    if (totalRows === 0) {
      console.log('\n[+] No dyeing data found. Nothing to delete.');
      return;
    }

    console.log(`\n[!] About to DELETE ${totalRows} total rows from dyeing tables...`);
    console.log('[*] Deleting in FK order (cascade)...\n');

    // Delete in reverse FK dependency order
    await prisma.$transaction(async (tx) => {
      const deleted = {
        voucherLines: await tx.voucherLine.deleteMany(),
        vouchers: await tx.voucher.deleteMany(),
        lFormRows: await tx.lFormRow.deleteMany(),
        lForms: await tx.lForm.deleteMany(),
        dyeingReceives: await tx.dyeingReceive.deleteMany(),
        dyeingJobs: await tx.dyeingJob.deleteMany(),
      };

      console.log('    Deleted:');
      console.log(`      voucher_lines:   ${deleted.voucherLines.count}`);
      console.log(`      vouchers:        ${deleted.vouchers.count}`);
      console.log(`      l_form_rows:     ${deleted.lFormRows.count}`);
      console.log(`      l_forms:         ${deleted.lForms.count}`);
      console.log(`      dyeing_receives: ${deleted.dyeingReceives.count}`);
      console.log(`      dyeing_jobs:     ${deleted.dyeingJobs.count}`);
    });

    console.log('\n[+] Done. All dyeing flow data wiped from local DB.');
    console.log('[+] Refresh your browser to see the empty listing.\n');

  } catch (error) {
    console.error('\n[!] Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

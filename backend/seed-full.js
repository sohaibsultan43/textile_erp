const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  try {
    // Create suppliers
    console.log('🏭 Creating suppliers...');
    const sup1 = await prisma.supplier.create({
      data: {
        name: 'Global Cotton Mills',
        contactPerson: 'Mr. Ahmed Khan',
        phone: '+92-300-1234567',
        address: 'Karachi, Pakistan',
        paymentTerms: 30,
      },
    });

    const sup2 = await prisma.supplier.create({
      data: {
        name: 'Polyester International',
        contactPerson: 'Ms. Sara Ali',
        phone: '+92-300-1234568',
        address: 'Lahore, Pakistan',
        paymentTerms: 45,
      },
    });

    console.log(`  ✓ ${sup1.name}`);
    console.log(`  ✓ ${sup2.name}`);

    // Create locations
    console.log('\n📍 Creating warehouse locations...');
    const loc1 = await prisma.location.create({
      data: {
        name: 'Main Warehouse',
        type: 'godown',
        address: 'Industrial Area, Karachi',
      },
    });

    const loc2 = await prisma.location.create({
      data: {
        name: 'Sales Outlet',
        type: 'salepoint',
        address: 'Mall Road, Lahore',
      },
    });

    console.log(`  ✓ ${loc1.name}`);
    console.log(`  ✓ ${loc2.name}`);

    // Create articles
    console.log('\n📦 Creating articles...');
    const art1 = await prisma.article.create({
      data: {
        name: 'Premium Cotton Jersey',
        gsm: 180,
        width: 58,
        supplierId: sup1.id,
      },
    });

    const art2 = await prisma.article.create({
      data: {
        name: 'Polyester Blend',
        gsm: 200,
        width: 60,
        supplierId: sup2.id,
      },
    });

    console.log(`  ✓ ${art1.name}`);
    console.log(`  ✓ ${art2.name}`);

    // Create stock
    console.log('\n📊 Creating stock items...');
    await prisma.stockItem.create({
      data: {
        articleId: art1.id,
        locationId: loc1.id,
        quantity: 5000,
      },
    });

    await prisma.stockItem.create({
      data: {
        articleId: art2.id,
        locationId: loc1.id,
        quantity: 3500,
      },
    });

    await prisma.stockItem.create({
      data: {
        articleId: art1.id,
        locationId: loc2.id,
        quantity: 1200,
      },
    });

    console.log(`  ✓ Stock created`);

    // Create customers
    console.log('\n👥 Creating customers...');
    const cust1 = await prisma.customer.create({
      data: {
        name: 'ABC Garments',
        email: 'orders@abcgarments.com',
        phone: '+92-300-9876543',
        city: 'Karachi',
      },
    });

    const cust2 = await prisma.customer.create({
      data: {
        name: 'XYZ Fashion',
        email: 'sales@xyzfashion.com',
        phone: '+92-300-9876544',
        city: 'Lahore',
      },
    });

    console.log(`  ✓ ${cust1.name}`);
    console.log(`  ✓ ${cust2.name}`);

    console.log('\n✅ Database seeded successfully!');
    console.log('\n📊 Summary:');
    console.log(`  Suppliers: 2`);
    console.log(`  Locations: 2`);
    console.log(`  Articles: 2`);
    console.log(`  Stock Items: 3`);
    console.log(`  Customers: 2`);
    console.log(`\n✨ The application is now ready to use!`);
    console.log(`\n📝 Demo Credentials:`);
    console.log(`  Email: admin@textile.com`);
    console.log(`  Password: admin123`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

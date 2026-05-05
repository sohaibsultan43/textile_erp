const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with textile ERP data...');

  try {
    // Create locations
    console.log('📍 Creating locations...');
    const locations = [
      { name: 'Main Warehouse', code: 'WH001', type: 'WAREHOUSE' },
      { name: 'Secondary Store', code: 'WH002', type: 'WAREHOUSE' },
      { name: 'Showroom', code: 'SR001', type: 'SHOWROOM' },
    ];

    for (const loc of locations) {
      await prisma.location.upsert({
        where: { code: loc.code },
        update: loc,
        create: loc,
      });
    }
    console.log(`  ✓ Created ${locations.length} locations`);

    // Create suppliers
    console.log('🏭 Creating suppliers...');
    const suppliers = [
      { name: 'Global Cotton Mills', code: 'SUP001', email: 'info@globalcotton.com', phone: '+92-300-1111111' },
      { name: 'Polyester International', code: 'SUP002', email: 'sales@polyint.com', phone: '+92-300-2222222' },
    ];

    for (const sup of suppliers) {
      await prisma.supplier.upsert({
        where: { code: sup.code },
        update: sup,
        create: sup,
      });
    }
    console.log(`  ✓ Created ${suppliers.length} suppliers`);

    // Create articles
    console.log('📦 Creating articles...');
    const articlesData = [
      {
        code: 'ART001',
        name: 'Premium Cotton Jersey',
        fabricType: 'JERSEY',
        composition: '100% Cotton',
        gsm: 180,
        width: 58,
        color: 'White',
        grade: 'A',
        supplierCode: 'SUP001',
        cost: 150,
        salePrice: 200,
      },
      {
        code: 'ART002',
        name: 'Polyester Blend',
        fabricType: 'KNIT',
        composition: '65% Polyester 35% Cotton',
        gsm: 200,
        width: 60,
        color: 'Navy',
        grade: 'A',
        supplierCode: 'SUP002',
        cost: 120,
        salePrice: 160,
      },
      {
        code: 'ART003',
        name: 'Denim Fabric',
        fabricType: 'WOVEN',
        composition: '100% Cotton',
        gsm: 350,
        width: 60,
        color: 'Blue',
        grade: 'B',
        supplierCode: 'SUP001',
        cost: 200,
        salePrice: 280,
      },
    ];

    const createdArticles = [];
    for (const artData of articlesData) {
      const supplier = await prisma.supplier.findUnique({ where: { code: artData.supplierCode } });
      
      const article = await prisma.article.upsert({
        where: { code: artData.code },
        update: artData,
        create: {
          code: artData.code,
          name: artData.name,
          fabricType: artData.fabricType,
          composition: artData.composition,
          gsm: artData.gsm,
          width: artData.width,
          color: artData.color,
          grade: artData.grade,
          cost: artData.cost,
          salePrice: artData.salePrice,
          supplier: { connect: { id: supplier.id } },
        },
      });
      createdArticles.push(article);
    }
    console.log(`  ✓ Created ${createdArticles.length} articles`);

    // Create stock items
    console.log('📊 Creating stock items...');
    let stockCount = 0;
    const allLocations = await prisma.location.findMany();

    for (const article of createdArticles) {
      for (const location of allLocations) {
        await prisma.stockItem.upsert({
          where: {
            articleId_locationId: {
              articleId: article.id,
              locationId: location.id,
            },
          },
          update: { quantity: 1000 + Math.random() * 5000 },
          create: {
            articleId: article.id,
            locationId: location.id,
            quantity: 1000 + Math.random() * 5000,
          },
        });
        stockCount++;
      }
    }
    console.log(`  ✓ Created ${stockCount} stock items`);

    console.log('\n✅ Database seeded successfully!');
    console.log(`
Summary:
- Locations: ${locations.length}
- Suppliers: ${suppliers.length}
- Articles: ${createdArticles.length}
- Stock Items: ${stockCount}

Ready to use! Login with admin@textile.com / admin123
    `);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

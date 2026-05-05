const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  console.log('🗑️  Clearing existing data...');
  await prisma.receivingInvoiceItem.deleteMany();
  await prisma.receivingInvoiceGRN.deleteMany();
  await prisma.receivingInvoice.deleteMany();
  await prisma.deliverySchedule.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.gRNItem.deleteMany();
  await prisma.gRN.deleteMany();
  await prisma.saleOrderItem.deleteMany();
  await prisma.saleOrder.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.vendorLedger.deleteMany();
  await prisma.stockItem.deleteMany();
  await prisma.location.deleteMany();
  await prisma.article.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.process.deleteMany();
  await prisma.systemConfig.deleteMany();
  await prisma.user.deleteMany();

  // Hash password for demo users
  const hashedPassword = await bcrypt.hash('123456', 12);

  // Create admin user first
  console.log('👤 Creating admin user...');
  const adminUser = await prisma.user.create({
    data: {
      email: process.env.ADMIN_EMAIL || 'admin@textile.com',
      password: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 12),
      name: process.env.ADMIN_NAME || 'System Administrator',
      role: 'owner',
    },
  });

  console.log(`✅ Admin user created: ${adminUser.email}`);

  // Create demo users
  console.log('👥 Creating demo users...');
  const users = [
    { email: 'sales@textileerp.com', role: 'sales', name: 'Sales Representative' },
    { email: 'warehouse@textileerp.com', role: 'warehouse', name: 'Warehouse Manager' },
    { email: 'finance@textileerp.com', role: 'finance', name: 'Finance Officer' },
  ];

  for (const userData of users) {
    await prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
      },
    });
  }

  console.log(`✅ Created ${users.length} demo users`);

  // Create customers
  console.log('🏢 Creating customers...');
  const customers = [
    { name: 'Adrees', city: 'Hyderabad', creditLimit: 300000, creditDays: 30, isCashOnly: false },
    { name: 'Yasir', city: 'Sukkur', creditLimit: 250000, creditDays: 30, isCashOnly: false },
    { name: 'Asghar', city: 'Lahore', creditLimit: 400000, creditDays: 45, isCashOnly: false },
    { name: 'Rafique', city: 'Karachi', creditLimit: 500000, creditDays: 45, isCashOnly: false },
    { name: 'Imtiaz', city: 'Peshawar', creditLimit: 0, creditDays: 0, isCashOnly: true },
  ];

  const createdCustomers = [];
  for (const customer of customers) {
    const created = await prisma.customer.create({
      data: customer,
    });
    createdCustomers.push(created);
  }

  console.log(`✅ Created ${customers.length} customers`);

  // Create suppliers
  console.log('🏭 Creating suppliers...');
  const suppliers = [
    {
      name: 'LocalFabricSupplies',
      contactPerson: 'Ahmed Khan',
      email: 'ahmed@localfabric.com',
      phone: '+92-300-1234567',
      address: 'Textile Market, Faisalabad',
      paymentTerms: 30,
    },
    {
      name: 'StitchTex Components',
      contactPerson: 'Sara Ali',
      email: 'sara@stitchtex.com',
      phone: '+92-301-7654321',
      address: 'Industrial Zone, Karachi',
      paymentTerms: 45,
    },
  ];

  const createdSuppliers = [];
  for (const supplier of suppliers) {
    const created = await prisma.supplier.create({
      data: supplier,
    });
    createdSuppliers.push(created);
  }

  console.log(`✅ Created ${suppliers.length} suppliers`);

  // Create articles
  console.log('🧵 Creating articles...');
  const articles = [
    { name: 'Dilkash', fabricType: 'Larson', color: 'Beige', grade: 'A', lotNumber: 'LOT-2024-001', unit: 'Meter', cost: 850, salePrice: 1200 },
    { name: 'Bel Man', fabricType: 'Larson', color: 'Cream', grade: 'A', lotNumber: 'LOT-2024-002', unit: 'Meter', cost: 900, salePrice: 1250 },
    { name: 'Canali', fabricType: 'M Saad', color: 'Navy', grade: 'A', lotNumber: 'LOT-2024-003', unit: 'Meter', cost: 1100, salePrice: 1500 },
    { name: 'Careera', fabricType: 'M Saad', color: 'Grey', grade: 'B', lotNumber: 'LOT-2024-004', unit: 'Meter', cost: 750, salePrice: 1050 },
    { name: 'Dhoom', fabricType: 'Larson', color: 'Black', grade: 'A', lotNumber: 'LOT-2024-005', unit: 'Meter', cost: 950, salePrice: 1300 },
    { name: 'Dosti', fabricType: 'Larson', color: 'Brown', grade: 'A', lotNumber: 'LOT-2024-006', unit: 'Meter', cost: 880, salePrice: 1220 },
    { name: 'Green Cafe', fabricType: 'M Saad', color: 'Green', grade: 'B', lotNumber: 'LOT-2024-007', unit: 'Meter', cost: 720, salePrice: 1000 },
    { name: 'Karabo', fabricType: 'M Saad', color: 'Charcoal', grade: 'A', lotNumber: 'LOT-2024-008', unit: 'Meter', cost: 1050, salePrice: 1450 },
  ];

  const createdArticles = [];
  for (const article of articles) {
    const created = await prisma.article.create({
      data: article,
    });
    createdArticles.push(created);
  }

  console.log(`✅ Created ${articles.length} articles`);

  // Create locations
  console.log('📍 Creating locations...');
  const locations = [
    { name: 'Sheranwala', type: 'godown', address: 'Sheranwala Gate, Multan' },
    { name: 'Khizri Mohala', type: 'godown', address: 'Khizri Mohala, Multan' },
    { name: 'Polka', type: 'godown', address: 'Polka Road, Multan' },
    { name: 'Shop Bin Bashir', type: 'salepoint', address: 'Bin Bashir Plaza, Multan' },
    { name: 'Shop Kareem Center', type: 'salepoint', address: 'Kareem Center, Multan' },
    { name: 'Shop 13 Nawab Bazar', type: 'salepoint', address: '13 Nawab Bazar, Multan' },
  ];

  const createdLocations = [];
  for (const location of locations) {
    const created = await prisma.location.create({
      data: location,
    });
    createdLocations.push(created);
  }

  console.log(`✅ Created ${locations.length} locations`);

  // Create processes
  console.log('⚙️ Creating processes...');
  const processes = [
    { name: 'Dyeing', stage: 'dyeing', wastagePercent: 5, duration: 8, inputType: 'RM', outputType: 'WIP' },
    { name: 'Finishing', stage: 'finishing', wastagePercent: 2, duration: 4, inputType: 'WIP', outputType: 'WIP' },
    { name: 'Cutting', stage: 'cutting', wastagePercent: 3, duration: 6, inputType: 'WIP', outputType: 'WIP' },
    { name: 'Stitching', stage: 'stitching', wastagePercent: 1, duration: 10, inputType: 'WIP', outputType: 'WIP' },
    { name: 'Packing', stage: 'packing', wastagePercent: 0.5, duration: 2, inputType: 'WIP', outputType: 'FG' },
  ];

  for (const process of processes) {
    await prisma.process.create({
      data: process,
    });
  }

  console.log(`✅ Created ${processes.length} processes`);

  // Create some initial stock items
  console.log('📦 Creating initial stock items...');
  const stockItems = [
    { articleId: createdArticles[0].id, locationId: createdLocations[0].id, quantity: 500, pricePerUnit: 850, stage: 'FG' },
    { articleId: createdArticles[1].id, locationId: createdLocations[0].id, quantity: 300, pricePerUnit: 900, stage: 'FG' },
    { articleId: createdArticles[2].id, locationId: createdLocations[1].id, quantity: 200, pricePerUnit: 1100, stage: 'FG' },
    { articleId: createdArticles[3].id, locationId: createdLocations[1].id, quantity: 400, pricePerUnit: 750, stage: 'FG' },
    { articleId: createdArticles[4].id, locationId: createdLocations[2].id, quantity: 250, pricePerUnit: 950, stage: 'FG' },
  ];

  for (const stockItem of stockItems) {
    await prisma.stockItem.create({
      data: stockItem,
    });
  }

  console.log(`✅ Created ${stockItems.length} stock items`);

  // Create demo purchase orders
  console.log('🧾 Creating demo purchase orders...');
  const purchaseOrder1 = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-20260330-001',
      supplierId: createdSuppliers[0].id,
      totalAmount: 163000,
      promiseDeliveryDays: 7,
      status: 'pending',
      notes: 'Demo PO for dashboard visibility',
      createdBy: adminUser.id,
      items: {
        create: [
          {
            articleId: createdArticles[0].id,
            quantity: 100,
            pricePerUnit: 850,
            totalPrice: 85000,
            yarnCount: '40/40',
            composition: '80:20',
            constraction: '112/90',
            width: '58',
            expectedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            deliverySchedules: {
              create: [
                {
                  quantity: 40,
                  pickDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
                },
                {
                  quantity: 60,
                  pickDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                },
              ],
            },
          },
          {
            articleId: createdArticles[1].id,
            quantity: 60,
            pricePerUnit: 1300,
            totalPrice: 78000,
            expectedDeliveryDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
          },
        ],
      },
    },
  });

  const purchaseOrder2 = await prisma.purchaseOrder.create({
    data: {
      poNumber: 'PO-20260330-002',
      supplierId: createdSuppliers[1].id,
      totalAmount: 99000,
      promiseDeliveryDays: 10,
      status: 'pending',
      notes: 'Demo PO ready for GRN receipts',
      createdBy: adminUser.id,
      approvedBy: adminUser.id,
      approvedAt: new Date(),
      items: {
        create: [
          {
            articleId: createdArticles[2].id,
            quantity: 90,
            pricePerUnit: 1100,
            totalPrice: 99000,
            expectedDeliveryDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
          },
        ],
      },
    },
  });

  console.log('✅ Created 2 purchase orders');

  // Create a demo GRN linked to the pending PO
  console.log('📥 Creating demo GRN...');
  const demoGRN = await prisma.gRN.create({
    data: {
      grnNumber: 'GRN-20260330-001',
      poId: purchaseOrder2.id,
      supplierId: createdSuppliers[1].id,
      warehouseId: createdLocations[0].id,
      receivedBy: adminUser.id,
      receivedAt: new Date(),
      status: 'pending',
      notes: 'Demo GRN awaiting inspection',
      items: {
        create: [
          {
            articleId: createdArticles[2].id,
            orderedQuantity: 90,
            receivedQuantity: 85,
            acceptedQuantity: 82,
            rejectedQuantity: 3,
            packages: 10,
            unit: 'Meter',
            lotNo: 'GRN-LOT-001',
            remarks: 'Minor shade variation on 3 meters',
          },
        ],
      },
    },
  });

  await prisma.purchaseOrder.update({
    where: { id: purchaseOrder2.id },
    data: { grnId: demoGRN.id },
  });

  console.log('✅ Created 1 GRN');

  // Create a demo sales order
  console.log('🧮 Creating demo sales order...');
  await prisma.saleOrder.create({
    data: {
      orderNumber: 'SO-20260330-001',
      customerId: createdCustomers[0].id,
      locationId: createdLocations[3].id,
      totalAmount: 62500,
      status: 'pending',
      paymentType: 'credit',
      createdBy: adminUser.id,
      items: {
        create: [
          {
            articleId: createdArticles[0].id,
            quantity: 25,
            pricePerUnit: 1250,
            totalPrice: 31250,
          },
          {
            articleId: createdArticles[3].id,
            quantity: 25,
            pricePerUnit: 1250,
            totalPrice: 31250,
          },
        ],
      },
    },
  });

  console.log('✅ Created 1 sales order');

  // Create system configuration
  console.log('⚙️ Creating system configuration...');
  const systemConfigs = [
    { key: 'company_name', value: 'Textile ERP System', category: 'company' },
    { key: 'company_address', value: 'Industrial Area, Multan, Pakistan', category: 'company' },
    { key: 'company_phone', value: '+92-61-1234567', category: 'company' },
    { key: 'company_email', value: 'info@textileerp.com', category: 'company' },
    { key: 'company_website', value: 'www.textileerp.com', category: 'company' },
    { key: 'sale_order_prefix', value: 'SO', category: 'numbering' },
    { key: 'purchase_order_prefix', value: 'PO', category: 'numbering' },
    { key: 'invoice_prefix', value: 'INV', category: 'numbering' },
    { key: 'gate_pass_prefix', value: 'GP', category: 'numbering' },
    { key: 'requisition_prefix', value: 'REQ', category: 'numbering' },
    { key: 'default_currency', value: 'PKR', category: 'general' },
    { key: 'tax_rate', value: '17', category: 'financial' },
    { key: 'default_credit_days', value: '30', category: 'financial' },
    { key: 'low_stock_threshold', value: '50', category: 'inventory' },
    { key: 'auto_approve_orders', value: 'false', category: 'workflow' },
  ];

  for (const config of systemConfigs) {
    await prisma.systemConfig.create({
      data: config,
    });
  }

  console.log(`✅ Created ${systemConfigs.length} system configurations`);

  console.log('🎉 Database seeding completed successfully!');
  console.log('');
  console.log('📋 Summary:');
  console.log(`   • Admin User: ${adminUser.email}`);
  console.log(`   • Demo Users: ${users.length}`);
  console.log(`   • Customers: ${customers.length}`);
  console.log(`   • Suppliers: ${suppliers.length}`);
  console.log(`   • Articles: ${articles.length}`);
  console.log(`   • Locations: ${locations.length}`);
  console.log(`   • Processes: ${processes.length}`);
  console.log(`   • Stock Items: ${stockItems.length}`);
  console.log('   • Purchase Orders: 2');
  console.log('   • GRNs: 1');
  console.log('   • Sale Orders: 1');
  console.log(`   • System Configs: ${systemConfigs.length}`);
  console.log('');
  console.log('🔑 Login Credentials:');
  console.log(`   Admin: ${adminUser.email} / ${process.env.ADMIN_PASSWORD || 'admin123'}`);
  console.log('   Demo Users: [role]@textileerp.com / 123456');
  console.log('   Example: sales@textileerp.com / 123456');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
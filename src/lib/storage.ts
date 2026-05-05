import { User, Customer, Article, Location, StockItem, SaleOrder, GatePass, Invoice, StockRequisition, Supplier, PurchaseOrder, GRN, QualityInspection, Process, ProductionOrder, MaterialIssue, MaterialReceipt, DyeingJob, DyeingReceive, LForm, Voucher, VendorLedgerEntry } from '@/types';

const STORAGE_VERSION = 'erp_data_v2'; // Increment to force refresh demo data

const STORAGE_KEYS = {
  USERS: 'erp_users',
  CUSTOMERS: 'erp_customers',
  ARTICLES: 'erp_articles',
  LOCATIONS: 'erp_locations',
  STOCK: 'erp_stock',
  SALES: 'erp_sales',
  GATEPASSES: 'erp_gatepasses',
  INVOICES: 'erp_invoices',
  REQUISITIONS: 'erp_requisitions',
  SUPPLIERS: 'erp_suppliers',
  PURCHASE_ORDERS: 'erp_purchase_orders',
  GRNS: 'erp_grns',
  QUALITY_INSPECTIONS: 'erp_quality_inspections',
  RECEIVING_INVOICES: 'erp_receiving_invoices',
  PROCESSES: 'erp_processes',
  PRODUCTION_ORDERS: 'erp_production_orders',
  MATERIAL_ISSUES: 'erp_material_issues',
  MATERIAL_RECEIPTS: 'erp_material_receipts',
  DYEING_JOBS: 'erp_dyeing_jobs',
  DYEING_RECEIVES: 'erp_dyeing_receives',
  LFORMS: 'erp_lforms',
  VOUCHERS: 'erp_vouchers',
  VENDOR_LEDGER: 'erp_vendor_ledger',
  CURRENT_USER: 'erp_current_user',
  AUTH_TOKEN: 'erp_auth_token',
  DATA_VERSION: 'erp_data_version',
};

// Generic storage functions
export const storage = {
  get: <T>(key: string): T[] => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  },

  set: <T>(key: string, data: T[]): void => {
    localStorage.setItem(key, JSON.stringify(data));
  },

  add: <T extends { id: string }>(key: string, item: T): void => {
    const items = storage.get<T>(key);
    items.push(item);
    storage.set(key, items);
  },

  update: <T extends { id: string }>(key: string, id: string, updates: Partial<T>): void => {
    const items = storage.get<T>(key);
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...updates };
      storage.set(key, items);
    }
  },

  delete: <T extends { id: string }>(key: string, id: string): void => {
    const items = storage.get<T>(key);
    const filtered = items.filter(item => item.id !== id);
    storage.set(key, filtered);
  },
};

// Initialize default data
export const initializeData = () => {
  // NOTE: Users/auth are now expected to come from the backend (Postgres + JWT).
  // Keep other demo/master data locally until modules are fully API-driven.

  // Check data version - if outdated, clear and reload demo data
  const currentVersion = localStorage.getItem(STORAGE_KEYS.DATA_VERSION);
  if (currentVersion !== STORAGE_VERSION) {
    // Clear old demo data to load fresh
    localStorage.removeItem(STORAGE_KEYS.ARTICLES);
    localStorage.removeItem(STORAGE_KEYS.SUPPLIERS);
    localStorage.removeItem(STORAGE_KEYS.STOCK);
    localStorage.setItem(STORAGE_KEYS.DATA_VERSION, STORAGE_VERSION);
  }

  // Customers
  if (!localStorage.getItem(STORAGE_KEYS.CUSTOMERS)) {
    const customers: Customer[] = [
      { id: '1', name: 'Adrees', city: 'Hyderabad', creditLimit: 300000, creditDays: 30, isCashOnly: false, currentBalance: 0 },
      { id: '2', name: 'Yasir', city: 'Sukkur', creditLimit: 250000, creditDays: 30, isCashOnly: false, currentBalance: 0 },
      { id: '3', name: 'Asghar', city: 'Lahore', creditLimit: 400000, creditDays: 45, isCashOnly: false, currentBalance: 0 },
      { id: '4', name: 'Rafique', city: 'Karachi', creditLimit: 500000, creditDays: 45, isCashOnly: false, currentBalance: 0 },
      { id: '5', name: 'Imtiaz', city: 'Peshawar', creditLimit: 0, creditDays: 0, isCashOnly: true, currentBalance: 0 },
    ];
    storage.set(STORAGE_KEYS.CUSTOMERS, customers);
  }

  // Articles
  if (!localStorage.getItem(STORAGE_KEYS.ARTICLES)) {
    const articles: Article[] = [
      // Grey Materials (Raw fabric for dyeing)
      { id: '1', name: 'Grey Larson 60x60', category: 'grey_material', status: 'active', fabricType: '', unit: 'Meter', cost: 450, reedPick: '60x60' },
      { id: '2', name: 'Grey Larson 72x68', category: 'grey_material', status: 'active', fabricType: '', unit: 'Meter', cost: 520, reedPick: '72x68' },
      { id: '3', name: 'Grey M Saad 80x80', category: 'grey_material', status: 'active', fabricType: '', unit: 'Meter', cost: 580, reedPick: '80x80' },

      // Finished Goods (Dyed & ready to sell)
      { id: '4', name: 'Dilkash', category: 'finished_goods', status: 'active', fabricType: 'Larson', color: 'Beige', grade: 'A', lotNumber: 'LOT-2024-001', unit: 'Meter', cost: 850, salePrice: 1200, reedPick: '60x60' },
      { id: '5', name: 'Bel Man', category: 'finished_goods', status: 'active', fabricType: 'Larson', color: 'Cream', grade: 'A', lotNumber: 'LOT-2024-002', unit: 'Meter', cost: 900, salePrice: 1250, reedPick: '60x60' },
      { id: '6', name: 'Canali', category: 'finished_goods', status: 'active', fabricType: 'M Saad', color: 'Navy Blue', grade: 'A', lotNumber: 'LOT-2024-003', unit: 'Meter', cost: 1100, salePrice: 1500, reedPick: '72x68' },
      { id: '7', name: 'Careera', category: 'finished_goods', status: 'active', fabricType: 'M Saad', color: 'Grey', grade: 'B', lotNumber: 'LOT-2024-004', unit: 'Meter', cost: 750, salePrice: 1050, reedPick: '80x80' },
      { id: '8', name: 'Dhoom', category: 'finished_goods', status: 'active', fabricType: 'Larson', color: 'Black', grade: 'A', lotNumber: 'LOT-2024-005', unit: 'Meter', cost: 950, salePrice: 1300, reedPick: '60x60' },

      // Packaging Materials
      { id: '9', name: 'Polythene Roll', category: 'packaging_material', status: 'active', fabricType: '', unit: 'Roll', cost: 350 },
      { id: '10', name: 'Carton Box Large', category: 'packaging_material', status: 'active', fabricType: '', unit: 'Piece', cost: 120 },
      { id: '11', name: 'Packing Tape', category: 'packaging_material', status: 'active', fabricType: '', unit: 'Roll', cost: 80 },

      // Service Items
      { id: '12', name: 'Dyeing Service - Standard', category: 'service_item', status: 'active', fabricType: '', unit: 'Meter', salePrice: 150 },
      { id: '13', name: 'Dyeing Service - Premium', category: 'service_item', status: 'active', fabricType: '', unit: 'Meter', salePrice: 220 },
    ];
    storage.set(STORAGE_KEYS.ARTICLES, articles);
  }

  // Locations
  if (!localStorage.getItem(STORAGE_KEYS.LOCATIONS)) {
    const locations: Location[] = [
      { id: '1', name: 'Sheranwala', type: 'godown', address: 'Sheranwala Gate, Multan' },
      { id: '2', name: 'Khizri Mohala', type: 'godown', address: 'Khizri Mohala, Multan' },
      { id: '3', name: 'Polka', type: 'godown', address: 'Polka Road, Multan' },
      { id: '4', name: 'Shop Bin Bashir', type: 'salepoint', address: 'Bin Bashir Plaza, Multan' },
      { id: '5', name: 'Shop Kareem Center', type: 'salepoint', address: 'Kareem Center, Multan' },
      { id: '6', name: 'Shop 13 Nawab Bazar', type: 'salepoint', address: '13 Nawab Bazar, Multan' },
    ];
    storage.set(STORAGE_KEYS.LOCATIONS, locations);
  }

  // Initial stock with demo data
  if (!localStorage.getItem(STORAGE_KEYS.STOCK)) {
    const stock: StockItem[] = [
      // Grey materials in Sheranwala godown
      { id: '1', articleId: '1', locationId: '1', quantity: 500, pricePerUnit: 450 },
      { id: '2', articleId: '2', locationId: '1', quantity: 300, pricePerUnit: 520 },
      { id: '3', articleId: '3', locationId: '1', quantity: 400, pricePerUnit: 580 },

      // Finished goods in different locations
      { id: '4', articleId: '4', locationId: '1', quantity: 150, pricePerUnit: 850 },
      { id: '5', articleId: '5', locationId: '2', quantity: 200, pricePerUnit: 900 },
      { id: '6', articleId: '6', locationId: '4', quantity: 75, pricePerUnit: 1100 },
      { id: '7', articleId: '7', locationId: '5', quantity: 100, pricePerUnit: 750 },
      { id: '8', articleId: '8', locationId: '6', quantity: 80, pricePerUnit: 950 },

      // Packaging materials
      { id: '9', articleId: '9', locationId: '3', quantity: 50, pricePerUnit: 350 },
      { id: '10', articleId: '10', locationId: '3', quantity: 200, pricePerUnit: 120 },
      { id: '11', articleId: '11', locationId: '3', quantity: 100, pricePerUnit: 80 },
    ];
    storage.set(STORAGE_KEYS.STOCK, stock);
  }

  if (!localStorage.getItem(STORAGE_KEYS.SALES)) {
    storage.set(STORAGE_KEYS.SALES, []);
  }

  if (!localStorage.getItem(STORAGE_KEYS.GATEPASSES)) {
    storage.set(STORAGE_KEYS.GATEPASSES, []);
  }

  if (!localStorage.getItem(STORAGE_KEYS.INVOICES)) {
    storage.set(STORAGE_KEYS.INVOICES, []);
  }

  if (!localStorage.getItem(STORAGE_KEYS.REQUISITIONS)) {
    storage.set(STORAGE_KEYS.REQUISITIONS, []);
  }

  // Suppliers/Vendors with categories
  if (!localStorage.getItem(STORAGE_KEYS.SUPPLIERS)) {
    const suppliers: Supplier[] = [
      // Grey Material Suppliers
      { id: '1', name: 'Faisalabad Grey Mills', category: 'supplier', contactPerson: 'Ahmed Khan', email: 'ahmed@faisalabadgrey.com', phone: '+92-300-1234567', address: 'Textile Market, Faisalabad', paymentTerms: 30 },
      { id: '2', name: 'Multan Fabric House', category: 'supplier', contactPerson: 'Imran Ali', email: 'imran@multanfabric.com', phone: '+92-301-9876543', address: 'Industrial Area, Multan', paymentTerms: 45 },

      // Dyeing Houses
      { id: '3', name: 'Noor Dyeing Works', category: 'dyeing', contactPerson: 'Noor Muhammad', email: 'noor@noordyeing.com', phone: '+92-302-5551234', address: 'Dyeing Zone, Faisalabad', paymentTerms: 15 },
      { id: '4', name: 'Star Dyers', category: 'dyeing', contactPerson: 'Shahid Malik', email: 'shahid@stardyers.com', phone: '+92-303-6667890', address: 'Industrial Estate, Lahore', paymentTerms: 20 },
      { id: '5', name: 'Premium Color House', category: 'dyeing', contactPerson: 'Tariq Mehmood', email: 'tariq@premiumcolor.com', phone: '+92-304-7778901', address: 'Dyeing Cluster, Karachi', paymentTerms: 30 },

      // Packaging Suppliers
      { id: '6', name: 'PackWell Industries', category: 'packaging', contactPerson: 'Sara Khan', email: 'sara@packwell.com', phone: '+92-305-8889012', address: 'SITE Area, Karachi', paymentTerms: 15 },
      { id: '7', name: 'Box & Wrap Co.', category: 'packaging', contactPerson: 'Usman Shah', email: 'usman@boxwrap.com', phone: '+92-306-9990123', address: 'Korangi, Karachi', paymentTerms: 7 },

      // Other
      { id: '8', name: 'General Traders', category: 'other', contactPerson: 'Ali Hassan', email: 'ali@generaltraders.com', phone: '+92-307-1112345', address: 'Cloth Market, Lahore', paymentTerms: 30 },
    ];
    storage.set(STORAGE_KEYS.SUPPLIERS, suppliers);
  }

  // Processes
  if (!localStorage.getItem(STORAGE_KEYS.PROCESSES)) {
    const processes: Process[] = [
      { id: '1', name: 'Dyeing', stage: 'dyeing', wastagePercent: 5, duration: 8, inputType: 'RM', outputType: 'WIP' },
      { id: '2', name: 'Finishing', stage: 'finishing', wastagePercent: 2, duration: 4, inputType: 'WIP', outputType: 'WIP' },
      { id: '3', name: 'Cutting', stage: 'cutting', wastagePercent: 3, duration: 6, inputType: 'WIP', outputType: 'WIP' },
      { id: '4', name: 'Stitching', stage: 'stitching', wastagePercent: 1, duration: 10, inputType: 'WIP', outputType: 'WIP' },
      { id: '5', name: 'Packing', stage: 'packing', wastagePercent: 0.5, duration: 2, inputType: 'WIP', outputType: 'FG' },
    ];
    storage.set(STORAGE_KEYS.PROCESSES, processes);
  }

  if (!localStorage.getItem(STORAGE_KEYS.PURCHASE_ORDERS)) {
    storage.set(STORAGE_KEYS.PURCHASE_ORDERS, []);
  }

  if (!localStorage.getItem(STORAGE_KEYS.GRNS)) {
    storage.set(STORAGE_KEYS.GRNS, []);
  }

  if (!localStorage.getItem(STORAGE_KEYS.QUALITY_INSPECTIONS)) {
    storage.set(STORAGE_KEYS.QUALITY_INSPECTIONS, []);
  }

  if (!localStorage.getItem(STORAGE_KEYS.PRODUCTION_ORDERS)) {
    storage.set(STORAGE_KEYS.PRODUCTION_ORDERS, []);
  }

  if (!localStorage.getItem(STORAGE_KEYS.MATERIAL_ISSUES)) {
    storage.set(STORAGE_KEYS.MATERIAL_ISSUES, []);
  }

  if (!localStorage.getItem(STORAGE_KEYS.MATERIAL_RECEIPTS)) {
    storage.set(STORAGE_KEYS.MATERIAL_RECEIPTS, []);
  }

  if (!localStorage.getItem(STORAGE_KEYS.DYEING_JOBS)) {
    storage.set(STORAGE_KEYS.DYEING_JOBS, []);
  }

  if (!localStorage.getItem(STORAGE_KEYS.DYEING_RECEIVES)) {
    storage.set(STORAGE_KEYS.DYEING_RECEIVES, []);
  }

  if (!localStorage.getItem(STORAGE_KEYS.LFORMS)) {
    storage.set(STORAGE_KEYS.LFORMS, []);
  }

  if (!localStorage.getItem(STORAGE_KEYS.VOUCHERS)) {
    storage.set(STORAGE_KEYS.VOUCHERS, []);
  }

  // Vendor Ledger
  if (!localStorage.getItem(STORAGE_KEYS.VENDOR_LEDGER)) {
    storage.set(STORAGE_KEYS.VENDOR_LEDGER, []);
  }
};

export { STORAGE_KEYS };

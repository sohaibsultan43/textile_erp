export type UserRole = 'owner' | 'warehouse' | 'outlet' | 'sales' | 'finance' | 'purchase_officer' | 'quality_inspector' | 'production_manager' | 'inventory_controller' | 'accounts_officer';

export interface User {
  id: string;
  email: string;
  password?: string;
  role: UserRole;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

// Customer Types
export type CustomerStatus = 'active' | 'on_hold' | 'inactive';

export interface Customer {
  id: string;
  name: string;
  status: CustomerStatus;
  // Contact & Address Details
  phone?: string;
  billingAddress?: string;
  billingCity?: string;
  billingState?: string;
  billingPostalCode?: string;
  shippingAddress?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostalCode?: string;
  // Credit & Payment Management
  creditLimit: number;
  creditDays: number;
  isCashOnly: boolean;
  currentBalance: number;
  acceptsCheque: boolean;
  acceptsPDC: boolean;
  pdcDueDays?: number;
  advancePayment?: number;
  advanceRequired: boolean;
  deliveryDays?: number;
  // Associations
  salespersonId?: string;
  warehouseId?: string;
  // Notes
  remarks?: string;
  // Legacy field
  city?: string;
}

// Article Types
export type ArticleCategory = 'grey_material' | 'packaging_material' | 'finished_goods' | 'service_item';
export type ArticleStatus = 'active' | 'inactive' | 'discontinued';

export interface Article {
  id: string;
  name: string;
  category: ArticleCategory;
  status: ArticleStatus;
  fabricType: string;
  color?: string;
  grade?: 'A' | 'B' | 'C';
  lotNumber?: string;
  unit: string;
  cost?: number;
  salePrice?: number;
  yarnCount?: string; // Yarn count (e.g. 40pv 40 pv)
  composition?: string; // Composition (e.g. 80:20)
  constraction?: string; // Constraction (e.g. 112 90)
  width?: string;
  remarks?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Location {
  id: string;
  name: string;
  code?: string;
  type: 'godown' | 'salepoint' | 'warehouse';
  /** Backend: own vs vendor-owned warehouse */
  ownershipType?: 'own' | 'vendor';
  /** Supplier/vendor id when ownershipType is vendor */
  vendorId?: string | null;
  warehouseType?: 'own' | 'supplier';
  supplierId?: string;
  address: string;
  contactPerson?: string;
  phone?: string;
  capacity?: number;
  remarks?: string;
}

export interface StockItem {
  id: string;
  articleId: string;
  locationId: string;
  quantity: number;
  pricePerUnit: number;
  stage?: InventoryStage;
  lotNo?: string;
  article?: Pick<
    Article,
    | 'name'
    | 'fabricType'
    | 'color'
    | 'grade'
    | 'lotNumber'
    | 'unit'
    | 'cost'
    | 'salePrice'
    | 'yarnCount'
    | 'constraction'
    | 'composition'
    | 'width'
  >;
  location?: Pick<Location, 'name' | 'type' | 'address'>;
}

export type StockLedgerEntryType = 'grn' | 'adjustment' | 'issue';

export interface StockLedgerEntry {
  id: string;
  articleId: string;
  type: StockLedgerEntryType;
  date: string;
  referenceId?: string | null;
  referenceNumber?: string | null;
  poNumber?: string | null;
  supplierName?: string | null;
  locationId?: string | null;
  locationName?: string | null;
  lotNo?: string | null;
  quantityIn: number;
  quantityOut: number;
  pricePerUnit?: number | null;
  value?: number | null;
  remarks?: string | null;
}

export interface StockLedgerSummary {
  totalIn: number;
  totalOut: number;
  net: number;
  currentStock: number;
  stockByLocation: { locationId: string; locationName: string; quantity: number }[];
}

export interface StockLedgerResponse {
  article: Pick<Article, 'id' | 'name' | 'unit' | 'lotNumber' | 'grade' | 'yarnCount' | 'constraction' | 'composition' | 'width'>;
  entries: StockLedgerEntry[];
  summary: StockLedgerSummary;
}

export interface SaleOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  locationId: string;
  items: SaleOrderItem[];
  totalAmount: number;
  status: 'pending' | 'approved' | 'completed' | 'rejected' | 'cancelled';
  paymentType: 'cash' | 'credit';
  createdAt: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  gatePassId?: string;
  invoiceId?: string;
}

export interface SaleOrderItem {
  articleId: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
}

export interface StockRequisition {
  id: string;
  requisitionNumber: string;
  requestedBy: string;
  fromLocationId: string;
  toLocationId: string;
  items: StockRequisitionItem[];
  status: 'requested' | 'approved' | 'rejected' | 'dispatched' | 'received';
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  gatePassId?: string;
  notes?: string;
}

export interface StockRequisitionItem {
  articleId: string;
  quantity: number;
  unit?: string;
}

export interface GatePass {
  id: string;
  gatePassNumber: string;
  saleOrderId?: string;
  requisitionId?: string;
  fromLocationId: string;
  toLocationId: string;
  items: GatePassItem[];
  /** Legacy localStorage rows may still contain `in_transit`; treat as display-only. */
  status: 'issued' | 'received';
  purpose: 'sale' | 'transfer' | 'return';
  vehicleNumber?: string;
  driverName?: string;
  driverContact?: string;
  createdAt: string;
  receivedAt?: string;
  receivedBy?: string;
  securityNotes?: string;
  verificationDoc?: string;
}

export interface GatePassItem {
  articleId: string;
  quantity: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  saleOrderId: string;
  customerId: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  dueDate: string;
  status: 'paid' | 'partial' | 'unpaid' | 'overdue';
  createdAt: string;
}

export type InventoryStage = 'RM' | 'WIP' | 'FG';

// Vendor/Supplier Types
export type VendorCategory = 'supplier' | 'dyeing' | 'packaging' | 'other';
export type PaymentMethod = 'cash' | 'credit' | 'cheque' | 'bank_transfer' | 'online';

export interface Supplier {
  id: string;
  name: string;
  category: VendorCategory;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  paymentTerms: number;
  paymentMethod?: PaymentMethod;
  bankName?: string;
  accountNumber?: string;
  accountTitle?: string;
  remarks?: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  transactionDate?: string;
  warehouseId?: string;
  items: PurchaseOrderItem[];
  totalAmount: number;
  promiseDeliveryDays: number;
  status: 'pending' | 'approved' | 'partially_received' | 'complete' | 'cancelled';
  createdAt: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  grnId?: string;
  notes?: string;
  data?: Record<string, unknown>; // Generic data field for header
}

export interface DeliverySchedule {
  id: string;
  purchaseOrderItemId: string;
  quantity: number;
  pickDate: string; // ISO date string
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseOrderItem {
  articleId: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  yarnCount?: string; // Yarn count (e.g. 40pv 40 pv)
  composition?: string; // Composition (e.g. 80:20)
  constraction?: string; // Constraction (e.g. 112 90)
  width?: string;
  unit?: string;
  expectedDeliveryDate?: string; // ISO date string
  deliverySchedules?: DeliverySchedule[]; // Delivery schedule entries
  /** Populated on some API responses (e.g. PO list) for display fallbacks */
  article?: Pick<
    Article,
    'id' | 'name' | 'unit' | 'yarnCount' | 'constraction' | 'composition' | 'width'
  >;
}

export interface GRN {
  id: string;
  grnNumber: string;
  poId: string;
  supplierId: string;
  warehouseId?: string; // Warehouse where goods are being received
  items: GRNItem[];
  receivedBy: string;
  receivedAt: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  inspectionId?: string;
  notes?: string;
  warehouse?: Location; // Populated from API
}

export interface GRNItem {
  articleId: string;
  orderedQuantity: number;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  packages?: number; // Number of rolls/cones/packages
  unit?: string; // Unit of measurement (e.g., meter, kg, piece)
  lotNo?: string; // Lot number
  remarks?: string;
}

export interface QualityInspection {
  id: string;
  inspectionNumber: string;
  grnId: string;
  inspectedBy: string;
  inspectedAt: string;
  status: 'passed' | 'failed' | 'partial';
  items: QualityInspectionItem[];
  overallRemarks?: string;
}

export interface QualityInspectionItem {
  articleId: string;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  reason?: string;
}

export interface Process {
  id: string;
  name: string;
  stage: 'dyeing' | 'finishing' | 'cutting' | 'stitching' | 'packing';
  wastagePercent: number;
  duration: number; // in hours
  inputType: InventoryStage;
  outputType: InventoryStage;
}

export interface ProductionOrder {
  id: string;
  orderNumber: string;
  processId: string;
  items: ProductionOrderItem[];
  status: 'draft' | 'submitted' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: string;
  createdBy: string;
  startedAt?: string;
  completedAt?: string;
  locationId: string;
  notes?: string;
}

export interface ProductionOrderItem {
  articleId: string;
  inputQuantity: number;
  expectedOutput: number;
  actualOutput?: number;
  wastageQuantity?: number;
  outputArticleId?: string;
}

export interface MaterialIssue {
  id: string;
  issueNumber: string;
  productionOrderId: string;
  items: MaterialIssueItem[];
  issuedBy: string;
  issuedAt: string;
  fromLocationId: string;
}

export interface MaterialIssueItem {
  articleId: string;
  quantity: number;
  stage: InventoryStage;
}

export interface MaterialReceipt {
  id: string;
  receiptNumber: string;
  productionOrderId: string;
  items: MaterialReceiptItem[];
  receivedBy: string;
  receivedAt: string;
  toLocationId: string;
}

export interface MaterialReceiptItem {
  articleId: string;
  quantity: number;
  stage: InventoryStage;
  wastageQuantity: number;
}

export interface StockItemExtended extends StockItem {
  stage: InventoryStage;
  batchNumber?: string;
  processId?: string;
}

// Dyeing and Production Flow Types
export interface DyeingJob {
  id: string;
  jobNumber: string;
  issueDate: string;
  fromLocation: string;
  dyeingHouse: string;
  workOrderNo: string;
  lotNo: string;
  quality: string;
  colour: string;
  greyThan: number;
  greyMeters: number;
  scheduledDeliveryDate?: string;
  attachmentUrl?: string;
  notes?: string;
  status: 'issued' | 'in_dyeing' | 'received' | 'completed';
  deliverySchedules?: DeliverySchedule[];
  sourceLots?: Array<{ lotNo: string; greyMeters: number; quality: string }>;
  skipLForm?: boolean;
  createdBy: string;
  createdAt: string;
}

export interface DyeingReceive {
  id: string;
  receiveNumber: string;
  dyeingJobId: string;
  lotNo: string;
  receiveDate: string;
  dyeingName: string;
  quality: string;
  colour: string;
  tiyarThan: number;
  tiyarMeters: number;
  shortageThan: number;
  shortageMeters: number;
  shortagePercent: number;
  scheduledDeliveryDate?: string;
  deliveryNoteNo?: string;
  billNumber?: string;
  attachments?: string[];
  notes?: string;
  thanDetails?: Array<{ id: string; meters: number }>;
  createdBy: string;
  createdAt: string;
}

export type LFormItemType = 'standard_than' | 'loose_than' | 'cut_piece';

export interface LFormRow {
  id: string;
  rowNumber: number;
  itemType: LFormItemType;
  thanId: string;
  shade: string;
  quality: string;
  thanLength: number;
  meterEquivalent: number;
  remarks?: string;
}

export interface LForm {
  id: string;
  lformNumber: string;
  lotNo: string;
  dyeingReceiveId: string;
  operationDate: string;
  operator: string;
  rows: LFormRow[];
  totalThans: number;
  totalMeters: number;
  status: 'draft' | 'finalized' | 'corrected';
  finalizedBy?: string;
  finalizedAt?: string;
  createdBy: string;
  createdAt: string;
}

export type VoucherType = 'bulk' | 'loose';

export interface VoucherLine {
  id: string;
  lineNumber: number;
  thanId?: string;
  shade: string;
  quality: string;
  thanCount: number;
  meters: number;
  itemType: LFormItemType;
  remarks?: string;
}

export interface Voucher {
  id: string;
  voucherNumber: string;
  voucherType: VoucherType;
  lotNo: string;
  lformId: string;
  transferDate: string;
  warehouseId: string;
  lines: VoucherLine[];
  totalThans: number;
  totalMeters: number;
  status: 'draft' | 'approved' | 'transferred';
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface StockItemWithLot extends StockItem {
  lotNo?: string;
  shade?: string;
  thanId?: string;
  meterEquivalent?: number;
  isLoose?: boolean;
  isCutPiece?: boolean;
}

// Vendor Ledger Types
export type VendorLedgerEntryType = 'debit' | 'credit';

export interface VendorLedgerEntry {
  id: string;
  supplierId: string;
  entryType: VendorLedgerEntryType;
  amount: number;
  balance: number; // Running balance after this transaction
  referenceType: 'receiving_invoice' | 'payment' | 'adjustment' | 'opening_balance';
  referenceId?: string; // ID of the related document (invoice, payment, etc.)
  referenceNumber?: string; // PO/GRN/Invoice number for display
  description: string;
  date: string;
  createdBy: string;
  createdAt: string;
}

// Receiving Invoice Types
export interface ReceivingInvoiceItem {
  id: string;
  articleId: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number; // quantity * pricePerUnit (before tax)
  taxPercent?: number; // Tax percentage (0-100)
  taxAmount: number; // Calculated tax amount
  lineTotal: number; // totalPrice + taxAmount
  article?: Article; // Populated from API
}

export interface ReceivingInvoice {
  id: string;
  invoiceNumber: string;
  billNo?: string; // Bill number from supplier
  poId: string;
  supplierId: string;
  date: string;
  dueDate?: string;
  amount: number; // Subtotal before tax
  taxAmount: number; // Total tax amount
  totalAmount: number; // Grand total (amount + taxAmount)
  paymentTerms?: 'cash' | 'credit' | 'cheque';
  status: 'pending' | 'paid' | 'partial';
  paidAmount: number;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  // Relations (populated from API)
  supplier?: Supplier;
  purchaseOrder?: PurchaseOrder;
  items: ReceivingInvoiceItem[];
  grnInvoices?: Array<{
    id: string;
    grnId: string;
    grn?: GRN;
  }>;
}

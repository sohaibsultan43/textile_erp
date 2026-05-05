import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { AppDatePicker } from '@/components/ui/app-date-picker';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { GRN, Supplier, PurchaseOrder, Article, VendorLedgerEntry, ReceivingInvoice, ReceivingInvoiceItem } from '@/types';
import { purchaseOrderApi, grnApi, vendorApi, articleApi, receivingInvoiceApi, vendorLedgerApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Printer, Download, FileText, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDate } from '@/lib/utils';

type ExtendedReceivingInvoice = ReceivingInvoice & {
  grnIds?: string[];
  _tempPayments?: Array<{ method: string; amount: string | number; reference?: string }>;
};

const ReceivingInvoiceModule: React.FC = () => {
  const [invoices, setInvoices] = useState<ReceivingInvoice[]>([]);
  const [grns, setGrns] = useState<GRN[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [ledgerData, setLedgerData] = useState<VendorLedgerEntry[]>([]);

  // Form state
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedPoId, setSelectedPoId] = useState('');
  const [selectedGrnIds, setSelectedGrnIds] = useState<string[]>([]);
  const [billNo, setBillNo] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentTerms, setPaymentTerms] = useState<'cash' | 'credit' | 'cheque'>('cash');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  // Multiple payment entries
  const [payments, setPayments] = useState<Array<{ method: 'cash' | 'cheque' | 'online'; amount: string; reference: string }>>([]);
  const [newPaymentMethod, setNewPaymentMethod] = useState<'cash' | 'cheque' | 'online'>('cash');
  const [newPaymentAmount, setNewPaymentAmount] = useState('');
  const [newPaymentRef, setNewPaymentRef] = useState('');
  // Line items with tax
  const [invoiceItems, setInvoiceItems] = useState<Array<{
    articleId: string;
    articleName: string;
    quantity: number;
    pricePerUnit: number;
    totalPrice: number;
    taxPercent: number;
    taxAmount: number;
    lineTotal: number;
  }>>([]);

  // Form visibility state
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Preview state
  const [previewInvoice, setPreviewInvoice] = useState<ReceivingInvoice | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedInvoiceItems, setExpandedInvoiceItems] = useState<Set<string>>(new Set());

  const { toast } = useToast();

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    try {
      const [apiPOs, apiGRNs, apiSuppliers, apiArticles, apiInvoices] = await Promise.all([
        purchaseOrderApi.getAll(),
        grnApi.getAll(),
        vendorApi.getAll(),
        articleApi.getAll(),
        receivingInvoiceApi.getAll().catch(() => []), // Fallback to empty array if API not ready
      ]);
      setPurchaseOrders(apiPOs);
      setGrns(apiGRNs);
      setSuppliers(apiSuppliers);
      setArticles(apiArticles);
      setInvoices(apiInvoices);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load data. Please check your connection and try again.',
        variant: 'destructive',
      });
      setInvoices([]);
      setGrns([]);
      setSuppliers([]);
      setPurchaseOrders([]);
      setArticles([]);
    }
  };

  // Get POs filtered by selected supplier that have at least one confirmed GRN
  const posWithGrns = purchaseOrders.filter(po => {
    const hasConfirmedGrn = grns.some(grn => grn.poId === po.id && grn.status === 'confirmed');
    const matchesSupplier = !selectedSupplierId || po.supplierId === selectedSupplierId;
    return hasConfirmedGrn && matchesSupplier;
  });

  // Get GRNs for selected PO that haven't been invoiced yet
  const availableGrnsForPO = grns.filter(grn => {
    if (grn.poId !== selectedPoId) return false;
    // Must be confirmed to be invoiced
    if (grn.status !== 'confirmed') return false;

    // Check if GRN is already invoiced
    const isInvoiced = invoices.some(inv =>
      inv.grnInvoices?.some(gi => gi.grnId === grn.id)
    );
    return !isInvoiced && !grn.isInvoiced;
  });

  // Get selected PO details
  const selectedPO = purchaseOrders.find(po => po.id === selectedPoId);
  const selectedSupplier = suppliers.find(s => s.id === selectedPO?.supplierId);

  // Generate auto invoice number: RINV-YYYYMMDD-XXX
  const generateInvoiceNumber = () => {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const todaysInvoices = invoices.filter(inv => inv.invoiceNumber.startsWith(`RINV-${dateStr}`));
    const nextNum = (todaysInvoices.length + 1).toString().padStart(3, '0');
    return `RINV-${dateStr}-${nextNum}`;
  };

  // Calculate totals from invoice items (with tax)
  const calculateTotals = () => {
    const subtotal = invoiceItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxTotal = invoiceItems.reduce((sum, item) => sum + item.taxAmount, 0);
    const grandTotal = subtotal + taxTotal;
    return { subtotal, taxTotal, grandTotal };
  };

  const { subtotal, taxTotal, grandTotal } = calculateTotals();

  // Handle GRN checkbox toggle
  const handleGrnToggle = (grnId: string) => {
    setSelectedGrnIds(prev =>
      prev.includes(grnId)
        ? prev.filter(id => id !== grnId)
        : [...prev, grnId]
    );
  };

  // Handle select all GRNs
  const handleSelectAllGrns = () => {
    if (selectedGrnIds.length === availableGrnsForPO.length) {
      setSelectedGrnIds([]);
    } else {
      setSelectedGrnIds(availableGrnsForPO.map(grn => grn.id));
    }
  };

  // Reset form when supplier changes
  useEffect(() => {
    setSelectedPoId('');
    setSelectedGrnIds([]);
    setInvoiceItems([]);
    if (selectedSupplierId) {
      loadLedgerData(selectedSupplierId);
    } else {
      setLedgerData([]);
    }
  }, [selectedSupplierId]);

  const loadLedgerData = async (supplierId: string) => {
    try {
      const data = await vendorLedgerApi.getBySupplierId(supplierId);
      setLedgerData(Array.isArray(data) ? data : data.entries || []);
    } catch (error) {
      console.error('Failed to load ledger data:', error);
    }
  };

  // Get current balance for the selected supplier
  const getCurrentBalance = () => {
    if (!ledgerData || ledgerData.length === 0) return 0;
    // Get the most recent entry's balance
    return ledgerData[0]?.balance || 0;
  };

  // Reset form when PO changes
  useEffect(() => {
    setSelectedGrnIds([]);
    setInvoiceItems([]);
  }, [selectedPoId]);

  // Update invoice items when GRNs are selected
  useEffect(() => {
    if (!selectedPO || selectedGrnIds.length === 0) {
      setInvoiceItems([]);
      return;
    }

    const itemMap = new Map<string, {
      articleId: string;
      articleName: string;
      quantity: number;
      pricePerUnit: number;
      totalPrice: number;
      taxPercent: number;
      taxAmount: number;
      lineTotal: number;
      dimensions: string;
      packages: number;
    }>();

    selectedGrnIds.forEach(grnId => {
      const grn = grns.find(g => g.id === grnId);
      if (grn) {
        grn.items.forEach(grnItem => {
          const poItem = selectedPO.items.find(pi => pi.articleId === grnItem.articleId);
          const pricePerUnit = poItem?.pricePerUnit || 0;
          const quantity = grnItem.receivedQuantity;
          const totalPrice = quantity * pricePerUnit;

          if (itemMap.has(grnItem.articleId)) {
            const existing = itemMap.get(grnItem.articleId)!;
            existing.quantity += quantity;
            existing.totalPrice += totalPrice;
            existing.packages += grnItem.packages || 0;
            // Recalculate tax and line total
            existing.taxAmount = (existing.totalPrice * existing.taxPercent) / 100;
            existing.lineTotal = existing.totalPrice + existing.taxAmount;
          } else {
            const article = articles.find(a => a.id === grnItem.articleId);
            itemMap.set(grnItem.articleId, {
              articleId: grnItem.articleId,
              articleName: article?.name || 'Unknown',
              quantity,
              pricePerUnit,
              totalPrice,
              taxPercent: 0, // Default to 0, user can update
              taxAmount: 0,
              lineTotal: totalPrice,
              dimensions: [
                poItem?.constraction || article?.constraction,
                poItem?.yarnCount || article?.yarnCount,
                poItem?.composition || article?.composition
              ].filter(Boolean).join(' ') || '-',
              packages: grnItem.packages || 0,
            });
          }
        });
      }
    });

    setInvoiceItems(Array.from(itemMap.values()));
  }, [selectedGrnIds, selectedPO, grns, articles]);

  // Update tax calculations when taxPercent changes
  const updateItemTax = (articleId: string, taxPercent: number) => {
    setInvoiceItems(prev => prev.map(item => {
      if (item.articleId === articleId) {
        const taxAmount = (item.totalPrice * taxPercent) / 100;
        const lineTotal = item.totalPrice + taxAmount;
        return { ...item, taxPercent, taxAmount, lineTotal };
      }
      return item;
    }));
  };

  const handleAddInvoice = async () => {
    if (!selectedSupplierId || !selectedPoId || selectedGrnIds.length === 0 || invoiceItems.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please select a vendor, PO, at least one GRN, and ensure items are loaded",
        variant: "destructive"
      });
      return;
    }

    // Validate payment totals don't exceed invoice total
    const totalPaid = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    if (totalPaid > grandTotal) {
      toast({
        title: "Payment Exceeds Invoice",
        description: `Total payments (PKR ${totalPaid.toLocaleString()}) cannot exceed invoice total (PKR ${grandTotal.toLocaleString()}).`,
        variant: "destructive"
      });
      return;
    }

    try {
      // Create invoice via API
      const newInvoice = await receivingInvoiceApi.create({
        billNo: billNo || undefined,
        poId: selectedPoId,
        supplierId: selectedSupplierId,
        date,
        dueDate: dueDate || undefined,
        amount: subtotal,
        taxAmount: taxTotal,
        totalAmount: grandTotal,
        paymentTerms,
        notes: notes || undefined,
        items: invoiceItems.map(item => ({
          articleId: item.articleId,
          quantity: item.quantity,
          pricePerUnit: item.pricePerUnit,
          totalPrice: item.totalPrice,
          taxPercent: item.taxPercent || undefined,
          taxAmount: item.taxAmount,
          lineTotal: item.lineTotal,
        })),
        grnIds: selectedGrnIds,
      });

      // Create vendor ledger credit entry via API (invoice → liability increases)
      try {
        await vendorLedgerApi.createEntry({
          supplierId: selectedSupplierId,
          entryType: 'credit',
          amount: grandTotal,
          referenceType: 'receiving_invoice',
          referenceId: newInvoice.id,
          referenceNumber: newInvoice.invoiceNumber,
          description: `Receiving Invoice - ${selectedPO!.poNumber}`,
          date: date,
        });
      } catch (error) {
        console.error('Failed to create ledger entry:', error);
        toast({
          title: "Warning",
          description: "Invoice created but ledger entry failed. Please contact support.",
          variant: "destructive",
        });
      }

      // Record each payment as a debit against the vendor ledger
      for (const payment of payments) {
        const amt = parseFloat(payment.amount) || 0;
        if (amt <= 0) continue;
        try {
          await vendorLedgerApi.createPayment({
            supplierId: selectedSupplierId,
            amount: amt,
            paymentMethod: payment.method,
            reference: payment.reference || undefined,
            date: date,
            notes: `Payment for Invoice ${newInvoice.invoiceNumber}`,
          });
        } catch (err) {
          console.error('Failed to record payment:', err);
        }
      }

      await loadData();

      // Reset form
      setSelectedSupplierId('');
      setSelectedPoId('');
      setSelectedGrnIds([]);
      setBillNo('');
      setInvoiceItems([]);
      setDate(new Date().toISOString().slice(0, 10));
      setPaymentTerms('cash');
      setDueDate('');
      setNotes('');
      setPayments([]);

      toast({
        title: "Invoice Created",
        description: `Invoice ${newInvoice.invoiceNumber} created${totalPaid > 0 ? ` · PKR ${totalPaid.toLocaleString()} payment(s) recorded` : ''}`
      });

      // Show preview
      setPreviewInvoice({
        ...newInvoice,
        // Optional temp field since we just created it right now
        _tempPayments: payments.length > 0 ? payments : undefined
      } as ExtendedReceivingInvoice);
      setIsPreviewOpen(true);
    } catch (error: unknown) {
      console.error('Failed to create invoice:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create invoice. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice ${previewInvoice?.invoiceNumber}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; background: #fff; }
            .page { max-width: 900px; margin: 0 auto; padding: 40px; }
            /* Header */
            .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; border-bottom: 3px solid #1a1a2e; margin-bottom: 32px; }
            .company-name { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; color: #1a1a2e; }
            .company-sub { font-size: 12px; color: #666; margin-top: 4px; }
            .invoice-title-block { text-align: right; }
            .invoice-label { font-size: 28px; font-weight: 700; color: #1a1a2e; letter-spacing: 2px; }
            .invoice-number { font-size: 13px; color: #666; margin-top: 4px; font-family: monospace; }
            /* Info grid */
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
            .info-section h4 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 6px; }
            .info-section p { font-size: 14px; color: #1a1a2e; font-weight: 500; }
            .info-section .secondary { font-size: 12px; color: #666; margin-top: 2px; }
            /* Table */
            table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
            thead tr { background: #1a1a2e; color: #fff; }
            thead th { padding: 10px 12px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
            thead th.text-right { text-align: right; }
            tbody tr { border-bottom: 1px solid #f0f0f0; }
            tbody tr:nth-child(even) { background: #fafafa; }
            tbody td { padding: 10px 12px; vertical-align: middle; }
            tbody td.text-right { text-align: right; }
            tbody td.muted { color: #666; font-size: 12px; }
            /* Totals */
            .totals-wrapper { display: flex; justify-content: flex-end; margin-bottom: 32px; }
            .totals-box { width: 320px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; }
            .totals-row { display: flex; justify-content: space-between; padding: 10px 16px; font-size: 13px; border-bottom: 1px solid #f0f0f0; }
            .totals-row:last-child { border-bottom: none; background: #1a1a2e; color: #fff; font-weight: 700; font-size: 15px; }
            /* Balance strip */
            .balance-strip { display: flex; justify-content: space-between; background: #f7f8fa; border: 1px solid #e8e8e8; border-radius: 8px; padding: 16px 20px; margin-bottom: 32px; }
            .balance-item h5 { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 4px; }
            .balance-item p { font-size: 16px; font-weight: 700; color: #1a1a2e; }
            .balance-item.highlight p { color: #c0392b; }
            /* Notes */
            .notes-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 12px 16px; margin-bottom: 32px; font-size: 13px; }
            .notes-box strong { display: block; margin-bottom: 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #92400e; }
            /* Footer */
            .footer { border-top: 1px solid #e8e8e8; padding-top: 20px; display: flex; justify-content: space-between; align-items: center; }
            .footer-left { font-size: 11px; color: #999; }
            .footer-right { font-size: 11px; color: #999; text-align: right; }
            .terms-badge { display: inline-block; background: #e8f4fd; color: #1a73e8; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: capitalize; }
            @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleDownload = () => {
    handlePrint(); // Uses print dialog which allows saving as PDF
  };

  const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.name || 'Unknown';
  const getArticleName = (id: string) => articles.find(a => a.id === id)?.name || 'Unknown';
  const getGrnNumbers = (grnIds?: string[]) => {
    if (!grnIds) return 'N/A';
    return grnIds.map(id => grns.find(g => g.id === id)?.grnNumber || 'N/A').join(', ');
  };
  const getPoNumber = (poId: string) => purchaseOrders.find(p => p.id === poId)?.poNumber || 'N/A';

  // Get invoice items for preview (use items from invoice if available, otherwise calculate)
  const getInvoiceItems = (invoice: ReceivingInvoice) => {
    // Determine the previous balance right before this invoice was created
    // Find the ledger entry for this invoice
    const ledgerEntry = ledgerData?.find(entry => entry.referenceType === 'receiving_invoice' && entry.referenceId === invoice.id);
    // Approximate previous balance
    const previousBalance = ledgerEntry ? (ledgerEntry.balance - ledgerEntry.amount) : getCurrentBalance();

    if (invoice.items && invoice.items.length > 0) {
      return {
        items: invoice.items.map(item => {
          // Find matching PO item to get reed pick
          const po = purchaseOrders.find(p => p.id === invoice.poId);
          const poItem = po?.items.find(pi => pi.articleId === item.articleId);

          // Try to compute packages from GRNs
          const grnIds = invoice.grnInvoices?.map(gi => gi.grnId) || (invoice as ExtendedReceivingInvoice).grnIds || [];
          let packages = 0;
          grnIds.forEach(grnId => {
            const grn = grns.find(g => g.id === grnId);
            const grnItem = grn?.items.find(gi => gi.articleId === item.articleId);
            if (grnItem?.packages) packages += grnItem.packages;
          });

          return {
            articleId: item.articleId,
            articleName: item.article?.name || getArticleName(item.articleId),
            quantity: item.quantity,
            price: item.pricePerUnit,
            total: item.totalPrice,
            taxPercent: item.taxPercent || 0,
            taxAmount: item.taxAmount,
            lineTotal: item.lineTotal,
            dimensions: [
              poItem?.constraction || item.article?.constraction,
              poItem?.yarnCount || item.article?.yarnCount,
              poItem?.composition || item.article?.composition
            ].filter(Boolean).join(' ') || getArticleName(item.articleId) || '-',
            packages: packages || 0,
          }
        }),
        previousBalance
      };
    }
    // Fallback: calculate from GRNs (for backward compatibility)
    const items: Array<{ articleId: string; articleName: string; quantity: number; price: number; total: number; taxPercent: number; taxAmount: number; lineTotal: number; dimensions: string; packages: number; }> = [];
    const po = purchaseOrders.find(p => p.id === invoice.poId);
    const grnIds = invoice.grnInvoices?.map(gi => gi.grnId) || (invoice as ExtendedReceivingInvoice).grnIds || [];

    grnIds.forEach(grnId => {
      const grn = grns.find(g => g.id === grnId);
      if (grn && po) {
        grn.items.forEach(item => {
          const poItem = po.items.find(pi => pi.articleId === item.articleId);
          const price = poItem?.pricePerUnit || 0;
          const total = item.receivedQuantity * price;
          items.push({
            articleId: item.articleId,
            articleName: getArticleName(item.articleId),
            quantity: item.receivedQuantity,
            price,
            total,
            taxPercent: 0,
            taxAmount: 0,
            lineTotal: total,
            dimensions: [
              poItem?.constraction,
              poItem?.yarnCount,
              poItem?.composition
            ].filter(Boolean).join(' ') || '-',
            packages: item.packages || 0,
          });
        });
      }
    });
    return { items, previousBalance: getCurrentBalance() };
  };

  // Filter invoices based on search query
  const filteredInvoices = invoices.filter(inv => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();

    // Get PO Number
    const poNumber = inv.purchaseOrder?.poNumber || getPoNumber(inv.poId) || '';

    // Get Supplier Name
    const supplierName = inv.supplier?.name || getSupplierName(inv.supplierId) || '';

    // Search in items
    const items = getInvoiceItems(inv).items;
    const itemsMatch = items.some(item => {
      const qtyStr = String(item.quantity);
      const reedPickLabel = String(item.dimensions || '').toLowerCase();
      const articleName = String(item.articleName || '').toLowerCase();
      return articleName.includes(query) || reedPickLabel.includes(query) || qtyStr.includes(query);
    });

    return (
      inv.invoiceNumber?.toLowerCase().includes(query) ||
      inv.billNo?.toLowerCase().includes(query) ||
      poNumber.toLowerCase().includes(query) ||
      supplierName.toLowerCase().includes(query) ||
      itemsMatch
    );
  });


  // Reset form and close
  const handleCloseForm = () => {
    setSelectedSupplierId('');
    setSelectedPoId('');
    setSelectedGrnIds([]);
    setBillNo('');
    setInvoiceItems([]);
    setDate(new Date().toISOString().slice(0, 10));
    setPaymentTerms('cash');
    setDueDate('');
    setNotes('');
    setPayments([]);
    setIsFormOpen(false);
  };

  const handleFormOpenChange = (open: boolean) => {
    if (!open) {
      handleCloseForm();
      return;
    }

    setIsFormOpen(true);
  };

  const toggleInvoiceItemsDropdown = (invoiceId: string) => {
    setExpandedInvoiceItems(prev => {
      const next = new Set(prev);
      if (next.has(invoiceId)) {
        next.delete(invoiceId);
      } else {
        next.add(invoiceId);
      }
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Receiving Invoices</CardTitle>
            <CardDescription>Create invoices by selecting Purchase Order and its GRNs</CardDescription>
          </div>
          {!isFormOpen && (
            <Button onClick={() => setIsFormOpen(true)}>
              <FileText className="mr-2 h-4 w-4" />
              Create Invoice
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Invoice Creation Form Dialog */}
        <Dialog open={isFormOpen} onOpenChange={handleFormOpenChange}>
          <DialogContent className="max-w-6xl w-[96vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Create New Invoice
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={(e) => { e.preventDefault(); handleAddInvoice(); }} className="space-y-6">
              {/* Step 1: Select Vendor */}
              <div className="space-y-2">
                <Label>Step 1: Select Vendor <span className="text-destructive">*</span></Label>
                <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a Vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.length === 0 ? (
                      <SelectItem value="none" disabled>No vendors available</SelectItem>
                    ) : (
                      suppliers.map(supplier => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Step 2: Select PO */}
              {selectedSupplierId && (
                <div className="space-y-2">
                  <Label>Step 2: Select Purchase Order <span className="text-destructive">*</span></Label>
                  <Select value={selectedPoId} onValueChange={setSelectedPoId} disabled={!selectedSupplierId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={selectedSupplierId ? "Select a Purchase Order" : "Select vendor first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {posWithGrns.length === 0 ? (
                        <SelectItem value="none" disabled>No POs with GRNs available for this vendor</SelectItem>
                      ) : (
                        posWithGrns.map(po => (
                          <SelectItem key={po.id} value={po.id}>
                            {po.poNumber}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Step 3: Select GRNs */}
              {selectedPoId && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Step 3: Select GRNs to Include <span className="text-destructive">*</span></Label>
                    {availableGrnsForPO.length > 0 && (
                      <Button type="button" variant="outline" size="sm" onClick={handleSelectAllGrns}>
                        {selectedGrnIds.length === availableGrnsForPO.length ? 'Deselect All' : 'Select All'}
                      </Button>
                    )}
                  </div>

                  {availableGrnsForPO.length === 0 ? (
                    <p className="text-sm text-muted-foreground bg-yellow-50 p-3 rounded border border-yellow-200">
                      No uninvoiced GRNs available for this PO. All GRNs may already have invoices.
                    </p>
                  ) : (
                    <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                      {availableGrnsForPO.map(grn => {
                        const grnTotal = grn.items.reduce((sum, item) => {
                          const poItem = selectedPO?.items.find(pi => pi.articleId === item.articleId);
                          return sum + (item.receivedQuantity * (poItem?.pricePerUnit || 0));
                        }, 0);

                        return (
                          <div key={grn.id} className="flex items-center gap-4 p-3 hover:bg-muted/50">
                            <Checkbox
                              id={`grn-${grn.id}`}
                              checked={selectedGrnIds.includes(grn.id)}
                              onCheckedChange={() => handleGrnToggle(grn.id)}
                            />
                            <label htmlFor={`grn-${grn.id}`} className="flex-1 cursor-pointer">
                              <div className="flex justify-between items-center">
                                <div>
                                  <span className="font-medium">{grn.grnNumber}</span>
                                  <span className="text-sm text-muted-foreground ml-2">
                                    ({grn.items.length} items)
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="font-medium">PKR {grnTotal.toLocaleString()}</span>
                                  {/* Show GRN date and time */}
                                  <span className="text-sm text-muted-foreground ml-2">
                                    {formatDate(grn.receivedAt)}
                                  </span>
                                </div>
                              </div>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Invoice Items with Tax */}
                  {invoiceItems.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <Label className="text-sm font-semibold text-muted-foreground">Invoice Items</Label>
                      <div className="border rounded-lg overflow-x-auto">
                        <Table className="min-w-[980px]">
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="text-xs w-[220px] min-w-[220px]">Article</TableHead>
                              <TableHead className="text-xs">Dimensions</TableHead>
                              <TableHead className="text-xs text-right">No. Thans</TableHead>
                              <TableHead className="text-xs text-right">Qty</TableHead>
                              <TableHead className="text-xs text-right">Rate</TableHead>
                              <TableHead className="text-xs text-right">Total</TableHead>
                              <TableHead className="text-xs text-right">Tax %</TableHead>
                              <TableHead className="text-xs text-right">Tax Amount</TableHead>
                              <TableHead className="text-xs text-right">Line Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {invoiceItems.map((item, idx) => (
                              <TableRow key={item.articleId} className="text-sm">
                                <TableCell className="py-2 font-medium min-w-[220px] whitespace-normal break-words">
                                  {item.articleName}
                                </TableCell>
                                <TableCell className="py-2 text-muted-foreground">{item.dimensions}</TableCell>
                                <TableCell className="py-2 text-right">{item.packages || '-'}</TableCell>
                                <TableCell className="py-2 text-right">{item.quantity}</TableCell>
                                <TableCell className="py-2 text-right">PKR {item.pricePerUnit.toLocaleString()}</TableCell>
                                <TableCell className="py-2 text-right">PKR {item.totalPrice.toLocaleString()}</TableCell>
                                <TableCell className="py-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={item.taxPercent === 0 ? '' : item.taxPercent}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      const taxPercent = value === '' ? 0 : parseFloat(value) || 0;
                                      updateItemTax(item.articleId, taxPercent);
                                    }}
                                    placeholder="0"
                                    className="w-20 text-right"
                                  />
                                </TableCell>
                                <TableCell className="py-2 text-right">PKR {item.taxAmount.toLocaleString()}</TableCell>
                                <TableCell className="py-2 text-right font-medium">PKR {item.lineTotal.toLocaleString()}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="bg-primary/10 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between">
                          <span className="font-medium">Subtotal:</span>
                          <span className="font-medium">PKR {subtotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-medium">Tax:</span>
                          <span className="font-medium">PKR {taxTotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="text-lg font-bold">Grand Total:</span>
                          <span className="text-xl font-bold text-primary">PKR {grandTotal.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Additional Details */}
              {invoiceItems.length > 0 && (
                <div className="space-y-4 pt-4 border-t">
                  <Label className="text-base font-semibold">Step 4: Invoice Details</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Invoice Number</Label>
                      <Input
                        value={`RINV-${Date.now().toString().slice(-8)}`}
                        disabled
                        className="bg-muted"
                      />
                      <p className="text-xs text-muted-foreground">Auto-generated</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Bill No / Ref Name</Label>
                      <Input
                        placeholder="Enter bill number or reference"
                        value={billNo}
                        onChange={e => setBillNo(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Invoice Date <span className="text-destructive">*</span></Label>
                      <AppDatePicker
                        value={date}
                        onChange={setDate}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Input
                        placeholder="Additional notes..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* ── Payment Entries ── */}
                  <div className="space-y-3 pt-2">
                    <Label className="text-sm font-semibold">Payment Entries <span className="text-muted-foreground font-normal">(optional — record payments made now)</span></Label>

                    {/* Add payment row */}
                    <div className="flex gap-2 items-end flex-wrap">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Method</Label>
                        <Select value={newPaymentMethod} onValueChange={(v: 'cash' | 'cheque' | 'online') => setNewPaymentMethod(v)}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="cheque">Cheque</SelectItem>
                            <SelectItem value="online">Online</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Amount (PKR)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0"
                          value={newPaymentAmount}
                          onChange={e => setNewPaymentAmount(e.target.value)}
                          className="w-36"
                        />
                      </div>
                      <div className="space-y-1 flex-1">
                        <Label className="text-xs text-muted-foreground">Reference / Cheque No.</Label>
                        <Input
                          placeholder="Reference"
                          value={newPaymentRef}
                          onChange={e => setNewPaymentRef(e.target.value)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const amt = parseFloat(newPaymentAmount);
                          if (!amt || amt <= 0) return;

                          const currentTotal = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
                          if (currentTotal + amt > grandTotal) {
                            toast({
                              title: "Amount Exceeds Total",
                              description: `Adding PKR ${amt.toLocaleString()} would exceed the invoice total of PKR ${grandTotal.toLocaleString()}.`,
                              variant: "destructive"
                            });
                            return;
                          }

                          setPayments(prev => [...prev, { method: newPaymentMethod, amount: newPaymentAmount, reference: newPaymentRef }]);
                          setNewPaymentAmount('');
                          setNewPaymentRef('');
                        }}
                      >
                        + Add
                      </Button>
                    </div>

                    {/* Payment list */}
                    {payments.length > 0 && (
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left p-2 font-medium">Method</th>
                              <th className="text-right p-2 font-medium">Amount</th>
                              <th className="text-left p-2 font-medium">Reference</th>
                              <th className="p-2"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {payments.map((p, i) => (
                              <tr key={i} className="border-t">
                                <td className="p-2 capitalize">{p.method}</td>
                                <td className="p-2 text-right font-medium">PKR {parseFloat(p.amount).toLocaleString()}</td>
                                <td className="p-2 text-muted-foreground">{p.reference || '-'}</td>
                                <td className="p-2 text-right">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive h-7 px-2"
                                    onClick={() => setPayments(prev => prev.filter((_, idx) => idx !== i))}
                                  >
                                    ✕
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div className="bg-muted/30 px-3 py-2 flex justify-between text-sm border-t">
                          <span>Total Paid:</span>
                          <span className={`font-bold ${payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0) > grandTotal ? 'text-destructive' : 'text-primary'}`}>
                            PKR {payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0).toLocaleString()}
                            {' '}/{' '}PKR {grandTotal.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-12 text-lg font-semibold"
                      onClick={handleCloseForm}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="w-full h-12 text-lg font-semibold">
                      <FileText className="mr-2 h-5 w-5" />
                      Generate Invoice (PKR {grandTotal.toLocaleString()})
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </DialogContent>
        </Dialog>

        {/* Invoice Preview Dialog */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Invoice Preview</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handlePrint}>
                    <Printer className="h-4 w-4 mr-2" />
                    Print
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDownload}>
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                </div>
              </DialogTitle>
            </DialogHeader>

            {previewInvoice && (
              <div ref={printRef} className="page bg-white text-[#1a1a2e]" style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}>

                {/* ── Header ── */}
                <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '24px', borderBottom: '3px solid #1a1a2e', marginBottom: '32px' }}>
                  <div>
                    <div className="company-name" style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.5px' }}>Textile ERP</div>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>Receiving Invoice Management</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '28px', fontWeight: 700, color: '#1a1a2e', letterSpacing: '2px' }}>INVOICE</div>
                    <div style={{ fontSize: '13px', color: '#666', marginTop: '4px', fontFamily: 'monospace' }}>{previewInvoice.invoiceNumber}</div>
                    <span style={{ display: 'inline-block', background: '#e8f4fd', color: '#1a73e8', padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, textTransform: 'capitalize', marginTop: '6px' }}>
                      {previewInvoice.paymentTerms || 'N/A'}
                    </span>
                  </div>
                </div>

                {/* ── Info Grid ── */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '32px' }}>
                  {/* Left: Bill To */}
                  <div>
                    <h4 style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#888', marginBottom: '8px' }}>Bill To (Supplier)</h4>
                    <p style={{ fontSize: '17px', fontWeight: 700, color: '#1a1a2e' }}>{previewInvoice.supplier?.name || getSupplierName(previewInvoice.supplierId)}</p>
                    <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                      PO: <strong>{previewInvoice.purchaseOrder?.poNumber || getPoNumber(previewInvoice.poId)}</strong>
                    </p>
                    <p style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                      GRN(s): <strong>{previewInvoice.grnInvoices?.map(gi => gi.grn?.grnNumber || 'N/A').join(', ') || (previewInvoice as ExtendedReceivingInvoice).grnIds?.map((id: string) => grns.find(g => g.id === id)?.grnNumber || 'N/A').join(', ') || 'N/A'}</strong>
                    </p>
                  </div>
                  {/* Right: Invoice Details */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ marginBottom: '10px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#888' }}>Invoice Date</span>
                      <p style={{ fontSize: '14px', fontWeight: 600, marginTop: '2px' }}>{formatDate(previewInvoice.date)}</p>
                    </div>
                    {previewInvoice.billNo && (
                      <div style={{ marginBottom: '10px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#888' }}>Bill / Ref No</span>
                        <p style={{ fontSize: '14px', fontWeight: 600, marginTop: '2px' }}>{previewInvoice.billNo}</p>
                      </div>
                    )}
                    {previewInvoice.dueDate && (
                      <div style={{ marginBottom: '10px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#888' }}>Due Date</span>
                        <p style={{ fontSize: '14px', fontWeight: 600, marginTop: '2px' }}>{formatDate(previewInvoice.dueDate)}</p>
                      </div>
                    )}
                    <div>
                      <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#888' }}>Remaining Balance</span>
                      <p style={{ fontSize: '14px', fontWeight: 800, marginTop: '2px', color: '#c0392b' }}>
                        PKR {Math.abs((getInvoiceItems(previewInvoice).previousBalance || 0) + previewInvoice.totalAmount).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>



                {/* ── Items Table ── */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#1a1a2e', color: '#fff' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>#</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Article</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dimensions</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Thans</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Qty</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rate</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Amount</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tax</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getInvoiceItems(previewInvoice).items.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0', background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                        <td style={{ padding: '10px 12px', color: '#999', fontSize: '12px' }}>{idx + 1}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{item.articleName}</td>
                        <td style={{ padding: '10px 12px', color: '#666', fontSize: '12px' }}>{item.dimensions || '—'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{item.packages || '—'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{item.quantity}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>PKR {item.price.toLocaleString()}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>PKR {item.total.toLocaleString()}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#666' }}>{item.taxPercent || 0}% = PKR {(item.taxAmount || 0).toLocaleString()}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>PKR {(item.lineTotal || item.total).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* ── Payments Made ── */}
                {(previewInvoice as ExtendedReceivingInvoice)._tempPayments && (
                  <div style={{ marginBottom: '24px' }}>
                    <h4 style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#666', marginBottom: '8px' }}>Payments Recorded</h4>
                    <table style={{ width: '400px', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <tbody>
                        {(previewInvoice as ExtendedReceivingInvoice)._tempPayments?.map((p: { method: string; reference?: string; amount: string | number }, idx: number) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <td style={{ padding: '6px 0', color: '#666', textTransform: 'capitalize' }}>{p.method}</td>
                            <td style={{ padding: '6px 0', color: '#999' }}>{p.reference || ''}</td>
                            <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>PKR {parseFloat(p.amount.toString()).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* ── Totals ── */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px' }}>
                  <div style={{ width: '300px', border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', fontSize: '13px', borderBottom: '1px solid #f0f0f0' }}>
                      <span style={{ color: '#666' }}>Subtotal</span>
                      <span style={{ fontWeight: 600 }}>PKR {previewInvoice.amount.toLocaleString()}</span>
                    </div>
                    {previewInvoice.taxAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', fontSize: '13px', borderBottom: '1px solid #f0f0f0' }}>
                        <span style={{ color: '#666' }}>Tax</span>
                        <span style={{ fontWeight: 600 }}>PKR {previewInvoice.taxAmount.toLocaleString()}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', fontSize: '16px', background: '#1a1a2e', color: '#fff', fontWeight: 700 }}>
                      <span>Grand Total</span>
                      <span>PKR {previewInvoice.totalAmount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* ── Notes ── */}
                {previewInvoice.notes && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '12px 16px', marginBottom: '32px', fontSize: '13px' }}>
                    <strong style={{ display: 'block', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#92400e' }}>Notes</strong>
                    {previewInvoice.notes}
                  </div>
                )}

                {/* ── Footer ── */}
                <div style={{ borderTop: '1px solid #e8e8e8', paddingTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '11px', color: '#aaa' }}>
                    Generated on {formatDate(new Date())}
                  </div>
                  <div style={{ fontSize: '11px', color: '#aaa', textAlign: 'right' }}>
                    This is a computer-generated invoice.<br />No signature required.
                  </div>
                </div>

              </div>
            )}

          </DialogContent>
        </Dialog>

        {/* Existing Invoices Table */}
        <div>
          <div className="mb-4">
            <Input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice Number</TableHead>
                <TableHead>Bill No</TableHead>
                <TableHead>PO Number</TableHead>
                <TableHead>GRNs</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Transaction Date</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total Amount</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    {searchQuery ? 'No invoices match your search' : 'No invoices yet'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map(inv => {
                  const invoiceItemDetails = getInvoiceItems(inv).items;
                  // Default expanded; track only manually collapsed rows.
                  const isInvoiceItemsExpanded = invoiceItemDetails.length > 0 && !expandedInvoiceItems.has(inv.id);
                  const invoiceGrnIds = inv.grnInvoices?.map(gi => gi.grnId) || (inv as ExtendedReceivingInvoice).grnIds || [];
                  const warehouseNames = Array.from(
                    new Set(
                      invoiceGrnIds
                        .map(grnId => {
                          const grn = grns.find(g => g.id === grnId);
                          return grn?.warehouse?.name || '';
                        })
                        .filter(Boolean)
                    )
                  );
                  const warehouseDisplay = warehouseNames.length === 0
                    ? '-'
                    : warehouseNames.length === 1
                      ? warehouseNames[0]
                      : `${warehouseNames[0]} +${warehouseNames.length - 1}`;

                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                      <TableCell>{inv.billNo || '-'}</TableCell>
                      <TableCell>{inv.purchaseOrder?.poNumber || getPoNumber(inv.poId)}</TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {inv.grnInvoices?.length || (inv as ExtendedReceivingInvoice).grnIds?.length || 0} GRN(s)
                        </span>
                      </TableCell>
                      <TableCell>{warehouseDisplay}</TableCell>
                      <TableCell>{inv.supplier?.name || getSupplierName(inv.supplierId)}</TableCell>
                      <TableCell>{formatDate(inv.date)}</TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => toggleInvoiceItemsDropdown(inv.id)}
                            disabled={invoiceItemDetails.length === 0}
                            aria-expanded={isInvoiceItemsExpanded}
                            aria-label={`Toggle items list for ${inv.invoiceNumber}`}
                          >
                            <span className="mr-1">{invoiceItemDetails.length} items</span>
                            {isInvoiceItemsExpanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                          <div
                            className={`overflow-hidden transition-all duration-300 ease-in-out ${isInvoiceItemsExpanded && invoiceItemDetails.length > 0 ? 'max-h-44 opacity-100' : 'max-h-0 opacity-0'}`}
                          >
                            <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/30 p-2 text-xs">
                              <ul className="space-y-1">
                                {invoiceItemDetails.map((item, idx) => (
                                  <li
                                    key={`${inv.id}-item-${idx}`}
                                    className="space-y-1 border-b border-border/40 pb-2 last:border-0 last:pb-0"
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="truncate font-medium">{item.articleName}</span>
                                      <span className="shrink-0 text-muted-foreground">
                                        {item.quantity}
                                      </span>
                                    </div>
                                    <p className="pl-0.5 text-[11px] leading-snug text-muted-foreground">
                                      Dimensions: {item.dimensions || '-'} | Thans: {item.packages || '-'}
                                    </p>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>PKR {inv.totalAmount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            // Find any payments in the ledger that match this invoice
                            const relatedPayments = ledgerData.filter(
                              (entry) =>
                                entry.entryType === 'debit' &&
                                entry.referenceType === 'payment' &&
                                entry.notes?.includes(inv.invoiceNumber)
                            ).map(entry => ({
                              method: entry.paymentMethod || 'cash',
                              amount: entry.amount.toString(),
                              reference: entry.referenceNumber || ''
                            }));

                            setPreviewInvoice({
                              ...inv,
                              _tempPayments: relatedPayments.length > 0 ? relatedPayments : undefined
                            } as ExtendedReceivingInvoice);
                            setIsPreviewOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card >
  );
};

export default ReceivingInvoiceModule;

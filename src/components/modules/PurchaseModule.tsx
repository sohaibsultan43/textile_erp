import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useReactToPrint } from 'react-to-print';
import { UserRole, PurchaseOrder, PurchaseOrderItem, Supplier, Article, GRN, GRNItem, StockItem, Location } from '@/types';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { purchaseOrderApi, grnApi, vendorApi, articleApi, stockApi, locationApi } from '@/lib/api';
import { formatArticleReedPickLine, formatPoItemReedPickLine } from '@/lib/poItemReedPick';
import { cn, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { AppDatePicker } from '@/components/ui/app-date-picker';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, FileText, Building2, Palette, Package, Factory, Eye, ChevronDown, ChevronUp, AlertTriangle, Printer, Edit2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ReceivingInvoiceModule from './ReceivingInvoiceModule';

interface PurchaseModuleProps {
  userRole: UserRole;
  userId: string;
}

export const PurchaseModule = ({ userRole, userId }: PurchaseModuleProps) => {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [grns, setGrns] = useState<GRN[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [warehouses, setWarehouses] = useState<Location[]>([]);

  const [isPoDialogOpen, setIsPoDialogOpen] = useState(false);
  const [isGrnDialogOpen, setIsGrnDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [grnSearchQuery, setGrnSearchQuery] = useState('');
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null);
  const [viewingGRN, setViewingGRN] = useState<GRN | null>(null);
  const [editingPOId, setEditingPOId] = useState<string | null>(null);

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrintPO = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Purchase_Order_${viewingPO?.poNumber || ''}`,
  });

  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10)); // yyyy-mm-dd
  const [poItems, setPoItems] = useState<PurchaseOrderItem[]>([]); // Existing state
  const [selectedArticleId, setSelectedArticleId] = useState(''); // Existing state
  const [quantity, setQuantity] = useState(''); // Existing state
  const [pricePerUnit, setPricePerUnit] = useState(''); // Existing state
  const [yarnCount, setYarnCount] = useState(''); // Reed Pick - Count (e.g. 40x40)
  const [composition, setComposition] = useState(''); // Composition (e.g. 80:20)
  const [constraction, setConstraction] = useState(''); // Construction (e.g. 112/90)
  const [width, setWidth] = useState(''); // Width (e.g. 50")
  const [unit, setUnit] = useState(''); // New state for unit
  const [poNotes, setPoNotes] = useState('');
  const [promiseDeliveryDays, setPromiseDeliveryDays] = useState('');

  const [selectedPoForGrn, setSelectedPoForGrn] = useState('');
  const [grnItems, setGrnItems] = useState<GRNItem[]>([]);
  const [grnNotes, setGrnNotes] = useState('');
  const [grnSupplierId, setGrnSupplierId] = useState('');
  const [grnWarehouseId, setGrnWarehouseId] = useState('');
  const [grnDate, setGrnDate] = useState(() => new Date().toISOString().slice(0, 10)); // yyyy-mm-dd
  const [isCreatingGRN, setIsCreatingGRN] = useState(false);
  const [formTouched, setFormTouched] = useState(false);
  const [expandedScheduleItems, setExpandedScheduleItems] = useState<Set<number>>(new Set());
  const [expandedPoItems, setExpandedPoItems] = useState<Set<string>>(new Set());
  const [expandedGrnItems, setExpandedGrnItems] = useState<Set<string>>(new Set());


  const { toast } = useToast();

  const loadData = useCallback(async () => {
    try {
      const [apiPOs, apiGRNs, apiSuppliers, apiArticles, apiLocations] = await Promise.all([
        purchaseOrderApi.getAll(),
        grnApi.getAll(),
        vendorApi.getAll(),
        articleApi.getAll(),
        locationApi.getAll(),
      ]);
      setPurchaseOrders(apiPOs);
      setGrns(apiGRNs);
      setSuppliers(apiSuppliers);
      setArticles(apiArticles);
      setWarehouses(apiLocations.filter(loc => loc.type === 'godown'));
    } catch (error) {
      console.error('Error loading data:', error);
      toast({ title: 'Error', description: 'Failed to load data. Please check your connection and try again.', variant: 'destructive' });
      setPurchaseOrders([]);
      setGrns([]);
      setSuppliers([]);
      setArticles([]);
      setWarehouses([]);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const canCreatePO = ['owner', 'purchase_officer'].includes(userRole);
  const canCreateGRN = ['owner', 'warehouse', 'purchase_officer'].includes(userRole);

  // Get selected supplier details
  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);
  const supplierCategory = selectedSupplier?.category;
  const grnSupplier = suppliers.find(s => s.id === grnSupplierId);

  // Filter articles based on vendor category
  const getFilteredArticles = () => {
    if (!supplierCategory) return articles;

    switch (supplierCategory) {
      case 'supplier': {
        // Supplier sells grey material - but show all if none exist
        const greyMaterials = articles.filter(a => a.category === 'grey_material');
        return greyMaterials.length > 0 ? greyMaterials : articles;
      }
      case 'packaging': {
        // Packaging vendor sells packaging materials - but show all if none exist
        const packagingMaterials = articles.filter(a => a.category === 'packaging_material');
        return packagingMaterials.length > 0 ? packagingMaterials : articles;
      }
      case 'dyeing': {
        // Dyeing is a service - show service items or grey material for processing
        const dyeingArticles = articles.filter(a => a.category === 'service_item' || a.category === 'grey_material');
        return dyeingArticles.length > 0 ? dyeingArticles : articles;
      }
      default:
        return articles;
    }
  };

  const filteredArticles = getFilteredArticles();

  // Get vendor category icon and label
  const getVendorCategoryInfo = (category?: string) => {
    switch (category) {
      case 'supplier':
        return { icon: <Building2 className="h-4 w-4" />, label: 'Supplier', color: 'bg-blue-100 text-blue-800' };
      case 'dyeing':
        return { icon: <Palette className="h-4 w-4" />, label: 'Dyeing Service', color: 'bg-purple-100 text-purple-800' };
      case 'packaging':
        return { icon: <Package className="h-4 w-4" />, label: 'Packaging', color: 'bg-green-100 text-green-800' };
      default:
        return { icon: <Factory className="h-4 w-4" />, label: 'Other', color: 'bg-gray-100 text-gray-800' };
    }
  };

  // Purchase Order Functions
  const addItemToPO = () => {
    if (!selectedArticleId || !quantity || !pricePerUnit) {
      toast({ title: "Error", description: "Please fill all item fields", variant: "destructive" });
      return;
    }

    const qty = parseFloat(quantity);
    const price = parseFloat(pricePerUnit);

    // Validate that quantity and price are valid numbers greater than 0
    if (isNaN(qty) || qty <= 0) {
      toast({ title: "Error", description: "Quantity must be greater than 0", variant: "destructive" });
      return;
    }

    if (isNaN(price) || price <= 0) {
      toast({ title: "Error", description: "Price per unit must be greater than 0", variant: "destructive" });
      return;
    }

    const newItem: PurchaseOrderItem = {
      articleId: selectedArticleId,
      quantity: qty,
      pricePerUnit: price,
      totalPrice: qty * price,
      yarnCount: yarnCount || undefined,
      composition: composition || undefined,
      constraction: constraction || undefined,
      width: width || undefined,
      unit: unit, // Updated to use the new state directly
      deliverySchedules: [], // Initialize with empty schedules array
    };

    setPoItems([...poItems, newItem]);
    setSelectedArticleId('');
    setQuantity('');
    setPricePerUnit('');
    setYarnCount('');
    setComposition('');
    setConstraction('');
    setWidth('');
    setUnit('');
  };

  const updatePoItem = (index: number, field: keyof PurchaseOrderItem, value: string | number) => {
    const updatedItems = [...poItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };

    if (field === 'quantity' || field === 'pricePerUnit') {
      const qty = parseFloat(updatedItems[index].quantity as unknown as string) || 0;
      const price = parseFloat(updatedItems[index].pricePerUnit as unknown as string) || 0;
      updatedItems[index].totalPrice = qty * price;
    }

    setPoItems(updatedItems);
  };

  const removeItemFromPO = (index: number) => {
    setPoItems(poItems.filter((_, i) => i !== index));
    // Remove from expanded items if it was expanded
    const newExpanded = new Set(expandedScheduleItems);
    newExpanded.delete(index);
    setExpandedScheduleItems(newExpanded);
  };

  const toggleScheduleExpansion = (index: number) => {
    const newExpanded = new Set(expandedScheduleItems);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedScheduleItems(newExpanded);
  };

  const addScheduleRow = (itemIndex: number) => {
    const updatedItems = [...poItems];
    const currentItem = updatedItems[itemIndex];
    const currentScheduledQty = getScheduledQuantity(currentItem);

    if (currentScheduledQty >= currentItem.quantity) {
      toast({
        title: 'Error',
        description: 'Schedule quantity cannot exceed the item quantity.',
        variant: 'destructive',
      });
      return;
    }

    if (!updatedItems[itemIndex].deliverySchedules) {
      updatedItems[itemIndex].deliverySchedules = [];
    }
    updatedItems[itemIndex].deliverySchedules!.push({
      id: `temp-${Date.now()}-${Math.random()}`,
      purchaseOrderItemId: '',
      quantity: Math.max(0, currentItem.quantity - currentScheduledQty),
      pickDate: new Date().toISOString().split('T')[0],
    });
    setPoItems(updatedItems);
  };

  const removeScheduleRow = (itemIndex: number, scheduleIndex: number) => {
    const updatedItems = [...poItems];
    if (updatedItems[itemIndex].deliverySchedules) {
      updatedItems[itemIndex].deliverySchedules = updatedItems[itemIndex].deliverySchedules!.filter((_, i) => i !== scheduleIndex);
      setPoItems(updatedItems);
    }
  };

  const updateScheduleRow = (itemIndex: number, scheduleIndex: number, field: 'quantity' | 'pickDate', value: string | number) => {
    const updatedItems = [...poItems];
    if (updatedItems[itemIndex].deliverySchedules && updatedItems[itemIndex].deliverySchedules![scheduleIndex]) {
      if (field === 'quantity') {
        const currentItem = updatedItems[itemIndex];
        const currentSchedule = updatedItems[itemIndex].deliverySchedules![scheduleIndex];
        const otherSchedulesTotal = getScheduledQuantity(currentItem) - (currentSchedule.quantity || 0);
        const remainingQty = Math.max(currentItem.quantity - otherSchedulesTotal, 0);
        const nextQty = Math.min(Math.max(Number(value) || 0, 0), remainingQty);

        if ((Number(value) || 0) > remainingQty) {
          toast({
            title: 'Warning',
            description: `Schedule quantity cannot exceed remaining quantity (${remainingQty}).`,
          });
        }

        updatedItems[itemIndex].deliverySchedules![scheduleIndex] = {
          ...currentSchedule,
          quantity: nextQty,
        };
        setPoItems(updatedItems);
        return;
      }

      updatedItems[itemIndex].deliverySchedules![scheduleIndex] = {
        ...updatedItems[itemIndex].deliverySchedules![scheduleIndex],
        [field]: value,
      };
      setPoItems(updatedItems);
    }
  };

  const getScheduledQuantity = (item: PurchaseOrderItem): number => {
    return item.deliverySchedules?.reduce((sum, schedule) => sum + (schedule.quantity || 0), 0) || 0;
  };

  const togglePoItemsDropdown = (poId: string) => {
    setExpandedPoItems(prev => {
      const next = new Set(prev);
      if (next.has(poId)) {
        next.delete(poId);
      } else {
        next.add(poId);
      }
      return next;
    });
  };

  const toggleGrnItemsDropdown = (grnId: string) => {
    setExpandedGrnItems(prev => {
      const next = new Set(prev);
      if (next.has(grnId)) {
        next.delete(grnId);
      } else {
        next.add(grnId);
      }
      return next;
    });
  };

  const handleCreatePO = async () => {
    setFormTouched(true);

    if (!selectedSupplierId || !promiseDeliveryDays || poItems.length === 0) {
      toast({ title: "Error", description: "Please fill all required fields and add items", variant: "destructive" });
      return;
    }

    const invalidScheduleItem = poItems.find(item => getScheduledQuantity(item) > item.quantity);
    if (invalidScheduleItem) {
      toast({
        title: 'Error',
        description: 'Delivery schedule quantity cannot exceed the item quantity.',
        variant: 'destructive',
      });
      return;
    }

    const totalAmount = poItems.reduce((sum, item) => sum + item.totalPrice, 0);

    try {
      // Format items with delivery schedules
      const formattedItems = poItems.map(item => ({
        ...item,
        deliverySchedules: item.deliverySchedules?.filter(schedule => schedule.quantity > 0 && schedule.pickDate).map(schedule => ({
          quantity: schedule.quantity,
          pickDate: schedule.pickDate.split('T')[0], // Ensure date is in YYYY-MM-DD format
        })) || [],
      }));

      if (editingPOId) {
        await purchaseOrderApi.update(editingPOId, {
          supplierId: selectedSupplierId,
          transactionDate: orderDate,
          totalAmount,
          promiseDeliveryDays: parseInt(promiseDeliveryDays) || 0,
          notes: poNotes,
          items: formattedItems as unknown as PurchaseOrderItem[],
        });
        toast({ title: "Success", description: `Purchase Order updated successfully` });
      } else {
        await purchaseOrderApi.create({
          supplierId: selectedSupplierId,
          transactionDate: orderDate,
          totalAmount,
          promiseDeliveryDays: parseInt(promiseDeliveryDays) || 0,
          status: 'pending',
          notes: poNotes,
          items: formattedItems as unknown as PurchaseOrderItem[],
          createdBy: userId,
        });
        toast({ title: "Success", description: `Purchase Order created successfully` });
      }

      resetPOForm();
      setFormTouched(false);
      setIsPoDialogOpen(false);
      await loadData();
    } catch (error) {
      console.error('Error creating purchase order:', error);
      toast({ title: "Error", description: "Failed to create purchase order", variant: "destructive" });
    }
  };

  const resetPOForm = () => {
    setSelectedSupplierId('');
    setPoItems([]);
    setPoNotes('');
    setPromiseDeliveryDays('');
    setOrderDate(new Date().toISOString().slice(0, 10));
    setYarnCount('');
    setComposition('');
    setConstraction('');
    setWidth('');
    setUnit('');
    setExpandedScheduleItems(new Set());
    setFormTouched(false);
    setEditingPOId(null);
  };

  const handleEditPOClick = (po: PurchaseOrder) => {
    setEditingPOId(po.id);
    setSelectedSupplierId(po.supplierId);
    setPromiseDeliveryDays(po.promiseDeliveryDays.toString());
    setPoNotes(po.notes || '');
    setOrderDate(new Date(po.transactionDate || po.createdAt).toISOString().slice(0, 10));
    setPoItems(
      po.items.map(mapped => ({
        ...mapped,
        deliverySchedules: (mapped.deliverySchedules || []).map(schedule => ({ ...schedule })),
      }))
    ); // Prevent direct mutations
    setExpandedScheduleItems(new Set(po.items.map((_, index) => index)));
    setIsPoDialogOpen(true);
    setViewingPO(null); // Close view dialog
  };

  // Auto-populate delivery days when supplier changes
  const handleSupplierChange = (supplierId: string) => {
    setSelectedSupplierId(supplierId);
    const supplier = suppliers.find(s => s.id === supplierId);
    if (supplier) {
      setPromiseDeliveryDays(supplier.paymentTerms?.toString() || '');
    }
  };

  // GRN Functions
  const handleSelectPoForGrn = (poId: string) => {
    setSelectedPoForGrn(poId);
    const po = purchaseOrders.find(p => p.id === poId);
    if (po) {
      setGrnSupplierId(po.supplierId);
      const items: GRNItem[] = po.items.map(item => {
        const article = articles.find(a => a.id === item.articleId);
        return {
          articleId: item.articleId,
          orderedQuantity: item.quantity,
          receivedQuantity: 0,
          acceptedQuantity: 0,
          rejectedQuantity: 0,
          packages: 0,
          unit: article?.unit || item.unit || '',
        };
      });
      setGrnItems(items);
    }
  };

  const updateGrnItem = (index: number, field: keyof GRNItem, value: number | string) => {
    const updated = [...grnItems];
    updated[index] = { ...updated[index], [field]: value };
    setGrnItems(updated);
  };

  const handleCreateGRN = async () => {
    if (isCreatingGRN) return;
    if (!selectedPoForGrn || !grnWarehouseId || grnItems.length === 0) {
      toast({ title: "Error", description: "Please select PO, warehouse, and enter received quantities", variant: "destructive" });
      return;
    }

    const hasReceived = grnItems.some(item => item.receivedQuantity > 0);
    if (!hasReceived) {
      toast({ title: "Error", description: "Enter received quantity for at least one item", variant: "destructive" });
      return;
    }

    const invalidReceived = grnItems.find(item => item.receivedQuantity < 0);
    if (invalidReceived) {
      toast({ title: "Error", description: "Received quantity cannot be negative", variant: "destructive" });
      return;
    }

    const po = purchaseOrders.find(p => p.id === selectedPoForGrn);
    if (!po) return;

    setIsCreatingGRN(true);
    try {
      const receivedItems = grnItems.filter(item => item.receivedQuantity > 0);
      const idempotencyKey = `grn-${selectedPoForGrn}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const newGRN = await grnApi.create({
        poId: selectedPoForGrn,
        supplierId: po.supplierId,
        warehouseId: grnWarehouseId || undefined,
        items: receivedItems,
        receivedBy: userId,
        receivedAt: new Date(grnDate).toISOString(),
        status: 'pending',
        notes: grnNotes,
      }, { idempotencyKey });

      toast({ title: "Success", description: "GRN created successfully" });
      resetGrnForm();
      setIsGrnDialogOpen(false);
      await loadData();
    } catch (error) {
      console.error('Error creating GRN:', error);
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to create GRN", variant: "destructive" });
    } finally {
      setIsCreatingGRN(false);
    }
  };

  const resetGrnForm = () => {
    setSelectedPoForGrn('');
    setGrnItems([]);
    setGrnNotes('');
    setGrnSupplierId('');
    setGrnWarehouseId('');
    setGrnDate(new Date().toISOString().slice(0, 10));
  };

  const getPreviouslyReceivedForPO = (poId: string) => {
    const receivedMap: Record<string, number> = {};
    grns
      .filter(grn => grn.poId === poId)
      .forEach(grn => {
        grn.items.forEach(item => {
          receivedMap[item.articleId] = (receivedMap[item.articleId] || 0) + (item.receivedQuantity || 0);
        });
      });
    return receivedMap;
  };

  const hasRemainingReceivableQty = (po: PurchaseOrder) => {
    const totalOrdered = po.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const totalReceived = grns
      .filter(grn => grn.poId === po.id && grn.status !== 'cancelled')
      .reduce(
        (sum, grn) =>
          sum +
          grn.items.reduce((itemSum, item) => itemSum + (Number(item.receivedQuantity) || 0), 0),
        0
      );

    return totalOrdered - totalReceived > 0;
  };


  const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.name || 'Unknown';
  const getSupplierCategory = (id: string) => suppliers.find(s => s.id === id)?.category;
  const getArticleName = (id: string) => articles.find(a => a.id === id)?.name || 'Unknown';
  const getArticleUnit = (id: string) => articles.find(a => a.id === id)?.unit || '-';

  const getWarehouseName = (id?: string) => {
    if (!id) return 'N/A';
    const warehouse = warehouses.find(w => w.id === id);
    return warehouse ? `${warehouse.code} - ${warehouse.name}` : 'Unknown';
  };

  // Filter purchase orders based on search query
  const filteredPurchaseOrders = purchaseOrders.filter(po => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const supplierName = getSupplierName(po.supplierId).toLowerCase();
    const poNumber = po.poNumber.toLowerCase();
    const status = po.status.toLowerCase();
    const date = formatDate(po.transactionDate || po.createdAt).toLowerCase();
    const vendorType = getSupplierCategory(po.supplierId)?.toLowerCase() || '';

    // Search in items
    const itemsMatch = po.items.some(item => {
      const article = articles.find(a => a.id === item.articleId);
      const reedPickLabel = formatPoItemReedPickLine(item).toLowerCase();
      const qtyStr = String(item.quantity);
      return (article?.name?.toLowerCase() || '').includes(query) || reedPickLabel.includes(query) || qtyStr.includes(query);
    });

    return poNumber.includes(query) ||
      supplierName.includes(query) ||
      status.includes(query) ||
      date.includes(query) ||
      vendorType.includes(query) ||
      itemsMatch;
  });

  // Filter GRNs based on search query
  const filteredGrns = grns.filter(grn => {
    if (grn.status !== 'confirmed') return false;
    if (!grnSearchQuery.trim()) return true;

    const query = grnSearchQuery.toLowerCase();
    const supplierName = getSupplierName(grn.supplierId).toLowerCase();
    const grnNumber = grn.grnNumber.toLowerCase();
    const status = grn.status.toLowerCase();
    // Include both date and time in GRN search
    const date = formatDate(grn.receivedAt).toLowerCase();
    const po = purchaseOrders.find(p => p.id === grn.poId);
    const poNumber = po?.poNumber?.toLowerCase() || '';

    // Search in items
    const itemsMatch = grn.items.some(item => {
      const article = articles.find(a => a.id === item.articleId);
      const originalPoItem = po?.items.find(poi => poi.articleId === item.articleId);
      const reedPickLabel = originalPoItem ? formatPoItemReedPickLine(originalPoItem).toLowerCase() : '';
      const qtyStr = String(item.receivedQuantity);
      return (article?.name?.toLowerCase() || '').includes(query) || reedPickLabel.includes(query) || qtyStr.includes(query);
    });

    return grnNumber.includes(query) ||
      poNumber.includes(query) ||
      supplierName.includes(query) ||
      status.includes(query) ||
      date.includes(query) ||
      itemsMatch;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      approved: "default",
      partially_received: "secondary",
      complete: "default",
      cancelled: "destructive",
    };
    const displayText = status.replace('_', ' ').toUpperCase();
    return <Badge variant={variants[status] || "default"}>{displayText}</Badge>;
  };

  // Note: PO status updates are handled by the backend when GRNs are created

  return (
    <div className="space-y-6">
      <Tabs defaultValue="purchase-orders" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="purchase-orders">🟩 Purchase Orders</TabsTrigger>
          <TabsTrigger value="grns">📦 Goods Receipt</TabsTrigger>
          <TabsTrigger value="receiving-invoice">🧾 Receiving Invoice</TabsTrigger>
        </TabsList>

        {/* Purchase Orders Tab */}
        <TabsContent value="purchase-orders">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Purchase Orders</CardTitle>
                  <CardDescription>Create and manage purchase orders for raw materials</CardDescription>
                </div>
                {canCreatePO && (
                  <Dialog open={isPoDialogOpen} onOpenChange={(open) => { setIsPoDialogOpen(open); if (!open) setFormTouched(false); }}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        New Purchase Order
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto w-[95vw]">
                      <DialogHeader>
                        <DialogTitle className="text-xl">Create Purchase Order</DialogTitle>
                        <DialogDescription>
                          Enter supplier, transaction date, and item details to create a purchase order.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        {/* Vendor Selection Section */}
                        <div className="bg-white rounded-2xl shadow p-4 space-y-4 border border-muted">
                          {/* Vendor Selection Section */}
                          <div className="mb-3">
                            <h3 className="font-semibold text-sm flex items-center gap-2 mb-2">
                              <Building2 className="h-4 w-4 text-primary" />
                              Vendor Selection
                            </h3>
                            <div className="flex flex-col md:flex-row gap-3 items-end">
                              <div className="w-full md:w-1/2">
                                <Label className="text-sm">Select Vendor <span className="text-destructive">*</span></Label>
                                <Select value={selectedSupplierId} onValueChange={handleSupplierChange}>
                                  <SelectTrigger className="bg-background h-12 w-full min-w-[260px]">
                                    <SelectValue placeholder="Choose a vendor" className="truncate" />
                                  </SelectTrigger>
                                  <SelectContent className="min-w-[260px]">
                                    {suppliers.map(supplier => {
                                      const categoryInfo = getVendorCategoryInfo(supplier.category);
                                      return (
                                        <SelectItem key={supplier.id} value={supplier.id} className="truncate">
                                          <div className="flex items-center gap-2 min-w-0">
                                            {categoryInfo.icon}
                                            <span className="font-medium truncate max-w-[140px]">{supplier.name}</span>
                                            <Badge variant="secondary" className="text-xs whitespace-nowrap">
                                              {categoryInfo.label}
                                            </Badge>
                                          </div>
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                                {formTouched && !selectedSupplierId && <span className="text-xs text-destructive">Vendor is required</span>}
                              </div>
                            </div>
                            {selectedSupplier && (
                              <div className="flex items-center gap-2 pt-2 border-t mt-3">
                                <span className="text-sm text-muted-foreground">Vendor Type:</span>
                                <Badge className={getVendorCategoryInfo(supplierCategory).color}>
                                  {getVendorCategoryInfo(supplierCategory).icon}
                                  <span className="ml-1">{getVendorCategoryInfo(supplierCategory).label}</span>
                                </Badge>
                                {supplierCategory === 'dyeing' && (
                                  <span className="text-xs text-muted-foreground ml-2">
                                    (Job work - send material for processing)
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Order Details Section */}
                          <div>
                            <h3 className="font-semibold text-sm flex items-center gap-2 mb-2">
                              <FileText className="h-4 w-4 text-primary" />
                              Order Details
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="flex flex-col gap-1 w-full">
                                <Label className="text-sm">Transaction Date <span className="text-destructive">*</span></Label>
                                <AppDatePicker
                                  className="bg-background h-12 w-full"
                                  value={orderDate}
                                  onChange={setOrderDate}
                                />
                                {!orderDate && <span className="text-xs text-destructive">Transaction date is required</span>}
                              </div>

                              <div className="flex flex-col gap-1 w-full">
                                <Label className="text-sm">Delivery Days <span className="text-destructive">*</span></Label>
                                <Input
                                  className="bg-background h-12 w-full"
                                  type="number"
                                  min="0"
                                  value={promiseDeliveryDays}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '' || parseInt(value) >= 0) {
                                      setPromiseDeliveryDays(value);
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === '-' || e.key === 'e' || e.key === '.') e.preventDefault();
                                  }}
                                  placeholder="Expected delivery days"
                                  required
                                />
                                {formTouched && !promiseDeliveryDays && <span className="text-xs text-destructive">Delivery days required</span>}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Add Items Section */}
                        <div className="bg-white rounded-xl shadow p-4 space-y-4 border border-muted">
                          <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                            <Package className="h-4 w-4 text-primary" />
                            Order Items
                          </h3>
                          {/* Row 1: Main Fields */}
                          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-start">
                            <div className="flex flex-col w-full md:col-span-2">
                              <Label className="text-sm mb-1.5 min-h-[20px] flex items-center">Article <span className="text-destructive">*</span></Label>
                              <Select value={selectedArticleId} onValueChange={id => {
                                setSelectedArticleId(id);
                                const article = articles.find(a => a.id === id);
                                setUnit(article?.unit || '');
                                // Auto-populate reed pick fields from selected article
                                setYarnCount(article?.yarnCount || '');
                                setComposition(article?.composition || '');
                                setConstraction(article?.constraction || '');
                                setWidth(article?.width || '');
                              }} disabled={!selectedSupplierId}>
                                <SelectTrigger className={!selectedSupplierId ? "bg-muted h-12 w-full" : "bg-background h-12 w-full"}>
                                  <SelectValue placeholder={selectedSupplierId ? "Select article" : "Select vendor first"} />
                                </SelectTrigger>
                                <SelectContent>
                                  {filteredArticles.map(article => (
                                    <SelectItem key={article.id} value={article.id}>
                                      <div className="flex items-center gap-2">
                                        <span className="truncate max-w-[120px]">{article.name}</span>
                                        <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                                          ({article.category.replace(/_/g, ' ')})
                                        </span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex flex-col w-full">
                              <Label className="text-sm mb-1.5 min-h-[20px] flex items-center">Quantity <span className="text-destructive">*</span></Label>
                              <Input
                                className="bg-background h-12 w-full"
                                type="number"
                                min="1"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                placeholder="0"
                              />
                            </div>
                            <div className="flex flex-col w-full">
                              <Label className="text-sm mb-1.5 min-h-[20px] flex items-center">Unit</Label>
                              <Select value={unit} onValueChange={setUnit} disabled={!selectedSupplierId}>
                                <SelectTrigger className={!selectedSupplierId ? "bg-muted h-12 w-full" : "bg-background h-12 w-full"}>
                                  <SelectValue placeholder={selectedSupplierId ? "Select unit" : "Select vendor first"} />
                                </SelectTrigger>
                                <SelectContent>
                                  {[...new Set(filteredArticles.map(a => a.unit).filter(Boolean))].map((u, idx) => (
                                    <SelectItem key={idx} value={u!}>{u}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex flex-col w-full">
                              <Label className="text-sm mb-1.5 min-h-[20px] flex items-center">Price / Unit <span className="text-destructive">*</span></Label>
                              <Input
                                className="bg-background h-12 w-full"
                                type="number"
                                min="0"
                                value={pricePerUnit}
                                onChange={(e) => setPricePerUnit(e.target.value)}
                                placeholder="0"
                              />
                            </div>
                          </div>

                          {/* Row 2: Dimensions Fields */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                            <div className="flex flex-col gap-1 w-full">
                              <Label className="text-sm mb-1">constraction</Label>
                              <Input
                                className="bg-background h-12 w-full"
                                type="text"
                                value={constraction}
                                onChange={(e) => setConstraction(e.target.value)}
                                placeholder="e.g. 112/90"
                                disabled={!selectedSupplierId}
                              />
                            </div>
                            <div className="flex flex-col gap-1 w-full">
                              <Label className="text-sm mb-1">Yarn count</Label>
                              <Input
                                className="bg-background h-12 w-full"
                                type="text"
                                value={yarnCount}
                                onChange={(e) => setYarnCount(e.target.value)}
                                placeholder="e.g. 40x40"
                                disabled={!selectedSupplierId}
                              />
                            </div>
                            <div className="flex flex-col gap-1 w-full">
                              <Label className="text-sm mb-1">Width</Label>
                              <Input
                                className="bg-background h-12 w-full"
                                type="text"
                                value={width}
                                onChange={(e) => setWidth(e.target.value)}
                                placeholder="e.g. 50&quot;"
                                disabled={!selectedSupplierId}
                              />
                            </div>
                            <div className="flex flex-col gap-1 w-full">
                              <Label className="text-sm mb-1">Composition</Label>
                              <Input
                                className="bg-background h-12 w-full"
                                type="text"
                                value={composition}
                                onChange={(e) => setComposition(e.target.value)}
                                placeholder="e.g. 80:20"
                                disabled={!selectedSupplierId}
                              />
                            </div>
                          </div>

                          {/* Add Button */}
                          <div className="flex justify-end mt-2">
                            <Button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                addItemToPO();
                              }}
                              className="h-12 px-8 font-semibold text-base flex items-center justify-center bg-primary text-white hover:bg-primary/90 transition-all"
                              disabled={
                                !selectedArticleId ||
                                !quantity ||
                                !pricePerUnit ||
                                isNaN(parseFloat(quantity)) ||
                                parseFloat(quantity) <= 0 ||
                                isNaN(parseFloat(pricePerUnit)) ||
                                parseFloat(pricePerUnit) <= 0
                              }
                            >
                              <Plus className="h-5 w-5 mr-1" />
                              Add
                            </Button>
                          </div>

                          {poItems.length > 0 && (
                            <>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Article</TableHead>
                                    <TableHead>Details</TableHead>
                                    <TableHead>Quantity</TableHead>
                                    <TableHead>Unit</TableHead>
                                    <TableHead>Price/Unit</TableHead>
                                    <TableHead>Schedule</TableHead>
                                    <TableHead></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {poItems.map((item, index) => {
                                    const isExpanded = expandedScheduleItems.has(index);
                                    const scheduledQty = getScheduledQuantity(item);
                                    const scheduleCount = item.deliverySchedules?.length || 0;
                                    const qtyMismatch = scheduledQty !== item.quantity;

                                    return (
                                      <React.Fragment key={`po-item-${index}`}>
                                        <TableRow>
                                          <TableCell>{getArticleName(item.articleId)}</TableCell>
                                          <TableCell>
                                            {item.yarnCount ||
                                            item.composition ||
                                            item.constraction ||
                                            item.width ? (
                                              <div className="text-xs">
                                                {item.constraction && (
                                                  <div>constraction: {item.constraction}</div>
                                                )}
                                                {item.yarnCount && (
                                                  <div>Yarn count: {item.yarnCount}</div>
                                                )}
                                                {item.width && <div>Width: {item.width}</div>}
                                                {item.composition && (
                                                  <div>Composition: {item.composition}</div>
                                                )}
                                              </div>
                                            ) : (
                                              '-'
                                            )}
                                          </TableCell>
                                          <TableCell>
                                            <Input
                                              type="number"
                                              min="1"
                                                max={item.quantity}
                                              value={item.quantity}
                                              onChange={(e) => {
                                                const nextQty = parseFloat(e.target.value) || 0;
                                                const scheduledQty = getScheduledQuantity(item);

                                                if (nextQty < scheduledQty) {
                                                  toast({
                                                    title: 'Warning',
                                                    description: `Quantity cannot be less than the scheduled total (${scheduledQty}). Reduce schedules first.`,
                                                  });
                                                  updatePoItem(index, 'quantity', scheduledQty);
                                                  return;
                                                }

                                                updatePoItem(index, 'quantity', nextQty);
                                              }}
                                              className="w-20 h-8"
                                            />
                                          </TableCell>
                                          <TableCell>{getArticleUnit(item.articleId)}</TableCell>
                                          <TableCell>
                                            <div className="flex items-center gap-1">
                                              <span className="text-xs text-muted-foreground">PKR</span>
                                              <Input
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={item.pricePerUnit}
                                                onChange={(e) => updatePoItem(index, 'pricePerUnit', parseFloat(e.target.value) || 0)}
                                                className="w-24 h-8"
                                              />
                                            </div>
                                          </TableCell>
                                          <TableCell>
                                            <div className="flex items-center gap-2">
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => toggleScheduleExpansion(index)}
                                                className="h-8 px-2"
                                              >
                                                {isExpanded ? (
                                                  <ChevronUp className="h-4 w-4" />
                                                ) : (
                                                  <ChevronDown className="h-4 w-4" />
                                                )}
                                              </Button>
                                              <span className="text-sm">{scheduleCount} scheduled</span>
                                            </div>
                                          </TableCell>
                                          <TableCell>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => removeItemFromPO(index)}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </TableCell>
                                        </TableRow>
                                        {isExpanded && (
                                          <TableRow>
                                            <TableCell colSpan={7} className="bg-muted/30 p-4">
                                              <div className="space-y-3">
                                                <h4 className="font-semibold text-sm">Delivery Schedule (Optional)</h4>
                                                <div className="space-y-2">
                                                  {(item.deliverySchedules || []).map((schedule, scheduleIndex) => (
                                                    <div key={scheduleIndex} className="flex items-center gap-2">
                                                      <div className="flex-1">
                                                        <Label className="text-xs">Qty</Label>
                                                        <Input
                                                          type="number"
                                                          min="0"
                                                          value={schedule.quantity || ''}
                                                          onChange={(e) => updateScheduleRow(index, scheduleIndex, 'quantity', parseFloat(e.target.value) || 0)}
                                                          className="h-9"
                                                        />
                                                      </div>
                                                      <div className="flex-1">
                                                        <Label className="text-xs">Pick date</Label>
                                                        <div className="flex items-center gap-2">
                                                          <AppDatePicker
                                                            value={schedule.pickDate ? schedule.pickDate.split('T')[0] : ''}
                                                            onChange={(nextValue) => updateScheduleRow(index, scheduleIndex, 'pickDate', nextValue)}
                                                            className="h-9"
                                                          />
                                                          <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => removeScheduleRow(index, scheduleIndex)}
                                                            className="h-9 w-9"
                                                          >
                                                            <Trash2 className="h-4 w-4" />
                                                          </Button>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() => addScheduleRow(index)}
                                                  className="mt-2"
                                                  disabled={getScheduledQuantity(item) >= item.quantity}
                                                >
                                                  <Plus className="h-4 w-4 mr-1" />
                                                  Add Row
                                                </Button>
                                              </div>
                                            </TableCell>
                                          </TableRow>
                                        )}
                                      </React.Fragment>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </>
                          )}
                        </div>

                        <div className="space-y-2 w-full">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <Label className="font-semibold text-sm">Notes & Additional Information</Label>
                          </div>
                          <div className="relative">
                            <Textarea
                              value={poNotes}
                              onChange={(e) => setPoNotes(e.target.value)}
                              placeholder="Enter any additional notes, special instructions, delivery requirements, or other relevant information for this purchase order..."
                              className="min-h-[100px] w-full resize-y text-sm leading-relaxed"
                            />
                            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                              {poNotes.length} / 1000 characters
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            These notes will be included with the purchase order and can be viewed by authorized personnel.
                          </p>
                        </div>

                        <Button onClick={handleCreatePO} className="w-full h-12 text-lg font-bold flex items-center justify-center gap-2" size="lg">
                          <FileText className="h-6 w-6" />
                          <span className="flex items-center">Create Purchase Order</span>
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
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
                    <TableHead>PO Number</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Delivery Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Transaction Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPurchaseOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        {purchaseOrders.length === 0 ? 'No purchase orders yet' : 'No purchase orders match your search'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPurchaseOrders.map(po => {
                      // Default expanded; track only manually collapsed rows.
                      const isPoItemsExpanded = po.items.length > 0 && !expandedPoItems.has(po.id);
                      return (
                        <TableRow key={po.id}>
                          <TableCell className="font-medium">{po.poNumber}</TableCell>
                          <TableCell>{getSupplierName(po.supplierId)}</TableCell>
                          <TableCell>
                            <Badge className={getVendorCategoryInfo(getSupplierCategory(po.supplierId)).color}>
                              {getVendorCategoryInfo(getSupplierCategory(po.supplierId)).label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => togglePoItemsDropdown(po.id)}
                                disabled={po.items.length === 0}
                                aria-expanded={isPoItemsExpanded}
                                aria-label={`Toggle items list for ${po.poNumber}`}
                              >
                                <span className="mr-1">{po.items.length} items</span>
                                {isPoItemsExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                              <div
                                className={cn(
                                  'overflow-hidden transition-all duration-300 ease-in-out',
                                  isPoItemsExpanded && po.items.length > 0 ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
                                )}
                              >
                                <div className="max-h-36 overflow-y-auto rounded-md border bg-muted/30 p-2 text-xs">
                                  <ul className="space-y-1">
                                    {po.items.map((item, idx) => {
                                      const reedPickLine = formatPoItemReedPickLine(item, articles);
                                      return (
                                        <li
                                          key={`${po.id}-item-${idx}`}
                                          className="space-y-1 border-b border-border/40 pb-2 last:border-0 last:pb-0"
                                        >
                                          <div className="flex items-center justify-between gap-3">
                                            <span className="truncate font-medium">
                                              {getArticleName(item.articleId)}
                                            </span>
                                            <span className="shrink-0 text-muted-foreground">
                                              {item.quantity} {getArticleUnit(item.articleId)}
                                            </span>
                                          </div>
                                          <p className="pl-0.5 text-[11px] leading-snug text-muted-foreground">
                                            {reedPickLine}
                                          </p>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{po.promiseDeliveryDays} days</TableCell>
                          <TableCell>{getStatusBadge(po.status)}</TableCell>
                          <TableCell>{formatDate(po.transactionDate || po.createdAt)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setViewingPO(po)}
                              title="View PO Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* GRN Tab */}
        <TabsContent value="grns">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Goods Receipt Notes (GRN)</CardTitle>
                  <CardDescription>Record receipt of materials from purchase orders</CardDescription>
                </div>
                {canCreateGRN && (
                  <Dialog open={isGrnDialogOpen} onOpenChange={setIsGrnDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <FileText className="mr-2 h-4 w-4" />
                        Create GRN
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto w-[95vw]">
                      <DialogHeader>
                        <DialogTitle>Create Goods Receipt Note (GRN)</DialogTitle>
                        <DialogDescription>
                          Select an open purchase order to record received stock.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm">Select Vendor <span className="text-destructive">*</span></Label>
                            <Select
                              value={grnSupplierId}
                              onValueChange={(id) => {
                                setGrnSupplierId(id);
                                setSelectedPoForGrn('');
                                setGrnItems([]);
                              }}
                            >
                              <SelectTrigger className="bg-background">
                                <SelectValue placeholder="Choose a vendor" />
                              </SelectTrigger>
                              <SelectContent>
                                {suppliers.map(supplier => {
                                  const categoryInfo = getVendorCategoryInfo(supplier.category);
                                  return (
                                    <SelectItem key={supplier.id} value={supplier.id}>
                                      <div className="flex items-center gap-2">
                                        {categoryInfo.icon}
                                        <span className="font-medium">{supplier.name}</span>
                                        <Badge variant="secondary" className="text-xs">
                                          {categoryInfo.label}
                                        </Badge>
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">Select Purchase Order <span className="text-destructive">*</span></Label>
                            <Select value={selectedPoForGrn} onValueChange={handleSelectPoForGrn} disabled={!grnSupplierId}>
                              <SelectTrigger className={!grnSupplierId ? "bg-muted" : "bg-background"}>
                                <SelectValue placeholder={grnSupplierId ? "Choose a PO" : "Select vendor first"} />
                              </SelectTrigger>
                              <SelectContent>
                                {purchaseOrders
                                  .filter(
                                    po =>
                                      po.supplierId === grnSupplierId &&
                                      ['approved', 'partially_received'].includes(po.status) &&
                                      hasRemainingReceivableQty(po)
                                  )
                                  .map(po => (
                                    <SelectItem key={po.id} value={po.id}>
                                      {po.poNumber} ({po.items.length} items)
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">Select Warehouse <span className="text-destructive">*</span></Label>
                            <Select
                              value={grnWarehouseId}
                              onValueChange={setGrnWarehouseId}
                            >
                              <SelectTrigger className="bg-background">
                                <SelectValue placeholder="Choose a warehouse" />
                              </SelectTrigger>
                              <SelectContent>
                                {warehouses.length === 0 ? (
                                  <SelectItem value="none" disabled>No warehouses available</SelectItem>
                                ) : (
                                  warehouses.map(warehouse => (
                                    <SelectItem key={warehouse.id} value={warehouse.id}>
                                      {warehouse.name}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">Transaction Date <span className="text-destructive">*</span></Label>
                            <AppDatePicker
                              className="bg-background h-10 w-full"
                              value={grnDate}
                              onChange={setGrnDate}
                            />
                          </div>
                        </div>

                        {grnSupplier && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Vendor Type:</span>
                            <Badge className={getVendorCategoryInfo(grnSupplier.category).color}>
                              {getVendorCategoryInfo(grnSupplier.category).icon}
                              <span className="ml-1">{getVendorCategoryInfo(grnSupplier.category).label}</span>
                            </Badge>
                          </div>
                        )}

                        {grnItems.length > 0 && (
                          <div className="border rounded-lg p-4">
                            <h3 className="font-semibold mb-4">Receive Items</h3>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[220px] min-w-[220px]">Article</TableHead>
                                  <TableHead>Ordered</TableHead>
                                  <TableHead>Received So Far</TableHead>
                                  <TableHead>Remaining</TableHead>
                                  <TableHead>Received</TableHead>
                                  <TableHead>Thans</TableHead>
                                  <TableHead>Lot No</TableHead>
                                  <TableHead>Unit</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {grnItems.map((item, index) => {
                                  const previouslyReceived = selectedPoForGrn
                                    ? getPreviouslyReceivedForPO(selectedPoForGrn)[item.articleId] || 0
                                    : 0;
                                  const remaining = Math.max(item.orderedQuantity - previouslyReceived, 0);

                                  const article = articles.find(a => a.id === item.articleId);
                                  const availableUnits = [...new Set(articles.map(a => a.unit).filter(Boolean))];

                                  return (
                                    <TableRow key={index}>
                                      <TableCell className="min-w-[220px] whitespace-normal break-words">
                                        {getArticleName(item.articleId)}
                                      </TableCell>
                                      <TableCell>{item.orderedQuantity}</TableCell>
                                      <TableCell>{previouslyReceived}</TableCell>
                                      <TableCell>{remaining}</TableCell>
                                      <TableCell>
                                        <Input
                                          type="number"
                                          min="0"
                                          max={remaining}
                                          value={item.receivedQuantity === 0 ? '' : item.receivedQuantity}
                                          onChange={(e) => {
                                            const { value } = e.target;
                                            updateGrnItem(index, 'receivedQuantity', value === '' ? 0 : parseFloat(value));
                                          }}
                                          placeholder="0"
                                          className="w-24"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <Input
                                          type="number"
                                          min="0"
                                          value={item.packages === 0 || item.packages == null ? '' : item.packages}
                                          onChange={(e) => {
                                            const { value } = e.target;
                                            updateGrnItem(index, 'packages', value === '' ? 0 : parseFloat(value));
                                          }}
                                          placeholder="0"
                                          className="w-28"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <Input
                                          type="text"
                                          value={item.lotNo || ''}
                                          onChange={(e) => updateGrnItem(index, 'lotNo', e.target.value)}
                                          placeholder="Lot No"
                                          className="w-24"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <Select
                                          value={item.unit || article?.unit || ''}
                                          onValueChange={(value) => updateGrnItem(index, 'unit', value)}
                                        >
                                          <SelectTrigger className="w-32 h-9">
                                            <SelectValue placeholder="Unit" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {availableUnits.map((unit, idx) => (
                                              <SelectItem key={idx} value={unit!}>{unit}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}

                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <Label className="font-semibold text-base">Notes & Remarks</Label>
                          </div>
                          <div className="relative">
                            <Textarea
                              value={grnNotes}
                              onChange={(e) => setGrnNotes(e.target.value)}
                              placeholder="Enter any remarks, observations, quality notes, or special handling instructions for this goods receipt..."
                              className="min-h-[100px] w-full resize-y text-sm leading-relaxed"
                            />
                            <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
                              {grnNotes.length} / 1000 characters
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Add any relevant notes about the received goods, quality observations, or special handling requirements.
                          </p>
                        </div>
                        <div className="flex gap-4 w-full">
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              setIsGrnDialogOpen(false);
                              setSelectedPoForGrn('');
                              setGrnSupplierId('');
                              setGrnItems([]);
                              setGrnNotes('');
                            }}
                          >
                            Cancel
                          </Button>
                          <Button onClick={handleCreateGRN} className="w-full" disabled={isCreatingGRN}>
                            {isCreatingGRN ? 'Creating GRN...' : 'Create GRN'}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Input
                  type="text"
                  placeholder="Search"
                  value={grnSearchQuery}
                  onChange={(e) => setGrnSearchQuery(e.target.value)}
                  className="max-w-md"
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>GRN Number</TableHead>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Transaction Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGrns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        {grns.filter(g => g.status === 'confirmed').length === 0 ? 'No confirmed GRNs yet' : 'No confirmed GRNs match your search'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredGrns.map(grn => {
                      const po = purchaseOrders.find(p => p.id === grn.poId);
                      // Default expanded; track only manually collapsed rows.
                      const isGrnItemsExpanded = grn.items.length > 0 && !expandedGrnItems.has(grn.id);
                      return (
                        <TableRow key={grn.id}>
                          <TableCell className="font-medium">{grn.grnNumber}</TableCell>
                          <TableCell>{po?.poNumber || 'N/A'}</TableCell>
                          <TableCell>{getSupplierName(grn.supplierId)}</TableCell>
                          <TableCell>{grn.warehouse?.name || (grn.warehouseId ? getWarehouseName(grn.warehouseId) : 'N/A')}</TableCell>
                          <TableCell>
                            <div className="space-y-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => toggleGrnItemsDropdown(grn.id)}
                                disabled={grn.items.length === 0}
                                aria-expanded={isGrnItemsExpanded}
                                aria-label={`Toggle items list for ${grn.grnNumber}`}
                              >
                                <span className="mr-1">{grn.items.length} items</span>
                                {isGrnItemsExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                              <div
                                className={cn(
                                  'overflow-hidden transition-all duration-300 ease-in-out',
                                  isGrnItemsExpanded && grn.items.length > 0 ? 'max-h-44 opacity-100' : 'max-h-0 opacity-0'
                                )}
                              >
                                <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/30 p-2 text-xs">
                                  <ul className="space-y-1">
                                    {grn.items.map((item, idx) => {
                                      const poItem = po?.items.find((pi) => pi.articleId === item.articleId);
                                      const article = articles.find(a => a.id === item.articleId);
                                      const reedPickLine = poItem
                                        ? formatPoItemReedPickLine(poItem, articles)
                                        : (article ? formatArticleReedPickLine(article) : '');
                                      return (
                                        <li
                                          key={`${grn.id}-item-${idx}`}
                                          className="space-y-1 border-b border-border/40 pb-2 last:border-0 last:pb-0"
                                        >
                                          <div className="flex items-center justify-between gap-3">
                                            <span className="truncate font-medium">
                                              {getArticleName(item.articleId)}
                                            </span>
                                            <span className="shrink-0 text-muted-foreground">
                                              {item.receivedQuantity} {item.unit || getArticleUnit(item.articleId)}
                                            </span>
                                          </div>
                                          {reedPickLine && (
                                            <p className="pl-0.5 text-[11px] leading-snug text-muted-foreground">
                                              {reedPickLine}
                                            </p>
                                          )}
                                          <p className="pl-0.5 text-[11px] leading-snug text-muted-foreground">
                                            Ordered: {item.orderedQuantity} | Accepted: {item.acceptedQuantity} | Rejected: {item.rejectedQuantity}
                                            {(item.packages ?? 0) > 0 ? ` | Packages: ${item.packages}` : ''}
                                            {item.lotNo ? ` | Lot: ${item.lotNo}` : ''}
                                          </p>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          {/* Show both date and time for GRN */}
                          <TableCell>{formatDate(grn.receivedAt)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setViewingGRN(grn)}
                              title="View GRN Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>


        {/* Receiving Invoice Tab */}
        <TabsContent value="receiving-invoice">
          <ReceivingInvoiceModule />
        </TabsContent>
      </Tabs>

      {/* View PO Dialog */}
      <Dialog open={!!viewingPO} onOpenChange={() => setViewingPO(null)}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto w-[90vw]">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Purchase Order: {viewingPO?.poNumber}
            </DialogTitle>
            <DialogDescription>
              Review purchase order header, items, and schedules.
            </DialogDescription>
          </DialogHeader>
          {viewingPO && (
            <div className="space-y-6">
              {/* PO Header Info */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Vendor</p>
                  <p className="font-medium">{getSupplierName(viewingPO.supplierId)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vendor Type</p>
                  <Badge className={getVendorCategoryInfo(getSupplierCategory(viewingPO.supplierId)).color}>
                    {getVendorCategoryInfo(getSupplierCategory(viewingPO.supplierId)).label}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(viewingPO.status)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Order Date</p>
                  <p className="font-medium">{formatDate(viewingPO.transactionDate || viewingPO.createdAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Delivery Days</p>
                  <p className="font-medium">{viewingPO.promiseDeliveryDays} days</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="font-bold text-primary">PKR {viewingPO.totalAmount.toLocaleString()}</p>
                </div>
              </div>

              {/* PO Items Table */}
              <div className="border rounded-lg">
                <div className="p-3 bg-muted/30 border-b">
                  <h4 className="font-semibold">Order Items ({viewingPO.items.length})</h4>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Article</TableHead>
                      <TableHead>Reed Pick</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Price/Unit</TableHead>
                      <TableHead>Schedule</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingPO.items.map((item, idx) => {
                      const schedules = item.deliverySchedules || [];
                      const scheduledQty = schedules.reduce((sum, s) => sum + (s.quantity || 0), 0);
                      const hasSchedules = schedules.length > 0;

                      return (
                        <React.Fragment key={`view-po-item-${idx}`}>
                          <TableRow>
                            <TableCell className="font-medium">{getArticleName(item.articleId)}</TableCell>
                            <TableCell>
                              {item.yarnCount ||
                              item.composition ||
                              item.constraction ||
                              item.width ? (
                                <div className="text-xs">
                                  {item.constraction && (
                                    <div>constraction: {item.constraction}</div>
                                  )}
                                  {item.yarnCount && (
                                    <div>Yarn count: {item.yarnCount}</div>
                                  )}
                                  {item.width && <div>Width: {item.width}</div>}
                                  {item.composition && (
                                    <div>Composition: {item.composition}</div>
                                  )}
                                </div>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>{getArticleUnit(item.articleId)}</TableCell>
                            <TableCell>PKR {item.pricePerUnit.toLocaleString()}</TableCell>
                            <TableCell>
                              {hasSchedules ? (
                                <div className="text-sm">
                                  <div className="font-medium">{schedules.length} scheduled</div>
                                  <div className="text-xs text-muted-foreground">
                                    Total: {scheduledQty} / {item.quantity}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">No schedule</span>
                              )}
                            </TableCell>
                          </TableRow>
                          {hasSchedules && (
                            <TableRow>
                              <TableCell colSpan={6} className="bg-muted/30 p-4">
                                <div className="space-y-3">
                                  <h5 className="font-semibold text-sm">Delivery Schedule</h5>
                                  <div className="space-y-2">
                                    {schedules.map((schedule, scheduleIdx) => (
                                      <div key={scheduleIdx} className="flex items-center gap-4 p-2 bg-background rounded border">
                                        <div className="flex-1">
                                          <Label className="text-xs text-muted-foreground">Quantity</Label>
                                          <div className="font-medium">{schedule.quantity}</div>
                                        </div>
                                        <div className="flex-1">
                                          <Label className="text-xs text-muted-foreground">Pick Date</Label>
                                          <div className="font-medium">
                                            {schedule.pickDate ? formatDate(schedule.pickDate) : 'N/A'}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Notes */}
              {viewingPO.notes && (
                <div className="p-4 bg-muted/30 rounded-lg border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground">Notes</p>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{viewingPO.notes}</p>
                </div>
              )}

              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => handlePrintPO()} className="flex items-center gap-2">
                  <Printer className="h-4 w-4" />
                  Print PO
                </Button>
                {viewingPO.status === 'pending' && canCreatePO && !grns.some(g => g.poId === viewingPO.id) && (
                  <Button onClick={() => handleEditPOClick(viewingPO)} className="flex items-center gap-2">
                    <Edit2 className="h-4 w-4" />
                    Edit PO
                  </Button>
                )}
                <Button variant="outline" onClick={() => setViewingPO(null)}>Close</Button>
              </div>

              {/* Hidden Print Template */}
              <div style={{ display: 'none' }}>
                <div ref={printRef} className="page p-8 bg-white text-black text-xs">
                  <div className="flex justify-end items-center border-b pb-4 mb-4">
                    <div className="text-right">
                      <h2 className="text-xl font-bold tracking-tight">PURCHASE ORDER</h2>
                      <div className="text-lg font-medium">#{viewingPO.poNumber}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8 mb-6">
                    <div>
                      <h4 className="font-bold border-b pb-1 mb-2">Vendor Details</h4>
                      <p className="font-medium text-sm">{getSupplierName(viewingPO.supplierId)}</p>
                    </div>
                    <div>
                      <h4 className="font-bold border-b pb-1 mb-2">Order Information</h4>
                      <p>Date: {formatDate(viewingPO.transactionDate || viewingPO.createdAt)}</p>
                      <div className="text-gray-600">Delivery Days: {viewingPO.promiseDeliveryDays || '-'}</div>
                    </div>
                  </div>

                  <table className="w-full border-collapse border border-gray-300 mb-6 text-xs">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 p-2 text-left w-1/4">Article</th>
                        <th className="border border-gray-300 p-2 text-left">Details</th>
                        <th className="border border-gray-300 p-2 text-right">Qty</th>
                        <th className="border border-gray-300 p-2 text-left">Unit</th>
                        <th className="border border-gray-300 p-2 text-right">Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewingPO.items.map((item, idx) => {
                        const lineTotal = item.quantity * (item.pricePerUnit || 0);
                        const lineUnitLabel = (item.unit?.trim() || getArticleUnit(item.articleId)).trim();

                        return (
                          <React.Fragment key={idx}>
                            <tr>
                              <td className="border border-gray-300 p-2">
                                <strong>{getArticleName(item.articleId)}</strong>
                              </td>
                              <td className="border border-gray-300 p-2 text-gray-600">
                                {item.constraction ? `constraction: ${item.constraction} ` : ''}
                                {item.yarnCount ? `Yarn count: ${item.yarnCount} ` : ''}
                                {item.width ? `Width: ${item.width}` : ''}
                                {item.composition ? `Composition: ${item.composition} ` : ''}
                              </td>
                              <td className="border border-gray-300 p-2 text-right font-medium">{item.quantity}</td>
                              <td className="border border-gray-300 p-2">{lineUnitLabel || '-'}</td>
                              <td className="border border-gray-300 p-2 text-right">{item.pricePerUnit ? item.pricePerUnit.toLocaleString() : '-'}</td>
                            </tr>
                            {(item.deliverySchedules || []).map((s, sIdx) => (
                              <tr key={`sched-${idx}-${sIdx}`} className="bg-gray-50/50">
                                <td className="border border-gray-300 p-2 border-t-0"></td>
                                <td colSpan={2} className="border border-gray-300 p-1 px-2 text-right italic text-gray-500 text-[10px]">
                                  Delivery {sIdx + 1}: {s.quantity}
                                  {lineUnitLabel ? ` ${lineUnitLabel}` : ''}
                                </td>
                                <td colSpan={2} className="border border-gray-300 p-1 px-2 italic text-gray-500 text-[10px]">
                                  {s.pickDate ? formatDate(s.pickDate) : 'N/A'}
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>

                  {viewingPO.notes && (
                    <div className="mb-8 border border-gray-300 p-3 bg-gray-50 rounded">
                      <strong className="block mb-1">Order Notes / Terms</strong>
                      {viewingPO.notes}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-16 mt-16 text-center">
                    <div>
                      <div className="border-t border-black pt-2 mx-12">Buyer Signature</div>
                    </div>
                    <div>
                      <div className="border-t border-black pt-2 mx-12">Seller Signature</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View GRN Dialog */}
      <Dialog open={!!viewingGRN} onOpenChange={() => setViewingGRN(null)}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto w-[90vw]">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Goods Receipt Note: {viewingGRN?.grnNumber}
            </DialogTitle>
            <DialogDescription>
              Review GRN header and received item details.
            </DialogDescription>
          </DialogHeader>
          {viewingGRN && (() => {
            const po = purchaseOrders.find(p => p.id === viewingGRN.poId);
            return (
              <div className="space-y-6">
                {/* GRN Header Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">PO Number</p>
                    <p className="font-medium">{po?.poNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Supplier</p>
                    <p className="font-medium">{getSupplierName(viewingGRN.supplierId)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Warehouse</p>
                    <p className="font-medium">{viewingGRN.warehouse?.name || (viewingGRN.warehouseId ? getWarehouseName(viewingGRN.warehouseId) : 'N/A')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Vendor Type</p>
                    <Badge className={getVendorCategoryInfo(getSupplierCategory(viewingGRN.supplierId)).color}>
                      {getVendorCategoryInfo(getSupplierCategory(viewingGRN.supplierId)).label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    {getStatusBadge(viewingGRN.status)}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Received At</p>
                    <p className="font-medium">{formatDate(viewingGRN.receivedAt)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Received By</p>
                    <p className="font-medium">{viewingGRN.receivedBy || 'N/A'}</p>
                  </div>
                </div>

                {/* GRN Items Table */}
                <div className="border rounded-lg">
                  <div className="p-3 bg-muted/30 border-b">
                    <h4 className="font-semibold">Received Items ({viewingGRN.items.length})</h4>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Article</TableHead>
                        <TableHead>Reed Pick</TableHead>
                        <TableHead>Ordered Qty</TableHead>
                        <TableHead>Received Qty</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingGRN.items.map((item, idx) => {
                        const sourcePo = purchaseOrders.find((p) => p.id === viewingGRN.poId);
                        const poItem = sourcePo?.items.find((pi) => pi.articleId === item.articleId);
                        const article = articles.find(a => a.id === item.articleId);
                        const reedPick = poItem
                          ? formatPoItemReedPickLine(poItem, articles)
                          : (article ? formatArticleReedPickLine(article) : '—');
                        return (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{getArticleName(item.articleId)}</TableCell>
                            <TableCell>{reedPick || '—'}</TableCell>
                            <TableCell>{item.orderedQuantity}</TableCell>
                            <TableCell className="text-green-600 font-medium">{item.receivedQuantity}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Notes */}
                {viewingGRN.notes && (
                  <div className="p-4 bg-muted/30 rounded-lg border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-semibold text-foreground">Notes</p>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{viewingGRN.notes}</p>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => setViewingGRN(null)}>Close</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

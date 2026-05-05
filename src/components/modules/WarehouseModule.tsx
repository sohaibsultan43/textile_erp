/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { UserRole, Location, Supplier, Article } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Warehouse, Trash2, AlertTriangle, Package, ShoppingCart, ArrowRightLeft, FileText, Pencil, Download } from 'lucide-react';
import { locationApi } from '@/lib/api/locations';
import { vendorApi } from '@/lib/api/vendors';
import { articleApi } from '@/lib/api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatArticleReedPickLine } from '@/lib/poItemReedPick';
import { formatDate } from '@/lib/utils';

interface WarehouseModuleProps {
  userRole: UserRole;
}

type StockDetail = {
  id: string;
  articleId: string;
  article: { name: string; unit: string; yarnCount?: string; composition?: string; constraction?: string; width?: string; lotNumber?: string };
  quantity: number;
  meterEquivalent?: number | null;
  pricePerUnit: number;
  lotNo?: string | null;
  shade?: string | null;
  stage: string;
  createdAt: string;
  receivingDate?: string | null;
  transactionNo?: string | null;
  supplier?: { id: string; name: string; phone?: string; contactPerson?: string } | null;
  packages?: number | null;
  issuedToDyeing?: { workOrderNo?: string; dyeingHouse?: string; jobNumber?: string; greyThan?: number; greyMeters?: number; status?: string } | null;
};

export const WarehouseModule = ({ userRole }: WarehouseModuleProps) => {
  type WarehouseWithStock = Location & {
    stockItems?: Array<{
      id: string;
      quantity: number;
      pricePerUnit?: number | null;
      lotNo?: string | null;
      article?: { name?: string; unit?: string; yarnCount?: string; composition?: string; constraction?: string; width?: string };
    }>;
  };

  const [warehouses, setWarehouses] = useState<WarehouseWithStock[]>([]);
  const [vendors, setVendors] = useState<Supplier[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<{
    canDelete: boolean;
    blockingRecords: {
      stockItems: number;
      saleOrders: number;
      fromRequisitions: number;
      toRequisitions: number;
      fromGatePasses: number;
      toGatePasses: number;
    };
    preview?: {
      stockItems?: Array<{
        id: string;
        quantity: number;
        article: { name: string };
        poNumbers?: string[] | null;
      }>;
      saleOrders?: Array<{ id: string; orderNumber: string; totalAmount: number; status: string }>;
      fromRequisitions?: Array<{ id: string; requisitionNumber?: string }>;
      toRequisitions?: Array<{ id: string; requisitionNumber?: string }>;
      fromGatePasses?: Array<{ id: string; gatePassNumber?: string }>;
      toGatePasses?: Array<{ id: string; gatePassNumber?: string }>;
    };
  } | null>(null);
  const [warehouseToDelete, setWarehouseToDelete] = useState<Location | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [warehouseToEdit, setWarehouseToEdit] = useState<Location | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editOwnershipType, setEditOwnershipType] = useState<'own' | 'vendor'>('own');
  const [editVendorId, setEditVendorId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [stockDialogWarehouse, setStockDialogWarehouse] = useState<WarehouseWithStock | null>(null);
  const [stockDetailItems, setStockDetailItems] = useState<StockDetail[]>([]);
  const [isStockDetailLoading, setIsStockDetailLoading] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);

  // Form states
  const [warehouseName, setWarehouseName] = useState('');
  const [warehouseAddress, setWarehouseAddress] = useState('');
  const [ownershipType, setOwnershipType] = useState<'own' | 'vendor'>('own');
  const [vendorId, setVendorId] = useState<string>('');

  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allLocations, allVendors, allArticles] = await Promise.all([
        locationApi.getAll(),
        vendorApi.getAll(),
        articleApi.getAll(),
      ]);
      // Filter for godown type (warehouses in the database)
      setWarehouses(allLocations.filter(loc => loc.type === 'godown') as WarehouseWithStock[]);
      setVendors(allVendors);
      setArticles(allArticles);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({ title: 'Error', description: 'Failed to load warehouses. Please check your connection and try again.', variant: 'destructive' });
      setWarehouses([]);
      setVendors([]);
      setArticles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const canManageWarehouse = ['owner', 'warehouse', 'purchase_officer'].includes(userRole);
  const canDeleteWarehouse = userRole === 'owner'; // Only owner can delete (as per backend authorization)

  const handleCreateWarehouse = async () => {
    const trimmedName = warehouseName.trim();
    const trimmedAddress = warehouseAddress.trim();

    if (!trimmedName || trimmedName.length < 2) {
      toast({ title: "Error", description: "Name must be at least 2 characters long", variant: "destructive" });
      return;
    }

    if (ownershipType === 'vendor' && !vendorId) {
      toast({ title: "Error", description: "Please select a vendor for vendor-owned warehouse", variant: "destructive" });
      return;
    }

    if (!trimmedAddress || trimmedAddress.length < 5) {
      toast({ title: "Error", description: "Address must be at least 5 characters long", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // Database Location model supports: name, type, address, ownershipType, vendorId
      const newWarehouse = await locationApi.create({
        name: warehouseName.trim(),
        type: 'godown', // Database uses 'godown' for warehouses
        address: warehouseAddress.trim(),
        ownershipType,
        ... (ownershipType === 'vendor' && vendorId ? { vendorId } : {})
      } as any); // Cast as any because the locationApi client might not be fully updated recursively

      // Reset form
      setWarehouseName('');
      setWarehouseAddress('');
      setOwnershipType('own');
      setVendorId('');
      setIsDialogOpen(false);

      await loadData();
      toast({ title: "Success", description: "Warehouse created successfully" });
    } catch (error) {
      console.error('Error creating warehouse:', error);
      toast({ title: "Error", description: "Failed to create warehouse", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (warehouse: Location) => {
    setWarehouseToEdit(warehouse);
    setEditName(warehouse.name);
    setEditAddress(warehouse.address);
    setEditOwnershipType((warehouse as any).ownershipType || 'own');
    setEditVendorId((warehouse as any).vendorId || '');
    setIsEditDialogOpen(true);
  };

  const handleUpdateWarehouse = async () => {
    if (!warehouseToEdit) return;

    const trimmedName = editName.trim();
    const trimmedAddress = editAddress.trim();

    if (!trimmedName || trimmedName.length < 2) {
      toast({ title: "Error", description: "Name must be at least 2 characters long", variant: "destructive" });
      return;
    }

    if (editOwnershipType === 'vendor' && !editVendorId) {
      toast({ title: "Error", description: "Please select a vendor for vendor-owned warehouse", variant: "destructive" });
      return;
    }

    if (!trimmedAddress || trimmedAddress.length < 5) {
      toast({ title: "Error", description: "Address must be at least 5 characters long", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      await locationApi.update(warehouseToEdit.id, {
        name: editName.trim(),
        type: 'godown',
        address: editAddress.trim(),
        ownershipType: editOwnershipType,
        ...(editOwnershipType === 'vendor' && editVendorId ? { vendorId: editVendorId } : {}),
      } as any);
      setIsEditDialogOpen(false);
      setWarehouseToEdit(null);
      await loadData();
      toast({ title: 'Success', description: 'Warehouse updated successfully' });
    } catch (error) {
      console.error('Error updating warehouse:', error);
      toast({ title: 'Error', description: 'Failed to update warehouse', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClick = async (warehouse: Location) => {
    setWarehouseToDelete(warehouse);
    setIsLoading(true);
    try {
      const status = await locationApi.getDeletionStatus(warehouse.id);
      setDeleteStatus(status);
      setIsDeleteDialogOpen(true);
    } catch (error: any) {
      console.error('Error checking deletion status:', error);
      toast({
        title: "Error",
        description: "Failed to check deletion status. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!warehouseToDelete) return;

    setIsLoading(true);
    try {
      await locationApi.delete(warehouseToDelete.id);
      toast({ title: "Success", description: "Warehouse deleted successfully" });
      setIsDeleteDialogOpen(false);
      setWarehouseToDelete(null);
      setDeleteStatus(null);
      await loadData();
    } catch (error: any) {
      console.error('Error deleting warehouse:', error);
      // Try to extract detailed error from response
      const errorMessage = error?.message || 'Unknown error';
      const errorDetails = error?.response?.data?.details;

      let fullMessage = errorMessage;
      if (errorDetails && Array.isArray(errorDetails)) {
        const details = errorDetails.map((d: any) => d.msg || d).join(', ');
        fullMessage = `${errorMessage}: ${details}`;
      }

      toast({
        title: "Error",
        description: fullMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredWarehouses = warehouses.filter(wh => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return wh.name.toLowerCase().includes(query) ||
      wh.address.toLowerCase().includes(query);
  });

  const getStockTotals = (warehouse: WarehouseWithStock) => {
    const items = warehouse.stockItems || [];
    const totalQty = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const totalValue = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (item.pricePerUnit || 0), 0);
    return { count: items.length, totalQty, totalValue };
  };

  const getArticleDetails = (articleId?: string) => articles.find((a) => a.id === articleId);

  const formatReedPick = (articleId?: string) => {
    const article = articleId ? getArticleDetails(articleId) : undefined;
    if (article) return formatArticleReedPickLine(article);
    return '-';
  };

  const resolveLot = (stockItem: { lotNo?: string | null; articleId?: string; article?: { name?: string; unit?: string } }) => {
    const article = stockItem.articleId ? getArticleDetails(stockItem.articleId) : undefined;
    return stockItem.lotNo || article?.lotNumber || '—';
  };

  const openStockDialog = async (warehouse: WarehouseWithStock) => {
    setStockDialogWarehouse(warehouse);
    setStockDetailItems([]);
    setIsStockDetailLoading(true);
    try {
      const detail = await locationApi.getStockDetail(warehouse.id);
      setStockDetailItems(detail);
    } catch {
      toast({ title: 'Error', description: 'Failed to load stock details', variant: 'destructive' });
    } finally {
      setIsStockDetailLoading(false);
    }
  };

  const getItemMeters = (item: StockDetail) => {
    if (item.meterEquivalent != null) return Number(item.meterEquivalent) || 0;
    const unit = (item.article?.unit || '').toLowerCase();
    if (unit.includes('meter') || unit === 'm') return Number(item.quantity) || 0;
    return 0;
  };

  const getItemThans = (item: StockDetail) => {
    // GRN receive rows store than count in `packages` (renamed in UI as Thans).
    if (item.packages != null && Number(item.packages) > 0) return Number(item.packages) || 0;
    if (item.meterEquivalent != null) return Number(item.quantity) || 0;
    const unit = (item.article?.unit || '').toLowerCase();
    if (unit.includes('meter') || unit === 'm') return 0;
    return Number(item.quantity) || 0;
  };

  const exportStockDetailsToExcel = () => {
    if (!stockDialogWarehouse) return;

    const headers = [
      'Receiving Date',
      'Transaction No',
      'Article',
      'Unit',
      'Reed-Pick',
      'Lot No',
      'Qty (Meters)',
      'Qty (Than)',
      'Rate (PKR)',
      'Supplier',
      'Supplier Contact',
      'Supplier Phone',
      'Issued (Than)',
      'Issued (Meters)',
      'WO No',
      'Dyeing House',
      'Dyeing Status',
    ];

    const rows = stockDetailItems.map((item) => {
      const article = item.article;
      const receivingDate = item.receivingDate ? formatDate(item.receivingDate) : '';
      const reedPick = formatArticleReedPickLine(
        { yarnCount: article.yarnCount, composition: article.composition, constraction: article.constraction, width: article.width } as any
      );

      return [
        receivingDate,
        item.transactionNo || '',
        article.name || '',
        article.unit || '',
        reedPick || '',
        item.lotNo || '',
        getItemMeters(item) > 0 ? getItemMeters(item).toString() : '',
        getItemThans(item) > 0 ? getItemThans(item).toString() : '',
        item.pricePerUnit ? item.pricePerUnit.toString() : '',
        item.supplier?.name || '',
        item.supplier?.contactPerson || '',
        item.supplier?.phone || '',
        item.issuedToDyeing?.greyThan != null ? String(item.issuedToDyeing.greyThan) : '',
        item.issuedToDyeing?.greyMeters != null ? String(item.issuedToDyeing.greyMeters) : '',
        item.issuedToDyeing?.workOrderNo || '',
        item.issuedToDyeing?.dyeingHouse || '',
        item.issuedToDyeing?.status || '',
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const datePart = new Date().toISOString().split('T')[0];
    const safeWarehouse = (stockDialogWarehouse.name || 'warehouse').replace(/[^\w\-]+/g, '_');
    link.href = url;
    link.download = `stock-view-${safeWarehouse}-${datePart}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({ title: 'Exported', description: 'Stock view exported for Excel.' });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Warehouses</CardTitle>
            <CardDescription>Manage your own and supplier warehouses</CardDescription>
          </div>
          {canManageWarehouse && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Warehouse
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Warehouse</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Warehouse Name <span className="text-destructive">*</span></Label>
                      <Input
                        value={warehouseName}
                        onChange={(e) => setWarehouseName(e.target.value)}
                        placeholder="Enter warehouse name"
                      />
                    </div>

                    <div className="space-y-4">
                      <Label>Ownership Type <span className="text-destructive">*</span></Label>
                      <div className="flex gap-4">
                        <Button
                          variant={ownershipType === 'own' ? 'default' : 'outline'}
                          onClick={() => setOwnershipType('own')}
                          type="button"
                          className="flex-1"
                        >
                          Company Owned
                        </Button>
                        <Button
                          variant={ownershipType === 'vendor' ? 'default' : 'outline'}
                          onClick={() => setOwnershipType('vendor')}
                          type="button"
                          className="flex-1"
                        >
                          Vendor Warehouse
                        </Button>
                      </div>
                    </div>

                    {ownershipType === 'vendor' && (
                      <div className="space-y-2">
                        <Label>Select Vendor <span className="text-destructive">*</span></Label>
                        <Select value={vendorId} onValueChange={setVendorId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a vendor" />
                          </SelectTrigger>
                          <SelectContent>
                            {vendors.map((vendor) => (
                              <SelectItem key={vendor.id} value={vendor.id}>
                                {vendor.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Address <span className="text-destructive">*</span></Label>
                      <Textarea
                        value={warehouseAddress}
                        onChange={(e) => setWarehouseAddress(e.target.value)}
                        placeholder="Enter warehouse address"
                        className="min-h-[80px]"
                      />
                    </div>
                  </div>

                  <Button onClick={handleCreateWarehouse} className="w-full">
                    Create Warehouse
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
              <TableHead>Name</TableHead>
              <TableHead>Ownership</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Stock</TableHead>
              {canManageWarehouse && <TableHead className="w-[120px]">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredWarehouses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canManageWarehouse ? 5 : 4} className="text-center text-muted-foreground">
                  {warehouses.length === 0 ? 'No warehouses yet' : 'No warehouses match your search'}
                </TableCell>
              </TableRow>
            ) : (
              filteredWarehouses.map(warehouse => (
                <TableRow key={warehouse.id}>
                  <TableCell className="font-medium">{warehouse.name}</TableCell>
                  <TableCell>
                    {warehouse.ownershipType === 'vendor' ? (
                      <div className="flex flex-col">
                        <Badge variant="outline" className="w-fit mb-1 border-blue-200 text-blue-700 bg-blue-50">Vendor</Badge>
                        <span className="text-xs text-muted-foreground">{warehouse.vendor?.name || 'Unknown Vendor'}</span>
                      </div>
                    ) : (
                      <Badge variant="outline" className="w-fit border-green-200 text-green-700 bg-green-50">Company Owned</Badge>
                    )}
                  </TableCell>
                  <TableCell>{warehouse.address}</TableCell>
                  <TableCell>
                    {(() => {
                      const totals = getStockTotals(warehouse);
                      return (
                        <div className="flex flex-col gap-1 text-sm">
                          <div className="font-medium">{totals.totalQty.toLocaleString()} units</div>
                          <div className="text-xs text-muted-foreground">{totals.count} line(s)</div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-fit px-2"
                            onClick={() => openStockDialog(warehouse)}
                          >
                            View stock
                          </Button>
                        </div>
                      );
                    })()}
                  </TableCell>
                  {canManageWarehouse && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditClick(warehouse)}
                          disabled={isLoading}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {canDeleteWarehouse && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(warehouse)}
                            disabled={isLoading}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog
        open={Boolean(stockDialogWarehouse)}
        onOpenChange={(open) => {
          if (!open) { setStockDialogWarehouse(null); setStockDetailItems([]); }
        }}
      >
        <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Stock in {stockDialogWarehouse?.name}</DialogTitle>
            <DialogDescription>
              {stockDialogWarehouse?.address || 'Warehouse stock details'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={exportStockDetailsToExcel}
                disabled={isStockDetailLoading || stockDetailItems.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Export to Excel
              </Button>
            </div>
            {/* Summary row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
              <div className="p-3 border rounded-lg">
                <div className="text-xs text-muted-foreground">Total Thans</div>
                <div className="text-lg font-semibold">
                  {stockDetailItems.reduce((s, i) => s + getItemThans(i), 0).toLocaleString()}
                </div>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="text-xs text-muted-foreground">Total Meters</div>
                <div className="text-lg font-semibold">
                  {stockDetailItems.reduce((s, i) => s + getItemMeters(i), 0).toLocaleString()}
                </div>
              </div>
              <div className="p-3 border rounded-lg">
                <div className="text-xs text-muted-foreground">Lines</div>
                <div className="text-lg font-semibold">{stockDetailItems.length}</div>
              </div>
            </div>

            {/* Detailed table */}
            {isStockDetailLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading stock details...</div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table className="min-w-[1100px]">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Receiving Date</TableHead>
                      <TableHead>Transaction No</TableHead>
                      <TableHead>Article / Reed-Pick</TableHead>
                      <TableHead>Lot No</TableHead>
                      <TableHead className="text-right">Qty (Meters)</TableHead>
                      <TableHead className="text-right">Qty (Than)</TableHead>
                      <TableHead className="text-right">Rate (PKR)</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead className="text-right">Issued (Than)</TableHead>
                      <TableHead className="text-right">Issued (Meters)</TableHead>
                      <TableHead>WO No / Dyeing</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stockDetailItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center text-muted-foreground py-6">
                          No stock items in this warehouse
                        </TableCell>
                      </TableRow>
                    ) : (
                      stockDetailItems.map(item => {
                        const article = item.article;
                        const reedPick = formatArticleReedPickLine(
                          { yarnCount: article.yarnCount, composition: article.composition, constraction: article.constraction, width: article.width } as any
                        );
                        return (
                          <TableRow key={item.id}>
                            {/* Receiving Date */}
                            <TableCell className="whitespace-nowrap text-sm">
                              {item.receivingDate ? formatDate(item.receivingDate) : '—'}
                            </TableCell>
                            {/* Transaction No (GRN Number) */}
                            <TableCell className="font-mono text-xs">{item.transactionNo || '—'}</TableCell>
                            {/* Article + Reed-Pick */}
                            <TableCell>
                              <div className="font-medium">{article.name}</div>
                              <div className="text-xs text-muted-foreground">{article.unit}</div>
                              {reedPick && <div className="text-xs text-muted-foreground">{reedPick}</div>}
                            </TableCell>
                            {/* Lot No */}
                            <TableCell className="text-sm">{item.lotNo || '—'}</TableCell>
                            {/* Qty in Meters */}
                            <TableCell className="text-right font-medium">
                              {getItemMeters(item) > 0 ? getItemMeters(item).toLocaleString() : '—'}
                            </TableCell>
                            {/* Qty in Than */}
                            <TableCell className="text-right font-medium">
                              {getItemThans(item) > 0 ? getItemThans(item).toLocaleString() : '—'}
                            </TableCell>
                            {/* Rate */}
                            <TableCell className="text-right">
                              {item.pricePerUnit ? item.pricePerUnit.toLocaleString() : '—'}
                            </TableCell>
                            {/* Supplier */}
                            <TableCell>
                              {item.supplier ? (
                                <div>
                                  <div className="font-medium text-sm">{item.supplier.name}</div>
                                  {item.supplier.contactPerson && <div className="text-xs text-muted-foreground">{item.supplier.contactPerson}</div>}
                                  {item.supplier.phone && <div className="text-xs text-muted-foreground">{item.supplier.phone}</div>}
                                </div>
                              ) : '—'}
                            </TableCell>
                            {/* Issued Qty to Dyeing */}
                            <TableCell className="text-right">
                              {item.issuedToDyeing?.greyThan != null ? item.issuedToDyeing.greyThan.toLocaleString() : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.issuedToDyeing?.greyMeters != null ? item.issuedToDyeing.greyMeters.toLocaleString() : '—'}
                            </TableCell>
                            {/* WO No / Dyeing House */}
                            <TableCell>
                              {item.issuedToDyeing ? (
                                <div>
                                  {item.issuedToDyeing.workOrderNo && <div className="text-xs font-medium">{item.issuedToDyeing.workOrderNo}</div>}
                                  {item.issuedToDyeing.dyeingHouse && <div className="text-xs text-muted-foreground">{item.issuedToDyeing.dyeingHouse}</div>}
                                  {item.issuedToDyeing.status && (
                                    <Badge variant="outline" className="text-[10px] mt-1 capitalize">{item.issuedToDyeing.status}</Badge>
                                  )}
                                </div>
                              ) : '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Warehouse Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Warehouse</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Warehouse Name <span className="text-destructive">*</span></Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter warehouse name"
              />
            </div>

            <div className="space-y-4">
              <Label>Ownership Type <span className="text-destructive">*</span></Label>
              <div className="flex gap-4">
                <Button
                  variant={editOwnershipType === 'own' ? 'default' : 'outline'}
                  onClick={() => setEditOwnershipType('own')}
                  type="button"
                  className="flex-1"
                >
                  Company Owned
                </Button>
                <Button
                  variant={editOwnershipType === 'vendor' ? 'default' : 'outline'}
                  onClick={() => setEditOwnershipType('vendor')}
                  type="button"
                  className="flex-1"
                >
                  Vendor Warehouse
                </Button>
              </div>
            </div>

            {editOwnershipType === 'vendor' && (
              <div className="space-y-2">
                <Label>Select Vendor <span className="text-destructive">*</span></Label>
                <Select value={editVendorId} onValueChange={setEditVendorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Address <span className="text-destructive">*</span></Label>
              <Textarea
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                placeholder="Enter warehouse address"
                className="min-h-[80px]"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdateWarehouse} disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deletion Status Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {deleteStatus?.canDelete ? (
                <>Delete Warehouse</>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Cannot Delete Warehouse
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {deleteStatus && (
            <div className="space-y-4">
              {!deleteStatus.canDelete ? (
                <>
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Deletion Blocked</AlertTitle>
                    <AlertDescription>
                      This warehouse cannot be deleted because it has associated records.
                      Please remove or reassign these records before deleting the warehouse.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm">Blocking Records:</h4>

                    {deleteStatus.blockingRecords.stockItems > 0 && (
                      <div className="flex items-start gap-3 p-3 border rounded-lg">
                        <Package className="h-5 w-5 text-orange-500 mt-0.5" />
                        <div className="flex-1">
                          <div className="font-medium">
                            Stock Items: {deleteStatus.blockingRecords.stockItems}
                          </div>
                          {deleteStatus.preview?.stockItems && deleteStatus.preview.stockItems.length > 0 && (
                            <div className="text-sm text-muted-foreground mt-1">
                              <div className="font-medium mb-1">Sample items:</div>
                              <ul className="list-disc list-inside space-y-1">
                                {deleteStatus.preview.stockItems.map((item) => (
                                  <li key={item.id} className="space-y-0.5">
                                    <div>
                                      <span className="font-medium">{item.article.name}</span> (Qty: {item.quantity})
                                    </div>
                                    {item.poNumbers && item.poNumbers.length > 0 && (
                                      <div className="ml-4 text-xs text-blue-600 dark:text-blue-400">
                                        PO: {item.poNumbers.join(', ')}
                                      </div>
                                    )}
                                  </li>
                                ))}
                                {deleteStatus.blockingRecords.stockItems > deleteStatus.preview.stockItems.length && (
                                  <li className="text-muted-foreground">
                                    ...and {deleteStatus.blockingRecords.stockItems - deleteStatus.preview.stockItems.length} more
                                  </li>
                                )}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {deleteStatus.blockingRecords.saleOrders > 0 && (
                      <div className="flex items-start gap-3 p-3 border rounded-lg">
                        <ShoppingCart className="h-5 w-5 text-blue-500 mt-0.5" />
                        <div className="flex-1">
                          <div className="font-medium">
                            Sale Orders: {deleteStatus.blockingRecords.saleOrders}
                          </div>
                          {deleteStatus.preview?.saleOrders && deleteStatus.preview.saleOrders.length > 0 && (
                            <div className="text-sm text-muted-foreground mt-1">
                              <div className="font-medium mb-1">Sample orders:</div>
                              <ul className="list-disc list-inside space-y-0.5">
                                {deleteStatus.preview.saleOrders.map((order) => (
                                  <li key={order.id}>
                                    {order.orderNumber} - {order.status} (${order.totalAmount.toFixed(2)})
                                  </li>
                                ))}
                                {deleteStatus.blockingRecords.saleOrders > deleteStatus.preview.saleOrders.length && (
                                  <li className="text-muted-foreground">
                                    ...and {deleteStatus.blockingRecords.saleOrders - deleteStatus.preview.saleOrders.length} more
                                  </li>
                                )}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {deleteStatus.blockingRecords.fromRequisitions > 0 && (
                      <div className="flex items-start gap-3 p-3 border rounded-lg">
                        <ArrowRightLeft className="h-5 w-5 text-purple-500 mt-0.5" />
                        <div className="flex-1">
                          <div className="font-medium">
                            Outgoing Requisitions: {deleteStatus.blockingRecords.fromRequisitions}
                          </div>
                          {deleteStatus.preview?.fromRequisitions && deleteStatus.preview.fromRequisitions.length > 0 && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {deleteStatus.preview.fromRequisitions.map((req) => req.requisitionNumber).filter(Boolean).join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {deleteStatus.blockingRecords.toRequisitions > 0 && (
                      <div className="flex items-start gap-3 p-3 border rounded-lg">
                        <ArrowRightLeft className="h-5 w-5 text-purple-500 mt-0.5" />
                        <div className="flex-1">
                          <div className="font-medium">
                            Incoming Requisitions: {deleteStatus.blockingRecords.toRequisitions}
                          </div>
                          {deleteStatus.preview?.toRequisitions && deleteStatus.preview.toRequisitions.length > 0 && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {deleteStatus.preview.toRequisitions.map((req) => req.requisitionNumber).filter(Boolean).join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {deleteStatus.blockingRecords.fromGatePasses > 0 && (
                      <div className="flex items-start gap-3 p-3 border rounded-lg">
                        <FileText className="h-5 w-5 text-green-500 mt-0.5" />
                        <div className="flex-1">
                          <div className="font-medium">
                            Outgoing Gate Passes: {deleteStatus.blockingRecords.fromGatePasses}
                          </div>
                          {deleteStatus.preview?.fromGatePasses && deleteStatus.preview.fromGatePasses.length > 0 && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {deleteStatus.preview.fromGatePasses.map((gp) => gp.gatePassNumber).filter(Boolean).join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {deleteStatus.blockingRecords.toGatePasses > 0 && (
                      <div className="flex items-start gap-3 p-3 border rounded-lg">
                        <FileText className="h-5 w-5 text-green-500 mt-0.5" />
                        <div className="flex-1">
                          <div className="font-medium">
                            Incoming Gate Passes: {deleteStatus.blockingRecords.toGatePasses}
                          </div>
                          {deleteStatus.preview?.toGatePasses && deleteStatus.preview.toGatePasses.length > 0 && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {deleteStatus.preview.toGatePasses.map((gp) => gp.gatePassNumber).filter(Boolean).join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Confirm Deletion</AlertTitle>
                    <AlertDescription>
                      Are you sure you want to delete <strong>{warehouseToDelete?.name}</strong>?
                      This action cannot be undone.
                    </AlertDescription>
                  </Alert>
                </>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDeleteDialogOpen(false);
                    setWarehouseToDelete(null);
                    setDeleteStatus(null);
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                {deleteStatus.canDelete && (
                  <Button
                    variant="destructive"
                    onClick={handleConfirmDelete}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Deleting...' : 'Delete Warehouse'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { locationApi, articleApi, stockApi } from '@/lib/api';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { StockRequisition, Location, Article, UserRole, StockItem } from '@/types';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { formatArticleReedPickLine } from '@/lib/poItemReedPick';
import { formatDate } from '@/lib/utils';

interface StockTransferModuleProps {
  userRole: UserRole;
  userId: string;
}

export const StockTransferModule = ({ userRole, userId }: StockTransferModuleProps) => {
  const [requisitions, setRequisitions] = useState<StockRequisition[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedArticles, setSelectedArticles] = useState<{ articleId: string; quantity: number | ''; unit: string }[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  /** Seed one article row when opening the dialog (matches requisition form UX). */
  useEffect(() => {
    if (!isAddDialogOpen) return;
    setSelectedArticles((prev) =>
      prev.length === 0 ? [{ articleId: '', quantity: '' as any, unit: '' }] : prev
    );
  }, [isAddDialogOpen]);

  const loadData = async () => {
    try {
      const [apiLocations, apiArticles, apiStock] = await Promise.all([
        locationApi.getAll(),
        articleApi.getAll(),
        stockApi.getAll(),
      ]);
      setLocations(apiLocations);
      setArticles(apiArticles);
      setStockItems(apiStock);
      const stored = storage.get<StockRequisition>(STORAGE_KEYS.REQUISITIONS);
      const sorted = [...stored].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setRequisitions(sorted);
    } catch (error) {
      console.error('Error loading data:', error);
      const stored = storage.get<StockRequisition>(STORAGE_KEYS.REQUISITIONS);
      setRequisitions(
        [...stored].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      );
      setLocations([]);
      setArticles([]);
      setStockItems([]);
    }
  };

  const handleCreateRequisition = () => {
    const validItems = selectedArticles.filter((a) => a.articleId && a.quantity >= 1 && a.unit);
    if (!fromLocation || !toLocation || validItems.length === 0) {
      toast.error('Please select locations and at least one article with quantity and unit');
      return;
    }

    const requestedByArticle = validItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.articleId] = (acc[item.articleId] || 0) + Number(item.quantity || 0);
      return acc;
    }, {});

    for (const [articleId, requestedQty] of Object.entries(requestedByArticle)) {
      const availableQty = getAvailableQuantity(articleId);
      if (requestedQty > availableQty) {
        const articleName = articles.find((a) => a.id === articleId)?.name || 'Selected article';
        toast.error(`${articleName}: requested ${requestedQty} exceeds available ${availableQty}`);
        return;
      }
    }

    // Generate a date-wise sequential requisition number (e.g., REQ-20260331-001)
    const generateRequisitionNumber = () => {
      const today = new Date();
      const todayKey = today.toISOString().split('T')[0]; // yyyy-mm-dd
      const existing = storage.get<StockRequisition>(STORAGE_KEYS.REQUISITIONS) || [];

      const todaysCount = existing.filter((req) => {
        const createdKey = new Date(req.createdAt).toISOString().split('T')[0];
        return createdKey === todayKey;
      }).length;

      const sequence = String(todaysCount + 1).padStart(3, '0');
      const datePart = todayKey.replace(/-/g, '');
      return `REQ-${datePart}-${sequence}`;
    };

    const newRequisition: StockRequisition = {
      id: Date.now().toString(),
      requisitionNumber: generateRequisitionNumber(),
      requestedBy: userId,
      fromLocationId: fromLocation,
      toLocationId: toLocation,
      items: validItems,
      status: 'requested',
      createdAt: new Date().toISOString(),
      notes,
    };

    storage.add(STORAGE_KEYS.REQUISITIONS, newRequisition);
    toast.success('Stock requisition created successfully');
    setIsAddDialogOpen(false);
    resetForm();
    loadData();
  };

  const addArticleToRequisition = () => {
    setSelectedArticles([...selectedArticles, { articleId: '', quantity: '' as any, unit: '' }]);
  };

  const updateArticle = (index: number, field: 'articleId' | 'quantity' | 'unit', value: string | number) => {
    const updated = [...selectedArticles];
    const next = { ...updated[index], [field]: value };

    if (field === 'articleId') {
      const selected = articles.find((a) => a.id === value);
      next.unit = selected?.unit || '';

      const remainingForSelection = getRemainingQuantityForRow(index, String(value));
      if (remainingForSelection <= 0) {
        next.quantity = 1;
      } else if (next.quantity > remainingForSelection) {
        next.quantity = remainingForSelection;
      }
    }

    if (field === 'quantity') {
      const raw = String(value);

      // Allow the user to clear the field temporarily without snapping back to 1.
      if (raw.trim() === '') {
        next.quantity = '' as any;
      } else {
        const numericQuantity = Math.max(1, Number(raw) || 1);
        const targetArticleId = next.articleId;

        // If we have a selected article and a source location, enforce available quantity.
        if (targetArticleId && fromLocation) {
          const remaining = getRemainingQuantityForRow(index, targetArticleId);
          if (numericQuantity > remaining && remaining >= 0) {
            next.quantity = Math.max(1, remaining);
            const articleName = articles.find((a) => a.id === targetArticleId)?.name || 'Selected article';
            toast.error(`${articleName}: maximum available is ${remaining}`);
          } else {
            next.quantity = numericQuantity;
          }
        } else {
          // No location / article yet: just set the numeric value (min 1) so the user can type.
          next.quantity = numericQuantity;
        }
      }
    }

    updated[index] = next;
    setSelectedArticles(updated);
  };

  const removeArticle = (index: number) => {
    setSelectedArticles(selectedArticles.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setFromLocation('');
    setToLocation('');
    setNotes('');
    setSelectedArticles([]);
  };

  const locationTypeLabel = (type: Location['type']) => {
    if (type === 'salepoint') return 'sale point';
    return type;
  };

  const formatLocationOption = (location: Location) =>
    `${location.name} (${locationTypeLabel(location.type)})`;

  const warehouseLocations = locations.filter((l) => l.type === 'godown');

  const getAvailableQuantity = (articleId: string) => {
    if (!fromLocation || !articleId) return 0;
    return stockItems
      .filter((item) => item.locationId === fromLocation && item.articleId === articleId)
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  };

  const getRemainingQuantityForRow = (rowIndex: number, articleId: string) => {
    const available = getAvailableQuantity(articleId);
    const usedInOtherRows = selectedArticles.reduce((sum, row, idx) => {
      if (idx === rowIndex) return sum;
      if (row.articleId !== articleId) return sum;
      return sum + Number(row.quantity || 0);
    }, 0);
    return Math.max(0, available - usedInOtherRows);
  };

  const getArticleLotForSource = (articleId: string) => {
    if (!fromLocation) return undefined;
    return stockItems.find(
      (item) => item.locationId === fromLocation && item.articleId === articleId && item.quantity > 0 && item.lotNo
    )?.lotNo;
  };

  const getArticleOptionLabel = (article: Article) => {
    const reedPick = formatArticleReedPickLine(article);
    const lotNo = getArticleLotForSource(article.id) || article.lotNumber;
    const parts = [article.name];
    if (reedPick) parts.push(`Reed: ${reedPick}`);
    if (lotNo) parts.push(`Lot: ${lotNo}`);
    return parts.join(' | ');
  };

  const selectableArticles = fromLocation
    ? articles.filter((article) =>
        stockItems.some(
          (item) => item.locationId === fromLocation && item.articleId === article.id && item.quantity > 0
        )
      )
    : articles;

  const allUnits = Array.from(new Set(articles.map((a) => a.unit).filter(Boolean)));

  const getLocationDisplay = (id: string) => {
    const loc = locations.find((l) => l.id === id);
    if (!loc) return 'Unknown';
    return formatLocationOption(loc);
  };

  /** Outlets request stock; warehouse/inventory often initiate; owner has full access. */
  const canCreateRequisition =
    userRole === 'outlet' ||
    userRole === 'owner' ||
    userRole === 'warehouse' ||
    userRole === 'inventory_controller';

  const getStatusBadge = (status: StockRequisition['status']) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      requested: 'secondary',
      approved: 'default',
      rejected: 'destructive',
      dispatched: 'outline',
      received: 'default',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  return (
    <Card className="rounded-xl border bg-card shadow-sm">
      <CardHeader className="flex flex-col gap-4 space-y-0 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="space-y-1">
          <CardTitle className="text-xl font-semibold tracking-tight">
            Stock Transfer & Requisitions
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Create and track transfer requests. Approve pending requisitions under{' '}
            <span className="font-medium text-foreground">Approvals</span>, then create a gate pass under{' '}
            <span className="font-medium text-foreground">Gate Pass</span> (Transfer Request).
          </CardDescription>
        </div>
        {canCreateRequisition && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="mr-2 h-4 w-4" />
                Create Requisition
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0 sm:rounded-xl">
              <DialogHeader className="space-y-1 border-b px-6 py-5 pr-14 text-left">
                <DialogTitle className="text-lg font-semibold">Create Stock Requisition</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Request stock transfer between warehouse locations
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-5 px-6 py-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="requisition-from" className="text-sm font-medium">
                      From Location
                    </Label>
                    <Select value={fromLocation} onValueChange={setFromLocation}>
                      <SelectTrigger id="requisition-from" className="w-full">
                        <SelectValue placeholder="Select source" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouseLocations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {formatLocationOption(location)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="requisition-to" className="text-sm font-medium">
                      To Location
                    </Label>
                    <Select value={toLocation} onValueChange={setToLocation}>
                      <SelectTrigger id="requisition-to" className="w-full">
                        <SelectValue placeholder="Select destination" />
                      </SelectTrigger>
                      <SelectContent>
                        {warehouseLocations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {formatLocationOption(location)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-medium">Articles</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 border-foreground/20 bg-background"
                      onClick={addArticleToRequisition}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Article
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {selectedArticles.map((item, index) => (
                      <div key={index} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                        <Select
                          value={item.articleId}
                          onValueChange={(v) => updateArticle(index, 'articleId', v)}
                        >
                          <SelectTrigger className="min-w-0 flex-1">
                            <SelectValue placeholder="Select article" />
                          </SelectTrigger>
                          <SelectContent>
                            {selectableArticles.map((article) => (
                              <SelectItem key={article.id} value={article.id}>
                                {getArticleOptionLabel(article)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min={1}
                          max={item.articleId ? getRemainingQuantityForRow(index, item.articleId) : undefined}
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => updateArticle(index, 'quantity', e.target.value)}
                          className="h-10 w-20 shrink-0 sm:w-24"
                        />
                        <Select
                          value={item.unit}
                          onValueChange={(v) => updateArticle(index, 'unit', v)}
                        >
                          <SelectTrigger className="h-10 w-24 shrink-0 sm:w-28">
                            <SelectValue placeholder="Unit" />
                          </SelectTrigger>
                          <SelectContent>
                            {allUnits.map((unit) => (
                              <SelectItem key={unit} value={unit}>
                                {unit}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="h-10 w-10 shrink-0"
                          onClick={() => removeArticle(index)}
                          aria-label="Remove article row"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="requisition-notes" className="text-sm font-medium">
                    Reason (Optional)
                  </Label>
                  <Textarea
                    id="requisition-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add transfer reason..."
                    className="min-h-[100px] resize-y"
                  />
                </div>

                <Button
                  type="button"
                  onClick={handleCreateRequisition}
                  className="h-11 w-full font-medium"
                >
                  Create Requisition
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-muted-foreground font-medium">Req. #</TableHead>
              <TableHead className="text-muted-foreground font-medium">From</TableHead>
              <TableHead className="text-muted-foreground font-medium">To</TableHead>
              <TableHead className="text-muted-foreground font-medium">Items</TableHead>
              <TableHead className="text-muted-foreground font-medium">Status</TableHead>
              <TableHead className="text-muted-foreground font-medium">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requisitions.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={6}
                  className="h-32 text-center align-middle text-muted-foreground"
                >
                  No requisitions found
                </TableCell>
              </TableRow>
            ) : (
              requisitions.map(req => (
                <TableRow key={req.id}>
                  <TableCell className="font-medium">{req.requisitionNumber}</TableCell>
                  <TableCell>{getLocationDisplay(req.fromLocationId)}</TableCell>
                  <TableCell>{getLocationDisplay(req.toLocationId)}</TableCell>
                  <TableCell>{req.items.length} items</TableCell>
                  <TableCell>{getStatusBadge(req.status)}</TableCell>
                  <TableCell>{formatDate(req.createdAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );
};

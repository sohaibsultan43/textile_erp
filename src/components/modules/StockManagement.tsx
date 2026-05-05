import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AppDatePicker } from '@/components/ui/app-date-picker';
import { StockItem, Article, Location, UserRole, PurchaseOrder, GRN, StockLedgerResponse, Voucher, DyeingReceive } from '@/types';
import { Search, Eye, Plus } from 'lucide-react';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { toast } from '@/hooks/use-toast';
import { stockApi, articleApi, locationApi, purchaseOrderApi, grnApi } from '@/lib/api';
import { buildPendingReceiptMap, pendingStockRowKey } from '@/lib/pendingStockFromPo';
import { formatArticleReedPickLine } from '@/lib/poItemReedPick';
import { formatDate } from '@/lib/utils';

interface StockManagementProps {
  userRole: UserRole;
}

export const StockManagement = ({ userRole }: StockManagementProps) => {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [grns, setGrns] = useState<GRN[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [dyeingReceives, setDyeingReceives] = useState<DyeingReceive[]>([]);
  const [activeView, setActiveView] = useState('available');
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [ledgerArticleId, setLedgerArticleId] = useState<string | null>(null);
  const [ledgerData, setLedgerData] = useState<StockLedgerResponse | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerLocationId, setLedgerLocationId] = useState('all');
  const [ledgerStartDate, setLedgerStartDate] = useState('');
  const [ledgerEndDate, setLedgerEndDate] = useState('');
  const [ledgerSearch, setLedgerSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [apiStock, apiArticles, apiLocations, apiPOs, apiGrns] = await Promise.all([
        stockApi.getAll(),
        articleApi.getAll(),
        locationApi.getAll(),
        purchaseOrderApi.getAll().catch(() => [] as PurchaseOrder[]),
        grnApi.getAll().catch(() => [] as GRN[]),
      ]);
      setStock(apiStock);
      setArticles(apiArticles);
      setLocations(apiLocations);
      setPurchaseOrders(apiPOs);
      setGrns(apiGrns);
      
      const storedVouchers = storage.get<Voucher>(STORAGE_KEYS.VOUCHERS);
      setVouchers(storedVouchers);

      const storedReceives = storage.get<DyeingReceive>(STORAGE_KEYS.DYEING_RECEIVES);
      setDyeingReceives(storedReceives);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data. Please check your connection and try again.');
      setStock([]);
      setArticles([]);
      setLocations([]);
      setPurchaseOrders([]);
      setGrns([]);
    }
  };

  useEffect(() => {
    if (!isLedgerOpen || !ledgerArticleId) return;

    const fetchLedger = async () => {
      try {
        setLedgerLoading(true);
        const data = await stockApi.getLedger(ledgerArticleId, {
          locationId: ledgerLocationId === 'all' ? undefined : ledgerLocationId,
          startDate: ledgerStartDate || undefined,
          endDate: ledgerEndDate || undefined,
        });
        setLedgerData(data);
      } catch (error) {
        console.error('Error loading ledger:', error);
        toast.error('Failed to load article ledger');
        setLedgerData(null);
      } finally {
        setLedgerLoading(false);
      }
    };

    fetchLedger();
  }, [isLedgerOpen, ledgerArticleId, ledgerLocationId, ledgerStartDate, ledgerEndDate]);

  const pendingReceiptMap = useMemo(
    () => buildPendingReceiptMap(stock, purchaseOrders, grns, locations),
    [stock, purchaseOrders, grns, locations]
  );

  const handleArticleChange = (articleId: string) => {
    setSelectedArticle(articleId);
    const article = articles.find(a => a.id === articleId);
    if (article?.cost) {
      setPrice(article.cost.toString());
    } else if (article?.salePrice) {
      setPrice(article.salePrice.toString());
    } else {
      setPrice('');
    }
  };

  const handleAddStock = async () => {
    if (!selectedArticle || !selectedLocation || !quantity || !price) {
      toast.error('Please fill all fields');
      return;
    }

    const qty = parseInt(quantity);
    const priceValue = parseFloat(price);

    if (qty <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    if (priceValue < 0) {
      toast.error('Price cannot be negative');
      return;
    }

    try {
      await stockApi.create({
        articleId: selectedArticle,
        locationId: selectedLocation,
        quantity: qty,
        pricePerUnit: priceValue,
      });
      
      toast.success('Stock added successfully');
      setIsAddDialogOpen(false);
      resetForm();
      await loadData();
    } catch (error) {
      console.error('Error adding stock:', error);
      toast.error('Failed to add stock');
    }
  };

  const resetForm = () => {
    setSelectedArticle('');
    setSelectedLocation('');
    setQuantity('');
    setPrice('');
  };

  const openLedger = (articleId: string, locationId?: string) => {
    setLedgerArticleId(articleId);
    setLedgerLocationId(locationId || 'all');
    setLedgerStartDate('');
    setLedgerEndDate('');
    setLedgerSearch('');
    setIsLedgerOpen(true);
  };

  const getArticleName = useCallback((id: string) => {
    return articles.find(a => a.id === id)?.name || id;
  }, [articles]);

  const getArticleReedPick = useCallback((id: string) => {
    const art = articles.find(a => a.id === id);
    if (!art) return '-';
    return `${art.reed || '-'} / ${art.pick || '-'}`;
  }, [articles]);

  const getArticleLot = useCallback((id: string, itemLot?: string) => {
    const art = articles.find(a => a.id === id);
    return art?.lotNumber || itemLot || '-';
  }, [articles]);

  const getArticleGrade = useCallback((id: string) => {
    const art = articles.find(a => a.id === id);
    return art?.grade || '';
  }, [articles]);

  const getLocationName = useCallback((id: string) => {
    return locations.find(l => l.id === id)?.name || id;
  }, [locations]);

  const canModify = userRole === 'owner' || userRole === 'warehouse';

  const getLotTokens = (lotNo?: string | null) =>
    String(lotNo || '')
      .split(',')
      .map((lot) => lot.trim().toLowerCase())
      .filter(Boolean);

  const hasLotOverlap = (leftLot?: string | null, rightLot?: string | null) => {
    const leftTokens = getLotTokens(leftLot);
    const rightTokens = new Set(getLotTokens(rightLot));
    return leftTokens.some((token) => rightTokens.has(token));
  };

  const filteredStock = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return stock;

    return stock.filter((item) => {
      const articleName = getArticleName(item.articleId).toLowerCase();
      const reedPick = getArticleReedPick(item.articleId).toLowerCase();
      const lot = getArticleLot(item.articleId, item.lotNo).toLowerCase();
      const grade = (getArticleGrade(item.articleId) || '-').toLowerCase();
      const locationName = getLocationName(item.locationId).toLowerCase();
      return (
        articleName.includes(q) ||
        reedPick.includes(q) ||
        lot.includes(q) ||
        grade.includes(q) ||
        locationName.includes(q)
      );
    });
  }, [stock, searchQuery, getArticleName, getArticleReedPick, getArticleLot, getArticleGrade, getLocationName]);

  const ledgerArticle = useMemo(() => articles.find((a) => a.id === ledgerArticleId) || null, [articles, ledgerArticleId]);

  const filteredLedgerEntries = useMemo(() => {
    if (!ledgerData?.entries) return [];
    const q = ledgerSearch.trim().toLowerCase();
    if (!q) return ledgerData.entries;

    return ledgerData.entries.filter((entry) => {
      const parts = [
        entry.referenceNumber || '',
        entry.remarks || '',
        entry.locationName || '',
        entry.supplierName || '',
        entry.poNumber || '',
      ].map((val) => val.toLowerCase());

      return parts.some((part) => part.includes(q));
    });
  }, [ledgerData, ledgerSearch]);

  return (
    <>
      <Tabs value={activeView} onValueChange={setActiveView} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="available">Available Stock</TabsTrigger>
          <TabsTrigger value="final-received">Final Received</TabsTrigger>
        </TabsList>

        <TabsContent value="available">
          <Card>
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-1">
                <CardTitle>On-Hand Inventory</CardTitle>
                <CardDescription>
                  Manage inventory across all locations.
                </CardDescription>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="relative w-full max-w-2xl flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search article, reed/pick, lot, grade, location"
                    className="pl-9"
                  />
                </div>
                {canModify && (
                  <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="shrink-0">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Stock
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Add Stock</DialogTitle>
                        <DialogDescription>Add new stock items to inventory</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-5">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Article</Label>
                            <Select value={selectedArticle} onValueChange={handleArticleChange}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select article" />
                              </SelectTrigger>
                              <SelectContent>
                                {articles.map(article => (
                                  <SelectItem key={article.id} value={article.id}>
                                    {article.name}
                                    {article.fabricType && ` - ${article.fabricType}`}
                                    {article.color && ` (${article.color})`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Location</Label>
                            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select location" />
                              </SelectTrigger>
                              <SelectContent>
                                {locations.map(location => (
                                  <SelectItem key={location.id} value={location.id}>
                                    {location.name} ({location.type})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label>Quantity</Label>
                              <span className="text-xs text-muted-foreground">Min 1</span>
                            </div>
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              placeholder="Enter quantity"
                              value={quantity}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '' || parseInt(value) >= 0) {
                                  setQuantity(value);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === '-' || e.key === 'e' || e.key === '.') e.preventDefault();
                              }}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label>Price Per Unit (PKR)</Label>
                              <span className="text-xs text-muted-foreground">Auto-fills from article</span>
                            </div>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              placeholder="Enter price"
                              value={price}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '' || parseFloat(value) >= 0) {
                                  setPrice(value);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === '-' || e.key === 'e') e.preventDefault();
                              }}
                            />
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <Button onClick={handleAddStock} className="w-full sm:w-auto sm:px-6">Add Stock</Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Article</TableHead>
                    <TableHead>Reed / Pick</TableHead>
                    <TableHead>Lot</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Pending receipt</TableHead>
                    <TableHead>Total value</TableHead>
                    <TableHead className="w-32">Ledger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStock.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        No stock items found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStock.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{getArticleName(item.articleId)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{getArticleReedPick(item.articleId)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{getArticleLot(item.articleId, item.lotNo)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {getArticleGrade(item.articleId) ? (
                            <Badge variant="outline" className="whitespace-nowrap text-[11px] px-2 py-0">
                              Grade {getArticleGrade(item.articleId)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{getLocationName(item.locationId)}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>
                          {pendingReceiptMap.get(pendingStockRowKey(item.articleId, item.locationId)) ?? 0}
                        </TableCell>
                        <TableCell>
                          PKR {(item.quantity * item.pricePerUnit).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openLedger(item.articleId, item.locationId)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View ledger
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="final-received" className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Processing Stock</CardTitle>
                <CardContent className="p-0 pt-1">
                  <div className="text-2xl font-bold">
                    {dyeingReceives
                      .filter(r => !vouchers.some(v => hasLotOverlap(v.lotNo, r.lotNo)))
                      .reduce((sum, r) => sum + r.tiyarMeters, 0)
                      .toFixed(1)}m
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Pending final warehouse delivery</p>
                </CardContent>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Finalized Stock</CardTitle>
                <CardContent className="p-0 pt-1">
                  <div className="text-2xl font-bold text-primary">
                    {vouchers.reduce((sum, v) => sum + v.totalMeters, 0).toFixed(1)}m
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Total finished volume in godowns</p>
                </CardContent>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="py-4">
                <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground">Total Production</CardTitle>
                <CardContent className="p-0 pt-1">
                  <div className="text-2xl font-bold">
                    {(vouchers.reduce((sum, v) => sum + v.totalMeters, 0) + 
                      dyeingReceives.filter(r => !vouchers.some(v => hasLotOverlap(v.lotNo, r.lotNo))).reduce((sum, r) => sum + r.tiyarMeters, 0))
                      .toFixed(1)}m
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Grand total throughput</p>
                </CardContent>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Production & Receipt History</CardTitle>
              <CardDescription>Comprehensive tracking of all production lots from initial receipt to final storage.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Lot No</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Quality / Shade</TableHead>
                    <TableHead className="text-right">Meters</TableHead>
                    <TableHead className="text-right">Thans</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* We combine Receives (Processing) and Vouchers (Final) into one list sorted by date */}
                  {(() => {
                    const processingList = dyeingReceives
                      .filter(r => !vouchers.some(v => hasLotOverlap(v.lotNo, r.lotNo)))
                      .map(r => ({
                        id: r.id,
                        date: r.receiveDate,
                        lotNo: r.lotNo,
                        status: 'processing',
                        quality: r.quality,
                        shade: r.colour,
                        meters: r.tiyarMeters,
                        thans: r.tiyarThan,
                        ref: r.receiveNumber
                      }));

                    const finalList = vouchers.map(v => ({
                      id: v.id,
                      date: v.transferDate,
                      lotNo: v.lotNo,
                      status: 'finalized',
                      quality: v.lines[0]?.quality || '-',
                      shade: v.lines[0]?.shade || '-',
                      meters: v.totalMeters,
                      thans: v.totalThans,
                      ref: v.voucherNumber
                    }));

                    const combined = [...processingList, ...finalList].sort((a, b) => 
                      new Date(b.date).getTime() - new Date(a.date).getTime()
                    );

                    if (combined.length === 0) {
                      return (
                        <TableRow>
                          <TableCell colSpan={7} className="h-32 text-center text-muted-foreground italic">
                            No production activity recorded yet.
                          </TableCell>
                        </TableRow>
                      );
                    }

                    return combined.map((item, idx) => (
                      <TableRow key={`${item.id}-${idx}`}>
                        <TableCell className="text-sm">{item.date}</TableCell>
                        <TableCell className="font-medium">{item.lotNo}</TableCell>
                        <TableCell>
                          <Badge variant={item.status === 'finalized' ? 'default' : 'secondary'} className="text-[10px] uppercase">
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-xs">
                            <span className="font-semibold">{item.quality}</span>
                            <span className="text-muted-foreground">{item.shade}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{item.meters.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{item.thans}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end items-center gap-1 text-xs text-muted-foreground">
                            <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">{item.ref}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ));
                  })()}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={isLedgerOpen}
        onOpenChange={(open) => {
          setIsLedgerOpen(open);
          if (!open) {
            setLedgerArticleId(null);
            setLedgerData(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Article Ledger</DialogTitle>
            <DialogDescription>Track receipts and stock snapshot for a single article.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {ledgerArticle?.name || ledgerData?.article?.name || 'Select an article'}
              </p>
              <p className="text-xs text-muted-foreground">
                Unit: {ledgerData?.article?.unit || ledgerArticle?.unit || '-'}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Select value={ledgerLocationId} onValueChange={setLedgerLocationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All locations</SelectItem>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>From</Label>
                <AppDatePicker value={ledgerStartDate} onChange={setLedgerStartDate} />
              </div>
              <div className="space-y-1.5">
                <Label>To</Label>
                <AppDatePicker value={ledgerEndDate} onChange={setLedgerEndDate} />
              </div>
              <div className="space-y-1.5">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={ledgerSearch}
                    onChange={(e) => setLedgerSearch(e.target.value)}
                    placeholder="Search ref, location, notes"
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Card className="border-l-4 border-l-green-500">
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-muted-foreground">Total received</p>
                  <p className="text-lg font-semibold">
                    {ledgerData?.summary ? ledgerData.summary.totalIn.toLocaleString() : '—'}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-amber-500">
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-muted-foreground">Total issued</p>
                  <p className="text-lg font-semibold">
                    {ledgerData?.summary ? ledgerData.summary.totalOut.toLocaleString() : '—'}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-blue-500">
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-muted-foreground">Net movement</p>
                  <p className="text-lg font-semibold">
                    {ledgerData?.summary ? ledgerData.summary.net.toLocaleString() : '—'}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-purple-500">
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-muted-foreground">Current stock (snapshot)</p>
                  <p className="text-lg font-semibold">
                    {ledgerData?.summary ? ledgerData.summary.currentStock.toLocaleString() : '—'}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {ledgerData?.summary?.stockByLocation?.map((stock) => (
                  <Badge key={`${stock.locationId}-${stock.locationName}`} variant="secondary">
                    {stock.locationName}: {stock.quantity.toLocaleString()}
                  </Badge>
                ))}
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Qty In</TableHead>
                      <TableHead className="text-right">Qty Out</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledgerLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          Loading ledger...
                        </TableCell>
                      </TableRow>
                    ) : filteredLedgerEntries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          No ledger entries found for this selection
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLedgerEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(entry.date)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col text-sm">
                              <span className="font-medium">{entry.referenceNumber || 'N/A'}</span>
                              {entry.poNumber && (
                                <span className="text-xs text-muted-foreground">PO {entry.poNumber}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="uppercase">{entry.type}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{entry.locationName || 'Unknown'}</div>
                              {entry.supplierName && (
                                <div className="text-xs text-muted-foreground">Supplier: {entry.supplierName}</div>
                              )}
                              {entry.lotNo && (
                                <div className="text-xs text-muted-foreground">Lot: {entry.lotNo}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{entry.quantityIn.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{entry.quantityOut.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            {entry.value !== null && entry.value !== undefined
                              ? `PKR ${entry.value.toLocaleString()}`
                              : entry.pricePerUnit
                              ? `@ ${entry.pricePerUnit.toLocaleString()}`
                              : '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {entry.remarks || '—'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

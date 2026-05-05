import { useState, useEffect } from 'react';
import { UserRole, ProductionOrder, ProductionOrderItem, Process, Article, Location, MaterialIssue, MaterialReceipt, MaterialIssueItem, MaterialReceiptItem, InventoryStage, StockItem } from '@/types';
import { productionOrderApi, articleApi, locationApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, PlayCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { formatDate } from '@/lib/utils';

interface ProductionModuleProps {
  userRole: UserRole;
  userId: string;
}

export const ProductionModule = ({ userRole, userId }: ProductionModuleProps) => {
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [materialIssues, setMaterialIssues] = useState<MaterialIssue[]>([]);
  const [materialReceipts, setMaterialReceipts] = useState<MaterialReceipt[]>([]);

  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false);

  const [selectedProcessId, setSelectedProcessId] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [orderItems, setOrderItems] = useState<ProductionOrderItem[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState('');
  const [inputQuantity, setInputQuantity] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  const [selectedOrderForIssue, setSelectedOrderForIssue] = useState('');
  const [issueItems, setIssueItems] = useState<MaterialIssueItem[]>([]);
  const [issueFromLocation, setIssueFromLocation] = useState('');

  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState('');
  const [receiptItems, setReceiptItems] = useState<MaterialReceiptItem[]>([]);
  const [receiptToLocation, setReceiptToLocation] = useState('');

  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [apiOrders, apiArticles, apiLocations] = await Promise.all([
        productionOrderApi.getAll(),
        articleApi.getAll(),
        locationApi.getAll(),
      ]);
      setProductionOrders(apiOrders);
      setArticles(apiArticles);
      setLocations(apiLocations);
      // TODO: Load processes, materialIssues, materialReceipts from API when APIs are available
      setProcesses([]);
      setMaterialIssues([]);
      setMaterialReceipts([]);
    } catch (error) {
      console.error('Error loading data:', error);
      setProductionOrders([]);
      setProcesses([]);
      setArticles([]);
      setLocations([]);
      setMaterialIssues([]);
      setMaterialReceipts([]);
    }
  };

  const canCreateOrder = ['owner', 'production_manager'].includes(userRole);
  const canIssueMaterial = ['owner', 'warehouse', 'inventory_controller'].includes(userRole);
  const canReceiveMaterial = ['owner', 'warehouse', 'inventory_controller', 'production_manager'].includes(userRole);

  // Production Order Functions
  const addItemToOrder = () => {
    if (!selectedArticleId || !inputQuantity || !selectedProcessId) {
      toast({ title: "Error", description: "Please fill all fields", variant: "destructive" });
      return;
    }

    const qty = parseFloat(inputQuantity);
    const process = processes.find(p => p.id === selectedProcessId);
    if (!process) return;

    const expectedOutput = qty * (1 - process.wastagePercent / 100);

    const newItem: ProductionOrderItem = {
      articleId: selectedArticleId,
      inputQuantity: qty,
      expectedOutput: expectedOutput,
    };

    setOrderItems([...orderItems, newItem]);
    setSelectedArticleId('');
    setInputQuantity('');
  };

  const removeItemFromOrder = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleCreateOrder = () => {
    if (!selectedProcessId || !selectedLocationId || orderItems.length === 0) {
      toast({ title: "Error", description: "Please complete all fields", variant: "destructive" });
      return;
    }

    const orderNumber = `PO-${Date.now()}`;

    const newOrder: ProductionOrder = {
      id: Date.now().toString(),
      orderNumber,
      processId: selectedProcessId,
      items: orderItems,
      status: 'submitted',
      createdAt: new Date().toISOString(),
      createdBy: userId,
      locationId: selectedLocationId,
      notes: orderNotes,
    };

    storage.add(STORAGE_KEYS.PRODUCTION_ORDERS, newOrder);
    toast({ title: "Success", description: `Production Order ${orderNumber} created` });

    resetOrderForm();
    setIsOrderDialogOpen(false);
    loadData();
  };

  const resetOrderForm = () => {
    setSelectedProcessId('');
    setSelectedLocationId('');
    setOrderItems([]);
    setOrderNotes('');
  };

  // Material Issue Functions
  const handleSelectOrderForIssue = (orderId: string) => {
    setSelectedOrderForIssue(orderId);
    const order = productionOrders.find(o => o.id === orderId);
    if (order) {
      const process = processes.find(p => p.id === order.processId);
      const items: MaterialIssueItem[] = order.items.map(item => ({
        articleId: item.articleId,
        quantity: item.inputQuantity,
        stage: process?.inputType || 'RM',
      }));
      setIssueItems(items);
    }
  };

  const handleIssueMaterial = () => {
    if (!selectedOrderForIssue || !issueFromLocation || issueItems.length === 0) {
      toast({ title: "Error", description: "Please complete all fields", variant: "destructive" });
      return;
    }

    const issueNumber = `MI-${Date.now()}`;

    const newIssue: MaterialIssue = {
      id: Date.now().toString(),
      issueNumber,
      productionOrderId: selectedOrderForIssue,
      items: issueItems,
      issuedBy: userId,
      issuedAt: new Date().toISOString(),
      fromLocationId: issueFromLocation,
    };

    storage.add(STORAGE_KEYS.MATERIAL_ISSUES, newIssue);

    // Deduct from stock
    const stock = storage.get<StockItem>(STORAGE_KEYS.STOCK);
    issueItems.forEach(item => {
      const stockItem = stock.find((s: StockItem) =>
        s.articleId === item.articleId &&
        s.locationId === issueFromLocation
      );
      if (stockItem) {
        stockItem.quantity -= item.quantity;
      }
    });
    storage.set(STORAGE_KEYS.STOCK, stock);

    // Update production order status
    storage.update<ProductionOrder>(STORAGE_KEYS.PRODUCTION_ORDERS, selectedOrderForIssue, {
      status: 'in_progress',
      startedAt: new Date().toISOString(),
    });

    toast({ title: "Success", description: `Material Issue ${issueNumber} created` });

    resetIssueForm();
    setIsIssueDialogOpen(false);
    loadData();
  };

  const resetIssueForm = () => {
    setSelectedOrderForIssue('');
    setIssueItems([]);
    setIssueFromLocation('');
  };

  // Material Receipt Functions
  const handleSelectOrderForReceipt = (orderId: string) => {
    setSelectedOrderForReceipt(orderId);
    const order = productionOrders.find(o => o.id === orderId);
    if (order) {
      const process = processes.find(p => p.id === order.processId);
      const items: MaterialReceiptItem[] = order.items.map(item => ({
        articleId: item.articleId,
        quantity: 0,
        stage: process?.outputType || 'WIP',
        wastageQuantity: 0,
      }));
      setReceiptItems(items);
    }
  };

  const updateReceiptItem = (index: number, field: keyof MaterialReceiptItem, value: number) => {
    const updated = [...receiptItems];
    updated[index] = { ...updated[index], [field]: value };
    setReceiptItems(updated);
  };

  const handleReceiveMaterial = () => {
    if (!selectedOrderForReceipt || !receiptToLocation || receiptItems.length === 0) {
      toast({ title: "Error", description: "Please complete all fields", variant: "destructive" });
      return;
    }

    const receiptNumber = `MR-${Date.now()}`;

    const newReceipt: MaterialReceipt = {
      id: Date.now().toString(),
      receiptNumber,
      productionOrderId: selectedOrderForReceipt,
      items: receiptItems,
      receivedBy: userId,
      receivedAt: new Date().toISOString(),
      toLocationId: receiptToLocation,
    };

    storage.add(STORAGE_KEYS.MATERIAL_RECEIPTS, newReceipt);

    // Add to stock
    const stock = storage.get<StockItem>(STORAGE_KEYS.STOCK);
    receiptItems.forEach(item => {
      if (item.quantity > 0) {
        const existingStock = stock.find((s: StockItem) =>
          s.articleId === item.articleId &&
          s.locationId === receiptToLocation
        );

        if (existingStock) {
          existingStock.quantity += item.quantity;
        } else {
          stock.push({
            id: Date.now().toString() + Math.random(),
            articleId: item.articleId,
            locationId: receiptToLocation,
            quantity: item.quantity,
            pricePerUnit: 0, // Cost calculation can be added
          });
        }
      }
    });
    storage.set(STORAGE_KEYS.STOCK, stock);

    // Update production order
    const order = productionOrders.find(o => o.id === selectedOrderForReceipt);
    if (order) {
      const updatedItems = order.items.map((item, index) => ({
        ...item,
        actualOutput: receiptItems[index].quantity,
        wastageQuantity: receiptItems[index].wastageQuantity,
      }));

      storage.update<ProductionOrder>(STORAGE_KEYS.PRODUCTION_ORDERS, selectedOrderForReceipt, {
        items: updatedItems,
        status: 'completed',
        completedAt: new Date().toISOString(),
      });
    }

    toast({ title: "Success", description: `Material Receipt ${receiptNumber} created` });

    resetReceiptForm();
    setIsReceiptDialogOpen(false);
    loadData();
  };

  const resetReceiptForm = () => {
    setSelectedOrderForReceipt('');
    setReceiptItems([]);
    setReceiptToLocation('');
  };

  const getProcessName = (id: string) => processes.find(p => p.id === id)?.name || 'Unknown';
  const getArticleName = (id: string) => articles.find(a => a.id === id)?.name || 'Unknown';
  const getLocationName = (id: string) => locations.find(l => l.id === id)?.name || 'Unknown';

  const getStatusBadge = (status: ProductionOrder['status']) => {
    const variants: Record<ProductionOrder['status'], "default" | "secondary" | "destructive" | "outline"> = {
      draft: "outline",
      submitted: "secondary",
      in_progress: "default",
      completed: "default",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status]}>{status.replace('_', ' ').toUpperCase()}</Badge>;
  };

  const getStageBadge = (stage: InventoryStage) => {
    const colors = {
      RM: "bg-green-100 text-green-800",
      WIP: "bg-blue-100 text-blue-800",
      FG: "bg-orange-100 text-orange-800",
    };
    return <span className={`px-2 py-1 rounded text-xs font-semibold ${colors[stage]}`}>{stage}</span>;
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="orders" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="orders">Production Orders</TabsTrigger>
          <TabsTrigger value="issues">Material Issue</TabsTrigger>
          <TabsTrigger value="receipts">Material Receipt</TabsTrigger>
          <TabsTrigger value="processes">Processes</TabsTrigger>
        </TabsList>

        {/* Production Orders Tab */}
        <TabsContent value="orders">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Production Orders</CardTitle>
                  <CardDescription>Manage production workflow from grey to pack</CardDescription>
                </div>
                {canCreateOrder && (
                  <Dialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        New Production Order
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Create Production Order</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Process</Label>
                            <Select value={selectedProcessId} onValueChange={setSelectedProcessId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select process" />
                              </SelectTrigger>
                              <SelectContent>
                                {processes.map(process => (
                                  <SelectItem key={process.id} value={process.id}>
                                    {process.name} (Wastage: {process.wastagePercent}%)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Location</Label>
                            <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select location" />
                              </SelectTrigger>
                              <SelectContent>
                                {locations.map(location => (
                                  <SelectItem key={location.id} value={location.id}>
                                    {location.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="border rounded-lg p-4 space-y-4">
                          <h3 className="font-semibold">Add Items</h3>
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <Label>Article</Label>
                              <Select value={selectedArticleId} onValueChange={setSelectedArticleId}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select article" />
                                </SelectTrigger>
                                <SelectContent>
                                  {articles.map(article => (
                                    <SelectItem key={article.id} value={article.id}>
                                      {article.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Input Quantity</Label>
                              <Input
                                type="number"
                                value={inputQuantity}
                                onChange={(e) => setInputQuantity(e.target.value)}
                                placeholder="0"
                              />
                            </div>
                            <div className="flex items-end">
                              <Button onClick={addItemToOrder} className="w-full">
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {orderItems.length > 0 && selectedProcessId && (
                            <div>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Article</TableHead>
                                    <TableHead>Input Qty</TableHead>
                                    <TableHead>Expected Output</TableHead>
                                    <TableHead>Wastage</TableHead>
                                    <TableHead></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {orderItems.map((item, index) => {
                                    const process = processes.find(p => p.id === selectedProcessId);
                                    const wastage = item.inputQuantity - item.expectedOutput;
                                    return (
                                      <TableRow key={index}>
                                        <TableCell>{getArticleName(item.articleId)}</TableCell>
                                        <TableCell>{item.inputQuantity}</TableCell>
                                        <TableCell className="text-green-600 font-medium">
                                          {item.expectedOutput.toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-orange-600">
                                          {wastage.toFixed(2)} ({process?.wastagePercent}%)
                                        </TableCell>
                                        <TableCell>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removeItemFromOrder(index)}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>

                        <div>
                          <Label>Notes</Label>
                          <Textarea
                            value={orderNotes}
                            onChange={(e) => setOrderNotes(e.target.value)}
                            placeholder="Additional notes..."
                          />
                        </div>

                        <Button onClick={handleCreateOrder} className="w-full">
                          Create Production Order
                        </Button>
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
                    <TableHead>Order #</TableHead>
                    <TableHead>Process</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productionOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No production orders yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    productionOrders.map(order => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.orderNumber}</TableCell>
                        <TableCell>{getProcessName(order.processId)}</TableCell>
                        <TableCell>{getLocationName(order.locationId)}</TableCell>
                        <TableCell>{order.items.length} items</TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell>{formatDate(order.createdAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Material Issue Tab */}
        <TabsContent value="issues">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Material Issue</CardTitle>
                  <CardDescription>Issue materials for production orders</CardDescription>
                </div>
                {canIssueMaterial && (
                  <Dialog open={isIssueDialogOpen} onOpenChange={setIsIssueDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <PlayCircle className="mr-2 h-4 w-4" />
                        Issue Material
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Issue Material for Production</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Production Order</Label>
                            <Select value={selectedOrderForIssue} onValueChange={handleSelectOrderForIssue}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select order" />
                              </SelectTrigger>
                              <SelectContent>
                                {productionOrders
                                  .filter(o => o.status === 'submitted')
                                  .map(order => (
                                    <SelectItem key={order.id} value={order.id}>
                                      {order.orderNumber} - {getProcessName(order.processId)}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Issue From Location</Label>
                            <Select value={issueFromLocation} onValueChange={setIssueFromLocation}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select location" />
                              </SelectTrigger>
                              <SelectContent>
                                {locations.map(location => (
                                  <SelectItem key={location.id} value={location.id}>
                                    {location.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {issueItems.length > 0 && (
                          <div className="border rounded-lg p-4">
                            <h3 className="font-semibold mb-4">Materials to Issue</h3>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Article</TableHead>
                                  <TableHead>Quantity</TableHead>
                                  <TableHead>Stage</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {issueItems.map((item, index) => (
                                  <TableRow key={index}>
                                    <TableCell>{getArticleName(item.articleId)}</TableCell>
                                    <TableCell>{item.quantity}</TableCell>
                                    <TableCell>{getStageBadge(item.stage)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}

                        <Button onClick={handleIssueMaterial} className="w-full">
                          Issue Material
                        </Button>
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
                    <TableHead>Issue #</TableHead>
                    <TableHead>Production Order</TableHead>
                    <TableHead>From Location</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materialIssues.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No material issues yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    materialIssues.map(issue => {
                      const order = productionOrders.find(o => o.id === issue.productionOrderId);
                      return (
                        <TableRow key={issue.id}>
                          <TableCell className="font-medium">{issue.issueNumber}</TableCell>
                          <TableCell>{order?.orderNumber || 'N/A'}</TableCell>
                          <TableCell>{getLocationName(issue.fromLocationId)}</TableCell>
                          <TableCell>{issue.items.length} items</TableCell>
                          <TableCell>{formatDate(issue.issuedAt)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Material Receipt Tab */}
        <TabsContent value="receipts">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Material Receipt</CardTitle>
                  <CardDescription>Receive completed production output</CardDescription>
                </div>
                {canReceiveMaterial && (
                  <Dialog open={isReceiptDialogOpen} onOpenChange={setIsReceiptDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Receive Material
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Receive Production Output</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Production Order</Label>
                            <Select value={selectedOrderForReceipt} onValueChange={handleSelectOrderForReceipt}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select order" />
                              </SelectTrigger>
                              <SelectContent>
                                {productionOrders
                                  .filter(o => o.status === 'in_progress')
                                  .map(order => (
                                    <SelectItem key={order.id} value={order.id}>
                                      {order.orderNumber} - {getProcessName(order.processId)}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Receive To Location</Label>
                            <Select value={receiptToLocation} onValueChange={setReceiptToLocation}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select location" />
                              </SelectTrigger>
                              <SelectContent>
                                {locations.map(location => (
                                  <SelectItem key={location.id} value={location.id}>
                                    {location.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {receiptItems.length > 0 && (
                          <div className="border rounded-lg p-4">
                            <h3 className="font-semibold mb-4">Record Output and Wastage</h3>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Article</TableHead>
                                  <TableHead>Expected</TableHead>
                                  <TableHead>Actual Output</TableHead>
                                  <TableHead>Wastage</TableHead>
                                  <TableHead>Stage</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {receiptItems.map((item, index) => {
                                  const order = productionOrders.find(o => o.id === selectedOrderForReceipt);
                                  const orderItem = order?.items[index];
                                  return (
                                    <TableRow key={index}>
                                      <TableCell>{getArticleName(item.articleId)}</TableCell>
                                      <TableCell>{orderItem?.expectedOutput.toFixed(2) || 0}</TableCell>
                                      <TableCell>
                                        <Input
                                          type="number"
                                          value={item.quantity}
                                          onChange={(e) => updateReceiptItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                          placeholder="0"
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <Input
                                          type="number"
                                          value={item.wastageQuantity}
                                          onChange={(e) => updateReceiptItem(index, 'wastageQuantity', parseFloat(e.target.value) || 0)}
                                          placeholder="0"
                                        />
                                      </TableCell>
                                      <TableCell>{getStageBadge(item.stage)}</TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}

                        <Button onClick={handleReceiveMaterial} className="w-full">
                          Complete Receipt
                        </Button>
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
                    <TableHead>Receipt #</TableHead>
                    <TableHead>Production Order</TableHead>
                    <TableHead>To Location</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materialReceipts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No material receipts yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    materialReceipts.map(receipt => {
                      const order = productionOrders.find(o => o.id === receipt.productionOrderId);
                      return (
                        <TableRow key={receipt.id}>
                          <TableCell className="font-medium">{receipt.receiptNumber}</TableCell>
                          <TableCell>{order?.orderNumber || 'N/A'}</TableCell>
                          <TableCell>{getLocationName(receipt.toLocationId)}</TableCell>
                          <TableCell>{receipt.items.length} items</TableCell>
                          <TableCell>{formatDate(receipt.receivedAt)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Processes Tab */}
        <TabsContent value="processes">
          <Card>
            <CardHeader>
              <CardTitle>Process Master</CardTitle>
              <CardDescription>View production processes and wastage rates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {processes.map(process => (
                  <Card key={process.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{process.name}</CardTitle>
                        <Badge>{process.stage}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Wastage Rate:</span>
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                            <span className="font-semibold text-orange-600">{process.wastagePercent}%</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Duration:</span>
                          <span className="font-medium">{process.duration} hours</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Flow:</span>
                          <div className="flex items-center gap-2">
                            {getStageBadge(process.inputType)}
                            <span>→</span>
                            {getStageBadge(process.outputType)}
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span>Output Efficiency</span>
                            <span className="font-medium">{100 - process.wastagePercent}%</span>
                          </div>
                          <Progress value={100 - process.wastagePercent} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

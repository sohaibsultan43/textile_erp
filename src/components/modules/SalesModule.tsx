import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { SaleOrder, SaleOrderItem, Customer, Article, Location, UserRole, Invoice } from '@/types';
import { Plus, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { saleOrderApi, customerApi, articleApi, locationApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';

interface SalesModuleProps {
  userRole: UserRole;
  userId: string;
}

export const SalesModule = ({ userRole, userId }: SalesModuleProps) => {
  const [sales, setSales] = useState<SaleOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [orderItems, setOrderItems] = useState<SaleOrderItem[]>([]);
  const [currentArticle, setCurrentArticle] = useState('');
  const [currentQuantity, setCurrentQuantity] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [paymentType, setPaymentType] = useState<'cash' | 'credit'>('credit');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [apiSales, apiCustomers, apiArticles, apiLocations] = await Promise.all([
        saleOrderApi.getAll(),
        customerApi.getAll(),
        articleApi.getAll(),
        locationApi.getAll(),
      ]);
      setSales(apiSales);
      setCustomers(apiCustomers);
      setArticles(apiArticles);
      setLocations(apiLocations.filter(l => l.type === 'salepoint'));
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data. Please check your connection and try again.');
      setSales([]);
      setCustomers([]);
      setArticles([]);
      setLocations([]);
    }
  };

  const addItemToOrder = () => {
    if (!currentArticle || !currentQuantity || !currentPrice) {
      toast.error('Please fill all item fields');
      return;
    }

    const newItem: SaleOrderItem = {
      articleId: currentArticle,
      quantity: parseInt(currentQuantity),
      pricePerUnit: parseFloat(currentPrice),
      totalPrice: parseInt(currentQuantity) * parseFloat(currentPrice),
    };

    setOrderItems([...orderItems, newItem]);
    setCurrentArticle('');
    setCurrentQuantity('');
    setCurrentPrice('');
  };

  const removeItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleCreateSale = async () => {
    if (!selectedCustomer || !selectedLocation || orderItems.length === 0) {
      toast.error('Please fill all fields and add at least one item');
      return;
    }

    const totalAmount = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
    
    try {
      await saleOrderApi.create({
        customerId: selectedCustomer,
        locationId: selectedLocation,
        items: orderItems,
        totalAmount,
        status: 'pending',
        paymentType,
        createdBy: userId,
      });
      
      toast.success('Sale order created successfully');
      setIsAddDialogOpen(false);
      resetForm();
      await loadData();
    } catch (error) {
      console.error('Error creating sale order:', error);
      toast.error('Failed to create sale order');
    }
  };

  const handleApproveSale = async (saleId: string) => {
    try {
      const sale = sales.find(s => s.id === saleId);
      if (!sale) return;

      const customer = customers.find(c => c.id === sale.customerId);
      if (!customer) return;

      await saleOrderApi.update(saleId, {
        status: 'approved',
        approvedBy: userId,
        approvedAt: new Date().toISOString(),
      });

      toast.success('Sale order approved');
      await loadData();
    } catch (error) {
      console.error('Error approving sale order:', error);
      toast.error('Failed to approve sale order');
    }
  };

  const handleRejectSale = async (saleId: string) => {
    try {
      await saleOrderApi.update(saleId, {
        status: 'rejected',
        approvedBy: userId,
        approvedAt: new Date().toISOString(),
      });
      toast.success('Sale order rejected');
      await loadData();
    } catch (error) {
      console.error('Error rejecting sale order:', error);
      toast.error('Failed to reject sale order');
    }
  };

  const resetForm = () => {
    setSelectedCustomer('');
    setSelectedLocation('');
    setOrderItems([]);
    setCurrentArticle('');
    setCurrentQuantity('');
    setCurrentPrice('');
    setPaymentType('credit');
  };

  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name || 'Unknown';
  const getArticleName = (id: string) => articles.find(a => a.id === id)?.name || 'Unknown';
  const getLocationName = (id: string) => locations.find(l => l.id === id)?.name || 'Unknown';

  const canCreate = userRole === 'owner' || userRole === 'sales' || userRole === 'outlet';
  const canApprove = userRole === 'owner' || userRole === 'finance';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Sales Orders</CardTitle>
          <CardDescription>Manage customer orders and sales</CardDescription>
        </div>
        {canCreate && (
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Sale Order
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Sale Order</DialogTitle>
                <DialogDescription>Create a new customer order</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Customer</Label>
                    <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map(customer => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name} - {customer.city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Sale Point</Label>
                    <Select value={selectedLocation} onValueChange={setSelectedLocation}>
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

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Add Items</h3>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    <Select value={currentArticle} onValueChange={setCurrentArticle}>
                      <SelectTrigger>
                        <SelectValue placeholder="Article" />
                      </SelectTrigger>
                      <SelectContent>
                        {articles.map(article => (
                          <SelectItem key={article.id} value={article.id}>
                            {article.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="Quantity"
                      value={currentQuantity}
                      onChange={(e) => setCurrentQuantity(e.target.value)}
                    />
                    <Input
                      type="number"
                      placeholder="Price"
                      value={currentPrice}
                      onChange={(e) => setCurrentPrice(e.target.value)}
                    />
                    <Button onClick={addItemToOrder} type="button">Add</Button>
                  </div>

                  {orderItems.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Article</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderItems.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{getArticleName(item.articleId)}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell>PKR {item.pricePerUnit}</TableCell>
                            <TableCell>PKR {item.totalPrice}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeItem(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}

                  {orderItems.length > 0 && (
                    <div className="mt-4 text-right">
                      <p className="text-lg font-bold">
                        Total: PKR {orderItems.reduce((sum, item) => sum + item.totalPrice, 0).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Payment Type</Label>
                  <Select value={paymentType} onValueChange={(v: 'cash' | 'credit') => setPaymentType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credit">Credit</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={handleCreateSale} className="w-full">Create Sale Order</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No sale orders found
                </TableCell>
              </TableRow>
            ) : (
              sales.map(sale => (
                <TableRow key={sale.id}>
                  <TableCell className="font-medium">{sale.orderNumber}</TableCell>
                  <TableCell>{getCustomerName(sale.customerId)}</TableCell>
                  <TableCell>{getLocationName(sale.locationId)}</TableCell>
                  <TableCell>
                    <Badge variant={sale.paymentType === 'cash' ? 'default' : 'secondary'}>
                      {sale.paymentType}
                    </Badge>
                  </TableCell>
                  <TableCell>PKR {sale.totalAmount.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={sale.status === 'approved' || sale.status === 'completed' ? 'default' : 'secondary'}>
                      {sale.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(sale.createdAt)}</TableCell>
                  <TableCell>
                    {canApprove && sale.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleApproveSale(sale.id)}>
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleRejectSale(sale.id)}>
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

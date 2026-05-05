/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { Customer, CustomerStatus, UserRole, User, Location } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Users, MapPin, CreditCard, Truck, FileText, Search, UserCheck, Building } from 'lucide-react';
import { toast } from 'sonner';
import { customerApi } from '@/lib/api/customers';
import { userApi } from '@/lib/api/users';
import { locationApi } from '@/lib/api/locations';

interface CustomerManagementProps {
  userRole: UserRole;
}

const STATUS_OPTIONS: { value: CustomerStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'inactive', label: 'Inactive' },
];

interface FormData {
  name: string;
  status: CustomerStatus;
  salespersonId: string;
  warehouseId: string;
  phone: string;
  billingAddress: string;
  billingCity: string;
  billingState: string;
  billingPostalCode: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  sameAsBilling: boolean;
  creditLimit: number;
  creditDays: number;
  isCashOnly: boolean;
  acceptsCheque: boolean;
  acceptsPDC: boolean;
  pdcDueDays: number;
  advancePayment: number;
  advanceRequired: boolean;
  deliveryDays: number;
  remarks: string;
  city: string;
}

const initialFormData: FormData = {
  name: '',
  status: 'active',
  salespersonId: '',
  warehouseId: '',
  phone: '',
  billingAddress: '',
  billingCity: '',
  billingState: '',
  billingPostalCode: '',
  shippingAddress: '',
  shippingCity: '',
  shippingState: '',
  shippingPostalCode: '',
  sameAsBilling: false,
  creditLimit: 0,
  creditDays: 30,
  isCashOnly: false,
  acceptsCheque: false,
  acceptsPDC: false,
  pdcDueDays: 0,
  advancePayment: 0,
  advanceRequired: false,
  deliveryDays: 0,
  remarks: '',
  city: '',
};

export const CustomerManagement = ({ userRole }: CustomerManagementProps) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const canEdit = ['owner', 'sales', 'finance'].includes(userRole);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [apiCustomers, allUsers, apiLocations] = await Promise.all([
        customerApi.getAll(),
        userApi.getAll(),
        locationApi.getAll(),
      ]);

      // Normalize the data to match our Customer type
      const normalizedCustomers = apiCustomers.map(customer => ({
        ...customer,
        status: customer.status || 'active',
        acceptsCheque: customer.acceptsCheque || false,
        acceptsPDC: customer.acceptsPDC || false,
        advanceRequired: customer.advanceRequired || false,
        currentBalance: customer.currentBalance || 0,
      })) as Customer[];
      
      setCustomers(normalizedCustomers);
      
      const salesUsers = allUsers.filter(u => ['sales', 'owner'].includes(u.role));
      setUsers(salesUsers);
      
      setLocations(apiLocations);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data. Please check your connection and try again.');
      setCustomers([]);
      setUsers([]);
      setLocations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    if (!searchQuery) return customers;
    const query = searchQuery.toLowerCase();
    return customers.filter(customer => 
      customer.name.toLowerCase().includes(query) ||
      customer.billingCity?.toLowerCase().includes(query) ||
      customer.phone?.toLowerCase().includes(query)
    );
  }, [customers, searchQuery]);

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingCustomer(null);
  };

  const handleOpenDialog = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({
        name: customer.name,
        status: customer.status || 'active',
        salespersonId: customer.salespersonId || '',
        warehouseId: customer.warehouseId || '',
        phone: customer.phone || '',
        billingAddress: customer.billingAddress || '',
        billingCity: customer.billingCity || '',
        billingState: customer.billingState || '',
        billingPostalCode: customer.billingPostalCode || '',
        shippingAddress: customer.shippingAddress || '',
        shippingCity: customer.shippingCity || '',
        shippingState: customer.shippingState || '',
        shippingPostalCode: customer.shippingPostalCode || '',
        sameAsBilling: false,
        creditLimit: customer.creditLimit,
        creditDays: customer.creditDays,
        isCashOnly: customer.isCashOnly,
        acceptsCheque: customer.acceptsCheque || false,
        acceptsPDC: customer.acceptsPDC || false,
        pdcDueDays: customer.pdcDueDays || 0,
        advancePayment: customer.advancePayment || 0,
        advanceRequired: customer.advanceRequired || false,
        deliveryDays: customer.deliveryDays || 0,
        remarks: customer.remarks || '',
        city: customer.city || '',
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const handleSameAsBillingChange = (checked: boolean) => {
    if (checked) {
      setFormData({
        ...formData,
        sameAsBilling: true,
        shippingAddress: formData.billingAddress,
        shippingCity: formData.billingCity,
        shippingState: formData.billingState,
        shippingPostalCode: formData.billingPostalCode,
      });
    } else {
      setFormData({
        ...formData,
        sameAsBilling: false,
      });
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Customer name is required');
      return;
    }

    const customerData: Omit<Customer, 'id' | 'currentBalance'> = {
      name: formData.name.trim(),
      status: formData.status,
      phone: formData.phone || undefined,
      billingAddress: formData.billingAddress || undefined,
      billingCity: formData.billingCity || undefined,
      billingState: formData.billingState || undefined,
      billingPostalCode: formData.billingPostalCode || undefined,
      shippingAddress: formData.sameAsBilling ? formData.billingAddress : formData.shippingAddress || undefined,
      shippingCity: formData.sameAsBilling ? formData.billingCity : formData.shippingCity || undefined,
      shippingState: formData.sameAsBilling ? formData.billingState : formData.shippingState || undefined,
      shippingPostalCode: formData.sameAsBilling ? formData.billingPostalCode : formData.shippingPostalCode || undefined,
      creditLimit: formData.creditLimit,
      creditDays: formData.creditDays,
      isCashOnly: formData.isCashOnly,
      acceptsCheque: formData.acceptsCheque,
      acceptsPDC: formData.acceptsPDC,
      pdcDueDays: formData.pdcDueDays || undefined,
      advancePayment: formData.advancePayment || undefined,
      advanceRequired: formData.advanceRequired,
      deliveryDays: formData.deliveryDays || undefined,
      salespersonId: formData.salespersonId || undefined,
      warehouseId: formData.warehouseId || undefined,
      remarks: formData.remarks || undefined,
      city: formData.billingCity || formData.city || undefined,
    };

    setIsLoading(true);
    try {
      if (editingCustomer) {
        await customerApi.update(editingCustomer.id, {
          ...customerData,
          currentBalance: editingCustomer.currentBalance,
        });
        toast.success('Customer updated successfully');
      } else {
        await customerApi.create(customerData);
        toast.success('Customer added successfully');
      }

      await loadData();
      handleCloseDialog();
    } catch (error: any) {
      console.error('Error saving customer:', error);
      toast.error('Failed to save customer: ' + (error.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this customer?')) {
      return;
    }

    setIsLoading(true);
    try {
      await customerApi.delete(id);
      toast.success('Customer deleted successfully');
      await loadData();
    } catch (error: any) {
      console.error('Error deleting customer:', error);
      toast.error('Failed to delete customer: ' + (error.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: CustomerStatus): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'active':
        return 'default';
      case 'on_hold':
        return 'secondary';
      case 'inactive':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getSalespersonName = (id?: string) => {
    if (!id) return '-';
    const user = users.find(u => u.id === id);
    return user?.name || '-';
  };

  // Stats
  const stats = useMemo(() => ({
    total: customers.length,
    active: customers.filter(c => c.status === 'active').length,
    credit: customers.filter(c => !c.isCashOnly).length,
    totalBalance: customers.reduce((sum, c) => sum + c.currentBalance, 0),
  }), [customers]);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="stats-card cursor-default">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="stats-card cursor-default">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card className="stats-card cursor-default">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credit Customers</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.credit}</div>
          </CardContent>
        </Card>
        <Card className="stats-card cursor-default">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">PKR {stats.totalBalance.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Customer Management</CardTitle>
              <CardDescription>Manage customer information, credit terms, and payment settings</CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search customers..."
                  className="pl-8 w-full sm:w-[250px]"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              {canEdit && (
                <>
                  <Button onClick={() => handleOpenDialog()}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Customer
                  </Button>
                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent className="max-w-4xl">
                    <DialogHeader>
                      <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
                      <DialogDescription>
                        {editingCustomer ? 'Update customer details.' : 'Enter customer details below.'}
                      </DialogDescription>
                    </DialogHeader>
                    
                    <ScrollArea className="max-h-[60vh] pr-4">
                      <div className="space-y-6 py-4">
                        {/* Core Information */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            <h4 className="font-semibold">Core Information</h4>
                          </div>
                          <Separator />
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Customer Name <span className="text-destructive">*</span></Label>
                              <Input
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Customer name"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Status</Label>
                              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as CustomerStatus })}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STATUS_OPTIONS.map(option => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Salesperson</Label>
                              <Select 
                                value={formData.salespersonId || undefined} 
                                onValueChange={(v) => setFormData({ ...formData, salespersonId: v || '' })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select salesperson" />
                                </SelectTrigger>
                                <SelectContent>
                                  {users.map(user => (
                                    <SelectItem key={user.id} value={user.id}>
                                      {user.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Phone Number</Label>
                              <Input
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="+92-300-1234567"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Billing Address */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-primary" />
                            <h4 className="font-semibold">Billing Address</h4>
                          </div>
                          <Separator />
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2 col-span-2">
                              <Label>Street Address</Label>
                              <Input
                                value={formData.billingAddress}
                                onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                                placeholder="Street address"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>City</Label>
                              <Input
                                value={formData.billingCity}
                                onChange={(e) => setFormData({ ...formData, billingCity: e.target.value })}
                                placeholder="City"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>State/Province</Label>
                              <Input
                                value={formData.billingState}
                                onChange={(e) => setFormData({ ...formData, billingState: e.target.value })}
                                placeholder="State/Province"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Postal Code</Label>
                              <Input
                                value={formData.billingPostalCode}
                                onChange={(e) => setFormData({ ...formData, billingPostalCode: e.target.value })}
                                placeholder="Postal code"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Shipping Address */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Truck className="h-4 w-4 text-primary" />
                              <h4 className="font-semibold">Shipping Address</h4>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="sameAsBilling"
                                checked={formData.sameAsBilling}
                                onCheckedChange={(checked) => handleSameAsBillingChange(checked as boolean)}
                              />
                              <Label htmlFor="sameAsBilling" className="text-sm font-normal">Same as billing</Label>
                            </div>
                          </div>
                          <Separator />
                          <div className={`grid grid-cols-2 gap-4 transition-all duration-300 ease-in-out overflow-hidden ${
                            !formData.sameAsBilling 
                              ? 'opacity-100 max-h-[500px] translate-y-0' 
                              : 'opacity-0 max-h-0 -translate-y-2 pointer-events-none'
                          }`}>
                            <div className="space-y-2 col-span-2">
                              <Label>Street Address</Label>
                              <Input
                                value={formData.shippingAddress}
                                onChange={(e) => setFormData({ ...formData, shippingAddress: e.target.value })}
                                placeholder="Street address"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>City</Label>
                              <Input
                                value={formData.shippingCity}
                                onChange={(e) => setFormData({ ...formData, shippingCity: e.target.value })}
                                placeholder="City"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>State/Province</Label>
                              <Input
                                value={formData.shippingState}
                                onChange={(e) => setFormData({ ...formData, shippingState: e.target.value })}
                                placeholder="State/Province"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Postal Code</Label>
                              <Input
                                value={formData.shippingPostalCode}
                                onChange={(e) => setFormData({ ...formData, shippingPostalCode: e.target.value })}
                                placeholder="Postal code"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Payment & Credit */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-primary" />
                            <h4 className="font-semibold">Payment & Credit</h4>
                          </div>
                          <Separator />
                          <div className="grid grid-cols-3 gap-4">
                            <div className="flex items-center space-x-2 p-3 border rounded-lg">
                              <Switch
                                id="isCashOnly"
                                checked={formData.isCashOnly}
                                onCheckedChange={(checked) => setFormData({ 
                                  ...formData, 
                                  isCashOnly: checked,
                                  creditLimit: checked ? 0 : formData.creditLimit,
                                  creditDays: checked ? 0 : formData.creditDays,
                                })}
                              />
                              <Label htmlFor="isCashOnly" className="font-normal">Cash Only</Label>
                            </div>
                            <div className="flex items-center space-x-2 p-3 border rounded-lg">
                              <Switch
                                id="acceptsCheque"
                                checked={formData.acceptsCheque}
                                onCheckedChange={(checked) => setFormData({ ...formData, acceptsCheque: checked })}
                              />
                              <Label htmlFor="acceptsCheque" className="font-normal">Accepts Cheque</Label>
                            </div>
                            <div className="flex items-center space-x-2 p-3 border rounded-lg">
                              <Switch
                                id="acceptsPDC"
                                checked={formData.acceptsPDC}
                                onCheckedChange={(checked) => setFormData({ ...formData, acceptsPDC: checked })}
                              />
                              <Label htmlFor="acceptsPDC" className="font-normal">Accepts PDC</Label>
                            </div>
                          </div>
                          
                          <div className={`grid grid-cols-2 gap-4 transition-all duration-300 ease-in-out overflow-hidden ${
                            !formData.isCashOnly 
                              ? 'opacity-100 max-h-[200px] translate-y-0' 
                              : 'opacity-0 max-h-0 -translate-y-2 pointer-events-none'
                          }`}>
                            <div className="space-y-2">
                              <Label>Credit Limit (PKR)</Label>
                              <Input
                                type="number"
                                value={formData.creditLimit}
                                onChange={(e) => setFormData({ ...formData, creditLimit: parseInt(e.target.value) || 0 })}
                                placeholder="0"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Credit Days</Label>
                              <Input
                                type="number"
                                value={formData.creditDays}
                                onChange={(e) => setFormData({ ...formData, creditDays: parseInt(e.target.value) || 0 })}
                                placeholder="30"
                              />
                            </div>
                          </div>

                          <div className={`grid grid-cols-2 gap-4 transition-all duration-300 ease-in-out overflow-hidden ${
                            formData.acceptsPDC 
                              ? 'opacity-100 max-h-[200px] translate-y-0' 
                              : 'opacity-0 max-h-0 -translate-y-2 pointer-events-none'
                          }`}>
                            <div className="space-y-2">
                              <Label>PDC Due Days</Label>
                              <Input
                                type="number"
                                value={formData.pdcDueDays}
                                onChange={(e) => setFormData({ ...formData, pdcDueDays: parseInt(e.target.value) || 0 })}
                                placeholder="Days after invoice"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            <div className="flex items-center space-x-2 p-3 border rounded-lg transition-all duration-200">
                              <Switch
                                id="advanceRequired"
                                checked={formData.advanceRequired}
                                onCheckedChange={(checked) => setFormData({ ...formData, advanceRequired: checked })}
                              />
                              <Label htmlFor="advanceRequired" className="font-normal">Advance Required</Label>
                            </div>
                            <div className={`space-y-2 col-span-2 transition-all duration-300 ease-in-out ${
                              formData.advanceRequired 
                                ? 'opacity-100 translate-x-0' 
                                : 'opacity-0 -translate-x-4 pointer-events-none'
                            }`}>
                              <Label>Advance Amount (PKR)</Label>
                              <Input
                                type="number"
                                value={formData.advancePayment}
                                onChange={(e) => setFormData({ ...formData, advancePayment: parseFloat(e.target.value) || 0 })}
                                placeholder="0"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Delivery */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-primary" />
                            <h4 className="font-semibold">Delivery</h4>
                          </div>
                          <Separator />
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Standard Delivery Days</Label>
                              <Input
                                type="number"
                                value={formData.deliveryDays}
                                onChange={(e) => setFormData({ ...formData, deliveryDays: parseInt(e.target.value) || 0 })}
                                placeholder="Lead time in days"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Notes */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            <h4 className="font-semibold">Additional Notes</h4>
                          </div>
                          <Separator />
                          <div className="space-y-2">
                            <Label>Remarks / Comments</Label>
                            <Textarea
                              value={formData.remarks}
                              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                              placeholder="Internal notes for sales and finance..."
                              rows={3}
                            />
                          </div>
                        </div>
                      </div>
                    </ScrollArea>

                    <DialogFooter className="gap-2 sm:gap-0">
                      <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
                      <Button onClick={handleSubmit}>{editingCustomer ? 'Update' : 'Add'} Customer</Button>
                    </DialogFooter>
                  </DialogContent>
                  </Dialog>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Name</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Phone</TableHead>
                  <TableHead className="font-semibold">City</TableHead>
                  <TableHead className="font-semibold">Salesperson</TableHead>
                  <TableHead className="font-semibold text-right">Credit Limit</TableHead>
                  <TableHead className="font-semibold text-right">Balance</TableHead>
                  <TableHead className="font-semibold">Type</TableHead>
                  {canEdit && <TableHead className="font-semibold w-[100px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 9 : 8} className="h-24 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Users className="h-8 w-8" />
                        <span>{searchQuery ? 'No customers match your search' : 'No customers found'}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map(customer => (
                    <TableRow key={customer.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(customer.status || 'active')}>
                          {customer.status || 'active'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{customer.phone || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{customer.billingCity || customer.city || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{getSalespersonName(customer.salespersonId)}</TableCell>
                      <TableCell className="text-right font-mono">PKR {customer.creditLimit.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono">PKR {customer.currentBalance.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          <Badge variant={customer.isCashOnly ? 'destructive' : 'default'}>
                            {customer.isCashOnly ? 'Cash' : 'Credit'}
                          </Badge>
                          {customer.acceptsCheque && (
                            <Badge variant="outline" className="text-xs">CHQ</Badge>
                          )}
                          {customer.acceptsPDC && (
                            <Badge variant="outline" className="text-xs">PDC</Badge>
                          )}
                        </div>
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(customer)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(customer.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

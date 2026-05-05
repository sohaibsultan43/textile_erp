/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { Supplier, VendorCategory, PaymentMethod, UserRole } from '@/types';
import { vendorApi } from '@/lib/api/vendors';
import { Plus, Edit, Building2, User, Mail, Phone, MapPin, FileText, Search, Factory, Palette, Package, CreditCard, Banknote, Landmark, Clock, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import VendorLedgerModule from './VendorLedgerModule';

interface VendorManagementProps {
  userRole: UserRole;
}

const CATEGORY_OPTIONS: { value: VendorCategory; label: string; icon: React.ReactNode }[] = [
  { value: 'supplier', label: 'Supplier', icon: <Building2 className="h-4 w-4" /> },
  { value: 'dyeing', label: 'Dyeing', icon: <Palette className="h-4 w-4" /> },
  { value: 'packaging', label: 'Packaging', icon: <Package className="h-4 w-4" /> },
  { value: 'other', label: 'Other', icon: <Factory className="h-4 w-4" /> },
];

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { value: 'cash', label: 'Cash', icon: <Banknote className="h-4 w-4" /> },
  { value: 'credit', label: 'Credit', icon: <Clock className="h-4 w-4" /> },
  { value: 'cheque', label: 'Cheque', icon: <FileText className="h-4 w-4" /> },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: <Landmark className="h-4 w-4" /> },
  { value: 'online', label: 'Online Payment', icon: <CreditCard className="h-4 w-4" /> },
];

interface FormData {
  name: string;
  category: VendorCategory;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  paymentTerms: number;
  paymentMethod: PaymentMethod;
  bankName: string;
  accountNumber: string;
  accountTitle: string;
  remarks: string;
}

const initialFormData: FormData = {
  name: '',
  category: 'supplier',
  contactPerson: '',
  email: '',
  phone: '',
  address: '',
  paymentTerms: 30,
  paymentMethod: 'cash',
  bankName: '',
  accountNumber: '',
  accountTitle: '',
  remarks: '',
};

const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

export const VendorManagement = ({ userRole }: VendorManagementProps) => {
  const [vendors, setVendors] = useState<Supplier[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeLedgerVendor, setActiveLedgerVendor] = useState<string | null>(null);

  const canEdit = ['owner', 'purchase_officer', 'finance'].includes(userRole);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const apiVendors = await vendorApi.getAll();
      const normalizedVendors = apiVendors.map(vendor => ({
        ...vendor,
        category: vendor.category || 'supplier',
      })) as Supplier[];

      setVendors(normalizedVendors);
    } catch (error) {
      console.error('Error loading vendors:', error);
      toast.error('Failed to load vendors. Please check your connection and try again.');
      setVendors([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredVendors = useMemo(() => {
    if (!searchQuery) return vendors;
    const query = searchQuery.toLowerCase();
    return vendors.filter(vendor =>
      vendor.name.toLowerCase().includes(query) ||
      vendor.contactPerson.toLowerCase().includes(query) ||
      (vendor.email && vendor.email.toLowerCase().includes(query))
    );
  }, [vendors, searchQuery]);

  const resetForm = () => {
    setFormData(initialFormData);
    setFormErrors({});
    setEditingVendor(null);
  };

  const handleOpenDialog = (vendor?: Supplier) => {
    if (vendor) {
      setEditingVendor(vendor);
      setFormData({
        name: asText(vendor.name),
        category: vendor.category || 'supplier',
        contactPerson: asText(vendor.contactPerson),
        email: asText(vendor.email),
        phone: asText(vendor.phone),
        address: asText(vendor.address),
        paymentTerms: Number(vendor.paymentTerms || 0),
        paymentMethod: vendor.paymentMethod || 'cash',
        bankName: asText(vendor.bankName),
        accountNumber: asText(vendor.accountNumber),
        accountTitle: asText(vendor.accountTitle),
        remarks: asText(vendor.remarks),
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

  const handleSubmit = async () => {
    const errors: Partial<Record<keyof FormData, string>> = {};

    const trimmedName = asText(formData.name).trim();
    if (!trimmedName) {
      errors.name = 'Vendor name is required';
    } else if (trimmedName.length < 2) {
      errors.name = 'Vendor name must be at least 2 characters';
    }

    const trimmedContact = asText(formData.contactPerson).trim();
    if (!trimmedContact) {
      errors.contactPerson = 'Contact person is required';
    } else if (trimmedContact.length < 2) {
      errors.contactPerson = 'Contact person must be at least 2 characters';
    }

    // Email is optional, backend validates format if provided

    const trimmedPhone = asText(formData.phone).trim();
    if (!trimmedPhone) {
      errors.phone = 'Phone number is required';
    } else if (trimmedPhone.length < 10) {
      errors.phone = 'Phone number must be at least 10 digits';
    }

    const trimmedAddress = asText(formData.address).trim();
    if (!trimmedAddress) {
      errors.address = 'Address is required';
    } else if (trimmedAddress.length < 5) {
      errors.address = 'Address must be at least 5 characters';
    }

    if (formData.paymentTerms < 0 || Number.isNaN(formData.paymentTerms)) {
      errors.paymentTerms = 'Payment terms must be 0 or more days';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error('Please fix the highlighted fields.');
      return;
    }

    setFormErrors({});

    const vendorData: Omit<Supplier, 'id'> = {
      name: trimmedName,
      category: formData.category,
      contactPerson: trimmedContact,
      email: asText(formData.email).trim() || undefined,
      phone: trimmedPhone,
      address: trimmedAddress,
      paymentTerms: formData.paymentTerms,
      paymentMethod: formData.paymentMethod,
      bankName: asText(formData.bankName).trim() || undefined,
      accountNumber: asText(formData.accountNumber).trim() || undefined,
      accountTitle: asText(formData.accountTitle).trim() || undefined,
      remarks: asText(formData.remarks).trim() || undefined,
    };

    setIsLoading(true);
    try {
      if (editingVendor) {
        const updated = await vendorApi.update(editingVendor.id, vendorData);
        setVendors(prev => prev.map(v => (v.id === updated.id ? { ...v, ...updated } : v)));
        toast.success('Vendor updated successfully');
      } else {
        const created = await vendorApi.create(vendorData);
        setVendors(prev => [...prev, created]);
        toast.success('Vendor added successfully');
      }

      handleCloseDialog();
    } catch (error: any) {
      console.error('Error saving vendor:', error);

      // Map backend validation errors (express-validator) to form fields if present
      const apiErrors = error?.response?.data?.details;
      if (Array.isArray(apiErrors) && apiErrors.length > 0) {
        const backendErrors: Partial<Record<keyof FormData, string>> = {};
        apiErrors.forEach((err: any) => {
          if (err?.param && (err.param in initialFormData)) {
            backendErrors[err.param as keyof FormData] = err.msg || 'Invalid value';
          }
        });
        if (Object.keys(backendErrors).length > 0) {
          setFormErrors(prev => ({ ...prev, ...backendErrors }));
          toast.error(error.response?.data?.error || 'Failed to save vendor. Please fix the highlighted fields.');
          return;
        }
      }

      toast.error('Failed to save vendor: ' + (error.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryBadgeVariant = (category: VendorCategory): "default" | "secondary" | "destructive" | "outline" => {
    switch (category) {
      case 'supplier':
        return 'default';
      case 'dyeing':
        return 'secondary';
      case 'packaging':
        return 'outline';
      case 'other':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  const getCategoryLabel = (category: VendorCategory) => {
    return CATEGORY_OPTIONS.find(c => c.value === category)?.label || category;
  };

  const getPaymentMethodLabel = (method?: PaymentMethod) => {
    if (!method) return 'N/A';
    return PAYMENT_METHOD_OPTIONS.find(p => p.value === method)?.label || method;
  };

  // Stats
  const stats = useMemo(() => ({
    total: vendors.length,
    suppliers: vendors.filter(v => v.category === 'supplier').length,
    dyeing: vendors.filter(v => v.category === 'dyeing').length,
    packaging: vendors.filter(v => v.category === 'packaging').length,
  }), [vendors]);

  return (
    <div className="space-y-6">
      {activeLedgerVendor ? (
        <VendorLedgerModule
          fixedVendorId={activeLedgerVendor}
          onBack={() => setActiveLedgerVendor(null)}
        />
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="stats-card cursor-default">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Vendors</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card className="stats-card cursor-default">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Suppliers</CardTitle>
                <Factory className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.suppliers}</div>
              </CardContent>
            </Card>
            <Card className="stats-card cursor-default">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Dyeing Houses</CardTitle>
                <Palette className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.dyeing}</div>
              </CardContent>
            </Card>
            <Card className="stats-card cursor-default">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Packaging</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.packaging}</div>
              </CardContent>
            </Card>
          </div>

          {/* Main Card */}
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Vendor Management</CardTitle>
                  <CardDescription>Manage suppliers, dyeing houses, and vendor information</CardDescription>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search vendors..."
                      className="pl-8 w-full sm:w-[250px]"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  {canEdit && (
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                      <DialogTrigger asChild>
                        <Button onClick={() => handleOpenDialog()}>
                          <Plus className="mr-2 h-4 w-4" />
                          Add Vendor
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl w-[95vw]">
                        <DialogHeader>
                          <DialogTitle>{editingVendor ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle>
                          <DialogDescription>
                            {editingVendor ? 'Update vendor details.' : 'Enter vendor details below.'}
                          </DialogDescription>
                        </DialogHeader>

                        <ScrollArea className="max-h-[60vh] pr-4">
                          <div className="space-y-6 py-4">
                            {/* Basic Information */}
                            <div className="space-y-4">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-primary" />
                                <h4 className="font-semibold">Basic Information</h4>
                              </div>
                              <Separator />
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Vendor Name <span className="text-destructive">*</span></Label>
                                  <Input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Vendor name"
                                  />
                                  {formErrors.name && (
                                    <p className="text-xs text-destructive mt-1">{formErrors.name}</p>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <Label>Category <span className="text-destructive">*</span></Label>
                                  <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v as VendorCategory })}>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {CATEGORY_OPTIONS.map(option => (
                                        <SelectItem key={option.value} value={option.value}>
                                          <div className="flex items-center gap-2">
                                            {option.icon}
                                            {option.label}
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>

                            {/* Contact Information */}
                            <div className="space-y-4">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-primary" />
                                <h4 className="font-semibold">Contact Information</h4>
                              </div>
                              <Separator />
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Contact Person <span className="text-destructive">*</span></Label>
                                  <div className="relative">
                                    <User className="absolute left-3.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                      className="pl-10"
                                      value={formData.contactPerson}
                                      onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                                      placeholder="Contact person name"
                                    />
                                  </div>
                                  {formErrors.contactPerson && (
                                    <p className="text-xs text-destructive mt-1">{formErrors.contactPerson}</p>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <Label>Email</Label>
                                  <div className="relative">
                                    <Mail className="absolute left-3.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                      className="pl-10"
                                      type="email"
                                      value={formData.email}
                                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                      placeholder="vendor@example.com"
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label>Phone <span className="text-destructive">*</span></Label>
                                  <div className="relative">
                                    <Phone className="absolute left-3.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                      className="pl-10"
                                      value={formData.phone}
                                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                      placeholder="+92-300-1234567"
                                    />
                                  </div>
                                  {formErrors.phone && (
                                    <p className="text-xs text-destructive mt-1">{formErrors.phone}</p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Address */}
                            <div className="space-y-4">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-primary" />
                                <h4 className="font-semibold">Address</h4>
                              </div>
                              <Separator />
                              <div className="space-y-2">
                                <Label>Full Address <span className="text-destructive">*</span></Label>
                                <Textarea
                                  value={formData.address}
                                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                  placeholder="Enter complete business address..."
                                  rows={2}
                                />
                                {formErrors.address && (
                                  <p className="text-xs text-destructive mt-1">{formErrors.address}</p>
                                )}
                              </div>
                            </div>

                            {/* Payment Information */}
                            <div className="space-y-4">
                              <div className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-primary" />
                                <h4 className="font-semibold">Payment Information</h4>
                              </div>
                              <Separator />
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Payment Method</Label>
                                  <Select value={formData.paymentMethod} onValueChange={(v) => setFormData({ ...formData, paymentMethod: v as PaymentMethod })}>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {PAYMENT_METHOD_OPTIONS.map(option => (
                                        <SelectItem key={option.value} value={option.value}>
                                          <div className="flex items-center gap-2">
                                            {option.icon}
                                            {option.label}
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label>Credit/Payment Terms (Days)</Label>
                                  <div className="relative">
                                    <Clock className="absolute left-3.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                      className="pl-10"
                                      type="number"
                                      value={formData.paymentTerms}
                                      onChange={(e) => setFormData({ ...formData, paymentTerms: parseInt(e.target.value) || 0 })}
                                      placeholder="30"
                                    />
                                  </div>
                                  {formErrors.paymentTerms && (
                                    <p className="text-xs text-destructive mt-1">{formErrors.paymentTerms}</p>
                                  )}
                                </div>
                              </div>

                              {/* Bank Details - Only show when bank_transfer or cheque is selected */}
                              {(formData.paymentMethod === 'bank_transfer' || formData.paymentMethod === 'cheque') && (
                                <div className="mt-4 p-4 rounded-lg bg-muted/50 space-y-4">
                                  <div className="flex items-center gap-2">
                                    <Landmark className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium text-muted-foreground">Bank Details</span>
                                  </div>
                                  <div className="grid grid-cols-1 gap-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <Label>Bank Name</Label>
                                        <Input
                                          value={formData.bankName}
                                          onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                                          placeholder="e.g., HBL, MCB, UBL"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Account Title</Label>
                                        <Input
                                          value={formData.accountTitle}
                                          onChange={(e) => setFormData({ ...formData, accountTitle: e.target.value })}
                                          placeholder="Account holder name"
                                        />
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Account Number / IBAN</Label>
                                      <Input
                                        value={formData.accountNumber}
                                        onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                                        placeholder="Enter account number or IBAN"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
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
                                  placeholder="Internal notes about this vendor..."
                                  rows={2}
                                />
                              </div>
                            </div>
                          </div>
                        </ScrollArea>

                        <DialogFooter className="gap-2 sm:gap-0">
                          <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
                          <Button onClick={handleSubmit}>{editingVendor ? 'Update' : 'Add'} Vendor</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold max-w-[160px] truncate whitespace-nowrap">Name</TableHead>
                      <TableHead className="font-semibold max-w-[110px] truncate whitespace-nowrap">Category</TableHead>
                      <TableHead className="font-semibold max-w-[140px] truncate whitespace-nowrap">Contact Person</TableHead>
                      <TableHead className="font-semibold max-w-[180px] truncate whitespace-nowrap">Email</TableHead>
                      <TableHead className="font-semibold max-w-[130px] truncate whitespace-nowrap">Phone</TableHead>
                      <TableHead className="font-semibold max-w-[200px] truncate whitespace-nowrap">Address</TableHead>
                      <TableHead className="font-semibold text-right max-w-[80px] truncate whitespace-nowrap">Delivery Days</TableHead>
                      <TableHead className="font-semibold max-w-[80px] truncate whitespace-nowrap">Payment</TableHead>
                      <TableHead className="font-semibold text-right w-[140px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVendors.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={canEdit ? 9 : 8} className="h-24 text-center">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Building2 className="h-8 w-8" />
                            <span>{searchQuery ? 'No vendors match your search' : 'No vendors found'}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredVendors.map(vendor => (
                        <TableRow key={vendor.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium max-w-[160px] truncate whitespace-nowrap">{vendor.name}</TableCell>
                          <TableCell className="max-w-[110px] truncate whitespace-nowrap">
                            <Badge variant={getCategoryBadgeVariant(vendor.category || 'supplier')}>
                              {getCategoryLabel(vendor.category || 'supplier')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-[140px] truncate whitespace-nowrap">{vendor.contactPerson}</TableCell>
                          <TableCell className="text-muted-foreground max-w-[180px] truncate whitespace-nowrap">{vendor.email || 'N/A'}</TableCell>
                          <TableCell className="text-muted-foreground max-w-[130px] truncate whitespace-nowrap">{vendor.phone}</TableCell>
                          <TableCell className="max-w-[200px] truncate whitespace-nowrap text-muted-foreground">{vendor.address}</TableCell>
                          <TableCell className="text-right font-mono max-w-[80px] truncate whitespace-nowrap">{vendor.paymentTerms} days</TableCell>
                          <TableCell className="max-w-[100px] truncate whitespace-nowrap">
                            <Badge variant="outline" className="text-xs">
                              {getPaymentMethodLabel(vendor.paymentMethod)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1 mr-1"
                                onClick={() => setActiveLedgerVendor(vendor.id)}
                                title="View Ledger"
                              >
                                <Wallet className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline text-xs">Ledger</span>
                              </Button>
                              {canEdit && (
                                <>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(vendor)} title="Edit Vendor">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

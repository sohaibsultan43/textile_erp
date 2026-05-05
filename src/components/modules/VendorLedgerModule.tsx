import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { AppDatePicker } from '@/components/ui/app-date-picker';
import { useToast } from '@/hooks/use-toast';
import { Plus, Building2, Wallet, TrendingUp, TrendingDown, Calendar, FileText, CreditCard, Search } from 'lucide-react';
import { vendorApi, vendorLedgerApi } from '@/lib/api';
import { VendorLedgerSummary } from '@/lib/api/vendor-ledger';
import { Supplier, VendorLedgerEntry, VendorCategory, PaymentMethod } from '@/types';
import { formatDate } from '@/lib/utils';

interface VendorLedgerModuleProps {
    fixedVendorId?: string;
    onBack?: () => void;
}

const VendorLedgerModule: React.FC<VendorLedgerModuleProps> = ({ fixedVendorId, onBack }) => {
    const { toast } = useToast();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [ledgerData, setLedgerData] = useState<VendorLedgerSummary | null>(null);
    const [selectedVendorId, setSelectedVendorId] = useState<string>(fixedVendorId || '');
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [entryCategoryFilter, setEntryCategoryFilter] = useState<'all' | 'po' | 'grn'>('all');
    const [loading, setLoading] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [appliedStartDate, setAppliedStartDate] = useState('');
    const [appliedEndDate, setAppliedEndDate] = useState('');

    // Payment form state
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const [paymentReference, setPaymentReference] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentNotes, setPaymentNotes] = useState('');

    const loadSuppliers = useCallback(async () => {
        try {
            const suppliersData = await vendorApi.getAll();
            setSuppliers(suppliersData);
        } catch (error) {
            console.error('Failed to load suppliers:', error);
            toast({
                title: 'Error',
                description: 'Failed to load suppliers',
                variant: 'destructive',
            });
        }
    }, [toast]);

    const loadLedgerData = useCallback(async (
        supplierId: string,
        filters?: { startDate?: string; endDate?: string }
    ) => {
        setLoading(true);
        try {
            const data = await vendorLedgerApi.getBySupplierId(supplierId, filters);
            setLedgerData(data);
        } catch (error) {
            console.error('Failed to load ledger data:', error);
            toast({
                title: 'Error',
                description: 'Failed to load ledger data',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        loadSuppliers();
    }, [loadSuppliers]);

    useEffect(() => {
        if (fixedVendorId) {
            setSelectedVendorId(fixedVendorId);
        }
    }, [fixedVendorId]);

    useEffect(() => {
        if (selectedVendorId) {
            loadLedgerData(selectedVendorId, {
                startDate: appliedStartDate || undefined,
                endDate: appliedEndDate || undefined,
            });
        } else {
            setLedgerData(null);
        }
    }, [selectedVendorId, appliedStartDate, appliedEndDate, loadLedgerData]);

    const handleApplyDateFilter = () => {
        if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
            toast({
                title: 'Invalid Date Range',
                description: 'From date cannot be later than to date.',
                variant: 'destructive',
            });
            return;
        }
        setAppliedStartDate(startDate);
        setAppliedEndDate(endDate);
    };

    const handleClearDateFilter = () => {
        setStartDate('');
        setEndDate('');
        setAppliedStartDate('');
        setAppliedEndDate('');
    };

    const getVendorCategoryInfo = (category: VendorCategory) => {
        const categories = {
            supplier: { label: 'Supplier', color: 'bg-blue-100 text-blue-800', icon: <Building2 className="h-4 w-4" /> },
            dyeing: { label: 'Dyeing', color: 'bg-purple-100 text-purple-800', icon: <Building2 className="h-4 w-4" /> },
            packaging: { label: 'Packaging', color: 'bg-orange-100 text-orange-800', icon: <Building2 className="h-4 w-4" /> },
            other: { label: 'Other', color: 'bg-gray-100 text-gray-800', icon: <Building2 className="h-4 w-4" /> },
        };
        return categories[category] || categories.other;
    };

    const selectedVendor = suppliers.find(s => s.id === selectedVendorId);

    // Get ledger entries from API data
    const ledgerEntries = ledgerData?.entries || [];

    // Calculate totals from API summary
    const totalDebits = ledgerData?.summary?.totalDebits || 0;
    const totalCredits = ledgerData?.summary?.totalCredits || 0;
    const currentBalance = ledgerData?.summary?.currentBalance || 0;

    // Filter entries by search + document type
    const filteredEntries = ledgerEntries.filter(entry => {
        const query = searchQuery.toLowerCase();
        const descriptionText = entry.description.toLowerCase();
        const referenceText = entry.referenceNumber?.toLowerCase() || '';
        const matchesSearch = descriptionText.includes(query) || referenceText.includes(query);

        if (!matchesSearch) return false;
        if (entryCategoryFilter === 'all') return true;

        const isPoEntry =
            Boolean((entry as VendorLedgerEntry & { invoiceDetails?: { poNumber?: string } }).invoiceDetails?.poNumber) ||
            descriptionText.includes('po') ||
            referenceText.includes('po-');

        const isGrnEntry =
            (entry.referenceType as string) === 'grn' ||
            descriptionText.includes('grn') ||
            referenceText.includes('grn-');

        if (entryCategoryFilter === 'po') return isPoEntry;
        if (entryCategoryFilter === 'grn') return isGrnEntry;
        return true;
    });

    const getCurrentBalance = (vendorId: string): number => {
        // For other vendors, we might need to load their data, but for now return 0
        // TODO: Implement proper balance fetching for all vendors
        return vendorId === selectedVendorId ? currentBalance : 0;
    };

    

    const handleAddPayment = async () => {
        if (!selectedVendorId || !paymentAmount || parseFloat(paymentAmount) <= 0) {
            toast({
                title: 'Validation Error',
                description: 'Please enter a valid payment amount',
                variant: 'destructive',
            });
            return;
        }

        try {
            await vendorLedgerApi.createPayment({
                supplierId: selectedVendorId,
                amount: parseFloat(paymentAmount),
                paymentMethod,
                reference: paymentReference,
                date: paymentDate,
                notes: paymentNotes,
            });

            toast({
                title: 'Payment Recorded',
                description: `Payment of PKR ${paymentAmount} has been recorded successfully.`,
            });

            // Reset form
            setPaymentAmount('');
            setPaymentMethod('cash');
            setPaymentReference('');
            setPaymentDate(new Date().toISOString().split('T')[0]);
            setPaymentNotes('');
            setIsPaymentDialogOpen(false);

            // Reload ledger data
            loadLedgerData(selectedVendorId);
        } catch (error) {
            console.error('Failed to record payment:', error);
            toast({
                title: 'Error',
                description: 'Failed to record payment. Please try again.',
                variant: 'destructive',
            });
        }
    };

    const getPaymentMethodLabel = (method: PaymentMethod): string => {
        const labels: Record<PaymentMethod, string> = {
            cash: 'Cash',
            credit: 'Credit',
            cheque: 'Cheque',
            bank_transfer: 'Bank Transfer',
            online: 'Online Payment',
        };
        return labels[method] || method;
    };

    return (
        <div className="space-y-6">
            {/* Vendor Selection */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Wallet className="h-5 w-5 text-primary" />
                                Vendor Ledger
                            </CardTitle>
                            <CardDescription>Track vendor balances, invoices, and payments</CardDescription>
                        </div>
                        {onBack && (
                            <Button variant="outline" onClick={onBack}>
                                Back to Vendors
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Select Vendor</Label>
                            <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                                <SelectTrigger>
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

                        {selectedVendor && (
                            <>
                                <div className="space-y-1">
                                    <Label className="text-muted-foreground text-xs">Vendor Details</Label>
                                    <div className="p-3 bg-muted/50 rounded-lg">
                                        <p className="font-medium">{selectedVendor.name}</p>
                                        <p className="text-sm text-muted-foreground">{selectedVendor.contactPerson}</p>
                                        <Badge className={getVendorCategoryInfo(selectedVendor.category).color + ' mt-1'}>
                                            {getVendorCategoryInfo(selectedVendor.category).label}
                                        </Badge>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-muted-foreground text-xs">Contact</Label>
                                    <div className="p-3 bg-muted/50 rounded-lg">
                                        <p className="text-sm">{selectedVendor.phone}</p>
                                        <p className="text-sm text-muted-foreground">{selectedVendor.email}</p>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Summary Cards */}
            {selectedVendorId && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border-l-4 border-l-red-500">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Invoices (Debit)</p>
                                    <p className="text-2xl font-bold text-red-600">
                                        {loading ? '...' : `PKR ${totalDebits.toLocaleString()}`}
                                    </p>
                                </div>
                                <TrendingUp className="h-8 w-8 text-red-500/50" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-green-500">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Payments (Credit)</p>
                                    <p className="text-2xl font-bold text-green-600">
                                        {loading ? '...' : `PKR ${totalCredits.toLocaleString()}`}
                                    </p>
                                </div>
                                <TrendingDown className="h-8 w-8 text-green-500/50" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className={`border-l-4 ${currentBalance > 0 ? 'border-l-orange-500' : 'border-l-blue-500'}`}>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Current Balance</p>
                                    <p className={`text-2xl font-bold ${currentBalance > 0 ? 'text-orange-600' : 'text-blue-600'}`}>
                                        {loading ? '...' : `PKR ${Math.abs(currentBalance).toLocaleString()}`}
                                        {currentBalance < 0 && ' (Cr)'}
                                    </p>
                                </div>
                                <Wallet className={`h-8 w-8 ${currentBalance > 0 ? 'text-orange-500/50' : 'text-blue-500/50'}`} />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Ledger Table */}
            {selectedVendorId && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>Ledger Entries</CardTitle>
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search entries..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9 w-64"
                                    />
                                </div>
                                <Select
                                    value={entryCategoryFilter}
                                    onValueChange={(value: 'all' | 'po' | 'grn') => setEntryCategoryFilter(value)}
                                >
                                    <SelectTrigger className="w-36">
                                        <SelectValue placeholder="Filter type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All</SelectItem>
                                        <SelectItem value="po">PO</SelectItem>
                                        <SelectItem value="grn">GRN</SelectItem>
                                    </SelectContent>
                                </Select>
                                <AppDatePicker
                                    value={startDate}
                                    onChange={setStartDate}
                                    className="w-40"
                                    placeholder="From date"
                                />
                                <AppDatePicker
                                    value={endDate}
                                    onChange={setEndDate}
                                    className="w-40"
                                    placeholder="To date"
                                />
                                <Button
                                    variant="outline"
                                    onClick={handleApplyDateFilter}
                                    disabled={!selectedVendorId}
                                >
                                    Apply
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={handleClearDateFilter}
                                    disabled={!selectedVendorId || (!startDate && !endDate && !appliedStartDate && !appliedEndDate)}
                                >
                                    Clear
                                </Button>
                                <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button>
                                            <Plus className="mr-2 h-4 w-4" />
                                            Add Payment
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-md">
                                        <DialogHeader>
                                            <DialogTitle className="flex items-center gap-2">
                                                <CreditCard className="h-5 w-5 text-primary" />
                                                Record Payment
                                            </DialogTitle>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                            <div className="p-3 bg-muted/50 rounded-lg">
                                                <p className="text-sm text-muted-foreground">Vendor</p>
                                                <p className="font-medium">{selectedVendor?.name}</p>
                                                <p className="text-sm mt-1">Current Balance: <span className="font-bold text-orange-600">PKR {currentBalance.toLocaleString()}</span></p>
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Payment Amount <span className="text-destructive">*</span></Label>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    value={paymentAmount}
                                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                                    placeholder="Enter amount"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Payment Method</Label>
                                                <Select value={paymentMethod} onValueChange={(v: PaymentMethod) => setPaymentMethod(v)}>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="cash">Cash</SelectItem>
                                                        <SelectItem value="cheque">Cheque</SelectItem>
                                                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                                        <SelectItem value="online">Online Payment</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Reference / Cheque No.</Label>
                                                <Input
                                                    value={paymentReference}
                                                    onChange={(e) => setPaymentReference(e.target.value)}
                                                    placeholder="Enter reference number"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Payment Date</Label>
                                                <AppDatePicker
                                                    value={paymentDate}
                                                    onChange={setPaymentDate}
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label>Notes</Label>
                                                <Textarea
                                                    value={paymentNotes}
                                                    onChange={(e) => setPaymentNotes(e.target.value)}
                                                    placeholder="Optional notes..."
                                                    rows={2}
                                                />
                                            </div>

                                            <Button onClick={handleAddPayment} className="w-full">
                                                Record Payment
                                            </Button>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {(appliedStartDate || appliedEndDate) && (
                            <div className="mb-3 text-sm text-muted-foreground">
                                Showing entries for {appliedStartDate || 'start'} to {appliedEndDate || 'today'}
                            </div>
                        )}
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Reference</TableHead>
                                    <TableHead className="text-right">Debit</TableHead>
                                    <TableHead className="text-right">Credit</TableHead>
                                    <TableHead className="text-right">Balance</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredEntries.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                            {ledgerEntries.length === 0
                                                ? 'No ledger entries for this vendor'
                                                : 'No entries match your search'}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredEntries.map((entry) => (
                                        <TableRow key={entry.id}>
                                            <TableCell className="whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                                    {formatDate(entry.date)}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                                    {entry.description}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {entry.referenceNumber && (
                                                    <Badge variant="outline">{entry.referenceNumber}</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {entry.entryType === 'debit' && (
                                                    <span className="text-red-600 font-medium">
                                                        PKR {entry.amount.toLocaleString()}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {entry.entryType === 'credit' && (
                                                    <span className="text-green-600 font-medium">
                                                        PKR {entry.amount.toLocaleString()}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                <span className={entry.balance > 0 ? 'text-orange-600' : 'text-blue-600'}>
                                                    PKR {Math.abs(entry.balance).toLocaleString()}
                                                    {entry.balance < 0 && ' Cr'}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* No vendor selected message */}
            {!selectedVendorId && (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center text-muted-foreground">
                            <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-medium">Select a vendor to view their ledger</p>
                            <p className="text-sm">Choose a vendor from the dropdown above to see their transaction history</p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default VendorLedgerModule;

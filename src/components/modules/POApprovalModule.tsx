import React, { useState, useEffect } from 'react';
import { PurchaseOrder, Supplier, Article } from '@/types';
import { purchaseOrderApi, vendorApi, articleApi } from '@/lib/api';
import { formatPoItemReedPickLine } from '@/lib/poItemReedPick';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, ChevronDown, ChevronUp, Building2, Package, Palette, Factory, Search, X } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate } from '@/lib/utils';

export const POApprovalModule = () => {
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [articles, setArticles] = useState<Article[]>([]);
    const [expandedPO, setExpandedPO] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedArticleId, setSelectedArticleId] = useState('all');
    const { toast } = useToast();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const fallbackArticles = storage.get<Article>(STORAGE_KEYS.ARTICLES);

        try {
            setLoading(true);
            const [pos, sups, arts] = await Promise.all([
                purchaseOrderApi.getAll(),
                vendorApi.getAll(),
                articleApi.getAll(),
            ]);
            setPurchaseOrders(pos);
            setSuppliers(sups);
            setArticles(arts.length > 0 ? arts : fallbackArticles);
        } catch (error) {
            console.error('Error loading data:', error);
            setArticles(fallbackArticles);
            toast({ title: 'Error', description: 'Failed to load purchase orders', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async (poId: string) => {
        try {
            await purchaseOrderApi.confirm(poId);
            toast({ title: 'Success', description: 'Purchase order approved successfully' });
            await loadData();
        } catch (error) {
            console.error('Error confirming PO:', error);
            toast({ title: 'Error', description: 'Failed to confirm purchase order', variant: 'destructive' });
        }
    };

    const handleReject = async (poId: string) => {
        try {
            await purchaseOrderApi.cancel(poId);
            toast({ title: 'Success', description: 'Purchase order rejected successfully' });
            await loadData();
        } catch (error) {
            console.error('Error rejecting PO:', error);
            toast({ title: 'Error', description: 'Failed to reject purchase order', variant: 'destructive' });
        }
    };

    const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.name || 'Unknown';
    const getSupplierCategory = (id: string) => suppliers.find(s => s.id === id)?.category;
    const getArticleName = (id: string) => articles.find(a => a.id === id)?.name || 'Unknown';

    const getVendorCategoryInfo = (category?: string) => {
        switch (category) {
            case 'supplier':
                return { icon: <Building2 className="h-3 w-3" />, label: 'Supplier', color: 'bg-blue-100 text-blue-800' };
            case 'dyeing':
                return { icon: <Palette className="h-3 w-3" />, label: 'Dyeing', color: 'bg-purple-100 text-purple-800' };
            case 'packaging':
                return { icon: <Package className="h-3 w-3" />, label: 'Packaging', color: 'bg-green-100 text-green-800' };
            default:
                return { icon: <Factory className="h-3 w-3" />, label: 'Other', color: 'bg-gray-100 text-gray-800' };
        }
    };

    const filterPOs = (statuses: PurchaseOrder['status'][]) => {
        return purchaseOrders.filter((po) => {
            if (!statuses.includes(po.status)) return false;

            if (selectedArticleId !== 'all') {
                const matchesArticle = po.items.some((item) => item.articleId === selectedArticleId);
                if (!matchesArticle) return false;
            }

            if (!searchQuery.trim()) return true;

            const query = searchQuery.toLowerCase();
            const supplierName = getSupplierName(po.supplierId).toLowerCase();
            const articleMatch = po.items.some((item) => getArticleName(item.articleId).toLowerCase().includes(query));

            return po.poNumber.toLowerCase().includes(query) || supplierName.includes(query) || articleMatch;
        });
    };

    const activePOs = filterPOs(['pending', 'approved', 'partially_received', 'complete']);
    const cancelledPOs = filterPOs(['cancelled']);

    const renderPOTable = (pos: PurchaseOrder[], showActionButtons: boolean) => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {pos.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            {showActionButtons ? 'No active purchase orders' : 'No cancelled purchase orders yet'}
                        </TableCell>
                    </TableRow>
                ) : (
                    pos.map(po => {
                        const isExpanded = expandedPO === po.id;
                        const vendorCategory = getSupplierCategory(po.supplierId);
                        const categoryInfo = getVendorCategoryInfo(vendorCategory);

                        return (
                            <React.Fragment key={po.id}>
                                <TableRow className={isExpanded ? 'bg-muted/30' : ''}>
                                    <TableCell className="font-medium">{po.poNumber}</TableCell>
                                    <TableCell>{getSupplierName(po.supplierId)}</TableCell>
                                    <TableCell>
                                        <Badge className={categoryInfo.color}>{categoryInfo.label}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 px-2"
                                            onClick={() => setExpandedPO(isExpanded ? null : po.id)}
                                        >
                                            <Badge variant="secondary" className="mr-2">{po.items.length} items</Badge>
                                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </Button>
                                    </TableCell>
                                    <TableCell>{formatDate(po.createdAt)}</TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={
                                                po.status === 'pending'
                                                    ? 'outline'
                                                    : po.status === 'approved'
                                                        ? 'default'
                                                    : po.status === 'partially_received'
                                                        ? 'secondary'
                                                        : po.status === 'complete'
                                                            ? 'default'
                                                            : 'destructive'
                                            }
                                        >
                                            {po.status.toUpperCase()}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1">
                                            {showActionButtons && po.status === 'pending' && (
                                                <>
                                                    <Button
                                                        variant="default"
                                                        size="sm"
                                                        onClick={() => handleConfirm(po.id)}
                                                        className="h-8 px-3 gap-1.5"
                                                    >
                                                        <CheckCircle className="h-4 w-4" />
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => handleReject(po.id)}
                                                        className="h-8 px-3 gap-1.5 ml-2"
                                                    >
                                                        <X className="h-4 w-4" />
                                                        Reject
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                                {isExpanded && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="bg-muted/20 p-4">
                                            <div className="space-y-3">
                                                <h4 className="font-semibold text-sm">Order Items</h4>
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Article</TableHead>
                                                            <TableHead>Reed Pick</TableHead>
                                                            <TableHead>Quantity</TableHead>
                                                            <TableHead className="text-right">Unit Price</TableHead>
                                                            <TableHead className="text-right">Total</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {po.items.map((item, idx) => (
                                                            <TableRow key={idx}>
                                                                <TableCell>{getArticleName(item.articleId)}</TableCell>
                                                                <TableCell className="text-xs text-muted-foreground">
                                                                    {formatPoItemReedPickLine(item, articles)}
                                                                </TableCell>
                                                                <TableCell>{item.quantity}</TableCell>
                                                                <TableCell className="text-right">
                                                                    {item.pricePerUnit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    {item.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                                {po.notes && (
                                                    <div className="text-sm text-muted-foreground mt-2">
                                                        <strong>Notes:</strong> {po.notes}
                                                    </div>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </React.Fragment>
                        );
                    })
                )}
            </TableBody>
        </Table>
    );

    return (
        <Card className="shadow-sm">
            <CardHeader className="border-b bg-muted/20 pb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-2xl">Purchase Order Approvals</CardTitle>
                        <CardDescription className="text-base mt-1.5">Monitor purchase orders through receipt lifecycle</CardDescription>
                    </div>
                    <div className="relative max-w-sm w-full">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Search by PO Number, Vendor, or Article..."
                            className="pl-9 bg-white"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <div className="mt-4 w-full max-w-sm">
                    <Label htmlFor="po-article-filter" className="text-sm font-medium">
                        Filter by article
                    </Label>
                    <Select value={selectedArticleId} onValueChange={setSelectedArticleId}>
                        <SelectTrigger id="po-article-filter" className="mt-2 h-12 w-full bg-background">
                            <SelectValue placeholder="Select article" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All articles</SelectItem>
                            {articles.map((article) => (
                                <SelectItem key={article.id} value={article.id}>
                                    <div className="flex items-center gap-2">
                                        <span className="max-w-[140px] truncate">{article.name}</span>
                                        <span className="max-w-[90px] truncate text-xs text-muted-foreground">
                                            ({(article.category || 'uncategorized').replace(/_/g, ' ')})
                                        </span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                <Tabs defaultValue="active" className="w-full">
                    <div className="flex items-center justify-between mb-6">
                        <TabsList className="grid w-full max-w-md grid-cols-2">
                            <TabsTrigger value="active" className="relative">
                                Active Receipts
                                {activePOs.length > 0 && (
                                    <Badge variant="destructive" className="ml-2 absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center rounded-full">
                                        {activePOs.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="history">Cancelled POs</TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="active" className="mt-0 outline-none">
                        <div className="border rounded-lg overflow-hidden">{renderPOTable(activePOs, true)}</div>
                    </TabsContent>
                    <TabsContent value="history" className="mt-0 outline-none">
                        <div className="border rounded-lg overflow-hidden">{renderPOTable(cancelledPOs, false)}</div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
};

export default POApprovalModule;

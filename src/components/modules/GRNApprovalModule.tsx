import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { CheckCircle, Eye, Clock, Search, ChevronDown, ChevronUp, X } from 'lucide-react';
import { purchaseOrderApi, grnApi, vendorApi, articleApi } from '@/lib/api';
import { formatArticleReedPickLine } from '@/lib/poItemReedPick';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { PurchaseOrder, GRN, Supplier, Article } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';

export const GRNApprovalModule: React.FC = () => {
    const [grns, setGrns] = useState<GRN[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [articles, setArticles] = useState<Article[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedArticleId, setSelectedArticleId] = useState('all');
    const [expandedGRN, setExpandedGRN] = useState<string | null>(null);
    const [viewingGRN, setViewingGRN] = useState<GRN | null>(null);

    const { toast } = useToast();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const fallbackArticles = storage.get<Article>(STORAGE_KEYS.ARTICLES);

        try {
            setIsLoading(true);
            const [apiGRNs, apiPOs, apiSuppliers, apiArticles] = await Promise.all([
                grnApi.getAll(),
                purchaseOrderApi.getAll(),
                vendorApi.getAll(),
                articleApi.getAll()
            ]);
            setGrns(apiGRNs);
            setPurchaseOrders(apiPOs);
            setSuppliers(apiSuppliers);
            setArticles(apiArticles.length > 0 ? apiArticles : fallbackArticles);
        } catch (error) {
            console.error('Error loading data:', error);
            setArticles(fallbackArticles);
            toast({
                title: 'Error',
                description: 'Failed to load data',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmGRN = async (grnId: string) => {
        try {
            await grnApi.confirm(grnId);
            toast({
                title: 'Success',
                description: 'GRN confirmed successfully. Stock and ledger have been updated.',
            });
            await loadData();
        } catch (error: any) {
            console.error('Error confirming GRN:', error);
            toast({
                title: 'Error',
                description: error.message || 'Failed to confirm GRN',
                variant: 'destructive',
            });
        }
    };

    const handleRejectGRN = async (grnId: string) => {
        try {
            await grnApi.cancel(grnId);
            toast({
                title: 'Success',
                description: 'GRN rejected successfully.',
            });
            await loadData();
        } catch (error: any) {
            console.error('Error rejecting GRN:', error);
            toast({
                title: 'Error',
                description: error.message || 'Failed to reject GRN',
                variant: 'destructive',
            });
        }
    };

    const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.name || 'Unknown';
    const getArticleName = (id: string) => articles.find(a => a.id === id)?.name || 'Unknown';
    const getPoNumber = (poId: string) => purchaseOrders.find(p => p.id === poId)?.poNumber || 'Unknown';

    const filterGRNs = (status: string) => {
        return grns.filter(grn => {
            // Status filter
            if (grn.status !== status) return false;

            // Article filter
            if (selectedArticleId !== 'all') {
                const matchesArticle = grn.items.some((item) => item.articleId === selectedArticleId);
                if (!matchesArticle) return false;
            }

            // Search filter
            if (!searchQuery.trim()) return true;
            const query = searchQuery.toLowerCase();
            const supplierName = getSupplierName(grn.supplierId).toLowerCase();
            const poNumber = getPoNumber(grn.poId).toLowerCase();
            const articleMatch = grn.items.some((item) => {
                const article = articles.find(a => a.id === item.articleId);
                const articleName = getArticleName(item.articleId).toLowerCase();
                const reedPickLabel = article ? formatArticleReedPickLine(article).toLowerCase() : '';
                const qtyStr = String(item.receivedQuantity);
                return articleName.includes(query) || reedPickLabel.includes(query) || qtyStr.includes(query);
            });

            return (
                grn.grnNumber.toLowerCase().includes(query) ||
                supplierName.includes(query) ||
                poNumber.includes(query) ||
                articleMatch
            );
        });
    };

    const pendingGRNs = filterGRNs('pending');
    const confirmedGRNs = filterGRNs('confirmed');

    const getStatusBadge = (status: string) => {
        const variants: Record<string, "default" | "secondary" | "destructive" | "outline" | "warning"> = {
            pending: "outline",
            confirmed: "default",
            cancelled: "destructive",
        };
        return <Badge variant={variants[status] as any || "default"}>{status.toUpperCase()}</Badge>;
    };

    const renderGRNTable = (grnList: GRN[], showConfirmButton: boolean) => (
        <div className="border rounded-lg overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead>Transaction Date</TableHead>
                        <TableHead>GRN Number</TableHead>
                        <TableHead>PO Number</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Created By</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {grnList.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                No GRNs found in this status
                            </TableCell>
                        </TableRow>
                    ) : (
                        grnList.map(grn => {
                            const isExpanded = expandedGRN === grn.id;

                            return (
                                <React.Fragment key={grn.id}>
                                    <TableRow className="hover:bg-muted/50 transition-colors">
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{formatDate(grn.receivedAt)}</span>
                                                <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                                    <Clock className="h-3 w-3" />
                                                    {new Date(grn.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">{grn.grnNumber}</TableCell>
                                        <TableCell>{getPoNumber(grn.poId)}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{getSupplierName(grn.supplierId)}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 px-2"
                                                onClick={() => setExpandedGRN(isExpanded ? null : grn.id)}
                                            >
                                                <Badge variant="secondary" className="mr-2">{grn.items.length} items</Badge>
                                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                            </Button>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {(grn as any).receivedByUser?.name || 'Unknown'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setViewingGRN(grn)}
                                                    title="View Details"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                {showConfirmButton && (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleConfirmGRN(grn.id)}
                                                            className="h-8 px-3 gap-1.5"
                                                            title="Confirm & Process Stock"
                                                        >
                                                            <CheckCircle className="h-4 w-4" />
                                                            Approve
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            onClick={() => handleRejectGRN(grn.id)}
                                                            className="h-8 px-3 gap-1.5"
                                                            title="Reject GRN"
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
                                        <TableRow className="bg-muted/20">
                                            <TableCell colSpan={7}>
                                                <div className="py-2">
                                                    <div className="text-sm font-semibold mb-2">Item details</div>
                                                    <div className="rounded-md border bg-background overflow-hidden">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow className="bg-muted/40">
                                                                    <TableHead>Article</TableHead>
                                                                    <TableHead className="text-right">Ordered</TableHead>
                                                                    <TableHead className="text-right">Received</TableHead>
                                                                    <TableHead className="text-right">Accepted</TableHead>
                                                                    <TableHead className="text-right">Rejected</TableHead>
                                                                    <TableHead>Remarks</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {grn.items.map((item, idx) => {
                                                                    const article = articles.find((a) => a.id === item.articleId);

                                                                    return (
                                                                        <TableRow key={`${grn.id}-${idx}`}>
                                                                            <TableCell className="font-medium">
                                                                                <div>{article?.name || 'Unknown Article'}</div>
                                                                                {article && (
                                                                                    <div className="text-xs text-muted-foreground mt-0.5">
                                                                                        {formatArticleReedPickLine(article)}
                                                                                    </div>
                                                                                )}
                                                                            </TableCell>
                                                                            <TableCell className="text-right">{item.orderedQuantity.toLocaleString()} {item.unit}</TableCell>
                                                                            <TableCell className="text-right">{item.receivedQuantity.toLocaleString()} {item.unit}</TableCell>
                                                                            <TableCell className="text-right text-green-600">{item.acceptedQuantity.toLocaleString()} {item.unit}</TableCell>
                                                                            <TableCell className="text-right text-red-600">{item.rejectedQuantity.toLocaleString()} {item.unit}</TableCell>
                                                                            <TableCell className="text-sm text-muted-foreground">{item.remarks || '-'}</TableCell>
                                                                        </TableRow>
                                                                    );
                                                                })}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
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
        </div>
    );

    if (isLoading) {
        return (
            <Card>
                <CardContent className="h-96 flex items-center justify-center">
                    <p className="text-muted-foreground">Loading GRNs...</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="shadow-sm">
            <CardHeader className="border-b bg-muted/20 pb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <CardTitle className="text-2xl">Goods Receipt Approvals</CardTitle>
                        <CardDescription className="text-base mt-1.5">
                            Review and confirm Goods Receipts. Stock updates and ledger credits are processed upon confirmation.
                        </CardDescription>
                    </div>
                    <div className="relative max-w-sm w-full">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Search by GRN Number, PO, or Vendor..."
                            className="pl-9 bg-white"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <div className="mt-4 w-full max-w-sm">
                    <Label htmlFor="grn-article-filter" className="text-sm font-medium">
                        Filter by article
                    </Label>
                    <Select value={selectedArticleId} onValueChange={setSelectedArticleId}>
                        <SelectTrigger id="grn-article-filter" className="mt-2 h-12 w-full bg-background">
                            <SelectValue placeholder="Select article" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All articles</SelectItem>
                            {articles.map((article) => (
                                <SelectItem key={article.id} value={article.id}>
                                    <div className="flex items-center gap-2">
                                        <span className="max-w-[140px] truncate">{article.name}</span>
                                        <span className="max-w-[90px] truncate text-xs text-muted-foreground">
                                            ({article.category.replace(/_/g, ' ')})
                                        </span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                <Tabs defaultValue="pending" className="w-full">
                    <div className="flex items-center justify-between mb-6">
                        <TabsList className="grid w-full max-w-md grid-cols-2">
                            <TabsTrigger value="pending" className="relative">
                                Pending Approval
                                {pendingGRNs.length > 0 && (
                                    <Badge variant="destructive" className="ml-2 absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center rounded-full">
                                        {pendingGRNs.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="confirmed">Confirmed History</TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="pending" className="mt-0 outline-none">
                        {renderGRNTable(pendingGRNs, true)}
                    </TabsContent>

                    <TabsContent value="confirmed" className="mt-0 outline-none">
                        {renderGRNTable(confirmedGRNs, false)}
                    </TabsContent>
                </Tabs>
            </CardContent>

            {/* GRN Details Dialog */}
            <Dialog open={!!viewingGRN} onOpenChange={() => setViewingGRN(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[90vw]">
                    <DialogHeader className="border-b pb-4 mb-4">
                        <DialogTitle className="text-xl flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span>GRN Details</span>
                                {viewingGRN && getStatusBadge(viewingGRN.status)}
                            </div>
                        </DialogTitle>
                    </DialogHeader>

                    {viewingGRN && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-muted/30 p-4 rounded-lg border">
                                <div>
                                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">GRN Number</div>
                                    <div className="font-medium text-base">{viewingGRN.grnNumber}</div>
                                </div>
                                <div>
                                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">PO Number</div>
                                    <div className="font-medium text-base">{getPoNumber(viewingGRN.poId)}</div>
                                </div>
                                <div>
                                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Vendor</div>
                                    <div className="font-medium text-base text-primary">{getSupplierName(viewingGRN.supplierId)}</div>
                                </div>
                                <div>
                                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Received Date</div>
                                    <div className="font-medium text-base">
                                        {formatDate(viewingGRN.receivedAt)}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="font-semibold text-lg mb-3">Received Items</h3>
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead>Article</TableHead>
                                                <TableHead className="text-right">Ordered</TableHead>
                                                <TableHead className="text-right">Received</TableHead>
                                                <TableHead className="text-right">Accepted</TableHead>
                                                <TableHead className="text-right">Rejected</TableHead>
                                                <TableHead>Remarks</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {viewingGRN.items.map((item, idx) => {
                                                const article = articles.find(a => a.id === item.articleId);
                                                return (
                                                    <TableRow key={idx}>
                                                        <TableCell className="font-medium">
                                                            <div>{article?.name || 'Unknown Article'}</div>
                                                            {article && (
                                                                <div className="text-xs text-muted-foreground mt-0.5">
                                                                    {formatArticleReedPickLine(article)}
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right">{item.orderedQuantity.toLocaleString()} {item.unit}</TableCell>
                                                        <TableCell className="text-right font-medium">{item.receivedQuantity.toLocaleString()} {item.unit}</TableCell>
                                                        <TableCell className="text-right text-green-600">{item.acceptedQuantity.toLocaleString()} {item.unit}</TableCell>
                                                        <TableCell className="text-right text-red-600">{item.rejectedQuantity.toLocaleString()} {item.unit}</TableCell>
                                                        <TableCell className="text-muted-foreground text-sm">{item.remarks || '-'}</TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>

                            {viewingGRN.notes && (
                                <div>
                                    <h3 className="font-semibold text-lg mb-2">Notes</h3>
                                    <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-4 whitespace-pre-wrap text-sm">
                                        {viewingGRN.notes}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-6 mt-6 border-t">
                                <Button variant="outline" onClick={() => setViewingGRN(null)}>
                                    Close
                                </Button>
                                {viewingGRN.status === 'pending' && (
                                    <>
                                        <Button
                                            onClick={() => {
                                                handleConfirmGRN(viewingGRN.id);
                                                setViewingGRN(null);
                                            }}
                                            className="bg-green-600 hover:bg-green-700"
                                        >
                                            <CheckCircle className="h-4 w-4 mr-2" />
                                            Approve & Process
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            onClick={() => {
                                                handleRejectGRN(viewingGRN.id);
                                                setViewingGRN(null);
                                            }}
                                        >
                                            <X className="h-4 w-4 mr-2" />
                                            Reject
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </Card>
    );
};

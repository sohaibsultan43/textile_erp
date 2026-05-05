import { Fragment, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { articleApi, locationApi } from '@/lib/api';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { StockRequisition, Location, UserRole, Article } from '@/types';
import { CheckCircle, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

interface StockRequisitionApprovalModuleProps {
  userRole: UserRole;
  userId: string;
}

export const StockRequisitionApprovalModule = ({
  userRole,
  userId,
}: StockRequisitionApprovalModuleProps) => {
  const [requisitions, setRequisitions] = useState<StockRequisition[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticleId, setSelectedArticleId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRequisition, setExpandedRequisition] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const fallbackArticles = storage.get<Article>(STORAGE_KEYS.ARTICLES);

    try {
      const [apiLocations, apiArticles] = await Promise.all([
        locationApi.getAll(),
        articleApi.getAll(),
      ]);
      setLocations(apiLocations);
      setArticles(apiArticles.length > 0 ? apiArticles : fallbackArticles);
      const stored = storage.get<StockRequisition>(STORAGE_KEYS.REQUISITIONS);
      const sorted = [...stored].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setRequisitions(sorted);
    } catch (error) {
      console.error('Error loading requisition approvals:', error);
      const stored = storage.get<StockRequisition>(STORAGE_KEYS.REQUISITIONS);
      setRequisitions(
        [...stored].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      );
      setLocations([]);
      setArticles(fallbackArticles);
    }
  };

  const getArticleName = (id: string) => articles.find((a) => a.id === id)?.name || 'Unknown';

  const filteredRequisitions = requisitions.filter((req) => {
    if (selectedArticleId !== 'all') {
      const matchesArticle = req.items.some((item) => item.articleId === selectedArticleId);
      if (!matchesArticle) return false;
    }

    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    const fromLabel = getLocationDisplay(req.fromLocationId).toLowerCase();
    const toLabel = getLocationDisplay(req.toLocationId).toLowerCase();
    const articleMatch = req.items.some((item) => getArticleName(item.articleId).toLowerCase().includes(query));

    return (
      req.requisitionNumber.toLowerCase().includes(query) ||
      fromLabel.includes(query) ||
      toLabel.includes(query) ||
      articleMatch
    );
  });

  const pendingRequisitions = filteredRequisitions.filter((req) => req.status === 'requested');
  const processedRequisitions = filteredRequisitions.filter((req) => req.status !== 'requested');

  const handleApprove = (requisitionId: string) => {
    const allRequisitions = storage.get<StockRequisition>(STORAGE_KEYS.REQUISITIONS);
    const reqIndex = allRequisitions.findIndex((r) => r.id === requisitionId);
    if (reqIndex === -1) return;

    allRequisitions[reqIndex] = {
      ...allRequisitions[reqIndex],
      status: 'approved',
      approvedBy: userId,
      approvedAt: new Date().toISOString(),
    };
    storage.set(STORAGE_KEYS.REQUISITIONS, allRequisitions);

    toast.success('Requisition approved. Create a gate pass from the Gate Pass tab when ready.');
    loadData();
  };

  const handleReject = (requisitionId: string) => {
    const allRequisitions = storage.get<StockRequisition>(STORAGE_KEYS.REQUISITIONS);
    const reqIndex = allRequisitions.findIndex((r) => r.id === requisitionId);
    if (reqIndex !== -1) {
      allRequisitions[reqIndex] = {
        ...allRequisitions[reqIndex],
        status: 'rejected',
        approvedBy: userId,
        approvedAt: new Date().toISOString(),
      };
      storage.set(STORAGE_KEYS.REQUISITIONS, allRequisitions);
      toast.success('Requisition rejected');
      loadData();
    }
  };

  const locationTypeLabel = (type: Location['type']) => {
    if (type === 'salepoint') return 'sale point';
    return type;
  };

  const formatLocationOption = (location: Location) =>
    `${location.name} (${locationTypeLabel(location.type)})`;

  const getLocationDisplay = (id: string) => {
    const loc = locations.find((l) => l.id === id);
    if (!loc) return 'Unknown';
    return formatLocationOption(loc);
  };

  const canApprove = userRole === 'owner' || userRole === 'warehouse';

  const renderRequisitionTable = (items: StockRequisition[]) => (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="font-medium text-muted-foreground">Req. #</TableHead>
            <TableHead className="font-medium text-muted-foreground">From</TableHead>
            <TableHead className="font-medium text-muted-foreground">To</TableHead>
            <TableHead className="font-medium text-muted-foreground">Items</TableHead>
            <TableHead className="font-medium text-muted-foreground">Reason</TableHead>
            <TableHead className="font-medium text-muted-foreground">Date</TableHead>
            <TableHead className="font-medium text-muted-foreground">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={7}
                className="h-32 text-center align-middle text-muted-foreground"
              >
                No requisitions found for this filter
              </TableCell>
            </TableRow>
          ) : (
            items.map((req) => {
              const isExpanded = expandedRequisition === req.id;

              return (
                <Fragment key={req.id}>
                  <TableRow>
                    <TableCell className="font-medium">{req.requisitionNumber}</TableCell>
                    <TableCell>{getLocationDisplay(req.fromLocationId)}</TableCell>
                    <TableCell>{getLocationDisplay(req.toLocationId)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => setExpandedRequisition(isExpanded ? null : req.id)}
                      >
                        <Badge variant="secondary" className="mr-2">{req.items.length} items</Badge>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {req.notes || '—'}
                    </TableCell>
                    <TableCell>{formatDate(req.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {canApprove && req.status === 'requested' ? (
                          <>
                            <Button size="sm" className="h-8 px-3 gap-1.5" onClick={() => handleApprove(req.id)}>
                              <CheckCircle className="h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-8 px-3 gap-1.5"
                              onClick={() => handleReject(req.id)}
                            >
                              <X className="h-4 w-4" />
                              Reject
                            </Button>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
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
                                  <TableHead>Category</TableHead>
                                  <TableHead className="text-right">Quantity</TableHead>
                                  <TableHead>Unit</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {req.items.map((item, idx) => {
                                  const article = articles.find((a) => a.id === item.articleId);

                                  return (
                                    <TableRow key={`${req.id}-${idx}`}>
                                      <TableCell className="font-medium">{article?.name || 'Unknown Article'}</TableCell>
                                      <TableCell className="text-muted-foreground text-sm">
                                        {(article?.category || 'uncategorized').replace(/_/g, ' ')}
                                      </TableCell>
                                      <TableCell className="text-right">{item.quantity.toLocaleString()}</TableCell>
                                      <TableCell>{item.unit || '-'}</TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                          {req.notes && (
                            <div className="mt-3 text-sm text-muted-foreground">
                              <span className="font-medium text-foreground">Reason:</span> {req.notes}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <Card className="shadow-sm">
      <CardHeader className="border-b bg-muted/20 pb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-2xl">Stock Requisition Approvals</CardTitle>
            <CardDescription className="text-base mt-1.5">
              Approve or reject transfer requests. After approval, issue a gate pass under{' '}
              <span className="font-medium text-foreground">Gate Pass</span> (Transfer Request).
            </CardDescription>
          </div>
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by requisition, article, from, or to..."
              className="pl-9 bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 w-full max-w-sm">
          <Label htmlFor="approval-article-filter" className="text-sm font-medium">
            Filter by article
          </Label>
          <Select value={selectedArticleId} onValueChange={setSelectedArticleId}>
            <SelectTrigger id="approval-article-filter" className="mt-2 h-12 w-full bg-background">
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
                {pendingRequisitions.length > 0 && (
                  <Badge
                    variant="destructive"
                    className="ml-2 absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center rounded-full"
                  >
                    {pendingRequisitions.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="processed">Processed History</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="pending" className="mt-0 outline-none">
            {renderRequisitionTable(pendingRequisitions)}
          </TabsContent>

          <TabsContent value="processed" className="mt-0 outline-none">
            {renderRequisitionTable(processedRequisitions)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

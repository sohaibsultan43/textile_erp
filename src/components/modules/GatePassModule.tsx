import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { saleOrderApi, locationApi, articleApi, customerApi, userApi } from '@/lib/api';
import { GatePass, SaleOrder, Location, Article, UserRole, StockRequisition, Customer, User } from '@/types';
import { Plus, Download, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { formatArticleReedPickLine } from '@/lib/poItemReedPick';
import { formatDate } from '@/lib/utils';

interface GatePassModuleProps {
  userRole: UserRole;
  userId: string;
}

export const GatePassModule = ({ userRole, userId }: GatePassModuleProps) => {
  const [gatePasses, setGatePasses] = useState<GatePass[]>([]);
  const [sales, setSales] = useState<SaleOrder[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stockRequisitions, setStockRequisitions] = useState<StockRequisition[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [sourceType, setSourceType] = useState<'sale' | 'transfer'>('sale');
  const [selectedSale, setSelectedSale] = useState('');
  const [selectedRequisition, setSelectedRequisition] = useState('');
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverContact, setDriverContact] = useState('');
  const [securityNotes, setSecurityNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  /** Approved requisitions that do not yet have a gate pass (eligible for "Transfer Request" flow). */
  const loadEligibleRequisitions = () => {
    const allReq = storage.get<StockRequisition>(STORAGE_KEYS.REQUISITIONS);
    return allReq.filter((r) => r.status === 'approved' && !r.gatePassId);
  };

  const loadGatePassesFromStorage = () => {
    const stored = storage.get<GatePass>(STORAGE_KEYS.GATEPASSES);
    return [...stored].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  };

  const generateGatePassNumber = () => {
    const now = new Date();
    const pad = (value: number) => value.toString().padStart(2, '0');
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return `GP-${datePart}-${timePart}`;
  };

  useEffect(() => {
    if (!isAddDialogOpen) return;
    setGatePasses(loadGatePassesFromStorage());
    setStockRequisitions(loadEligibleRequisitions());
  }, [isAddDialogOpen]);

  useEffect(() => {
    if (sourceType !== 'transfer' || !selectedRequisition) return;
    const req = stockRequisitions.find((r) => r.id === selectedRequisition);
    if (req) {
      setFromLocation(req.fromLocationId);
      setToLocation(req.toLocationId);
    }
  }, [selectedRequisition, sourceType, stockRequisitions]);

  const loadData = async () => {
    try {
      const [apiSales, apiLocations, apiArticles, apiCustomers, apiUsers] = await Promise.all([
        saleOrderApi.getAll(),
        locationApi.getAll(),
        articleApi.getAll(),
        customerApi.getAll(),
        userApi.getAll(),
      ]);
      setSales(apiSales.filter(s => s.status === 'approved'));
      setLocations(apiLocations);
      setArticles(apiArticles);
      setCustomers(apiCustomers);
      setUsers(apiUsers);
      setGatePasses(loadGatePassesFromStorage());
      setStockRequisitions(loadEligibleRequisitions());
    } catch (error) {
      console.error('Error loading data:', error);
      setGatePasses(loadGatePassesFromStorage());
      setStockRequisitions(loadEligibleRequisitions());
      setSales([]);
      setLocations([]);
      setArticles([]);
      setCustomers([]);
      setUsers([]);
    }
  };

  const handleCreateGatePass = () => {
    if (sourceType === 'sale') {
      if (!selectedSale || !fromLocation || !toLocation) {
        toast.error('Please fill all fields');
        return;
      }

      const sale = sales.find(s => s.id === selectedSale);
      if (!sale) return;

      const newGatePass: GatePass = {
        id: Date.now().toString(),
        gatePassNumber: generateGatePassNumber(),
        saleOrderId: selectedSale,
        fromLocationId: fromLocation,
        toLocationId: toLocation,
        items: sale.items.map(item => ({
          articleId: item.articleId,
          quantity: item.quantity,
        })),
        status: 'issued',
        purpose: 'sale',
        vehicleNumber: vehicleNumber || undefined,
        driverName: driverName || undefined,
        driverContact: driverContact || undefined,
        securityNotes: securityNotes || undefined,
        createdAt: new Date().toISOString(),
      };

      storage.add(STORAGE_KEYS.GATEPASSES, newGatePass);
      const salesData = storage.get<SaleOrder>(STORAGE_KEYS.SALES);
      const saleIndex = salesData.findIndex(s => s.id === selectedSale);
      if (saleIndex !== -1) {
        salesData[saleIndex] = { ...salesData[saleIndex], gatePassId: newGatePass.id };
        storage.set(STORAGE_KEYS.SALES, salesData);
      }

      toast.success('Gate pass created successfully');
    } else {
      if (!selectedRequisition || !fromLocation || !toLocation) {
        toast.error('Please fill all fields');
        return;
      }

      const requisitionsData = storage.get<StockRequisition>(STORAGE_KEYS.REQUISITIONS);
      const requisition = requisitionsData.find((r) => r.id === selectedRequisition);
      if (!requisition) {
        toast.error('Transfer request not found');
        return;
      }
      if (requisition.status !== 'approved' || requisition.gatePassId) {
        toast.error('This request is not eligible for a new gate pass');
        return;
      }

      const newGatePass: GatePass = {
        id: Date.now().toString(),
        gatePassNumber: generateGatePassNumber(),
        requisitionId: selectedRequisition,
        fromLocationId: fromLocation,
        toLocationId: toLocation,
        items: requisition.items.map(item => ({
          articleId: item.articleId,
          quantity: item.quantity,
        })),
        status: 'issued',
        purpose: 'transfer',
        vehicleNumber: vehicleNumber || undefined,
        driverName: driverName || undefined,
        driverContact: driverContact || undefined,
        securityNotes: securityNotes || undefined,
        createdAt: new Date().toISOString(),
      };

      storage.add(STORAGE_KEYS.GATEPASSES, newGatePass);

      const reqIndex = requisitionsData.findIndex((r) => r.id === selectedRequisition);
      if (reqIndex !== -1) {
        requisitionsData[reqIndex] = { 
          ...requisitionsData[reqIndex], 
          status: 'dispatched',
          gatePassId: newGatePass.id 
        };
        storage.set(STORAGE_KEYS.REQUISITIONS, requisitionsData);
      }

      toast.success('Gate pass created for transfer request');
    }

    setIsAddDialogOpen(false);
    resetForm();
    loadData();
  };

  const resetForm = () => {
    setSourceType('sale');
    setSelectedSale('');
    setSelectedRequisition('');
    setFromLocation('');
    setToLocation('');
    setVehicleNumber('');
    setDriverName('');
    setDriverContact('');
    setSecurityNotes('');
  };

  const getLocationName = (id: string) => locations.find(l => l.id === id)?.name || 'Unknown';
  const getArticleName = (id: string) => articles.find(a => a.id === id)?.name || 'Unknown';
  const getSaleOrderNumber = (id: string) => sales.find(s => s.id === id)?.orderNumber || 'Unknown';

  const getReedPick = (articleId: string) => {
    const article = articles.find((a) => a.id === articleId);
    return formatArticleReedPickLine(article) || '—';
  };

  const getLotNumber = (articleId: string) => {
    const article = articles.find((a) => a.id === articleId);
    return article?.lotNumber || '—';
  };

  const canCreate = userRole === 'owner' || userRole === 'warehouse';

  const selectedItems = sourceType === 'transfer'
    ? stockRequisitions.find((r) => r.id === selectedRequisition)?.items || []
    : sales.find((s) => s.id === selectedSale)?.items || [];

  const filteredGatePasses = gatePasses.filter((gp) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const fields = [
      gp.gatePassNumber,
      gp.purpose,
      getLocationName(gp.fromLocationId),
      getLocationName(gp.toLocationId),
      gp.vehicleNumber,
      gp.driverName,
      gp.driverContact,
    ];
    const sourceNumber = gp.saleOrderId
      ? getSaleOrderNumber(gp.saleOrderId)
      : stockRequisitions.find((r) => r.id === gp.requisitionId)?.requisitionNumber;
    if (sourceNumber) fields.push(sourceNumber);
    return fields.some((field) => field?.toLowerCase().includes(query));
  });

  const generateGatePassReport = () => {
    const allSales = storage.get<SaleOrder>(STORAGE_KEYS.SALES);
    const allRequisitions = storage.get<StockRequisition>(STORAGE_KEYS.REQUISITIONS);

    // Prepare CSV headers
    const headers = [
      'Date',
      'Sale Order / Transfer No',
      'Sales Person / Requestor',
      'From Location (Godown)',
      'To Location (Sale Point)',
      'Quality',
      'Quantity (Than)',
      'Quantity (Meter)',
      'Reference Name / Customer Name'
    ];

    // Prepare CSV rows
    const rows = gatePasses.map(gatePass => {
      const sale = allSales.find(s => s.id === gatePass.saleOrderId);
      const requisition = allRequisitions.find((r) => r.id === gatePass.requisitionId);
      const user = users.find(u => u.id === (sale?.createdBy || requisition?.requestedBy));
      
      let customerName = 'N/A';
      if (sale) {
        const customer = customers.find(c => c.id === sale.customerId);
        customerName = customer?.name || 'Unknown Customer';
      }

      // Aggregate items by article
      const itemsData = gatePass.items.map(item => {
        const article = articles.find(a => a.id === item.articleId);
        // Assuming 1 Than = article unit conversion (simplified)
        // In real scenario, you'd have proper conversion logic
        const quantityThan = item.quantity;
        const quantityMeter = item.quantity; // This should be calculated based on actual conversion
        
        return {
          quality: article?.fabricType || 'Unknown',
          quantityThan,
          quantityMeter
        };
      });

      // For simplicity, taking first item's quality or aggregating
      const quality = itemsData.map(i => i.quality).join(', ');
      const totalThan = itemsData.reduce((sum, i) => sum + i.quantityThan, 0);
      const totalMeter = itemsData.reduce((sum, i) => sum + i.quantityMeter, 0);

      return [
        formatDate(gatePass.createdAt),
        gatePass.saleOrderId ? getSaleOrderNumber(gatePass.saleOrderId) : (requisition?.requisitionNumber || 'N/A'),
        user?.name || 'Unknown',
        getLocationName(gatePass.fromLocationId),
        getLocationName(gatePass.toLocationId),
        quality,
        totalThan.toString(),
        totalMeter.toString(),
        customerName
      ];
    });

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `gate-pass-report-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Gate Pass report downloaded successfully');
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle>Gate Pass Management</CardTitle>
          <CardDescription>Create and track gate passes for goods movement</CardDescription>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search gate passes..."
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={generateGatePassReport}>
              <Download className="mr-2 h-4 w-4" />
              Download Report
            </Button>
            {canCreate && (
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Gate Pass
                  </Button>
                </DialogTrigger>
              <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Gate Pass</DialogTitle>
                <DialogDescription>Generate gate pass for goods transfer</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Source Type</Label>
                  <RadioGroup
                    value={sourceType}
                    onValueChange={(value) => {
                      const v = value as 'sale' | 'transfer';
                      setSourceType(v);
                      setSelectedSale('');
                      setSelectedRequisition('');
                      setFromLocation('');
                      setToLocation('');
                      if (v === 'transfer') {
                        setStockRequisitions(loadEligibleRequisitions());
                      }
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="sale" id="sale" />
                      <Label htmlFor="sale" className="font-normal cursor-pointer">Sales Order</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="transfer" id="transfer" />
                      <Label htmlFor="transfer" className="font-normal cursor-pointer">Transfer Request</Label>
                    </div>
                  </RadioGroup>
                </div>

                {sourceType === 'sale' ? (
                  <div className="space-y-2">
                    <Label>Sale Order</Label>
                    <Select value={selectedSale} onValueChange={setSelectedSale}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select approved sale order" />
                      </SelectTrigger>
                      <SelectContent>
                        {sales.map(sale => (
                          <SelectItem key={sale.id} value={sale.id}>
                            {sale.orderNumber} - {sale.items.length} items
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Transfer Request</Label>
                    <Select value={selectedRequisition} onValueChange={setSelectedRequisition}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select approved transfer request" />
                      </SelectTrigger>
                      <SelectContent>
                        {stockRequisitions.map((req) => (
                          <SelectItem key={req.id} value={req.id}>
                            {req.requisitionNumber} — {req.items.length} items
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>From Location (Godown)</Label>
                  <Select
                    value={fromLocation}
                    onValueChange={setFromLocation}
                    disabled={sourceType === 'transfer'}
                  >
                    <SelectTrigger className={sourceType === 'transfer' ? 'opacity-80' : ''}>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      {(sourceType === 'transfer' ? locations : locations.filter(l => l.type === 'godown')).map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>To Location (Sale Point)</Label>
                  <Select
                    value={toLocation}
                    onValueChange={setToLocation}
                    disabled={sourceType === 'transfer'}
                  >
                    <SelectTrigger className={sourceType === 'transfer' ? 'opacity-80' : ''}>
                      <SelectValue placeholder="Select destination" />
                    </SelectTrigger>
                    <SelectContent>
                      {(sourceType === 'transfer' ? locations : locations.filter(l => l.type === 'salepoint')).map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(sourceType === 'transfer' ? selectedRequisition : selectedSale) && (
                  <div className="space-y-2">
                    <Label>Items</Label>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Article</TableHead>
                            <TableHead>Reed/Pick</TableHead>
                            <TableHead>Lot</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                            {selectedItems.length > 0 ? (
                              selectedItems.map((item, idx) => (
                                <TableRow key={`${item.articleId}-${idx}`}>
                                  <TableCell className="font-medium">{getArticleName(item.articleId)}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">{getReedPick(item.articleId)}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">{getLotNumber(item.articleId)}</TableCell>
                                  <TableCell className="text-right">{item.quantity.toLocaleString()}</TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground">
                                  No items found
                                </TableCell>
                              </TableRow>
                            )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Vehicle Number</Label>
                    <Input
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value)}
                      placeholder="Enter vehicle number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Driver Contact</Label>
                    <Input
                      value={driverContact}
                      onChange={(e) => setDriverContact(e.target.value)}
                      placeholder="Enter contact"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Driver Name</Label>
                  <Input
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="Enter driver name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Security Notes (Optional)</Label>
                  <Input
                    value={securityNotes}
                    onChange={(e) => setSecurityNotes(e.target.value)}
                    placeholder="Add security notes"
                  />
                </div>
                <Button onClick={handleCreateGatePass} className="w-full">Create Gate Pass</Button>
              </div>
            </DialogContent>
          </Dialog>
          )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Gate Pass #</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Vehicle/Driver</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredGatePasses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No gate passes found
                </TableCell>
              </TableRow>
            ) : (
              filteredGatePasses.map(gatePass => (
                <TableRow key={gatePass.id}>
                  <TableCell className="font-medium">{gatePass.gatePassNumber}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{gatePass.purpose}</Badge>
                  </TableCell>
                  <TableCell>{getLocationName(gatePass.fromLocationId)}</TableCell>
                  <TableCell>{getLocationName(gatePass.toLocationId)}</TableCell>
                  <TableCell>
                    {gatePass.vehicleNumber && (
                      <div className="text-sm">
                        <div>{gatePass.vehicleNumber}</div>
                        {gatePass.driverName && <div className="text-muted-foreground">{gatePass.driverName}</div>}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={gatePass.status === 'received' ? 'default' : 'secondary'}>
                      {String(gatePass.status) === 'in_transit' ? 'issued' : gatePass.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(gatePass.createdAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

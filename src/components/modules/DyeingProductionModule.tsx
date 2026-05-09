/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { AppDatePicker } from '@/components/ui/app-date-picker';
import { cn, formatDate } from '@/lib/utils';
import { dyeingFlowApi, locationApi, vendorApi, stockApi } from '@/lib/api';
import { getApiBaseUrl, getAuthToken } from '@/lib/auth';
import { DyeingJob, DyeingReceive, LForm, LFormRow, Voucher, Location, Supplier } from '@/types';
import { Plus, Printer, Download, Check, X, Trash2, Eye, ChevronsUpDown, Square, CheckSquare, AlertTriangle, Scissors, Package } from 'lucide-react';
import { COLOR_OPTIONS } from '@/lib/constants';

const makeIssueLineId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

type SourceLotLine = {
  id: string;
  lotNo: string;
  articleName: string;
  quality: string;
  reedPick: string;
  availableMeters: number;
  usedThans?: number;
  usedMeters: number;
  skipLForm: boolean;
};

const EMPTY_LOT_SELECT = '__none__';

const toDateOnly = (value: string): string => String(value || '').slice(0, 10);

const formatReedPickLine = (article?: {
  yarnCount?: string;
  constraction?: string;
  composition?: string;
  width?: string;
}): string => {
  const slots = [
    String(article?.yarnCount || '').trim(),
    String(article?.constraction || '').trim(),
    String(article?.composition || '').trim(),
    String(article?.width || '').trim(),
  ];
  if (slots.every((s) => !s)) return '';
  return slots.map((s) => (s ? s : '-')).join(' / ');
};

/**
 * Detailed read-only view for a Dyeing Job or a Dyeing Receive record.
 */
const DyeingDetailsView = ({ isOpen, onOpenChange, item }: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  item: DyeingJob | DyeingReceive | null;
}) => {
  if (!item) return null;

  const isJob = 'workOrderNo' in item; // DyeingJob has workOrderNo
  const title = isJob ? `Work Order Details: ${item.workOrderNo}` : `Receive Details: ${(item as DyeingReceive).receiveNumber}`;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4 mb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
            <Badge variant={isJob ? (item.status === 'completed' ? 'default' : 'secondary') : ((item as DyeingReceive).shortagePercent > 5 ? 'destructive' : 'secondary')}>
              {isJob ? (item as DyeingJob).status.toUpperCase() : 'RECEIVED'}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/30 p-4 rounded-xl border-2 border-primary/5">
            <div className="space-y-1">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Date</p>
              <p className="text-sm font-semibold">{formatDate(isJob ? (item as DyeingJob).issueDate : (item as DyeingReceive).receiveDate)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">{isJob ? 'Dyeing House' : 'Vendor'}</p>
              <p className="text-sm font-semibold">{isJob ? (item as DyeingJob).dyeingHouse : (item as DyeingReceive).dyeingName}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Quality</p>
              <p className="text-sm font-semibold truncate" title={item.quality}>{item.quality}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">{isJob ? 'Colors' : 'Colour'}</p>
              <p className="text-sm font-semibold">
                {isJob ? `${(item as DyeingJob).colorCount}` : (item as DyeingReceive).colour}
              </p>
            </div>
          </div>

          {isJob ? (
            /* ISSUANCE VIEW */
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Source Lots */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                    <div className="w-1 h-3 bg-primary rounded-full" />
                    Source Lot Pool
                  </h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow className="h-8">
                          <TableHead className="text-[10px] uppercase font-bold">Lot No</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold text-right px-4">Meters</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(item as DyeingJob).sourceLots?.map((src, i) => (
                          <TableRow key={i} className="h-9">
                            <TableCell className="text-xs font-medium">{src.lotNo}</TableCell>
                            <TableCell className="text-xs text-right px-4 font-bold">{src.greyMeters.toFixed(2)}m</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Work Order Meta */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                    <div className="w-1 h-3 bg-primary rounded-full" />
                    Work Order Meta
                  </h4>
                  <div className="border rounded-lg p-4 bg-muted/5">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Color Count</p>
                    <p className="text-base font-semibold">{(item as DyeingJob).colorCount}</p>
                  </div>
                </div>
              </div>

              <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 flex justify-between items-center">
                <span className="text-xs font-bold uppercase text-primary/70">Total Issued Volume</span>
                <span className="text-lg font-black text-primary">{(item as DyeingJob).greyMeters.toFixed(2)} Meters</span>
              </div>

              {/* Attachment Preview */}
              {(item as DyeingJob).attachmentUrl && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                    <div className="w-1 h-3 bg-primary rounded-full" />
                    Attached Document
                  </h4>
                  <div className="border rounded-lg overflow-hidden bg-white">
                    {(item as DyeingJob).attachmentUrl?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                      <div className="p-4">
                        <img 
                          src={`${getApiBaseUrl()}${(item as DyeingJob).attachmentUrl}`}
                          alt="Work Order Attachment"
                          className="w-full h-auto max-h-[500px] object-contain mx-auto"
                          crossOrigin="anonymous"
                        />
                        <div className="mt-2 text-center">
                          <a 
                            href={`${getApiBaseUrl()}${(item as DyeingJob).attachmentUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            Open in new tab: {(item as DyeingJob).attachmentUrl?.split('/').pop()}
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 text-center">
                        <a 
                          href={`${getApiBaseUrl()}${(item as DyeingJob).attachmentUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-primary hover:underline font-semibold"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          View Attached Document
                        </a>
                        <p className="text-xs text-muted-foreground mt-2">
                          {(item as DyeingJob).attachmentUrl?.split('/').pop()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* RECEIVING VIEW */
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Metrics */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                    <div className="w-1 h-3 bg-primary rounded-full" />
                    Reception Summary
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-muted/20 border rounded-lg space-y-1">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Than</p>
                      <p className="text-lg font-bold">{(item as DyeingReceive).tiyarThan}</p>
                    </div>
                    <div className="p-3 bg-muted/20 border rounded-lg space-y-1">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Meters</p>
                      <p className="text-lg font-bold">{(item as DyeingReceive).tiyarMeters.toFixed(2)}m</p>
                    </div>
                    <div className="p-3 bg-muted/20 border rounded-lg space-y-1">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Shortage</p>
                      <p className={`text-lg font-bold ${(item as DyeingReceive).shortagePercent > 5 ? 'text-destructive' : 'text-amber-600'}`}>
                        {(item as DyeingReceive).shortagePercent}%
                      </p>
                    </div>
                    <div className="p-3 bg-muted/20 border rounded-lg space-y-1">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Delivery Note</p>
                      <p className="text-sm font-bold truncate">{(item as DyeingReceive).deliveryNoteNo || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Individual Than Breakdown */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                    <div className="w-1 h-3 bg-primary rounded-full" />
                    Individual Than Breakdown
                  </h4>
                  <div className="max-h-[250px] overflow-y-auto border rounded-xl p-3 bg-muted/5">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {(item as DyeingReceive).thanDetails?.length ? (item as DyeingReceive).thanDetails.map((than, i) => (
                        <div key={than.id || i} className="flex items-center justify-between p-2 bg-background border rounded-lg text-xs shadow-sm">
                          <span className="text-muted-foreground font-bold">{i + 1}</span>
                          <span className="font-black text-slate-700">{than.meters.toFixed(2)}m</span>
                        </div>
                      )) : (
                        <div className="col-span-full text-center py-8 text-muted-foreground text-xs italic">
                          No granular than details saved for this record.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {item.notes && (
            <div className="pt-4 border-t">
              <p className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Remarks / Production Notes</p>
              <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-lg text-sm text-slate-700 leading-relaxed italic">
                "{item.notes}"
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const DyeingProductionModule = () => {
  const [activeTab, setActiveTab] = useState('issue');
  const [locations, setLocations] = useState<Location[]>([]);
  const [dyeingVendors, setDyeingVendors] = useState<Supplier[]>([]);
  const [selectedDyeingVendorId, setSelectedDyeingVendorId] = useState('');
  const [availableLots, setAvailableLots] = useState<Array<{
    lotNo: string;
    articleName: string;
    quality: string;
    reedPick: string;
    colour: string;
    availableMeters: number;
  }>>([]);
  const [dyeingJobs, setDyeingJobs] = useState<DyeingJob[]>([]);
  const [dyeingReceives, setDyeingReceives] = useState<DyeingReceive[]>([]);
  const [lforms, setLforms] = useState<LForm[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);

  // View state
  const [viewItem, setViewItem] = useState<DyeingJob | DyeingReceive | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);
  const [issueForm, setIssueForm] = useState({
    issueDate: new Date().toISOString().split('T')[0],
    fromLocation: '',
    dyeingHouse: '',
    workOrderNo: '',
    colorCount: '1',
    notes: '',
    attachmentUrl: ''
  });
  const [isUploading, setIsUploading] = useState(false);
  const [sourceLots, setSourceLots] = useState<SourceLotLine[]>(() => [
    {
      id: makeIssueLineId(),
      lotNo: '',
      articleName: '',
      quality: '',
      reedPick: '',
      availableMeters: 0,
      usedThans: 0,
      usedMeters: 0,
      skipLForm: false,
    },
  ]);

  // Lot Receive Form State
  const [receiveForm, setReceiveForm] = useState({
    receiveDate: new Date().toISOString().split('T')[0],
    dyeingJobId: '',
    deliveryNoteNo: '',
    billNumber: '',
    tiyarThan: '',
    tiyarMeters: '',
    notes: '',
    thanLines: [] as { id: string; meters: number; isFaulty?: boolean }[]
  });
  const [selectedReceiveJobIds, setSelectedReceiveJobIds] = useState<string[]>([]);
  const [openJobCombo, setOpenJobCombo] = useState(false);
  const [openReceiveCombo, setOpenReceiveCombo] = useState(false);
  const [lformState, setLformState] = useState({
    dyeingReceiveId: '',
    operationDate: new Date().toISOString().split('T')[0],
    operator: '',
    colorGroups: [] as {
      id: string;
      colorName: string;
      thanCount: number;
      thanLines: {
        id: string;
        meters: number;
        placeholderMeters?: number;
        isFaulty?: boolean;
        pieceType: 'loose' | 'grade_b' | 'cut_piece';
      }[];
    }[]
  });

  // Cutting & Packing State
  const [cuttingBatches, setCuttingBatches] = useState<any[]>([]);
  const [packingBatches, setPackingBatches] = useState<any[]>([]);

  const [isCuttingDialogOpen, setIsCuttingDialogOpen] = useState(false);
  const [isPackingDialogOpen, setIsPackingDialogOpen] = useState(false);
  const [cuttingBundles, setCuttingBundles] = useState<any[]>([]);
  const [packingSelectedBundles, setPackingSelectedBundles] = useState<any[]>([]);

  /** Warehouses linked to the selected dyeing vendor only (issue-from grey stock). */
  const vendorWarehousesForIssue = useMemo(() => {
    if (!selectedDyeingVendorId) return [];
    return locations.filter((loc) => {
      const isVendorWarehouse =
        loc.ownershipType === 'vendor' || loc.warehouseType === 'supplier';
      const matchesVendor =
        loc.vendorId === selectedDyeingVendorId || loc.supplierId === selectedDyeingVendorId;
      const isStorage = loc.type === 'godown' || loc.type === 'warehouse';
      return isVendorWarehouse && matchesVendor && isStorage;
    });
  }, [locations, selectedDyeingVendorId]);

  const generateDatewiseWorkOrderNo = useCallback((issueDate: string) => {
    if (!issueDate) return '';

    const normalizedIssueDate = toDateOnly(issueDate);
    const compactDate = normalizedIssueDate.replace(/-/g, '');
    const todaysJobs = dyeingJobs.filter((job) => toDateOnly(job.issueDate) === normalizedIssueDate);

    const maxSequence = todaysJobs.reduce((max, job) => {
      const match = job.workOrderNo?.match(/-(\d{3})$/);
      const seq = match ? Number(match[1]) : 0;
      return seq > max ? seq : max;
    }, 0);

    const nextSequence = String(maxSequence + 1).padStart(3, '0');
    return `WO-${compactDate}-${nextSequence}`;
  }, [dyeingJobs]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!issueForm.issueDate) return;

    const nextWorkOrderNo = generateDatewiseWorkOrderNo(issueForm.issueDate);
    setIssueForm(prev => {
      if (prev.workOrderNo === nextWorkOrderNo) return prev;
      return {
        ...prev,
        workOrderNo: nextWorkOrderNo,
      };
    });
  }, [issueForm.issueDate, dyeingJobs, generateDatewiseWorkOrderNo]);

  useEffect(() => {
    const loadLotsByLocation = async () => {
      if (!issueForm.fromLocation) {
        setAvailableLots([]);
        return;
      }

      try {
        const stockItems = await stockApi.getAll(issueForm.fromLocation, undefined, 'RM');
        const lotsMap = new Map<string, {
          lotNo: string;
          articleName: string;
          quality: string;
          reedPick: string;
          colour: string;
          availableMeters: number;
        }>();

        stockItems.forEach((item) => {
          const lotNo = item.lotNo || item.article?.lotNumber;
          if (!lotNo) return;

          const inferredQuality = String(
            item.article?.grade || item.article?.fabricType || item.article?.name || ''
          ).trim();
          const inferredReedPick = formatReedPickLine(item.article);
          const inferredColour = String(item.article?.color || (item as any).shade || '').trim();
          const itemMeters = Number(item.quantity) || 0;

          if (!lotsMap.has(lotNo)) {
            lotsMap.set(lotNo, {
              lotNo,
              articleName: item.article?.name || 'Unknown article',
              quality: inferredQuality,
              reedPick: inferredReedPick,
              colour: inferredColour,
              availableMeters: itemMeters,
            });
          } else {
            const existing = lotsMap.get(lotNo)!;
            existing.availableMeters += itemMeters;
            if (!existing.quality && inferredQuality) {
              existing.quality = inferredQuality;
            }
            if (!existing.reedPick && inferredReedPick) {
              existing.reedPick = inferredReedPick;
            }
            if (!existing.colour && inferredColour) {
              existing.colour = inferredColour;
            }
          }
        });

        const lots = Array.from(lotsMap.values()).sort((a, b) => a.lotNo.localeCompare(b.lotNo));
        setAvailableLots(lots);

        // Clear lot rows that are no longer valid for this location's stock.
        setSourceLots((prev) =>
          prev.map((line) => {
            if (!line.lotNo || lots.some((l) => l.lotNo === line.lotNo)) return line;
            return {
              ...line,
              lotNo: '',
              articleName: '',
              quality: '',
              reedPick: '',
              availableMeters: 0,
              usedMeters: 0,
            };
          })
        );
      } catch (error) {
        console.error('Error loading lots by location:', error);
        setAvailableLots([]);
      }
    };

    loadLotsByLocation();
  }, [issueForm.fromLocation]);

  useEffect(() => {
    setSourceLots([
      {
        id: makeIssueLineId(),
        lotNo: '',
        articleName: '',
        quality: '',
        reedPick: '',
        availableMeters: 0,
        usedThans: 0,
        usedMeters: 0,
        skipLForm: false,
      },
    ]);
  }, [issueForm.fromLocation]);

  const getLotsOptionsForSource = (rowId: string) => {
    const selectedElsewhere = new Set(
      sourceLots.filter((l) => l.id !== rowId && l.lotNo).map((l) => l.lotNo)
    );
    return availableLots.filter((l) => !selectedElsewhere.has(l.lotNo));
  };


  // Source Lot Handlers
  const addSourceLotLine = () => {
    setSourceLots(prev => [...prev, {
      id: makeIssueLineId(),
      lotNo: '',
      articleName: '',
      quality: '',
      reedPick: '',
      availableMeters: 0,
      usedThans: 0,
      usedMeters: 0,
      skipLForm: false,
    }]);
  };

  const removeSourceLotLine = (id: string) => {
    setSourceLots(prev => prev.length > 1 ? prev.filter(l => l.id !== id) : prev);
  };

  const handleSelectLotForSource = (id: string, lotNo: string) => {
    if (lotNo === EMPTY_LOT_SELECT) {
      setSourceLots(prev => prev.map(l => l.id === id ? { ...l, lotNo: '', quality: '', reedPick: '', availableMeters: 0, usedThans: 0, usedMeters: 0, articleName: '' } : l));
      return;
    }
    const lotInfo = availableLots.find(l => l.lotNo === lotNo);
    setSourceLots(prev => prev.map(l => l.id === id ? {
      ...l,
      lotNo,
      quality: lotInfo?.quality || '',
      reedPick: lotInfo?.reedPick || '',
      articleName: lotInfo?.articleName || '',
      availableMeters: lotInfo?.availableMeters || 0,
      usedThans: 0,
      usedMeters: lotInfo?.availableMeters || 0,
    } : l));
  };

  const updateSourceLotUsedMeters = (id: string, meters: number) => {
    setSourceLots(prev => prev.map(l => l.id === id ? { ...l, usedMeters: meters } : l));
  };

  const updateSourceLotUsedThans = (id: string, thans: number) => {
    setSourceLots(prev => prev.map(l => l.id === id ? { ...l, usedThans: thans } : l));
  };

  const loadData = async () => {
    // Load locations and vendors first (critical for form to work)
    try {
      const [apiLocations, apiVendors] = await Promise.all([
        locationApi.getAll(),
        vendorApi.getAll(),
      ]);
      
      setLocations(
        apiLocations.filter(
          (loc) => loc.type === 'godown' || loc.type === 'warehouse'
        )
      );
      
      const dyeingOnly = apiVendors.filter(vendor => vendor.category === 'dyeing');
      setDyeingVendors(dyeingOnly);
      
      console.log('[DyeingModule] Locations & Vendors loaded successfully');
      console.log('[DyeingModule] Dyeing vendors:', dyeingOnly.length);
    } catch (error) {
      console.error('[DyeingModule] Error loading locations/vendors:', error);
      toast({
        title: 'Error',
        description: 'Failed to load vendors and locations',
        variant: 'destructive',
      });
      setLocations([]);
      setDyeingVendors([]);
    }
    
    // Load dyeing flow data separately (non-critical, don't block form)
    try {
      const flowData = await dyeingFlowApi.getAll();
      setDyeingJobs(flowData.jobs || []);
      setDyeingReceives(flowData.receives || []);
      setLforms(flowData.lforms || []);
      setVouchers(flowData.vouchers || []);
      console.log('[DyeingModule] Dyeing flow data loaded successfully');
    } catch (error) {
      console.error('[DyeingModule] Error loading dyeing flow data:', error);
      // Don't show error toast for flow data - just log it
      setDyeingJobs([]);
      setDyeingReceives([]);
      setLforms([]);
      setVouchers([]);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!issueForm.workOrderNo) {
      toast({ 
        title: 'Error', 
        description: 'Work order number not generated yet. Please select a date first.', 
        variant: 'destructive' 
      });
      return;
    }

    try {
      setIsUploading(true);
      const token = getAuthToken();
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${getApiBaseUrl()}/api/upload?workOrderNo=${encodeURIComponent(issueForm.workOrderNo)}`, {
        method: 'POST',
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');
      const payload = await res.json();
      if (!payload.success) throw new Error(payload.error || 'Upload failed');

      setIssueForm(prev => ({ ...prev, attachmentUrl: payload.data.url }));
      toast({ title: 'Success', description: 'File uploaded successfully' });
    } catch (error) {
      console.error('Upload Error:', error);
      toast({ title: 'Upload Failed', description: 'Could not upload attachment.', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  // Issue Grey Material to Dyeing (creates many-to-many relationship)
  const handleIssueGreyMaterial = async () => {
    if (!issueForm.fromLocation || !issueForm.dyeingHouse) {
      toast({
        title: "Validation Error",
        description: "Please select warehouse and dyeing house",
        variant: "destructive"
      });
      return;
    }

    if (!issueForm.attachmentUrl) {
      toast({
        title: "Validation Error",
        description: "Please upload an attachment (Picture/Document) before submitting",
        variant: "destructive"
      });
      return;
    }

    const validSources = sourceLots.filter(l => l.lotNo && l.usedMeters > 0);

    if (validSources.length === 0) {
      toast({
        title: "Validation Error",
        description: "Add at least one source lot with meters to use",
        variant: "destructive"
      });
      return;
    }

    const totalSource = validSources.reduce((sum, l) => sum + l.usedMeters, 0);
    const totalSourceThan = validSources.reduce((sum, l) => sum + (l.usedThans || 0), 0);
    const globalSkipLForm = validSources.some(l => l.skipLForm);
    const colorCount = Math.max(1, Number(issueForm.colorCount) || 1);

    // Quality check (Warning)
    const qualities = new Set(validSources.map(l => l.quality));
    if (qualities.size > 1) {
      if (!window.confirm("Warning: Multiple distinct qualities found in source lots. Proceed anyway?")) return;
    }

    const normalizedIssueDate = toDateOnly(issueForm.issueDate);
    const compactDate = normalizedIssueDate.replace(/-/g, '');
    const todaysJobs = dyeingJobs.filter((job) => toDateOnly(job.issueDate) === normalizedIssueDate);
    const maxSequence = todaysJobs.reduce((max, job) => {
      const match = job.workOrderNo?.match(/-(\d{3})$/);
      const seq = match ? Number(match[1]) : 0;
      return seq > max ? seq : max;
    }, 0);
    const generatedWorkOrderNo = `WO-${compactDate}-${String(maxSequence + 1).padStart(3, '0')}`;

    const baseTime = Date.now();
    const joinedLots = validSources.map(l => l.lotNo).join(', ');
    const sharedQuality = validSources[0].quality;
    const structuredSources = validSources.map(l => ({
      lotNo: l.lotNo,
      greyMeters: l.usedMeters,
      quality: l.quality
    }));

    try {
      const newJob: DyeingJob = {
        id: `${baseTime}-${generatedWorkOrderNo}`,
        jobNumber: `DJ-${baseTime}`,
        issueDate: issueForm.issueDate,
        fromLocation: issueForm.fromLocation,
        dyeingHouse: issueForm.dyeingHouse,
        workOrderNo: generatedWorkOrderNo,
        lotNo: joinedLots,
        quality: sharedQuality,
        colour: undefined,
        colorCount,
        greyThan: totalSourceThan,
        greyMeters: totalSource,
        skipLForm: globalSkipLForm,
        sourceLots: structuredSources,
        attachmentUrl: issueForm.attachmentUrl,
        notes: issueForm.notes,
        status: 'issued',
        createdBy: 'current_user',
        createdAt: new Date().toISOString()
      };
      await dyeingFlowApi.createJob(newJob);
    } catch (error) {
      console.error('Create dyeing jobs error:', error);
      toast({
        title: 'Save Failed',
        description: 'Could not save dyeing issue data to server.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: "Success",
      description: `Issued ${totalSource.toFixed(2)}m from ${validSources.length} lot(s) for ${colorCount} color(s).`
    });

    setIsIssueDialogOpen(false);

    setIssueForm({
      issueDate: new Date().toISOString().split('T')[0],
      fromLocation: '',
      dyeingHouse: '',
      workOrderNo: '',
      colorCount: '1',
      notes: '',
      attachmentUrl: ''
    });
    setSourceLots([
      {
        id: makeIssueLineId(),
        lotNo: '',
        articleName: '',
        quality: '',
        reedPick: '',
        availableMeters: 0,
        usedThans: 0,
        usedMeters: 0,
        skipLForm: false,
      },
    ]);
    setSelectedDyeingVendorId('');
    loadData();
  };

  /** Remove a dyeing job and cascade-delete linked receive / L-form / voucher rows from DB. */
  const deleteDyeingJobEntry = async (job: DyeingJob) => {
    if (
      !window.confirm(
        `Delete work order ${job.workOrderNo} (Lot ${job.lotNo})? Related receive, L-form, and voucher records for this job will also be removed.`
      )
    ) {
      return;
    }

    try {
      await dyeingFlowApi.deleteJobCascade(job.id);
    } catch (error) {
      console.error('Delete dyeing job error:', error);
      toast({
        title: 'Delete Failed',
        description: 'Could not delete this work order from server.',
        variant: 'destructive',
      });
      return;
    }

    setReceiveForm((prev) => (prev.dyeingJobId === job.id ? { ...prev, dyeingJobId: '' } : prev));
    setLformState((prev) => ({ ...prev, dyeingReceiveId: '', thanLines: [] }));

    toast({
      title: 'Removed',
      description: `Work order ${job.workOrderNo} deleted`,
    });
    loadData();
  };

  // Lot Receive (Step 1)
  const handleLotReceive = async () => {
    const tiyarThan = Number(receiveForm.tiyarThan);
    const tiyarMeters = Number(receiveForm.tiyarMeters);
    const contextJobs = selectedJobs.length > 0 ? selectedJobs : (selectedJob ? [selectedJob] : []);

    if (contextJobs.length === 0 || tiyarThan <= 0 || tiyarMeters <= 0) {
      toast({
        title: "Validation Error",
        description: "Please select a dyeing job and enter valid total received than and meters.",
        variant: "destructive"
      });
      return;
    }

    const job = contextJobs[0];
    if (!job) return;

    const totalIssuedThans = contextJobs.reduce((sum, j) => sum + (Number(j.greyThan) || 0), 0);
    const totalIssuedMeters = contextJobs.reduce((sum, j) => sum + (Number(j.greyMeters) || 0), 0);
    const shortageThan = totalIssuedThans - tiyarThan;
    const shortageMeters = totalIssuedMeters - tiyarMeters;
    const shortagePercent = totalIssuedMeters > 0 ? ((shortageMeters / totalIssuedMeters) * 100) : 0;
    const contextLots = Array.from(
      new Set(
        contextJobs.flatMap((j) =>
          String(j.lotNo || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        )
      )
    );
    const contextColours = Array.from(new Set(contextJobs.map((j) => j.colour).filter(Boolean)));
    const contextQualities = Array.from(new Set(contextJobs.map((j) => j.quality).filter(Boolean)));
    const contextDyeingHouses = Array.from(new Set(contextJobs.map((j) => j.dyeingHouse).filter(Boolean)));

    const buildDistributedAllocations = () => {
      if (contextJobs.length === 1) {
        const single = contextJobs[0];
        return [
          {
            job: single,
            allocatedMeters: tiyarMeters,
            allocatedThans: tiyarThan,
          },
        ];
      }

      const totalMeterWeight = contextJobs.reduce((sum, j) => sum + Math.max(Number(j.greyMeters) || 0, 0), 0);
      const meterWeights = contextJobs.map((j) => (totalMeterWeight > 0 ? Math.max(Number(j.greyMeters) || 0, 0) : 1));
      const meterWeightSum = meterWeights.reduce((sum, w) => sum + w, 0);

      let allocatedMetersSoFar = 0;
      const meterAllocations = contextJobs.map((contextJob, index) => {
        if (index === contextJobs.length - 1) {
          return Math.max(Number((tiyarMeters - allocatedMetersSoFar).toFixed(2)), 0);
        }
        const raw = meterWeightSum > 0 ? (tiyarMeters * meterWeights[index]) / meterWeightSum : 0;
        const rounded = Number(raw.toFixed(2));
        allocatedMetersSoFar += rounded;
        return rounded;
      });

      const isIntegerThanInput = Number.isInteger(tiyarThan);
      let thanAllocations: number[];
      if (!isIntegerThanInput) {
        let allocatedThansSoFar = 0;
        thanAllocations = contextJobs.map((contextJob, index) => {
          if (index === contextJobs.length - 1) {
            return Math.max(Number((tiyarThan - allocatedThansSoFar).toFixed(2)), 0);
          }
          const raw = meterWeightSum > 0 ? (tiyarThan * meterWeights[index]) / meterWeightSum : 0;
          const rounded = Number(raw.toFixed(2));
          allocatedThansSoFar += rounded;
          return rounded;
        });
      } else {
        const raw = contextJobs.map((contextJob, index) =>
          meterWeightSum > 0 ? (tiyarThan * meterWeights[index]) / meterWeightSum : 0
        );
        thanAllocations = raw.map((value) => Math.floor(value));
        let remainder = Math.max(Math.round(tiyarThan - thanAllocations.reduce((sum, value) => sum + value, 0)), 0);
        const order = raw
          .map((value, index) => ({ index, frac: value - Math.floor(value) }))
          .sort((a, b) => b.frac - a.frac);
        let cursor = 0;
        while (remainder > 0 && order.length > 0) {
          thanAllocations[order[cursor % order.length].index] += 1;
          remainder -= 1;
          cursor += 1;
        }
      }

      return contextJobs.map((contextJob, index) => ({
        job: contextJob,
        allocatedMeters: meterAllocations[index] || 0,
        allocatedThans: thanAllocations[index] || 0,
      }));
    };

    const allocations = buildDistributedAllocations();
    const receivesToCreate: DyeingReceive[] = allocations.map(({ job: allocatedJob, allocatedMeters, allocatedThans }, index) => {
      const jobIssuedThans = Number(allocatedJob.greyThan) || 0;
      const jobIssuedMeters = Number(allocatedJob.greyMeters) || 0;
      const jobShortageMeters = jobIssuedMeters - allocatedMeters;
      const jobShortageThans = jobIssuedThans - allocatedThans;
      const jobShortagePercent = jobIssuedMeters > 0 ? (jobShortageMeters / jobIssuedMeters) * 100 : 0;

      return {
        id: `${Date.now()}-${index}`,
        receiveNumber: `DR-${Date.now()}-${index + 1}`,
        dyeingJobId: allocatedJob.id,
        lotNo: allocatedJob.lotNo,
        receiveDate: receiveForm.receiveDate,
        dyeingName: allocatedJob.dyeingHouse,
        quality: allocatedJob.quality,
        colour: allocatedJob.colour || `MIXED (${allocatedJob.colorCount})`,
        tiyarThan: Number(allocatedThans.toFixed(2)),
        tiyarMeters: Number(allocatedMeters.toFixed(2)),
        shortageThan: Number(jobShortageThans.toFixed(2)),
        shortageMeters: Number(jobShortageMeters.toFixed(2)),
        shortagePercent: Number(jobShortagePercent.toFixed(2)),
        deliveryNoteNo: receiveForm.deliveryNoteNo,
        billNumber: receiveForm.billNumber,
        notes: receiveForm.notes,
        thanDetails: contextJobs.length === 1 ? receiveForm.thanLines : [],
        createdBy: 'current_user',
        createdAt: new Date().toISOString(),
      };
    });

    try {
      await Promise.all(receivesToCreate.map((payload) => dyeingFlowApi.createReceive(payload)));

      // Keep partially received jobs selectable for subsequent receives.
      const nextStatusByJob = new Map<string, DyeingJob['status']>();
      contextJobs.forEach((contextJob) => {
        const alreadyReceivedMeters = dyeingReceives
          .filter((r) => r.dyeingJobId === contextJob.id)
          .reduce((sum, r) => sum + (Number(r.tiyarMeters) || 0), 0);
        const newlyReceivedMeters = receivesToCreate
          .filter((r) => r.dyeingJobId === contextJob.id)
          .reduce((sum, r) => sum + (Number(r.tiyarMeters) || 0), 0);
        const totalReceivedMeters = alreadyReceivedMeters + newlyReceivedMeters;
        const issuedMeters = Number(contextJob.greyMeters) || 0;
        const isFullyReceived = totalReceivedMeters >= issuedMeters - 0.01;
        nextStatusByJob.set(contextJob.id, isFullyReceived ? 'received' : 'in_dyeing');
      });

      await Promise.all(
        Array.from(nextStatusByJob.entries()).map(([jobId, nextStatus]) =>
          dyeingFlowApi.updateJobStatus(jobId, nextStatus)
        )
      );
    } catch (error) {
      console.error('Create dyeing receive error:', error);
      toast({
        title: 'Save Failed',
        description: 'Could not save dyeing receive data to server.',
        variant: 'destructive',
      });
      return;
    }

    if (shortagePercent > 5) {
      toast({
        title: "High Shortage Alert",
        description: `Shortage is ${shortagePercent.toFixed(2)}% - requires review`,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: `Received ${receivesToCreate.length} lot(s): ${tiyarThan} than, ${tiyarMeters.toFixed(2)}m total`
      });
    }

    setReceiveForm({
      receiveDate: new Date().toISOString().split('T')[0],
      dyeingJobId: '',
      deliveryNoteNo: '',
      billNumber: '',
      tiyarThan: '',
      tiyarMeters: '',
      notes: '',
      thanLines: []
    });
    setSelectedReceiveJobIds([]);
    loadData();
  };

  // Save L-Form
  const saveLForm = async (finalize: boolean = false) => {
    if (!lformState.dyeingReceiveId || !lformState.operator || lformState.colorGroups.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields and add at least one color group.",
        variant: "destructive"
      });
      return;
    }

    const receive = dyeingReceives.find(r => r.id === lformState.dyeingReceiveId);
    if (!receive) return;

    // Flatten all thanLines from all color groups
    const allThanLines = lformState.colorGroups.flatMap(group => 
      group.thanLines.map(line => ({ ...line, colorName: group.colorName }))
    );

    const totalMeters = allThanLines.reduce((sum, line) => sum + (line.meters || 0), 0);
    const totalThans = allThanLines.length;

    // Validate totals match received amounts
    if (Math.abs(totalMeters - receive.tiyarMeters) > 0.5) {
      toast({
        title: "Meter Mismatch",
        description: `Total meters (${totalMeters.toFixed(2)} M) must equal received meters (${receive.tiyarMeters.toFixed(2)} M). Difference: ${Math.abs(totalMeters - receive.tiyarMeters).toFixed(2)} M`,
        variant: "destructive"
      });
      return;
    }

    if (totalThans !== receive.tiyarThan) {
      toast({
        title: "Than Count Mismatch",
        description: `Total thans (${totalThans}) must equal received thans (${receive.tiyarThan})`,
        variant: "destructive"
      });
      return;
    }

    const rows: LFormRow[] = allThanLines.map((line, idx) => ({
      id: line.id,
      rowNumber: idx + 1,
      itemType: line.pieceType === 'grade_b' ? 'standard_than' : line.pieceType === 'loose' ? 'loose_than' : 'cut_piece',
      thanId: line.id,
      shade: line.isFaulty ? 'FAULTY' : line.colorName,
      quality: receive.quality,
      thanLength: line.meters || 0,
      meterEquivalent: line.meters || 0,
      remarks: line.isFaulty ? 'Marked as Faulty' : ''
    }));

    const newLForm: Partial<LForm> = {
      lformNumber: `LF-${Date.now()}`,
      lotNo: receive.lotNo,
      dyeingReceiveId: receive.id,
      operationDate: lformState.operationDate,
      operator: lformState.operator,
      rows,
      totalThans,
      totalMeters,
      status: finalize ? 'finalized' : 'draft'
    };

    try {
      await dyeingFlowApi.createLForm(newLForm);
    } catch (error) {
      console.error('Create L-Form error:', error);
      toast({
        title: 'Save Failed',
        description: 'Could not save L-Form to server.',
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: "Success",
      description: `L-Form ${finalize ? 'finalized' : 'saved as draft'}`
    });

    setLformState({
      dyeingReceiveId: '',
      operationDate: new Date().toISOString().split('T')[0],
      operator: '',
      colorGroups: []
    });
    loadData();
  };



  const receivableJobs = useMemo(() => {
    const epsilon = 0.01;
    return dyeingJobs.filter((job) => {
      const issuedMeters = Number(job.greyMeters) || 0;
      if (issuedMeters <= 0) return false;

      const receivedMeters = dyeingReceives
        .filter((receive) => receive.dyeingJobId === job.id)
        .reduce((sum, receive) => sum + (Number(receive.tiyarMeters) || 0), 0);

      return receivedMeters < issuedMeters - epsilon;
    });
  }, [dyeingJobs, dyeingReceives]);

  const selectedJob = receivableJobs.find(j => j.id === receiveForm.dyeingJobId);
  const selectedJobs = useMemo(
    () =>
      selectedReceiveJobIds.length > 0
        ? receivableJobs.filter((j) => selectedReceiveJobIds.includes(j.id))
        : selectedJob
          ? [selectedJob]
          : [],
    [receivableJobs, selectedReceiveJobIds, selectedJob]
  );
  const selectedWorkOrderNos = Array.from(new Set(selectedJobs.map((j) => j.workOrderNo)));
  const selectedWorkOrderNo = selectedWorkOrderNos[0] || '';
  const selectedWorkOrderJobs = selectedJobs;
  const selectedContextLots = useMemo(
    () =>
      Array.from(
        new Set(
          selectedWorkOrderJobs.flatMap((j) =>
            String(j.lotNo || '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          )
        )
      ),
    [selectedWorkOrderJobs]
  );
  const selectedContextQualities = useMemo(
    () => Array.from(new Set(selectedWorkOrderJobs.map((j) => j.quality).filter(Boolean))),
    [selectedWorkOrderJobs]
  );
  const selectedContextDyeingHouses = useMemo(
    () => Array.from(new Set(selectedWorkOrderJobs.map((j) => j.dyeingHouse).filter(Boolean))),
    [selectedWorkOrderJobs]
  );
  const selectedContextIssuedMeters = useMemo(
    () => selectedWorkOrderJobs.reduce((sum, j) => sum + (Number(j.greyMeters) || 0), 0),
    [selectedWorkOrderJobs]
  );
  const selectedContextColorCount = useMemo(
    () => selectedWorkOrderJobs.reduce((sum, j) => sum + Number(j.colorCount), 0),
    [selectedWorkOrderJobs]
  );

  useEffect(() => {
    if (selectedReceiveJobIds.length === 0) return;
    const availableJobIds = new Set(receivableJobs.map((j) => j.id));
    const pruned = selectedReceiveJobIds.filter((jobId) => availableJobIds.has(jobId));
    if (pruned.length !== selectedReceiveJobIds.length) {
      setSelectedReceiveJobIds(pruned);
      if (pruned.length === 0) {
        setReceiveForm((prev) => ({ ...prev, dyeingJobId: '' }));
      } else if (!pruned.includes(receiveForm.dyeingJobId)) {
        setReceiveForm((prev) => ({ ...prev, dyeingJobId: pruned[0] }));
      }
    }
  }, [receivableJobs, selectedReceiveJobIds, receiveForm.dyeingJobId]);
  const selectedReceive = dyeingReceives.find(r => r.id === lformState.dyeingReceiveId);

  return (
    <div className="space-y-6">
      <DyeingDetailsView
        isOpen={isViewDialogOpen}
        onOpenChange={setIsViewDialogOpen}
        item={viewItem}
      />
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Dyeing Production Flow</h2>
        <div className="flex gap-2">
          <Badge variant="secondary">🟩 Grey Material</Badge>
          <Badge variant="secondary">🟦 Dyeing</Badge>
          <Badge variant="secondary">🟨 L-Form</Badge>
          <Badge variant="secondary">🟧 Cutting & Packing</Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="issue">Issue Grey</TabsTrigger>
          <TabsTrigger value="receive">Step 1: Receive</TabsTrigger>
          <TabsTrigger value="lform">Step 2: L-Form</TabsTrigger>
          <TabsTrigger value="cutting-packing">Step 3: Cutting & Packing</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        {/* Issue Grey Material */}
        <TabsContent value="issue">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Dyeing Issuance Work Orders</CardTitle>
              <Dialog open={isIssueDialogOpen} onOpenChange={setIsIssueDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    New Issuance
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] lg:max-w-6xl overflow-y-auto max-h-[90vh]">
                  <DialogHeader>
                    <DialogTitle>Create New Dyeing Work Order</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 pt-4">
                    {/* Header Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-6 border-b">
                      <div className="space-y-1">
                        <Label className="text-sm">Dyeing House</Label>
                        <Select
                          value={selectedDyeingVendorId}
                          onValueChange={v => {
                            const vendor = dyeingVendors.find((item) => item.id === v);
                            setSelectedDyeingVendorId(v);
                            setIssueForm({
                              ...issueForm,
                              dyeingHouse: vendor?.name || '',
                              fromLocation: '',
                            });
                          }}
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Select dyeing vendor" />
                          </SelectTrigger>
                          <SelectContent>
                            {dyeingVendors.length === 0 ? (
                              <SelectItem value="no-dyeing-vendor" disabled>No dyeing vendors available</SelectItem>
                            ) : (
                              dyeingVendors.map(vendor => (
                                <SelectItem key={vendor.id} value={vendor.id}>{vendor.name}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm">Work Order No</Label>
                        <Input
                          value={issueForm.workOrderNo}
                          readOnly
                          className="bg-muted h-10"
                          placeholder="Auto-generated"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm">Issue Date</Label>
                        <AppDatePicker
                          value={issueForm.issueDate}
                          className="h-10"
                          onChange={(nextValue) => setIssueForm({ ...issueForm, issueDate: nextValue })}
                        />
                      </div>
                      <div className="md:col-span-3 space-y-1">
                        <Label className="text-sm font-semibold text-muted-foreground mr-2">From Location</Label>
                        <Select
                          value={issueForm.fromLocation}
                          onValueChange={v => setIssueForm({ ...issueForm, fromLocation: v })}
                          disabled={!selectedDyeingVendorId}
                        >
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue
                              placeholder={
                                selectedDyeingVendorId
                                  ? 'Select vendor warehouse where grey cloth is located'
                                  : 'Select dyeing vendor first'
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {!selectedDyeingVendorId ? (
                              <SelectItem value="no-vendor" disabled>Select dyeing vendor first</SelectItem>
                            ) : vendorWarehousesForIssue.length === 0 ? (
                              <SelectItem value="no-vendor-warehouse" disabled>
                                No warehouse linked to this dyeing vendor
                              </SelectItem>
                            ) : (
                              vendorWarehousesForIssue.map((loc) => (
                                <SelectItem key={loc.id} value={loc.id}>
                                  {loc.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-8">
                      {/* SOURCE LOTS SECTION */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">Select lots from stock to build your total volume.</p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addSourceLotLine}
                            disabled={!issueForm.fromLocation}
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            Add lot
                          </Button>
                        </div>
                        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
                          <Table>
                            <TableHeader className="bg-muted/50">
                              <TableRow className="h-10 border-b">
                                <TableHead className="text-xs w-[220px]">Lot Number</TableHead>
                                <TableHead className="text-xs w-[80px] text-center">No L-Form</TableHead>
                                <TableHead className="text-xs w-[100px] text-right">Available</TableHead>
                                <TableHead className="text-xs w-[80px] text-right">Thans</TableHead>
                                <TableHead className="text-xs w-[120px] text-right">Meters to Use</TableHead>
                                <TableHead className="w-[40px]" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sourceLots.map((line) => (
                                <TableRow key={line.id} className="group transition-colors h-14 border-b last:border-0 hover:bg-muted/5">
                                  <TableCell className="py-2">
                                    <Select
                                      value={line.lotNo || EMPTY_LOT_SELECT}
                                      onValueChange={(v) => handleSelectLotForSource(line.id, v)}
                                      disabled={!issueForm.fromLocation}
                                    >
                                      <SelectTrigger className="h-8 text-[11px]">
                                        <SelectValue placeholder="Select lot" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value={EMPTY_LOT_SELECT}>— Select lot —</SelectItem>
                                        {getLotsOptionsForSource(line.id).map((lot) => (
                                          <SelectItem key={lot.lotNo} value={lot.lotNo}>
                                            {lot.lotNo} ({lot.articleName})
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    {line.reedPick && <span className="text-[10px] text-muted-foreground mt-1 block px-1">{line.reedPick}</span>}
                                  </TableCell>
                                  <TableCell className="py-2 text-center">
                                    <input
                                      type="checkbox"
                                      checked={line.skipLForm}
                                      onChange={(e) => setSourceLots(prev => prev.map(l => l.id === line.id ? { ...l, skipLForm: e.target.checked } : l))}
                                      className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                      title="Bypass L-Form for this lot?"
                                    />
                                  </TableCell>
                                  <TableCell className="text-right py-2 font-medium text-xs">
                                    {line.availableMeters.toFixed(2)}m
                                  </TableCell>
                                  <TableCell className="py-2">
                                    <Input
                                      type="number"
                                      step="1"
                                      min={0}
                                      value={line.usedThans || ''}
                                      className="text-right h-8 text-xs font-bold"
                                      onChange={(e) => updateSourceLotUsedThans(line.id, Number(e.target.value))}
                                    />
                                  </TableCell>
                                  <TableCell className="py-2">
                                    <Input
                                      type="number"
                                      step="1"
                                      min={0}
                                      value={line.usedMeters || ''}
                                      className={`text-right h-8 text-xs font-bold ${line.usedMeters > line.availableMeters ? 'border-destructive text-destructive bg-destructive/5' : ''}`}
                                      onChange={(e) => updateSourceLotUsedMeters(line.id, Number(e.target.value))}
                                    />
                                  </TableCell>
                                  <TableCell className="py-2 text-right">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => removeSourceLotLine(line.id)}
                                      disabled={sourceLots.length <= 1}
                                    >
                                      <X className="h-3 w-3 text-destructive" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                    </div>

                    <div className="mt-6 p-4 rounded-lg bg-muted/50 border grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                      <div className="rounded-lg border bg-card p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                              Color Count
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Select total number of colors for this work order.
                            </p>
                          </div>
                          <Input
                            type="number"
                            min={1}
                            max={200}
                            value={issueForm.colorCount}
                            onChange={(e) =>
                              setIssueForm((prev) => ({
                                ...prev,
                                colorCount: e.target.value,
                              }))
                            }
                            className="h-9 w-24 text-center"
                          />
                        </div>
                      </div>

                      <div className="rounded-lg border bg-card p-3 flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Source Pool</p>
                          <p className="text-xl font-bold">
                            {sourceLots.reduce((sum, l) => sum + l.usedMeters, 0).toFixed(2)}m
                          </p>
                        </div>
                        <Button
                          onClick={handleIssueGreyMaterial}
                          disabled={sourceLots.reduce((sum, l) => sum + l.usedMeters, 0) <= 0}
                          size="lg"
                          className="px-8"
                        >
                          Issue to Dyeing
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 mt-6 border-t">
                      <div className="space-y-3 border p-4 rounded-xl bg-muted/5 flex flex-col">
                        <Label className="text-sm font-bold text-slate-700">Production Notes</Label>
                        <Textarea
                          value={issueForm.notes}
                          onChange={e => setIssueForm({ ...issueForm, notes: e.target.value })}
                          placeholder="Include any specific instructions for the dyeing house..."
                          className="flex-1 min-h-[100px] text-sm bg-background resize-none border-muted-foreground/20 focus-visible:ring-primary/20"
                        />
                      </div>
                      <div className="space-y-3 border p-4 rounded-xl bg-muted/5 flex flex-col">
                        <Label className="text-sm font-bold text-slate-700">
                          Attachments (Picture / Doc) <span className="text-destructive">*</span>
                        </Label>
                        <div className={`flex-1 flex flex-col justify-center border-2 border-dashed rounded-lg p-4 bg-background relative transition-colors hover:bg-muted/10 group overflow-hidden ${
                          issueForm.attachmentUrl ? 'border-emerald-300/50' : 'border-muted-foreground/20'
                        }`}>
                          <Input
                            type="file"
                            onChange={handleFileUpload}
                            disabled={isUploading}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            title="Click or drop file to upload"
                          />
                          <div className="flex flex-col items-center justify-center text-center pointer-events-none">
                            {isUploading ? (
                              <span className="text-xs font-semibold text-primary animate-pulse">Uploading file...</span>
                            ) : issueForm.attachmentUrl ? (
                              <>
                                <Check className="h-6 w-6 text-emerald-500 mb-1" />
                                <span className="text-xs font-bold text-emerald-600 truncate max-w-full px-2">
                                  {issueForm.attachmentUrl.split('/').pop()}
                                </span>
                                <span className="text-[10px] text-muted-foreground mt-1 group-hover:text-primary transition-colors">Click to replace</span>
                              </>
                            ) : (
                              <>
                                <Plus className="h-6 w-6 text-muted-foreground mb-1 group-hover:text-primary transition-colors" />
                                <span className="text-xs font-semibold text-muted-foreground group-hover:text-slate-700 transition-colors">Click or drag file to upload</span>
                                <span className="text-[10px] text-muted-foreground/60 mt-1">Supports JPG, PNG, PDF</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Work Order No</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Lot No(s)</TableHead>
                      <TableHead>Quality</TableHead>
                      <TableHead>Dyeing House</TableHead>
                      <TableHead>Color Count</TableHead>
                      <TableHead>Grey Thans</TableHead>
                      <TableHead>Grey Meters</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[52px] text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...dyeingJobs].sort((a, b) => new Date(b.issueDate || 0).getTime() - new Date(a.issueDate || 0).getTime()).map(job => {
                      return (
                        <React.Fragment key={job.id}>
                          <TableRow>
                            <TableCell className="font-medium">{job.workOrderNo}</TableCell>
                            <TableCell className="text-muted-foreground">{formatDate(job.issueDate)}</TableCell>
                            <TableCell><Badge variant="outline" className="max-w-[200px] truncate">{job.lotNo}</Badge></TableCell>
                            <TableCell>{job.quality || '-'}</TableCell>
                            <TableCell>{job.dyeingHouse}</TableCell>
                            <TableCell>{job.colorCount}</TableCell>
                            <TableCell>{job.greyThan}</TableCell>
                            <TableCell>{job.greyMeters.toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge variant={job.status === 'completed' ? 'default' : 'secondary'} className="capitalize">
                                {job.status.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-primary hover:bg-primary/10"
                                  title="View Details"
                                  onClick={() => {
                                    setViewItem(job);
                                    setIsViewDialogOpen(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                  title="Delete job"
                                  onClick={() => deleteDyeingJobEntry(job)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                      );
                    })}
                    {dyeingJobs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                          No issuance work orders found. Click 'New Issuance' to create one.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lot Receive - Step 1 */}
        <TabsContent value="receive">
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Lot Receive (Tiyar Received)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Step 1: Job selection & header */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pb-4 border-b">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-tight">Receive Date</Label>
                  <AppDatePicker
                    value={receiveForm.receiveDate}
                    className="h-10 text-sm"
                    onChange={(nextValue) => setReceiveForm({ ...receiveForm, receiveDate: nextValue })}
                  />
                </div>
                <div className="space-y-1.5 flex flex-col justify-end">
                  <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-tight mb-1 inline-block">Dyeing Job (Work Order) *</Label>
                  <Popover open={openJobCombo} onOpenChange={setOpenJobCombo}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openJobCombo}
                        className="w-full justify-between h-10 px-3 font-normal bg-background"
                      >
                        {selectedReceiveJobIds.length > 1
                          ? `${selectedReceiveJobIds.length} work orders selected`
                          : receiveForm.dyeingJobId
                            ? (() => {
                              const j = dyeingJobs.find((job) => job.id === receiveForm.dyeingJobId);
                              return j ? <span className="truncate">{j.workOrderNo} · {j.dyeingHouse}</span> : "Select work order...";
                            })()
                            : "Select work order..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search job or lot no..." />
                        <CommandList>
                          <CommandEmpty>No work orders found.</CommandEmpty>
                          <CommandGroup>
                            {receivableJobs.map((job) => (
                              <CommandItem
                                key={job.id}
                                value={`${job.workOrderNo} ${job.lotNo} ${job.dyeingHouse} ${job.colour} ${job.id}`}
                                onSelect={() => {
                                  setSelectedReceiveJobIds((prev) => {
                                    const exists = prev.includes(job.id);
                                    const next = exists
                                      ? prev.filter((jobId) => jobId !== job.id)
                                      : [...prev, job.id];
                                    setReceiveForm((formPrev) => ({
                                      ...formPrev,
                                      dyeingJobId: next[0] || '',
                                    }));
                                    return next;
                                  });
                                }}
                                className="flex items-start py-2"
                              >
                                {selectedReceiveJobIds.includes(job.id) ? (
                                  <CheckSquare className="mr-2 h-4 w-4 flex-shrink-0 mt-0.5 text-primary" />
                                ) : (
                                  <Square className="mr-2 h-4 w-4 flex-shrink-0 mt-0.5 text-muted-foreground" />
                                )}
                                <div className="flex flex-col gap-0.5 truncate">
                                  <span className="font-medium">{job.workOrderNo} · <span className="font-normal text-muted-foreground">{job.dyeingHouse} ({job.colour})</span></span>
                                  <span className="text-[10px] uppercase font-bold text-muted-foreground/80">Lot: {job.lotNo}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-tight">Delivery Note No</Label>
                  <Input
                    value={receiveForm.deliveryNoteNo}
                    className="h-10 text-sm"
                    onChange={e => setReceiveForm({ ...receiveForm, deliveryNoteNo: e.target.value })}
                    placeholder="Enter delivery note (e.g. DN-123)"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-tight">Bill Number</Label>
                  <Input
                    value={receiveForm.billNumber}
                    className="h-10 text-sm"
                    onChange={e => setReceiveForm({ ...receiveForm, billNumber: e.target.value })}
                    placeholder="Enter bill number (e.g. BILL-123)"
                  />
                </div>
              </div>

              {/* Job summary */}
              {selectedJob && (
                <div className="p-4 rounded-xl bg-muted/30 border-2 border-primary/10 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-4 w-1 bg-primary rounded-full" />
                    <p className="text-xs font-bold text-primary uppercase tracking-widest">Original Grey Issue Context</p>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Lot Number</p>
                      <p className="text-sm font-semibold">{selectedContextLots.join(', ') || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Color Count</p>
                      <p className="text-sm font-semibold">{selectedContextColorCount || 1}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Quality</p>
                      <p className="text-sm font-semibold truncate" title={selectedContextQualities.join(', ')}>
                        {selectedContextQualities.join(', ') || '-'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Dyeing House</p>
                      <p className="text-sm font-semibold">{selectedContextDyeingHouses.join(', ') || '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase font-bold text-primary">Issued Volume</p>
                      <p className="text-sm font-bold text-primary">{selectedContextIssuedMeters.toFixed(2)} m</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Direct Tiyar Input */}
              {selectedJob && (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2 border-b">
                    <div className="space-y-1.5 p-3 border rounded-lg bg-emerald-50/50">
                      <Label className="text-[11px] font-bold uppercase tracking-tight text-emerald-800">Total Tiyar Than (Received)</Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="Ex: 5"
                        className="h-10 text-sm font-bold bg-background border-emerald-200 placeholder:text-muted-foreground/45"
                        value={receiveForm.tiyarThan || ''}
                        onChange={(e) => {
                          const n = Math.max(0, Math.min(500, Number(e.target.value)));
                          setReceiveForm(prev => {
                            const next: { id: string; meters: number }[] = [];
                            for (let i = 0; i < n; i++) {
                              next.push(prev.thanLines[i] ?? { id: `than-rec-${Date.now()}-${i}`, meters: 0 });
                            }
                            return { ...prev, tiyarThan: n.toString(), thanLines: next };
                          });
                        }}
                      />
                    </div>
                    <div className="space-y-1.5 p-3 border rounded-lg bg-emerald-50/50">
                      <Label className="text-[11px] font-bold uppercase tracking-tight text-emerald-800">Total Tiyar Meters (Received)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Ex: 500.25"
                        className="h-10 text-sm font-bold bg-background border-emerald-200 placeholder:text-muted-foreground/45"
                        value={receiveForm.tiyarMeters || ''}
                        onChange={e => setReceiveForm({ ...receiveForm, tiyarMeters: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* GRANULAR THAN ENTRY SECTION (Dye-Step 1) */}
                  <div className="pt-2 border-t mt-4">
                    <div className="flex items-center justify-between pb-2 border-b mb-4">
                      <div>
                        <h3 className="text-sm font-bold flex items-center gap-2">
                          <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px]">R</div>
                          Received Than Entry
                        </h3>
                        <p className="text-[11px] text-muted-foreground leading-tight">Specify individual meters to track granular lot volume.</p>
                      </div>
                      <div className="text-[10px] font-bold uppercase text-muted-foreground">
                        Count: {receiveForm.thanLines.length} Than
                      </div>
                    </div>

                    {receiveForm.thanLines.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 max-h-[300px] overflow-y-auto p-1">
                        {receiveForm.thanLines.map((line, idx) => (
                          <div
                            key={line.id}
                            className="flex items-center gap-2 p-2 rounded-lg border bg-card hover:bg-muted/5 transition-colors shadow-sm"
                          >
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[11px] font-bold text-muted-foreground/80">
                              {idx + 1}
                            </div>
                            <div className="relative flex-1">
                              <Input
                                type="number"
                                step="0.01"
                                min={0}
                                placeholder="0.00"
                                className="h-9 pl-7 pr-2 text-sm font-bold focus:ring-1"
                                value={line.meters || ''}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setReceiveForm(prev => {
                                    const nextLines = prev.thanLines.map((l, i) => i === idx ? { ...l, meters: val } : l);
                                    const totalSum = nextLines.reduce((s, ln) => s + ln.meters, 0);
                                    return {
                                      ...prev,
                                      thanLines: nextLines,
                                      tiyarMeters: totalSum > 0 ? totalSum.toFixed(2) : prev.tiyarMeters
                                    };
                                  });
                                }}
                              />
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-muted-foreground/40">M</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {receiveForm.thanLines.length > 0 && (
                      <div className="mt-4 p-4 bg-muted/40 border rounded-lg flex flex-col gap-2 text-sm">
                        <h4 className="font-semibold mb-1 uppercase text-[10px] tracking-wider text-muted-foreground">Summary:</h4>
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <strong>Total Rows:</strong> {receiveForm.thanLines.length}
                          </div>
                          <div>
                            <strong>Total Than:</strong> {receiveForm.thanLines.length}
                          </div>
                          <div>
                            <strong>Total Meters:</strong> {receiveForm.thanLines.reduce((sum, r) => sum + r.meters, 0).toFixed(2)} M
                          </div>
                          <div className={receiveForm.thanLines.filter(l => l.isFaulty).length > 0 ? "text-destructive font-bold" : ""}>
                            <strong>Faulty Thans:</strong> {receiveForm.thanLines.filter(l => l.isFaulty).length}
                          </div>
                        </div>

                        {receiveForm.thanLines.some(l => l.isFaulty) && (
                          <div className="bg-destructive/10 p-2 rounded border border-destructive/20 text-xs mt-1 flex items-start gap-2">
                            <AlertTriangle className="h-3 w-3 mt-0.5 text-destructive shrink-0" />
                            <div>
                              <span className="font-bold text-destructive uppercase tracking-tighter mr-2">List of Faulty:</span>
                              <span>
                                {receiveForm.thanLines
                                  .map((l, i) => l.isFaulty ? `#${i + 1}` : null)
                                  .filter(Boolean)
                                  .join(', ')}
                              </span>
                            </div>
                          </div>
                        )}

                        <div className={`mt-2 font-bold bg-background p-2 border rounded ${Math.abs(receiveForm.thanLines.reduce((s, l) => s + l.meters, 0) - selectedContextIssuedMeters) < 0.01 ? 'text-emerald-600 border-emerald-200' : 'text-amber-600 border-amber-200'}`}>
                          Comparison Vs. Issued Target: {selectedContextIssuedMeters.toFixed(2)} M
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Summary bar */}
                  {Number(receiveForm.tiyarMeters) > 0 && (() => {
                    const totalReceived = Number(receiveForm.tiyarMeters);
                    const shortageMeters = selectedContextIssuedMeters - totalReceived;
                    const shortagePercent = selectedContextIssuedMeters > 0 ? (shortageMeters / selectedContextIssuedMeters) * 100 : 0;
                    const isShort = shortageMeters > 0.01;
                    const isOver = shortageMeters < -0.01;

                    return (
                      <div className={`p-4 rounded-lg border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${isShort ? 'bg-amber-50 border-amber-200' : isOver ? 'bg-indigo-50 border-indigo-200' : 'bg-emerald-50 border-emerald-200'}`}>
                        <div className="flex flex-wrap gap-6 text-sm">
                          <div className="space-y-0.5">
                            <p className="text-xs text-muted-foreground">Total Received</p>
                            <p className="font-semibold">{totalReceived.toFixed(2)} m</p>
                          </div>
                          <div className="h-8 w-px bg-border hidden md:block" />
                          <div className="space-y-0.5">
                            <p className="text-xs text-muted-foreground">Issued</p>
                            <p className="font-semibold">{selectedContextIssuedMeters.toFixed(2)} m</p>
                          </div>
                          <div className="h-8 w-px bg-border hidden md:block" />
                          <div className="space-y-0.5">
                            <p className="text-xs text-muted-foreground">{isOver ? 'Excess' : 'Shortage'}</p>
                            <p className={`font-semibold ${isShort ? 'text-amber-700' : isOver ? 'text-indigo-700' : 'text-emerald-700'}`}>
                              {Math.abs(shortageMeters).toFixed(2)} m ({Math.abs(shortagePercent).toFixed(2)}%)
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="space-y-1.5 pt-2">
                    <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-tight">Additional Remarks / Notes</Label>
                    <Textarea
                      value={receiveForm.notes}
                      onChange={e => setReceiveForm({ ...receiveForm, notes: e.target.value })}
                      placeholder="Enter any specific details or remarks about this received lot..."
                      className="min-h-[80px] text-sm bg-muted/20 border-primary/5 focus:border-primary/20 transition-colors"
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={handleLotReceive}
                      disabled={!receiveForm.tiyarThan || !receiveForm.tiyarMeters}
                      size="lg"
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Confirm Lot Receive
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3">Recent Receives</h3>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 h-9">
                      <TableHead className="text-[10px] font-bold uppercase">Receive No</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Lot No</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Dyeing Name</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Tiyar Than</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Tiyar Meters</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase">Shortage %</TableHead>
                      <TableHead className="text-[10px] font-bold uppercase text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dyeingReceives.map(receive => (
                      <TableRow key={receive.id}>
                        <TableCell className="font-medium">{receive.receiveNumber}</TableCell>
                        <TableCell><Badge variant="outline">{receive.lotNo}</Badge></TableCell>
                        <TableCell className="text-sm">{receive.dyeingName}</TableCell>
                        <TableCell className="text-sm font-medium">{receive.tiyarThan}</TableCell>
                        <TableCell className="text-sm font-bold">{receive.tiyarMeters.toFixed(2)}m</TableCell>
                        <TableCell>
                          <Badge variant={receive.shortagePercent > 5 ? 'destructive' : 'secondary'} className="text-[10px]">
                            {receive.shortagePercent}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary hover:bg-primary/10"
                            onClick={() => {
                              setViewItem(receive);
                              setIsViewDialogOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {dyeingReceives.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="h-16 text-center text-muted-foreground">
                          No receives found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* L-Form - Step 2 */}
        <TabsContent value="lform">
          <Card>
            <CardHeader>
              <CardTitle>Step 2: Cutting / L-Form</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <Label className="text-[11px] font-bold uppercase text-muted-foreground tracking-tight mb-1 inline-block">Select Received Lot *</Label>
                  <Popover open={openReceiveCombo} onOpenChange={setOpenReceiveCombo}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openReceiveCombo}
                        className="w-full justify-between h-10 px-3 font-normal bg-background"
                      >
                        {lformState.dyeingReceiveId
                          ? (() => {
                            const r = dyeingReceives.find((rec) => rec.id === lformState.dyeingReceiveId);
                            return r ? <span className="truncate">{r.lotNo} ({r.tiyarThan} Than)</span> : "Select lot...";
                          })()
                          : "Select lot..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search lot or work order..." />
                        <CommandList>
                          <CommandEmpty>No received lots found.</CommandEmpty>
                          <CommandGroup>
                            {dyeingReceives
                              .filter(receive => {
                                const job = dyeingJobs.find(j => j.id === receive.dyeingJobId);
                                return job?.skipLForm !== true;
                              })
                              .map((receive) => {
                                const relatedJob = dyeingJobs.find(j => j.id === receive.dyeingJobId);
                                return (
                                  <CommandItem
                                    key={receive.id}
                                    value={`${receive.lotNo} ${relatedJob?.workOrderNo} ${relatedJob?.dyeingHouse}`}
                                    onSelect={() => {
                                      setLformState({ ...lformState, dyeingReceiveId: receive.id, colorGroups: [] });
                                      setOpenReceiveCombo(false);
                                    }}
                                    className="flex items-start py-2"
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4 flex-shrink-0 mt-0.5",
                                        lformState.dyeingReceiveId === receive.id ? "opacity-100 text-primary" : "opacity-0"
                                      )}
                                    />
                                    <div className="flex flex-col gap-0.5 truncate">
                                      <span className="font-medium">{receive.lotNo} · <span className="font-normal text-muted-foreground">{receive.quality}</span></span>
                                      <span className="text-[10px] uppercase font-bold text-muted-foreground/80">
                                        {relatedJob?.workOrderNo} · {relatedJob?.dyeingHouse}
                                      </span>
                                      <span className="text-xs text-muted-foreground mt-0.5">
                                        {receive.tiyarThan} Than, {receive.tiyarMeters.toFixed(2)} M
                                      </span>
                                    </div>
                                  </CommandItem>
                                );
                              })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Operation Date</Label>
                  <AppDatePicker
                    value={lformState.operationDate}
                    onChange={(nextValue) => setLformState({ ...lformState, operationDate: nextValue })}
                  />
                </div>
                <div>
                  <Label>Operator *</Label>
                  <Input
                    value={lformState.operator}
                    onChange={e => setLformState({ ...lformState, operator: e.target.value })}
                    placeholder="Operator name"
                  />
                </div>
              </div>

              {(() => {
                const selectedReceive = dyeingReceives.find(r => r.id === lformState.dyeingReceiveId);
                const relatedJob = dyeingJobs.find(j => j.id === selectedReceive?.dyeingJobId);
                return selectedReceive ? (
                  <div className="p-4 rounded-xl bg-muted/30 border-2 border-primary/10 shadow-sm mb-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-4 w-1 bg-primary rounded-full" />
                      <p className="text-xs font-bold text-primary uppercase tracking-widest">Received Lot Details</p>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                      {relatedJob && (
                        <div className="space-y-1">
                          <p className="text-[10px] uppercase font-bold text-muted-foreground">Work Order</p>
                          <p className="text-sm font-semibold">{relatedJob.workOrderNo}</p>
                        </div>
                      )}
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Lot Number</p>
                        <p className="text-sm font-semibold">{selectedReceive.lotNo}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Colour & Quality</p>
                        <p className="text-sm font-semibold truncate" title={`${selectedReceive.colour} / ${selectedReceive.quality}`}>
                          {selectedReceive.colour} / {selectedReceive.quality || relatedJob?.quality}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Vendor</p>
                        <p className="text-sm font-semibold truncate">{relatedJob?.dyeingHouse}</p>
                      </div>
                      <div className="space-y-1 p-1 bg-emerald-50 rounded border border-emerald-100">
                        <p className="text-[10px] uppercase font-bold text-emerald-800">Received Tiyar</p>
                        <p className="text-sm font-bold text-emerald-900">{selectedReceive.tiyarThan} Th, {selectedReceive.tiyarMeters.toFixed(2)} M</p>
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}

              <div className="pt-2 border-t mt-4">
                <div className="flex items-center justify-between pb-3 mb-4 border-b">
                  <div>
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px]">L</div>
                      Color-wise Than Entry
                    </h3>
                    <p className="text-[11px] text-muted-foreground leading-tight">Add colors and specify thans for each color. Total must match received amounts.</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setLformState(prev => ({
                        ...prev,
                        colorGroups: [
                          ...prev.colorGroups,
                          {
                            id: `color-${Date.now()}`,
                            colorName: '',
                            thanCount: 0,
                            thanLines: []
                          }
                        ]
                      }));
                    }}
                    disabled={(() => {
                      if (!lformState.dyeingReceiveId) return true;
                      const selectedReceive = dyeingReceives.find(r => r.id === lformState.dyeingReceiveId);
                      if (!selectedReceive) return true;
                      const totalAllocated = lformState.colorGroups.reduce((sum, g) => sum + g.thanCount, 0);
                      return totalAllocated >= selectedReceive.tiyarThan;
                    })()}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Color Group
                  </Button>
                </div>

                {/* Color Groups */}
                <div className="space-y-4">
                  {lformState.colorGroups.map((group, groupIdx) => (
                    <div key={group.id} className="p-4 border-2 rounded-xl bg-muted/20">
                      <div className="flex items-start gap-4 mb-3">
                        <div className="flex-1 grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Color *</Label>
                            <Select 
                              value={group.colorName} 
                              onValueChange={(v) => {
                                setLformState(prev => ({
                                  ...prev,
                                  colorGroups: prev.colorGroups.map((g, i) => 
                                    i === groupIdx ? { ...g, colorName: v } : g
                                  )
                                }));
                              }}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="Select color" />
                              </SelectTrigger>
                              <SelectContent>
                                {COLOR_OPTIONS.map(option => (
                                  <SelectItem key={option.value} value={option.value}>
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-4 h-4 rounded-full border border-gray-400 flex-shrink-0"
                                        style={{ backgroundColor: option.hex }}
                                      />
                                      <span>{option.label}</span>
                                      <span className="text-xs text-muted-foreground font-mono">{option.hex}</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Number of Thans *</Label>
                            <Input
                              type="number"
                              min={0}
                              value={group.thanCount || ''}
                              onChange={(e) => {
                                const requestedCount = Math.max(0, Number(e.target.value));
                                const selectedReceive = dyeingReceives.find(r => r.id === lformState.dyeingReceiveId);
                                
                                if (!selectedReceive) return;
                                
                                // Calculate total thans from OTHER color groups
                                const otherGroupsTotal = lformState.colorGroups
                                  .filter((_, i) => i !== groupIdx)
                                  .reduce((sum, g) => sum + g.thanCount, 0);
                                
                                // Check if adding this would exceed the received total
                                const wouldExceed = otherGroupsTotal + requestedCount > selectedReceive.tiyarThan;
                                
                                if (wouldExceed) {
                                  const maxAllowed = selectedReceive.tiyarThan - otherGroupsTotal;
                                  toast({
                                    title: "Than Limit Exceeded",
                                    description: `Cannot exceed received thans (${selectedReceive.tiyarThan}). Maximum ${maxAllowed} more thans can be added to this color.`,
                                    variant: "destructive"
                                  });
                                  return;
                                }
                                
                                const n = requestedCount;
                                setLformState(prev => ({
                                  ...prev,
                                  colorGroups: prev.colorGroups.map((g, i) => {
                                    if (i !== groupIdx) return g;
                                    const newLines: typeof g.thanLines = [];
                                    for (let j = 0; j < n; j++) {
                                      newLines.push(g.thanLines[j] ?? {
                                        id: `than-${Date.now()}-${j}`,
                                        meters: 0,
                                        pieceType: 'loose'
                                      });
                                    }
                                    return { ...g, thanCount: n, thanLines: newLines };
                                  })
                                }));
                              }}
                              placeholder="0"
                              className="h-9"
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 mt-6"
                          onClick={() => {
                            setLformState(prev => ({
                              ...prev,
                              colorGroups: prev.colorGroups.filter((_, i) => i !== groupIdx)
                            }));
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Than entries for this color */}
                      {group.thanLines.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 mt-3 pt-3 border-t">
                          {group.thanLines.map((line, lineIdx) => (
                            <div key={line.id} className={`flex flex-col gap-2 p-2 rounded-lg border transition-all shadow-sm ${line.isFaulty ? 'bg-destructive/5 border-destructive/20' : 'bg-card'}`}>
                              <div className="flex items-center gap-2">
                                <div className="flex flex-col items-center gap-1">
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${line.isFaulty ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground/80'}`}>
                                    {lineIdx + 1}
                                  </div>
                                  <input
                                    type="checkbox"
                                    checked={line.isFaulty || false}
                                    onChange={(e) => {
                                      setLformState(prev => ({
                                        ...prev,
                                        colorGroups: prev.colorGroups.map((g, i) =>
                                          i === groupIdx
                                            ? {
                                                ...g,
                                                thanLines: g.thanLines.map((l, j) =>
                                                  j === lineIdx ? { ...l, isFaulty: e.target.checked } : l
                                                )
                                              }
                                            : g
                                        )
                                      }));
                                    }}
                                    className="h-3 w-3 accent-destructive"
                                    title="Mark as faulty"
                                  />
                                </div>
                                <div className="relative flex-1">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    placeholder="0.00"
                                    className="h-9 pl-7 pr-2 text-sm font-bold"
                                    value={line.meters || ''}
                                    onChange={(e) => {
                                      const val = Number(e.target.value);
                                      setLformState(prev => ({
                                        ...prev,
                                        colorGroups: prev.colorGroups.map((g, i) =>
                                          i === groupIdx
                                            ? {
                                                ...g,
                                                thanLines: g.thanLines.map((l, j) =>
                                                  j === lineIdx ? { ...l, meters: val } : l
                                                )
                                              }
                                            : g
                                        )
                                      }));
                                    }}
                                  />
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-muted-foreground/40">M</span>
                                </div>
                              </div>
                              <Select
                                value={line.pieceType}
                                onValueChange={(val: any) => {
                                  setLformState(prev => ({
                                    ...prev,
                                    colorGroups: prev.colorGroups.map((g, i) =>
                                      i === groupIdx
                                        ? {
                                            ...g,
                                            thanLines: g.thanLines.map((l, j) =>
                                              j === lineIdx ? { ...l, pieceType: val } : l
                                            )
                                          }
                                        : g
                                    )
                                  }));
                                }}
                              >
                                <SelectTrigger className="h-7 text-[10px] py-0 px-2 font-semibold">
                                  <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="loose">Loose</SelectItem>
                                  <SelectItem value="grade_b">Grade B</SelectItem>
                                  <SelectItem value="cut_piece">Cut Piece</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Group summary */}
                      {group.thanLines.length > 0 && (
                        <div className="mt-3 pt-2 border-t flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Group Total:</span>
                          <span className="font-bold">{group.thanLines.reduce((s, l) => s + l.meters, 0).toFixed(2)} M ({group.thanLines.length} Than)</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Overall Summary */}
                {lformState.colorGroups.length > 0 && (() => {
                  const allLines = lformState.colorGroups.flatMap(g => g.thanLines);
                  const totalMeters = allLines.reduce((s, l) => s + l.meters, 0);
                  const totalThans = allLines.length;
                  const selectedReceive = dyeingReceives.find(r => r.id === lformState.dyeingReceiveId);
                  const metersDiff = selectedReceive ? Math.abs(totalMeters - selectedReceive.tiyarMeters) : 0;
                  const thansDiff = selectedReceive ? totalThans - selectedReceive.tiyarThan : 0;

                  return (
                    <div className="mt-4 p-4 bg-muted/40 border-2 rounded-lg">
                      <h4 className="font-semibold mb-3 uppercase text-[10px] tracking-wider text-muted-foreground">Overall Summary:</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                        <div>
                          <strong>Total Colors:</strong> {lformState.colorGroups.length}
                        </div>
                        <div className={thansDiff !== 0 ? "text-destructive font-bold" : "text-emerald-600"}>
                          <strong>Total Thans:</strong> {totalThans}
                          {selectedReceive && ` / ${selectedReceive.tiyarThan}`}
                          {thansDiff !== 0 && ` (${thansDiff > 0 ? '+' : ''}${thansDiff})`}
                        </div>
                        <div className={metersDiff > 0.5 ? "text-destructive font-bold" : "text-emerald-600"}>
                          <strong>Total Meters:</strong> {totalMeters.toFixed(2)} M
                          {selectedReceive && ` / ${selectedReceive.tiyarMeters.toFixed(2)} M`}
                          {metersDiff > 0.5 && ` (${metersDiff.toFixed(2)} M diff)`}
                        </div>
                        <div className={allLines.filter(l => l.isFaulty).length > 0 ? "text-destructive font-bold" : ""}>
                          <strong>Faulty:</strong> {allLines.filter(l => l.isFaulty).length}
                        </div>
                      </div>
                      {selectedReceive && (metersDiff > 0.5 || thansDiff !== 0) && (
                        <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-800">
                          <AlertTriangle className="h-3 w-3 inline mr-1" />
                          Totals don't match received amounts. Please adjust before finalizing.
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => saveLForm(false)} disabled={lformState.colorGroups.length === 0}>
                  Save Draft
                </Button>
                <Button onClick={() => saveLForm(true)} disabled={lformState.colorGroups.length === 0}>
                  <Check className="mr-2 h-4 w-4" />
                  Finalize L-Form
                </Button>
              </div>

              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3">Recent L-Forms</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>L-Form No</TableHead>
                      <TableHead>Lot No</TableHead>
                      <TableHead>Operator</TableHead>
                      <TableHead>Total Rows</TableHead>
                      <TableHead>Total Than</TableHead>
                      <TableHead>Total Meters</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lforms.slice(0, 5).map(lform => (
                      <TableRow key={lform.id}>
                        <TableCell>{lform.lformNumber}</TableCell>
                        <TableCell><Badge>{lform.lotNo}</Badge></TableCell>
                        <TableCell>{lform.operator}</TableCell>
                        <TableCell>{lform.rows.length}</TableCell>
                        <TableCell>{lform.totalThans.toFixed(2)}</TableCell>
                        <TableCell>{lform.totalMeters.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={lform.status === 'finalized' ? 'default' : 'secondary'}>
                            {lform.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cutting & Packing Tab */}
        {/* Cutting & Packing Tab */}
        <TabsContent value="cutting-packing" className="mt-0">
          <Tabs defaultValue="cutting">
            <div className="bg-slate-50 border-b p-2 rounded-b-md mb-6 -mt-2">
              <TabsList className="bg-transparent space-x-2">
                <TabsTrigger value="cutting" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <Scissors className="mr-2 h-4 w-4" />
                  Cutting Batches
                </TabsTrigger>
                <TabsTrigger value="packing" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <Package className="mr-2 h-4 w-4" />
                  Packing Batches
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="cutting">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-xl">Cutting Batches</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Convert approved L-Form fabric into cut bundles</p>
                  </div>
                  <Button onClick={() => setIsCuttingDialogOpen(true)} className="bg-slate-900 text-white hover:bg-slate-800">
                    <Plus className="mr-2 h-4 w-4" />
                    New Cutting Batch
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Batch #</TableHead>
                        <TableHead>L-Form</TableHead>
                        <TableHead>Style</TableHead>
                        <TableHead>Fabric (m)</TableHead>
                        <TableHead>Pieces</TableHead>
                        <TableHead>Yield %</TableHead>
                        <TableHead>Bundles</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cuttingBatches.map(batch => (
                        <TableRow key={batch.id}>
                          <TableCell className="font-medium">{batch.batchNumber}</TableCell>
                          <TableCell>{batch.lformId}</TableCell>
                          <TableCell>{batch.style}</TableCell>
                          <TableCell>{batch.fabricMeters}</TableCell>
                          <TableCell>{batch.pieces}</TableCell>
                          <TableCell className={batch.yieldPercent >= 98 ? 'text-emerald-600' : 'text-amber-600'}>{batch.yieldPercent.toFixed(1)}%</TableCell>
                          <TableCell>{batch.bundlesCount}</TableCell>
                          <TableCell>
                            <Badge variant={batch.status === 'Open' ? 'outline' : 'secondary'} className={batch.status === 'Open' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}>
                              {batch.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm">
                              <Eye className="mr-2 h-4 w-4" /> View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="packing">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-xl">Packing Batches</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Pack cut bundles into finished goods using the active BOM</p>
                  </div>
                  <Button onClick={() => setIsPackingDialogOpen(true)} className="bg-slate-900 text-white hover:bg-slate-800">
                    <Plus className="mr-2 h-4 w-4" />
                    New Packing Batch
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Batch #</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>BOM Ver.</TableHead>
                        <TableHead>Input</TableHead>
                        <TableHead>Packed</TableHead>
                        <TableHead>Rejected</TableHead>
                        <TableHead>Yield</TableHead>
                        <TableHead>Destination</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {packingBatches.map(batch => (
                        <TableRow key={batch.id}>
                          <TableCell className="font-medium">{batch.batchNumber}</TableCell>
                          <TableCell>{batch.sku}</TableCell>
                          <TableCell>{batch.bomVersion}</TableCell>
                          <TableCell>{batch.inputPieces}</TableCell>
                          <TableCell>{batch.packedPieces}</TableCell>
                          <TableCell>{batch.rejectedPieces}</TableCell>
                          <TableCell>{batch.yieldPercent.toFixed(1)}%</TableCell>
                          <TableCell>{batch.destination}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={batch.status === 'In Packing Store' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}>
                              {batch.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm">
                              <Eye className="mr-2 h-4 w-4" /> View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Dialogs */}
          <Dialog open={isCuttingDialogOpen} onOpenChange={setIsCuttingDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl">Create Cutting Batch</DialogTitle>
                <p className="text-sm text-muted-foreground">Convert approved L-Form fabric into cut bundles</p>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 mt-4">
                <div>
                  <Label>Approved L-Form *</Label>
                  <Select>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select L-Form" /></SelectTrigger>
                    <SelectContent><SelectItem value="lf1">LF-101</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Available Fabric (m)</Label>
                  <Input className="mt-1" disabled />
                </div>
                <div>
                  <Label>Style / Product *</Label>
                  <Input className="mt-1" placeholder="e.g. S-220 Polo" />
                </div>
                <div>
                  <Label>Marker Reference</Label>
                  <Input className="mt-1" placeholder="MK-..." />
                </div>
                <div>
                  <Label>Planned Pieces</Label>
                  <Input className="mt-1" />
                </div>
                <div>
                  <Label>Fabric Consumed (m)</Label>
                  <Input className="mt-1" />
                </div>
                <div>
                  <Label>Actual Pieces *</Label>
                  <Input className="mt-1" />
                </div>
                <div>
                  <Label>Rejected Pieces</Label>
                  <Input className="mt-1" />
                </div>
                <div>
                  <Label>Wastage (m)</Label>
                  <Input className="mt-1" />
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg flex justify-between items-center mt-6 border">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Yield %</p>
                  <p className="text-2xl font-semibold">0%</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Remaining Fabric</p>
                  <p className="text-2xl font-semibold">0m</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Variance (pcs)</p>
                  <p className="text-2xl font-semibold">0</p>
                </div>
              </div>

              <div className="mt-6">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-medium">Cut Bundles</h4>
                  <Button variant="outline" size="sm">
                    <Plus className="mr-2 h-4 w-4" /> Add bundle
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bundle</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cuttingBundles.length > 0 ? cuttingBundles.map((b, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{b.bundleId}</TableCell>
                        <TableCell>
                          <Select defaultValue={b.size}>
                            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="S">S</SelectItem>
                              <SelectItem value="M">M</SelectItem>
                              <SelectItem value="L">L</SelectItem>
                              <SelectItem value="XL">XL</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell><Input className="w-32" defaultValue={b.qty} /></TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-4">No bundles added yet.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => setIsCuttingDialogOpen(false)}>Cancel</Button>
                <Button className="bg-slate-900 text-white hover:bg-slate-800">Save Cutting Batch</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isPackingDialogOpen} onOpenChange={setIsPackingDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl">Create Packing Batch</DialogTitle>
                <p className="text-sm text-muted-foreground">Pick bundles, run BOM explosion, and record output</p>
              </DialogHeader>

              <div className="mt-4">
                <h4 className="font-medium mb-3">Step 1 — Select Bundle(s)</h4>
                <div className="border rounded-lg overflow-hidden mb-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Cut Batch</TableHead>
                        <TableHead>Bundle</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead className="text-right">Available</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {packingSelectedBundles.length > 0 ? packingSelectedBundles.map((b, idx) => (
                        <TableRow key={idx}>
                          <TableCell><CheckSquare className="h-4 w-4" /></TableCell>
                          <TableCell>{b.cutBatch}</TableCell>
                          <TableCell>{b.bundle}</TableCell>
                          <TableCell>{b.size}</TableCell>
                          <TableCell className="text-right">{b.available}</TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-4">No bundles selected.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="grid grid-cols-3 gap-x-6 gap-y-4 mb-4">
                  <div>
                    <Label>Finished Good SKU *</Label>
                    <Select>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select SKU" /></SelectTrigger>
                      <SelectContent><SelectItem value="s1">SKU-S220-RED</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Input Pieces (from bundles)</Label>
                    <Input className="mt-1" value="0" disabled />
                  </div>
                  <div>
                    <Label>Active BOM</Label>
                    <Input className="mt-1" value="—" disabled />
                  </div>
                  <div>
                    <Label>Packed Qty *</Label>
                    <Input className="mt-1" />
                  </div>
                  <div>
                    <Label>Rejected Qty</Label>
                    <Input className="mt-1" />
                  </div>
                  <div>
                    <Label>Destination</Label>
                    <Select defaultValue="store">
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="store">Packing Store</SelectItem>
                        <SelectItem value="warehouse">Interim Warehouse</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mb-6">
                  <Label>Remarks</Label>
                  <Textarea className="mt-1" />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsPackingDialogOpen(false)}>Cancel</Button>
                <Button className="bg-slate-900 text-white hover:bg-slate-800">Save Packing Batch</Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Lot Traceability Report</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Track complete flow: Issue → Dyeing → Receive → L-Form → Voucher
                </p>
                <Button variant="outline" className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  Generate Report
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Shrinkage/Shortage Report</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Analyze shortage % by Lot, Dyeing House, and Date range
                </p>
                <Button variant="outline" className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  Generate Report
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>L-Form Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Printable list of Thans and cut pieces per Lot
                </p>
                <Button variant="outline" className="w-full">
                  <Printer className="mr-2 h-4 w-4" />
                  Print Summary
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Inventory by Shade & Quality</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Aggregated view in Than and Meters
                </p>
                <Button variant="outline" className="w-full">
                  <Download className="mr-2 h-4 w-4" />
                  View Inventory
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

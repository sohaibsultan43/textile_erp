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
import { DyeingJob, DyeingReceive, LForm, LFormRow, Voucher, VoucherLine, Location, LFormItemType, Supplier, DeliverySchedule } from '@/types';
import { Plus, Printer, Download, Check, X, ArrowRight, Trash2, ChevronDown, ChevronUp, Eye, ChevronsUpDown, Square, CheckSquare, AlertTriangle } from 'lucide-react';
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
type ColorJobLine = {
  id: string;
  colour: string;
  greyMeters: number;
  deliverySchedules: DeliverySchedule[];
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
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Colour</p>
              <p className="text-sm font-semibold">{item.colour}</p>
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

                {/* Delivery Schedule */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                    <div className="w-1 h-3 bg-primary rounded-full" />
                    Target Delivery Schedule
                  </h4>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow className="h-8">
                          <TableHead className="text-[10px] uppercase font-bold">Planned Date</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold text-right px-4">Planned Qty</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(item as DyeingJob).deliverySchedules?.length ? (item as DyeingJob).deliverySchedules?.map((sch, i) => (
                          <TableRow key={i} className="h-9">
                            <TableCell className="text-xs">{formatDate(sch.pickDate)}</TableCell>
                            <TableCell className="text-xs text-right px-4 font-bold">{sch.quantity.toFixed(2)}m</TableCell>
                          </TableRow>
                        )) : (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center text-xs text-muted-foreground py-4 italic">No schedule defined</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 flex justify-between items-center">
                <span className="text-xs font-bold uppercase text-primary/70">Total Issued Volume</span>
                <span className="text-lg font-black text-primary">{(item as DyeingJob).greyMeters.toFixed(2)} Meters</span>
              </div>
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
  const [expandedScheduleItems, setExpandedScheduleItems] = useState<Set<string>>(new Set());
  const [expandedRecentJobs, setExpandedRecentJobs] = useState<Set<string>>(new Set());

  // View state
  const [viewItem, setViewItem] = useState<DyeingJob | DyeingReceive | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);
  const [issueForm, setIssueForm] = useState({
    issueDate: new Date().toISOString().split('T')[0],
    fromLocation: '',
    dyeingHouse: '',
    workOrderNo: '',
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
    },
  ]);

  const [colorLines, setColorLines] = useState<ColorJobLine[]>(() => [
    {
      id: makeIssueLineId(),
      colour: '',
      greyMeters: 0,
      deliverySchedules: [],
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
    thanLines: [] as { id: string; meters: number }[]
  });
  const [lotSearchTerm, setLotSearchTerm] = useState('');
  const [selectedReceiveJobIds, setSelectedReceiveJobIds] = useState<string[]>([]);
  const [openJobCombo, setOpenJobCombo] = useState(false);
  const [openReceiveCombo, setOpenReceiveCombo] = useState(false);
  const [lformState, setLformState] = useState({
    dyeingReceiveId: '',
    operationDate: new Date().toISOString().split('T')[0],
    operator: '',
    thanLines: [] as { 
      id: string; 
      meters: number; 
      placeholderMeters?: number;
      isFaulty?: boolean;
      pieceType: 'loose' | 'grade_b' | 'cut_piece';
    }[]
  });

  // Voucher State
  const [voucherState, setVoucherState] = useState({
    lformId: '',
    transferDate: new Date().toISOString().split('T')[0],
    warehouseId: '',
    voucherType: 'bulk' as 'bulk' | 'loose'
  });

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
      },
    ]);
    setColorLines([
      {
        id: makeIssueLineId(),
        colour: '',
        greyMeters: 0,
        deliverySchedules: [],
      },
    ]);
  }, [issueForm.fromLocation]);

  const getLotsOptionsForSource = (rowId: string) => {
    const selectedElsewhere = new Set(
      sourceLots.filter((l) => l.id !== rowId && l.lotNo).map((l) => l.lotNo)
    );
    return availableLots.filter((l) => !selectedElsewhere.has(l.lotNo));
  };

  const getScheduledQuantityDyeing = (line: ColorJobLine): number => {
    return line.deliverySchedules?.reduce((sum, s) => sum + (s.quantity || 0), 0) || 0;
  };

  const toggleScheduleExpansionDyeing = (id: string) => {
    setExpandedScheduleItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addScheduleRowDyeing = (colorLineId: string) => {
    setColorLines((lines) =>
      lines.map((line) => {
        if (line.id !== colorLineId) return line;
        
        const scheduledQty = getScheduledQuantityDyeing(line);
        if (scheduledQty >= line.greyMeters) {
          toast({
            title: 'Fullly Scheduled',
            description: 'Total scheduled quantity already matches color quantity.',
          });
          return line;
        }

        const newSchedule: DeliverySchedule = {
          id: `sch-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          purchaseOrderItemId: colorLineId,
          quantity: Math.max(0, line.greyMeters - scheduledQty),
          pickDate: new Date().toISOString().split('T')[0],
        };
        
        return {
          ...line,
          deliverySchedules: [...(line.deliverySchedules || []), newSchedule],
        };
      })
    );
    
    setExpandedScheduleItems(prev => new Set(prev).add(colorLineId));
  };

  const removeScheduleRowDyeing = (colorLineId: string, scheduleId: string) => {
    setColorLines((lines) =>
      lines.map((line) => {
        if (line.id !== colorLineId) return line;
        return {
          ...line,
          deliverySchedules: (line.deliverySchedules || []).filter((s) => s.id !== scheduleId),
        };
      })
    );
  };

  const updateScheduleRowDyeing = (
    colorLineId: string,
    scheduleId: string,
    field: 'quantity' | 'pickDate',
    value: any
  ) => {
    setColorLines((lines) =>
      lines.map((line) => {
        if (line.id !== colorLineId) return line;
        
        return {
          ...line,
          deliverySchedules: (line.deliverySchedules || []).map((s) => {
            if (s.id !== scheduleId) return s;
            
            if (field === 'quantity') {
              const otherSchedulesTotal = getScheduledQuantityDyeing(line) - (s.quantity || 0);
              const remaining = Math.max(0, line.greyMeters - otherSchedulesTotal);
              const nextVal = Math.min(Number(value) || 0, remaining);
              
              if (Number(value) > remaining) {
                toast({
                  title: 'Limit Exceeded',
                  description: `Maximum remaining for this color is ${remaining}m`,
                });
              }
              return { ...s, quantity: nextVal };
            }
            
            return { ...s, [field]: value };
          }),
        };
      })
    );
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

  // Color Job Handlers
  const addColorLine = () => {
    setColorLines(prev => [...prev, {
      id: makeIssueLineId(),
      colour: '',
      greyMeters: 0,
      skipLForm: false,
      deliverySchedules: [],
    }]);
  };

  const removeColorLine = (id: string) => {
    setColorLines(prev => prev.length > 1 ? prev.filter(l => l.id !== id) : prev);
  };

  const updateColorLine = (id: string, patch: Partial<ColorJobLine>) => {
    setColorLines(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  };

  const loadData = async () => {
    try {
      const [apiLocations, apiVendors] = await Promise.all([
        locationApi.getAll(),
        vendorApi.getAll(),
      ]);
      // All storage / warehouse locations (exclude sale points for grey issue-from)
      setLocations(
        apiLocations.filter(
          (loc) => loc.type === 'godown' || loc.type === 'warehouse'
        )
      );
      setDyeingVendors(apiVendors.filter(vendor => vendor.category === 'dyeing'));
      const flowData = await dyeingFlowApi.getAll();
      setDyeingJobs(flowData.jobs || []);
      setDyeingReceives(flowData.receives || []);
      setLforms(flowData.lforms || []);
      setVouchers(flowData.vouchers || []);
    } catch (error) {
      console.error('Error loading data:', error);
      setLocations([]);
      setDyeingVendors([]);
      setDyeingJobs([]);
      setDyeingReceives([]);
      setLforms([]);
      setVouchers([]);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const token = getAuthToken();
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch(`${getApiBaseUrl()}/api/upload`, {
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

    const validSources = sourceLots.filter(l => l.lotNo && l.usedMeters > 0);
    const validColors = colorLines.filter(l => l.colour && l.greyMeters > 0);

    if (validSources.length === 0) {
      toast({
        title: "Validation Error",
        description: "Add at least one source lot with meters to use",
        variant: "destructive"
      });
      return;
    }

    if (validColors.length === 0) {
      toast({
        title: "Validation Error",
        description: "Add at least one target color with grey meters",
        variant: "destructive"
      });
      return;
    }

    const totalSource = validSources.reduce((sum, l) => sum + l.usedMeters, 0);
    const totalSourceThan = validSources.reduce((sum, l) => sum + (l.usedThans || 0), 0);
    const totalColor = validColors.reduce((sum, c) => sum + c.greyMeters, 0);
    const globalSkipLForm = validSources.some(l => l.skipLForm);

    // Allowing very small (0.01) floating point difference
    if (Math.abs(totalSource - totalColor) > 0.01) {
      const isExceeded = totalColor > totalSource + 0.01;
      toast({
        title: isExceeded ? "Quantity Limit Exceeded" : "Quantity Mismatch",
        description: isExceeded 
          ? `Target dyeing total (${totalColor.toFixed(2)}m) cannot exceed available Source Pool (${totalSource.toFixed(2)}m).`
          : `Total Source (${totalSource.toFixed(2)}m) must match Total Color (${totalColor.toFixed(2)}m).`,
        variant: "destructive"
      });
      return;
    }

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
      const createPromises = validColors.map((colorLine, index) => {
        const newJob: DyeingJob = {
          id: `${baseTime}-${index}-${colorLine.colour}`,
          jobNumber: `DJ-${baseTime}-${index}`,
          issueDate: issueForm.issueDate,
          fromLocation: issueForm.fromLocation,
          dyeingHouse: issueForm.dyeingHouse,
          workOrderNo: generatedWorkOrderNo, // Shared work order for the batch
          lotNo: joinedLots, // Combined string for visibility in lists
          quality: sharedQuality,
          colour: colorLine.colour,
          greyThan: totalSourceThan,
          greyMeters: colorLine.greyMeters,
          skipLForm: globalSkipLForm,
          deliverySchedules: colorLine.deliverySchedules || [],
          sourceLots: structuredSources,
          attachmentUrl: issueForm.attachmentUrl,
          notes: issueForm.notes,
          status: 'issued',
          createdBy: 'current_user',
          createdAt: new Date().toISOString()
        };
        return dyeingFlowApi.createJob(newJob);
      });
      await Promise.all(createPromises);
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
      description: `Issued ${totalColor.toFixed(2)}m from ${validSources.length} lot(s) for ${validColors.length} color(s).`
    });

    setIsIssueDialogOpen(false);

    setIssueForm({
      issueDate: new Date().toISOString().split('T')[0],
      fromLocation: '',
      dyeingHouse: '',
      workOrderNo: '',
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
      },
    ]);
    setColorLines([
      {
        id: makeIssueLineId(),
        colour: '',
        greyMeters: 0,
        skipLForm: false,
        deliverySchedules: [],
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
    setVoucherState((prev) => ({ ...prev, lformId: '', warehouseId: '' }));

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
        colour: allocatedJob.colour,
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
      await Promise.all(contextJobs.map((contextJob) => dyeingFlowApi.updateJobStatus(contextJob.id, 'received')));
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
    if (!lformState.dyeingReceiveId || !lformState.operator || lformState.thanLines.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields and complete the Received Than Entry.",
        variant: "destructive"
      });
      return;
    }

    const receive = dyeingReceives.find(r => r.id === lformState.dyeingReceiveId);
    if (!receive) return;

    const totalMeters = lformState.thanLines.reduce((sum, line) => sum + (line.meters || line.placeholderMeters || 0), 0);

    if (totalMeters > receive.tiyarMeters) {
      toast({
        title: "Excess Meters Warning",
        description: `Total meters (${totalMeters.toFixed(2)}) exceeds Tiyar meters (${receive.tiyarMeters.toFixed(2)}). This will be recorded as excess production.`,
        variant: "default"
      });
    }

    const rows: LFormRow[] = lformState.thanLines.map((line, idx) => ({
      id: line.id,
      rowNumber: idx + 1,
      itemType: line.pieceType === 'grade_b' ? 'standard_than' : line.pieceType === 'loose' ? 'loose_than' : 'cut_piece',
      thanId: line.id,
      shade: line.isFaulty ? 'FAULTY' : receive.colour,
      quality: receive.quality,
      thanLength: line.meters || line.placeholderMeters || 0,
      meterEquivalent: line.meters || line.placeholderMeters || 0,
      remarks: line.isFaulty ? 'Marked as Faulty' : ''
    }));

    const newLForm: Partial<LForm> = {
      lformNumber: `LF-${Date.now()}`,
      lotNo: receive.lotNo,
      dyeingReceiveId: receive.id,
      operationDate: lformState.operationDate,
      operator: lformState.operator,
      rows,
      totalThans: lformState.thanLines.length,
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
      thanLines: []
    });
    loadData();
  };

  // Create Voucher
  const createVoucher = async () => {
    if (!voucherState.lformId || !voucherState.warehouseId) {
      toast({
        title: "Validation Error",
        description: "Please select L-Form and warehouse",
        variant: "destructive"
      });
      return;
    }

    const lform = lforms.find(l => l.id === voucherState.lformId);
    if (!lform) return;

    // Group rows by shade for bulk voucher or keep as-is for loose
    const lines: VoucherLine[] = voucherState.voucherType === 'bulk'
      ? groupByShade(lform.rows)
      : lform.rows.map((row, idx) => ({
          id: Date.now().toString() + idx,
          lineNumber: idx + 1,
          thanId: row.thanId,
          shade: row.shade,
          quality: row.quality,
          thanCount: row.thanLength,
          meters: row.meterEquivalent,
          itemType: row.itemType,
          remarks: row.remarks
        }));

    const totalThans = lines.reduce((sum, line) => sum + line.thanCount, 0);
    const totalMeters = lines.reduce((sum, line) => sum + line.meters, 0);

    const newVoucher: Voucher = {
      id: Date.now().toString(),
      voucherNumber: `V${voucherState.voucherType === 'bulk' ? '1' : '3'}-${Date.now()}`,
      voucherType: voucherState.voucherType,
      lotNo: lform.lotNo,
      lformId: lform.id,
      transferDate: voucherState.transferDate,
      warehouseId: voucherState.warehouseId,
      lines,
      totalThans,
      totalMeters,
      status: 'draft',
      createdBy: 'current_user',
      createdAt: new Date().toISOString()
    };

    try {
      await dyeingFlowApi.createVoucher(newVoucher);
    } catch (error) {
      console.error('Create voucher error:', error);
      toast({
        title: 'Save Failed',
        description: 'Could not save voucher to server.',
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: "Success",
      description: `Voucher ${newVoucher.voucherNumber} created`
    });

    setVoucherState({
      lformId: '',
      transferDate: new Date().toISOString().split('T')[0],
      warehouseId: '',
      voucherType: 'bulk'
    });
    loadData();
  };

  const groupByShade = (rows: LFormRow[]): VoucherLine[] => {
    const shadeMap = new Map<string, VoucherLine>();
    
    rows.forEach(row => {
      const key = `${row.shade}-${row.quality}`;
      if (shadeMap.has(key)) {
        const existing = shadeMap.get(key)!;
        existing.thanCount += row.thanLength;
        existing.meters += row.meterEquivalent;
      } else {
        shadeMap.set(key, {
          id: Date.now().toString() + Math.random(),
          lineNumber: shadeMap.size + 1,
          shade: row.shade,
          quality: row.quality,
          thanCount: row.thanLength,
          meters: row.meterEquivalent,
          itemType: row.itemType
        });
      }
    });

    return Array.from(shadeMap.values());
  };

  const receivableJobs = useMemo(
    () =>
      dyeingJobs.filter((j) => {
        const normalizedStatus = String(j.status || '').trim().toLowerCase();
        return (normalizedStatus === 'issued' || normalizedStatus === 'in_dyeing') && !j.skipLForm;
      }),
    [dyeingJobs]
  );

  const selectedJob = receivableJobs.find(j => j.id === receiveForm.dyeingJobId);
  const selectedJobs = selectedReceiveJobIds.length > 0
    ? receivableJobs.filter((j) => selectedReceiveJobIds.includes(j.id))
    : selectedJob
      ? [selectedJob]
      : [];
  const selectedWorkOrderNos = Array.from(new Set(selectedJobs.map((j) => j.workOrderNo)));
  const selectedWorkOrderNo = selectedWorkOrderNos[0] || '';
  const selectedWorkOrderJobs = useMemo(
    () => selectedJobs,
    [selectedJobs]
  );
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
  const selectedContextColours = useMemo(
    () => Array.from(new Set(selectedWorkOrderJobs.map((j) => j.colour).filter(Boolean))),
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
  const selectedContextSchedules = useMemo(
    () =>
      selectedWorkOrderJobs.flatMap((j) =>
        (j.deliverySchedules || []).map((s) => ({ ...s, colour: j.colour }))
      ),
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
  const selectedLForm = lforms.find(l => l.id === voucherState.lformId);

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
          <Badge variant="secondary">🟧 Packing</Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="issue">Issue Grey</TabsTrigger>
          <TabsTrigger value="receive">Step 1: Receive</TabsTrigger>
          <TabsTrigger value="lform">Step 2: L-Form</TabsTrigger>
          <TabsTrigger value="voucher">Step 3: Voucher</TabsTrigger>
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
                          onValueChange={v => setIssueForm({...issueForm, fromLocation: v})}
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

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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

                      {/* TARGET COLORS SECTION */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-semibold">2. Target: Dyeing Colors</h3>
                            <p className="text-xs text-muted-foreground">Define how the total quantity is distributed by color.</p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addColorLine}
                            disabled={!issueForm.fromLocation}
                          >
                            <Plus className="mr-1 h-3 w-3" />
                            Add color
                          </Button>
                        </div>

                        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
                          <Table>
                            <TableHeader className="bg-muted/50">
                              <TableRow className="h-10 border-b">
                                <TableHead className="text-xs">Color Name</TableHead>
                                <TableHead className="text-xs w-[120px] text-right">Meters to Dye</TableHead>
                                <TableHead className="text-xs w-[100px] text-center">Schedule</TableHead>
                                <TableHead className="w-[40px]" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {colorLines.map((line) => {
                                const isExpanded = expandedScheduleItems.has(line.id);
                                const scheduledQty = getScheduledQuantityDyeing(line);
                                const scheduleCount = line.deliverySchedules?.length || 0;

                                return (
                                  <React.Fragment key={line.id}>
                                    <TableRow className={`group transition-colors h-14 border-b last:border-0 hover:bg-muted/5 ${isExpanded ? 'bg-muted/20 border-b-0' : ''}`}>
                                      <TableCell className="py-2">
                                        <Select
                                          value={line.colour}
                                          onValueChange={(v) => updateColorLine(line.id, { colour: v })}
                                        >
                                          <SelectTrigger className="h-8 text-[11px]">
                                            <SelectValue placeholder="Select color" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {COLOR_OPTIONS.map(option => (
                                              <SelectItem key={option.value} value={option.value}>
                                                <div className="flex items-center gap-2">
                                                  <div
                                                    className="w-2.5 h-2.5 rounded-full border border-gray-400"
                                                    style={{ backgroundColor: option.hex }}
                                                  />
                                                  <span>{option.label}</span>
                                                </div>
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </TableCell>
                                      <TableCell className="py-2">
                                        <Input
                                          type="number"
                                          step="0.01"
                                          min={0}
                                          value={line.greyMeters || ''}
                                          className="text-right h-8 text-xs font-bold"
                                          onChange={(e) => updateColorLine(line.id, { greyMeters: Number(e.target.value) })}
                                        />
                                      </TableCell>
                                      <TableCell className="py-2 text-center">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => toggleScheduleExpansionDyeing(line.id)}
                                          className={`h-8 px-2 flex items-center gap-1 mx-auto transition-colors ${scheduleCount > 0 ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-muted-foreground hover:bg-muted/50'}`}
                                        >
                                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                          <span className="text-[10px] uppercase font-bold">{scheduleCount} sch</span>
                                        </Button>
                                      </TableCell>
                                      <TableCell className="py-2 text-right">
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                          onClick={() => removeColorLine(line.id)}
                                          disabled={colorLines.length <= 1}
                                        >
                                          <X className="h-3 w-3 text-destructive" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                    {isExpanded && (
                                      <TableRow className="bg-muted/10 border-t-0 hover:bg-muted/10">
                                        <TableCell colSpan={4} className="pb-4 pt-0">
                                          <div className="ml-4 pl-4 border-l-2 border-primary/20 space-y-3 py-3">
                                            <div className="flex items-center justify-between">
                                              <h4 className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">
                                                Delivery Schedule Summary
                                              </h4>
                                              <div className="text-[10px] font-bold">
                                                Total Scheduled: <span className={scheduledQty > line.greyMeters ? "text-destructive" : "text-blue-600"}>{scheduledQty.toFixed(2)}</span> / {line.greyMeters.toFixed(2)}m
                                              </div>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                              {(line.deliverySchedules || []).map((schedule) => (
                                                <div key={schedule.id} className="flex items-center gap-2 bg-background p-2 rounded border shadow-sm">
                                                  <div className="w-20">
                                                    <Input
                                                      type="number"
                                                      min="0"
                                                      value={schedule.quantity || ''}
                                                      onChange={(e) => updateScheduleRowDyeing(line.id, schedule.id, 'quantity', e.target.value)}
                                                      className="h-7 text-[10px] px-1 font-medium"
                                                      placeholder="Qty"
                                                    />
                                                  </div>
                                                  <div className="flex-1">
                                                    <AppDatePicker
                                                      value={schedule.pickDate}
                                                      onChange={(nextValue) => updateScheduleRowDyeing(line.id, schedule.id, 'pickDate', nextValue)}
                                                      className="h-7 text-[10px] px-2"
                                                    />
                                                  </div>
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => removeScheduleRowDyeing(line.id, schedule.id)}
                                                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                                  >
                                                    <X className="h-3 w-3" />
                                                  </Button>
                                                </div>
                                              ))}
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => addScheduleRowDyeing(line.id)}
                                                className="h-8 text-[10px] uppercase font-bold border-dashed border-2 hover:bg-background transition-all"
                                                disabled={scheduledQty >= line.greyMeters}
                                              >
                                                <Plus className="h-3 w-3 mr-1" />
                                                Add Schedule Row
                                              </Button>
                                            </div>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>

                    {/* CALCULATION & SUMMARY BAR */}
                    {(() => {
                      const totalSrc = sourceLots.reduce((sum, l) => sum + l.usedMeters, 0);
                      const totalClr = colorLines.reduce((sum, c) => sum + c.greyMeters, 0);
                      const diff = totalSrc - totalClr;
                      const isMatched = Math.abs(diff) < 0.01;

                      return (
                        <div className="mt-8 p-4 rounded-lg bg-muted/50 border flex flex-col md:flex-row items-center justify-between gap-4">
                          <div className="flex flex-wrap items-center gap-6">
                            <div className="space-y-1">
                              <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Source Pool</p>
                              <p className="text-xl font-bold">{totalSrc.toFixed(2)}m</p>
                            </div>
                            <div className="h-8 w-px bg-border hidden md:block" />
                            <div className="space-y-1">
                              <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">Target Total</p>
                              <p className={`text-xl font-bold ${totalClr > totalSrc + 0.01 ? 'text-destructive' : ''}`}>{totalClr.toFixed(2)}m</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right hidden sm:block">
                              {isMatched ? (
                                <div className="flex items-center justify-end gap-2 text-emerald-600 font-semibold text-xs">
                                  <Check className="h-4 w-4" />
                                  Match Successful
                                </div>
                              ) : (
                                <div className="flex items-center justify-end gap-2 text-destructive font-semibold text-xs">
                                  <X className="h-4 w-4" />
                                  {totalClr > totalSrc + 0.01 ? 'Limit Exceeded' : `Mismatch: ${Math.abs(diff).toFixed(2)}m`}
                                </div>
                              )}
                            </div>

                            <Button 
                              onClick={handleIssueGreyMaterial}
                              disabled={!isMatched || totalSrc <= 0}
                              size="lg"
                              className="px-8"
                            >
                              Issue to Dyeing
                            </Button>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 mt-6 border-t">
                      <div className="space-y-3 border p-4 rounded-xl bg-muted/5 flex flex-col">
                        <Label className="text-sm font-bold text-slate-700">Production Notes</Label>
                        <Textarea
                          value={issueForm.notes}
                          onChange={e => setIssueForm({...issueForm, notes: e.target.value})}
                          placeholder="Include any specific instructions for the dyeing house..."
                          className="flex-1 min-h-[100px] text-sm bg-background resize-none border-muted-foreground/20 focus-visible:ring-primary/20"
                        />
                      </div>
                      <div className="space-y-3 border p-4 rounded-xl bg-muted/5 flex flex-col">
                        <Label className="text-sm font-bold text-slate-700">Attachments (Picture / Doc)</Label>
                        <div className="flex-1 flex flex-col justify-center border-2 border-dashed border-muted-foreground/20 rounded-lg p-4 bg-background relative transition-colors hover:bg-muted/10 group overflow-hidden">
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
                      <TableHead className="w-8" />
                      <TableHead>Work Order No</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Lot No(s)</TableHead>
                      <TableHead>Quality</TableHead>
                      <TableHead>Dyeing House</TableHead>
                      <TableHead>Colour</TableHead>
                      <TableHead>Grey Thans</TableHead>
                      <TableHead>Grey Meters</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[52px] text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dyeingJobs.slice(-10).reverse().map(job => {
                      const isListExpanded = expandedRecentJobs.has(job.id);
                      const toggleRecentJobExpansion = () => {
                        setExpandedRecentJobs(prev => {
                          const next = new Set(prev);
                          if (next.has(job.id)) next.delete(job.id);
                          else next.add(job.id);
                          return next;
                        });
                      };
                      const hasSchedules = (job.deliverySchedules?.length || 0) > 0;
                      const scheduledQty = job.deliverySchedules?.reduce((sum, s) => sum + (s.quantity || 0), 0) || 0;

                      return (
                        <React.Fragment key={job.id}>
                          <TableRow>
                            <TableCell>
                              {hasSchedules && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={toggleRecentJobExpansion}
                                >
                                  {isListExpanded ? (
                                    <ChevronUp className="h-3 w-3" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3" />
                                  )}
                                </Button>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{job.workOrderNo}</TableCell>
                            <TableCell className="text-muted-foreground">{formatDate(job.issueDate)}</TableCell>
                            <TableCell><Badge variant="outline" className="max-w-[200px] truncate">{job.lotNo}</Badge></TableCell>
                            <TableCell>{job.quality || '-'}</TableCell>
                            <TableCell>{job.dyeingHouse}</TableCell>
                            <TableCell>{job.colour}</TableCell>
                            <TableCell>{job.greyThan}</TableCell>
                            <TableCell>{job.greyMeters.toFixed(2)}</TableCell>
                            <TableCell>
                              {hasSchedules ? (
                                <div className="text-[11px] leading-tight">
                                  <div className="font-medium text-primary">{job.deliverySchedules?.length} rows</div>
                                  <div className="text-muted-foreground">{scheduledQty} / {job.greyMeters}m</div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs italic">No schedule</span>
                              )}
                            </TableCell>
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
                          {isListExpanded && hasSchedules && (
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={10} className="p-0">
                                <div className="p-3 ml-8 border-l-2 border-primary/20 space-y-2">
                                  <p className="text-[10px] font-bold uppercase text-muted-foreground">Delivery Schedule Details</p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {job.deliverySchedules?.map((s, idx) => (
                                      <div key={idx} className="flex justify-between items-center bg-background p-2 rounded border text-xs shadow-sm">
                                        <span className="font-semibold">{s.quantity}m</span>
                                        <span className="text-muted-foreground">{formatDate(s.pickDate)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {dyeingJobs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
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
                          ? `${selectedReceiveJobIds.length} colors selected`
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
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Colour</p>
                      <p className="text-sm font-semibold">{selectedContextColours.join(', ') || '-'}</p>
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
                  {selectedContextSchedules.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-primary/5">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Target Delivery Schedule</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedContextSchedules.map((s, idx) => (
                          <div key={idx} className="bg-background/80 px-3 py-1.5 rounded-md border border-primary/10 text-[11px] font-medium flex gap-3 items-center shadow-sm">
                            <span className="text-primary">{s.quantity}m</span>
                            <span className="text-muted-foreground border-l pl-3">{s.colour}</span>
                            <span className="text-muted-foreground border-l pl-3">{formatDate(s.pickDate)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                        onChange={e => setReceiveForm({...receiveForm, tiyarMeters: e.target.value})}
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
                      onChange={e => setReceiveForm({...receiveForm, notes: e.target.value})}
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
                    {dyeingReceives.slice(-5).reverse().map(receive => (
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
                                      const numThans = receive?.tiyarThan || 0;
                                      let next: { 
                                        id: string; 
                                        meters: number; 
                                        placeholderMeters?: number;
                                        isFaulty?: boolean;
                                        pieceType: 'loose' | 'grade_b' | 'cut_piece';
                                      }[] = [];
                                      
                                      // If receive has granular thanDetails, use them as SUGGESTIONS (placeholders)
                                      if (receive.thanDetails && receive.thanDetails.length > 0) {
                                        next = receive.thanDetails.map(td => ({ 
                                          id: td.id, 
                                          meters: 0, 
                                          placeholderMeters: td.meters,
                                          isFaulty: false,
                                          pieceType: 'loose'
                                        }));
                                      } else {
                                        for (let i = 0; i < numThans; i++) {
                                          next.push({ 
                                            id: `than-${Date.now()}-${i}`, 
                                            meters: 0,
                                            isFaulty: false,
                                            pieceType: 'loose'
                                          });
                                        }
                                      }
                                      
                                      setLformState({...lformState, dyeingReceiveId: receive.id, thanLines: next});
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
                    onChange={e => setLformState({...lformState, operator: e.target.value})}
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
                <div className="flex items-center justify-between pb-2 border-b mb-4">
                  <div>
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px]">L</div>
                      Received Than Entry
                    </h3>
                    <p className="text-[11px] text-muted-foreground leading-tight">Enter count first, then specify individual meters to construct L-Form rows.</p>
                  </div>
                  <div className="flex items-center gap-3 bg-muted/30 p-1 rounded-lg border">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground pl-2 leading-none">Total Than</Label>
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      className="w-16 h-7 text-center font-bold focus:ring-1 text-xs"
                      placeholder="0"
                      value={lformState.thanLines.length || ''}
                      onChange={(e) => {
                        const n = Math.max(0, Math.min(500, Number(e.target.value)));
                        setLformState(prev => {
                          const next: { id: string; meters: number }[] = [];
                          for (let i = 0; i < n; i++) {
                            next.push(prev.thanLines[i] ?? { id: `than-${Date.now()}-${i}`, meters: 0 });
                          }
                          return { ...prev, thanLines: next };
                        });
                      }}
                    />
                  </div>
                </div>

                {lformState.thanLines.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 max-h-[400px] overflow-y-auto p-1">
                    {lformState.thanLines.map((line, idx) => (
                      <div 
                        key={line.id} 
                        className={`flex flex-col gap-2 p-2 rounded-lg border transition-all shadow-sm ${line.isFaulty ? 'bg-destructive/5 border-destructive/20 ring-1 ring-destructive/10' : 'bg-card hover:bg-muted/5'}`}
                      >
                        <div className="flex items-center gap-2">
                            <div className="flex flex-col items-center gap-1">
                                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${line.isFaulty ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground/80'}`}>
                                  {idx + 1}
                                </div>
                                <input 
                                    type="checkbox"
                                    checked={line.isFaulty || false}
                                    onChange={(e) => {
                                        const checked = e.target.checked;
                                        setLformState(prev => ({
                                            ...prev,
                                            thanLines: prev.thanLines.map((l, i) => i === idx ? { ...l, isFaulty: checked } : l)
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
                                placeholder={line.placeholderMeters ? line.placeholderMeters.toFixed(2) : "0.00"}
                                className={`h-9 pl-7 pr-2 text-sm font-bold focus:ring-1 transition-all ${!line.meters ? 'opacity-40 bg-muted/20' : 'opacity-100 bg-background'}`}
                                value={line.meters || ''}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setLformState(prev => ({
                                    ...prev,
                                    thanLines: prev.thanLines.map((l, i) => i === idx ? { ...l, meters: val } : l)
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
                              thanLines: prev.thanLines.map((l, i) => i === idx ? { ...l, pieceType: val } : l)
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
                
                {lformState.thanLines.length > 0 && (
                  <div className="mt-4 p-4 bg-muted/40 border rounded-lg flex flex-col gap-2 text-sm">
                    <h4 className="font-semibold mb-1 uppercase text-[10px] tracking-wider text-muted-foreground">Summary:</h4>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <strong>Total Rows:</strong> {lformState.thanLines.length}
                      </div>
                      <div>
                        <strong>Total Than:</strong> {lformState.thanLines.length}
                      </div>
                      <div>
                        <strong>Total Meters:</strong> {lformState.thanLines.reduce((sum, r) => sum + r.meters, 0).toFixed(2)} M
                      </div>
                      <div className={lformState.thanLines.filter(l => l.isFaulty).length > 0 ? "text-destructive font-bold" : ""}>
                        <strong>Faulty items:</strong> {lformState.thanLines.filter(l => l.isFaulty).length}
                      </div>
                    </div>

                    {lformState.thanLines.some(l => l.isFaulty) && (
                      <div className="bg-destructive/10 p-2 rounded border border-destructive/20 text-xs mt-1 flex items-start gap-2">
                        <AlertTriangle className="h-3 w-3 mt-0.5 text-destructive shrink-0" />
                        <div>
                            <span className="font-bold text-destructive uppercase tracking-tighter mr-2">List of Faulty:</span>
                            <span>
                              {lformState.thanLines
                                .map((l, i) => l.isFaulty ? `#${i + 1}` : null)
                                .filter(Boolean)
                                .join(', ')}
                            </span>
                        </div>
                      </div>
                    )}

                    {selectedReceive && (
                        <div className={`mt-2 font-bold bg-background p-2 border rounded ${lformState.thanLines.reduce((s, l) => s + l.meters, 0) > selectedReceive.tiyarMeters ? 'text-indigo-600 border-indigo-200' : 'text-emerald-600 border-emerald-200'}`}>
                            Comparison Vs. Received Target: {selectedReceive.tiyarMeters.toFixed(2)} M
                        </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => saveLForm(false)} disabled={lformState.thanLines.length === 0}>
                  Save Draft
                </Button>
                <Button onClick={() => saveLForm(true)} disabled={lformState.thanLines.length === 0}>
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
                    {lforms.slice(-5).reverse().map(lform => (
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

        {/* Voucher Creation - Step 3 */}
        <TabsContent value="voucher">
          <Card>
            <CardHeader>
              <CardTitle>Step 3: Packing Department Transfer (Voucher)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <Label>Select L-Form *</Label>
                  <Select value={voucherState.lformId} onValueChange={v => setVoucherState({...voucherState, lformId: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select L-Form" />
                    </SelectTrigger>
                    <SelectContent>
                      {lforms.filter(l => l.status === 'finalized').map(lform => (
                        <SelectItem key={lform.id} value={lform.id}>
                          {lform.lformNumber} - Lot {lform.lotNo} ({lform.totalThans} Than, {lform.totalMeters.toFixed(2)} M)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Voucher Type *</Label>
                  <Select value={voucherState.voucherType} onValueChange={v => setVoucherState({...voucherState, voucherType: v as 'bulk' | 'loose'})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bulk">Voucher No 1 - Bulk Transfer</SelectItem>
                      <SelectItem value="loose">Voucher No 3 - Loose/Cut Pieces</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Transfer Date</Label>
                  <AppDatePicker
                    value={voucherState.transferDate}
                    onChange={(nextValue) => setVoucherState({ ...voucherState, transferDate: nextValue })}
                  />
                </div>
                <div>
                  <Label>Warehouse Destination *</Label>
                  <Select value={voucherState.warehouseId} onValueChange={v => setVoucherState({...voucherState, warehouseId: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map(loc => (
                        <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedLForm && (
                <div className="p-4 bg-muted rounded-lg mb-4">
                  <h4 className="font-semibold mb-2">L-Form Preview:</h4>
                  <div className="grid grid-cols-4 gap-2 text-sm mb-3">
                    <div><strong>L-Form:</strong> {selectedLForm.lformNumber}</div>
                    <div><strong>Lot:</strong> {selectedLForm.lotNo}</div>
                    <div><strong>Total Rows:</strong> {selectedLForm.rows.length}</div>
                    <div><strong>Total Meters:</strong> {selectedLForm.totalMeters.toFixed(2)}</div>
                  </div>
                  <div className="max-h-48 overflow-y-auto border rounded p-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Than ID</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Shade</TableHead>
                          <TableHead>Than</TableHead>
                          <TableHead>Meters</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedLForm.rows.map(row => (
                          <TableRow key={row.id}>
                            <TableCell className="text-xs">{row.thanId}</TableCell>
                            <TableCell className="text-xs">{row.itemType}</TableCell>
                            <TableCell className="text-xs">{row.shade}</TableCell>
                            <TableCell className="text-xs">{row.thanLength}</TableCell>
                            <TableCell className="text-xs">{row.meterEquivalent.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button onClick={createVoucher} disabled={!selectedLForm || !voucherState.warehouseId}>
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Create Voucher
                </Button>
              </div>

              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3">Recent Vouchers</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Voucher No</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Lot No</TableHead>
                      <TableHead>Warehouse</TableHead>
                      <TableHead>Total Than</TableHead>
                      <TableHead>Total Meters</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vouchers.slice(-5).reverse().map(voucher => {
                      const warehouse = locations.find(l => l.id === voucher.warehouseId);
                      return (
                        <TableRow key={voucher.id}>
                          <TableCell>
                            <Badge variant={voucher.voucherType === 'bulk' ? 'default' : 'secondary'}>
                              {voucher.voucherNumber}
                            </Badge>
                          </TableCell>
                          <TableCell>{voucher.voucherType === 'bulk' ? 'Bulk' : 'Loose/Cut'}</TableCell>
                          <TableCell><Badge>{voucher.lotNo}</Badge></TableCell>
                          <TableCell>{warehouse?.name}</TableCell>
                          <TableCell>{voucher.totalThans.toFixed(2)}</TableCell>
                          <TableCell>{voucher.totalMeters.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={voucher.status === 'approved' ? 'default' : 'secondary'}>
                              {voucher.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              <Printer className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
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

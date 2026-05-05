/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { stockApi, saleOrderApi, customerApi, articleApi, dyeingFlowApi, grnApi } from '@/lib/api';
import { StockItem, SaleOrder, Customer, Article, UserRole, DyeingJob, DyeingReceive, LForm, Voucher, GRN } from '@/types';
import {
  BarChart3, TrendingUp, Package, Users,
  ChevronDown, ChevronRight, AlertTriangle, Paperclip,
  Search, CheckCircle2, Circle, FileText, Table2,
} from 'lucide-react';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn, formatDate } from '@/lib/utils';

interface ReportsModuleProps {
  userRole: UserRole;
}

// ── Stage config ──────────────────────────────────────────────────────────────
const STAGE_CONFIG = {
  grey_fabric: { label: 'Grey Fabric', cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  dyeing:      { label: 'Dyeing',      cls: 'bg-violet-100 text-violet-700 border-violet-200' },
  l_form:      { label: 'L-Form',      cls: 'bg-sky-100 text-sky-700 border-sky-200' },
  cutting:     { label: 'Cutting',     cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  packing:     { label: 'Packing',     cls: 'bg-rose-100 text-rose-700 border-rose-200' },
  dispatch:    { label: 'Dispatch',    cls: 'bg-slate-800 text-white border-slate-800' },
} as const;

type StageName = keyof typeof STAGE_CONFIG;

// ── Tree node type ────────────────────────────────────────────────────────────
interface TreeNodeData {
  id: string;
  stage: StageName;
  ref: string;
  txDate?: string;
  supplier?: string;
  thans: number;
  meters: number;
  warehouse: string;
  splitTo?: number;
  mergeTo?: number;
  hasWarning?: boolean;
  hasAttachment?: boolean;
  status: string;
  children: TreeNodeData[];
}

// ── Build genealogy tree ──────────────────────────────────────────────────────
const buildTree = (
  lotNo: string,
  jobs: DyeingJob[],
  receives: DyeingReceive[],
  lforms: LForm[],
  vouchers: Voucher[],
  stockLotMetersByLot: Map<string, number>,
  grnInfoByLot: Map<string, { grnNumber: string; txDate?: string; supplierName?: string; thans?: number }>,
): TreeNodeData => {
  const getDyeingRef = (job: DyeingJob): string => {
    const wo = String(job.workOrderNo || '').trim();
    const fallback = String(job.jobNumber || '').trim();
    const baseRef = wo || fallback || 'WO-NA';
    const colour = String(job.colour || '').trim();
    return colour ? `${baseRef} (${colour})` : baseRef;
  };

  const jobsForLot = jobs.filter(
    j => j.lotNo === lotNo || j.sourceLots?.some(s => s.lotNo === lotNo)
  );
  const totalGreyMeters = jobsForLot.reduce((s, j) => s + (j.greyMeters || 0), 0);
  const totalGreyThan   = jobsForLot.reduce((s, j) => s + (j.greyThan   || 0), 0);
  const fallbackGreyMeters = stockLotMetersByLot.get(lotNo) || 0;
  // Keep GRN/stock quantity visible even if a dyeing job exists for the same lot.
  const effectiveGreyMeters = Math.max(totalGreyMeters, fallbackGreyMeters);

  const dyeingNodes: TreeNodeData[] = jobsForLot.map(job => {
    const receivesForJob = receives.filter(
      r => r.dyeingJobId === job.id || r.lotNo === lotNo
    );

    const lformNodes: TreeNodeData[] = [];

    receivesForJob.forEach(recv => {
      const lformsForRecv = lforms.filter(
        l => l.dyeingReceiveId === recv.id || l.lotNo === lotNo
      );

      lformsForRecv.forEach(lf => {
        const vouchersForLf = vouchers.filter(
          v => v.lformId === lf.id || v.lotNo === lotNo
        );

        const dispatchNodes: TreeNodeData[] = vouchersForLf.map(v => ({
          id: v.id,
          stage: 'dispatch' as const,
          ref: v.voucherNumber,
          txDate: v.transferDate || v.createdAt || undefined,
          supplier: '-',
          thans: Number(v.totalThans || 0),
          meters: Number(v.totalMeters || 0),
          warehouse: String(v.warehouseId || '-'),
          status: v.status === 'transferred' ? 'complete' : v.status === 'approved' ? 'partial' : 'pending',
          children: [],
        }));

        lformNodes.push({
          id: lf.id,
          stage: 'l_form',
          ref: lf.lformNumber,
          txDate: lf.operationDate || lf.createdAt || undefined,
          supplier: '-',
          thans: Number(lf.totalThans || 0),
          meters: Number(lf.totalMeters || 0),
          warehouse: '-',
          status: lf.status === 'finalized' ? 'complete' : 'partial',
          children: dispatchNodes,
        });
      });
    });

    const recvThan   = receivesForJob.reduce((s, r) => s + (r.tiyarThan   || 0), 0);
    const recvMeters = receivesForJob.reduce((s, r) => s + (r.tiyarMeters || 0), 0);
    const hasLoss    = (recvMeters > 0 && recvMeters < (job.greyMeters || 0)) ||
                       (recvThan  > 0 && recvThan  < (job.greyThan   || 0));

    return {
      id: job.id,
      stage: 'dyeing',
      ref: getDyeingRef(job),
      txDate: job.issueDate || job.createdAt || undefined,
      supplier: String(job.dyeingHouse || '-'),
      thans: Number(job.greyThan || 0),
      meters: Number(job.greyMeters || 0),
      warehouse: String(job.dyeingHouse || '-'),
      hasWarning:    hasLoss,
      hasAttachment: !!job.attachmentUrl,
      status: job.status === 'received' || job.status === 'completed' ? 'received' : 'issued',
      children: lformNodes,
    };
  });

  return {
    id: `grey-${lotNo}`,
    stage: 'grey_fabric',
    ref: grnInfoByLot.get(lotNo)?.grnNumber || lotNo,
    txDate: grnInfoByLot.get(lotNo)?.txDate,
    supplier: grnInfoByLot.get(lotNo)?.supplierName || '-',
    thans: Number(grnInfoByLot.get(lotNo)?.thans || totalGreyThan || 0),
    meters: Number(effectiveGreyMeters || 0),
    warehouse: 'Grey Store',
    splitTo: jobsForLot.length > 1 ? jobsForLot.length : undefined,
    status: 'received',
    children: dyeingNodes,
  };
};

const collectIds = (node: TreeNodeData): string[] => [
  node.id,
  ...node.children.flatMap(collectIds),
];

// ── Flat table rows for table view ───────────────────────────────────────────
interface FlatRow {
  stage: StageName;
  ref: string;
  txDate?: string;
  supplier?: string;
  thans: number;
  meters: number;
  warehouse: string;
  status: string;
  depth: number;
}

const flatten = (node: TreeNodeData, depth = 0): FlatRow[] => [
  {
    stage: node.stage,
    ref: node.ref,
    txDate: node.txDate,
    supplier: node.supplier,
    thans: node.thans,
    meters: node.meters,
    warehouse: node.warehouse,
    status: node.status,
    depth,
  },
  ...node.children.flatMap(c => flatten(c, depth + 1)),
];

// ── Tree row component ────────────────────────────────────────────────────────
const TreeRow = ({
  node,
  depth,
  expandedIds,
  onToggle,
}: {
  node: TreeNodeData;
  depth: number;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}) => {
  const isExpanded   = expandedIds.has(node.id);
  const hasChildren  = node.children.length > 0;
  const cfg          = STAGE_CONFIG[node.stage];

  return (
    <div>
      {/* Row */}
      <div
        className={cn(
          'flex items-center gap-2 border rounded-lg px-3 py-2.5 mb-1.5 select-none',
          hasChildren && 'cursor-pointer hover:bg-muted/40 transition-colors',
        )}
        style={{ marginLeft: depth * 28 }}
        onClick={() => hasChildren && onToggle(node.id)}
      >
        {/* Expand chevron */}
        <span className="w-5 flex-shrink-0 flex items-center justify-center">
          {hasChildren
            ? isExpanded
              ? <ChevronDown  className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
            : null}
        </span>

        {/* Status icon */}
        {node.status === 'complete' || node.status === 'received'
          ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
          : node.status === 'partial' || node.status === 'issued'
          ? <Circle       className="h-4 w-4 text-amber-400 flex-shrink-0" />
          : <Circle       className="h-4 w-4 text-slate-300 flex-shrink-0" />}

        {/* Stage badge */}
        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded border', cfg.cls)}>
          {cfg.label}
        </span>

        {/* Reference */}
        <span className="text-sm font-semibold">{node.ref}</span>

        {/* Split / Merge pill */}
        {node.splitTo  && <Badge variant="secondary" className="text-xs">Split → {node.splitTo}</Badge>}
        {node.mergeTo  && <Badge variant="secondary" className="text-xs">Merge → {node.mergeTo}</Badge>}

        <div className="flex-1" />

        {/* Icons */}
        {node.hasWarning    && <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />}
        {node.hasAttachment && <Paperclip     className="h-4 w-4 text-slate-400 flex-shrink-0" />}
      </div>

      {/* Quantity sub-line */}
      <div
        className="text-xs text-muted-foreground mb-2 -mt-0.5"
        style={{ marginLeft: depth * 28 + 52 }}
      >
        {node.qty}
      </div>

      {/* Children */}
      {isExpanded && node.children.map(child => (
        <TreeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          expandedIds={expandedIds}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
};

// ── Reconciliation (kept for Overview tab) ────────────────────────────────────
interface ReconStage {
  stage: string;
  inputQty: number | null;
  outputQty: number | null;
  loss: number | null;
  yieldPct: number | null;
  zeroLoss?: boolean;
  isDark?: boolean;
}

const computeRecon = (
  lotNo: string,
  jobs: DyeingJob[],
  receives: DyeingReceive[],
  lforms: LForm[],
  vouchers: Voucher[],
): ReconStage[] => {
  const jobsForLot = jobs.filter(j => j.lotNo === lotNo || j.sourceLots?.some(s => s.lotNo === lotNo));
  const greyThan   = jobsForLot.reduce((s, j) => s + (j.greyThan   || 0), 0);
  const greyMeters = jobsForLot.reduce((s, j) => s + (j.greyMeters || 0), 0);

  const jobIds     = new Set(jobsForLot.map(j => j.id));
  const rcvs       = receives.filter(r => r.lotNo === lotNo || jobIds.has(r.dyeingJobId));
  const dyeOut     = rcvs.reduce((s, r) => s + (r.tiyarThan   || r.tiyarMeters   || 0), 0);

  const rcvIds     = new Set(rcvs.map(r => r.id));
  const lfs        = lforms.filter(l => l.lotNo === lotNo || rcvIds.has(l.dyeingReceiveId));
  const lformOut   = lfs.reduce((s, l) => s + (l.totalThans  || l.totalMeters  || 0), 0);

  const lfIds      = new Set(lfs.map(l => l.id));
  const vouchs     = vouchers.filter(v => v.lotNo === lotNo || lfIds.has(v.lformId));
  const dispatchOut= vouchs.reduce((s, v) => s + (v.totalThans || v.totalMeters || 0), 0);

  const greyIn = greyThan || greyMeters;
  const pct    = (out: number, inQty: number) =>
    inQty > 0 ? parseFloat(((out / inQty) * 100).toFixed(1)) : null;

  const stages: ReconStage[] = [];
  if (greyIn > 0) {
    stages.push({ stage: 'Grey Fabric', inputQty: greyIn,   outputQty: dyeOut  > 0 ? dyeOut  : null, loss: dyeOut > 0 && greyIn > dyeOut ? greyIn - dyeOut : null, yieldPct: dyeOut > 0 ? pct(dyeOut, greyIn) : null });
    if (dyeOut > 0) stages.push({ stage: 'Dyeing',         inputQty: dyeOut,  outputQty: lformOut > 0 ? lformOut : null, loss: lformOut > 0 && dyeOut > lformOut ? dyeOut - lformOut : null, yieldPct: lformOut > 0 ? pct(lformOut, dyeOut) : null });
    if (lformOut > 0) stages.push({ stage: 'L-Form',       inputQty: lformOut, outputQty: lformOut, loss: null, yieldPct: 100.0, zeroLoss: true, isDark: true });
    if (dispatchOut > 0) {
      stages.push({ stage: 'Dispatch', inputQty: lformOut, outputQty: dispatchOut, loss: lformOut > dispatchOut ? lformOut - dispatchOut : null, yieldPct: pct(dispatchOut, lformOut), isDark: dispatchOut === lformOut });
    }
  }
  return stages;
};

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════
export const ReportsModule = ({ userRole }: ReportsModuleProps) => {
  // Overview data
  const [stock,     setStock]     = useState<StockItem[]>([]);
  const [sales,     setSales]     = useState<SaleOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [articles,  setArticles]  = useState<Article[]>([]);
  const [grns,      setGrns]      = useState<GRN[]>([]);

  // Dyeing flow (localStorage)
  const [dyeingJobs,     setDyeingJobs]     = useState<DyeingJob[]>([]);
  const [dyeingReceives, setDyeingReceives] = useState<DyeingReceive[]>([]);
  const [lforms,         setLforms]         = useState<LForm[]>([]);
  const [vouchers,       setVouchers]       = useState<Voucher[]>([]);

  // Lot Traceability UI state
  const [lotSearch,    setLotSearch]    = useState('');
  const [stageFilter,  setStageFilter]  = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedLot,  setSelectedLot]  = useState('');
  const [viewMode,     setViewMode]     = useState<'tree' | 'table'>('tree');
  const [expandedIds,  setExpandedIds]  = useState<Set<string>>(new Set());

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [s, sl, c, a, flow, apiGrns] = await Promise.all([
        stockApi.getAll(), saleOrderApi.getAll(), customerApi.getAll(), articleApi.getAll(), dyeingFlowApi.getAll(), grnApi.getAll(),
      ]);
      setStock(s); setSales(sl); setCustomers(c); setArticles(a);
      setGrns(apiGrns);
      setDyeingJobs(flow.jobs || []);
      setDyeingReceives(flow.receives || []);
      setLforms(flow.lforms || []);
      setVouchers(flow.vouchers || []);
      return;
    } catch { setStock([]); setSales([]); setCustomers([]); setArticles([]); setGrns([]); }

    // Fallback to local storage if dyeing flow API is unavailable.
    const dj = storage.get<DyeingJob>(STORAGE_KEYS.DYEING_JOBS);
    const dr = storage.get<DyeingReceive>(STORAGE_KEYS.DYEING_RECEIVES);
    const lf = storage.get<LForm>(STORAGE_KEYS.LFORMS);
    const v  = storage.get<Voucher>(STORAGE_KEYS.VOUCHERS);
    setDyeingJobs(dj); setDyeingReceives(dr); setLforms(lf); setVouchers(v);
  };

  // ── All grey lots ──────────────────────────────────────────────────────────
  const stockLotMetersByLot = useMemo(() => {
    const map = new Map<string, number>();
    stock.forEach((item) => {
      const lotNo = String(item.lotNo || item.article?.lotNumber || '').trim();
      if (!lotNo) return;
      const qty = Number(item.quantity || 0);
      map.set(lotNo, (map.get(lotNo) || 0) + qty);
    });
    return map;
  }, [stock]);

  const greyLots = useMemo(() => {
    const map = new Map<string, { meters: number; stages: number }>();

    stock.forEach((item) => {
      const lotNo = String(item.lotNo || item.article?.lotNumber || '').trim();
      if (!lotNo) return;
      const existing = map.get(lotNo) || { meters: 0, stages: 0 };
      existing.meters += Number(item.quantity || 0);
      existing.stages = Math.max(existing.stages, 1);
      map.set(lotNo, existing);
    });

    dyeingJobs.forEach(j => {
      const key = j.lotNo || 'Unknown';
      const existing = map.get(key) || { meters: 0, stages: 0 };
      existing.meters += j.greyMeters || 0;
      existing.stages += 1;
      map.set(key, existing);
    });
    return Array.from(map.entries())
      .map(([lotNo, data]) => ({ lotNo, ...data }))
      .sort((a, b) => a.lotNo.localeCompare(b.lotNo));
  }, [dyeingJobs, stock]);

  const filteredLots = useMemo(() =>
    greyLots.filter(l => l.lotNo.toLowerCase().includes(lotSearch.toLowerCase())),
    [greyLots, lotSearch]
  );

  const grnInfoByLot = useMemo(() => {
    const map = new Map<string, { grnNumber: string; txDate?: string; supplierName?: string; thans?: number }>();
    const sortedGrns = [...grns].sort(
      (a, b) => new Date(b.receivedAt || b.createdAt).getTime() - new Date(a.receivedAt || a.createdAt).getTime()
    );

    sortedGrns.forEach((grn) => {
      (grn.items || []).forEach((item: any) => {
        const lotNo = String(item.lotNo || '').trim();
        if (!lotNo) return;
        const existing = map.get(lotNo);
        if (!existing) {
          map.set(lotNo, {
            grnNumber: grn.grnNumber,
            txDate: grn.receivedAt || grn.createdAt || undefined,
            supplierName: grn.supplier?.name || undefined,
            thans: Number(item.packages || 0),
          });
          return;
        }
        map.set(lotNo, {
          ...existing,
          thans: Number(existing.thans || 0) + Number(item.packages || 0),
        });
      });
    });

    return map;
  }, [grns]);

  // Auto-select first lot
  useEffect(() => {
    if (!selectedLot && filteredLots.length > 0) setSelectedLot(filteredLots[0].lotNo);
  }, [filteredLots, selectedLot]);

  // ── Build tree for selected lot ──────────────────────────────────────────
  const tree = useMemo(() => {
    if (!selectedLot) return null;
    return buildTree(selectedLot, dyeingJobs, dyeingReceives, lforms, vouchers, stockLotMetersByLot, grnInfoByLot);
  }, [selectedLot, dyeingJobs, dyeingReceives, lforms, vouchers, stockLotMetersByLot, grnInfoByLot]);

  const allIds = useMemo(() => tree ? collectIds(tree) : [], [tree]);

  const expandAll  = useCallback(() => setExpandedIds(new Set(allIds)),  [allIds]);
  const collapseAll = useCallback(() => setExpandedIds(new Set()),        []);

  const toggleNode = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // Auto-expand tree root on lot change
  useEffect(() => {
    if (tree) setExpandedIds(new Set([tree.id, ...tree.children.map(c => c.id)]));
  }, [tree]);

  // ── Overview metrics ──────────────────────────────────────────────────────
  const totalStockValue = stock.reduce((s, i) => s + i.quantity * i.pricePerUnit, 0);
  const totalSales      = sales.reduce((s, o) => s + o.totalAmount, 0);
  const pendingSales    = sales.filter(o => o.status === 'pending').length;

  // ── Flat table rows ───────────────────────────────────────────────────────
  const tableRows = useMemo(() => tree ? flatten(tree) : [], [tree]);

  // ── Recon for table view tooltip ──────────────────────────────────────────

  return (
    <div className="space-y-0">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="overview"         className="gap-1.5"><BarChart3   className="h-4 w-4" />Overview</TabsTrigger>
          <TabsTrigger value="lot-traceability" className="gap-1.5"><AlertTriangle className="h-4 w-4" />Lot Traceability</TabsTrigger>
        </TabsList>

        {/* ══════════════════════ OVERVIEW TAB ══════════════════════ */}
        <TabsContent value="overview" className="space-y-4 mt-0">
          {/* KPI cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: 'Total Stock Value', icon: <Package className="h-4 w-4 text-muted-foreground" />, primary: `PKR ${totalStockValue.toLocaleString()}`, sub: `${stock.length} items in inventory` },
              { title: 'Total Sales',       icon: <TrendingUp className="h-4 w-4 text-muted-foreground" />, primary: `PKR ${totalSales.toLocaleString()}`, sub: `${sales.length} orders processed` },
              { title: 'Pending Orders',    icon: <BarChart3 className="h-4 w-4 text-muted-foreground" />, primary: String(pendingSales), sub: 'Awaiting processing' },
              { title: 'Total Customers',   icon: <Users className="h-4 w-4 text-muted-foreground" />, primary: String(customers.length), sub: 'Active customers' },
            ].map(kpi => (
              <Card key={kpi.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
                  {kpi.icon}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpi.primary}</div>
                  <p className="text-xs text-muted-foreground">{kpi.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Business overview */}
          <Card>
            <CardHeader>
              <CardTitle>Business Overview</CardTitle>
              <CardDescription>Quick summary of your textile business</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border-b pb-5">
                <h3 className="font-semibold mb-3">Top Articles</h3>
                <div className="space-y-2">
                  {articles.slice(0, 5).map(a => (
                    <div key={a.id} className="flex justify-between items-center">
                      <span className="text-sm text-blue-500 hover:underline cursor-pointer">
                        {a.name} ({a.fabricType || '—'})
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {[a.color, a.grade ? `Grade ${a.grade}` : null].filter(Boolean).join(' - ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Customer Summary</h3>
                <div className="space-y-2">
                  {customers.map(c => (
                    <div key={c.id} className="flex justify-between items-center">
                      <span className="text-sm text-blue-500 hover:underline cursor-pointer">
                        {c.name} ({(c as any).city || (c as any).billingCity || '—'})
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {c.isCashOnly ? 'Cash Only' : `Credit: PKR ${c.creditLimit.toLocaleString()}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ══════════════════ LOT TRACEABILITY TAB ══════════════════ */}
        <TabsContent value="lot-traceability" className="mt-0 space-y-3">
          {/* Top toolbar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search lot number…"
                value={lotSearch}
                onChange={e => setLotSearch(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>

            {/* Stage filter */}
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-36 bg-background">
                <SelectValue placeholder="All Stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {Object.entries(STAGE_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 bg-background">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>

            {/* Export */}
            <Button variant="outline" size="sm" className="gap-1.5 flex-shrink-0">
              <FileText className="h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 flex-shrink-0">
              <Table2 className="h-4 w-4" /> Excel
            </Button>
          </div>

          {/* Two-panel layout */}
          <div className="flex gap-4 min-h-[500px]">
            {/* ─── Left sidebar: Grey Lots ─── */}
            <div className="w-56 flex-shrink-0">
              <h3 className="text-sm font-semibold text-muted-foreground mb-2 px-1">Grey Lots</h3>
              <div className="space-y-2">
                {filteredLots.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic px-1">No lots found.</p>
                ) : (
                  filteredLots.map(lot => (
                    <button
                      key={lot.lotNo}
                      onClick={() => setSelectedLot(lot.lotNo)}
                      className={cn(
                        'w-full text-left px-3 py-2.5 rounded-lg border transition-colors',
                        selectedLot === lot.lotNo
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border bg-background hover:bg-muted/50',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{lot.lotNo}</span>
                        {selectedLot === lot.lotNo && (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {lot.meters.toLocaleString()} meters · {lot.stages} stage{lot.stages !== 1 ? 's' : ''}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* ─── Right panel: Tree / Table ─── */}
            <div className="flex-1 min-w-0">
              {/* Panel toolbar */}
              <div className="flex items-center justify-between mb-3">
                {/* Tree / Table toggle */}
                <div className="flex border rounded-lg overflow-hidden text-sm">
                  <button
                    onClick={() => setViewMode('tree')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 transition-colors',
                      viewMode === 'tree'
                        ? 'bg-foreground text-background'
                        : 'bg-background text-foreground hover:bg-muted',
                    )}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" /> Tree
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 border-l transition-colors',
                      viewMode === 'table'
                        ? 'bg-foreground text-background'
                        : 'bg-background text-foreground hover:bg-muted',
                    )}
                  >
                    <BarChart3 className="h-3.5 w-3.5" /> Table
                  </button>
                </div>

                {viewMode === 'tree' && (
                  <div className="flex items-center gap-3">
                    <button onClick={expandAll}  className="text-sm text-primary hover:underline">Expand All</button>
                    <button onClick={collapseAll} className="text-sm text-primary hover:underline">Collapse All</button>
                  </div>
                )}
              </div>

              {/* Content */}
              {!selectedLot || !tree ? (
                <div className="flex items-center justify-center h-64 border rounded-xl text-muted-foreground text-sm">
                  Select a lot from the left to view its genealogy.
                </div>
              ) : viewMode === 'tree' ? (
                <div className="border rounded-xl p-4 bg-background">
                  {/* Tree header */}
                  <div className="mb-3">
                    <h3 className="font-semibold text-base flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-primary" />
                      Lot Genealogy: {selectedLot}
                    </h3>
                    <p className="text-xs text-primary mt-0.5">Click any node for full details</p>
                  </div>

                  {/* Tree nodes */}
                  <div>
                    <TreeRow
                      node={tree}
                      depth={0}
                      expandedIds={expandedIds}
                      onToggle={toggleNode}
                    />
                  </div>
                </div>
              ) : (
                /* Table view */
                <div className="border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Stage</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Transaction Date</TableHead>
                        <TableHead className="text-right">Thans</TableHead>
                        <TableHead>Meters</TableHead>
                        <TableHead>Warehouse</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableRows.map((row, i) => {
                        const cfg = STAGE_CONFIG[row.stage];
                        return (
                          <TableRow key={i}>
                            <TableCell>
                              <span className={cn('text-xs font-semibold px-2 py-0.5 rounded border', cfg.cls)}>
                                {cfg.label}
                              </span>
                            </TableCell>
                            <TableCell className="font-medium" style={{ paddingLeft: row.depth * 20 + 16 }}>
                              {row.ref}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {row.txDate ? formatDate(row.txDate) : '-'}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-right">
                              {row.thans > 0 ? row.thans.toLocaleString() : '—'}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {row.meters > 0 ? `${row.meters.toLocaleString()} m` : '-'}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{row.warehouse || '-'}</TableCell>
                            <TableCell className="text-muted-foreground">{row.supplier || '-'}</TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-xs capitalize',
                                  row.status === 'complete' || row.status === 'received'
                                    ? 'text-emerald-600 border-emerald-300 bg-emerald-50'
                                  : row.status === 'partial' || row.status === 'issued'
                                    ? 'text-amber-600 border-amber-300 bg-amber-50'
                                  : 'text-slate-500 border-slate-200 bg-slate-50',
                                )}
                              >
                                {row.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {tableRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            No records for this lot.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

import type { PurchaseOrder, GRN, StockItem, Location } from '@/types';

export const pendingStockRowKey = (articleId: string, locationId: string) =>
  `${articleId}::${locationId}`;

/**
 * PO is still relevant for inbound qty if not cancelled/closed.
 * Supports receipt lifecycle statuses plus some legacy values for safety.
 */
export function isPurchaseOrderAwaitingInbound(status: string): boolean {
  const s = String(status).toLowerCase();
  if (s === 'cancelled') return false;
  if (s === 'complete' || s === 'completed' || s === 'received') return false;
  return true;
}

/** Sum accepted/received qty for one PO line across all GRNs for that PO. */
export function totalAcceptedForPoArticle(grns: GRN[], poId: string, articleId: string): number {
  return grns
    .filter((g) => g.poId === poId)
    .flatMap((g) => g.items || [])
    .filter((i) => i.articleId === articleId)
    .reduce(
      (sum, i) =>
        sum + (Number(i.acceptedQuantity) || Number(i.receivedQuantity) || 0),
      0
    );
}

/** Best-effort warehouse row to attribute PO lines not yet fully GRN'd. */
export function resolveInboundWarehouseId(
  po: PurchaseOrder,
  grns: GRN[],
  articleId: string,
  stock: StockItem[],
  locations: Location[]
): string | undefined {
  const forPo = grns.filter((g) => g.poId === po.id);
  const fromGrn = forPo.find((g) => g.warehouseId);
  if (fromGrn?.warehouseId) return fromGrn.warehouseId;
  if (po.warehouseId) return po.warehouseId;
  const godownOrWarehouseIds = new Set(
    locations
      .filter((l) => l.type === 'godown' || l.type === 'warehouse')
      .map((l) => l.id)
  );
  const row = stock.find(
    (s) => s.articleId === articleId && godownOrWarehouseIds.has(s.locationId)
  );
  return row?.locationId;
}

/**
 * Pending physical receipt: ordered on open POs minus quantities already on GRNs for that PO/article.
 * Values are keyed by `articleId::locationId` (expected inbound warehouse).
 */
export function buildPendingReceiptMap(
  stock: StockItem[],
  purchaseOrders: PurchaseOrder[],
  grns: GRN[],
  locations: Location[]
): Map<string, number> {
  const map = new Map<string, number>();

  for (const po of purchaseOrders) {
    if (!isPurchaseOrderAwaitingInbound(po.status)) continue;
    const items = po.items || [];
    for (const line of items) {
      const ordered = Number(line.quantity) || 0;
      if (ordered <= 0) continue;
      const received = totalAcceptedForPoArticle(grns, po.id, line.articleId);
      const pending = Math.max(0, ordered - received);
      if (pending <= 0) continue;
      const wh = resolveInboundWarehouseId(po, grns, line.articleId, stock, locations);
      if (!wh) continue;
      const k = pendingStockRowKey(line.articleId, wh);
      map.set(k, (map.get(k) || 0) + pending);
    }
  }
  return map;
}

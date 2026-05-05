import type { PurchaseOrderItem, Article } from '@/types';

function formatReedPickSlots(
  yarn: string | undefined | null,
  constraction: string | undefined | null,
  composition: string | undefined | null,
  width: string | undefined | null
): string {
  const y = String(yarn ?? '').trim();
  const cont = String(constraction ?? '').trim();
  const comp = String(composition ?? '').trim();
  const w = String(width ?? '').trim();
  const cell = (s: string) => (s ? s : '-');
  const a = cell(y);
  const b = cell(cont);
  const c = cell(w);
  const d = cell(comp);
  if (a === '-' && b === '-' && c === '-' && d === '-') return '-';
  return `${a} / ${b} / ${c} / ${d}`;
}

/** Article master only (no PO line overrides). */
export function formatArticleReedPickLine(article: Article): string {
  return formatReedPickSlots(
    article.yarnCount,
    article.constraction,
    article.composition,
    article.width
  );
}

/**
 * Reed pick line: yarn / constraction / width / composition.
 * PO line overrides article master. Empty slots use "-". All empty → "-".
 */
export function formatPoItemReedPickLine(
  item: PurchaseOrderItem,
  articles: Article[]
): string {
  // Prefer nested article from PO API (has dimensions); else article master list
  const art = item.article ?? articles.find((a) => a.id === item.articleId);
  return formatReedPickSlots(
    item.yarnCount ?? art?.yarnCount,
    item.constraction ?? art?.constraction,
    item.composition ?? art?.composition,
    item.width ?? art?.width
  );
}

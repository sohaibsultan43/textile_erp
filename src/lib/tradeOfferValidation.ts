// TradeOffer type for frontend validation
export interface TradeOffer {
  name: string;
  type: string;
  description?: string;
  level: string;
  status?: string;
  priority?: number;
  validFrom: string;
  validTo: string;
  allowStacking?: boolean;
}

// Validation function
export function validateTradeOffer(offer: TradeOffer): string[] {
  const errors: string[] = [];
  if (!offer.name) errors.push('Name is required');
  if (!offer.type) errors.push('Type is required');
  if (!offer.level) errors.push('Level is required');
  if (!offer.validFrom) errors.push('Valid From is required');
  if (!offer.validTo) errors.push('Valid To is required');
  return errors;
}

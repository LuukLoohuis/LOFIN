import { applyBp, cumulativeShare, MONTHS_PER_YEAR } from '../core/money';
import { at, zeros } from '../core/series';
import type { Cents, InvestmentItem, MonthIndex } from '../types/input';
import type { AssetSchedule } from '../types/result';

/**
 * Lineair: (aanschaf − restwaarde) / looptijd, per maand, vanaf de maand na aanschaf.
 * Cumulatief afgerond, zodat de afschrijving exact optelt tot het af te schrijven bedrag.
 */
export function straightLine(params: {
  costCents: Cents;
  residualCents: Cents;
  lifeMonths: number;
  purchaseMonth: MonthIndex;
  length: number;
}): { depreciation: Cents[]; bookValue: Cents[] } {
  const { costCents, residualCents, lifeMonths, purchaseMonth, length } = params;
  const depreciable = Math.max(0, costCents - residualCents);
  const depreciation = zeros(length);
  const bookValue = zeros(length);
  let accumulated = 0;

  for (let index = 0; index < length; index++) {
    const monthsSincePurchase = index - purchaseMonth;
    if (monthsSincePurchase >= 1 && monthsSincePurchase <= lifeMonths) {
      const amount = cumulativeShare(depreciable, monthsSincePurchase, lifeMonths);
      depreciation[index] = amount;
      accumulated += amount;
    }
    bookValue[index] = index >= purchaseMonth ? costCents - accumulated : 0;
  }
  return { depreciation, bookValue };
}

/** Bestaande vaste activa: de jaarlijkse afschrijving loopt door tot de boekwaarde op is. */
export function existingAssetsSchedule(
  bookValueCents: Cents,
  annualDepreciationCents: Cents,
  length: number,
): AssetSchedule {
  const depreciation = zeros(length);
  const bookValue = zeros(length);
  let remaining = bookValueCents;
  for (let index = 0; index < length; index++) {
    if (index > 0) {
      const positionInYear = ((index - 1) % MONTHS_PER_YEAR) + 1;
      const amount = Math.min(remaining, cumulativeShare(annualDepreciationCents, positionInYear, MONTHS_PER_YEAR));
      depreciation[index] = amount;
      remaining -= amount;
    }
    bookValue[index] = remaining;
  }
  return { investmentId: null, depreciation, bookValue };
}

export interface InvestmentsResult {
  exVat: Cents[];
  vat: Cents[];
  /** Voorraad blijft op peil staan: wat verkocht wordt, wordt aangevuld. */
  stock: Cents[];
  schedules: AssetSchedule[];
}

export function buildInvestments(items: readonly InvestmentItem[], length: number): InvestmentsResult {
  const result: InvestmentsResult = { exVat: zeros(length), vat: zeros(length), stock: zeros(length), schedules: [] };

  for (const item of items.filter((investment) => investment.purchaseMonth < length)) {
    const month = item.purchaseMonth;
    result.exVat[month] = at(result.exVat, month) + item.amountCents;
    result.vat[month] = at(result.vat, month) + applyBp(item.amountCents, item.vatRateBp);

    if (item.category === 'voorraad') {
      for (let index = month; index < length; index++) result.stock[index] = at(result.stock, index) + item.amountCents;
      continue;
    }

    const schedule = straightLine({
      costCents: item.amountCents,
      residualCents: item.residualValueCents,
      lifeMonths: item.lifeYears === null ? 0 : item.lifeYears * MONTHS_PER_YEAR,
      purchaseMonth: month,
      length,
    });
    result.schedules.push({ investmentId: item.id, ...schedule });
  }
  return result;
}

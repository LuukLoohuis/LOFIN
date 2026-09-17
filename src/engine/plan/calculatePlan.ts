import type { EngineConfig } from '../types/config';
import type { PlanInput } from '../types/input';
import type { PlanResult } from '../types/result';
import { ENGINE_VERSION } from '../version';
import { buildBalanceSheets } from './balanceSheet';
import { buildCashflow } from './cashflow';
import { buildChecklist, buildCompleteness } from './completeness';
import { buildFinancingNeed } from './financingNeed';
import { buildLedger } from './ledger';
import { buildPnl } from './pnl';
import { buildRatios } from './ratios';
import { buildScenarios } from './scenarios';
import { collectIssues } from './validation';

/**
 * De enige ingang van de rekenkern: dezelfde uitkomst voedt het dashboard, de pdf en Excel.
 * Zuiver en deterministisch — dezelfde invoer geeft altijd hetzelfde resultaat.
 */
export function calculatePlan(input: PlanInput, config: EngineConfig): PlanResult {
  const ledger = buildLedger(input, config, 0);
  const pnl = buildPnl(ledger);
  const cashflow = buildCashflow(ledger);
  const balanceSheet = buildBalanceSheets(ledger);
  const financingNeed = buildFinancingNeed(input, ledger.vat);
  const issues = collectIssues(input, ledger, financingNeed);
  const checklist = buildChecklist(input, config.checklist);

  return {
    meta: {
      engineVersion: ENGINE_VERSION,
      legalForm: input.company.legalForm,
      horizonMonths: ledger.timeline.horizonMonths,
      months: ledger.timeline.months,
      periods: ledger.timeline.periods,
    },
    issues,
    financingNeed,
    pnl,
    cashflow,
    loans: ledger.loans,
    creditLines: ledger.creditLines,
    depreciation: [ledger.existingAssets, ...ledger.investments.schedules],
    vat: ledger.vat,
    balanceSheet,
    ratios: buildRatios(ledger, pnl.periods, balanceSheet.periodEnds, config),
    scenarios: buildScenarios(input, ledger, config),
    checklist,
    completeness: buildCompleteness(input, checklist, issues, config),
  };
}

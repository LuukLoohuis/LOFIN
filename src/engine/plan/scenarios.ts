import { sum } from '../core/money';
import type { EngineConfig } from '../types/config';
import type { Bp, PlanInput } from '../types/input';
import type { ScenarioKey, ScenarioSummary } from '../types/result';
import { buildLedger, type Ledger } from './ledger';
import { buildPnl } from './pnl';
import { dscrByPeriod, firstMonthWhere, lowestCash } from './ratios';

/**
 * Een scenario verschuift alleen de omzet; de inkoopwaarde beweegt als percentage mee,
 * alle andere aannames blijven gelijk.
 */
export function summarizeScenario(key: ScenarioKey, revenueDeltaBp: Bp, ledger: Ledger, config: EngineConfig): ScenarioSummary {
  const lowest = lowestCash(ledger.closingCash);
  return {
    key,
    revenueDeltaBp,
    revenue: sum(ledger.revenue),
    dscr: dscrByPeriod(buildPnl(ledger).periods, config),
    lowestCash: lowest,
    firstNegativeMonth: firstMonthWhere(ledger.closingCash, (cash) => cash < 0),
    firstShortfallMonth: firstMonthWhere(ledger.shortfall, (gap) => gap > 0),
  };
}

export function buildScenarios(input: PlanInput, base: Ledger, config: EngineConfig): ScenarioSummary[] {
  const { pessimisticRevenueBp, optimisticRevenueBp } = input.scenarios;
  return [
    summarizeScenario('basis', 0, base, config),
    summarizeScenario('pessimistisch', pessimisticRevenueBp, buildLedger(input, config, pessimisticRevenueBp), config),
    summarizeScenario('optimistisch', optimisticRevenueBp, buildLedger(input, config, optimisticRevenueBp), config),
  ];
}

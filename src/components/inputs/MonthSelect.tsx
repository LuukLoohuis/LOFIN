import { useMemo } from 'react';
import { buildTimeline, parseYearMonth, type MonthIndex } from '../../engine';
import { formatYearMonth } from '../../lib/format';
import { Select } from '../ui/Select';

interface MonthSelectProps {
  value: MonthIndex;
  onChange: (month: MonthIndex) => void;
  startMonth: string;
  id?: string;
  describedBy?: string | undefined;
  invalid?: boolean;
  ariaLabel?: string;
}

/** Kiest een maand binnen de prognose; maand 0 is het startmoment. */
export function MonthSelect({ value, onChange, startMonth, id, describedBy, invalid, ariaLabel }: MonthSelectProps) {
  const options = useMemo(() => {
    const start = parseYearMonth(startMonth);
    if (start === null) return [{ value: '0', label: 'Startmoment' }];
    const { months } = buildTimeline(start);
    return months.map((meta) => ({
      value: String(meta.index),
      label:
        meta.index === 0
          ? 'Startmoment'
          : `${meta.index}. ${formatYearMonth(`${meta.year}-${String(meta.month).padStart(2, '0')}`)}`,
    }));
  }, [startMonth]);

  return (
    <Select
      id={id}
      aria-label={ariaLabel}
      aria-describedby={describedBy}
      invalid={invalid ?? false}
      options={options}
      value={String(value)}
      onChange={(event) => {
        onChange(Number(event.target.value));
      }}
    />
  );
}

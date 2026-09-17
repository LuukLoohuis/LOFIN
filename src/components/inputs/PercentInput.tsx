import { useState } from 'react';
import type { Bp } from '../../engine';
import { formatNumber, parsePercentInput } from '../../lib/format';
import { inputClass } from '../ui/inputStyles';

interface PercentInputProps {
  value: Bp;
  onChange: (bp: Bp) => void;
  id?: string;
  describedBy?: string | undefined;
  invalid?: boolean;
  decimals?: number;
  ariaLabel?: string;
}

/** Toont procenten, bewaart basispunten: 7,5 wordt 750. */
export function PercentInput({
  value,
  onChange,
  id,
  describedBy,
  invalid = false,
  decimals = 2,
  ariaLabel,
}: PercentInputProps) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const formatted = formatNumber(value / 100, decimals);

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className={inputClass(invalid, 'pr-8 text-right tabular-nums')}
        value={editing ? draft : formatted}
        onFocus={() => {
          setDraft(value === 0 ? '' : formatted);
          setEditing(true);
        }}
        onChange={(event) => {
          setDraft(event.target.value);
          const parsed = parsePercentInput(event.target.value);
          onChange(parsed ?? 0);
        }}
        onBlur={() => {
          setEditing(false);
        }}
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-500">%</span>
    </div>
  );
}

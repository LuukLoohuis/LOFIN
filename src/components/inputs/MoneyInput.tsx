import { useState } from 'react';
import type { Cents } from '../../engine';
import { formatCentsInput, parseEuroInput } from '../../lib/format';
import { inputClass } from '../ui/inputStyles';

interface MoneyInputProps {
  value: Cents;
  onChange: (cents: Cents) => void;
  id?: string;
  describedBy?: string | undefined;
  invalid?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}

/** Toont euro's, bewaart centen. Tijdens het typen blijft staan wat je intikt. */
export function MoneyInput({ value, onChange, id, describedBy, invalid = false, disabled, ariaLabel }: MoneyInputProps) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-500">€</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className={inputClass(invalid, 'pl-7 text-right tabular-nums')}
        value={editing ? draft : formatCentsInput(value)}
        onFocus={() => {
          setDraft(value === 0 ? '' : formatCentsInput(value));
          setEditing(true);
        }}
        onChange={(event) => {
          setDraft(event.target.value);
          const parsed = parseEuroInput(event.target.value);
          onChange(parsed ?? 0);
        }}
        onBlur={() => {
          setEditing(false);
        }}
      />
    </div>
  );
}

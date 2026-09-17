import { useState } from 'react';
import { formatNumber, parseDutchNumber } from '../../lib/format';
import { inputClass } from '../ui/inputStyles';

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  id?: string;
  describedBy?: string | undefined;
  invalid?: boolean;
  decimals?: number;
  suffix?: string;
  ariaLabel?: string;
}

/** Voor aantallen: uren, opdrachten, dagen, jaren. */
export function NumberInput({
  value,
  onChange,
  id,
  describedBy,
  invalid = false,
  decimals = 0,
  suffix,
  ariaLabel,
}: NumberInputProps) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const formatted = formatNumber(value, decimals);

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className={inputClass(invalid, suffix === undefined ? 'text-right tabular-nums' : 'pr-14 text-right tabular-nums')}
        value={editing ? draft : formatted}
        onFocus={() => {
          setDraft(value === 0 ? '' : formatted);
          setEditing(true);
        }}
        onChange={(event) => {
          setDraft(event.target.value);
          onChange(parseDutchNumber(event.target.value) ?? 0);
        }}
        onBlur={() => {
          setEditing(false);
        }}
      />
      {suffix !== undefined && (
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-500">
          {suffix}
        </span>
      )}
    </div>
  );
}

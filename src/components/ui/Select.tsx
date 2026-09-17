import type { SelectHTMLAttributes } from 'react';
import { inputClass } from './inputStyles';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  options: readonly { value: string; label: string }[];
}

export function Select({ invalid = false, className, options, ...props }: SelectProps) {
  return (
    <select className={inputClass(invalid, className)} aria-invalid={invalid || undefined} {...props}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

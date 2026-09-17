import { useId, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string | undefined;
  className?: string;
  children: (props: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

/** Label, uitleg en foutmelding om één invoerveld, met de juiste koppelingen voor schermlezers. */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint !== undefined ? hintId : null, error !== undefined ? errorId : null]
    .filter((value) => value !== null)
    .join(' ');

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-slate-800">
        {label}
      </label>
      {children({ id, describedBy: describedBy === '' ? undefined : describedBy, invalid: error !== undefined })}
      {hint !== undefined && (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error !== undefined && (
        <p id={errorId} className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

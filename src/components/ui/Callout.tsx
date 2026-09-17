import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type Tone = 'info' | 'warning' | 'error' | 'success';

const TONES: Record<Tone, string> = {
  info: 'border-slate-200 bg-slate-50 text-slate-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
};

export function Callout({ tone = 'info', title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  return (
    <div className={cn('rounded-md border px-4 py-3 text-sm', TONES[tone])}>
      {title !== undefined && <p className="font-semibold">{title}</p>}
      <div className={cn(title !== undefined && 'mt-1')}>{children}</div>
    </div>
  );
}

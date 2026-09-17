import type { Light } from '../../engine';
import { cn } from '../../lib/cn';

const COLORS: Record<Light, string> = {
  groen: 'bg-emerald-600',
  oranje: 'bg-amber-500',
  rood: 'bg-red-600',
  geen: 'bg-slate-300',
};

const LABELS: Record<Light, string> = {
  groen: 'Ruim',
  oranje: 'Krap',
  rood: 'Te krap',
  geen: 'Niet van toepassing',
};

/** Kleur én woord: kleur alleen is voor kleurenblinden geen signaal. */
export function TrafficLight({ light, className }: { light: Light; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium text-slate-600', className)}>
      <span className={cn('size-2.5 rounded-full', COLORS[light])} aria-hidden />
      {LABELS[light]}
    </span>
  );
}

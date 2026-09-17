import { cn } from '../../lib/cn';

/** Eén stijl voor alle invoervelden, zodat tekst, getallen en keuzelijsten op elkaar lijken. */
export function inputClass(invalid: boolean, className?: string): string {
  return cn(
    'w-full rounded-md border bg-white px-3 py-2 text-sm text-slate-900 shadow-xs transition',
    'placeholder:text-slate-400 focus:outline-2 focus:outline-offset-1',
    invalid
      ? 'border-red-400 focus:outline-red-600'
      : 'border-slate-300 hover:border-slate-400 focus:outline-blue-700',
    className,
  );
}

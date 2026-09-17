import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface CardProps {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Card({ title, description, actions, className, children }: CardProps) {
  return (
    <section className={cn('rounded-lg border border-slate-200 bg-white p-5 shadow-xs', className)}>
      {(title !== undefined || actions !== undefined) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title !== undefined && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
            {description !== undefined && <p className="mt-1 text-sm text-slate-600">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

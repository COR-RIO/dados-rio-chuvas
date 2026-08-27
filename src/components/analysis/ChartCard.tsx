import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
  action?: ReactNode;
}

/** Cartão padrão das seções do dashboard institucional (título + conteúdo). */
export function ChartCard({ title, subtitle, className, children, action }: ChartCardProps) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className ?? ''}`}
    >
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

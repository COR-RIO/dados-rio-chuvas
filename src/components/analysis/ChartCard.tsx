import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
  action?: ReactNode;
  /** Versão escura (fundo azul-marinho) para gráficos de destaque. */
  dark?: boolean;
}

/** Cartão padrão das seções do dashboard institucional (título + conteúdo). */
export function ChartCard({ title, subtitle, className, children, action, dark }: ChartCardProps) {
  return (
    <section
      className={`rounded-2xl border shadow-sm ${
        dark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
      } ${className ?? ''}`}
    >
      <header
        className={`flex items-start justify-between gap-3 border-b px-4 py-3 ${
          dark ? 'border-slate-800' : 'border-slate-100'
        }`}
      >
        <div className="min-w-0">
          <h3 className={`text-sm font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>{title}</h3>
          {subtitle && (
            <p className={`mt-0.5 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{subtitle}</p>
          )}
        </div>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

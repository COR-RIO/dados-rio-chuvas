import type { ReactNode } from 'react';

type Accent = 'sky' | 'blue' | 'amber' | 'rose' | 'emerald' | 'violet';

interface KpiCardProps {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  icon?: ReactNode;
  accent?: Accent;
}

const ACCENTS: Record<Accent, string> = {
  sky: 'bg-sky-50 text-sky-700',
  blue: 'bg-blue-50 text-blue-700',
  amber: 'bg-amber-50 text-amber-700',
  rose: 'bg-rose-50 text-rose-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  violet: 'bg-violet-50 text-violet-700',
};

/** Cartão de indicador-chave (KPI) para o dashboard institucional. */
export function KpiCard({ label, value, unit, hint, icon, accent = 'sky' }: KpiCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {icon && (
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${ACCENTS[accent]}`}>
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-extrabold text-slate-900">
        {value}
        {unit && <span className="ml-1 text-sm font-semibold text-slate-400">{unit}</span>}
      </p>
      {hint && (
        <p className="mt-1 truncate text-xs text-slate-500" title={hint}>
          {hint}
        </p>
      )}
    </div>
  );
}

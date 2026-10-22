import { ArrowUp } from 'lucide-react';
import type { ForecastSlot } from '../services/forecastModelsApi';
import { dayLabel, fmtMm, gustClass, isPast, rainClass, slotKey } from '../utils/forecastFormat';

function WindArrow({ deg }: { deg: number | null }) {
  if (deg == null) return null;
  // Direção meteorológica = de onde o vento vem; a seta aponta para onde ele vai.
  return <ArrowUp className="inline h-3 w-3 shrink-0" style={{ transform: `rotate(${deg + 180}deg)` }} />;
}

/** Faixa de um modelo no formato do "Comparar previsões" do Windy: hora, °C, chuva, vento e
 * rajada em blocos de 3 h. `highlight` destaca os blocos da janela exibida no mapa. */
export function ModelStrip({
  label,
  color,
  slots,
  now,
  highlight,
}: {
  label: string;
  color: string;
  slots: ForecastSlot[];
  now: { date: string; hour: number };
  highlight?: Set<string>;
}) {
  const visible = slots.filter((s) => !isPast(s, now));
  const hl = (s: ForecastSlot) => (highlight?.has(slotKey(s)) ? 'bg-indigo-50' : '');
  const rowLabel = 'sticky left-0 z-10 bg-white pr-2 text-right text-[10px] font-semibold uppercase text-slate-400';

  return (
    <div>
      <p className="mb-1 text-xs font-extrabold" style={{ color }}>
        {label}
      </p>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="border-collapse text-[11px] tabular-nums">
          <tbody>
            <tr>
              <td className={rowLabel}>Dia</td>
              {visible.map((s, i) => {
                const newDay = i === 0 || visible[i - 1].date !== s.date;
                return (
                  <td
                    key={slotKey(s)}
                    className={`px-1.5 pt-1 text-left text-[10px] font-bold text-slate-500 ${hl(s)} ${newDay && i > 0 ? 'border-l border-slate-300' : ''}`}
                  >
                    {newDay ? dayLabel(s.date) : ''}
                  </td>
                );
              })}
            </tr>
            {(
              [
                ['Hora', (s: ForecastSlot) => <span className="text-slate-500">{String(s.hour).padStart(2, '0')}</span>],
                ['°C', (s: ForecastSlot) => (s.tempC == null ? '' : `${s.tempC}°`)],
                [
                  'mm',
                  (s: ForecastSlot) =>
                    s.rainMm == null ? (
                      <span className="text-amber-600" title="Sem dado do modelo para este horário">
                        –
                      </span>
                    ) : s.rainMm > 0 ? (
                      <span className={`rounded px-1 font-bold ${rainClass(s.rainMm)}`}>{fmtMm(s.rainMm)}</span>
                    ) : (
                      ''
                    ),
                ],
                [
                  'Vento km/h',
                  (s: ForecastSlot) =>
                    s.windKmh == null ? (
                      ''
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-slate-600">
                        <WindArrow deg={s.windDirDeg} />
                        {s.windKmh}
                      </span>
                    ),
                ],
                [
                  'Rajada km/h',
                  (s: ForecastSlot) =>
                    s.gustKmh == null ? (
                      <span className="text-slate-300">–</span>
                    ) : (
                      <span className={gustClass(s.gustKmh)}>
                        {s.gustKmh}
                      </span>
                    ),
                ],
              ] as const
            ).map(([name, render]) => (
              <tr key={name}>
                <td className={rowLabel}>{name}</td>
                {visible.map((s, i) => {
                  const newDay = i > 0 && visible[i - 1].date !== s.date;
                  return (
                    <td
                      key={slotKey(s)}
                      className={`min-w-[38px] px-1.5 py-1 text-center ${hl(s)} ${newDay ? 'border-l border-slate-300' : ''}`}
                    >
                      {render(s)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

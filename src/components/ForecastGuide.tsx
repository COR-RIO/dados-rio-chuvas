import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { accumulatedRainLevels } from '../utils/rainLevel';
import { GUST_ALERT_KMH, gustClass, rainClass } from '../utils/forecastFormat';
import { WIND_CATEGORY_COLORS, WIND_CATEGORY_LABELS, WIND_CATEGORY_ORDER, WIND_CATEGORY_RANGES } from '../types/wind';

/** Blocos de 3 h: limites de rainClass (forecastFormat.ts). */
const BLOCK_SAMPLES: { mm: number; label: string }[] = [
  { mm: 1, label: '1 mm ou mais' },
  { mm: 5, label: '5 mm ou mais' },
  { mm: 10, label: '10 mm ou mais' },
  { mm: 25, label: '25 mm ou mais' },
];

const MODEL_NOTES: { name: string; text: string }[] = [
  { name: 'ECMWF', text: 'Europa, 9 km, nova rodada a cada 6 h. Referência global, costuma ser o mais consistente.' },
  { name: 'meteoblue', text: 'Suíça, multimodelo (o mesmo do Windy), atualiza de hora em hora. Rajada de 3 em 3 h; usa créditos pagos.' },
  { name: 'GFS', text: 'EUA, 13–25 km, a cada 6 h. Tende a exagerar pancadas (chuva convectiva).' },
  { name: 'ICON', text: 'Alemanha, 13 km, a cada 3 h.' },
  { name: 'ECMWF AIFS', text: 'Modelo de IA, 25 km. Só na aba Previsão; não traz rajada e fica fora do Máximo.' },
];

const Swatch = ({ color }: { color: string }) => (
  <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-sm border border-black/10" style={{ background: color }} />
);

/** Legenda + guia de leitura e análise da previsão dos modelos — mesmo formato da "Legenda e
 * explicações do mapa" (quadro de cores à esquerda, tópicos à direita). */
export function ForecastGuide({ defaultOpen = true }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-3 py-4 shadow-sm sm:px-4 sm:py-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-gray-800 sm:text-base">Guia da previsão — como ler e analisar chuva e vento</h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 sm:text-sm"
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {open ? 'Ocultar guia' : 'Mostrar guia'}
        </button>
      </div>

      {open && (
        <div className="mt-3 flex flex-wrap items-start gap-4 sm:mt-4 sm:gap-6">
          {/* Quadro de legenda */}
          <div className="w-full shrink-0 space-y-3 rounded-lg border border-gray-200 bg-gray-50/80 p-3 text-xs text-gray-700 sm:w-auto sm:p-4">
            <div>
              <p className="text-sm font-semibold text-gray-800">Etiqueta no mapa</p>
              <p className="mb-1.5 text-[10px] text-gray-500">Chuva acumulada na janela escolhida (3, 6, 12 ou 24 h).</p>
              <ul className="space-y-1">
                {accumulatedRainLevels.map((l) => (
                  <li key={l.name} className="flex items-center gap-2">
                    <Swatch color={l.color} />
                    <span className="capitalize">{l.name}</span>
                    <span className="text-gray-500">({l.description})</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-gray-200 pt-3">
              <p className="mb-1.5 font-semibold text-gray-800">Blocos de 3 h (tabelas e faixas)</p>
              <ul className="space-y-1">
                {BLOCK_SAMPLES.map((b) => (
                  <li key={b.mm} className="flex items-center gap-2">
                    <span className={`w-9 rounded px-1 text-center font-bold ${rainClass(b.mm)}`}>{b.mm}</span>
                    <span>{b.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-gray-200 pt-3">
              <p className="mb-1.5 font-semibold text-gray-800">Rajada prevista (km/h)</p>
              <ul className="space-y-1">
                <li><span className={gustClass(20)}>abaixo de {GUST_ALERT_KMH}</span> — sem destaque</li>
                <li><span className={gustClass(GUST_ALERT_KMH)}>{GUST_ALERT_KMH} a 54</span> — atenção (aparece na etiqueta)</li>
                <li><span className={gustClass(55)}>55 ou mais</span> — rajada forte</li>
              </ul>
              <p className="mt-2 mb-1 text-[10px] text-gray-500">Categorias oficiais de vento:</p>
              <ul className="space-y-1">
                {WIND_CATEGORY_ORDER.map((c) => (
                  <li key={c} className="flex items-center gap-2">
                    <Swatch color={WIND_CATEGORY_COLORS[c]} />
                    <span>{WIND_CATEGORY_LABELS[c]}</span>
                    <span className="text-gray-500">({WIND_CATEGORY_RANGES[c].kmh})</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-gray-200 pt-3">
              <p className="mb-1.5 font-semibold text-gray-800">Estados especiais</p>
              <ul className="space-y-1">
                <li><b>0</b> — modelo prevê que não chove (mouse: quando começa)</li>
                <li><b>4,2*</b> — total parcial, faltam blocos de 3 h</li>
                <li><i className="text-amber-700">sem dados</i> — modelo não trouxe o período</li>
              </ul>
            </div>
          </div>

          {/* Explicações */}
          <div className="min-w-0 flex-1 space-y-3 text-xs text-gray-600">
            <div className="space-y-1">
              <p>• <strong>Bloco de 3 h:</strong> o horário é o <strong>fim</strong> do bloco. "15h · 1,2 mm · 63 km/h" = 1,2 mm entre 12h e 15h, rajada máxima de 63 km/h no intervalo (mesma leitura do Windy).</p>
              <p>• <strong>Janela (3/6/12/24 h):</strong> soma dos próximos blocos a partir do bloco em andamento. O período exato aparece no topo do painel e fica destacado em lilás nas faixas.</p>
              <p>• <strong>Etiqueta tracejada</strong> = previsão; <strong>bolinha cheia</strong> = chuva observada nas estações. Vento e rajada sempre em km/h (o Windy usa nós: 1 kt = 1,852 km/h).</p>
            </div>

            <div className="space-y-1">
              <p>• <strong>Modo Máximo (padrão do mapa):</strong> número principal = <strong>maior acumulado</strong> entre os modelos (cenário mais pessimista) e a maior rajada; segunda linha = <strong>qual modelo</strong> previu esse máximo.</p>
              <p>• <strong>O máximo pode vir de um único modelo exagerando</strong> (ex.: GFS em pancadas): clicar na etiqueta para comparar os modelos antes de decidir.</p>
            </div>

            <div className="space-y-1">
              <p className="font-semibold text-gray-700">Roteiro do plantão:</p>
              <ol className="list-decimal space-y-0.5 pl-5">
                <li>Ver o mapa em <strong>Máximo · 24 h</strong> para o panorama da cidade (pior cenário).</li>
                <li>Nos pontos com máximo ≥ 5 mm, clicar na etiqueta e comparar os modelos.</li>
                <li>Reduzir a janela (12 → 6 → 3 h) para localizar quando a chuva começa e o pico.</li>
                <li>Conferir a rajada: a partir de {GUST_ALERT_KMH} km/h ela aparece na etiqueta; 52 km/h ou mais já é vento forte pela categoria oficial.</li>
                <li>Cruzar com radar e estações (observado) antes de decidir.</li>
                <li>Reavaliar a cada nova rodada (ECMWF/GFS a cada 6 h; o app atualiza sozinho a cada 30 min).</li>
              </ol>
            </div>

            <div className="space-y-1">
              <p className="font-semibold text-gray-700">Modelos:</p>
              {MODEL_NOTES.map((m) => (
                <p key={m.name}>• <strong>{m.name}:</strong> {m.text}</p>
              ))}
            </div>

            <div className="space-y-1">
              <p>• <strong>Avisos:</strong> "indisponível" = a fonte falhou (ex.: créditos do meteoblue, Open-Meteo sobrecarregado) — os outros modelos seguem válidos. "Falha ao atualizar" = a tela mantém a última previsão boa e mostra o horário dela.</p>
              <p>• <strong>Limitações:</strong> o valor é o da célula do modelo (9–25 km) mais próxima do ponto, não do bairro; pancadas isoladas e chuva orográfica localizada podem não aparecer. Previsão não substitui o observado.</p>
              <p>• <strong>Fontes:</strong> ECMWF, NOAA GFS e DWD ICON via Open-Meteo; meteoblue via API própria. Critérios de chuva observada: Alerta Rio.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { Map, Layers, Hexagon, Route, Clock3, CalendarDays, Timer, BarChart3, AlertTriangle, Maximize2, Upload, X } from 'lucide-react';
import { MAP_TYPES, type BoundsGeoJson, type MapDataWindow, type HistoricalViewMode, type MapTypeId } from './mapControlTypes';
import { getInfluenceLegendItems } from '../utils/influenceTheme';
import { rainLevels } from '../utils/rainLevel';

interface MapLayersProps {
  value: MapTypeId;
  onChange: (id: MapTypeId) => void;
}

const controlBoxClass = 'bg-white/95 backdrop-blur rounded-lg shadow-md border border-gray-200 p-2 min-w-0 shrink-0';

export const MapLayers: React.FC<MapLayersProps> = ({ value, onChange }) => {
  return (
    <div className={controlBoxClass} style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-700">
        <Layers className="w-3.5 h-3.5" />
        Tipo de mapa
      </div>
      <div className="flex flex-col gap-1">
        {MAP_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`px-2.5 py-1.5 rounded text-left text-xs font-medium transition-colors ${
              value === t.id
                ? 'bg-yellow-500 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
};

interface HexagonLayerToggleProps {
  value: boolean;
  onChange: (show: boolean) => void;
}

/** Controle para mostrar ou ocultar a camada de hexágonos (área de influência) no mapa. */
export const HexagonLayerToggle: React.FC<HexagonLayerToggleProps> = ({ value, onChange }) => {
  return (
    <div className={controlBoxClass} style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-700">
        <Hexagon className="w-3.5 h-3.5" />
        Hexágonos
      </div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`px-2.5 py-1.5 rounded text-left text-xs font-medium transition-colors ${
            value ? 'bg-yellow-500 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Sim
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`px-2.5 py-1.5 rounded text-left text-xs font-medium transition-colors ${
            !value ? 'bg-yellow-500 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Não
        </button>
      </div>
    </div>
  );
};

interface InfluenceLinesToggleProps {
  value: boolean;
  onChange: (show: boolean) => void;
}

/** Exibe ou oculta as zonas do arquivo zonas-pluviometricas.geojson (linhas em azul que dividem a área de cada pluviômetro). Ocultar evita confusão com os bairros do Rio. */
export const InfluenceLinesToggle: React.FC<InfluenceLinesToggleProps> = ({ value, onChange }) => {
  return (
    <div className={controlBoxClass} style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-700" title="Zonas dos pluviômetros (zonas-pluviometricas.geojson). Ocultar para não confundir com bairros (Ipanema, Copacabana, etc.).">
        <Route className="w-3.5 h-3.5" />
        Linhas de influência
      </div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => onChange(true)}
          title="Mostrar as zonas dos pluviômetros (linhas em azul)"
          className={`px-2.5 py-1.5 rounded text-left text-xs font-medium transition-colors ${
            value ? 'bg-yellow-500 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Sim
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          title="Ocultar as zonas dos pluviômetros (evita confusão com bairros)"
          className={`px-2.5 py-1.5 rounded text-left text-xs font-medium transition-colors ${
            !value ? 'bg-yellow-500 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Não
        </button>
      </div>
    </div>
  );
};

interface OccurrencesToggleProps {
  value: boolean;
  onChange: (show: boolean) => void;
}

interface ResizableToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
}

/** Controle para mostrar ou ocultar os marcadores de ocorrências no mapa. */
export const OccurrencesToggle: React.FC<OccurrencesToggleProps> = ({ value, onChange }) => {
  return (
    <div className={controlBoxClass} style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-700" title="Ocorrências georreferenciadas associadas a chuvas fortes.">
        <AlertTriangle className="w-3.5 h-3.5" />
        Ocorrências no mapa
      </div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`px-2.5 py-1.5 rounded text-left text-xs font-medium transition-colors ${
            value ? 'bg-red-500 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Mostrar
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`px-2.5 py-1.5 rounded text-left text-xs font-medium transition-colors ${
            !value ? 'bg-red-500 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Ocultar
        </button>
      </div>
    </div>
  );
};

export type OccurrenceDataSource = 'api' | 'planilha';

interface OccurrenceSourceSelectorProps {
  value: OccurrenceDataSource;
  onChange: (source: OccurrenceDataSource) => void;
}

/** Fonte dos dados de ocorrências no modo histórico: API Hexagon ou planilha. Em tempo real usa sempre ocorrências abertas (Simaa). */
export const OccurrenceSourceSelector: React.FC<OccurrenceSourceSelectorProps> = ({ value, onChange }) => {
  return (
    <div className={controlBoxClass} style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-700" title="No histórico: de onde vêm os dados de ocorrências.">
        <AlertTriangle className="w-3.5 h-3.5" />
        Fonte (histórico)
      </div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => onChange('api')}
          className={`px-2.5 py-1.5 rounded text-left text-xs font-medium transition-colors ${
            value === 'api' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          title="Hexagon por período (login)"
        >
          API
        </button>
        <button
          type="button"
          onClick={() => onChange('planilha')}
          className={`px-2.5 py-1.5 rounded text-left text-xs font-medium transition-colors ${
            value === 'planilha' ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          title="Planilha do site ou arquivo .xlsx carregado"
        >
          Planilha
        </button>
      </div>
    </div>
  );
};

interface OccurrencePlanilhaUploadProps {
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadedFileName: string | null;
  onClearUpload: () => void;
  uploadError: string | null;
  geocoding: boolean;
  geocodeProgress: string | null;
}

/** Carregar ocorrências a partir de um .xlsx (formato Relação de Ocorrências / Prefeitura). */
export const OccurrencePlanilhaUpload: React.FC<OccurrencePlanilhaUploadProps> = ({
  onFileChange,
  uploadedFileName,
  onClearUpload,
  uploadError,
  geocoding,
  geocodeProgress,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className={controlBoxClass} style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-700" title="Substitui a planilha padrão do site pelos dados do arquivo.">
        <Upload className="w-3.5 h-3.5 shrink-0" />
        Arquivo Excel
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={onFileChange}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={geocoding}
        className="w-full rounded border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-left text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
      >
        {geocoding ? 'Processando…' : 'Carregar planilha (.xlsx)'}
      </button>
      {uploadedFileName && (
        <div className="mt-1.5 flex items-start justify-between gap-1">
          <span className="text-[10px] text-gray-700 break-words min-w-0" title={uploadedFileName}>
            Em uso: {uploadedFileName}
          </span>
          <button
            type="button"
            onClick={onClearUpload}
            disabled={geocoding}
            className="shrink-0 p-0.5 rounded text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50"
            title="Voltar à planilha padrão do site"
            aria-label="Remover arquivo carregado"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {geocoding && (
        <p className="text-[10px] text-blue-700 mt-1" aria-live="polite">
          Buscando coordenadas no mapa…{geocodeProgress ? ` (${geocodeProgress})` : ''}
        </p>
      )}
      {uploadError && (
        <p className="text-[10px] text-red-600 font-medium mt-1" role="alert">
          {uploadError}
        </p>
      )}
      <p className="text-[9px] text-gray-500 mt-1.5 leading-snug">
        Use arquivo Excel .xlsx (nao .docx), preferencialmente no formato "Relacao de Ocorrencias Finalizadas" com Lat/Long.
      </p>
    </div>
  );
};

export const ResizableToggle: React.FC<ResizableToggleProps> = ({ value, onChange }) => {
  return (
    <div className={controlBoxClass} style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-700" title="Ativa largura ajustável para o painel de ocorrências (fixo à direita).">
        <Maximize2 className="w-3.5 h-3.5" />
        Tabela redimensionável
      </div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`px-2.5 py-1.5 rounded text-left text-xs font-medium transition-colors ${
            value ? 'bg-yellow-500 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Sim
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`px-2.5 py-1.5 rounded text-left text-xs font-medium transition-colors ${
            !value ? 'bg-yellow-500 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Não
        </button>
      </div>
    </div>
  );
};
interface MapDataWindowToggleProps {
  value: MapDataWindow;
  onChange: (v: MapDataWindow) => void;
}

/** Toggle para escolher quais dados ver no mapa: 15 min, 1 hora ou ambos. */
export const MapDataWindowToggle: React.FC<MapDataWindowToggleProps> = ({ value, onChange }) => {
  return (
    <div className={controlBoxClass} style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-700">
        <Timer className="w-3.5 h-3.5" />
        Dados no mapa
      </div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => onChange('15min')}
          className={`px-2.5 py-1.5 rounded text-left text-xs font-medium transition-colors ${
            value === '15min' ? 'bg-yellow-500 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          title="Hexágonos e bolinhas pelo acumulado de 15 min"
        >
          15 min
        </button>
        <button
          type="button"
          onClick={() => onChange('1h')}
          className={`px-2.5 py-1.5 rounded text-left text-xs font-medium transition-colors ${
            value === '1h' ? 'bg-yellow-500 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          title="Hexágonos e bolinhas pelo acumulado de 1 hora"
        >
          1 hora
        </button>
        <button
          type="button"
          onClick={() => onChange('both')}
          className={`px-2.5 py-1.5 rounded text-left text-xs font-medium transition-colors ${
            value === 'both' ? 'bg-yellow-500 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          title="Zonas = critério 15 min; bolinhas = critério 1 h"
        >
          Ambos
        </button>
      </div>
      {value === 'both' && (
        <p className="mt-1.5 text-[10px] text-gray-500 leading-tight">
          Zonas: 15 min. Bolinhas: 1 h.
        </p>
      )}
    </div>
  );
};

/** Legenda compacta do critério em uso (15 min, 1 h ou ambos) conforme "Dados no mapa". */
interface MapDataWindowLegendProps {
  value: MapDataWindow;
}

const legendBoxClass = 'bg-white/95 backdrop-blur rounded-lg shadow-md border border-gray-200 p-2 min-w-0 shrink-0';

export const MapDataWindowLegend: React.FC<MapDataWindowLegendProps> = ({ value }) => {
  const items15 = getInfluenceLegendItems();
  const items1h = rainLevels.map((l, i) => ({ value: i as 0 | 1 | 2 | 3 | 4, label: `${l.name} (${l.description})`, color: l.color }));

  const renderStrip = (title: string, items: Array<{ value: number; label: string; color: string }>) => (
    <div className="mb-1 last:mb-0">
      <div className="text-[10px] font-semibold text-gray-600 mb-1">{title}</div>
      <div className="flex flex-col gap-0.5">
        {items.map(({ value: v, label, color }) => (
          <div key={v} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded flex-shrink-0 border border-white shadow-sm" style={{ backgroundColor: color }} />
            <span className="text-[9px] text-gray-700 truncate" title={label}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className={legendBoxClass} style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="flex items-center gap-1.5 mb-1.5 text-xs font-semibold text-gray-700">
        <BarChart3 className="w-3.5 h-3.5" />
        Legenda
      </div>
      {value === '15min' && renderStrip('Critério 15 min (zonas e bolinhas)', items15)}
      {value === '1h' && renderStrip('Critério 1 h (zonas e bolinhas)', items1h)}
      {value === 'both' && (
        <>
          {renderStrip('Zonas: 15 min', items15)}
          {renderStrip('Bolinhas: 1 h', items1h)}
        </>
      )}
    </div>
  );
};

interface HistoricalViewModeToggleProps {
  value: HistoricalViewMode;
  onChange: (v: HistoricalViewMode) => void;
  /** Só exibe quando há estações com acumulado no período */
  hasAccumulated?: boolean;
}

/** Toggle para modo histórico: instantâneo (snapshot no horário) ou acumulado no período. Sempre visível no modo histórico para poder escolher e definir De/Até. */
export const HistoricalViewModeToggle: React.FC<HistoricalViewModeToggleProps> = ({
  value,
  onChange,
  hasAccumulated: _hasAccumulated = true,
}) => {
  return (
    <div className={controlBoxClass} style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-700">
        <BarChart3 className="w-3.5 h-3.5" />
        Vista (histórico)
      </div>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => onChange('instant')}
          className={`px-2.5 py-1.5 rounded text-left text-xs font-medium transition-colors ${
            value === 'instant' ? 'bg-blue-500 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          title="Valores no horário selecionado do timeline"
        >
          Instantâneo
        </button>
        <button
          type="button"
          onClick={() => onChange('accumulated')}
          className={`px-2.5 py-1.5 rounded text-left text-xs font-medium transition-colors ${
            value === 'accumulated' ? 'bg-blue-500 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          title="Soma de chuva no período (De + Até)"
        >
          Acumulado no período
        </button>
      </div>
    </div>
  );
};

interface TimeWindowControlProps {
  value: number;
  onChange: (minutes: number) => void;
}

/** Filtro temporal do mapa (5 a 60 minutos) para bolinhas e hexágonos. */
export const TimeWindowControl: React.FC<TimeWindowControlProps> = ({ value, onChange }) => {
  return (
    <div className={controlBoxClass} style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-700">
        <Clock3 className="w-3.5 h-3.5" />
        Janela de tempo
      </div>
      <input
        type="range"
        min={5}
        max={60}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-yellow-500 cursor-pointer"
      />
      <div className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
        <span>5m</span>
        <span className="font-semibold text-gray-700">{value}m</span>
        <span>60m</span>
      </div>
      <div className="mt-1 text-[10px] text-gray-500">Base oficial: 5min, 15min e 1h (AlertaRio)</div>
    </div>
  );
};

interface HistoricalTimelineControlProps {
  enabled: boolean;
  dateValue: string;
  onDateChange: (date: string) => void;
  /** Data fim do intervalo (ex.: 10/02/2026). De + Até = período para buscar dados e acumulado */
  dateToValue?: string;
  onDateToChange?: (date: string) => void;
  /** Filtro de horário (baseado em dia_original do BD Nimbus). Formato HH:mm */
  timeFrom?: string;
  timeTo?: string;
  onTimeFromChange?: (time: string) => void;
  onTimeToChange?: (time: string) => void;
  timeline: string[];
  selectedTimestamp: string | null;
  onTimestampChange: (timestamp: string) => void;
  /** Ao clicar em "Aplicar", busca dados com o intervalo atual (evita buscar a cada mudança de campo) */
  onApplyFilter?: () => void;
  /** Exibe "Buscando..." ao lado do botão enquanto carrega */
  refreshing?: boolean;
  /** Carregando ocorrências da API (quando "Mostrar ocorrências" + Aplicar) */
  occurrenceLoading?: boolean;
  /** Erro ao carregar ocorrências (ex.: falha de login na API) */
  occurrenceError?: string | null;
  /** Quando "accumulated", mostra o intervalo em vez do slider de snapshot */
  viewMode?: 'instant' | 'accumulated';
  /** No modo instantâneo: horário desejado (HH:mm). Só aplicado ao clicar em Aplicar. */
  desiredAnalysisTime?: string;
  onDesiredAnalysisTimeChange?: (time: string) => void;
  /** Em tempo real: mostrar botão para carregar ocorrências do dia (hoje) da API */
  showOccurrencesLoadInRealtime?: boolean;
}

/** Retorna HH:mm a partir de um timestamp ISO. */
function timeFromIso(isoTs: string): string {
  const d = new Date(isoTs);
  if (Number.isNaN(d.getTime())) return '00:00';
  const h = d.getHours();
  const m = d.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Controle de histórico: seleciona data e horário (timeline) quando o modo histórico está ativo.
 */
export const HistoricalTimelineControl: React.FC<HistoricalTimelineControlProps> = ({
  enabled,
  dateValue,
  onDateChange,
  dateToValue,
  onDateToChange,
  timeFrom = '00:00',
  timeTo = '23:59',
  onTimeFromChange,
  onTimeToChange,
  timeline,
  selectedTimestamp,
  onTimestampChange: _onTimestampChange,
  onApplyFilter,
  refreshing = false,
  occurrenceLoading = false,
  occurrenceError = null,
  viewMode = 'instant',
  desiredAnalysisTime,
  onDesiredAnalysisTimeChange,
  showOccurrencesLoadInRealtime = false,
}) => {
  const selectedIndex = selectedTimestamp ? timeline.indexOf(selectedTimestamp) : -1;
  const safeIndex = selectedIndex >= 0 ? selectedIndex : Math.max(0, timeline.length - 1);
  const currentTs = timeline[safeIndex] ?? null;
  const hasRange = dateToValue && dateToValue !== dateValue;

  const isAccumulatedView = viewMode === 'accumulated';
  const formatDateBr = (yyyyMmDd: string) => {
    const [y, m, d] = yyyyMmDd.split('-');
    return d && m && y ? `${d}/${m}/${y}` : yyyyMmDd;
  };
  const intervalLabel = (() => {
    const dFrom = dateValue;
    const dTo = dateToValue ?? dateValue;
    const tFrom = timeFrom ?? '00:00';
    const tTo = timeTo ?? '23:59';
    if (dFrom === dTo && tFrom === '00:00' && tTo === '23:59') return `${formatDateBr(dFrom)} (dia inteiro)`;
    return `${formatDateBr(dFrom)} ${tFrom} a ${formatDateBr(dTo)} ${tTo}`;
  })();
  const intervalHoursLabel = (() => {
    try {
      const [hF, mF] = (timeFrom ?? '00:00').split(':').map(Number);
      const [hT, mT] = (timeTo ?? '23:59').split(':').map(Number);
      const [yF, moF, dF] = dateValue.split('-').map(Number);
      const [yT, moT, dT] = (dateToValue ?? dateValue).split('-').map(Number);
      const start = new Date(yF, moF - 1, dF, hF, mF || 0, 0).getTime();
      const end = new Date(yT, moT - 1, dT, hT, mT || 0, 0).getTime();
      const hours = (end - start) / (60 * 60 * 1000);
      if (hours < 1) return `${Math.round(hours * 60)} min`;
      const h = Math.floor(hours);
      const m = Math.round((hours - h) * 60);
      return m > 0 ? `${h}h ${m}min` : `${h}h`;
    } catch {
      return null;
    }
  })();

  return (
    <div className={controlBoxClass} style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-700">
        <CalendarDays className="w-3.5 h-3.5 shrink-0" />
        Histórico (GCP)
      </div>

      <div className="text-[10px] text-gray-500 mb-2 space-y-0.5">
        {isAccumulatedView ? (
          <>
            <p>Acumulado: use De e Até para o intervalo.</p>
            <p>Ex.: 09/02/2026 até 10/02/2026 → Aplicar.</p>
          </>
        ) : (
          <>
            <p>Instantâneo: uma data + horário abaixo.</p>
            <p>Intervalo De/Até só no modo Acumulado.</p>
          </>
        )}
      </div>

      <div className="space-y-2">
        <div>
          <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
            {isAccumulatedView ? 'De (data)' : 'Data'}
          </label>
          <input
            type="date"
            value={dateValue}
            onChange={(e) => {
              const v = e.target.value;
              onDateChange(v);
              if (!isAccumulatedView) onDateToChange?.(v);
            }}
            disabled={!enabled}
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-700 disabled:bg-gray-100 disabled:text-gray-400"
          />
        </div>
        {isAccumulatedView && (
          <>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-0.5">Até (data)</label>
              <input
                type="date"
                value={dateToValue ?? dateValue}
                onChange={(e) => onDateToChange?.(e.target.value)}
                disabled={!enabled}
                min={dateValue}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-700 disabled:bg-gray-100 disabled:text-gray-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-0.5">Horário (de)</label>
                <input
                  type="time"
                  value={timeFrom}
                  onChange={(e) => onTimeFromChange?.(e.target.value)}
                  disabled={!enabled}
                  className="w-full rounded border border-gray-300 px-1.5 py-1 text-xs text-gray-700 disabled:bg-gray-100 disabled:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-0.5">Horário (até)</label>
                <input
                  type="time"
                  value={timeTo}
                  onChange={(e) => onTimeToChange?.(e.target.value)}
                  disabled={!enabled}
                  className="w-full rounded border border-gray-300 px-1.5 py-1 text-xs text-gray-700 disabled:bg-gray-100 disabled:text-gray-400"
                />
              </div>
            </div>
          </>
        )}
      </div>
      {hasRange && isAccumulatedView && (
        <div className="mt-2 text-[10px] text-gray-500">
          Período: {dateValue} a {dateToValue}
        </div>
      )}

      {enabled && onApplyFilter && (
        <div className="mt-3 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onApplyFilter}
              disabled={refreshing || occurrenceLoading}
              className="flex-1 rounded bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {refreshing ? 'Buscando…' : occurrenceLoading ? 'Buscando ocorrências…' : 'Aplicar'}
            </button>
          </div>
          {(refreshing || occurrenceLoading) && (
            <span className="text-[10px] text-gray-500">
              {refreshing && occurrenceLoading ? 'Dados e ocorrências…' : refreshing ? 'Atualizando dados…' : 'Carregando ocorrências da API…'}
            </span>
          )}
          {occurrenceError && (
            <p className="text-[10px] text-red-600 font-medium" role="alert">{occurrenceError}</p>
          )}
        </div>
      )}

      {!enabled && showOccurrencesLoadInRealtime && onApplyFilter && (
        <div className="mt-3 flex flex-col gap-1.5">
          <p className="text-[10px] text-gray-500">Tempo real: carregar ocorrências de hoje da API.</p>
          <button
            type="button"
            onClick={onApplyFilter}
            disabled={refreshing || occurrenceLoading}
            className="w-full rounded bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {occurrenceLoading ? 'Carregando…' : 'Carregar ocorrências (hoje)'}
          </button>
          {occurrenceError && (
            <p className="text-[10px] text-red-600 font-medium" role="alert">{occurrenceError}</p>
          )}
        </div>
      )}

      {!enabled && !showOccurrencesLoadInRealtime && (
        <div className="mt-2 text-[10px] text-gray-500">
          Ative o modo &quot;Histórico&quot; no topo para usar datas e acumulado.
        </div>
      )}

      {enabled && isAccumulatedView && (
        <div className="mt-3 rounded bg-blue-50 border border-blue-200 px-2.5 py-2">
          <p className="text-[11px] font-semibold text-blue-800">Acumulado no período</p>
          <p className="mt-0.5 text-[10px] text-blue-700">O intervalo De (data) até Até (data) acima só aparece e funciona neste modo.</p>
          <p className="mt-0.5 text-[10px] text-blue-700">{intervalLabel}</p>
          {intervalHoursLabel != null && (
            <p className="mt-0.5 text-[10px] text-blue-600 font-medium">Intervalo: {intervalHoursLabel}</p>
          )}
          <p className="mt-1 text-[10px] text-blue-600/90">Valores no mapa e na tabela referem-se a este período, não ao último horário.</p>
        </div>
      )}

      {enabled && !isAccumulatedView && (
        <div className="mt-3">
          <p className="text-[10px] text-gray-500 mb-2">Momento fixo: data + horário. Vale ao clicar em Aplicar.</p>
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-0.5">Horário (de)</label>
            <input
              type="time"
              value={desiredAnalysisTime ?? (currentTs ? timeFromIso(currentTs) : '00:00')}
              onChange={(e) => onDesiredAnalysisTimeChange?.(e.target.value)}
              disabled={!enabled}
              className="w-full rounded border border-gray-300 px-1.5 py-1 text-xs text-gray-700 disabled:bg-gray-100 disabled:text-gray-400"
            />
          </div>
          {timeline.length > 0 ? (
            <div className="mt-1 text-[10px] text-gray-500">
              {timeline.length} horários no período
            </div>
          ) : (
            <div className="mt-1 text-[10px] text-gray-500">
              Data + horário → Aplicar para carregar.
            </div>
          )}
        </div>
      )}

      {enabled && timeline.length === 0 && (
        <div className="mt-2 text-[10px] text-gray-500">
          Sem horários para esta data.
        </div>
      )}
    </div>
  );
};

const BAIRROS_BOUNDS_PROPS: L.FitBoundsOptions = { padding: [24, 24], maxZoom: 12 };

function boundsFromBairros(bairrosData: { features: Array<{ geometry: { type?: string; coordinates: number[][] | number[][][] | number[][][][] } }> }): L.LatLngBounds | null {
  if (!bairrosData?.features?.length) return null;
  const points: [number, number][] = [];
  const features = Array.isArray(bairrosData.features) ? bairrosData.features : [];
  for (const f of features) {
    const coords = f.geometry?.coordinates;
    if (!coords || !Array.isArray(coords) || coords.length === 0) continue;
    // Polygon: coordinates[0] = anel (array de [lng, lat])
    // MultiPolygon: coordinates[0][0] = anel do primeiro polígono
    const first = coords[0];
    if (first == null) continue;
    let ring: number[][] | undefined;
    if (Array.isArray(first) && first.length > 0) {
      const firstEl = first[0];
      if (Array.isArray(firstEl) && typeof firstEl[0] === 'number') {
        ring = first as number[][]; // Polygon: first já é o anel
      } else if (Array.isArray(firstEl) && Array.isArray(firstEl[0])) {
        ring = first[0] as number[][]; // MultiPolygon: first[0] é o anel
      }
    }
    if (!ring || !Array.isArray(ring) || ring.length === 0) continue;
    for (const pt of ring) {
      if (Array.isArray(pt) && pt.length >= 2 && typeof pt[0] === 'number' && typeof pt[1] === 'number') {
        points.push([pt[1], pt[0]]); // [lat, lng] para Leaflet
      }
    }
  }
  return points.length > 0 ? L.latLngBounds(points) : null;
}

interface FitCityOnLoadProps {
  /** Bairros ou zonas pluviométricas para encaixar a vista (preferir zonas quando disponível). */
  boundsData: BoundsGeoJson;
}

/** Ajusta a vista do mapa para a cidade do Rio ao carregar (uma vez). */
export const FitCityOnLoad: React.FC<FitCityOnLoadProps> = ({ boundsData }) => {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !boundsData) return;
    const bounds = boundsFromBairros(boundsData);
    if (bounds) {
      map.fitBounds(bounds, BAIRROS_BOUNDS_PROPS);
      done.current = true;
    }
  }, [map, boundsData]);
  return null;
};

interface FocusCityButtonProps {
  boundsData: BoundsGeoJson;
}

export const FocusCityButton: React.FC<FocusCityButtonProps> = ({ boundsData }) => {
  const map = useMap();

  const handleFocus = () => {
    if (!boundsData) return;
    const bounds = boundsFromBairros(boundsData);
    if (bounds) map.fitBounds(bounds, BAIRROS_BOUNDS_PROPS);
  };

  return (
    <button
      type="button"
      onClick={handleFocus}
      className="absolute top-24 left-1/2 z-[1400] flex min-w-0 max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-xs font-medium text-gray-700 shadow-md backdrop-blur transition-colors hover:bg-gray-50 active:bg-gray-100 sm:top-28"
      title="Ajustar vista para a cidade do Rio inteira"
    >
      <Map className="w-4 h-4 shrink-0" />
      <span className="truncate">Ver cidade inteira</span>
    </button>
  );
};

interface OccurrenceFiltersProps {
  textFilter: string;
  onTextFilterChange: (text: string) => void;
  categoryFilter: string[];
  onCategoryFilterChange: (categories: string[]) => void;
  availableCategories: string[];
}

/** Controle para filtrar ocorrências por texto e categoria (POP). */
export const OccurrenceFilters: React.FC<OccurrenceFiltersProps> = ({
  textFilter,
  onTextFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  availableCategories,
}) => {
  const handleCategoryToggle = (category: string) => {
    if (categoryFilter.includes(category)) {
      onCategoryFilterChange(categoryFilter.filter((c) => c !== category));
    } else {
      onCategoryFilterChange([...categoryFilter, category]);
    }
  };

  return (
    <div className={controlBoxClass} style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-gray-700">
        <AlertTriangle className="w-3.5 h-3.5" />
        Filtrar ocorrências
      </div>
      <div className="flex flex-col gap-2">
        {/* Filtro por texto */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-600 font-medium">Buscar por tipo:</label>
          <input
            type="text"
            placeholder="Ex: bolsão, alagamento"
            value={textFilter}
            onChange={(e) => onTextFilterChange(e.target.value)}
            className="px-2 py-1.5 rounded text-xs border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Filtro por categoria */}
        {availableCategories.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-600 font-medium">Categorias (POP):</label>
            <div className="flex flex-col gap-1 max-h-[150px] overflow-y-auto pr-1">
              {availableCategories.map((category) => (
                <label key={category} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={categoryFilter.includes(category)}
                    onChange={() => handleCategoryToggle(category)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700 text-ellipsis overflow-hidden">{category}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

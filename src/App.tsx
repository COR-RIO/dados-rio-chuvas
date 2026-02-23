import { RefreshCw, AlertCircle, Info, Beaker, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useRainData, type RainDataMode } from './hooks/useRainData';
import { LeafletMap } from './components/LeafletMap';
import { RainStationCard } from './components/RainStationCard';
import { InfoModal } from './components/InfoModal';
import { InfluenceLegend } from './components/InfluenceLegend';
import type { MapTypeId, HistoricalViewMode } from './components/mapControlTypes';
import { findClosestTimestamp } from './utils/historicalTimestamp';

function App() {
  const [useMockDemo, setUseMockDemo] = useState(false);
  const [dataMode, setDataMode] = useState<RainDataMode>('auto');
  const today = new Date().toISOString().slice(0, 10);
  const [historicalDate, setHistoricalDate] = useState(today);
  const [historicalDateTo, setHistoricalDateTo] = useState(today);
  const [historicalTimeFrom, setHistoricalTimeFrom] = useState('00:00');
  const [historicalTimeTo, setHistoricalTimeTo] = useState('23:59');
  const [historicalTimestamp, setHistoricalTimestamp] = useState<string | null>(null);
  const [desiredAnalysisTime, setDesiredAnalysisTime] = useState<string>('00:00');
  const [historicalViewMode, setHistoricalViewMode] = useState<HistoricalViewMode>('instant');
  const pendingApplyTimeRef = useRef<string | null>(null);
  const [mapType, setMapType] = useState<MapTypeId>('rua');
  const {
    stations,
    loading,
    refreshing,
    error,
    lastUpdate,
    apiAvailable,
    dataSource,
    historicalTimeline,
    activeHistoricalTimestamp,
    totalStations,
    refresh,
  } = useRainData({
    useMock: useMockDemo,
    mode: dataMode,
    historicalDate,
    historicalDateFrom: historicalDate,
    historicalDateTo,
    historicalTimeFrom,
    historicalTimeTo,
    historicalTimestamp,
    refreshInterval: 300000,
  });
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [showMapLegend, setShowMapLegend] = useState(true);
  const isHistoricalMode = dataMode === 'historical' && !useMockDemo;
  const isDarkMap = mapType === 'escuro';
  const isSatelliteMap = mapType === 'satelite';
  const isHighContrastMap = isDarkMap || isSatelliteMap;

  const headerPanelClass = isDarkMap
    ? 'bg-slate-900/88 border-slate-500'
    : isSatelliteMap
      ? 'bg-black/62 border-white/35'
      : 'bg-white/92 border-gray-200';
  const headerTitleClass = isHighContrastMap ? 'text-white' : 'text-gray-900';
  const headerMetaClass = isHighContrastMap ? 'text-gray-200' : 'text-gray-600';
  const headerButtonNeutralClass = isHighContrastMap
    ? 'bg-white/15 text-white hover:bg-white/25 border border-white/30'
    : 'bg-gray-100 text-gray-700 hover:bg-gray-200';
  const headerButtonMockClass = useMockDemo
    ? 'bg-amber-500 text-white hover:bg-amber-600'
    : (isHighContrastMap ? 'bg-white/15 text-white hover:bg-white/25 border border-white/30' : 'bg-gray-100 text-gray-700 hover:bg-gray-200');
  const headerButtonHistoricalClass = isHistoricalMode
    ? 'bg-blue-600 text-white hover:bg-blue-700'
    : (isHighContrastMap ? 'bg-white/15 text-white hover:bg-white/25 border border-white/30' : 'bg-gray-100 text-gray-700 hover:bg-gray-200');
  const headerOnlineClass = isHighContrastMap ? 'text-emerald-300' : 'text-green-700';
  const headerOfflineClass = isHighContrastMap ? 'text-red-300' : 'text-red-700';
  const headerFallbackClass = isHighContrastMap ? 'text-amber-300' : 'text-amber-700';
  const headerAlertClass = isHighContrastMap
    ? 'border-amber-400/70 bg-amber-900/78 text-amber-100'
    : 'border-amber-200 bg-amber-50/95 text-amber-800';
  const sourceLabel = useMockDemo
    ? 'Demonstração'
    : isHistoricalMode
      ? 'COR (histórico filtrado no GCP)'
    : dataSource === 'gcp'
      ? 'COR (histórico no GCP)'
      : 'Alerta Rio (API em tempo real)';
  const titleLabel = isHistoricalMode ? 'Como estava a chuva no horário selecionado?' : 'Onde está chovendo agora?';

  const selectedMoment =
    isHistoricalMode && (historicalTimestamp ?? activeHistoricalTimestamp)
      ? (() => {
          const ts = historicalTimestamp ?? activeHistoricalTimestamp;
          if (!ts) return null;
          const d = new Date(ts);
          if (Number.isNaN(d.getTime())) return null;
          return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        })()
      : null;

  // Ao receber nova timeline após Aplicar no Instantâneo: definir timestamp pelo horário desejado e atualizar mapa/tabela com dados do GCP
  useEffect(() => {
    if (historicalViewMode !== 'instant' || historicalTimeline.length === 0 || pendingApplyTimeRef.current === null) return;
    const time = pendingApplyTimeRef.current;
    pendingApplyTimeRef.current = null;
    const closest = findClosestTimestamp(historicalTimeline, historicalDate, time);
    if (closest) {
      setHistoricalTimestamp(closest);
      const d = new Date(closest);
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      setDesiredAnalysisTime(`${h}:${m}`);
    }
  }, [historicalViewMode, historicalTimeline, historicalDate]);

  const handleApplyHistorical = () => {
    setHistoricalTimestamp(null);
    if (historicalViewMode === 'instant') {
      pendingApplyTimeRef.current = desiredAnalysisTime || '00:00';
    }
    refresh();
  };

  return (
    <div className="min-h-screen w-screen bg-gray-900 overflow-x-hidden">
      <div className="relative h-screen w-full overflow-hidden">
        <LeafletMap
          stations={stations}
          mapType={mapType}
          onMapTypeChange={setMapType}
          historicalMode={isHistoricalMode}
          historicalDate={historicalDate}
          onHistoricalDateChange={(date) => {
            setHistoricalDate(date);
            if (date > historicalDateTo) setHistoricalDateTo(date);
            setHistoricalTimestamp(null);
          }}
          historicalDateTo={historicalDateTo}
          onHistoricalDateToChange={(date) => {
            setHistoricalDateTo(date);
            setHistoricalTimestamp(null);
          }}
          historicalTimeFrom={historicalTimeFrom}
          historicalTimeTo={historicalTimeTo}
          onHistoricalTimeFromChange={setHistoricalTimeFrom}
          onHistoricalTimeToChange={setHistoricalTimeTo}
          historicalTimeline={historicalTimeline}
          selectedHistoricalTimestamp={historicalTimestamp ?? activeHistoricalTimestamp}
          onHistoricalTimestampChange={(ts) => {
            setHistoricalTimestamp(ts);
          }}
          desiredAnalysisTime={desiredAnalysisTime}
          onDesiredAnalysisTimeChange={setDesiredAnalysisTime}
          historicalViewMode={historicalViewMode}
          onHistoricalViewModeChange={setHistoricalViewMode}
          onApplyHistoricalFilter={handleApplyHistorical}
          historicalRefreshing={refreshing}
        />

        <div className="absolute top-3 left-3 right-3 z-[2000] pointer-events-none">
          <div className={`pointer-events-auto mx-auto max-w-6xl rounded-2xl border backdrop-blur shadow-lg px-3 py-2 sm:px-4 sm:py-3 ${headerPanelClass}`}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h1 className={`text-sm sm:text-base lg:text-lg font-bold ${headerTitleClass}`}>{titleLabel}</h1>
                <div className={`mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] sm:text-xs ${headerMetaClass}`}>
                  {selectedMoment && <span>Momento dos dados: {selectedMoment}</span>}
                  {lastUpdate && !selectedMoment && <span>Atualizado: {lastUpdate.toLocaleString('pt-BR')}</span>}
                  <span>Estações: {totalStations}</span>
                  <span>Fonte: {sourceLabel}</span>
                  {!useMockDemo && (
                    <span
                      className={
                        isHistoricalMode
                          ? headerFallbackClass
                          : apiAvailable
                            ? headerOnlineClass
                            : dataSource === 'gcp'
                              ? headerFallbackClass
                              : headerOfflineClass
                      }
                    >
                      {isHistoricalMode
                        ? 'Modo histórico (GCP)'
                        : apiAvailable
                          ? 'API online'
                          : dataSource === 'gcp'
                            ? 'API offline (fallback GCP)'
                            : 'API offline'}
                    </span>
                  )}
                  {useMockDemo && <span className={isHighContrastMap ? 'text-amber-300 font-medium' : 'text-amber-700 font-medium'}>Modo demonstração</span>}
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setUseMockDemo((v) => !v)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium transition-colors ${headerButtonMockClass}`}
                  title={useMockDemo ? 'Voltar aos dados em tempo real' : 'Usar dados de exemplo'}
                >
                  <Beaker className="w-4 h-4" />
                  {useMockDemo ? 'Tempo real' : 'Exemplo'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDataMode((m) => (m === 'historical' ? 'auto' : 'historical'));
                    setHistoricalTimestamp(null);
                  }}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium transition-colors ${headerButtonHistoricalClass}`}
                  title={isHistoricalMode ? 'Voltar para tempo real/fallback automático' : 'Ativar filtro temporal histórico (GCP)'}
                >
                  {isHistoricalMode ? 'Tempo real' : 'Histórico'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsInfoModalOpen(true)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs sm:text-sm font-medium transition-colors ${headerButtonNeutralClass}`}
                >
                  <Info className="w-4 h-4" />
                  Info
                </button>
                <button
                  type="button"
                  onClick={refresh}
                  disabled={loading || refreshing}
                  className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-3 py-2 text-xs sm:text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${(loading || refreshing) ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
              </div>
            </div>
          </div>

          {error && !useMockDemo && (
            <div className={`pointer-events-auto mx-auto max-w-6xl mt-2 rounded-xl border backdrop-blur px-3 py-2 text-xs sm:text-sm flex items-center gap-2 ${headerAlertClass}`}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{error}</span>
            </div>
          )}
        </div>
      </div>

      <section className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm sm:text-base font-bold text-gray-800">Legenda e explicações do mapa</h2>
            <button
              type="button"
              onClick={() => setShowMapLegend((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {showMapLegend ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {showMapLegend ? 'Ocultar legenda' : 'Mostrar legenda'}
            </button>
          </div>

          {showMapLegend && (
            <div className="mt-3 sm:mt-4 flex flex-wrap gap-4 sm:gap-6 items-start">
              <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-3 sm:p-4 shrink-0">
                <InfluenceLegend showHexagons={false} mapType={mapType} embedded />
              </div>

              <div className="space-y-3 text-xs text-gray-600 min-w-0 flex-1">
                <div className="space-y-1">
                  <p>• <strong>Bolinhas:</strong> posição das estações pluviométricas no mapa.</p>
                  <p>• <strong>Cores de fundo:</strong> cada zona (área de influência) usa a mesma paleta por nível de chuva (sem chuva, fraca, moderada, forte, muito forte).</p>
                  <p>• <strong>Linhas de influência:</strong> contornos que delimitam as zonas no painel do mapa.</p>
                </div>

                <div className="space-y-1">
                  <p>• <strong>Níveis de chuva:</strong> mesma paleta (cinza, azuis) para 15min, 1h e acumulado nas zonas e bolinhas.</p>
                  <p>• <strong>Modo Histórico (GCP):</strong> em <strong>Instantâneo</strong> use uma data e o horário para análise; em <strong>Acumulado no período</strong> aparecem <strong>De</strong> e <strong>Até</strong> para o intervalo (ex.: 09/02/2026 até 10/02/2026).</p>
                </div>

                <div className="space-y-1">
                  <p>• <strong>Critério oficial (15min):</strong> fraca &lt;1,25 | moderada 1,25–6,25 | forte 6,25–12,5 | muito forte &gt;12,5 mm/15min.</p>
                  <p>• <strong>Critério oficial (1h):</strong> fraca &lt;5,0 | moderada 5,0–25,0 | forte 25,1–50,0 | muito forte &gt;50,0 mm/h.</p>
                </div>

                <div className="space-y-1">
                  <p>• <strong>Ver cidade inteira:</strong> ajusta o enquadramento para todo o município.</p>
                  <p>• <strong>Fonte:</strong> Alerta Rio (Termos Meteorológicos e Probabilidades de Escorregamento).</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-6 sm:py-8">
          <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800">Cards de dados pluviométricos</h2>
            <span className="text-xs sm:text-sm text-gray-500">{stations.length} estações</span>
          </div>

          {stations.length === 0 && loading ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
              Carregando estações...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
              {stations.map((station) => (
                <RainStationCard key={station.id} station={station} />
              ))}
            </div>
          )}
        </div>
      </section>

      <footer className="border-t border-slate-800 bg-slate-950 text-slate-200">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-3 py-5 text-xs sm:px-4 sm:py-6 sm:text-sm lg:px-6">
          <p className="font-semibold text-slate-100">COR - Centro de Operações e Resiliência | Prefeitura do Rio de Janeiro</p>
          <p className="text-slate-300">
            Fonte institucional do projeto. Dados de chuva em tempo real via Alerta Rio e histórico via BigQuery (GCP).
          </p>
        </div>
      </footer>

      {/* Info Modal */}
      <InfoModal 
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        apiAvailable={apiAvailable}
        dataSource={dataSource}
        totalStations={totalStations}
        stations={stations}
      />
    </div>
  );
}

export default App;
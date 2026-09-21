import { useCallback, useState } from 'react';
import { Map as MapIcon, BarChart3, Info } from 'lucide-react';
import MapTab from './MapTab';
import AnalysisDashboard from './pages/AnalysisDashboard';

export type AppTab = 'mapa' | 'analise';

/** Links de navegação do header (como um site institucional). Para adicionar uma nova seção,
 * basta inserir um item aqui e renderizá-lo no <main> abaixo. */
const TABS: { id: AppTab; label: string; icon: typeof MapIcon; description: string }[] = [
  { id: 'mapa', label: 'Mapa', icon: MapIcon, description: 'Monitoramento em tempo real' },
  { id: 'analise', label: 'Análise Institucional', icon: BarChart3, description: 'Cruzamento de chuva, vento e ocorrências' },
];

function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('mapa');
  // Ação "Ver cidade inteira": o MapTab registra a função de foco quando o mapa está pronto
  // (e desregistra ao desmontar, ex. trocar pra aba Análise) — o botão em si mora aqui no
  // header, fora do mapa, pra não poluir a área de visualização.
  const [focusCityHandler, setFocusCityHandler] = useState<(() => void) | null>(null);
  const handleFocusCityHandlerChange = useCallback((handler: (() => void) | null) => {
    setFocusCityHandler(() => handler);
  }, []);

  // Botão "Mostrar painel"/"Ocultar painel": troca de rótulo conforme o estado atual do painel
  // de contexto. Como o valor é um objeto (não uma função crua), não precisa do truque de
  // embrulhar pra escapar da checagem "função em setState = updater" — setState guarda o objeto
  // como veio.
  const [contextPanelToggle, setContextPanelToggle] = useState<{ isOpen: boolean; onToggle: () => void } | null>(null);

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 overflow-hidden">
      {/* Header superior com navegação (o sistema original continua na aba "Mapa") */}
      <header className="h-14 shrink-0 z-[3000] flex items-center gap-3 px-3 sm:px-5 bg-white border-b border-slate-200 shadow-sm">
        {/* Logo COR (Prefeitura do Rio) */}
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/logo-cor-light.png"
            alt="Logo COR — Centro de Operações e Resiliência · Prefeitura do Rio de Janeiro"
            title="COR — Centro de Operações e Resiliência | Prefeitura do Rio de Janeiro"
            className="h-9 sm:h-10 w-auto shrink-0"
            draggable={false}
          />
          <div className="hidden sm:flex flex-col leading-tight min-w-0 border-l border-slate-300 pl-3">
            <p className="text-xs font-bold text-slate-800 truncate">COR Rio — Monitoramento</p>
            <p className="text-[10px] text-slate-500 truncate">Chuva · Vento · Ocorrências</p>
          </div>
        </div>

        {activeTab === 'mapa' && (focusCityHandler || contextPanelToggle) && (
          <div className="flex items-center gap-1.5 sm:gap-2">
            {contextPanelToggle && (
              <button
                type="button"
                onClick={contextPanelToggle.onToggle}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 sm:px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 active:bg-slate-200"
                title={contextPanelToggle.isOpen ? 'Ocultar painel de contexto' : 'Mostrar painel de contexto'}
              >
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{contextPanelToggle.isOpen ? 'Ocultar painel' : 'Mostrar painel'}</span>
              </button>
            )}
            {focusCityHandler && (
              <button
                type="button"
                onClick={focusCityHandler}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 sm:px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 active:bg-slate-200"
                title="Ajustar vista para a cidade do Rio inteira"
              >
                <MapIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Ver cidade inteira</span>
              </button>
            )}
          </div>
        )}

        <nav className="ml-auto flex items-center" aria-label="Navegação do sistema">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`group relative inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold transition-colors ${
                  active ? 'text-sky-600' : 'text-slate-500 hover:text-slate-800'
                }`}
                title={tab.description}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                <span
                  className={`absolute inset-x-2.5 -bottom-px h-0.5 rounded-full transition-opacity ${
                    active ? 'bg-sky-500 opacity-100' : 'bg-sky-400 opacity-0 group-hover:opacity-40'
                  }`}
                />
              </button>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 min-h-0 relative">
        {activeTab === 'mapa' ? (
          <MapTab
            onFocusCityHandlerChange={handleFocusCityHandlerChange}
            onContextPanelToggleChange={setContextPanelToggle}
          />
        ) : (
          <AnalysisDashboard />
        )}
      </main>
    </div>
  );
}

export default App;

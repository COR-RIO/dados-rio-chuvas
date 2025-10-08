// React import removido - não necessário com React 17+
import { RefreshCw, AlertCircle, Info } from 'lucide-react';
import { useState } from 'react';
import { useRainData } from './hooks/useRainData';
import { RainStationCard } from './components/RainStationCard';
import { LeafletMap } from './components/LeafletMap';
import { RainDataTable } from './components/RainDataTable';
import { InfoModal } from './components/InfoModal';
import { LoadingSpinner } from './components/LoadingSpinner';

function App() {
  const { stations, loading, error, lastUpdate, apiAvailable, totalStations, refresh } = useRainData(300000); // 5 minutos
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4 lg:py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-4xl font-black text-yellow-500 mb-1 sm:mb-2 leading-tight">
                Onde está chovendo agora?
              </h1>
              <p className="text-gray-600 font-medium mb-2 sm:mb-3 text-xs sm:text-sm lg:text-base leading-relaxed">
                Monitoramento de chuvas em tempo real no Rio de Janeiro
              </p>
              
              {/* Status Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-center gap-2 sm:gap-3 lg:gap-6 text-xs lg:text-sm">
                {lastUpdate && (
                  <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                    <span className="text-gray-500 flex-shrink-0">Última atualização:</span>
                    <span className="font-medium text-gray-700 truncate">
                      {lastUpdate.toLocaleString('pt-BR')}
                    </span>
                  </div>
                )}
                {totalStations > 0 && (
                  <div className="flex items-center gap-1 sm:gap-2">
                    <span className="text-gray-500 flex-shrink-0">Estações ativas:</span>
                    <span className="font-medium text-gray-700">{totalStations}</span>
                  </div>
                )}
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${apiAvailable ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className={`font-medium ${apiAvailable ? 'text-green-600' : 'text-red-600'}`}>
                    {apiAvailable ? 'API Online' : 'API Offline'}
                  </span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0"></div>
                  <span className="font-medium text-blue-600">Auto-atualização ativa</span>
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="lg:ml-6 flex-shrink-0 flex gap-2 sm:gap-3">
              <button
                onClick={() => setIsInfoModalOpen(true)}
                className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-3 sm:px-4 py-2 sm:py-2 lg:py-3 rounded-lg sm:rounded-xl font-medium hover:bg-gray-200 transition-colors shadow-sm hover:shadow-md text-sm sm:text-base"
              >
                <Info className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Informações</span>
                <span className="sm:hidden">Info</span>
              </button>
              <button
                onClick={refresh}
                disabled={loading}
                className="flex items-center justify-center gap-2 bg-yellow-500 text-white px-3 sm:px-4 lg:px-6 py-2 sm:py-2 lg:py-3 rounded-lg sm:rounded-xl font-medium hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg text-sm sm:text-base"
              >
                <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Atualizar</span>
                <span className="sm:hidden">Atualizar</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {error && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-amber-800 font-medium">{error}</p>
          </div>
        )}

        {/* Layout Principal: Mapa à esquerda, Dados à direita */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* Mapa - Ocupa 2/3 da largura em telas grandes */}
          <div className="md:col-span-2 xl:col-span-2 order-1">
            {loading ? (
              <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-3 sm:p-4 lg:p-6 h-[400px] sm:h-[500px] lg:h-[600px] flex items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : (
              <LeafletMap stations={stations} />
            )}
          </div>

          {/* Coluna de Dados - Ocupa 1/3 da largura em telas grandes */}
          <div className="md:col-span-2 xl:col-span-1 order-2">
            <div className="xl:sticky xl:top-8">
              {/* Tabela de Dados Pluviométricos */}
              {loading ? (
                <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-3 sm:p-4 lg:p-6 h-72 sm:h-80 lg:h-96 flex items-center justify-center">
                  <LoadingSpinner />
                </div>
              ) : (
                <RainDataTable stations={stations} />
              )}
            </div>
          </div>
        </div>

        {/* Seção de Cards Detalhados - Abaixo do layout principal */}
        <div className="mt-8 sm:mt-12">
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">Detalhes das Estações</h2>
          {loading ? (
            <div className="flex justify-center py-6 sm:py-8">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              {stations.map((station) => (
                <RainStationCard key={station.id} station={station} />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 mt-12 sm:mt-16">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="text-center text-gray-500 text-xs sm:text-sm">
            <p>Sistema de Monitoramento de Chuvas • Dados da Prefeitura do Rio de Janeiro</p>
          </div>
        </div>
      </footer>

      {/* Info Modal */}
      <InfoModal 
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        apiAvailable={apiAvailable}
        totalStations={totalStations}
        stations={stations}
      />
    </div>
  );
}

export default App;
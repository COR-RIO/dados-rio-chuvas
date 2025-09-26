import React from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { useRainData } from './hooks/useRainData';
import { RainStationCard } from './components/RainStationCard';
import { RainLegend } from './components/RainLegend';
import { GoogleMap } from './components/GoogleMap';
import { LoadingSpinner } from './components/LoadingSpinner';

function App() {
  const { stations, loading, error, lastUpdate, apiAvailable, totalStations, refresh } = useRainData();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-yellow-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black text-yellow-500 mb-2">
                Onde está chovendo agora?
              </h1>
              <p className="text-gray-600 font-medium">
                Monitoramento de chuvas em tempo real no Rio de Janeiro
              </p>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                {lastUpdate && (
                  <span>
                    Última atualização: {lastUpdate.toLocaleString('pt-BR')}
                  </span>
                )}
                {totalStations > 0 && (
                  <span>
                    {totalStations} estações ativas
                  </span>
                )}
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${apiAvailable ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className={apiAvailable ? 'text-green-600' : 'text-red-600'}>
                    {apiAvailable ? 'API Online' : 'API Offline'}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={refresh}
              disabled={loading}
              className="flex items-center gap-2 bg-yellow-500 text-white px-4 py-2 rounded-xl font-medium hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-amber-800 font-medium">{error}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-4 gap-8">
          {/* Map Section */}
          <div className="lg:col-span-4 mb-8">
            {loading ? (
              <div className="bg-white rounded-2xl shadow-lg p-6 h-96 flex items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : (
              <GoogleMap stations={stations} />
            )}
          </div>

          {/* Stations Grid */}
          <div className="lg:col-span-3">
            {loading ? (
              <LoadingSpinner />
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stations.map((station) => (
                  <RainStationCard key={station.id} station={station} />
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <RainLegend />
              
              <div className="mt-6 bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Sobre os dados
                </h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>• Dados fornecidos pela Prefeitura do Rio</p>
                  <p>• Atualização automática a cada 5 minutos</p>
                  <p>• Medições em milímetros (mm)</p>
                  <p>• Horário local de Brasília</p>
                  <p>• API: websempre.rio.rj.gov.br</p>
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      Status: {apiAvailable ? '✅ Conectado' : '❌ Desconectado'}
                    </p>
                    {totalStations > 0 && (
                      <p className="text-xs text-gray-500">
                        Estações: {totalStations} ativas
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 mt-16">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="text-center text-gray-500 text-sm">
            <p>Sistema de Monitoramento de Chuvas • Dados da Prefeitura do Rio de Janeiro</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
import React from 'react';
import { X, Info, MapPin } from 'lucide-react';
import { RainStation } from '../types/rain';
import { rainLevels } from '../utils/rainLevel';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiAvailable: boolean;
  dataSource: 'api' | 'gcp' | 'mock';
  totalStations: number;
  stations: RainStation[];
}

export const InfoModal: React.FC<InfoModalProps> = ({
  isOpen,
  onClose,
  apiAvailable,
  dataSource,
  totalStations,
  stations,
}) => {
  if (!isOpen) return null;

  const sourceDescription =
    dataSource === 'gcp'
      ? 'Leituras históricas no BigQuery (GCP) via Netlify Function'
      : dataSource === 'mock'
        ? 'Dados simulados para demonstração'
        : 'API websempre.rio.rj.gov.br / Alerta Rio (tempo real)';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative z-[10000]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Info className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-800">
              Informações e Legenda
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-6 relative z-[10001]">
          {/* Mapa */}
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Mapa Interativo
            </h3>
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
              <div className="text-center mb-4">
                <div className="text-gray-700 text-sm font-medium mb-2">
                  📍 Mapa dos Bairros do Rio de Janeiro
                </div>
                <div className="text-xs text-gray-600 space-y-1">
                  <p>• <strong>Bolinhas coloridas:</strong> Estações meteorológicas ativas</p>
                  <p>• <strong>Dados em tempo real:</strong> Atualização a cada 5 minutos</p>
                  <p>• <strong>Interatividade:</strong> Clique nos bairros e estações para detalhes</p>
                  <p>• <strong>Tecnologia:</strong> Leaflet + OpenStreetMap</p>
                </div>
              </div>
              
              {/* Estatísticas das estações */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <div className="bg-white rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-blue-600">{stations.length}</div>
                  <div className="text-xs text-gray-600">Estações</div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-green-600">
                    {stations.filter(s => s.data.h01 > 0).length}
                  </div>
                  <div className="text-xs text-gray-600">Com chuva</div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-gray-600">
                    {stations.filter(s => s.data.h01 === 0).length}
                  </div>
                  <div className="text-xs text-gray-600">Sem chuva</div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-orange-600">
                    {stations.length > 0 ? Math.max(...stations.map(s => s.data.h01)).toFixed(1) : '0.0'}
                  </div>
                  <div className="text-xs text-gray-600">Máx. mm/h</div>
                </div>
              </div>
            </div>
          </div>

          {/* Informações sobre os dados */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Sobre os dados
            </h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                <div>
                  <p className="font-medium text-gray-800">Fonte dos dados</p>
                  <p className="text-gray-600">
                    Dados fornecidos pela Prefeitura do Rio de Janeiro (COR/Alerta Rio). Fonte atual: {sourceDescription}.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0"></div>
                <div>
                  <p className="font-medium text-gray-800">Atualização automática</p>
                  <p className="text-gray-600">Os dados são atualizados automaticamente a cada 5 minutos</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-yellow-500 mt-2 flex-shrink-0"></div>
                <div>
                  <p className="font-medium text-gray-800">Unidades de medida</p>
                  <p className="text-gray-600">Medições em milímetros (mm) por hora</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-purple-500 mt-2 flex-shrink-0"></div>
                <div>
                  <p className="font-medium text-gray-800">Fuso horário</p>
                  <p className="text-gray-600">Horário local de Brasília (UTC-3)</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-gray-500 mt-2 flex-shrink-0"></div>
                <div>
                  <p className="font-medium text-gray-800">Dados geográficos</p>
                  <p className="text-gray-600">Mapa interativo com dados geográficos da Prefeitura do Rio de Janeiro e camadas do Alerta Rio</p>
                </div>
              </div>
            </div>
            
            {/* Status da API */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${apiAvailable ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-sm font-medium text-gray-800">
                    Status da API: {apiAvailable ? 'Conectado' : dataSource === 'gcp' ? 'Indisponível (dados GCP ativos)' : 'Desconectado'}
                  </span>
                </div>
                {totalStations > 0 && (
                  <span className="text-sm text-gray-500">
                    {totalStations} estações ativas
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 sm:p-6 border-t border-gray-200 relative z-[10001]">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

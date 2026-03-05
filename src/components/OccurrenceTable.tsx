import React, { useMemo, useState, useRef, useEffect } from 'react';
import type { Occurrence } from '../types/occurrence';

interface OccurrenceTableProps {
  occurrences?: Occurrence[];
  embedded?: boolean;
}

type SortField =
  | 'id_ocorrencia'
  | 'data_hora_abertura'
  | 'bairro'
  | 'criticidade'
  | 'estagio'
  | 'pluviometro_estacao'
  | 'titulo'
  | 'localizacao'
  | 'sentido'
  | 'ap'
  | 'agencias_acionadas';
type SortDirection = 'asc' | 'desc';

function getOccurrenceDateTime(occ: Occurrence): string {
  if (occ.data_hora_abertura) return occ.data_hora_abertura;
  if (occ.data_abertura && occ.hora_abertura) return `${occ.data_abertura}T${occ.hora_abertura.length === 5 ? `${occ.hora_abertura}:00` : occ.hora_abertura}`;
  if (occ.data_abertura) return `${occ.data_abertura}T00:00:00`;
  return '';
}

export const OccurrenceTable: React.FC<OccurrenceTableProps> = ({ occurrences = [], embedded = false }) => {
  const [sortField, setSortField] = useState<SortField>('data_hora_abertura');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [tableWidth, setTableWidth] = useState(0);

  useEffect(() => {
    if (!tableRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setTableWidth(entry.contentRect.width);
      }
    });
    observer.observe(tableRef.current);
    return () => observer.disconnect();
  }, [occurrences]);

  const handleTopScroll = () => {
    if (bottomScrollRef.current && topScrollRef.current) {
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleBottomScroll = () => {
    if (topScrollRef.current && bottomScrollRef.current) {
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sorted = useMemo(() => {
    const list = [...occurrences];
    list.sort((a, b) => {
      let aVal: string = '';
      let bVal: string = '';

      switch (sortField) {
        case 'id_ocorrencia':
          aVal = a.id_ocorrencia ?? '';
          bVal = b.id_ocorrencia ?? '';
          break;
        case 'data_hora_abertura':
          aVal = getOccurrenceDateTime(a);
          bVal = getOccurrenceDateTime(b);
          break;
        case 'bairro':
          aVal = a.bairro ?? '';
          bVal = b.bairro ?? '';
          break;
        case 'criticidade':
          aVal = a.criticidade ?? '';
          bVal = b.criticidade ?? '';
          break;
        case 'estagio':
          aVal = a.estagio ?? '';
          bVal = b.estagio ?? '';
          break;
        case 'pluviometro_estacao':
          aVal = a.pluviometro_estacao ?? '';
          bVal = b.pluviometro_estacao ?? '';
          break;
        case 'titulo':
          aVal = a.titulo ?? '';
          bVal = b.titulo ?? '';
          break;
        case 'localizacao':
          aVal = a.localizacao ?? '';
          bVal = b.localizacao ?? '';
          break;
        case 'sentido':
          aVal = a.sentido ?? '';
          bVal = b.sentido ?? '';
          break;
        case 'ap':
          aVal = a.ap ?? '';
          bVal = b.ap ?? '';
          break;
        case 'agencias_acionadas':
          aVal = a.agencias_acionadas ?? '';
          bVal = b.agencias_acionadas ?? '';
          break;
        default:
          return 0;
      }

      if (aVal === bVal) return 0;
      const comp = aVal.localeCompare(bVal, 'pt-BR', { sensitivity: 'base' });
      return sortDirection === 'asc' ? comp : -comp;
    });
    return list;
  }, [occurrences, sortField, sortDirection]);

  if (!sorted.length) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <p className="text-xs sm:text-sm text-gray-500 px-4 text-center">
          Nenhuma ocorrência encontrada para o período selecionado.
        </p>
      </div>
    );
  }

  const headerBase =
    'px-1.5 sm:px-2 py-1.5 sm:py-2 text-left text-[10px] sm:text-[11px] font-medium text-gray-700 cursor-pointer hover:bg-gray-100';
  const cellBase =
    'px-1.5 sm:px-2 py-1.5 sm:py-2 text-[10px] sm:text-[11px] text-gray-800 align-top';

  return (
    <div className={`${embedded ? 'bg-white rounded-xl shadow-lg' : 'bg-white rounded-xl sm:rounded-2xl shadow-lg'} overflow-hidden`}>
      <div className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 bg-white border-b border-gray-200 flex items-center justify-between gap-2">
        <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-800">
          Ocorrências relacionadas à chuva
        </h3>
        <span className="text-[10px] sm:text-[11px] text-gray-500">
          {sorted.length} ocorrências
        </span>
      </div>

      {/* Barra de rolagem superior */}
      <div
        ref={topScrollRef}
        onScroll={handleTopScroll}
        className={`overflow-x-auto ${embedded ? 'min-w-0' : ''}`}
      >
        <div style={{ width: tableWidth > 0 ? `${tableWidth}px` : '100%', height: '1px' }}></div>
      </div>

      <div
        ref={bottomScrollRef}
        onScroll={handleBottomScroll}
        className={`overflow-x-auto ${embedded ? 'min-w-0' : ''}`}
      >
        <table ref={tableRef} className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th
                className={`${headerBase} w-[70px] sm:w-[90px] min-w-[70px] truncate`}
                onClick={() => handleSort('id_ocorrencia')}
              >
                ID
              </th>
              <th
                className={`${headerBase} w-[90px] sm:w-[110px] min-w-[90px] truncate`}
                onClick={() => handleSort('data_hora_abertura')}
              >
                Data/hora
              </th>
              <th
                className={`${headerBase} w-[80px] sm:w-[100px] min-w-[80px] max-w-[130px] truncate`}
                onClick={() => handleSort('bairro')}
              >
                Bairro
              </th>
              <th
                className={`${headerBase} w-[60px] sm:w-[80px] min-w-[60px] truncate`}
                onClick={() => handleSort('criticidade')}
              >
                Criticidade
              </th>
              <th
                className={`${headerBase} w-[50px] sm:w-[60px] min-w-[50px] truncate`}
                onClick={() => handleSort('estagio')}
              >
                Estágio
              </th>
              <th
                className={`${headerBase} w-[100px] sm:w-[130px] min-w-[90px] max-w-[150px] truncate`}
                onClick={() => handleSort('pluviometro_estacao')}
              >
                Pluviômetro / estação
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sorted.map((occ) => {
              const dtIso = getOccurrenceDateTime(occ);
              const dtLabel = dtIso
                ? new Date(dtIso).toLocaleString('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })
                : '-';

              return (
                <tr key={occ.id_ocorrencia} className="hover:bg-gray-50">
                  <td className={`${cellBase} w-[70px] sm:w-[90px] min-w-[70px] truncate`} title={occ.id_ocorrencia}>
                    <span className="font-semibold text-gray-900">
                      {occ.id_ocorrencia}
                    </span>
                  </td>
                  <td className={`${cellBase} w-[90px] sm:w-[110px] min-w-[90px] truncate`} title={dtLabel}>{dtLabel}</td>
                  <td className={`${cellBase} w-[80px] sm:w-[100px] min-w-[80px] max-w-[130px] truncate`} title={occ.bairro ?? undefined}>{occ.bairro ?? '-'}</td>
                  <td className={`${cellBase} w-[60px] sm:w-[80px] min-w-[60px] truncate`} title={occ.criticidade ?? undefined}>{occ.criticidade ?? '-'}</td>
                  <td className={`${cellBase} w-[50px] sm:w-[60px] min-w-[50px] truncate`} title={occ.estagio ?? undefined}>{occ.estagio ?? '-'}</td>
                  <td className={`${cellBase} w-[100px] sm:w-[130px] min-w-[90px] max-w-[150px]`}>
                    <div className="space-y-0.5 min-w-0">
                      <div className="text-gray-900 truncate" title={occ.pluviometro_estacao ?? undefined}>
                        {occ.pluviometro_estacao ?? '-'}
                      </div>
                      {occ.pluviometro_id && (
                        <div className="text-[9px] sm:text-[10px] text-gray-500 truncate" title={`ID: ${occ.pluviometro_id}`}>
                          ID: {occ.pluviometro_id}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-3 sm:px-4 lg:px-6 py-2 lg:py-3 border-t border-gray-200 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[10px] sm:text-xs text-gray-500">
          <span>
            Período filtrado segue o controle de histórico e horário do painel de filtros.
          </span>
          <span>
            Use a coluna de pluviômetro para cruzar manualmente com os dados de chuva das estações.
          </span>
        </div>
      </div>
    </div>
  );
};


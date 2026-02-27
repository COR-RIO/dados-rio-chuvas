import React, { useMemo, useState } from 'react';
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
  | 'pluviometro_estacao';
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
    'px-2 sm:px-3 py-2 text-left text-[11px] sm:text-xs font-medium text-gray-700 cursor-pointer hover:bg-gray-100 whitespace-nowrap';
  const cellBase =
    'px-2 sm:px-3 py-2 text-[11px] sm:text-xs text-gray-800 align-top whitespace-nowrap';

  return (
    <div className={`${embedded ? 'bg-white rounded-xl shadow-lg' : 'bg-white rounded-xl sm:rounded-2xl shadow-lg'} overflow-hidden`}>
      <div className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 bg-white border-b border-gray-200 flex items-center justify-between gap-2">
        <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-800">
          Ocorrências relacionadas à chuva
        </h3>
        <span className="text-[11px] sm:text-xs text-gray-500">
          {sorted.length} ocorrências
        </span>
      </div>

      <div className={`overflow-x-auto ${embedded ? 'min-w-0' : ''}`}>
        <table className="w-full min-w-[520px] table-fixed">
          <colgroup>
            <col style={{ width: '10%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '22%' }} />
          </colgroup>
          <thead className="bg-gray-50">
            <tr>
              <th
                className={headerBase}
                onClick={() => handleSort('id_ocorrencia')}
              >
                ID
              </th>
              <th
                className={headerBase}
                onClick={() => handleSort('data_hora_abertura')}
              >
                Data/hora abertura
              </th>
              <th
                className={headerBase}
                onClick={() => handleSort('bairro')}
              >
                Bairro
              </th>
              <th
                className={headerBase}
                onClick={() => handleSort('criticidade')}
              >
                Criticidade
              </th>
              <th
                className={headerBase}
                onClick={() => handleSort('estagio')}
              >
                Estágio
              </th>
              <th
                className={headerBase}
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
                  <td className={cellBase}>
                    <span className="font-semibold text-gray-900">
                      {occ.id_ocorrencia}
                    </span>
                  </td>
                  <td className={cellBase}>{dtLabel}</td>
                  <td className={cellBase}>{occ.bairro ?? '-'}</td>
                  <td className={cellBase}>{occ.criticidade ?? '-'}</td>
                  <td className={cellBase}>{occ.estagio ?? '-'}</td>
                  <td className={`${cellBase} whitespace-normal`}>
                    <div className="space-y-0.5">
                      <div className="text-gray-900">
                        {occ.pluviometro_estacao ?? '-'}
                      </div>
                      {occ.pluviometro_id && (
                        <div className="text-[10px] text-gray-500">
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


export type MapAlertKind = 'vento' | 'chuva';

export interface MapAlert {
  id: string;
  kind: MapAlertKind;
  label: string;
  /** Ponto único (alerta de vento numa estação) — usado para map.flyTo. */
  location: [number, number] | null;
  /** Vários pontos (alerta de concentração de chuva numa zona) — usado para map.fitBounds. */
  points: [number, number][] | null;
  createdAt: string;
}

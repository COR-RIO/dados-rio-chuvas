export interface RainStation {
  id: string;
  nome: string;
  bairro: string;
  estacao: string;
  chuva_15min: number;
  chuva_1h: number;
  chuva_4h: number;
  chuva_24h: number;
  chuva_96h: number;
  ultima_atualizacao: string;
}

export interface RainLevel {
  name: string;
  description: string;
  min: number;
  max: number | null;
  color: string;
  bgColor: string;
}
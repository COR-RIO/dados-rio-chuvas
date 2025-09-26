export interface RainStation {
  id: string;
  name: string;
  location: [number, number];
  read_at: string;
  is_new: boolean;
  data: {
    m05: number;
    m15: number;
    h01: number;
    h02: number;
    h03: number;
    h04: number;
    h24: number;
    h96: number;
    mes: number;
  };
}

export interface RainLevel {
  name: string;
  description: string;
  min: number;
  max: number | null;
  color: string;
  bgColor: string;
}
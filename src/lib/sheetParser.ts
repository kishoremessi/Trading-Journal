export interface Trade {
  date: Date;
  dateStr: string;
  segment: string;
  qty: number;
  buy: number;
  sell: number;
  points: number;
  profit: number;
  loss: number;
  tax: number;
  rulesFollowed: boolean;
  reason: string;
  actualProfit: number;
  missedProfits: number;
}

export function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

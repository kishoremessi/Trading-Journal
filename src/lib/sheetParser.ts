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

export interface Historical2025Monthly {
  month: string;
  niftyCE: number;
  bankniftyCE: number;
  sensex: number;
  niftyPE: number;
  bankniftyPE: number;
  total: number;
}

export interface Historical2025 {
  months: Historical2025Monthly[];
  total: { niftyCE: number; bankniftyCE: number; sensex: number; niftyPE: number; bankniftyPE: number; total: number } | null;
  roi: { niftyCE: number; bankniftyCE: number; sensex: number; niftyPE: number; bankniftyPE: number; total: number } | null;
}

export function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function buildCsvUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed.includes('/export?format=csv')) return trimmed;
  const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return trimmed;
  const sheetId = idMatch[1];
  const gidMatch = trimmed.match(/[#&?]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '';
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
}

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const FULL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function parseDateStr(raw: string, currentYear: number, lastMonthIdx: number): { date: Date; year: number; monthIdx: number } | null {
  const parts = raw.trim().split('-');
  if (parts.length !== 2) return null;
  const day = parseInt(parts[0], 10);
  const monthKey = parts[1].toLowerCase().substring(0, 3);
  const monthIdx = MONTH_MAP[monthKey];
  if (isNaN(day) || monthIdx === undefined) return null;
  let year = currentYear;
  if (monthIdx < lastMonthIdx && lastMonthIdx >= 11) year = currentYear + 1;
  return { date: new Date(year, monthIdx, day), year, monthIdx };
}

function parseNum(s: string | undefined): number {
  if (!s) return 0;
  return parseFloat(s.replace(/,/g, '')) || 0;
}

export function parseCsv(rows: string[][]): Trade[] {
  const trades: Trade[] = [];
  let dataStart = 4;
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    if (rows[i][2] && rows[i][2].trim().toLowerCase() === 'date') {
      dataStart = i + 1;
      break;
    }
  }

  const startYear = 2025;
  let currentYear = startYear;
  let lastMonthIdx = -1;

  for (let i = dataStart; i < rows.length; i++) {
    const row = rows[i];
    const dateRaw = row[2]?.trim();
    if (!dateRaw || !/^\d{1,2}-[A-Za-z]{3,}/.test(dateRaw)) continue;

    const actualProfitRaw = row[13]?.trim();
    if (!actualProfitRaw) continue;
    const actualProfit = parseFloat(actualProfitRaw.replace(/,/g, ''));
    if (isNaN(actualProfit)) continue;

    const segment = row[3]?.trim();
    if (!segment) continue;

    const parsed = parseDateStr(dateRaw, currentYear, lastMonthIdx);
    if (!parsed) continue;

    if (parsed.monthIdx < lastMonthIdx && lastMonthIdx >= 10) currentYear = parsed.year;
    lastMonthIdx = parsed.monthIdx;

    trades.push({
      date: parsed.date,
      dateStr: toLocalDateStr(parsed.date),
      segment,
      qty: parseFloat(row[4] || '0') || 0,
      buy: parseFloat(row[5] || '0') || 0,
      sell: parseFloat(row[6] || '0') || 0,
      points: parseFloat(row[7] || '0') || 0,
      profit: parseFloat(row[8] || '0') || 0,
      loss: parseFloat(row[9] || '0') || 0,
      tax: parseFloat(row[10] || '0') || 0,
      rulesFollowed: ['yes', 'y'].includes((row[11] || '').trim().toLowerCase()),
      reason: row[12]?.trim() || '',
      actualProfit,
      missedProfits: parseFloat(row[14] || '0') || 0,
    });
  }

  return trades;
}

export function parse2025Data(rows: string[][]): Historical2025 {
  // Find the row where col[17] === "Month" (0-based index 17 = column R)
  const COL = 17;
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][COL]?.trim() === 'Month') { headerIdx = i; break; }
  }
  if (headerIdx === -1) return { months: [], total: null, roi: null };

  const months: Historical2025Monthly[] = [];
  let total: Historical2025['total'] = null;
  let roi: Historical2025['roi'] = null;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const label = row[COL]?.trim();
    if (!label) continue;

    const niftyCE    = parseNum(row[COL + 1]);
    const bankniftyCE = parseNum(row[COL + 2]);
    const sensex     = parseNum(row[COL + 3]);
    const niftyPE    = parseNum(row[COL + 4]);
    const bankniftyPE = parseNum(row[COL + 5]);
    const tot        = parseNum(row[COL + 6]);

    if (label === 'TOTAL') {
      total = { niftyCE, bankniftyCE, sensex, niftyPE, bankniftyPE, total: tot };
    } else if (label === 'ROI') {
      roi = { niftyCE, bankniftyCE, sensex, niftyPE, bankniftyPE, total: tot };
      break;
    } else if (FULL_MONTHS.includes(label)) {
      months.push({ month: label, niftyCE, bankniftyCE, sensex, niftyPE, bankniftyPE, total: tot });
    }
  }

  return { months, total, roi };
}

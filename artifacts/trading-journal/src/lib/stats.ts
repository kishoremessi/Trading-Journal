import type { Trade } from './sheetParser';
import { toLocalDateStr } from './sheetParser';

export interface TradeStats {
  totalPnl: number;
  totalTradingDays: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  rrRatio: number;
  expectancy: number;
  profitFactor: number;
  rulesFollowedPct: number;
  bestWinStreak: number;
  maxDrawdown: number;
  recentForm: Array<{ win: boolean; pnl: number }>;
  cumulativePnl: number[];
}

export interface SegmentStats {
  segment: string;
  totalPnl: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgTrade: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
}

export interface InstrumentGroup {
  name: string;
  totalPnl: number;
  trades: number;
  wins: number;
  winRate: number;
  cePnl: number;
  pePnl: number;
  ceWins: number;
  peWins: number;
  ceWinRate: number;
  peWinRate: number;
  ceTrades: number;
  peTrades: number;
  profitFactor: number;
  avgTrade: number;
  segments: string[];
}

export interface DayPnl {
  dateStr: string;
  date: Date;
  pnl: number;
  trades: number;
  tax: number;
}

export function computeStats(trades: Trade[]): TradeStats {
  if (!trades.length) {
    return {
      totalPnl: 0, totalTradingDays: 0, totalTrades: 0, wins: 0, losses: 0,
      winRate: 0, avgWin: 0, avgLoss: 0, rrRatio: 0, expectancy: 0,
      profitFactor: 0, rulesFollowedPct: 0, bestWinStreak: 0, maxDrawdown: 0,
      recentForm: [], cumulativePnl: [],
    };
  }

  const winningTrades = trades.filter(t => t.actualProfit > 0);
  const losingTrades  = trades.filter(t => t.actualProfit < 0);
  const totalPnl      = trades.reduce((s, t) => s + t.actualProfit, 0);
  const uniqueDays    = new Set(trades.map(t => t.dateStr)).size;
  const avgWin        = winningTrades.length ? winningTrades.reduce((s, t) => s + t.actualProfit, 0) / winningTrades.length : 0;
  const avgLoss       = losingTrades.length  ? Math.abs(losingTrades.reduce((s, t) => s + t.actualProfit, 0) / losingTrades.length) : 0;
  const sumWins       = winningTrades.reduce((s, t) => s + t.actualProfit, 0);
  const sumLosses     = Math.abs(losingTrades.reduce((s, t) => s + t.actualProfit, 0));
  const rulesFollowed = trades.filter(t => t.rulesFollowed).length;

  let bestStreak = 0, currentStreak = 0;
  for (const t of trades) {
    if (t.actualProfit > 0) { currentStreak++; bestStreak = Math.max(bestStreak, currentStreak); }
    else currentStreak = 0;
  }

  const cumulative: number[] = [];
  let running = 0;
  for (const t of trades) { running += t.actualProfit; cumulative.push(running); }
  let peak = cumulative[0] ?? 0, maxDrawdown = 0;
  for (const val of cumulative) {
    if (val > peak) peak = val;
    maxDrawdown = Math.max(maxDrawdown, peak - val);
  }

  return {
    totalPnl,
    totalTradingDays: uniqueDays,
    totalTrades: trades.length,
    wins: winningTrades.length,
    losses: losingTrades.length,
    winRate: (winningTrades.length / trades.length) * 100,
    avgWin, avgLoss,
    rrRatio: avgLoss > 0 ? avgWin / avgLoss : 0,
    expectancy: totalPnl / trades.length,
    profitFactor: sumLosses > 0 ? sumWins / sumLosses : 0,
    rulesFollowedPct: (rulesFollowed / trades.length) * 100,
    bestWinStreak: bestStreak,
    maxDrawdown,
    recentForm: trades.slice(-10).map(t => ({ win: t.actualProfit > 0, pnl: t.actualProfit })),
    cumulativePnl: cumulative,
  };
}

export function computeSegmentStats(trades: Trade[]): SegmentStats[] {
  const map = new Map<string, Trade[]>();
  for (const t of trades) {
    if (!map.has(t.segment)) map.set(t.segment, []);
    map.get(t.segment)!.push(t);
  }
  const result: SegmentStats[] = [];
  for (const [segment, segTrades] of map.entries()) {
    const wins   = segTrades.filter(t => t.actualProfit > 0);
    const losses = segTrades.filter(t => t.actualProfit < 0);
    const totalPnl  = segTrades.reduce((s, t) => s + t.actualProfit, 0);
    const sumWins   = wins.reduce((s, t) => s + t.actualProfit, 0);
    const sumLosses = Math.abs(losses.reduce((s, t) => s + t.actualProfit, 0));
    result.push({
      segment, totalPnl,
      trades: segTrades.length,
      wins: wins.length, losses: losses.length,
      winRate: (wins.length / segTrades.length) * 100,
      avgTrade: totalPnl / segTrades.length,
      profitFactor: sumLosses > 0 ? sumWins / sumLosses : 0,
      avgWin:  wins.length   ? sumWins / wins.length       : 0,
      avgLoss: losses.length ? -sumLosses / losses.length  : 0,
    });
  }
  return result.sort((a, b) => b.totalPnl - a.totalPnl);
}

function getInstrumentGroup(segment: string): string | null {
  const s = segment.toLowerCase().replace(/\s+/g, '');
  if (s.includes('niftybull'))   return 'NiftyBull';
  if (s.includes('sensexbull'))  return 'SensexBull';
  if (s.startsWith('banknifty')) return 'Banknifty';
  if (s.startsWith('nifty'))     return 'Nifty';
  if (s.startsWith('sensex'))    return 'Sensex';
  return null;
}

function isCE(segment: string): boolean {
  return segment.toLowerCase().includes('ce');
}

export function computeGroupedSegments(trades: Trade[]): InstrumentGroup[] {
  const groupMap = new Map<string, { ceTrades: Trade[]; peTrades: Trade[]; segments: Set<string> }>();
  const ORDER = ['Nifty', 'Banknifty', 'Sensex', 'NiftyBull', 'SensexBull'];

  for (const t of trades) {
    const group = getInstrumentGroup(t.segment);
    if (!group) continue;
    if (!groupMap.has(group)) groupMap.set(group, { ceTrades: [], peTrades: [], segments: new Set() });
    const g = groupMap.get(group)!;
    g.segments.add(t.segment);
    if (isCE(t.segment)) g.ceTrades.push(t); else g.peTrades.push(t);
  }

  const result: InstrumentGroup[] = [];
  for (const name of ORDER) {
    const g = groupMap.get(name);
    if (!g) continue;
    const allTrades = [...g.ceTrades, ...g.peTrades];
    const wins      = allTrades.filter(t => t.actualProfit > 0);
    const losses    = allTrades.filter(t => t.actualProfit < 0);
    const totalPnl  = allTrades.reduce((s, t) => s + t.actualProfit, 0);
    const cePnl     = g.ceTrades.reduce((s, t) => s + t.actualProfit, 0);
    const pePnl     = g.peTrades.reduce((s, t) => s + t.actualProfit, 0);
    const ceWins    = g.ceTrades.filter(t => t.actualProfit > 0).length;
    const peWins    = g.peTrades.filter(t => t.actualProfit > 0).length;
    const sumWins   = wins.reduce((s, t) => s + t.actualProfit, 0);
    const sumLosses = Math.abs(losses.reduce((s, t) => s + t.actualProfit, 0));
    result.push({
      name, totalPnl,
      trades: allTrades.length,
      wins: wins.length,
      winRate: allTrades.length > 0 ? (wins.length / allTrades.length) * 100 : 0,
      cePnl, pePnl, ceWins, peWins,
      ceWinRate: g.ceTrades.length > 0 ? (ceWins / g.ceTrades.length) * 100 : 0,
      peWinRate: g.peTrades.length > 0 ? (peWins / g.peTrades.length) * 100 : 0,
      ceTrades: g.ceTrades.length,
      peTrades: g.peTrades.length,
      profitFactor: sumLosses > 0 ? sumWins / sumLosses : 0,
      avgTrade: allTrades.length > 0 ? totalPnl / allTrades.length : 0,
      segments: Array.from(g.segments).sort(),
    });
  }
  return result.sort((a, b) => b.totalPnl - a.totalPnl);
}

export function computeDayPnl(trades: Trade[]): DayPnl[] {
  const map = new Map<string, { pnl: number; date: Date; count: number; tax: number }>();
  for (const t of trades) {
    if (!map.has(t.dateStr)) map.set(t.dateStr, { pnl: 0, date: t.date, count: 0, tax: 0 });
    const d = map.get(t.dateStr)!;
    d.pnl += t.actualProfit; d.tax += t.tax; d.count++;
  }
  return Array.from(map.entries())
    .map(([dateStr, v]) => ({ dateStr, date: v.date, pnl: v.pnl, trades: v.count, tax: v.tax }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function formatPnl(val: number, compact = true): string {
  const abs  = Math.abs(val);
  const sign = val >= 0 ? '+' : '-';
  if (compact && abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(abs >= 10000 ? 1 : 2)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

export function formatPnlFull(val: number): string {
  const abs  = Math.abs(val);
  const sign = val >= 0 ? '+' : '-';
  return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

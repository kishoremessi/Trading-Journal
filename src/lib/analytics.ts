import type { Trade } from './sheetParser';
import type { DayPnl } from './stats';

export function getFilteredTrades(trades: Trade[], year: string, month: string): Trade[] {
  return trades.filter(t => {
    const y = t.date.getFullYear();
    const m = t.date.getMonth() + 1;
    if (year !== 'all' && y !== parseInt(year)) return false;
    if (month !== 'all' && m !== parseInt(month)) return false;
    return true;
  });
}

export function getAvailableYears(trades: Trade[]): number[] {
  const years = new Set(trades.map(t => t.date.getFullYear()));
  return Array.from(years).sort();
}

export interface EquityPoint {
  date: string;
  equity: number;
  drawdown: number;
  tradeNum: number;
}

export function calculateEquityCurve(trades: Trade[]): EquityPoint[] {
  let running = 0;
  let peak = 0;
  return trades.map((t, i) => {
    running += t.actualProfit;
    if (running > peak) peak = running;
    const drawdown = peak > 0 ? ((peak - running) / peak) * 100 : 0;
    return {
      date: t.dateStr,
      equity: running,
      drawdown,
      tradeNum: i + 1,
    };
  });
}

export interface DrawdownInfo {
  maxDrawdown: number;
  maxDrawdownPct: number;
  avgDrawdown: number;
  currentDrawdown: number;
  peakEquity: number;
  currentEquity: number;
  recoveryPct: number;
}

export function calculateDrawdowns(trades: Trade[]): DrawdownInfo {
  if (!trades.length) return { maxDrawdown: 0, maxDrawdownPct: 0, avgDrawdown: 0, currentDrawdown: 0, peakEquity: 0, currentEquity: 0, recoveryPct: 0 };
  let running = 0, peak = 0, maxDD = 0;
  const drawdowns: number[] = [];
  for (const t of trades) {
    running += t.actualProfit;
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDD) maxDD = dd;
    if (dd > 0) drawdowns.push(dd);
  }
  const maxDdPct = peak > 0 ? (maxDD / peak) * 100 : 0;
  const avgDD = drawdowns.length ? drawdowns.reduce((s, v) => s + v, 0) / drawdowns.length : 0;
  const currentDD = peak - running;
  const recoveryPct = maxDD > 0 ? Math.min(100, ((maxDD - currentDD) / maxDD) * 100) : 100;
  return {
    maxDrawdown: maxDD,
    maxDrawdownPct: maxDdPct,
    avgDrawdown: avgDD,
    currentDrawdown: currentDD,
    peakEquity: peak,
    currentEquity: running,
    recoveryPct,
  };
}

export interface MonthlyStats {
  year: number;
  month: number;
  monthLabel: string;
  pnl: number;
  trades: number;
  wins: number;
  winRate: number;
  drawdown: number;
}

export function calculateMonthlyStats(trades: Trade[]): MonthlyStats[] {
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const map = new Map<string, { year: number; month: number; trades: Trade[] }>();
  for (const t of trades) {
    const y = t.date.getFullYear(), m = t.date.getMonth();
    const key = `${y}-${m}`;
    if (!map.has(key)) map.set(key, { year: y, month: m, trades: [] });
    map.get(key)!.trades.push(t);
  }
  const result: MonthlyStats[] = [];
  for (const [, entry] of map) {
    const wins = entry.trades.filter(t => t.actualProfit > 0);
    const pnl = entry.trades.reduce((s, t) => s + t.actualProfit, 0);
    let peak = 0, cum = 0, maxDD = 0;
    for (const t of entry.trades) { cum += t.actualProfit; if (cum > peak) peak = cum; maxDD = Math.max(maxDD, peak - cum); }
    result.push({
      year: entry.year,
      month: entry.month,
      monthLabel: `${MONTH_NAMES[entry.month]} ${entry.year}`,
      pnl,
      trades: entry.trades.length,
      wins: wins.length,
      winRate: entry.trades.length ? (wins.length / entry.trades.length) * 100 : 0,
      drawdown: maxDD,
    });
  }
  return result.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
}

export interface PredictiveMetrics {
  avgMonthlyPnl: number;
  avgMonthlyLoss: number;
  bestMonth: MonthlyStats | null;
  worstMonth: MonthlyStats | null;
  highestDDMonth: MonthlyStats | null;
  avgMonthlyDD: number;
  equityCurveStability: number;
  volatilityScore: number;
  consistencyRating: number;
  algoStabilityRating: number;
  riskOfRuin: number;
  recoverySpeed: number;
  capitalEfficiency: number;
  psychologicalPressure: number;
  profitableMonths: number;
  losingMonths: number;
}

export function calculatePredictiveMetrics(trades: Trade[], monthlyStats: MonthlyStats[]): PredictiveMetrics {
  if (!trades.length || !monthlyStats.length) {
    return {
      avgMonthlyPnl: 0, avgMonthlyLoss: 0, bestMonth: null, worstMonth: null,
      highestDDMonth: null, avgMonthlyDD: 0, equityCurveStability: 0, volatilityScore: 0,
      consistencyRating: 0, algoStabilityRating: 0, riskOfRuin: 0, recoverySpeed: 0,
      capitalEfficiency: 0, psychologicalPressure: 0, profitableMonths: 0, losingMonths: 0,
    };
  }

  const profitableMonths = monthlyStats.filter(m => m.pnl > 0);
  const losingMonths = monthlyStats.filter(m => m.pnl < 0);
  const pnls = monthlyStats.map(m => m.pnl);
  const avgMonthlyPnl = pnls.reduce((s, v) => s + v, 0) / pnls.length;
  const lossPnls = losingMonths.map(m => Math.abs(m.pnl));
  const avgMonthlyLoss = lossPnls.length ? lossPnls.reduce((s, v) => s + v, 0) / lossPnls.length : 0;

  const bestMonth = monthlyStats.reduce((best, m) => m.pnl > (best?.pnl ?? -Infinity) ? m : best, monthlyStats[0]);
  const worstMonth = monthlyStats.reduce((worst, m) => m.pnl < (worst?.pnl ?? Infinity) ? m : worst, monthlyStats[0]);
  const highestDDMonth = monthlyStats.reduce((worst, m) => m.drawdown > (worst?.drawdown ?? -Infinity) ? m : worst, monthlyStats[0]);

  const avgMonthlyDD = monthlyStats.reduce((s, m) => s + m.drawdown, 0) / monthlyStats.length;

  const mean = avgMonthlyPnl;
  const variance = pnls.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / pnls.length;
  const stdDev = Math.sqrt(variance);
  const volatilityScore = mean !== 0 ? Math.min(100, Math.max(0, 100 - (stdDev / Math.abs(mean)) * 20)) : 50;

  const consistencyRating = Math.min(100, Math.max(0,
    (profitableMonths.length / monthlyStats.length) * 60 +
    (monthlyStats.length >= 3 ? 20 : 0) +
    (volatilityScore / 100) * 20
  ));

  const wins = trades.filter(t => t.actualProfit > 0);
  const losses = trades.filter(t => t.actualProfit < 0);
  const winRate = wins.length / trades.length;
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.actualProfit, 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((s, t) => s + t.actualProfit, 0) / losses.length) : 1;
  const rrRatio = avgLoss > 0 ? avgWin / avgLoss : 0;

  const pRuin = avgLoss > 0 && winRate < 1 ? Math.pow((1 - winRate) / winRate, 1 / rrRatio) : 0;
  const riskOfRuin = Math.min(100, pRuin * 100);

  const algoStabilityRating = Math.min(100, Math.max(0,
    (winRate * 40) + (Math.min(rrRatio, 3) / 3 * 30) + (consistencyRating / 100 * 30)
  ));

  const equityCurveStability = Math.min(100, Math.max(0, 100 - (avgMonthlyDD / (Math.abs(avgMonthlyPnl) || 1)) * 10));

  const capitalEfficiency = rrRatio > 0 && winRate > 0
    ? Math.min(100, (winRate * rrRatio) * 50)
    : 0;

  const recoverySpeed = monthlyStats.length > 1 ? Math.min(100, (profitableMonths.length / monthlyStats.length) * 100) : 50;

  const psychologicalPressure = Math.min(100, Math.max(0,
    (1 - winRate) * 40 + (avgMonthlyDD / (Math.abs(avgMonthlyPnl) || 1)) * 30 + (losingMonths.length / monthlyStats.length) * 30
  ));

  return {
    avgMonthlyPnl, avgMonthlyLoss, bestMonth, worstMonth, highestDDMonth,
    avgMonthlyDD, equityCurveStability, volatilityScore, consistencyRating,
    algoStabilityRating, riskOfRuin, recoverySpeed, capitalEfficiency,
    psychologicalPressure, profitableMonths: profitableMonths.length,
    losingMonths: losingMonths.length,
  };
}

export interface Achievement {
  id: string;
  category: 'discipline' | 'consistency' | 'risk' | 'performance';
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
  progress: number;
  target: number;
  badge?: string;
}

export function calculateAchievements(trades: Trade[], monthlyStats: MonthlyStats[]): Achievement[] {
  const wins = trades.filter(t => t.actualProfit > 0);
  const totalPnl = trades.reduce((s, t) => s + t.actualProfit, 0);
  const winRate = trades.length ? (wins.length / trades.length) * 100 : 0;
  const rulesFollowedPct = trades.length ? (trades.filter(t => t.rulesFollowed).length / trades.length) * 100 : 0;
  const profitableMonths = monthlyStats.filter(m => m.pnl > 0).length;

  const winningTrades = trades.filter(t => t.actualProfit > 0);
  const losingTrades = trades.filter(t => t.actualProfit < 0);
  const sumWins = winningTrades.reduce((s, t) => s + t.actualProfit, 0);
  const sumLosses = Math.abs(losingTrades.reduce((s, t) => s + t.actualProfit, 0));
  const profitFactor = sumLosses > 0 ? sumWins / sumLosses : 0;

  let bestStreak = 0, curStreak = 0;
  for (const t of trades) {
    if (t.actualProfit > 0) { curStreak++; bestStreak = Math.max(bestStreak, curStreak); }
    else curStreak = 0;
  }

  let curLoseStreak = 0, worstLoseStreak = 0;
  for (const t of trades) {
    if (t.actualProfit < 0) { curLoseStreak++; worstLoseStreak = Math.max(worstLoseStreak, curLoseStreak); }
    else curLoseStreak = 0;
  }

  const ddInfo = calculateDrawdowns(trades);

  const allRulesFollowed = rulesFollowedPct >= 100;
  const noRevengeTrades = worstLoseStreak <= 2;

  return [
    {
      id: 'rules-30d', category: 'discipline', icon: '🛡️',
      title: '100% Rule-Based Entries',
      description: 'All trades follow entry rules with zero exceptions.',
      unlocked: rulesFollowedPct >= 100,
      progress: Math.min(100, rulesFollowedPct),
      target: 100,
    },
    {
      id: 'no-revenge', category: 'discipline', icon: '🧘',
      title: 'Zero Revenge Trades',
      description: 'No losing streak beyond 2 consecutive losses detected.',
      unlocked: noRevengeTrades,
      progress: noRevengeTrades ? 100 : Math.max(0, 100 - worstLoseStreak * 20),
      target: 100,
    },
    {
      id: 'consistent-sizing', category: 'discipline', icon: '⚖️',
      title: 'Consistent Position Sizing',
      description: 'Trade discipline across all positions with rule adherence ≥ 90%.',
      unlocked: rulesFollowedPct >= 90,
      progress: Math.min(100, rulesFollowedPct),
      target: 90,
    },
    {
      id: '3-profitable-months', category: 'consistency', icon: '📅',
      title: '3 Profitable Months',
      description: 'Achieve 3 or more profitable months in the journal.',
      unlocked: profitableMonths >= 3,
      progress: Math.min(100, (profitableMonths / 3) * 100),
      target: 3,
      badge: profitableMonths >= 3 ? 'Highly Stable' : undefined,
    },
    {
      id: '6-profitable-months', category: 'consistency', icon: '🗓️',
      title: '6 Profitable Months',
      description: 'Sustain profitability across half a year.',
      unlocked: profitableMonths >= 6,
      progress: Math.min(100, (profitableMonths / 6) * 100),
      target: 6,
      badge: profitableMonths >= 6 ? 'Momentum Edge' : undefined,
    },
    {
      id: '12-profitable-months', category: 'consistency', icon: '🏆',
      title: '12 Profitable Months',
      description: 'A full year of profitable months — elite consistency.',
      unlocked: profitableMonths >= 12,
      progress: Math.min(100, (profitableMonths / 12) * 100),
      target: 12,
    },
    {
      id: 'stable-equity', category: 'consistency', icon: '📈',
      title: 'Stable Equity Curve',
      description: 'Max drawdown stays below 15% of peak equity.',
      unlocked: ddInfo.maxDrawdownPct < 15,
      progress: Math.min(100, Math.max(0, 100 - ddInfo.maxDrawdownPct * 2)),
      target: 100,
    },
    {
      id: 'dd-under-10', category: 'risk', icon: '🛡️',
      title: 'Drawdown Under 10%',
      description: 'Max drawdown contained below 10% of peak.',
      unlocked: ddInfo.maxDrawdownPct < 10,
      progress: Math.min(100, Math.max(0, 100 - ddInfo.maxDrawdownPct * 5)),
      target: 100,
      badge: ddInfo.maxDrawdownPct < 10 ? 'Risk Controlled Trader' : undefined,
    },
    {
      id: 'recovery-master', category: 'risk', icon: '⚡',
      title: 'Recovery Master',
      description: 'Recovered from a drawdown to new equity highs.',
      unlocked: ddInfo.recoveryPct >= 100,
      progress: Math.min(100, ddInfo.recoveryPct),
      target: 100,
    },
    {
      id: 'no-blowup', category: 'risk', icon: '🔒',
      title: 'No Blowup Month',
      description: 'No single month with loss exceeding 20% of capital.',
      unlocked: monthlyStats.every(m => Math.abs(m.pnl) < 50000 * 0.2 || m.pnl > 0),
      progress: monthlyStats.every(m => Math.abs(m.pnl) < 50000 * 0.2 || m.pnl > 0) ? 100 : 30,
      target: 100,
      badge: 'Low Reliability' as const,
    },
    {
      id: 'profit-50k', category: 'performance', icon: '💰',
      title: '₹50K Total Profit',
      description: 'Cumulative P&L reaches ₹50,000.',
      unlocked: totalPnl >= 50000,
      progress: Math.min(100, (totalPnl / 50000) * 100),
      target: 100,
    },
    {
      id: 'profit-1l', category: 'performance', icon: '💎',
      title: '₹1L Total Profit',
      description: 'Cumulative P&L reaches ₹1,00,000.',
      unlocked: totalPnl >= 100000,
      progress: Math.min(100, (totalPnl / 100000) * 100),
      target: 100,
    },
    {
      id: 'win-rate-55', category: 'performance', icon: '🎯',
      title: '55% Win Rate',
      description: 'Sustained win rate above 55% across all trades.',
      unlocked: winRate >= 55,
      progress: Math.min(100, (winRate / 55) * 100),
      target: 100,
    },
    {
      id: 'profit-factor-1.5', category: 'performance', icon: '⚡',
      title: 'Profit Factor Above 1.5',
      description: 'Gross wins are 1.5× gross losses — robust edge.',
      unlocked: profitFactor >= 1.5,
      progress: Math.min(100, (profitFactor / 1.5) * 100),
      target: 100,
      badge: profitFactor >= 1.5 ? 'Momentum Edge' : undefined,
    },
  ];
}

export function generateFutureInsights(
  trades: Trade[],
  monthlyStats: MonthlyStats[],
  predictive: PredictiveMetrics
): Array<{ icon: string; title: string; body: string; color: string }> {
  const insights: Array<{ icon: string; title: string; body: string; color: string }> = [];
  const wins = trades.filter(t => t.actualProfit > 0);
  const winRate = trades.length ? (wins.length / trades.length) * 100 : 0;
  const winningTrades = wins;
  const losingTrades = trades.filter(t => t.actualProfit < 0);
  const avgWin = winningTrades.length ? winningTrades.reduce((s, t) => s + t.actualProfit, 0) / winningTrades.length : 0;
  const avgLoss = losingTrades.length ? Math.abs(losingTrades.reduce((s, t) => s + t.actualProfit, 0) / losingTrades.length) : 0;
  const rrRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
  const totalPnl = trades.reduce((s, t) => s + t.actualProfit, 0);

  if (predictive.equityCurveStability > 70) {
    insights.push({ icon: '📈', title: 'Current expectancy supports gradual scaling.', body: `Your equity curve stability score is ${predictive.equityCurveStability.toFixed(0)}/100 — a smooth curve signals readiness to add lots systematically.`, color: 'border-l-emerald-400 bg-emerald-50/60' });
  }

  const recentTrades = trades.slice(-30);
  const recentWins = recentTrades.filter(t => t.actualProfit > 0);
  const recentWinRate = recentTrades.length ? (recentWins.length / recentTrades.length) * 100 : 0;
  if (recentWinRate > winRate && recentTrades.length >= 10) {
    insights.push({ icon: '🚀', title: `Recent ${recentTrades.length}-trade consistency improving.`, body: `Win rate in last ${recentTrades.length} trades: ${recentWinRate.toFixed(1)}% vs overall ${winRate.toFixed(1)}%. Momentum is accelerating.`, color: 'border-l-blue-400 bg-blue-50/60' });
  } else if (recentTrades.length >= 10) {
    insights.push({ icon: '⚠️', title: `Monitor recent ${recentTrades.length}-trade window carefully.`, body: `Recent win rate ${recentWinRate.toFixed(1)}% vs overall ${winRate.toFixed(1)}%. Stay disciplined — do not deviate from your algo rules.`, color: 'border-l-amber-400 bg-amber-50/60' });
  }

  if (rrRatio < 1.5) {
    insights.push({ icon: '🎯', title: 'Avoid overleveraging during low R:R months.', body: `Current R:R of ${rrRatio.toFixed(2)} leaves thin margin. Scale capital only when R:R consistently exceeds 1.5.`, color: 'border-l-orange-400 bg-orange-50/60' });
  }

  if (predictive.consistencyRating > 65) {
    insights.push({ icon: '⚙️', title: 'System strongest during trending environments.', body: `Consistency rating ${predictive.consistencyRating.toFixed(0)}/100. Algo performs best in directional markets — avoid ranging, choppy periods.`, color: 'border-l-violet-400 bg-violet-50/60' });
  }

  if (predictive.riskOfRuin < 5) {
    insights.push({ icon: '🛡️', title: 'Current drawdown structure remains healthy.', body: `Risk-of-ruin estimated at ${predictive.riskOfRuin.toFixed(1)}% — very low. Your position sizing and R:R combination is protecting capital effectively.`, color: 'border-l-green-400 bg-green-50/60' });
  } else if (predictive.riskOfRuin > 20) {
    insights.push({ icon: '⚠️', title: 'Risk of ruin elevated — reduce size.', body: `Estimated risk-of-ruin at ${predictive.riskOfRuin.toFixed(1)}%. Consider reducing lot size or improving R:R before scaling.`, color: 'border-l-red-400 bg-red-50/60' });
  }

  if (rrRatio > 1.5 && winRate < 50) {
    insights.push({ icon: '💡', title: 'Win rate stable but R:R compression detected.', body: `Win rate ${winRate.toFixed(1)}% is below 50% but R:R of ${rrRatio.toFixed(2)} keeps expectancy positive. Protect your R:R at all costs.`, color: 'border-l-blue-400 bg-blue-50/60' });
  }

  if (totalPnl > 0 && monthlyStats.length >= 3) {
    const growthRate = ((totalPnl / (monthlyStats.length * 50000)) * 100).toFixed(1);
    insights.push({ icon: '💰', title: `${growthRate}% estimated monthly capital growth rate.`, body: `Based on ${monthlyStats.length} months of data. Compound this consistently to reach your capital targets.`, color: 'border-l-teal-400 bg-teal-50/60' });
  }

  return insights.slice(0, 6);
}

import { useState, useMemo } from 'react';
import {
  ComposedChart, AreaChart, Area, Line, Bar, BarChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceDot, Cell,
} from 'recharts';
import {
  TradeStats, SegmentStats, DayPnl, InstrumentGroup,
  formatPnl, formatPnlFull,
  computeStats, computeSegmentStats, computeGroupedSegments, computeDayPnl,
} from '../lib/stats';
import type { Historical2025, Trade } from '../lib/sheetParser';
import {
  getFilteredTrades, getAvailableYears, calculateEquityCurve,
  calculateDrawdowns, calculateMonthlyStats, calculatePredictiveMetrics,
  calculateAchievements, generateFutureInsights,
  type Achievement, type MonthlyStats,
} from '../lib/analytics';

interface Props {
  stats: TradeStats;
  segments: SegmentStats[];
  groupedSegments: InstrumentGroup[];
  dayPnls: DayPnl[];
  historical2025: Historical2025;
  trades: Trade[];
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtFull(v: number) {
  const abs = Math.abs(v);
  const sign = v >= 0 ? '+' : '-';
  return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
function fmtK(v: number) {
  const abs = Math.abs(v);
  const sign = v >= 0 ? '+' : '-';
  return `${sign}₹${(abs / 1000).toFixed(1)}K`;
}

/* ── Section 1: Expectancy Banner ────────────────────────────── */
function ExpectancyBanner({ stats, year, month, filteredTrades }: {
  stats: TradeStats; year: string; month: string; filteredTrades: Trade[];
}) {
  const periodLabel = useMemo(() => {
    if (year === 'all' && month === 'all') return 'All Time';
    if (year !== 'all' && month === 'all') return `Full ${year}`;
    if (year !== 'all' && month !== 'all') return `${MONTH_NAMES[parseInt(month)-1]} ${year}`;
    return `All Years · ${MONTH_NAMES[parseInt(month)-1]}`;
  }, [year, month]);

  const info = useMemo(() => {
    const { expectancy, winRate, profitFactor, totalTrades } = stats;
    const dd = calculateDrawdowns(filteredTrades);
    if (expectancy <= 0) return {
      emoji: '⚠️', title: 'System Review Needed',
      body: `Negative expectancy of ${formatPnl(expectancy)}/trade across ${totalTrades} trades. Revisit entry criteria.`,
      bg: 'bg-red-50 border-red-200', titleColor: 'text-red-700',
      badge: 'Performance Weakening', badgeColor: 'bg-red-100 text-red-700 border-red-200',
    };
    if (dd.maxDrawdownPct > 20) return {
      emoji: '📉', title: 'Drawdown Recovery Phase',
      body: `Positive expectancy ${formatPnl(expectancy)}/trade — but drawdown at ${dd.maxDrawdownPct.toFixed(1)}%. Reduce size until equity recovers.`,
      bg: 'bg-green-50 border-green-200', titleColor: 'text-green-700',
      badge: 'Drawdown Recovery Phase', badgeColor: 'bg-green-100 text-green-700 border-green-200',
    };
    if (totalTrades < 20) return {
      emoji: '🔬', title: 'Edge Building — Early Data',
      body: `${formatPnl(expectancy)}/trade across ${totalTrades} trades. Accumulate more trades for statistical significance.`,
      bg: 'bg-blue-50 border-blue-200', titleColor: 'text-blue-700',
      badge: 'High Volatility Period', badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
    };
    if (profitFactor > 2 && winRate > 60) return {
      emoji: '✨', title: 'Strong Edge Detected',
      body: `${formatPnl(expectancy)}/trade · ${winRate.toFixed(1)}% WR · ${profitFactor.toFixed(2)} PF — exceptional performance.`,
      bg: 'bg-green-50 border-green-200', titleColor: 'text-green-700',
      badge: 'Strong Edge Detected', badgeColor: 'bg-green-100 text-green-700 border-green-200',
    };
    return {
      emoji: '📈', title: 'Positive Expectancy Confirmed',
      body: `${formatPnl(expectancy)}/trade average across ${totalTrades} trades · ${profitFactor.toFixed(2)} PF. Stay consistent.`,
      bg: 'bg-emerald-50 border-emerald-200', titleColor: 'text-emerald-700',
      badge: 'System Stable', badgeColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    };
  }, [stats, filteredTrades]);

  return (
    <div className={`rounded-2xl p-5 border ${info.bg}`}>
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex-1 min-w-0">
          <h2 className={`text-base font-bold mb-1 ${info.titleColor}`}>{info.emoji} {info.title}</h2>
          <p className="text-sm text-gray-600 leading-relaxed">{info.body}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${info.badgeColor}`}>{info.badge}</span>
          <span className="text-xs text-gray-400 border border-gray-200 rounded-full px-2 py-0.5">{periodLabel}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-5 mt-4 pt-3 border-t border-black/5">
        {[
          { label: 'Expectancy/Trade', val: formatPnl(stats.expectancy), color: stats.expectancy >= 0 ? 'text-green-600' : 'text-red-500' },
          { label: 'Total Trades', val: String(stats.totalTrades), color: 'text-gray-800' },
          { label: 'Win Rate', val: `${stats.winRate.toFixed(1)}%`, color: 'text-gray-800' },
          { label: 'Profit Factor', val: stats.profitFactor.toFixed(2), color: stats.profitFactor >= 1.5 ? 'text-green-600' : 'text-amber-600' },
        ].map(m => (
          <div key={m.label}>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{m.label}</p>
            <p className={`text-base font-bold font-mono mt-0.5 ${m.color}`}>{m.val}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Section 2: Filters ──────────────────────────────────────── */
export function Filters({
  allTrades, year, month, onYearChange, onMonthChange,
}: {
  allTrades: Trade[]; year: string; month: string;
  onYearChange: (y: string) => void; onMonthChange: (m: string) => void;
}) {
  const years = useMemo(() => getAvailableYears(allTrades), [allTrades]);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-xs text-gray-500 font-medium">Filter:</span>
      <select value={year} onChange={e => onYearChange(e.target.value)}
        className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 outline-none focus:ring-1 focus:ring-blue-300 cursor-pointer hover:border-gray-300 transition-colors shadow-sm">
        <option value="all">All Years</option>
        {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
      </select>
      <select value={month} onChange={e => onMonthChange(e.target.value)}
        className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 outline-none focus:ring-1 focus:ring-blue-300 cursor-pointer hover:border-gray-300 transition-colors shadow-sm">
        <option value="all">All Months</option>
        {MONTH_NAMES.map((m, i) => <option key={i} value={String(i+1)}>{m}</option>)}
      </select>
      {(year !== 'all' || month !== 'all') && (
        <button onClick={() => { onYearChange('all'); onMonthChange('all'); }}
          className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:bg-gray-50 transition-all">
          ✕ Clear
        </button>
      )}
    </div>
  );
}

/* ── Section 3: Equity Curve ─────────────────────────────────── */
function EquityCurve({ trades }: { trades: Trade[] }) {
  const equityData = useMemo(() => calculateEquityCurve(trades), [trades]);
  const ddInfo    = useMemo(() => calculateDrawdowns(trades), [trades]);

  /* equity curve + running peak per trade */
  const chartData = useMemo(() => {
    let runningPeak = 0;
    return equityData.map(p => {
      if (p.equity > runningPeak) runningPeak = p.equity;
      return {
        name:     p.date,
        equity:   Math.round(p.equity),
        peak:     Math.round(runningPeak),
        pos:      Math.round(Math.max(0, p.equity)),
        neg:      Math.round(Math.min(0, p.equity)),
        tradeNum: p.tradeNum,
      };
    });
  }, [equityData]);

  /* daily P&L bars — aggregate trades by date */
  const dayBarData = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of trades) map.set(t.dateStr, (map.get(t.dateStr) ?? 0) + t.actualProfit);
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, pnl]) => ({ date, pnl: Math.round(pnl) }));
  }, [trades]);

  /* best / worst equity points */
  const { bestIdx, worstIdx } = useMemo(() => {
    let bestIdx = 0, worstIdx = 0, bestVal = -Infinity, worstVal = Infinity;
    chartData.forEach((d, i) => {
      if (d.equity > bestVal) { bestVal = d.equity; bestIdx = i; }
      if (d.equity < worstVal) { worstVal = d.equity; worstIdx = i; }
    });
    return { bestIdx, worstIdx };
  }, [chartData]);

  /* month label ticks — show one tick per unique month/year */
  const xTickValues = useMemo(() => {
    const seen = new Set<string>();
    const ticks: string[] = [];
    for (const d of chartData) {
      try {
        const dt = new Date(d.name);
        const key = `${dt.getFullYear()}-${dt.getMonth()}`;
        if (!seen.has(key)) { seen.add(key); ticks.push(d.name); }
      } catch { /* skip */ }
    }
    return ticks;
  }, [chartData]);

  const xTickFormatter = (val: string) => {
    try {
      const d = new Date(val);
      return `${MONTH_SHORT[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
    } catch { return ''; }
  };

  const monthlyGrowthEst = trades.length > 0
    ? ((ddInfo.currentEquity / Math.max(1, trades.length / 20)) / 50000) * 100 : 0;

  const bestPoint  = chartData[bestIdx];
  const worstPoint = chartData[worstIdx];

  const EquityTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { tradeNum: number; name: string; peak: number } }> }) => {
    if (!active || !payload?.length) return null;
    const v    = payload[0].value;
    const peak = payload[0].payload.peak;
    const dd   = peak > 0 ? ((peak - v) / peak) * 100 : 0;
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg text-xs space-y-0.5">
        <p className="text-gray-400">Trade #{payload[0].payload.tradeNum} · {payload[0].payload.name}</p>
        <p className={`text-sm font-bold font-mono ${v >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {v >= 0 ? '+' : ''}₹{Math.abs(v).toLocaleString('en-IN')}
        </p>
        {dd > 0.5 && <p className="text-orange-500 font-mono">DD −{dd.toFixed(1)}% from peak</p>}
      </div>
    );
  };

  const DayTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { date: string } }> }) => {
    if (!active || !payload?.length) return null;
    const v = payload[0].value;
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-2 shadow text-xs">
        <p className="text-gray-400">{payload[0].payload.date}</p>
        <p className={`font-bold font-mono ${v >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {v >= 0 ? '+' : ''}₹{Math.abs(v).toLocaleString('en-IN')}
        </p>
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

      {/* ── Stats header ── */}
      <div className="flex flex-wrap gap-5 px-5 py-4 border-b border-gray-100">
        {[
          { label: 'Current Equity',    val: fmtFull(ddInfo.currentEquity),   color: ddInfo.currentEquity >= 0 ? 'text-green-600' : 'text-red-500' },
          { label: 'Peak Equity',       val: fmtFull(ddInfo.peakEquity),       color: 'text-gray-800' },
          { label: 'Current Drawdown',  val: ddInfo.currentDrawdown > 0 ? fmtK(-ddInfo.currentDrawdown) : 'At Peak', color: ddInfo.currentDrawdown > 0 ? 'text-orange-500' : 'text-green-600' },
          { label: 'Recovery',          val: `${ddInfo.recoveryPct.toFixed(0)}%`, color: ddInfo.recoveryPct >= 100 ? 'text-green-600' : 'text-amber-500' },
          { label: 'Est. Monthly Growth', val: `${monthlyGrowthEst >= 0 ? '+' : ''}${monthlyGrowthEst.toFixed(1)}%`, color: monthlyGrowthEst >= 0 ? 'text-blue-600' : 'text-red-500' },
        ].map(m => (
          <div key={m.label}>
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{m.label}</p>
            <p className={`text-lg font-bold font-mono mt-0.5 ${m.color}`}>{m.val}</p>
          </div>
        ))}
      </div>

      {/* ── Chart legend ── */}
      <div className="flex items-center gap-5 px-5 pt-3 pb-0">
        <div className="flex items-center gap-1.5">
          <svg width="16" height="8"><path d="M0 4 L16 4" stroke="#16a34a" strokeWidth="2.5" /></svg>
          <span className="text-[10px] text-gray-500">Equity Curve</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="16" height="8"><path d="M0 4 L4 4 M6 4 L10 4 M12 4 L16 4" stroke="#9ca3af" strokeWidth="1.5" /></svg>
          <span className="text-[10px] text-gray-500">Running Peak</span>
        </div>
        {bestPoint && bestPoint.equity > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-green-600 ring-2 ring-white ring-offset-0 shadow" />
            <span className="text-[10px] text-gray-500">All-time High</span>
          </div>
        )}
        {worstPoint && worstPoint.equity < 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white shadow" />
            <span className="text-[10px] text-gray-500">Max Drawdown</span>
          </div>
        )}
      </div>

      {/* ── Equity + peak chart ── */}
      <div className="px-2 pt-1 pb-0 bg-white" style={{ height: 260 }}>
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 14, right: 16, left: 0, bottom: 0 }} style={{ background: '#ffffff' }}>
              <defs>
                <linearGradient id="posGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="negGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#dc2626" stopOpacity={0.02} />
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0.22} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tickFormatter={xTickFormatter} ticks={xTickValues}
                tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} interval={0} angle={-30} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false}
                tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} width={56} />
              <ReferenceLine y={0} stroke="#d1d5db" strokeDasharray="4 2" strokeWidth={1.5} />
              <Tooltip content={<EquityTooltip />} />

              {/* Running peak dashed line */}
              <Line type="monotone" dataKey="peak" stroke="#d1d5db" strokeWidth={1.5}
                strokeDasharray="5 3" dot={false} activeDot={false} />

              {/* Equity fill areas */}
              <Area type="monotone" dataKey="pos" stroke="#16a34a" strokeWidth={2.5}
                fill="url(#posGrad2)" dot={false}
                activeDot={{ r: 4, fill: '#16a34a', strokeWidth: 0 }} animationDuration={600} />
              <Area type="monotone" dataKey="neg" stroke="#dc2626" strokeWidth={2.5}
                fill="url(#negGrad2)" dot={false}
                activeDot={{ r: 4, fill: '#dc2626', strokeWidth: 0 }} animationDuration={600} />

              {/* All-time high dot */}
              {bestPoint && bestPoint.equity > 0 && (
                <ReferenceDot x={bestPoint.name} y={bestPoint.equity} r={5}
                  fill="#16a34a" stroke="#fff" strokeWidth={2}
                  label={{ value: `▲ ${fmtK(bestPoint.equity)}`, position: 'top', fontSize: 10, fill: '#16a34a', fontWeight: 700 }} />
              )}

              {/* Max drawdown dot */}
              {worstPoint && worstPoint.equity < 0 && worstIdx !== bestIdx && (
                <ReferenceDot x={worstPoint.name} y={worstPoint.equity} r={5}
                  fill="#dc2626" stroke="#fff" strokeWidth={2}
                  label={{ value: `▼ ${fmtK(worstPoint.equity)}`, position: 'bottom', fontSize: 10, fill: '#dc2626', fontWeight: 700 }} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            Not enough data to render equity curve.
          </div>
        )}
      </div>

      {/* ── Daily P&L pulse bars ── */}
      {dayBarData.length > 1 && (
        <div className="px-2 pb-3 border-t border-gray-50 mt-1 bg-white">
          <p className="text-[9px] text-gray-400 uppercase tracking-widest px-3 pt-2 pb-0.5">Daily P&amp;L Pulse</p>
          <div className="bg-white" style={{ height: 60 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayBarData} margin={{ top: 2, right: 16, left: 0, bottom: 0 }} barCategoryGap="15%" style={{ background: '#ffffff' }}>
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={1} />
                <Tooltip content={<DayTooltip />} />
                <Bar dataKey="pnl" radius={[2, 2, 0, 0]} maxBarSize={10}>
                  {dayBarData.map((entry, i) => (
                    <Cell key={i} fill={entry.pnl >= 0 ? '#16a34a' : '#dc2626'} fillOpacity={0.7} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Section 4: Core Metrics — trendy redesign ───────────────── */
function CoreMetrics({ stats, trades }: { stats: TradeStats; trades: Trade[] }) {
  const ddInfo = useMemo(() => calculateDrawdowns(trades), [trades]);
  const wins   = trades.filter(t => t.actualProfit > 0);
  const losses = trades.filter(t => t.actualProfit < 0);

  let bestStreak = 0, cur = 0;
  for (const t of trades) {
    if (t.actualProfit > 0) { cur++; bestStreak = Math.max(bestStreak, cur); } else cur = 0;
  }

  const rrColor  = stats.rrRatio >= 1.5 ? '#16a34a' : stats.rrRatio >= 1 ? '#d97706' : '#dc2626';
  const pfColor  = stats.profitFactor >= 1.5 ? '#16a34a' : stats.profitFactor >= 1 ? '#d97706' : '#dc2626';
  const ddColor  = ddInfo.maxDrawdownPct < 10 ? '#16a34a' : ddInfo.maxDrawdownPct < 20 ? '#d97706' : '#dc2626';
  const wrPct    = Math.min(100, stats.winRate);

  return (
    <div className="space-y-3">
      {/* ── Hero row: 3 primary numbers ── */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-gray-100">

          {/* Total P&L */}
          <div className="px-6 py-5">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Total P&amp;L</p>
            <p className={`text-3xl font-extrabold font-mono leading-none ${stats.totalPnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {formatPnl(stats.totalPnl)}
            </p>
            <p className="text-[11px] text-gray-400 mt-1.5">{stats.totalTradingDays} trading days</p>
          </div>

          {/* Win Rate with bar */}
          <div className="px-6 py-5">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Win Rate</p>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-extrabold font-mono leading-none text-gray-900">
                {stats.winRate.toFixed(1)}<span className="text-lg text-gray-400 font-bold">%</span>
              </p>
            </div>
            <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600 transition-all"
                style={{ width: `${wrPct}%` }} />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">{stats.wins}W · {stats.losses}L of {stats.totalTrades}</p>
          </div>

          {/* Profit Factor */}
          <div className="px-6 py-5">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Profit Factor</p>
            <p className="text-3xl font-extrabold font-mono leading-none" style={{ color: pfColor }}>
              {stats.profitFactor.toFixed(2)}
            </p>
            <p className="text-[11px] text-gray-400 mt-1.5">
              {stats.profitFactor >= 1.5 ? 'Strong edge' : stats.profitFactor >= 1 ? 'Positive edge' : 'Needs work'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Secondary row: compact pills ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          {
            label: 'R:R Ratio',
            value: stats.rrRatio.toFixed(2),
            sub: `${fmtK(stats.avgWin)} / ${fmtK(-stats.avgLoss)}`,
            color: rrColor,
            accent: rrColor,
          },
          {
            label: 'Max Drawdown',
            value: fmtK(-ddInfo.maxDrawdown),
            sub: `${ddInfo.maxDrawdownPct.toFixed(1)}% of peak`,
            color: ddColor,
            accent: ddColor,
          },
          {
            label: 'Avg Trade',
            value: fmtK(stats.avgWin),
            sub: `loss avg ${fmtK(-stats.avgLoss)}`,
            color: '#16a34a',
            accent: '#16a34a',
          },
          bestStreak >= 3
            ? { label: 'Best Streak', value: `${bestStreak}`, sub: bestStreak >= 7 ? '🔥 Excellent run' : 'wins in a row', color: '#16a34a', accent: '#16a34a' }
            : { label: 'Total Trades', value: String(stats.totalTrades), sub: formatPnlFull(stats.totalPnl) + ' net', color: '#374151', accent: '#6b7280' },
        ].map(m => (
          <div key={m.label}
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm flex flex-col gap-0.5"
            style={{ borderLeftWidth: 3, borderLeftColor: m.accent }}>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{m.label}</p>
            <p className="text-xl font-extrabold font-mono leading-none" style={{ color: m.color }}>{m.value}</p>
            <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{m.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Section 5: Instrument Group Performance ─────────────────── */
function InstrumentGroups({ groups }: { groups: InstrumentGroup[] }) {
  const sorted = useMemo(() => [...groups].sort((a, b) => b.totalPnl - a.totalPnl), [groups]);
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {sorted.map((g, i) => {
        const isProfit = g.totalPnl >= 0;
        return (
          <div key={g.name} className={`rounded-xl border p-4 shadow-sm ${isProfit ? 'bg-white border-gray-200' : 'bg-red-50/50 border-red-200'}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{medals[i] ?? `#${i+1}`}</span>
                <div>
                  <p className="text-sm font-bold text-gray-900">{g.name}</p>
                  <p className="text-xs text-gray-400">{g.trades} trades · {g.winRate.toFixed(0)}% WR</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold font-mono ${isProfit ? 'text-green-600' : 'text-red-500'}`}>
                  {formatPnl(g.totalPnl, false)}
                </p>
                <p className="text-[10px] text-gray-400">combined P&L</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className={`rounded-lg p-2.5 border ${g.cePnl >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                <p className="text-[10px] text-gray-400 mb-0.5">CE · {g.ceTrades}T · {g.ceWinRate.toFixed(0)}%WR</p>
                <p className={`text-sm font-bold font-mono ${g.cePnl >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{formatPnl(g.cePnl, false)}</p>
              </div>
              <div className={`rounded-lg p-2.5 border ${g.pePnl >= 0 ? 'bg-violet-50 border-violet-200' : 'bg-red-50 border-red-200'}`}>
                <p className="text-[10px] text-gray-400 mb-0.5">PE · {g.peTrades}T · {g.peWinRate.toFixed(0)}%WR</p>
                <p className={`text-sm font-bold font-mono ${g.pePnl >= 0 ? 'text-violet-700' : 'text-red-600'}`}>{formatPnl(g.pePnl, false)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
              <span>PF: <span className={`font-mono font-semibold ${g.profitFactor >= 1.5 ? 'text-green-600' : g.profitFactor >= 1 ? 'text-amber-600' : 'text-red-500'}`}>{g.profitFactor.toFixed(2)}</span></span>
              <span>Avg: <span className={`font-mono font-semibold ${g.avgTrade >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatPnl(g.avgTrade)}</span></span>
              <span>{g.wins}W / {g.trades - g.wins}L</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Section 6: Segment Analysis ─────────────────────────────── */
const RANK_MEDALS = ['🥇','🥈','🥉'];
function getSegmentBadge(seg: SegmentStats): { label: string; color: string } {
  if (seg.winRate >= 65 && seg.profitFactor >= 1.5) return { label: 'Highly Stable', color: 'bg-green-100 text-green-700 border-green-200' };
  if (seg.winRate >= 60) return { label: 'Momentum Edge', color: 'bg-blue-100 text-blue-700 border-blue-200' };
  if (seg.trades < 5) return { label: 'Low Reliability', color: 'bg-amber-100 text-amber-700 border-amber-200' };
  if (seg.winRate < 40 || seg.totalPnl < 0) return { label: 'Avoid in Volatility', color: 'bg-red-100 text-red-600 border-red-200' };
  return { label: 'Stable', color: 'bg-teal-100 text-teal-700 border-teal-200' };
}

function SegmentCard({ seg, rank, mode }: { seg: SegmentStats; rank: number; mode: 'top' | 'under' }) {
  const badge = getSegmentBadge(seg);
  const medal = RANK_MEDALS[rank];
  return (
    <div className={`rounded-xl border px-3 py-2.5 shadow-sm flex items-center gap-3 ${mode === 'top' ? 'bg-white border-gray-200' : 'bg-red-50/40 border-red-200'}`}>
      <span className="text-base shrink-0">{medal ?? <span className="text-xs font-bold text-gray-500">#{rank+1}</span>}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-xs font-semibold text-gray-900 truncate">{seg.segment}</p>
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${badge.color}`}>{badge.label}</span>
        </div>
        <p className="text-[10px] text-gray-400 mt-0.5">{seg.trades}T · {seg.wins}W/{seg.losses}L · PF {seg.profitFactor.toFixed(2)}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-bold font-mono ${seg.totalPnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatPnl(seg.totalPnl, true)}</p>
        <p className={`text-[10px] font-mono ${seg.winRate >= 55 ? 'text-green-600' : seg.winRate >= 45 ? 'text-amber-600' : 'text-red-500'}`}>{seg.winRate.toFixed(0)}% WR</p>
      </div>
    </div>
  );
}

function SegmentAnalysis({ segments }: { segments: SegmentStats[] }) {
  const sorted = useMemo(() => [...segments].sort((a, b) => b.totalPnl - a.totalPnl), [segments]);
  const top = sorted.slice(0, 3);
  const under = sorted.filter(s => s.totalPnl < 0 || s.winRate < 45).slice(0, 3);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <h4 className="text-xs font-bold text-green-700 uppercase tracking-wider mb-3">🚀 Top Performing</h4>
        <div className="space-y-2">
          {top.map((s, i) => <SegmentCard key={s.segment} seg={s} rank={i} mode="top" />)}
        </div>
      </div>
      <div>
        <h4 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-3">⚠️ Underperforming</h4>
        <div className="space-y-2">
          {under.length ? under.map((s, i) => <SegmentCard key={s.segment} seg={s} rank={i} mode="under" />) : (
            <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
              <p className="text-xl mb-1">🎯</p>
              <p className="text-sm text-green-700 font-semibold">All segments profitable</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Section 7: Predictive Intelligence ─────────────────────── */
const LOT_CAPITAL = 50000;
// Returns the number of lots traded in a given month based on period
function getHistoricalLots(year: number, month: number): number {
  return (year > 2026 || (year === 2026 && month >= 2)) ? 3 : 1;
}

function PredictiveIntelligence({ trades, stats }: { trades: Trade[]; stats: TradeStats }) {
  const [lotInput, setLotInput] = useState('4');
  const customLots = Math.max(1, parseInt(lotInput) || 1);

  const monthlyStats = useMemo(() => calculateMonthlyStats(trades), [trades]);
  const predictive = useMemo(() => calculatePredictiveMetrics(trades, monthlyStats), [trades, monthlyStats]);
  const ddInfo = useMemo(() => calculateDrawdowns(trades), [trades]);

  const capital = customLots * LOT_CAPITAL;

  // Normalize each month to per-1-lot, then scale to customLots
  const perLotMonthlyAvg = useMemo(() => {
    if (!monthlyStats.length) return 0;
    const sum = monthlyStats.reduce((s, m) => s + m.pnl / getHistoricalLots(m.year, m.month), 0);
    return sum / monthlyStats.length;
  }, [monthlyStats]);

  const avgMonthly = perLotMonthlyAvg * customLots;
  const avgReturn = capital > 0 ? (avgMonthly / capital) * 100 : 0;

  // Max drawdown: normalize by avg historical lots, scale to customLots
  const avgHistLots = useMemo(() => {
    if (!monthlyStats.length) return 1;
    return monthlyStats.reduce((s, m) => s + getHistoricalLots(m.year, m.month), 0) / monthlyStats.length;
  }, [monthlyStats]);
  const maxDD = (ddInfo.maxDrawdown / avgHistLots) * customLots;
  const maxDDPct = capital > 0 ? (maxDD / capital) * 100 : 0;

  // Best / worst month: normalize per lot, scale to customLots
  const bestRaw = predictive.bestMonth;
  const worstRaw = predictive.worstMonth;
  const bestPnl = bestRaw ? (bestRaw.pnl / getHistoricalLots(bestRaw.year, bestRaw.month)) * customLots : 0;
  const bestPct = capital > 0 ? (bestPnl / capital) * 100 : 0;
  const worstPnl = worstRaw ? (worstRaw.pnl / getHistoricalLots(worstRaw.year, worstRaw.month)) * customLots : 0;
  const worstPct = capital > 0 ? (worstPnl / capital) * 100 : 0;

  const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const systemRatings = useMemo(() => {
    const stab = predictive.equityCurveStability;
    const cons = predictive.consistencyRating;
    const risk = 100 - predictive.riskOfRuin;
    const label = (v: number) => v >= 80 ? 'Excellent' : v >= 65 ? 'Stable' : v >= 45 ? 'Moderate' : 'Weak';
    const color = (v: number) => v >= 80 ? 'bg-green-100 text-green-700 border-green-200' : v >= 65 ? 'bg-blue-100 text-blue-700 border-blue-200' : v >= 45 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-red-100 text-red-600 border-red-200';
    return [
      { name: 'Stability', score: stab, label: label(stab), color: color(stab) },
      { name: 'Consistency', score: cons, label: label(cons), color: color(cons) },
      { name: 'Risk Control', score: risk, label: label(risk), color: color(risk) },
    ];
  }, [predictive]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-gray-900">Predictive Intelligence</h3>
        <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full">
          {monthlyStats.length} months analysed
        </span>
      </div>

      {/* System Ratings — simplified */}
      <div className="flex flex-wrap gap-3">
        {systemRatings.map(r => (
          <div key={r.name} className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${r.color}`}>
            <div className="w-6 h-6 rounded-full bg-white/60 flex items-center justify-center text-xs font-bold">{r.score.toFixed(0)}</div>
            <div>
              <p className="text-[10px] font-medium opacity-70">{r.name}</p>
              <p className="text-xs font-bold leading-tight">{r.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Lot Size Calculator */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">Lot Size Calculator</p>
            <p className="text-xs text-gray-400 mt-0.5">₹50,000 capital required per lot · based on historical data</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 font-medium">Lots:</label>
            <input
              type="number" min="1" max="100" value={lotInput}
              onChange={e => setLotInput(e.target.value)}
              className="w-20 text-center border border-gray-300 rounded-lg px-2 py-1.5 text-sm font-bold font-mono text-blue-700 outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all"
            />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 mb-4 flex items-center gap-3">
          <span className="text-blue-600 font-semibold text-sm">Capital Required:</span>
          <span className="text-blue-800 font-bold font-mono text-lg">₹{capital.toLocaleString('en-IN')}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <div className="bg-green-50 border border-green-200 rounded-xl p-3.5">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Avg Monthly Profit</p>
            <p className="text-2xl font-bold font-mono text-green-600">{avgMonthly > 0 ? fmtK(avgMonthly) : '—'}</p>
            <p className={`text-sm font-mono font-semibold mt-1 ${avgReturn >= 0 ? 'text-green-500' : 'text-red-400'}`}>{avgReturn >= 0 ? '+' : ''}{avgReturn.toFixed(1)}% / mo</p>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3.5">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">Max Drawdown</p>
            <p className="text-2xl font-bold font-mono text-orange-600">{maxDD > 0 ? fmtK(-maxDD) : '—'}</p>
            <p className="text-sm font-mono font-semibold text-orange-500 mt-1">-{maxDDPct.toFixed(1)}% of capital</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">If Perform Good</p>
            {predictive.bestMonth ? (
              <>
                <p className="text-2xl font-bold font-mono text-emerald-600">{fmtK(bestPnl)}</p>
                <p className="text-sm font-mono font-semibold text-emerald-500 mt-1">+{bestPct.toFixed(1)}% · {MONTH_LABELS[predictive.bestMonth.month]} {predictive.bestMonth.year}</p>
              </>
            ) : <p className="text-xl text-gray-400">—</p>}
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-3.5">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">If Perform Worst</p>
            {predictive.worstMonth ? (
              <>
                <p className="text-2xl font-bold font-mono text-red-600">{fmtK(worstPnl)}</p>
                <p className="text-sm font-mono font-semibold text-red-500 mt-1">{worstPct.toFixed(1)}% · {MONTH_LABELS[predictive.worstMonth.month]} {predictive.worstMonth.year}</p>
              </>
            ) : <p className="text-xl text-gray-400">—</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Section 8: Future Insights ──────────────────────────────── */
function FutureInsights({ trades }: { trades: Trade[] }) {
  const monthlyStats = useMemo(() => calculateMonthlyStats(trades), [trades]);
  const predictive = useMemo(() => calculatePredictiveMetrics(trades, monthlyStats), [trades, monthlyStats]);
  const insights = useMemo(() => generateFutureInsights(trades, monthlyStats, predictive), [trades, monthlyStats, predictive]);
  const COLORS = [
    'border-l-green-400 bg-green-50/60 border-green-200',
    'border-l-blue-400 bg-blue-50/60 border-blue-200',
    'border-l-amber-400 bg-amber-50/60 border-amber-200',
    'border-l-violet-400 bg-violet-50/60 border-violet-200',
    'border-l-teal-400 bg-teal-50/60 border-teal-200',
    'border-l-orange-400 bg-orange-50/60 border-orange-200',
  ];
  return (
    <div className="space-y-2.5">
      {insights.map((ins, i) => (
        <div key={i} className={`rounded-xl p-4 border-l-4 border ${COLORS[i % COLORS.length]}`}>
          <div className="flex items-start gap-2.5">
            <span className="text-base shrink-0">{ins.icon}</span>
            <div>
              <p className="text-sm font-semibold text-gray-900">{ins.title}</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{ins.body}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Section 9: Achievements ─────────────────────────────────── */
const CATEGORY_LABELS: Record<Achievement['category'], string> = {
  discipline: '🛡️ Discipline', consistency: '📅 Consistency',
  risk: '⚠️ Risk Management', performance: '💰 Performance',
};

function AchievementCard({ ach }: { ach: Achievement }) {
  return (
    <div className={`rounded-xl border p-3.5 transition-all ${
      ach.unlocked ? 'bg-amber-50 border-amber-200 shadow-sm' : 'bg-gray-50 border-gray-200 opacity-70'
    }`}>
      <div className="flex items-start gap-2.5 mb-2.5">
        <span className={`text-lg shrink-0 ${!ach.unlocked ? 'grayscale' : ''}`}>{ach.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold ${ach.unlocked ? 'text-amber-800' : 'text-gray-500'}`}>{ach.title}</p>
          <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{ach.description}</p>
        </div>
        {ach.unlocked && <span className="text-green-500 text-sm shrink-0 font-bold">✓</span>}
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
        <div className={`h-full rounded-full transition-all duration-700 ${ach.unlocked ? 'bg-amber-400' : 'bg-gray-300'}`}
          style={{ width: `${ach.progress}%` }} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-gray-400">{ach.progress.toFixed(0)}% complete</span>
        {ach.badge && (
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${ach.unlocked ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
            {ach.badge}
          </span>
        )}
      </div>
    </div>
  );
}

function AchievementsSystem({ trades }: { trades: Trade[] }) {
  const monthlyStats = useMemo(() => calculateMonthlyStats(trades), [trades]);
  const achievements = useMemo(() => calculateAchievements(trades, monthlyStats), [trades, monthlyStats]);
  const unlocked = achievements.filter(a => a.unlocked).length;
  const categories = ['discipline', 'consistency', 'risk', 'performance'] as const;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Trader Achievements</h3>
          <p className="text-xs text-gray-400 mt-0.5">Disciplined algo trading milestones</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold font-mono text-amber-600">{unlocked}/{achievements.length}</p>
          <p className="text-[10px] text-gray-400">unlocked</p>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">Overall Progress</span>
          <span className="text-xs font-mono font-semibold text-amber-600">{((unlocked/achievements.length)*100).toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-amber-400 to-yellow-300 rounded-full transition-all duration-700"
            style={{ width: `${(unlocked/achievements.length)*100}%` }} />
        </div>
      </div>
      {categories.map(cat => {
        const catAch = achievements.filter(a => a.category === cat);
        return (
          <div key={cat}>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{CATEGORY_LABELS[cat]}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {catAch.map(a => <AchievementCard key={a.id} ach={a} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Section 4b: Monthly Breakdown Table ─────────────────────── */
function MonthlyBreakdown({ trades }: { trades: Trade[] }) {
  const monthly = useMemo(() => calculateMonthlyStats(trades), [trades]);

  // Compute best & worst day per month from raw trades
  const dayStatsByMonth = useMemo(() => {
    const dayMap = new Map<string, number>(); // "YYYY-M" → dayStr → pnl
    const perMonth = new Map<string, { best: number; worst: number }>();
    for (const t of trades) {
      const key = `${t.date.getFullYear()}-${t.date.getMonth()}`;
      const day = t.dateStr;
      dayMap.set(day, (dayMap.get(day) ?? 0) + t.actualProfit);
    }
    for (const t of trades) {
      const key = `${t.date.getFullYear()}-${t.date.getMonth()}`;
      const dayPnl = dayMap.get(t.dateStr) ?? 0;
      const cur = perMonth.get(key) ?? { best: -Infinity, worst: Infinity };
      perMonth.set(key, {
        best:  Math.max(cur.best,  dayPnl),
        worst: Math.min(cur.worst, dayPnl),
      });
    }
    return perMonth;
  }, [trades]);

  // Show most recent months first
  const rows = [...monthly].reverse();
  const maxAbsPnl = Math.max(...rows.map(r => Math.abs(r.pnl)), 1);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Monthly Breakdown</h3>
        <span className="text-[10px] text-gray-400">{rows.length} months · most recent first</span>
      </div>

      {/* Header */}
      <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr] gap-0 text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-5 py-2 border-b border-gray-100 bg-gray-50/60">
        <span>Month</span>
        <span className="text-right">P&amp;L</span>
        <span className="text-center">Win Rate</span>
        <span className="text-right">Trades</span>
        <span className="text-right">Best Day</span>
        <span className="text-right">Worst Day</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-50">
        {rows.map(r => {
          const key = `${r.year}-${r.month}`;
          const ds = dayStatsByMonth.get(key);
          const isProfit = r.pnl >= 0;
          const barW = Math.round((Math.abs(r.pnl) / maxAbsPnl) * 100);

          return (
            <div key={key}
              className={`grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr] gap-0 items-center px-5 py-3 hover:bg-gray-50/70 transition-colors ${isProfit ? '' : 'bg-red-50/20'}`}>

              {/* Month */}
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-7 rounded-full shrink-0 ${isProfit ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-sm font-semibold text-gray-800">{r.monthLabel}</span>
              </div>

              {/* P&L with mini bar */}
              <div className="text-right">
                <span className={`text-sm font-bold font-mono ${isProfit ? 'text-green-600' : 'text-red-500'}`}>
                  {isProfit ? '+' : ''}₹{Math.abs(r.pnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </span>
                <div className="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${isProfit ? 'bg-green-400' : 'bg-red-400'}`}
                    style={{ width: `${barW}%` }} />
                </div>
              </div>

              {/* Win rate */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-sm font-mono font-semibold text-gray-700">{r.winRate.toFixed(0)}%</span>
                <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600"
                    style={{ width: `${Math.min(100, r.winRate)}%` }} />
                </div>
              </div>

              {/* Trades */}
              <div className="text-right">
                <span className="text-sm font-mono text-gray-700">{r.trades}</span>
                <p className="text-[10px] text-gray-400">{r.wins}W · {r.trades - r.wins}L</p>
              </div>

              {/* Best day */}
              <div className="text-right">
                {ds && ds.best !== -Infinity ? (
                  <span className="text-sm font-mono font-semibold text-green-600">
                    +₹{Math.abs(ds.best).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                ) : <span className="text-gray-300">—</span>}
              </div>

              {/* Worst day */}
              <div className="text-right">
                {ds && ds.worst !== Infinity ? (
                  <span className={`text-sm font-mono font-semibold ${ds.worst < 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {ds.worst >= 0 ? '+' : ''}₹{Math.abs(ds.worst).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </span>
                ) : <span className="text-gray-300">—</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer summary */}
      <div className="px-5 py-3 bg-gray-50/60 border-t border-gray-100 flex items-center gap-6 text-xs text-gray-500">
        <span><span className="font-semibold text-green-600">{rows.filter(r => r.pnl > 0).length}</span> profitable months</span>
        <span><span className="font-semibold text-red-500">{rows.filter(r => r.pnl < 0).length}</span> losing months</span>
        <span>Best: <span className="font-semibold text-green-600 font-mono">
          {rows.reduce((b, r) => r.pnl > b.pnl ? r : b, rows[0])?.monthLabel ?? '—'}
        </span></span>
        <span>Worst: <span className="font-semibold text-red-500 font-mono">
          {rows.reduce((b, r) => r.pnl < b.pnl ? r : b, rows[0])?.monthLabel ?? '—'}
        </span></span>
      </div>
    </div>
  );
}

/* ── Section 4c: Segment × Month Heatmap (trendy) ────────────── */
function SegmentHeatmap({ trades }: { trades: Trade[] }) {
  const { months, segments, cellMap, segTotals } = useMemo(() => {
    const monthSet = new Set<string>();
    const monthMeta = new Map<string, { year: number; month: number; label: string }>();
    const segSet    = new Set<string>();
    const cellMap   = new Map<string, number>();
    const segTotals = new Map<string, number>();
    for (const t of trades) {
      const y = t.date.getFullYear(), m = t.date.getMonth();
      const mk = `${y}-${String(m).padStart(2, '0')}`;
      monthSet.add(mk);
      if (!monthMeta.has(mk)) monthMeta.set(mk, { year: y, month: m, label: `${MONTH_SHORT[m]} '${String(y).slice(2)}` });
      segSet.add(t.segment);
      const ck = `${t.segment}|${mk}`;
      cellMap.set(ck, (cellMap.get(ck) ?? 0) + t.actualProfit);
      segTotals.set(t.segment, (segTotals.get(t.segment) ?? 0) + t.actualProfit);
    }
    const months   = [...monthSet].sort().map(k => ({ key: k, ...monthMeta.get(k)! }));
    const segments = [...segSet].sort((a, b) => (segTotals.get(b) ?? 0) - (segTotals.get(a) ?? 0));
    return { months, segments, cellMap, segTotals };
  }, [trades]);

  const maxAbs = useMemo(() => {
    let max = 0;
    for (const v of cellMap.values()) if (Math.abs(v) > max) max = Math.abs(v);
    return max || 1;
  }, [cellMap]);

  /* Returns inline style for background opacity + text color — light pastel palette */
  const cellCss = (pnl: number | undefined): { style: React.CSSProperties; textClass: string; borderColor: string } => {
    if (pnl === undefined) return { style: { background: 'transparent' }, textClass: '', borderColor: 'transparent' };
    const ratio = Math.min(1, Math.abs(pnl) / maxAbs);
    const opacity = 0.06 + ratio * 0.22; // stays in pastel range 0.06 → 0.28
    if (pnl > 0) return {
      style: { background: `rgba(16,185,129,${opacity})` },   // emerald-500
      textClass: ratio > 0.55 ? 'text-emerald-800' : 'text-emerald-600',
      borderColor: `rgba(16,185,129,${opacity + 0.15})`,
    };
    return {
      style: { background: `rgba(251,113,133,${opacity})` },  // rose-400
      textClass: ratio > 0.55 ? 'text-rose-800' : 'text-rose-500',
      borderColor: `rgba(251,113,133,${opacity + 0.15})`,
    };
  };

  const fmtCell = (v: number) =>
    `${v >= 0 ? '+' : '-'}₹${Math.abs(v) >= 1000 ? `${(Math.abs(v) / 1000).toFixed(1)}K` : String(Math.abs(Math.round(v)))}`;

  if (!segments.length || !months.length) return null;

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
      {/* ── Header ── */}
      <div className="px-5 py-4 bg-white border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Segment × Month</h3>
          <p className="text-[10px] text-gray-400 mt-0.5">{segments.length} segments · {months.length} months · color intensity = P&amp;L size</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400 mr-1">Loss</span>
          {[0.08, 0.14, 0.2, 0.27].reverse().map(o => (
            <div key={o} className="w-4 h-4 rounded border" style={{ background: `rgba(251,113,133,${o})`, borderColor: `rgba(251,113,133,${o + 0.15})` }} />
          ))}
          <div className="w-4 h-4 rounded bg-gray-50 border border-gray-200" />
          {[0.08, 0.14, 0.2, 0.27].map(o => (
            <div key={o} className="w-4 h-4 rounded border" style={{ background: `rgba(16,185,129,${o})`, borderColor: `rgba(16,185,129,${o + 0.15})` }} />
          ))}
          <span className="text-[10px] text-gray-400 ml-1">Profit</span>
        </div>
      </div>

      <div className="overflow-x-auto bg-white">
        <table className="w-full border-collapse">
          {/* ── Column headers ── */}
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-4 py-3 text-left min-w-[120px]">
                <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">Segment</span>
              </th>
              {months.map(m => (
                <th key={m.key} className="px-1.5 py-3 min-w-[72px]">
                  <span className="inline-flex items-center justify-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[10px] font-semibold text-gray-500 whitespace-nowrap">
                    {m.label}
                  </span>
                </th>
              ))}
              {/* Total header — dark pill */}
              <th className="pl-3 pr-4 py-3 min-w-[88px]" style={{ borderLeft: '2px solid #e5e7eb' }}>
                <span className="inline-flex items-center justify-center rounded-full bg-gray-900 px-3 py-0.5 text-[10px] font-bold text-white whitespace-nowrap tracking-wide">
                  TOTAL
                </span>
              </th>
            </tr>
          </thead>

          {/* ── Segment rows ── */}
          <tbody>
            {segments.map((seg, ri) => {
              const total  = segTotals.get(seg) ?? 0;
              const isPos  = total >= 0;
              return (
                <tr key={seg} className={`group ${ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} hover:bg-blue-50/30 transition-colors`}>
                  {/* Segment label */}
                  <td className="sticky left-0 z-10 px-4 py-2" style={{ background: ri % 2 === 0 ? '#fff' : 'rgba(249,250,251,0.4)' }}>
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isPos ? 'bg-green-500' : 'bg-red-400'}`} />
                      <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">{seg}</span>
                    </div>
                  </td>

                  {/* Month cells */}
                  {months.map(m => {
                    const pnl = cellMap.get(`${seg}|${m.key}`);
                    const { style, textClass, borderColor } = cellCss(pnl);
                    return (
                      <td key={m.key} className="px-1 py-1.5 text-center"
                        title={pnl !== undefined ? `${seg} · ${m.label}: ${fmtCell(pnl)}` : 'No trades'}>
                        {pnl !== undefined ? (
                          <div className="rounded-lg px-1.5 py-1.5 mx-0.5 border" style={{ ...style, borderColor }}>
                            <span className={`text-[10px] font-bold font-mono whitespace-nowrap ${textClass}`}>
                              {fmtCell(pnl)}
                            </span>
                          </div>
                        ) : (
                          <div className="rounded-lg px-1.5 py-1.5 mx-0.5">
                            <span className="text-[10px] text-gray-200">·</span>
                          </div>
                        )}
                      </td>
                    );
                  })}

                  {/* Total cell — dark card, clearly distinct */}
                  <td className="pl-3 pr-4 py-1.5 text-center" style={{ borderLeft: '2px solid #e5e7eb' }}>
                    <div className={`rounded-xl px-2.5 py-2 ${isPos ? 'bg-gray-900' : 'bg-gray-800'}`}>
                      <span className={`text-[11px] font-extrabold font-mono whitespace-nowrap ${isPos ? 'text-green-400' : 'text-red-400'}`}>
                        {fmtCell(total)}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>

        </table>
      </div>
    </div>
  );
}

/* ── Dashboard Root ───────────────────────────────────────────── */
export function Dashboard({ trades: allTrades, historical2025 }: Props) {
  const [year, setYear] = useState(() => { try { return localStorage.getItem('tj-filter-year') || 'all'; } catch { return 'all'; } });
  const [month, setMonth] = useState(() => { try { return localStorage.getItem('tj-filter-month') || 'all'; } catch { return 'all'; } });

  const handleYear = (y: string) => { setYear(y); try { localStorage.setItem('tj-filter-year', y); } catch {} };
  const handleMonth = (m: string) => { setMonth(m); try { localStorage.setItem('tj-filter-month', m); } catch {} };

  const filteredTrades = useMemo(() => getFilteredTrades(allTrades, year, month), [allTrades, year, month]);
  const stats = useMemo(() => computeStats(filteredTrades), [filteredTrades]);
  const segments = useMemo(() => computeSegmentStats(filteredTrades), [filteredTrades]);
  const groupedSegments = useMemo(() => computeGroupedSegments(filteredTrades), [filteredTrades]);

  return (
    <div className="space-y-6">
      <ExpectancyBanner stats={stats} year={year} month={month} filteredTrades={filteredTrades} />
      <Filters allTrades={allTrades} year={year} month={month} onYearChange={handleYear} onMonthChange={handleMonth} />

      {filteredTrades.length > 0 ? (
        <EquityCurve trades={filteredTrades} />
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-400 text-sm">
          No trades found for the selected period.
        </div>
      )}

      {filteredTrades.length > 0 && (
        <>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Core Performance Metrics</h3>
            <CoreMetrics stats={stats} trades={filteredTrades} />
          </div>

          <MonthlyBreakdown trades={filteredTrades} />

          <SegmentHeatmap trades={filteredTrades} />

          {groupedSegments.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Instrument Group Performance <span className="text-xs font-normal text-gray-400">(CE + PE Combined)</span>
              </h3>
              <InstrumentGroups groups={groupedSegments} />
            </div>
          )}

          {segments.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Segment Performance Analysis</h3>
              <SegmentAnalysis segments={segments} />
            </div>
          )}

          {allTrades.length >= 5 && (
            <PredictiveIntelligence trades={allTrades} stats={stats} />
          )}

          {allTrades.length >= 10 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Future Insights Engine
                <span className="text-xs font-normal text-blue-500 border border-blue-200 bg-blue-50 px-2 py-0.5 rounded-full ml-2">AI</span>
              </h3>
              <FutureInsights trades={allTrades} />
            </div>
          )}

          <AchievementsSystem trades={allTrades} />
        </>
      )}
    </div>
  );
}

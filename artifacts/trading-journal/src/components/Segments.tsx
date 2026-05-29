import { useState, useMemo } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { SegmentStats, InstrumentGroup, formatPnl, computeSegmentStats, computeGroupedSegments } from '../lib/stats';
import type { Trade } from '../lib/sheetParser';
import { getFilteredTrades, getAvailableYears, calculateMonthlyStats, calculateDrawdowns } from '../lib/analytics';
import { Filters } from './Dashboard';

interface Props {
  segments: SegmentStats[];
  groupedSegments: InstrumentGroup[];
  trades: Trade[];
}

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const RANK_MEDALS = ['🥇','🥈','🥉'];

function fmtK(v: number) {
  const abs = Math.abs(v);
  const sign = v >= 0 ? '+' : '-';
  return `${sign}₹${(abs/1000).toFixed(1)}K`;
}

/* ── Trend Status ──────────────────────────────────────────────── */
function getTrend(trades: Trade[], segment: string): { label: string; color: string } {
  const segTrades = trades.filter(t => t.segment === segment);
  if (segTrades.length < 6) return { label: 'Insufficient Data', color: 'text-gray-400' };
  const half = Math.floor(segTrades.length / 2);
  const firstHalf = segTrades.slice(0, half);
  const secondHalf = segTrades.slice(half);
  const firstPnl = firstHalf.reduce((s, t) => s + t.actualProfit, 0) / half;
  const secondPnl = secondHalf.reduce((s, t) => s + t.actualProfit, 0) / secondHalf.length;
  const change = secondPnl - firstPnl;
  if (change > 200) return { label: '↑ Improving', color: 'text-green-600' };
  if (change < -200) return { label: '↓ Weakening', color: 'text-red-500' };
  const wins = segTrades.filter(t => t.actualProfit > 0).length;
  const wr = wins / segTrades.length;
  if (wr >= 0.6) return { label: '→ Stable', color: 'text-blue-600' };
  return { label: '⚡ Highly Volatile', color: 'text-amber-600' };
}

/* ── Per-segment best month/year ─────────────────────────────── */
function getSegmentBestWorst(trades: Trade[], segment: string) {
  const seg = trades.filter(t => t.segment === segment);
  const monthMap = new Map<string, { label: string; pnl: number }>();
  const yearMap = new Map<number, number>();
  for (const t of seg) {
    const y = t.date.getFullYear(), m = t.date.getMonth();
    const k = `${y}-${m}`;
    if (!monthMap.has(k)) monthMap.set(k, { label: `${MONTH_SHORT[m]} ${y}`, pnl: 0 });
    monthMap.get(k)!.pnl += t.actualProfit;
    yearMap.set(y, (yearMap.get(y) ?? 0) + t.actualProfit);
  }
  const months = Array.from(monthMap.values());
  const years = Array.from(yearMap.entries());
  const bestMonth = months.length ? months.reduce((b, m) => m.pnl > b.pnl ? m : b) : null;
  const worstMonth = months.length ? months.reduce((w, m) => m.pnl < w.pnl ? m : w) : null;
  const bestYear = years.length ? years.reduce((b, y) => y[1] > b[1] ? y : b) : null;
  return { bestMonth, worstMonth, bestYear };
}

/* ── Segment Intelligence Card ───────────────────────────────── */
function SegmentIntelCard({ seg, rank, trades: allTrades }: { seg: SegmentStats; rank: number; trades: Trade[] }) {
  const isProfit = seg.totalPnl >= 0;
  const medal = RANK_MEDALS[rank];
  const trend = useMemo(() => getTrend(allTrades, seg.segment), [allTrades, seg.segment]);
  const { bestMonth, worstMonth, bestYear } = useMemo(() => getSegmentBestWorst(allTrades, seg.segment), [allTrades, seg.segment]);
  const ddInfo = useMemo(() => {
    const segTrades = allTrades.filter(t => t.segment === seg.segment);
    return calculateDrawdowns(segTrades);
  }, [allTrades, seg.segment]);

  return (
    <div className={`bg-white rounded-xl border p-4 shadow-sm ${isProfit ? 'border-gray-200' : 'border-red-200 bg-red-50/30'}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{medal ?? <span className="text-xs font-bold text-gray-500 bg-gray-100 rounded-full w-5 h-5 flex items-center justify-center">#{rank+1}</span>}</span>
          <div>
            <p className="text-sm font-bold text-gray-900">{seg.segment}</p>
            <p className="text-[10px] text-gray-400">{seg.trades} trades · {seg.wins}W / {seg.losses}L</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-base font-bold font-mono ${isProfit ? 'text-green-600' : 'text-red-500'}`}>{formatPnl(seg.totalPnl, false)}</p>
          <p className={`text-[10px] font-semibold ${trend.color}`}>{trend.label}</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: 'Win Rate', val: `${seg.winRate.toFixed(1)}%`, color: seg.winRate >= 55 ? 'text-green-600' : seg.winRate >= 45 ? 'text-amber-600' : 'text-red-500' },
          { label: 'Prof. Factor', val: seg.profitFactor.toFixed(2), color: seg.profitFactor >= 1.5 ? 'text-green-600' : seg.profitFactor >= 1 ? 'text-amber-600' : 'text-red-500' },
          { label: 'Avg/Trade', val: fmtK(seg.avgTrade), color: seg.avgTrade >= 0 ? 'text-green-600' : 'text-red-500' },
          { label: 'Avg Win', val: fmtK(seg.avgWin), color: 'text-green-600' },
          { label: 'Avg Loss', val: fmtK(seg.avgLoss), color: 'text-red-500' },
          { label: 'Max Drawdown', val: ddInfo.maxDrawdown > 0 ? fmtK(-ddInfo.maxDrawdown) : '—', color: 'text-orange-500' },
        ].map(m => (
          <div key={m.label} className="bg-gray-50 rounded-lg p-2 border border-gray-100 text-center">
            <p className="text-[9px] text-gray-400 mb-0.5">{m.label}</p>
            <p className={`text-sm font-bold font-mono ${m.color}`}>{m.val}</p>
          </div>
        ))}
      </div>

      {/* Best/Worst Month + Year */}
      <div className="flex flex-wrap gap-2 text-xs">
        {bestMonth && (
          <div className="flex items-center gap-1 bg-green-50 border border-green-200 rounded-lg px-2 py-1">
            <span className="text-[9px] text-gray-400">Best</span>
            <span className="font-semibold text-green-700">{bestMonth.label}</span>
            <span className="font-mono text-green-600">{fmtK(bestMonth.pnl)}</span>
          </div>
        )}
        {worstMonth && (
          <div className="flex items-center gap-1 bg-red-50 border border-red-200 rounded-lg px-2 py-1">
            <span className="text-[9px] text-gray-400">Worst</span>
            <span className="font-semibold text-red-600">{worstMonth.label}</span>
            <span className="font-mono text-red-500">{fmtK(worstMonth.pnl)}</span>
          </div>
        )}
        {bestYear && (
          <div className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
            <span className="text-[9px] text-gray-400">Best Year</span>
            <span className="font-semibold text-blue-700">{bestYear[0]}</span>
            <span className="font-mono text-blue-600">{fmtK(bestYear[1])}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Monthly Heatmap ──────────────────────────────────────────── */
function MonthlyHeatmap({ trades }: { trades: Trade[] }) {
  const { groups, months } = useMemo(() => {
    const groupNames = ['Nifty CE', 'Nifty PE', 'Banknifty CE', 'Banknifty PE', 'Sensex CE', 'Sensex PE'];
    const monthSet = new Set<string>();
    const data = new Map<string, Map<string, number>>();

    for (const t of trades) {
      const y = t.date.getFullYear(), m = t.date.getMonth();
      const monthKey = `${MONTH_SHORT[m]} ${y}`;
      const seg = t.segment;
      let group = '';
      const sl = seg.toLowerCase().replace(/\s/g, '');
      if (sl.startsWith('banknifty')) group = sl.includes('ce') ? 'Banknifty CE' : 'Banknifty PE';
      else if (sl.startsWith('nifty')) group = sl.includes('ce') ? 'Nifty CE' : 'Nifty PE';
      else if (sl.startsWith('sensex')) group = sl.includes('ce') ? 'Sensex CE' : 'Sensex PE';
      if (!group) continue;
      monthSet.add(monthKey);
      if (!data.has(group)) data.set(group, new Map());
      const cur = data.get(group)!.get(monthKey) ?? 0;
      data.get(group)!.set(monthKey, cur + t.actualProfit);
    }

    const months = Array.from(monthSet).sort((a, b) => {
      const [ma, ya] = a.split(' '); const [mb, yb] = b.split(' ');
      return parseInt(ya) !== parseInt(yb) ? parseInt(ya) - parseInt(yb) : MONTH_SHORT.indexOf(ma) - MONTH_SHORT.indexOf(mb);
    });

    const groups = groupNames.filter(g => data.has(g));
    return { groups, months, data };
  }, [trades]);

  if (!groups.length || !months.length) return null;

  const data = useMemo(() => {
    const d = new Map<string, Map<string, number>>();
    for (const t of trades) {
      const y = t.date.getFullYear(), m = t.date.getMonth();
      const monthKey = `${MONTH_SHORT[m]} ${y}`;
      const seg = t.segment;
      let group = '';
      const sl = seg.toLowerCase().replace(/\s/g, '');
      if (sl.startsWith('banknifty')) group = sl.includes('ce') ? 'Banknifty CE' : 'Banknifty PE';
      else if (sl.startsWith('nifty')) group = sl.includes('ce') ? 'Nifty CE' : 'Nifty PE';
      else if (sl.startsWith('sensex')) group = sl.includes('ce') ? 'Sensex CE' : 'Sensex PE';
      if (!group) continue;
      if (!d.has(group)) d.set(group, new Map());
      const cur = d.get(group)!.get(monthKey) ?? 0;
      d.get(group)!.set(monthKey, cur + t.actualProfit);
    }
    return d;
  }, [trades]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Monthly Performance Heatmap</h3>
        <p className="text-xs text-gray-400 mt-0.5">Green = profitable month · Red = losing month</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-3 py-2 text-left text-[10px] text-gray-400 font-medium w-28">Segment</th>
              {months.slice(-12).map(m => (
                <th key={m} className="px-1 py-2 text-center text-[10px] text-gray-400 font-medium min-w-[52px]">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(group => (
              <tr key={group} className="border-b border-gray-50">
                <td className="px-3 py-2 text-[10px] font-semibold text-gray-600 whitespace-nowrap">{group}</td>
                {months.slice(-12).map(m => {
                  const pnl = data.get(group)?.get(m) ?? null;
                  const isPos = pnl !== null && pnl > 0;
                  const isNeg = pnl !== null && pnl < 0;
                  return (
                    <td key={m} className="px-1 py-1.5 text-center">
                      {pnl !== null ? (
                        <div className={`rounded-lg px-1 py-1.5 text-[9px] font-mono font-bold ${
                          isPos ? 'bg-green-100 text-green-700' : isNeg ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {pnl >= 0 ? '+' : ''}{(pnl/1000).toFixed(1)}K
                        </div>
                      ) : (
                        <div className="rounded-lg px-1 py-1.5 bg-gray-50 text-gray-200 text-[9px] text-center">—</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── CE vs PE Analysis ───────────────────────────────────────── */
function CePeAnalysis({ groupedSegments }: { groupedSegments: InstrumentGroup[] }) {
  const totalCE = groupedSegments.reduce((s, g) => s + g.cePnl, 0);
  const totalPE = groupedSegments.reduce((s, g) => s + g.pePnl, 0);
  const totalCETrades = groupedSegments.reduce((s, g) => s + g.ceTrades, 0);
  const totalPETrades = groupedSegments.reduce((s, g) => s + g.peTrades, 0);
  const totalCEWins = groupedSegments.reduce((s, g) => s + g.ceWins, 0);
  const totalPEWins = groupedSegments.reduce((s, g) => s + g.peWins, 0);
  const ceWR = totalCETrades > 0 ? (totalCEWins / totalCETrades) * 100 : 0;
  const peWR = totalPETrades > 0 ? (totalPEWins / totalPETrades) * 100 : 0;
  const total = totalCE + totalPE;
  const cePct = total !== 0 ? (totalCE / Math.abs(total)) * 100 : 50;

  const winner = totalCE > totalPE ? 'CE' : 'PE';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">CE vs PE Analysis</h3>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${winner === 'CE' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-violet-100 text-violet-700 border-violet-200'}`}>
          {winner} Outperforming
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">CE Strategies</p>
          <p className={`text-lg font-bold font-mono ${totalCE >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatPnl(totalCE, false)}</p>
          <p className="text-[10px] text-gray-400 mt-1">{totalCETrades}T · {ceWR.toFixed(1)}% WR</p>
        </div>
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">PE Strategies</p>
          <p className={`text-lg font-bold font-mono ${totalPE >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatPnl(totalPE, false)}</p>
          <p className="text-[10px] text-gray-400 mt-1">{totalPETrades}T · {peWR.toFixed(1)}% WR</p>
        </div>
      </div>
      {/* Distribution bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] text-gray-400 mb-1">
          <span>CE contribution</span><span>PE contribution</span>
        </div>
        <div className="h-3 bg-violet-200 rounded-full overflow-hidden">
          <div className="h-full bg-blue-400 rounded-full transition-all" style={{ width: `${Math.max(5, Math.min(95, 50 + cePct/2))}%` }} />
        </div>
      </div>
      {/* Per-instrument */}
      <div className="space-y-1.5">
        {groupedSegments.map(g => (
          <div key={g.name} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
            <span className="text-gray-600 font-medium w-24">{g.name}</span>
            <span className={`font-mono ${g.cePnl >= 0 ? 'text-blue-600' : 'text-red-500'} w-20 text-right`}>CE {fmtK(g.cePnl)}</span>
            <span className={`font-mono ${g.pePnl >= 0 ? 'text-violet-600' : 'text-red-500'} w-20 text-right`}>PE {fmtK(g.pePnl)}</span>
            <span className="text-gray-400 text-[10px] w-12 text-right">{g.winRate.toFixed(0)}%WR</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-3 italic bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
        {winner === 'PE'
          ? 'PE strategies outperform — trending/volatile market conditions favour puts.'
          : 'CE strategies outperform — CE performs strongest during trending/bullish periods.'}
        {' '}Combined CE+PE approach reduces single-direction drawdown risk.
      </p>
    </div>
  );
}

/* ── Segment P&L Chart ───────────────────────────────────────── */
function SegmentBarChart({ segments }: { segments: SegmentStats[] }) {
  const data = useMemo(() =>
    segments.slice(0, 12).map(s => ({
      name: s.segment.length > 18 ? s.segment.slice(0, 17) + '…' : s.segment,
      fullName: s.segment,
      pnl: Math.round(s.totalPnl),
    })).reverse(),
  [segments]);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { fullName: string } }> }) => {
    if (!active || !payload?.length) return null;
    const v = payload[0].value;
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg text-xs">
        <p className="text-gray-600 mb-1 font-medium">{payload[0].payload.fullName}</p>
        <p className={`font-bold font-mono text-sm ${v >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {v >= 0 ? '+' : ''}₹{Math.abs(v).toLocaleString('en-IN')}
        </p>
      </div>
    );
  };

  const barHeight = Math.max(260, data.length * 32);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Segment P&L Comparison</h3>
      <div className="bg-white" style={{ height: barHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 4 }} style={{ background: '#ffffff' }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false}
              tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#374151' }} tickLine={false} axisLine={false} width={120} />
            <ReferenceLine x={0} stroke="#d1d5db" strokeWidth={1.5} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#16a34a' : '#dc2626'} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Group Card (redesigned, no progress bars) ───────────────── */
function GroupCard({ g, rank }: { g: InstrumentGroup; rank: number }) {
  const isProfit = g.totalPnl >= 0;
  const medal = RANK_MEDALS[rank];
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${isProfit ? 'bg-white border-gray-200' : 'bg-red-50/30 border-red-200'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{medal ?? `#${rank+1}`}</span>
          <div>
            <p className="text-sm font-bold text-gray-900">{g.name}</p>
            <p className="text-[10px] text-gray-400">{g.trades} trades · {g.winRate.toFixed(0)}% WR · PF {g.profitFactor.toFixed(2)}</p>
          </div>
        </div>
        <p className={`text-lg font-bold font-mono ${isProfit ? 'text-green-600' : 'text-red-500'}`}>
          {formatPnl(g.totalPnl, false)}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className={`rounded-lg p-3 border ${g.cePnl >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">CE · {g.ceTrades}T · {g.ceWinRate.toFixed(0)}%WR</p>
          <p className={`text-base font-bold font-mono ${g.cePnl >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{formatPnl(g.cePnl, false)}</p>
        </div>
        <div className={`rounded-lg p-3 border ${g.pePnl >= 0 ? 'bg-violet-50 border-violet-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">PE · {g.peTrades}T · {g.peWinRate.toFixed(0)}%WR</p>
          <p className={`text-base font-bold font-mono ${g.pePnl >= 0 ? 'text-violet-700' : 'text-red-600'}`}>{formatPnl(g.pePnl, false)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
        <span className="text-gray-400">Avg/Trade:</span>
        <span className={`font-mono font-semibold ${g.avgTrade >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatPnl(g.avgTrade)}</span>
        <span className="mx-1 text-gray-200">·</span>
        <span className="text-gray-400">{g.wins}W / {g.trades - g.wins}L</span>
        <span className="mx-1 text-gray-200">·</span>
        <span className={`font-mono ${g.cePnl > g.pePnl ? 'text-blue-600' : 'text-violet-600'} font-semibold`}>
          {g.cePnl > g.pePnl ? 'CE leads' : 'PE leads'}
        </span>
      </div>
    </div>
  );
}

/* ── Main Segments component ─────────────────────────────────── */
export function Segments({ trades: allTrades }: Props) {
  const [year, setYear] = useState(() => { try { return localStorage.getItem('tj-filter-year') || 'all'; } catch { return 'all'; } });
  const [month, setMonth] = useState(() => { try { return localStorage.getItem('tj-filter-month') || 'all'; } catch { return 'all'; } });

  const handleYear = (y: string) => { setYear(y); try { localStorage.setItem('tj-filter-year', y); } catch {} };
  const handleMonth = (m: string) => { setMonth(m); try { localStorage.setItem('tj-filter-month', m); } catch {} };

  const filteredTrades = useMemo(() => getFilteredTrades(allTrades, year, month), [allTrades, year, month]);
  const segments = useMemo(() => computeSegmentStats(filteredTrades), [filteredTrades]);
  const groupedSegments = useMemo(() => computeGroupedSegments(filteredTrades), [filteredTrades]);
  const sortedGroups = useMemo(() => [...groupedSegments].sort((a, b) => b.totalPnl - a.totalPnl), [groupedSegments]);
  const sortedSegments = useMemo(() => [...segments].sort((a, b) => b.totalPnl - a.totalPnl), [segments]);

  if (!allTrades.length) {
    return <div className="text-center text-gray-400 py-20">No segment data available.</div>;
  }

  return (
    <div className="space-y-8">
      {/* Filters */}
      <Filters allTrades={allTrades} year={year} month={month} onYearChange={handleYear} onMonthChange={handleMonth} />

      {/* ── 1. Segment P&L Chart (vertical) ── */}
      <div>
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Segment P&L Chart</h2>
          <p className="text-xs text-gray-400 mt-0.5">Best → Worst · ranked by net P&L</p>
        </div>
        <SegmentBarChart segments={sortedSegments} />
      </div>

      {/* ── 2. Combined Instrument Groups ── */}
      <div>
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Combined Instrument Groups</h2>
          <p className="text-xs text-gray-400 mt-0.5">CE + PE merged per underlying — overall instrument edge</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sortedGroups.map((g, i) => <GroupCard key={g.name} g={g} rank={i} />)}
        </div>
      </div>

      {/* ── 3. Individual Segment Intelligence ── */}
      <div>
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Individual Segment Intelligence</h2>
          <p className="text-xs text-gray-400 mt-0.5">Deep analytics per segment — ranked by net P&L</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sortedSegments.map((seg, i) => (
            <SegmentIntelCard key={seg.segment} seg={seg} rank={i} trades={filteredTrades} />
          ))}
        </div>
      </div>

      {/* ── 4. CE vs PE Analysis ── */}
      {groupedSegments.length > 0 && (
        <div>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-gray-900">CE vs PE Analysis</h2>
            <p className="text-xs text-gray-400 mt-0.5">Call vs Put breakdown per instrument</p>
          </div>
          <CePeAnalysis groupedSegments={groupedSegments} />
        </div>
      )}

      {/* ── Monthly Heatmap ── */}
      {filteredTrades.length > 0 && (
        <div>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Monthly Heatmap</h2>
            <p className="text-xs text-gray-400 mt-0.5">Segment profitability by month — last 12 months shown</p>
          </div>
          <MonthlyHeatmap trades={filteredTrades} />
        </div>
      )}
    </div>
  );
}

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


/* ── Segment × Month Heatmap (from Dashboard) ─────────────────── */
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

  const cellCss = (pnl: number | undefined): { style: React.CSSProperties; textClass: string; borderColor: string } => {
    if (pnl === undefined) return { style: { background: 'transparent' }, textClass: '', borderColor: 'transparent' };
    const ratio = Math.min(1, Math.abs(pnl) / maxAbs);
    const opacity = 0.06 + ratio * 0.22;
    if (pnl > 0) return {
      style: { background: `rgba(16,185,129,${opacity})` },
      textClass: ratio > 0.55 ? 'text-emerald-800' : 'text-emerald-600',
      borderColor: `rgba(16,185,129,${opacity + 0.15})`,
    };
    return {
      style: { background: `rgba(251,113,133,${opacity})` },
      textClass: ratio > 0.55 ? 'text-rose-800' : 'text-rose-500',
      borderColor: `rgba(251,113,133,${opacity + 0.15})`,
    };
  };

  const fmtCell = (v: number) =>
    `${v >= 0 ? '+' : '-'}${Math.abs(v) >= 1000 ? `${(Math.abs(v) / 1000).toFixed(1)}K` : String(Math.abs(Math.round(v)))}`;

  if (!segments.length || !months.length) return null;

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
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
              <th className="pl-3 pr-4 py-3 min-w-[88px]" style={{ borderLeft: '2px solid #e5e7eb' }}>
                <span className="inline-flex items-center justify-center rounded-full bg-gray-900 px-3 py-0.5 text-[10px] font-bold text-white whitespace-nowrap tracking-wide">
                  TOTAL
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {segments.map((seg, ri) => {
              const total  = segTotals.get(seg) ?? 0;
              const isPos  = total >= 0;
              return (
                <tr key={seg} className={`group ${ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} hover:bg-blue-50/30 transition-colors`}>
                  <td className="sticky left-0 z-10 px-4 py-2" style={{ background: ri % 2 === 0 ? '#fff' : 'rgba(249,250,251,0.4)' }}>
                    <div className="flex items-center gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isPos ? 'bg-green-500' : 'bg-red-400'}`} />
                      <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">{seg}</span>
                    </div>
                  </td>
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

/* ── Group Intelligence Card (matches Segment Intel style) ──── */
function GroupCard({ g, rank }: { g: InstrumentGroup; rank: number }) {
  const isProfit = g.totalPnl >= 0;
  const medal = RANK_MEDALS[rank];
  return (
    <div className={`bg-white rounded-xl border p-4 shadow-sm ${isProfit ? 'border-gray-200' : 'border-red-200 bg-red-50/30'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{medal ?? <span className="text-xs font-bold text-gray-500 bg-gray-100 rounded-full w-5 h-5 flex items-center justify-center">#{rank + 1}</span>}</span>
          <div>
            <p className="text-sm font-bold text-gray-900">{g.name}</p>
            <p className="text-[15px] text-justify text-[#073ef2ed]">{g.trades} trades · {g.wins}W / {g.trades - g.wins}L</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-base font-bold font-mono ${isProfit ? 'text-green-600' : 'text-red-500'}`}>{formatPnl(g.totalPnl, false)}</p>
          <p className={`text-[10px] font-semibold ${g.avgTrade > 100 ? 'text-green-600' : g.avgTrade < -100 ? 'text-red-500' : 'text-gray-400'}`}>
            {g.avgTrade > 100 ? '↑ Improving' : g.avgTrade < -100 ? '↓ Weakening' : '→ Stable'}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: 'Win Rate', val: `${g.winRate.toFixed(1)}%`, color: g.winRate >= 55 ? 'text-green-600' : g.winRate >= 45 ? 'text-amber-600' : 'text-red-500' },
          { label: 'Prof. Factor', val: g.profitFactor.toFixed(2), color: g.profitFactor >= 1.5 ? 'text-green-600' : g.profitFactor >= 1 ? 'text-amber-600' : 'text-red-500' },
          { label: 'Avg/Trade', val: fmtK(g.avgTrade), color: g.avgTrade >= 0 ? 'text-green-600' : 'text-red-500' },
          { label: 'Avg Win', val: fmtK(g.avgWin), color: 'text-green-600' },
          { label: 'Avg Loss', val: fmtK(g.avgLoss), color: 'text-red-500' },
          { label: 'Max DD', val: g.maxDrawdown > 0 ? fmtK(-g.maxDrawdown) : '—', color: 'text-orange-500' },
        ].map(m => (
          <div key={m.label} className="bg-gray-50 rounded-lg p-2 border border-gray-100 text-center">
            <p className="text-[9px] mb-0.5 text-[#0f0101]">{m.label}</p>
            <p className={`text-sm font-bold font-mono ${m.color}`}>{m.val}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
          <span className="text-[9px] text-gray-400">CE</span>
          <span className={`font-mono font-semibold ${g.cePnl >= 0 ? 'text-blue-600' : 'text-red-500'}`}>{fmtK(g.cePnl)}</span>
          <span className="text-[10px] text-gray-400">{g.ceWinRate.toFixed(0)}%WR</span>
        </div>
        <div className="flex items-center gap-1 bg-violet-50 border border-violet-200 rounded-lg px-2 py-1">
          <span className="text-[9px] text-gray-400">PE</span>
          <span className={`font-mono font-semibold ${g.pePnl >= 0 ? 'text-violet-600' : 'text-red-500'}`}>{fmtK(g.pePnl)}</span>
          <span className="text-[10px] text-gray-400">{g.peWinRate.toFixed(0)}%WR</span>
        </div>
        <div className={`flex items-center gap-1 rounded-lg px-2 py-1 border ${g.cePnl > g.pePnl ? 'bg-blue-50 border-blue-200' : 'bg-violet-50 border-violet-200'}`}>
          <span className="text-[9px] text-gray-400">{g.cePnl > g.pePnl ? 'CE leads' : 'PE leads'}</span>
        </div>
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

      {/* ── Segment × Month Heatmap ── */}
      {filteredTrades.length > 0 && (
        <div>
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Segment × Month</h2>
            <p className="text-xs text-gray-400 mt-0.5">Segment profitability by month — color intensity = P&L size</p>
          </div>
          <SegmentHeatmap trades={filteredTrades} />
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { DayPnl, formatPnl } from '../lib/stats';
import { Trade } from '../lib/sheetParser';

interface Props {
  dayPnls: DayPnl[];
  trades: Trade[];
}

interface MonthData {
  year: number; month: number; label: string;
  totalPnl: number; tradingDays: number; winDays: number; lossDays: number;
  maxDrawdown: number; capital: number; returnPct: number; ddPct: number;
}

interface SegBreakdown {
  segment: string; pnl: number; tradeCount: number; wins: number; tax: number;
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const SHORT_MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri'];
const RANK_MEDALS = ['🥇','🥈','🥉'];

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getCapital(year: number, month: number): number {
  if (year === 2025 && month === 10) return 100000; // Nov 2025 = 2 lots = 100k
  if (year > 2026 || (year === 2026 && month >= 3)) return 150000; // Mar 2026+ = 3 lots
  return 50000; // Default = 1 lot
}
function getLots(year: number, month: number): number {
  if (year === 2025 && month === 10) return 2; // Nov 2025 = 2 lots
  if (year > 2026 || (year === 2026 && month >= 3)) return 3; // Mar 2026+ = 3 lots
  return 1; // Default = 1 lot
}
function fmtPct(pct: number): string {
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
}
function fmtFull(v: number): string {
  const abs = Math.abs(v);
  const sign = v >= 0 ? '+' : '-';
  return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
function fmtTax(tax: number): string {
  return `₹${Math.abs(tax).toFixed(0)}`;
}
function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) { days.push(new Date(d)); d.setDate(d.getDate()+1); }
  return days;
}
function getWeekday(date: Date): number { return (date.getDay()+6)%7; }
function computeMonthDrawdown(dayPnls: DayPnl[]): number {
  let peak = 0, cum = 0, maxDD = 0;
  const sorted = [...dayPnls].sort((a, b) => a.date.getTime() - b.date.getTime());
  for (const d of sorted) {
    cum += d.pnl;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}
function buildSegBreakdown(trades: Trade[], dateStr: string): SegBreakdown[] {
  const map = new Map<string, SegBreakdown>();
  for (const t of trades) {
    if (t.dateStr !== dateStr) continue;
    if (!map.has(t.segment)) map.set(t.segment, { segment: t.segment, pnl: 0, tradeCount: 0, wins: 0, tax: 0 });
    const s = map.get(t.segment)!;
    s.pnl += t.actualProfit; s.tradeCount++; s.tax += t.tax;
    if (t.actualProfit > 0) s.wins++;
  }
  return Array.from(map.values()).sort((a,b) => b.pnl - a.pnl);
}
function buildMonthSegBreakdown(trades: Trade[], year: number, month: number): SegBreakdown[] {
  const map = new Map<string, SegBreakdown>();
  for (const t of trades) {
    if (t.date.getFullYear() !== year || t.date.getMonth() !== month) continue;
    if (!map.has(t.segment)) map.set(t.segment, { segment: t.segment, pnl: 0, tradeCount: 0, wins: 0, tax: 0 });
    const s = map.get(t.segment)!;
    s.pnl += t.actualProfit; s.tradeCount++; s.tax += t.tax;
    if (t.actualProfit > 0) s.wins++;
  }
  return Array.from(map.values()).sort((a,b) => b.pnl - a.pnl);
}

/* ── Segment Ranked Cards ──────────────────────────────────────── */
function CompactSegmentTable({ segs, title }: { segs: SegBreakdown[]; title?: string }) {
  if (!segs.length) return null;
  return (
    <div className="space-y-2">
      {title && (
        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{title}</h4>
      )}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left py-2 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Segment</th>
              <th className="text-right py-2 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide">P&L</th>
              <th className="text-right py-2 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Trades</th>
              <th className="text-right py-2 px-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide">W/L</th>
              <th className="text-right py-2 px-3 text-[10px] font-bold text-gray-400 uppercase tracking-wide">WR</th>
            </tr>
          </thead>
          <tbody>
            {segs.map((seg, i) => {
              const winRate = seg.tradeCount > 0 ? (seg.wins / seg.tradeCount) * 100 : 0;
              const isPos = seg.pnl >= 0;
              const medal = RANK_MEDALS[i];
              return (
                <tr key={seg.segment} className={`border-b border-gray-100 last:border-b-0 ${i === 0 ? 'bg-green-50/40' : !isPos && i === segs.length - 1 ? 'bg-red-50/40' : ''}`}>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm leading-none">{medal ?? <span className={`text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center ${isPos ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{i + 1}</span>}</span>
                      <span className="font-semibold text-gray-800">{seg.segment}</span>
                    </div>
                  </td>
                  <td className={`py-2 px-2 text-right font-mono font-bold ${isPos ? 'text-green-600' : 'text-red-500'}`}>
                    {fmtFull(seg.pnl)}
                  </td>
                  <td className="py-2 px-2 text-right text-gray-500 font-mono">{seg.tradeCount}</td>
                  <td className="py-2 px-2 text-right text-gray-500 font-mono">{seg.wins}W/{seg.tradeCount - seg.wins}L</td>
                  <td className={`py-2 px-3 text-right font-mono font-bold ${winRate >= 55 ? 'text-green-600' : winRate >= 45 ? 'text-amber-600' : 'text-red-500'}`}>
                    {winRate.toFixed(0)}%
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

/* ── Day Popup ─────────────────────────────────────────────────── */
function DayPopup({ dateStr, segments, onClose }: { dateStr: string; segments: SegBreakdown[]; onClose: () => void }) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateLabel = new Date(y, m-1, d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const totalPnl = segments.reduce((s, seg) => s + seg.pnl, 0);
  const totalTax = segments.reduce((s, seg) => s + seg.tax, 0);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border border-gray-200 rounded-2xl p-5 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{dateLabel}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-lg font-bold font-mono ${totalPnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {fmtFull(totalPnl)}
              </span>
              {totalTax !== 0 && (
                <span className="text-xs text-gray-400 font-mono">tax {fmtTax(totalTax)}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2">
          {segments.map((seg, i) => (
            <div key={seg.segment} className={`rounded-xl p-3 border ${seg.pnl >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{RANK_MEDALS[i] ?? `#${i+1}`}</span>
                  <span className="text-sm font-semibold text-gray-900">{seg.segment}</span>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold font-mono ${seg.pnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {fmtFull(seg.pnl)}
                  </p>
                  {seg.tax !== 0 && (
                    <p className="text-[10px] text-gray-400 font-mono">tax {fmtTax(seg.tax)}</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">{seg.tradeCount} trade{seg.tradeCount > 1 ? 's' : ''} · {seg.wins}W {seg.tradeCount - seg.wins}L</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Calendar View ─────────────────────────────────────────────── */
export function CalendarView({ dayPnls, trades = [] }: Props) {
  const calendarRef = useRef<HTMLDivElement>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pnlMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of dayPnls) m.set(d.dateStr, d.pnl);
    return m;
  }, [dayPnls]);

  const taxMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of dayPnls) m.set(d.dateStr, d.tax);
    return m;
  }, [dayPnls]);

  const streakMap = useMemo(() => {
    const sorted = [...dayPnls].sort((a, b) => a.date.getTime() - b.date.getTime());
    const m = new Map<string, number>();
    let streak = 0;
    for (const d of sorted) {
      if (d.pnl > 0) { streak++; } else { streak = 0; }
      m.set(d.dateStr, streak);
    }
    return m;
  }, [dayPnls]);

  const monthDayMap = useMemo(() => {
    const m = new Map<string, DayPnl[]>();
    for (const d of dayPnls) {
      const key = `${d.date.getFullYear()}-${d.date.getMonth()}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(d);
    }
    return m;
  }, [dayPnls]);

  const months = useMemo(() => {
    const list: MonthData[] = [];
    const seen = new Set<string>();
    for (const d of dayPnls) {
      const year = d.date.getFullYear(), month = d.date.getMonth();
      const key = `${year}-${month}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ year, month, label: `${MONTH_NAMES[month]} ${year}`, totalPnl: 0, tradingDays: 0, winDays: 0, lossDays: 0, maxDrawdown: 0, capital: getCapital(year, month), returnPct: 0, ddPct: 0 });
      }
      const entry = list.find(e => e.year === year && e.month === month)!;
      entry.totalPnl += d.pnl; entry.tradingDays++;
      if (d.pnl > 0) entry.winDays++; else if (d.pnl < 0) entry.lossDays++;
    }
    for (const entry of list) {
      const mDays = (monthDayMap.get(`${entry.year}-${entry.month}`) || []).sort((a,b) => a.date.getTime()-b.date.getTime());
      entry.maxDrawdown = computeMonthDrawdown(mDays);
      entry.returnPct = (entry.totalPnl / entry.capital) * 100;
      entry.ddPct = entry.capital > 0 ? (entry.maxDrawdown / entry.capital) * 100 : 0;
    }
    return list;
  }, [dayPnls, monthDayMap]);

  const [monthIdx, setMonthIdx] = useState(() => Math.max(0, months.length - 1));
  const currentMonth = months[monthIdx];

  const handleSaveImage = useCallback(async () => {
    if (!calendarRef.current || saving) return;
    setSaving(true);
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(calendarRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `calendar-${currentMonth?.label || 'export'}.png`;
      link.href = dataUrl;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    } catch (e) {
      console.error('Failed to save image', e);
    } finally { setSaving(false); }
  }, [currentMonth, saving]);

  if (!months.length || !currentMonth) {
    return <div className="text-center text-gray-400 py-20">No calendar data available.</div>;
  }

  const days = getMonthDays(currentMonth.year, currentMonth.month);
  const firstWeekday = getWeekday(days[0]);
  const calendarDays: (Date | null)[] = Array(firstWeekday > 4 ? 0 : firstWeekday).fill(null);
  for (const d of days) { if (getWeekday(d) <= 4) calendarDays.push(d); }
  while (calendarDays.length % 5 !== 0) calendarDays.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < calendarDays.length; i += 5) weeks.push(calendarDays.slice(i, i+5));

  const prevMonth = months[monthIdx - 1];
  const nextMonth = months[monthIdx + 1];
  const isProfit = currentMonth.totalPnl >= 0;
  const lots = getLots(currentMonth.year, currentMonth.month);
  const monthSegs = buildMonthSegBreakdown(trades, currentMonth.year, currentMonth.month);
  const selectedDaySegs = selectedDay ? buildSegBreakdown(trades, selectedDay) : [];

  return (
    <div className="space-y-4">
      {selectedDay && selectedDaySegs.length > 0 && (
        <DayPopup dateStr={selectedDay} segments={selectedDaySegs} onClose={() => setSelectedDay(null)} />
      )}
      <div ref={calendarRef} className="bg-white border border-gray-200 rounded-xl p-3 space-y-2 shadow-sm">
        {/* Compact top bar: nav + month info + save in one row */}
        <div className="flex items-center gap-2">
          <button onClick={() => setMonthIdx(i => Math.max(0, i-1))} disabled={monthIdx === 0} data-testid="button-prev-month"
            className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors shrink-0">
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Prev month mini */}
          <div className="w-16 shrink-0">
            {prevMonth && (
              <div>
                <p className="text-[10px] text-gray-400">{SHORT_MONTH[prevMonth.month]} {prevMonth.year}</p>
                <p className={`text-xs font-bold font-mono ${prevMonth.totalPnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatPnl(prevMonth.totalPnl)}</p>
              </div>
            )}
          </div>

          {/* Current month — compact single row */}
          <div className="flex-1 text-center">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-[#012a7d]">
                {MONTH_NAMES[currentMonth.month]} {currentMonth.year}
              </h2>
              <span className="font-bold font-mono text-green-600 text-[15px]">
                {isProfit ? '↑' : '↓'} {fmtFull(currentMonth.totalPnl)}
              </span>
              <span className={`text-xs font-mono font-semibold ${isProfit ? 'text-green-500' : 'text-red-400'}`}>
                ({fmtPct(currentMonth.returnPct)})
              </span>
              <span className="text-[12px] text-[#00050d]">{currentMonth.winDays}W/{currentMonth.lossDays}L · {currentMonth.tradingDays}d · {lots}L</span>
              {currentMonth.maxDrawdown > 0 && (
                <span className="text-[10px] font-mono font-bold text-red-600 bg-red-50 border border-red-300 rounded px-1.5 py-0.5">
                  DD {fmtFull(-currentMonth.maxDrawdown)} ({currentMonth.ddPct.toFixed(1)}%)
                </span>
              )}
            </div>
          </div>

          {/* Next month mini */}
          <div className="w-16 shrink-0 text-right">
            {nextMonth && (
              <div>
                <p className="text-[10px] text-gray-400">{SHORT_MONTH[nextMonth.month]} {nextMonth.year}</p>
                <p className={`text-xs font-bold font-mono ${nextMonth.totalPnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatPnl(nextMonth.totalPnl)}</p>
              </div>
            )}
          </div>

          <button onClick={() => setMonthIdx(i => Math.min(months.length-1, i+1))} disabled={monthIdx === months.length-1} data-testid="button-next-month"
            className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors shrink-0">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={handleSaveImage} disabled={saving} data-testid="button-save-image"
            className="flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 border border-blue-200 rounded-lg px-2 py-1 hover:bg-blue-100 disabled:opacity-50 transition-colors shrink-0">
            <Download className="w-3 h-3" />
            {saving ? '…' : 'Save'}
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-5 gap-1">
          {DAY_LABELS.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-gray-400 py-1 uppercase tracking-wide">{d}</div>
          ))}
        </div>

        {/* Grid — compact cells */}
        <div className="space-y-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-5 gap-1">
              {week.map((day, di) => {
                if (!day) return <div key={di} className="rounded-lg h-14 bg-gray-50" />;
                const dateStr = toLocalDateStr(day);
                const pnl = pnlMap.get(dateStr);
                const tax = taxMap.get(dateStr);
                const hasData = pnl !== undefined;
                const isDayProfit = hasData && pnl! > 0;
                const isDayLoss = hasData && pnl! < 0;
                const capital = getCapital(day.getFullYear(), day.getMonth());
                const returnPct = hasData ? (pnl! / capital) * 100 : 0;
                const streak = streakMap.get(dateStr) ?? 0;
                const isOnFire = streak >= 3;
                const cellBg = isDayProfit
                  ? 'bg-gradient-to-b from-green-50 to-green-100/60 border border-gray-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]'
                  : isDayLoss
                    ? Math.abs(returnPct) > 5
                      ? 'bg-gradient-to-b from-red-100/80 to-red-150/60 border border-gray-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]'
                      : 'bg-gradient-to-b from-red-50 to-red-100/50 border border-gray-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]'
                  : hasData
                    ? 'bg-gray-100 border border-gray-200'
                    : 'bg-gray-50/70 border border-gray-100';

                return (
                  <div key={di} onClick={() => hasData && setSelectedDay(dateStr)}
                    data-testid={`calendar-day-${dateStr}`}
                    className={`rounded-xl h-20 p-1.5 flex flex-col transition-all relative ${hasData ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] hover:brightness-95' : ''} ${cellBg}`}>
                    {/* Date + fire */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium text-gray-400 leading-none">{day.getDate()}</span>
                      {isOnFire && <span className="text-[11px] leading-none" title={`${streak} day win streak`}>🔥</span>}
                    </div>
                    {hasData ? (
                      <>
                        {/* P&L + (%) centered */}
                        <div className="flex-1 flex flex-col items-center justify-center gap-0.5">
                          <div className={`text-sm font-bold font-mono leading-none text-center ${isDayProfit ? 'text-green-700' : 'text-red-600'}`}>
                            {fmtFull(pnl!)}
                          </div>
                          <div className={`text-[10px] font-mono font-semibold underline leading-none ${isDayProfit ? 'text-green-500' : isDayLoss && Math.abs(returnPct) > 5 ? 'text-orange-600' : 'text-red-400'}`}>
                            ({fmtPct(returnPct)})
                          </div>
                        </div>
                        {/* Tax — bottom left */}
                        {tax !== undefined && tax !== 0 && (
                          <div className="text-[8px] font-mono text-gray-400 leading-none self-start">
                            tax {fmtTax(tax)}
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 justify-end pt-1">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-green-100 border border-gray-200" /><span className="text-[10px] text-gray-400">Profit</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-100 border border-gray-200" /><span className="text-[10px] text-gray-400">Loss</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-orange-100 border border-gray-200" /><span className="text-[10px] text-gray-400">Heavy Loss (&gt;5%)</span></div>
          <span className="text-[10px] text-gray-400 italic">Click day for details</span>
        </div>

        {/* Month strip — inside the calendar card */}
        <div className="border-t border-gray-100 pt-3 mt-2">
          <div className="flex gap-1.5 flex-wrap justify-center items-start">
            {months.map((m, i) => (
              <button key={i} onClick={() => setMonthIdx(i)} data-testid={`button-month-${m.label}`}
                className={`flex flex-col items-center px-2 py-1.5 rounded-lg text-xs transition-all ${
                  i === monthIdx ? 'bg-blue-50 border border-blue-300 shadow-sm' : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                }`}>
                <span className="text-gray-500 font-medium">{SHORT_MONTH[m.month]} {String(m.year).slice(2)}</span>
                <span className={`font-mono font-bold mt-0.5 ${m.totalPnl >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatPnl(m.totalPnl)}</span>
                <span className={`font-mono text-[10px] ${m.returnPct >= 0 ? 'text-green-500' : 'text-red-400'}`}>{fmtPct(m.returnPct)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* Monthly segment breakdown */}
      {monthSegs.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-semibold text-gray-900">
              {MONTH_NAMES[currentMonth.month]} — Segment Performance
            </h3>
            <span className="text-xs text-gray-400">Best → Worst</span>
          </div>
          <CompactSegmentTable segs={monthSegs} />
        </div>
      )}
    </div>
  );
}

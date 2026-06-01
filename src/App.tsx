import { useState, useEffect, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { RefreshCw, LayoutDashboard, BarChart3, Calendar, BookOpen } from 'lucide-react';
import { Trade, toLocalDateStr } from './lib/sheetParser';
import { computeStats, computeSegmentStats, computeDayPnl, computeGroupedSegments, TradeStats, SegmentStats, DayPnl, InstrumentGroup } from './lib/stats';
import { Dashboard } from './components/Dashboard';
import { Segments } from './components/Segments';
import { CalendarView } from './components/CalendarView';
import TradeBook from './pages/TradeBook';

const queryClient = new QueryClient();

type Tab = 'dashboard' | 'segments' | 'calendar' | 'tradebook';

interface AppData {
  trades: Trade[];
  stats: TradeStats;
  segments: SegmentStats[];
  groupedSegments: InstrumentGroup[];
  dayPnls: DayPnl[];
  loadedAt: Date;
  totalDays: number;
}

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseDDMMYYYY(dateStr: string): { date: Date; dateStr: string } | null {
  const s = dateStr.trim();
  const m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10) - 1;
  const year = parseInt(m[3], 10);
  const d = new Date(year, month, day);
  if (d.getMonth() !== month || d.getDate() !== day) return null;
  return { date: d, dateStr: toLocalDateStr(d) };
}

function convertApiTrades(apiTrades: Array<Record<string, unknown>>): Trade[] {
  return apiTrades.map(t => {
    const dateStrRaw = String(t.date || '');
    const parsed = parseDDMMYYYY(dateStrRaw);
    if (parsed) {
      return {
        date: parsed.date,
        dateStr: parsed.dateStr,
        segment: String(t.segment || ''),
        qty: Number(t.qty) || 0,
        buy: Number(t.buyPremium) || 0,
        sell: Number(t.sellPremium) || 0,
        points: Number(t.points) || 0,
        profit: Number(t.profit) || 0,
        loss: Number(t.loss) || 0,
        tax: Number(t.tax) || 0,
        rulesFollowed: String(t.ruleFollowed).toLowerCase() === 'yes',
        reason: '',
        actualProfit: Number(t.pnl) || 0,
        missedProfits: 0,
      };
    }
    const parts = dateStrRaw.split('-');
    const day = parseInt(parts[0]) || 1;
    const monthIdx = MONTH_MAP[parts[1]?.toLowerCase()?.substring(0, 3) ?? ''] ?? 0;
    const year = parseInt(parts[2]) || new Date().getFullYear();
    const date = new Date(year, monthIdx, day);
    return {
      date,
      dateStr: toLocalDateStr(date),
      segment: String(t.segment || ''),
      qty: Number(t.qty) || 0,
      buy: Number(t.buyPremium) || 0,
      sell: Number(t.sellPremium) || 0,
      points: Number(t.points) || 0,
      profit: Number(t.profit) || 0,
      loss: Number(t.loss) || 0,
      tax: Number(t.tax) || 0,
      rulesFollowed: String(t.ruleFollowed).toLowerCase() === 'yes',
      reason: '',
      actualProfit: Number(t.pnl) || 0,
      missedProfits: 0,
    };
  });
}

function useTrades() {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/trades');
      const json = await res.json();
      if (!json.success || !Array.isArray(json.trades)) {
        throw new Error('Failed to load trades from trades.xlsx');
      }
      const trades = convertApiTrades(json.trades);
      if (!trades.length) {
        throw new Error('No trades found in trades.xlsx');
      }
      const stats = computeStats(trades);
      const segments = computeSegmentStats(trades);
      const groupedSegments = computeGroupedSegments(trades);
      const dayPnls = computeDayPnl(trades);
      setData({
        trades, stats, segments, groupedSegments, dayPnls,
        loadedAt: new Date(),
        totalDays: stats.totalTradingDays,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_, version]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => setVersion(v => v + 1), 5000);
    return () => clearInterval(interval);
  }, []);

  const refetch = useCallback(() => setVersion(v => v + 1), []);
  return { data, loading, error, refetch };
}

function AppContent() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const { data, loading, error, refetch } = useTrades();

  const tabs: Array<{ id: Tab; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
    { id: 'segments',   label: 'Segments',   icon: BarChart3 },
    { id: 'calendar',   label: 'Calendar',   icon: Calendar },
    { id: 'tradebook',  label: 'Trade Book', icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
              <BarChart3 className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-foreground truncate">Trading Journal - Kishore</h1>
              <p className="text-xs text-muted-foreground truncate">
                {loading ? 'Loading...' : data
                  ? `${data.totalDays} trading days · ${data.trades.length} trades · updated ${data.loadedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : error ? 'Error loading data' : 'No data'}
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center bg-muted/50 rounded-lg p-0.5 gap-0.5">
            {tabs.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} data-testid={`tab-${t.id}`}
                  className={`flex gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all justify-center items-center text-[10px] ${
                    tab === t.id
                      ? 'bg-card shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  <Icon className="w-3.5 h-3.5" />{t.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button onClick={refetch} disabled={loading} data-testid="button-refresh"
              className="flex gap-1.5 hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted/50 transition-all disabled:opacity-50 justify-center items-center text-[#1a8a1a] text-[13px] font-bold bg-[#edf5ef80]">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="sm:hidden border-t border-border flex overflow-x-auto">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} data-testid={`tab-mobile-${t.id}`}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all whitespace-nowrap px-2 ${
                  tab === t.id ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'
                }`}>
                <Icon className="w-3.5 h-3.5" />{t.label}
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Trade Book tab — always available */}
        {tab === 'tradebook' && <TradeBook onTradeSaved={refetch} />}

        {/* Other tabs need data */}
        {tab !== 'tradebook' && loading && !data && (
          <div className="flex items-center justify-center py-32">
            <div className="text-center space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Loading trading data from trades.xlsx...</p>
            </div>
          </div>
        )}
        {tab !== 'tradebook' && error && !data && (
          <div className="flex items-center justify-center py-32">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 max-w-md text-center">
              <p className="text-sm font-semibold text-red-400 mb-2">Failed to load data</p>
              <p className="text-xs text-muted-foreground mb-4">{error}</p>
              <div className="flex gap-2 justify-center">
                <button onClick={refetch} className="text-xs bg-muted text-foreground rounded-lg px-4 py-2 hover:bg-muted/70 transition-colors">Try Again</button>
              </div>
            </div>
          </div>
        )}
        {tab !== 'tradebook' && data && (
          <>
            {tab === 'dashboard' && (
              <Dashboard
                stats={data.stats}
                segments={data.segments}
                groupedSegments={data.groupedSegments}
                dayPnls={data.dayPnls}
                trades={data.trades}
              />
            )}
            {tab === 'segments' && (
              <Segments segments={data.segments} groupedSegments={data.groupedSegments} trades={data.trades} />
            )}
            {tab === 'calendar' && (
              <CalendarView dayPnls={data.dayPnls} trades={data.trades} />
            )}
          </>
        )}
      </main>
      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

import { useState, useEffect, useCallback, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { RefreshCw, FileText, LayoutDashboard, BarChart3, Calendar, X, Check, BookOpen } from 'lucide-react';
import Papa from 'papaparse';
import { parseCsv, buildCsvUrl, Trade, parse2025Data, Historical2025, toLocalDateStr } from './lib/sheetParser';
import { computeStats, computeSegmentStats, computeDayPnl, computeGroupedSegments, TradeStats, SegmentStats, DayPnl, InstrumentGroup } from './lib/stats';
import { Dashboard } from './components/Dashboard';
import { Segments } from './components/Segments';
import { CalendarView } from './components/CalendarView';
import TradeBook from './pages/TradeBook';

const queryClient = new QueryClient();

const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1S0daWgmjoNE1QMjhrPBUw6j0XWnJVLbw/export?format=csv&gid=1018221512';
const STORAGE_KEY = 'trading-journal-sheet-url';

type Tab = 'dashboard' | 'segments' | 'calendar' | 'tradebook';

interface AppData {
  trades: Trade[];
  stats: TradeStats;
  segments: SegmentStats[];
  groupedSegments: InstrumentGroup[];
  dayPnls: DayPnl[];
  historical2025: Historical2025;
  loadedAt: Date;
  totalDays: number;
}

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function convertLocalTrades(apiTrades: Array<Record<string, unknown>>): Trade[] {
  const year = new Date().getFullYear();
  return apiTrades.map(t => {
    const parts = String(t.date || '').split('-');
    const day = parseInt(parts[0]) || 1;
    const monthIdx = MONTH_MAP[parts[1]?.toLowerCase()?.substring(0, 3) ?? ''] ?? 0;
    const date = new Date(year, monthIdx, day);
    const dateStr = toLocalDateStr(date);
    return {
      date,
      dateStr,
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

function useSheetData(url: string) {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async (csvUrl: string) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(csvUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      const result = Papa.parse<string[]>(text, { skipEmptyLines: false });
      const rows = result.data as string[][];
      const trades = parseCsv(rows);
      if (!trades.length) throw new Error('No trade data found. Check the sheet URL and make sure it is publicly accessible.');
      const stats = computeStats(trades);
      const segments = computeSegmentStats(trades);
      const groupedSegments = computeGroupedSegments(trades);
      const dayPnls = computeDayPnl(trades);
      const historical2025 = parse2025Data(rows);
      setData({
        trades, stats, segments, groupedSegments, dayPnls, historical2025,
        loadedAt: new Date(),
        totalDays: stats.totalTradingDays,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch_(url); }, [url, fetch_]);
  return { data, loading, error, refetch: () => fetch_(url) };
}

function useLocalTrades() {
  const [localTrades, setLocalTrades] = useState<Trade[]>([]);
  const [version, setVersion] = useState(0);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch('/api/trades');
      const json = await res.json();
      if (json.success && Array.isArray(json.trades) && json.trades.length > 0) {
        setLocalTrades(convertLocalTrades(json.trades));
      } else {
        setLocalTrades([]);
      }
    } catch {
      // backend may not be running
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_, version]);

  const refetch = useCallback(() => setVersion(v => v + 1), []);
  return { localTrades, refetchLocal: refetch };
}

function ChangeFileModal({ onConfirm, onClose }: { onConfirm: (url: string) => void; onClose: () => void }) {
  const [value, setValue] = useState('');
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-card-border rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Change Google Sheet</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Paste your Google Sheets share URL or CSV export URL. Make sure the sheet is set to "Anyone with the link can view".
        </p>
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
          data-testid="input-sheet-url"
          autoFocus
        />
        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg bg-muted text-sm text-muted-foreground hover:bg-muted/70 transition-colors"
          >Cancel</button>
          <button
            onClick={() => { if (value.trim()) { onConfirm(value.trim()); onClose(); } }}
            disabled={!value.trim()}
            className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-1.5"
            data-testid="button-confirm-change-file"
          ><Check className="w-4 h-4" /> Load Sheet</button>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const [sheetUrl, setSheetUrl] = useState(() => localStorage.getItem(STORAGE_KEY) || DEFAULT_SHEET_URL);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [showChangeFile, setShowChangeFile] = useState(false);

  const { data, loading, error, refetch } = useSheetData(sheetUrl);
  const { localTrades } = useLocalTrades();

  // Merge Google Sheets trades with local Trade Book trades
  const mergedData = useMemo<AppData | null>(() => {
    if (!data) return null;
    if (!localTrades.length) return data;

    const allTrades = [...data.trades, ...localTrades].sort((a, b) => a.date.getTime() - b.date.getTime());
    const stats = computeStats(allTrades);
    const segments = computeSegmentStats(allTrades);
    const groupedSegments = computeGroupedSegments(allTrades);
    const dayPnls = computeDayPnl(allTrades);

    return {
      ...data,
      trades: allTrades,
      stats,
      segments,
      groupedSegments,
      dayPnls,
      totalDays: stats.totalTradingDays,
    };
  }, [data, localTrades]);

  const handleChangeFile = (url: string) => {
    const csvUrl = buildCsvUrl(url);
    localStorage.setItem(STORAGE_KEY, csvUrl);
    setSheetUrl(csvUrl);
  };

  const tabs: Array<{ id: Tab; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
    { id: 'segments',   label: 'Segments',   icon: BarChart3 },
    { id: 'calendar',   label: 'Calendar',   icon: Calendar },
    { id: 'tradebook',  label: 'Trade Book', icon: BookOpen },
  ];

  const displayData = mergedData;

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
                {loading ? 'Loading...' : displayData
                  ? `${displayData.totalDays} trading days · ${localTrades.length > 0 ? `+${localTrades.length} local trades · ` : ''}updated ${displayData.loadedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
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
            {tab !== 'tradebook' && (
              <button onClick={refetch} disabled={loading} data-testid="button-refresh"
                className="flex gap-1.5 hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted/50 transition-all disabled:opacity-50 justify-center items-center text-[#1a8a1a] text-[13px] font-bold bg-[#edf5ef80]">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh
              </button>
            )}
            <button onClick={() => setShowChangeFile(true)} data-testid="button-change-file"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted/50 transition-all">
              <FileText className="w-3.5 h-3.5" />Change file
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
        {tab === 'tradebook' && <TradeBook />}

        {/* Other tabs need data */}
        {tab !== 'tradebook' && loading && !displayData && (
          <div className="flex items-center justify-center py-32">
            <div className="text-center space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Loading trading data from Google Sheets...</p>
            </div>
          </div>
        )}
        {tab !== 'tradebook' && error && !displayData && (
          <div className="flex items-center justify-center py-32">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 max-w-md text-center">
              <p className="text-sm font-semibold text-red-400 mb-2">Failed to load data</p>
              <p className="text-xs text-muted-foreground mb-4">{error}</p>
              <div className="flex gap-2 justify-center">
                <button onClick={refetch} className="text-xs bg-muted text-foreground rounded-lg px-4 py-2 hover:bg-muted/70 transition-colors">Try Again</button>
                <button onClick={() => setShowChangeFile(true)} className="text-xs bg-primary text-primary-foreground rounded-lg px-4 py-2 hover:opacity-90 transition-all">Change Sheet</button>
              </div>
            </div>
          </div>
        )}
        {tab !== 'tradebook' && displayData && (
          <>
            {tab === 'dashboard' && (
              <Dashboard
                stats={displayData.stats}
                segments={displayData.segments}
                groupedSegments={displayData.groupedSegments}
                dayPnls={displayData.dayPnls}
                historical2025={displayData.historical2025}
                trades={displayData.trades}
              />
            )}
            {tab === 'segments' && (
              <Segments segments={displayData.segments} groupedSegments={displayData.groupedSegments} trades={displayData.trades} />
            )}
            {tab === 'calendar' && (
              <CalendarView dayPnls={displayData.dayPnls} trades={displayData.trades} />
            )}
          </>
        )}
      </main>

      {showChangeFile && (
        <ChangeFileModal onConfirm={handleChangeFile} onClose={() => setShowChangeFile(false)} />
      )}
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

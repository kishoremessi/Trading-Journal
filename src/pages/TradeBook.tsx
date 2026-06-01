import { useState, useEffect, useCallback } from 'react';
import { PlusCircle, CheckCircle2, XCircle, TrendingUp, TrendingDown, BookOpen, RefreshCw, Trash2 } from 'lucide-react';

interface TradeFormState {
  date: string;
  segment: string;
  qty: string;
  buy: string;
  sell: string;
  tax: string;
  rule: string;
}

interface TradeRecord {
  id: number;
  date: string;
  segment: string;
  qty: number;
  buyPremium: number;
  sellPremium: number;
  points: number;
  profit: number;
  loss: number;
  tax: number;
  ruleFollowed: string;
  pnl: number;
  result: string;
}

const SEGMENTS = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'STOCKS'];

const GSHEET_URL =
  'https://script.google.com/macros/s/AKfycbz-d1MJr_4Aqq-_vbur2OTZlgJrncJfPLyKDRGNgvZd2bQd7CFHabVxZqQI7mvX97U_/exec';

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
}

const emptyForm: TradeFormState = {
  date: new Date().toISOString().split('T')[0],
  segment: 'BANKNIFTY',
  qty: '',
  buy: '',
  sell: '',
  tax: '',
  rule: 'YES',
};

const inputCls =
  'w-full bg-[#1a1a24] border border-[#2a2a38] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 outline-none focus:border-[#4a4a8a] focus:ring-1 focus:ring-[#4a4a8a]/40 transition-colors';
const labelCls =
  'block text-[11px] font-medium text-gray-500 mb-1.5 uppercase tracking-wider';

export default function TradeBook() {
  const [form, setForm] = useState<TradeFormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMsg, setSubmitMsg] = useState('');
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const qty = parseFloat(form.qty) || 0;
  const buy = parseFloat(form.buy) || 0;
  const sell = parseFloat(form.sell) || 0;
  const tax = parseFloat(form.tax) || 0;
  const points = sell - buy;
  const rawPnL = points * qty;
  const pnl = rawPnL - tax;
  const profit = pnl > 0 ? pnl : 0;
  const loss = pnl < 0 ? Math.abs(pnl) : 0;
  const result = pnl >= 0 ? 'Target Hit' : 'Stop Loss Hit';
  const hasCalc = qty > 0 && (buy > 0 || sell > 0);

  const fetchTrades = useCallback(async () => {
    setLoadingTrades(true);
    try {
      const res = await fetch('/api/trades');
      const data = await res.json();
      if (data.success) setTrades([...data.trades].reverse());
    } catch {
      /* backend may not be reachable */
    } finally {
      setLoadingTrades(false);
    }
  }, []);

  useEffect(() => {
    fetchTrades();
  }, [fetchTrades]);

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        const res = await fetch(`/api/trades/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          setConfirmDeleteId(null);
          fetchTrades();
        }
      } catch {
        /* silent */
      }
    },
    [fetchTrades]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (submitStatus !== 'idle') setSubmitStatus('idle');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date || !form.segment || !qty) return;
    setSubmitting(true);
    setSubmitStatus('idle');

    const payload = {
      Date: form.date,
      Segment: form.segment,
      Quantity: qty,
      BuyPremium: buy,
      SellPremium: sell,
      PointsDifference: points,
      PnL: pnl,
      Profit: profit,
      Loss: loss,
      Tax: tax,
      RuleFollowed: form.rule,
      Result: result,
    };

    try {
      // Save to Google Sheets
      await fetch(GSHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // Also save to local XLSX for Recent Trades panel
      try {
        await fetch('/api/add-trade', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        fetchTrades();
      } catch {
        /* local save optional */
      }

      setSubmitStatus('success');
      setSubmitMsg('Trade saved to Google Sheet! Hit Refresh on Dashboard to see it.');
      setForm(prev => ({ ...emptyForm, date: prev.date, segment: prev.segment }));
    } catch {
      setSubmitStatus('error');
      setSubmitMsg('Failed to save trade. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 rounded-2xl bg-[#07070f] p-5 border border-[#1a1a2e]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
          <BookOpen className="w-4 h-4 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Trade Book</h2>
          <p className="text-[11px] text-gray-500">
            Saves to Google Sheets · Hit Refresh on Dashboard to see updates
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* ── Form ── */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-3 bg-[#0e0e1a] border border-[#1e1e30] rounded-xl p-5 space-y-4"
        >
          <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">
            New Entry
          </p>

          <div className="grid grid-cols-2 gap-3">
            {/* Date */}
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Date</label>
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                required
                className={inputCls}
              />
            </div>

            {/* Segment */}
            <div className="col-span-2 sm:col-span-1">
              <label className={labelCls}>Segment</label>
              <select
                name="segment"
                value={form.segment}
                onChange={handleChange}
                className={inputCls + ' appearance-none cursor-pointer'}
              >
                {SEGMENTS.map(s => (
                  <option key={s} value={s} className="bg-[#1a1a24]">
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className={labelCls}>Quantity</label>
              <input
                type="number"
                name="qty"
                value={form.qty}
                onChange={handleChange}
                placeholder="e.g. 50"
                min="1"
                step="1"
                required
                className={inputCls}
              />
            </div>

            {/* Tax */}
            <div>
              <label className={labelCls}>Tax (₹)</label>
              <input
                type="number"
                name="tax"
                value={form.tax}
                onChange={handleChange}
                placeholder="e.g. 150"
                min="0"
                step="0.01"
                className={inputCls}
              />
            </div>

            {/* Buy */}
            <div>
              <label className={labelCls}>Buy Premium (₹)</label>
              <input
                type="number"
                name="buy"
                value={form.buy}
                onChange={handleChange}
                placeholder="e.g. 120.50"
                min="0"
                step="0.01"
                className={inputCls}
              />
            </div>

            {/* Sell */}
            <div>
              <label className={labelCls}>Sell Premium (₹)</label>
              <input
                type="number"
                name="sell"
                value={form.sell}
                onChange={handleChange}
                placeholder="e.g. 175.00"
                min="0"
                step="0.01"
                className={inputCls}
              />
            </div>

            {/* Rule */}
            <div className="col-span-2">
              <label className={labelCls}>Rule Followed?</label>
              <select
                name="rule"
                value={form.rule}
                onChange={handleChange}
                className={inputCls + ' appearance-none cursor-pointer'}
              >
                <option value="YES" className="bg-[#1a1a24]">YES</option>
                <option value="NO" className="bg-[#1a1a24]">NO</option>
              </select>
            </div>
          </div>

          {/* Live P&L preview */}
          {hasCalc && (
            <div
              className={`rounded-xl p-3.5 border text-xs ${
                pnl >= 0
                  ? 'bg-green-950/40 border-green-800/30'
                  : 'bg-red-950/40 border-red-800/30'
              }`}
            >
              <p className="font-semibold text-white mb-2.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                {pnl >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                )}
                Live Preview
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-gray-400">
                <span>Quantity</span>
                <span className="text-white font-medium">{qty} units</span>
                <span>Points Diff</span>
                <span className="text-white font-medium">{points.toFixed(2)}</span>
                <span>Gross P&amp;L</span>
                <span className={`font-medium ${rawPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(rawPnL)}
                </span>
                <span>Tax</span>
                <span className="text-white font-medium">−{formatCurrency(tax)}</span>
                <span>Net P&amp;L</span>
                <span
                  className={`font-bold text-sm ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}
                >
                  {formatCurrency(pnl)}
                </span>
                <span>Result</span>
                <span
                  className={`font-semibold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}
                >
                  {result}
                </span>
              </div>
            </div>
          )}

          {submitStatus === 'success' && (
            <div className="flex items-center gap-2 text-xs text-green-400 bg-green-950/50 border border-green-800/30 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              {submitMsg}
            </div>
          )}
          {submitStatus === 'error' && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/50 border border-red-800/30 rounded-lg px-3 py-2">
              <XCircle className="w-3.5 h-3.5 shrink-0" />
              {submitMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !form.date || !form.segment || !qty}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-40 transition-all"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4" /> Add Trade
              </>
            )}
          </button>
        </form>

        {/* ── Recent Trades ── */}
        <div className="lg:col-span-2 bg-[#0e0e1a] border border-[#1e1e30] rounded-xl p-5 flex flex-col min-h-64">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">
              Recent Trades
            </p>
            <button
              onClick={fetchTrades}
              disabled={loadingTrades}
              className="text-gray-600 hover:text-gray-300 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingTrades ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loadingTrades && (
            <div className="flex-1 flex items-center justify-center py-8">
              <RefreshCw className="w-5 h-5 animate-spin text-gray-600" />
            </div>
          )}

          {!loadingTrades && trades.length === 0 && (
            <div className="flex-1 flex items-center justify-center py-8 text-center">
              <div>
                <BookOpen className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-xs text-gray-600">
                  No trades logged yet.<br />Add your first trade using the form.
                </p>
              </div>
            </div>
          )}

          {!loadingTrades && trades.length > 0 && (
            <div className="space-y-2 overflow-y-auto max-h-[540px] pr-1">
              {trades.map((t, i) => {
                const isConfirming = confirmDeleteId === t.id;
                const isProfit = Number(t.pnl) >= 0;
                return (
                  <div
                    key={i}
                    className={`rounded-xl p-3 border text-xs space-y-1.5 transition-colors ${
                      isConfirming
                        ? 'border-red-800/50 bg-red-950/20'
                        : 'border-[#222230] bg-[#111120] hover:border-[#2a2a40]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-semibold text-white">{t.date}</span>
                        <span className="mx-1.5 text-gray-600">·</span>
                        <span className="text-indigo-400 font-medium">{t.segment}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`font-bold text-sm ${isProfit ? 'text-green-400' : 'text-red-400'}`}
                        >
                          {isProfit ? '+' : ''}
                          {formatCurrency(Number(t.pnl))}
                        </span>
                        {isConfirming ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(t.id)}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-600 text-white hover:bg-red-500 transition-colors"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#222] text-gray-400 hover:text-white transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(t.id)}
                            className="text-gray-700 hover:text-red-500 transition-colors p-0.5 rounded"
                            title="Delete this trade"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-gray-500">
                      <span className="text-gray-400">
                        {t.qty} <span className="text-gray-600">units</span>
                      </span>
                      <span>
                        B: <span className="text-gray-300">₹{t.buyPremium}</span>
                      </span>
                      <span>
                        S: <span className="text-gray-300">₹{t.sellPremium}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${
                          isProfit
                            ? 'bg-green-950/60 text-green-400 border border-green-800/30'
                            : 'bg-red-950/60 text-red-400 border border-red-800/30'
                        }`}
                      >
                        {isProfit ? (
                          <TrendingUp className="w-2.5 h-2.5" />
                        ) : (
                          <TrendingDown className="w-2.5 h-2.5" />
                        )}
                        {t.result}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium ${
                          String(t.ruleFollowed).toLowerCase() === 'yes'
                            ? 'bg-indigo-950/60 text-indigo-400 border border-indigo-800/30'
                            : 'bg-[#1a1a24] text-gray-500 border border-[#2a2a38]'
                        }`}
                      >
                        {String(t.ruleFollowed).toLowerCase() === 'yes' ? (
                          <CheckCircle2 className="w-2.5 h-2.5" />
                        ) : (
                          <XCircle className="w-2.5 h-2.5" />
                        )}
                        Rules{' '}
                        {String(t.ruleFollowed).toLowerCase() === 'yes' ? 'Followed' : 'Broken'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

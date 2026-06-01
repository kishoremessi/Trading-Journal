import { useState, useEffect, useCallback } from 'react';
import { PlusCircle, CheckCircle2, XCircle, TrendingUp, TrendingDown, BookOpen, RefreshCw } from 'lucide-react';

interface TradeFormState {
  date: string;
  segment: string;
  quantity: string;
  buyPremium: string;
  sellPremium: string;
  tax: string;
  ruleFollowed: string;
}

interface TradeRecord {
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

const SEGMENTS = ['NIFTY CE', 'NIFTY PE', 'BANKNIFTY CE', 'BANKNIFTY PE', 'FINNIFTY CE', 'FINNIFTY PE', 'STOCKS'];

function formatDateToDDMMM(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()}-${months[d.getMonth()]}`;
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
}

const emptyForm: TradeFormState = {
  date: new Date().toISOString().split('T')[0],
  segment: 'NIFTY CE',
  quantity: '',
  buyPremium: '',
  sellPremium: '',
  tax: '',
  ruleFollowed: 'Yes',
};

export default function TradeBook() {
  const [form, setForm] = useState<TradeFormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMsg, setSubmitMsg] = useState('');
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [loadingTrades, setLoadingTrades] = useState(false);

  const qty = parseFloat(form.quantity) || 0;
  const buy = parseFloat(form.buyPremium) || 0;
  const sell = parseFloat(form.sellPremium) || 0;
  const tax = parseFloat(form.tax) || 0;

  const pointsDiff = sell - buy;
  const rawPnL = pointsDiff * qty;
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
      // backend may not be reachable
    } finally {
      setLoadingTrades(false);
    }
  }, []);

  useEffect(() => { fetchTrades(); }, [fetchTrades]);

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
      Date: formatDateToDDMMM(form.date),
      Segment: form.segment,
      Quantity: qty,
      BuyPremium: buy,
      SellPremium: sell,
      PointsDifference: pointsDiff,
      PnL: pnl,
      Profit: profit,
      Loss: loss,
      Tax: tax,
      RuleFollowed: form.ruleFollowed,
      Result: result,
    };

    try {
      const res = await fetch('/api/add-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitStatus('success');
        setSubmitMsg('Trade saved to XLSX successfully!');
        setForm(prev => ({ ...emptyForm, date: prev.date }));
        fetchTrades();
      } else {
        throw new Error(data.error || 'Failed to save trade');
      }
    } catch (err) {
      setSubmitStatus('error');
      setSubmitMsg(err instanceof Error ? err.message : 'Failed to save trade');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
          <BookOpen className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Trade Book</h2>
          <p className="text-xs text-muted-foreground">Log a new trade — appended to your local XLSX file</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-3 bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Trade Entry</h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date</label>
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                required
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Segment</label>
              <select
                name="segment"
                value={form.segment}
                onChange={handleChange}
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              >
                {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Quantity (Lots)</label>
              <input
                type="number"
                name="quantity"
                value={form.quantity}
                onChange={handleChange}
                placeholder="e.g. 50"
                min="1"
                required
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tax (₹)</label>
              <input
                type="number"
                name="tax"
                value={form.tax}
                onChange={handleChange}
                placeholder="e.g. 150"
                min="0"
                step="0.01"
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Buy Premium (₹)</label>
              <input
                type="number"
                name="buyPremium"
                value={form.buyPremium}
                onChange={handleChange}
                placeholder="e.g. 120.50"
                min="0"
                step="0.01"
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Sell Premium (₹)</label>
              <input
                type="number"
                name="sellPremium"
                value={form.sellPremium}
                onChange={handleChange}
                placeholder="e.g. 175.00"
                min="0"
                step="0.01"
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Rule Followed?</label>
              <select
                name="ruleFollowed"
                value={form.ruleFollowed}
                onChange={handleChange}
                className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
          </div>

          {/* Live Calculation Preview */}
          {hasCalc && (
            <div className={`rounded-lg p-3 border text-xs space-y-1.5 ${pnl >= 0 ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
              <p className="font-semibold text-foreground mb-2 flex items-center gap-1.5">
                {pnl >= 0
                  ? <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                  : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                Live Calculation Preview
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                <span>Points Difference:</span>
                <span className="font-medium text-foreground">{pointsDiff.toFixed(2)}</span>
                <span>Gross P&amp;L:</span>
                <span className={`font-medium ${rawPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(rawPnL)}</span>
                <span>Tax Deducted:</span>
                <span className="font-medium text-foreground">−{formatCurrency(tax)}</span>
                <span>Net P&amp;L:</span>
                <span className={`font-semibold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(pnl)}</span>
                <span>Result:</span>
                <span className={`font-semibold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{result}</span>
              </div>
            </div>
          )}

          {submitStatus === 'success' && (
            <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-3.5 h-3.5" />{submitMsg}
            </div>
          )}
          {submitStatus === 'error' && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <XCircle className="w-3.5 h-3.5" />{submitMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !form.date || !form.segment || !qty}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-all"
          >
            {submitting
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</>
              : <><PlusCircle className="w-4 h-4" /> Add Trade</>}
          </button>
        </form>

        {/* Trade History */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5 flex flex-col min-h-64">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Trades</h3>
            <button onClick={fetchTrades} disabled={loadingTrades} className="text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${loadingTrades ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loadingTrades && (
            <div className="flex-1 flex items-center justify-center py-8">
              <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loadingTrades && trades.length === 0 && (
            <div className="flex-1 flex items-center justify-center py-8 text-center">
              <div>
                <BookOpen className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No trades logged yet.<br />Add your first trade using the form.</p>
              </div>
            </div>
          )}

          {!loadingTrades && trades.length > 0 && (
            <div className="space-y-2 overflow-y-auto max-h-[520px] pr-1">
              {trades.map((t, i) => (
                <div key={i} className="border border-border rounded-lg p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{t.date} · {t.segment}</span>
                    <span className={`font-bold ${Number(t.pnl) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {Number(t.pnl) >= 0 ? '+' : ''}{formatCurrency(Number(t.pnl))}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>Qty: {t.qty}</span>
                    <span>Buy: ₹{t.buyPremium}</span>
                    <span>Sell: ₹{t.sellPremium}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      t.result === 'Target Hit' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
                    }`}>
                      {t.result === 'Target Hit'
                        ? <TrendingUp className="w-2.5 h-2.5" />
                        : <TrendingDown className="w-2.5 h-2.5" />}
                      {t.result}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      String(t.ruleFollowed).toLowerCase() === 'yes' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {String(t.ruleFollowed).toLowerCase() === 'yes'
                        ? <CheckCircle2 className="w-2.5 h-2.5" />
                        : <XCircle className="w-2.5 h-2.5" />}
                      Rules {String(t.ruleFollowed).toLowerCase() === 'yes' ? 'Followed' : 'Broken'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

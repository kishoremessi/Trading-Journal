import { useState, useEffect, useCallback } from "react";
import {
  PlusCircle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  BookOpen,
  RefreshCw,
  Trash2,
  Pencil,
  Download,
} from "lucide-react";

interface TradeFormState {
  date: string;
  segment: string;
  lots: string;
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

const SEGMENTS = [
  "NiftyCE",
  "NiftyPE",
  "BankniftyCE",
  "BankniftyPE",
  "Sensex CE",
  "Sensex PE",
  "NiftyBullCE",
  "NiftyBullPE",
  "SensexBullCE",
  "SensexBullPE",
];

const LOT_SIZES: Record<string, number> = {
  NiftyCE: 65,
  NiftyPE: 65,
  BankniftyCE: 30,
  BankniftyPE: 30,
  "Sensex CE": 20,
  "Sensex PE": 20,
  NiftyBullCE: 65,
  NiftyBullPE: 65,
  SensexBullCE: 20,
  SensexBullPE: 20,
};

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
}

function getLotSize(segment: string): number {
  return LOT_SIZES[segment] ?? 1;
}

const emptyForm: TradeFormState = {
  date: new Date().toISOString().split("T")[0],
  segment: "NiftyCE",
  lots: "",
  buy: "",
  sell: "",
  tax: "",
  rule: "YES",
};

const inputCls =
  "w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-colors";
const labelCls =
  "block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider";

function ddmmyyyyToYyyyMmDd(ddmmyyyy: string): string {
  const m = ddmmyyyy.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return ddmmyyyy;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function yyyyMmDdToDdmmyyyy(yyyyMmDd: string): string {
  const m = yyyyMmDd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return yyyyMmDd;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

interface TradeBookProps {
  onTradeSaved?: () => void;
}

export default function TradeBook({ onTradeSaved }: TradeBookProps) {
  const [form, setForm] = useState<TradeFormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [submitMsg, setSubmitMsg] = useState("");
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [loadingTrades, setLoadingTrades] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const lots = parseFloat(form.lots) || 0;
  const lotSize = getLotSize(form.segment);
  const actualQty = lots * lotSize;
  const buy = parseFloat(form.buy) || 0;
  const sell = parseFloat(form.sell) || 0;
  const tax = parseFloat(form.tax) || 0;
  const points = sell - buy;
  const rawPnL = points * actualQty;
  const pnl = rawPnL - tax;
  const profit = pnl > 0 ? pnl : 0;
  const loss = pnl < 0 ? Math.abs(pnl) : 0;
  const result = pnl >= 0 ? "Target Hit" : "Stop Loss Hit";
  const hasCalc = lots > 0 && (buy > 0 || sell > 0);

  const fetchTrades = useCallback(async () => {
    setLoadingTrades(true);
    try {
      const res = await fetch("/api/trades");
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
        const res = await fetch(`/api/trades/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          setConfirmDeleteId(null);
          fetchTrades();
          onTradeSaved?.();
        }
      } catch {
        /* silent */
      }
    },
    [fetchTrades, onTradeSaved],
  );

  const handleEdit = useCallback((trade: TradeRecord) => {
    const ls = getLotSize(trade.segment);
    const lotsDisplay = ls
      ? Math.round(Number(trade.qty) / ls)
      : Number(trade.qty);
    setForm({
      date: ddmmyyyyToYyyyMmDd(String(trade.date)),
      segment: trade.segment,
      lots: String(lotsDisplay),
      buy: String(trade.buyPremium),
      sell: String(trade.sellPremium),
      tax: String(trade.tax),
      rule: String(trade.ruleFollowed),
    });
    setEditingId(trade.id);
    setSubmitStatus("idle");
    setSubmitMsg("");
  }, []);

  const cancelEdit = useCallback(() => {
    setForm(emptyForm);
    setEditingId(null);
    setSubmitStatus("idle");
    setSubmitMsg("");
  }, []);

  const handleUpdate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (editingId === null || !form.date || !form.segment || !lots) return;
      setSubmitting(true);
      setSubmitStatus("idle");

      const payload = {
        Date: yyyyMmDdToDdmmyyyy(form.date),
        Segment: form.segment,
        Quantity: actualQty,
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
        const res = await fetch(`/api/trades/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Update failed");

        setSubmitStatus("success");
        setSubmitMsg("Trade updated successfully.");
        setEditingId(null);
        setForm(emptyForm);
        fetchTrades();
        onTradeSaved?.();
      } catch (err) {
        setSubmitStatus("error");
        setSubmitMsg(
          err instanceof Error ? err.message : "Failed to update trade.",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [
      editingId,
      form,
      lots,
      actualQty,
      buy,
      sell,
      tax,
      points,
      pnl,
      profit,
      loss,
      result,
      fetchTrades,
      onTradeSaved,
    ],
  );

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (submitStatus !== "idle") setSubmitStatus("idle");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date || !form.segment || !lots) return;
    setSubmitting(true);
    setSubmitStatus("idle");

    const payload = {
      Date: yyyyMmDdToDdmmyyyy(form.date),
      Segment: form.segment,
      Quantity: actualQty,
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
      const res = await fetch("/api/add-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to save trade");

      setSubmitStatus("success");
      setSubmitMsg("Trade saved to trades.xlsx");
      setForm((prev) => ({
        ...emptyForm,
        date: prev.date,
        segment: prev.segment,
      }));
      fetchTrades();
      onTradeSaved?.();
    } catch (err) {
      setSubmitStatus("error");
      setSubmitMsg(
        err instanceof Error ? err.message : "Failed to save trade.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 rounded-2xl bg-gray-50 p-5 border border-gray-200">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Trade Book</h2>
            <p className="text-[11px] text-gray-500">
              All trades saved to trades.xlsx
            </p>
          </div>
        </div>
        <a
          href="/api/trades/download"
          download="trades.xlsx"
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-all"
          title="Download trades.xlsx"
        >
          <Download className="w-3.5 h-3.5" />
          Download
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* ── Entry Form ── */}
        <form
          onSubmit={editingId !== null ? handleUpdate : handleSubmit}
          className="lg:col-span-3 bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm"
        >
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {editingId !== null ? "Edit Entry" : "New Entry"}
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
              <label className={labelCls}>
                Segment
                {form.segment && (
                  <span className="ml-2 text-blue-500 normal-case font-normal">
                    {lotSize} units/lot
                  </span>
                )}
              </label>
              <select
                name="segment"
                value={form.segment}
                onChange={handleChange}
                className={inputCls + " appearance-none cursor-pointer"}
              >
                {SEGMENTS.map((s) => (
                  <option key={s} value={s}>
                    {s} ({LOT_SIZES[s]}/lot)
                  </option>
                ))}
              </select>
            </div>

            {/* Lots */}
            <div>
              <label className={labelCls}>
                Lots
                {lots > 0 && (
                  <span className="ml-2 text-gray-400 normal-case font-normal">
                    = {actualQty} units
                  </span>
                )}
              </label>
              <input
                type="number"
                name="lots"
                value={form.lots}
                onChange={handleChange}
                placeholder="e.g. 4"
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
                className={inputCls + " appearance-none cursor-pointer"}
              >
                <option value="YES">YES</option>
                <option value="NO">NO</option>
              </select>
            </div>
          </div>

          {/* Live P&L preview */}
          {hasCalc && (
            <div
              className={`rounded-xl p-4 border text-xs ${
                pnl >= 0
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <p className="font-bold text-gray-700 mb-3 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                {pnl >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                )}
                Live Preview
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-gray-500">
                <span>Lots × Size</span>
                <span className="text-gray-800 font-medium">
                  {lots} × {lotSize} = {actualQty} units
                </span>
                <span>Points Diff</span>
                <span className="text-gray-800 font-medium">
                  {points.toFixed(2)}
                </span>
                <span>Gross P&amp;L</span>
                <span
                  className={`font-medium ${rawPnL >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {formatCurrency(rawPnL)}
                </span>
                <span>Tax</span>
                <span className="text-gray-800 font-medium">
                  −{formatCurrency(tax)}
                </span>
                <span>Net P&amp;L</span>
                <span
                  className={`font-bold text-sm ${pnl >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {formatCurrency(pnl)}
                </span>
                <span>Result</span>
                <span
                  className={`font-semibold ${pnl >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {result}
                </span>
              </div>
            </div>
          )}

          {submitStatus === "success" && (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              {submitMsg}
            </div>
          )}
          {submitStatus === "error" && (
            <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <XCircle className="w-3.5 h-3.5 shrink-0" />
              {submitMsg}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting || !form.date || !form.segment || !lots}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-40 transition-all"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  {editingId !== null ? (
                    <>
                      <Pencil className="w-4 h-4" /> Update Trade
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-4 h-4" /> Add Trade
                    </>
                  )}
                </>
              )}
            </button>
            {editingId !== null && (
              <button
                type="button"
                onClick={cancelEdit}
                className="flex items-center justify-center gap-1 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg py-2.5 text-sm font-semibold transition-all"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* ── Recent Trades ── */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5 flex flex-col min-h-64 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Recent Trades
            </p>
            <button
              onClick={fetchTrades}
              disabled={loadingTrades}
              className="text-gray-400 hover:text-gray-700 transition-colors"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loadingTrades ? "animate-spin" : ""}`}
              />
            </button>
          </div>

          {loadingTrades && (
            <div className="flex-1 flex items-center justify-center py-8">
              <RefreshCw className="w-5 h-5 animate-spin text-gray-300" />
            </div>
          )}

          {!loadingTrades && trades.length === 0 && (
            <div className="flex-1 flex items-center justify-center py-8 text-center">
              <div>
                <BookOpen className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400">
                  No trades logged yet.
                  <br />
                  Add your first trade using the form.
                </p>
              </div>
            </div>
          )}

          {!loadingTrades && trades.length > 0 && (
            <div className="space-y-2 overflow-y-auto max-h-[540px] pr-1">
              {trades.map((t, i) => {
                const ls = getLotSize(t.segment);
                const lotsDisplay = ls
                  ? Math.round(Number(t.qty) / ls)
                  : Number(t.qty);
                const isConfirming = confirmDeleteId === t.id;
                const isProfit = Number(t.pnl) >= 0;
                return (
                  <div
                    key={i}
                    className={`rounded-xl p-3 border text-xs space-y-1.5 transition-colors ${
                      isConfirming
                        ? "border-red-200 bg-red-50"
                        : "border-gray-100 bg-gray-50 hover:border-gray-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-semibold text-gray-800">
                          {t.date}
                        </span>
                        <span className="mx-1.5 text-gray-300">·</span>
                        <span className="text-blue-600 font-medium">
                          {t.segment}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`font-bold text-sm ${isProfit ? "text-green-600" : "text-red-600"}`}
                        >
                          {isProfit ? "+" : ""}
                          {formatCurrency(Number(t.pnl))}
                        </span>
                        {isConfirming ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(t.id)}
                              className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500 text-white hover:bg-red-600 transition-colors"
                            >
                              Delete
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEdit(t)}
                              className="hover:text-blue-500 transition-colors p-0.5 rounded text-[#b00b9d]"
                              title="Edit this trade"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(t.id)}
                              className="text-gray-300 hover:text-red-500 transition-colors p-0.5 rounded"
                              title="Delete this trade"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-[#00040a]">
                      <span className="text-gray-600">
                        {lotsDisplay} lots{" "}
                        <span className="text-gray-400">({t.qty} units)</span>
                      </span>
                      <span>
                        B:{" "}
                        <span className="text-gray-700">₹{t.buyPremium}</span>
                      </span>
                      <span>
                        S:{" "}
                        <span className="text-gray-700">₹{t.sellPremium}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border ${
                          isProfit
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-red-50 text-red-700 border-red-200"
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
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium border ${
                          String(t.ruleFollowed).toLowerCase() === "yes"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-gray-50 text-gray-500 border-gray-200"
                        }`}
                      >
                        {String(t.ruleFollowed).toLowerCase() === "yes" ? (
                          <CheckCircle2 className="w-2.5 h-2.5" />
                        ) : (
                          <XCircle className="w-2.5 h-2.5" />
                        )}
                        Rules{" "}
                        {String(t.ruleFollowed).toLowerCase() === "yes"
                          ? "Followed"
                          : "Broken"}
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

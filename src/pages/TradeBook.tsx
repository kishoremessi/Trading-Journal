import { useState } from "react";

export default function TradeBook() {
  const [form, setForm] = useState({
    date: "",
    segment: "BANKNIFTY",
    qty: "",
    buy: "",
    sell: "",
    tax: "",
    rule: "YES"
  });

  const handleChange = (e: any) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    const buy = Number(form.buy);
    const sell = Number(form.sell);
    const qty = Number(form.qty);

    const points = sell - buy;
    const pnl = points * qty;

    const payload = {
      Date: form.date,
      Segment: form.segment,
      Quantity: qty,
      BuyPremium: buy,
      SellPremium: sell,
      PointsDifference: points,
      PnL: pnl,
      Result: pnl >= 0 ? "Target Hit" : "Stop Loss Hit",
      Tax: Number(form.tax || 0),
      RuleFollowed: form.rule
    };

    try {
      await fetch("https://script.google.com/macros/s/AKfycbz-d1MJr_4Aqq-_vbur2OTZlgJrncJfPLyKDRGNgvZd2bQd7CFHabVxZqQI7mvX97U_/exec", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      alert("Trade saved to Google Sheet ✅");

      // reset form
      setForm({
        date: "",
        segment: "BANKNIFTY",
        qty: "",
        buy: "",
        sell: "",
        tax: "",
        rule: "YES"
      });

    } catch (err) {
      console.error(err);
      alert("Failed to save trade ❌");
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>Trade Book</h2>

      <input
        name="date"
        type="date"
        value={form.date}
        onChange={handleChange}
        placeholder="Date"
      />
      <br /><br />

      <select name="segment" value={form.segment} onChange={handleChange}>
        <option value="NIFTY">NIFTY</option>
        <option value="BANKNIFTY">BANKNIFTY</option>
        <option value="FINNIFTY">FINNIFTY</option>
        <option value="STOCKS">STOCKS</option>
      </select>
      <br /><br />

      <input
        name="qty"
        value={form.qty}
        onChange={handleChange}
        placeholder="Quantity"
        type="number"
      />
      <br /><br />

      <input
        name="buy"
        value={form.buy}
        onChange={handleChange}
        placeholder="Buy Premium"
        type="number"
      />
      <br /><br />

      <input
        name="sell"
        value={form.sell}
        onChange={handleChange}
        placeholder="Sell Premium"
        type="number"
      />
      <br /><br />

      <input
        name="tax"
        value={form.tax}
        onChange={handleChange}
        placeholder="Tax (manual)"
        type="number"
      />
      <br /><br />

      <select name="rule" value={form.rule} onChange={handleChange}>
        <option value="YES">YES</option>
        <option value="NO">NO</option>
      </select>

      <br /><br />

      <button onClick={handleSubmit}>
        Add Trade
      </button>
    </div>
  );
}
import express from 'express';
import cors from 'cors';
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const XLSX_PATH = path.join(__dirname, 'trades.xlsx');

const app = express();
app.use(cors());
app.use(express.json());

function ensureFile() {
  if (!fs.existsSync(XLSX_PATH)) {
    const wb = XLSX.utils.book_new();
    const headers = [
      ['', '', 'Date', 'Segment', 'Qty', 'Buy', 'Sell', 'Points', 'Profit', 'Loss', 'Tax', 'Rules Followed', 'Reason', 'Actual Profit', 'Missed Profits']
    ];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    XLSX.utils.book_append_sheet(wb, ws, 'Trades');
    XLSX.writeFile(wb, XLSX_PATH);
  }
}

app.get('/api/trades', (req, res) => {
  try {
    ensureFile();
    const wb = XLSX.readFile(XLSX_PATH);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const dataRows = rows.slice(1).filter(r => r[2]);
    const trades = dataRows.map(r => ({
      date: r[2] || '',
      segment: r[3] || '',
      qty: r[4] || 0,
      buyPremium: r[5] || 0,
      sellPremium: r[6] || 0,
      points: r[7] || 0,
      profit: r[8] || 0,
      loss: r[9] || 0,
      tax: r[10] || 0,
      ruleFollowed: r[11] || '',
      reason: r[12] || '',
      pnl: r[13] || 0,
      result: Number(r[13]) >= 0 ? 'Target Hit' : 'Stop Loss Hit',
    }));
    res.json({ success: true, trades });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/add-trade', (req, res) => {
  try {
    ensureFile();
    const trade = req.body;

    const wb = XLSX.readFile(XLSX_PATH);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    const newRow = new Array(15).fill('');
    newRow[2]  = trade.Date;
    newRow[3]  = trade.Segment;
    newRow[4]  = trade.Quantity;
    newRow[5]  = trade.BuyPremium;
    newRow[6]  = trade.SellPremium;
    newRow[7]  = trade.PointsDifference;
    newRow[8]  = trade.Profit;
    newRow[9]  = trade.Loss;
    newRow[10] = trade.Tax;
    newRow[11] = trade.RuleFollowed;
    newRow[12] = '';
    newRow[13] = trade.PnL;
    newRow[14] = 0;

    rows.push(newRow);

    const newWs = XLSX.utils.aoa_to_sheet(rows);
    wb.Sheets[wb.SheetNames[0]] = newWs;
    XLSX.writeFile(wb, XLSX_PATH);

    res.json({ success: true, message: 'Trade added successfully' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

const PORT = 3001;
app.listen(PORT, 'localhost', () => {
  console.log(`Trade API server running on http://localhost:${PORT}`);
});

import express from "express";
import cors from "cors";
import XLSX from "xlsx";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import https from "https";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const XLSX_PATH = path.join(__dirname, "trades.xlsx");

const app = express();
app.use(cors());
app.use(express.json());

function ensureFile() {
  if (!fs.existsSync(XLSX_PATH)) {
    const wb = XLSX.utils.book_new();
    const headers = [
      [
        "",
        "",
        "Date",
        "Segment",
        "Qty",
        "Buy",
        "Sell",
        "Points",
        "Profit",
        "Loss",
        "Tax",
        "Rules Followed",
        "Reason",
        "Actual Profit",
        "Missed Profits",
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    XLSX.utils.book_append_sheet(wb, ws, "Trades");
    XLSX.writeFile(wb, XLSX_PATH);
  }
}

// Convert any date format to DD-MM-YYYY for consistent storage & display
function normalizeDate(str) {
  const s = String(str || "").trim();
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) return s;
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[3].padStart(2, "0")}-${m[2].padStart(2, "0")}-${m[1]}`;
  return s;
}

app.get("/api/trades", (req, res) => {
  try {
    ensureFile();
    const wb = XLSX.readFile(XLSX_PATH);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    const dataRows = rows.slice(1).filter((r) => r[2]);
    const trades = dataRows.map((r, i) => ({
      id: i,
      date: r[2] || "",
      segment: r[3] || "",
      qty: r[4] || 0,
      buyPremium: r[5] || 0,
      sellPremium: r[6] || 0,
      points: r[7] || 0,
      profit: r[8] || 0,
      loss: r[9] || 0,
      tax: r[10] || 0,
      ruleFollowed: r[11] || "",
      reason: r[12] || "",
      pnl: r[13] || 0,
      result: Number(r[13]) >= 0 ? "Target Hit" : "Stop Loss Hit",
    }));
    res.json({ success: true, trades });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post("/api/add-trade", (req, res) => {
  try {
    ensureFile();
    const trade = req.body;

    const wb = XLSX.readFile(XLSX_PATH);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

    const newRow = new Array(15).fill("");
    newRow[2] = normalizeDate(trade.Date);
    newRow[3] = trade.Segment;
    newRow[4] = trade.Quantity;
    newRow[5] = trade.BuyPremium;
    newRow[6] = trade.SellPremium;
    newRow[7] = trade.PointsDifference;
    newRow[8] = trade.Profit;
    newRow[9] = trade.Loss;
    newRow[10] = trade.Tax;
    newRow[11] = trade.RuleFollowed;
    newRow[12] = "";
    newRow[13] = trade.PnL;
    newRow[14] = 0;

    rows.push(newRow);

    const newWs = XLSX.utils.aoa_to_sheet(rows);
    wb.Sheets[wb.SheetNames[0]] = newWs;
    XLSX.writeFile(wb, XLSX_PATH);

    res.json({ success: true, message: "Trade added successfully" });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete("/api/trades/:index", (req, res) => {
  try {
    ensureFile();
    const targetIdx = parseInt(req.params.index);

    const wb = XLSX.readFile(XLSX_PATH);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

    const header = rows[0];
    const dataRows = rows.slice(1);

    // Find positions of valid (non-empty) trade rows
    const validPositions = [];
    for (let i = 0; i < dataRows.length; i++) {
      if (dataRows[i][2]) validPositions.push(i);
    }

    if (targetIdx < 0 || targetIdx >= validPositions.length) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid trade index" });
    }

    // Remove that row
    dataRows.splice(validPositions[targetIdx], 1);

    const newRows = [header, ...dataRows];
    const newWs = XLSX.utils.aoa_to_sheet(newRows);
    wb.Sheets[wb.SheetNames[0]] = newWs;
    XLSX.writeFile(wb, XLSX_PATH);

    res.json({ success: true, message: "Trade deleted successfully" });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.put("/api/trades/:index", (req, res) => {
  try {
    ensureFile();
    const targetIdx = parseInt(req.params.index);
    const trade = req.body;

    const wb = XLSX.readFile(XLSX_PATH);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

    const header = rows[0];
    const dataRows = rows.slice(1);

    const validPositions = [];
    for (let i = 0; i < dataRows.length; i++) {
      if (dataRows[i][2]) validPositions.push(i);
    }

    if (targetIdx < 0 || targetIdx >= validPositions.length) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid trade index" });
    }

    const updatedRow = new Array(15).fill("");
    updatedRow[2] = normalizeDate(trade.Date);
    updatedRow[3] = trade.Segment;
    updatedRow[4] = trade.Quantity;
    updatedRow[5] = trade.BuyPremium;
    updatedRow[6] = trade.SellPremium;
    updatedRow[7] = trade.PointsDifference;
    updatedRow[8] = trade.Profit;
    updatedRow[9] = trade.Loss;
    updatedRow[10] = trade.Tax;
    updatedRow[11] = trade.RuleFollowed;
    updatedRow[12] = "";
    updatedRow[13] = trade.PnL;
    updatedRow[14] = 0;

    dataRows[validPositions[targetIdx]] = updatedRow;

    const newRows = [header, ...dataRows];
    const newWs = XLSX.utils.aoa_to_sheet(newRows);
    wb.Sheets[wb.SheetNames[0]] = newWs;
    XLSX.writeFile(wb, XLSX_PATH);

    res.json({ success: true, message: "Trade updated successfully" });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Proxy POST to Google Apps Script (avoids browser CORS)
app.post("/api/save-to-sheets", (req, res) => {
  const GSHEET_URL =
    "https://script.google.com/macros/s/AKfycbwq9Kon3bv2J6jCPnGpgBkdCixStwi5wAHdGyEctkaFzO7e7jXrfPhGyYiejxzUUjmc/exec";
  const body = JSON.stringify(req.body);

  const urlObj = new URL(GSHEET_URL);
  const options = {
    hostname: urlObj.hostname,
    path: urlObj.pathname + urlObj.search,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
    // follow redirects: Google Apps Script returns a 302 on POST
  };

  function doRequest(opts, redirectCount = 0) {
    const reqOut = https.request(opts, (resp) => {
      // Google Apps Script often redirects POST → GET after execution
      if (
        (resp.statusCode === 301 || resp.statusCode === 302) &&
        resp.headers.location &&
        redirectCount < 5
      ) {
        const loc = new URL(resp.headers.location);
        doRequest(
          {
            hostname: loc.hostname,
            path: loc.pathname + loc.search,
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(body),
            },
          },
          redirectCount + 1,
        );
        resp.resume();
        return;
      }
      let data = "";
      resp.on("data", (chunk) => {
        data += chunk;
      });
      resp.on("end", () => {
        res.json({ success: true, status: resp.statusCode, response: data });
      });
    });
    reqOut.on("error", (err) => {
      res.status(500).json({ success: false, error: err.message });
    });
    reqOut.write(body);
    reqOut.end();
  }

  doRequest(options);
});

const PORT = 3001;
app.listen(PORT, "localhost", () => {
  console.log(`Trade API server running on http://localhost:${PORT}`);
});

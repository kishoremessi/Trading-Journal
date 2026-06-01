import * as XLSX from "xlsx";
import fs from "fs";

const FILE = "trades.xlsx";

export function addTrade(trade) {
  const file = fs.readFileSync(FILE);
  const wb = XLSX.read(file, { type: "buffer" });

  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];

  const data = XLSX.utils.sheet_to_json(sheet);

  const pnl =
    (Number(trade.Exit) - Number(trade.Entry)) * Number(trade.Lots);

  const isProfit = pnl >= 0;

  const newRow = {
    Date: trade.Date,
    Side: trade.Side,
    Lots: trade.Lots,
    Entry: trade.Entry,
    Exit: trade.Exit,
    PnL: pnl,
    Profit: isProfit ? pnl : 0,
    Loss: isProfit ? 0 : Math.abs(pnl),
    Tax: trade.Tax || 0
  };

  data.push(newRow);

  const newSheet = XLSX.utils.json_to_sheet(data);
  wb.Sheets[sheetName] = newSheet;

  const updated = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  fs.writeFileSync(FILE, updated);
}
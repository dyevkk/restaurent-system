// scripts/build-print-pdf.js
// FULL AUTOMATION: QR PNGs + HTML + PDF

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import puppeteer from "puppeteer";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE_ORDER_URL =
  process.env.PRINT_BASE_URL || "http://localhost:3000/order?table=";

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error("❌ Missing Supabase keys in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

async function fetchTables() {
  const { data, error } = await supabase
    .from("restaurant_tables")
    .select("id, table_number")
    .order("table_number", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function generateQRImages(tables) {
  const outDir = path.join(process.cwd(), "public", "qrcodes");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log("📦 Generating QR images...");

  for (const t of tables) {
    const filePath = path.join(outDir, `table-${t.table_number}.png`);
    const url = `${BASE_ORDER_URL}${t.id}`;

    await QRCode.toFile(filePath, url, {
      width: 500,
      color: { dark: "#000", light: "#ffffff" },
    });

    console.log(`✔ QR for Table ${t.table_number} → ${filePath}`);
  }
}

function generateHTML(tables) {
  const cards = tables
    .map((t) => {
      const qr = `/qrcodes/table-${t.table_number}.png`;
      const orderUrl = `${BASE_ORDER_URL}${t.id}`;

      return `
      <div class="card">
        <div class="title">Scan to Order</div>
        <img src="${qr}" class="qr" />
        <div class="table">Table ${t.table_number}</div>
        <div class="url">${orderUrl}</div>
      </div>
    `;
    })
    .join("\n");

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body { font-family: Arial, sans-serif; background:#f3f3f3; padding:20px; }
      .grid { display:flex; flex-wrap:wrap; gap:20px; }
      .card {
        width: 300px;
        padding: 20px;
        background:white;
        border-radius: 12px;
        box-shadow:0 6px 12px rgba(0,0,0,0.1);
        text-align:center;
      }
      .qr {
        width: 220px; margin-bottom:15px;
      }
      .title {
        font-size:20px;
        font-weight:bold;
        margin-bottom:10px;
      }
      .table {
        font-size:18px;
        font-weight:bold;
        margin-top:10px;
      }
      .url {
        font-size:12px;
        color:#666;
        margin-top:8px;
        word-break: break-all;
      }
      @media print {
        body { background: white; padding:0; }
        .card { box-shadow:none; }
      }
    </style>
  </head>
  <body>
    <h1>Printable Table QR Cards</h1>
    <div class="grid">
      ${cards}
    </div>
  </body>
  </html>
`;
}

async function saveHTML(html) {
  const outPath = path.join(process.cwd(), "public", "print_cards.html");
  fs.writeFileSync(outPath, html, "utf8");

  console.log("📄 HTML saved →", outPath);
  return outPath;
}

async function generatePDF(htmlPath) {
  console.log("🖨 Generating PDF...");

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto("file://" + htmlPath, { waitUntil: "networkidle0" });

  const pdfPath = path.join(process.cwd(), "public", "print_cards.pdf");

  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: "10mm", bottom: "10mm" },
  });

  await browser.close();

  console.log("✔ PDF created →", pdfPath);
}

(async () => {
  try {
    console.log("🔍 Fetching tables from Supabase...");
    const tables = await fetchTables();

    if (tables.length === 0) {
      console.log("⚠ No tables found in Supabase!");
      process.exit(0);
    }

    await generateQRImages(tables);

    const html = generateHTML(tables);
    const htmlPath = await saveHTML(html);

    await generatePDF(htmlPath);

    console.log("\n🎉 DONE! Your printable QR pack is ready in /public/");
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
})();

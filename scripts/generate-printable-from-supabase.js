// scripts/generate-printable-from-supabase.js
// Usage: node scripts/generate-printable-from-supabase.js
// Requires .env.local containing NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
// Optional env: PRINT_BASE_URL (defaults to http://localhost:3000/order?table=)

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') });

// Validate env
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE_ORDER_URL = process.env.PRINT_BASE_URL || 'http://localhost:3000/order?table=';

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

async function fetchTables() {
  const { data, error } = await supabase.from('restaurant_tables').select('id, table_number').order('table_number', { ascending: true });
  if (error) throw error;
  return data || [];
}

function buildHtml(cardsHtml) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Printable Table QR Cards</title>
<style>
:root{--card-width:320px;--card-height:420px;--gap:24px;--page-padding:24px}
html,body{height:100%;margin:0;background:#f3f4f6;font-family:Inter,system-ui,Arial,sans-serif;color:#111827}
.page{padding:var(--page-padding)}
.grid{display:flex;flex-wrap:wrap;gap:var(--gap)}
.card{width:var(--card-width);height:var(--card-height);background:#fff;border-radius:12px;padding:18px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:space-between;box-shadow:0 6px 18px rgba(15,23,42,0.06)}
.qr{width:220px;height:220px;border-radius:8px;background:#fff;padding:8px;display:flex;align-items:center;justify-content:center}
.restaurant{font-weight:700;font-size:20px;color:#0b5fff}
.table-number{font-size:18px;font-weight:700;margin-top:10px}
.instructions{font-size:12px;color:#475569;text-align:center;margin-top:10px}
@media print{body{background:white}.page{padding:12mm}.card{box-shadow:none;border:none}}
</style>
</head>
<body>
  <div class="page">
    <div style="display:flex; gap:16px; align-items:center; margin-bottom:12px;">
      <div style="font-weight:800; font-size:18px">Your Restaurant Name</div>
      <div style="font-size:12px;color:#6b7280">Scan to order from your table</div>
    </div>

    <div class="grid">
${cardsHtml}
    </div>

    <div style="margin-top:18px; font-size:12px; color:#6b7280">
      Tip: Print to A4, scale 100%, enable background graphics.
    </div>
  </div>
</body>
</html>`;
}

function makeCardHtml(table) {
  const tableNum = table.table_number ?? '—';
  const uuid = table.id;
  // We expect you to have generated QR images in public/qrcodes/table-{number}.png,
  // but if they are not present we'll still embed the plain order URL for scanning apps that accept text
  const qrImgPath = `/qrcodes/table-${tableNum}.png`;
  const orderUrl = `${BASE_ORDER_URL}${uuid}`;

  return `      <div class="card">
        <div style="text-align:center; width:100%;">
          <div class="restaurant">Your Restaurant</div>
          <div class="subtitle" style="font-size:13px;color:#6b7280;margin-top:6px">Scan to order from this table</div>
        </div>

        <div class="qr">
          <img src="${qrImgPath}" alt="QR Table ${tableNum}" style="max-width:100%; max-height:100%; object-fit:contain" onerror="this.style.opacity=0.0">
        </div>

        <div style="text-align:center; width:100%;">
          <div class="table-number">Table ${tableNum}</div>
          <div class="instructions">Scan or visit:<br><strong style="word-break:break-all;">${orderUrl}</strong></div>
        </div>
      </div>`;
}

(async function main() {
  try {
    console.log('Fetching tables from Supabase...');
    const tables = await fetchTables();
    if (!tables || tables.length === 0) {
      console.warn('No tables found in restaurant_tables. Aborting.');
      process.exit(0);
    }
    const cards = tables.map(makeCardHtml).join('\n\n');
    const html = buildHtml(cards);

    const outDir = path.join(process.cwd(), 'public');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const outPath = path.join(outDir, 'print_cards.html');
    fs.writeFileSync(outPath, html, 'utf8');
    console.log('Wrote', outPath);
    console.log('Open http://localhost:3000/print_cards.html to preview and print.');
  } catch (err) {
    console.error('Error generating printable file:', err.message || err);
    process.exit(1);
  }
})();

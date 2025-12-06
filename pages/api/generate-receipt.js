// pages/api/generate-receipt.js
import path from 'path';
import puppeteer from 'puppeteer';
import { supabaseServer } from '../../lib/supabaseServer';
import { requireStaff } from '../../lib/requireStaff';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

/**
 * POST { orderId: string }
 * - verifies staff
 * - fetches order + items
 * - renders PDF via Puppeteer
 * - uploads to private 'receipts' bucket as receipts/receipt-<orderId>.pdf
 * - saves receipt_path on orders table
 * - returns { ok:true, path }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  // auth
  const auth = await requireStaff(req, res);
  if (!auth.allowed) return res.status(403).json({ error: auth.error || 'forbidden' });

  const { orderId } = req.body || {};
  if (!orderId) return res.status(400).json({ error: 'orderId_required' });

  try {
    // fetch order and order_items (server)
    const { data: order, error: orderErr } = await supabaseServer
      .from('orders')
      .select('id, table_id, status, total, created_at, note, order_items ( id, menu_id, name, qty, unit_price ), restaurant_tables ( table_number )')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      console.error('generate-receipt: failed to fetch order', orderErr);
      return res.status(500).json({ error: 'fetch_order_failed', detail: orderErr?.message || orderErr });
    }

    // build invoice HTML
    const html = buildInvoiceHtml(order);

    // render PDF with puppeteer
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' }
    });

    await browser.close();

    // upload to private bucket 'receipts'
    const fileName = `receipt-${orderId}.pdf`;
    const filePath = `receipts/${fileName}`;

    const { error: uploadErr } = await supabaseServer.storage
      .from('receipts')
      .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

    if (uploadErr) {
      console.error('generate-receipt upload error', uploadErr);
      // fallback: return PDF inline
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=receipt-${orderId}.pdf`);
      return res.status(200).send(pdfBuffer);
    }

    // save path to orders
    const { error: updateErr } = await supabaseServer
      .from('orders')
      .update({ receipt_path: filePath })
      .eq('id', orderId);

    if (updateErr) {
      console.error('generate-receipt: failed to save receipt_path', updateErr);
    }

    return res.status(200).json({ ok: true, path: filePath });
  } catch (err) {
    console.error('generate-receipt exception', err);
    return res.status(500).json({ error: 'exception', detail: String(err) });
  }
}

/* ---------- invoice HTML builder (same as before) ---------- */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildInvoiceHtml(order) {
  const items = (order.order_items || []).map(it => ({
    name: it.name,
    qty: it.qty,
    unit: Number(it.unit_price || 0),
    subtotal: Number(it.unit_price || 0) * Number(it.qty || 0)
  }));

  const total = Number(order.total || items.reduce((s, i) => s + i.subtotal, 0)).toFixed(2);
  const placed = new Date(order.created_at).toLocaleString();
  const tableNum = order.restaurant_tables?.table_number ?? order.table_id;

  return `
  <!doctype html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <title>Receipt ${order.id}</title>
    <style>
      body{font-family:Inter,Arial,sans-serif;margin:0;padding:24px;color:#0f172a;background:#fff}
      .wrap{max-width:800px;margin:0 auto}
      header{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}
      .brand{font-family:'Playfair Display',serif;color:#b8892e;font-size:22px;font-weight:700}
      .meta{text-align:right;font-size:12px;color:#6b7280}
      .card{background:#fff;border-radius:10px;padding:12px;box-shadow:0 8px 24px rgba(15,23,42,0.04)}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{padding:10px 8px;text-align:left;font-size:14px}
      th{color:#6b7280;font-weight:600}
      tr+tr td{border-top:1px dashed rgba(0,0,0,0.06)}
      .qty{width:72px;text-align:right}
      .price,.subtotal{text-align:right;width:120px}
      .total-row td{font-weight:700;font-size:16px}
      .note{margin-top:12px;color:#6b7280;font-size:12px}
      footer{margin-top:20px;font-size:12px;color:#6b7280;text-align:center}
      .small{font-size:12px;color:#6b7280}
    </style>
  </head>
  <body>
    <div class="wrap">
      <header>
        <div>
          <div class="brand">Your Restaurant</div>
          <div class="small">Address • Phone</div>
        </div>
        <div class="meta">
          <div>Receipt</div>
          <div>Order: ${order.id.slice(0,8)}</div>
          <div>Table: ${tableNum}</div>
          <div>Placed: ${placed}</div>
        </div>
      </header>
      <div class="card">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th class="qty">Qty</th>
              <th class="price">Unit</th>
              <th class="subtotal">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(it => `
              <tr>
                <td>${escapeHtml(it.name)}</td>
                <td class="qty">${it.qty}</td>
                <td class="price">₹${Number(it.unit).toFixed(2)}</td>
                <td class="subtotal">₹${Number(it.subtotal).toFixed(2)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td></td><td></td>
              <td class="price">Total</td>
              <td class="subtotal">₹${total}</td>
            </tr>
          </tbody>
        </table>
        ${order.note ? `<div class="note">Note: ${escapeHtml(order.note)}</div>` : ''}
      </div>
      <footer>Thank you for dining with us — visit again!</footer>
    </div>
  </body>
  </html>
  `;
}

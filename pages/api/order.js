// pages/api/order.js
import { supabaseServer } from '../../lib/supabaseServerClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { table_id, items = [], note = '' } = req.body;
  if (!table_id || items.length === 0) return res.status(400).json({ error: 'invalid_payload' });

  try {
    const { data: order, error: orderErr } = await supabaseServer
      .from('orders')
      .insert({ table_id, status: 'pending', total: 0, note })
      .select()
      .single();
    if (orderErr) throw orderErr;

    let total = 0;
    const orderItems = items.map(i => {
      const line_total = Number(i.unit_price) * Number(i.qty);
      total += line_total;
      return {
        order_id: order.id,
        menu_id: i.menu_id,
        name: i.name,
        unit_price: i.unit_price,
        qty: i.qty,
        line_total
      };
    });

    const { error: oiErr } = await supabaseServer.from('order_items').insert(orderItems);
    if (oiErr) throw oiErr;

    const { error: updErr } = await supabaseServer.from('orders').update({ total }).eq('id', order.id);
    if (updErr) throw updErr;

    return res.status(201).json({ order_id: order.id });
  } catch (err) {
    console.error('api/order error', err);
    return res.status(500).json({ error: err.message || 'server_error' });
  }
}

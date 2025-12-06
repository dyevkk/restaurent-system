// pages/api/order-status.js
import { requireStaff } from '../../lib/requireStaff';
import { supabaseServer } from '../../lib/supabaseServer';

export default async function handler(req, res) {
  // Only POST allowed
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  // Auth check
  const auth = await requireStaff(req, res);
  if (!auth.allowed) return res.status(403).json({ error: auth.error || 'forbidden' });

  const { orderId, status } = req.body || {};
  if (!orderId || !status) return res.status(400).json({ error: 'orderId_and_status_required' });

  try {
    const updates = { status };

    // if status is closed, you may want to set 'closed_at' or other fields. Add if needed:
    if (status === 'closed') updates.closed_at = new Date().toISOString();

    const { data, error } = await supabaseServer
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      console.error('order-status update error', error);
      return res.status(500).json({ error: 'update_failed', detail: error.message || error });
    }

    return res.status(200).json({ ok: true, order: data });
  } catch (err) {
    console.error('order-status exception', err);
    return res.status(500).json({ error: 'exception', detail: String(err) });
  }
}

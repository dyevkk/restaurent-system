// pages/api/receipt-signed-url.js
import { requireStaff } from '../../lib/requireStaff';
import { supabaseServer } from '../../lib/supabaseServer';
import pathLib from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: pathLib.join(process.cwd(), '.env.local') });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const auth = await requireStaff(req, res);
  if (!auth.allowed) return res.status(403).json({ error: auth.error || 'forbidden' });

  const { path, expiresIn } = req.body || {};
  if (!path) return res.status(400).json({ error: 'path_required' });

  try {
    const ttl = Number(expiresIn) || 60 * 60; // default 1 hour
    const { data, error } = await supabaseServer.storage.from('receipts').createSignedUrl(path, ttl);
    if (error) {
      console.error('createSignedUrl error', error);
      return res.status(500).json({ error: 'signed_url_failed', detail: error.message || error });
    }
    return res.status(200).json({ ok: true, signedUrl: data.signedUrl });
  } catch (err) {
    console.error('receipt-signed-url exception', err);
    return res.status(500).json({ error: 'exception', detail: String(err) });
  }
}

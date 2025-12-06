// components/AdminContent.js
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import Header from './Header'; // if you don't have Header, you can inline a simple header below

export default function AdminContent() {
  const [orders, setOrders] = useState([]);
  const mountedRef = useRef(false);
  const channelRef = useRef(null);
  const [busyOrder, setBusyOrder] = useState(null);

  useEffect(() => {
    mountedRef.current = true;
    fetchOrders();

    // subscribe once
    channelRef.current = supabase
      .channel('orders-channel-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        // simple refetch when orders table changes
        debounceFetch();
      })
      .subscribe();

    return () => {
      mountedRef.current = false;
      try { channelRef.current?.unsubscribe(); } catch (_) {}
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, table_id, status, total, created_at, note, receipt_path, restaurant_tables ( table_number )')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('fetchOrders error', error);
        return;
      }
      if (!mountedRef.current) return;
      setOrders(data || []);
    } catch (err) {
      console.error('fetchOrders unexpected', err);
    }
  }, []);

  // debounce for subscription bursts
  const debounceRef = useRef(null);
  function debounceFetch() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchOrders();
      debounceRef.current = null;
    }, 300);
  }

  // --------- updateStatus (patched to include Authorization token) ----------
  async function updateStatus(orderId, status) {
    try {
      // show optimistic UI
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));

      // get current session token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        // not signed in — revert UI and redirect to login
        await fetchOrders();
        alert('You are not signed in. Please login again.');
        window.location.href = '/auth/login';
        return;
      }

      const res = await fetch('/api/order-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ orderId, status })
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        console.error('order-status API error', res.status, body);
        // revert UI by refetching authoritative data
        await fetchOrders();
        alert('Failed to update status: ' + (body?.error || res.status));
        return;
      }

      // success — refresh to ensure consistent state
      if (status === 'closed') {
        setOrders(prev => prev.filter(o => o.id !== orderId));
      } else {
        await fetchOrders();
      }
    } catch (err) {
      console.error('updateStatus unexpected', err);
      await fetchOrders();
      alert('Unexpected error updating status: ' + (err.message || err));
    }
  }

  // --------- closeOrderAndOpenReceipt (generate receipt, close order, open signed URL) ----------
  async function closeOrderAndOpenReceipt(orderId) {
    if (!orderId) return;
    if (!confirm('Close this order and generate receipt?')) return;

    setBusyOrder(orderId);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        alert('Not signed in. Please sign in again.');
        window.location.href = '/auth/login';
        return;
      }

      // 1) generate receipt (server saves receipt_path)
      const genRes = await fetch('/api/generate-receipt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ orderId })
      });
      const genJson = await genRes.json().catch(() => null);
      if (!genRes.ok) {
        console.warn('generate-receipt failed', genJson);
        // we continue to attempt to close the order even if receipt generation failed
      }

      // 2) close order
      const closeRes = await fetch('/api/order-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ orderId, status: 'closed' })
      });
      const closeJson = await closeRes.json().catch(() => null);
      if (!closeRes.ok) {
        console.error('Failed to close order', closeJson);
        alert('Failed to close order: ' + (closeJson?.error || closeRes.status));
        setBusyOrder(null);
        await fetchOrders();
        return;
      }

      // 3) open signed URL if path returned
      const path = genJson?.path;
      if (path) {
        const signedRes = await fetch('/api/receipt-signed-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ path, expiresIn: 60 * 60 * 24 }) // 24 hours
        });
        const signedJson = await signedRes.json().catch(() => null);
        if (signedRes.ok && signedJson?.signedUrl) {
          window.open(signedJson.signedUrl, '_blank');
        } else {
          console.warn('Could not create signed URL', signedJson);
        }
      } else {
        console.warn('No receipt path returned from generate-receipt', genJson);
      }

      await fetchOrders();
    } catch (err) {
      console.error('closeOrderAndOpenReceipt error', err);
      alert('Close & receipt generation failed: ' + (err.message || err));
      await fetchOrders();
    } finally {
      setBusyOrder(null);
    }
  }

  return (
    <div>
      {/* Basic header component fallback if Header is not available */}
      {typeof Header === 'function' ? <Header title="Kitchen Dashboard" subtitle="Manage live orders" /> : (
        <div style={{ padding: 18, borderBottom: '1px solid #eee' }}>
          <h2 style={{ margin: 0 }}>Kitchen Dashboard</h2>
          <div style={{ color: '#6b7280' }}>Manage live orders</div>
        </div>
      )}

      <main style={{ paddingTop: 28, paddingBottom: 60, maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: 22, color: '#b8892e' }}>Live Orders</h2>
          <div style={{ color: '#6b7280' }}>Realtime • Debounced</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
          {orders.length === 0 && <div style={{ padding: 16, color: '#6b7280' }}>No orders yet.</div>}
          {orders.map(o => (
            <div key={o.id} style={{ padding: 16, borderRadius: 10, boxShadow: '0 6px 18px rgba(10,10,10,0.04)', background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 14, color: '#6b7280' }}>Order</div>
                  <div style={{ fontWeight: 700, marginTop: 6 }}>{o.id?.slice(0, 10)}</div>
                  <div style={{ color: '#6b7280', marginTop: 8 }}>Table: <span style={{ fontWeight: 700 }}>{o.restaurant_tables?.table_number ?? o.table_id}</span></div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, color: '#b8892e' }}>₹{Number(o.total || 0).toFixed(2)}</div>
                  <div style={{ color: '#6b7280', fontSize: 12, marginTop: 8 }}>{new Date(o.created_at).toLocaleString()}</div>
                </div>
              </div>

              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => updateStatus(o.id, 'preparing')} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d6c39a', background: 'transparent' }}>Preparing</button>
                <button onClick={() => updateStatus(o.id, 'ready')} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d6c39a', background: 'transparent' }}>Ready</button>
                <button onClick={() => updateStatus(o.id, 'served')} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: 'linear-gradient(90deg,#b8892e,#f5d490)', color: '#071017' }}>Served</button>

                <button
                  onClick={() => closeOrderAndOpenReceipt(o.id)}
                  disabled={busyOrder === o.id}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d6c39a', background: 'transparent' }}
                >
                  {busyOrder === o.id ? 'Processing…' : 'Close'}
                </button>
              </div>

              {o.note && <div style={{ marginTop: 12, color: '#6b7280' }}>Note: {o.note}</div>}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

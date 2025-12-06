// pages/order.js
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import Header from '../components/Header';

function Toast({ text }) {
  return (
    <div style={{position:'fixed', right:20, top:20, zIndex:60}}>
      <div style={{background:'#071017', color:'#fff', padding:'10px 14px', borderRadius:10, boxShadow:'0 8px 24px rgba(2,6,23,0.6)'}}>{text}</div>
    </div>
  );
}

export default function OrderPage() {
  const [menu,setMenu] = useState([]);
  const [cart,setCart] = useState([]);
  const [tableId,setTableId] = useState(null);
  const [latestOrder,setLatestOrder] = useState(null);
  const [orderItems,setOrderItems] = useState([]);
  const [toast,setToast] = useState(null);
  const [loading,setLoading] = useState(false);

  const channelRef = useRef(null);
  const lastStatusRef = useRef(null);
  const pollingRef = useRef({timer:null, attempts:0});

  useEffect(()=> {
    const q = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    setTableId(q.get('table'));
    fetchMenu();
  }, []);

  useEffect(()=> {
    if (!tableId) return;
    fetchLatestOrder();

    const ch = supabase.channel(`orders-table-${tableId}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'orders', filter:`table_id=eq.${tableId}` }, ()=> fetchLatestOrder())
      .subscribe(status => {
        if (status === 'SUBSCRIBED') stopPolling();
        else if (status === 'TIMED_OUT' || status === 'CLOSED') startPolling();
      });

    channelRef.current = ch;
    return ()=> {
      try { channelRef.current?.unsubscribe(); } catch {}
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  async function fetchMenu(){
    const { data, error } = await supabase.from('menus').select('*').eq('available', true).order('created_at');
    if (error) { console.error(error); return; }
    setMenu(data || []);
  }

  async function fetchLatestOrder(){
    if (!tableId) return;
    const { data: orders } = await supabase.from('orders').select('*').eq('table_id', tableId).neq('status','closed').order('created_at',{ascending:false}).limit(1);
    const order = orders && orders.length ? orders[0] : null;
    setLatestOrder(order);
    if (!order) { setOrderItems([]); lastStatusRef.current = null; return; }
    const { data: items } = await supabase.from('order_items').select('*').eq('order_id', order.id);
    setOrderItems(items || []);
    if (lastStatusRef.current && lastStatusRef.current !== order.status) {
      showToast(`Order ${order.id.slice(0,8)} → ${order.status.toUpperCase()}`);
      try { new Audio('/notify.mp3').play().catch(()=>{}); } catch {}
    }
    lastStatusRef.current = order.status;
  }

  function startPolling() {
    if (pollingRef.current.timer) return;
    const tick = async ()=> {
      pollingRef.current.attempts++;
      await fetchLatestOrder();
      const delay = Math.min(2000 * 2 ** (pollingRef.current.attempts - 1), 60000);
      pollingRef.current.timer = setTimeout(tick, delay);
    };
    tick();
  }
  function stopPolling() { if (pollingRef.current.timer) { clearTimeout(pollingRef.current.timer); pollingRef.current.timer = null; pollingRef.current.attempts = 0; } }

  function addToCart(item){ setCart(prev => { const f = prev.find(p=>p.menu_id===item.id); if (f) return prev.map(p=>p.menu_id===item.id ? {...p, qty:p.qty+1} : p); return [...prev, {menu_id:item.id, name:item.name, unit_price:item.price, qty:1}]; }); }
  function decQty(menu_id){ setCart(prev=> prev.flatMap(i => i.menu_id===menu_id ? (i.qty>1 ? [{...i, qty:i.qty-1}] : []) : [i])); }
  function removeFromCart(menu_id){ setCart(prev => prev.filter(i=>i.menu_id!==menu_id)); }

  async function placeOrder(){
    if (!tableId) return alert('Table not detected');
    if (cart.length===0) return alert('Cart empty');
    setLoading(true);
    try {
      const res = await fetch('/api/order', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ table_id: tableId, items: cart, note:'' })});
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'order failed');
      setCart([]);
      await fetchLatestOrder();
      showToast('Order placed — thank you!');
    } catch (err) {
      console.error(err); alert('Failed to place order: '+err.message);
    } finally { setLoading(false); }
  }

  function showToast(text, ms=3500){ setToast(text); setTimeout(()=>setToast(null), ms); }

  return (
    <div>
      <Header title="Order" subtitle={tableId ? `Table ${tableId.slice(0,8)}` : 'Scan your table QR'} />

      <div className="container" style={{paddingTop:28, paddingBottom:40}}>
        <div className="order-shell light-shell fade-in">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Menu list */}
            <section className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-semibold" style={{fontFamily:'Playfair Display, serif'}}>Menu</h2>
                  <div className="muted-dark" style={{fontSize:13}}>Tap to add to cart</div>
                </div>
                <div>
                  <button className="btn-gold">View Menu</button>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {menu.map(item => (
                  <div key={item.id} className="card p-4 bg-white" style={{borderRadius:12}}>
                    <div className="flex items-start gap-4">
                      <div style={{flex:'1 1 auto'}}>
                        <div className="text-lg font-semibold">{item.name}</div>
                        <div className="text-sm muted-dark">{item.description}</div>
                      </div>
                      <div style={{minWidth:90, textAlign:'right'}}>
                        <div className="font-semibold">₹{Number(item.price).toFixed(2)}</div>
                        <button onClick={()=>addToCart(item)} className="btn-gold" style={{marginTop:10}}>Add</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Cart */}
            <aside>
              <div className="card p-4">
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <div className="font-semibold">Your Cart</div>
                  <div className="muted-dark">{cart.length} items</div>
                </div>

                <div style={{marginTop:12}}>
                  {cart.length===0 && <div className="muted-dark">Your cart is empty</div>}
                  {cart.map(c=>(
                    <div key={c.menu_id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid rgba(15,23,42,0.04)'}}>
                      <div>
                        <div style={{fontWeight:600}}>{c.name}</div>
                        <div className="muted-dark" style={{fontSize:13}}>₹{(c.unit_price*c.qty).toFixed(2)}</div>
                      </div>
                      <div style={{display:'flex', alignItems:'center', gap:8}}>
                        <button onClick={()=>decQty(c.menu_id)} className="btn-outline-gold">-</button>
                        <div>{c.qty}</div>
                        <button onClick={()=>addToCart({id:c.menu_id, name:c.name, price:c.unit_price})} className="btn-outline-gold">+</button>
                      </div>
                    </div>
                  ))}
                </div>

                {cart.length>0 && (
                  <div style={{marginTop:14}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
                      <div className="font-semibold">Total</div>
                      <div style={{fontSize:18, fontWeight:700}}>₹{cart.reduce((s,i)=>s+i.unit_price*i.qty,0).toFixed(2)}</div>
                    </div>
                    <button onClick={placeOrder} className="btn-gold" style={{width:'100%'}} disabled={loading}>{loading ? 'Placing...' : 'Place Order'}</button>
                  </div>
                )}
              </div>

              <div style={{marginTop:12}} className="card p-3">
                <div className="font-semibold">Latest Order</div>
                {!latestOrder && <div className="muted-dark" style={{marginTop:8}}>No open orders</div>}
                {latestOrder && (
                  <div style={{marginTop:8}}>
                    <div style={{fontWeight:600}}>Order {latestOrder.id.slice(0,8)}</div>
                    <div className="muted-dark">Status: {latestOrder.status}</div>
                    <div className="muted-dark" style={{fontSize:12}}>Placed: {new Date(latestOrder.created_at).toLocaleString()}</div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>

      {toast && <Toast text={toast} />}
    </div>
  );
}

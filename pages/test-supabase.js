import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function TestSupabase() {
  const [menus, setMenus] = useState([]);
  const [err, setErr] = useState(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('menus').select('*');
      if (error) setErr(error.message);
      else setMenus(data);
    }
    load();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Supabase Test</h1>
      {err && <div style={{ color: 'red' }}>Error: {err}</div>}
      <pre>{JSON.stringify(menus, null, 2)}</pre>
    </div>
  );
}

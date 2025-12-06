// pages/auth/logout.js
import { useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function LogoutPage() {
  useEffect(() => {
    (async () => {
      try {
        await supabase.auth.signOut();
      } catch (e) { console.error(e); }
      // redirect to login
      window.location.href = '/auth/login';
    })();
  }, []);
  return <div style={{padding:20}}>Signing out…</div>;
}

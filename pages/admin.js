// pages/admin.js
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import AdminContent from '../components/AdminContent'; // we'll create this wrapper below or inline

export default function AdminPageWrapper() {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data?.session) {
        setSession(data.session);
        setChecking(false);
      } else {
        // redirect to login
        window.location.href = '/auth/login';
      }
    })();

    // listen to auth changes (optional)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s?.access_token) {
        setSession(s);
      } else {
        setSession(null);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  if (checking) return <div style={{padding:20}}>Checking authentication…</div>;

  // session present -> render the real admin UI (we will inline the admin UI below)
  return <AdminContent />;
}

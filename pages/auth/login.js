// pages/auth/login.js
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Head from 'next/head';
import Link from 'next/link';

export default function LoginPage() {
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [loading,setLoading] = useState(false);
  const [errorMsg,setErrorMsg] = useState('');

  useEffect(()=>{
    (async()=> {
      const { data } = await supabase.auth.getSession();
      if (data?.session) window.location.href = '/admin';
    })();
  },[]);

  async function handleSignIn(e){
    e.preventDefault();
    setLoading(true); setErrorMsg('');
    try {
      const res = await supabase.auth.signInWithPassword({ email, password });
      if (res.error) setErrorMsg(res.error.message || 'Failed to sign in');
      else if (res.data?.user) window.location.href = '/admin';
      else setErrorMsg('Unexpected response');
    } catch (err) { setErrorMsg(err.message || 'Sign in failed'); }
    setLoading(false);
  }

  async function handleMagicLink(e){
    e.preventDefault();
    if (!email) return setErrorMsg('Enter email for magic link');
    setLoading(true); setErrorMsg('');
    try {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + '/admin' }});
      if (error) setErrorMsg(error.message || 'Failed to send link');
      else setErrorMsg('Magic link sent — check your email');
    } catch (err) { setErrorMsg(err.message || 'Failed to send link'); }
    setLoading(false);
  }

  return (
    <>
      <Head><title>Admin Sign-In</title></Head>
      <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20}}>
        <div style={{width:420}}>
          <div style={{marginBottom:20}}>
            <h1 style={{fontSize:24, margin:0}}>Staff Sign-In</h1>
            <p style={{color:'#6b7280', marginTop:6}}>Log into the admin panel</p>
          </div>

          <form onSubmit={handleSignIn} style={{display:'grid', gap:10}}>
            <label style={{fontSize:13}}>Email</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@restaurant.com" style={{padding:'10px 12px', borderRadius:8, border:'1px solid #e6e6e6'}} />

            <label style={{fontSize:13}}>Password</label>
            <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="password" style={{padding:'10px 12px', borderRadius:8, border:'1px solid #e6e6e6'}} />

            <div style={{display:'flex', gap:8}}>
              <button disabled={loading} style={{padding:'10px 14px', borderRadius:8, fontWeight:700, background:'#111827', color:'#fff', border:'none', width:'100%'}}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </div>

            <button onClick={handleMagicLink} type="button" disabled={loading} style={{marginTop:8, padding:'10px 14px', borderRadius:8, background:'transparent', border:'1px solid #d1d5db', width:'100%'}}>
              Send Magic Link
            </button>

            {errorMsg && <div style={{color: errorMsg.startsWith('Magic link') ? '#065f46' : '#b91c1c', fontSize:13, marginTop:6}}>{errorMsg}</div>}

            <div style={{marginTop:12, fontSize:13}}>
              <Link href="/" style={{ color:'#2563eb' }}>⟵ Back to site</Link>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

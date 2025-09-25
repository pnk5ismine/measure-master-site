/*! mm-auth.js : 공용 인증 코어 (모든 페이지 공통) */
(function(){
  'use strict';

  // ---------- Supabase 클라이언트 ----------
  const SUPABASE_URL  = "https://snxjcbaaysgfunpsohzg.supabase.co";
  const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNueGpjYmFheXNnZnVucHNvaHpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1OTk3MzQsImV4cCI6MjA3MjE3NTczNH0.T8b9PpabXkCvwW2W57Qbr-h--JLZB6errlyP5IwsYyk";

  // 이미 전역 sb가 있다면 재사용(중복 생성으로 인한 onAuthStateChange 혼선 방지)
  const sb = (function(){
    if (window.sb && window.sb.auth) return window.sb;
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
    });
    window.sb = client;
    return client;
  })();

  // ---------- 관리자 이메일 ----------
  const ADMIN_EMAILS = ['pnk506@gmail.com'];

  function isAdminEmail(email){
    return ADMIN_EMAILS.includes((email||'').toLowerCase());
  }
  function isAdmin(session){
    const email = session?.user?.email || '';
    return isAdminEmail(email);
  }

  // ---------- 세션 유틸 ----------
  async function safeGetSession(timeoutMs = 2000){
    try{
      return await Promise.race([
        sb.auth.getSession().catch(()=>({ data:{ session:null }})),
        new Promise(res => setTimeout(()=>res({ data:{ session:null }}), timeoutMs))
      ]);
    }catch{
      return { data:{ session:null } };
    }
  }
  async function getSession(){
    const { data:{ session } } = await sb.auth.getSession();
    return session ?? null;
  }
  async function waitForSession(maxMs=5000, step=250){
    const t0 = Date.now();
    while (Date.now()-t0 < maxMs){
      const s = await getSession();
      if (s?.user) return s;
      await new Promise(r=>setTimeout(r, step));
    }
    return null;
  }

  // ---------- 이벤트(구독) ----------
  const listeners = new Set();
  const unsubSupabase = sb.auth.onAuthStateChange(async ()=>{
    const session = await getSession();
    listeners.forEach(fn => {
      try { fn(session); } catch(e){ console.warn('[mmAuth] listener error', e); }
    });
  });

  function onAuthChange(cb){
    if (typeof cb === 'function') listeners.add(cb);
    // 구독 직후 한 번 현재 상태도 알려줌
    getSession().then(s => { try{ cb(s); }catch{} });
    return ()=>listeners.delete(cb);
  }

  // ---------- 액션 ----------
  async function signUp(email, password){
    return sb.auth.signUp({ email, password });
  }
  async function signIn(email, password){
    return sb.auth.signInWithPassword({ email, password });
  }
  async function signOut(){
    return sb.auth.signOut();
  }

  // ---------- 공개 API ----------
  window.mmAuth = {
    getClient : () => sb,
    getSession,
    safeGetSession,
    waitForSession,
    signUp, signIn, signOut,
    onAuthChange,
    isAdmin, isAdminEmail,
    ADMIN_EMAILS
  };
})();

// /js/mm-auth.js
;(() => {
  const SUPABASE_URL  = "https://snxjcbaaysgfunpsohzg.supabase.co";
  const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNueGpjYmFheXNnZnVucHNvaHpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1OTk3MzQsImV4cCI6MjA3MjE3NTczNH0.T8b9PpabXkCvwW2W57Qbr-h--JLZB6errlyP5IwsYyk";

  // 관리자 이메일 중앙관리
  const ADMIN_EMAILS = ['pnk506@gmail.com'];

  // Supabase 클라이언트(전역 단일 인스턴스)
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  // 유틸
  async function getSession() {
    try {
      const { data: { session } } = await sb.auth.getSession();
      return session || null;
    } catch {
      return null;
    }
  }

  async function waitForSession(maxMs = 3000, step = 200) {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      const s = await getSession();
      if (s?.user) return s;
      await new Promise(r => setTimeout(r, step));
    }
    return null;
  }

  function isAdminEmail(email) {
    return ADMIN_EMAILS.includes(email || '');
  }

  function isAdminSession(session) {
    return !!(session?.user?.email && isAdminEmail(session.user.email));
  }

  // 이벤트 구독
  const listeners = new Set();
  function onChange(fn) {
    if (typeof fn === 'function') listeners.add(fn);
    // 현재 상태로 즉시 1회 호출
    getSession().then(s => fn?.(s)).catch(()=>{});
    return () => listeners.delete(fn);
  }

  sb.auth.onAuthStateChange(async () => {
    const s = await getSession();
    listeners.forEach(fn => { try { fn(s); } catch {} });
  });

  // sign helpers
  function signUp(email, password) {
    return sb.auth.signUp({ email, password });
  }
  function signIn(email, password) {
    return sb.auth.signInWithPassword({ email, password });
  }
  function signOut() {
    return sb.auth.signOut();
  }

  // 공개 API
  window.mmAuth = Object.freeze({
    sb,
    getSession,
    waitForSession,
    signUp,
    signIn,
    signOut,
    onChange,
    ADMIN_EMAILS,
    isAdminEmail,
    isAdminSession
  });
})();

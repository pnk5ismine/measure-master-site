/* /js/mm-auth.js : 모든 페이지에서 공유하는 Supabase 인증/세션 유틸 */
(function(global){
  const SUPABASE_URL  = "https://snxjcbaaysgfunpsohzg.supabase.co";
  const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNueGpjYmFheXNnZnVucHNvaHpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1OTk3MzQsImV4cCI6MjA3MjE3NTczNH0.T8b9PpabXkCvwW2W57Qbr-h--JLZB6errlyP5IwsYyk";
  const sb = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
  });

  // 관리자 이메일(한 곳에서만 관리)
  const ADMIN_EMAILS = ['pnk506@gmail.com'];

  // 단순 이벤트 버스 (세션 변경 브로드캐스트)
  const subs = new Set();
  function emit(){ subs.forEach(fn => { try{ fn(); }catch{} }); }
  sb.auth.onAuthStateChange(()=> emit());
  window.addEventListener('storage', (e)=>{
    if (e.key && e.key.includes('-auth-token')) emit();
  });

  // 유틸
  async function getSession(){
    try{ const { data:{ session } } = await sb.auth.getSession(); return session || null; }
    catch{ return null; }
  }
  async function waitForSession(maxMs=5000, step=250){
    const t0 = Date.now();
    while(Date.now()-t0 < maxMs){
      const s = await getSession();
      if(s?.user) return s;
      await new Promise(r=>setTimeout(r, step));
    }
    return null;
  }
  function isAdmin(session){
    const email = session?.user?.email || '';
    return ADMIN_EMAILS.includes(email);
  }
  function displayName(row){
    if (ADMIN_EMAILS.includes(row?.author_email || '')) return '관리자';
    return row?.nickname || (row?.author_email ? row.author_email.split('@')[0] : '익명');
  }
  function isOwner(session, row){
    if (!session?.user) return false;
    if (row?.user_id) return session.user.id === row.user_id;
    if (row?.author_email && session.user.email) return row.author_email === session.user.email;
    return false;
  }

  // 공개 API
  global.mmAuth = {
    sb,
    getSession, waitForSession,
    signIn: (email, password)=> sb.auth.signInWithPassword({ email, password }),
    signUp: (email, password)=> sb.auth.signUp({ email, password }),
    signOut: ()=> sb.auth.signOut(),
    isAdmin, isOwner, displayName,
    onChange: (fn)=>{ subs.add(fn); return ()=>subs.delete(fn); }
  };
})(window);

/* /js/mm-auth.js — 통합 인증 모듈 (drop-in) */
(function () {
  if (!window.supabase) {
    console.error("[mmAuth] supabase-js 가 먼저 로드되어야 합니다.");
    return;
  }

  // === 프로젝트 설정 ===
  const SUPABASE_URL  = "https://snxjcbaaysgfunpsohzg.supabase.co";
  const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNueGpjYmFheXNnZnVucHNvaHpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1OTk3MzQsImV4cCI6MjA3MjE3NTczNH0.T8b9PpabXkCvwW2W57Qbr-h--JLZB6errlyP5IwsYyk";

  // 필요하면 관리자 메일 채워 넣으세요 (리뷰 목록에서 "관리자" 표기용)
  const ADMIN_EMAILS = [
    // "admin@example.com",
  ];

  // === 클라이언트 생성 ===
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  // === 상태 & 이벤트 ===
  let currentSession = null;
  let ready = false;

  const changeHandlers = [];
  const readyHandlers  = [];

  function fireChange() {
    changeHandlers.forEach(fn => {
      try { fn(currentSession); } catch (e) { /* noop */ }
    });
  }
  function fireReady() {
    ready = true;
    while (readyHandlers.length) {
      const fn = readyHandlers.shift();
      try { fn(currentSession); } catch (e) { /* noop */ }
    }
  }

  // 최초 세션 동기화
  (async () => {
    try {
      const { data: { session } } = await sb.auth.getSession();
      currentSession = session || null;
    } catch (_) {
      currentSession = null;
    } finally {
      fireReady();
      fireChange();
    }
  })();

  // 세션 변화 구독
  sb.auth.onAuthStateChange((_event, session) => {
    currentSession = session || null;
    fireChange();
  });

  // === 공개 API ===
  async function getSession() {
    try {
      const { data: { session } } = await sb.auth.getSession();
      currentSession = session || null;
      return currentSession;
    } catch (e) {
      return null;
    }
  }

  function onChange(handler) {
    if (typeof handler === "function") changeHandlers.push(handler);
  }

  function whenReady(handler) {
    if (typeof handler !== "function") return;
    if (ready) {
      // 다음 틱에 호출(동기 호출로 인한 레이아웃 경쟁 방지)
      setTimeout(() => handler(currentSession), 0);
    } else {
      readyHandlers.push(handler);
    }
  }

  function isAdmin(email) {
    if (!email) return false;
    return ADMIN_EMAILS.includes(String(email).toLowerCase());
  }

  // 로그인/가입/로그아웃 래퍼
  function signIn(email, password) {
    return sb.auth.signInWithPassword({ email, password });
  }
  function signUp(email, password) {
    return sb.auth.signUp({ email, password });
  }
  function signOut() {
    return sb.auth.signOut();
  }

  function _debugPing() {
    console.log("[mmAuth] ready:", ready, "session:", currentSession);
  }

  // 전역 노출 (기존 키 보존 + 새 키 추가)
/* /js/mm-auth.js — 통합 인증 모듈 (drop-in) */
(function () {
  if (!window.supabase) {
    console.error("[mmAuth] supabase-js 가 먼저 로드되어야 합니다.");
    return;
  }

  // === 프로젝트 설정 ===
  const SUPABASE_URL  = "https://snxjcbaaysgfunpsohzg.supabase.co";
  const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNueGpjYmFheXNnZnVucHNvaHpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1OTk3MzQsImV4cCI6MjA3MjE3NTczNH0.T8b9PpabXkCvwW2W57Qbr-h--JLZB6errlyP5IwsYyk";

  const ADMIN_EMAILS = [
    // "admin@example.com",
  ];

  // === 클라이언트 생성 ===
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  // === 상태 & 이벤트 ===
  let currentSession = null;
  let ready = false;

  const changeHandlers = [];
  const readyHandlers  = [];

  function fireChange() {
    changeHandlers.forEach(fn => { try { fn(currentSession); } catch (_) {} });
  }
  function fireReady() {
    ready = true;
    while (readyHandlers.length) {
      const fn = readyHandlers.shift();
      try { fn(currentSession); } catch (_) {}
    }
  }

  // 최초 세션 동기화
  (async () => {
    try {
      const { data: { session } } = await sb.auth.getSession();
      currentSession = session || null;
    } catch (_) {
      currentSession = null;
    } finally {
      fireReady();
      fireChange();
    }
  })();

  // 세션 변화 구독
  sb.auth.onAuthStateChange((_event, session) => {
    currentSession = session || null;
    fireChange();
  });

  // === 공개 API ===
  async function getSession() {
    try {
      const { data: { session } } = await sb.auth.getSession();
      currentSession = session || null;
      return currentSession;
    } catch (_) {
      return null;
    }
  }

  function onChange(handler) {
    if (typeof handler === "function") changeHandlers.push(handler);
  }

  function whenReady(handler) {
    if (typeof handler !== "function") return;
    if (ready) { setTimeout(() => handler(currentSession), 0); }
    else { readyHandlers.push(handler); }
  }

  function isAdmin(email) {
    if (!email) return false;
    return ADMIN_EMAILS.includes(String(email).toLowerCase());
  }

  // 입력 정규화
  const normEmail = (s) => String(s || "").trim().toLowerCase();
  const normPw    = (s) => String(s || "");

  // 로그인/가입/로그아웃 래퍼 (입력 정규화)
  function signIn(email, password) {
    return sb.auth.signInWithPassword({ email: normEmail(email), password: normPw(password) });
  }
  function signUp(email, password) {
    return sb.auth.signUp({ email: normEmail(email), password: normPw(password) });
  }
  function signOut() {
    return sb.auth.signOut();
  }

  function _debugPing() {
    console.log("[mmAuth] ready:", ready, "session:", currentSession);
  }

  // 간단 진단
  async function _diag() {
    const ref = SUPABASE_URL.replace(/^https?:\/\//, "").split(".")[0];
    const { data: { session } } = await sb.auth.getSession();
    return {
      url: SUPABASE_URL,
      ref,
      anon: SUPABASE_ANON.slice(0, 6) + "…" + SUPABASE_ANON.slice(-6),
      hasSession: !!session,
      user: session?.user?.email || null,
    };
  }

  // 전역 노출
  window.mmAuth = {
    // 기존
    sb,
    isAdmin,
    getSession,
    signIn,
    signUp,
    // 추가
    signOut,
    onChange,
    whenReady,
    _debugPing,
    _diag,
    meta: {
      url: SUPABASE_URL,
      ref: SUPABASE_URL.replace(/^https?:\/\//, "").split(".")[0],
      anon: SUPABASE_ANON.slice(0, 6) + "…" + SUPABASE_ANON.slice(-6),
    },
    version: "2025-10-03.r1"
  };
})();

})();

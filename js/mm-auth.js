// /js/mm-auth.js
(function(){
  // ---- Supabase 설정 ----
  var SUPABASE_URL  = "https://snxjcbaaysgfunpsohzg.supabase.co";
  var SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNueGpjYmFheXNnZnVucHNvaHpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1OTk3MzQsImV4cCI6MjA3MjE3NTczNH0.T8b9PpabXkCvwW2W57Qbr-h--JLZB6errlyP5IwsYyk";

  if (!window.supabase) {
    console.error("[mm-auth] supabase-js가 아직 로드되지 않았습니다. CDN 스크립트 순서를 확인하세요.");
    return;
  }

  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON, {
    auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
  });

  // ---- 관리자 메일(공통) ----
  var ADMIN_EMAILS = ["pnk506@gmail.com"];

  // ---- 내부 상태 ----
  var sessionCache = null;
  var changeCallbacks = [];
  var readyResolved = false;
  var readyPromiseResolve = null;
  var ready = new Promise(function(res){ readyPromiseResolve = res; });

  function log(){ /* 필요 시 console.log.apply(console, arguments); */ }

  function isAdmin(input){
    if (!input) return false;
    var email = "";
    if (typeof input === "string") email = input;
    else if (input.user && input.user.email) email = input.user.email;
    return ADMIN_EMAILS.indexOf(email) >= 0;
  }

  function getSession(timeoutMs){
    var to = typeof timeoutMs === "number" ? timeoutMs : 2500;
    var p = sb.auth.getSession().then(function(r){
      return r && r.data ? r.data.session : null;
    })["catch"](function(){ return null; });
    var t = new Promise(function(res){ setTimeout(function(){ res(null); }, to); });
    return Promise.race([p,t]);
  }

  function onChange(cb){
    if (typeof cb === "function") changeCallbacks.push(cb);
  }

  function fireChange(){
    for (var i=0;i<changeCallbacks.length;i++){
      try { changeCallbacks[i](sessionCache); } catch(e){ console.warn("[mm-auth] onChange callback error:", e); }
    }
  }

  function signIn(email, password){
    return sb.auth.signInWithPassword({ email: email, password: password });
  }

  function signUp(email, password){
    return sb.auth.signUp({ email: email, password: password });
  }

  function signOut(){
    return sb.auth.signOut();
  }

  // 첫 세션 확보 -> ready
  (function bootstrap(){
    getSession(3000).then(function(sess){
      sessionCache = sess;
      if (!readyResolved && typeof readyPromiseResolve === "function"){
        readyResolved = true;
        readyPromiseResolve(true);
      }
      // 문서 이벤트로도 브로드캐스트
      try { document.dispatchEvent(new CustomEvent("mm-auth-ready")); } catch(_){}
    });
  })();

  // 상태 변경 수신
  sb.auth.onAuthStateChange(function(){
    getSession(3000).then(function(sess){
      sessionCache = sess;
      fireChange();
    });
  });

  // 외부 노출
  window.mmAuth = {
    sb: sb,
    isAdmin: isAdmin,
    getSession: function(){ return getSession(2500); },
    signIn: signIn,
    signUp: signUp,
    signOut: signOut,
    onChange: onChange,
    whenReady: function(cb){
      // 콜백도 받고, Promise도 반환
      if (typeof cb === "function"){
        ready.then(function(){ cb(); });
      }
      return ready;
    },
    // 디버그용
    _debugPing: function(){
      console.log("[mm-auth] debug: sb=", !!sb, "session cached:", !!sessionCache);
      return { hasSb: !!sb, hasSession: !!sessionCache };
    }
  };
})();

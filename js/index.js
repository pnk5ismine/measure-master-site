// /js/index.js
;(() => {
  if (!window.mmAuth) {
    console.error('[index] mmAuth 가 먼저 로드되어야 합니다.');
    return;
  }
  const sb = window.mmAuth.sb;

  const $ = s => document.querySelector(s);
  const elTabs   = $("#auth-tabs");
  const elTabSignup = $("#tab-signup");
  const elTabLogin  = $("#tab-login");
  const elSignup = $("#signup-form");
  const elLogin  = $("#login-form");
  const elLogout = $("#logout-btn");
  const goLogin  = $("#go-login");

  const t = (key, vars) => window.mmI18n?.t ? window.mmI18n.t(key, vars) : key;

  function showSignup(){
    elTabSignup?.classList.add("active");
    elTabLogin?.classList.remove("active");
    elSignup.hidden=false;
    elLogin.hidden=true;
  }
  function showLogin(){
    elTabLogin?.classList.add("active");
    elTabSignup?.classList.remove("active");
    elLogin.hidden=false;
    elSignup.hidden=true;
  }

  elTabSignup?.addEventListener("click", showSignup);
  elTabLogin?.addEventListener("click", showLogin);
  goLogin?.addEventListener("click", (e)=>{ e.preventDefault(); showLogin(); });

  async function refreshAuthUI(session){
    if (!session) session = await window.mmAuth.getSession();

    if(session?.user){
      if(elTabs)   elTabs.hidden = true;
      if(elSignup) elSignup.hidden = true;
      if(elLogin)  elLogin.hidden  = false;

      const loginBtn = $("#login-form button.primary");
      if (loginBtn) loginBtn.style.display = "none";
      if (elLogout) elLogout.style.display = "inline-block";

      const email = session.user.email || "";
      const emailInput = $("#login-email");
      if (emailInput) emailInput.value = email;
    } else {
      if(elTabs) elTabs.hidden = false;
      showSignup();

      const loginBtn = $("#login-form button.primary");
      if (loginBtn) loginBtn.style.display = "";
      if (elLogout) elLogout.style.display = "none";
    }
  }

  // 방문자수
  async function bumpAndShowVisitCounterHome() {
    const el = document.getElementById('visitCounterHome');
    if (!el) return;

    try {
      const { data, error } = await sb.rpc('inc_page_visit', { _page: 'home_index' });
      if (error) throw error;

      const n = Number(data || 0);
      // idx.visit.count 예: "Visits {n}"
      el.textContent = t("idx.visit.count", { n: n.toLocaleString() });
    } catch (e) {
      console.warn('[visitCounter] RPC 실패:', e?.message||e);
      el.textContent = t("idx.visit.fallback"); // 예: "Visits: unavailable"
    }

    setTimeout(() => {
      if (/loading/i.test(el.textContent) || /로딩/.test(el.textContent)) {
        el.textContent = t("idx.visit.fallback");
      }
    }, 3000);
  }

  // 가입/로그인/로그아웃
  elSignup?.addEventListener("submit", async(e)=>{
    e.preventDefault();
    const email = e.target.email.value.trim();
    const pw1   = e.target.password.value;
    const pw2   = e.target.password2.value;

    if(pw1 !== pw2){
      alert(t("idx.msg.pw_mismatch"));
      return;
    }

    const { error } = await window.mmAuth.signUp(email, pw1);
    alert(error ? t("idx.msg.signup_err", { msg: error.message }) : t("idx.msg.signup_ok"));
    refreshAuthUI();
  });

  elLogin?.addEventListener("submit", async(e)=>{
    e.preventDefault();
    const email = e.target.email.value.trim();
    const password = e.target.password.value;

    const { error } = await window.mmAuth.signIn(email, password);
    alert(error ? t("idx.msg.login_err", { msg: error.message }) : t("idx.msg.login_ok"));
    refreshAuthUI();
  });

  elLogout?.addEventListener("click", async()=>{
    await window.mmAuth.signOut();
    refreshAuthUI();
  });

  window.mmAuth.onChange(refreshAuthUI);

  // lazy만 처리 (언어는 i18n.js가 담당)
  function initLazy(){
    try{
      if ('loading' in HTMLImageElement.prototype) {
        document.querySelectorAll('img:not([loading]):not(.no-lazy)')
          .forEach(img=>{
            img.setAttribute('loading','lazy');
            img.setAttribute('decoding','async');
          });
      }
    }catch(e){
      console.warn("[MM] initLazy warning:", e);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initLazy();
    refreshAuthUI();
    bumpAndShowVisitCounterHome();

    // i18n이 뒤늦게 로드되어 텍스트 치환이 필요하면:
    window.mmI18n?.applyI18n?.();
  });
})();

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

  function showSignup(){
    elTabSignup?.classList.add("active");
    elTabLogin?.classList.remove("active");
    if (elSignup) elSignup.hidden=false;
    if (elLogin)  elLogin.hidden=true;
  }
  function showLogin(){
    elTabLogin?.classList.add("active");
    elTabSignup?.classList.remove("active");
    if (elLogin)  elLogin.hidden=false;
    if (elSignup) elSignup.hidden=true;
  }

  elTabSignup?.addEventListener("click", showSignup);
  elTabLogin?.addEventListener("click", showLogin);
  goLogin?.addEventListener("click", (e)=>{ e.preventDefault(); showLogin(); });

  // i18n helper (없으면 기존 문구 fallback)
  const t = (key, fallback) => {
    try {
      return window.mmI18n?.t ? window.mmI18n.t(key, fallback) : fallback;
    } catch {
      return fallback;
    }
  };

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

      // locale: ko면 ko-KR, en이면 en-US 정도로
      const lang = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
      const locale = lang === 'ko' ? 'ko-KR' : 'en-US';

      el.textContent = t('idx.visit.count', `Visits ${n.toLocaleString(locale)}`)
        .replace('{n}', n.toLocaleString(locale));
    } catch (e) {
      console.warn('[visitCounter] RPC 실패:', e?.message||e);
      el.textContent = t('idx.visit.preparing', 'Visit count: preparing');
    }

    setTimeout(() => {
      if (/로딩|Loading/i.test(el.textContent)) {
        el.textContent = t('idx.visit.preparing', 'Visit count: preparing');
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
      alert(t('idx.auth.pw_mismatch', "Password confirmation doesn't match."));
      return;
    }

    const { error } = await window.mmAuth.signUp(email, pw1);
    alert(error
      ? t('idx.auth.signup_fail', `Sign-up failed: ${error.message}`).replace('{msg}', error.message)
      : t('idx.auth.signup_ok', 'Sign-up completed. If email verification is enabled, check your inbox.')
    );

    refreshAuthUI();
  });

  elLogin?.addEventListener("submit", async(e)=>{
    e.preventDefault();
    const email = e.target.email.value.trim();
    const password = e.target.password.value;

    const { error } = await window.mmAuth.signIn(email, password);
    alert(error
      ? t('idx.auth.login_fail', `Login failed: ${error.message}`).replace('{msg}', error.message)
      : t('idx.auth.login_ok', 'Logged in')
    );

    refreshAuthUI();
  });

  elLogout?.addEventListener("click", async()=>{
    await window.mmAuth.signOut();
    refreshAuthUI();
  });

  // 인증 변경시 자동 반영 + 최초 즉시 반영
  window.mmAuth.onChange(refreshAuthUI);

  function initLangAndLazy(){
    try{
      const urlLang = new URLSearchParams(location.search).get('lang');
      const savedLang = localStorage.getItem('mm_lang');
      const lang = (urlLang || savedLang || 'en').toLowerCase();
      document.documentElement.setAttribute('lang', lang);

      if (urlLang) localStorage.setItem('mm_lang', lang);

      document.querySelectorAll('[data-lang-btn]').forEach(btn=>{
        const v = btn.getAttribute('data-lang-btn');
        if(v === lang) btn.classList.add('active');
        btn.addEventListener('click', ()=>{
          // index.html에서 이미 i18n 로딩/적용을 해주지만,
          // querystring 방식 유지하고 싶으면 아래 한 줄을 살려도 됩니다.
          // location.search = '?lang=' + encodeURIComponent(v);
          localStorage.setItem('mm_lang', v);
          document.documentElement.setAttribute('lang', v);
        });
      });

      if ('loading' in HTMLImageElement.prototype) {
        document.querySelectorAll('img:not([loading]):not(.no-lazy)')
          .forEach(img=>{
            img.setAttribute('loading','lazy');
            img.setAttribute('decoding','async');
          });
      }
    }catch(e){
      console.warn("[MM] initLangAndLazy warning:", e);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();

    initLangAndLazy();
    refreshAuthUI();
    bumpAndShowVisitCounterHome();
  });
})();

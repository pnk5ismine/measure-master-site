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

  function showSignup(){ elTabSignup?.classList.add("active"); elTabLogin?.classList.remove("active"); elSignup.hidden=false; elLogin.hidden=true; }
  function showLogin(){  elTabLogin?.classList.add("active");  elTabSignup?.classList.remove("active"); elLogin.hidden=false;  elSignup.hidden=true; }

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
      if(elTabs)   elTabs.hidden = false;
      showSignup();
      const loginBtn = $("#login-form button.primary");
      if (loginBtn) loginBtn.style.display = "";
      if (elLogout) elLogout.style.display = "none";
    }
  }

  // 방문자수 (RPC 실패 원인도 출력)
  async function bumpAndShowVisitCounterHome() {
    const el = document.getElementById('visitCounterHome');
    if (!el) return;
    try {
      const { data, error } = await sb.rpc('inc_page_visit', { _page: 'home_index' });
      if (error) throw error;
      const n = Number(data || 0);
      el.textContent = `방문수 ${n.toLocaleString('ko-KR')}`;
    } catch (e) {
      console.warn('[visitCounter] RPC 실패:', e?.message||e);
      el.textContent = '방문수 준비중';
    }
    // 3초 후에도 로딩이면 실패로 표시
    setTimeout(() => {
      if (/로딩중/.test(el.textContent)) el.textContent = '방문수 준비중';
    }, 3000);
  }

  // 가입/로그인/로그아웃
  elSignup?.addEventListener("submit", async(e)=>{
    e.preventDefault();
    const email = e.target.email.value.trim();
    const pw1   = e.target.password.value;
    const pw2   = e.target.password2.value;
    if(pw1 !== pw2){ alert("비밀번호 확인이 일치하지 않습니다."); return; }
    const { error } = await window.mmAuth.signUp(email, pw1);
    alert(error ? `가입 실패: ${error.message}` : "가입 완료(이메일 인증을 설정했다면 메일을 확인하세요)");
    refreshAuthUI();
  });

  elLogin?.addEventListener("submit", async(e)=>{
    e.preventDefault();
    const email = e.target.email.value.trim();
    const password = e.target.password.value;
    const { error } = await window.mmAuth.signIn(email, password);
    alert(error ? `로그인 실패: ${error.message}` : "로그인 성공");
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
      const lang = (urlLang || savedLang || 'ko').toLowerCase();
      document.documentElement.setAttribute('lang', lang);
      if (urlLang) localStorage.setItem('mm_lang', lang);

      document.querySelectorAll('[data-lang-btn]').forEach(btn=>{
        const v = btn.getAttribute('data-lang-btn');
        if(v === lang) btn.classList.add('active');
        btn.addEventListener('click', ()=>{
          localStorage.setItem('mm_lang', v);
          document.documentElement.setAttribute('lang', v);
          location.search = '?lang=' + encodeURIComponent(v);
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
    document.getElementById('year').textContent = new Date().getFullYear();
    initLangAndLazy();
    refreshAuthUI();
    bumpAndShowVisitCounterHome();
  });
})();

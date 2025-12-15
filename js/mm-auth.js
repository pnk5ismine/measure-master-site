// /js/mm-auth.js
// Home(index.html)의 "Tester login" 섹션용 간단 Auth + members 연동

(function (global) {
  // 🔧 여기 두 값은 *반드시* 본인 Supabase 프로젝트 값으로 바꿔 넣어야 합니다.
  //    - URL: https://<project-ref>.supabase.co
  //    - KEY: sb_publishable_ 로 시작하는 ANON/PUBLIC 키
  const SUPABASE_URL = 'https://dyoeqoeuoziaiiflqtdt.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_0-sfEJvu_n2_uSAlZKKdqA_QCjX-P_S';

  if (!global.supabase) {
    console.error('[mmAuth] supabase-js not loaded. Check CDN script.');
    return;
  }

  const client = global.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // members 테이블에 (user_id, email, nickname) upsert
  async function ensureMemberForUser(user) {
    try {
      if (!user) return;
      const email = user.email || '';
      const nickname =
        (email && email.split('@')[0]) ||
        'tester';

      const { error } = await client
        .from('members')
        .upsert(
          {
            user_id: user.id,
            email: email,
            nickname: nickname,
            is_admin: false
          },
          { onConflict: 'user_id' } // 이미 있으면 업데이트
        );

      if (error) {
        console.error('[mmAuth] members upsert error:', error);
      }
    } catch (e) {
      console.error('[mmAuth] ensureMemberForUser exception:', e);
    }
  }

  const mmAuth = {
    supabase: client,

    async initHomeAuth() {
      const tabSignup   = document.getElementById('tab-signup');
      const tabLogin    = document.getElementById('tab-login');
      const signupForm  = document.getElementById('signup-form');
      const loginForm   = document.getElementById('login-form');
      const logoutBtn   = document.getElementById('logout-btn');
      const goLoginLink = document.getElementById('go-login');

      if (!signupForm && !loginForm) {
        // 이 페이지에는 회원가입 UI가 없는 경우
        return;
      }

      function showSignup() {
        if (signupForm) signupForm.hidden = false;
        if (loginForm)  loginForm.hidden  = true;
        if (tabSignup)  tabSignup.classList.add('active');
        if (tabLogin)   tabLogin.classList.remove('active');
      }

      function showLogin() {
        if (signupForm) signupForm.hidden = true;
        if (loginForm)  loginForm.hidden  = false;
        if (tabLogin)   tabLogin.classList.add('active');
        if (tabSignup)  tabSignup.classList.remove('active');
      }

      // 탭 전환
      if (tabSignup) {
        tabSignup.addEventListener('click', (e) => {
          e.preventDefault();
          showSignup();
        });
      }
      if (tabLogin) {
        tabLogin.addEventListener('click', (e) => {
          e.preventDefault();
          showLogin();
        });
      }
      if (goLoginLink) {
        goLoginLink.addEventListener('click', (e) => {
          e.preventDefault();
          showLogin();
        });
      }

      // 회원가입 처리
      if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const email = (document.getElementById('signup-email')?.value || '').trim();
          const pw    = document.getElementById('signup-password')?.value || '';
          const pw2   = document.getElementById('signup-password2')?.value || '';

          if (!email) {
            alert('Please enter your email.');
            return;
          }
          if (pw !== pw2) {
            alert('Passwords do not match.');
            return;
          }
          if (pw.length < 4) {
            alert('Please use a password with at least 4 characters.');
            return;
          }

          const { data, error } = await client.auth.signUp({
            email,
            password: pw
          });

          if (error) {
            // ❗ 여기 메시지를 잘 봐 주세요. 예: "Password should be at least 6 characters"
            alert('Sign-up failed: ' + (error.message || 'Unknown error'));
            console.error('[mmAuth] signUp error:', error);
            return;
          }

          const user = data.user;
          await ensureMemberForUser(user);

          alert('Sign-up successful.\nIf email confirmation is required, please check your inbox.');
          showLogin();
          const loginEmail = document.getElementById('login-email');
          if (loginEmail) loginEmail.value = email;
        });
      }

      // 로그인 처리
      if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const email = (document.getElementById('login-email')?.value || '').trim();
          const pw    = document.getElementById('login-password')?.value || '';

          if (!email || !pw) {
            alert('Please enter both email and password.');
            return;
          }

          const { data, error } = await client.auth.signInWithPassword({
            email,
            password: pw
          });

          if (error) {
            alert('Login failed: ' + (error.message || 'Unknown error'));
            console.error('[mmAuth] signIn error:', error);
            return;
          }

          const user = data.user;
          await ensureMemberForUser(user);

          alert('Logged in successfully.');
          if (logoutBtn) logoutBtn.style.display = 'inline-block';
        });
      }

      // 초기 세션 상태 체크
      try {
        const { data } = await client.auth.getUser();
        if (data && data.user) {
          // 이미 로그인 되어 있는 상태
          await ensureMemberForUser(data.user);
          showLogin();
          const loginEmail = document.getElementById('login-email');
          if (loginEmail && data.user.email) {
            loginEmail.value = data.user.email;
          }
          if (logoutBtn) logoutBtn.style.display = 'inline-block';
        } else {
          // 미로그인 → 기본은 회원가입 탭
          showSignup();
          if (logoutBtn) logoutBtn.style.display = 'none';
        }
      } catch (e) {
        console.error('[mmAuth] getUser failed:', e);
        showSignup();
      }
    },

    async signOut() {
      await client.auth.signOut();
    }
  };

  global.mmAuth = mmAuth;
})(window);

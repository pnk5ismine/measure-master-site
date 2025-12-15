// /js/mm-auth.js
// Home(index.html)의 "Tester login" 섹션용 간단 Auth + members 연동

(function (global) {
  // 🔧 꼭 본인 Supabase 프로젝트 값으로 바꿔 넣으세요!
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
          { onConflict: 'user_id' }
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

      // 회원가입
      if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const emailRaw = document.getElementById('signup-email')?.value || '';
          const pwRaw    = document.getElementById('signup-password')?.value || '';
          const pw2Raw   = document.getElementById('signup-password2')?.value || '';

          const email = emailRaw.trim().toLowerCase();
          const pw    = pwRaw.trim();
          const pw2   = pw2Raw.trim();

          console.log('[mmAuth] signUp email =', email, 'pw.length =', pw.length);

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
            alert('Sign-up failed: ' + (error.message || 'Unknown error'));
            console.error('[mmAuth] signUp error:', error);
            return;
          }

          const user = data.user;
          await ensureMemberForUser(user);

          // 💡 가입 후 바로 로그인까지 자동 시도
          try {
            const { data: loginData, error: loginError } =
              await client.auth.signInWithPassword({ email, password: pw });

            if (loginError) {
              alert(
                'Signed up, but auto login failed: ' +
                (loginError.message || 'Unknown error')
              );
              console.error('[mmAuth] auto signIn error:', loginError);
              showLogin();
              const loginEmail = document.getElementById('login-email');
              if (loginEmail) loginEmail.value = email;
              return;
            }

            await ensureMemberForUser(loginData.user);
            alert('Sign-up and login successful.');
            if (logoutBtn) logoutBtn.style.display = 'inline-block';
            showLogin();
            const loginEmail = document.getElementById('login-email');
            if (loginEmail) loginEmail.value = email;
          } catch (e2) {
            console.error('[mmAuth] auto-login exception:', e2);
            showLogin();
          }
        });
      }

      // 로그인
      if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const emailRaw = document.getElementById('login-email')?.value || '';
          const pwRaw    = document.getElementById('login-password')?.value || '';

          const email = emailRaw.trim().toLowerCase();
          const pw    = pwRaw.trim();

          console.log('[mmAuth] login email =', email, 'pw.length =', pw.length);

          if (!email || !pw) {
            alert('Please enter both email and password.');
            return;
          }

          const { data, error } = await client.auth.signInWithPassword({
            email,
            password: pw
          });

          if (error) {
            alert('Login failed: ' + (error.message || 'Invalid login'));
            console.error('[mmAuth] signIn error:', error);
            return;
          }

          const user = data.user;
          await ensureMemberForUser(user);

          alert('Logged in successfully.');
          if (logoutBtn) logoutBtn.style.display = 'inline-block';
        });
      }

      // 초기 세션 상태
      try {
        const { data } = await client.auth.getUser();
        if (data && data.user) {
          await ensureMemberForUser(data.user);
          showLogin();
          const loginEmail = document.getElementById('login-email');
          if (loginEmail && data.user.email) {
            loginEmail.value = data.user.email;
          }
          if (logoutBtn) logoutBtn.style.display = 'inline-block';
        } else {
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

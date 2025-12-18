// /js/mm-auth.js
// 공통 Auth 서비스: index.html + reviews.html 에서 같이 사용

(function (global) {
  const SUPABASE_URL = 'https://dyoeqoeuoziaiiflqtdt.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_0-sfEJvu_n2_uSAlZKKdqA_QCjX-P_S';

  if (!global.supabase) {
    console.error('[mmAuth] supabase-js not loaded. Check CDN script.');
    return;
  }

  // 단일 Supabase 클라이언트 (모든 페이지에서 공유)
  const client = global.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  function normEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  // members 테이블에 (user_id, email, nickname) 보장
  // ⚠️ 관리자 플래그(is_admin)는 절대 덮어쓰지 않도록 수정
  async function ensureMemberForUser(user) {
    try {
      if (!user) return;

      const email = normEmail(user.email || '');
      const nickname = (email && email.split('@')[0]) || 'tester';

      // 1) 기존 레코드 확인
      const { data: existing, error: selErr } = await client
        .from('members')
        .select('user_id, is_admin')
        .eq('user_id', user.id)
        .maybeSingle();

      if (selErr) {
        console.error('[mmAuth] members select error:', selErr);
        return;
      }

      if (existing) {
        // 2) 있으면 email/nickname만 업데이트 (is_admin 유지!)
        const { error: updErr } = await client
          .from('members')
          .update({ email, nickname })
          .eq('user_id', user.id);

        if (updErr) {
          console.error('[mmAuth] members update error:', updErr);
        }
      } else {
        // 3) 없으면 insert (기본은 false)
        const { error: insErr } = await client
          .from('members')
          .insert({
            user_id: user.id,
            email,
            nickname,
            is_admin: false
          });

        if (insErr) {
          console.error('[mmAuth] members insert error:', insErr);
        }
      }
    } catch (e) {
      console.error('[mmAuth] ensureMemberForUser exception:', e);
    }
  }

  const mmAuth = {
    supabase: client,
    sb: client, // legacy alias

    async signUp(email, password) {
      const e = normEmail(email);

      const { data, error } = await client.auth.signUp({
        email: e,
        password
      });

      console.log('[mmAuth] signUp:', { data, error });
      if (error) {
        alert(error.message); // ✅ 원인 즉시 확인
        return { data, error };
      }

      if (data && data.user) {
        await ensureMemberForUser(data.user);
      }
      return { data, error };
    },

    async signIn(email, password) {
      const e = normEmail(email);

      // ✅ 입력값 자체 점검 (공백/undefined로 400 나는 경우 방지)
      if (!e || !password) {
        const msg = 'Email or password is empty.';
        console.warn('[mmAuth] signIn blocked:', { email, passwordLen: (password || '').length });
        alert(msg);
        return { data: null, error: { message: msg } };
      }

      const { data, error } = await client.auth.signInWithPassword({
        email: e,
        password
      });

      console.log('[mmAuth] signInWithPassword:', { data, error });
      if (error) {
        alert(error.message); // ✅ 400의 진짜 메시지 확인 (핵심)
        return { data, error };
      }

      if (data && data.user) {
        await ensureMemberForUser(data.user);
      }
      return { data, error };
    },

    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) console.error('[mmAuth] signOut error:', error);
      return { error };
    },

    async getSession() {
      try {
        const { data, error } = await client.auth.getSession();
        if (error) {
          console.error('[mmAuth] getSession error:', error);
          return null;
        }
        return data.session || null;
      } catch (e) {
        console.error('[mmAuth] getSession exception:', e);
        return null;
      }
    },

    onChange(callback) {
      if (typeof callback !== 'function') return;

      this.getSession()
        .then((session) => {
          try { callback(session); }
          catch (e) { console.error('[mmAuth] onChange initial callback error:', e); }
        })
        .catch((e) => console.error(e));

      client.auth.onAuthStateChange(async (_event, session) => {
        try {
          if (session && session.user) {
            await ensureMemberForUser(session.user);
          }
          callback(session);
        } catch (e) {
          console.error('[mmAuth] onChange callback error:', e);
        }
      });
    }
  };

  global.mmAuth = mmAuth;
})(window);

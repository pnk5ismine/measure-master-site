// /js/mm-auth.js
// 공통 Auth 서비스: index.html + reviews.html 에서 같이 사용

(function (global) {
  const SUPABASE_URL = 'https://dyoeqoeuoziaiiflqtdt.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_0-sfEJvu_n2_uSAlZKKdqA_QCjX-P_S';

  if (!global.supabase) {
    console.error('[mmAuth] supabase-js not loaded. Check CDN script.');
    return;
  }

  const client = global.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // ✅ members 레코드 "있으면 그대로", "없으면 생성만"
  async function ensureMemberForUser(user) {
    try {
      if (!user) return;

      const email = user.email || '';
      const nickname = (email && email.split('@')[0]) || 'tester';

      // 1) 먼저 존재 여부 확인
      const { data: existing, error: selErr } = await client
        .from('members')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (selErr) {
        console.error('[mmAuth] members select error:', selErr);
        return;
      }

      // 2) 이미 있으면 "절대 덮어쓰지 않음" (admin / nickname 유지)
      if (existing && existing.user_id) return;

      // 3) 없으면 insert (is_admin은 절대 여기서 건드리지 않음)
      const { error: insErr } = await client
        .from('members')
        .insert({
          user_id: user.id,
          email: email,
          nickname: nickname
        });

      if (insErr) {
        console.error('[mmAuth] members insert error:', insErr);
      }
    } catch (e) {
      console.error('[mmAuth] ensureMemberForUser exception:', e);
    }
  }

  const mmAuth = {
    supabase: client,
    sb: client,

    async signUp(email, password) {
      const { data, error } = await client.auth.signUp({ email, password });
      if (!error && data && data.user) await ensureMemberForUser(data.user);
      return { data, error };
    },

    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (!error && data && data.user) await ensureMemberForUser(data.user);
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
          try { callback(session); } catch (e) { console.error('[mmAuth] onChange initial callback error:', e); }
        })
        .catch((e) => console.error(e));

      client.auth.onAuthStateChange(async (_event, session) => {
        try {
          if (session && session.user) await ensureMemberForUser(session.user);
          callback(session);
        } catch (e) {
          console.error('[mmAuth] onChange callback error:', e);
        }
      });
    }
  };

  global.mmAuth = mmAuth;
})(window);

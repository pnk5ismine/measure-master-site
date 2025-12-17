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
    // Supabase client 공유
    supabase: client,
    sb: client, // 옛 코드 호환용 별칭

    /**
     * 회원 가입
     * @returns {Promise<{data:any, error:any}>}
     */
    async signUp(email, password) {
      // 여기서는 길이 체크 안 하고 Supabase에게 맡깁니다.
      // (index.html 쪽에서 6자 이상 정도만 간단히 체크해도 OK)
      const { data, error } = await client.auth.signUp({
        email,
        password
      });

      if (!error && data && data.user) {
        await ensureMemberForUser(data.user);
      }
      return { data, error };
    },

    /**
     * 로그인
     * @returns {Promise<{data:any, error:any}>}
     */
    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password
      });

      if (!error && data && data.user) {
        await ensureMemberForUser(data.user);
      }
      return { data, error };
    },

    /**
     * 로그아웃
     */
    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) {
        console.error('[mmAuth] signOut error:', error);
      }
      return { error };
    },

    /**
     * 현재 세션 가져오기
     * @returns {Promise<null|object>} Supabase Session or null
     */
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

    /**
     * Auth 상태 변화 구독
     * 콜백은 (session) 을 인자로 받습니다.
     */
    onChange(callback) {
      if (typeof callback !== 'function') return;

      // 초기 1회 호출
      this.getSession()
        .then((session) => {
          try {
            callback(session);
          } catch (e) {
            console.error('[mmAuth] onChange initial callback error:', e);
          }
        })
        .catch((e) => console.error(e));

      // 상태 변화 구독
      client.auth.onAuthStateChange((_event, session) => {
        try {
          if (session && session.user) {
            // members 보장
            ensureMemberForUser(session.user);
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

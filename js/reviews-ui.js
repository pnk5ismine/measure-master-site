// /js/reviews-ui.js
// "reviews" 테이블 목록을 표시하는 모듈.
// ❗ Supabase client는 mm-auth.js에서 만든 것을 재사용합니다.

(function (global) {
  const MMReviews = {
    supabase: null,
    user: null,

    /**
     * 초기화
     * @param {object} supabaseClient - (선택) mm-auth.js에서 넘겨주는 client
     * @param {object|null} currentUser - (선택) 이미 조회해 둔 user 객체
     */
    async init(supabaseClient, currentUser) {
      console.log('[MMReviews] init called with client, user =', !!supabaseClient, !!currentUser);

      // 1) 우선 인자로 받은 client 사용
      if (supabaseClient && supabaseClient.auth) {
        this.supabase = supabaseClient;
      }
      // 2) 아니면 mmAuth.supabase 사용
      else if (global.mmAuth && global.mmAuth.supabase) {
        this.supabase = global.mmAuth.supabase;
      }

      if (!this.supabase) {
        console.error('[MMReviews] No Supabase client available.');
        return;
      }

      this.user = currentUser || null;
      this.cacheDom();
      this.applyAuthHint();   // 로그인 안내 문구 갱신
      await this.loadList();  // 목록 로딩
    },

    cacheDom() {
      this.$listBody      = document.getElementById('listBody');
      this.$listView      = document.getElementById('listView');
      this.$readView      = document.getElementById('readView');
      this.$writeForm     = document.getElementById('writeForm');
      this.$listLoginHint = document.getElementById('listLoginHint');
      this.$btnCompose    = document.getElementById('btn-compose');

      if (!this.$listBody) {
        console.error('[MMReviews] #listBody not found.');
      }
    },

    // 로그인 상태에 따라 하단 안내 문구 갱신
    applyAuthHint() {
      if (!this.$listLoginHint) return;

      if (this.user) {
        this.$listLoginHint.textContent =
          'You are logged in as ' + (this.user.email || '') + '. You can write a review.';
      } else {
        this.$listLoginHint.textContent =
          'To write a review, please sign up / log in on the home page.';
      }
    },

    // 필요할 경우 이 함수로 최신 user를 다시 불러올 수도 있습니다.
    async refreshUser() {
      if (!this.supabase) return null;
      const { data, error } = await this.supabase.auth.getUser();
      if (error) {
        console.warn('[MMReviews] refreshUser error:', error);
        this.user = null;
      } else {
        this.user = data && data.user ? data.user : null;
      }
      this.applyAuthHint();
      return this.user;
    },

    async loadList() {
      if (!this.$listBody) return;

      // 로딩 중 표시
      this.$listBody.innerHTML = '';
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.textContent = 'Loading reviews…';
      tr.appendChild(td);
      this.$listBody.appendChild(tr);

      // Supabase에서 리뷰 목록 가져오기
      const { data, error } = await this.supabase
        .from('reviews')
        .select('id, title, content, nickname, view_count, created_at, is_notice')
        .order('is_notice', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[MMReviews] Failed to load list:', error);
        td.textContent =
          'Failed to load the list: ' + (error.message || 'Unknown error');
        return;
      }

      if (!data || data.length === 0) {
        td.textContent = 'No reviews have been posted yet.';
        return;
      }

      // 목록 렌더링
      this.$listBody.innerHTML = '';
      data.forEach((row, idx) => {
        const tr = document.createElement('tr');

        // 번호
        const tdNo = document.createElement('td');
        tdNo.className = 'cell-no';
        tdNo.textContent = String(idx + 1);
        tr.appendChild(tdNo);

        // 닉네임
        const tdNick = document.createElement('td');
        tdNick.className = 'cell-nick';
        tdNick.textContent = row.nickname || '-';
        tr.appendChild(tdNick);

        // 본문(목록 요약)
        const tdBody = document.createElement('td');
        tdBody.className = 'cell-body';

        const line1 = document.createElement('div');
        line1.className = 'm-line1';
        line1.textContent = row.title || '(No title)';

        const line2 = document.createElement('div');
        line2.className = 'm-line2';
        const spanViews = document.createElement('span');
        spanViews.textContent = `Views ${row.view_count ?? 0}`;
        const spanTime = document.createElement('span');
        spanTime.textContent = this.formatDate(row.created_at);
        line2.appendChild(spanViews);
        line2.appendChild(spanTime);

        tdBody.appendChild(line1);
        tdBody.appendChild(line2);
        tr.appendChild(tdBody);

        // 조회수
        const tdStats = document.createElement('td');
        tdStats.className = 'cell-stats';
        tdStats.textContent = String(row.view_count ?? 0);
        tr.appendChild(tdStats);

        // 작성 시각
        const tdTime = document.createElement('td');
        tdTime.className = 'cell-time';
        tdTime.textContent = this.formatDateTime(row.created_at);
        tr.appendChild(tdTime);

        // 클릭 시 읽기 뷰로 변경 (지금은 간단한 알림만)
        tr.dataset.id = row.id;
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', () => {
          alert('Reading view will be implemented in the next step.\n\nTitle: ' + (row.title || ''));
        });

        if (row.is_notice) {
          tr.classList.add('notice');
        }

        this.$listBody.appendChild(tr);
      });
    },

    formatDate(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    },

    formatDateTime(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${y}-${m}-${day} ${hh}:${mm}`;
    }
  };

  global.MMReviews = MMReviews;
})(window);

// /js/reviews-ui.js
// 새 Supabase 프로젝트의 "reviews" 테이블을 읽어서 목록에 표시하는 최소 버전

(function (global) {
  // 🔧 이 두 줄은 반드시 "본인 프로젝트 값"으로 바꿔 넣으세요.
  const SUPABASE_URL = 'https://dyoeqoeuoziaiiflqtdt.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_0-sfEJvu_n2_uSAlZKKdqA_QCjX-P_S ';

  if (!global.supabase) {
    console.error('[MMReviews] supabase-js가 로드되지 않았습니다. CDN 스크립트를 확인하세요.');
    return;
  }

  const supabase = global.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const MMReviews = {
    async init() {
      this.cacheDom();
      await this.loadList();
    },

    cacheDom() {
      this.$listBody   = document.getElementById('listBody');
      this.$listView   = document.getElementById('listView');
      this.$readView   = document.getElementById('readView');
      this.$writeForm  = document.getElementById('writeForm');
      this.$listLoginHint = document.getElementById('listLoginHint');

      // 안전장치
      if (!this.$listBody) {
        console.error('[MMReviews] #listBody 를 찾지 못했습니다.');
      }
    },

    async loadList() {
      if (!this.$listBody) return;

      // 로딩 중 표시
      this.$listBody.innerHTML = '';
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.textContent = '목록을 불러오는 중입니다…';
      tr.appendChild(td);
      this.$listBody.appendChild(tr);

      // Supabase에서 리뷰 목록 가져오기
      const { data, error } = await supabase
        .from('reviews')
        .select('id, title, content, nickname, view_count, created_at, is_notice')
        .order('is_notice', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[MMReviews] 목록 로드 실패:', error);
        td.textContent = '목록 로드 실패: ' + (error.message || '알 수 없는 오류');
        return;
      }

      if (!data || data.length === 0) {
        td.textContent = '등록된 후기가 아직 없습니다.';
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

        // 내용(제목 + 앞부분)
        const tdBody = document.createElement('td');
        tdBody.className = 'cell-body';

        const line1 = document.createElement('div');
        line1.className = 'm-line1';
        line1.textContent = row.title || '(제목 없음)';

        const line2 = document.createElement('div');
        line2.className = 'm-line2';
        const spanViews = document.createElement('span');
        spanViews.textContent = `조회 ${row.view_count ?? 0}`;
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

        // 작성시각
        const tdTime = document.createElement('td');
        tdTime.className = 'cell-time';
        tdTime.textContent = this.formatDateTime(row.created_at);
        tr.appendChild(tdTime);

        // 클릭 시 (나중에) 읽기 뷰로 연결할 수 있도록 id 저장
        tr.dataset.id = row.id;
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', () => {
          // TODO: 이후 단계에서 readView 구현
          alert('읽기 화면은 다음 단계에서 연결합니다.\n\n제목: ' + (row.title || ''));
        });

        // 공지글 표시 (있으면)
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

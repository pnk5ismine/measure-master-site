// /js/reviews-ui.js
// Reviews page UI: list + read + write + image upload + comments
// ⚠️ Supabase client 는 index.html / mm-auth.js 에서 만든 것을 재사용합니다.

(function (global) {
  const MMReviews = {
    supabase: null,
    user: null,
    bucketName: 'review_images', // Supabase Storage 버킷 이름

    // 🔹 새로 추가: 여러 번 선택된 파일을 누적해서 관리
    selectedFiles: [],

    // ========= 초기화 =========
    /**
     * @param {object} supabaseClient  - mmAuth에서 넘겨준 Supabase client
     * @param {object|null} currentUser - 현재 로그인 유저(or null)
     */
    async init(supabaseClient, currentUser) {
      console.log(
        '[MMReviews] init called. client:',
        !!supabaseClient,
        'user:',
        !!currentUser
      );

      // 1) 우선 caller에서 넘겨준 client 사용
      if (supabaseClient && supabaseClient.auth) {
        this.supabase = supabaseClient;
      }
      // 2) 혹시 없으면 mmAuth.supabase 재사용
      else if (global.mmAuth && global.mmAuth.supabase) {
        this.supabase = global.mmAuth.supabase;
      }

      if (!this.supabase) {
        console.error('[MMReviews] No Supabase client available.');
        return;
      }

      this.user = currentUser || null;

      this.cacheDom();
      this.bindLightbox();       // (옵션) 나중에 쓸 수 있게 준비
      this.setupComposeButton(); // "Write a review" 버튼
      this.setupWriteForm();     // 쓰기 폼 + 이미지 업로드
      this.applyAuthHint();      // "로그인 필요" 안내

      await this.loadList();     // 목록 먼저 로드
      this.handleInitialViewFromQuery(); // ?compose=1 등 처리
    },

    // ========= DOM 캐시 =========
    cacheDom() {
      this.$listBody       = document.getElementById('listBody');
      this.$listView       = document.getElementById('listView');
      this.$readView       = document.getElementById('readView');
      this.$writeForm      = document.getElementById('writeForm');
      this.$listLoginHint  = document.getElementById('listLoginHint');
      this.$btnCompose     = document.getElementById('btn-compose');
      this.$formStatus     = document.getElementById('formStatus');
      this.$inputTitle     = document.getElementById('title');
      this.$inputContent   = document.getElementById('content');
      this.$fileInput      = document.getElementById('image');
      this.$selectPreviews = document.getElementById('selectPreviews');

      if (!this.$listBody) {
        console.error('[MMReviews] #listBody not found.');
      }
    },

    // ========= 로그인 안내 문구 =========
    applyAuthHint() {
      if (!this.$listLoginHint) return;

      if (this.user) {
        this.$listLoginHint.textContent =
          'Logged in as ' + (this.user.email || '') + '. You can write a review.';
      } else {
        this.$listLoginHint.textContent =
          'To write a review, please sign up / log in on the home page.';
      }
    },

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

    // ========= URL 파라미터(글쓰기 바로 열기 등) =========
    handleInitialViewFromQuery() {
      const params  = new URLSearchParams(window.location.search);
      const compose = params.get('compose');

      if (compose === '1' || compose === 'true') {
        if (this.user) {
          this.showWriteView();
        } else {
          this.showListView();
        }
      } else {
        this.showListView();
      }
    },

    // ========= View 전환 =========
    showListView() {
      if (this.$listView)  this.$listView.hidden  = false;
      if (this.$readView)  this.$readView.hidden  = true;
      if (this.$writeForm) this.$writeForm.hidden = true;
    },

    async showReadView(reviewId) {
      if (this.$listView)  this.$listView.hidden  = true;
      if (this.$writeForm) this.$writeForm.hidden = true;
      if (this.$readView)  this.$readView.hidden  = false;
      await this.loadReview(reviewId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    showWriteView() {
      if (this.$listView)  this.$listView.hidden  = true;
      if (this.$readView)  this.$readView.hidden  = true;
      if (this.$writeForm) this.$writeForm.hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    // ========= “Write a review” 버튼 =========
    setupComposeButton() {
      if (!this.$btnCompose) return;

      this.$btnCompose.addEventListener('click', (e) => {
        e.preventDefault();

        if (!this.user) {
          alert('Please log in on the home page before writing a review.');
          return;
        }
        this.showWriteView();
      });
    },

// ========= 파일 미리보기(작성 폼) =========
setupFilePreview() {
  if (!this.$fileInput || !this.$selectPreviews) return;

  const maxFiles = Number(this.$fileInput.dataset.max || '6') || 6;

  this.$fileInput.addEventListener('change', () => {
    if (!this.$fileInput.files) return;

    const newlySelected = Array.from(this.$fileInput.files);

    // 1) 기존 선택 + 새로 선택한 파일을 합침
    const merged = (this.selectedFiles || []).concat(newlySelected);

    // 2) 최대 maxFiles 개까지만 유지
    this.selectedFiles = merged.slice(0, maxFiles);

    // 3) 미리보기 다시 그리기
    this.$selectPreviews.innerHTML = '';
    this.selectedFiles.forEach((f) => {
      const url = URL.createObjectURL(f);
      const wrap = document.createElement('div');
      wrap.className = 'thumb-card';

      const img = document.createElement('img');
      img.className = 'thumb-img';
      img.src = url;
      img.alt = f.name;

      wrap.appendChild(img);
      this.$selectPreviews.appendChild(wrap);
    });

    if (merged.length > maxFiles) {
      alert('You can attach up to ' + maxFiles + ' images.');
    }

    // 같은 파일을 다시 선택할 수 있도록 value를 비워 둠
    this.$fileInput.value = '';
  });
},

    // ========= 쓰기 폼(텍스트 + 이미지 업로드) =========
    setupWriteForm() {
      if (!this.$writeForm) return;

      this.setupFilePreview();

      this.$writeForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!this.user) {
          alert('Please log in on the home page before writing a review.');
          return;
        }

        const title   = (this.$inputTitle?.value || '').trim();
        const content = (this.$inputContent?.value || '').trim();

        if (!title) {
          alert('Please enter a title.');
          return;
        }
        if (!content) {
          alert('Please enter the content.');
          return;
        }

        if (this.$formStatus) {
          this.$formStatus.textContent = 'Saving...';
        }

        const nickname =
          (this.user.email && this.user.email.split('@')[0]) || 'tester';
        const author_email = this.user.email || null;

        // 1) 우선 reviews 에 텍스트 글 저장
        let insertedReview = null;
        {
          const { data, error } = await this.supabase
            .from('reviews')
            .insert({
              title,
              content,
              nickname,
              author_email,
              author_id: this.user.id
            })
            .select()
            .single();

          if (error) {
            console.error(
              '[MMReviews] insert review error:',
              error,
              error?.message,
              error?.code,
              JSON.stringify(error, null, 2)
            );
            if (this.$formStatus) {
              this.$formStatus.textContent =
                'Failed to save the review: ' + (error.message || 'Unknown error');
            }
            return;
          }
          insertedReview = data;
        }

        // 2) 이미지 파일이 있다면 Storage + review_imginfo 테이블에 저장
        try {
          await this.uploadAttachments(insertedReview.id);
        } catch (e2) {
          console.error('[MMReviews] uploadAttachments exception:', e2);
          // 이미지 업로드 실패해도 글 자체는 저장된 상태이니, 에러만 로그로 남깁니다.
        }

        if (this.$formStatus) {
          this.$formStatus.textContent = 'Review saved.';
        }
        // 폼 비우기
        if (this.$inputTitle)     this.$inputTitle.value     = '';
        if (this.$inputContent)   this.$inputContent.value   = '';
        if (this.$fileInput)      this.$fileInput.value      = '';
        if (this.$selectPreviews) this.$selectPreviews.innerHTML = '';

        // 다시 목록 모드로
        this.showListView();
        await this.loadList();
      });
    },

// ========= 첨부 이미지 업로드 =========
async uploadAttachments(reviewId) {
  // 1) selectedFiles 배열에 쌓인 파일 우선 사용
  let files = Array.isArray(this.selectedFiles) ? this.selectedFiles : [];

  // 혹시 그래도 비어 있으면(옛날 방식 대비) file input에서 가져오기
  if ((!files || files.length === 0) && this.$fileInput?.files?.length) {
    files = Array.from(this.$fileInput.files);
  }

  if (!files || files.length === 0) {
    return; // 업로드할 파일 없음
  }

  const maxFiles = Number(this.$fileInput?.dataset.max || '6') || 6;
  const selected = files.slice(0, maxFiles);

  for (let i = 0; i < selected.length; i++) {
    const f = selected[i];

    // 확장자 정리
    const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
    const safeExt = ext.replace(/[^a-z0-9]/gi, '') || 'jpg';

    // 예: <reviewId>/1700000000000_0.jpg
    const path = `${reviewId}/${Date.now()}_${i}.${safeExt}`;

    // 2-1) Storage 버킷에 업로드
    const { data: uploadData, error: uploadErr } = await this.supabase
      .storage
      .from(this.bucketName)   // 'review_images'
      .upload(path, f, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadErr) {
      console.error('[MMReviews] upload failed:', f.name, uploadErr);
      continue;
    }

    // 2-2) 퍼블릭 URL 얻기
    const { data: urlData } = this.supabase
      .storage
      .from(this.bucketName)
      .getPublicUrl(path);

    const publicUrl = urlData && urlData.publicUrl ? urlData.publicUrl : null;
    console.log('[MMReviews] upload ok:', f.name, '→', path, 'url=', publicUrl);

    // 2-3) review_imginfo 테이블에 기록
    const { error: imgErr } = await this.supabase
      .from('review_imginfo')
      .insert({
        review_id: reviewId,
        storage_path: path,
        public_url: publicUrl,
        original_name: f.name
      });

    if (imgErr) {
      console.error('[MMReviews] insert review_imginfo error:', imgErr);
    }
  }

  // 업로드 끝난 후 상태 정리
  this.selectedFiles = [];
  if (this.$fileInput) this.$fileInput.value = '';
  if (this.$selectPreviews) this.$selectPreviews.innerHTML = '';
}

    // ========= 목록 로드 =========
    async loadList() {
      if (!this.$listBody) return;

      this.$listBody.innerHTML = '';
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 5;
      td.textContent = 'Loading reviews…';
      tr.appendChild(td);
      this.$listBody.appendChild(tr);

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

        // 본문 (목록에서 1~2줄 요약)
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

        // 작성시각
        const tdTime = document.createElement('td');
        tdTime.className = 'cell-time';
        tdTime.textContent = this.formatDateTime(row.created_at);
        tr.appendChild(tdTime);

        // 클릭 시 읽기뷰 열기
        tr.dataset.id = row.id;
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', () => {
          this.showReadView(row.id);
        });

        if (row.is_notice) {
          tr.classList.add('notice');
        }

        this.$listBody.appendChild(tr);
      });
    },

    // ========= 단일 리뷰 + 이미지 + 댓글 로드 =========
    async loadReview(reviewId) {
      if (!this.$readView) return;

      this.$readView.innerHTML = 'Loading…';

      // 1) 본문
      const { data: review, error } = await this.supabase
        .from('reviews')
        .select('*')
        .eq('id', reviewId)
        .single();

      if (error || !review) {
        console.error('[MMReviews] loadReview error:', error);
        this.$readView.textContent =
          'Failed to load the review: ' + (error?.message || 'Unknown error');
        return;
      }

      // 2) 첨부 이미지들
      const { data: images, error: imgErr } = await this.supabase
        .from('review_imginfo')
        .select('id, public_url, original_name, storage_path')
        .eq('review_id', reviewId)
        .order('id', { ascending: true });

      if (imgErr) {
        console.warn('[MMReviews] loadReview images error:', imgErr);
      }

      // 3) 화면 렌더
      this.renderReadView(review, images || []);

      // 4) 댓글 로드
      await this.loadComments(reviewId);
    },

    // ========= 읽기 화면 렌더 =========
    renderReadView(review, images) {
      const container = this.$readView;
      container.innerHTML = '';

      // 상단 액션바 (목록으로)
      const topActions = document.createElement('div');
      topActions.className = 'top-actions';
      const backBtn = document.createElement('button');
      backBtn.className = 'btn secondary';
      backBtn.type = 'button';
      backBtn.textContent = 'Back to list';
      backBtn.addEventListener('click', () => this.showListView());
      topActions.appendChild(backBtn);

      const infoSpan = document.createElement('span');
      infoSpan.className = 'muted';
      infoSpan.textContent = this.formatDateTime(review.created_at);
      topActions.appendChild(infoSpan);

      container.appendChild(topActions);

      // 제목 / 작성자 / 메타
      const h2 = document.createElement('h2');
      h2.textContent = review.title || '(No title)';
      container.appendChild(h2);

      const meta = document.createElement('p');
      meta.className = 'muted';
      const nick =
        review.nickname ||
        (review.author_email || '').split('@')[0] ||
        'anonymous';
      meta.textContent =
        `${nick} · ${this.formatDateTime(review.created_at)} · Views ${review.view_count ?? 0}`;
      container.appendChild(meta);

      // 본문
      const body = document.createElement('div');
      body.className = 'comment-body';
      body.style.whiteSpace = 'pre-wrap';
      body.textContent = review.content || '';
      container.appendChild(body);

      // 첨부 이미지 영역
      if (images && images.length > 0) {
        const imgTitle = document.createElement('h3');
        imgTitle.style.marginTop = '18px';
        imgTitle.style.fontSize = '15px';
        imgTitle.textContent = 'Attached photos';
        container.appendChild(imgTitle);

        const thumbs = document.createElement('div');
        thumbs.className = 'thumbs';

        images.forEach((imgRow) => {
          if (!imgRow.public_url) return;
          const card = document.createElement('div');
          card.className = 'thumb-card';

          const img = document.createElement('img');
          img.className = 'thumb-img';
          img.src = imgRow.public_url;
          img.alt = imgRow.original_name || '';
          img.loading = 'lazy';

          // 클릭 시 새 탭으로 크게 보기 (라이트박스 대신)
          img.addEventListener('click', () => {
            window.open(imgRow.public_url, '_blank', 'noopener');
          });

          card.appendChild(img);
          thumbs.appendChild(card);
        });

        container.appendChild(thumbs);
      }

      // 댓글 영역(비어 있는 div만 만들고, loadComments에서 채움)
      const commentsSection = document.createElement('section');
      commentsSection.className = 'comments';
      commentsSection.style.marginTop = '20px';

      const cTitle = document.createElement('h3');
      cTitle.textContent = 'Comments';
      commentsSection.appendChild(cTitle);

      const commentsList = document.createElement('div');
      commentsList.id = 'commentsList';
      commentsSection.appendChild(commentsList);

      // 댓글 쓰기 폼
      const formWrap = document.createElement('div');
      formWrap.className = 'comment-form-wrap';

      if (this.user) {
        const form = document.createElement('form');
        form.className = 'comment-form';

        const textarea = document.createElement('textarea');
        textarea.placeholder = 'Write a comment…';
        textarea.required = true;

        const btn = document.createElement('button');
        btn.type = 'submit';
        btn.className = 'btn';
        btn.textContent = 'Post';

        form.appendChild(textarea);
        form.appendChild(btn);
        formWrap.appendChild(form);

        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const text = (textarea.value || '').trim();
          if (!text) return;
          await this.submitComment(review.id, text);
          textarea.value = '';
          await this.loadComments(review.id);
        });
      } else {
        const hint = document.createElement('p');
        hint.className = 'muted';
        hint.textContent =
          'To write a comment, please log in on the home page.';
        formWrap.appendChild(hint);
      }

      commentsSection.appendChild(formWrap);
      container.appendChild(commentsSection);
    },

    // ========= 댓글 로드 =========
    async loadComments(reviewId) {
      const listEl = document.getElementById('commentsList');
      if (!listEl) return;

      listEl.innerHTML = 'Loading comments…';

      const { data, error } = await this.supabase
        .from('review_comments')
        .select('id, author_email, nickname, content, created_at')
        .eq('review_id', reviewId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[MMReviews] loadComments error:', error);
        listEl.textContent =
          'Failed to load comments: ' + (error.message || 'Unknown error');
        return;
      }

      if (!data || data.length === 0) {
        listEl.textContent = 'No comments yet.';
        return;
      }

      listEl.innerHTML = '';
      data.forEach((row) => {
        const item = document.createElement('div');
        item.className = 'comment-item';

        const head = document.createElement('div');
        head.className = 'comment-head';

        const nick =
          row.nickname ||
          (row.author_email || '').split('@')[0] ||
          'anonymous';
        const left = document.createElement('span');
        left.textContent = nick;

        const right = document.createElement('span');
        right.textContent = this.formatDateTime(row.created_at);

        head.appendChild(left);
        head.appendChild(right);

        const body = document.createElement('div');
        body.className = 'comment-body';
        body.textContent = row.content || '';

        item.appendChild(head);
        item.appendChild(body);
        listEl.appendChild(item);
      });
    },

    // ========= 댓글 쓰기 =========
    async submitComment(reviewId, text) {
      if (!this.user) {
        alert('Please log in on the home page before writing a comment.');
        return;
      }

      const nickname =
        (this.user.email && this.user.email.split('@')[0]) || 'tester';
      const author_email = this.user.email || null;

      const { error } = await this.supabase
        .from('review_comments')
        .insert({
          review_id: reviewId,
          content: text,
          author_id: this.user.id,
          author_email,
          nickname
        });

      if (error) {
        console.error('[MMReviews] submitComment error:', error);
        alert(
          'Failed to post comment: ' + (error.message || 'Unknown error')
        );
      }
    },

    // ========= (선택) 라이트박스 바인딩 틀 =========
    bindLightbox() {
      // 현재는 이미지 클릭 시 새 탭으로만 열고 있습니다.
      // 나중에 .lightbox 마크업을 붙이고 싶으면 여기서 구현하면 됩니다.
    },

    // ========= 날짜 포맷 =========
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

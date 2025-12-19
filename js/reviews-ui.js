// /js/reviews-ui.js
// Reviews page UI: list + read + write + image upload + comments + edit/delete
// Supabase client는 index.html / mm-auth.js에서 만든 것을 재사용합니다.

(function (global) {
  const MMReviews = {
    supabase: null,
    user: null,
    member: null,          // members 테이블의 내 레코드
    isAdmin: false,        // 관리자 여부
    bucketName: 'review_images', // Supabase Storage 버킷 이름
    editingReviewId: null, // 수정 중인 리뷰 id (새 글이면 null)

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

      // 1) caller에서 넘겨준 client 사용
      if (supabaseClient && supabaseClient.auth) {
        this.supabase = supabaseClient;
      }
      // 2) 없으면 mmAuth.supabase 재사용
      else if (global.mmAuth && global.mmAuth.supabase) {
        this.supabase = global.mmAuth.supabase;
      }

      if (!this.supabase) {
        console.error('[MMReviews] No Supabase client available.');
        return;
      }

      this.user = currentUser || null;
      await this.fetchMemberAndFlags();  // members / is_admin 정보

      this.cacheDom();
      this.setupGlobalClickFix();
      this.setupListClickDelegation();
      this.bindLightbox();
      this.setupComposeButton();
      this.setupWriteForm();
      this.applyAuthHint();

      await this.loadList();             // 목록 먼저
      await this.handleInitialViewFromQuery(); // ?compose=1 등 처리
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
      this.$fileInput      = document.getElementById('image');          // reviews.html의 id="image"
      this.$selectPreviews = document.getElementById('selectPreviews');
      this.$noticeField    = document.getElementById('noticeField');
      this.$isNotice       = document.getElementById('isNotice');

     if (!this.$listBody) {
        console.error('[MMReviews] #listBody not found.');
      }

      // [DEBUG] list click delegation (safe)
      if (this.$listBody && !this._clickDelegationBound) {
        this._clickDelegationBound = true;
        this.$listBody.addEventListener('click', (e) => {
          const tr = e.target.closest('tr[data-id]');
          console.log('[DEBUG] list click target:', e.target, 'tr:', tr);
          if (!tr) return;
          console.log('[DEBUG] clicked id=', tr.dataset.id);
          this.showReadView(tr.dataset.id);
        });
      }
    },

    // ========= 현재 회원(members) + admin 플래그 =========
    async fetchMemberAndFlags() {
      this.member = null;
      this.isAdmin = false;

      if (!this.supabase || !this.user) return;

      const { data, error } = await this.supabase
        .from('members')
        .select('user_id, email, nickname, is_admin')
        .eq('user_id', this.user.id)
        .maybeSingle();

      if (error) {
        console.warn('[MMReviews] fetchMemberAndFlags error:', error);
        return;
      }

      if (data) {
        this.member = data;
        this.isAdmin = !!data.is_admin;
      }
    },

    // ========= 로그인 안내 문구 =========
    applyAuthHint() {
      if (!this.$listLoginHint) return;

      if (this.user) {
        const email = this.user.email || '';
        const adminLabel = this.isAdmin ? ' (admin)' : '';
        this.$listLoginHint.textContent =
          'Logged in as ' + email + adminLabel + '. You can write a review.';
      } else {
        this.$listLoginHint.textContent =
          'To write a review, please sign up / log in on the home page.';
      }
      // Notice UI (admin only)
      if (this.$noticeField) {
        this.$noticeField.style.display = this.isAdmin ? 'block' : 'none';
      }
      if (this.$isNotice) {
        this.$isNotice.checked = false;
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
      await this.fetchMemberAndFlags();
      this.applyAuthHint();
      return this.user;
    },

    // ========= URL 파라미터(글쓰기 바로 열기 등) =========
   async handleInitialViewFromQuery() {
     const params  = new URLSearchParams(window.location.search);
     const id      = params.get('id');
     const compose = params.get('compose');

     // ✅ 1) id가 있으면 무조건 읽기 뷰로
     if (id) {
       await this.showReadView(id);
       return;
     }

     // ✅ 2) compose 처리(기존 로직)
     if (compose === '1' || compose === 'true') {
       if (this.user) this.showWriteView();
       else this.showListView();
     } else {
       this.showListView();
     }
   }

    // ========= 이 리뷰를 수정/삭제할 수 있는지? =========
    canEditReview(review) {
      if (!this.user || !review) return false;
      if (this.isAdmin) return true;              // 관리자면 무조건 가능
      return review.author_id === this.user.id;   // 아니면 본인 글만
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

    // ========= “글쓰기” 버튼 =========
    setupComposeButton() {
      if (!this.$btnCompose) return;

      this.$btnCompose.addEventListener('click', (e) => {
        e.preventDefault();

        if (!this.user) {
          alert('Please log in on the home page before writing a review.');
          return;
        }
        this.editingReviewId = null;  // 새 글
        if (this.$formStatus) this.$formStatus.textContent = '';
        this.showWriteView();
      });
    },

    // ========= 파일 미리보기(작성 폼) =========
    setupFilePreview() {
      if (!this.$fileInput || !this.$selectPreviews) return;

      const maxFiles = Number(this.$fileInput.dataset.max || '6') || 6;
      this.$fileInput.addEventListener('change', () => {
        const files = this.$fileInput.files;
        this.$selectPreviews.innerHTML = '';
        if (!files || files.length === 0) return;

        const n = Math.min(files.length, maxFiles);
        for (let i = 0; i < n; i++) {
          const f = files[i];
          const url = URL.createObjectURL(f);
          const wrap = document.createElement('div');
          wrap.className = 'thumb-card';
          const img = document.createElement('img');
          img.className = 'thumb-img';
          img.src = url;
          img.alt = f.name;
          wrap.appendChild(img);
          this.$selectPreviews.appendChild(wrap);
        }

        if (files.length > maxFiles) {
          alert('You can attach up to ' + maxFiles + ' images.');
        }
      });
    },
    // ========= 리스트 클릭(이벤트 위임) =========
    setupListClickDelegation() {
      if (!this.$listBody) return;
      if (this._listClickBound) return;
      this._listClickBound = true;

      this.$listBody.addEventListener('click', (e) => {
        const tr = e.target.closest('tr[data-id]');
        if (!tr) return;

        const id = tr.dataset.id;
        console.log('[MMReviews] click delegated id=', id);


        this.showReadView(id);
      });
    },

    // ========= 수정 모드 시작 =========
    startEditReview(review) {
      if (!this.$writeForm) return;
      if (!this.canEditReview(review)) {
        alert('You are not allowed to edit this review.');
        return;
      }

      this.editingReviewId = review.id;

      if (this.$inputTitle)   this.$inputTitle.value   = review.title || '';
      if (this.$inputContent) this.$inputContent.value = review.content || '';

      if (this.$fileInput) this.$fileInput.value = '';
      if (this.$selectPreviews) this.$selectPreviews.innerHTML = '';

      if (this.$formStatus) {
        this.$formStatus.textContent =
          'Editing existing review. Saving will update this post.';
      }

      this.showWriteView();
    },

    // ========= 리뷰 삭제 =========
    async deleteReview(review) {
      if (!this.supabase || !review) return;
      if (!this.canEditReview(review)) {
        alert('You are not allowed to delete this review.');
        return;
      }

      const ok = window.confirm('Delete this review? This cannot be undone.');
      if (!ok) return;

      const { error } = await this.supabase
        .from('reviews')
        .delete()
        .eq('id', review.id);

      if (error) {
        console.error('[MMReviews] deleteReview error:', error);
        alert('Failed to delete the review: ' + (error.message || 'Unknown error'));
        return;
      }

      alert('Review deleted.');
      this.editingReviewId = null;
      this.showListView();
      await this.loadList();
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
        const is_notice = !!(this.isAdmin && this.$isNotice && this.$isNotice.checked);

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

        const isEdit = !!this.editingReviewId;
        let reviewId = this.editingReviewId || null;
        let savedReview = null;

        if (isEdit) {
          // ----- UPDATE -----
          const { data, error } = await this.supabase
            .from('reviews')
            .update({
              title,
              content,
              nickname,
              author_email,
              is_notice
            })
            .eq('id', reviewId)
            .select()
            .single();

          if (error) {
            console.error('[MMReviews] update review error:', error);
            if (this.$formStatus) {
              this.$formStatus.textContent =
                'Failed to update the review: ' + (error.message || 'Unknown error');
            }
            return;
          }
          savedReview = data;
          reviewId = data.id;
        } else {
          // ----- INSERT -----
          const { data, error } = await this.supabase
            .from('reviews')
            .insert({
              title,
              content,
              nickname,
              author_email,
              author_id: this.user.id,
              is_notice
            })
            .select()
            .single();

          if (error) {
            console.error('[MMReviews] insert review error:', error);
            if (this.$formStatus) {
              this.$formStatus.textContent =
                'Failed to save the review: ' + (error.message || 'Unknown error');
            }
            return;
          }
          savedReview = data;
          reviewId = data.id;
        }

        // 첨부 이미지 업로드 (편집 시에는 "추가"로 동작)
        try {
          await this.uploadAttachments(reviewId);
        } catch (e2) {
          console.error('[MMReviews] uploadAttachments exception:', e2);
        }

        if (this.$formStatus) {
          this.$formStatus.textContent = isEdit ? 'Review updated.' : 'Review saved.';
        }

        this.editingReviewId = null;
        if (this.$inputTitle)   this.$inputTitle.value   = '';
        if (this.$inputContent) this.$inputContent.value = '';
        if (this.$fileInput)    this.$fileInput.value    = '';
        if (this.$selectPreviews) this.$selectPreviews.innerHTML = '';

        this.showListView();
        await this.loadList();
      });
    },

    // ========= 첨부 이미지 업로드 =========
    async uploadAttachments(reviewId) {
      if (!this.$fileInput || !this.$fileInput.files || this.$fileInput.files.length === 0) {
        return;
      }

      const files    = Array.from(this.$fileInput.files);
      const maxFiles = Number(this.$fileInput.dataset.max || '6') || 6;
      const selected = files.slice(0, maxFiles);

      for (let i = 0; i < selected.length; i++) {
        const f = selected[i];

        const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
        const safeExt = ext.replace(/[^a-z0-9]/gi, '') || 'jpg';

        const path = `${reviewId}/${Date.now()}_${i}.${safeExt}`;

        const { data: uploadData, error: uploadErr } = await this.supabase
          .storage
          .from(this.bucketName)
          .upload(path, f, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadErr) {
          console.error('[MMReviews] upload failed:', f.name, uploadErr);
          continue;
        }

        const { data: urlData } = this.supabase
          .storage
          .from(this.bucketName)
          .getPublicUrl(path);

        const publicUrl =
          urlData && urlData.publicUrl ? urlData.publicUrl : null;

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
    },

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

      console.log('[MMReviews] loadList result:', { data, error });

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

        const tdNo = document.createElement('td');
        tdNo.className = 'cell-no';
        tdNo.textContent = String(idx + 1);
        tr.appendChild(tdNo);

        const tdNick = document.createElement('td');
        tdNick.className = 'cell-nick';
        tdNick.textContent = row.nickname || '-';
        tr.appendChild(tdNick);

        const tdBody = document.createElement('td');
        tdBody.className = 'cell-body';

        // Title row (badge + title)
        const titleRow = document.createElement('div');
        titleRow.style.display = 'flex';
        titleRow.style.alignItems = 'center';
        titleRow.style.gap = '8px';
        titleRow.style.minWidth = '0'; // for ellipsis

        // Notice badge (only for notice posts)
        if (row.is_notice) {
          const badge = document.createElement('span');
          badge.className = 'notice-badge';
          badge.textContent = 'Notice';
          titleRow.appendChild(badge);
        }

        // Title (1 line)
        const titleDiv = document.createElement('div');
        titleDiv.className = 'list-title';
        titleDiv.textContent = row.title || '(No title)';
        titleDiv.style.minWidth = '0';
        titleRow.appendChild(titleDiv);

        // Preview (content, 2 lines via CSS)
        const previewDiv = document.createElement('div');
        previewDiv.className = 'list-preview';
        const previewText = (row.content || '').replace(/\s+/g, ' ').trim();
        previewDiv.textContent = previewText || '';

        // Mobile meta (optional; shows when other columns hidden)
        const metaDiv = document.createElement('div');
        metaDiv.className = 'list-meta';
        metaDiv.innerHTML = `<span>Views ${row.view_count ?? 0}</span><span>${this.formatDate(row.created_at)}</span>`;

// 링크로 감싸서 클릭이 무조건 동작하게
const link = document.createElement('a');
link.className = 'row-link';
link.href = `/reviews.html?id=${encodeURIComponent(row.id)}`;

        link.appendChild(titleRow);
        link.appendChild(previewDiv);
        link.appendChild(metaDiv);

        tdBody.appendChild(link);
        tr.appendChild(tdBody);

        if (row.is_notice) {
          tr.classList.add('notice');
        }

        this.$listBody.appendChild(tr);
      });
    },

    setupGlobalClickFix() {
      if (this._globalClickFixBound) return;
      this._globalClickFixBound = true;

      document.addEventListener('click', (e) => {
        const tr = e.target.closest('tr[data-id]');
        if (!tr) return;
        const id = tr.dataset.id;
        console.log('[DEBUG] GLOBAL click ->', id);
        if (!id) return;
        this.showReadView(id);
      }, true); // capture
    },


    // ========= 단일 리뷰 + 이미지 + 댓글 로드 =========
    async loadReview(reviewId) {
      if (!this.$readView) return;

      this.$readView.innerHTML = 'Loading…';

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

      const { data: images, error: imgErr } = await this.supabase
        .from('review_imginfo')
        .select('id, public_url, original_name, storage_path')
        .eq('review_id', reviewId)
        .order('id', { ascending: true });

      if (imgErr) {
        console.warn('[MMReviews] loadReview images error:', imgErr);
      }

      this.renderReadView(review, images || []);
      await this.loadComments(reviewId);
    },

    // ========= 읽기 화면 렌더 =========
    renderReadView(review, images) {
      const container = this.$readView;
      container.innerHTML = '';

      const canEdit = this.canEditReview(review);

      const topActions = document.createElement('div');
      topActions.className = 'top-actions';

      const leftBox = document.createElement('div');
      leftBox.style.display = 'flex';
      leftBox.style.alignItems = 'center';
      leftBox.style.gap = '8px';

      const backBtn = document.createElement('button');
      backBtn.className = 'btn secondary';
      backBtn.type = 'button';
      backBtn.textContent = 'Back to list';

      backBtn.addEventListener('click', () => {
        try { history.pushState({}, '', '/reviews.html'); } catch(e) {}
        this.showListView();
      });

      leftBox.appendChild(backBtn);

      const infoSpan = document.createElement('span');
      infoSpan.className = 'muted';
      infoSpan.textContent = this.formatDateTime(review.created_at);
      leftBox.appendChild(infoSpan);

      topActions.appendChild(leftBox);

      if (canEdit) {
        const rightBox = document.createElement('div');
        rightBox.style.display = 'flex';
        rightBox.style.gap = '8px';

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn secondary';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => this.startEditReview(review));

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn';
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', () => this.deleteReview(review));

        rightBox.appendChild(editBtn);
        rightBox.appendChild(delBtn);
        topActions.appendChild(rightBox);
      }

      container.appendChild(topActions);

      const h2 = document.createElement('h2');
      h2.textContent = review.title || '(No title)';
      container.appendChild(h2);

      const meta = document.createElement('p');
      meta.className = 'muted';
      const nick = review.nickname ||
        (review.author_email || '').split('@')[0] || 'anonymous';
      meta.textContent =
        `${nick} · ${this.formatDateTime(review.created_at)} · Views ${review.view_count ?? 0}`;
      container.appendChild(meta);

      const body = document.createElement('div');
      body.className = 'comment-body';
      body.style.whiteSpace = 'pre-wrap';
      body.textContent = review.content || '';
      container.appendChild(body);

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

          img.addEventListener('click', () => {
            window.open(imgRow.public_url, '_blank', 'noopener');
          });

          card.appendChild(img);
          thumbs.appendChild(card);
        });

        container.appendChild(thumbs);
      }

      const commentsSection = document.createElement('section');
      commentsSection.className = 'comments';
      commentsSection.style.marginTop = '20px';

      const cTitle = document.createElement('h3');
      cTitle.textContent = 'Comments';
      commentsSection.appendChild(cTitle);

      const commentsList = document.createElement('div');
      commentsList.id = 'commentsList';
      commentsSection.appendChild(commentsList);

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

        const nick = row.nickname ||
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

// /js/reviews-ui.js

(function (global) {
  const MMReviews = {
    supabase: null,
    user: null,
    member: null,
    isAdmin: false,
    bucketName: 'review_images',
    editingReviewId: null,

    // ✅ 여기서 admin 이메일을 고정 (원하면 변경)
    ADMIN_EMAIL: 'pnk506@gmail.com',

    async init(supabaseClient, currentUser) {
      console.log('[MMReviews] init called. client:', !!supabaseClient, 'user:', !!currentUser);

      if (supabaseClient && supabaseClient.auth) this.supabase = supabaseClient;
      else if (global.mmAuth && global.mmAuth.supabase) this.supabase = global.mmAuth.supabase;

      if (!this.supabase) {
        console.error('[MMReviews] No Supabase client available.');
        return;
      }

      this.user = currentUser || null;

      this.cacheDom();
      await this.fetchMemberAndFlags();
      this.applyAuthHint();

      this.setupListClickDelegation();
      this.setupComposeButton();
      this.setupWriteForm();

      await this.loadList();
      await this.handleInitialViewFromQuery();

      window.addEventListener('popstate', async () => {
        await this.handleInitialViewFromQuery();
      });
    },

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
      this.$noticeField    = document.getElementById('noticeField');
      this.$isNotice       = document.getElementById('isNotice');
      this.$btnCancelWrite = document.getElementById('btn-cancel-write');

      if (!this.$listBody) console.error('[MMReviews] #listBody not found.');
    },

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
        // ✅ members.is_admin OR email match
        this.isAdmin = !!data.is_admin || ((this.user.email || '').toLowerCase() === this.ADMIN_EMAIL.toLowerCase());
      } else {
        // ✅ fallback: email match
        this.isAdmin = ((this.user.email || '').toLowerCase() === this.ADMIN_EMAIL.toLowerCase());
      }
    },

    applyAuthHint() {
      if (this.$listLoginHint) {
        if (this.user) {
          const email = this.user.email || '';
          const adminLabel = this.isAdmin ? ' (admin)' : '';
          this.$listLoginHint.textContent = 'Logged in as ' + email + adminLabel + '. You can write a review.';
        } else {
          this.$listLoginHint.textContent = 'To write a review, please sign up / log in on the home page.';
        }
      }

      if (this.$noticeField) this.$noticeField.style.display = this.isAdmin ? 'block' : 'none';
      if (this.$isNotice) this.$isNotice.checked = false;
    },

    // ========= URL handling =========
    async handleInitialViewFromQuery() {
      const params  = new URLSearchParams(window.location.search);
      const id      = params.get('id');
      const compose = params.get('compose');

      if (id) {
        await this.showReadView(id);
        return;
      }
      if (compose === '1' || compose === 'true') {
        if (this.user) this.showWriteView();
        else this.showListView();
        return;
      }
      this.showListView();
    },

    canEditReview(review) {
      if (!this.user || !review) return false;
      if (this.isAdmin) return true;
      return review.author_id === this.user.id;
    },

    showListView() {
      if (this.$listView)  this.$listView.hidden  = false;
      if (this.$readView)  this.$readView.hidden  = true;
      if (this.$writeForm) this.$writeForm.hidden = true;
      if (this.$readView)  this.$readView.classList.remove('notice-read');
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

    setupListClickDelegation() {
      if (!this.$listBody || this._listClickBound) return;
      this._listClickBound = true;

      this.$listBody.addEventListener('click', async (e) => {
        const tr = e.target.closest('tr[data-id]');
        if (!tr) return;

        const a = e.target.closest('a.row-link');
        if (a) e.preventDefault();

        const id = tr.dataset.id;
        if (!id) return;

        try { history.pushState({}, '', `/reviews.html?id=${encodeURIComponent(id)}`); } catch (err) {}
        await this.showReadView(id);
      });
    },

    setupComposeButton() {
      if (!this.$btnCompose || this._composeBound) return;
      this._composeBound = true;

      this.$btnCompose.addEventListener('click', (e) => {
        e.preventDefault();

        if (!this.user) {
          alert('Please log in on the home page before writing a review.');
          return;
        }

        this.editingReviewId = null;
        if (this.$formStatus) this.$formStatus.textContent = '';
        if (this.$inputTitle) this.$inputTitle.value = '';
        if (this.$inputContent) this.$inputContent.value = '';
        if (this.$fileInput) this.$fileInput.value = '';
        if (this.$selectPreviews) this.$selectPreviews.innerHTML = '';
        if (this.$isNotice) this.$isNotice.checked = false;

        try { history.pushState({}, '', '/reviews.html?compose=1'); } catch (err) {}
        this.showWriteView();
      });

      if (this.$btnCancelWrite && !this._cancelBound) {
        this._cancelBound = true;
        this.$btnCancelWrite.addEventListener('click', (e) => {
          e.preventDefault();
          this.editingReviewId = null;
          try { history.pushState({}, '', '/reviews.html'); } catch (err) {}
          this.showListView();
        });
      }
    },

    setupFilePreview() {
      if (!this.$fileInput || !this.$selectPreviews || this._filePreviewBound) return;
      this._filePreviewBound = true;

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

        if (files.length > maxFiles) alert('You can attach up to ' + maxFiles + ' images.');
      });
    },

    setupWriteForm() {
      if (!this.$writeForm || this._writeBound) return;
      this._writeBound = true;

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

        if (!title) return alert('Please enter a title.');
        if (!content) return alert('Please enter the content.');

        if (this.$formStatus) this.$formStatus.textContent = 'Saving...';

        // ✅ admin 닉네임 완전 고정
        const nickname = this.isAdmin ? 'admin'
          : ((this.user.email && this.user.email.split('@')[0]) || 'tester');

        const author_email = this.user.email || null;

        const isEdit = !!this.editingReviewId;
        let reviewId = this.editingReviewId || null;

        if (isEdit) {
          const { data, error } = await this.supabase
            .from('reviews')
            .update({ title, content, nickname, author_email, is_notice })
            .eq('id', reviewId)
            .select()
            .single();

          if (error || !data) {
            console.error('[MMReviews] update review error:', error);
            if (this.$formStatus) this.$formStatus.textContent =
              'Failed to update the review: ' + (error?.message || 'Unknown error');
            return;
          }
          reviewId = data.id;
        } else {
          const { data, error } = await this.supabase
            .from('reviews')
            .insert({ title, content, nickname, author_email, author_id: this.user.id, is_notice })
            .select()
            .single();

          if (error || !data) {
            console.error('[MMReviews] insert review error:', error);
            if (this.$formStatus) this.$formStatus.textContent =
              'Failed to save the review: ' + (error?.message || 'Unknown error');
            return;
          }
          reviewId = data.id;
        }

        try { await this.uploadAttachments(reviewId); } catch (err) { console.error(err); }

        if (this.$formStatus) this.$formStatus.textContent = isEdit ? 'Review updated.' : 'Review saved.';

        this.editingReviewId = null;
        if (this.$inputTitle) this.$inputTitle.value = '';
        if (this.$inputContent) this.$inputContent.value = '';
        if (this.$fileInput) this.$fileInput.value = '';
        if (this.$selectPreviews) this.$selectPreviews.innerHTML = '';
        if (this.$isNotice) this.$isNotice.checked = false;

        try { history.pushState({}, '', '/reviews.html'); } catch (err) {}
        this.showListView();
        await this.loadList();
      });
    },

    async uploadAttachments(reviewId) {
      if (!this.$fileInput || !this.$fileInput.files || this.$fileInput.files.length === 0) return;

      const files = Array.from(this.$fileInput.files);
      const maxFiles = Number(this.$fileInput.dataset.max || '6') || 6;
      const selected = files.slice(0, maxFiles);

      for (let i = 0; i < selected.length; i++) {
        const f = selected[i];
        const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
        const safeExt = ext.replace(/[^a-z0-9]/gi, '') || 'jpg';
        const path = `${reviewId}/${Date.now()}_${i}.${safeExt}`;

        const { error: uploadErr } = await this.supabase
          .storage
          .from(this.bucketName)
          .upload(path, f, { cacheControl: '3600', upsert: false });

        if (uploadErr) {
          console.error('[MMReviews] upload failed:', f.name, uploadErr);
          continue;
        }

        const { data: urlData } = this.supabase
          .storage
          .from(this.bucketName)
          .getPublicUrl(path);

        const publicUrl = urlData?.publicUrl || null;

        const { error: imgErr } = await this.supabase
          .from('review_imginfo')
          .insert({ review_id: reviewId, storage_path: path, public_url: publicUrl, original_name: f.name });

        if (imgErr) console.error('[MMReviews] insert review_imginfo error:', imgErr);
      }
    },

    async loadList() {
      if (!this.$listBody) return;

      this.$listBody.innerHTML = '';
      const tr0 = document.createElement('tr');
      const td0 = document.createElement('td');
      td0.colSpan = 5;
      td0.textContent = 'Loading reviews…';
      tr0.appendChild(td0);
      this.$listBody.appendChild(tr0);

      // ✅ author_email까지 가져와서 "admin" 표기 안정화
      const { data, error } = await this.supabase
        .from('reviews')
        .select('id, title, content, nickname, author_email, view_count, created_at, is_notice')
        .order('is_notice', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[MMReviews] Failed to load list:', error);
        td0.textContent = 'Failed to load the list: ' + (error.message || 'Unknown error');
        return;
      }

      if (!data || data.length === 0) {
        td0.textContent = 'No reviews have been posted yet.';
        return;
      }

      this.$listBody.innerHTML = '';

      data.forEach((row, idx) => {
        const tr = document.createElement('tr');
        tr.dataset.id = row.id;
        tr.style.cursor = 'pointer';

        const isAdminAuthor = ((row.author_email || '').toLowerCase() === this.ADMIN_EMAIL.toLowerCase());
        const isNotice = !!row.is_notice;

        if (isNotice) tr.classList.add('notice');

        const tdNo = document.createElement('td');
        tdNo.className = 'cell-no';
        tdNo.textContent = String(idx + 1);
        tr.appendChild(tdNo);

        const tdNick = document.createElement('td');
        tdNick.className = 'cell-nick';
        tdNick.textContent = isAdminAuthor ? 'admin' : (row.nickname || '-');
        tr.appendChild(tdNick);

        const tdBody = document.createElement('td');
        tdBody.className = 'cell-body';

        const link = document.createElement('a');
        link.className = 'row-link';
        link.href = `/reviews.html?id=${encodeURIComponent(row.id)}`;

        const titleRow = document.createElement('div');
        titleRow.className = 'title-row';

        if (isNotice) {
          const badge = document.createElement('span');
          badge.className = 'notice-badge';
          badge.textContent = 'Notice';
          // ✅ 혹시 CSS가 밀려도 보이게 인라인 강제
          badge.style.background = '#dbeafe';
          badge.style.border = '1px solid #93c5fd';
          badge.style.color = '#1d4ed8';
          titleRow.appendChild(badge);
        }

        const titleDiv = document.createElement('div');
        titleDiv.className = 'list-title';
        titleDiv.textContent = row.title || '(No title)';
        titleRow.appendChild(titleDiv);

        const previewDiv = document.createElement('div');
        previewDiv.className = 'list-preview';
        const previewText = (row.content || '').replace(/\s+/g, ' ').trim();
        previewDiv.textContent = previewText;

        const metaDiv = document.createElement('div');
        metaDiv.className = 'list-meta';
        metaDiv.innerHTML = `<span>Views ${row.view_count ?? 0}</span><span>${this.formatDate(row.created_at)}</span>`;

        // ✅ 공지: 제목/프리뷰/메타(날짜 포함) 모두 파랑 (CSS+인라인 이중)
        if (isNotice) {
          titleDiv.style.color = '#1d4ed8';
          previewDiv.style.color = '#1d4ed8';
          metaDiv.style.color = '#1d4ed8';
        }

        link.appendChild(titleRow);
        link.appendChild(previewDiv);
        link.appendChild(metaDiv);

        tdBody.appendChild(link);
        tr.appendChild(tdBody);

        const tdViews = document.createElement('td');
        tdViews.className = 'cell-stats';
        tdViews.textContent = String(row.view_count ?? 0);
        if (isNotice) tdViews.style.color = '#1d4ed8';
        tr.appendChild(tdViews);

        const tdTime = document.createElement('td');
        tdTime.className = 'cell-time';
        tdTime.textContent = this.formatDateTime(row.created_at);
        if (isNotice) tdTime.style.color = '#1d4ed8';
        tr.appendChild(tdTime);

        this.$listBody.appendChild(tr);
      });
    },

    async loadReview(reviewId) {
      if (!this.$readView) return;

      this.$readView.innerHTML = 'Loading…';
      this.$readView.classList.remove('notice-read');

      const { data: review, error } = await this.supabase
        .from('reviews')
        .select('*')
        .eq('id', reviewId)
        .single();

      if (error || !review) {
        console.error('[MMReviews] loadReview error:', error);
        this.$readView.textContent = 'Failed to load the review: ' + (error?.message || 'Unknown error');
        return;
      }

      const { data: images, error: imgErr } = await this.supabase
        .from('review_imginfo')
        .select('id, public_url, original_name, storage_path')
        .eq('review_id', reviewId)
        .order('id', { ascending: true });

      if (imgErr) console.warn('[MMReviews] loadReview images error:', imgErr);

      this.renderReadView(review, images || []);
      await this.loadComments(reviewId);
    },

    renderReadView(review, images) {
      const container = this.$readView;
      if (!container) return;

      container.innerHTML = '';
      const isNotice = !!review.is_notice;
      container.classList.toggle('notice-read', isNotice);

      const canEdit = this.canEditReview(review);
      const created = review.created_at || null;

      const isAdminAuthor = ((review.author_email || '').toLowerCase() === this.ADMIN_EMAIL.toLowerCase());
      const nick = isAdminAuthor ? 'admin'
        : (review.nickname || (review.author_email || '').split('@')[0] || 'anonymous');

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
        try { history.pushState({}, '', '/reviews.html'); } catch (e) {}
        this.showListView();
      });

      leftBox.appendChild(backBtn);

      const timeSpan = document.createElement('span');
      timeSpan.className = 'muted';
      timeSpan.textContent = created ? this.formatDateTime(created) : '';
      if (isNotice) timeSpan.style.color = '#1d4ed8';
      leftBox.appendChild(timeSpan);

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
        delBtn.className = 'btn danger';
        delBtn.textContent = 'Delete';
        delBtn.addEventListener('click', () => this.deleteReview(review));

        rightBox.appendChild(editBtn);
        rightBox.appendChild(delBtn);
        topActions.appendChild(rightBox);
      }

      container.appendChild(topActions);

      if (isNotice) {
        const badge = document.createElement('span');
        badge.className = 'notice-badge';
        badge.textContent = 'Notice';
        badge.style.background = '#dbeafe';
        badge.style.border = '1px solid #93c5fd';
        badge.style.color = '#1d4ed8';
        container.appendChild(badge);
      }

      const h2 = document.createElement('h2');
      h2.textContent = review.title || '(No title)';
      if (isNotice) h2.style.color = '#1d4ed8';
      container.appendChild(h2);

      const meta = document.createElement('div');
      meta.className = 'read-meta';
      meta.textContent = `${nick} · ${created ? this.formatDateTime(created) : ''} · Views ${review.view_count ?? 0}`;
      if (isNotice) meta.style.color = '#1d4ed8';
      container.appendChild(meta);

      const body = document.createElement('div');
      body.className = 'read-content';
      body.textContent = review.content || '';
      if (isNotice) body.style.color = '#1d4ed8'; // ✅ 본문 파랑 강제
      container.appendChild(body);

      if (images && images.length > 0) {
        const imgTitle = document.createElement('h3');
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
      commentsSection.style.marginTop = '18px';

      const cTitle = document.createElement('h3');
      cTitle.textContent = 'Comments';
      commentsSection.appendChild(cTitle);

      const list = document.createElement('div');
      list.id = 'commentsList';
      commentsSection.appendChild(list);

      const formWrap = document.createElement('div');

      if (this.user) {
        const form = document.createElement('form');
        form.className = 'comment-form';

        const ta = document.createElement('textarea');
        ta.placeholder = 'Write a comment…';
        ta.required = true;

        const btn = document.createElement('button');
        btn.type = 'submit';
        btn.className = 'btn';
        btn.textContent = 'Post';

        form.appendChild(ta);
        form.appendChild(btn);
        formWrap.appendChild(form);

        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const text = (ta.value || '').trim();
          if (!text) return;
          await this.submitComment(review.id, text);
          ta.value = '';
          await this.loadComments(review.id);
        });
      } else {
        const hint = document.createElement('p');
        hint.className = 'muted';
        hint.textContent = 'To write a comment, please log in on the home page.';
        formWrap.appendChild(hint);
      }

      commentsSection.appendChild(formWrap);
      container.appendChild(commentsSection);
    },

    async startEditReview(review) {
      if (!this.$writeForm) return;
      if (!this.canEditReview(review)) return alert('You are not allowed to edit this review.');

      this.editingReviewId = review.id;

      if (this.$inputTitle) this.$inputTitle.value = review.title || '';
      if (this.$inputContent) this.$inputContent.value = review.content || '';
      if (this.$fileInput) this.$fileInput.value = '';
      if (this.$selectPreviews) this.$selectPreviews.innerHTML = '';
      if (this.$isNotice) this.$isNotice.checked = !!(this.isAdmin && review.is_notice);

      if (this.$formStatus) this.$formStatus.textContent = 'Editing existing review. Saving will update this post.';

      try { history.pushState({}, '', '/reviews.html?compose=1'); } catch (e) {}
      this.showWriteView();
    },

    async deleteReview(review) {
      if (!this.supabase || !review) return;
      if (!this.canEditReview(review)) return alert('You are not allowed to delete this review.');

      const ok = window.confirm('Delete this review? This cannot be undone.');
      if (!ok) return;

      const { error } = await this.supabase.from('reviews').delete().eq('id', review.id);

      if (error) {
        console.error('[MMReviews] deleteReview error:', error);
        alert('Failed to delete the review: ' + (error.message || 'Unknown error'));
        return;
      }

      alert('Review deleted.');
      this.editingReviewId = null;

      try { history.pushState({}, '', '/reviews.html'); } catch (e) {}
      this.showListView();
      await this.loadList();
    },

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
        listEl.textContent = 'Failed to load comments: ' + (error.message || 'Unknown error');
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

        const nick = row.nickname || (row.author_email || '').split('@')[0] || 'anonymous';
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

    async submitComment(reviewId, text) {
      if (!this.user) return alert('Please log in on the home page before writing a comment.');

      const nickname = this.isAdmin ? 'admin'
        : ((this.user.email && this.user.email.split('@')[0]) || 'tester');

      const author_email = this.user.email || null;

      const { error } = await this.supabase
        .from('review_comments')
        .insert({ review_id: reviewId, content: text, author_id: this.user.id, author_email, nickname });

      if (error) {
        console.error('[MMReviews] submitComment error:', error);
        alert('Failed to post comment: ' + (error.message || 'Unknown error'));
      }
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

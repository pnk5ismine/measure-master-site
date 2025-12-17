// /js/reviews-ui.js
// Reviews page: list + read + write + images + likes + comments
// Uses the SAME Supabase client as mm-auth.js (session 공유)

(function (global) {
  const MMReviews = {
    supabase: null,
    user: null,

    // 상태
    currentReview: null,
    isEditing: false,
    editingReviewId: null,
    userHasLiked: false,
    likeCount: 0,

    // DOM 캐시
    $authInfo: null,
    $listBody: null,
    $listView: null,
    $readView: null,
    $writeForm: null,
    $listLoginHint: null,
    $btnCompose: null,
    $formStatus: null,
    $writeTitleHeading: null,
    $inputTitle: null,
    $inputContent: null,
    $fileInput: null,
    $selectPreviews: null,

    $btnBackList: null,
    $btnEditReview: null,
    $btnDeleteReview: null,

    $readTitle: null,
    $readMeta: null,
    $readContent: null,
    $readImages: null,
    $readImagesGrid: null,
    $btnLike: null,
    $likeCountSpan: null,

    $commentsList: null,
    $commentForm: null,
    $commentContent: null,
    $commentStatus: null,

    /**
     * Initialize reviews module
     * @param {object} supabaseClient - Supabase client (from mmAuth)
     * @param {object|null} currentUser - logged in user (if any)
     */
    async init(supabaseClient, currentUser) {
      console.log(
        '[MMReviews] init called. client:',
        !!supabaseClient,
        'user:',
        !!currentUser
      );

      // 1) client 설정
      if (supabaseClient && supabaseClient.auth) {
        this.supabase = supabaseClient;
      } else if (global.mmAuth && global.mmAuth.supabase) {
        this.supabase = global.mmAuth.supabase;
      }

      if (!this.supabase) {
        console.error('[MMReviews] No Supabase client available.');
        return;
      }

      this.user = currentUser || null;

      this.cacheDom();
      this.bindEvents();
      this.applyAuthInfo();

      await this.loadList();
    },

    cacheDom() {
      this.$authInfo        = document.getElementById('authInfo');
      this.$listBody        = document.getElementById('listBody');
      this.$listView        = document.getElementById('listView');
      this.$readView        = document.getElementById('readView');
      this.$writeForm       = document.getElementById('writeForm');
      this.$listLoginHint   = document.getElementById('listLoginHint');
      this.$btnCompose      = document.getElementById('btn-compose');
      this.$formStatus      = document.getElementById('formStatus');
      this.$writeTitleHeading = document.getElementById('writeTitleHeading');
      this.$inputTitle      = document.getElementById('title');
      this.$inputContent    = document.getElementById('content');
      this.$fileInput       = document.getElementById('review-images');
      this.$selectPreviews  = document.getElementById('selectPreviews');

      this.$btnBackList     = document.getElementById('btn-back-list');
      this.$btnEditReview   = document.getElementById('btn-edit-review');
      this.$btnDeleteReview = document.getElementById('btn-delete-review');

      this.$readTitle       = document.getElementById('readTitle');
      this.$readMeta        = document.getElementById('readMeta');
      this.$readContent     = document.getElementById('readContent');
      this.$readImages      = document.getElementById('readImages');
      this.$readImagesGrid  = document.getElementById('readImagesGrid');
      this.$btnLike         = document.getElementById('btn-like');
      this.$likeCountSpan   = document.getElementById('likeCount');

      this.$commentsList    = document.getElementById('commentsList');
      this.$commentForm     = document.getElementById('commentForm');
      this.$commentContent  = document.getElementById('commentContent');
      this.$commentStatus   = document.getElementById('commentStatus');

      if (!this.$listBody) {
        console.error('[MMReviews] #listBody not found.');
      }
    },

    bindEvents() {
      // 목록에서 "Write a review" 버튼
      if (this.$btnCompose) {
        this.$btnCompose.addEventListener('click', (e) => {
          e.preventDefault();
          if (!this.user) {
            alert('Please log in on the home page before writing a review.');
            return;
          }
          this.startWriteNew();
        });
      }

      // 글쓰기 폼 submit
      if (this.$writeForm) {
        this.$writeForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          await this.handleSubmitReview();
        });
      }

      // 글쓰기 취소
      const btnCancel = document.getElementById('btn-cancel-write');
      if (btnCancel) {
        btnCancel.addEventListener('click', (e) => {
          e.preventDefault();
          this.resetWriteForm();
          this.showListView();
        });
      }

      // 파일 선택 → 미리보기
      if (this.$fileInput && this.$selectPreviews) {
        this.$fileInput.addEventListener('change', () => {
          this.renderFilePreviews();
        });
      }

      // 읽기뷰: 목록으로 돌아가기
      if (this.$btnBackList) {
        this.$btnBackList.addEventListener('click', (e) => {
          e.preventDefault();
          this.currentReview = null;
          this.isEditing = false;
          this.editingReviewId = null;
          this.showListView();
        });
      }

      // 읽기뷰: Edit / Delete
      if (this.$btnEditReview) {
        this.$btnEditReview.addEventListener('click', (e) => {
          e.preventDefault();
          this.startEditCurrentReview();
        });
      }
      if (this.$btnDeleteReview) {
        this.$btnDeleteReview.addEventListener('click', async (e) => {
          e.preventDefault();
          await this.deleteCurrentReview();
        });
      }

      // 좋아요 버튼
      if (this.$btnLike) {
        this.$btnLike.addEventListener('click', async (e) => {
          e.preventDefault();
          await this.toggleLike();
        });
      }

      // 댓글 폼
      if (this.$commentForm) {
        this.$commentForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          await this.submitComment();
        });
      }
    },

    applyAuthInfo() {
      if (this.$authInfo) {
        if (this.user) {
          this.$authInfo.textContent =
            'Logged in as ' + (this.user.email || '') + '.';
        } else {
          this.$authInfo.textContent =
            'Not logged in. To write reviews or comments, please log in on the home page.';
        }
      }

      if (this.$listLoginHint) {
        if (this.user) {
          this.$listLoginHint.textContent =
            'You are logged in. You can write a review.';
        } else {
          this.$listLoginHint.textContent =
            'To write a review, please sign up / log in on the home page.';
        }
      }
    },

    showListView() {
      if (this.$listView)  this.$listView.hidden  = false;
      if (this.$readView)  this.$readView.hidden  = true;
      if (this.$writeForm) this.$writeForm.hidden = true;
    },

    showReadView() {
      if (this.$listView)  this.$listView.hidden  = true;
      if (this.$readView)  this.$readView.hidden  = false;
      if (this.$writeForm) this.$writeForm.hidden = true;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    showWriteView() {
      if (this.$listView)  this.$listView.hidden  = true;
      if (this.$readView)  this.$readView.hidden  = true;
      if (this.$writeForm) this.$writeForm.hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    startWriteNew() {
      this.isEditing = false;
      this.editingReviewId = null;
      if (this.$writeTitleHeading) {
        this.$writeTitleHeading.textContent = 'Write a new review';
      }
      if (this.$inputTitle)   this.$inputTitle.value = '';
      if (this.$inputContent) this.$inputContent.value = '';
      if (this.$fileInput)    this.$fileInput.value = '';
      if (this.$selectPreviews) this.$selectPreviews.innerHTML = '';
      if (this.$formStatus)   this.$formStatus.textContent = '';

      this.showWriteView();
    },

    startEditCurrentReview() {
      if (!this.currentReview || !this.user) return;
      if (this.currentReview.author_id !== this.user.id) {
        alert('You can only edit your own review.');
        return;
      }
      this.isEditing = true;
      this.editingReviewId = this.currentReview.id;

      if (this.$writeTitleHeading) {
        this.$writeTitleHeading.textContent = 'Edit your review';
      }
      if (this.$inputTitle)   this.$inputTitle.value = this.currentReview.title || '';
      if (this.$inputContent) this.$inputContent.value = this.currentReview.content || '';
      if (this.$fileInput)    this.$fileInput.value = '';
      if (this.$selectPreviews) this.$selectPreviews.innerHTML = '';
      if (this.$formStatus)   this.$formStatus.textContent =
        'Editing text only. Existing images will remain unless you attach new ones.';

      this.showWriteView();
    },

    resetWriteForm() {
      this.isEditing = false;
      this.editingReviewId = null;
      if (this.$writeTitleHeading) {
        this.$writeTitleHeading.textContent = 'Write a new review';
      }
      if (this.$inputTitle)   this.$inputTitle.value = '';
      if (this.$inputContent) this.$inputContent.value = '';
      if (this.$fileInput)    this.$fileInput.value = '';
      if (this.$selectPreviews) this.$selectPreviews.innerHTML = '';
      if (this.$formStatus)   this.$formStatus.textContent = '';
    },

    renderFilePreviews() {
      if (!this.$fileInput || !this.$selectPreviews) return;
      const files = Array.from(this.$fileInput.files || []);
      this.$selectPreviews.innerHTML = '';

      const max = Math.min(files.length, 6);
      for (let i = 0; i < max; i++) {
        const file = files[i];
        const card = document.createElement('div');
        card.className = 'thumb-card';
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.onload = () => URL.revokeObjectURL(img.src);
        card.appendChild(img);
        this.$selectPreviews.appendChild(card);
      }
      if (files.length > 6 && this.$formStatus) {
        this.$formStatus.textContent = 'Only the first 6 images will be used.';
      }
    },

    async handleSubmitReview() {
      if (!this.supabase) return;
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

      // 1) 이미지 업로드 (최대 6장)
      let imagePaths = [];
      if (this.$fileInput && this.$fileInput.files && this.$fileInput.files.length > 0) {
        const files = Array.from(this.$fileInput.files);
        if (files.length > 6) {
          alert('You can attach up to 6 images. Only the first 6 will be used.');
        }

        const bucket = this.supabase.storage.from('review-images');
        const max = Math.min(files.length, 6);
        for (let i = 0; i < max; i++) {
          const file = files[i];
          const rawExt = (file.name.split('.').pop() || 'jpg').toLowerCase();
          const ext = rawExt.replace(/[^a-z0-9]/g, '') || 'jpg';
          const path = `${this.user.id}/${Date.now()}_${i}.${ext}`;

          const { data, error } = await bucket.upload(path, file);
          if (error) {
            console.error('[MMReviews] image upload error:', error);
            if (this.$formStatus) {
              this.$formStatus.textContent =
                'Failed to upload images: ' + (error.message || 'Unknown error');
            }
            return;
          }
          imagePaths.push(data.path);
        }
      }

      const nickname =
        (this.user.email && this.user.email.split('@')[0]) || 'tester';
      const author_email = this.user.email || null;
      const author_id = this.user.id;

      let result = null;

      if (this.isEditing && this.editingReviewId) {
        // 수정 모드: 텍스트 + (선택적으로) 새 이미지로 교체
        const payload = {
          title,
          content
        };
        if (imagePaths.length > 0) {
          payload.image_urls = imagePaths;
        }

        const { data, error } = await this.supabase
          .from('reviews')
          .update(payload)
          .eq('id', this.editingReviewId)
          .eq('author_id', author_id)
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
        result = data;
      } else {
        // 새 글 작성
        const { data, error } = await this.supabase
          .from('reviews')
          .insert({
            title,
            content,
            nickname,
            author_email,
            author_id,
            image_urls: imagePaths
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
        result = data;
      }

      if (this.$formStatus) {
        this.$formStatus.textContent = 'Saved successfully.';
      }

      this.resetWriteForm();
      await this.loadList();

      // 방금 작성/수정한 글을 바로 읽기 화면으로 열고 싶으면:
      if (result && result.id) {
        await this.openReview(result.id);
      } else {
        this.showListView();
      }
    },

    async deleteCurrentReview() {
      if (!this.supabase || !this.currentReview || !this.user) return;
      if (this.currentReview.author_id !== this.user.id) {
        alert('You can only delete your own review.');
        return;
      }
      if (!confirm('Delete this review? This cannot be undone.')) {
        return;
      }
      const { error } = await this.supabase
        .from('reviews')
        .delete()
        .eq('id', this.currentReview.id)
        .eq('author_id', this.user.id);

      if (error) {
        alert('Failed to delete the review: ' + (error.message || 'Unknown error'));
        console.error('[MMReviews] delete review error:', error);
        return;
      }

      alert('Review deleted.');
      this.currentReview = null;
      await this.loadList();
      this.showListView();
    },

    async loadList() {
      if (!this.$listBody || !this.supabase) return;

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
        if (row.is_notice) tr.classList.add('notice');

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

        // 본문 요약
        const tdBody = document.createElement('td');
        tdBody.className = 'cell-body';

        const line1 = document.createElement('div');
        line1.className = 'm-line1';
        line1.textContent = (row.is_notice ? '[Notice] ' : '') + (row.title || '(No title)');

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

        tr.dataset.id = row.id;
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', () => {
          this.openReview(row.id);
        });

        this.$listBody.appendChild(tr);
      });
    },

    async openReview(id) {
      if (!this.supabase || !id) return;

      // 리뷰 상세 가져오기 (이미지 포함)
      const { data, error } = await this.supabase
        .from('reviews')
        .select('id, title, content, nickname, author_email, author_id, created_at, view_count, is_notice, image_urls')
        .eq('id', id)
        .single();

      if (error) {
        alert('Failed to load the review: ' + (error.message || 'Unknown error'));
        console.error('[MMReviews] load review error:', error);
        return;
      }

      this.currentReview = data;
      this.renderReadView();
      await this.refreshLikes();
      await this.loadComments();

      this.showReadView();
    },

    renderReadView() {
      if (!this.currentReview) return;
      const r = this.currentReview;

      if (this.$readTitle) {
        this.$readTitle.textContent = r.title || '(No title)';
      }
      if (this.$readMeta) {
        const author = r.nickname || (r.author_email || '(unknown)');
        const dateStr = this.formatDateTime(r.created_at);
        const views = r.view_count ?? 0;
        this.$readMeta.textContent =
          `${author} · ${dateStr} · Views ${views}`;
      }
      if (this.$readContent) {
        this.$readContent.textContent = r.content || '';
      }

      // 자신의 글이면 Edit/Delete 버튼 노출
      if (this.user && r.author_id === this.user.id) {
        if (this.$btnEditReview)   this.$btnEditReview.style.display = 'inline-flex';
        if (this.$btnDeleteReview) this.$btnDeleteReview.style.display = 'inline-flex';
      } else {
        if (this.$btnEditReview)   this.$btnEditReview.style.display = 'none';
        if (this.$btnDeleteReview) this.$btnDeleteReview.style.display = 'none';
      }

      // 이미지 렌더
      if (this.$readImages && this.$readImagesGrid) {
        this.$readImagesGrid.innerHTML = '';
        const paths = Array.isArray(r.image_urls) ? r.image_urls : [];
        if (paths.length === 0) {
          this.$readImages.hidden = true;
        } else {
          const bucket = this.supabase.storage.from('review-images');
          paths.forEach((p) => {
            const { data: urlData } = bucket.getPublicUrl(p);
            const url = urlData.publicUrl;

            const card = document.createElement('div');
            card.className = 'thumb-card';
            const img = document.createElement('img');
            img.src = url;
            img.alt = 'Attached image';
            img.addEventListener('click', () => {
              window.open(url, '_blank');
            });
            card.appendChild(img);
            this.$readImagesGrid.appendChild(card);
          });
          this.$readImages.hidden = false;
        }
      }
    },

    async refreshLikes() {
      if (!this.supabase || !this.currentReview) return;
      const reviewId = this.currentReview.id;

      // 총 좋아요 개수
      const { count, error: countError } = await this.supabase
        .from('review_likes')
        .select('review_id', { count: 'exact', head: true })
        .eq('review_id', reviewId);

      if (!countError && typeof count === 'number') {
        this.likeCount = count;
      } else {
        this.likeCount = 0;
      }

      // 내가 눌렀는지
      this.userHasLiked = false;
      if (this.user) {
        const { data, error } = await this.supabase
          .from('review_likes')
          .select('review_id')
          .eq('review_id', reviewId)
          .eq('user_id', this.user.id)
          .maybeSingle?.() ?? await this.supabase
          .from('review_likes')
          .select('review_id')
          .eq('review_id', reviewId)
          .eq('user_id', this.user.id)
          .single()
          .catch(() => ({ data: null, error: null }));

        if (!error && data) {
          this.userHasLiked = true;
        }
      }

      this.updateLikeUI();
    },

    updateLikeUI() {
      if (this.$likeCountSpan) {
        this.$likeCountSpan.textContent = String(this.likeCount);
      }
      if (this.$btnLike) {
        if (this.userHasLiked) {
          this.$btnLike.textContent = '💔 Unlike';
        } else {
          this.$btnLike.textContent = '❤️ Like';
        }
      }
    },

    async toggleLike() {
      if (!this.supabase || !this.currentReview) return;
      if (!this.user) {
        alert('Please log in on the home page to use likes.');
        return;
      }

      const reviewId = this.currentReview.id;
      const userId = this.user.id;

      if (this.userHasLiked) {
        // 좋아요 취소
        const { error } = await this.supabase
          .from('review_likes')
          .delete()
          .eq('review_id', reviewId)
          .eq('user_id', userId);

        if (error) {
          alert('Failed to remove like: ' + (error.message || 'Unknown error'));
          console.error('[MMReviews] unlike error:', error);
          return;
        }
        this.userHasLiked = false;
        this.likeCount = Math.max(0, this.likeCount - 1);
      } else {
        // 좋아요 추가
        const { error } = await this.supabase
          .from('review_likes')
          .insert({
            review_id: reviewId,
            user_id: userId
          });

        if (error) {
          alert('Failed to add like: ' + (error.message || 'Unknown error'));
          console.error('[MMReviews] like error:', error);
          return;
        }
        this.userHasLiked = true;
        this.likeCount += 1;
      }

      this.updateLikeUI();
    },

    async loadComments() {
      if (!this.supabase || !this.currentReview || !this.$commentsList) return;

      this.$commentsList.innerHTML = '';
      const reviewId = this.currentReview.id;

      const { data, error } = await this.supabase
        .from('review_comments')
        .select('id, review_id, author_id, author_email, nickname, content, created_at')
        .eq('review_id', reviewId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[MMReviews] load comments error:', error);
        if (this.$commentStatus) {
          this.$commentStatus.textContent =
            'Failed to load comments: ' + (error.message || 'Unknown error');
        }
        return;
      }

      if (!data || data.length === 0) {
        const li = document.createElement('li');
        li.className = 'comment-item';
        li.textContent = 'No comments yet.';
        this.$commentsList.appendChild(li);
        return;
      }

      data.forEach((c) => {
        const li = document.createElement('li');
        li.className = 'comment-item';

        const head = document.createElement('div');
        head.className = 'comment-head';
        const left = document.createElement('span');
        left.textContent =
          (c.nickname || (c.author_email || '(unknown)')) +
          ' · ' + this.formatDateTime(c.created_at);
        head.appendChild(left);

        const right = document.createElement('span');
        head.appendChild(right);

        const body = document.createElement('div');
        body.className = 'comment-body';
        body.textContent = c.content || '';

        li.appendChild(head);
        li.appendChild(body);

        // 자기 댓글이면 삭제 버튼
        if (this.user && c.author_id === this.user.id) {
          const actions = document.createElement('div');
          actions.className = 'comment-actions';
          const btnDel = document.createElement('button');
          btnDel.type = 'button';
          btnDel.textContent = 'Delete';
          btnDel.addEventListener('click', async () => {
            if (!confirm('Delete this comment?')) return;
            const { error: delError } = await this.supabase
              .from('review_comments')
              .delete()
              .eq('id', c.id)
              .eq('author_id', this.user.id);

            if (delError) {
              alert('Failed to delete comment: ' + (delError.message || 'Unknown error'));
              console.error('[MMReviews] delete comment error:', delError);
              return;
            }
            await this.loadComments();
          });
          actions.appendChild(btnDel);
          li.appendChild(actions);
        }

        this.$commentsList.appendChild(li);
      });
    },

    async submitComment() {
      if (!this.supabase || !this.currentReview || !this.$commentContent) return;
      if (!this.user) {
        alert('Please log in on the home page before writing a comment.');
        return;
      }
      const text = this.$commentContent.value.trim();
      if (!text) {
        alert('Please enter a comment.');
        return;
      }

      if (this.$commentStatus) {
        this.$commentStatus.textContent = 'Saving comment...';
      }

      const nickname =
        (this.user.email && this.user.email.split('@')[0]) || 'tester';
      const author_email = this.user.email || null;
      const author_id = this.user.id;
      const reviewId = this.currentReview.id;

      const { error } = await this.supabase
        .from('review_comments')
        .insert({
          review_id: reviewId,
          author_id,
          author_email,
          nickname,
          content: text
        });

      if (error) {
        console.error('[MMReviews] insert comment error:', error);
        if (this.$commentStatus) {
          this.$commentStatus.textContent =
            'Failed to save comment: ' + (error.message || 'Unknown error');
        }
        return;
      }

      this.$commentContent.value = '';
      if (this.$commentStatus) {
        this.$commentStatus.textContent = 'Comment saved.';
      }
      await this.loadComments();
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

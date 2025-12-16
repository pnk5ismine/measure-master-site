// /js/reviews-ui.js
// Reviews page UI: list + write view, using the *same* Supabase client as mm-auth.js

(function (global) {
  const MMReviews = {
    supabase: null,
    user: null,

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

      // 1) Prefer client passed from caller
      if (supabaseClient && supabaseClient.auth) {
        this.supabase = supabaseClient;
      }
      // 2) Fallback to mmAuth.supabase if present
      else if (global.mmAuth && global.mmAuth.supabase) {
        this.supabase = global.mmAuth.supabase;
      }

      if (!this.supabase) {
        console.error('[MMReviews] No Supabase client available.');
        return;
      }

      this.user = currentUser || null;

      this.cacheDom();
      this.setupComposeButton();
      this.setupWriteForm();
      this.applyAuthHint();
      this.handleInitialViewFromQuery();
      await this.loadList();
    },

    cacheDom() {
      this.$listBody      = document.getElementById('listBody');
      this.$listView      = document.getElementById('listView');
      this.$readView      = document.getElementById('readView');   // (not used yet)
      this.$writeForm     = document.getElementById('writeForm');
      this.$listLoginHint = document.getElementById('listLoginHint');
      this.$btnCompose    = document.getElementById('btn-compose');
      this.$btnCancel     = document.getElementById('btn-cancel');
      this.$formStatus    = document.getElementById('formStatus');
      this.$inputTitle    = document.getElementById('title');
      this.$inputContent  = document.getElementById('content');

      if (!this.$listBody) {
        console.error('[MMReviews] #listBody not found.');
      }
    },

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

    handleInitialViewFromQuery() {
      const params = new URLSearchParams(window.location.search);
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

    showListView() {
      if (this.$listView)  this.$listView.hidden  = false;
      if (this.$readView)  this.$readView.hidden  = true;
      if (this.$writeForm) this.$writeForm.hidden = true;
    },

    showWriteView() {
      if (this.$listView)  this.$listView.hidden  = true;
      if (this.$readView)  this.$readView.hidden  = true;
      if (this.$writeForm) this.$writeForm.hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    setupComposeButton() {
      if (!this.$btnCompose) return;

      this.$btnCompose.addEventListener('click', (e) => {
        e.preventDefault();

        if (!this.user || !this.user.id) {
          alert('Please log in on the home page before writing a review.');
          return;
        }
        this.showWriteView();
      });

      if (this.$btnCancel) {
        this.$btnCancel.addEventListener('click', (e) => {
          e.preventDefault();
          this.showListView();
        });
      }
    },

    setupWriteForm() {
      if (!this.$writeForm) return;

      this.$writeForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 로그인 여부 다시 확인
        if (!this.user || !this.user.id) {
          await this.refreshUser();
          if (!this.user || !this.user.id) {
            alert('Please log in on the home page before writing a review.');
            if (this.$formStatus) {
              this.$formStatus.textContent = 'Not logged in.';
            }
            return;
          }
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

        const user = this.user;
        const nickname =
          (user.email && user.email.split('@')[0]) || 'tester';
        const author_email = user.email || null;
        const author_id = user.id;   // ★ reviews.author_id 에 들어갈 값

        const { data, error } = await this.supabase
          .from('reviews')
          .insert({
            title,
            content,
            nickname,
            author_email,
            author_id
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

        if (this.$formStatus) {
          this.$formStatus.textContent = 'Review saved.';
        }

        if (this.$inputTitle)   this.$inputTitle.value = '';
        if (this.$inputContent) this.$inputContent.value = '';

        this.showListView();
        await this.loadList();
      });
    },

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

        // No.
        const tdNo = document.createElement('td');
        tdNo.className = 'cell-no';
        tdNo.textContent = String(idx + 1);
        tr.appendChild(tdNo);

        // Nickname
        const tdNick = document.createElement('td');
        tdNick.className = 'cell-nick';
        tdNick.textContent = row.nickname || '-';
        tr.appendChild(tdNick);

        // Title + summary
        const tdBody = document.createElement('td');
        tdBody.className = 'cell-body';

        const line1 = document.createElement('div');
        line1.className = 'm-line1';
        line1.textContent = row.is_notice
          ? '[NOTICE] ' + (row.title || '(No title)')
          : (row.title || '(No title)');

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

        // Views
        const tdStats = document.createElement('td');
        tdStats.className = 'cell-stats';
        tdStats.textContent = String(row.view_count ?? 0);
        tr.appendChild(tdStats);

        // Created at
        const tdTime = document.createElement('td');
        tdTime.className = 'cell-time';
        tdTime.textContent = this.formatDateTime(row.created_at);
        tr.appendChild(tdTime);

        // Click handler (later can be full read view)
        tr.dataset.id = row.id;
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', () => {
          alert(
            'Reading view will be implemented later.\n\nTitle: ' +
              (row.title || '')
          );
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

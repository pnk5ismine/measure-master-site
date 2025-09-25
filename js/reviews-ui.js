/*! reviews-ui.js : 후기 페이지 전용 UI (목록/읽기/쓰기/댓글/반응/업로드) */
(function(){
  'use strict';

  // ----- 공유 클라이언트/헬퍼 -----
  const sb = window.mmAuth.getClient();
  const $  = s => document.querySelector(s);
  const _get = v => (typeof v === 'function' ? v() : v); // 변수/함수 겸용 안전 접근

  // ----- DOM refs -----
  const authInfo     = $('#authInfo');
  const authStatus   = $('#authStatus');
  const authTabs     = $('#authTabs');
  const loginForm    = $('#loginForm');
  const signupForm   = $('#signupForm');
  const loginStatus  = $('#loginStatus');
  const signupStatus = $('#signupStatus');

  const loginEmailField = $('#login-email')?.closest('.field');
  const loginPwField    = $('#login-password')?.closest('.field');
  const btnLogin        = $('#btn-login');
  const btnLogout       = $('#btn-logout');
  const listLoginHint   = $('#listLoginHint');

  const listView   = $('#listView');
  const readView   = $('#readView');
  const writeForm  = $('#writeForm');
  const listBody   = $('#listBody');
  const btnCompose = $('#btn-compose');
  const btnSubmit  = $('#btn-submit');
  const formStatus = $('#formStatus');

  const fTitle   = $('#title');
  const fContent = $('#content');
  const fImage   = $('#image');
  const preview  = $('#preview');
  const selectPreviews = $('#selectPreviews');
  const editImages = $('#editImages');

  const MAX_FILES = Number($('#image')?.dataset?.max || 6);
  let   chosenFiles = [];

  // ----- 모바일 auth 패널 노출 제어 -----
  const MOBILE_MAX = 700;
  const isMobile = () => window.matchMedia(`(max-width:${MOBILE_MAX}px)`).matches;
  function showAuthForMobile(){
    if (!isMobile()) return;
    document.body.classList.add('show-auth');
    try { setTab && setTab('login'); } catch {}
    document.getElementById('leftAuth')?.scrollIntoView({ behavior:'smooth', block:'start' });
  }
  function hideAuthForMobile(){
    if (!isMobile()) return;
    document.body.classList.remove('show-auth');
  }

  // ----- 탭 전환 -----
  function setTab(which){
    $('#tab-login')?.classList.toggle('active', which==='login');
    $('#tab-signup')?.classList.toggle('active', which==='signup');
    if(loginForm)  loginForm.hidden  = (which!=='login');
    if(signupForm) signupForm.hidden = (which!=='signup');
  }
  $('#tab-login')?.addEventListener('click', ()=>setTab('login'));
  $('#tab-signup')?.addEventListener('click', ()=>setTab('signup'));

  // ----- 유틸 -----
  function escapeHtml(s){return (s??'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]))}
  function fmtDate(iso){try{const d=new Date(iso);return d.toLocaleString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return iso||''}}
  function displayName(row){
    if (window.mmAuth.isAdminEmail(row?.author_email)) return '관리자';
    return row?.nickname || (row?.author_email ? row.author_email.split('@')[0] : '익명');
  }

  // =========================
  // 인증 UI 갱신
  // =========================
  async function refreshAuthUI(){
    const res = await window.mmAuth.safeGetSession(2000);
    const session = res?.data?.session ?? null;

    if(session?.user){
      authStatus && (authStatus.textContent = `로그인: ${session.user.email}`);
      authInfo   && (authInfo.textContent  = `로그인: ${session.user.email}`);
      listLoginHint && (listLoginHint.hidden = true);
      authTabs && authTabs.setAttribute('hidden','');
      signupForm && signupForm.setAttribute('hidden','');

      if (loginForm) {
        loginForm.hidden = false;
        loginEmailField && (loginEmailField.hidden = true);
        loginPwField    && (loginPwField.hidden = true);
        btnLogin        && (btnLogin.hidden = true);
        btnLogout       && (btnLogout.hidden = false);
      }
    }else{
      authStatus && (authStatus.textContent = '로그아웃 상태');
      authInfo   && (authInfo.textContent  = '로그아웃 상태');
      listLoginHint && (listLoginHint.hidden = false);
      authTabs && authTabs.removeAttribute('hidden');
      signupForm && signupForm.setAttribute('hidden','');
      if (loginForm) loginForm.hidden = false;
      loginEmailField && (loginEmailField.hidden = false);
      loginPwField    && (loginPwField.hidden = false);
      btnLogin        && (btnLogin.hidden = false);
      btnLogout       && (btnLogout.hidden = true);
      setTab('login');
      ensureAuthVisible();
    }
  }
  function ensureAuthVisible(){
    const loginForm = document.getElementById('loginForm');
    const authTabs  = document.getElementById('authTabs');
    const signupForm= document.getElementById('signupForm');
    if (!loginForm || !authTabs) return;
    const cs = getComputedStyle(loginForm);
    const needsShow = loginForm.hidden || cs.display === 'none' || cs.visibility === 'hidden';
    if (needsShow) {
      authTabs.hidden = false;
      loginForm.hidden = false;
      loginForm.style.display = '';
      loginForm.style.visibility = '';
      if (signupForm) { signupForm.hidden = true; }
      if (typeof setTab === 'function') setTab('login');
    }
  }

  // 실사용 로그인/로그아웃/가입
  $('#btn-login')?.addEventListener('click', async (e)=>{
    e.preventDefault();
    if (loginStatus) loginStatus.textContent = '로그인 중…';
    const email = $('#login-email')?.value.trim();
    const pw    = ($('#login-password')?.value ?? '').trim();
    const { error } = await window.mmAuth.signIn(email, pw);
    if (loginStatus) loginStatus.textContent = error ? ('로그인 실패: '+error.message) : '로그인 성공';
    await refreshAuthUI();
  });
  $('#btn-logout')?.addEventListener('click', async (e)=>{
    e.preventDefault();
    await window.mmAuth.signOut();
    await refreshAuthUI();
  });
  $('#btn-signup')?.addEventListener('click', async (e)=>{
    e.preventDefault();
    if (signupStatus) signupStatus.textContent = '가입 중…';
    const email = $('#signup-email')?.value.trim();
    const pw1   = $('#signup-password')?.value;
    const pw2   = $('#signup-password2')?.value;
    if(pw1 !== pw2){ signupStatus.textContent='비밀번호 확인이 일치하지 않습니다.'; return; }
    if((pw1||'').length < 8){ signupStatus.textContent='비밀번호는 8자 이상'; return; }
    const { data, error } = await window.mmAuth.signUp(email, pw1);
    if(error){ signupStatus.textContent = '가입 실패: ' + error.message; return; }
    signupStatus.textContent = data.session ? '가입+로그인 완료' : '가입 완료';
    await refreshAuthUI();
  });

  // 모든 페이지 공통 상태 변경에 반응
  window.mmAuth.onAuthChange(async (session)=>{
    // 로그인 완료되면 모바일에선 auth 박스 숨김 + compose=1이면 글쓰기로
    if (session?.user && document.body.classList.contains('show-auth')){
      hideAuthForMobile();
      const q = new URLSearchParams(location.search);
      if (q.get('compose') === '1'){
        showWrite();
        if (window.mmAuth.isAdmin(session)) document.getElementById('noticeBox')?.removeAttribute('hidden');
      }
    }
    if (session?.user) hideAuthForMobile();
    await refreshAuthUI();
  });

  // =========================
  // 뷰 전환
  // =========================
  function setSection(elLike, visible){
    const el = _get(elLike);
    if(!el) return;
    el.hidden = !visible;
    el.setAttribute('aria-hidden', visible ? 'false' : 'true');
    el.style.display = visible ? '' : 'none';
  }
  function resetWriteDraft(){
    try{
      const wf = _get(writeForm);
      if (wf && wf.dataset) delete wf.dataset.editing;
      const t  = _get(fTitle);
      const c  = _get(fContent);
      const sp = _get(selectPreviews);
      const ei = _get(editImages);
      const fi = _get(fImage);
      const fs = _get(formStatus);
      if (t)  t.value = '';
      if (c)  c.value = '';
      if (sp) sp.innerHTML = '';
      if (ei){ ei.hidden = true; ei.innerHTML = ''; }
      if (fi) fi.value = '';
      if (fs) fs.textContent = '';
      chosenFiles = [];
    }catch{}
  }
  function showList(opts={}){
    setSection(listView,  true);
    setSection(readView,  false);
    setSection(writeForm, false);
    resetWriteDraft();
    if (opts.updateUrl !== false) history.replaceState(null,'','/reviews.html');
    (document.getElementById('btn-compose') || _get(listView) || document.body)
      .scrollIntoView({ behavior:'smooth', block:'start' });
  }
  function showRead(opts={}){
    setSection(listView,  false);
    setSection(readView,  true);
    setSection(writeForm, false);
    if (opts.scroll !== false) (_get(readView) || document.body).scrollIntoView({ behavior:'smooth', block:'start' });
  }
  function showWrite(opts={}){
    setSection(listView,  false);
    setSection(readView,  false);
    setSection(writeForm, true);
    const wf = _get(writeForm);
    if (opts.clear !== false && !(wf && wf.dataset && wf.dataset.editing)) resetWriteDraft();
    try{ hideAuthForMobile?.(); }catch{}
    if (opts.updateUrl) history.replaceState(null,'','/reviews.html?compose=1');
    ( _get(fTitle) || wf || document.body ).scrollIntoView({ behavior:'smooth', block:'start' });
  }

  // =========================
  // 목록
  // =========================
  async function loadList(){
    const { data, error } = await sb.from('reviews')
      .select('id, title, content, nickname, author_email, created_at, view_count, is_notice')
      .order('is_notice', { ascending:false })
      .order('created_at', { ascending:false })
      .limit(100);
    if(error){
      listBody.innerHTML = `<tr><td colspan="5" class="muted">목록 로드 실패: ${escapeHtml(error.message)}</td></tr>`;
      return;
    }
    if(!data?.length){
      listBody.innerHTML = `<tr><td colspan="5" class="muted">등록된 후기가 없습니다.</td></tr>`;
      return;
    }

    // 조회/댓글 카운트(뷰가 있으면 사용)
    const ids = data.map(r => r.id);
    let countMap = new Map();
    if (ids.length){
      const { data: counts } = await sb.from('review_counts')
        .select('review_id, view_count, comment_count')
        .in('review_id', ids);
      counts?.forEach(r => countMap.set(r.review_id, {
        v: Number(r.view_count||0),
        c: Number(r.comment_count||0)
      }));
    }

    listBody.innerHTML = data.map((row, idx) => {
      const stat = countMap.get(row.id) || { v: Number(row.view_count||0), c: 0 };
      const nick = escapeHtml(displayName(row));
      const titleHtml = row.title ? `[${escapeHtml(row.title)}] ` : '';
      const bodyHtml =
        (row.is_notice ? '<span class="notice-tag">[알림]</span> ' : '')
        + titleHtml + escapeHtml(row.content||'');
      const when = fmtDate(row.created_at);
      const trCls = row.is_notice ? 'row-item notice' : 'row-item';
      return `
        <tr data-id="${row.id}" class="${trCls}" style="cursor:pointer">
          <td class="cell-no">${idx+1}</td>
          <td class="cell-nick">${nick}</td>
          <td class="cell-body">
            <div class="m-line1"><span class="nick m-only">${nick}</span>${bodyHtml}</div>
            <div class="m-line2 m-only"><span>조회 ${stat.v} (${stat.c})</span><span>${when}</span></div>
          </td>
          <td class="cell-stats">${stat.v} (${stat.c})</td>
          <td class="cell-time">${when}</td>
        </tr>
      `;
    }).join('');

    listBody.querySelectorAll('tr.row-item').forEach(tr=>{
      tr.addEventListener('click',()=> location.href=`/reviews.html?id=${tr.dataset.id}`);
    });
  }

  // =========================
  // 읽기(상세)
  // =========================
  async function loadOne(id){
    const { data, error } = await sb
      .from("reviews")
      .select("id, user_id, title, content, created_at, nickname, author_email, image_url, image_path, is_notice")
      .eq("id", id).single();
    if(error){
      readView.innerHTML = `<p class="muted">불러오기 실패: ${escapeHtml(error.message)}</p>`;
      return;
    }

    const session = await window.mmAuth.getSession();
    const me = session?.user || null;
    const isOwner = !!(me && data.user_id && me.id === data.user_id);
    const name = displayName(data);

    readView.innerHTML = `
      <div class="top-actions">
        <a class="btn secondary" href="/reviews.html">목록보기</a>
        <div style="display:flex; gap:8px; align-items:center">
          <button class="btn" type="button" id="btn-to-compose">글쓰기</button>
          ${isOwner ? `<button class="btn secondary" type="button" id="btn-edit">수정</button>` : ``}
          ${isOwner ? `<button class="btn secondary" type="button" id="btn-delete">삭제</button>` : ``}
        </div>
      </div>

      <h3 style="margin:0 0 6px">${escapeHtml((data.is_notice ? "[알림] " : "") + (data.title || "(제목 없음)"))}</h3>
      <div class="muted" style="margin-bottom:10px">${escapeHtml(name)} · ${fmtDate(data.created_at)}</div>
      <div style="white-space:pre-wrap;word-break:break-word">${escapeHtml(data.content || "")}</div>

      <!-- 라이트박스 -->
      <div id="lb" class="lightbox" hidden>
        <button class="lb-close" aria-label="닫기">×</button>
        <button class="lb-prev" aria-label="이전">‹</button>
        <img id="lbImg" alt="">
        <button class="lb-next" aria-label="다음">›</button>
      </div>

      <!-- 썸네일 그리드 -->
      <div id="galleryThumbs" class="thumbs" style="margin-top:12px"></div>

      <div class="reaction-bar" id="reactBar"></div>

      <div class="comments" id="commentsBox">
        <h4 style="margin:16px 0 8px">댓글</h4>
        <div id="commentList"></div>
        <form id="commentForm" class="comment-form" hidden>
          <textarea id="commentText" placeholder="댓글을 입력해 주세요"></textarea>
          <label style="display:flex;align-items:center;gap:6px;white-space:nowrap">
            <input type="checkbox" id="commentSecret"> 비밀글
          </label>
          <button class="btn" id="btnComment">등록</button>
        </form>
        <div id="commentLoginHint" class="muted">댓글을 쓰려면 로그인하세요.</div>
      </div>

      <!-- 하단 공유 -->
      <div class="bottom-actions">
        <button class="btn secondary icon" type="button" id="btnCopyLink" title="링크 복사">
          🔗 <span>공유</span>
        </button>
        <span id="shareTip" class="status"></span>
      </div>
    `;

    // 상단 버튼
    document.getElementById('btn-to-compose')?.addEventListener('click', async ()=>{
      const s = await window.mmAuth.waitForSession(3000);
      if(!s?.user){ showAuthForMobile(); return; }
      history.replaceState(null,'','/reviews.html?compose=1');
      showWrite();
      if (window.mmAuth.isAdmin(s)) document.getElementById('noticeBox')?.removeAttribute('hidden');
    });

    document.getElementById('btn-edit')?.addEventListener('click', ()=>{
      history.replaceState(null,'', `/reviews.html?edit=${id}`);
      showWrite();
      if (fTitle)   fTitle.value   = data.title   || '';
      if (fContent) fContent.value = data.content || '';
      if (writeForm) {
        writeForm.dataset.editing = id;
        writeForm._editingLegacy  = { url: data.image_url || null, path: data.image_path || null };
      }
      // 관리자라면 공지 체크 박스
      if (window.mmAuth.isAdmin(session)) {
        document.getElementById('noticeBox')?.removeAttribute('hidden');
        const cb = document.getElementById('isNotice'); if (cb) cb.checked = !!data.is_notice;
      }
      const editBox = document.getElementById('editImages');
      if (editBox) editBox.hidden = false;
      renderEditImagesForEditMode(id, data.image_url, data.image_path);
    });

    document.getElementById('btn-delete')?.addEventListener('click', async ()=>{
      if(!confirm('정말 삭제할까요? 이 작업은 되돌릴 수 없습니다.')) return;
      try{
        await sb.from('comments').delete().eq('review_id', id);
        const del = await sb.from('reviews').delete().eq('id', id);
        if(del.error) throw new Error(del.error.message);

        if(data.image_path){
          const rm = await sb.storage.from('reviews').remove([data.image_path]);
          if(rm.error) console.warn('이미지 삭제 실패:', rm.error.message);
        }
        alert('삭제되었습니다.');
        location.href='/reviews.html';
      }catch(err){
        alert('삭제 실패: ' + (err.message||err));
      }
    });

    // 반응/댓글/이미지
    await renderReactions(id);
    await renderComments(id, data.user_id);
    await renderGalleryLightbox(id, data.image_url);

    // 조회수 +1 (있으면)
    try { await sb.rpc('inc_review_view', { _id: id }); } catch (e) { console.warn('view +1 실패', e); }

    // 공유: 텍스트 링크 복사
    const copyBtn  = document.getElementById('btnCopyLink');
    const shareTip = document.getElementById('shareTip');
    const shareUrl = `${location.origin}/reviews.html?id=${id}`;
    function copyPlainText(text) {
      if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
      return new Promise((resolve, reject) => {
        try{
          const ta = document.createElement('textarea');
          ta.value = text; ta.setAttribute('readonly', '');
          ta.style.position = 'fixed'; ta.style.left = '-9999px';
          document.body.appendChild(ta); ta.select();
          const ok = document.execCommand('copy');
          document.body.removeChild(ta);
          ok ? resolve() : reject(new Error('execCommand copy 실패'));
        }catch(err){ reject(err); }
      });
    }
    copyBtn?.addEventListener('click', async ()=>{
      try{ await copyPlainText(shareUrl); if (shareTip) shareTip.textContent = '링크를 복사했습니다. (붙여넣기)'; }
      catch{ if (shareTip) shareTip.textContent = '복사 실패'; }
      setTimeout(()=>{ if(shareTip) shareTip.textContent=''; }, 2000);
    });
  }

  // =========================
  // 좋아요/싫어요
  // =========================
  async function getMyReaction(reviewId){
    const session = await window.mmAuth.getSession();
    const uid = session?.user?.id;
    if(!uid) return null;
    const { data, error } = await sb
      .from('reactions')
      .select('kind')
      .eq('review_id', reviewId)
      .eq('user_id', uid)
      .limit(1);
    if(error) return null;
    return (data && data[0]) ? data[0].kind : null;
  }
  async function countReaction(reviewId, kind){
    const { count } = await sb
      .from('reactions')
      .select('*', { count:'exact', head:true })
      .eq('review_id', reviewId)
      .eq('kind', kind);
    return count || 0;
  }
  async function toggleReaction(reviewId, kind){
    const session = await window.mmAuth.getSession();
    if(!session?.user){ alert('로그인이 필요합니다.'); return; }
    const uid = session.user.id;
    const { data: curRows } = await sb
      .from('reactions')
      .select('id, kind')
      .eq('review_id', reviewId).eq('user_id', uid).limit(1);
    const cur = curRows?.[0] || null;

    if(cur && cur.kind === kind){
      await sb.from('reactions').delete().eq('review_id', reviewId).eq('user_id', uid);
    }else if(cur && cur.kind !== kind){
      await sb.from('reactions').update({ kind }).eq('review_id', reviewId).eq('user_id', uid);
    }else{
      await sb.from('reactions').insert({ review_id: reviewId, user_id: uid, kind });
    }
    await renderReactions(reviewId);
  }
  async function renderReactions(reviewId){
    const bar = document.getElementById('reactBar');
    if(!bar) return;
    const [likes, dislikes, mine] = await Promise.all([
      countReaction(reviewId, 'like'),
      countReaction(reviewId, 'dislike'),
      getMyReaction(reviewId)
    ]);
    bar.innerHTML = `
      <button type="button" class="btn-chip ${mine==='like'?'active':''}" id="btnLike">👍 좋아요 ${likes}</button>
      <button type="button" class="btn-chip ${mine==='dislike'?'active':''}" id="btnDislike">👎 싫어요 ${dislikes}</button>
    `;
    document.getElementById('btnLike')?.addEventListener('click', ()=> toggleReaction(reviewId, 'like'));
    document.getElementById('btnDislike')?.addEventListener('click', ()=> toggleReaction(reviewId, 'dislike'));
  }

  // =========================
  // 댓글
  // =========================
  async function fetchCommentsSafe(reviewId){
    let res = await sb
      .from('comments')
      .select('id, user_id, nickname, author_email, content, created_at, is_secret')
      .eq('review_id', reviewId)
      .order('created_at', { ascending:true });
    if (res.error && /is_secret|schema cache/i.test(res.error.message||'')) {
      let res2 = await sb
        .from('comments')
        .select('id, user_id, nickname, author_email, content, created_at')
        .eq('review_id', reviewId)
        .order('created_at', { ascending:true });
      if (!res2.error && Array.isArray(res2.data)) {
        res2.data = res2.data.map(c => ({ ...c, is_secret:false }));
      }
      return res2;
    }
    return res;
  }
  async function insertCommentSafe(row){
    let res = await sb.from('comments').insert(row);
    if (res.error && /is_secret|schema cache/i.test(res.error.message||'')) {
      const { is_secret, ...row2 } = row;
      res = await sb.from('comments').insert(row2);
    }
    return res;
  }
  async function renderComments(reviewId, ownerUserId){
    const list = document.getElementById('commentList');
    const form = document.getElementById('commentForm');
    const hint = document.getElementById('commentLoginHint');
    if(!list) return;

    const { data, error } = await fetchCommentsSafe(reviewId);
    if(error){
      list.innerHTML = `<div class="muted">댓글 로드 실패: ${escapeHtml(error.message)}</div>`;
    }else if(!data?.length){
      list.innerHTML = `<div class="muted">아직 댓글이 없습니다.</div>`;
    }else{
      const session = await window.mmAuth.getSession();
      const myId = session?.user?.id || null;
      list.innerHTML = data.map(c=>{
        const name = c.nickname || (c.author_email ? c.author_email.split('@')[0] : '익명');
        const canDel = myId && c.user_id && (myId === c.user_id);
        const canEdit = canDel;
        const canSee = !c.is_secret
                    || (myId && c.user_id && myId === c.user_id)
                    || window.mmAuth.isAdmin(session)
                    || (ownerUserId && myId === ownerUserId);
        const contentHtml = canSee ? escapeHtml(c.content||'') : '비밀 댓글입니다.';
        return `
          <div class="comment-item" data-id="${c.id}">
            <div class="comment-head">
              <span>${escapeHtml(name)} · ${fmtDate(c.created_at)}</span>
              ${canEdit ? `<button class="btn secondary btn-sm" data-edit="${c.id}">수정</button>` : ``}
              ${canDel ? `<button class="btn secondary btn-sm" data-del="${c.id}">삭제</button>` : ``}
            </div>
            <div class="comment-body" data-raw="${encodeURIComponent(c.content||'')}">${contentHtml}</div>
          </div>
        `;
      }).join('');

      list.querySelectorAll('[data-del]').forEach(btn=>{
        btn.addEventListener('click', async (e)=>{
          e.preventDefault();
          const id = btn.getAttribute('data-del');
          if(!confirm('댓글을 삭제할까요?')) return;
          const del = await sb.from('comments').delete().eq('id', id);
          if(del.error) return alert('삭제 실패: '+del.error.message);
          await renderComments(reviewId, ownerUserId);
        });
      });

      list.querySelectorAll('[data-edit]').forEach(btn=>{
        btn.addEventListener('click', async (e)=>{
          e.preventDefault();
          const id   = btn.getAttribute('data-edit');
          const item = btn.closest('.comment-item');
          const body = item.querySelector('.comment-body');
          if (!body || item._editing) return;
          item._editing = true;

          const original = decodeURIComponent(body.dataset.raw || '');
          body.innerHTML = '';

          const ta = document.createElement('textarea');
          ta.style.width = '100%';
          ta.style.minHeight = '70px';
          ta.value = original;
          body.appendChild(ta);

          const actions = document.createElement('div');
          actions.style.marginTop = '6px';
          const save = document.createElement('button');
          save.className = 'btn'; save.textContent = '저장';
          const cancel = document.createElement('button');
          cancel.className = 'btn secondary'; cancel.style.marginLeft = '6px'; cancel.textContent = '취소';
          actions.appendChild(save); actions.appendChild(cancel); body.appendChild(actions);

          save.addEventListener('click', async ()=>{
            const newText = ta.value.trim();
            if (!newText){ alert('내용을 입력하세요.'); return; }
            const session = await window.mmAuth.getSession();
            if (!session?.user){ alert('로그인이 필요합니다.'); return; }
            const up = await sb.from('comments').update({ content: newText }).eq('id', id);
            if (up.error){ alert('수정 실패: ' + up.error.message); return; }
            await renderComments(reviewId, ownerUserId);
          });

          cancel.addEventListener('click', ()=>{ renderComments(reviewId, ownerUserId); });
        });
      });
    }

    const session = await window.mmAuth.getSession();
    const loggedIn = !!session?.user;
    if(form) form.hidden = !loggedIn;
    if(hint) hint.hidden = loggedIn;

    if(form && !form._bound){
      form._bound = true;
      form.addEventListener('submit', async (e)=>{
        e.preventDefault();
        const ta = document.getElementById('commentText');
        const text = (ta?.value||'').trim();
        if(!text) return;

        const session = await window.mmAuth.getSession();
        if(!session?.user){ alert('로그인이 필요합니다.'); return; }

        const nick = window.mmAuth.isAdmin(session)
          ? '관리자'
          : (session.user.user_metadata?.full_name
             || (session.user.email ? session.user.email.split('@')[0] : '익명'));

        const secret = !!document.getElementById('commentSecret')?.checked;
        const ins = await insertCommentSafe({
          review_id: reviewId,
          user_id: session.user.id,
          author_email: session.user.email,
          nickname: nick,
          content: text,
          is_secret: secret
        });
        if(ins.error) return alert('등록 실패: '+ins.error.message);

        ta.value = '';
        await renderComments(reviewId, ownerUserId);
      });
    }
  }

  // =========================
  // 갤러리(읽기)
  // =========================
  async function renderGalleryLightbox(reviewId, fallbackUrl){
    const box = document.getElementById('galleryThumbs');
    const lb  = document.getElementById('lb');
    const lbImg = document.getElementById('lbImg');
    if(!box) return;

    let urls = [];
    try{
      let res = await sb
        .from('review_images')
        .select('id,url')
        .eq('review_id', reviewId)
        .order('created_at', { ascending:true });
      if (res.error) throw res.error;
      if (res.data?.length) urls = res.data.map(r=>r.url);
    }catch{
      try{
        const res2 = await sb
          .from('review_images')
          .select('id,url')
          .eq('review_id', reviewId)
          .order('id', { ascending:true });
        if (!res2.error && res2.data?.length) urls = res2.data.map(r=>r.url);
      }catch(e2){ console.warn('review_images fallback error', e2); }
    }

    if(!urls.length && fallbackUrl) urls = [fallbackUrl];
    if (!urls.length) console.warn('[review_images] 0장 반환');

    box.innerHTML = urls.map((u,i)=>`
      <div class="thumb-card"><img class="thumb-img" src="${u}" alt="" data-idx="${i}"></div>
    `).join('');

    const lbOk = lb && lbImg;
    if(!lbOk) return;
    let cur = 0;
    const openAt = (i)=>{ cur=i; lbImg.src=urls[cur]; lb.hidden=false; document.body.style.overflow='hidden'; };
    const close  = ()=>{ lb.hidden=true; document.body.style.overflow=''; };
    const prev   = ()=>{ cur=(cur-1+urls.length)%urls.length; lbImg.src=urls[cur]; };
    const next   = ()=>{ cur=(cur+1)%urls.length; lbImg.src=urls[cur]; };
    box.querySelectorAll('img.thumb-img').forEach(img=>{
      img.addEventListener('click', ()=> openAt(Number(img.dataset.idx)));
    });
    lb.querySelector('.lb-close')?.addEventListener('click', close);
    lb.querySelector('.lb-prev')?.addEventListener('click', prev);
    lb.querySelector('.lb-next')?.addEventListener('click', next);
    lb.addEventListener('click', (e)=>{ if(e.target===lb) close(); });
    document.addEventListener('keydown', (e)=>{
      if(lb.hidden) return;
      if(e.key==='Escape') close();
      if(e.key==='ArrowLeft') prev();
      if(e.key==='ArrowRight') next();
    });
  }

  // =========================
  // 편집 모드: 기존 이미지 썸네일/삭제
  // =========================
  async function renderEditImagesForEditMode(reviewId, fallbackUrl, fallbackPath){
    if (!editImages) return;
    editImages.hidden = false;
    editImages.innerHTML = '<div class="muted">기존 이미지를 불러오는 중…</div>';

    let rows = [];
    try{
      let res = await sb
        .from('review_images')
        .select('id,url,path,created_at')
        .eq('review_id', reviewId)
        .order('created_at', { ascending:true });
      if (!res.error && res.data) rows = res.data;
    }catch{
      try{
        const res2 = await sb
          .from('review_images')
          .select('id,url,path')
          .eq('review_id', reviewId)
          .order('id', { ascending:true });
        if (!res2.error && res2.data) rows = res2.data;
      }catch(e2){ console.warn('review_images fallback error', e2); }
    }
    if ((!rows || !rows.length) && fallbackUrl){
      rows = [{ id: null, url: fallbackUrl, path: fallbackPath || null, _legacy: true }];
    }

    if (!rows.length){
      editImages.innerHTML = `<div class="muted">기존 이미지가 없습니다.</div>`;
      return;
    }

    editImages.innerHTML = rows.map(r => `
      <div class="thumb-card">
        <img class="thumb-img" src="${r.url}" alt="">
        <label style="font-size:13px;color:#444;margin-top:6px; display:block; text-align:center">
          <input type="checkbox"
            data-del="img"
            data-imgid="${r.id ?? ''}"
            data-path="${r.path ?? ''}"
            data-legacy="${r._legacy ? '1':'0'}"
          /> 삭제
        </label>
      </div>
    `).join('');
  }

  async function enterEditModeById(editId){
    const { data, error } = await sb
      .from('reviews')
      .select('id, title, content, image_url, image_path, is_notice')
      .eq('id', editId).single();
    if (error){ alert('글 불러오기 실패: ' + error.message); return; }

    showWrite();
    if (fTitle)   fTitle.value   = data.title   || '';
    if (fContent) fContent.value = data.content || '';
    if (writeForm){
      writeForm.dataset.editing = data.id;
      writeForm._editingLegacy  = { url: data.image_url, path: data.image_path };
    }
    const editBox = document.getElementById('editImages');
    if (editBox) editBox.hidden = false;
    await renderEditImagesForEditMode(data.id, data.image_url, data.image_path);

    const session = await window.mmAuth.getSession();
    if (window.mmAuth.isAdmin(session)) {
      document.getElementById('noticeBox')?.removeAttribute('hidden');
      const cb2 = document.getElementById('isNotice');
      if (cb2) cb2.checked = !!data.is_notice;
    }
  }

  async function getCurrentImageCount(reviewId) {
    const { data: imgs, error } = await sb
      .from('review_images')
      .select('id')
      .eq('review_id', reviewId);
    const countDb = error ? 0 : (imgs?.length || 0);

    let legacy = 0;
    try {
      const { data: r } = await sb.from('reviews')
        .select('image_url').eq('id', reviewId).single();
      if (r?.image_url) legacy = 1;
    } catch {}

    const toDel = document.querySelectorAll('input[data-del="img"]:checked').length;
    return Math.max(0, countDb + legacy - toDel);
  }

  // 새 이미지 선택 미리보기
  fImage?.addEventListener('change', ()=>{
    let existing = 0;
    if (editImages && !editImages.hidden){
      existing = editImages.querySelectorAll('input[data-del="img"]').length
               - editImages.querySelectorAll('input[data-del="img"]:checked').length;
    }
    const slot = Math.max(0, MAX_FILES - existing);
    const newly = Array.from(fImage.files || []);
    const key = f => `${f.name}__${f.size}__${f.lastModified}`;
    const map = new Map();
    [...chosenFiles, ...newly].forEach(f => { if (!map.has(key(f))) map.set(key(f), f); });
    let next = Array.from(map.values());

    if (next.length > slot){
      if (formStatus) formStatus.textContent =
        `이미지는 최대 ${MAX_FILES}장까지 가능합니다. (현재 ${next.length}→${slot}장으로 제한)`;
      next = next.slice(0, slot);
    }else{
      if (formStatus) formStatus.textContent = '';
    }
    chosenFiles = next;

    if (preview){ preview.hidden = true; preview.removeAttribute('src'); }
    if (!selectPreviews) return;
    selectPreviews.innerHTML = '';
    chosenFiles.forEach(f=>{
      const url = URL.createObjectURL(f);
      const wrap = document.createElement('div');
      wrap.className = 'thumb-card';
      const img = document.createElement('img');
      img.className = 'thumb-img';
      img.src = url;
      wrap.appendChild(img);
      selectPreviews.appendChild(wrap);
    });
    try{ fImage.value = ''; }catch{}
  });

  // 저장(신규/편집)
  writeForm?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const session = await window.mmAuth.getSession();
    if(!session?.user){ alert('로그인이 필요합니다.'); return; }

    const title = fTitle.value.trim();
    const content = fContent.value.trim();
    if(!content){ formStatus.textContent = "내용을 입력하세요."; return; }
    const editingId = writeForm?.dataset?.editing;

    btnSubmit.disabled = true; btnSubmit.textContent = "저장 중…";
    try{
      const nickname = window.mmAuth.isAdmin(session)
        ? '관리자'
        : ((session.user.user_metadata?.full_name) || (session.user.email?.split('@')[0]) || '익명');

      let image_path=null, image_url=null;

      if (editingId){
        const noticeFlag = window.mmAuth.isAdmin(session) ? !!document.getElementById('isNotice')?.checked : false;
        const upd = await sb.from('reviews').update({ title, content, is_notice: noticeFlag }).eq('id', editingId);
        if(upd.error) throw new Error(upd.error.message);

        const dels = Array.from(document.querySelectorAll('input[data-del="img"]:checked'));
        const pathsToRemove = [];
        for (const el of dels){
          const isLegacy = el.getAttribute('data-legacy') === '1';
          const path = el.getAttribute('data-path') || '';
          const imgId = el.getAttribute('data-imgid') || null;

          if (!isLegacy && imgId){
            const del = await sb.from('review_images').delete().eq('id', imgId);
            if (del.error) console.warn('review_images 삭제 실패:', del.error.message);
          }
          if (isLegacy){
            try { await sb.from('reviews').update({ image_url: null, image_path: null }).eq('id', editingId); }
            catch (e) { console.warn('legacy 컬럼 정리 실패', e); }
          }
          if (path) pathsToRemove.push(path);
        }
        if (pathsToRemove.length){
          try { await sb.storage.from('reviews').remove(pathsToRemove); }
          catch (e) { console.warn('storage remove 실패', e); }
        }

        const currentCount = await getCurrentImageCount(editingId);
        const remain = Math.max(0, MAX_FILES - currentCount);
        const files = (chosenFiles.length ? chosenFiles : Array.from(fImage.files || [])).slice(0, remain);

        const uploaded = [];
        for (const file of files){
          const ext=(file.name.split('.').pop()||'jpg').toLowerCase();
          const safeExt=["jpg","jpeg","png","webp","gif"].includes(ext)?ext:"jpg";
          const key=`${(session.user.id)}/${Date.now()}_${Math.random().toString(36).slice(2)}.${safeExt}`;
          const up=await sb.storage.from("reviews").upload(key,file,{upsert:false,cacheControl:"3600"});
          if(up.error) throw new Error("이미지 업로드 실패: "+up.error.message);
          const url = sb.storage.from("reviews").getPublicUrl(key).data.publicUrl;
          uploaded.push({ path:key, url });
        }
        if (uploaded.length){
          const add = await sb.from('review_images').insert(
            uploaded.map(u => ({ review_id: editingId, url: u.url, path: u.path }))
          );
          if (add.error) throw new Error('이미지 메타 저장 실패: ' + add.error.message);
        }
        location.href = `/reviews.html?id=${editingId}`;
        return;
      }

      // 신규 글
      const files = (chosenFiles.length ? chosenFiles : Array.from(fImage.files || [])).slice(0, MAX_FILES);
      const uploaded = [];
      for (const file of files){
        const ext=(file.name.split('.').pop()||'jpg').toLowerCase();
        const safeExt=["jpg","jpeg","png","webp","gif"].includes(ext)?ext:"jpg";
        const key=`${session.user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${safeExt}`;
        const up=await sb.storage.from("reviews").upload(key,file,{upsert:false,cacheControl:"3600"});
        if(up.error) throw new Error("이미지 업로드 실패: "+up.error.message);
        const url = sb.storage.from("reviews").getPublicUrl(key).data.publicUrl;
        uploaded.push({ path:key, url });
      }
      if (uploaded[0]) { image_path = uploaded[0].path; image_url = uploaded[0].url; }

      const noticeFlag = window.mmAuth.isAdmin(session) ? !!document.getElementById('isNotice')?.checked : false;
      const ins = await sb.from("reviews").insert({
        title, content, is_notice: noticeFlag,
        user_id: session.user.id,
        author_email: session.user.email,
        nickname, image_path, image_url
      }).select("id").single();
      if(ins.error) throw new Error(ins.error.message);

      if (uploaded.length){
        const add = await sb.from('review_images').insert(
          uploaded.map(u => ({ review_id: ins.data.id, url: u.url, path: u.path }))
        );
        if (add.error) throw new Error('이미지 메타 저장 실패: ' + add.error.message);
      }
      location.href = '/reviews.html';
    }catch(err){
      formStatus.textContent = String(err.message||err);
      btnSubmit.disabled = false; btnSubmit.textContent = "저장";
    }
  });

  // =========================
  // 라우팅 & 부트스트랩
  // =========================
  async function init(){
    await refreshAuthUI();

    // 2.5초 후에도 '확인 중'이면 게스트 표시(모바일에서도 auth 박스는 기본 숨김)
    setTimeout(() => {
      const waitingLeft = authStatus?.textContent?.includes('확인 중');
      if (waitingLeft) {
        authStatus && (authStatus.textContent = '로그아웃 상태');
        authInfo   && (authInfo.textContent  = '로그아웃 상태');
        authTabs   && authTabs.removeAttribute('hidden');
        loginForm  && (loginForm.hidden = false);
        signupForm && (signupForm.hidden = true);
        try { setTab && setTab('login'); } catch {}
      }
    }, 2500);

    hideAuthForMobile(); // 모바일 기본 숨김

    const q = new URLSearchParams(location.search);
    const id = q.get('id');
    const compose = q.get('compose');
    const edit   = q.get('edit');

    if (id){
      showRead();
      await loadOne(id);
      return;
    }

    if (compose === '1'){
      const session = await window.mmAuth.waitForSession(3000);
      if (!session?.user){
        showList();
        await loadList();
        showAuthForMobile();
        return;
      }
      showWrite();
      if (window.mmAuth.isAdmin(session)) document.getElementById('noticeBox')?.removeAttribute('hidden');
      return;
    }

    if (edit){
      const session = await window.mmAuth.waitForSession(3000);
      if (!session?.user){
        showList();
        await loadList();
        showAuthForMobile();
        return;
      }
      await enterEditModeById(edit);
      if (window.mmAuth.isAdmin(session)) document.getElementById('noticeBox')?.removeAttribute('hidden');
      return;
    }

    // 기본: 목록
    try{
      showList();
    }catch(e){
      console.error('[showList error]', e);
      const v = _get(listView);
      if (v){ v.hidden = false; v.style.display = ''; }
    }
    await loadList();
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    const y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();
    init();
  });

  // 글쓰기 버튼
  document.getElementById('btn-compose')?.addEventListener('click', async (e)=>{
    e.preventDefault();
    const session = await window.mmAuth.waitForSession(3000);
    if (!session?.user){ showAuthForMobile(); return; }
    history.pushState(null,'','/reviews.html?compose=1');
    showWrite();
    if (window.mmAuth.isAdmin(session)) document.getElementById('noticeBox')?.removeAttribute('hidden');
  });

})();

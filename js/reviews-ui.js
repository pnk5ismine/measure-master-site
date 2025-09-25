// /js/reviews-ui.js
;(() => {
  if (!window.mmAuth) {
    console.error('[reviews-ui] mmAuth 가 먼저 로드되어야 합니다.');
    return;
  }
  const sb = window.mmAuth.sb;

  // ------- DOM refs -------
  const $ = sel => document.querySelector(sel);
  const els = {
    authInfo:   $('#authInfo'),
    authStatus: $('#authStatus'),
    authTabs:   $('#authTabs'),
    loginForm:  $('#loginForm'),
    signupForm: $('#signupForm'),
    loginStatus:  $('#loginStatus'),
    signupStatus: $('#signupStatus'),

    btnLogin:  $('#btn-login'),
    btnLogout: $('#btn-logout'),

    listView:  $('#listView'),
    readView:  $('#readView'),
    writeForm: $('#writeForm'),
    listBody:  $('#listBody'),
    btnCompose: $('#btn-compose'),
    btnSubmit:  $('#btn-submit'),
    formStatus: $('#formStatus'),

    fTitle:   $('#title'),
    fContent: $('#content'),
    fImage:   $('#image'),
    preview:  $('#preview'),
    selectPreviews: $('#selectPreviews'),
    editImages: $('#editImages'),

    noticeBox:  $('#noticeBox'),
    isNotice:   $('#isNotice')
  };

  const MAX_FILES = Number(els.fImage?.dataset?.max || 6);
  let chosenFiles = [];

  // ------- 유틸 -------
  function escapeHtml(s){return (s??'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]))}
  function fmtDate(iso){try{const d=new Date(iso);return d.toLocaleString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}catch{return iso||''}}
  function displayName(row){
    if (window.mmAuth.isAdminEmail(row?.author_email)) return '관리자';
    return row?.nickname || (row?.author_email ? row.author_email.split('@')[0] : '익명');
  }

  // 모바일 로그인 패널 토글(리뷰 페이지 전용)
  const isMobile = () => window.matchMedia('(max-width:700px)').matches;
  function showAuthForMobile(){
    if (!isMobile()) return;
    document.body.classList.add('show-auth');
    document.getElementById('leftAuth')?.scrollIntoView({ behavior:'smooth', block:'start' });
  }
  function hideAuthForMobile(){
    if (!isMobile()) return;
    document.body.classList.remove('show-auth');
  }

  // ------- 인증 UI 갱신 -------
  async function refreshAuthUI(session) {
    // session 인자가 없으면 최신 세션 조회
    if (!session) session = await window.mmAuth.getSession();
    const loggedIn = !!session?.user;

    if (els.authStatus) els.authStatus.textContent = loggedIn ? `로그인: ${session.user.email}` : '로그아웃 상태';
    if (els.authInfo)   els.authInfo.textContent   = loggedIn ? `로그인: ${session.user.email}` : '로그아웃 상태';

    // 로그인 폼/버튼 토글
    if (els.loginForm) els.loginForm.hidden = false;
    const emailField = $('#login-email')?.closest('.field');
    const pwField    = $('#login-password')?.closest('.field');

    if (loggedIn) {
      els.authTabs?.setAttribute('hidden','');
      els.signupForm?.setAttribute('hidden','');

      if (emailField) emailField.hidden = true;
      if (pwField)    pwField.hidden = true;
      if (els.btnLogin)  els.btnLogin.hidden = true;
      if (els.btnLogout) els.btnLogout.hidden = false;

      hideAuthForMobile();
    } else {
      els.authTabs?.removeAttribute('hidden');
      els.signupForm?.setAttribute('hidden','');

      if (emailField) emailField.hidden = false;
      if (pwField)    pwField.hidden = false;
      if (els.btnLogin)  els.btnLogin.hidden = false;
      if (els.btnLogout) els.btnLogout.hidden = true;

      if (isMobile()) document.body.classList.remove('show-auth'); // 기본은 숨김
    }
  }

  // ------- 뷰 전환 -------
  function showList(){ if(els.listView) els.listView.hidden=false; if(els.readView) els.readView.hidden=true; if(els.writeForm) els.writeForm.hidden=true; }
  function showRead(){ if(els.listView) els.listView.hidden=true;  if(els.readView) els.readView.hidden=false; if(els.writeForm) els.writeForm.hidden=true; }
  function showWrite(){if(els.listView) els.listView.hidden=true;  if(els.readView) els.readView.hidden=true;  if(els.writeForm) els.writeForm.hidden=false; }

  // ------- 목록 로드 -------
  async function loadList(){
    if (!els.listBody) return;
    const { data, error } = await sb.from('reviews')
      .select('id, title, content, nickname, author_email, created_at, view_count, is_notice')
      .order('is_notice', { ascending:false })
      .order('created_at', { ascending:false })
      .limit(100);

    if(error){
      els.listBody.innerHTML = `<tr><td colspan="5" class="muted">목록 로드 실패: ${escapeHtml(error.message)}</td></tr>`;
      return;
    }
    if(!data?.length){
      els.listBody.innerHTML = `<tr><td colspan="5" class="muted">등록된 후기가 없습니다.</td></tr>`;
      return;
    }

    // review_counts 뷰(있으면 사용)
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

    els.listBody.innerHTML = data.map((row, idx) => {
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

    els.listBody.querySelectorAll('tr.row-item').forEach(tr=>{
      tr.addEventListener('click',()=> location.href=`/reviews.html?id=${tr.dataset.id}`);
    });
  }

  // ------- 읽기(단건) -------
  async function loadOne(id){
    const { data, error } = await sb
      .from("reviews")
      .select("id, user_id, title, content, created_at, nickname, author_email, image_url, image_path, is_notice")
      .eq("id", id)
      .single();

    if(error){
      els.readView.innerHTML = `<p class="muted">불러오기 실패: ${escapeHtml(error.message)}</p>`;
      return;
    }

    // 세션이 늦게 올 수도 있으니 잠깐 대기
    const sess = await window.mmAuth.waitForSession(1200);
    const me = sess?.user || null;
    const isOwner = !!(me && data.user_id && me.id === data.user_id);
    const name = displayName(data);

    els.readView.innerHTML = `
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

    // 버튼 바인드
    document.getElementById('btn-to-compose')?.addEventListener('click', async ()=>{
      const s = await window.mmAuth.getSession();
      if (!s?.user){ showAuthForMobile(); return; }
      history.replaceState(null,'','/reviews.html?compose=1');
      showWrite();
      if (window.mmAuth.isAdminSession(s)) els.noticeBox?.removeAttribute('hidden');
    });

    document.getElementById('btn-edit')?.addEventListener('click', ()=>{
      history.replaceState(null,'', `/reviews.html?edit=${id}`);
      showWrite();
      if (els.fTitle)   els.fTitle.value   = data.title   || '';
      if (els.fContent) els.fContent.value = data.content || '';
      if (els.writeForm) {
        els.writeForm.dataset.editing = id;
        els.writeForm._editingLegacy  = { url: data.image_url || null, path: data.image_path || null };
      }
      if (window.mmAuth.isAdminSession(sess)) {
        els.noticeBox?.removeAttribute('hidden');
        if (els.isNotice) els.isNotice.checked = !!data.is_notice;
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

    // 반응/댓글/이미지/뷰카운트
    await renderReactions(id);
    await renderComments(id, data.user_id);
    await renderGalleryLightbox(id, data.image_url);
    try { await sb.rpc('inc_review_view', { _id: id }); } catch (e) { console.warn('view +1 실패', e); }

    // 공유
    const copyBtn  = document.getElementById('btnCopyLink');
    const shareTip = document.getElementById('shareTip');
    const shareUrl = `${location.origin}/reviews.html?id=${id}`;
    copyBtn?.addEventListener('click', async ()=>{
      try{
        await (navigator.clipboard?.writeText(shareUrl) ?? (async()=>{
          const ta=document.createElement('textarea'); ta.value=shareUrl; ta.style.position='fixed'; ta.style.left='-9999px';
          document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        })());
        if (shareTip) shareTip.textContent = '링크를 복사했습니다. (붙여넣기)';
      }catch{
        if (shareTip) shareTip.textContent = '복사 실패';
      }
      setTimeout(()=>{ if(shareTip) shareTip.textContent=''; }, 2000);
    });
  }

  // ------- 반응(좋아요/싫어요) -------
  async function getMyReaction(reviewId){
    const s = await window.mmAuth.getSession();
    const uid = s?.user?.id;
    if(!uid) return null;
    const { data, error } = await sb
      .from('reactions')
      .select('kind').eq('review_id', reviewId).eq('user_id', uid).limit(1);
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
    const s = await window.mmAuth.getSession();
    if(!s?.user){ alert('로그인이 필요합니다.'); return; }
    const uid = s.user.id;

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

  // ------- 댓글 -------
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
      const s = await window.mmAuth.getSession();
      const myId = s?.user?.id || null;
      list.innerHTML = data.map(c=>{
        const name = c.nickname || (c.author_email ? c.author_email.split('@')[0] : '익명');
        const canDel = myId && c.user_id && (myId === c.user_id);
        const canEdit = canDel;
        const canSee = !c.is_secret
                    || (myId && c.user_id && myId === c.user_id)
                    || window.mmAuth.isAdminSession(s)
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
          if (!body) return;
          if (item._editing) return;
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
          actions.appendChild(save); actions.appendChild(cancel);
          body.appendChild(actions);

          save.addEventListener('click', async ()=>{
            const newText = ta.value.trim();
            if (!newText){ alert('내용을 입력하세요.'); return; }
            const s = await window.mmAuth.getSession();
            if (!s?.user){ alert('로그인이 필요합니다.'); return; }
            const up = await sb.from('comments').update({ content: newText }).eq('id', id);
            if (up.error){ alert('수정 실패: ' + up.error.message); return; }
            await renderComments(reviewId, ownerUserId);
          });

          cancel.addEventListener('click', ()=>{
            renderComments(reviewId, ownerUserId);
          });
        });
      });
    }

    const s = await window.mmAuth.getSession();
    const loggedIn = !!s?.user;
    if(form) form.hidden = !loggedIn;
    if(hint) hint.hidden = loggedIn;

    if(form && !form._bound){
      form._bound = true;
      form.addEventListener('submit', async (e)=>{
        e.preventDefault();
        const ta = document.getElementById('commentText');
        const text = (ta?.value||'').trim();
        if(!text) return;

        const s = await window.mmAuth.getSession();
        if(!s?.user){ alert('로그인이 필요합니다.'); return; }

        const nick = window.mmAuth.isAdminSession(s)
          ? '관리자'
          : (s.user.user_metadata?.full_name || (s.user.email ? s.user.email.split('@')[0] : '익명'));

        const secret = !!document.getElementById('commentSecret')?.checked;
        const ins = await insertCommentSafe({
          review_id: reviewId,
          user_id: s.user.id,
          author_email: s.user.email,
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

  // ------- 갤러리 -------
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
      if (!res.error && res.data?.length) urls = res.data.map(r=>r.url);
    }catch{
      try{
        const res2 = await sb
          .from('review_images')
          .select('id,url')
          .eq('review_id', reviewId)
          .order('id', { ascending:true });
        if (!res2.error && res2.data?.length) urls = res2.data.map(r=>r.url);
      }catch(e2){
        console.warn('review_images fallback error', e2);
      }
    }
    if(!urls.length && fallbackUrl) urls = [fallbackUrl];

    box.innerHTML = urls.map((u,i)=>`
      <div class="thumb-card"><img class="thumb-img" src="${u}" alt="" data-idx="${i}"></div>
    `).join('');

    if(!(lb && lbImg)) return;
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

  // ------- 편집 이미지(기존) -------
  async function renderEditImagesForEditMode(reviewId, fallbackUrl, fallbackPath){
    const editImages = els.editImages;
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

  async function getCurrentImageCount(reviewId) {
    const { data: imgs, error } = await sb
      .from('review_images').select('id').eq('review_id', reviewId);
    const countDb = error ? 0 : (imgs?.length || 0);
    let legacy = 0;
    try {
      const { data: r } = await sb.from('reviews').select('image_url').eq('id', reviewId).single();
      if (r?.image_url) legacy = 1;
    } catch {}
    const toDel = document.querySelectorAll('input[data-del="img"]:checked').length;
    return Math.max(0, countDb + legacy - toDel);
  }

  // 새 이미지 선택 미리보기
  els.fImage?.addEventListener('change', ()=>{
    let existing = 0;
    if (els.editImages && !els.editImages.hidden){
      existing = els.editImages.querySelectorAll('input[data-del="img"]').length
              - els.editImages.querySelectorAll('input[data-del="img"]:checked').length;
    }
    const slot = Math.max(0, MAX_FILES - existing);
    const newly = Array.from(els.fImage.files || []);

    const key = f => `${f.name}__${f.size}__${f.lastModified}`;
    const map = new Map();
    [...chosenFiles, ...newly].forEach(f => { if (!map.has(key(f))) map.set(key(f), f); });
    let next = Array.from(map.values());
    if (next.length > slot){
      if (els.formStatus) els.formStatus.textContent = `이미지는 최대 ${MAX_FILES}장까지 가능합니다. (현재 ${next.length}→${slot}장으로 제한)`;
      next = next.slice(0, slot);
    } else {
      if (els.formStatus) els.formStatus.textContent = '';
    }
    chosenFiles = next;

    if (els.preview){ els.preview.hidden = true; els.preview.removeAttribute('src'); }
    if (!els.selectPreviews) return;
    els.selectPreviews.innerHTML = '';
    chosenFiles.forEach(f=>{
      const url = URL.createObjectURL(f);
      const wrap = document.createElement('div');
      wrap.className = 'thumb-card';
      const img = document.createElement('img');
      img.className = 'thumb-img';
      img.src = url;
      wrap.appendChild(img);
      els.selectPreviews.appendChild(wrap);
    });
    try{ els.fImage.value = ''; }catch{}
  });

  // 저장(신규/편집)
  els.writeForm?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const s = await window.mmAuth.getSession();
    if(!s?.user){ alert('로그인이 필요합니다.'); return; }
    const title = els.fTitle.value.trim();
    const content = els.fContent.value.trim();
    if(!content){ els.formStatus.textContent = "내용을 입력하세요."; return; }
    const editingId = els.writeForm?.dataset?.editing;

    els.btnSubmit.disabled = true; els.btnSubmit.textContent = "저장 중…";
    try{
      const nickname = window.mmAuth.isAdminSession(s)
        ? '관리자'
        : ((s.user.user_metadata?.full_name) || (s.user.email?.split('@')[0]) || '익명');

      let image_path=null, image_url=null;

      if (editingId){
        const noticeFlag = window.mmAuth.isAdminSession(s) ? !!els.isNotice?.checked : false;
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
        const files = (chosenFiles.length ? chosenFiles : Array.from(els.fImage.files || [])).slice(0, remain);

        const uploaded = [];
        for (const file of files){
          const ext=(file.name.split('.').pop()||'jpg').toLowerCase();
          const safeExt=["jpg","jpeg","png","webp","gif"].includes(ext)?ext:"jpg";
          const key=`${(s.user.id)}/${Date.now()}_${Math.random().toString(36).slice(2)}.${safeExt}`;
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

      // 신규
      const files = (chosenFiles.length ? chosenFiles : Array.from(els.fImage.files || [])).slice(0, MAX_FILES);
      const uploaded = [];
      for (const file of files){
        const ext=(file.name.split('.').pop()||'jpg').toLowerCase();
        const safeExt=["jpg","jpeg","png","webp","gif"].includes(ext)?ext:"jpg";
        const key=`${s.user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${safeExt}`;
        const up=await sb.storage.from("reviews").upload(key,file,{upsert:false,cacheControl:"3600"});
        if(up.error) throw new Error("이미지 업로드 실패: "+up.error.message);
        const url = sb.storage.from("reviews").getPublicUrl(key).data.publicUrl;
        uploaded.push({ path:key, url });
      }
      if (uploaded[0]) { image_path = uploaded[0].path; image_url = uploaded[0].url; }

      const noticeFlag = window.mmAuth.isAdminSession(s) ? !!els.isNotice?.checked : false;
      const ins = await sb.from("reviews").insert({
        title, content, is_notice: noticeFlag,
        user_id: s.user.id,
        author_email: s.user.email,
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
      els.formStatus.textContent = String(err.message||err);
      els.btnSubmit.disabled = false; els.btnSubmit.textContent = "저장";
    }
  });

  // ------- 라우팅 -------
  async function init(){
    // 상단 연도
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // 인증 UI를 즉시 반영 + 변경시 반영
    window.mmAuth.onChange(refreshAuthUI);

    // 모바일 기본: 로그인 패널 숨김(PC 영향 없음)
    hideAuthForMobile();

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
      const session = await window.mmAuth.waitForSession(2000);
      if (!session?.user){
        showList();
        await loadList();
        showAuthForMobile();   // 비로그인 시 로그인판 열기(모바일 전용)
        return;
      }
      showWrite();
      if (window.mmAuth.isAdminSession(session)) els.noticeBox?.removeAttribute('hidden');
      return;
    }

    if (edit){
      const session = await window.mmAuth.waitForSession(2000);
      if (!session?.user){
        showList();
        await loadList();
        showAuthForMobile();
        return;
      }
      await loadOne(edit); // 내용 읽은 뒤 편집 진입이 자연스럽지만, 여기선 목록부터 보여주고 편집 루트는 읽기뷰에서 진입하도록 일관 유지
      history.replaceState(null,'', `/reviews.html?id=${edit}`);
      return;
    }

    // 기본: 목록
    showList();
    await loadList();
  }

  // 공개 init
  window.MMReviews = { init };
})();

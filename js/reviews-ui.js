// /js/reviews-ui.js
// 일관 네이밍: elListView / elReadView / elWriteForm (reviews.html과 동일)
// 기능: 목록 로드, 행 클릭 → 읽기, 읽기 화면 렌더, 인증 상태 텍스트만 갱신
// 주의: 편집/삭제/댓글/리액션은 임시 비활성 (필요 시 이후 단계에서 추가)

var MMReviews = (function(){
  // -------- 공통 유틸 --------
  function $(s){ return document.querySelector(s); }
  function escapeHtml(s){
    if (s===null || s===undefined) return "";
    return String(s).replace(/[&<>"']/g, function(m){
      if (m==="&") return "&amp;";
      if (m==="<") return "&lt;";
      if (m===">") return "&gt;";
      if (m==='"') return "&quot;";
      return "&#39;";
    });
  }
  function fmtDate(iso){
    try{
      var d = new Date(iso);
      return d.toLocaleString("ko-KR",{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
    }catch(_){ return iso || ""; }
  }
  function displayName(row){
    var email = row && row.author_email ? row.author_email : "";
    try{
      if (window.mmAuth && typeof window.mmAuth.isAdmin === 'function' && window.mmAuth.isAdmin(email)) return "관리자";
    }catch(_){}
    if (row && row.nickname) return row.nickname;
    if (email){ var p = email.split("@"); return p[0] || "익명"; }
    return "익명";
  }
  function safeText(el, text){ if (el) el.textContent = text; }

  // -------- DOM refs (init에서 채움) --------
  var elAuthInfo   = null;
  var elAuthStatus = null;
  var fTitle = null, fContent = null;   // 제목/본문 입력
  var elBtnSubmit = null, elFormStatus = null; // 저장 버튼/상태 텍스트
  var elListView   = null;
  var elReadView   = null;
  var elWriteForm  = null;
  var elListBody   = null;
  var elBtnCompose = null;

  // -------- 뷰 전환 --------
  function showList(){
    if (elListView)  elListView.hidden = false;
    if (elReadView)  elReadView.hidden = true;
    if (elWriteForm) elWriteForm.hidden = true;
  }
  function showRead(){
    if (elListView)  elListView.hidden = true;
    if (elReadView)  elReadView.hidden = false;
    if (elWriteForm) elWriteForm.hidden = true;
  }
  function showWrite(){
    if (elListView)  elListView.hidden = true;
    if (elReadView)  elReadView.hidden = true;
    if (elWriteForm) elWriteForm.hidden = false;
  }

  // -------- 인증 텍스트 갱신 --------
  function refreshAuthUI(){
    return (window.mmAuth && window.mmAuth.getSession ? window.mmAuth.getSession() : Promise.resolve(null))
      .then(function(session){
        if (session && session.user){
          safeText(elAuthStatus, "로그인: " + (session.user.email||""));
          safeText(elAuthInfo,   "로그인: " + (session.user.email||""));
        } else {
          safeText(elAuthStatus, "로그아웃 상태");
          safeText(elAuthInfo,   "로그아웃 상태");
        }
      })
      .catch(function(){
        safeText(elAuthStatus, "로그아웃 상태");
        safeText(elAuthInfo,   "로그아웃 상태");
      });
  }

  // -------- 목록 --------
  function loadList(){
    if (!elListBody) return Promise.resolve();
    var sb = window.mmAuth && window.mmAuth.sb;
    if (!sb){
      elListBody.innerHTML = '<tr><td colspan="5" class="muted">로딩 실패: Supabase 클라이언트 준비 전</td></tr>';
      return Promise.resolve();
    }

    return sb.from('reviews')
      .select('id, title, content, nickname, author_email, created_at, view_count, is_notice')
      .order('is_notice', { ascending:false })
      .order('created_at', { ascending:false })
      .limit(100)
      .then(function(res){
        if (res.error){
          elListBody.innerHTML = '<tr><td colspan="5" class="muted">목록 로드 실패: '+escapeHtml(res.error.message)+'</td></tr>';
          return;
        }
        var data = res.data || [];
        if (!data.length){
          elListBody.innerHTML = '<tr><td colspan="5" class="muted">등록된 후기가 없습니다.</td></tr>';
          return;
        }

        // counts 조회 (없어도 진행)
        var ids = [];
        for (var i=0;i<data.length;i++) ids.push(data[i].id);

        function renderWithCounts(countMap){
          var html = "";
          for (var j=0;j<data.length;j++){
            var row = data[j];
            var stat = countMap[row.id] || { v: Number(row.view_count||0), c: 0 };
            var nick = escapeHtml(displayName(row));
            var titleHtml = row.title ? "["+escapeHtml(row.title)+"] " : "";
            var bodyHtml = (row.is_notice ? '<span class="notice-tag">[알림]</span> ' : '') + titleHtml + escapeHtml(row.content||"");
            var when = fmtDate(row.created_at);
            var trCls = row.is_notice ? "row-item notice" : "row-item";

            html += '<tr data-id="'+row.id+'" class="'+trCls+'" style="cursor:pointer">';
            html +=   '<td class="cell-no">'+(j+1)+'</td>';
            html +=   '<td class="cell-nick">'+nick+'</td>';
            html +=   '<td class="cell-body">';
            // 1줄 요약(닉네임 + 본문) — 모바일에서도 보이며, 닉네임은 .m-only 로 표시
            html +=     '<div class="m-line1"><span class="nick m-only">'+nick+'</span>'+bodyHtml+'</div>';
            // 2줄 요약(조회/시각) — 모바일에서만 보임 (CSS에서 .m-line2를 PC에선 display:none)
            html +=     '<div class="m-line2 m-only"><span>조회 '+stat.v+' ('+stat.c+')</span><span>'+when+'</span></div>';
            html +=   '</td>';
            html +=   '<td class="cell-stats">'+stat.v+' ('+stat.c+')</td>';
            html +=   '<td class="cell-time">'+when+'</td>';
            html += '</tr>';
          }
          elListBody.innerHTML = html;

          var trs = elListBody.querySelectorAll("tr.row-item");
          for (var k=0;k<trs.length;k++){
            (function(tr){
              tr.addEventListener("click", function(){
                var id = tr.getAttribute("data-id");
                // 같은 페이지 내 라우팅
                history.pushState(null, "", "/reviews.html?id=" + id);
                showRead();
                loadOne(id);
              });
            })(trs[k]);
          }
        }

        if (!ids.length){ renderWithCounts({}); return; }

        sb.from('review_counts')
          .select('review_id, view_count, comment_count')
          .in('review_id', ids)
          .then(function(r2){
            var map = {};
            if (!r2.error && r2.data){
              for (var i=0;i<r2.data.length;i++){
                var rr = r2.data[i];
                map[rr.review_id] = { v: Number(rr.view_count||0), c: Number(rr.comment_count||0) };
              }
            }
            renderWithCounts(map);
          })
          .catch(function(){ renderWithCounts({}); });
      })
      .catch(function(err){
        elListBody.innerHTML = '<tr><td colspan="5" class="muted">목록 로드 실패: '+escapeHtml(err && err.message)+'</td></tr>';
      });
  }

  // -------- 단건 읽기 --------
  function loadOne(id){
    if (!elReadView) return Promise.resolve();
    var sb = window.mmAuth && window.mmAuth.sb;
    if (!sb){
      elReadView.innerHTML = '<p class="muted">불러오기 실패: Supabase 클라이언트 준비 전</p>';
      return Promise.resolve();
    }

    return sb.from('reviews')
      .select('id, user_id, title, content, created_at, nickname, author_email, image_url, image_path, is_notice')
      .eq('id', id).single()
      .then(function(r){
        if (r.error){
          elReadView.innerHTML = '<p class="muted">불러오기 실패: '+escapeHtml(r.error.message)+'</p>';
          return;
        }
        var data = r.data;

        return (window.mmAuth.getSession ? window.mmAuth.getSession() : Promise.resolve(null))
          .then(function(sess){
            var me = sess && sess.user ? sess.user : null;
            var isOwner = !!(me && data.user_id && me.id === data.user_id);
            var name = displayName(data);
            var title = (data.is_notice ? "[알림] " : "") + (data.title || "(제목 없음)");

            var html = "";
            html += '<div class="top-actions">';
            html += '  <a class="btn secondary" href="/reviews.html">목록보기</a>';
            html += '  <div style="display:flex; gap:8px; align-items:center">';
            html += '    <button class="btn" type="button" id="btn-to-compose">글쓰기</button>';
            if (isOwner){
              html += '    <button class="btn secondary" type="button" id="btn-edit">수정</button>';
              html += '    <button class="btn secondary" type="button" id="btn-delete">삭제</button>';
            }
            html += '  </div>';
            html += '</div>';

            html += '<h3 style="margin:0 0 6px">'+escapeHtml(title)+'</h3>';
            html += '<div class="muted" style="margin-bottom:10px">'+escapeHtml(name)+' · '+fmtDate(data.created_at)+'</div>';
            html += '<div style="white-space:pre-wrap;word-break:break-word">'+escapeHtml(data.content || "")+'</div>';

            html += '<div id="lb" class="lightbox" hidden>'
                  +   '<button class="lb-close" aria-label="닫기">×</button>'
                  +   '<button class="lb-prev" aria-label="이전">‹</button>'
                  +   '<img id="lbImg" alt="">'
                  +   '<button class="lb-next" aria-label="다음">›</button>'
                  + '</div>';
            html += '<div id="galleryThumbs" class="thumbs" style="margin-top:12px"></div>';

            html += '<div class="bottom-actions">';
            html += '  <button class="btn secondary icon" type="button" id="btnCopyLink" title="링크 복사">🔗 <span>공유</span></button>';
            html += '  <span id="shareTip" class="status"></span>';
            html += '</div>';

            elReadView.innerHTML = html;

            renderGallery(id, data.image_url);

            // [EDIT] 수정 버튼 → 편집 모드로
            var btnEdit = document.getElementById('btn-edit');
            if (btnEdit){
              btnEdit.addEventListener('click', function(){
                window.mmAuth.getSession().then(function(sess){
                  var u = sess && sess.user;
                  var admin = u && window.mmAuth.isAdmin(u.email);
                  if (!u){ alert('로그인이 필요합니다.'); return; }
                  if (!admin && u.id !== data.user_id){ alert('본인 글만 수정할 수 있습니다.'); return; }

                  // 작성 폼으로 전환 + 값 프리필
                  showWrite();
                  if (fTitle)   fTitle.value   = data.title   || '';
                  if (fContent) fContent.value = data.content || '';
                  if (elWriteForm) elWriteForm.dataset.editing = data.id;

                  // 기존 이미지 간단 프리뷰(있으면)
                  var editBox = document.getElementById('editImages');
                  if (editBox){ editBox.hidden = false; }
                  renderEditImagesForEditMode(data.id, data.image_url);
                });
              });
            }

            // 글쓰기 버튼
            var btnToCompose = document.getElementById('btn-to-compose');
            if (btnToCompose){
              btnToCompose.addEventListener('click', function(){
                (window.mmAuth.getSession ? window.mmAuth.getSession() : Promise.resolve(null))
                  .then(function(s){
                    if (!s || !s.user){ alert('로그인이 필요합니다.'); return; }
                    history.replaceState(null, '', '/reviews.html?compose=1');
                    showWrite();
                  });
              });
            }

            // 조회수 +1 (Promise일 때만 then 핸들링)
            try{
              var p = (sb && typeof sb.rpc === 'function') ? sb.rpc('inc_review_view', { _id: id }) : null;
              if (p && typeof p.then === 'function'){
                p.then(function(){}, function(e){ console.warn('[reviews] view +1 실패:', e && e.message); });
              }
            }catch(e){
              console.warn('[reviews] view +1 예외:', e && e.message);
            }

            // 공유
            var copyBtn  = document.getElementById('btnCopyLink');
            var shareTip = document.getElementById('shareTip');
            var shareUrl = location.origin + '/reviews.html?id=' + id;
            function copyPlainText(text){
              if (navigator.clipboard && window.isSecureContext){
                return navigator.clipboard.writeText(text);
              }
              return new Promise(function(resolve, reject){
                try{
                  var ta = document.createElement('textarea');
                  ta.value = text;
                  ta.setAttribute('readonly','');
                  ta.style.position='fixed';
                  ta.style.left='-9999px';
                  document.body.appendChild(ta);
                  ta.select();
                  var ok = document.execCommand('copy');
                  document.body.removeChild(ta);
                  ok ? resolve() : reject(new Error('execCommand copy 실패'));
                }catch(err){ reject(err); }
              });
            }
            if (copyBtn){
              copyBtn.addEventListener('click', function(){
                copyPlainText(shareUrl).then(function(){
                  if (shareTip) shareTip.textContent = '링크를 복사했습니다. (붙여넣기)';
                  setTimeout(function(){ if (shareTip) shareTip.textContent=''; }, 2000);
                }, function(){
                  if (shareTip) shareTip.textContent = '복사 실패';
                  setTimeout(function(){ if (shareTip) shareTip.textContent=''; }, 2000);
                });
              });
            }
          });
      })
      .catch(function(err){
        elReadView.innerHTML = '<p class="muted">불러오기 실패: '+escapeHtml(err && err.message)+'</p>';
      });
  }
  // -------- 갤러리(읽기) --------
  function renderGallery(reviewId, fallbackUrl){
    var box   = document.getElementById('galleryThumbs');
    var lb    = document.getElementById('lb');
    var lbImg = document.getElementById('lbImg');
    if (!box) return;

    var sb = window.mmAuth && window.mmAuth.sb;
    if (!sb){ box.innerHTML=''; return; }

    function render(urls){
      if (!urls || !urls.length){ box.innerHTML=''; return; }
      var html = '';
      for (var i=0;i<urls.length;i++){
        html += '<div class="thumb-card"><img class="thumb-img" src="'+urls[i]+'" alt="" data-idx="'+i+'"></div>';
      }
      box.innerHTML = html;

      if (!lb || !lbImg) return;
      var cur = 0;
      function openAt(i){ cur=i; lbImg.src=urls[cur]; lb.hidden=false; document.body.style.overflow='hidden'; }
      function close(){ lb.hidden=true; document.body.style.overflow=''; }
      function prev(){ cur=(cur-1+urls.length)%urls.length; lbImg.src=urls[cur]; }
      function next(){ cur=(cur+1)%urls.length; lbImg.src=urls[cur]; }

      var imgs = box.querySelectorAll('img.thumb-img');
      for (var k=0;k<imgs.length;k++){
        (function(img){
          img.addEventListener('click', function(){
            var idx = parseInt(img.getAttribute('data-idx'),10) || 0;
            openAt(idx);
          });
        })(imgs[k]);
      }

      var btnClose = lb.querySelector('.lb-close');
      var btnPrev  = lb.querySelector('.lb-prev');
      var btnNext  = lb.querySelector('.lb-next');
      if (btnClose) btnClose.addEventListener('click', close);
      if (btnPrev)  btnPrev.addEventListener('click', prev);
      if (btnNext)  btnNext.addEventListener('click', next);
      lb.addEventListener('click', function(e){ if (e.target===lb) close(); });
      document.addEventListener('keydown', function(e){
        if (lb.hidden) return;
        if (e.key==='Escape') close();
        if (e.key==='ArrowLeft') prev();
        if (e.key==='ArrowRight') next();
      });
    }

    // 1차: review_images에서 불러오기
    sb.from('review_images')
      .select('id,url')
      .eq('review_id', reviewId)
      .order('created_at', { ascending:true })
      .then(function(res){
        if (res.error){
          // created_at 없는 경우 대비: id 기준 재시도
          return sb.from('review_images')
                   .select('id,url')
                   .eq('review_id', reviewId)
                   .order('id', { ascending:true });
        }
        return res;
      })
      .then(function(res2){
        var urls = [];
        if (!res2.error && res2.data && res2.data.length){
          for (var i=0;i<res2.data.length;i++){
            var u = res2.data[i] && res2.data[i].url;
            if (u) urls.push(u);
          }
        }
        if (!urls.length && fallbackUrl) urls = [fallbackUrl];
        render(urls);
      })
      .catch(function(){
        if (fallbackUrl) render([fallbackUrl]); else render([]);
      });
  }


  // -------- 부트스트랩 & 라우팅 --------
  function init(){
    // 1) DOM 캐시
    elAuthInfo   = $("#authInfo");
    elAuthStatus = $("#authStatus");
    elListView   = $("#listView");
    elReadView   = $("#readView");
    elWriteForm  = $("#writeForm");
    elListBody   = $("#listBody");
    elBtnCompose = $("#btn-compose");
    fTitle       = $("#title");
    fContent     = $("#content");
    elBtnSubmit  = $("#btn-submit");
    elFormStatus = $("#formStatus");

    // [EDIT SAVE] 저장(편집 전용)
    if (elWriteForm && !elWriteForm._bindSubmit){
      elWriteForm._bindSubmit = true;
      elWriteForm.addEventListener('submit', function(e){
        e.preventDefault();
        var sb = window.mmAuth && window.mmAuth.sb;
        if (!sb){ alert('클라이언트 준비 전'); return; }
        var title   = fTitle ? fTitle.value.trim() : '';
        var content = fContent ? fContent.value.trim() : '';
        var editingId = elWriteForm && elWriteForm.dataset ? elWriteForm.dataset.editing : '';
        if (!editingId){ alert('편집 중인 글이 없습니다.'); return; }
        if (!content){ if (elFormStatus) elFormStatus.textContent = '내용을 입력하세요.'; return; }
        if (elBtnSubmit){ elBtnSubmit.disabled = true; elBtnSubmit.textContent = '저장 중…'; }

        sb.from('reviews').update({ title:title, content:content }).eq('id', editingId)
          .then(function(r){
            if (r.error){ throw r.error; }
            location.href = '/reviews.html?id=' + editingId;
          })
          .catch(function(err){
            if (elFormStatus) elFormStatus.textContent = '저장 실패: ' + (err && err.message);
            if (elBtnSubmit){ elBtnSubmit.disabled = false; elBtnSubmit.textContent = '저장'; }
          });
      });
    }


    // 2) auth 모듈 준비 후 진행
    if (window.mmAuth && typeof window.mmAuth.whenReady === 'function'){
      window.mmAuth.whenReady(function(){
        refreshAuthUI();

        var q = new URLSearchParams(location.search);
        var id = q.get("id");
        var compose = q.get("compose");
        var edit = q.get("edit");

        if (id){
          showRead();
          loadOne(id);
          return;
        }
        if (compose === "1"){
          // 비로그인도 목록 먼저
          showList();
          loadList().then(function(){
            (window.mmAuth.getSession ? window.mmAuth.getSession() : Promise.resolve(null))
              .then(function(s){
                if (!s || !s.user){ /* 로그인 유도 메시지 정도 */ }
                else { showWrite(); }
              });
          });
          return;
        }
        if (edit){
          // 로그인 필요. 비로그인이면 목록 먼저
          showList();
          loadList();
          console.log("[reviews] edit 모드는 로그인 후 구현 예정");
          return;
        }

        // 기본: 목록
        showList();
        loadList();
      });

      if (typeof window.mmAuth.onChange === 'function'){
        window.mmAuth.onChange(function(){ refreshAuthUI(); });
      }
    } else {
      // mmAuth가 없으면 목록만 시도
      showList();
      loadList();
    }

    // footer 연도
    var y = $("#year");
    if (y) y.textContent = (new Date()).getFullYear();
  }

  // 디버그
  function _debug(){
    console.log("[MMReviews] elements",
      !!elListView, !!elReadView, !!elWriteForm, !!elListBody);
    if (window.mmAuth && typeof window.mmAuth._debugPing === 'function'){
      window.mmAuth._debugPing();
    }
  }

  return { init: init, _debug: _debug };
})(); // IIFE 종료 (파일 반드시 이 줄로 끝나야 함)

/* /js/reviews-ui.js */
'use strict';

var MMReviews = (function(){
  // ---------- DOM refs ----------
  var $ = function(s){ return document.querySelector(s); };

  var elAuthInfo   = null;
  var elAuthStatus = null;

  var elListView   = null;  // id="listView"  (목록 뷰)
  var elReadView   = null;  // id="readView"  (읽기 뷰)
  var elWriteForm  = null;  // id="writeForm" (쓰기 뷰)
  var elListBody   = null;
  var elBtnCompose = null;
  var elBtnSubmit  = null;
  var elFormStatus = null;

  var fTitle = null, fContent = null, fImage = null, elSelectPreviews = null, elEditImages = null;

  var MAX_FILES = 6;
  var chosenFiles = [];
  var MOBILE_MAX = 700;

  function isMobile(){
    try { return window.matchMedia('(max-width:'+MOBILE_MAX+'px)').matches; }
    catch(_) { return false; }
  }
  // 모바일 인증 박스 토글(PC에는 영향 없음: CSS가 모바일에서만 숨김 처리)
 function showAuthPanel(){ document.body.classList.add('show-auth'); }
 function hideAuthPanel(){ document.body.classList.remove('show-auth'); }

  // ---------- 유틸 ----------
  function escapeHtml(s){
    if (s===null || s===undefined) return '';
    return String(s).replace(/[&<>"']/g, function(m){
      if (m==='&') return '&amp;';
      if (m=== '<') return '&lt;';
      if (m=== '>') return '&gt;';
      if (m==='"') return '&quot;';
      return '&#39;';
    });
  }
  function fmtDate(iso){
    try{
      var d = new Date(iso);
      return d.toLocaleString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
    }catch(_){ return iso || ''; }
  }
  function displayName(row){
    var email = row && row.author_email ? row.author_email : '';
    if (window.mmAuth && window.mmAuth.isAdmin(email)) return '관리자';
    if (row && row.nickname) return row.nickname;
    if (email){ var p = email.split('@'); return p[0] || '익명'; }
    return '익명';
  }
  function safeText(el, text){ if (el) el.textContent = text; }

  // ---------- 인증 UI(텍스트만) ----------
  function refreshAuthUI(){
    return window.mmAuth.getSession().then(function(session){
      if (session && session.user){
        var email = session.user.email || '';
        safeText(elAuthStatus, '로그인: ' + email);
        safeText(elAuthInfo,   '로그인: ' + email);
      } else {
        safeText(elAuthStatus, '로그아웃 상태');
        safeText(elAuthInfo,   '로그아웃 상태');
      }
    })['catch'](function(){
      safeText(elAuthStatus, '로그아웃 상태');
      safeText(elAuthInfo,   '로그아웃 상태');
    });
  }

  // ---------- 뷰 전환 ----------
  function showList(){ if(elListView) elListView.hidden=false; if(elReadView) elReadView.hidden=true; if(elWriteForm) elWriteForm.hidden=true; }
  function showRead(){ if(elListView) elListView.hidden=true;  if(elReadView) elReadView.hidden=false; if(elWriteForm) elWriteForm.hidden=true; }
  function showWrite(){if(elListView) elListView.hidden=true;  if(elReadView) elReadView.hidden=true;  if(elWriteForm) elWriteForm.hidden=false; }

  // ---------- 목록 로딩(항상 실행) ----------
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

        // review_counts 뷰(없어도 진행)
        var ids = [];
        for (var i=0;i<data.length;i++){ ids.push(data[i].id); }

       function renderWithCounts(map){
         var html = "";
         for (var j=0;j<data.length;j++){
           var row = data[j];
           var stat = map[row.id] || { v: Number(row.view_count||0), c: 0 };
           var nick = escapeHtml(displayName(row));
           var titleHtml = row.title ? "["+escapeHtml(row.title)+"] " : "";
           var bodyHtml = (row.is_notice ? '<span class="notice-tag">[알림]</span> ' : '') + titleHtml + escapeHtml(row.content||"");
           var when = fmtDate(row.created_at);
           var trCls = row.is_notice ? "row-item notice" : "row-item";
           html +=
             '<tr data-id="'+row.id+'" class="'+trCls+'" style="cursor:pointer">'
               + '<td class="cell-no">'+(j+1)+'</td>'
               + '<td class="cell-nick">'+nick+'</td>'
               + '<td class="cell-body">'
                 + '<div class="m-line1"><span class="nick m-only">'+nick+'</span>'+bodyHtml+'</div>'
                 + '<div class="m-line2 m-only"><span>조회 '+stat.v+' ('+stat.c+')</span><span>'+when+'</span></div>'
               + '</td>'
               + '<td class="cell-stats">'+stat.v+' ('+stat.c+')</td>'
               + '<td class="cell-time">'+when+'</td>'
             + '</tr>';
         }
         elListBody.innerHTML = html;

         // 행 클릭은 '한 번만' 붙는 위임 방식
         if (!elListBody._boundClick) {
           elListBody.addEventListener('click', function(ev){
             var tr = ev.target.closest('tr.row-item');
             if (!tr || !elListBody.contains(tr)) return;
             var id = tr.getAttribute('data-id');
             if (!id) return;
             window.location.href = '/reviews.html?id=' + encodeURIComponent(id);
           });
           elListBody._boundClick = true;
         }
       }

  // ---------- 단건 읽기 ----------
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

      return window.mmAuth.getSession().then(function(sess){
        var me = sess && sess.user ? sess.user : null;
        var isOwner = !!(me && data.user_id && me.id === data.user_id);
        var name = displayName(data);
        var title = (data.is_notice ? "[알림] " : "") + (data.title || "(제목 없음)");

        var html = '';
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

        html += '<div id="lb" class="lightbox" hidden>';
        html += '  <button class="lb-close" aria-label="닫기">×</button>';
        html += '  <button class="lb-prev" aria-label="이전">‹</button>';
        html += '  <img id="lbImg" alt="">';
        html += '  <button class="lb-next" aria-label="다음">›</button>';
        html += '</div>';

        html += '<div id="galleryThumbs" class="thumbs" style="margin-top:12px"></div>';
        html += '<div class="reaction-bar" id="reactBar"></div>';

        html += '<div class="comments" id="commentsBox">';
        html += '  <h4 style="margin:16px 0 8px">댓글</h4>';
        html += '  <div id="commentList"></div>';
        html += '  <form id="commentForm" class="comment-form" hidden>';
        html += '    <textarea id="commentText" placeholder="댓글을 입력해 주세요"></textarea>';
        html += '    <label style="display:flex;align-items:center;gap:6px;white-space:nowrap">';
        html += '      <input type="checkbox" id="commentSecret"> 비밀글';
        html += '    </label>';
        html += '    <button class="btn" id="btnComment">등록</button>';
        html += '  </form>';
        html += '  <div id="commentLoginHint" class="muted">댓글을 쓰려면 로그인하세요.</div>';
        html += '</div>';

        html += '<div class="bottom-actions">';
        html += '  <button class="btn secondary icon" type="button" id="btnCopyLink" title="링크 복사">🔗 <span>공유</span></button>';
        html += '  <span id="shareTip" class="status"></span>';
        html += '</div>';

        elReadView.innerHTML = html;

        // 글쓰기 이동
        var btnToCompose = document.getElementById('btn-to-compose');
        if (btnToCompose){
          btnToCompose.addEventListener('click', function(){
            window.mmAuth.getSession().then(function(s){
              if (!s || !s.user){ alert('로그인이 필요합니다.'); return; }
              history.replaceState(null, '', '/reviews.html?compose=1');
              showWrite();
            });
          });
        }

        // 조회수 +1 (안전 호출: Promise일 때만 then/catch)
        try{
          var p = (sb && typeof sb.rpc === 'function') ? sb.rpc('inc_review_view', { _id: id }) : null;
          if (p && typeof p.then === 'function'){
            p.then(function(){})["catch"](function(e){
              console.warn('[reviews] view +1 실패:', e && e.message);
            });
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
            })["catch"](function(){
              if (shareTip) shareTip.textContent = '복사 실패';
              setTimeout(function(){ if (shareTip) shareTip.textContent=''; }, 2000);
            });
          });
        }
      });
    })["catch"](function(err){
      elReadView.innerHTML = '<p class="muted">불러오기 실패: '+escapeHtml(err && err.message)+'</p>';
    });
}

  // ---------- 초기화 & 라우팅 ----------
  function init(){
    // DOM 캐시 (HTML id와 1:1)
    elAuthInfo   = $('#authInfo');
    elAuthStatus = $('#authStatus');

    elListView   = $('#listView');
    elReadView   = $('#readView');
    elWriteForm  = $('#writeForm');

    elListBody   = $('#listBody');
    elBtnCompose = $('#btn-compose');
    if (elBtnCompose){
      elBtnCompose.addEventListener('click', function(e){
        e.preventDefault();
        window.mmAuth.getSession().then(function(s){
          if (!s || !s.user){
            // 모바일: 인증 박스 노출(PC는 원래 보이니 그대로)
            showAuthPanel();
            // 최상단으로 부드럽게 스크롤
            (document.getElementById('leftAuth') || document.body)
              .scrollIntoView({ behavior:'smooth', block:'start' });
          }else{
            history.pushState(null,'','/reviews.html?compose=1');
            showWrite();
          }
        });
      });
    }

    elBtnSubmit  = $('#btn-submit');
    elFormStatus = $('#formStatus');

    fTitle = $('#title'); fContent = $('#content'); fImage = $('#image');
    elSelectPreviews = $('#selectPreviews');
    elEditImages     = $('#editImages');

    if (fImage && fImage.dataset && fImage.dataset.max){
      var n = parseInt(fImage.dataset.max,10);
      if (!isNaN(n)) MAX_FILES = n;
    }

    // 인증 모듈 준비 후 시작
    window.mmAuth.whenReady(function(){
      hideAuthPanel();
      refreshAuthUI();

      // 라우팅
      var q = new URLSearchParams(location.search);
      var id = q.get('id');
      var compose = q.get('compose');
      var edit = q.get('edit');

      if (id){
        showRead();
        loadOne(id);
        return;
      }

      if (compose === '1'){
        showList();
        loadList().then(function(){
          window.mmAuth.getSession().then(function(s){
            if (!s || !s.user){
              console.log('[reviews] compose=1 비로그인 상태');
            } else {
              showWrite();
            }
          });
        });
        return;
      }

      if (edit){
        // 편집 라우팅은 추후 확장
        showList();
        loadList();
        console.log('[reviews] edit 모드는 로그인 후 구현');
        return;
      }

      // 기본: 목록
      showList();
      loadList();
    });

    // 인증 상태 변화 → 텍스트만 갱신
    window.mmAuth.onChange(function(){ refreshAuthUI(); });

    var y = $('#year');
    if (y) y.textContent = (new Date()).getFullYear();
  }

  // 디버깅 헬퍼
  function _debug(){
    console.log('[MMReviews] elements',
      !!elListView, !!elReadView, !!elWriteForm, !!elListBody);
    if (window.mmAuth) window.mmAuth._debugPing();
  }
  return { init: init, _debug: _debug };
})();

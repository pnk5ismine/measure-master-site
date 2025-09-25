// /js/reviews-ui.js  (전면 교체)
var MMReviews = (function () {
  "use strict";

  // ---- util ----
  var $ = function (s) { return document.querySelector(s); };
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
    if (window.mmAuth && window.mmAuth.isAdmin && window.mmAuth.isAdmin(email)) return "관리자";
    if (row && row.nickname) return row.nickname;
    if (email){ var p = email.split("@"); return p[0] || "익명"; }
    return "익명";
  }
  function safeText(el, text){ if (el) el.textContent = text; }

  // ---- fixed DOM refs (ID는 기존 그대로) ----
  const elViewList  = document.getElementById("listView");
  const elReadView  = document.getElementById("readView");
  const elWriteForm = document.getElementById("writeForm");

  // ---- late DOM refs (init에서 채움) ----
  var elAuthInfo   = null;
  var elAuthStatus = null;
  var elListBody   = null;
  var elBtnCompose = null;
  var elBtnSubmit  = null;
  var elFormStatus = null;

  // ---- auth UI (텍스트만) ----
  function refreshAuthUI(){
    return (window.mmAuth && window.mmAuth.getSession
      ? window.mmAuth.getSession()
      : Promise.resolve(null)
    ).then(function(session){
      if (session && session.user){
        var em = session.user.email || "";
        safeText(elAuthStatus, "로그인: " + em);
        safeText(elAuthInfo,   "로그인: " + em);
      } else {
        safeText(elAuthStatus, "로그아웃 상태");
        safeText(elAuthInfo,   "로그아웃 상태");
      }
    }).catch(function(){
      safeText(elAuthStatus, "로그아웃 상태");
      safeText(elAuthInfo,   "로그아웃 상태");
    });
  }

  // ------ 뷰 전환 ------
  function showList(){ if(elViewList) elViewList.hidden=false; if(elReadView) elReadView.hidden=true; if(elWriteForm) elWriteForm.hidden=true; }
  function showRead(){ if(elViewList) elViewList.hidden=true;  if(elReadView) elReadView.hidden=false; if(elWriteForm) elWriteForm.hidden=true; }
  function showWrite(){if(elViewList) elViewList.hidden=true;  if(elReadView) elReadView.hidden=true;  if(elWriteForm) elWriteForm.hidden=false; }

  // ---- 목록 로딩 ----
  function loadList(){
    if (!elListBody) return Promise.resolve();
    var sb = window.mmAuth && window.mmAuth.sb;
    if (!sb){
      elListBody.innerHTML = '<tr><td colspan="5" class="muted">로딩 실패: Supabase 클라이언트 준비 전</td></tr>';
      return Promise.resolve();
    }

    return sb.from("reviews")
      .select("id, title, content, nickname, author_email, created_at, view_count, is_notice")
      .order("is_notice", { ascending:false })
      .order("created_at", { ascending:false })
      .limit(100)
      .then(function(res){
        if (res.error){
          elListBody.innerHTML = '<tr><td colspan="5" class="muted">목록 로드 실패: ' + escapeHtml(res.error.message) + '</td></tr>';
          return;
        }
        var data = res.data || [];
        if (!data.length){
          elListBody.innerHTML = '<tr><td colspan="5" class="muted">등록된 후기가 없습니다.</td></tr>';
          return;
        }

        var ids = data.map(function(r){ return r.id; });

        function renderWithCounts(countMap){
          var html = data.map(function(row, idx){
            var stat = countMap[row.id] || { v: Number(row.view_count||0), c: 0 };
            var nick = escapeHtml(displayName(row));
            var titleHtml = row.title ? "[" + escapeHtml(row.title) + "] " : "";
            var bodyHtml = (row.is_notice ? '<span class="notice-tag">[알림]</span> ' : '') +
                           titleHtml + escapeHtml(row.content || "");
            var when = fmtDate(row.created_at);
            var trCls = row.is_notice ? "row-item notice" : "row-item";

            return (
`<tr data-id="${row.id}" class="${trCls}" style="cursor:pointer">
  <td class="cell-no">${idx+1}</td>
  <td class="cell-nick">${nick}</td>
  <td class="cell-body">
    <div class="m-line1"><span class="nick m-only">${nick}</span>${bodyHtml}</div>
    <div class="m-line2 m-only"><span>조회 ${stat.v} (${stat.c})</span><span>${when}</span></div>
  </td>
  <td class="cell-stats">${stat.v} (${stat.c})</td>
  <td class="cell-time">${when}</td>
</tr>`
            );
          }).join("");

          elListBody.innerHTML = html;

          var trs = elListBody.querySelectorAll("tr.row-item");
          for (var k=0;k<trs.length;k++){
            trs[k].addEventListener("click", function(){
              var id = this.getAttribute("data-id");
              location.href = "/reviews.html?id=" + id;
            });
          }
        }

        if (!ids.length){ renderWithCounts({}); return; }

        sb.from("review_counts")
          .select("review_id, view_count, comment_count")
          .in("review_id", ids)
          .then(function(r2){
            var map = {};
            if (!r2.error && r2.data){
              for (var i=0;i<r2.data.length;i++){
                var rr = r2.data[i];
                map[rr.review_id] = {
                  v: Number(rr.view_count||0),
                  c: Number(rr.comment_count||0)
                };
              }
            }
            renderWithCounts(map);
          })
          .catch(function(){ renderWithCounts({}); });
      })
      .catch(function(err){
        elListBody.innerHTML = '<tr><td colspan="5" class="muted">목록 로드 실패: ' + escapeHtml(err && err.message) + '</td></tr>';
      });
  }

  // ---- 상세 읽기 ----
  function loadOne(id){
    if (!elReadView) return Promise.resolve();
    var sb = window.mmAuth && window.mmAuth.sb;
    if (!sb){
      elReadView.innerHTML = '<p class="muted">불러오기 실패: Supabase 클라이언트 준비 전</p>';
      return Promise.resolve();
    }

    return sb.from("reviews")
      .select("id, user_id, title, content, created_at, nickname, author_email, image_url, image_path, is_notice")
      .eq("id", id).single()
      .then(function(r){
        if (r.error){
          elReadView.innerHTML = '<p class="muted">불러오기 실패: ' + escapeHtml(r.error.message) + '</p>';
          return;
        }
        var data = r.data;

        return (window.mmAuth.getSession ? window.mmAuth.getSession() : Promise.resolve(null))
          .then(function(sess){
            var me = (sess && sess.user) ? sess.user : null;
            var isOwner = !!(me && data.user_id && me.id === data.user_id);
            var name = displayName(data);
            var title = (data.is_notice ? "[알림] " : "") + (data.title || "(제목 없음)");

            var html = (
`<div class="top-actions">
  <a class="btn secondary" href="/reviews.html">목록보기</a>
  <div style="display:flex; gap:8px; align-items:center">
    <button class="btn" type="button" id="btn-to-compose">글쓰기</button>
    ${isOwner ? `<button class="btn secondary" type="button" id="btn-edit">수정</button>` : ``}
    ${isOwner ? `<button class="btn secondary" type="button" id="btn-delete">삭제</button>` : ``}
  </div>
</div>

<h3 style="margin:0 0 6px">${escapeHtml(title)}</h3>
<div class="muted" style="margin-bottom:10px">${escapeHtml(name)} · ${fmtDate(data.created_at)}</div>
<div style="white-space:pre-wrap;word-break:break-word">${escapeHtml(data.content || "")}</div>

<div id="lb" class="lightbox" hidden>
  <button class="lb-close" aria-label="닫기">×</button>
  <button class="lb-prev" aria-label="이전">‹</button>
  <img id="lbImg" alt="">
  <button class="lb-next" aria-label="다음">›</button>
</div>

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

<div class="bottom-actions">
  <button class="btn secondary icon" type="button" id="btnCopyLink" title="링크 복사">🔗 <span>공유</span></button>
  <span id="shareTip" class="status"></span>
</div>`
            );

            elReadView.innerHTML = html;

            // “글쓰기” 버튼
            var btnToCompose = $("#btn-to-compose");
            if (btnToCompose){
              btnToCompose.addEventListener("click", function(){
                window.mmAuth.getSession().then(function(s){
                  if (!s || !s.user){
                    alert("로그인이 필요합니다.");
                    return;
                  }
                  history.replaceState(null, "", "/reviews.html?compose=1");
                  showWrite();
                });
              });
            }

            // 조회수 +1
            if (sb.rpc){
              sb.rpc("inc_review_view", { _id: id }).catch(function(e){
                console.warn("[reviews] view +1 실패:", e && e.message);
              });
            }

            // 공유
            var copyBtn  = $("#btnCopyLink");
            var shareTip = $("#shareTip");
            var shareUrl = location.origin + "/reviews.html?id=" + id;

            function copyPlainText(text){
              if (navigator.clipboard && window.isSecureContext){
                return navigator.clipboard.writeText(text);
              }
              return new Promise(function(resolve, reject){
                try{
                  var ta = document.createElement("textarea");
                  ta.value = text;
                  ta.setAttribute("readonly", "");
                  ta.style.position = "fixed";
                  ta.style.left = "-9999px";
                  document.body.appendChild(ta);
                  ta.select();
                  var ok = document.execCommand("copy");
                  document.body.removeChild(ta);
                  ok ? resolve() : reject(new Error("execCommand copy 실패"));
                }catch(err){ reject(err); }
              });
            }

            if (copyBtn){
              copyBtn.addEventListener("click", function(){
                copyPlainText(shareUrl).then(function(){
                  if (shareTip) shareTip.textContent = "링크를 복사했습니다. (붙여넣기)";
                  setTimeout(function(){ if (shareTip) shareTip.textContent=""; }, 2000);
                }).catch(function(){
                  if (shareTip) shareTip.textContent = "복사 실패";
                  setTimeout(function(){ if (shareTip) shareTip.textContent=""; }, 2000);
                });
              });
            }
          });
      })
      .catch(function(err){
        elReadView.innerHTML = '<p class="muted">불러오기 실패: ' + escapeHtml(err && err.message) + '</p>';
      });
  }

  // ---- init & routing ----
  function init(){
    // 늦게 잡는 캐시
    elAuthInfo   = $("#authInfo");
    elAuthStatus = $("#authStatus");
    elListBody   = $("#listBody");
    elBtnCompose = $("#btn-compose");
    elBtnSubmit  = $("#btn-submit");
    elFormStatus = $("#formStatus");

    // auth 준비 후 라우팅
    (window.mmAuth && window.mmAuth.whenReady
      ? window.mmAuth.whenReady
      : function(cb){ cb && cb(); }
    )(function(){
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
        showList();      // 비로그인이라도 목록 먼저
        loadList().then(function(){
          window.mmAuth.getSession().then(function(s){
            if (s && s.user){ showWrite(); }
          });
        });
        return;
      }
      if (edit){
        showList();
        loadList();
        console.log("[reviews] edit 모드는 로그인 후 구현");
        return;
      }

      // 기본: 목록
      showList();
      loadList();
    });

    // auth 상태변화 → 텍스트만 갱신
    if (window.mmAuth && window.mmAuth.onChange){
      window.mmAuth.onChange(function(){ refreshAuthUI(); });
    }

    // footer year
    var y = $("#year");
    if (y) y.textContent = (new Date()).getFullYear();
  }

  function _debug(){
    console.log("[MMReviews] elements",
      !!elViewList, !!elReadView, !!elWriteForm, !!elListBody);
    if (window.mmAuth && window.mmAuth._debugPing) window.mmAuth._debugPing();
  }

  return { init: init, _debug: _debug };
})();

// /js/reviews-ui.js
var MMReviews = (function(){
  // ---------- DOM refs ----------
  function $(s){ return document.querySelector(s); }

  var elAuthInfo   = null;
  var elAuthStatus = null;
  var elListView   = null;
  var elReadView   = null;
  var elWriteForm  = null;
  var elListBody   = null;
  var elBtnCompose = null;
  var elBtnSubmit  = null;
  var elFormStatus = null;

  var fTitle = null, fContent = null, fImage = null;
  var elSelectPreviews = null, elEditImages = null;

  var MAX_FILES = 6;
  var chosenFiles = []; // 새로 선택한 파일 누적(미리보기용)
  var MOBILE_MAX = 700;

  function isMobile(){
    try { return window.matchMedia("(max-width:"+MOBILE_MAX+"px)").matches; }
    catch(_){ return false; }
  }
  function safeText(el, s){ if(el) el.textContent = s; }
  function escapeHtml(s){
    if (s===null || s===undefined) return "";
    return String(s).replace(/[&<>"']/g, function(m){
      if(m==="&")return"&amp;"; if(m==="<")return"&lt;"; if(m===">")return"&gt;"; if(m==='"')return"&quot;"; return"&#39;";
    });
  }
  function fmtDate(iso){
    try{ var d=new Date(iso);
      return d.toLocaleString("ko-KR",{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
    }catch(_){ return iso||""; }
  }
  function displayName(row){
    var email = row && row.author_email ? row.author_email : "";
    if (window.mmAuth && window.mmAuth.isAdmin(email)) return "관리자";
    if (row && row.nickname) return row.nickname;
    if (email){ var p=email.split("@"); return p[0]||"익명"; }
    return "익명";
  }

  // ---------- 인증 UI(좌측 패널) ----------
  function refreshAuthUI(){
    return window.mmAuth.getSession().then(function(session){
      var logged = !!(session && session.user);
      safeText(elAuthStatus, logged ? ("로그인: "+(session.user.email||"")) : "로그아웃 상태");
      safeText(elAuthInfo,   logged ? ("로그인: "+(session.user.email||"")) : "로그아웃 상태");

      // 좌측 로그인 패널의 버튼/필드 토글
      var authTabs   = $("#authTabs");
      var loginForm  = $("#loginForm");
      var signupForm = $("#signupForm");
      var btnLogin   = $("#btn-login");
      var btnLogout  = $("#btn-logout");
      var loginEmailField = $("#login-email") ? $("#login-email").closest(".field") : null;
      var loginPwField    = $("#login-password") ? $("#login-password").closest(".field") : null;

      if (logged){
        if (authTabs) authTabs.setAttribute("hidden","");
        if (signupForm) signupForm.setAttribute("hidden","");
        if (loginForm)  loginForm.hidden = false;
        if (loginEmailField) loginEmailField.hidden = true;
        if (loginPwField)    loginPwField.hidden = true;
        if (btnLogin)  btnLogin.hidden  = true;
        if (btnLogout) btnLogout.hidden = false;
      }else{
        if (authTabs) authTabs.removeAttribute("hidden");
        if (signupForm) signupForm.setAttribute("hidden","");
        if (loginForm)  loginForm.hidden = false;
        if (loginEmailField) loginEmailField.hidden = false;
        if (loginPwField)    loginPwField.hidden = false;
        if (btnLogin)  btnLogin.hidden  = false;
        if (btnLogout) btnLogout.hidden = true;
      }
    })["catch"](function(){
      safeText(elAuthStatus,"로그아웃 상태");
      safeText(elAuthInfo,"로그아웃 상태");
    });
  }

  // ---------- 목록 ----------
  function attachRowClicks(){
    if (!elListBody) return;
    var trs = elListBody.querySelectorAll("tr.row-item");
    for (var k=0;k<trs.length;k++){
      (function(tr){
        tr.addEventListener("click", function(){
          var id = tr.getAttribute("data-id");
          location.href = "/reviews.html?id=" + id;
        });
      })(trs[k]);
    }
  }

  function loadList(){
    if (!elListBody) return Promise.resolve();
    var sb = window.mmAuth && window.mmAuth.sb;
    if (!sb){
      elListBody.innerHTML = '<tr><td colspan="5" class="muted">로딩 실패: Supabase 준비 전</td></tr>';
      return Promise.resolve();
    }
    return sb.from("reviews")
      .select("id, title, content, nickname, author_email, created_at, view_count, is_notice")
      .order("is_notice",{ascending:false})
      .order("created_at",{ascending:false})
      .limit(100)
      .then(function(res){
        if (res.error){
          elListBody.innerHTML = '<tr><td colspan="5" class="muted">목록 로드 실패: '+escapeHtml(res.error.message)+'</td></tr>';
          return;
        }
        var data = res.data||[];
        if (!data.length){
          elListBody.innerHTML = '<tr><td colspan="5" class="muted">등록된 후기가 없습니다.</td></tr>';
          return;
        }

        var ids = []; for (var i=0;i<data.length;i++) ids.push(data[i].id);

        function renderWithCounts(map){
          var html = "";
          for (var j=0;j<data.length;j++){
            var row = data[j];
            var stat = map[row.id] || { v: Number(row.view_count||0), c: 0 };
            var nick = escapeHtml(displayName(row));
            var titleHtml = row.title ? "["+escapeHtml(row.title)+"] " : "";
            var bodyHtml  = (row.is_notice ? '<span class="notice-tag">[알림]</span> ' : '') + titleHtml + escapeHtml(row.content||"");
            var when = fmtDate(row.created_at);
            var trCls = row.is_notice ? "row-item notice" : "row-item";

            html += ''
              + '<tr data-id="'+row.id+'" class="'+trCls+'" style="cursor:pointer">'
              +   '<td class="cell-no">'+(j+1)+'</td>'
              +   '<td class="cell-nick">'+nick+'</td>'
              +   '<td class="cell-body">'
              +     '<div class="m-line1"><span class="nick m-only">'+nick+'</span>'+bodyHtml+'</div>'
              +     '<div class="m-line2 m-only"><span>조회 '+stat.v+' ('+stat.c+')</span><span>'+when+'</span></div>'
              +   '</td>'
              +   '<td class="cell-stats">'+stat.v+' ('+stat.c+')</td>'
              +   '<td class="cell-time">'+when+'</td>'
              + '</tr>';
          }
          elListBody.innerHTML = html;
          attachRowClicks();
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
                map[rr.review_id] = { v:Number(rr.view_count||0), c:Number(rr.comment_count||0) };
              }
            }
            renderWithCounts(map);
          })["catch"](function(){ renderWithCounts({}); });
      })["catch"](function(err){
        elListBody.innerHTML = '<tr><td colspan="5" class="muted">목록 로드 실패: '+escapeHtml(err && err.message)+'</td></tr>';
      });
  }

  // ---------- 갤러리(읽기) ----------
  function renderGallery(reviewId, fallbackUrl){
    var sb = window.mmAuth && window.mmAuth.sb;
    var box = $("#galleryThumbs");
    var lb  = $("#lb");
    var lbImg = $("#lbImg");
    if (!box || !sb) return;

    sb.from("review_images").select("id,url").eq("review_id", reviewId).order("created_at",{ascending:true})
      .then(function(r){
        var urls = [];
        if (!r.error && r.data && r.data.length){
          for (var i=0;i<r.data.length;i++) urls.push(r.data[i].url);
        }
        if (!urls.length && fallbackUrl) urls = [fallbackUrl];

        if (!urls.length){ box.innerHTML = ""; return; }

        var html = "";
        for (var i=0;i<urls.length;i++){
          html += '<div class="thumb-card"><img class="thumb-img" src="'+urls[i]+'" data-idx="'+i+'" alt=""></div>';
        }
        box.innerHTML = html;

        if (!lb || !lbImg) return;
        var cur = 0;
        function openAt(i){ cur=i; lbImg.src=urls[cur]; lb.hidden=false; document.body.style.overflow="hidden"; }
        function close(){ lb.hidden=true; document.body.style.overflow=""; }
        function prev(){ cur=(cur-1+urls.length)%urls.length; lbImg.src=urls[cur]; }
        function next(){ cur=(cur+1)%urls.length; lbImg.src=urls[cur]; }

        var imgs = box.querySelectorAll("img.thumb-img");
        for (var k=0;k<imgs.length;k++){
          (function(img){
            img.addEventListener("click", function(){ openAt(Number(img.getAttribute("data-idx"))); });
          })(imgs[k]);
        }
        var x = lb.querySelector(".lb-close"), p = lb.querySelector(".lb-prev"), n = lb.querySelector(".lb-next");
        if (x) x.addEventListener("click", close);
        if (p) p.addEventListener("click", prev);
        if (n) n.addEventListener("click", next);
        lb.addEventListener("click", function(e){ if(e.target===lb) close(); });
        document.addEventListener("keydown", function(e){
          if (lb.hidden) return;
          if (e.key==="Escape") close();
          if (e.key==="ArrowLeft") prev();
          if (e.key==="ArrowRight") next();
        });
      });
  }

  // ---------- 읽기 ----------
  function loadOne(id){
    if (!elReadView) return Promise.resolve();
    var sb = window.mmAuth && window.mmAuth.sb;
    if (!sb){
      elReadView.innerHTML = '<p class="muted">불러오기 실패: Supabase 준비 전</p>';
      return Promise.resolve();
    }

    return sb.from("reviews")
      .select("id, user_id, title, content, created_at, nickname, author_email, image_url, image_path, is_notice")
      .eq("id", id).single()
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
          var title = (data.is_notice ? "[일림] " : "") + (data.title || "(제목 없음)");

          // 버튼 묶음 구성(문자열 안전)
          var actionsRight = '<button class="btn" type="button" id="btn-to-compose">글쓰기</button>';
          if (isOwner){
            actionsRight += '<button class="btn secondary" type="button" id="btn-edit">수정</button>';
            actionsRight += '<button class="btn secondary" type="button" id="btn-delete">삭제</button>';
          }

          var html = ''
            + '<div class="top-actions">'
            +   '<a class="btn secondary" href="/reviews.html">목록보기</a>'
            +   '<div style="display:flex; gap:8px; align-items:center">'+actionsRight+'</div>'
            + '</div>'
            + '<h3 style="margin:0 0 6px">'+escapeHtml(title)+'</h3>'
            + '<div class="muted" style="margin-bottom:10px">'+escapeHtml(name)+' · '+fmtDate(data.created_at)+'</div>'
            + '<div style="white-space:pre-wrap;word-break:break-word">'+escapeHtml(data.content||"")+'</div>'
            + '<div id="lb" class="lightbox" hidden>'
            +   '<button class="lb-close" aria-label="닫기">×</button>'
            +   '<button class="lb-prev" aria-label="이전">‹</button>'
            +   '<img id="lbImg" alt="">'
            +   '<button class="lb-next" aria-label="다음">›</button>'
            + '</div>'
            + '<div id="galleryThumbs" class="thumbs" style="margin-top:12px"></div>'
            + '<div class="reaction-bar" id="reactBar"></div>'
            + '<div class="comments" id="commentsBox">'
            +   '<h4 style="margin:16px 0 8px">댓글</h4>'
            +   '<div id="commentList"></div>'
            +   '<form id="commentForm" class="comment-form" hidden>'
            +     '<textarea id="commentText" placeholder="댓글을 입력해 주세요"></textarea>'
            +     '<label style="display:flex;align-items:center;gap:6px;white-space:nowrap">'
            +       '<input type="checkbox" id="commentSecret"> 비밀글'
            +     '</label>'
            +     '<button class="btn" id="btnComment">등록</button>'
            +   '</form>'
            +   '<div id="commentLoginHint" class="muted">댓글을 쓰려면 로그인하세요.</div>'
            + '</div>'
            + '<div class="bottom-actions">'
            +   '<button class="btn secondary icon" type="button" id="btnCopyLink" title="링크 복사">🔗 <span>공유</span></button>'
            +   '<span id="shareTip" class="status"></span>'
            + '</div>';

          elReadView.innerHTML = html;

          // 글쓰기 이동
          var btnToCompose = $("#btn-to-compose");
          if (btnToCompose){
            btnToCompose.addEventListener("click", function(){
              window.mmAuth.getSession().then(function(s){
                if (!s || !s.user){
	      document.body.classList.add('show-auth');        // ★ 모바일 인증 패널 표시
	      document.getElementById('tab-login')?.click();   // ★ 로그인 탭으로
                 return;
                }
                history.replaceState(null,"","/reviews.html?compose=1");
                showWrite();
              });
            });
          }

          // 수정(저자만)
          var btnEdit = $("#btn-edit");
          if (btnEdit){
            btnEdit.addEventListener("click", function(){
              showWrite();
              if (fTitle)   fTitle.value   = data.title   || "";
              if (fContent) fContent.value = data.content || "";
              if (elWriteForm) elWriteForm.setAttribute("data-editing", data.id);

              var sess2 = sess; // 위에서 구해둠
              // 관리자 공지 체크박스
              var noticeBox = $("#noticeBox");
              var cb = $("#isNotice");
              if (noticeBox){
                if (window.mmAuth.isAdmin(sess2 && sess2.user ? sess2.user.email : "")){
                  noticeBox.removeAttribute("hidden");
                  if (cb) cb.checked = !!data.is_notice;
                }else{
                  noticeBox.setAttribute("hidden","");
                  if (cb) cb.checked = false;
                }
              }
              // 기존 이미지 썸네일
              if (elEditImages){
                elEditImages.hidden = false;
                renderEditImagesForEditMode(data.id, data.image_url, data.image_path);
              }
            });
          }

          // 삭제(저자만)
          var btnDelete = $("#btn-delete");
          if (btnDelete){
            btnDelete.addEventListener("click", function(){
              if (!confirm("정말 삭제할까요? 이 작업은 되돌릴 수 없습니다.")) return;
              // 댓글 먼저 삭제(제약 없는 환경 대비)
              sb.from("comments").delete().eq("review_id", id).then(function(){
                // 레거시 단일 이미지 스토리지 정리
                var toRemove = [];
                if (data.image_path) toRemove.push(data.image_path);
                // 메타/스토리지(여러 장)
                sb.from("review_images").select("path").eq("review_id", id).then(function(rm){
                  if (!rm.error && rm.data){
                    for (var i=0;i<rm.data.length;i++){
                      if (rm.data[i].path) toRemove.push(rm.data[i].path);
                    }
                  }
                  // 글 삭제
                  sb.from("reviews").delete().eq("id", id).then(function(del){
                    if (toRemove.length){
                      sb.storage.from("reviews").remove(toRemove).then(function(){ location.href="/reviews.html"; })["catch"](function(){ location.href="/reviews.html"; });
                    }else{
                      location.href="/reviews.html";
                    }
                  });
                });
              });
            });
          }

          // 갤러리
          renderGallery(id, data.image_url);

          // 조회수 +1 (RPC 실패해도 조용히 무시)
          try{
            sb.rpc("inc_review_view", { _id:id })["catch"](function(){});
          }catch(_){}

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
                var ta=document.createElement("textarea");
                ta.value=text; ta.setAttribute("readonly",""); ta.style.position="fixed"; ta.style.left="-9999px";
                document.body.appendChild(ta); ta.select();
                var ok=document.execCommand("copy");
                document.body.removeChild(ta);
                if (ok) resolve(); else reject(new Error("execCommand copy 실패"));
              }catch(err){ reject(err); }
            });
          }
          if (copyBtn){
            copyBtn.addEventListener("click", function(){
              copyPlainText(shareUrl).then(function(){
                if (shareTip) shareTip.textContent="링크를 복사했습니다. (붙여넣기)";
                setTimeout(function(){ if(shareTip) shareTip.textContent=""; },2000);
              })["catch"](function(){
                if (shareTip) shareTip.textContent="복사 실패";
                setTimeout(function(){ if(shareTip) shareTip.textContent=""; },2000);
              });
            });
          }
        });
      })["catch"](function(err){
        elReadView.innerHTML = '<p class="muted">불러오기 실패: '+escapeHtml(err && err.message)+'</p>';
      });
  }

  // ---------- 편집 모드: 기존 이미지 썸네일 + 삭제 체크 ----------
  function renderEditImagesForEditMode(reviewId, fallbackUrl, fallbackPath){
    if (!elEditImages) return;
    var sb = window.mmAuth && window.mmAuth.sb;
    elEditImages.hidden = false;
    elEditImages.innerHTML = '<div class="muted">기존 이미지를 불러오는 중…</div>';
    if (!sb){
      elEditImages.innerHTML = '<div class="muted">클라이언트 준비 전</div>';
      return;
    }
    sb.from("review_images")
      .select("id,url,path,created_at")
      .eq("review_id", reviewId)
      .order("created_at",{ascending:true})
      .then(function(res){
        var rows = [];
        if (!res.error && res.data && res.data.length) rows = res.data;
        if (!rows.length && fallbackUrl){
          rows = [{ id:null, url:fallbackUrl, path:(fallbackPath||null), _legacy:true }];
        }
        if (!rows.length){
          elEditImages.innerHTML = '<div class="muted">기존 이미지가 없습니다.</div>';
          return;
        }
        var html = "";
        for (var i=0;i<rows.length;i++){
          var r = rows[i];
          html += ''
            + '<div class="thumb-card">'
            +   '<img class="thumb-img" src="'+r.url+'" alt="">'
            +   '<label style="font-size:13px;color:#444;margin-top:6px; display:block; text-align:center">'
            +     '<input type="checkbox"'
            +       ' data-del="img"'
            +       ' data-imgid="'+(r.id||'')+'"'
            +       ' data-path="'+(r.path||'')+'"'
            +       ' data-legacy="'+(r._legacy ? '1':'0')+'"> 삭제'
            +   '</label>'
            + '</div>';
        }
        elEditImages.innerHTML = html;
      })["catch"](function(){
        elEditImages.innerHTML = '<div class="muted">이미지 로드 실패</div>';
      });
  }

  // ---------- 파일 선택 미리보기 ----------
  function onFileChange(){
    if (!fImage || !elSelectPreviews) return;
    var files = fImage.files ? Array.prototype.slice.call(fImage.files) : [];
    // 누적 중복 제거(name+size+lastModified)
    function key(f){ return (f.name||"")+"__"+(f.size||0)+"__"+(f.lastModified||0); }
    var map = {};
    // 기존 누적 + 신규
    for (var i=0;i<chosenFiles.length;i++){ map[key(chosenFiles[i])] = chosenFiles[i]; }
    for (var j=0;j<files.length;j++){ map[key(files[j])] = files[j]; }
    chosenFiles = []; for (var k in map){ if (map.hasOwnProperty(k)) chosenFiles.push(map[k]); }

    // 슬롯 제한 계산: 편집 모드면 기존 - 삭제체크 수 고려
    var slot = MAX_FILES;
    if (elWriteForm && elWriteForm.getAttribute("data-editing")){
      var totalThumbs = elEditImages ? elEditImages.querySelectorAll('input[data-del="img"]').length : 0;
      var delChecked  = elEditImages ? elEditImages.querySelectorAll('input[data-del="img"]:checked').length : 0;
      var existing = Math.max(0, totalThumbs - delChecked);
      slot = Math.max(0, MAX_FILES - existing);
    }
    if (chosenFiles.length > slot) chosenFiles = chosenFiles.slice(0, slot);

    // 미리보기 렌더
    elSelectPreviews.innerHTML = "";
    for (var x=0;x<chosenFiles.length;x++){
      (function(f){
        var url = URL.createObjectURL(f);
        var wrap = document.createElement("div"); wrap.className = "thumb-card";
        var img  = document.createElement("img"); img.className = "thumb-img"; img.src = url;
        wrap.appendChild(img);
        elSelectPreviews.appendChild(wrap);
      })(chosenFiles[x]);
    }
    try{ fImage.value = ""; }catch(_){}
  }

  // ---------- 저장(신규/수정) ----------
  function saveWriteForm(e){
    e.preventDefault();
    var sb = window.mmAuth && window.mmAuth.sb;
    if (!sb){ alert("Supabase 준비 전"); return; }

    window.mmAuth.getSession().then(function(sess){
      if (!sess || !sess.user){ alert("로그인이 필요합니다."); return; }
      var user = sess.user;

      if (!fContent || !fContent.value.trim()){
        if (elFormStatus) elFormStatus.textContent = "내용을 입력하세요.";
        return;
      }
      if (elBtnSubmit){ elBtnSubmit.disabled = true; elBtnSubmit.textContent = "저장 중…"; }

      var editingId = elWriteForm ? elWriteForm.getAttribute("data-editing") : null;
      var title = fTitle && fTitle.value ? fTitle.value.trim() : "";
      var content = fContent.value.trim();
      var nickname = (window.mmAuth.isAdmin(user.email) ? "관리자"
        : (user.user_metadata && user.user_metadata.full_name) ? user.user_metadata.full_name
        : (user.email ? user.email.split("@")[0] : "익명"));

      // 업로드 함수
      function uploadFilesLimit(remain, cb){
        var files = chosenFiles.slice(0, remain);
        var uploaded = [];
        if (!files.length){ cb(null, uploaded); return; }

        (function up(i){
          if (i>=files.length){ cb(null, uploaded); return; }
          var file = files[i];
          var ext = (file.name.split(".").pop()||"jpg").toLowerCase();
          var ok = ("jpg jpeg png webp gif").indexOf(ext) >= 0 ? ext : "jpg";
          var key = user.id + "/" + Date.now() + "_" + Math.random().toString(36).slice(2) + "." + ok;
          sb.storage.from("reviews").upload(key, file, { upsert:false, cacheControl:"3600" })
            .then(function(up){
              if (up.error){ cb(up.error); return; }
              var pub = sb.storage.from("reviews").getPublicUrl(key);
              var url = pub && pub.data ? pub.data.publicUrl : "";
              uploaded.push({ path:key, url:url });
              up(i+1);
            })["catch"](function(err){ cb(err); });
        })(0);
      }

      // 공지 플래그
      var noticeFlag = false;
      var cbNotice = $("#isNotice");
      if (cbNotice && window.mmAuth.isAdmin(user.email)) noticeFlag = !!cbNotice.checked;

      if (editingId){
        // -------- 수정 흐름 --------
        // 1) 텍스트 업데이트
        sb.from("reviews").update({ title:title, content:content, is_notice:noticeFlag }).eq("id", editingId)
          .then(function(upd){
            if (upd.error){ throw upd.error; }

            // 2) 삭제 체크
            var dels = elEditImages ? elEditImages.querySelectorAll('input[data-del="img"]:checked') : [];
            var pathsToRemove = [];
            function deleteNextDel(idx, done){
              if (!dels || idx>=dels.length){ done(); return; }
              var el = dels[idx];
              var isLegacy = (el.getAttribute("data-legacy")==="1");
              var path     = el.getAttribute("data-path") || "";
              var imgId    = el.getAttribute("data-imgid") || null;

              function next(){ deleteNextDel(idx+1, done); }

              if (!isLegacy && imgId){
                // review_images 행 삭제
                sb.from("review_images").delete().eq("id", imgId).then(function(){ if(path) pathsToRemove.push(path); next(); })["catch"](function(){ if(path) pathsToRemove.push(path); next(); });
              }else if (isLegacy){
                // reviews 레거시 컬럼 제거
                sb.from("reviews").update({ image_url:null, image_path:null }).eq("id", editingId)
                  .then(function(){ if(path) pathsToRemove.push(path); next(); })["catch"](function(){ if(path) pathsToRemove.push(path); next(); });
              }else{
                if (path) pathsToRemove.push(path);
                next();
              }
            }

            deleteNextDel(0, function(){
              // 스토리지 제거
              function removeStorage(pList, cb2){
                if (!pList.length){ cb2(); return; }
                sb.storage.from("reviews").remove(pList).then(function(){ cb2(); })["catch"](function(){ cb2(); });
              }

              // 3) 남은 슬롯 계산 → 업로드 → 메타 insert
              var totalThumbs = elEditImages ? elEditImages.querySelectorAll('input[data-del="img"]').length : 0;
              var delChecked  = elEditImages ? elEditImages.querySelectorAll('input[data-del="img"]:checked').length : 0;
              var existing = Math.max(0, totalThumbs - delChecked);
              var remain = Math.max(0, MAX_FILES - existing);

              uploadFilesLimit(remain, function(errUp, uploaded){
                if (errUp){
                  removeStorage(pathsToRemove, function(){ afterAll(errUp); });
                  return;
                }
                function insertMeta(list, cb3){
                  if (!list.length){ cb3(); return; }
                  var rows = [];
                  for (var i=0;i<list.length;i++){
                    rows.push({ review_id:editingId, url:list[i].url, path:list[i].path });
                  }
                  sb.from("review_images").insert(rows).then(function(ins){
                    cb3(ins.error || null);
                  })["catch"](function(e){ cb3(e); });
                }
                insertMeta(uploaded, function(errMeta){
                  removeStorage(pathsToRemove, function(){
                    afterAll(errMeta || null);
                  });
                });
              });
            });

            function afterAll(err){
              if (err){
                if (elFormStatus) elFormStatus.textContent = "저장 일부 실패: " + (err.message||err);
                if (elBtnSubmit){ elBtnSubmit.disabled=false; elBtnSubmit.textContent="저장"; }
                return;
              }
              location.href = "/reviews.html?id=" + editingId;
            }
          })["catch"](function(e){
            if (elFormStatus) elFormStatus.textContent = "수정 실패: " + (e.message||e);
            if (elBtnSubmit){ elBtnSubmit.disabled=false; elBtnSubmit.textContent="저장"; }
          });

        return;
      }

      // -------- 신규 작성 --------
      uploadFilesLimit(MAX_FILES, function(errUp, uploaded){
        if (errUp){
          if (elFormStatus) elFormStatus.textContent = "이미지 업로드 실패: " + (errUp.message||errUp);
          if (elBtnSubmit){ elBtnSubmit.disabled=false; elBtnSubmit.textContent="저장"; }
          return;
        }
        var image_path = null, image_url = null;
        if (uploaded[0]){ image_path = uploaded[0].path; image_url = uploaded[0].url; }

        sb.from("reviews").insert({
          title:title, content:content, is_notice:noticeFlag,
          user_id:user.id, author_email:user.email, nickname:nickname,
          image_path:image_path, image_url:image_url
        }).select("id").single()
        .then(function(ins){
          if (ins.error){ throw ins.error; }
          var newId = ins.data.id;
          if (!uploaded.length){ location.href="/reviews.html"; return; }
          var rows = [];
          for (var i=0;i<uploaded.length;i++){
            rows.push({ review_id:newId, url:uploaded[i].url, path:uploaded[i].path });
          }
          sb.from("review_images").insert(rows).then(function(add){
            if (add.error){
              if (elFormStatus) elFormStatus.textContent = "메타 저장 실패: " + add.error.message;
              if (elBtnSubmit){ elBtnSubmit.disabled=false; elBtnSubmit.textContent="저장"; }
              return;
            }
            location.href="/reviews.html";
          });
        })["catch"](function(e){
          if (elFormStatus) elFormStatus.textContent = "저장 실패: " + (e.message||e);
          if (elBtnSubmit){ elBtnSubmit.disabled=false; elBtnSubmit.textContent="저장"; }
        });
      });
    });
  }

  // ---------- 뷰 전환 ----------
  function showList(){ if(elListView) elListView.hidden=false; if(elReadView) elReadView.hidden=true; if(elWriteForm) elWriteForm.hidden=true; }
  function showRead(){ if(elListView) elListView.hidden=true;  if(elReadView) elReadView.hidden=false; if(elWriteForm) elWriteForm.hidden=true; }
  function showWrite(){if(elListView) elListView.hidden=true;  if(elReadView) elReadView.hidden=true;  if(elWriteForm) elWriteForm.hidden=false; }

  // ---------- 부트스트랩 & 라우팅 ----------
  function init(){
    // DOM 캐시
    elAuthInfo   = $("#authInfo");
    elAuthStatus = $("#authStatus");
    elListView   = $("#listView");
    elReadView   = $("#readView");
    elWriteForm  = $("#writeForm");
    elListBody   = $("#listBody");
    elBtnCompose = $("#btn-compose");
    elBtnSubmit  = $("#btn-submit");
    elFormStatus = $("#formStatus");

    fTitle = $("#title");
    fContent = $("#content");
    fImage = $("#image");
    elSelectPreviews = $("#selectPreviews");
    elEditImages = $("#editImages");
    if (fImage && fImage.getAttribute("data-max")){
      var n = parseInt(fImage.getAttribute("data-max"),10);
      if (!isNaN(n)) MAX_FILES = n;
    }

    if (fImage){ fImage.addEventListener("change", onFileChange); }
    if (elWriteForm){ elWriteForm.addEventListener("submit", saveWriteForm); }

    // 인증 핸들
    if (window.mmAuth){
      window.mmAuth.whenReady(function(){
        refreshAuthUI();

// [REPLACE] reviews 페이지 인증 핸들러 (모바일 submit 안정화)
(function () {
  const sb = window.mmAuth.sb;

  const loginForm   = document.getElementById('loginForm');
  const signupForm  = document.getElementById('signupForm');
  const btnLogout   = document.getElementById('btn-logout');
  const loginStatus = document.getElementById('loginStatus');
  const signupStatus= document.getElementById('signupStatus');

  // 탭 전환
  const tabLogin  = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  function setTab(which){
    if (tabLogin)  tabLogin.classList.toggle('active',  which==='login');
    if (tabSignup) tabSignup.classList.toggle('active', which==='signup');
    if (loginForm)  loginForm.hidden  = (which!=='login');
    if (signupForm) signupForm.hidden = (which!=='signup');
  }
  if (tabLogin)  tabLogin.onclick  = () => setTab('login');
  if (tabSignup) tabSignup.onclick = () => setTab('signup');

  // 로그인: 폼 submit에서만 처리 (모바일 Enter/Go 포함)
  if (loginForm){
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault(); // ★ 새로고침 방지
      const email = (document.getElementById('login-email')?.value || '').trim().toLowerCase();
      const pw    = document.getElementById('login-password')?.value || '';
      if (loginStatus) loginStatus.textContent = '로그인 중…';
      try {
        const { error } = await (window.mmAuth?.signIn
          ? window.mmAuth.signIn(email, pw)
          : sb.auth.signInWithPassword({ email, password: pw }));
        if (error){
          if (loginStatus) loginStatus.textContent = '로그인 실패: ' + (error.message || '에러');
          return;
        }
        if (loginStatus) loginStatus.textContent = '로그인 성공';
        document.body.classList.remove('show-auth');  // 모바일: 인증 패널 닫기
        refreshAuthUI();
      } catch (err) {
        if (loginStatus) loginStatus.textContent = '로그인 에러: ' + (err?.message || err);
      }
    });
  }

  // 가입: 폼 submit에서 처리
  if (signupForm){
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (document.getElementById('signup-email')?.value || '').trim().toLowerCase();
      const p1    = document.getElementById('signup-password')?.value || '';
      const p2    = document.getElementById('signup-password2')?.value || '';
      if (signupStatus) signupStatus.textContent = '가입 중…';
      if (p1 !== p2){ signupStatus.textContent = '비밀번호 확인이 일치하지 않습니다.'; return; }
      if (p1.length < 8){ signupStatus.textContent = '비밀번호는 8자 이상'; return; }
      try {
        const { error } = await (window.mmAuth?.signUp
          ? window.mmAuth.signUp(email, p1)
          : sb.auth.signUp({ email, password: p1 }));
        if (error){ signupStatus.textContent = '가입 실패: ' + (error.message || '에러'); return; }
        signupStatus.textContent = '가입 완료';
        setTab('login'); // 가입 후 로그인 탭으로 전환
      } catch (err) {
        signupStatus.textContent = '가입 에러: ' + (err?.message || err);
      }
    });
  }

  // 로그아웃
  if (btnLogout){
    btnLogout.addEventListener('click', async (e) => {
      e.preventDefault();
      try{
        if (window.mmAuth?.signOut) await window.mmAuth.signOut();
        else await sb.auth.signOut();
      } finally {
        refreshAuthUI();
      }
    });
  }
})();

        // 라우팅
        var q = new URLSearchParams(location.search);
        var id = q.get("id");
        var compose = q.get("compose");
        var edit = q.get("edit");

        if (id){ showRead(); loadOne(id); return; }

        if (compose==="1"){
          showList();
          loadList().then(function(){
            window.mmAuth.getSession().then(function(s){
              if (s && s.user){ showWrite(); }
            });
          });
          return;
        }

        if (edit){
          // 간소화: 목록 먼저 → 로그인 시 edit 로직 추가 구현 가능
          showList(); loadList();
          return;
        }

        showList(); loadList();
      });
      window.mmAuth.onChange(function(){ refreshAuthUI(); });
    }else{
      // 비상: 인증모듈이 없다면 목록만
      showList(); loadList();
    }

    var y = $("#year");
    if (y) y.textContent = (new Date()).getFullYear();
  }

  function _debug(){
    console.log("[MMReviews] el", !!elListView, !!elReadView, !!elWriteForm, !!elListBody);
    if (window.mmAuth && window.mmAuth._debugPing) window.mmAuth._debugPing();
  }

  return { init:init, _debug:_debug };
})();

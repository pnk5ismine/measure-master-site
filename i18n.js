// i18n.js — Measure Master 다국어 공통 스크립트
const I18N = {
  ko: {
    "meta.title": "Measure Master — 사진 보정 · 길이/면적 계산",
    "meta.description": "A4 등과 같이 용적을 아는 기준 사각형으로 투시 보정 후 길이/면적을 계산하는 Measure Master 앱",
    "nav.home": "홈",
    "nav.login": "로그인",
    "nav.reviews": "사용후기",
    "nav.privacy": "개인정보처리방침",
    "hero.title": "사진 속 왜곡을 보정해<br/>정확한 길이·면적을 계산",
    "hero.desc": "A4 기준 사각형으로 투시 보정 후, 보정된 도형의 길이/면적을 산출합니다. 건축·실측·인테리어 현장에서 빠르고 간편하게.",
    "hero.cta.play": "Google Play(준비중)",
    "hero.cta.reviews": "사용후기 보기",
    "hero.cta.privacy": "개인정보처리방침",
    "why.title": "왜 Measure Master인가요?",
    "why.f1.title": "정확한 투시 보정",
    "why.f1.desc": "A4 기준 사각형 4점만 지정하면 사진을 직사각형 기준으로 보정해 길이·면적을 신뢰성 있게 계산.",
    "why.f2.title": "실측 친화 UI",
    "why.f2.desc": "직선/곡선 도형, 스냅 각도, 자동 커밋 등 현장 사용성을 최우선으로 설계.",
    "why.f3.title": "빠른 결과",
    "why.f3.desc": "보정 후 즉시 길이 합계, 면적 합계 표시. 내보내기 및 공유도 간편.",
    "why.f4.title": "피드백 루프",
    "why.f4.desc": "사용자 후기 기반 개선. 버그 리포트/요청은 후기 게시판으로 알려주세요.",
    "auth.title": "회원가입 · 로그인",
    "auth.logged_out": "로그아웃 상태",
    "auth.logged_in": "로그인: {email}",
    "auth.email": "이메일",
    "auth.email_ph": "you@example.com",
    "auth.password": "비밀번호",
    "auth.password_ph": "8자 이상",
    "auth.signup": "회원가입",
    "auth.login": "로그인",
    "auth.logout": "로그아웃",
    "auth.note": "가입 후 이메일 인증이 설정된 경우, 받은 메일에서 확인을 완료해 주세요.",
    "auth.reviews_link": "후기를 남기시려면 <a href=\"/reviews.html\">사용후기 페이지</a>로 이동하세요.",
    "msg.signup_ok": "가입 완료! 메일 확인을 진행해 주세요.",
    "msg.signup_err": "회원가입 오류: {msg}",
    "msg.login_ok": "로그인 성공",
    "msg.login_err": "로그인 오류: {msg}",
    "footer.all": "All rights reserved.",
    "noscript": "이 페이지는 JavaScript를 필요로 합니다. 브라우저 설정에서 JavaScript를 활성화해 주세요.",
    "reviews.title": "최신 후기",
    "reviews.live": "LIVE",
    "reviews.loading": "불러오는 중…",
    "write.title": "후기 작성",
    "write.nickname": "닉네임",
    "write.nickname_ph": "예: 현장왕",
    "write.content": "후기 내용",
    "write.content_ph": "앱을 써 보신 소감을 남겨 주세요",
    "write.submit": "등록",
    "write.need_login": "로그인 후 후기를 작성할 수 있습니다.",
    "write.no_account": "아직 계정이 없으신가요? <a href=\"/index.html#auth\">회원가입</a>"
  },
  en: {
    "meta.title": "Measure Master — Perspective Fix · Length/Area",
    "meta.description": "Measure Master calculates length and area by rectifying perspective using an already known rectangle like A4.",
    "nav.home": "Home",
    "nav.login": "Log In",
    "nav.reviews": "Reviews",
    "nav.privacy": "Privacy Policy",
    "hero.title": "Fix perspective in photos<br/>and measure length & area accurately",
    "hero.desc": "Use an A4 reference rectangle to rectify perspective, then compute reliable length/area. Fast and handy for field work.",
    "hero.cta.play": "Google Play (Coming Soon)",
    "hero.cta.reviews": "See Reviews",
    "hero.cta.privacy": "Privacy Policy",
    "why.title": "Why Measure Master?",
    "why.f1.title": "Accurate Rectification",
    "why.f1.desc": "Specify 4 corners of an A4 reference to rectify to a rectangle and obtain reliable length/area results.",
    "why.f2.title": "Field-Friendly UI",
    "why.f2.desc": "Straight/curved shapes, angle snapping, auto-commit—designed for real-world usage.",
    "why.f3.title": "Instant Results",
    "why.f3.desc": "Total length and area after rectification, with simple export & sharing.",
    "why.f4.title": "Feedback Loop",
    "why.f4.desc": "We improve via user feedback. Post requests and bug reports in Reviews.",
    "auth.title": "Sign Up · Log In",
    "auth.logged_out": "Signed out",
    "auth.logged_in": "Signed in: {email}",
    "auth.email": "Email",
    "auth.email_ph": "you@example.com",
    "auth.password": "Password",
    "auth.password_ph": "At least 8 characters",
    "auth.signup": "Sign Up",
    "auth.login": "Log In",
    "auth.logout": "Log Out",
    "auth.note": "If email verification is enabled, please confirm via the email after sign-up.",
    "auth.reviews_link": "To leave feedback, go to the <a href=\"/reviews.html\">Reviews page</a>.",
    "msg.signup_ok": "Sign-up completed! Please check your email.",
    "msg.signup_err": "Sign-up error: {msg}",
    "msg.login_ok": "Logged in",
    "msg.login_err": "Login error: {msg}",
    "footer.all": "All rights reserved.",
    "noscript": "This site requires JavaScript. Please enable it in your browser.",
    "reviews.title": "Latest Reviews",
    "reviews.live": "LIVE",
    "reviews.loading": "Loading…",
    "write.title": "Write a Review",
    "write.nickname": "Nickname",
    "write.nickname_ph": "e.g., ProMeasurer",
    "write.content": "Your Review",
    "write.content_ph": "Tell us about your experience with the app",
    "write.submit": "Submit",
    "write.need_login": "You need to log in to post a review.",
    "write.no_account": "Don't have an account? <a href=\"/index.html#auth\">Sign up</a>"
  }
};

// i18n.js 안의 I18N 객체에 추가
Object.assign(I18N.ko, {
  "privacy.meta.title": "개인정보처리방침 · Measure Master",
  "privacy.meta.desc": "Measure Master 개인정보 처리에 관한 안내",
  "privacy.title": "개인정보처리방침",
  "privacy.updated": "최종 업데이트: 2025-09-01",
  "privacy.intro": "Measure Master(이하 '당사')는 이용자의 개인정보를 소중히 여기며, 관련 법령을 준수합니다. 본 방침은 당사가 어떤 정보를 수집·이용·보관하며, 이용자의 권리를 어떻게 보장하는지 설명합니다.",
  "privacy.section1": "1. 수집하는 정보",
  "privacy.section1.body": "회원가입/로그인 시 이메일과 비밀번호를 수집합니다. 비밀번호는 해시 처리되어 저장되며 원문으로 보관하지 않습니다. 후기 작성 시 닉네임과 후기 내용을 수집합니다.",
  "privacy.section2": "2. 수집·이용 목적",
  "privacy.section2.body": "회원 식별 및 계정 관리, 서비스 제공(로그인, 후기 게시), 악용 방지 및 보안, 서비스 개선을 위한 통계/분석에 개인정보를 이용합니다.",
  "privacy.section3": "3. 보관 및 파기",
  "privacy.section3.body": "서비스 제공에 필요한 기간 동안 보관 후 목적 달성 시 지체없이 파기합니다. 법령이 보관을 요구하는 경우 해당 기간 동안 보관합니다.",
  "privacy.section4": "4. 제3자 제공 및 처리위탁",
  "privacy.section4.body": "다음 클라우드 서비스가 데이터 처리에 사용됩니다: Supabase(인증/DB), Vercel(호스팅). 이들 서비스는 운영상 필요한 범위 내에서만 데이터를 처리합니다.",
  "privacy.section5": "5. 이용자 권리",
  "privacy.section5.body": "이용자는 자신의 개인정보 열람·수정·삭제를 요청할 수 있으며, 동의 철회(회원탈퇴)를 할 수 있습니다. 요청은 아래 연락처로 가능합니다.",
  "privacy.section6": "6. 쿠키 및 로깅",
  "privacy.section6.body": "인증 상태 유지를 위해 로컬 저장소/세션 저장소 또는 쿠키를 사용할 수 있습니다. 또한 서비스 안정성 향상을 위한 기본 접속 로그가 수집될 수 있습니다.",
  "privacy.section7": "7. 개인정보 보호조치",
  "privacy.section7.body": "전송 구간 암호화(HTTPS), 접근 통제, 최소 수집 원칙을 준수합니다. 단, 인터넷 특성상 절대적 보안을 보장할 수 없으므로 이용자도 계정 보안에 유의해 주세요.",
  "privacy.section8": "8. 문의처",
  "privacy.section8.body": "개인정보 관련 문의는 이메일(support@measure-master.net)로 연락해 주세요.",
  "privacy.section9": "9. 고지 의무",
  "privacy.section9.body": "본 방침이 변경될 경우, 본 페이지에 업데이트일과 함께 공지합니다."
});

Object.assign(I18N.en, {
  "privacy.meta.title": "Privacy Policy · Measure Master",
  "privacy.meta.desc": "Information about how Measure Master handles your data",
  "privacy.title": "Privacy Policy",
  "privacy.updated": "Last updated: 2025-09-01",
  "privacy.intro": "Measure Master ('we', 'our', or 'us') values your privacy and complies with applicable laws. This policy explains what data we collect, how we use and store it, and your rights.",
  "privacy.section1": "1. Data We Collect",
  "privacy.section1.body": "When you sign up/log in, we collect your email and password. Passwords are stored hashed, not in plain text. When you post a review, we collect your nickname and review content.",
  "privacy.section2": "2. Purpose of Use",
  "privacy.section2.body": "We use your data for account management and authentication, providing services (login, reviews), preventing abuse and ensuring security, and aggregated analytics for service improvements.",
  "privacy.section3": "3. Retention & Deletion",
  "privacy.section3.body": "We retain personal data only as long as necessary for the service. Once the purpose is fulfilled, we delete it without undue delay unless a longer retention period is required by law.",
  "privacy.section4": "4. Third Parties / Subprocessors",
  "privacy.section4.body": "We use the following cloud services: Supabase (auth/DB) and Vercel (hosting). They process data only as necessary to operate the service.",
  "privacy.section5": "5. Your Rights",
  "privacy.section5.body": "You may request to access, correct, or delete your data, and withdraw consent (account deletion). Please contact us using the email below.",
  "privacy.section6": "6. Cookies & Logging",
  "privacy.section6.body": "We may use local/session storage or cookies for authentication state, and basic access logs may be collected to improve reliability.",
  "privacy.section7": "7. Security Measures",
  "privacy.section7.body": "We use HTTPS, access controls, and data minimization. However, no method is 100% secure; please keep your account credentials safe.",
  "privacy.section8": "8. Contact",
  "privacy.section8.body": "For privacy inquiries, contact: support@measure-master.net",
  "privacy.section9": "9. Notice of Changes",
  "privacy.section9.body": "If this policy changes, we will update this page with the effective date."
});


// ===== Functions =====
function getLang() {
  return localStorage.getItem("lang") || document.documentElement.getAttribute("lang") || "ko";
}
function setLang(lang) {
  localStorage.setItem("lang", lang);
  document.documentElement.setAttribute("lang", lang);
  document.documentElement.setAttribute("data-lang", lang);
  applyI18n();
  markActiveLang(lang);
}
function t(key, vars = {}) {
  const lang = getLang();
  let s = (I18N[lang] && I18N[lang][key]) || (I18N.ko && I18N.ko[key]) || key;
  for (const k in vars) {
    s = s.replaceAll(`{${k}}`, vars[k]);
  }
  return s;
}
function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.innerHTML = t(el.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-attr]").forEach(el => {
    el.getAttribute("data-i18n-attr").split(",").forEach(p => {
      const [attr, key] = p.split("=").map(s => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    });
  });
  // <title>
  const titleEl = document.querySelector("title[data-i18n]");
  if (titleEl) titleEl.textContent = t(titleEl.getAttribute("data-i18n"));
  // <meta name=description>
  const metaDesc = document.querySelector('meta[name="description"][data-i18n-attr]');
  if (metaDesc) {
    metaDesc.getAttribute("data-i18n-attr").split(",").forEach(p => {
      const [attr, key] = p.split("=").map(s => s.trim());
      if (attr && key) metaDesc.setAttribute(attr, t(key));
    });
  }
}
function markActiveLang(lang) {
  document.querySelectorAll("[data-lang-btn]").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-lang-btn") === lang);
  });
}

// ===== Init =====
(function() {
  const lang = getLang();
  setLang(lang);
  document.querySelectorAll("[data-lang-btn]").forEach(btn =>
    btn.addEventListener("click", () => setLang(btn.getAttribute("data-lang-btn")))
  );
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();

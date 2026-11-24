/* ---------------- state ---------------- */
const S = { user: null, me: null, view: 'dash', p: {}, classes: [], settings: {}, quizzes: [], subs: [], reviews: {}, keys: {}, users: [], msgs: [], templates: [], ed: null, take: null, authMode: 'in', ready: false, unsubs: [] };
const A = {}; // action handlers
const isAdmin = () => S.me?.role === 'admin';
const isDelegate = () => S.me?.role === 'delegate';
const isStaff = () => isAdmin() || isDelegate();
const cls = id => S.classes.find(c => c.id === id);
const clsName = id => cls(id)?.name || 'بدون فصل';
const userById = id => S.users.find(u => u.id === id);
const quizById = id => S.quizzes.find(q => q.id === id);
const subId = (qid, uid) => qid + '_' + uid;
const students = () => S.users.filter(u => u.role === 'student' && (isAdmin() || (S.me.delegateClasses || []).includes(u.classId)));
const myClasses = () => isAdmin() ? S.classes : S.classes.filter(c => (S.me.delegateClasses || []).includes(c.id));
const go = (view, p = {}) => { S.view = view; S.p = p; render(); window.scrollTo({ top: 0, behavior: 'instant' }); };

/* ---------------- ui helpers ---------------- */
function toast(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2600); }
function openModal(html, wide) { const o = $('#ov-root'); o.innerHTML = `<div class="ov" data-a="ovClose"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div></div>`; document.body.classList.add('has-modal'); const f = o.querySelector('input,textarea,select'); f && setTimeout(() => f.focus(), 50); }
function closeModal() { $('#ov-root').innerHTML = ''; document.body.classList.remove('has-modal'); }
A.ovClose = (el, e) => { if (e.target === el) closeModal(); };
A.close = () => closeModal();
function ask(title, body = '', ok = 'تأكيد', danger) {
  return new Promise(res => {
    openModal(`<h2>${esc(title)}</h2>${body ? `<p class="muted" style="margin-top:8px">${body}</p>` : ''}<div class="row" style="margin-top:20px;justify-content:flex-end"><button class="btn ghost" id="m-no">إلغاء</button><button class="btn ${danger ? 'danger' : ''}" id="m-yes">${esc(ok)}</button></div>`);
    $('#m-yes').onclick = () => { closeModal(); res(true); }; $('#m-no').onclick = () => { closeModal(); res(false); };
  });
}
function askText(title, label, val = '', multi) {
  return new Promise(res => {
    openModal(`<h2>${esc(title)}</h2><label class="f" style="margin-top:14px">${esc(label)}${multi ? `<textarea class="in" id="m-t">${esc(val)}</textarea>` : `<input class="in" id="m-t" value="${esc(val)}">`}</label><div class="row" style="margin-top:18px;justify-content:flex-end"><button class="btn ghost" id="m-no">إلغاء</button><button class="btn" id="m-yes">حفظ</button></div>`);
    $('#m-yes').onclick = () => { const v = $('#m-t').value; closeModal(); res(v); }; $('#m-no').onclick = () => { closeModal(); res(null); };
  });
}
async function safe(fn, okMsg) { try { const r = await fn(); okMsg && toast(okMsg); return r; } catch (e) { console.error(e); toast(e.code === 'permission-denied' ? 'لا تملك صلاحية لهذا الإجراء' : 'تعذر الحفظ: ' + (e.message || e.code || '')); } }
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas'); c.className = 'confetti'; document.body.appendChild(c); const x = c.getContext('2d'); c.width = innerWidth; c.height = innerHeight;
  const P = Array.from({ length: 160 }, () => ({ x: Math.random() * c.width, y: -20 - Math.random() * c.height * .5, r: 4 + Math.random() * 6, c: PALETTE[Math.floor(Math.random() * 6)], vy: 2 + Math.random() * 3, vx: -1.5 + Math.random() * 3, a: Math.random() * 6, va: -.2 + Math.random() * .4 }));
  let t = 0; (function f() { x.clearRect(0, 0, c.width, c.height); P.forEach(p => { p.y += p.vy; p.x += p.vx; p.a += p.va; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); x.restore(); }); if (++t < 240) requestAnimationFrame(f); else c.remove(); })();
}
function doPrint(certMode) { if (certMode) document.body.classList.add('print-cert'); try { window.print(); } catch { toast('الطباعة غير متاحة في وضع المعاينة، تعمل على الموقع المنشور'); } setTimeout(() => document.body.classList.remove('print-cert'), 800); }
A.print = () => doPrint();
function downloadCSV(name, rows) {
  const csv = '﻿' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = name + '.csv'; document.body.appendChild(a); a.click(); a.remove(); toast('تم تجهيز الملف'); } catch { toast('التنزيل غير متاح هنا'); }
}

/* charts */
const ringSVG = (p, size = 240, col) => { const r = 100, C = 2 * Math.PI * r; return `<svg viewBox="0 0 240 240"><circle cx="120" cy="120" r="${r}" fill="none" stroke="var(--surface2)" stroke-width="20"/><circle class="p" cx="120" cy="120" r="${r}" fill="none" stroke="${col || pctColor(p)}" stroke-width="20" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}" data-off="${C * (1 - p / 100)}"/></svg>`; };
const hbars = (rows, unit = '%') => rows.length ? rows.map(r => `<div class="hrow"><span title="${esc(r.l)}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.l)}</span><div class="bar"><i style="width:${Math.max(2, Math.min(100, r.v))}%;background:${r.c || pctColor(r.v)}"></i></div><b class="num" style="text-align:end">${r1(r.v)}${unit}</b></div>`).join('') : `<p class="muted small">لا توجد بيانات بعد</p>`;
function histSVG(vals) {
  const bins = Array(10).fill(0); vals.forEach(v => bins[Math.min(9, Math.floor(v / 10))]++); const m = Math.max(1, ...bins); const W = 600, H = 230, bw = W / 10;
  return `<svg class="chart" viewBox="0 0 ${W} ${H + 30}" role="img" aria-label="توزيع الدرجات">${bins.map((b, i) => { const h = b / m * (H - 26); const x = W - (i + 1) * bw; return `<rect x="${x + 6}" y="${H - h}" width="${bw - 12}" height="${h}" rx="7" fill="${pctColor(i * 10 + 5)}" opacity=".9"/>${b ? `<text x="${x + bw / 2}" y="${H - h - 7}" text-anchor="middle" font-size="15" font-weight="700" style="fill:var(--ink)">${b}</text>` : ''}<text x="${x + bw / 2}" y="${H + 20}" text-anchor="middle" font-size="13">${i * 10}-${i * 10 + 10}</text>`; }).join('')}<line x1="0" x2="${W}" y1="${H}" y2="${H}" stroke="var(--line)"/></svg>`;
}
function lineSVG(pts) {
  if (pts.length < 2) return `<p class="muted small">يظهر منحنى التقدم بعد اختبارين على الأقل</p>`;
  const W = 640, H = 220, px = 34, py = 22; const X = i => W - px - i * (W - 2 * px) / (pts.length - 1); const Y = v => H - py - v / 100 * (H - 2 * py);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i)},${Y(p.v)}`).join(''); const area = d + `L${X(pts.length - 1)},${H - py}L${X(0)},${H - py}Z`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H + 26}" role="img" aria-label="منحنى التقدم"><defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--brand)" stop-opacity=".28"/><stop offset="1" stop-color="var(--brand)" stop-opacity="0"/></linearGradient></defs>${[0, 50, 100].map(v => `<line x1="${px}" x2="${W - px}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)" stroke-dasharray="4 5"/><text x="${W - 4}" y="${Y(v) + 4}" font-size="12" text-anchor="end">${v}</text>`).join('')}<path d="${area}" fill="url(#lg)"/><path d="${d}" fill="none" stroke="var(--brand)" stroke-width="3.5" stroke-linejoin="round"/>${pts.map((p, i) => `<circle cx="${X(i)}" cy="${Y(p.v)}" r="6" fill="var(--surface)" stroke="${pctColor(p.v)}" stroke-width="3.5"/><text x="${X(i)}" y="${H + 18}" font-size="12" text-anchor="middle">${esc(String(p.l).slice(0, 12))}</text>`).join('')}</svg>`;
}
const stat = (n, l, c = 'var(--brand)') => `<div class="stat"><i style="background:${c}"></i><span class="n" style="color:${c}">${n}</span><span class="l">${esc(l)}</span></div>`;
const empty = (t, art = 'quiz') => `<div class="empty">${ico(art, 'style="color:var(--brand)"')}<p>${t}</p></div>`;
const avatar = (n, size = 42) => `<span class="av" style="background:${colorOf(n)};width:${size}px;height:${size}px">${esc(initials(n))}</span>`;
const printHead = t => `<div class="print-head"><div><b class="disp" style="font-size:22px">${esc(t)}</b><div class="small">${esc(S.settings.schoolName || 'منصة الاختبارات')} · ${esc(S.settings.teacherName || '')}</div></div><div class="small">${fmtDate(now())}</div></div>`;

/* hero art: chalkboard with paper notes */
const ART = `<svg class="art" viewBox="0 0 260 190" aria-hidden="true"><rect x="18" y="20" width="224" height="140" rx="16" fill="rgba(0,0,0,.18)"/><rect x="12" y="12" width="224" height="140" rx="16" fill="rgba(255,255,255,.12)" stroke="rgba(255,255,255,.35)" stroke-width="2"/><path d="M40 52h90M40 72h130M40 92h70" stroke="rgba(255,255,255,.7)" stroke-width="5" stroke-linecap="round"/><g transform="rotate(-6 190 60)"><rect x="160" y="34" width="62" height="62" rx="8" fill="#ffd27a"/><path d="M172 64l10 10 20-24" stroke="#a3305f" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g><g transform="rotate(8 120 128)"><rect x="96" y="104" width="56" height="50" rx="8" fill="#ff9a80"/><path d="M108 122h32M108 134h22" stroke="#fff" stroke-width="5" stroke-linecap="round"/></g><circle cx="58" cy="128" r="18" fill="#ffd1e4"/><path d="M50 128l6 6 10-12" stroke="#a3305f" stroke-width="5" fill="none" stroke-linecap="round"/><rect x="60" y="160" width="140" height="10" rx="5" fill="rgba(255,255,255,.3)"/></svg>`;

const BOOK = `<svg class="big book" viewBox="0 0 350 250" role="img" aria-label="كتاب مفتوح تتطاير منه حروف عربية"><defs><linearGradient id="pg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#f3e6c8"/></linearGradient><linearGradient id="gd" x1="0" x2="1"><stop offset="0" stop-color="#ffd98a"/><stop offset="1" stop-color="#e9a83a"/></linearGradient></defs>
<ellipse cx="170" cy="226" rx="132" ry="12" fill="rgba(0,0,0,.22)"/>
<path d="M30 92 Q100 74 168 98 L168 222 Q100 198 30 214 Z" fill="#7d2350"/><path d="M310 92 Q240 74 172 98 L172 222 Q240 198 310 214 Z" fill="#7d2350"/>
<path d="M38 86 Q102 66 168 92 L168 214 Q102 190 38 206 Z" fill="url(#pg)"/><path d="M302 86 Q238 66 172 92 L172 214 Q238 190 302 206 Z" fill="url(#pg)"/>
<path d="M168 92 L168 214 M172 92 L172 214" stroke="#d9c49a" stroke-width="2"/>
<g stroke="#c9b083" stroke-width="3.2" stroke-linecap="round" fill="none"><path d="M60 110 Q108 98 152 112"/><path d="M60 128 Q108 116 152 130"/><path d="M60 146 Q100 136 140 146"/><path d="M60 164 Q108 152 152 166"/><path d="M188 112 Q232 98 280 110"/><path d="M188 130 Q232 116 280 128"/><path d="M200 146 Q240 136 280 146"/><path d="M188 166 Q232 152 280 164"/></g>
<text x="104" y="196" text-anchor="middle" font-family="Aref Ruqaa,serif" font-size="26" fill="#a3305f">لغتي</text><text x="238" y="196" text-anchor="middle" font-family="Aref Ruqaa,serif" font-size="26" fill="#c0612f">هويتي</text>
<g font-family="Aref Ruqaa,serif" font-weight="700"><text x="170" y="62" text-anchor="middle" font-size="70" fill="url(#gd)">ض</text><text x="92" y="52" font-size="36" fill="#ffd1e4" transform="rotate(-14 92 52)">أ</text><text x="250" y="46" font-size="34" fill="#e3d0ff" transform="rotate(12 250 46)">ع</text><text x="40" y="70" font-size="26" fill="#ffd98a" opacity=".9">ب</text><text x="292" y="78" font-size="28" fill="#ffd1e4" opacity=".9">ن</text></g>
<g fill="#fff"><path d="M128 22l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" opacity=".85"/><path d="M220 14l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" opacity=".7"/><circle cx="66" cy="34" r="2.5" opacity=".6"/><circle cx="300" cy="30" r="2" opacity=".6"/></g>
<g transform="translate(36 -40) rotate(30 268 150)"><rect x="258" y="96" width="14" height="96" rx="5" fill="#8a5a2b"/><rect x="258" y="96" width="5" height="96" rx="2.5" fill="#b07a42"/><path d="M258 192 L265 214 L272 192 Z" fill="#2b1d10"/></g><circle cx="322" cy="168" r="4.5" fill="#2b1d10" opacity=".7"/></svg>`;

/* ---------------- shell ---------------- */
function navItems() {
  const pend = pendingReviews().length, appr = S.quizzes.filter(q => q.status === 'pending').length, unread = unreadCount();
  if (S.me.role === 'student') return [['dash', 'home', 'الرئيسية'], ['myres', 'chart', 'نتائجي'], ['msgs', 'msg', 'الرسائل', unread], ['mycerts', 'cert', 'شهاداتي']];
  const it = [['dash', 'home', 'الرئيسية'], ['quizzes', 'quiz', 'الاختبارات'], ['review', 'review', 'المراجعة', pend], ['reports', 'chart', 'التقارير'], ['students', 'users', 'الطلاب'], ['msgs', 'msg', 'الرسائل', unread]];
  if (isAdmin()) it.splice(2, 0, ['approvals', 'shield', 'الاعتمادات', appr]), it.push(['certs', 'cert', 'الشهادات'], ['classes', 'class', 'الفصول'], ['delegates', 'users', 'المفوضون', S.users.filter(u => u.role === 'pending_delegate').length], ['settings', 'gear', 'الإعدادات']);
  return it;
}
function render() {
  const root = $('#app');
  if (!S.ready) { root.innerHTML = `<div style="min-height:100vh;display:grid;place-items:center"><div class="center">${ART.replace('class="art"', 'style="width:180px;color:var(--brand)"')}<p class="muted" style="margin-top:12px">جارٍ التحميل…</p></div></div>`; return; }
  if (S.fatal) { root.innerHTML = `<div style="min-height:100vh;display:grid;place-items:center;padding:20px"><div class="card col" style="max-width:560px"><h2>تعذر فتح الحساب</h2><p class="muted">صوّر هذه الرسالة وأرسلها للدعم الفني:</p><pre dir="ltr" style="white-space:pre-wrap;background:var(--surface2);padding:12px;border-radius:12px;font-size:13px">${esc(S.fatal)}</pre><p class="small muted" dir="ltr">${esc(S.user?.email || '')} · verified: ${S.user?.emailVerified}</p><div class="row"><button class="btn" onclick="location.reload()">إعادة المحاولة</button><button class="btn ghost" data-a="logout">خروج</button></div></div></div>`; return; }
  if (!S.user || !S.me || S.me.role === 'pending_delegate' || S.me.active === false || S.gate) { root.innerHTML = viewGate(); afterRender(); return; }
  if (S.view === 'take' && S.take) { root.innerHTML = `<main class="main take">${viewTake()}</main>`; afterRender(); return; }
  const items = navItems(); const navB = (cls_) => items.map(([v, i, l, b]) => `<button class="nav ${S.view === v || (S.p.from === v) ? 'on' : ''}" data-a="nav" data-v="${v}">${ico(i)}<span>${l}</span>${b ? `<span class="badge">${b}</span>` : ''}</button>`).join('');
  const V = VIEWS[S.view] || VIEWS.dash;
  root.innerHTML = `<div class="shell"><aside class="side"><div class="logo">${ico('spark', 'style="width:34px;height:34px"')}<div><b>${esc(S.settings.platformName || 'سبورة')}</b><small>${esc(S.settings.schoolName || 'منصة الاختبارات الذكية')}</small></div></div>${navB()}<div class="me"><div class="row">${avatar(S.me.name, 36)}<div class="grow"><b style="display:block;font-size:14px">${esc(S.me.name)}</b><span style="opacity:.8;font-size:12.5px">${S.me.role === 'admin' ? 'المدير العام' : S.me.role === 'delegate' ? 'معلم مفوض' : esc(clsName(S.me.classId))}</span></div><button class="btn icon sm" style="background:rgba(255,255,255,.15);color:inherit" data-a="logout" title="خروج" aria-label="خروج">${ico('out')}</button></div></div></aside>
  <main class="main"><div class="mtop noprint"><b>${esc(S.settings.platformName || 'سبورة')}</b><button class="btn sm" style="background:rgba(255,255,255,.18);color:inherit" data-a="logout">${ico('out')} خروج</button></div>${!LIVE ? `<div class="alert br noprint" style="margin-bottom:16px">${ico('eye', 'style="width:22px"')}<span class="grow">وضع المعاينة: بيانات تجريبية محفوظة في هذا المتصفح فقط. بعد ربط Firebase يعمل الموقع للجميع.</span><button class="btn sm soft" data-a="demoSwitch">تبديل الدور</button></div>` : ''}${V()}</main>
  <nav class="bnav noprint">${navB()}</nav></div>`;
  afterRender();
}
function afterRender() { requestAnimationFrame(() => $$('circle.p[data-off]').forEach(c => c.style.strokeDashoffset = c.dataset.off)); (S.after || []).forEach(f => f()); S.after = []; }
A.nav = el => { if (S.view === 'editor' && S.ed?.dirty) { ask('مغادرة المحرر؟', 'لديك تعديلات غير محفوظة.', 'مغادرة', true).then(ok => { if (ok) { S.ed = null; go(el.dataset.v); } }); return; } go(el.dataset.v); };
A.go = el => go(el.dataset.v, { ...el.dataset });
A.logout = async () => { if (await ask('تسجيل الخروج؟', '', 'خروج')) { S.unsubs.forEach(u => u()); S.unsubs = []; await AUTH.signOut(); } };

/* ---------------- gate: auth, profile, verify ---------------- */
function viewGate() {
  const left = `<div class="art lugha"><div class="row">${ico('spark', 'style="width:36px;height:36px"')}<b class="disp" style="font-size:24px">${esc(S.settings.platformName || 'سبورة')}</b></div><div class="col" style="gap:6px"><span class="kick">أهلًا بكم في</span><h1 class="ruq">منصة <em>لغتي</em></h1><p class="who"><span></span>للمعلمة نورة الهاجري<span></span></p></div>${BOOK}</div>`;
  let form = '';
  if (!S.user) {
    const m = S.authMode;
    form = `<div><h2>${m === 'in' ? 'تسجيل الدخول' : m === 'up' ? 'إنشاء حساب جديد' : 'استعادة كلمة المرور'}</h2><p class="muted" style="margin-top:6px">${m === 'up' ? 'للطلاب والمعلمين المتعاونين. بعد التسجيل تختار فصلك.' : m === 'in' ? 'أهلًا بعودتك' : 'نرسل لك رابطًا لتعيين كلمة مرور جديدة'}</p></div>
    <form class="col" data-f="auth"><label class="f">${m === 'in' ? 'البريد الإلكتروني أو رقم الطالب' : 'البريد الإلكتروني'}<input class="in" id="a-email" type="${m === 'in' ? 'text' : 'email'}" autocomplete="username" required dir="ltr"></label>${m !== 'reset' ? `<label class="f">كلمة المرور<input class="in" id="a-pass" type="password" autocomplete="${m === 'up' ? 'new-password' : 'current-password'}" required minlength="6" dir="ltr"></label>` : ''}${m === 'up' ? `<label class="f">تأكيد كلمة المرور<input class="in" id="a-pass2" type="password" autocomplete="new-password" required dir="ltr"></label>` : ''}<p id="a-err" class="small" style="color:var(--bad);min-height:1.2em"></p><button class="btn" type="submit">${m === 'in' ? 'دخول' : m === 'up' ? 'إنشاء الحساب' : 'إرسال الرابط'}</button></form>
    <div class="row sp small">${m !== 'in' ? `<button class="btn ghost sm" data-a="authMode" data-m="in">لدي حساب</button>` : `<button class="btn ghost sm" data-a="authMode" data-m="up">حساب جديد</button><button class="btn ghost sm" data-a="authMode" data-m="reset">نسيت كلمة المرور</button>`}</div>
    ${!LIVE ? `<div class="card flat" style="background:var(--surface2)"><b>جرّب المعاينة مباشرة</b><p class="small muted" style="margin:4px 0 10px">بيانات تجريبية جاهزة لتشاهد كل الواجهات</p><div class="row"><button class="btn sm" data-a="demoLogin" data-r="admin">دخول كمعلم (المدير)</button><button class="btn sm acc" data-a="demoLogin" data-r="student">دخول كطالب</button><button class="btn sm ghost" data-a="demoLogin" data-r="delegate">دخول كمفوض</button></div></div>` : ''}`;
  } else if (LIVE && S.user.email === ADMIN_EMAIL && !S.user.emailVerified) {
    form = `<h2>تأكيد بريد المدير</h2><p class="muted">لحماية حساب المدير أرسلنا رابط تأكيد إلى <b dir="ltr">${esc(S.user.email)}</b>. افتح الرابط ثم اضغط الزر بالأسفل.</p><div class="row"><button class="btn" data-a="verified">تم التأكيد</button><button class="btn ghost" data-a="resendVerify">إعادة الإرسال</button><button class="btn ghost" data-a="logout">خروج</button></div>`;
  } else if (S.me?.active === false) {
    form = `<h2>الحساب موقوف</h2><p class="muted">تم إيقاف هذا الحساب مؤقتًا. تواصل مع معلمك.</p><button class="btn ghost" data-a="logout">خروج</button>`;
  } else if (S.me?.role === 'pending_delegate') {
    form = `<h2>طلبك قيد المراجعة</h2><p class="muted">أرسلنا طلب التفويض للمدير العام. بعد الموافقة وتحديد فصولك ستظهر لك لوحة المعلم.</p><div class="row"><button class="btn" data-a="recheck">تحديث</button><button class="btn ghost" data-a="logout">خروج</button></div>`;
  } else {
    const ac = S.classes;
    form = `<div><h2>أكمل بياناتك</h2><p class="muted" style="margin-top:6px">مرة واحدة فقط، ليتعرف عليك معلمك</p></div><form class="col" data-f="profile">
    <div class="f"><span style="font-weight:500;font-size:14.5px">أنا</span><div class="pick"><label><input type="radio" name="p-role" value="student" checked data-a="roleToggle"><span>طالب / طالبة</span></label><label><input type="radio" name="p-role" value="pending_delegate" data-a="roleToggle"><span>معلم متعاون (طلب تفويض)</span></label></div></div>
    <div id="p-st" class="col"><label class="f">الفصل${ac.length ? `<select class="in" id="p-class" data-c="pClass"><option value="">اختر فصلك</option>${ac.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select>` : `<p class="alert">لم يضف المعلم الفصول بعد، حاول لاحقًا</p>`}</label><div id="p-rs" class="col"></div></div>
    <label class="f" id="p-nm" style="display:none">الاسم الكامل<input class="in" id="p-name" maxlength="80"></label>
    <label class="f">رقم الجوال (اختياري)<input class="in" id="p-phone" maxlength="15" inputmode="tel" dir="ltr"></label><p id="p-err" class="small" style="color:var(--bad)"></p><button class="btn" type="submit">حفظ والمتابعة</button></form><button class="btn ghost sm" data-a="logout">خروج</button>`;
  }
  return `<div class="auth">${left}<div class="form">${form}</div></div>`;
}
A.authMode = el => { S.authMode = el.dataset.m; render(); };
A.roleToggle = () => { const st = $('input[name=p-role]:checked').value === 'student'; $('#p-st').style.display = st ? '' : 'none'; $('#p-nm').style.display = st && ($('#p-rid') || !$('#p-class')?.value) ? 'none' : ''; };
A.pClass = async el => {
  const box = $('#p-rs'); box.innerHTML = '<p class="small muted">جارٍ تحميل أسماء الفصل…</p>'; S.rosterOpts = [];
  if (!el.value) { box.innerHTML = ''; $('#p-nm').style.display = 'none'; return; }
  const list = (await DB.query('roster', [['classId', '==', el.value]]).catch(() => [])).filter(r => !r.claimedBy).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  S.rosterOpts = list;
  if (list.length) {
    box.innerHTML = `<label class="f">اختر اسمك من قائمة الفصل<select class="in" id="p-rid" data-c="pRid"><option value="">اختر اسمك</option>${list.map(r => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('')}</select></label><label class="f" id="p-rnol" style="display:none">رقم الطالب للتحقق (كما سجّله المعلم)<input class="in" id="p-rno" maxlength="20" inputmode="numeric" dir="ltr"></label><p class="small muted">اسمك غير موجود؟ راجع معلمك ليضيفه أولًا.</p>`;
    $('#p-nm').style.display = 'none';
  } else {
    box.innerHTML = `<label class="f">رقم الطالب أو رقم الهوية (اختياري)<input class="in" id="p-no" maxlength="20" inputmode="numeric"></label>`;
    $('#p-nm').style.display = '';
  }
};
A.pRid = el => { const r = (S.rosterOpts || []).find(x => x.id === el.value); $('#p-rnol').style.display = r?.needsNo ? '' : 'none'; };
A.verified = async () => { try { const u = await AUTH.reload(); S.user = u; if (!u.emailVerified) return toast('لم يتم التأكيد بعد، افتح الرابط من بريدك أولًا'); toast('جارٍ فتح لوحة المعلم…'); await onAuthed(u); } catch (e) { S.fatal = (e.code || '') + ' ' + (e.message || e); render(); } };
A.resendVerify = () => safe(() => AUTH.sendVerify(), 'تم إرسال الرابط');
A.recheck = async () => { S.me = await DB.get('users', S.user.uid); if (S.me?.role !== 'pending_delegate') await onAuthed(S.user); else { render(); toast('ما زال الطلب قيد المراجعة'); } };
async function submitAuth() {
  const e = S.authMode === 'in' ? loginEmail($('#a-email').value) : $('#a-email').value.trim().toLowerCase(), p = $('#a-pass')?.value, err = $('#a-err'); err.textContent = '';
  try {
    if (S.authMode === 'reset') { if (!e.includes('@') || isStuEmail(e)) { err.textContent = 'الطالب الذي أنشأ المعلم حسابه يطلب كلمة المرور من معلمه'; return; } await AUTH.reset(e); toast('أرسلنا رابط الاستعادة إلى بريدك'); S.authMode = 'in'; render(); return; }
    if (S.authMode === 'up') { if (p !== $('#a-pass2').value) { err.textContent = 'كلمتا المرور غير متطابقتين'; return; } await AUTH.signUp(e, p); if (LIVE && e === ADMIN_EMAIL) await AUTH.sendVerify(); }
    else await AUTH.signIn(e, p);
  } catch (x) { err.textContent = AUTH_ERR(x.code); }
}
async function submitProfile() {
  const role = $('input[name=p-role]:checked').value, classId = $('#p-class')?.value || '', err = $('#p-err'); err.textContent = '';
  const d = { email: S.user.email, role, phone: $('#p-phone').value.trim(), active: true, createdAt: now() };
  if (role === 'student') {
    if (!classId) return err.textContent = 'اختر الفصل';
    const rid = $('#p-rid')?.value;
    if ($('#p-rid')) {
      const r = S.rosterOpts.find(x => x.id === rid); if (!r) return err.textContent = 'اختر اسمك من القائمة';
      const no = latinDigits($('#p-rno')?.value || '').trim(); if (r.needsNo && !no) return err.textContent = 'اكتب رقم الطالب للتحقق';
      Object.assign(d, { name: r.name, classId, studentNo: r.needsNo ? no : '', rosterId: r.id });
      try { await DB.batch([{ op: 'set', c: 'users', id: S.user.uid, d }, { op: 'update', c: 'roster', id: r.id, d: { claimedBy: S.user.uid, claimedAt: now() } }]); }
      catch (e) { console.error(e); return err.textContent = e.code === 'permission-denied' ? 'الرقم لا يطابق الاسم المختار، تأكد منه أو راجع معلمك' : 'تعذر الحفظ، حاول مرة أخرى'; }
      return onAuthed(S.user);
    }
    Object.assign(d, { classId, studentNo: latinDigits($('#p-no')?.value || '').trim() });
  }
  d.name = $('#p-name').value.trim(); if (d.name.length < 3) return err.textContent = 'اكتب اسمك الكامل';
  await safe(async () => { await DB.set('users', S.user.uid, d); if (role === 'pending_delegate') await DB.add('messages', { from: S.user.uid, fromName: d.name, to: 'admin', toName: 'المدير', kind: 'msg', subject: 'طلب تفويض جديد', body: `طلب ${d.name} (${S.user.email}) صلاحية معلم مفوض. راجع صفحة المفوضين.`, createdAt: now(), readBy: [] }); await onAuthed(S.user); });
}
document.addEventListener('submit', e => { const f = e.target.dataset.f; if (!f) return; e.preventDefault(); ({ auth: submitAuth, profile: submitProfile, ...FORMS })[f]?.(e.target); });
const FORMS = {};

/* ---------------- boot & loading ---------------- */
async function loadCommon() {
  const [cl, st] = await Promise.all([DB.query('classes'), DB.get('settings', 'app')]);
  S.classes = cl.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'ar')); S.settings = st || {};
}
async function onAuthed(u) {
  S.user = u; S.fatal = null; S.unsubs.forEach(f => f()); S.unsubs = [];
  if (!u) { S.me = null; S.ready = true; render(); return; }
  try {
    if (LIVE && u.email === ADMIN_EMAIL) { try { u = S.user = await AUTH.reload(); } catch (e) { console.warn(e); } }
    await loadCommon().catch(console.warn);
    if (LIVE && u.email === ADMIN_EMAIL && !u.emailVerified) { S.me = null; S.ready = true; render(); return; }
    let me = await DB.get('users', u.uid);
    if (!me && u.email === ADMIN_EMAIL) {
      me = { name: S.settings.teacherName || 'المعلم', email: u.email, role: 'admin', active: true, createdAt: now() };
      try { await DB.set('users', u.uid, me); }
      catch (e) { await new Promise(r => setTimeout(r, 1500)); if (LIVE) await AUTH.reload(); await DB.set('users', u.uid, me); }
      me.id = u.uid;
    }
    if (me && u.email === ADMIN_EMAIL && me.role !== 'admin') { me.role = 'admin'; await DB.update('users', u.uid, { role: 'admin' }).catch(() => { }); }
    S.me = me; S.ready = true;
    if (!me || me.role === 'pending_delegate' || me.active === false) { render(); return; }
    if (isAdmin()) await ensureSeedTemplates().catch(console.warn);
    await (isStaff() ? loadStaff() : loadStudent());
    S.view = 'dash'; render(); startWatch();
  } catch (e) {
    console.error(e); S.ready = true; S.me = null;
    S.fatal = (e.code ? e.code + ': ' : '') + (e.message || String(e)); render();
  }
}
async function ensureSeedTemplates() { const t = await DB.query('templates'); if (!t.length) for (const x of DEFAULT_TEMPLATES) await DB.add('templates', { ...x, createdAt: now() }); }
async function loadStaff() {
  let qz, subs, users;
  if (isAdmin()) [qz, subs, users] = await Promise.all([DB.query('quizzes'), DB.query('submissions'), DB.query('users')]);
  else [qz, subs, users] = await Promise.all([DB.query('quizzes', [['createdBy', '==', S.user.uid]]), DB.query('submissions', [['ownerId', '==', S.user.uid]]), DB.query('users')]);
  S.quizzes = qz.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); S.subs = subs; S.users = users;
  const [revs, tpl, creds, roster] = await Promise.all([DB.query('reviews').catch(() => []), DB.query('templates').catch(() => []), isAdmin() ? DB.query('creds').catch(() => []) : [], isAdmin() ? DB.query('roster').catch(() => []) : []]);
  S.roster = roster;
  S.creds = Object.fromEntries(creds.map(c => [c.id, c]));
  S.reviews = Object.fromEntries(revs.map(r => [r.id, r])); S.templates = tpl;
  const ks = await Promise.all(S.quizzes.map(q => DB.get('quizKeys', q.id).catch(() => null)));
  S.keys = Object.fromEntries(S.quizzes.map((q, i) => [q.id, ks[i]]));
}
async function loadStudent() {
  const [qz, subs] = await Promise.all([DB.query('quizzes', [['pubClasses', 'array-contains', S.me.classId]]), DB.query('submissions', [['uid', '==', S.user.uid]])]);
  S.quizzes = qz.sort((a, b) => (b.publishedAt || b.createdAt || 0) - (a.publishedAt || a.createdAt || 0)); S.subs = subs;
  const revs = await Promise.all(subs.map(s => DB.get('reviews', s.id).catch(() => null)));
  S.reviews = Object.fromEntries(subs.map((s, i) => [s.id, revs[i]]).filter(x => x[1]));
  const ks = await Promise.all(subs.map(s => { const q = quizById(s.quizId); return q && (q.resultsMode !== 'manual' || q.released) ? DB.get('quizKeys', s.quizId).catch(() => null) : null; }));
  S.keys = Object.fromEntries(subs.map((s, i) => [s.quizId, ks[i]]));
}
function startWatch() {
  const merge = (k) => list => { S._m ||= {}; S._m[k] = list; S.msgs = [...new Map(Object.values(S._m).flat().map(m => [m.id, m])).values()].sort((a, b) => b.createdAt - a.createdAt); if (S.view !== 'take' && S.view !== 'editor') softRender(); };
  if (isAdmin()) S.unsubs.push(DB.watch('messages', [], merge('all')));
  else {
    const u = S.user.uid; S.unsubs.push(DB.watch('messages', [['to', '==', u]], merge('to')), DB.watch('messages', [['from', '==', u]], merge('from')));
    if (S.me.role === 'student') S.unsubs.push(DB.watch('messages', [['to', '==', 'all']], merge('all')), DB.watch('messages', [['to', '==', 'class:' + S.me.classId]], merge('cls')));
  }
  if (isAdmin()) S.unsubs.push(DB.watch('submissions', [], list => { if (list.length !== S.subs.length) { S.subs = list; if (!['take', 'editor'].includes(S.view)) softRender(); } }));
}
let srT; function softRender() { clearTimeout(srT); srT = setTimeout(() => { const ae = document.activeElement; if (ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName) && !$('#ov-root').contains(ae)) return; if ($('#ov-root').innerHTML) return; render(); }, 250); }
async function reload() { await loadCommon(); await (isStaff() ? loadStaff() : loadStudent()); render(); }
A.reload = () => reload().then(() => toast('تم التحديث'));
const unreadCount = () => S.msgs.filter(m => m.from !== S.user?.uid && !(m.readBy || []).includes(S.user?.uid) && (isAdmin() ? m.to === 'admin' || m.to === S.user.uid : true)).length;

/* ---------------- global events ---------------- */
document.addEventListener('click', e => { const el = e.target.closest('[data-a]'); if (!el || el.disabled) return; const f = A[el.dataset.a]; if (f) { if (el.tagName === 'A' || el.type === 'submit') { } f(el, e); } });
document.addEventListener('input', e => { const el = e.target.closest('[data-b]'); if (el) BIND(el); });
document.addEventListener('change', e => { const el = e.target.closest('[data-c]'); if (el) A[el.dataset.c]?.(el, e); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#ov-root').innerHTML) closeModal(); });
let BIND = () => { };

/* demo */
A.demoLogin = async el => { await seedDemo(); const r = el.dataset.r; const acc = { admin: ADMIN_EMAIL, student: 'sara@demo.sa', delegate: 'huda@demo.sa' }[r]; await AUTH.signIn(acc, 'demo123'); };
A.demoSwitch = async () => { openModal(`<h2>تبديل الدور في المعاينة</h2><div class="col" style="margin-top:16px"><button class="btn" data-a="demoAs" data-r="admin">المعلم (المدير العام)</button><button class="btn acc" data-a="demoAs" data-r="student">طالب: سارة</button><button class="btn soft" data-a="demoAs" data-r="delegate">معلم مفوض: هدى</button><hr><button class="btn danger" data-a="demoReset">مسح بيانات المعاينة والبدء من جديد</button></div>`); };
A.demoAs = async el => { closeModal(); await AUTH.signOut(); await A.demoLogin(el); };
A.demoReset = async () => { closeModal(); DB.reset(); store.del('qz_demo_acc'); store.del('qz_demo_seeded'); await AUTH.signOut(); toast('تم مسح بيانات المعاينة'); };

async function boot() {
  render();
  if (LIVE) { try { await makeFirebase(); } catch (e) { $('#app').innerHTML = `<div class="empty"><h2>تعذر الاتصال بـ Firebase</h2><p>${esc(e.message)}</p></div>`; return; } }
  else { DB = makeLocal(); AUTH = makeLocalAuth(); }
  AUTH.onChange(u => onAuthed(u).catch(e => { console.error(e); S.ready = true; render(); toast('تعذر تحميل البيانات: ' + (e.code || e.message)); }));
}

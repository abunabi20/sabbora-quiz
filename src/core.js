'use strict';
/* ============================================================
   الإعدادات: الصق هنا إعدادات مشروع Firebase الخاص بالمنصة
   (من Project settings > Your apps > Web app > SDK setup)
   إذا تُركت فارغة يعمل الموقع في "وضع المعاينة" ببيانات تجريبية
   ============================================================ */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDhMBslev8FfSWaQc00xjuMSITI0ibXz9Y",
  authDomain: "sabbora-quiz.firebaseapp.com",
  projectId: "sabbora-quiz",
  storageBucket: "sabbora-quiz.firebasestorage.app",
  messagingSenderId: "1079308998936",
  appId: "1:1079308998936:web:2999d5df1a168bb547666d"
};
const ADMIN_EMAIL = 'nora141453@gmail.com';
const LIVE = !!FIREBASE_CONFIG.apiKey;
const FB_VER = '10.12.2';
const STU_DOMAIN = 'students.lughati.app';
const latinDigits = s => String(s ?? '').replace(/[\u0660-\u0669]/g, d => d.charCodeAt(0) - 0x660).replace(/[\u06F0-\u06F9]/g, d => d.charCodeAt(0) - 0x6F0);
const loginEmail = v => { v = latinDigits(v).trim().toLowerCase(); return v.includes('@') ? v : v.replace(/\s+/g, '') + '@' + STU_DOMAIN; };
const isStuEmail = e => String(e || '').endsWith('@' + STU_DOMAIN);
const genPass = () => String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));

/* ---------------- utils ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rid = (n = 10) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
const now = () => Date.now();
const clone = o => JSON.parse(JSON.stringify(o ?? null));
const sum = a => a.reduce((x, y) => x + (+y || 0), 0);
const avg = a => a.length ? sum(a) / a.length : 0;
const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const stdev = a => { if (a.length < 2) return 0; const m = avg(a); return Math.sqrt(avg(a.map(x => (x - m) ** 2))); };
const r1 = x => Math.round((+x || 0) * 10) / 10;
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const shuffle = (a, seed) => { const r = [...a]; let s = seed || Math.random() * 1e9; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const hashStr = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 1e9; return h; };
const fmtDate = t => t ? new Date(t).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
const fmtDT = t => t ? new Date(t).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
const ago = t => { const d = (now() - t) / 1000; if (d < 60) return 'الآن'; if (d < 3600) return `قبل ${Math.floor(d / 60)} د`; if (d < 86400) return `قبل ${Math.floor(d / 3600)} س`; return fmtDate(t); };
const initials = n => String(n || '؟').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join(' ');
const PALETTE = ['#c2417a', '#8a5cc9', '#e0a22a', '#3d7bd9', '#8a5cc7', '#2e9e6b', '#d14f7c', '#1f8aa0'];
const colorOf = s => PALETTE[hashStr(s) % PALETTE.length];
const grade5 = p => p >= 90 ? ['ممتاز', 'ok'] : p >= 80 ? ['جيد جدًا', 'br'] : p >= 65 ? ['جيد', 'gold'] : p >= 50 ? ['مقبول', 'warn'] : ['يحتاج دعمًا', 'bad'];
const pctColor = p => p >= 85 ? 'var(--ok)' : p >= 65 ? 'var(--brand)' : p >= 50 ? 'var(--gold)' : 'var(--bad)';
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
  del(k) { try { localStorage.removeItem(k); } catch { } }
};

/* ---------------- Arabic-aware text similarity ---------------- */
const STOP = new Set(['في', 'من', 'علي', 'الي', 'عن', 'هو', 'هي', 'ان', 'او', 'ثم', 'مع', 'هذا', 'هذه', 'ذلك', 'التي', 'الذي', 'كان', 'the', 'a', 'an', 'of', 'is', 'to', 'and', 'in']);
function normAr(s) {
  return String(s ?? '').toLowerCase()
    .replace(/[٠-٩]/g, d => d.charCodeAt(0) - 0x660)
    .replace(/[۰-۹]/g, d => d.charCodeAt(0) - 0x6F0)
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}\s.]/gu, ' ').replace(/\s+/g, ' ').trim();
}
const stem = w => { if (w.length > 4 && w.startsWith('وال')) w = w.slice(3); else if (w.length > 3 && w.startsWith('ال')) w = w.slice(2); else if (w.length > 4 && /^[وفبل]ال/.test(w)) w = w.slice(3); return w; };
const toks = s => normAr(s).split(' ').filter(w => w && !STOP.has(w)).map(stem);
function lev(a, b) {
  if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
  let p = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) { const c = [i]; for (let j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; }
  return p[b.length];
}
const levR = (a, b) => { const m = Math.max(a.length, b.length); return m ? 1 - lev(a, b) / m : 1; };
function tokenF1(a, b) {
  const A = toks(a), B = toks(b); if (!A.length || !B.length) return 0;
  const used = new Set(); let hit = 0;
  for (const t of A) { let bi = -1, bs = 0; B.forEach((u, i) => { if (used.has(i)) return; const s = levR(t, u); if (s > bs) { bs = s; bi = i; } }); if (bs >= .8) { used.add(bi); hit++; } }
  const P = hit / A.length, R = hit / B.length; return P + R ? 2 * P * R / (P + R) : 0;
}
function textSim(a, b) {
  const na = normAr(a), nb = normAr(b); if (!na || !nb) return 0;
  const xa = parseFloat(na), xb = parseFloat(nb);
  if (/^-?[\d.]+$/.test(na) && /^-?[\d.]+$/.test(nb)) return xa === xb ? 1 : 0;
  const sa = toks(a).join(' '), sb = toks(b).join(' ');
  return Math.max(levR(na, nb), levR(sa, sb), tokenF1(a, b));
}
function kwCoverage(ans, kws) {
  const A = toks(ans); if (!kws?.length) return null;
  let hit = 0; for (const k of kws) { const kt = toks(k); if (!kt.length) continue; const ok = kt.every(t => A.some(u => levR(t, u) >= .8)); if (ok) hit++; }
  return hit / kws.length;
}

/* ---------------- question types ---------------- */
const IC = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  quiz: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  review: '<path d="M9 11l3 3 8-8"/><path d="M20 12v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h9"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6M17 11a3 3 0 1 0 0-6M22 20c0-3-2-5-5-5"/>',
  class: '<path d="M3 7l9-4 9 4-9 4z"/><path d="M7 9v5c0 2 2.5 3 5 3s5-1 5-3V9M21 7v6"/>',
  msg: '<path d="M4 5h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1z"/>',
  cert: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14l-1.5 8 5-3 5 3-1.5-8"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  print: '<path d="M7 9V3h10v6M7 18H4v-7h16v7h-3"/><rect x="7" y="14" width="10" height="7"/>',
  out: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h10"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  send: '<path d="M21 3L3 11l7 3 3 7z"/><path d="M10 14l11-11"/>',
  spark: '<path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  img: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/>',
  dl: '<path d="M12 3v12M6 10l6 6 6-6M4 21h16"/>',
  back: '<path d="M14 6l6 6-6 6M20 12H4"/>',
  mcq: '<circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/><path d="M11 7h9M11 17h9"/>',
  multi: '<rect x="3.5" y="4.5" width="5" height="5" rx="1"/><rect x="3.5" y="14.5" width="5" height="5" rx="1"/><path d="M4.5 7l1.5 1.5 2-2.5M4.5 17l1.5 1.5 2-2.5M11 7h9M11 17h9"/>',
  tf: '<path d="M3 12l3 3 5-6"/><path d="M15 8l6 6M21 8l-6 6"/>',
  short: '<path d="M4 7h16M4 12h10M4 17h7"/>',
  essay: '<path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h4"/>',
  fill: '<path d="M3 12h4M17 12h4"/><rect x="9" y="9" width="6" height="6" rx="1"/>',
  match: '<circle cx="5" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 6l10 12M7 18L17 6"/>',
  order: '<path d="M8 6h12M8 12h12M8 18h12M3 5l1-1v4M3 11h2l-2 2h2M3 17h2v3H3"/>',
  numeric: '<path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16"/>',
  passage: '<path d="M4 5c3-1 5-1 8 1 3-2 5-2 8-1v14c-3-1-5-1-8 1-3-2-5-2-8-1z"/><path d="M12 6v14"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  moon: '<path d="M20 15A8 8 0 1 1 9 4a6 6 0 0 0 11 11z"/>',
  wand: '<path d="M4 20L16 8M14 4v2M20 10h-2M18 6l-1 1M12 2l.5 1.5M22 12l-1.5-.5"/>'
};
const ico = (n, s = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" ${s}>${IC[n] || ''}</svg>`;

const QT = {
  mcq: { n: 'اختيار من متعدد', d: 'إجابة واحدة صحيحة', auto: true },
  multi: { n: 'اختيارات متعددة', d: 'أكثر من إجابة صحيحة، مع درجات جزئية', auto: true },
  tf: { n: 'صح أو خطأ', d: 'سؤال بإجابتين', auto: true },
  short: { n: 'إجابة قصيرة', d: 'نص حر يُصحَّح بذكاء ويُحال إليك إن كان غامضًا', auto: true },
  essay: { n: 'سؤال مقالي', d: 'إجابة مطولة، تقدّرها أنت بمساعدة اقتراح ذكي', auto: false },
  fill: { n: 'أكمل الفراغ', d: 'نص فيه فراغات، اكتب الإجابة بين [[ ]]', auto: true },
  match: { n: 'توصيل', d: 'صِل كل عنصر بما يناسبه', auto: true },
  order: { n: 'ترتيب', d: 'رتّب العناصر بالتسلسل الصحيح', auto: true },
  numeric: { n: 'إجابة رقمية', d: 'رقم مع هامش تسامح', auto: true },
  passage: { n: 'نص قرائي', d: 'فقرة أو قطعة تسبق مجموعة أسئلة', auto: true }
};

/* split editor question into public part + key part */
function splitQ(q) {
  const base = { id: q.id, type: q.type, text: q.text || '', points: q.type === 'passage' ? 0 : (+q.points || 1), tag: q.tag || '', img: q.img || '' };
  let pub = {}, key = {};
  switch (q.type) {
    case 'mcq': case 'multi':
      pub.choices = (q.choices || []).filter(c => c.t.trim()).map(c => ({ id: c.id, t: c.t }));
      key.correct = q.type === 'mcq' ? (q.choices.find(c => c.ok)?.id || '') : q.choices.filter(c => c.ok && c.t.trim()).map(c => c.id);
      break;
    case 'tf': key.correct = q.correct === 'false' ? 'false' : 'true'; break;
    case 'short': key.accepted = (q.accepted || []).map(s => s.trim()).filter(Boolean); key.keywords = (q.keywords || []).map(s => s.trim()).filter(Boolean); break;
    case 'essay': key.model = q.model || ''; key.keywords = (q.keywords || []).map(s => s.trim()).filter(Boolean); pub.minWords = +q.minWords || 0; break;
    case 'fill': {
      const parts = [], blanks = []; const re = /\[\[(.+?)\]\]/g; let last = 0, m;
      while ((m = re.exec(q.text || ''))) { parts.push((q.text || '').slice(last, m.index)); blanks.push(m[1].split('|').map(s => s.trim()).filter(Boolean)); last = re.lastIndex; }
      parts.push((q.text || '').slice(last));
      base.text = (q.text || '').replace(re, '_____'); pub.parts = parts; key.blanks = blanks; key.source = q.text; break;
    }
    case 'match': {
      const pairs = (q.pairs || []).filter(p => p.l.trim() && p.r.trim());
      const left = pairs.map(p => ({ id: p.id, t: p.l })); const rights = pairs.map(p => ({ id: 'r' + p.id, t: p.r }));
      (q.extra || []).filter(x => x.trim()).forEach((t, i) => rights.push({ id: 'x' + i + q.id, t }));
      pub.left = left; pub.right = shuffle(rights, hashStr(q.id)); key.pairs = Object.fromEntries(pairs.map(p => [p.id, 'r' + p.id])); break;
    }
    case 'order': { const items = (q.items || []).filter(i => i.t.trim()); pub.items = shuffle(items.map(i => ({ id: i.id, t: i.t })), hashStr(q.id) + 3); key.order = items.map(i => i.id); break; }
    case 'numeric': key.value = +q.value || 0; key.tol = +q.tol || 0; pub.unit = q.unit || ''; break;
  }
  return { pub: { ...base, ...pub }, key };
}
function joinQ(p, k = {}) {
  const q = { ...clone(p) };
  switch (p.type) {
    case 'mcq': q.choices = p.choices.map(c => ({ ...c, ok: c.id === k.correct })); break;
    case 'multi': q.choices = p.choices.map(c => ({ ...c, ok: (k.correct || []).includes(c.id) })); break;
    case 'tf': q.correct = k.correct || 'true'; break;
    case 'short': q.accepted = k.accepted?.length ? [...k.accepted] : ['']; q.keywords = k.keywords || []; break;
    case 'essay': q.model = k.model || ''; q.keywords = k.keywords || []; break;
    case 'fill': q.text = k.source || p.text; break;
    case 'match': q.pairs = p.left.map(l => ({ id: l.id, l: l.t, r: p.right.find(r => r.id === k.pairs?.[l.id])?.t || '' })); q.extra = p.right.filter(r => r.id.startsWith('x')).map(r => r.t); break;
    case 'order': q.items = (k.order || p.items.map(i => i.id)).map(id => p.items.find(i => i.id === id)).filter(Boolean).map(i => ({ ...i })); break;
    case 'numeric': q.value = k.value; q.tol = k.tol; break;
  }
  return q;
}
function newQ(type) {
  const id = rid(6);
  const q = { id, type, text: '', points: type === 'essay' ? 5 : type === 'passage' ? 0 : 1, tag: '', img: '' };
  if (type === 'mcq' || type === 'multi') q.choices = [0, 1, 2, 3].map(() => ({ id: rid(4), t: '', ok: false }));
  if (type === 'tf') q.correct = 'true';
  if (type === 'short') { q.accepted = ['']; q.keywords = []; }
  if (type === 'essay') { q.model = ''; q.keywords = []; q.minWords = 0; }
  if (type === 'match') { q.pairs = [0, 1, 2].map(() => ({ id: rid(4), l: '', r: '' })); q.extra = []; }
  if (type === 'order') q.items = [0, 1, 2, 3].map(() => ({ id: rid(4), t: '' }));
  if (type === 'numeric') { q.value = 0; q.tol = 0; q.unit = ''; }
  return q;
}

/* ---------------- grading engine ---------------- */
const HI = .85, LO = .4;
function grade(q, k, a) {
  const max = +q.points || 0; const R = (frac, status, conf = 1, extra = {}) => ({ score: r1(max * frac), max, status, conf, ...extra });
  if (q.type === 'passage') return null;
  if (!k) return R(0, 'review', 0, { suggest: 0 });
  const empty = a == null || a === '' || (Array.isArray(a) && !a.length) || (typeof a === 'object' && !Array.isArray(a) && !Object.values(a).some(v => String(v ?? '').trim()));
  if (empty && q.type !== 'order') return R(0, 'wrong', 1, { empty: true });
  switch (q.type) {
    case 'mcq': return a === k.correct ? R(1, 'correct') : R(0, 'wrong');
    case 'tf': return String(a) === String(k.correct) ? R(1, 'correct') : R(0, 'wrong');
    case 'multi': {
      const c = new Set(k.correct || []), s = new Set(a || []); let right = 0, wrong = 0; s.forEach(x => c.has(x) ? right++ : wrong++);
      const f = c.size ? Math.max(0, (right - wrong) / c.size) : 0; return R(f, f >= 1 ? 'correct' : f <= 0 ? 'wrong' : 'partial');
    }
    case 'numeric': { const v = parseFloat(normAr(a)); if (isNaN(v)) return R(0, 'wrong'); return Math.abs(v - k.value) <= (k.tol || 0) + 1e-9 ? R(1, 'correct') : R(0, 'wrong'); }
    case 'match': { const ks = Object.keys(k.pairs || {}); const ok = ks.filter(l => a?.[l] === k.pairs[l]).length; const f = ks.length ? ok / ks.length : 0; return R(f, f >= 1 ? 'correct' : f <= 0 ? 'wrong' : 'partial'); }
    case 'order': { const o = k.order || []; const g = a?.length ? a : null; if (!g) return R(0, 'wrong', 1, { empty: true }); const ok = o.filter((id, i) => g[i] === id).length; const f = o.length ? ok / o.length : 0; return R(f, f >= 1 ? 'correct' : f <= 0 ? 'wrong' : 'partial'); }
    case 'fill': {
      const bl = k.blanks || []; let sure = 0, unsure = 0; const per = bl.map((alts, i) => { const s = Math.max(0, ...alts.map(t => textSim(a?.[i] || '', t))); if (s >= HI) sure++; else if (s >= .6) unsure++; return s; });
      const n = bl.length || 1; if (unsure) return R(0, 'review', r1(avg(per)), { suggest: r1(max * (sure + unsure * .5) / n), per });
      const f = sure / n; return R(f, f >= 1 ? 'correct' : f <= 0 ? 'wrong' : 'partial', 1, { per });
    }
    case 'short': {
      const sims = (k.accepted || []).map(t => textSim(a, t)); let s = sims.length ? Math.max(...sims) : 0;
      const kc = kwCoverage(a, k.keywords); if (kc != null) s = sims.length ? Math.max(s, kc * .95) : kc;
      if (s >= HI) return R(1, 'correct', s); if (s < LO) return R(0, 'wrong', 1 - s);
      return R(0, 'review', s, { suggest: r1(max * s) });
    }
    case 'essay': {
      const kc = kwCoverage(a, k.keywords); const ms = k.model ? tokenF1(a, k.model) : null;
      const s = Math.max(kc ?? 0, ms ?? 0); const words = normAr(a).split(' ').filter(Boolean).length;
      return R(0, 'review', s, { suggest: r1(max * Math.min(1, s * 1.15)), words, kc });
    }
  }
  return R(0, 'wrong');
}
function evalSub(quiz, key, sub, rev) {
  const items = []; let total = 0, max = 0, pending = 0;
  for (const q of quiz.questions || []) {
    if (q.type === 'passage') continue;
    const g = grade(q, key?.answers?.[q.id], sub.answers?.[q.id]); const ov = rev?.overrides?.[q.id];
    let it = { qid: q.id, q, ans: sub.answers?.[q.id], ...g };
    if (ov) { it.score = +ov.points; it.status = ov.points >= g.max ? 'correct' : ov.points <= 0 ? 'wrong' : 'partial'; it.reviewed = true; it.note = ov.note || ''; }
    if (it.status === 'review') pending++;
    total += it.status === 'review' ? 0 : it.score; max += g.max; items.push(it);
  }
  return { items, total: r1(total), max, pct: pct(total, max), pending };
}
const ansText = (q, a) => {
  if (a == null || a === '') return '—';
  switch (q.type) {
    case 'mcq': return q.choices?.find(c => c.id === a)?.t || '—';
    case 'multi': return (a || []).map(id => q.choices?.find(c => c.id === id)?.t).filter(Boolean).join('، ') || '—';
    case 'tf': return a === 'true' ? 'صح' : 'خطأ';
    case 'fill': return (a || []).map(x => x || '…').join(' | ');
    case 'match': return q.left.map(l => `${l.t} ← ${q.right.find(r => r.id === a?.[l.id])?.t || '…'}`).join('، ');
    case 'order': return (a || []).map(id => q.items.find(i => i.id === id)?.t).join(' ← ');
    default: return String(a);
  }
};
const keyText = (q, k) => {
  if (!k) return '';
  switch (q.type) {
    case 'mcq': return q.choices.find(c => c.id === k.correct)?.t || '';
    case 'multi': return (k.correct || []).map(id => q.choices.find(c => c.id === id)?.t).join('، ');
    case 'tf': return k.correct === 'true' ? 'صح' : 'خطأ';
    case 'short': return (k.accepted || []).join(' / ') + (k.keywords?.length ? ` (كلمات مفتاحية: ${k.keywords.join('، ')})` : '');
    case 'essay': return k.model || (k.keywords || []).join('، ');
    case 'fill': return (k.blanks || []).map(b => b.join(' / ')).join(' | ');
    case 'match': return q.left.map(l => `${l.t} ← ${q.right.find(r => r.id === k.pairs?.[l.id])?.t}`).join('، ');
    case 'order': return (k.order || []).map(id => q.items.find(i => i.id === id)?.t).join(' ← ');
    case 'numeric': return `${k.value}${k.tol ? ' ± ' + k.tol : ''} ${q.unit || ''}`;
  }
  return '';
};

/* ---------------- smart paste parser ---------------- */
function parseBulk(txt) {
  const blocks = String(txt).replace(/\r/g, '').split(/\n\s*\n/).map(b => b.trim()).filter(Boolean); const out = [];
  for (const b of blocks) {
    const lines = b.split('\n').map(l => l.trim()).filter(Boolean); let text = lines[0].replace(/^(س|سؤال)?\s*\d*\s*[:.)\-]\s*/, '').replace(/^س\s*[:.]/, '').trim();
    const opts = lines.slice(1).filter(l => /^[-*•✓✔+]/.test(l)); const ansL = lines.find(l => /^(ج|الإجابة|الاجابة)\s*[:：]/.test(l));
    const ans = ansL ? ansL.replace(/^(ج|الإجابة|الاجابة)\s*[:：]\s*/, '').trim() : '';
    if (/\[\[.+\]\]/.test(text)) { const q = newQ('fill'); q.text = text; out.push(q); continue; }
    if (opts.length >= 2) {
      const okc = opts.filter(o => /^[*✓✔+]/.test(o)).length; const q = newQ(okc > 1 ? 'multi' : 'mcq'); q.text = text;
      q.choices = opts.map(o => ({ id: rid(4), t: o.replace(/^[-*•✓✔+]\s*/, ''), ok: /^[*✓✔+]/.test(o) })); out.push(q); continue;
    }
    if (/^(صح|صحيح|خطأ|خطا|true|false)$/i.test(ans)) { const q = newQ('tf'); q.text = text; q.correct = /^(صح|صحيح|true)$/i.test(ans) ? 'true' : 'false'; out.push(q); continue; }
    if (ans && /^-?[\d٠-٩.]+$/.test(ans)) { const q = newQ('numeric'); q.text = text; q.value = parseFloat(normAr(ans)); out.push(q); continue; }
    if (ans) { const q = newQ('short'); q.text = text; q.accepted = ans.split('/').map(s => s.trim()); out.push(q); continue; }
    const q = newQ('essay'); q.text = text; out.push(q);
  }
  return out;
}

/* ---------------- data layer ---------------- */
let DB, AUTH;
function matchF(d, [f, op, v]) {
  const x = d[f]; if (op === '==') return x === v; if (op === 'in') return v.includes(x); if (op === 'array-contains') return Array.isArray(x) && x.includes(v); return true;
}
function makeLocal() {
  const K = 'qz_demo_db'; let mem = store.get(K, null) || {}; const save = () => { store.set(K, mem); window.dispatchEvent(new Event('qz-change')); };
  const C = c => (mem[c] ||= {});
  return {
    reset() { mem = {}; save(); }, raw: () => mem,
    async get(c, id) { const d = C(c)[id]; return d ? { id, ...clone(d) } : null; },
    async set(c, id, d, merge) { const v = clone(d); delete v.id; C(c)[id] = merge ? { ...(C(c)[id] || {}), ...v } : v; save(); },
    async add(c, d) { const id = rid(14); await this.set(c, id, d); return id; },
    async update(c, id, p) { if (!C(c)[id]) throw new Error('not found'); const v = clone(p); delete v.id; Object.assign(C(c)[id], v); save(); },
    async del(c, id) { delete C(c)[id]; save(); },
    async batch(ops) { for (const o of ops) { if (o.op === 'set') await this.set(o.c, o.id, o.d); else if (o.op === 'update') await this.update(o.c, o.id, o.d); else await this.del(o.c, o.id); } },
    async query(c, f = []) { return Object.entries(C(c)).map(([id, d]) => ({ id, ...clone(d) })).filter(d => f.every(x => matchF(d, x))); },
    watch(c, f, cb) { const run = () => this.query(c, f).then(cb); run(); window.addEventListener('qz-change', run); return () => window.removeEventListener('qz-change', run); }
  };
}
function makeLocalAuth() {
  let cbs = [];
  const cur = () => { const s = store.get('qz_demo_sess', null); return s ? { uid: s.uid, email: s.email, emailVerified: true } : null; };
  const fire = () => cbs.forEach(cb => cb(cur()));
  return {
    onChange(cb) { cbs.push(cb); setTimeout(() => cb(cur()), 0); },
    current: cur,
    async signIn(email, pass) { const acc = store.get('qz_demo_acc', {}); const a = acc[email.toLowerCase()]; if (!a || a.pass !== pass) throw { code: 'auth/invalid-credential' }; store.set('qz_demo_sess', { uid: a.uid, email: email.toLowerCase() }); fire(); },
    async signUp(email, pass) { const acc = store.get('qz_demo_acc', {}); const e = email.toLowerCase(); if (acc[e]) throw { code: 'auth/email-already-in-use' }; if (pass.length < 6) throw { code: 'auth/weak-password' }; acc[e] = { uid: rid(12), pass }; store.set('qz_demo_acc', acc); store.set('qz_demo_sess', { uid: acc[e].uid, email: e }); fire(); },
    async signOut() { store.del('qz_demo_sess'); fire(); },
    async sendVerify() { }, async reset() { }, async reload() { return cur(); },
    async createUser(email, pass) { const acc = store.get('qz_demo_acc', {}); const e = email.toLowerCase(); if (acc[e]) { if (acc[e].pass === pass) return acc[e].uid; throw { code: 'auth/email-already-in-use' }; } acc[e] = { uid: rid(12), pass }; store.set('qz_demo_acc', acc); return acc[e].uid; }
  };
}
async function makeFirebase() {
  const b = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
  const [ap, au, fs] = await Promise.all([import(b + 'firebase-app.js'), import(b + 'firebase-auth.js'), import(b + 'firebase-firestore.js')]);
  let creator; const app = ap.initializeApp(FIREBASE_CONFIG); const auth = au.getAuth(app); const db = fs.getFirestore(app);
  const cl = d => { const v = JSON.parse(JSON.stringify(d)); delete v.id; return v; };
  const q = (c, f) => f?.length ? fs.query(fs.collection(db, c), ...f.map(x => fs.where(...x))) : fs.collection(db, c);
  const map = s => s.docs.map(d => ({ id: d.id, ...d.data() }));
  DB = {
    async get(c, id) { try { const s = await fs.getDoc(fs.doc(db, c, id)); return s.exists() ? { id: s.id, ...s.data() } : null; } catch (e) { if (e.code === 'permission-denied') return null; throw e; } },
    async set(c, id, d, merge) { await fs.setDoc(fs.doc(db, c, id), cl(d), merge ? { merge: true } : {}); },
    async add(c, d) { return (await fs.addDoc(fs.collection(db, c), cl(d))).id; },
    async update(c, id, p) { await fs.updateDoc(fs.doc(db, c, id), cl(p)); },
    async del(c, id) { await fs.deleteDoc(fs.doc(db, c, id)); },
    async query(c, f) { return map(await fs.getDocs(q(c, f))); },
    async batch(ops) { for (let i = 0; i < ops.length; i += 450) { const b = fs.writeBatch(db); for (const o of ops.slice(i, i + 450)) { const r = fs.doc(db, o.c, o.id); if (o.op === 'set') b.set(r, cl(o.d)); else if (o.op === 'update') b.update(r, cl(o.d)); else b.delete(r); } await b.commit(); } },
    watch(c, f, cb) { return fs.onSnapshot(q(c, f), s => cb(map(s)), e => console.warn('watch', c, e.code)); }
  };
  const U = u => u ? { uid: u.uid, email: (u.email || '').toLowerCase(), emailVerified: u.emailVerified } : null;
  AUTH = {
    onChange(cb) { au.onAuthStateChanged(auth, u => cb(U(u))); },
    current: () => U(auth.currentUser),
    signIn: (e, p) => au.signInWithEmailAndPassword(auth, e, p),
    signUp: (e, p) => au.createUserWithEmailAndPassword(auth, e, p),
    signOut: () => au.signOut(auth),
    sendVerify: () => au.sendEmailVerification(auth.currentUser),
    reset: e => au.sendPasswordResetEmail(auth, e),
    async reload() { await auth.currentUser.reload(); await auth.currentUser.getIdToken(true); return U(auth.currentUser); },
    async createUser(email, pass) {
      creator ||= ap.initializeApp(FIREBASE_CONFIG, 'creator'); const a2 = au.getAuth(creator); let c;
      try { c = await au.createUserWithEmailAndPassword(a2, email, pass); }
      catch (e) { if (e.code !== 'auth/email-already-in-use') throw e; try { c = await au.signInWithEmailAndPassword(a2, email, pass); } catch { throw e; } }
      const uid = c.user.uid; await au.signOut(a2); return uid;
    }
  };
}
const AUTH_ERR = c => ({
  'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة', 'auth/wrong-password': 'كلمة المرور غير صحيحة', 'auth/user-not-found': 'لا يوجد حساب بهذا البريد',
  'auth/email-already-in-use': 'هذا البريد مسجل مسبقًا، استخدم تسجيل الدخول', 'auth/weak-password': 'كلمة المرور ضعيفة، 6 أحرف على الأقل',
  'auth/invalid-email': 'صيغة البريد غير صحيحة', 'auth/too-many-requests': 'محاولات كثيرة، انتظر قليلًا ثم أعد المحاولة', 'auth/network-request-failed': 'تعذر الاتصال بالإنترنت'
}[c] || 'حدث خطأ، حاول مرة أخرى');

/* ---------------- certificate themes ---------------- */
const CERT_THEMES = {
  royal: { n: 'ملكي ذهبي', bg: 'linear-gradient(135deg,#fffaf0,#fbefd3 60%,#f6e2b3)', cf: '#b8862b', ct: '#0d5a52', cn: '#8a5a00' },
  garden: { n: 'حديقة الورد', bg: 'linear-gradient(135deg,#fff6f6,#ffe4e8 55%,#e6f6ee)', cf: '#d9677f', ct: '#a23a58', cn: '#2e8a5f' },
  sky: { n: 'سماء النجوم', bg: 'linear-gradient(160deg,#eef6ff,#dcebff 50%,#efe6ff)', cf: '#5577d6', ct: '#2b3f9a', cn: '#7b4fc4' },
  sunrise: { n: 'شروق', bg: 'linear-gradient(135deg,#fff5ec,#ffe0cc 50%,#fff2c7)', cf: '#ec7a4e', ct: '#c24a25', cn: '#0d6a61' },
  mint: { n: 'نعناع هادئ', bg: 'linear-gradient(135deg,#f1fbf8,#d9f1ea 55%,#eaf7ff)', cf: '#2a9d8f', ct: '#0d5a52', cn: '#1d6fa0' }
};
const DEFAULT_TEMPLATES = [
  { title: 'شهادة شكر وتقدير', theme: 'royal', heading: 'شهادة شكر وتقدير', body: 'يسعدنا أن نتقدم بخالص الشكر والتقدير\nتقديرًا للتفوق في {الاختبار} والحصول على {الدرجة}\nمع أطيب التمنيات بدوام التألق والنجاح', emblem: 'star' },
  { title: 'نجم الأسبوع', theme: 'sky', heading: 'نجم الأسبوع', body: 'لأنك أضأت فصل {الفصل} بجدّك واجتهادك\nاستحققت هذا اللقب بكل جدارة', emblem: 'star' },
  { title: 'تقدير التحسن', theme: 'garden', heading: 'شهادة تميّز وتحسّن', body: 'فخورون جدًا بتقدمك الملحوظ وإصرارك\nاستمر، فالقادم أجمل بإذن الله', emblem: 'flower' },
  { title: 'الدرجة الكاملة', theme: 'sunrise', heading: 'الدرجة الكاملة', body: 'مبارك حصولك على {الدرجة} في {الاختبار}\nإنجاز رائع يستحق الاحتفاء', emblem: 'medal' }
];

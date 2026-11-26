/* ---------------- import questions from a PDF ---------------- */
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
const AR_LET = 'أابتثجحخدذرزسشصضطظعغفقكلمنهوي';
const Q_START = /^\s*(?:-\s*(?=[0-9٠-٩]))?(?:(?:س|سؤال|السؤال)\s*)?[(\[]?\s*([0-9٠-٩]{1,3})\s*[)\]\-.ـ:/]\s*(.*)$/;
const CH_START = /^\s*[(\[]?\s*([أابجدهوزa-fA-F]|[0-9٠-٩])\s*[)\].\-ـ]\s+(.+)$/;
const SECTION = /^\s*(السؤال\s+(الأول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر)|القسم|الجزء|أولا|ثانيا|ثالثا|رابعا)[\s:ـ-]*/;
const MARKS = /^\s*[*✓✔√☑+]\s*|\s*[(\[]\s*[✓✔√]\s*[)\]]\s*$|\s*\*\s*$/;
function hintOf(line) {
  const n = normAr(line);
  if (/اختار|اختيار|ضع دايره|ضعي دايره|ظلل|ظللي/.test(n)) return 'mcq';
  if (/صح|خطا|علامه|صواب/.test(n) && /امام|علامه|صح|خطا/.test(n) && !/اختار/.test(n)) return 'tf';
  if (/اكمل|اكملي|املا|املئي|الفراغ/.test(n)) return 'fill';
  if (/صل|صلي|وصل|توصيل/.test(n) && n.length < 80) return 'match';
  if (/رتب|رتبي/.test(n)) return 'order';
  return '';
}
const isEssayText = t => /^(اذكر|اذكري|وضح|وضحي|علل|عللي|اشرح|اشرحي|قارن|قارني|ما راي|بين|بيني|اكتب|اكتبي|استنتج|لماذا)/.test(normAr(t).replace(/^ال/, ''));
function splitInlineChoices(line) {
  const parts = line.split(/\s(?=[(\[]?[أبجد]\s*[)\].\-]\s)/).map(s => s.trim()).filter(Boolean);
  return parts.length >= 2 ? parts : null;
}
function parseExam(raw) {
  const lines = String(raw).normalize('NFKC').replace(/\r/g, '').replace(/[‏‎‪-‮]/g, '').split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const blocks = []; let hint = '', cur = null;
  for (const line of lines) {
    if (SECTION.test(line) || (hintOf(line) && !Q_START.test(line) && line.length < 90)) { const h = hintOf(line); if (h) hint = h; cur = null; continue; }
    const qm = line.match(Q_START);
    if (qm && !(cur && cur.choices.length && cur.choices.length < 6 && /^[0-9٠-٩]$/.test(qm[1]) && cur.hint === 'order')) { cur = { text: qm[2], choices: [], hint, ans: '' }; blocks.push(cur); }
    else if (!cur) { if (line.length > 8 && /[؟?]|\.\.\.|_{2,}/.test(line)) { cur = { text: line, choices: [], hint, ans: '' }; blocks.push(cur); } continue; }
    else {
      const am = /^\s*(الإجابة|الاجابة|الإجابه|الجواب)\s*[:：]?\s*\S|^\s*ج\s*[:：]\s*\S/.test(line); if (am) { cur.ans = line.replace(/^[^:：]*[:：]\s*/, '').trim(); continue; }
      const inl = splitInlineChoices(line);
      if (inl && inl.every(p => CH_START.test(p))) { inl.forEach(p => cur.choices.push(p)); continue; }
      if (CH_START.test(line) || /^\s*[-•○□◻▢*✓✔]\s*/.test(line)) { cur.choices.push(line); continue; }
      if (cur.choices.length) cur.choices[cur.choices.length - 1] += ' ' + line; else cur.text += ' ' + line;
    }
    if (qm) { const inl = splitInlineChoices(cur.text); if (inl && inl.length >= 3 && CH_START.test(inl[1])) { cur.text = inl[0]; inl.slice(1).forEach(p => cur.choices.push(p)); } }
  }
  const out = [];
  for (const b of blocks) {
    let text = b.text.replace(/\s*[(\[]\s*[)\]]\s*$/, '').replace(/[(\[]\s*\d+\s*(درجه|درجة|درجات)?\s*[)\]]\s*$/, '').trim(); if (text.length < 3) continue;
    const isTF = b.hint === 'tf' || (/[(\[]\s*[)\]]\s*$/.test(b.text) && !b.choices.length);
    if (b.choices.length >= 2 && b.hint !== 'match' && b.hint !== 'order') {
      const chs = b.choices.map(c => { const marked = MARKS.test(c); const m = c.replace(MARKS, '').match(CH_START); return { t: (m ? m[2] : c.replace(/^\s*[-•○□◻▢]\s*/, '')).replace(MARKS, '').trim(), ok: marked, k: m ? m[1] : '' }; });
      if (b.ans) { const a = normAr(b.ans).replace(/[^\p{L}\p{N}]/gu, ''); chs.forEach(c => { if (c.k && normAr(c.k) === a) c.ok = true; else if (a.length > 2 && normAr(c.t).replace(/[^\p{L}\p{N}]/gu, '') === a) c.ok = true; }); }
      const q = newQ(chs.filter(c => c.ok).length > 1 ? 'multi' : 'mcq'); q.text = text; q.choices = chs.map(c => ({ id: rid(4), t: c.t, ok: c.ok })); out.push(q); continue;
    }
    if (b.hint === 'order' && b.choices.length >= 2) { const q = newQ('order'); q.text = text; q.items = b.choices.map(c => ({ id: rid(4), t: c.replace(CH_START, '$2').replace(/^\s*[-•]\s*/, '') })); out.push(q); continue; }
    if (isTF) { const q = newQ('tf'); q.text = text; const a = normAr(b.ans); q.correct = /خطا|×|✗/.test(a) ? 'false' : 'true'; q._unsure = !b.ans; out.push(q); continue; }
    if (/\.{3,}|_{3,}|…/.test(text)) { const q = newQ('fill'); q.text = b.ans ? text.replace(/\s*(\.{3,}|_{3,}|…+)\s*/, ` [[${b.ans}]] `) : text.replace(/\s*(\.{3,}|_{3,}|…+)\s*/, ' [[؟]] '); out.push(q); continue; }
    const q = newQ(isEssayText(text) ? 'essay' : 'short'); q.text = text; if (b.ans) { if (q.type === 'short') q.accepted = [b.ans]; else q.model = b.ans; } out.push(q);
  }
  return out;
}

/* PDF text comes either in logical order or in visual order (glyphs left to right, Arabic presentation forms).
   Build both readings line by line and keep the one that reads like Arabic. */
function pdfLines(items) {
  const its = items.filter(i => i.str !== undefined && i.transform).map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width || 0, h: Math.abs(i.height || i.transform[3] || 10) }));
  const lines = [];
  for (const it of its) { let L = lines.find(l => Math.abs(l.y - it.y) < Math.max(2, it.h * 0.35)); if (!L) { L = { y: it.y, items: [] }; lines.push(L); } L.items.push(it); }
  lines.sort((a, b) => b.y - a.y);
  const join = arr => { let t = ''; arr.forEach((it, i) => { if (i) { const p = arr[i - 1]; const gap = Math.min(Math.abs(it.x - (p.x + p.w)), Math.abs(p.x - (it.x + it.w))); if (gap > it.h * 0.18 && !/\s$/.test(t) && !/^\s/.test(it.s)) t += ' '; } t += it.s; }); return t; };
  const mirror = t => t.replace(/[()\[\]{}<>]/g, c => ({ '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<' }[c]));
  const ltr = x => /^[0-9A-Za-z٠-٩]+([.,:/][0-9A-Za-z٠-٩]+)*$/.test(x.s);
  const logical = lines.map(l => join(l.items)).join('\n');
  const visual = lines.map(l => {
    const its2 = l.items.filter(it => it.s.trim()).sort((a, b) => (b.x + b.w) - (a.x + a.w)); const out = [];
    for (let i = 0; i < its2.length;) { if (ltr(its2[i])) { let j = i; while (j < its2.length && ltr(its2[j])) j++; out.push(...its2.slice(i, j).reverse()); i = j; } else out.push(its2[i++]); }
    return mirror(join(out));
  }).join('\n');
  const score = t => (t.normalize('NFKC').match(/(^|\s)(ال|وال|بال|فال|لل)[\u0621-\u064A]{2,}/g) || []).length;
  return (score(visual) > score(logical) ? visual : logical).normalize('NFKC');
}
async function pdfText(file, st) {
  await loadScript(PDFJS + 'pdf.min.js'); pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise; let txt = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    st(`جارٍ قراءة الصفحة ${p} من ${pdf.numPages}…`);
    const c = await (await pdf.getPage(p)).getTextContent();
    txt += pdfLines(c.items) + '\n';
  }
  return { txt, pdf };
}
async function pdfOCR(pdf, st) {
  await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'); let txt = '';
  const n = Math.min(pdf.numPages, 15);
  for (let p = 1; p <= n; p++) {
    const page = await pdf.getPage(p); const vp = page.getViewport({ scale: 2 }); const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
    await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
    const r = await Tesseract.recognize(cv, 'ara+eng', { logger: m => { if (m.status === 'recognizing text') st(`قراءة الصفحة الممسوحة ${p} من ${n}: ${Math.round(m.progress * 100)}%`); } });
    txt += r.data.text + '\n';
  }
  return txt;
}
const fileB64 = f => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
function aiToQ(x) {
  const q = newQ(QT[x.type] && x.type !== 'passage' ? x.type : (x.type === 'passage' ? 'passage' : 'short')); q.text = x.text || ''; q.tag = x.tag || '';
  if (x.choices?.length) q.choices = x.choices.map(c => ({ id: rid(4), t: String(c.t ?? c), ok: !!c.ok }));
  if (q.type === 'tf') q.correct = String(x.answer) === 'false' ? 'false' : 'true';
  if (x.accepted) q.accepted = x.accepted.length ? x.accepted : ['']; if (x.pairs) q.pairs = x.pairs.map(p => ({ id: rid(4), l: p.l, r: p.r }));
  if (x.items) q.items = x.items.map(t => ({ id: rid(4), t })); if (x.model) q.model = x.model; if (x.keywords) q.keywords = x.keywords;
  if (x.points) q.points = +x.points || q.points; if (q.type === 'essay' && !x.points) q.points = 5; if (q.type === 'numeric') { q.value = +x.value || 0; q.tol = +x.tol || 0; }
  return q;
}

A.pdfOpen = () => openModal(`<div class="row sp"><h2>${ico('dl', 'style="width:26px;vertical-align:middle"')} استيراد الأسئلة من PDF</h2><button class="btn ghost sm" data-a="close">إغلاق</button></div>
  <p class="muted small" style="margin:8px 0 14px">ارفع ورقة الاختبار بصيغة PDF وسأستخرج منها الأسئلة بأنواعها والخيارات، وإن كانت الإجابات معلّمة في الملف (نجمة أو علامة صح أو سطر «الإجابة:») أحددها تلقائيًا. بعد الاستيراد راجع الأسئلة وحدد ما لم يُحدد.</p>
  <label class="btn" style="cursor:pointer">${ico('dl')} اختر ملف PDF<input type="file" hidden accept="application/pdf,.pdf" data-c="pdfImp"></label>
  <p class="small" id="pdf-st" style="margin-top:12px;color:var(--brand);font-weight:600"></p>
  <div class="alert br small" style="margin-top:10px">${S.ai?.key || isAdmin() ? 'إذا أضفت مفتاح Gemini في الإعدادات يقرأ الذكاء الاصطناعي الملف كاملًا بدقة أعلى، ويفهم الجداول والصور والملفات الممسوحة ضوئيًا.' : 'الاستخراج يعمل مباشرة من نص الملف.'}</div>`);
A.pdfImp = async el => {
  const f = el.files[0]; if (!f) return; const st = t => { const e = $('#pdf-st'); if (e) e.textContent = t; };
  if (f.size > 18e6) return st('الملف كبير جدًا، الحد 18 ميجابايت');
  try {
    S.ai ||= isAdmin() ? await DB.get('settings', 'ai').catch(() => null) : null; let qs = [];
    if (S.ai?.key) {
      st('يقرأ الذكاء الاصطناعي ورقة الاختبار…');
      const data = await fileB64(f);
      const out = await gemini(`هذا ملف PDF لورقة اختبار باللغة العربية. استخرج كل الأسئلة بالترتيب كما هي دون تغيير صياغتها، وحدد نوع كل سؤال من: mcq (اختيار واحد), multi (أكثر من إجابة), tf (صح وخطأ), short (إجابة قصيرة), essay (مقالي), fill (أكمل الفراغ: ضع الإجابة بين [[ ]] أو [[؟]] إن لم تعرفها), match (توصيل), order (ترتيب), numeric, passage (نص قرائي يسبق أسئلة).
إن كانت الإجابة الصحيحة معلّمة في الملف فاستخدمها، وإلا فاقترح الإجابة الصحيحة من معرفتك. ضع "tag" باسم الدرس أو المهارة إن ظهر.
أعد JSON فقط: {"questions":[{"type":"mcq","text":"...","tag":"","points":1,"choices":[{"t":"...","ok":true}]},{"type":"tf","text":"...","answer":"true"},{"type":"short","text":"...","accepted":["..."]},{"type":"fill","text":"... [[الإجابة]] ..."},{"type":"match","text":"...","pairs":[{"l":"...","r":"..."}]},{"type":"order","text":"...","items":["..."]},{"type":"essay","text":"...","model":"...","keywords":["..."]},{"type":"passage","text":"..."}]}`, data, 'application/pdf');
      qs = (out.questions || []).map(aiToQ).filter(q => q.text.trim());
    } else {
      const { txt, pdf } = await pdfText(f, st);
      let text = txt;
      if (text.replace(/\s/g, '').length < 40) { st('الملف ممسوح ضوئيًا، أقرؤه بقارئ الصور (قد يستغرق دقيقة)…'); text = await pdfOCR(pdf, st); }
      qs = parseExam(text);
    }
    if (!qs.length) return st('لم أتعرف على أسئلة في الملف. جرّب «لصق سريع» بعد نسخ النص، أو أضف مفتاح Gemini');
    S.ed.qs.push(...qs); closeModal(); edR();
    const need = qs.filter(q => (q.type === 'mcq' && !q.choices.some(c => c.ok)) || (q.type === 'multi' && !q.choices.some(c => c.ok)) || (q.type === 'short' && !q.accepted.some(a => a.trim())) || q._unsure || (q.type === 'fill' && q.text.includes('[[؟]]'))).length;
    toast(`أُضيف ${qs.length} سؤال${need ? `، منها ${need} يحتاج تحديد الإجابة الصحيحة` : ''}`);
  } catch (e) { console.error(e); st('تعذرت قراءة الملف: ' + (e.message || e)); }
};

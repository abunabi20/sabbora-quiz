/* ---------------- student home ---------------- */
const mySub = qid => S.subs.find(s => s.quizId === qid && s.uid === S.user.uid);
const myEval = s => { const q = quizById(s.quizId); if (!q) return null; const k = S.keys[q.id]; if (!k) return { hidden: true, q }; return { q, ev: evalSub(q, k, s, S.reviews[s.id]) }; };
VIEWS.sdash = () => {
  const open = S.quizzes.filter(q => q.status === 'published' && !mySub(q.id) && (!q.dueAt || q.dueAt > now()));
  const done = S.subs.map(myEval).filter(x => x && !x.hidden); const av = avg(done.map(d => d.ev.pct)); const best = Math.max(0, ...done.map(d => d.ev.pct));
  const certs = S.msgs.filter(m => m.kind === 'cert' && m.to === S.user.uid); const ann = S.msgs.filter(m => m.kind === 'msg' && m.from !== S.user.uid).slice(0, 3);
  return `<div class="col" style="gap:20px"><section class="hero"><div class="col" style="gap:10px"><span style="opacity:.85">${esc(clsName(S.me.classId))}</span><h1>أهلًا ${esc(S.me.name.split(' ')[0])}</h1><p>${open.length ? `لديك ${open.length} اختبار بانتظارك` : 'لا توجد اختبارات جديدة الآن، أحسنت!'}</p>${open[0] ? `<button class="btn gold" style="align-self:flex-start" data-a="startQuiz" data-id="${open[0].id}">${ico('quiz')} ابدأ «${esc(open[0].title)}»</button>` : ''}</div>${ART}</section>
  <div class="grid g4">${stat(done.length, 'اختبار أنجزته')}${stat(r1(av) + '%', 'متوسط درجاتي', 'var(--ok)')}${stat(best + '%', 'أعلى درجة', 'var(--gold)')}${stat(certs.length, 'شهادة تقدير', 'var(--accent)')}</div>
  <section><h2 style="margin-bottom:12px">الاختبارات المتاحة</h2>${open.length ? `<div class="grid g2">${open.map(q => `<article class="qcard" style="--c:${colorOf(q.id)}"><h3>${esc(q.title)}</h3>${q.desc ? `<p class="muted small">${esc(q.desc)}</p>` : ''}<div class="row small muted"><span>${ico('quiz', 'style="width:16px;vertical-align:middle"')} ${q.questions.filter(x => x.type !== 'passage').length} سؤال</span><span>${q.totalPoints} درجة</span>${q.duration ? `<span>${ico('clock', 'style="width:16px;vertical-align:middle"')} ${q.duration} دقيقة</span>` : ''}${q.dueAt ? `<span class="chip warn">ينتهي ${fmtDT(q.dueAt)}</span>` : ''}</div><button class="btn" style="align-self:flex-start" data-a="startQuiz" data-id="${q.id}">ابدأ الاختبار</button></article>`).join('')}</div>` : `<div class="card flat center muted">لا توجد اختبارات متاحة حاليًا</div>`}</section>
  ${ann.length ? `<section><h2 style="margin-bottom:12px">آخر الرسائل</h2><div class="list">${ann.map(msgRow).join('')}</div></section>` : ''}</div>`;
};
VIEWS.myres = () => {
  const rows = S.subs.map(s => ({ s, ...myEval(s) })).filter(x => x.q).sort((a, b) => b.s.submittedAt - a.s.submittedAt);
  const shown = rows.filter(r => !r.hidden); const tags = {};
  shown.forEach(r => r.ev.items.forEach(i => { if (i.status === 'review') return; const t = i.q.tag || QT[i.q.type].n; (tags[t] ||= [0, 0]); tags[t][0] += i.score; tags[t][1] += i.max; }));
  const tg = Object.entries(tags).map(([l, [a, b]]) => ({ l, v: pct(a, b) })).sort((a, b) => b.v - a.v);
  return `<div class="top"><div class="t"><h1>نتائجي</h1><p class="muted">${rows.length} اختبار</p></div></div><div class="col" style="gap:18px">
  ${shown.length > 1 ? `<div class="card"><h3>منحنى تقدمي</h3>${lineSVG([...shown].reverse().map(r => ({ l: r.q.title, v: r.ev.pct })))}</div>` : ''}
  ${tg.length ? `<div class="grid g2"><div class="card"><h3>نقاط قوتي</h3>${hbars(tg.slice(0, 5))}</div><div class="card"><h3>ما أحتاج التركيز عليه</h3>${hbars([...tg].reverse().slice(0, 5))}</div></div>` : ''}
  ${rows.length ? `<div class="list">${rows.map(r => `<button class="item" style="cursor:pointer;text-align:start" data-a="go" data-v="result" data-id="${r.q.id}" data-from="myres"><span class="qnum" style="background:${colorOf(r.q.id)}">${ico('quiz', 'style="width:20px"')}</span><div class="grow"><b>${esc(r.q.title)}</b><div class="small muted">${fmtDT(r.s.submittedAt)}</div></div>${r.hidden ? '<span class="chip">النتيجة لاحقًا</span>' : `<span class="chip ${grade5(r.ev.pct)[1]}">${r.ev.total}/${r.ev.max} · ${r.ev.pct}%</span>${r.ev.pending ? '<span class="chip warn">بانتظار تقييم المعلم</span>' : ''}`}</button>`).join('')}</div>` : empty('لم تختبر بعد. اختباراتك تظهر في الرئيسية')}</div>`;
};

/* ---------------- question renderer ---------------- */
function renderQ(q, a, i, preview, seed = 1) {
  const dis = preview ? 'disabled' : ''; const L = 'أبجدهوزحطي';
  const head = q.type === 'passage' ? `<div class="passage">${esc(q.text)}</div>` : `<div class="row sp" style="margin-bottom:6px"><span class="chip br">${QT[q.type].n}${q.tag ? ' · ' + esc(q.tag) : ''}</span><span class="chip">${q.points} ${q.points == 1 ? 'درجة' : 'درجات'}</span></div>${q.type !== 'fill' ? `<div class="qbody">${esc(q.text)}</div>` : ''}${q.img ? `<img class="qimg" src="${esc(q.img)}" alt="صورة السؤال">` : ''}`;
  let body = '';
  const shuf = arr => S.take?.quiz?.shuffle ? shuffle(arr, seed + hashStr(q.id)) : arr;
  switch (q.type) {
    case 'mcq': body = `<div class="opts">${shuf(q.choices).map((c, j) => `<button class="opt ${a === c.id ? 'sel' : ''}" data-a="tAns" data-q="${q.id}" data-v="${c.id}" ${dis}><span class="k">${L[j] || j + 1}</span><span>${esc(c.t)}</span></button>`).join('')}</div>`; break;
    case 'multi': body = `<p class="small muted" style="margin-top:8px">اختر كل الإجابات الصحيحة</p><div class="opts">${shuf(q.choices).map((c, j) => `<button class="opt ${(a || []).includes(c.id) ? 'sel' : ''}" data-a="tMulti" data-q="${q.id}" data-v="${c.id}" ${dis}><span class="k">${(a || []).includes(c.id) ? ico('check', 'style="width:18px"') : L[j]}</span><span>${esc(c.t)}</span></button>`).join('')}</div>`; break;
    case 'tf': body = `<div class="tf">${[['true', 'صح'], ['false', 'خطأ']].map(([v, l]) => `<button class="opt ${a === v ? 'sel' : ''}" data-a="tAns" data-q="${q.id}" data-v="${v}" ${dis}>${ico(v === 'true' ? 'check' : 'x', 'style="width:26px"')} ${l}</button>`).join('')}</div>`; break;
    case 'short': body = `<input class="in" style="margin-top:14px;font-size:18px" data-t="${q.id}" value="${esc(a || '')}" placeholder="اكتب إجابتك" ${dis}>`; break;
    case 'essay': body = `<textarea class="in" style="margin-top:14px;min-height:180px;font-size:17px" data-t="${q.id}" placeholder="اكتب إجابتك هنا${q.minWords ? ` (${q.minWords} كلمة على الأقل)` : ''}" ${dis}>${esc(a || '')}</textarea><p class="small muted" id="wc-${q.id}">${normAr(a || '').split(' ').filter(Boolean).length} كلمة</p>`; break;
    case 'numeric': body = `<div class="row" style="margin-top:14px"><input class="in" style="max-width:220px;font-size:20px" inputmode="decimal" data-t="${q.id}" value="${esc(a ?? '')}" placeholder="الرقم" ${dis}>${q.unit ? `<b>${esc(q.unit)}</b>` : ''}</div>`; break;
    case 'fill': body = `<div class="qbody">${q.parts.map((p, j) => esc(p) + (j < q.parts.length - 1 ? `<input class="blank" data-t="${q.id}" data-k="${j}" value="${esc(a?.[j] || '')}" aria-label="الفراغ ${j + 1}" ${dis}>` : '')).join('')}</div>`; break;
    case 'match': body = `<div style="margin-top:14px">${q.left.map(l => `<div class="mrow"><b>${esc(l.t)}</b>${ico('back', 'style="width:22px;transform:scaleX(-1);color:var(--brand)"')}<select class="in" data-c="tMatch" data-q="${q.id}" data-l="${l.id}" ${dis}><option value="">اختر</option>${q.right.map(r => `<option value="${r.id}" ${a?.[l.id] === r.id ? 'selected' : ''}>${esc(r.t)}</option>`).join('')}</select></div>`).join('')}</div>`; break;
    case 'order': { const ord = a?.length ? a : q.items.map(x => x.id); body = `<p class="small muted" style="margin:8px 0">استخدم الأسهم لترتيب العناصر</p>${ord.map((id, j) => { const it = q.items.find(x => x.id === id); return it ? `<div class="ord"><span class="n">${j + 1}</span><span class="grow">${esc(it.t)}</span><button class="btn icon sm ghost" data-a="tOrd" data-q="${q.id}" data-j="${j}" data-d="-1" ${dis || (j === 0 ? 'disabled' : '')} aria-label="أعلى">${ico('up')}</button><button class="btn icon sm ghost" data-a="tOrd" data-q="${q.id}" data-j="${j}" data-d="1" ${dis || (j === ord.length - 1 ? 'disabled' : '')} aria-label="أسفل">${ico('down')}</button></div>` : ''; }).join('')}`; break; }
  }
  return head + body;
}

/* ---------------- taking a quiz ---------------- */
const takeKey = qid => 'qz_take_' + qid + '_' + S.user.uid;
A.startQuiz = async el => {
  const q = quizById(el.dataset.id); if (mySub(q.id)) return go('result', { id: q.id });
  const saved = store.get(takeKey(q.id), null);
  if (!saved) { if (!await ask(`بدء «${q.title}»؟`, `${q.questions.filter(x => x.type !== 'passage').length} سؤال${q.duration ? ` ومدة ${q.duration} دقيقة تبدأ الآن ولا تتوقف` : ''}. لديك محاولة واحدة.`, 'ابدأ')) return; }
  const t = saved && saved.order ? saved : { qid: q.id, ans: {}, start: now(), seed: Math.floor(Math.random() * 1e6), idx: 0 };
  const order = q.questions.map((_, i) => i).filter(i => q.questions[i].type !== 'passage'); t.order = q.shuffle ? groupShuffle(q.questions, t.seed) : order;
  S.take = { ...t, quiz: q }; store.set(takeKey(q.id), t); S.view = 'take'; render(); startTimer();
};
const passageIdx = (qs, i) => { for (let j = i - 1; j >= 0; j--) if (qs[j].type === 'passage') return j; return -1; };
function groupShuffle(qs, seed) { const blocks = new Map(); qs.forEach((q, i) => { if (q.type === 'passage') return; const p = passageIdx(qs, i); const k = p < 0 ? 'q' + i : 'p' + p; if (!blocks.has(k)) blocks.set(k, []); blocks.get(k).push(i); }); return shuffle([...blocks.values()], seed).flatMap(b => shuffle(b, seed + b[0])); }
const saveTake = () => { const t = S.take; store.set(takeKey(t.qid), { qid: t.qid, ans: t.ans, start: t.start, seed: t.seed, idx: t.idx, order: t.order }); };
let tmr; function startTimer() { clearInterval(tmr); const t = S.take; if (!t?.quiz.duration && !t?.quiz.dueAt) return; tmr = setInterval(() => { if (!S.take) return clearInterval(tmr); const left = timeLeft(); const el = $('#tmr'); if (el) { el.querySelector('b').textContent = fmtLeft(left); el.classList.toggle('low', left < 60000); } if (left <= 0) { clearInterval(tmr); toast('انتهى الوقت، يتم تسليم إجاباتك'); submitTake(true); } }, 1000); }
const timeLeft = () => { const t = S.take; const ends = [t.quiz.duration ? t.start + t.quiz.duration * 6e4 : Infinity, t.quiz.dueAt || Infinity]; return Math.min(...ends) - now(); };
const fmtLeft = ms => { if (!isFinite(ms)) return ''; ms = Math.max(0, ms); const s = Math.floor(ms / 1000); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0'); };
const answered = (q, a) => q.type === 'passage' || (a != null && a !== '' && !(Array.isArray(a) && !a.length) && !(typeof a === 'object' && !Array.isArray(a) && !Object.values(a).some(v => String(v ?? '').trim())));
function viewTake() {
  const t = S.take, q = t.quiz, ord = t.order, cur = q.questions[ord[t.idx]], left = timeLeft();
  const pi = passageIdx(q.questions, ord[t.idx]); const prev = pi >= 0 ? `<details open style="margin-bottom:16px"><summary class="small muted" style="cursor:pointer">النص القرائي</summary><div class="passage" style="margin-top:8px">${esc(q.questions[pi].text)}</div></details>` : '';
  const qnums = ord.map(i => q.questions[i]);
  return `<div class="row sp" style="margin-bottom:6px"><div><b class="disp" style="font-size:20px">${esc(q.title)}</b><div class="small muted">${esc(S.me.name)}</div></div><div class="row">${isFinite(left) ? `<span class="timer ${left < 60000 ? 'low' : ''}" id="tmr">${ico('clock', 'style="width:18px"')}<b>${fmtLeft(left)}</b></span>` : ''}<button class="btn ghost sm" data-a="takeExit">حفظ والخروج</button></div></div>
  <div class="prog" aria-label="الأسئلة">${qnums.map((x, n) => `<button class="${n === t.idx ? 'cur' : answered(x, t.ans[x.id]) ? 'done' : ''}" data-a="tJump" data-n="${n}" aria-label="سؤال ${n + 1}">${n + 1}</button>`).join('')}</div>
  <div class="bar" style="margin-bottom:18px"><i style="width:${pct(qnums.filter(x => answered(x, t.ans[x.id])).length, qnums.length)}%"></i></div>
  <section class="card" style="padding:clamp(18px,3vw,30px)">${prev}${renderQ(cur, t.ans[cur.id], t.idx, false, t.seed)}</section>
  <div class="row sp" style="margin-top:16px"><button class="btn ghost" data-a="tNav" data-d="-1" ${t.idx === 0 ? 'disabled' : ''}>${ico('back')} السابق</button>${t.idx < ord.length - 1 ? `<button class="btn" data-a="tNav" data-d="1">التالي ${ico('back', 'style="transform:scaleX(-1)"')}</button>` : `<button class="btn acc" data-a="tSubmit">${ico('send')} تسليم الإجابات</button>`}</div>
  ${t.idx < ord.length - 1 ? `<div class="center" style="margin-top:22px"><button class="btn ghost sm" data-a="tSubmit">تسليم الآن</button></div>` : ''}`;
}
const tRender = () => { render(); };
A.tAns = el => { S.take.ans[el.dataset.q] = el.dataset.v; saveTake(); tRender(); };
A.tMulti = el => { const a = new Set(S.take.ans[el.dataset.q] || []); a.has(el.dataset.v) ? a.delete(el.dataset.v) : a.add(el.dataset.v); S.take.ans[el.dataset.q] = [...a]; saveTake(); tRender(); };
A.tMatch = el => { const a = S.take.ans[el.dataset.q] ||= {}; a[el.dataset.l] = el.value; saveTake(); };
A.tOrd = el => { const q = S.take.quiz.questions.find(x => x.id === el.dataset.q); const a = S.take.ans[q.id]?.length ? [...S.take.ans[q.id]] : q.items.map(x => x.id); const j = +el.dataset.j, k = j + +el.dataset.d; [a[j], a[k]] = [a[k], a[j]]; S.take.ans[q.id] = a; saveTake(); tRender(); };
A.tNav = el => { S.take.idx = Math.max(0, Math.min(S.take.order.length - 1, S.take.idx + +el.dataset.d)); saveTake(); tRender(); scrollTo(0, 0); };
A.tJump = el => { S.take.idx = +el.dataset.n; saveTake(); tRender(); };
A.takeExit = () => { saveTake(); clearInterval(tmr); S.take = null; go('dash'); toast('حُفظت إجاباتك، والوقت مستمر إن كان الاختبار محددًا بمدة'); };
A.tSubmit = async () => { const t = S.take; const qs = t.quiz.questions.filter(x => x.type !== 'passage'); const miss = qs.filter(x => !answered(x, t.ans[x.id])).length; if (!await ask('تسليم الإجابات؟', miss ? `يوجد ${miss} سؤال بلا إجابة. لا يمكنك التعديل بعد التسليم.` : 'لا يمكنك التعديل بعد التسليم.', 'سلّم الآن')) return; submitTake(); };
document.addEventListener('input', e => { const el = e.target.closest('[data-t]'); if (!el || !S.take) return; const id = el.dataset.t; if (el.dataset.k != null) { const a = S.take.ans[id] ||= []; a[+el.dataset.k] = el.value; } else S.take.ans[id] = el.value; const wc = $('#wc-' + id); if (wc) wc.textContent = normAr(el.value).split(' ').filter(Boolean).length + ' كلمة'; saveTake(); });
async function submitTake(auto) {
  const t = S.take; if (!t || t.sending) return; t.sending = true; clearInterval(tmr); const q = t.quiz;
  const sub = { quizId: q.id, uid: S.user.uid, name: S.me.name, classId: S.me.classId, ownerId: q.createdBy, answers: t.ans, startedAt: t.start, submittedAt: now(), timeSpent: Math.round((now() - t.start) / 1000), auto: !!auto };
  try {
    await DB.set('submissions', subId(q.id, S.user.uid), sub); store.del(takeKey(q.id));
    S.subs.push({ id: subId(q.id, S.user.uid), ...sub }); S.take = null;
    if (q.resultsMode !== 'manual') S.keys[q.id] = await DB.get('quizKeys', q.id).catch(() => null);
    S.p = { id: q.id, fresh: 1 }; S.view = 'result'; render();
  } catch (e) { t.sending = false; console.error(e); toast(e.code === 'permission-denied' ? 'انتهى وقت هذا الاختبار أو أُغلق' : 'تعذر التسليم، تحقق من الاتصال وأعد المحاولة'); render(); }
}

/* ---------------- result ---------------- */
VIEWS.result = () => {
  const q = quizById(S.p.id), s = mySub(S.p.id); if (!q || !s) return VIEWS.myres();
  const k = S.keys[q.id]; const head = `<div class="top"><button class="btn ghost" data-a="nav" data-v="${S.p.from || 'dash'}">${ico('back')} رجوع</button></div>`;
  if (!k) return head + `<div class="card center" style="padding:40px 20px">${ico('check', 'style="width:70px;height:70px;color:var(--ok)"')}<h1 style="margin-top:10px">تم تسليم إجاباتك</h1><p class="muted" style="margin-top:8px">ستظهر نتيجة «${esc(q.title)}» بعد أن يعلنها المعلم</p></div>`;
  const ev = evalSub(q, k, s, S.reviews[s.id]); const [gl, gc] = grade5(ev.pct);
  if (S.p.fresh && ev.pct >= 80) S.after = [...(S.after || []), () => setTimeout(confetti, 500)]; S.p.fresh = 0;
  const msg = ev.pct >= 90 ? 'أداء مذهل! أنت نجم هذا الاختبار' : ev.pct >= 75 ? 'عمل رائع، استمر على هذا المستوى' : ev.pct >= 50 ? 'جيد، ومع قليل من المراجعة ستتفوق' : 'لا بأس، راجع الأخطاء وستتحسن بإذن الله';
  return head + `<div class="col" style="gap:18px"><section class="card center" style="padding:clamp(20px,4vw,40px)"><p class="muted">${esc(q.title)}</p><div class="ring" style="margin:14px auto">${ringSVG(ev.pct)}<div class="v"><b style="color:${pctColor(ev.pct)}">${ev.pct}%</b><span class="muted">${ev.total} من ${ev.max}</span></div></div><span class="chip ${gc}" style="font-size:16px;padding:6px 16px">${gl}</span><h2 style="margin-top:14px">${msg}</h2>${ev.pending ? `<div class="alert" style="margin-top:16px;justify-content:center">${ico('clock', 'style="width:20px"')} ${ev.pending} إجابة بانتظار تقييم المعلم، وقد ترتفع درجتك بعدها</div>` : ''}</section>
  <section><h2 style="margin-bottom:12px">مراجعة إجاباتك</h2><div class="col" style="gap:10px">${ev.items.map((i, n) => { const cl = i.status === 'correct' ? 'ok' : i.status === 'wrong' ? 'bad' : 'warn'; return `<div class="rv ${cl}"><div class="row sp"><b>${n + 1}. ${esc(i.q.text)}</b><span class="chip ${cl}">${i.status === 'review' ? 'قيد التقييم' : `${i.score} / ${i.max}`}</span></div><span class="small">إجابتك: ${esc(ansText(i.q, i.ans))}</span>${q.showAnswers !== false && i.status !== 'correct' && i.status !== 'review' ? `<span class="small" style="color:var(--ok)">الإجابة الصحيحة: ${esc(keyText(i.q, k.answers?.[i.qid]))}</span>` : ''}${i.note ? `<span class="small muted">ملاحظة المعلم: ${esc(i.note)}</span>` : ''}</div>`; }).join('')}</div></section></div>`;
};

VIEWS.mycerts = () => { const c = S.msgs.filter(m => m.kind === 'cert' && m.to === S.user.uid); return `<div class="top"><div class="t"><h1>شهاداتي</h1><p class="muted">${c.length} شهادة تقدير</p></div></div>${c.length ? `<div class="grid g2">${c.map(m => `<button style="border:0;background:none;padding:0;cursor:pointer" data-a="openCert" data-id="${m.id}">${certHTML(m.cert)}</button>`).join('')}</div>` : empty('ستظهر هنا شهادات التقدير التي يرسلها لك معلمك', 'cert')}`; };

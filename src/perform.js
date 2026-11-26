/* ================= مهام الإلقاء (Performance / speaking tasks) ================= */
const CRIT = { pronunciation: 'النطق ومخارج الحروف', fluency: 'الطلاقة والانسيابية', expression: 'التعبير والتنغيم', language: 'سلامة اللغة', confidence: 'الثقة ووضوح الصوت', accuracy: 'الالتزام بالنص', content: 'ترابط الأفكار' };
const POLICY = { weak: ['عند الأداء الضعيف', 50], avg: ['عند الأداء المتوسط أو أقل', 75], target: ['حتى يصل للدرجة المطلوبة', null], off: ['لا يُطلب (التحسين اختياري)', -1] };
const RETRY_FLOOR = 60; // below average: always offered a retry
const perfId = (tid, uid) => tid + '_' + uid;
const policyLimit = t => t.policy === 'target' ? (+t.target || 80) : POLICY[t.policy || 'avg'][1];
const mustImprove = (t, sc) => sc < policyLimit(t);
const fmtSec = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

/* ---------- audio helpers ---------- */
const blobB64 = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
async function decodeBlob(blob) { const ac = new (window.AudioContext || window.webkitAudioContext)(); const buf = await ac.decodeAudioData(await blob.arrayBuffer()); ac.close?.(); return buf; }
async function toMono16k(buf) { const len = Math.ceil(buf.duration * 16000); const oc = new OfflineAudioContext(1, len, 16000); const s = oc.createBufferSource(); s.buffer = buf; s.connect(oc.destination); s.start(); return (await oc.startRendering()).getChannelData(0); }
function wavB64(pcm) {
  const b = new ArrayBuffer(44 + pcm.length * 2), v = new DataView(b), w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
  let s = ''; const u = new Uint8Array(b); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return 'data:audio/wav;base64,' + btoa(s);
}
/* acoustic analysis: speech ratio, pauses, sustained "aaa" hesitations, loudness */
function analyzePCM(pcm) {
  const fr = 480, n = Math.floor(pcm.length / fr), rms = [], zcr = [];
  for (let i = 0; i < n; i++) { let e = 0, z = 0; for (let j = 0; j < fr; j++) { const x = pcm[i * fr + j]; e += x * x; if (j && (x >= 0) !== (pcm[i * fr + j - 1] >= 0)) z++; } rms.push(Math.sqrt(e / fr)); zcr.push(z / fr); }
  const sorted = [...rms].sort((a, b) => a - b), floor = sorted[Math.floor(n * .1)] || 0, peak = sorted[Math.floor(n * .95)] || .01;
  const th = Math.max(floor * 2.5, peak * .12, .008), voiced = rms.map(r => r > th);
  let first = voiced.indexOf(true), last = voiced.lastIndexOf(true); if (first < 0) return { dur: pcm.length / 16000, speech: 0, ratio: 0, pauses: 0, longPauses: 0, hesitations: 0, loud: 0, steady: 0 };
  let pauses = 0, longP = 0, run = 0, hes = 0, seg = [];
  for (let i = first; i <= last; i++) {
    if (!voiced[i]) { run++; if (seg.length) { if (seg.length >= 13 && seg.length <= 90) { const zs = seg.map(k => zcr[k]), es = seg.map(k => rms[k]); const zm = avg(zs), zsd = stdev(zs), em = avg(es), esd = stdev(es); if (zsd < .012 && esd / em < .28 && zm < .09) hes++; } seg = []; } }
    else { if (run >= 23) { pauses++; if (run >= 67) longP++; } run = 0; seg.push(i); }
  }
  const sp = voiced.filter(Boolean).length; const vr = rms.filter((r, i) => voiced[i]);
  return { dur: pcm.length / 16000, speech: sp * .03, ratio: sp / Math.max(1, last - first + 1), pauses, longPauses: longP, hesitations: hes, loud: avg(vr), steady: 1 - Math.min(1, stdev(vr) / (avg(vr) || 1)) };
}
const FILLER_RE = /^(ا+ه+|آ+ه*|ا+م+|ام+|م{2,}|ها+|ايه+|اه+|يعني)$/;
function localEval(m, task, transcript) {
  const words = transcript ? normAr(transcript).split(' ').filter(Boolean) : [];
  const fillWords = words.filter(w => FILLER_RE.test(w)).length;
  const fillers = Math.max(m.hesitations, fillWords); const mins = Math.max(.25, m.speech / 60);
  const wpm = words.length ? Math.round((words.length - fillWords) / mins) : 0;
  const c = (x) => Math.round(Math.max(20, Math.min(100, x)));
  const fluency = c(100 - fillers * 7 - m.longPauses * 8 - m.pauses * 1.5 + (m.ratio - .6) * 40);
  const confidence = c(55 + m.steady * 35 + Math.min(15, m.loud * 300) - m.longPauses * 4);
  const expression = c(60 + m.steady * 15 + (m.ratio > .55 ? 15 : 0) - fillers * 3);
  const durOk = task.duration ? Math.min(1, m.dur / (task.duration * .5)) : Math.min(1, m.speech / 20);
  const pronunciation = c(70 + (wpm > 60 && wpm < 170 ? 10 : 0) - fillers * 2);
  const language = c(72 - fillWords * 2);
  const k = task.mode === 'passage' ? 'accuracy' : 'content';
  const criteria = { pronunciation, fluency, expression, language, confidence, [k]: c(65 * durOk + 20) };
  const score = Math.round(avg(Object.values(criteria)) * (.6 + .4 * durOk));
  if (m.speech < 1) return { score: 10, criteria: Object.fromEntries(Object.keys(criteria).map(x => [x, 10])), fillers: 0, wpm: 0, words: 0, transcript: '', studentNote: 'لم أسمع صوتك بوضوح. تأكد من السماح للميكروفون، وقرّب الجهاز منك، ثم أعد المحاولة.', teacherNote: 'لم يُلتقط كلام واضح في التسجيل.', source: 'local', metrics: m };
  const tips = [];
  if (fillers >= 3) tips.push(`لاحظت ${fillers} مرات تردد مثل «آآآ» أو «إممم». خذ نفسًا قصيرًا بدلها.`);
  if (m.longPauses) tips.push(`توقفت ${m.longPauses} مرة لأكثر من ثانيتين، حاول الاستمرار بانسيابية.`);
  if (durOk < 1) tips.push('التسجيل قصير، أكمل الإلقاء حتى النهاية.');
  if (m.steady < .45) tips.push('حافظ على مستوى صوت ثابت وواضح.');
  if (!tips.length) tips.push('إلقاء واثق ومنساب، أحسنت!');
  return { score, criteria, fillers, wpm, words: words.length, transcript: transcript || '', studentNote: tips.join(' '), teacherNote: `تقييم آلي تقريبي من تحليل الصوت: مدة الكلام ${Math.round(m.speech)} ث، توقفات ${m.pauses} (طويلة ${m.longPauses})، تردد مقدّر ${fillers}${wpm ? `، سرعة ${wpm} كلمة/دقيقة` : ''}.`, source: 'local', metrics: m };
}
async function aiEval(wav, task, key, model) {
  const ctx = task.mode === 'passage' ? `النص المطلوب إلقاؤه:\n${task.passage}` : `الطالب يلقي قطعة أو تعبيرًا من اختياره${task.topicHint ? ` (${task.topicHint})` : ''}.`;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model || 'gemini-2.5-flash')}:generateContent?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: `أنت معلمة لغة عربية خبيرة في تقييم الإلقاء والقراءة الجهرية، عادلة ومشجعة. استمع لتسجيل الطالب وقيّمه بدقة.
المهمة: ${task.title}. ${task.instructions || ''}
${ctx}
عدّ بدقة الأصوات الحشوية والتردد مثل (آآآ، أأأ، إممم، ممم، هااا) وتكرار الكلمات. ${task.mode === 'passage' ? 'قارن بالنص وحدد الكلمات المحذوفة أو الخاطئة.' : 'قيّم ترابط الأفكار ووضوحها.'}
أعد JSON فقط بهذا الشكل:
{"transcript":"نص ما قاله","fillers":0,"fillerExamples":["آآآ"],"repetitions":0,"wordsPerMinute":0,"criteria":{"pronunciation":0,"fluency":0,"expression":0,"language":0,"confidence":0,"${task.mode === 'passage' ? 'accuracy' : 'content'}":0},"score":0,"verdict":"ممتاز|جيد جدًا|جيد|متوسط|ضعيف","studentNote":"ملاحظة للطالب بالعربية: نقطة قوة ثم ما يحسنه بالتحديد في جملتين أو ثلاث، بأسلوب مشجع","teacherNote":"ملاحظة تشخيصية مختصرة للمعلمة"}
كل الدرجات من 100.` }, { inline_data: { mime_type: 'audio/wav', data: wav.split(',')[1] } }] }], generationConfig: { responseMimeType: 'application/json', temperature: .2 } }) });
  const j = await r.json(); if (!r.ok) throw new Error(j.error?.message || 'Gemini');
  const o = JSON.parse(j.candidates[0].content.parts[0].text);
  return { score: Math.round(+o.score || 0), criteria: o.criteria || {}, fillers: +o.fillers || 0, fillerExamples: o.fillerExamples || [], repetitions: +o.repetitions || 0, wpm: +o.wordsPerMinute || 0, transcript: o.transcript || '', verdict: o.verdict || '', studentNote: o.studentNote || '', teacherNote: o.teacherNote || '', source: 'ai' };
}
async function evaluateRecording(blob, task, transcript) {
  const buf = await decodeBlob(blob); const pcm = await toMono16k(buf); const m = analyzePCM(pcm);
  let k = S.aiStu; if (k === undefined) { k = S.aiStu = isAdmin() ? (await DB.get('settings', 'ai').catch(() => null)) : (await DB.get('settings', 'aiStudent').catch(() => null)); }
  if (k?.key && m.speech > 1) { try { const r = await aiEval(wavB64(pcm), task, k.key, k.model); r.metrics = m; if (!r.fillers && m.hesitations > 2) r.fillers = m.hesitations; return r; } catch (e) { console.warn('AI eval failed', e); } }
  return localEval(m, task, transcript);
}
/* store audio in Firestore chunks (works on the free plan) */
async function saveAudio(recId, blob, meta) {
  const b64 = await blobB64(blob); const parts = []; for (let i = 0; i < b64.length; i += 600000) parts.push(b64.slice(i, i + 600000));
  const ops = parts.map((d, i) => ({ op: 'set', c: 'audio', id: recId + '_' + i, d: { uid: meta.uid, kind: meta.kind, i, data: d } }));
  ops.push({ op: 'set', c: 'recordings', id: recId, d: { ...meta, chunks: parts.length, mime: blob.type || 'audio/webm', size: blob.size, createdAt: now() } });
  for (const o of ops) await DB.set(o.c, o.id, o.d);
}
async function loadAudio(recId) {
  const rec = await DB.get('recordings', recId); if (!rec) return null;
  const parts = await Promise.all(Array.from({ length: rec.chunks }, (_, i) => DB.get('audio', recId + '_' + i)));
  return { rec, url: parts.map(p => p?.data || '').join('') };
}

/* ================= teacher ================= */
VIEWS.perform = () => {
  const list = [...(S.tasks || [])].sort((a, b) => b.createdAt - a.createdAt);
  return `<div class="top"><div class="t"><h1>مهام الإلقاء</h1><p class="muted">يسجل الطالب صوته، ويُقيَّم أداؤه فورًا، ويُطلب منه التحسين حسب ما تحدده</p></div>${isAdmin() ? `<button class="btn" data-a="taskNew">${ico('plus')} مهمة إلقاء جديدة</button>` : ''}</div>
  ${list.length ? `<div class="grid g2">${list.map(t => { const ps = (S.perfs || []).filter(p => p.taskId === t.id), aud = taskAudience(t); const done = ps.filter(p => p.finalScore != null || p.firstScore != null); return `<article class="qcard" style="--c:${colorOf(t.id)}"><div class="row sp"><h3>${ico('mic', 'style="width:20px;vertical-align:middle"')} ${esc(t.title)}</h3>${t.status === 'closed' ? '<span class="chip">مغلقة</span>' : '<span class="chip ok">متاحة</span>'}</div>
  <div class="row small muted"><span>${t.mode === 'passage' ? 'نص محدد' : 'قطعة أو تعبير يختاره الطالب'}</span><span>${t.duration ? 'المدة ' + fmtSec(t.duration) : 'وقت مفتوح'}</span><span>الهدف ${t.target}%</span></div>
  <div class="row" style="gap:6px">${(t.classIds || []).map(c => `<span class="chip br">${esc(clsName(c))}</span>`).join('')}${(t.studentIds || []).length ? `<span class="chip acc">${t.studentIds.length} طالب محدد</span>` : ''}</div>
  <div><div class="row sp small"><span>أنجز ${done.length} من ${aud.length}</span><b>${r1(avg(done.map(p => p.finalScore ?? p.firstScore)))}%</b></div><div class="bar" style="margin-top:6px"><i style="width:${pct(done.length, aud.length)}%"></i></div></div>
  <div class="row" style="margin-top:auto"><button class="btn sm" data-a="go" data-v="taskres" data-id="${t.id}" data-from="perform">${ico('chart')} النتائج</button>${isAdmin() ? `<button class="btn sm soft" data-a="taskNew" data-id="${t.id}">${ico('edit')} تعديل</button><button class="btn sm ghost" data-a="taskToggle" data-id="${t.id}">${t.status === 'closed' ? 'إعادة فتح' : 'إغلاق'}</button><button class="btn icon sm danger" data-a="taskDel" data-id="${t.id}">${ico('trash')}</button>` : ''}</div></article>`; }).join('')}</div>` : empty('لا توجد مهام إلقاء بعد. أنشئ أول مهمة واختر الفصول أو الطلاب', 'mic')}`;
};
const taskAudience = t => students().filter(u => (t.classIds || []).includes(u.classId) || (t.studentIds || []).includes(u.id));
A.taskNew = el => {
  const t = (S.tasks || []).find(x => x.id === el.dataset?.id) || { title: '', instructions: '', mode: 'passage', passage: '', topicHint: '', classIds: [], studentIds: [], duration: 120, target: 80, policy: 'avg', maxAttempts: 5 };
  S.tk = clone(t);
  openModal(`<h2>${t.id ? 'تعديل مهمة الإلقاء' : 'مهمة إلقاء جديدة'}</h2><form class="col" data-f="taskSave" style="margin-top:14px">
  <label class="f">العنوان<input class="in" id="tk-title" required value="${esc(t.title)}" placeholder="مثال: إلقاء قصيدة الوطن"></label>
  <label class="f">التعليمات للطالب<textarea class="in" id="tk-ins" style="min-height:70px" placeholder="اقرأ النص بصوت واضح مع مراعاة علامات الترقيم">${esc(t.instructions)}</textarea></label>
  <div class="f"><span class="small">ماذا يلقي الطالب؟</span><div class="pick"><label><input type="radio" name="tk-mode" value="passage" ${t.mode === 'passage' ? 'checked' : ''} data-c="tkMode"><span>نص أحدده</span></label><label><input type="radio" name="tk-mode" value="free" ${t.mode === 'free' ? 'checked' : ''} data-c="tkMode"><span>قطعة أو تعبير يختاره الطالب</span></label></div></div>
  <label class="f" id="tk-pw" ${t.mode === 'free' ? 'style="display:none"' : ''}>النص المطلوب إلقاؤه<textarea class="in" id="tk-pass" style="min-height:110px">${esc(t.passage)}</textarea></label>
  <label class="f" id="tk-hw" ${t.mode === 'passage' ? 'style="display:none"' : ''}>توجيه للاختيار (اختياري)<input class="in" id="tk-hint" value="${esc(t.topicHint || '')}" placeholder="مثال: تعبير عن يوم التأسيس في دقيقتين"></label>
  <div class="f"><span class="small">لمن؟ الفصول</span><div class="pick">${myClasses().map(c => `<label><input type="checkbox" class="tk-c" value="${c.id}" ${t.classIds.includes(c.id) ? 'checked' : ''}><span>${esc(c.name)}</span></label>`).join('')}</div></div>
  <details ${t.studentIds.length ? 'open' : ''}><summary class="small" style="cursor:pointer;font-weight:600">أو طلاب محددون (${t.studentIds.length})</summary><input class="in" style="margin:8px 0;min-height:40px" placeholder="بحث" data-c="tkFind" id="tk-find"><div class="pick" id="tk-st" style="max-height:180px;overflow:auto">${students().map(u => `<label data-n="${esc(normAr(u.name))}"><input type="checkbox" class="tk-s" value="${u.id}" ${t.studentIds.includes(u.id) ? 'checked' : ''}><span>${esc(u.name)}</span></label>`).join('')}</div></details>
  <div class="grid g2"><label class="f">مدة الإلقاء<select class="in" id="tk-dur">${[[0, 'وقت مفتوح (حتى 10 دقائق)'], [30, '30 ثانية'], [60, 'دقيقة'], [90, 'دقيقة ونصف'], [120, 'دقيقتان'], [180, '3 دقائق'], [300, '5 دقائق']].map(([v, l]) => `<option value="${v}" ${+t.duration === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  <label class="f">الدرجة المطلوبة %<input class="in" id="tk-target" type="number" min="40" max="100" value="${t.target}"></label>
  <label class="f">متى يُطلب من الطالب التحسين؟<select class="in" id="tk-pol">${Object.entries(POLICY).map(([k, [l, v]]) => `<option value="${k}" ${t.policy === k ? 'selected' : ''}>${l}${v > 0 ? ` (أقل من ${v}%)` : ''}</option>`).join('')}</select></label>
  <label class="f">أقصى عدد للمحاولات<select class="in" id="tk-max">${[[3, '3'], [5, '5'], [10, '10'], [0, 'بلا حد']].map(([v, l]) => `<option value="${v}" ${+t.maxAttempts === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
  <p class="small muted">يُحفظ التسجيل الأول دائمًا ولا يمكن حذفه. ويُعطى الطالب فرصة الإعادة تلقائيًا إذا كان أداؤه أقل من المتوسط (${RETRY_FLOOR}%).</p>
  <div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" data-a="close">إلغاء</button><button class="btn" type="submit">${ico('send')} حفظ ونشر</button></div></form>`, true);
};
A.tkMode = () => { const f = $('input[name=tk-mode]:checked').value === 'free'; $('#tk-pw').style.display = f ? 'none' : ''; $('#tk-hw').style.display = f ? '' : 'none'; };
A.tkFind = el => { const q = normAr(el.value); $$('#tk-st label').forEach(l => l.style.display = !q || l.dataset.n.includes(q) ? '' : 'none'); };
FORMS.taskSave = () => {
  const t = S.tk; const classIds = $$('.tk-c:checked').map(x => x.value), studentIds = $$('.tk-s:checked').map(x => x.value);
  if (!classIds.length && !studentIds.length) return toast('اختر فصلًا أو طالبًا');
  const mode = $('input[name=tk-mode]:checked').value;
  if (mode === 'passage' && $('#tk-pass').value.trim().length < 10) return toast('اكتب النص المطلوب إلقاؤه');
  const d = { title: $('#tk-title').value.trim(), instructions: $('#tk-ins').value.trim(), mode, passage: $('#tk-pass').value.trim(), topicHint: $('#tk-hint').value.trim(), classIds, studentIds, audience: [...classIds.map(c => 'c:' + c), ...studentIds.map(u => 'u:' + u)], duration: +$('#tk-dur').value, target: Math.min(100, Math.max(40, +$('#tk-target').value || 80)), policy: $('#tk-pol').value, maxAttempts: +$('#tk-max').value, status: t.status || 'published', updatedAt: now() };
  safe(async () => {
    const isNew = !t.id; const id = t.id || rid(16); await DB.set('tasks', id, { ...d, createdBy: S.user.uid, createdAt: t.createdAt || now() });
    if (isNew) { for (const c of classIds) await DB.add('messages', { from: S.user.uid, fromName: S.me.name, to: 'class:' + c, toName: clsName(c), kind: 'msg', subject: 'مهمة إلقاء جديدة', body: `لديك مهمة إلقاء: «${d.title}». ادخل المنصة وسجّل إلقاءك.`, createdAt: now(), readBy: [] }); for (const u of studentIds) await DB.add('messages', { from: S.user.uid, fromName: S.me.name, to: u, toName: userById(u)?.name || '', kind: 'msg', subject: 'مهمة إلقاء جديدة', body: `لديك مهمة إلقاء: «${d.title}». ادخل المنصة وسجّل إلقاءك.`, createdAt: now(), readBy: [] }); }
    closeModal(); await reload(); go('perform');
  }, 'تم حفظ المهمة ونشرها');
};
A.taskToggle = el => { const t = S.tasks.find(x => x.id === el.dataset.id); safe(async () => { await DB.update('tasks', t.id, { status: t.status === 'closed' ? 'published' : 'closed' }); await reload(); }, 'تم'); };
A.taskDel = async el => { const t = S.tasks.find(x => x.id === el.dataset.id); if (!await ask('حذف مهمة الإلقاء؟', `«${esc(t.title)}» مع نتائجها. التسجيلات المحفوظة تبقى ولا تظهر.`, 'حذف', true)) return; safe(async () => { for (const p of S.perfs.filter(p => p.taskId === t.id)) await DB.del('perf', p.id); await DB.del('tasks', t.id); await reload(); }, 'تم الحذف'); };

const perfStatus = (t, p) => {
  if (!p || p.firstScore == null) return ['لم يبدأ', ''];
  const sc = p.finalScore ?? p.firstScore;
  if (p.teacherRequested && p.needsRetry) return ['طُلب منه التحسين', 'warn'];
  if (sc >= (t.target || 80)) return [p.attempts > 1 ? `حقق الهدف بعد ${p.attempts} محاولات` : 'حقق الهدف من أول مرة', 'ok'];
  if (mustImprove(t, sc)) return ['يحتاج تحسينًا', 'bad'];
  return [p.attempts > 1 ? `أنجز بعد ${p.attempts} محاولات` : 'أنجز من أول مرة', 'br'];
};
VIEWS.taskres = () => {
  const t = (S.tasks || []).find(x => x.id === S.p.id); if (!t) return VIEWS.perform();
  const rows = taskAudience(t).map(u => ({ u, p: (S.perfs || []).find(p => p.id === perfId(t.id, u.id)) })).sort((a, b) => ((b.p?.finalScore ?? b.p?.firstScore ?? -1) - (a.p?.finalScore ?? a.p?.firstScore ?? -1)));
  const done = rows.filter(r => r.p?.firstScore != null); const first = done.map(r => r.p.firstScore), fin = done.map(r => r.p.finalScore ?? r.p.firstScore);
  return `<div class="top noprint"><button class="btn ghost" data-a="nav" data-v="perform">${ico('back')} رجوع</button>${prBtn}</div>${printHead('مهمة إلقاء: ' + t.title)}
  <div class="col" style="gap:18px"><div><h1>${esc(t.title)}</h1><p class="muted">${t.duration ? 'المدة ' + fmtSec(t.duration) : 'وقت مفتوح'} · الهدف ${t.target}% · التحسين يُطلب ${POLICY[t.policy][0]}</p></div>
  <div class="grid g4">${stat(`${done.length}/${rows.length}`, 'أنجزوا')}${stat(r1(avg(first)) + '%', 'متوسط أول محاولة', 'var(--accent)')}${stat(r1(avg(fin)) + '%', 'متوسط بعد التحسين', 'var(--ok)')}${stat(done.filter(r => (r.p.finalScore ?? r.p.firstScore) >= t.target).length, 'حققوا الهدف', 'var(--gold)')}</div>
  <div class="card" style="padding:0;overflow:hidden"><table class="stack"><thead><tr><th>الطالب</th><th class="num">الأولى</th><th class="num">الأخيرة</th><th class="num">المحاولات</th><th class="num">التردد</th><th>الحالة</th><th></th></tr></thead><tbody>${rows.map(({ u, p }) => { const [l, c] = perfStatus(t, p); return `<tr><td><b>${esc(u.name)}</b><div class="small muted">${esc(clsName(u.classId))}</div></td><td class="num">${p?.firstScore ?? '-'}${p?.firstScore != null ? '%' : ''}</td><td class="num">${p?.finalScore != null ? p.finalScore + '%' : '-'}</td><td class="num">${p?.attempts || 0}</td><td class="num">${p?.firstFillers ?? '-'}${p?.finalFillers != null ? ' ← ' + p.finalFillers : ''}</td><td><span class="chip ${c}">${l}</span></td><td class="noprint">${p ? `<button class="btn sm soft" data-a="perfDetail" data-id="${p.id}">استماع ومقارنة</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div></div>`;
};
const critBars = (a, b) => Object.keys(CRIT).filter(k => a?.[k] != null || b?.[k] != null).map(k => `<div class="hrow" style="grid-template-columns:minmax(90px,150px) minmax(0,1fr) 84px"><span>${CRIT[k]}</span><div class="col" style="gap:3px"><div class="bar"><i style="width:${a?.[k] || 0}%;background:${b ? 'var(--accent)' : pctColor(a?.[k] || 0)}"></i></div>${b ? `<div class="bar"><i style="width:${b[k] || 0}%;background:${pctColor(b[k] || 0)}"></i></div>` : ''}</div><b class="small" style="text-align:end">${a?.[k] ?? '-'}${b ? ' ← ' + (b[k] ?? '-') : ''}</b></div>`).join('');
A.perfDetail = async el => {
  const p = S.perfs.find(x => x.id === el.dataset.id); const t = S.tasks.find(x => x.id === p.taskId);
  openModal(`<p class="muted">جارٍ تحميل التسجيلات…</p>`, true);
  const [f, l] = await Promise.all([loadAudio(p.id + '_first'), p.finalScore != null ? loadAudio(p.id + '_final') : null]);
  const a = f?.rec?.result, b = l?.rec?.result;
  const box = (title, r, x) => `<div class="card flat col" style="gap:8px"><div class="row sp"><b>${title}</b>${x ? `<span class="chip ${grade5(x.score)[1]}">${x.score}%</span>` : ''}</div>${r ? `<audio controls preload="none" src="${esc(r.url)}" style="width:100%"></audio>` : '<p class="small muted">لا يوجد</p>'}${x ? `<div class="small">التردد (آآآ/إممم): <b>${x.fillers}</b>${x.wpm ? ` · السرعة: <b>${x.wpm}</b> كلمة/دقيقة` : ''}${x.source === 'local' ? ' · <span class="muted">تقييم تقريبي</span>' : ''}</div><p class="small" style="background:var(--surface2);padding:10px;border-radius:12px">${esc(x.teacherNote || x.studentNote)}</p>${x.transcript ? `<details><summary class="small" style="cursor:pointer">النص المسموع</summary><p class="small" style="white-space:pre-wrap">${esc(x.transcript)}</p></details>` : ''}` : ''}</div>`;
  openModal(`<div class="row sp"><div><h2>${esc(p.name)}</h2><p class="small muted">${esc(t.title)} · ${p.attempts} محاولة · ${perfStatus(t, p)[0]}</p></div><button class="btn ghost sm" data-a="close">إغلاق</button></div>
  <div class="grid g2" style="margin-top:14px">${box('التسجيل الأول', f, a)}${box(`التسجيل المعتمد (المحاولة ${p.finalAttempt || '-'})`, l, b)}</div>
  ${a ? `<div class="card flat" style="margin-top:12px"><h3>المقارنة حسب المعايير</h3><p class="small muted" style="margin-bottom:6px">البنفسجي: الأول، والملون: الأخير</p>${critBars(a.criteria, b?.criteria)}</div>` : ''}
  ${(p.log || []).length ? `<p class="small muted" style="margin-top:10px">سجل المحاولات: ${p.log.map(x => `${x.n}) ${x.score}%`).join(' · ')}</p>` : ''}
  <form class="row" data-f="perfTeacher" data-id="${p.id}" style="margin-top:14px;align-items:flex-end"><label class="f" style="width:120px">درجتك %<input class="in" id="pt-score" type="number" min="0" max="100" value="${p.teacherScore ?? ''}"></label><label class="f grow">ملاحظتك للطالب<input class="in" id="pt-note" value="${esc(p.teacherNote || '')}"></label><button class="btn" type="submit">حفظ</button></form>
  <div class="row" style="margin-top:12px;justify-content:flex-end">${isAdmin() ? `<button class="btn ghost" data-a="perfAI" data-id="${p.id}">${ico('wand')} أعد التقييم بالذكاء الاصطناعي</button>` : ''}<button class="btn acc" data-a="perfAskRetry" data-id="${p.id}">${ico('send')} اطلب منه التحسين</button></div>`, true);
};
FORMS.perfTeacher = f => { const sc = $('#pt-score').value; safe(async () => { await DB.update('perf', f.dataset.id, { teacherScore: sc === '' ? null : +sc, teacherNote: $('#pt-note').value.trim() }); await reload(); }, 'تم الحفظ'); };
A.perfAskRetry = el => { const p = S.perfs.find(x => x.id === el.dataset.id); const t = S.tasks.find(x => x.id === p.taskId); safe(async () => { await DB.update('perf', p.id, { needsRetry: true, teacherRequested: true }); await DB.add('messages', { from: S.user.uid, fromName: S.me.name, to: p.uid, toName: p.name, kind: 'msg', subject: 'طلب تحسين الإلقاء', body: `أرجو أن تعيد إلقاء «${t.title}» لتحسين أدائك.${p.teacherNote ? ' ' + p.teacherNote : ''}`, createdAt: now(), readBy: [] }); closeModal(); await reload(); }, 'أُرسل طلب التحسين'); };
A.perfAI = async el => {
  const p = S.perfs.find(x => x.id === el.dataset.id); const t = S.tasks.find(x => x.id === p.taskId); el.disabled = true; el.textContent = 'جارٍ التقييم…';
  try {
    S.aiStu = undefined; for (const kind of ['first', 'final']) { if (kind === 'final' && p.finalScore == null) continue; const l = await loadAudio(p.id + '_' + kind); if (!l) continue; const blob = await (await fetch(l.url)).blob(); const r = await evaluateRecording(blob, t, l.rec.result?.transcript); await DB.update('recordings', p.id + '_' + kind, { result: r }); await DB.update('perf', p.id, kind === 'first' ? { firstScore: r.score, firstFillers: r.fillers } : { finalScore: r.score, finalFillers: r.fillers }); }
    await reload(); A.perfDetail({ dataset: { id: p.id } });
  } catch (e) { toast('تعذر التقييم: ' + e.message); el.disabled = false; }
};

/* ================= student ================= */
const myPerf = tid => (S.perfs || []).find(p => p.id === perfId(tid, S.user.uid));
VIEWS.myperf = () => {
  const list = (S.tasks || []).filter(t => t.status !== 'closed' || myPerf(t.id));
  return `<div class="top"><div class="t"><h1>مهام الإلقاء</h1><p class="muted">سجّل إلقاءك بصوتك واحصل على تقييم وملاحظات فورية</p></div></div>
  ${list.length ? `<div class="grid g2">${list.map(t => { const p = myPerf(t.id); const sc = p ? (p.finalScore ?? p.firstScore) : null; return `<article class="qcard" style="--c:${colorOf(t.id)}"><h3>${ico('mic', 'style="width:20px;vertical-align:middle"')} ${esc(t.title)}</h3><p class="small muted">${t.duration ? 'المدة ' + fmtSec(t.duration) : 'وقت مفتوح'} · الهدف ${t.target}%</p>${sc != null ? `<div class="row"><span class="chip ${grade5(sc)[1]}">${sc}%</span>${p.needsRetry ? '<span class="chip warn">مطلوب تحسين</span>' : ''}</div>` : ''}<button class="btn" style="align-self:flex-start;margin-top:auto" data-a="go" data-v="perf" data-id="${t.id}" data-from="myperf">${p ? 'عرض وتحسين' : 'ابدأ'}</button></article>`; }).join('')}</div>` : empty('لا توجد مهام إلقاء حاليًا', 'mic')}`;
};
VIEWS.perf = () => {
  const t = (S.tasks || []).find(x => x.id === S.p.id); if (!t) return VIEWS.myperf();
  const p = myPerf(t.id), R = S.rec?.tid === t.id ? S.rec : (S.rec = { tid: t.id, phase: 'idle' });
  const attempts = p?.attempts || 0, max = +t.maxAttempts || 0, left = max ? max - attempts : 99;
  const best = p ? (p.finalScore ?? p.firstScore) : null;
  const canRetry = p && left > 0 && t.status !== 'closed' && (best < RETRY_FLOOR || p.needsRetry || best < t.target);
  let body = '';
  if (R.phase === 'rec') body = `<div class="center col" style="align-items:center;gap:14px;padding:20px 0"><div class="recdot"></div><b class="disp" style="font-size:44px" id="rec-t">${t.duration ? fmtSec(t.duration) : '0:00'}</b><div class="meter" id="rec-m">${'<i></i>'.repeat(24)}</div><p class="small muted">${t.duration ? 'الوقت المتبقي' : 'مدة التسجيل'}</p><button class="btn danger" data-a="recStop">${ico('x')} إنهاء التسجيل</button></div>`;
  else if (R.phase === 'eval') body = `<div class="center" style="padding:30px 0"><div class="spinner"></div><p style="margin-top:14px">جارٍ الاستماع لإلقائك وتقييمه…</p></div>`;
  else if (R.phase === 'result') { const r = R.result, isFirst = R.n === 1; const pass = r.score >= t.target, need = mustImprove(t, r.score), below = r.score < RETRY_FLOOR;
    body = `<div class="col" style="gap:14px"><div class="row" style="justify-content:center;gap:24px"><div class="ring" style="width:170px">${ringSVG(r.score)}<div class="v"><b style="color:${pctColor(r.score)};font-size:40px">${r.score}%</b><span class="small muted">${r.verdict || grade5(r.score)[0]}</span></div></div><div class="col" style="gap:6px"><span class="chip ${r.fillers > 3 ? 'warn' : 'ok'}">التردد (آآآ / إممم): ${r.fillers}</span>${r.wpm ? `<span class="chip">السرعة: ${r.wpm} كلمة/دقيقة</span>` : ''}<span class="chip br">المحاولة ${R.n}</span></div></div>
    <audio controls src="${esc(R.url)}" style="width:100%"></audio>
    <div class="alert ${pass ? 'br' : need || below ? 'acc' : ''}" style="align-items:flex-start">${ico('spark', 'style="width:22px;flex:none"')}<span>${esc(r.studentNote)}</span></div>
    <div class="card flat">${critBars(r.criteria)}</div>
    ${isFirst ? `<p class="small muted center">حُفظ تسجيلك الأول وأُرسل لمعلمك.</p>` : ''}
    <div class="row" style="justify-content:center">${!isFirst ? `<button class="btn" data-a="recKeep">${ico('check')} اعتمد هذا التسجيل</button>` : ''}${left - (isFirst ? 0 : 0) > 0 && (below || need || !isFirst || !pass) ? `<button class="btn ${isFirst ? '' : 'ghost'}" data-a="recStart">${ico('mic')} ${isFirst ? 'أعد المحاولة لتحسين أدائك' : 'أعد التسجيل'}</button>` : ''}<button class="btn ghost" data-a="recDone">إنهاء</button></div>
    ${need && isFirst ? `<p class="center small" style="color:var(--accent);font-weight:600">${below ? 'أداؤك أقل من المتوسط، أعد المحاولة لتحسينه' : 'معلمك يطلب الوصول إلى ' + policyLimit(t) + '% على الأقل'}</p>` : ''}</div>`; }
  else body = `<div class="center col" style="align-items:center;gap:12px;padding:16px 0">${p ? `<p>أفضل درجة حتى الآن: <b>${best}%</b> بعد ${attempts} محاولة${p.teacherScore != null ? ` · درجة المعلم: <b>${p.teacherScore}%</b>` : ''}</p>${p.teacherNote ? `<div class="alert br">${esc(p.teacherNote)}</div>` : ''}${p.needsRetry && p.teacherRequested ? '<div class="alert acc">طلب معلمك تحسين إلقائك</div>' : ''}` : ''}
    ${(!p && t.status !== 'closed') || canRetry ? `<button class="micbtn" data-a="recStart" aria-label="ابدأ التسجيل">${ico('mic')}</button><p class="muted small">${p ? `المحاولات المتبقية: ${max ? left : 'بلا حد'}` : 'اضغط لبدء التسجيل'}${t.duration ? ` · لديك ${fmtSec(t.duration)}` : ''}</p>` : `<p class="muted">${p ? (best >= t.target ? 'أحسنت! حققت الدرجة المطلوبة' : 'انتهت المحاولات المتاحة') : 'المهمة مغلقة'}</p>`}</div>`;
  return `<div class="top"><button class="btn ghost" data-a="nav" data-v="myperf">${ico('back')} رجوع</button></div><div class="col" style="gap:16px;max-width:760px;margin-inline:auto">
  <div><h1>${esc(t.title)}</h1>${t.instructions ? `<p class="muted" style="margin-top:6px">${esc(t.instructions)}</p>` : ''}</div>
  ${t.mode === 'passage' ? `<div class="passage" style="font-size:19px">${esc(t.passage)}</div>` : `<div class="alert br">${ico('mic', 'style="width:20px"')} ألقِ قطعة أو تعبيرًا من اختيارك${t.topicHint ? `: ${esc(t.topicHint)}` : ''}</div>`}
  <section class="card">${body}</section></div>`;
};
let mediaRec, recStream, recTimer, recAnal, recSR, recTxt = '';
A.recStart = async () => {
  const t = S.tasks.find(x => x.id === S.p.id);
  try { recStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch { return toast('اسمح للمتصفح باستخدام الميكروفون ثم حاول مرة أخرى'); }
  const chunks = []; const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', ''].find(m => !m || MediaRecorder.isTypeSupported?.(m));
  mediaRec = new MediaRecorder(recStream, mime ? { mimeType: mime, audioBitsPerSecond: 24000 } : undefined);
  mediaRec.ondataavailable = e => e.data.size && chunks.push(e.data);
  mediaRec.onstop = () => recFinish(new Blob(chunks, { type: mediaRec.mimeType || 'audio/webm' }));
  recTxt = ''; const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) { try { recSR = new SR(); recSR.lang = 'ar-SA'; recSR.continuous = true; recSR.interimResults = false; recSR.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) recTxt += e.results[i][0].transcript + ' '; }; recSR.onend = () => { if (mediaRec?.state === 'recording') try { recSR.start(); } catch { } }; recSR.start(); } catch { recSR = null; } }
  const ac = new (window.AudioContext || window.webkitAudioContext)(); const an = ac.createAnalyser(); an.fftSize = 64; ac.createMediaStreamSource(recStream).connect(an); recAnal = { ac, an };
  S.rec = { tid: t.id, phase: 'rec', start: now() }; render(); mediaRec.start(1000);
  const cap = t.duration || 600;
  recTimer = setInterval(() => { const el = $('#rec-t'); const s = (now() - S.rec.start) / 1000; if (el) el.textContent = fmtSec(t.duration ? t.duration - s : s); const d = new Uint8Array(an.frequencyBinCount); an.getByteFrequencyData(d); $$('#rec-m i').forEach((b, i) => b.style.height = (6 + (d[i] || 0) / 255 * 46) + 'px'); if (s >= cap) A.recStop(); }, 100);
};
A.recStop = () => { clearInterval(recTimer); try { recSR?.stop(); } catch { } recSR = null; if (mediaRec?.state === 'recording') mediaRec.stop(); recStream?.getTracks().forEach(x => x.stop()); recAnal?.ac.close?.(); };
async function recFinish(blob) {
  const t = S.tasks.find(x => x.id === S.p.id); const p = myPerf(t.id); const n = (p?.attempts || 0) + 1;
  S.rec = { tid: t.id, phase: 'eval' }; render();
  if (blob.size < 2000) { S.rec = { tid: t.id, phase: 'idle' }; render(); return toast('التسجيل قصير جدًا، حاول مرة أخرى'); }
  let r; try { r = await evaluateRecording(blob, t, recTxt.trim()); } catch (e) { console.error(e); r = localEval({ dur: 0, speech: 0, ratio: 0, pauses: 0, longPauses: 0, hesitations: 0, loud: 0, steady: 0 }, t, recTxt); }
  const pid = perfId(t.id, S.user.uid); const logE = { n, score: r.score, fillers: r.fillers, at: now() };
  try {
    if (n === 1) {
      await saveAudio(pid + '_first', blob, { uid: S.user.uid, taskId: t.id, kind: 'first', attempt: 1, result: r });
      const d = { taskId: t.id, uid: S.user.uid, name: S.me.name, classId: S.me.classId, attempts: 1, firstScore: r.score, firstFillers: r.fillers, log: [logE], needsRetry: r.score < RETRY_FLOOR || mustImprove(t, r.score), teacherRequested: false, updatedAt: now() };
      await DB.set('perf', pid, d); S.perfs = [...(S.perfs || []).filter(x => x.id !== pid), { id: pid, ...d }];
    } else {
      const d = { attempts: n, log: [...(p.log || []), logE], updatedAt: now() }; await DB.update('perf', pid, d); Object.assign(p, d);
    }
  } catch (e) { console.error(e); toast('تعذر حفظ التسجيل: ' + (e.code === 'permission-denied' ? 'لا تملك صلاحية' : e.message)); }
  S.rec = { tid: t.id, phase: 'result', result: r, blob, url: URL.createObjectURL(blob), n }; render();
  if (r.score >= t.target) setTimeout(confetti, 300);
}
A.recKeep = async el => {
  const t = S.tasks.find(x => x.id === S.p.id), R = S.rec, pid = perfId(t.id, S.user.uid), p = myPerf(t.id); el.disabled = true;
  await safe(async () => { await saveAudio(pid + '_final', R.blob, { uid: S.user.uid, taskId: t.id, kind: 'final', attempt: R.n, result: R.result }); const d = { finalScore: R.result.score, finalFillers: R.result.fillers, finalAttempt: R.n, needsRetry: mustImprove(t, R.result.score), teacherRequested: false, updatedAt: now() }; await DB.update('perf', pid, d); Object.assign(p, d); S.rec = { tid: t.id, phase: 'idle' }; render(); }, 'اعتُمد تسجيلك وأُرسل لمعلمك');
};
A.recDone = () => { S.rec = { tid: S.p.id, phase: 'idle' }; render(); };

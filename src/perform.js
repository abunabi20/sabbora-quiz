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
/* acoustic analysis: thinking pauses, sustained "أأأ / إممم" fillers, part-word stutters, loudness */
function analyzePCM(pcm) {
  const fr = 480, n = Math.floor(pcm.length / fr), rms = [], zcr = [], f0 = [];
  for (let i = 0; i < n; i++) {
    let e = 0, z = 0; const o = i * fr;
    for (let j = 0; j < fr; j++) { const x = pcm[o + j]; e += x * x; if (j && (x >= 0) !== (pcm[o + j - 1] >= 0)) z++; }
    rms.push(Math.sqrt(e / fr)); zcr.push(z / fr);
    let best = 0, lag = 0; if (e > 1e-6) for (let L = 40; L <= 213; L++) { let c = 0; for (let j = 0; j + L < fr; j++) c += pcm[o + j] * pcm[o + j + L]; c /= e; if (c > best) { best = c; lag = L; } }
    f0.push(best > .45 ? 16000 / lag : 0);
  }
  const sorted = [...rms].sort((a, b) => a - b), floor = sorted[Math.floor(n * .1)] || 0, peak = sorted[Math.floor(n * .95)] || .01;
  const th = Math.max(floor * 2.5, peak * .12, .008), voiced = rms.map(r => r > th);
  const first = voiced.indexOf(true), last = voiced.lastIndexOf(true);
  const zero = { dur: pcm.length / 16000, speech: 0, ratio: 0, pauses: 0, longPauses: 0, hesitations: 0, stutters: 0, loud: 0, steady: 0, pauseList: [] };
  if (first < 0) return zero;
  // voiced segments
  const segs = []; let s = -1;
  for (let i = first; i <= last + 1; i++) { if (i <= last && voiced[i]) { if (s < 0) s = i; } else if (s >= 0) { segs.push([s, i - 1]); s = -1; } }
  // merge tiny gaps (< 90ms) inside words
  const m = []; for (const g of segs) { const p = m[m.length - 1]; if (p && g[0] - p[1] <= 3) p[1] = g[1]; else m.push([...g]); }
  let pauses = 0, longP = 0; const pauseList = [];
  for (let k = 1; k < m.length; k++) { const gap = m[k][0] - m[k - 1][1] - 1; if (gap >= 20) { pauses++; pauseList.push(+(gap * .03).toFixed(1)); if (gap >= 67) longP++; } }
  // sustained filler: a long run of steady pitch and low zero-crossing (open vowel), e.g. "أأأأ" or "إممم"
  let hes = 0;
  for (const [a, b] of m) {
    let run = 0;
    for (let i = a + 1; i <= b + 1; i++) {
      const ok = i <= b && f0[i] > 70 && f0[i - 1] > 70 && Math.abs(f0[i] - f0[i - 1]) / f0[i] < .06 && zcr[i] < .1 && Math.abs(rms[i] - rms[i - 1]) / (rms[i] + 1e-6) < .35;
      if (ok) run++; else { const len = run + 1, isolated = (b - a + 1) <= len + 8; if (len >= 20 || (len >= 12 && isolated)) hes++; run = 0; }
    }
  }
  // part-word stutter: two or more very short bursts (< 210ms) with short gaps before a longer segment, e.g. "تـ تـ تسكن"
  let stut = 0;
  for (let k = 0; k < m.length - 2; k++) {
    const len = x => x[1] - x[0] + 1, gap = (x, y) => y[0] - x[1] - 1;
    if (len(m[k]) <= 7 && len(m[k + 1]) <= 7 && gap(m[k], m[k + 1]) <= 12 && gap(m[k + 1], m[k + 2]) <= 12) { stut++; k += 2; }
  }
  const sp = voiced.filter(Boolean).length, vr = rms.filter((r, i) => voiced[i]);
  return { dur: pcm.length / 16000, speech: sp * .03, ratio: sp / Math.max(1, last - first + 1), pauses, longPauses: longP, hesitations: hes, stutters: stut, loud: avg(vr), steady: 1 - Math.min(1, stdev(vr) / (avg(vr) || 1)), pauseList };
}
const FILLER_RE = /^(ا+ه*|آ+ه*|ا+م+|ام+|م{2,}|ها+|ايه+|اه+|يعني|امم+|ءء+)$/;
const SELF_FIX = /^(عفوا|عفوًا|اقصد|اسف|اسفه|لا|اعيد|عذرا)$/;
/* word alignment between the required passage and what was heard */
function alignText(passage, heard) {
  const P = normAr(passage).split(' ').filter(Boolean), H = normAr(heard).split(' ').filter(Boolean);
  const eq = (a, b) => a === b || stem(a) === stem(b) || (Math.max(a.length, b.length) > 3 && levR(a, b) >= .75);
  const n = P.length, k = H.length, D = Array.from({ length: n + 1 }, () => new Array(k + 1).fill(0));
  for (let i = 0; i <= n; i++) D[i][0] = i; for (let j = 0; j <= k; j++) D[0][j] = j;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= k; j++) D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (eq(P[i - 1], H[j - 1]) ? 0 : 1));
  const ops = []; let i = n, j = k;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + (eq(P[i - 1], H[j - 1]) ? 0 : 1)) { ops.push(eq(P[i - 1], H[j - 1]) ? ['ok', P[i - 1], H[j - 1]] : ['sub', P[i - 1], H[j - 1]]); i--; j--; }
    else if (j > 0 && D[i][j] === D[i][j - 1] + 1) { ops.push(['ins', null, H[j - 1]]); j--; }
    else { ops.push(['del', P[i - 1], null]); i--; }
  }
  ops.reverse();
  // trailing deletions = stopped early
  let tail = 0; for (let x = ops.length - 1; x >= 0 && ops[x][0] === 'del'; x--) tail++;
  const body = ops.slice(0, ops.length - tail);
  const out = { matched: 0, inserted: [], omitted: [], repeated: [], substituted: [], selfFix: 0, fillers: 0, readWords: n - tail, total: n };
  body.forEach((o, x) => {
    if (o[0] === 'ok') out.matched++;
    else if (o[0] === 'sub') out.substituted.push([o[1], o[2]]);
    else if (o[0] === 'del') out.omitted.push(o[1]);
    else { const w = o[2], prev = body[x - 1]?.[2], next = body[x + 1]?.[2] || body[x + 1]?.[1];
      if (FILLER_RE.test(w)) out.fillers++; else if (SELF_FIX.test(w)) out.selfFix++; else if (prev && eq(w, prev) || next && eq(w, next)) out.repeated.push(w); else out.inserted.push(w); }
  });
  out.coverage = n ? (n - tail) / n : 1; out.accuracy = out.readWords ? out.matched / out.readWords : 0;
  return out;
}
function localEval(m, task, transcript) {
  const words = transcript ? normAr(transcript).split(' ').filter(Boolean) : [];
  const al = task.mode === 'passage' && task.passage && words.length ? alignText(task.passage, transcript) : null;
  const fillWords = al ? al.fillers : words.filter(w => FILLER_RE.test(w)).length;
  const fillers = m.hesitations + fillWords, stutters = m.stutters || 0;
  const reps = al ? al.repeated.length : words.filter((w, i) => i && w === words[i - 1]).length;
  const mins = Math.max(.2, m.speech / 60), wpm = words.length ? Math.round(words.length / Math.max(.25, m.dur / 60)) : 0;
  const punct = task.mode === 'passage' ? (String(task.passage).match(/[،,.؛;:!؟?]/g) || []).length * (al ? al.coverage : 1) : m.dur / 8;
  const thinkPauses = Math.max(0, m.pauses - Math.round(punct));
  const c = x => Math.round(Math.max(10, Math.min(100, x)));
  const fluency = c(100 - fillers * 7 - stutters * 7 - reps * 6 - thinkPauses * 5 - m.longPauses * 8 - (al ? al.selfFix * 4 : 0) - (wpm && wpm < 70 ? (70 - wpm) * .6 : 0));
  const confidence = c(50 + m.steady * 35 + Math.min(15, m.loud * 300) - m.longPauses * 5 - fillers * 2);
  const expression = c(68 + m.steady * 12 - fillers * 3 - thinkPauses * 2 - (wpm && wpm < 60 ? 10 : 0));
  const pronunciation = c(al ? 100 - al.substituted.length * 6 - stutters * 3 : 72 - stutters * 4);
  const language = c(al ? 95 - al.inserted.length * 5 - al.substituted.length * 3 : 72 - fillWords * 2);
  let criteria, cover = 1;
  if (al) { cover = al.coverage; criteria = { pronunciation, fluency, expression, language, confidence, accuracy: c(al.accuracy * 100 * (.5 + .5 * cover) - al.omitted.length * 4) }; }
  else { cover = task.duration ? Math.min(1, m.dur / (task.duration * .5)) : Math.min(1, m.speech / 20); criteria = { pronunciation, fluency, expression, language, confidence, content: c(65 * cover + 20) }; }
  const score = Math.round(avg(Object.values(criteria)) * (.55 + .45 * Math.min(1, cover)));
  const q = s => `«${s}»`, tips = [];
  if (fillers) tips.push(`سُمع منك ${fillers} مرة صوت تفكير مثل «أأأ» أو «إممم»، خذ نفسًا هادئًا بدلًا منه.`);
  if (stutters) tips.push(`تكررت بداية بعض الكلمات (تأتأة) ${stutters} مرة، اقرأ أبطأ قليلًا.`);
  if (thinkPauses) tips.push(`توقفت للتفكير ${thinkPauses} مرة في غير مواضع الوقف.`);
  if (al?.repeated.length) tips.push(`كررت: ${al.repeated.slice(0, 4).map(q).join('، ')}.`);
  if (al?.inserted.length) tips.push(`أضفت كلمات ليست في النص: ${al.inserted.slice(0, 4).map(q).join('، ')}.`);
  if (al?.selfFix) tips.push(`صحّحت نفسك أثناء القراءة ${al.selfFix} مرة.`);
  if (al?.substituted.length) tips.push(`قرأت ${al.substituted.slice(0, 3).map(([a, b]) => `${q(b)} بدل ${q(a)}`).join('، ')}.`);
  if (al?.omitted.length) tips.push(`تجاوزت: ${al.omitted.slice(0, 4).map(q).join('، ')}.`);
  if (cover < .9) tips.push(al ? `قرأت ${Math.round(cover * 100)}% من النص فقط، أكمله حتى النهاية.` : 'التسجيل قصير، أكمل الإلقاء حتى النهاية.');
  if (wpm && wpm < 60) tips.push('سرعتك بطيئة، حاول القراءة بانسيابية أكثر.');
  if (!tips.length) tips.push('إلقاء واثق ومنساب، أحسنت!');
  return { score, criteria, fillers, stutters, repetitions: reps, wpm, words: words.length, transcript: transcript || '', studentNote: tips.join(' '), details: al ? { inserted: al.inserted, repeated: al.repeated, omitted: al.omitted, substituted: al.substituted, selfFix: al.selfFix, coverage: Math.round(cover * 100) } : null, pauses: thinkPauses, teacherNote: `تقييم آلي داخل المتصفح (بدون ذكاء اصطناعي): تردد ${fillers}، تأتأة ${stutters}، تكرار ${reps}، توقفات تفكير ${thinkPauses} (أطول من ثانيتين: ${m.longPauses})${al ? `، إضافات ${al.inserted.length}، أخطاء قراءة ${al.substituted.length}، حذف ${al.omitted.length}، نسبة ما قُرئ ${Math.round(cover * 100)}%` : ''}${wpm ? `، السرعة ${wpm} كلمة/دقيقة` : ''}. ملاحظة: كشف «أأأ» والتأتأة صوتيًا تقريبي، ولتقييم دقيق أضف مفتاح Gemini.`, source: 'local', metrics: m };
}
async function aiEval(wav, task, key, model) {
  const ctx = task.mode === 'passage' ? `النص المطلوب إلقاؤه:\n${task.passage}` : `الطالب يلقي قطعة أو تعبيرًا من اختياره${task.topicHint ? ` (${task.topicHint})` : ''}.`;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model || 'gemini-2.5-flash')}:generateContent?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: `أنت معلمة لغة عربية خبيرة في تقييم الإلقاء والقراءة الجهرية، عادلة ومشجعة. استمع لتسجيل الطالب وقيّمه بدقة.
المهمة: ${task.title}. ${task.instructions || ''}
${ctx}
قيّم بصرامة وعدل، وانتبه خصوصًا لما يلي واذكره بالتفصيل:
1) أصوات التفكير والتردد مثل (أأأ، آآ، إممم، ممم، هااا) حتى لو كانت قصيرة أو بين الكلمات، وعدّها كلها.
2) التأتأة وتكرار المقاطع أو بدايات الكلمات (مثل: تـ تـ تسكن).
3) فجوات التفكير: الصمت الذي يزيد عن نصف ثانية في غير مواضع الوقف وعلامات الترقيم، مع توقيتها.
4) ${task.mode === 'passage' ? 'قارن بالنص كلمة بكلمة: الكلمات المضافة التي ليست في النص، والمحذوفة، والمقروءة خطأ، والمكررة، والتصحيح الذاتي (مثل: عفوًا)، وهل أكمل النص حتى نهايته.' : 'ترابط الأفكار ووضوحها والكلمات الحشوية والتكرار.'}
خصم الطلاقة: كل صوت تفكير أو تأتأة أو فجوة تفكير يخفض الطلاقة 5 إلى 8 درجات. ولا تعط الطلاقة أكثر من 70 إذا وُجدت 3 مشكلات أو أكثر.
أعد JSON فقط بهذا الشكل:
{"transcript":"اكتب ما قاله حرفيًا بما في ذلك أأأ وإممم والتكرار","fillers":0,"fillerExamples":["أأأ"],"stutters":0,"stutterExamples":["تـ تـ تسكن"],"thinkingPauses":0,"pauseTimes":["0:12"],"repetitions":0,"inserted":["كلمة مضافة"],"omitted":["كلمة محذوفة"],"substituted":[["الصحيح","المقروء"]],"selfCorrections":0,"coverage":100,"wordsPerMinute":0,"criteria":{"pronunciation":0,"fluency":0,"expression":0,"language":0,"confidence":0,"${task.mode === 'passage' ? 'accuracy' : 'content'}":0},"score":0,"verdict":"ممتاز|جيد جدًا|جيد|متوسط|ضعيف","studentNote":"ملاحظة للطالب بالعربية: نقطة قوة ثم ما يحسنه بالتحديد مع أمثلة مما قاله، بأسلوب مشجع في 3 جمل","teacherNote":"ملاحظة تشخيصية مختصرة للمعلمة تذكر الأعداد والأمثلة"}
كل الدرجات من 100.` }, { inline_data: { mime_type: 'audio/wav', data: wav.split(',')[1] } }] }], generationConfig: { responseMimeType: 'application/json', temperature: .2 } }) });
  const j = await r.json(); if (!r.ok) throw new Error(j.error?.message || 'Gemini');
  const o = JSON.parse(j.candidates[0].content.parts[0].text);
  return { score: Math.round(+o.score || 0), criteria: o.criteria || {}, fillers: +o.fillers || 0, fillerExamples: o.fillerExamples || [], stutters: +o.stutters || 0, repetitions: +o.repetitions || 0, pauses: +o.thinkingPauses || 0, wpm: +o.wordsPerMinute || 0, transcript: o.transcript || '', verdict: o.verdict || '', studentNote: o.studentNote || '', teacherNote: o.teacherNote || '', details: { inserted: o.inserted || [], omitted: o.omitted || [], substituted: o.substituted || [], repeated: o.stutterExamples || [], selfFix: +o.selfCorrections || 0, coverage: o.coverage ?? null, pauseTimes: o.pauseTimes || [] }, source: 'ai' };
}
async function evaluateRecording(blob, task, transcript) {
  const buf = await decodeBlob(blob); const pcm = await toMono16k(buf); const m = analyzePCM(pcm);
  let k = S.aiStu; if (k === undefined) { k = S.aiStu = isAdmin() ? (await DB.get('settings', 'ai').catch(() => null)) : (await DB.get('settings', 'aiStudent').catch(() => null)); }
  if (k?.key && m.speech > 1) { try { const r = await aiEval(wavB64(pcm), task, k.key, k.model); r.metrics = m; return r; } catch (e) { console.warn('AI eval failed', e); } }
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
function detailsHTML(r) {
  const d = r.details || {}; const q = x => `<span class="chip">${esc(x)}</span>`; const rows = [];
  rows.push(`<div class="row" style="gap:6px"><span class="chip ${r.fillers ? 'warn' : 'ok'}">أصوات تفكير (أأأ/إممم): ${r.fillers || 0}</span><span class="chip ${r.stutters ? 'warn' : 'ok'}">تأتأة: ${r.stutters || 0}</span><span class="chip ${r.pauses ? 'warn' : 'ok'}">فجوات تفكير: ${r.pauses || 0}</span><span class="chip ${r.repetitions ? 'warn' : 'ok'}">تكرار: ${r.repetitions || 0}</span>${d.coverage != null ? `<span class="chip ${d.coverage < 90 ? 'bad' : 'ok'}">ما قُرئ من النص: ${d.coverage}%</span>` : ''}</div>`);
  if (d.inserted?.length) rows.push(`<div class="small"><b>كلمات مضافة:</b> ${d.inserted.map(q).join(' ')}</div>`);
  if (d.repeated?.length) rows.push(`<div class="small"><b>مكرر:</b> ${d.repeated.map(q).join(' ')}</div>`);
  if (d.substituted?.length) rows.push(`<div class="small"><b>قراءة خاطئة:</b> ${d.substituted.map(([a, b]) => `<span class="chip">${esc(b)} ← ${esc(a)}</span>`).join(' ')}</div>`);
  if (d.omitted?.length) rows.push(`<div class="small"><b>محذوف:</b> ${d.omitted.slice(0, 12).map(q).join(' ')}${d.omitted.length > 12 ? ' …' : ''}</div>`);
  if (d.pauseTimes?.length) rows.push(`<div class="small"><b>مواضع التوقف:</b> ${d.pauseTimes.map(q).join(' ')}</div>`);
  return `<div class="col" style="gap:8px">${rows.join('')}</div>`;
}
const critBars = (a, b) => Object.keys(CRIT).filter(k => a?.[k] != null || b?.[k] != null).map(k => `<div class="hrow" style="grid-template-columns:minmax(90px,150px) minmax(0,1fr) 84px"><span>${CRIT[k]}</span><div class="col" style="gap:3px"><div class="bar"><i style="width:${a?.[k] || 0}%;background:${b ? 'var(--accent)' : pctColor(a?.[k] || 0)}"></i></div>${b ? `<div class="bar"><i style="width:${b[k] || 0}%;background:${pctColor(b[k] || 0)}"></i></div>` : ''}</div><b class="small" style="text-align:end">${a?.[k] ?? '-'}${b ? ' ← ' + (b[k] ?? '-') : ''}</b></div>`).join('');
A.perfDetail = async el => {
  const p = S.perfs.find(x => x.id === el.dataset.id); const t = S.tasks.find(x => x.id === p.taskId);
  openModal(`<p class="muted">جارٍ تحميل التسجيلات…</p>`, true);
  const [f, l] = await Promise.all([loadAudio(p.id + '_first'), p.finalScore != null ? loadAudio(p.id + '_final') : null]);
  const a = f?.rec?.result, b = l?.rec?.result;
  const box = (title, r, x) => `<div class="card flat col" style="gap:8px"><div class="row sp"><b>${title}</b>${x ? `<span class="chip ${grade5(x.score)[1]}">${x.score}%</span>` : ''}</div>${r ? `<audio controls preload="none" src="${esc(r.url)}" style="width:100%"></audio>` : '<p class="small muted">لا يوجد</p>'}${x ? `${detailsHTML(x)}<div class="small">${x.wpm ? `السرعة: <b>${x.wpm}</b> كلمة/دقيقة · ` : ''}${x.source === 'local' ? '<span class="muted">تقييم تقريبي داخل المتصفح</span>' : '<span style="color:var(--ok)">تقييم بالذكاء الاصطناعي</span>'}</div><p class="small" style="background:var(--surface2);padding:10px;border-radius:12px">${esc(x.teacherNote || x.studentNote)}</p>${x.transcript ? `<details><summary class="small" style="cursor:pointer">النص المسموع</summary><p class="small" style="white-space:pre-wrap">${esc(x.transcript)}</p></details>` : ''}` : ''}</div>`;
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
    body = `<div class="col" style="gap:14px"><div class="row" style="justify-content:center;gap:24px"><div class="ring" style="width:170px">${ringSVG(r.score)}<div class="v"><b style="color:${pctColor(r.score)};font-size:40px">${r.score}%</b><span class="small muted">${r.verdict || grade5(r.score)[0]}</span></div></div><div class="col" style="gap:6px">${r.wpm ? `<span class="chip">السرعة: ${r.wpm} كلمة/دقيقة</span>` : ''}<span class="chip br">المحاولة ${R.n}</span>${r.source === 'local' ? '<span class="chip">تقييم تقريبي</span>' : ''}</div></div>
    ${detailsHTML(r)}
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

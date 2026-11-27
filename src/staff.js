/* ---------------- computed ---------------- */
function quizResults(qid) {
  const q = quizById(qid); if (!q) return [];
  return S.subs.filter(s => s.quizId === qid).map(s => ({ sub: s, user: userById(s.uid) || { name: s.name, classId: s.classId }, ev: evalSub(q, S.keys[qid], s, S.reviews[s.id]) })).sort((a, b) => b.ev.pct - a.ev.pct);
}
function pendingReviews() {
  if (!isStaff()) return []; const out = [];
  for (const s of S.subs) { const q = quizById(s.quizId); if (!q) continue; const ev = evalSub(q, S.keys[q.id], s, S.reviews[s.id]); ev.items.filter(i => i.status === 'review').forEach(i => out.push({ sub: s, quiz: q, it: i })); }
  return out;
}
function studentEvals(uid) {
  return S.subs.filter(s => s.uid === uid).map(s => { const q = quizById(s.quizId); return q ? { q, s, ev: evalSub(q, S.keys[q.id], s, S.reviews[s.id]) } : null; }).filter(Boolean).sort((a, b) => a.s.submittedAt - b.s.submittedAt);
}
const classStudents = cid => students().filter(u => u.classId === cid);
const quizAudience = q => students().filter(u => (q.classIds || []).includes(u.classId));
const statusChip = s => ({ draft: '<span class="chip">مسودة</span>', pending: '<span class="chip warn">بانتظار الاعتماد</span>', published: '<span class="chip ok">منشور</span>', closed: '<span class="chip">مغلق</span>', rejected: '<span class="chip bad">مُعاد للتعديل</span>' }[s] || '');

const VIEWS = {};
/* ---------------- dashboard ---------------- */
VIEWS.dash = () => {
  if (S.me.role === 'student') return VIEWS.sdash();
  const st = students(), pub = S.quizzes.filter(q => q.status === 'published'), pend = pendingReviews(), appr = S.quizzes.filter(q => q.status === 'pending');
  const evs = S.subs.map(s => { const q = quizById(s.quizId); return q ? evalSub(q, S.keys[q.id], s, S.reviews[s.id]) : null; }).filter(Boolean);
  const reqs = S.users.filter(u => u.role === 'pending_delegate'); const un = unreadCount();
  const clsAvg = myClasses().map(c => { const ids = new Set(classStudents(c.id).map(u => u.id)); const v = S.subs.filter(s => ids.has(s.uid)).map(s => { const q = quizById(s.quizId); return q ? evalSub(q, S.keys[q.id], s, S.reviews[s.id]).pct : null; }).filter(x => x != null); return { l: c.name, v: avg(v), n: v.length }; });
  const recent = [...S.subs].sort((a, b) => b.submittedAt - a.submittedAt).slice(0, 6);
  const hour = new Date().getHours();
  return `<div class="col" style="gap:20px">
  <section class="hero"><div class="col" style="gap:10px"><span style="opacity:.85">${hour < 12 ? 'صباح الخير' : 'مساء الخير'}</span><h1>${esc(S.me.name)}</h1><p>${pub.length} اختبار منشور، و${S.subs.length} تسليم، ومتوسط عام ${r1(avg(evs.map(e => e.pct)))}%</p><div class="row" style="margin-top:6px"><button class="btn gold" data-a="newQuiz">${ico('plus')} اختبار جديد</button><button class="btn" style="background:rgba(255,255,255,.16)" data-a="nav" data-v="reports">${ico('chart')} التقارير</button></div></div>${ART}</section>
  ${!S.classes.length && isAdmin() ? `<div class="card"><h3>ابدأ بإضافة فصولك</h3><p class="muted" style="margin-bottom:12px">اكتب اسم كل فصل في سطر، وسيختار الطلاب فصولهم عند التسجيل.</p><form class="col" data-f="bulkClasses"><textarea class="in" id="bc" placeholder="الصف الأول متوسط - أ&#10;الصف الأول متوسط - ب&#10;الصف الثاني متوسط - أ" required></textarea><button class="btn" type="submit" style="align-self:flex-start">${ico('plus')} إضافة الفصول</button></form></div>` : ''}
  <div class="col">${pend.length ? `<div class="alert">${ico('review', 'style="width:22px"')}<span class="grow">لديك ${pend.length} إجابة تحتاج تقييمك، قدّر النظام بعضها كإجابات غير محسومة</span><button class="btn sm" data-a="nav" data-v="review">راجعها الآن</button></div>` : ''}
  ${appr.length && isAdmin() ? `<div class="alert acc">${ico('shield', 'style="width:22px"')}<span class="grow">${appr.length} اختبار من المفوضين ينتظر اعتمادك</span><button class="btn sm acc" data-a="nav" data-v="approvals">عرض</button></div>` : ''}
  ${reqs.length && isAdmin() ? `<div class="alert br">${ico('users', 'style="width:22px"')}<span class="grow">${reqs.length} طلب تفويض جديد</span><button class="btn sm" data-a="nav" data-v="delegates">مراجعة</button></div>` : ''}
  ${un ? `<div class="alert br">${ico('msg', 'style="width:22px"')}<span class="grow">${un} رسالة غير مقروءة</span><button class="btn sm" data-a="nav" data-v="msgs">فتح</button></div>` : ''}</div>
  <div class="grid g4">${stat(st.length, 'طالب مسجل')}${stat(pub.length, 'اختبار منشور', 'var(--accent)')}${stat(S.subs.length, 'تسليم', 'var(--gold)')}${stat(r1(avg(evs.map(e => e.pct))) + '%', 'المتوسط العام', 'var(--ok)')}</div>
  <div class="grid g2"><div class="card"><h3>متوسط الفصول</h3>${hbars(clsAvg.filter(c => c.n))}${clsAvg.some(c => c.n) ? '' : ''}</div>
  <div class="card"><div class="row sp" style="margin-bottom:10px"><h3 style="margin:0">آخر التسليمات</h3><button class="btn ghost sm" data-a="reload">${ico('down')} تحديث</button></div>${recent.length ? `<div class="list">${recent.map(s => { const q = quizById(s.quizId); const ev = q ? evalSub(q, S.keys[q.id], s, S.reviews[s.id]) : null; return `<button class="item" style="cursor:pointer;text-align:start" data-a="subDetail" data-id="${esc(s.id)}">${avatar(s.name, 36)}<div class="grow"><b>${esc(s.name)}</b><div class="small muted">${esc(q?.title || '')} · ${ago(s.submittedAt)}</div></div>${ev ? `<span class="chip ${grade5(ev.pct)[1]}">${ev.pct}%</span>${ev.pending ? '<span class="chip warn">مراجعة</span>' : ''}` : ''}</button>`; }).join('')}</div>` : empty('لا توجد تسليمات بعد')}</div></div></div>`;
};
FORMS.bulkClasses = async () => { const names = $('#bc').value.split('\n').map(s => s.trim()).filter(Boolean); await safe(async () => { let o = S.classes.length; for (const n of names) await DB.add('classes', { name: n, order: o++, createdAt: now() }); await reload(); }, `تمت إضافة ${names.length} فصل`); };

/* ---------------- quizzes list ---------------- */
VIEWS.quizzes = () => {
  const f = S.p.f || 'all'; const list = S.quizzes.filter(q => f === 'all' || q.status === f);
  const tabs = [['all', 'الكل'], ['published', 'المنشورة'], ['pending', 'بانتظار الاعتماد'], ['draft', 'المسودات'], ['rejected', 'المعادة'], ['closed', 'المغلقة']];
  return `<div class="top"><div class="t"><h1>الاختبارات</h1><p class="muted">${S.quizzes.length} اختبار</p></div><button class="btn" data-a="newQuiz">${ico('plus')} اختبار جديد</button></div>
  <div class="tabs" style="margin-bottom:18px">${tabs.map(([k, l]) => `<button class="${f === k ? 'on' : ''}" data-a="go" data-v="quizzes" data-f="${k}">${l}</button>`).join('')}</div>
  ${list.length ? `<div class="grid g2">${list.map(quizCard).join('')}</div>` : empty('لا توجد اختبارات هنا. ابدأ بإنشاء أول اختبار')}`;
};
function quizCard(q) {
  const res = quizResults(q.id), aud = quizAudience(q), pend = res.reduce((x, r) => x + r.ev.pending, 0); const mine = q.createdBy === S.user.uid;
  const canEdit = isAdmin() || (mine && ['draft', 'pending', 'rejected'].includes(q.status));
  return `<article class="qcard" style="--c:${colorOf(q.id)}"><div class="row sp"><h3>${esc(q.title)}</h3>${statusChip(q.status)}</div>
  <div class="row" style="gap:6px">${(q.classIds || []).map(c => `<span class="chip br">${esc(clsName(c))}</span>`).join('')}</div>
  <div class="row small muted"><span>${(q.questions || []).filter(x => x.type !== 'passage').length} سؤال</span><span>${q.totalPoints || 0} درجة</span>${q.duration ? `<span>${q.duration} دقيقة</span>` : ''}${q.dueAt ? `<span>حتى ${fmtDT(q.dueAt)}</span>` : ''}${q.createdBy !== S.user.uid ? `<span>بواسطة ${esc(q.createdByName || '')}</span>` : ''}</div>
  ${q.status === 'rejected' && q.rejectNote ? `<div class="alert acc small">ملاحظة المدير: ${esc(q.rejectNote)}</div>` : ''}
  ${q.status === 'published' || q.status === 'closed' ? `<div class="row"><div class="grow"><div class="row sp small"><span>سلّم ${res.length} من ${aud.length}</span><b>${r1(avg(res.map(r => r.ev.pct)))}%</b></div><div class="bar" style="margin-top:6px"><i style="width:${pct(res.length, aud.length)}%"></i></div></div>${pend ? `<span class="chip warn">${pend} للمراجعة</span>` : ''}</div>` : ''}
  <div class="row" style="margin-top:auto;gap:8px">
   ${['published', 'closed'].includes(q.status) ? `<button class="btn sm" data-a="go" data-v="qreport" data-id="${q.id}" data-from="quizzes">${ico('chart')} النتائج</button>` : ''}
   ${canEdit ? `<button class="btn sm soft" data-a="editQuiz" data-id="${q.id}">${ico('edit')} تعديل</button>` : ''}
   <button class="btn sm ghost" data-a="previewQuiz" data-id="${q.id}">${ico('eye')} معاينة</button>
   <button class="btn sm ghost" data-a="dupQuiz" data-id="${q.id}" title="نسخ">${ico('copy')}</button>
   ${isAdmin() && q.status === 'published' ? `<button class="btn sm ghost" data-a="closeQuiz" data-id="${q.id}">إغلاق</button>` : ''}
   ${isAdmin() && q.status === 'closed' ? `<button class="btn sm ghost" data-a="reopenQuiz" data-id="${q.id}">إعادة فتح</button>` : ''}
   ${isAdmin() && q.resultsMode === 'manual' && !q.released && ['published', 'closed'].includes(q.status) ? `<button class="btn sm gold" data-a="releaseQuiz" data-id="${q.id}">إعلان النتائج</button>` : ''}
   ${isAdmin() || (mine && q.status !== 'published') ? `<button class="btn sm danger" data-a="delQuiz" data-id="${q.id}" title="حذف">${ico('trash')}</button>` : ''}
  </div></article>`;
}
A.closeQuiz = el => safe(async () => { await DB.update('quizzes', el.dataset.id, { status: 'closed' }); await reload(); }, 'تم إغلاق الاختبار');
A.reopenQuiz = el => safe(async () => { await DB.update('quizzes', el.dataset.id, { status: 'published' }); await reload(); }, 'تمت إعادة فتح الاختبار');
A.releaseQuiz = async el => { if (!await ask('إعلان النتائج للطلاب؟', 'سيرى الطلاب درجاتهم وإجاباتهم.', 'إعلان')) return; safe(async () => { await DB.update('quizzes', el.dataset.id, { released: true }); const q = quizById(el.dataset.id); for (const c of q.classIds) await DB.add('messages', { from: S.user.uid, fromName: S.me.name, to: 'class:' + c, toName: clsName(c), kind: 'msg', subject: 'تم إعلان النتائج', body: `ظهرت نتائج اختبار «${q.title}». ادخل إلى نتائجي لمشاهدتها.`, createdAt: now(), readBy: [] }); await reload(); }, 'تم إعلان النتائج'); };
A.delQuiz = async el => { const q = quizById(el.dataset.id); const n = S.subs.filter(s => s.quizId === q.id).length; if (!await ask('حذف الاختبار؟', `«${esc(q.title)}»${n ? ` ومعه ${n} تسليم` : ''}. لا يمكن التراجع.`, 'حذف', true)) return; safe(async () => { if (isAdmin()) for (const s of S.subs.filter(s => s.quizId === q.id)) { await DB.del('submissions', s.id); await DB.del('reviews', s.id).catch(() => { }); } await DB.del('quizKeys', q.id).catch(() => { }); await DB.del('quizzes', q.id); await reload(); }, 'تم الحذف'); };
A.dupQuiz = el => { const q = quizById(el.dataset.id); const k = S.keys[q.id]; S.ed = edFrom(q, k); S.ed.id = null; S.ed.title += ' (نسخة)'; S.ed.dirty = true; S.ed.qs.forEach(x => { x.id = rid(6); }); go('editor'); };
A.editQuiz = el => { const q = quizById(el.dataset.id); S.ed = edFrom(q, S.keys[q.id]); go('editor'); };
A.newQuiz = () => { if (!myClasses().length) return toast(isAdmin() ? 'أضف فصلًا أولًا من صفحة الفصول' : 'لم يحدد لك المدير فصولًا بعد'); S.ed = { id: null, title: '', desc: '', classIds: myClasses().length === 1 ? [myClasses()[0].id] : [], duration: 0, dueAt: 0, resultsMode: 'instant', showAnswers: true, shuffle: false, openAt: 0, integrity: { drawCount: 0, noBack: false, qTime: 0, trackFocus: false, maxLeaves: 0, noCopy: false, asImage: false, similarity: true, fullscreen: false }, qs: [], dirty: false }; go('editor'); };
function edFrom(q, k) { return { id: q.id, title: q.title, desc: q.desc || '', classIds: [...(q.classIds || [])], duration: q.duration || 0, dueAt: q.dueAt || 0, resultsMode: q.resultsMode || 'instant', showAnswers: q.showAnswers !== false, shuffle: !!q.shuffle, openAt: q.openAt || 0, integrity: { ...{ drawCount: 0, noBack: false, qTime: 0, trackFocus: false, maxLeaves: 0, noCopy: false, asImage: false, similarity: true, fullscreen: false }, ...(q.integrity || {}) }, status: q.status, createdBy: q.createdBy, createdByName: q.createdByName, qs: (q.questions || []).map(p => joinQ(p, k?.answers?.[p.id])), dirty: false }; }

/* ---------------- editor ---------------- */
VIEWS.editor = () => {
  const E = S.ed; if (!E) return VIEWS.quizzes();
  const dt = E.dueAt ? new Date(E.dueAt - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : '';
  const ot = E.openAt ? new Date(E.openAt - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : ''; const G = E.integrity; const nQ = E.qs.filter(q => q.type !== 'passage').length;
  const tot = sum(E.qs.map(q => q.type === 'passage' ? 0 : +q.points || 0));
  return `<div class="top"><div class="t"><h1>${E.id ? 'تعديل الاختبار' : 'اختبار جديد'}</h1><p class="muted">${E.qs.filter(q => q.type !== 'passage').length} سؤال · ${tot} درجة</p></div><div class="row"><button class="btn ghost" data-a="nav" data-v="quizzes">${ico('back')} رجوع</button><button class="btn ghost" data-a="edPreview">${ico('eye')} معاينة</button></div></div>
  <div class="col" style="gap:18px">
  <section class="card"><div class="grid g2"><label class="f">عنوان الاختبار<input class="in" data-b="s:title" value="${esc(E.title)}" placeholder="مثال: اختبار الوحدة الثالثة"></label><label class="f">وصف أو تعليمات (اختياري)<input class="in" data-b="s:desc" value="${esc(E.desc)}" placeholder="اقرأ كل سؤال بعناية"></label></div>
  <div class="f" style="margin-top:14px"><span style="font-weight:500;font-size:14.5px">الفصول المستهدفة</span><div class="pick">${myClasses().map(c => `<label><input type="checkbox" data-c="edCls" value="${esc(c.id)}" ${E.classIds.includes(c.id) ? 'checked' : ''}><span>${esc(c.name)}</span></label>`).join('')}</div></div>
  <div class="grid g4" style="margin-top:14px"><label class="f">المدة بالدقائق (0 = مفتوح)<input class="in" type="number" min="0" max="600" data-b="s:duration" value="${E.duration}"></label><label class="f">يبدأ في (اختياري)<input class="in" type="datetime-local" data-b="s:openAt" value="${ot}"></label><label class="f">آخر موعد للتسليم (اختياري)<input class="in" type="datetime-local" data-b="s:dueAt" value="${dt}"></label>
  <label class="f">إظهار النتيجة<select class="in" data-b="s:resultsMode"><option value="instant" ${E.resultsMode === 'instant' ? 'selected' : ''}>فور انتهاء الطالب</option><option value="afterDue" ${E.resultsMode === 'afterDue' ? 'selected' : ''}>بعد انتهاء الموعد للجميع</option><option value="manual" ${E.resultsMode === 'manual' ? 'selected' : ''}>بعد أن أعلنها</option></select></label>
  <div class="col" style="justify-content:flex-end;gap:8px"><label class="sw"><input type="checkbox" data-b="s:showAnswers" ${E.showAnswers ? 'checked' : ''}> إظهار الإجابات الصحيحة للطالب</label><label class="sw"><input type="checkbox" data-b="s:shuffle" ${E.shuffle ? 'checked' : ''}> ترتيب عشوائي للأسئلة والخيارات</label></div></div></section>
  <section class="card" id="integ"><div class="row sp"><h3 style="margin:0">${ico('shield', 'style="width:22px;vertical-align:middle"')} النزاهة ومنع الغش</h3><div class="tabs">${[['off', 'بدون'], ['mid', 'متوسط'], ['strict', 'صارم']].map(([k, l]) => `<button class="${G.preset === k ? 'on' : ''}" data-a="integPreset" data-p="${k}">${l}</button>`).join('')}</div></div>
  <p class="small muted" style="margin:6px 0 14px">اختر الحماية المناسبة لهذا الاختبار. تظهر للطلاب قبل البدء كتنبيه، وتظهر نتائجها لك في تقرير الاختبار.</p>
  <div class="grid g2">
  <label class="f">بنك أسئلة: اسحب لكل طالب<select class="in" data-b="g:drawCount"><option value="0">كل الأسئلة (${nQ})</option>${Array.from({ length: Math.max(0, nQ - 1) }, (_, i) => i + 1).filter(n => n >= 3).map(n => `<option value="${n}" ${+G.drawCount === n ? 'selected' : ''}>${n} سؤال عشوائي من ${nQ}</option>`).join('')}</select></label>
  <label class="f">وقت لكل سؤال<select class="in" data-b="g:qTime">${[[0, 'بدون'], [20, '20 ثانية'], [30, '30 ثانية'], [45, '45 ثانية'], [60, 'دقيقة'], [90, 'دقيقة ونصف'], [120, 'دقيقتان'], [300, '5 دقائق']].map(([v, l]) => `<option value="${v}" ${+G.qTime === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  <label class="sw"><input type="checkbox" data-b="g:noBack" ${G.noBack ? 'checked' : ''}> سؤال في كل صفحة بدون رجوع</label>
  <label class="sw"><input type="checkbox" data-b="g:noCopy" ${G.noCopy ? 'checked' : ''}> منع النسخ واللصق ورصد اللصق</label>
  <label class="sw"><input type="checkbox" data-b="g:trackFocus" ${G.trackFocus ? 'checked' : ''}> رصد الخروج من صفحة الاختبار</label>
  <label class="f">التسليم التلقائي بعد عدد مرات الخروج<select class="in" data-b="g:maxLeaves">${[[0, 'لا، سجّل فقط'], [1, 'بعد مرة واحدة'], [2, 'بعد مرتين'], [3, 'بعد 3 مرات'], [5, 'بعد 5 مرات']].map(([v, l]) => `<option value="${v}" ${+G.maxLeaves === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  <label class="sw"><input type="checkbox" data-b="g:fullscreen" ${G.fullscreen ? 'checked' : ''}> ملء الشاشة أثناء الاختبار (على الكمبيوتر)</label>
  <label class="sw"><input type="checkbox" data-b="g:asImage" ${G.asImage ? 'checked' : ''}> عرض نص الأسئلة والخيارات كصور (يصعّب النسخ للذكاء الاصطناعي)</label>
  <label class="sw"><input type="checkbox" data-b="g:similarity" ${G.similarity ? 'checked' : ''}> كشف التشابه بين إجابات الطلاب في التقرير</label>
  </div><p class="small muted" style="margin-top:12px">تلميح: لإخفاء الإجابات الصحيحة حتى يُغلق الاختبار للجميع، اختر في «إظهار النتيجة»: بعد انتهاء الموعد للجميع. ولإضافة سؤال يُحل بخط اليد اختر نوع «حل بخط اليد».</p></section>
  <div class="col" id="qlist" style="gap:14px">${E.qs.map(qEditor).join('') || `<div class="card flat center muted">لم تُضف أسئلة بعد. اختر نوع السؤال بالأسفل، أو الصق أسئلتك دفعة واحدة.</div>`}</div>
  <section class="card"><div class="row sp" style="margin-bottom:12px"><h3 style="margin:0">أضف سؤالًا</h3><div class="row"><button class="btn sm" data-a="pdfOpen">${ico('dl')} استيراد من PDF</button><button class="btn sm soft" data-a="bulkOpen">${ico('copy')} لصق سريع لعدة أسئلة</button><button class="btn sm acc" data-a="aiGenOpen">${ico('wand')} توليد بالذكاء الاصطناعي</button></div></div>
  <div class="types">${Object.entries(QT).map(([k, t]) => `<button class="type" data-a="addQ" data-t="${k}">${ico(k)}<b>${t.n}</b><small>${t.d}</small></button>`).join('')}</div></section>
  <div class="card row sp savebar"><span class="muted small">${E.dirty ? 'تعديلات غير محفوظة' : 'محفوظ'}</span><div class="row"><button class="btn ghost" data-a="edSave" data-s="draft">حفظ كمسودة</button>${isAdmin() ? `<button class="btn" data-a="edSave" data-s="published">${ico('send')} ${E.status === 'published' ? 'حفظ التعديلات' : 'نشر للطلاب'}</button>` : `<button class="btn acc" data-a="edSave" data-s="pending">${ico('shield')} إرسال للاعتماد</button>`}</div></div></div>`;
};
function qEditor(q, i) {
  const t = QT[q.type]; const X = (a, j = '') => `data-a="${a}" data-i="${i}" data-j="${j}"`;
  let body = '';
  const txt = (ph) => `<label class="f">${q.type === 'passage' ? 'النص القرائي' : 'نص السؤال'}<textarea class="in" data-b="q:${i}:text" placeholder="${ph}">${esc(q.text)}</textarea></label>`;
  switch (q.type) {
    case 'mcq': case 'multi': body = txt('اكتب السؤال') + `<div class="col" style="gap:8px"><span class="small muted">${q.type === 'mcq' ? 'اضغط على علامة الصح بجانب الإجابة الصحيحة' : 'حدد كل الإجابات الصحيحة'}</span>${q.choices.map((c, j) => `<div class="optrow"><button class="mark ${c.ok ? 'on' : ''}" ${X('markCh', j)} aria-label="صحيحة">${ico('check')}</button><input class="in" data-b="c:${i}:${j}" value="${esc(c.t)}" placeholder="الخيار ${j + 1}"><button class="btn icon sm ghost" ${X('delCh', j)} aria-label="حذف">${ico('x')}</button></div>`).join('')}<button class="btn sm ghost" style="align-self:flex-start" ${X('addCh')}>${ico('plus')} خيار</button></div>`; break;
    case 'tf': body = txt('اكتب العبارة') + `<div class="pick">${[['true', 'صح'], ['false', 'خطأ']].map(([v, l]) => `<label><input type="radio" name="tf${q.id}" ${q.correct === v ? 'checked' : ''} data-c="tfSet" data-i="${i}" value="${v}"><span>الإجابة: ${l}</span></label>`).join('')}</div>`; break;
    case 'short': body = txt('مثال: ما عاصمة المملكة؟') + `<div class="col" style="gap:8px"><span class="small muted">الإجابات المقبولة (يقارنها النظام بذكاء مع مراعاة الهمزات والتشكيل والأخطاء الإملائية البسيطة)</span>${q.accepted.map((a, j) => `<div class="optrow"><input class="in" data-b="acc:${i}:${j}" value="${esc(a)}" placeholder="إجابة مقبولة"><button class="btn icon sm ghost" ${X('delAcc', j)}>${ico('x')}</button></div>`).join('')}<button class="btn sm ghost" style="align-self:flex-start" ${X('addAcc')}>${ico('plus')} صيغة أخرى مقبولة</button><label class="f small">كلمات مفتاحية (اختياري، افصل بفاصلة)<input class="in" data-b="kw:${i}" value="${esc(q.keywords.join('، '))}" placeholder="مثل: الرياض، نجد"></label></div>`; break;
    case 'essay': body = txt('اكتب سؤال المقال') + `<label class="f">الإجابة النموذجية (تساعد في الاقتراح الذكي)<textarea class="in" data-b="q:${i}:model">${esc(q.model)}</textarea></label><div class="grid g2"><label class="f small">عناصر يجب ذكرها (افصل بفاصلة)<input class="in" data-b="kw:${i}" value="${esc(q.keywords.join('، '))}"></label><label class="f small">أقل عدد كلمات (اختياري)<input class="in" type="number" min="0" data-b="q:${i}:minWords" value="${q.minWords || 0}"></label></div>`; break;
    case 'photo': body = txt('اكتب السؤال، وسيحله الطالب على ورقة ويرفع صورة الحل') + `<label class="f">الحل النموذجي (يظهر لك عند التقييم)<textarea class="in" data-b="q:${i}:model">${esc(q.model || '')}</textarea></label>`; break;
    case 'fill': body = `<label class="f">النص مع الفراغات<textarea class="in" data-b="q:${i}:text" placeholder="عاصمة المملكة هي [[الرياض]] وتقع في منطقة [[نجد|وسط المملكة]]">${esc(q.text)}</textarea></label><p class="small muted">ضع كل إجابة بين [[ ]]، والصيغ البديلة يفصلها الرمز |</p>`; break;
    case 'match': body = txt('مثال: صِل كل دولة بعاصمتها') + `<div class="col" style="gap:8px">${q.pairs.map((p, j) => `<div class="optrow"><input class="in" data-b="pl:${i}:${j}" value="${esc(p.l)}" placeholder="العنصر"><span>${ico('back', 'style="width:20px;transform:scaleX(-1)"')}</span><input class="in" data-b="pr:${i}:${j}" value="${esc(p.r)}" placeholder="ما يقابله"><button class="btn icon sm ghost" ${X('delPair', j)}>${ico('x')}</button></div>`).join('')}<button class="btn sm ghost" style="align-self:flex-start" ${X('addPair')}>${ico('plus')} زوج</button><label class="f small">خيارات مشتتة إضافية (سطر لكل خيار، اختياري)<textarea class="in" style="min-height:60px" data-b="ex:${i}">${esc((q.extra || []).join('\n'))}</textarea></label></div>`; break;
    case 'order': body = txt('مثال: رتّب مراحل دورة الماء') + `<div class="col" style="gap:8px"><span class="small muted">اكتب العناصر بترتيبها الصحيح، وسيظهر للطالب مخلوطًا</span>${q.items.map((it, j) => `<div class="optrow"><span class="qnum" style="width:30px;height:30px;font-size:13px">${j + 1}</span><input class="in" data-b="it:${i}:${j}" value="${esc(it.t)}"><button class="btn icon sm ghost" ${X('mvItem', j)} data-d="-1">${ico('up')}</button><button class="btn icon sm ghost" ${X('delItem', j)}>${ico('x')}</button></div>`).join('')}<button class="btn sm ghost" style="align-self:flex-start" ${X('addItem')}>${ico('plus')} عنصر</button></div>`; break;
    case 'numeric': body = txt('مثال: كم يساوي 12 × 4؟') + `<div class="grid g3"><label class="f">الإجابة<input class="in" type="number" step="any" data-b="q:${i}:value" value="${q.value}"></label><label class="f">هامش التسامح ±<input class="in" type="number" step="any" min="0" data-b="q:${i}:tol" value="${q.tol}"></label><label class="f">الوحدة (اختياري)<input class="in" data-b="q:${i}:unit" value="${esc(q.unit || '')}" placeholder="سم، كجم"></label></div>`; break;
    case 'passage': body = txt('الصق القطعة هنا، وستظهر قبل الأسئلة التي تليها'); break;
  }
  return `<article class="qed" id="qe-${q.id}"><div class="hd"><span class="qnum">${i + 1}</span><span class="chip br">${ico(q.type, 'style="width:16px"')} ${t.n}</span><span class="grow"></span>
  ${q.type !== 'passage' ? `<label class="row small" style="gap:6px">الدرجة<input class="in" type="number" min="0" step="0.5" style="width:84px;min-height:38px" data-b="q:${i}:points" value="${q.points}"></label><input class="in" style="width:150px;min-height:38px" data-b="q:${i}:tag" value="${esc(q.tag)}" placeholder="المهارة أو الدرس" title="تُستخدم في تحليل نقاط القوة والضعف">` : ''}
  <button class="btn icon sm ghost" ${X('mvQ')} data-d="-1" title="أعلى">${ico('up')}</button><button class="btn icon sm ghost" ${X('mvQ')} data-d="1" title="أسفل">${ico('down')}</button><button class="btn icon sm ghost" ${X('dupQ')} title="تكرار">${ico('copy')}</button><button class="btn icon sm danger" ${X('delQ')} title="حذف">${ico('trash')}</button></div>
  ${body}<div class="row small">${q.img ? `<img src="${esc(q.img)}" alt="" style="max-height:90px;border-radius:10px"><button class="btn sm danger" ${X('clrImg')}>إزالة الصورة</button>` : `<label class="btn sm ghost" style="cursor:pointer">${ico('img')} إرفاق صورة<input type="file" accept="image/*" hidden data-c="qImg" data-i="${i}"></label>`}</div></article>`;
}
BIND = el => {
  const [k, a, b] = el.dataset.b.split(':'); const E = S.ed; if (!E && k !== 'cert') return BINDX(el); if (k === 'cert') return BINDX(el);
  const v = el.type === 'checkbox' ? el.checked : el.value; E.dirty = true;
  if (k === 'g') { E.integrity[a] = el.type === 'checkbox' ? el.checked : Math.max(0, +v || 0); E.integrity.preset = ''; return; }
  if (k === 's') { if (a === 'openAt') E.openAt = v ? new Date(v).getTime() : 0; else if (a === 'dueAt') E.dueAt = v ? new Date(v).getTime() : 0; else if (a === 'duration') E.duration = Math.max(0, +v || 0); else E[a] = v; return; }
  const q = E.qs[+a]; if (!q) return;
  if (k === 'q') q[b] = ['points', 'value', 'tol', 'minWords'].includes(b) ? (v === '' ? '' : +v) : v;
  else if (k === 'c') q.choices[+b].t = v; else if (k === 'acc') q.accepted[+b] = v; else if (k === 'kw') q.keywords = v.split(/[,،]/).map(s => s.trim()).filter(Boolean);
  else if (k === 'pl') q.pairs[+b].l = v; else if (k === 'pr') q.pairs[+b].r = v; else if (k === 'it') q.items[+b].t = v; else if (k === 'ex') q.extra = v.split('\n');
};
let BINDX = () => { };
const edR = () => { S.ed.dirty = true; const y = scrollY; render(); scrollTo(0, y); };
const QI = el => S.ed.qs[+el.dataset.i];
const PRESETS = { off: { drawCount: 0, noBack: false, qTime: 0, trackFocus: false, maxLeaves: 0, noCopy: false, asImage: false, similarity: true, fullscreen: false }, mid: { noBack: false, qTime: 0, trackFocus: true, maxLeaves: 0, noCopy: true, asImage: false, similarity: true, fullscreen: false }, strict: { noBack: true, qTime: 45, trackFocus: true, maxLeaves: 3, noCopy: true, asImage: true, similarity: true, fullscreen: true } };
A.integPreset = el => { const E = S.ed, p = el.dataset.p, n = E.qs.filter(q => q.type !== 'passage').length; Object.assign(E.integrity, PRESETS[p], { preset: p }); if (p === 'strict' && n >= 10) E.integrity.drawCount = Math.max(5, Math.round(n * .7)); if (p !== 'strict') E.integrity.drawCount = p === 'off' ? 0 : E.integrity.drawCount; edR(); toast(p === 'off' ? 'أُلغيت الحماية' : p === 'mid' ? 'حماية متوسطة: رصد الخروج ومنع النسخ' : 'حماية صارمة: بدون رجوع، وقت لكل سؤال، أسئلة كصور، تسليم تلقائي بعد 3 خروج'); };
A.addQ = el => { S.ed.qs.push(newQ(el.dataset.t)); edR(); setTimeout(() => { const n = $$('.qed').pop(); n?.scrollIntoView({ behavior: 'smooth', block: 'center' }); n?.querySelector('textarea,input')?.focus(); }, 60); };
A.delQ = async el => { if (await ask('حذف السؤال؟', '', 'حذف', true)) { S.ed.qs.splice(+el.dataset.i, 1); edR(); } };
A.dupQ = el => { const c = clone(QI(el)); c.id = rid(6); S.ed.qs.splice(+el.dataset.i + 1, 0, c); edR(); };
A.mvQ = el => { const i = +el.dataset.i, j = i + +el.dataset.d; if (j < 0 || j >= S.ed.qs.length) return; [S.ed.qs[i], S.ed.qs[j]] = [S.ed.qs[j], S.ed.qs[i]]; edR(); };
A.markCh = el => { const q = QI(el); if (q.type === 'mcq') q.choices.forEach((c, j) => c.ok = j === +el.dataset.j); else q.choices[+el.dataset.j].ok = !q.choices[+el.dataset.j].ok; edR(); };
A.addCh = el => { QI(el).choices.push({ id: rid(4), t: '', ok: false }); edR(); };
A.delCh = el => { const q = QI(el); if (q.choices.length > 2) { q.choices.splice(+el.dataset.j, 1); edR(); } };
A.addAcc = el => { QI(el).accepted.push(''); edR(); };
A.delAcc = el => { const q = QI(el); if (q.accepted.length > 1) { q.accepted.splice(+el.dataset.j, 1); edR(); } };
A.addPair = el => { QI(el).pairs.push({ id: rid(4), l: '', r: '' }); edR(); };
A.delPair = el => { const q = QI(el); if (q.pairs.length > 2) { q.pairs.splice(+el.dataset.j, 1); edR(); } };
A.addItem = el => { QI(el).items.push({ id: rid(4), t: '' }); edR(); };
A.delItem = el => { const q = QI(el); if (q.items.length > 2) { q.items.splice(+el.dataset.j, 1); edR(); } };
A.mvItem = el => { const q = QI(el), j = +el.dataset.j; if (j > 0) { [q.items[j - 1], q.items[j]] = [q.items[j], q.items[j - 1]]; edR(); } };
A.tfSet = el => { QI(el).correct = el.value; S.ed.dirty = true; };
A.edCls = el => { const E = S.ed; E.classIds = $$('[data-c=edCls]:checked').map(x => x.value); E.dirty = true; };
A.clrImg = el => { QI(el).img = ''; edR(); };
A.qImg = (el) => { const f = el.files[0]; if (!f) return; const q = QI(el); resizeImg(f, 900).then(d => { q.img = d; edR(); }); };
function resizeImg(file, max) { return new Promise(res => { const r = new FileReader(); r.onload = () => { const im = new Image(); im.onload = () => { const s = Math.min(1, max / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = im.width * s; c.height = im.height * s; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', .72)); }; im.src = r.result; }; r.readAsDataURL(file); }); }
A.bulkOpen = () => openModal(`<h2>لصق سريع لعدة أسئلة</h2><p class="muted small" style="margin:8px 0">افصل بين الأسئلة بسطر فارغ. ضع علامة * قبل الخيار الصحيح، و - قبل الخيارات الأخرى. وللإجابات النصية اكتب «ج:» ثم الإجابة.</p><textarea class="in" id="bulk" style="min-height:240px" placeholder="ما عاصمة المملكة؟&#10;- جدة&#10;* الرياض&#10;- الدمام&#10;&#10;الشمس نجم.&#10;ج: صح&#10;&#10;كم عدد أيام الأسبوع؟&#10;ج: 7&#10;&#10;اذكر لونين من ألوان العلم.&#10;ج: الأخضر / الأبيض&#10;&#10;يتكون الماء من [[الهيدروجين]] و[[الأكسجين]]"></textarea><div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn ghost" data-a="close">إلغاء</button><button class="btn" data-a="bulkAdd">إضافة الأسئلة</button></div>`, true);
A.bulkAdd = () => { const qs = parseBulk($('#bulk').value); if (!qs.length) return toast('لم أتعرف على أسئلة'); S.ed.qs.push(...qs); closeModal(); edR(); toast(`أضيف ${qs.length} سؤال، راجعها ثم احفظ`); };
A.edPreview = () => { const E = S.ed; const quiz = { title: E.title || 'معاينة', questions: E.qs.map(q => splitQ(q).pub), duration: 0 }; previewModal(quiz); };
A.previewQuiz = el => previewModal(quizById(el.dataset.id));
function previewModal(q) { openModal(`<div class="row sp"><h2>${esc(q.title)}</h2><button class="btn ghost sm" data-a="close">إغلاق</button></div><p class="muted small" style="margin:6px 0 14px">هكذا يرى الطالب الأسئلة</p><div class="col" style="gap:14px">${(q.questions || []).map((x, i) => `<div class="card flat">${renderQ(x, null, i, true)}</div>`).join('')}</div>`, true); }
A.edSave = async el => {
  const E = S.ed, st = el.dataset.s;
  if (!E.title.trim()) return toast('اكتب عنوان الاختبار');
  if (!E.classIds.length) return toast('اختر فصلًا واحدًا على الأقل');
  if (st !== 'draft') {
    if (!E.qs.some(q => q.type !== 'passage')) return toast('أضف سؤالًا واحدًا على الأقل');
    for (const [i, q] of E.qs.entries()) { const n = i + 1; if (!q.text.trim()) return toast(`السؤال ${n} بلا نص`); if (q.type === 'mcq' && !q.choices.some(c => c.ok && c.t.trim())) return toast(`حدد الإجابة الصحيحة في السؤال ${n}`); if (q.type === 'multi' && !q.choices.some(c => c.ok)) return toast(`حدد إجابة صحيحة في السؤال ${n}`); if (q.type === 'fill' && !/\[\[.+?\]\]/.test(q.text)) return toast(`السؤال ${n}: ضع الإجابة بين [[ ]]`); if (q.type === 'short' && !q.accepted.some(a => a.trim()) && !q.keywords.length) return toast(`السؤال ${n}: اكتب الإجابة المقبولة`); }
  }
  const nQ = E.qs.filter(q => q.type !== 'passage').length; if (E.integrity.drawCount && E.integrity.drawCount >= nQ) E.integrity.drawCount = 0;
  if (E.openAt && E.dueAt && E.openAt >= E.dueAt) return toast('وقت البدء يجب أن يكون قبل آخر موعد');
  const parts = E.qs.map(splitQ); const pubQs = parts.map(p => p.pub); const key = { answers: Object.fromEntries(parts.map(p => [p.pub.id, p.key])) };
  const doc = { title: E.title.trim(), desc: E.desc.trim(), classIds: E.classIds, duration: E.duration, dueAt: E.dueAt || 0, resultsMode: E.resultsMode, showAnswers: E.showAnswers, shuffle: E.shuffle, openAt: E.openAt || 0, integrity: E.integrity, questions: pubQs, totalPoints: sum(pubQs.map(q => q.points)), status: st, updatedAt: now() };
  doc.pubClasses = st === 'published' ? E.classIds : [];
  if (st === 'published' && E.status !== 'published') doc.publishedAt = now();
  if (st === 'pending') doc.rejectNote = '';
  if (JSON.stringify(doc).length > 900000) return toast('حجم الاختبار كبير جدًا بسبب الصور، قلّل عدد الصور');
  await safe(async () => {
    let id = E.id;
    if (!id) { id = rid(16); await DB.set('quizzes', id, { ...doc, createdBy: S.user.uid, createdByName: S.me.name, createdAt: now(), released: false }); }
    else await DB.update('quizzes', id, doc);
    await DB.set('quizKeys', id, key);
    if (st === 'pending') await DB.add('messages', { from: S.user.uid, fromName: S.me.name, to: 'admin', toName: 'المدير', kind: 'msg', subject: 'اختبار جديد بانتظار الاعتماد', body: `أرسل ${S.me.name} اختبار «${doc.title}» لاعتماده.`, createdAt: now(), readBy: [] });
    if (st === 'published' && E.status !== 'published') for (const c of E.classIds) await DB.add('messages', { from: S.user.uid, fromName: S.me.name, to: 'class:' + c, toName: clsName(c), kind: 'msg', subject: 'اختبار جديد', body: `تم نشر اختبار «${doc.title}». بالتوفيق!`, createdAt: now(), readBy: [] });
    S.ed = null; await reload(); go('quizzes');
  }, st === 'published' ? 'تم النشر للطلاب' : st === 'pending' ? 'أُرسل للمدير للاعتماد' : 'تم الحفظ');
};

/* ---------------- AI (Gemini) ---------------- */
async function gemini(prompt, img, mime = 'image/jpeg') {
  S.ai ||= await DB.get('settings', 'ai'); const ai = S.ai; if (!ai?.key) throw new Error('أضف مفتاح Gemini من الإعدادات أولًا');
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(ai.model || 'gemini-2.5-flash')}:generateContent?key=${encodeURIComponent(ai.key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, ...(img ? [{ inline_data: { mime_type: mime, data: img.split(',')[1] } }] : [])] }], generationConfig: { responseMimeType: 'application/json', temperature: .35 } }) });
  const j = await r.json(); if (!r.ok) throw new Error(j.error?.message || 'خطأ من Gemini'); return JSON.parse(j.candidates[0].content.parts[0].text);
}
A.aiGenOpen = () => { if (!isAdmin()) return toast('التوليد الذكي متاح للمدير'); openModal(`<h2>${ico('wand', 'style="width:26px;vertical-align:middle"')} توليد أسئلة بالذكاء الاصطناعي</h2><p class="muted small" style="margin:8px 0">الصق الدرس أو اكتب الموضوع، وسأقترح أسئلة متنوعة تراجعها قبل الحفظ.</p><textarea class="in" id="ai-src" style="min-height:160px" placeholder="الصق نص الدرس هنا"></textarea><div class="grid g2" style="margin-top:10px"><label class="f">عدد الأسئلة<input class="in" id="ai-n" type="number" value="8" min="1" max="30"></label><label class="f">المستوى<select class="in" id="ai-lv"><option>متوسط</option><option>سهل</option><option>متقدم</option></select></label></div><p id="ai-st" class="small muted" style="margin-top:8px"></p><div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn ghost" data-a="close">إلغاء</button><button class="btn acc" data-a="aiGen">${ico('spark')} ولّد الأسئلة</button></div>`, true); };
A.aiGen = async el => {
  const src = $('#ai-src').value.trim(); if (src.length < 20) return toast('الصق نصًا أطول'); el.disabled = true; $('#ai-st').textContent = 'جارٍ التوليد…';
  try {
    const out = await gemini(`أنت معلم خبير. أنشئ ${+$('#ai-n').value || 8} أسئلة باللغة العربية بمستوى ${$('#ai-lv').value} من النص التالي، ونوّع بين الأنواع: mcq, multi, tf, short, fill, match, order, essay.
أعد JSON فقط بهذا الشكل: {"questions":[{"type":"mcq","text":"...","tag":"المهارة","choices":[{"t":"...","ok":true},{"t":"...","ok":false}]},{"type":"tf","text":"...","answer":"true"},{"type":"short","text":"...","accepted":["..."]},{"type":"fill","text":"جملة فيها [[الإجابة]]"},{"type":"match","text":"...","pairs":[{"l":"...","r":"..."}]},{"type":"order","text":"...","items":["الأول","الثاني"]},{"type":"essay","text":"...","model":"...","keywords":["..."]}]}
النص:\n${src}`);
    const qs = (out.questions || []).map(x => { const q = newQ(QT[x.type] ? x.type : 'short'); q.text = x.text || ''; q.tag = x.tag || ''; if (x.choices) q.choices = x.choices.map(c => ({ id: rid(4), t: c.t, ok: !!c.ok })); if (q.type === 'tf') q.correct = String(x.answer) === 'false' ? 'false' : 'true'; if (x.accepted) q.accepted = x.accepted; if (x.pairs) q.pairs = x.pairs.map(p => ({ id: rid(4), l: p.l, r: p.r })); if (x.items) q.items = x.items.map(t => ({ id: rid(4), t })); if (x.model) q.model = x.model; if (x.keywords) q.keywords = x.keywords; if (q.type === 'essay') q.points = 5; return q; });
    S.ed.qs.push(...qs); closeModal(); edR(); toast(`أضيف ${qs.length} سؤال مقترح، راجعها`);
  } catch (e) { $('#ai-st').textContent = e.message; el.disabled = false; }
};

/* ---------------- approvals ---------------- */
VIEWS.approvals = () => {
  const list = S.quizzes.filter(q => q.status === 'pending');
  return `<div class="top"><div class="t"><h1>اعتماد الاختبارات</h1><p class="muted">اختبارات أعدها المفوضون وتنتظر موافقتك قبل وصولها للطلاب</p></div></div>
  ${list.length ? `<div class="list">${list.map(q => `<div class="card"><div class="row sp"><div><h3>${esc(q.title)}</h3><p class="small muted">${esc(q.createdByName)} · ${fmtDT(q.updatedAt)} · ${(q.questions || []).length} سؤال · ${q.totalPoints} درجة</p></div><div class="row">${q.classIds.map(c => `<span class="chip br">${esc(clsName(c))}</span>`).join('')}</div></div>
  <div class="row" style="margin-top:14px"><button class="btn ghost" data-a="apprView" data-id="${q.id}">${ico('eye')} مراجعة الأسئلة والإجابات</button><button class="btn soft" data-a="editQuiz" data-id="${q.id}">${ico('edit')} تعديل بنفسي</button><span class="grow"></span><button class="btn danger" data-a="apprReject" data-id="${q.id}">إعادة للتعديل</button><button class="btn okb" data-a="apprOk" data-id="${q.id}">${ico('check')} اعتماد ونشر</button></div></div>`).join('')}</div>` : empty('لا توجد طلبات اعتماد حاليًا', 'shield')}`;
};
A.apprView = el => { const q = quizById(el.dataset.id), k = S.keys[q.id]; openModal(`<div class="row sp"><h2>${esc(q.title)}</h2><button class="btn ghost sm" data-a="close">إغلاق</button></div><div class="col" style="gap:12px;margin-top:14px">${q.questions.map((x, i) => `<div class="card flat">${renderQ(x, null, i, true)}${x.type !== 'passage' ? `<div class="alert br small" style="margin-top:10px">الإجابة المعتمدة: ${esc(keyText(x, k?.answers?.[x.id]))}</div>` : ''}</div>`).join('')}</div><div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn danger" data-a="apprReject" data-id="${q.id}">إعادة للتعديل</button><button class="btn okb" data-a="apprOk" data-id="${q.id}">اعتماد ونشر</button></div>`, true); };
A.apprOk = el => { closeModal(); const q = quizById(el.dataset.id); safe(async () => { await DB.update('quizzes', q.id, { status: 'published', pubClasses: q.classIds, publishedAt: now(), approvedBy: S.user.uid }); await DB.add('messages', { from: S.user.uid, fromName: S.me.name, to: q.createdBy, toName: q.createdByName, kind: 'msg', subject: 'تم اعتماد اختبارك', body: `تم اعتماد اختبار «${q.title}» ونشره للطلاب. شكرًا لجهدك.`, createdAt: now(), readBy: [] }); for (const c of q.classIds) await DB.add('messages', { from: S.user.uid, fromName: S.me.name, to: 'class:' + c, toName: clsName(c), kind: 'msg', subject: 'اختبار جديد', body: `تم نشر اختبار «${q.title}». بالتوفيق!`, createdAt: now(), readBy: [] }); await reload(); }, 'تم الاعتماد والنشر'); };
A.apprReject = async el => { closeModal(); const q = quizById(el.dataset.id); const note = await askText('إعادة للتعديل', 'ملاحظاتك للمفوض', '', true); if (note == null) return; safe(async () => { await DB.update('quizzes', q.id, { status: 'rejected', rejectNote: note }); await DB.add('messages', { from: S.user.uid, fromName: S.me.name, to: q.createdBy, toName: q.createdByName, kind: 'msg', subject: 'اختبارك يحتاج تعديلًا', body: `اختبار «${q.title}»: ${note}`, createdAt: now(), readBy: [] }); await reload(); }, 'أُعيد الاختبار للمفوض'); };

/* ---------------- review queue (smart grouping) ---------------- */
VIEWS.review = () => {
  const pend = pendingReviews(); const groups = new Map();
  for (const p of pend) { const k = p.quiz.id + '|' + p.it.qid + '|' + (p.quiz.questions.find(q => q.id === p.it.qid).type === 'essay' ? p.sub.id : normAr(JSON.stringify(p.it.ans))); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
  const G = [...groups.values()];
  return `<div class="top"><div class="t"><h1>المراجعة الذكية</h1><p class="muted">إجابات لم يحسمها التصحيح الآلي. الإجابات المتطابقة مجمّعة لتقرر فيها مرة واحدة</p></div><span class="chip warn">${pend.length} إجابة</span></div>
  ${G.length ? `<div class="list">${G.map((g, gi) => reviewCard(g, gi)).join('')}</div>` : empty('ممتاز! لا توجد إجابات تنتظر تقييمك', 'review')}`;
};
function reviewCard(g, gi) {
  const { quiz, it } = g[0]; const q = quiz.questions.find(x => x.id === it.qid); const k = S.keys[quiz.id]?.answers?.[q.id]; const conf = Math.round((it.conf || 0) * 100);
  return `<div class="card" id="rg-${gi}"><div class="row sp"><div class="row"><span class="chip br">${esc(quiz.title)}</span><span class="chip">${QT[q.type].n}</span><span class="chip">${q.points} درجة</span></div><span class="chip ${conf >= 60 ? 'ok' : conf >= 40 ? 'warn' : 'bad'}">تقدير النظام: تطابق ${conf}%</span></div>
  <p style="margin:12px 0 6px;font-weight:600">${esc(q.text)}</p>
  <div class="grid g2"><div class="rv"><span class="small muted">إجابة الطالب${g.length > 1 ? ` (${g.length} طلاب كتبوا نفس الإجابة)` : ''}</span>${q.type === 'photo' && it.ans ? `<a href="${esc(it.ans)}" target="_blank" rel="noopener"><img src="${esc(it.ans)}" alt="حل الطالب" style="max-width:100%;max-height:360px;border-radius:12px"></a>` : `<b style="white-space:pre-wrap">${esc(ansText(q, it.ans))}</b>`}${it.words != null ? `<span class="small muted">${it.words} كلمة</span>` : ''}</div><div class="rv ok"><span class="small muted">الإجابة المعتمدة</span><b style="white-space:pre-wrap">${esc(keyText(q, k)) || '—'}</b></div></div>
  <p class="small muted" style="margin-top:8px">${g.map(x => esc(x.sub.name)).join('، ')}</p>
  <div id="ai-${gi}"></div>
  <div class="row" style="margin-top:12px"><button class="btn okb" data-a="rvSet" data-g="${gi}" data-v="full">${ico('check')} صحيحة</button><button class="btn danger" data-a="rvSet" data-g="${gi}" data-v="0">${ico('x')} خاطئة</button><div class="row" style="gap:6px"><input class="in" type="number" step="0.5" min="0" max="${q.points}" id="rp-${gi}" value="${it.suggest ?? ''}" style="width:90px;min-height:44px" aria-label="درجة جزئية"><button class="btn soft" data-a="rvSet" data-g="${gi}" data-v="part">درجة جزئية</button></div>
  ${q.type === 'short' && isAdmin() ? `<button class="btn ghost" data-a="rvAccept" data-g="${gi}" title="تضاف إلى الإجابات المقبولة فتُصحَّح تلقائيًا للجميع">${ico('spark')} اعتمدها إجابة مقبولة دائمًا</button>` : ''}
  ${isAdmin() ? `<button class="btn ghost" data-a="rvAI" data-g="${gi}">${ico('wand')} رأي الذكاء الاصطناعي</button>` : ''}</div></div>`;
}
const rvGroups = () => { const pend = pendingReviews(); const groups = new Map(); for (const p of pend) { const k = p.quiz.id + '|' + p.it.qid + '|' + (p.quiz.questions.find(q => q.id === p.it.qid).type === 'essay' ? p.sub.id : normAr(JSON.stringify(p.it.ans))); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); } return [...groups.values()]; };
async function setOverride(sub, qid, points, note = '') {
  const cur = S.reviews[sub.id] || { overrides: {} }; const ov = { ...(cur.overrides || {}), [qid]: { points: +points, note, by: S.user.uid, at: now() } };
  const d = { quizId: sub.quizId, uid: sub.uid, overrides: ov, reviewedAt: now() }; await DB.set('reviews', sub.id, d); S.reviews[sub.id] = { id: sub.id, ...d };
}
A.rvSet = async el => {
  const g = rvGroups()[+el.dataset.g]; if (!g) return; const q = g[0].quiz.questions.find(x => x.id === g[0].it.qid); const v = el.dataset.v;
  const pts = v === 'full' ? q.points : v === '0' ? 0 : Math.min(q.points, Math.max(0, +$('#rp-' + el.dataset.g).value || 0));
  await safe(async () => { for (const p of g) await setOverride(p.sub, p.it.qid, pts); render(); }, `تم التقييم (${g.length})`);
};
A.rvAccept = async el => {
  const g = rvGroups()[+el.dataset.g]; const { quiz, it } = g[0]; const key = clone(S.keys[quiz.id]); const ans = String(it.ans).trim();
  key.answers[it.qid].accepted = [...(key.answers[it.qid].accepted || []), ans];
  await safe(async () => { await DB.set('quizKeys', quiz.id, key); S.keys[quiz.id] = key; render(); }, 'اعتُمدت الإجابة، وصُححت لكل من كتبها');
};
A.rvAI = async el => {
  const gi = el.dataset.g, g = rvGroups()[+gi]; const { quiz, it } = g[0]; const q = quiz.questions.find(x => x.id === it.qid); const box = $('#ai-' + gi); box.innerHTML = `<p class="small muted" style="margin-top:10px">جارٍ التحليل…</p>`;
  try {
    const photo = q.type === 'photo' && it.ans;
    const r = await gemini(`أنت مصحح عادل ودقيق. السؤال: ${q.text}\nالإجابة النموذجية: ${keyText(q, S.keys[quiz.id]?.answers?.[q.id])}\nإجابة الطالب: ${photo ? 'في الصورة المرفقة (حل بخط اليد)' : ansText(q, it.ans)}\nالدرجة الكاملة: ${q.points}\nأعد JSON: {"points": رقم, "verdict": "صحيحة|جزئية|خاطئة", "reason": "سبب مختصر بالعربية"}`, photo ? it.ans : undefined);
    box.innerHTML = `<div class="alert br" style="margin-top:10px">${ico('wand', 'style="width:20px"')}<span class="grow"><b>${esc(r.verdict)}، ${esc(r.points)} من ${q.points}</b><br><span class="small">${esc(r.reason)}</span></span></div>`; const inp = $('#rp-' + gi); if (inp) inp.value = r.points;
  } catch (e) { box.innerHTML = `<p class="small" style="color:var(--bad);margin-top:10px">${esc(e.message)}</p>`; }
};

/* submission detail (staff) */
A.subDetail = el => {
  const s = S.subs.find(x => x.id === el.dataset.id); const q = quizById(s.quizId); const ev = evalSub(q, S.keys[q.id], s, S.reviews[s.id]);
  openModal(`<div class="row sp"><div class="row">${avatar(s.name)}<div><h2>${esc(s.name)}</h2><p class="small muted">${esc(q.title)} · ${fmtDT(s.submittedAt)}${s.timeSpent ? ` · استغرق ${Math.round(s.timeSpent / 60)} دقيقة` : ''}</p>${s.integrity && (s.integrity.leaves || s.integrity.pastes || s.integrity.pasteSus) ? `<p class="small" style="color:var(--bad)">خرج من الاختبار ${s.integrity.leaves} مرة (${Math.round((s.integrity.awayMs || 0) / 1000)} ث)${s.integrity.pastes ? ` · حاول اللصق ${s.integrity.pastes} مرة` : ''}${s.integrity.pasteSus ? ` · إدخال نص دفعة واحدة ${s.integrity.pasteSus} مرة` : ''}${s.auto ? ' · سُلِّم تلقائيًا' : ''}</p>` : ''}</div></div><span class="chip ${grade5(ev.pct)[1]}" style="font-size:16px;padding:6px 14px">${ev.total} / ${ev.max} · ${ev.pct}%</span></div>
  <div class="col" style="gap:10px;margin-top:16px">${ev.items.map((i, n) => `<div class="rv ${i.status === 'correct' ? 'ok' : i.status === 'review' ? 'warn' : i.status === 'partial' ? 'warn' : 'bad'}"><div class="row sp"><b>${n + 1}. ${esc(i.q.text.slice(0, 140))}</b><span class="chip ${i.status === 'correct' ? 'ok' : i.status === 'wrong' ? 'bad' : 'warn'}">${i.status === 'review' ? 'تحتاج تقييم' : `${i.score} / ${i.max}`}</span></div>${i.q.type === 'photo' && i.ans ? `<img src="${esc(i.ans)}" alt="حل الطالب" style="max-width:280px;border-radius:12px">` : `<span class="small">إجابته: ${esc(ansText(i.q, i.ans))}</span>`}<span class="small muted">الصحيح: ${esc(keyText(i.q, S.keys[q.id]?.answers?.[i.qid]))}</span><div class="row noprint" style="gap:6px"><input class="in" type="number" step="0.5" min="0" max="${i.max}" value="${i.status === 'review' ? (i.suggest ?? '') : i.score}" id="ov-${i.qid}" style="width:90px;min-height:38px"><button class="btn sm soft" data-a="ovSave" data-s="${s.id}" data-q="${i.qid}">تعديل الدرجة</button>${i.reviewed ? '<span class="chip br">قيّمها المعلم</span>' : ''}</div></div>`).join('')}</div>
  <div class="row noprint" style="justify-content:flex-end;margin-top:16px"><button class="btn ghost" data-a="print">${ico('print')} طباعة</button>${isAdmin() ? `<button class="btn danger" data-a="subReset" data-s="${s.id}">السماح بإعادة الاختبار</button>` : ''}<button class="btn" data-a="close">تم</button></div>`, true);
};
A.ovSave = async el => { const s = S.subs.find(x => x.id === el.dataset.s); await safe(async () => { await setOverride(s, el.dataset.q, +$('#ov-' + el.dataset.q).value || 0); A.subDetail({ dataset: { id: s.id } }); render(); }, 'تم تعديل الدرجة'); };
A.subReset = async el => { if (!await ask('السماح بإعادة الاختبار؟', 'سيُحذف تسليم الطالب الحالي ليعيد الحل.', 'حذف التسليم', true)) return; closeModal(); safe(async () => { await DB.del('submissions', el.dataset.s); await DB.del('reviews', el.dataset.s).catch(() => { }); await reload(); }, 'يمكن للطالب الآن إعادة الاختبار'); };

/* ---------------- students ---------------- */
VIEWS.students = () => {
  const c = S.p.c || '', qy = (S.p.q || '').trim(); let list = students().filter(u => (!c || u.classId === c) && (!qy || normAr(u.name).includes(normAr(qy)) || (u.studentNo || '').includes(qy)));
  const rows = list.map(u => { const e = studentEvals(u.id); return { u, n: e.length, a: avg(e.map(x => x.ev.pct)) }; }).sort((a, b) => a.u.name.localeCompare(b.u.name, 'ar'));
  return `<div class="top"><div class="t"><h1>الطلاب</h1><p class="muted">${list.length} مسجل${c ? ' في ' + esc(clsName(c)) : ''}</p></div><div class="row">${isAdmin() ? `<button class="btn" data-a="impOpen">${ico('plus')} إضافة طلاب</button>${Object.keys(S.creds || {}).length ? `<button class="btn ghost" data-a="go" data-v="cards" data-c="${esc(c)}" data-from="students">${ico('print')} بطاقات الدخول</button>` : ''}` : ''}<button class="btn ghost" data-a="exportStudents">${ico('dl')} تصدير Excel</button></div></div>
  ${rosterSection(c)}<div class="row" style="margin-bottom:16px"><input class="in" style="max-width:320px" placeholder="بحث بالاسم أو الرقم" id="st-q" value="${esc(qy)}" data-c="stFilter"><select class="in" style="max-width:260px" id="st-c" data-c="stFilter"><option value="">كل الفصول</option>${myClasses().map(x => `<option value="${x.id}" ${c === x.id ? 'selected' : ''}>${esc(x.name)} (${classStudents(x.id).length})</option>`).join('')}</select></div>
  ${rows.length ? `<div class="card" style="padding:0;overflow:hidden"><table class="stack"><thead><tr><th>الطالب</th><th>الفصل</th><th class="num">الاختبارات</th><th>المتوسط</th><th></th></tr></thead><tbody>${rows.map(({ u, n, a }) => `<tr><td><div class="row" style="gap:10px;flex-wrap:nowrap">${avatar(u.name, 34)}<div><b>${esc(u.name)}</b>${u.active === false ? ' <span class="chip bad">موقوف</span>' : ''}<div class="small muted">${esc(u.studentNo || u.email)}${isStuEmail(u.email) ? ' · أنشأه المعلم' : ''}</div></div></div></td><td>${esc(clsName(u.classId))}</td><td class="num">${n}</td><td>${n ? `<div class="row" style="gap:8px;flex-wrap:nowrap"><div class="bar grow"><i style="width:${a}%;background:${pctColor(a)}"></i></div><b class="small">${r1(a)}%</b></div>` : '<span class="muted small">لم يختبر بعد</span>'}</td><td><div class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn sm soft" data-a="go" data-v="sreport" data-id="${u.id}" data-from="students">${ico('chart')} تقرير</button><button class="btn icon sm ghost" data-a="msgTo" data-id="${u.id}" title="رسالة">${ico('msg')}</button><button class="btn icon sm ghost" data-a="certTo" data-id="${u.id}" title="شهادة">${ico('cert')}</button>${isAdmin() ? `<button class="btn icon sm ghost" data-a="stEdit" data-id="${u.id}" title="تعديل">${ico('edit')}</button>` : ''}</div></td></tr>`).join('')}</tbody></table></div>` : empty('لا يوجد طلاب. يسجل الطلاب بأنفسهم من صفحة الدخول ويختارون فصولهم', 'users')}`;
};
A.stFilter = () => { S.p.q = $('#st-q').value; S.p.c = $('#st-c').value; render(); };
A.stEdit = el => { const u = userById(el.dataset.id); openModal(`<h2>تعديل بيانات الطالب</h2><form class="col" data-f="stSave" data-id="${u.id}" style="margin-top:14px"><label class="f">الاسم<input class="in" id="se-n" value="${esc(u.name)}" required></label><label class="f">الفصل<select class="in" id="se-c">${S.classes.map(c => `<option value="${c.id}" ${c.id === u.classId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label><label class="f">رقم الطالب<input class="in" id="se-no" value="${esc(u.studentNo || '')}"></label><label class="f">الجوال<input class="in" id="se-p" value="${esc(u.phone || '')}" dir="ltr"></label>${S.creds?.[u.id] ? `<div class="alert br small">رقم الدخول: <b dir="ltr">${esc(S.creds[u.id].no)}</b> · كلمة المرور: <b dir="ltr">${esc(S.creds[u.id].pass)}</b></div>` : `<p class="small muted" dir="ltr" style="text-align:start">${esc(u.email)}</p>`}<label class="sw"><input type="checkbox" id="se-a" ${u.active !== false ? 'checked' : ''}> الحساب مفعّل</label><div class="row" style="justify-content:space-between;margin-top:8px"><button type="button" class="btn danger" data-a="stDel" data-id="${u.id}">حذف الطالب</button><div class="row"><button type="button" class="btn ghost" data-a="close">إلغاء</button><button class="btn" type="submit">حفظ</button></div></div></form>`); };
FORMS.stSave = f => safe(async () => { await DB.update('users', f.dataset.id, { name: $('#se-n').value.trim(), classId: $('#se-c').value, studentNo: $('#se-no').value.trim(), phone: $('#se-p').value.trim(), active: $('#se-a').checked }); closeModal(); await reload(); }, 'تم الحفظ');
A.stDel = async el => { closeModal(); if (!await ask('حذف الطالب؟', 'تُحذف بياناته وتسليماته من المنصة. يبقى حساب الدخول ويمكنه التسجيل من جديد.', 'حذف', true)) return; safe(async () => { for (const s of S.subs.filter(s => s.uid === el.dataset.id)) await DB.del('submissions', s.id); const u = userById(el.dataset.id); await DB.del('users', el.dataset.id); await DB.del('creds', el.dataset.id).catch(() => { }); if (u?.rosterId) await DB.update('roster', u.rosterId, { claimedBy: null }).catch(() => { }); await reload(); }, 'تم الحذف'); };
A.exportStudents = () => { const rows = [['الاسم', 'الفصل', 'رقم الطالب', 'البريد', 'الجوال', 'عدد الاختبارات', 'المتوسط %', ...S.quizzes.filter(q => q.status !== 'draft').map(q => q.title)]]; for (const u of students()) { const e = studentEvals(u.id); rows.push([u.name, clsName(u.classId), u.studentNo || '', u.email, u.phone || '', e.length, r1(avg(e.map(x => x.ev.pct))), ...S.quizzes.filter(q => q.status !== 'draft').map(q => { const x = e.find(y => y.q.id === q.id); return x ? x.ev.total : ''; })]); } downloadCSV('الطلاب-والدرجات', rows); };

/* ---------------- classes ---------------- */
VIEWS.classes = () => `<div class="top"><div class="t"><h1>الفصول</h1><p class="muted">يختار الطالب فصله عند التسجيل، ويمكنك نقله لاحقًا</p></div><button class="btn" data-a="clsAdd">${ico('plus')} فصل جديد</button></div>
  ${S.classes.length ? `<div class="grid g3">${S.classes.map(c => { const n = classStudents(c.id).length; return `<div class="qcard" style="--c:${colorOf(c.id)}"><h3>${esc(c.name)}</h3><p class="muted small">${n} طالب · ${S.quizzes.filter(q => q.classIds?.includes(c.id)).length} اختبار</p><div class="row"><button class="btn sm soft" data-a="go" data-v="creport" data-id="${c.id}" data-from="classes">${ico('chart')} تقرير الفصل</button><button class="btn icon sm ghost" data-a="clsRen" data-id="${c.id}">${ico('edit')}</button><button class="btn icon sm danger" data-a="clsDel" data-id="${c.id}">${ico('trash')}</button></div></div>`; }).join('')}</div>` : empty('أضف فصولك ليتمكن الطلاب من التسجيل', 'class')}`;
A.clsAdd = async () => { const n = await askText('فصل جديد', 'اسم الفصل'); if (n?.trim()) safe(async () => { await DB.add('classes', { name: n.trim(), order: S.classes.length, createdAt: now() }); await reload(); }, 'تمت الإضافة'); };
A.clsRen = async el => { const c = cls(el.dataset.id); const n = await askText('تعديل اسم الفصل', 'اسم الفصل', c.name); if (n?.trim()) safe(async () => { await DB.update('classes', c.id, { name: n.trim() }); await reload(); }, 'تم التعديل'); };
A.clsDel = async el => { const c = cls(el.dataset.id); if (classStudents(c.id).length) return toast('انقل طلاب الفصل أولًا قبل حذفه'); if (await ask('حذف الفصل؟', esc(c.name), 'حذف', true)) safe(async () => { await DB.del('classes', c.id); await reload(); }, 'تم الحذف'); };

/* ---------------- delegates ---------------- */
VIEWS.delegates = () => {
  const reqs = S.users.filter(u => u.role === 'pending_delegate'), dels = S.users.filter(u => u.role === 'delegate');
  const card = (u, req) => `<div class="card"><div class="row sp"><div class="row">${avatar(u.name)}<div><b>${esc(u.name)}</b><div class="small muted" dir="ltr" style="text-align:start">${esc(u.email)}</div></div></div>${req ? '<span class="chip warn">طلب جديد</span>' : `<span class="chip ok">مفوض · ${S.quizzes.filter(q => q.createdBy === u.id).length} اختبار</span>`}</div>
  <div class="f" style="margin-top:12px"><span class="small muted">الفصول المسموح له بإعداد اختباراتها</span><div class="pick">${S.classes.map(c => `<label><input type="checkbox" class="dc-${u.id}" value="${c.id}" ${(u.delegateClasses || []).includes(c.id) ? 'checked' : ''}><span>${esc(c.name)}</span></label>`).join('')}</div></div>
  <div class="row" style="margin-top:12px;justify-content:flex-end">${req ? `<button class="btn danger" data-a="delReject" data-id="${u.id}">رفض</button><button class="btn okb" data-a="delSave" data-id="${u.id}">${ico('check')} قبول التفويض</button>` : `<button class="btn danger" data-a="delRevoke" data-id="${u.id}">إلغاء التفويض</button><button class="btn" data-a="delSave" data-id="${u.id}">حفظ الفصول</button>`}</div></div>`;
  return `<div class="top"><div class="t"><h1>المفوضون</h1><p class="muted">من يسجل كـ«معلم متعاون» يظهر هنا. تحدد له فصولًا، وكل اختبار يعده يمر عليك للاعتماد</p></div></div>
  ${reqs.length ? `<h3 style="margin-bottom:10px">طلبات جديدة</h3><div class="list" style="margin-bottom:24px">${reqs.map(u => card(u, true)).join('')}</div>` : ''}
  <h3 style="margin-bottom:10px">المفوضون الحاليون</h3>${dels.length ? `<div class="list">${dels.map(u => card(u)).join('')}</div>` : empty('لا يوجد مفوضون بعد. اطلب من المعلم المتعاون إنشاء حساب واختيار «معلم متعاون»', 'users')}`;
};
A.delSave = el => { const id = el.dataset.id; const dc = $$('.dc-' + id + ':checked').map(x => x.value); if (!dc.length) return toast('اختر فصلًا واحدًا على الأقل'); const u = userById(id); safe(async () => { await DB.update('users', id, { role: 'delegate', delegateClasses: dc }); if (u.role === 'pending_delegate') await DB.add('messages', { from: S.user.uid, fromName: S.me.name, to: id, toName: u.name, kind: 'msg', subject: 'تم قبول التفويض', body: `مرحبًا بك! أصبح بإمكانك إعداد اختبارات لفصول: ${dc.map(clsName).join('، ')}. كل اختبار يمر علي للاعتماد قبل النشر.`, createdAt: now(), readBy: [] }); await reload(); }, 'تم الحفظ'); };
A.delReject = async el => { if (await ask('رفض الطلب؟', '', 'رفض', true)) safe(async () => { await DB.del('users', el.dataset.id); await reload(); }, 'تم الرفض'); };
A.delRevoke = async el => { if (await ask('إلغاء التفويض؟', 'يبقى حسابه ولكن دون صلاحيات.', 'إلغاء التفويض', true)) safe(async () => { await DB.update('users', el.dataset.id, { role: 'pending_delegate', delegateClasses: [] }); await reload(); }, 'تم إلغاء التفويض'); };

/* ---------------- settings ---------------- */
VIEWS.settings = () => {
  const s = S.settings; const th = store.get('qz_theme', '');
  return `<div class="top"><div class="t"><h1>الإعدادات</h1></div></div><div class="col" style="gap:18px">
  <form class="card col" data-f="setSave"><h3>هوية المنصة</h3><div class="grid g3"><label class="f">اسم المنصة<input class="in" id="s-pn" value="${esc(s.platformName || 'سبورة')}"></label><label class="f">اسم المدرسة<input class="in" id="s-sn" value="${esc(s.schoolName || '')}"></label><label class="f">اسم المعلم كما يظهر للطلاب وفي الشهادات<input class="in" id="s-tn" value="${esc(s.teacherName || S.me.name)}"></label></div><button class="btn" style="align-self:flex-start" type="submit">حفظ</button></form>
  <form class="card col" data-f="aiSave"><h3>${ico('wand', 'style="width:22px;vertical-align:middle"')} الذكاء الاصطناعي (اختياري)</h3><p class="muted small">التصحيح الذكي يعمل بدون أي مفتاح. أضف مفتاح Gemini من Google AI Studio لتفعيل: توليد الأسئلة من الدروس، ورأي الذكاء في الإجابات المقالية والغامضة. المفتاح محفوظ ولا يراه إلا المدير.</p><div class="grid g2"><label class="f">مفتاح Gemini API<input class="in" id="ai-k" type="password" dir="ltr" placeholder="AIza…" autocomplete="off"></label><label class="f">النموذج<input class="in" id="ai-m" dir="ltr" value="gemini-2.5-flash"></label></div><button class="btn" style="align-self:flex-start" type="submit">حفظ المفتاح</button></form>
  <form class="card col" data-f="aiStuSave"><h3>${ico('mic', 'style="width:22px;vertical-align:middle"')} تقييم الإلقاء الفوري للطلاب</h3><p class="muted small">ليُقيَّم إلقاء الطالب بالذكاء الاصطناعي لحظة انتهائه، يحتاج متصفحه مفتاحًا. لا تستخدم مفتاحك الأساسي: أنشئ مفتاحًا ثانيًا في Google AI Studio، ثم من Google Cloud Console قيّده بموقع المنصة فقط (Website restrictions). بدون مفتاح يُقيَّم الإلقاء تقييمًا صوتيًا تقريبيًا داخل المتصفح، وتستطيع أنت إعادة تقييمه بالذكاء الاصطناعي من صفحة النتائج.</p><div class="grid g2"><label class="f">مفتاح Gemini للطلاب<input class="in" id="ais-k" type="password" dir="ltr" autocomplete="off" placeholder="AIza…"></label><label class="f">النموذج<input class="in" id="ais-m" dir="ltr" value="gemini-2.5-flash"></label></div><div class="row"><button class="btn" type="submit">حفظ</button><button class="btn ghost" type="button" data-a="aiStuDel">إيقاف التقييم الفوري بالذكاء</button></div></form>
  <div class="card"><h3>المظهر</h3><div class="pick">${[['', 'حسب الجهاز'], ['light', 'فاتح'], ['dark', 'داكن مريح للعين']].map(([v, l]) => `<label><input type="radio" name="th" value="${v}" ${th === v ? 'checked' : ''} data-c="theme"><span>${l}</span></label>`).join('')}</div></div>
  <div class="card"><h3>نسخة احتياطية</h3><p class="muted small" style="margin-bottom:10px">تنزيل كل الدرجات في ملف يفتح في Excel</p><button class="btn ghost" data-a="exportStudents">${ico('dl')} تنزيل الدرجات</button></div>
  <div class="card"><h3>الأمان</h3><ul class="small muted" style="margin:0;padding-inline-start:20px;line-height:2"><li>حساب المدير مرتبط ببريدك المؤكد فقط: <b dir="ltr">${ADMIN_EMAIL}</b></li><li>الطالب لا يرى مفتاح الإجابات قبل التسليم، ولا يستطيع تعديل إجاباته بعده</li><li>الدرجة تُحسب من الإجابات المحفوظة في كل مرة، فلا يمكن التلاعب بها</li><li>الرسائل الخاصة لا يقرؤها إلا المرسل والمستلم</li></ul></div></div>`;
};
FORMS.setSave = () => safe(async () => { const d = { platformName: $('#s-pn').value.trim() || 'سبورة', schoolName: $('#s-sn').value.trim(), teacherName: $('#s-tn').value.trim() }; await DB.set('settings', 'app', d, true); await DB.update('users', S.user.uid, { name: d.teacherName || S.me.name }); S.me.name = d.teacherName || S.me.name; S.settings = { ...S.settings, ...d }; render(); }, 'تم الحفظ');
FORMS.aiSave = () => { const k = $('#ai-k').value.trim(); if (!k) return toast('الصق المفتاح'); safe(async () => { const d = { key: k, model: $('#ai-m').value.trim() || 'gemini-2.5-flash' }; await DB.set('settings', 'ai', d); S.ai = d; $('#ai-k').value = ''; }, 'تم حفظ المفتاح'); };
FORMS.aiStuSave = () => { const k = $('#ais-k').value.trim(); if (!k) return toast('الصق المفتاح'); safe(async () => { await DB.set('settings', 'aiStudent', { key: k, model: $('#ais-m').value.trim() || 'gemini-2.5-flash' }); $('#ais-k').value = ''; }, 'تم الحفظ'); };
A.aiStuDel = () => safe(() => DB.del('settings', 'aiStudent'), 'أُوقف التقييم الفوري بالذكاء');
A.theme = el => { store.set('qz_theme', el.value); applyTheme(); };
function applyTheme() { const t = store.get('qz_theme', ''); if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }

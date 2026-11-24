/* ---------------- adding students by the teacher (paste / Excel / image) ---------------- */
const HEAD_RE = /^(م|#|ت|الرقم|رقم|الاسم|اسم الطالب|اسم الطالبة|الطالب|الطالبة|name|no|id|الفصل|الصف)$/i;
function parseRoster(txt, defCls) {
  const out = [];
  for (let line of String(txt || '').replace(/\r/g, '').split('\n')) {
    line = line.trim(); if (!line) continue;
    let cells = line.split(/\t|,|؛|;|\|/).map(x => x.trim()).filter(Boolean);
    let name = '', no = '', classId = defCls || '';
    if (cells.length === 1) { const m = latinDigits(line).match(/\d{3,}/); if (m) { no = m[0]; cells = [line.replace(/[0-9٠-٩]{3,}/, '').trim()]; } }
    for (const c of cells) {
      const d = latinDigits(c).replace(/\s/g, '');
      if (/^\d{3,}$/.test(d) && !no) { no = d; continue; }
      if (/^\d{1,2}[-.)]?$/.test(d)) continue;
      const k = S.classes.find(x => normAr(x.name) === normAr(c) || (normAr(c).length > 3 && normAr(x.name).includes(normAr(c))));
      if (k && cells.length > 1) { classId = k.id; continue; }
      if (/\p{L}/u.test(c) && c.length > name.length) name = c;
    }
    name = name.replace(/^[0-9٠-٩]+\s*[-.)]\s*/, '').replace(/\s+/g, ' ').trim();
    if (name.length < 3 || HEAD_RE.test(name)) continue;
    out.push({ name, no, classId, ok: true });
  }
  return out;
}
const loadScript = src => new Promise((res, rej) => { if ([...document.scripts].some(s => s.src === src)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('تعذر تحميل المكتبة')); document.head.appendChild(s); });

A.impOpen = () => { S.imp = { tab: 'paste', cls: S.p.c || myClasses()[0]?.id || '', rows: [], status: '' }; impRender(); };
function impRender() {
  const I = S.imp; const existing = new Set(students().map(u => u.studentNo).filter(Boolean));
  const rows = I.rows.map((r, i) => { const dup = r.no && existing.has(r.no); return `<tr><td><input type="checkbox" data-ib="${i}:ok" ${r.ok && !dup ? 'checked' : ''} ${dup ? 'disabled' : ''}></td><td><input class="in" style="min-height:38px" data-ib="${i}:name" value="${esc(r.name)}"></td><td><input class="in" style="min-height:38px;width:130px" dir="ltr" data-ib="${i}:no" value="${esc(r.no)}" placeholder="تلقائي"></td><td><select class="in" style="min-height:38px" data-ib="${i}:classId">${S.classes.map(c => `<option value="${c.id}" ${c.id === (r.classId || I.cls) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></td><td class="small">${dup ? '<span class="chip warn">مسجل مسبقًا</span>' : r.err ? `<span class="chip bad">${esc(r.err)}</span>` : r.done ? '<span class="chip ok">تم</span>' : ''}</td></tr>`; }).join('');
  openModal(`<div class="row sp"><h2>${ico('users', 'style="width:26px;vertical-align:middle"')} إضافة طلاب</h2><button class="btn ghost sm" data-a="close">إغلاق</button></div>
  <p class="muted small" style="margin:6px 0 14px">ينشئ النظام لكل طالب حسابًا برقم دخول وكلمة مرور، ثم تطبع بطاقاتهم وتوزعها. الطالب يدخل برقمه بدون بريد إلكتروني.</p>
  <label class="f" style="max-width:360px">الفصل الافتراضي<select class="in" id="imp-cls" data-c="impCls">${myClasses().map(c => `<option value="${c.id}" ${c.id === I.cls ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
  <div class="tabs" style="margin:14px 0">${[['paste', 'لصق من Excel'], ['file', 'ملف Excel'], ['img', 'صورة قائمة']].map(([k, l]) => `<button class="${I.tab === k ? 'on' : ''}" data-a="impTab" data-t="${k}">${l}</button>`).join('')}</div>
  ${I.tab === 'paste' ? `<textarea class="in" id="imp-txt" style="min-height:150px" placeholder="انسخ عمود الأسماء (ومعه رقم الطالب إن وجد) من Excel والصقه هنا&#10;سارة محمد الدوسري	1120345&#10;لمى عبدالله القحطاني	1120346"></textarea><button class="btn soft" style="margin-top:10px" data-a="impParse">قراءة القائمة</button>`
    : I.tab === 'file' ? `<label class="btn soft" style="cursor:pointer">${ico('dl')} اختر ملف Excel أو CSV<input type="file" hidden accept=".xlsx,.xls,.csv" data-c="impFile"></label><p class="small muted" style="margin-top:8px">يقرأ الورقة الأولى: عمود الاسم، ورقم الطالب إن وجد، والفصل إن وجد</p>`
    : `<label class="btn soft" style="cursor:pointer">${ico('img')} اختر صورة القائمة أو صوّرها<input type="file" hidden accept="image/*" data-c="impImg"></label><p class="small muted" style="margin-top:8px">${S.ai?.key ? 'يقرأ الصورة بالذكاء الاصطناعي (Gemini) بدقة عالية' : 'يقرأ الصورة بقارئ نصوص مجاني. للحصول على دقة أعلى مع الخط اليدوي أضف مفتاح Gemini من الإعدادات'}. راجع الأسماء بعد القراءة.</p>`}
  <p class="small" id="imp-st" style="margin-top:10px;color:var(--brand);font-weight:600">${esc(I.status)}</p>
  ${I.rows.length ? `<div class="scroll" style="margin-top:6px;max-height:340px;overflow:auto"><table><thead><tr><th></th><th>الاسم</th><th>رقم الدخول</th><th>الفصل</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
  <div class="row sp" style="margin-top:14px"><span class="small muted">${I.rows.filter(r => r.ok && !(r.no && existing.has(r.no)) && !r.done).length} طالب جاهز للإضافة</span><div class="row"><button class="btn ghost" data-a="impAddRow">${ico('plus')} صف</button><button class="btn" data-a="impCreate" ${I.busy ? 'disabled' : ''}>${ico('check')} إنشاء الحسابات</button></div></div>` : ''}`, true);
}
A.impTab = el => { S.imp.tab = el.dataset.t; impRender(); };
A.impCls = el => { S.imp.cls = el.value; };
A.impAddRow = () => { S.imp.rows.push({ name: '', no: '', classId: S.imp.cls, ok: true }); impRender(); };
document.addEventListener('input', e => { const el = e.target.closest('[data-ib]'); if (!el || !S.imp) return; const [i, f] = el.dataset.ib.split(':'); S.imp.rows[+i][f] = el.type === 'checkbox' ? el.checked : f === 'no' ? latinDigits(el.value).trim() : el.value; });
document.addEventListener('change', e => { const el = e.target.closest('[data-ib]'); if (el && el.tagName === 'SELECT' && S.imp) S.imp.rows[+el.dataset.ib.split(':')[0]].classId = el.value; });
const impSet = rows => { const I = S.imp; I.cls = $('#imp-cls')?.value || I.cls; rows.forEach(r => r.classId ||= I.cls); I.rows.push(...rows); I.status = rows.length ? `تمت قراءة ${rows.length} اسم، راجعها ثم اضغط إنشاء الحسابات` : 'لم أتعرف على أسماء، جرّب طريقة أخرى'; impRender(); };
A.impParse = () => impSet(parseRoster($('#imp-txt').value, $('#imp-cls').value));
A.impFile = async el => {
  const f = el.files[0]; if (!f) return; $('#imp-st').textContent = 'جارٍ قراءة الملف…';
  try {
    if (/\.csv$/i.test(f.name)) return impSet(parseRoster(await f.text()));
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    const wb = XLSX.read(await f.arrayBuffer()); const ws = wb.Sheets[wb.SheetNames[0]];
    impSet(parseRoster(XLSX.utils.sheet_to_csv(ws, { FS: '\t', blankrows: false })));
  } catch (e) { $('#imp-st').textContent = 'تعذرت قراءة الملف: ' + e.message; }
};
A.impImg = async el => {
  const f = el.files[0]; if (!f) return; const st = $('#imp-st'); st.textContent = 'جارٍ تجهيز الصورة…';
  try {
    const img = await resizeImg(f, 1800);
    S.ai ||= isAdmin() ? await DB.get('settings', 'ai').catch(() => null) : null;
    if (S.ai?.key) {
      st.textContent = 'يقرأ الذكاء الاصطناعي الأسماء…';
      const r = await gemini(`هذه صورة قائمة طلاب. استخرج كل اسم طالب كما هو مكتوب بالعربية، ورقم الطالب أو الهوية إن وجد، والفصل إن كان مكتوبًا بجانب الاسم. تجاهل العناوين والترقيم والتواقيع. أعد JSON فقط: {"students":[{"name":"...","number":"...","className":"..."}]}`, img);
      impSet((r.students || []).map(x => ({ name: String(x.name || '').trim(), no: latinDigits(x.number || '').replace(/\D/g, ''), classId: S.classes.find(c => x.className && normAr(c.name).includes(normAr(x.className)))?.id || '', ok: true })).filter(x => x.name.length > 2));
    } else {
      st.textContent = 'تحميل قارئ النصوص (أول مرة قد يستغرق دقيقة)…';
      await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');
      const res = await Tesseract.recognize(img, 'ara+eng', { logger: m => { if (m.status === 'recognizing text') st.textContent = `جارٍ قراءة الصورة ${Math.round(m.progress * 100)}%`; } });
      impSet(parseRoster(res.data.text));
    }
  } catch (e) { st.textContent = 'تعذرت قراءة الصورة: ' + e.message; }
};
A.impCreate = async () => {
  const I = S.imp; const existing = new Set(students().map(u => u.studentNo).filter(Boolean));
  const todo = I.rows.filter(r => r.ok && !r.done && r.name.trim().length > 2 && !(r.no && existing.has(r.no)));
  if (!todo.length) return toast('لا يوجد طلاب للإضافة');
  I.busy = true; let n = 0;
  for (const r of todo) {
    $('#imp-st').textContent = `جارٍ إنشاء الحسابات ${++n} من ${todo.length}…`;
    const no = r.no || String(Math.floor(1e6 + Math.random() * 9e6)); const pass = genPass();
    try {
      const uid = await AUTH.createUser(no + '@' + STU_DOMAIN, pass);
      await DB.set('users', uid, { name: r.name.trim(), email: no + '@' + STU_DOMAIN, role: 'student', classId: r.classId || I.cls, studentNo: no, active: true, createdAt: now(), createdByTeacher: true });
      await DB.set('creds', uid, { no, pass, name: r.name.trim(), classId: r.classId || I.cls, createdAt: now() });
      r.no = no; r.done = true; r.err = '';
    } catch (e) { console.error(e); r.err = e.code === 'auth/email-already-in-use' ? 'الرقم مستخدم لحساب آخر' : e.code === 'auth/too-many-requests' ? 'تجاوز الحد، أكمل بعد ساعة' : e.code === 'permission-denied' ? 'حدّث قواعد Firestore' : 'تعذر'; if (e.code === 'auth/too-many-requests') break; }
  }
  I.busy = false; const ok = todo.filter(r => r.done).length; I.status = `تم إنشاء ${ok} حساب${todo.length - ok ? `، وتعذر ${todo.length - ok}` : ''}. اطبع بطاقات الدخول من صفحة الطلاب.`;
  await reload(); impRender();
};

VIEWS.cards = () => {
  const c = S.p.c || ''; const list = students().filter(u => S.creds?.[u.id] && (!c || u.classId === c)).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  const url = location.origin.startsWith('http') ? location.origin : '';
  return `<div class="top noprint"><button class="btn ghost" data-a="nav" data-v="students">${ico('back')} رجوع</button><div class="row"><select class="in" style="width:auto" data-c="cardsCls"><option value="">كل الفصول</option>${myClasses().map(x => `<option value="${x.id}" ${x.id === c ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>${prBtn}</div></div>
  <h1 class="noprint" style="margin-bottom:6px">بطاقات الدخول</h1><p class="muted noprint" style="margin-bottom:16px">${list.length} بطاقة. اطبعها وقصّها ووزعها على الطلاب</p>
  ${list.length ? `<div class="lcards">${list.map(u => { const k = S.creds[u.id]; return `<div class="lcard"><div class="row sp"><b class="ruqa">منصة لغتي</b><span class="small">${esc(clsName(u.classId))}</span></div><div class="nm">${esc(u.name)}</div><div class="kv"><span>رقم الدخول</span><b dir="ltr">${esc(k.no)}</b></div><div class="kv"><span>كلمة المرور</span><b dir="ltr">${esc(k.pass)}</b></div>${url ? `<div class="small" dir="ltr" style="text-align:center;opacity:.8">${esc(url)}</div>` : ''}</div>`; }).join('')}</div>` : empty('لا توجد بطاقات. أضف الطلاب من زر «إضافة طلاب» لتظهر بطاقاتهم هنا', 'users')}`;
};
A.cardsCls = el => go('cards', { c: el.value, from: 'students' });

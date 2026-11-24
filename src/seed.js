/* ---------------- demo data (preview mode only) ---------------- */
async function seedDemo() {
  if (LIVE || store.get('qz_demo_seeded', false)) return;
  const acc = {}; const mk = (e) => { const uid = rid(12); acc[e] = { uid, pass: 'demo123' }; return uid; };
  const admin = mk(ADMIN_EMAIL), huda = mk('huda@demo.sa');
  const C = [['c1', 'الصف الأول متوسط - أ'], ['c2', 'الصف الأول متوسط - ب'], ['c3', 'الصف الثاني متوسط - أ']];
  for (const [i, [id, name]] of C.entries()) await DB.set('classes', id, { name, order: i, createdAt: now() });
  await DB.set('settings', 'app', { platformName: 'سبورة', schoolName: 'المتوسطة الأولى بالدمام', teacherName: 'أ. نورة' });
  await DB.set('users', admin, { name: 'أ. نورة', email: ADMIN_EMAIL, role: 'admin', active: true, createdAt: now() });
  await DB.set('users', huda, { name: 'أ. هدى العتيبي', email: 'huda@demo.sa', role: 'delegate', delegateClasses: ['c2'], active: true, createdAt: now() });
  const names = [['sara', 'سارة الدوسري', 'c1', .95], ['lama', 'لمى القحطاني', 'c1', .82], ['reem', 'ريم الشمري', 'c1', .58], ['joud', 'جود المطيري', 'c1', .74], ['hala', 'هلا الزهراني', 'c2', .9], ['maha', 'مها العنزي', 'c2', .45], ['dana', 'دانة الحربي', 'c2', .68], ['raghad', 'رغد الغامدي', 'c3', .87], ['nouf', 'نوف السبيعي', 'c3', .62]];
  const U = {};
  for (const [e, n, c, lv] of names) { const uid = mk(e + '@demo.sa'); U[e] = { uid, n, c, lv }; await DB.set('users', uid, { name: n, email: e + '@demo.sa', role: 'student', classId: c, studentNo: String(1000 + Object.keys(U).length), active: true, createdAt: now() - 864e5 * 20 }); }
  mk('pending@demo.sa');
  await DB.set('users', acc['pending@demo.sa'].uid, { name: 'أ. أمل الخالدي', email: 'pending@demo.sa', role: 'pending_delegate', active: true, createdAt: now() });
  store.set('qz_demo_acc', acc);
  for (const t of DEFAULT_TEMPLATES) await DB.add('templates', { ...t, createdAt: now() });

  const mq = (type, o) => Object.assign(newQ(type), o);
  const Q1 = [
    mq('mcq', { text: 'ما عاصمة المملكة العربية السعودية؟', tag: 'الجغرافيا', choices: [{ id: 'a', t: 'جدة', ok: false }, { id: 'b', t: 'الرياض', ok: true }, { id: 'c', t: 'الدمام', ok: false }, { id: 'd', t: 'مكة المكرمة', ok: false }] }),
    mq('tf', { text: 'يقع الخليج العربي في شرق المملكة.', tag: 'الجغرافيا', correct: 'true' }),
    mq('short', { text: 'ما اسم أكبر صحراء رملية متصلة في المملكة؟', tag: 'الجغرافيا', points: 2, accepted: ['الربع الخالي'] }),
    mq('multi', { text: 'اختر المدن الساحلية:', tag: 'الجغرافيا', points: 2, choices: [{ id: 'a', t: 'جدة', ok: true }, { id: 'b', t: 'الدمام', ok: true }, { id: 'c', t: 'بريدة', ok: false }, { id: 'd', t: 'ينبع', ok: true }] }),
    mq('match', { text: 'صِل كل منطقة بمدينتها:', tag: 'المناطق', points: 3, pairs: [{ id: 'p1', l: 'المنطقة الشرقية', r: 'الدمام' }, { id: 'p2', l: 'منطقة القصيم', r: 'بريدة' }, { id: 'p3', l: 'منطقة عسير', r: 'أبها' }], extra: ['تبوك'] }),
    mq('fill', { text: 'توحدت المملكة على يد الملك [[عبدالعزيز|عبد العزيز]] عام [[1932|1351]]', tag: 'التاريخ', points: 2 }),
    mq('order', { text: 'رتّب المدن من الشمال إلى الجنوب:', tag: 'المناطق', points: 2, items: [{ id: 'o1', t: 'تبوك' }, { id: 'o2', t: 'المدينة المنورة' }, { id: 'o3', t: 'مكة المكرمة' }, { id: 'o4', t: 'جازان' }] }),
    mq('essay', { text: 'اكتب فقرة قصيرة عن أهمية رؤية المملكة 2030.', tag: 'التعبير', points: 5, model: 'تهدف رؤية 2030 إلى تنويع الاقتصاد وتقليل الاعتماد على النفط وتطوير التعليم والسياحة وتمكين الشباب', keywords: ['تنويع الاقتصاد', 'النفط', 'السياحة', 'الشباب'] })
  ];
  const Q2 = [
    mq('numeric', { text: 'كم يساوي 12 × 4 ؟', tag: 'الضرب', value: 48 }),
    mq('numeric', { text: 'ما ناتج 3.5 + 1.25 ؟', tag: 'الكسور العشرية', value: 4.75, tol: .01 }),
    mq('mcq', { text: 'أي الأعداد التالية عدد أولي؟', tag: 'الأعداد', choices: [{ id: 'a', t: '9', ok: false }, { id: 'b', t: '15', ok: false }, { id: 'c', t: '13', ok: true }, { id: 'd', t: '21', ok: false }] }),
    mq('tf', { text: 'مجموع زوايا المثلث 360 درجة.', tag: 'الهندسة', correct: 'false' }),
    mq('short', { text: 'ماذا نسمي الشكل الرباعي الذي أضلاعه متساوية وزواياه قائمة؟', tag: 'الهندسة', accepted: ['المربع', 'مربع'] })
  ];
  const mkQuiz = async (id, title, qs, classIds, createdBy, createdByName, status, extra = {}) => { const parts = qs.map(splitQ); await DB.set('quizzes', id, { title, desc: '', classIds, duration: 20, dueAt: 0, resultsMode: 'instant', showAnswers: true, shuffle: false, questions: parts.map(p => p.pub), totalPoints: sum(parts.map(p => p.pub.points)), status, pubClasses: status === 'published' ? classIds : [], createdBy, createdByName, createdAt: now() - 864e5 * 9, publishedAt: now() - 864e5 * 9, released: false, ...extra }); await DB.set('quizKeys', id, { answers: Object.fromEntries(parts.map(p => [p.pub.id, p.key])) }); return parts; };
  const P1 = await mkQuiz('demoQ1', 'اختبار وطني الغالي', Q1, ['c1', 'c2', 'c3'], admin, 'أ. نورة', 'published');
  const P2 = await mkQuiz('demoQ2', 'مراجعة الرياضيات', Q2, ['c1', 'c3'], admin, 'أ. نورة', 'published', { createdAt: now() - 864e5 * 3, publishedAt: now() - 864e5 * 3 });
  await mkQuiz('demoQ3', 'اختبار قصير في العلوم', [mq('mcq', { text: 'ما الكوكب الأقرب إلى الشمس؟', tag: 'الفضاء', choices: [{ id: 'a', t: 'عطارد', ok: true }, { id: 'b', t: 'المريخ', ok: false }, { id: 'c', t: 'الأرض', ok: false }] }), mq('tf', { text: 'الماء يغلي عند 100 درجة مئوية عند مستوى سطح البحر.', tag: 'المادة', correct: 'true' })], ['c2'], huda, 'أ. هدى العتيبي', 'pending');
  // simulate answers
  const shortAlt = { 'الربع الخالي': ['الربع الخالى', 'ربع الخالي', 'صحراء الربع', 'النفود', 'الربع الخالي'] };
  const answerFor = (p, lv, r) => {
    const k = p.key, q = p.pub, ok = r() < lv;
    switch (q.type) {
      case 'mcq': return ok ? k.correct : q.choices.find(c => c.id !== k.correct).id;
      case 'tf': return ok ? k.correct : (k.correct === 'true' ? 'false' : 'true');
      case 'multi': return ok ? k.correct : k.correct.slice(0, 1).concat(['c']);
      case 'short': return ok ? (r() < .6 ? k.accepted[0] : (shortAlt[k.accepted[0]] || k.accepted)[Math.floor(r() * 3)]) : (shortAlt[k.accepted[0]] || ['لا أعرف'])[3] || 'مستطيل';
      case 'match': return Object.fromEntries(Object.entries(k.pairs).map(([l, rr], i) => [l, ok || i ? rr : q.right[0].id]));
      case 'fill': return ok ? k.blanks.map(b => b[0]) : [k.blanks[0][0], '1940'];
      case 'order': return ok ? k.order : [k.order[1], k.order[0], ...k.order.slice(2)];
      case 'numeric': return ok ? String(k.value) : String(k.value + 2);
      case 'essay': return lv > .8 ? 'رؤية 2030 مهمة لأنها تنوع الاقتصاد وتقلل الاعتماد على النفط وتهتم بالسياحة وتمكين الشباب' : 'الرؤية مهمة للوطن وتطوره في المستقبل';
    }
  };
  let seed = 7; const r = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (const [qid, P, cl, days] of [['demoQ1', P1, ['c1', 'c2', 'c3'], 8], ['demoQ2', P2, ['c1', 'c3'], 2]]) {
    for (const [key, s] of Object.entries(U)) {
      if (!cl.includes(s.c) || (qid === 'demoQ2' && key === 'joud')) continue;
      const lv = qid === 'demoQ2' && key === 'reem' ? .8 : s.lv;
      const answers = Object.fromEntries(P.map(p => [p.pub.id, answerFor(p, lv, r)]));
      const t = now() - 864e5 * days + Math.floor(r() * 7e6);
      await DB.set('submissions', qid + '_' + s.uid, { quizId: qid, uid: s.uid, name: s.n, classId: s.c, ownerId: admin, answers, startedAt: t - 9e5, submittedAt: t, timeSpent: 400 + Math.floor(r() * 700) });
    }
  }
  // a reviewed essay for sara
  const essayId = P1[7].pub.id; await DB.set('reviews', 'demoQ1_' + U.sara.uid, { quizId: 'demoQ1', uid: U.sara.uid, overrides: { [essayId]: { points: 5, note: 'فقرة رائعة ومكتملة', by: admin, at: now() } }, reviewedAt: now() });
  const M = (o) => DB.add('messages', { kind: 'msg', readBy: [], createdAt: now() - 36e5 * (2 + Math.floor(r() * 40)), ...o });
  await M({ from: admin, fromName: 'أ. نورة', to: 'all', toName: 'كل الطلاب', subject: 'مرحبًا بكم في منصة سبورة', body: 'أهلًا بكم جميعًا. ستجدون هنا الاختبارات والنتائج ورسائلي لكم. بالتوفيق!' });
  await M({ from: admin, fromName: 'أ. نورة', to: 'class:c1', toName: C[0][1], subject: 'اختبار الرياضيات', body: 'تم نشر مراجعة الرياضيات، أتمنى لكم التوفيق.' });
  await M({ from: U.lama.uid, fromName: 'لمى القحطاني', to: 'admin', toName: 'المعلم', subject: 'سؤال عن الاختبار القادم', body: 'أستاذة، هل يشمل الاختبار القادم درس الخرائط؟' });
  const t0 = DEFAULT_TEMPLATES[0]; const su = { name: U.sara.n, classId: 'c1' };
  await DB.add('messages', { from: admin, fromName: 'أ. نورة', to: U.sara.uid, toName: U.sara.n, kind: 'cert', subject: t0.heading, body: '', cert: { theme: t0.theme, emblem: t0.emblem, heading: t0.heading, body: fillVars(t0.body, { 'الاختبار': 'اختبار وطني الغالي', 'الدرجة': 'الدرجة الكاملة' }), name: su.name, className: C[0][1], teacher: 'أ. نورة', school: 'المتوسطة الأولى بالدمام', date: fmtDate(now()) }, createdAt: now() - 36e5, readBy: [] });
  store.set('qz_demo_seeded', true);
}

/* ---------------- start ---------------- */
if (store.get('qz_theme', '')) document.documentElement.dataset.theme = store.get('qz_theme', '');
boot();

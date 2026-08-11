/* ============================================================
   成绩统计（专业成绩 + 文化课成绩 / 走势分析）
   教师：完整管理；学生 / 家长：查看自己的成绩
   ============================================================ */
Views.grades = {
  title: '成绩统计',
  render: function (ctx) {
    var role = ctx.user.role;
    if (role === 'teacher') return teacherGrades(ctx);
    return ownGrades(ctx);
  },
  mount: function (ctx) {
    if (ctx.user.role === 'teacher') mountTeacherGrades(ctx);
    else mountOwnGrades(ctx);
  }
};

/* ---------- 专业成绩统计辅助 ---------- */
function proGradeDistribution() {
  var graded = Store.queryRecords({ status: 'reviewed' });
  var byGrade = { A: 0, B: 0, C: 0, D: 0 };
  graded.forEach(function (r) { if (byGrade[r.grade] !== undefined) byGrade[r.grade]++; });
  return { graded: graded, byGrade: byGrade };
}
function proSubjectProgress() {
  return Store.SUBJECTS.map(function (s) {
    var rs = Store.queryRecords({ subject: s.key });
    var sum = Store.summarize(rs);
    return { sub: s, avg: sum.avgProgress, pieces: sum.pieces, graded: sum.graded };
  });
}
function proStudentRows() {
  return Store.allStudents().map(function (st) {
    var rs = Store.queryRecords({ studentId: st.id });
    var sum = Store.summarize(rs);
    return { st: st, sum: sum };
  }).sort(function (a, b) { return (b.sum.avgScore || 0) - (a.sum.avgScore || 0); });
}

/* ================================================== 教师端 */
function teacherGrades(ctx) {
  var tab = App.query().tab || 'pro';
  var tabs =
    '<div class="tabs">' +
      '<div class="tab' + (tab === 'pro' ? ' on' : '') + '" data-gtab="pro">🎨 专业成绩</div>' +
      '<div class="tab' + (tab === 'culture' ? ' on' : '') + '" data-gtab="culture">📚 文化课成绩</div>' +
    '</div>';

  var head = '<div class="row wrap" style="margin-bottom:14px"><div><h2 style="font-size:20px">成绩统计</h2>' +
    '<div class="small muted">专业成绩（色彩 / 素描 / 速写）与文化课成绩（含走势分析）一目了然</div></div></div>';

  return head + tabs + (tab === 'pro' ? teacherPro() : teacherCulture());
}

function teacherPro() {
  var profExams = Store.profExams();
  var pexam = App.query().pexam || (profExams.length ? profExams[0].name : '');

  var dist = proGradeDistribution();
  var rows = proStudentRows();
  var pgAll = pexam ? Store.profGrades({ examName: pexam }) : Store.profGrades();
  var pg = Store.profGradeTable(pexam);

  // 评级分布：优先用教师“专业成绩”录入（按场次）；无录入则回退到作业批改
  var distItems, distCenter, distEmpty, distSub;
  if (pgAll.length) {
    var byGrade = { A: 0, B: 0, C: 0, D: 0 };
    var graded = 0;
    pgAll.forEach(function (c) { if (c.grade && byGrade[c.grade] !== undefined) { byGrade[c.grade]++; graded++; } });
    distItems = Store.GRADES.map(function (g) { return { label: g + ' · ' + Store.GRADE_TEXT[g], value: byGrade[g], color: Store.GRADE_COLOR[g] }; });
    distCenter = graded; distSub = pexam ? (pexam + ' · 已评定') : '已评定'; distEmpty = !graded;
  } else {
    distItems = Store.GRADES.map(function (g) { return { label: g + ' · ' + Store.GRADE_TEXT[g], value: dist.byGrade[g], color: Store.GRADE_COLOR[g] }; });
    distCenter = dist.graded; distSub = '已评'; distEmpty = !dist.graded;
  }

  var distCard =
    '<div class="card"><div class="card-head"><h3>专业评级分布</h3><div class="spacer"></div><span class="hint">' + distSub + '</span></div><div class="card-pad">' +
      (distEmpty ? UI.empty('暂无评级', '在下方「专业成绩录入」中点评级，或批改作业后自动汇总', '⭐') :
        Charts.donut({ items: distItems, centerValue: distCenter, centerLabel: distSub })) + '</div></div>';

  // 各科平均专业成绩（按分数，分场次）
  var subjAvg = Store.SUBJECTS.map(function (s) {
    var list = pexam ? Store.profGrades({ examName: pexam, subject: s.key }) : Store.profGrades({ subject: s.key });
    var scored = list.filter(function (c) { return c.score != null; });
    return { sub: s, avg: scored.length ? Math.round(scored.reduce(function (a, c) { return a + c.score; }, 0) / scored.length) : 0 };
  });
  var subjCard =
    '<div class="card"><div class="card-head"><h3>各科平均专业成绩' + (pexam ? '（' + UI.esc(pexam) + '）' : '') + '</h3><div class="spacer"></div><span class="hint">单位：分</span></div><div class="card-pad">' +
      Charts.bar({
        labels: subjAvg.map(function (x) { return x.sub.name; }),
        series: [{ name: '平均专业分', color: '#5A4FCF', data: subjAvg.map(function (x) { return x.avg; }) }],
        height: 220
      }) + '</div></div>';

  // 专业考试场次选择 + 操作
  var sessionBar =
    '<div class="row wrap" style="gap:10px;align-items:center;margin-bottom:14px">' +
      '<span class="small muted">考试场次</span>' +
      '<select class="select sm" id="profExamSel" style="max-width:200px">' +
      (profExams.length ? profExams.map(function (e) { return '<option value="' + UI.esc(e.name) + '"' + (e.name === pexam ? ' selected' : '') + '>' + UI.esc(e.name) + '（' + Store.mmdd(e.date) + '）</option>'; }).join('') : '<option value="">（暂无场次）</option>') +
      '</select>' +
      '<button class="btn sm" id="newProfExam">＋ 新建考试</button>' +
      '<button class="btn sm soft" id="addProf">＋ 录入专业成绩</button>' +
      '<button class="btn sm ghost" id="editProf">编辑本次</button>' +
      '<button class="btn sm ghost" id="importProf">📥 导入成绩</button>' +
    '</div>';

  // 专业成绩录入表（student × subject，每科含考试成绩与小测成绩：等级 + 分数），按所选场次
  var headCells = Store.SUBJECTS.map(function (s) { return '<th>' + s.icon + ' ' + s.name + '</th>'; }).join('');
  var bodyRows = pg.students.length ? pg.students.map(function (st) {
    var sgm = pg.map[st.id] || {};
    var cells = Store.SUBJECTS.map(function (s) {
      var cell = sgm[s.key] || { exam: null, quiz: null };
      var html = '';
      if (cell.exam) html += '考 ' + UI.gradeBadge(cell.exam.grade) + (cell.exam.score != null ? ' ' + cell.exam.score + '分' : '') + '<br>';
      if (cell.quiz) html += '测 ' + UI.gradeBadge(cell.quiz.grade) + (cell.quiz.score != null ? ' ' + cell.quiz.score + '分' : '');
      if (!html) html = '<span class="muted">—</span>';
      return '<td style="font-size:13px;line-height:1.5">' + html + '</td>';
    }).join('');
    return '<tr><td><div class="row" style="gap:8px">' + UI.avatar(st.name, st.color, 'sm') + '<b>' + UI.esc(st.name) + '</b></div></td>' +
      cells + '<td><button class="btn sm ghost" data-pg-sid="' + st.id + '">录入</button></td></tr>';
  }).join('') : '<tr><td colspan="' + (Store.SUBJECTS.length + 2) + '">暂无数据</td></tr>';

  var pgCard =
    '<div class="card section-gap"><div class="card-head"><h3>🎓 专业成绩录入（教师评定）</h3><div class="spacer"></div>' +
      (pexam ? '<span class="hint">场次：' + UI.esc(pexam) + '</span>' : '') + '</div>' +
      '<div class="small muted" style="padding:0 14px 10px">按学生 / 科目录入「考试成绩」与「小测成绩」，每类含等级(A/B/C/D)与分数；点「新建考试」可新增一场专业测评并独立统计。</div>' +
      '<div class="card-pad" style="padding:0"><table class="tbl"><thead><tr><th>学生</th>' + headCells + '<th>操作</th></tr></thead><tbody>' +
      bodyRows + '</tbody></table></div></div>';

  // 分场次走势分析（跨场次班级平均分）
  var trendCard =
    '<div class="card section-gap"><div class="card-head"><h3>📈 专业成绩走势分析（分场次）</h3><div class="spacer"></div>' +
      '<select class="select sm" id="profTrendSubj">' + Store.SUBJECTS.map(function (s) { return '<option value="' + s.key + '">' + s.icon + ' ' + s.name + '</option>'; }).join('') + '</select>' +
      '<select class="select sm" id="profTrendType" style="margin-left:6px">' +
        '<option value="all">考试+小测</option><option value="exam">仅考试</option><option value="quiz">仅小测</option></select></div>' +
      '<div class="card-pad"><div id="profTrendChart"></div></div></div>';

  var table = '<div class="card section-gap"><div class="card-head"><h3>学生作业完成情况</h3><div class="spacer"></div>' +
    '<span class="badge">按平均评级排序</span></div><div class="card-pad" style="padding:0">' +
    '<table class="tbl"><thead><tr><th>学生</th><th>平均评级</th><th>平均完成度</th><th>累计张数</th><th>已评次数</th></tr></thead><tbody>' +
    (rows.length ? rows.map(function (r) {
      return '<tr>' +
        '<td><div class="row" style="gap:8px">' + UI.avatar(r.st.name, r.st.color, 'sm') + '<b>' + UI.esc(r.st.name) + '</b></div></td>' +
        '<td>' + (r.sum.avgGrade ? UI.gradeBadge(r.sum.avgGrade) : '–') + '</td>' +
        '<td>' + (r.sum.graded ? r.sum.avgProgress + '%' : '–') + '</td>' +
        '<td><b>' + r.sum.pieces + '</b> 张</td>' +
        '<td>' + r.sum.graded + ' 次</td></tr>';
    }).join('') : '<tr><td colspan="5">暂无数据</td></tr>') +
    '</tbody></table></div></div>';

  return sessionBar + '<div class="grid g-2 section-gap">' + distCard + subjCard + '</div>' + pgCard + trendCard + table;
}

function teacherCulture() {
  var exams = Store.cultureExams();
  var examName = App.query().exam || (exams.length ? exams[0].name : '');

  // 走势分析控件
  var subjSel = Store.CULTURE_SUBJECTS.map(function (s) {
    return '<option value="' + s + '">' + s + '</option>';
  }).join('');
  var stuSel = '<option value="__class__">全班平均</option>' +
    Store.allStudents().map(function (st) { return '<option value="' + st.id + '">' + UI.esc(st.name) + '</option>'; }).join('');

  var trendBlock =
    '<div class="card section-gap"><div class="card-head"><h3>📈 文化课成绩走势分析</h3></div><div class="card-pad">' +
      '<div class="row wrap" style="gap:12px;margin-bottom:12px">' +
        '<div class="field" style="margin:0;min-width:140px"><label>科目</label><select class="select" id="trendSubj">' + subjSel + '</select></div>' +
        '<div class="field" style="margin:0;min-width:160px"><label>学生</label><select class="select" id="trendStu">' + stuSel + '</select></div>' +
      '</div>' +
      '<div id="trendChart"></div>' +
    '</div></div>';

  var tableBlock;
  if (!exams.length) {
    tableBlock =
      '<div class="card section-gap"><div class="card-head"><h3>📚 文化课成绩表</h3><div class="spacer"></div>' +
        '<button class="btn sm soft" id="addCulture">＋ 录入成绩</button>' +
        '<button class="btn sm ghost" id="importCulture">📥 导入成绩</button></div>' +
        '<div class="card-pad">' + UI.empty('还没有文化课成绩', '点击右上角「录入成绩」添加月考 / 期中考试成绩，可一次录入全班 9 科', '📚') + '</div></div>';
  } else {
    var t = Store.cultureExamTable(examName);
    var headCells = t.subjects.map(function (s) { return '<th>' + s + '<br><span class="small muted">均 ' + (t.avg[s] != null ? t.avg[s] : '–') + '</span></th>'; }).join('');
    var bodyRows = t.students.map(function (st) {
      var cells = t.subjects.map(function (s) {
        var c = t.map[st.id] && t.map[st.id][s];
        return '<td>' + (c ? c.score : '<span class="muted">—</span>') + '</td>';
      }).join('');
      return '<tr><td><div class="row" style="gap:8px">' + UI.avatar(st.name, st.color, 'sm') + '<b>' + UI.esc(st.name) + '</b></div></td>' + cells + '</tr>';
    }).join('');
    var avgCells = t.subjects.map(function (s) { return '<td><b>' + (t.avg[s] != null ? t.avg[s] : '–') + '</b></td>'; }).join('');
    tableBlock =
      '<div class="card section-gap"><div class="card-head"><h3>文化课成绩表</h3><div class="spacer"></div>' +
        '<select class="select sm" id="examSel" style="max-width:180px">' +
        exams.map(function (e) { return '<option value="' + UI.esc(e.name) + '"' + (e.name === examName ? ' selected' : '') + '>' + UI.esc(e.name) + '（' + e.date + '）</option>'; }).join('') +
        '</select>' +
        '<button class="btn sm soft" id="addCulture">＋ 录入成绩</button>' +
        '<button class="btn sm" id="newExam">＋ 新建考试</button>' +
        '<button class="btn sm ghost" id="editCulture">编辑本次</button>' +
        '<button class="btn sm ghost" id="importCulture">📥 导入成绩</button></div>' +
        '<div class="card-pad" style="padding:0"><table class="tbl"><thead><tr><th>学生</th>' + headCells + '</tr></thead><tbody>' +
        bodyRows + '<tr class="tbl-avg"><td>班级平均</td>' + avgCells + '</tr>' +
        '</tbody></table></div></div>';
  }

  return trendBlock + tableBlock;
}

function mountTeacherGrades(ctx) {
  UI.els('[data-gtab]').forEach(function (b) {
    b.onclick = function () { App.go('#/grades?tab=' + b.dataset.gtab); };
  });
  // 走势图渲染
  function renderTrend() {
    var box = UI.el('#trendChart');
    if (!box) return;
    var subj = UI.el('#trendSubj') ? UI.el('#trendSubj').value : Store.CULTURE_SUBJECTS[0];
    var stu = UI.el('#trendStu') ? UI.el('#trendStu').value : '__class__';
    var title = (stu === '__class__' ? '全班平均' : (Store.getStudent(stu) || {}).name) + ' · ' + subj;
    var data, labels;
    if (stu === '__class__') {
      var c = Store.classCultureTrend(subj);
      labels = c.labels; data = c.data;
    } else {
      var s = Store.studentCultureTrend(stu, subj);
      labels = s.labels; data = s.data;
    }
    box.innerHTML = '<div class="small muted" style="margin-bottom:6px">📊 ' + UI.esc(title) + '（历次考试）</div>' +
      (labels.length ? Charts.line({ labels: labels, data: data, max: 100, suffix: ' 分' }) : UI.empty('暂无成绩', '')) +
      '<div class="small muted" style="margin-top:6px">满分 100，纵轴为分数</div>';
  }
  UI.els('#trendSubj, #trendStu').forEach(function (s) { s.onchange = renderTrend; });
  renderTrend();

  var examSel = UI.el('#examSel');
  if (examSel) examSel.onchange = function () { App.go('#/grades?tab=culture&exam=' + encodeURIComponent(this.value)); };
  var addBtn = UI.el('#addCulture');
  if (addBtn) addBtn.onclick = function () { cultureScoreModal(null, 'new'); };
  var newBtn = UI.el('#newExam');
  if (newBtn) newBtn.onclick = function () { cultureScoreModal(null, 'new'); };
  var editBtn = UI.el('#editCulture');
  if (editBtn) editBtn.onclick = function () { cultureScoreModal(App.query().exam, 'edit'); };
  // 专业成绩录入
  UI.els('[data-pg-sid]').forEach(function (b) {
    b.onclick = function () { profGradeModal(b.dataset.pgSid, App.query().pexam ? 'edit' : 'new', App.query().pexam); };
  });
  function openProfFirst(mode, examName) {
    var st = Store.allStudents()[0];
    if (st) profGradeModal(st.id, mode, examName);
  }
  var addProf = UI.el('#addProf');
  if (addProf) addProf.onclick = function () { openProfFirst('new'); };
  var newProfExam = UI.el('#newProfExam');
  if (newProfExam) newProfExam.onclick = function () { openProfFirst('new'); };
  var editProf = UI.el('#editProf');
  if (editProf) editProf.onclick = function () { openProfFirst('edit', App.query().pexam); };
  // 专业成绩场次切换 + 走势图
  var profExamSel = UI.el('#profExamSel');
  if (profExamSel) profExamSel.onchange = function () { App.go('#/grades?tab=pro&pexam=' + encodeURIComponent(this.value)); };
  function renderProfTrend() {
    var box = UI.el('#profTrendChart');
    if (!box) return;
    var subj = UI.el('#profTrendSubj') ? UI.el('#profTrendSubj').value : Store.SUBJECTS[0].key;
    var type = UI.el('#profTrendType') ? UI.el('#profTrendType').value : 'all';
    var tr = Store.classProfTrend(subj, type);
    box.innerHTML = (tr.labels && tr.labels.length) ? Charts.line({ labels: tr.labels, data: tr.data, max: 100, suffix: ' 分' }) : UI.empty('暂无成绩', '');
  }
  UI.els('#profTrendSubj, #profTrendType').forEach(function (s) { s.onchange = renderProfTrend; });
  renderProfTrend();

  var impCulture = UI.el('#importCulture');
  if (impCulture) impCulture.onclick = function () { cultureImportModal(); };
  var impProf = UI.el('#importProf');
  if (impProf) impProf.onclick = function () { profImportModal(); };
}

/* ---------------- 表格文件导入（文化课 / 专业成绩） ---------------- */
function parseTableRows(text) {
  var raw = (text || '').replace(/\r/g, '').split('\n').filter(function (l) { return l.trim(); });
  return raw.map(function (l) {
    return l.replace(/，/g, ',').split(/\t|,/).map(function (c) { return c.trim(); });
  });
}
// 文化课：宽表(学生,语文,...,生物) 或 长表(学生,科目,分数)；返回 {count, unmatched}
// dry=true 时只统计不写入（用于导入前预览）
function importCultureRows(text, examName, examDate, dry) {
  var rows = parseTableRows(text);
  if (!rows.length) return { count: 0, unmatched: [] };
  var header = rows[0];
  var isWide = header.length > 2 &&
    (header[0] === '学生' || header[0] === '姓名' || header[0].toLowerCase() === 'name') &&
    header.slice(1).some(function (h) { return Store.CULTURE_SUBJECTS.indexOf(h) >= 0; });
  var count = 0, unmatched = [];
  if (isWide) {
    var subs = header.slice(1);
    rows.slice(1).forEach(function (r) {
      var name = r[0]; if (!name) return;
      var st = Store.getStudentByName(name);
      if (!st) { unmatched.push(name); return; }
      subs.forEach(function (sub, i) {
        var v = r[i + 1];
        if (v === '' || v == null || isNaN(+v)) return;
        if (!dry) {
          var ex = Store.cultureScores({ studentId: st.id, examName: examName, subject: sub });
          if (ex.length) Store.updateCultureScore(ex[0].id, { score: +v, examDate: examDate });
          else Store.addCultureScore({ studentId: st.id, examName: examName, examDate: examDate, subject: sub, score: +v, fullScore: 100 });
        }
        count++;
      });
    });
  } else {
    var start = (header[0] === '学生' || header[0] === '姓名') ? 1 : 0;
    rows.slice(start).forEach(function (r) {
      var name = r[0], sub = r[1], v = r[2];
      if (!name || !sub || v === '' || v == null || isNaN(+v)) return;
      var st = Store.getStudentByName(name);
      if (!st) { unmatched.push(name); return; }
      if (Store.CULTURE_SUBJECTS.indexOf(sub) < 0) { unmatched.push(name + '/' + sub); return; }
      if (!dry) {
        var ex = Store.cultureScores({ studentId: st.id, examName: examName, subject: sub });
        if (ex.length) Store.updateCultureScore(ex[0].id, { score: +v, examDate: examDate });
        else Store.addCultureScore({ studentId: st.id, examName: examName, examDate: examDate, subject: sub, score: +v, fullScore: 100 });
      }
      count++;
    });
  }
  return { count: count, unmatched: unmatched };
}
// 专业：长表(学生,科目,类型,等级,分数) 或 宽表(学生,色彩,素描,速写)
function importProfRows(text, examName, examDate, dry) {
  var rows = parseTableRows(text);
  if (!rows.length) return { count: 0, unmatched: [] };
  var header = rows[0];
  var isWide = header.length > 2 &&
    (header[0] === '学生' || header[0] === '姓名') &&
    header.slice(1).some(function (h) { return Store.subjectByLabel(h); });
  var count = 0, unmatched = [];
  function upsert(st, subKey, type, grade, score) {
    var g = grade;
    if (!g && score != null && !isNaN(score)) g = Store.scoreToLetter(+score);
    if (!dry) {
      var ex = Store.profGrades({ studentId: st.id, subject: subKey, type: type, examName: examName });
      if (ex.length) Store.updateProfGrade(ex[0].id, { examName: examName, examDate: examDate, grade: g, score: score == null ? null : +score });
      else Store.addProfGrade({ studentId: st.id, subject: subKey, type: type, examName: examName, examDate: examDate, grade: g, score: score == null ? null : +score, byName: (Store.currentUser() || {}).name || '教师' });
    }
    count++;
  }
  if (isWide) {
    var subs = header.slice(1);
    rows.slice(1).forEach(function (r) {
      var name = r[0]; if (!name) return;
      var st = Store.getStudentByName(name);
      if (!st) { unmatched.push(name); return; }
      subs.forEach(function (h, i) {
        var subKey = Store.subjectByLabel(h), v = r[i + 1];
        if (!subKey || v === '' || v == null || isNaN(+v)) return;
        upsert(st, subKey, 'exam', '', +v);
      });
    });
  } else {
    var start = (header[0] === '学生' || header[0] === '姓名') ? 1 : 0;
    rows.slice(start).forEach(function (r) {
      var name = r[0], sub = r[1], typeRaw = r[2] || '', grade = (r[3] || '').trim(), scoreRaw = (r[4] || '').trim();
      if (!name || !sub) return;
      var st = Store.getStudentByName(name);
      if (!st) { unmatched.push(name); return; }
      var subKey = Store.subjectByLabel(sub);
      if (!subKey) { unmatched.push(name + '/' + sub); return; }
      var type = (typeRaw === '小测' || typeRaw.toLowerCase() === 'quiz') ? 'quiz' : 'exam';
      var gradeV = (grade && Store.GRADES.indexOf(grade) >= 0) ? grade : '';
      var scoreV = (scoreRaw === '' || isNaN(+scoreRaw)) ? null : +scoreRaw;
      if (!gradeV && scoreV == null) { unmatched.push(name + '/' + sub); return; }
      upsert(st, subKey, type, gradeV, scoreV);
    });
  }
  return { count: count, unmatched: unmatched };
}
function downloadText(filename, text) {
  var blob = new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); document.body.removeChild(a); }, 0);
}
function readFileAsText(file, cb) {
  var reader = new FileReader();
  reader.onload = function (e) { cb(e.target.result || ''); };
  reader.readAsText(file, 'utf-8');
}
function cultureImportModal() {
  var exams = Store.cultureExams();
  var examName = exams.length ? exams[0].name : '';
  var examDate = exams.length ? exams[0].date : Store.todayStr();
  var tmpl = '学生,语文,数学,英语,政治,历史,地理,物理,化学,生物\n张三,88,92,85,76,80,79,90,84,82\n李四,77,81,73,68,72,70,85,80,78';
  var body =
    '<div class="field"><label>考试名称</label><input class="input" id="impExam" value="' + UI.esc(examName) + '" placeholder="如：8月月考"></div>' +
    '<div class="field"><label>考试日期</label><input class="input" type="date" id="impDate" value="' + examDate + '"></div>' +
    '<div class="small muted" style="margin-bottom:8px">支持两种表格格式（首行可省略，自动识别）：<br>① 宽表：<code>学生,语文,数学,…,生物</code>（每行一名学生、各列一门课分数）<br>② 长表：<code>学生,科目,分数</code>（每行为一条成绩）<br>可用 Excel / WPS 复制粘贴，或上传 .csv 文件。相同「学生+场次+科目」会覆盖更新。</div>' +
    '<div class="row wrap" style="gap:8px;margin-bottom:8px">' +
      '<button class="btn sm ghost" id="impTpl">下载模板</button>' +
      '<label class="btn sm ghost" style="cursor:pointer;margin:0">上传文件<input type="file" id="impFile" accept=".csv,.txt" style="display:none"></label>' +
    '</div>' +
    '<textarea class="input" id="impText" rows="6" placeholder="在此粘贴表格内容，或上传文件…"></textarea>' +
    '<div id="impPreview" class="small muted" style="margin-top:8px"></div>';
  UI.modal({
    title: '导入文化课成绩', okText: '解析并导入',
    body: body,
    onMount: function (m) {
      UI.el('#impTpl', m).onclick = function () { downloadText('文化课成绩导入模板.csv', tmpl); };
      UI.el('#impFile', m).onchange = function (e) {
        var f = e.target.files && e.target.files[0];
        if (f) readFileAsText(f, function (txt) { UI.el('#impText', m).value = txt; preview(); });
      };
      function preview() {
        var txt = UI.el('#impText', m).value;
        var name = UI.el('#impExam', m).value.trim();
        var date = UI.el('#impDate', m).value || Store.todayStr();
        if (!name) { UI.el('#impPreview', m).innerHTML = '请先填写考试名称'; return; }
        if (!txt.trim()) { UI.el('#impPreview', m).innerHTML = ''; return; }
        var res = importCultureRows(txt, name, date, true);
        UI.el('#impPreview', m).innerHTML = (res.count ? ('✅ 将导入/更新 <b>' + res.count + '</b> 条成绩') : '未解析到可导入的数据') +
          (res.unmatched.length ? '　<span style="color:var(--danger)">⚠ 未匹配：' + UI.esc(res.unmatched.slice(0, 8).join('、')) + (res.unmatched.length > 8 ? ' 等' : '') + '</span>' : '');
      }
      UI.el('#impText', m).oninput = preview;
    },
    onOk: function (m) {
      var name = UI.el('#impExam', m).value.trim();
      var date = UI.el('#impDate', m).value || Store.todayStr();
      if (!name) { UI.toast('请填写考试名称', 'err'); return false; }
      var txt = UI.el('#impText', m).value;
      if (!txt.trim()) { UI.toast('请粘贴或上传表格内容', 'err'); return false; }
      var res = importCultureRows(txt, name, date);
      if (!res.count) { UI.toast('没有解析到可导入的数据', 'err'); return false; }
      UI.toast('已导入 ' + res.count + ' 条文化课成绩' + (res.unmatched.length ? '（' + res.unmatched.length + ' 条未匹配）' : ''), 'ok');
      App.go('#/grades?tab=culture&exam=' + encodeURIComponent(name));
    }
  });
}
function profImportModal() {
  var exams = Store.profExams();
  var examName = exams.length ? exams[0].name : '';
  var examDate = exams.length ? exams[0].date : Store.todayStr();
  var tmpl = '学生,科目,类型,等级,分数\n张三,色彩,考试,A,95\n张三,色彩,小测,B,82\n李四,素描,考试,,88';
  var body =
    '<div class="field"><label>考试场次</label><input class="input" id="impExam" value="' + UI.esc(examName) + '" placeholder="如：9月专业测评"></div>' +
    '<div class="field"><label>考试日期</label><input class="input" type="date" id="impDate" value="' + examDate + '"></div>' +
    '<div class="small muted" style="margin-bottom:8px">支持两种表格格式（首行可省略，自动识别）：<br>① 长表：<code>学生,科目,类型,等级,分数</code>（类型填 考试/小测；等级 A/B/C/D 可空，留空按分数自动评级；分数可空）<br>② 宽表：<code>学生,色彩,素描,速写</code>（每列一个科目分数，按考试计）<br>可用 Excel / WPS 复制粘贴，或上传 .csv 文件。相同「学生+场次+科目+类型」会覆盖更新。</div>' +
    '<div class="row wrap" style="gap:8px;margin-bottom:8px">' +
      '<button class="btn sm ghost" id="impTpl">下载模板</button>' +
      '<label class="btn sm ghost" style="cursor:pointer;margin:0">上传文件<input type="file" id="impFile" accept=".csv,.txt" style="display:none"></label>' +
    '</div>' +
    '<textarea class="input" id="impText" rows="6" placeholder="在此粘贴表格内容，或上传文件…"></textarea>' +
    '<div id="impPreview" class="small muted" style="margin-top:8px"></div>';
  UI.modal({
    title: '导入专业成绩', okText: '解析并导入',
    body: body,
    onMount: function (m) {
      UI.el('#impTpl', m).onclick = function () { downloadText('专业成绩导入模板.csv', tmpl); };
      UI.el('#impFile', m).onchange = function (e) {
        var f = e.target.files && e.target.files[0];
        if (f) readFileAsText(f, function (txt) { UI.el('#impText', m).value = txt; preview(); });
      };
      function preview() {
        var txt = UI.el('#impText', m).value;
        var name = UI.el('#impExam', m).value.trim();
        var date = UI.el('#impDate', m).value || Store.todayStr();
        if (!name) { UI.el('#impPreview', m).innerHTML = '请先填写考试场次名称'; return; }
        if (!txt.trim()) { UI.el('#impPreview', m).innerHTML = ''; return; }
        var res = importProfRows(txt, name, date, true);
        UI.el('#impPreview', m).innerHTML = (res.count ? ('✅ 将导入/更新 <b>' + res.count + '</b> 条专业成绩') : '未解析到可导入的数据') +
          (res.unmatched.length ? '　<span style="color:var(--danger)">⚠ 未匹配：' + UI.esc(res.unmatched.slice(0, 8).join('、')) + (res.unmatched.length > 8 ? ' 等' : '') + '</span>' : '');
      }
      UI.el('#impText', m).oninput = preview;
    },
    onOk: function (m) {
      var name = UI.el('#impExam', m).value.trim();
      var date = UI.el('#impDate', m).value || Store.todayStr();
      if (!name) { UI.toast('请填写考试场次名称', 'err'); return false; }
      var txt = UI.el('#impText', m).value;
      if (!txt.trim()) { UI.toast('请粘贴或上传表格内容', 'err'); return false; }
      var res = importProfRows(txt, name, date);
      if (!res.count) { UI.toast('没有解析到可导入的数据', 'err'); return false; }
      UI.toast('已导入 ' + res.count + ' 条专业成绩' + (res.unmatched.length ? '（' + res.unmatched.length + ' 条未匹配）' : ''), 'ok');
      App.go('#/grades?tab=pro&pexam=' + encodeURIComponent(name));
    }
  });
}

/* 录入 / 编辑 专业成绩（按学生 × 科目，分考试成绩 / 小测成绩，每类含等级 + 分数）
   mode: 'new'  → 新建场次（空白场次名，保存时永远新增，绝不改动已有场次）
         'edit' → 编辑当前场次（可改名，更新既有记录） */
function profGradeModal(studentId, mode, examName) {
  var isNew = mode === 'new';
  var exams = Store.profExams();
  var st = Store.getStudent(studentId);
  if (!st) return;
  var curExam = isNew ? '' : (examName || (exams.length ? exams[0].name : ''));
  var curDate = isNew ? Store.todayStr() : (exams.length ? (exams.filter(function (e) { return e.name === curExam; })[0] || {}).date || Store.todayStr() : Store.todayStr());
  // 预填：仅 edit 模式读取该场次该生已有成绩；new 模式一律空白
  var bySub = {};
  if (!isNew) Store.profGrades({ studentId: studentId, examName: curExam }).forEach(function (c) {
    var b = bySub[c.subject] = bySub[c.subject] || { exam: null, quiz: null };
    b[c.type === 'quiz' ? 'quiz' : 'exam'] = c;
  });
  var students = Store.allStudents();
  var stuOpts = students.map(function (s) {
    return '<option value="' + s.id + '"' + (s.id === studentId ? ' selected' : '') + '>' + UI.esc(s.name) + '</option>';
  }).join('');
  function gradeSel(cur) {
    return '<option value="">— 不评定 —</option>' + Store.GRADES.map(function (g) {
      return '<option value="' + g + '"' + (cur === g ? ' selected' : '') + '>' + g + ' · ' + Store.GRADE_TEXT[g] + '</option>';
    }).join('');
  }
  function subRows(type) {
    return Store.SUBJECTS.map(function (s) {
      var cur = bySub[s.key] ? bySub[s.key][type] : null;
      return '<tr><td><b>' + s.icon + ' ' + s.name + '</b></td>' +
        '<td><select class="select sm" data-pg-grade="' + s.key + '_' + type + '">' + gradeSel(cur ? cur.grade : null) + '</select>' +
        '<input class="input sm" data-pg-score="' + s.key + '_' + type + '" type="number" min="0" max="100" placeholder="分数" style="width:74px;margin-left:6px" value="' + (cur && cur.score != null ? cur.score : '') + '"></td>' +
        '<td><input class="input sm" data-pg-comment="' + s.key + '_' + type + '" placeholder="评语（可选）" value="' + UI.esc(cur ? cur.comment || '' : '') + '"></td></tr>';
    }).join('');
  }
  var body = '' +
    '<div class="field"><label>学生</label><select class="select" id="pgStu">' + stuOpts + '</select></div>' +
    '<div class="field"><label>考试场次</label><input class="input" id="pgExam" value="' + UI.esc(curExam) + '" placeholder="如：9月专业测评 / 期中专业测评"></div>' +
    '<div class="field"><label>考试日期</label><input class="input" type="date" id="pgDate" value="' + curDate + '"></div>' +
    '<div class="small muted" style="margin:4px 0 8px">每科分别录入「考试成绩」与「小测成绩」，等级(A/B/C/D)与分数（0–100）可只填其一；留空「不评定」且无分数则视为未录入。</div>' +
    '<div style="overflow:auto"><table class="tbl"><thead><tr><th style="width:110px">科目</th><th style="width:200px">📝 考试成绩</th><th>评语</th></tr></thead><tbody>' + subRows('exam') + '</tbody></table></div>' +
    '<div style="overflow:auto;margin-top:10px"><table class="tbl"><thead><tr><th style="width:110px">科目</th><th style="width:200px">📋 小测成绩</th><th>评语</th></tr></thead><tbody>' + subRows('quiz') + '</tbody></table></div>';

  UI.modal({
    title: isNew ? '录入专业成绩（新建场次）' : (curExam ? '编辑专业成绩 · ' + curExam : '专业成绩录入'),
    okText: '保存',
    body: body,
    onMount: function (m) {
      var sel = UI.el('#pgStu', m);
      sel.onchange = function () {
        var en = UI.el('#pgExam', m).value;
        profGradeModal(sel.value, 'edit', en);
      };
    },
    onOk: function (m) {
      var sid = UI.el('#pgStu', m).value;
      var ename = (UI.el('#pgExam', m).value || '').trim();
      var edate = UI.el('#pgDate', m).value || Store.todayStr();
      var byName = (Store.currentUser() || {}).name || '教师';
      if (!ename) { UI.toast('请填写考试场次名称', 'err'); return false; }
      Store.SUBJECTS.forEach(function (s) {
        ['exam', 'quiz'].forEach(function (type) {
          var grade = UI.el('[data-pg-grade="' + s.key + '_' + type + '"]', m).value;
          var scoreRaw = (UI.el('[data-pg-score="' + s.key + '_' + type + '"]', m).value || '').trim();
          var score = scoreRaw === '' ? '' : scoreRaw;
          var comment = (UI.el('[data-pg-comment="' + s.key + '_' + type + '"]', m).value || '').trim();
          if (!grade && !score) { // 清空：删除该生该科该类型该场次
            var ex = bySub[s.key] ? bySub[s.key][type] : null;
            if (ex) Store.removeProfGrade(ex.id);
            return;
          }
          if (isNew) {
            Store.addProfGrade({ studentId: sid, subject: s.key, type: type, examName: ename, examDate: edate, grade: grade, score: score, comment: comment, byName: byName });
          } else {
            var ex2 = bySub[s.key] ? bySub[s.key][type] : null;
            if (ex2) Store.updateProfGrade(ex2.id, { examName: ename, examDate: edate, grade: grade, score: score, comment: comment, byName: byName });
            else Store.addProfGrade({ studentId: sid, subject: s.key, type: type, examName: ename, examDate: edate, grade: grade, score: score, comment: comment, byName: byName });
          }
        });
      });
      UI.toast(isNew ? '已新建场次并保存' : '专业成绩已保存', 'ok');
      App.go('#/grades?tab=pro&pexam=' + encodeURIComponent(ename));
    }
  });
}

/* 录入 / 编辑 文化课成绩弹窗
   mode: 'new'  → 新建考试（空白表单，保存时永远新增，绝不改动已有考试）
         'edit' → 编辑当前考试（可改名，更新既有记录） */
function cultureScoreModal(examName, mode) {
  var isNew = mode === 'new';
  var exams = Store.cultureExams();
  var students = Store.allStudents();
  var subjects = Store.CULTURE_SUBJECTS;
  var exam = isNew ? '' : (examName || (exams.length ? exams[0].name : ''));
  var examDate = isNew ? Store.todayStr() : (exams.length ? (exams.filter(function (e) { return e.name === exam; })[0] || {}).date || Store.todayStr() : Store.todayStr());
  // 预填：仅“编辑”模式读取该考试已有成绩；“新建”模式一律空白，避免误改旧考试
  var existMap = {};
  if (!isNew) Store.cultureScores({ examName: exam }).forEach(function (c) { (existMap[c.studentId] = existMap[c.studentId] || {})[c.subject] = c; });

  var rows = students.map(function (st) {
    var cells = subjects.map(function (sub) {
      var c = existMap[st.id] && existMap[st.id][sub];
      return '<td><input class="input sm cs-input" data-sid="' + st.id + '" data-sub="' + sub + '" type="number" min="0" max="100" value="' + (c ? c.score : '') + '" placeholder="–"></td>';
    }).join('');
    return '<tr><td><div class="row" style="gap:6px">' + UI.avatar(st.name, st.color, 'sm') + '<b>' + UI.esc(st.name) + '</b></div></td>' + cells + '</tr>';
  }).join('');

  var body = '' +
    '<div class="field"><label>考试名称</label><input class="input" id="csExam" value="' + UI.esc(exam) + '" placeholder="如：9月月考 / 期中考试"></div>' +
    '<div class="field"><label>考试日期</label><input class="input" type="date" id="csDate" value="' + examDate + '"></div>' +
    '<div style="overflow:auto"><table class="tbl"><thead><tr><th>学生</th>' +
      subjects.map(function (s) { return '<th>' + s + '</th>'; }).join('') + '</tr></thead><tbody>' + rows + '</tbody></table></div>';

  UI.modal({
    title: isNew ? '录入文化课成绩' : '编辑成绩 · ' + exam,
    okText: '保存',
    body: body,
    onOk: function (m) {
      var name = UI.el('#csExam', m).value.trim();
      var date = UI.el('#csDate', m).value || Store.todayStr();
      if (!name) { UI.toast('请填写考试名称', 'err'); return false; }
      UI.els('.cs-input', m).forEach(function (inp) {
        var v = inp.value.trim();
        if (v === '') return;
        var sid = inp.dataset.sid, sub = inp.dataset.sub;
        var existing = existMap[sid] && existMap[sid][sub];
        if (isNew) {
          // 新建：永远新增，不触碰任何已有考试
          Store.addCultureScore({ studentId: sid, examName: name, examDate: date, subject: sub, score: +v, fullScore: 100 });
        } else if (existing) {
          // 编辑：更新既有记录（可改名）
          Store.updateCultureScore(existing.id, { examName: name, examDate: date, subject: sub, score: +v, fullScore: 100 });
        } else {
          // 编辑模式下出现的新学生，补录
          Store.addCultureScore({ studentId: sid, examName: name, examDate: date, subject: sub, score: +v, fullScore: 100 });
        }
      });
      UI.toast(isNew ? '已新建考试并保存' : '成绩已保存', 'ok');
      App.go('#/grades?tab=culture&exam=' + encodeURIComponent(name));
    }
  });
}

/* ================================================== 学生 / 家长端（查看自己的成绩） */
function ownGrades(ctx) {
  var sid = ctx.user.studentId;
  var st = Store.getStudent(sid);
  if (!st) return UI.empty('未绑定学生', '');

  var dist = Store.queryRecords({ studentId: sid });
  var sum = Store.summarize(dist);
  var subjProg = Store.SUBJECTS.map(function (s) {
    var rs = Store.queryRecords({ studentId: sid, subject: s.key });
    return { sub: s, sum: Store.summarize(rs) };
  });

  var proCard =
    '<div class="grid g-2 section-gap">' +
      '<div class="card"><div class="card-head"><h3>我的专业评级分布</h3></div><div class="card-pad">' +
        (sum.graded ? Charts.donut({
          items: Store.GRADES.map(function (g) { return { label: g, value: sum.byGrade[g], color: Store.GRADE_COLOR[g] }; }),
          centerValue: sum.avgGrade || '–', centerLabel: '平均'
        }) : UI.empty('暂无评级', '')) + '</div></div>' +
      '<div class="card"><div class="card-head"><h3>各科完成度</h3><div class="spacer"></div><span class="hint">%</span></div><div class="card-pad">' +
        Charts.bar({
          labels: subjProg.map(function (x) { return x.sub.name; }),
          series: [{ name: '完成度', color: '#5A4FCF', data: subjProg.map(function (x) { return x.sum.avgProgress; }) }],
          height: 220
        }) + '</div></div>' +
    '</div>';

  // 教师录入的专业成绩（我的）：按考试场次分，含等级 + 分数
  var myExams = Store.profExams();
  var myExam = App.query().pexam || (myExams.length ? myExams[myExams.length - 1].name : '');
  var myPg = myExam ? Store.profGrades({ studentId: sid, examName: myExam }) : Store.profGrades({ studentId: sid });
  var proGradeCard;
  if (!myPg.length) {
    proGradeCard = '<div class="card section-gap">' + UI.empty('暂无专业成绩', '老师会在「专业成绩录入」中为你评定', '🎓') + '</div>';
  } else {
    function pgCell(c) {
      if (!c) return '<span class="muted">—</span>';
      return UI.gradeBadge(c.grade) + (c.score != null ? '　' + c.score + '分' : '') + (c.comment ? '<br><span class="small muted">' + UI.esc(c.comment) + '</span>' : '');
    }
    var bySub = {};
    myPg.forEach(function (c) {
      var b = bySub[c.subject] = bySub[c.subject] || { exam: null, quiz: null };
      b[c.type === 'quiz' ? 'quiz' : 'exam'] = c;
    });
    var pgRow = Store.SUBJECTS.map(function (s) {
      var cell = bySub[s.key] || { exam: null, quiz: null };
      return '<tr><td><b>' + s.icon + ' ' + s.name + '</b></td>' +
        '<td style="font-size:13px;line-height:1.5">' + pgCell(cell.exam) + '</td>' +
        '<td style="font-size:13px;line-height:1.5">' + pgCell(cell.quiz) + '</td></tr>';
    }).join('');
    var examSel = myExams.length ? '<select class="select sm" id="ownProfExam">' + myExams.map(function (e) {
      return '<option value="' + UI.esc(e.name) + '"' + (e.name === myExam ? ' selected' : '') + '>' + UI.esc(e.name) + '</option>';
    }).join('') + '</select>' : '';
    proGradeCard = '<div class="card section-gap"><div class="card-head"><h3>🎓 我的专业成绩（老师评定）</h3><div class="spacer"></div>' + examSel + '</div>' +
      '<div class="small muted" style="padding:0 14px 10px">每科含考试 / 小测成绩与等级</div>' +
      '<div class="card-pad" style="padding:0"><table class="tbl"><thead><tr><th>科目</th><th>📝 考试成绩</th><th>📋 小测成绩</th></tr></thead><tbody>' + pgRow + '</tbody></table></div></div>';
  }

  // 我的专业成绩走势（分场次）
  var myProfTrend = (myExams.length > 1) ? (
    '<div class="card section-gap"><div class="card-head"><h3>📈 我的专业成绩走势（分场次）</h3><div class="spacer"></div>' +
      '<select class="select sm" id="ownProfTrendSubj">' + Store.SUBJECTS.map(function (s) { return '<option value="' + s.key + '">' + s.icon + ' ' + s.name + '</option>'; }).join('') + '</select></div>' +
      '<div class="card-pad"><div id="ownProfTrendChart"></div></div></div>'
  ) : '';

  // 文化课：科目(行) × 考试(列)
  var exams = Store.cultureExams();
  var cultureBlock;
  if (!exams.length) {
    cultureBlock = '<div class="card section-gap">' + UI.empty('暂无文化课成绩', '老师录入后会显示在这里', '📚') + '</div>';
  } else {
    // 仅显示学生自选的文化课科目
    var myCult = Store.studentCultureSubjects(sid);
    var rows = myCult.map(function (sub) {
      var cells = exams.map(function (e) {
        var list = Store.cultureScores({ studentId: sid, examName: e.name, subject: sub });
        return '<td>' + (list.length ? list[0].score : '—') + '</td>';
      }).join('');
      return '<tr><td><b>' + sub + '</b></td>' + cells + '</tr>';
    }).join('');
    var headCells = exams.map(function (e) { return '<th>' + UI.esc(e.name) + '<br><span class="small muted">' + Store.mmdd(e.date) + '</span></th>'; }).join('');

    // 走势：默认第一门自选科目
    var trendSubj = myCult[0] || Store.CULTURE_SUBJECTS[0];
    var tr = Store.studentCultureTrend(sid, trendSubj);

    cultureBlock =
      '<div class="card section-gap"><div class="card-head"><h3>📚 我的文化课成绩</h3><div class="spacer"></div>' +
        '<span class="hint">' + myCult.length + ' 门 · 在「我的」可调整</span></div>' +
        '<div class="card-pad" style="padding:0"><table class="tbl"><thead><tr><th>科目</th>' + headCells + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>' +
      '<div class="card section-gap"><div class="card-head"><h3>📈 文化课成绩走势</h3><div class="spacer"></div>' +
        '<select class="select sm" id="ownTrendSubj">' + myCult.map(function (s) {
          return '<option value="' + s + '"' + (s === trendSubj ? ' selected' : '') + '>' + s + '</option>';
        }).join('') + '</select></div>' +
        '<div class="card-pad"><div id="ownTrendChart"></div></div></div>';
  }

  // 总成绩走势（文化课 / 专业课）：家长首页点击进入后，直接就能看到这两张总走势
  function totalTrendChart(trend, title, color) {
    var labels = [], data = [];
    trend.labels.forEach(function (l, i) { if (trend.data[i] != null) { labels.push(l); data.push(trend.data[i]); } });
    return '<div class="card"><div class="card-head"><h3>' + title + '</h3></div><div class="card-pad">' +
      (labels.length ? Charts.line({ labels: labels, data: data, max: 100, suffix: ' 分' }) : UI.empty('暂无成绩', '', '📊')) + '</div></div>';
  }
  var cultTotal = Store.studentCultureTotalTrend(sid);
  var profTotal = Store.studentProfTotalTrend(sid);
  var totalSection = '<div class="grid g-2 section-gap">' +
    totalTrendChart(cultTotal, '📚 文化课总成绩走势', '#2563EB') +
    totalTrendChart(profTotal, '🎨 专业课总成绩走势', '#5A4FCF') +
    '</div>';

  return '<div class="row wrap" style="margin-bottom:14px"><div><h2 style="font-size:20px">我的成绩</h2>' +
    '<div class="small muted">专业成绩与文化课成绩成长轨迹</div></div></div>' +
    totalSection + proCard + proGradeCard + myProfTrend + cultureBlock;
}

function mountOwnGrades(ctx) {
  var sel = UI.el('#ownTrendSubj');
  function render() {
    var box = UI.el('#ownTrendChart');
    if (!box || !sel) return;
    var tr = Store.studentCultureTrend(ctx.user.studentId, sel.value);
    box.innerHTML = tr.labels.length ? Charts.line({ labels: tr.labels, data: tr.data, max: 100, suffix: ' 分' }) : UI.empty('暂无成绩', '');
  }
  if (sel) { sel.onchange = render; render(); }

  // 专业成绩场次切换
  var psel = UI.el('#ownProfExam');
  if (psel) psel.onchange = function () { App.go('#/grades?tab=pro&pexam=' + encodeURIComponent(this.value)); };

  // 我的专业成绩走势（分场次）
  function renderProf() {
    var box = UI.el('#ownProfTrendChart');
    if (!box) return;
    var subj = UI.el('#ownProfTrendSubj') ? UI.el('#ownProfTrendSubj').value : Store.SUBJECTS[0].key;
    var tr = Store.studentProfTrend(ctx.user.studentId, subj, 'all');
    box.innerHTML = (tr.labels && tr.labels.length) ? Charts.line({ labels: tr.labels, data: tr.data, max: 100, suffix: ' 分' }) : UI.empty('暂无成绩', '');
  }
  var psubj = UI.el('#ownProfTrendSubj');
  if (psubj) { psubj.onchange = renderProf; renderProf(); }
}

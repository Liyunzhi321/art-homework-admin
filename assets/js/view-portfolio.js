/* ============================================================
   作品集
   ============================================================ */
Views.portfolio = {
  title: '作品集',
  render: function (ctx) {
    var q = App.query();
    var role = ctx.user.role;
    var students = Store.allStudents();
    var sid = role === 'teacher' ? (q.student || (students[0] ? students[0].id : '')) : ctx.user.studentId;
    var st = Store.getStudent(sid);
    if (!st) return '<div class="card">' + UI.empty('暂无学生数据', '请先在学生管理中添加学生', '🎒') + '</div>';

    var subj = q.subject || '';
    var grade = q.grade || '';
    var recs = Store.queryRecords({ studentId: sid, subject: subj, grade: grade, hasImage: true });
    var items = [];
    recs.forEach(function (r) {
      (r.images || []).forEach(function (imgId, i) {
        items.push({ id: imgId, rec: r, idx: i });
      });
    });

    var all = Store.queryRecords({ studentId: sid });
    var sum = Store.summarize(all);

    var picker = role === 'teacher'
      ? '<select class="select" id="pfStudent" style="width:auto;min-width:190px;padding:8px 34px 8px 13px;border-radius:999px">' +
          students.map(function (s) {
            return '<option value="' + s.id + '"' + (s.id === sid ? ' selected' : '') + '>' + UI.esc(s.name) + '（' + UI.esc(Store.className(s.classId)) + '）</option>';
          }).join('') + '</select>'
      : '';

    return '' +
      '<div class="card" style="margin-bottom:14px"><div class="card-pad row wrap" style="gap:14px">' +
        UI.avatar(st.name, st.color, 'lg', st.avatar) +
        '<div><div style="font-size:18px;font-weight:700">' + UI.esc(st.name) + ' 的作品集</div>' +
          '<div class="small muted">' + Store.className(st.classId) + '　学号 ' + UI.esc(st.no) +
          '　共 ' + sum.images + ' 幅作品 · ' + sum.pieces + ' 张作业</div></div>' +
        '<div class="spacer"></div>' + picker +
        (role === 'teacher' ? '<button class="btn sm" id="pfUpload" style="margin-left:8px">＋ 代交作业</button>' : '') +
        (role === 'teacher' ? '<button class="btn sm ghost" id="pfDelAll" style="margin-left:8px;color:var(--danger);border-color:#FECACA">删除作品集</button>' : '') +
        '<button class="btn sm ghost" id="pfExport">导出记录</button>' +
      '</div></div>' +

      '<div class="grid g-4" style="margin-bottom:14px">' +
        UI.statCard({ icon: '🎨', bg: '#FDF2F8', fg: '#EC4899', value: sum.bySubject.color, unit: '张', label: '色彩' }) +
        UI.statCard({ icon: '✏️', bg: '#F1F5F9', fg: '#64748B', value: sum.bySubject.sketch, unit: '张', label: '素描' }) +
        UI.statCard({ icon: '🖌️', bg: '#FFFBEB', fg: '#B45309', value: sum.bySubject.quick, unit: '张', label: '速写' }) +
        UI.statCard({ icon: '⭐', bg: '#ECFDF5', fg: '#16A34A', value: sum.avgGrade || '–', label: '平均评级' }) +
      '</div>' +

      '<div class="filters">' +
        '<button class="chip' + (subj === '' ? ' active' : '') + '" data-f="subject" data-v="">全部科目</button>' +
        Store.SUBJECTS.map(function (s) {
          return '<button class="chip' + (subj === s.key ? ' active' : '') + '" data-f="subject" data-v="' + s.key + '">' + s.icon + ' ' + s.name + '</button>';
        }).join('') +
        '<span style="width:1px;height:20px;background:var(--border)"></span>' +
        '<button class="chip' + (grade === '' ? ' active' : '') + '" data-f="grade" data-v="">全部评级</button>' +
        Store.GRADES.map(function (g) {
          return '<button class="chip' + (grade === g ? ' active' : '') + '" data-f="grade" data-v="' + g + '">' + g + '</button>';
        }).join('') +
        '<div class="spacer"></div><span class="small muted">' + items.length + ' 幅</span>' +
      '</div>' +

      (items.length
        ? '<div class="gallery">' +           items.map(function (it, i) {
            var r = it.rec;
            // 老师或本人（学生/家长查看自己）均可删除单张作品
            var delBtn = '<button class="ac-del" data-del-img="' + it.id + '" data-rec="' + r.id + '" title="删除此作品">🗑</button>';
            return '<div class="art-card" data-open="' + i + '">' + delBtn +
              '<div class="ac-img"><img data-img-id="' + it.id + '" alt="作品"></div>' +
              '<div class="ac-body"><div class="ac-row">' + UI.subjectBadge(r.subject) + '<div class="spacer"></div>' + UI.gradeBadge(r.grade) + '</div>' +
              '<div class="ac-date">' + r.date + '　完成度 ' + r.progress + '%</div></div></div>';
          }).join('') + '</div>'
        : '<div class="card">' + UI.empty('还没有作品', '上传作业照片后会自动进入作品集', '🖼️') + '</div>');
  },
  mount: function (ctx) {
    UI.hydrateImages();
    var q = App.query();
    var role = ctx.user.role;
    var students = Store.allStudents();
    var sid = role === 'teacher' ? (q.student || (students[0] ? students[0].id : '')) : ctx.user.studentId;
    var st = Store.getStudent(sid);

    UI.els('[data-f]').forEach(function (b) { b.onclick = function () { App.setQuery(b.dataset.f, b.dataset.v); }; });
    var sel = UI.el('#pfStudent');
    if (sel) sel.onchange = function () { App.setQuery('student', sel.value); };

    var upBtn = UI.el('#pfUpload');
    if (upBtn) upBtn.onclick = function () { openTeacherUpload(sid); };

    var delAll = UI.el('#pfDelAll');
    if (delAll) delAll.onclick = function () {
      UI.confirm('删除作品集', '将删除 ' + (st ? st.name : '该学生') + ' 的全部作业记录与作品图片（不会删除该学生账号），确定吗？', function () {
        var n = Store.deleteStudentPortfolio(sid);
        UI.toast('已删除 ' + n + ' 条作业记录', 'ok');
        App.render();
      }, true);
    };

    UI.els('[data-del-img]').forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        UI.confirm('删除作品', '将从此学生的作品集中移除这张照片（作业记录其余内容保留），确定吗？', function () {
          Store.removeImageFromRecord(b.dataset.rec, b.dataset.delImg);
          UI.toast('已删除该作品', 'ok');
          App.render();
        }, true);
      };
    });

    var recs = Store.queryRecords({ studentId: sid, subject: q.subject || '', grade: q.grade || '', hasImage: true });
    var items = [];
    recs.forEach(function (r) { (r.images || []).forEach(function (imgId) { items.push({ id: imgId, rec: r }); }); });

    UI.els('[data-open]').forEach(function (c) {
      c.onclick = function () {
        UI.openLightbox(items.map(function (it) {
          return {
            id: it.id,
            title: (st ? st.name : '') + ' · ' + Store.subject(it.rec.subject).name + (it.rec.grade ? '　评级 ' + it.rec.grade : ''),
            sub: it.rec.date + '　完成度 ' + it.rec.progress + '%' + (it.rec.teacherComment ? '　·　' + it.rec.teacherComment : '')
          };
        }), +c.dataset.open);
      };
    });

    var exp = UI.el('#pfExport');
    if (exp) exp.onclick = function () {
      UI.download((st ? st.name : '学生') + '_作业记录.csv', Store.exportCSV(Store.queryRecords({ studentId: sid })), 'text/csv');
      UI.toast('已导出该学生全部作业记录', 'ok');
    };
  }
};

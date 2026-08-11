/* ============================================================
   作业批改（教师）
   ============================================================ */
Views.review = {
  title: '作业批改',
  render: function () {
    var q = App.query();
    var range = q.range || 'week';
    var status = q.status || 'pending';
    var subj = q.subject || '';
    var cls = q.cls || '';
    var kw = q.kw || '';

    var today = Store.todayStr();
    var opt = { status: status === 'all' ? '' : status, subject: subj, classId: cls, keyword: kw };
    if (range === 'today') opt.date = today;
    else if (range === 'week') opt.from = Store.weekStart(today);
    else if (range === 'month') opt.from = Store.shiftDate(today, -30);

    var list = Store.queryRecords(opt);
    var classes = Store.data().classes;

    var head = '' +
      '<div class="filters">' +
        '<div class="chip-scroll">' +
          [['today', '今天'], ['week', '本周'], ['month', '近30天'], ['all', '全部']].map(function (r) {
            return '<button class="chip' + (range === r[0] ? ' active' : '') + '" data-f="range" data-v="' + r[0] + '">' + r[1] + '</button>';
          }).join('') +
        '</div>' +
        '<span style="width:1px;height:20px;background:var(--border)"></span>' +
        '<div class="chip-scroll">' +
          [['pending', '待批改'], ['reviewed', '已批改'], ['all', '全部']].map(function (r) {
            return '<button class="chip' + (status === r[0] ? ' active' : '') + '" data-f="status" data-v="' + r[0] + '">' + r[1] + '</button>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<div class="filters">' +
        '<button class="chip' + (subj === '' ? ' active' : '') + '" data-f="subject" data-v="">全部科目</button>' +
        Store.SUBJECTS.map(function (s) {
          return '<button class="chip' + (subj === s.key ? ' active' : '') + '" data-f="subject" data-v="' + s.key + '">' + s.icon + ' ' + s.name + '</button>';
        }).join('') +
        '<select class="select" id="fCls" style="width:auto;min-width:150px;padding:7px 34px 7px 12px;border-radius:999px">' +
          '<option value="">全部班级</option>' +
          classes.map(function (c) { return '<option value="' + c.id + '"' + (cls === c.id ? ' selected' : '') + '>' + UI.esc(c.name) + '</option>'; }).join('') +
        '</select>' +
        '<input class="input" id="fKw" placeholder="搜索学生姓名/学号" value="' + UI.esc(kw) + '" style="width:auto;min-width:170px;padding:7px 12px;border-radius:999px">' +
        '<div class="spacer"></div>' +
        '<button class="btn sm ghost" id="expCsv">导出 CSV</button>' +
      '</div>' +
      '<div class="row small muted" style="margin-bottom:12px">共 ' + list.length + ' 条记录　·　待批改 ' +
        list.filter(function (r) { return !r.grade; }).length + ' 条</div>';

    if (!list.length) return head + '<div class="card">' + UI.empty('没有符合条件的作业', '换个筛选条件试试', '🔍') + '</div>';

    return head + '<div class="grid" style="gap:12px">' + list.map(reviewCard).join('') + '</div>';
  },
  mount: function () {
    UI.hydrateImages();
    UI.els('[data-f]').forEach(function (b) {
      b.onclick = function () { App.setQuery(b.dataset.f, b.dataset.v); };
    });
    var sel = UI.el('#fCls');
    if (sel) sel.onchange = function () { App.setQuery('cls', sel.value); };
    var kwInput = UI.el('#fKw');
    if (kwInput) {
      var t = null;
      kwInput.oninput = function () {
        clearTimeout(t);
        t = setTimeout(function () { App.setQuery('kw', kwInput.value.trim()); }, 420);
      };
    }
    var exp = UI.el('#expCsv');
    if (exp) exp.onclick = function () {
      var q = App.query();
      var opt = { status: (q.status || 'pending') === 'all' ? '' : (q.status || 'pending'), subject: q.subject || '', classId: q.cls || '', keyword: q.kw || '' };
      var range = q.range || 'week', today = Store.todayStr();
      if (range === 'today') opt.date = today;
      else if (range === 'week') opt.from = Store.weekStart(today);
      else if (range === 'month') opt.from = Store.shiftDate(today, -30);
      UI.download('美术作业记录_' + today + '.csv', Store.exportCSV(Store.queryRecords(opt)), 'text/csv');
      UI.toast('CSV 已导出', 'ok');
    };

    UI.els('[data-grade-btn]').forEach(function (b) {
      b.onclick = function () {
        var wrap = b.closest('.rec-card');
        UI.els('[data-grade-btn]', wrap).forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        wrap.dataset.pickGrade = b.dataset.g;
      };
    });
    UI.els('[data-save-review]').forEach(function (b) {
      b.onclick = function () {
        var wrap = b.closest('.rec-card');
        var id = b.dataset.saveReview;
        var g = wrap.dataset.pickGrade || null;
        var c = UI.el('[data-comment]', wrap).value.trim();
        if (!g) { UI.toast('请先选择评级', 'err'); return; }
        Store.gradeRecord(id, g, c, (Store.currentUser() || {}).name);
        UI.toast('已保存评定：' + g + ' 级', 'ok');
        App.render();
      };
    });
    UI.els('[data-view-imgs]').forEach(function (b) {
      b.onclick = function () {
        var rec = Store.data().records.filter(function (r) { return r.id === b.dataset.viewImgs; })[0];
        if (!rec) return;
        var st = Store.getStudent(rec.studentId) || {};
        UI.openLightbox((rec.images || []).map(function (id) {
          return { id: id, title: st.name + ' · ' + Store.subject(rec.subject).name, sub: rec.date + '　完成度 ' + rec.progress + '%' };
        }), +b.dataset.idx || 0);
      };
    });
    UI.els('[data-del-review]').forEach(function (b) {
      b.onclick = function () {
        UI.confirm('删除记录', '将永久删除该条作业记录及其照片，确定吗？', function () {
          Store.deleteRecord(b.dataset.delReview);
          UI.toast('已删除', 'ok');
          App.render();
        }, true);
      };
    });
  }
};

function reviewCard(r) {
  var st = Store.getStudent(r.studentId) || { name: '未知学生', color: '#999', no: '' };
  var imgs = r.images || [];
  return '<div class="rec-card" data-pick-grade="' + (r.grade || '') + '">' +
    '<div class="rec-head">' + UI.avatar(st.name, st.color, 'sm') +
      '<div><div class="rh-name">' + UI.esc(st.name) + ' <span class="small muted">' + UI.esc(st.no) + '</span></div>' +
      '<div class="rh-meta">' + Store.className(st.classId) + '　' + r.date + ' 周' + Store.weekdayCN(r.date) + '</div></div>' +
      '<div class="spacer"></div>' + UI.subjectBadge(r.subject) +
      (r.grade ? '<span class="badge ok">已批改</span>' : '<span class="badge warn">待批改</span>') +
    '</div>' +

    '<div class="rec-metrics">' +
      '<div class="metric"><div class="m-label">完成数量</div><div class="m-val">' + r.count + ' 张</div></div>' +
      '<div class="metric" style="flex:1;min-width:150px"><div class="m-label">完成程度 ' + r.progress + '%</div>' +
        '<div style="margin-top:7px">' + UI.progressBar(r.progress, r.progress >= 90 ? '#16A34A' : r.progress >= 70 ? '#5A4FCF' : '#F59E0B') + '</div></div>' +
      '<div class="metric"><div class="m-label">提交时间</div><div class="m-val" style="font-size:13px">' + UI.esc((r.createdAt || '').split(' ')[1] || '—') + '</div></div>' +
    '</div>' +

    (r.note ? '<div class="small muted">📝 ' + UI.esc(r.note) + '</div>' : '') +

    (imgs.length ? '<div class="thumbs">' + imgs.map(function (id, i) {
      return '<div class="thumb" data-view-imgs="' + r.id + '" data-idx="' + i + '"><img data-img-id="' + id + '" alt=""></div>';
    }).join('') + '</div>' : '<div class="small muted" style="margin:10px 0">未上传照片</div>') +

    '<div class="row wrap" style="gap:10px;margin-top:12px">' +
      '<div class="grade-picker">' + Store.GRADES.map(function (g) {
        return '<button class="gp-btn ' + g + (r.grade === g ? ' on' : '') + '" data-grade-btn data-g="' + g + '" title="' + Store.GRADE_TEXT[g] + '">' + g + '</button>';
      }).join('') + '</div>' +
      '<input class="input" data-comment placeholder="写点评语鼓励一下…" value="' + UI.esc(r.teacherComment || '') + '" style="flex:1;min-width:180px;padding:9px 12px">' +
      '<button class="btn sm" data-save-review="' + r.id + '">保存</button>' +
      '<button class="icon-btn" data-del-review="' + r.id + '" title="删除">🗑</button>' +
    '</div>' +
    (r.reviewedBy ? '<div class="small muted" style="margin-top:8px">已由 ' + UI.esc(r.reviewedBy) + ' 于 ' + UI.esc(r.reviewedAt || '') + ' 批改</div>' : '') +
  '</div>';
}

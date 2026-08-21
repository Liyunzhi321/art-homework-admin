/* ============================================================
   数据统计
   ============================================================ */
Views.stats = {
  title: '数据统计',
  render: function (ctx) {
    var q = App.query();
    var range = q.range || 'week';
    var today = Store.todayStr();
    var from = range === 'week' ? Store.weekStart(today)
      : range === 'month' ? Store.shiftDate(today, -29)
      : '2000-01-01';
    var days = range === 'week' ? Store.lastNDates(7)
      : range === 'month' ? Store.lastNDates(30)
      : Store.lastNDates(14);

    var isTeacher = ctx.user.role === 'teacher';
    var sid = isTeacher ? '' : ctx.user.studentId;
    var recs = Store.queryRecords(sid ? { studentId: sid, from: from } : { from: from });
    var sum = Store.summarize(recs);

    var series = Store.SUBJECTS.map(function (s) {
      return {
        name: s.name, color: s.color,
        data: days.map(function (d) {
          return Store.queryRecords(sid ? { studentId: sid, date: d, subject: s.key } : { date: d, subject: s.key })
            .reduce(function (a, r) { return a + r.count; }, 0);
        })
      };
    });
    var trend = days.map(function (d) {
      var rs = Store.queryRecords(sid ? { studentId: sid, date: d } : { date: d });
      if (!rs.length) return 0;
      return Math.round(rs.reduce(function (a, r) { return a + r.progress; }, 0) / rs.length);
    });

    var head = '<div class="filters">' +
      [['week', '本周'], ['month', '近30天'], ['all', '全部']].map(function (r) {
        return '<button class="chip' + (range === r[0] ? ' active' : '') + '" data-f="range" data-v="' + r[0] + '">' + r[1] + '</button>';
      }).join('') +
      '<div class="spacer"></div>' +
      (isTeacher ? '<button class="btn sm ghost" id="stExport">导出全部记录</button>' : '') +
      '</div>';

    var cards = '<div class="grid g-4">' +
      UI.statCard({ icon: '📦', bg: '#EDEBFB', fg: '#5A4FCF', value: sum.pieces, unit: '张', label: '作业总量' }) +
      UI.statCard({ icon: '✅', bg: '#ECFDF5', fg: '#16A34A', value: sum.total, unit: '次', label: '提交次数', trend: '待批改 ' + sum.pending + ' 次' }) +
      UI.statCard({ icon: '📈', bg: '#FFF1EA', fg: '#F97316', value: sum.avgProgress + '%', label: '平均完成程度' }) +
      UI.statCard({ icon: '⭐', bg: '#EFF6FF', fg: '#2563EB', value: sum.avgGrade || '–', label: '平均评级', trend: '已评定 ' + sum.graded + ' 次' }) +
      '</div>';

    var charts = '<div class="grid g-2-1 section-gap">' +
      '<div class="card"><div class="card-head"><h3>三科作业量趋势</h3><div class="spacer"></div><span class="hint">单位：张</span></div>' +
        '<div class="card-pad">' + Charts.bar({ labels: days.map(function (d) { return Store.mmdd(d); }), series: series, height: 250 }) + '</div></div>' +
      '<div class="card"><div class="card-head"><h3>评级构成</h3></div><div class="card-pad">' +
        Charts.donut({
          items: Store.GRADES.map(function (g) { return { label: g + ' · ' + Store.GRADE_TEXT[g], value: sum.byGrade[g], color: Store.GRADE_COLOR[g] }; }),
          centerValue: sum.graded, centerLabel: '已评定'
        }) + '</div></div>' +
      '</div>' +
      '<div class="card section-gap"><div class="card-head"><h3>平均完成程度走势</h3><div class="spacer"></div><span class="hint">单位：%</span></div>' +
        '<div class="card-pad">' + Charts.line({ labels: days.map(function (d) { return Store.mmdd(d); }), data: trend, max: 100 }) + '</div></div>';

    var extra = '';
    if (isTeacher) {
      var rows = Store.allStudents().map(function (st) {
        var rs = Store.queryRecords({ studentId: st.id, from: from });
        var s2 = Store.summarize(rs);
        var subCount = Store.SUBJECTS.map(function (sb) {
          return rs.filter(function (r) { return r.subject === sb.key; }).reduce(function (a, r) { return a + r.count; }, 0);
        });
        return { st: st, s: s2, subCount: subCount, n: rs.length };
      }).sort(function (a, b) { return b.s.pieces - a.s.pieces; });

      extra = '<div class="card section-gap"><div class="card-head"><h3>学生完成情况明细</h3><div class="spacer"></div>' +
        '<span class="hint">按作业量排序</span></div><div class="table-wrap"><table class="tbl">' +
        '<thead><tr><th>学生</th><th>班级</th><th>🎨 色彩</th><th>✏️ 素描</th><th>🖌️ 速写</th><th>合计</th><th>完成度</th><th>评级</th><th>待批改</th></tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr><td><div class="row">' + UI.avatar(r.st.name, r.st.color, 'sm') + '<b>' + UI.esc(r.st.name) + '</b></div></td>' +
            '<td class="small">' + UI.esc(Store.className(r.st.classId)) + '</td>' +
            '<td>' + r.subCount[0] + '</td><td>' + r.subCount[1] + '</td><td>' + r.subCount[2] + '</td>' +
            '<td><b>' + r.s.pieces + '</b></td>' +
            '<td style="min-width:110px">' + UI.progressBar(r.s.avgProgress) + '<span class="small muted">' + r.s.avgProgress + '%</span></td>' +
            '<td>' + UI.gradeBadge(r.s.avgGrade) + '</td>' +
            '<td>' + (r.s.pending ? '<span class="badge warn">' + r.s.pending + '</span>' : '<span class="small muted">0</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';

      var byClass = Store.data().classes.map(function (c) {
        var rs = Store.queryRecords({ classId: c.id, from: from });
        return { c: c, s: Store.summarize(rs) };
      });
      extra += '<div class="grid g-2 section-gap">' + byClass.map(function (b) {
        return '<div class="card"><div class="card-head"><h3>' + UI.esc(b.c.name) + '</h3></div><div class="card-pad">' +
          '<div class="row wrap" style="gap:22px">' +
            '<div><div class="small muted">作业量</div><div style="font-size:20px;font-weight:800">' + b.s.pieces + ' 张</div></div>' +
            '<div><div class="small muted">平均完成度</div><div style="font-size:20px;font-weight:800">' + b.s.avgProgress + '%</div></div>' +
            '<div><div class="small muted">平均评级</div><div style="font-size:20px;font-weight:800">' + (b.s.avgGrade || '–') + '</div></div>' +
            '<div><div class="small muted">待批改</div><div style="font-size:20px;font-weight:800">' + b.s.pending + '</div></div>' +
          '</div>' +
          '<div style="margin-top:14px">' + Store.SUBJECTS.map(function (sb) {
            var v = b.s.bySubject[sb.key] || 0;
            var max = Math.max(1, b.s.pieces);
            return '<div style="margin-bottom:9px"><div class="row small"><span>' + sb.icon + ' ' + sb.name + '</span><div class="spacer"></div><b>' + v + ' 张</b></div>' +
              UI.progressBar(v / max * 100, sb.color) + '</div>';
          }).join('') + '</div></div></div>';
      }).join('') + '</div>';
    } else {
      var subjRows = Store.SUBJECTS.map(function (sb) {
        var rs = recs.filter(function (r) { return r.subject === sb.key; });
        var s2 = Store.summarize(rs);
        return '<div class="card"><div class="card-pad">' +
          '<div class="row"><span style="font-size:20px">' + sb.icon + '</span><b>' + sb.name + '</b><div class="spacer"></div>' + UI.gradeBadge(s2.avgGrade) + '</div>' +
          '<div class="row" style="margin-top:12px;gap:20px">' +
            '<div><div class="small muted">完成量</div><b style="font-size:18px">' + s2.pieces + ' 张</b></div>' +
            '<div><div class="small muted">提交次数</div><b style="font-size:18px">' + s2.total + '</b></div>' +
            '<div><div class="small muted">完成度</div><b style="font-size:18px">' + s2.avgProgress + '%</b></div>' +
          '</div>' +
          '<div style="margin-top:12px">' + UI.progressBar(s2.avgProgress, sb.color) + '</div>' +
        '</div></div>';
      }).join('');
      extra = '<div class="grid g-3 section-gap">' + subjRows + '</div>';
    }

    return head + cards + charts + extra;
  },
  mount: function () {
    UI.els('[data-f]').forEach(function (b) { b.onclick = function () { App.setQuery(b.dataset.f, b.dataset.v); }; });
    var e = UI.el('#stExport');
    if (e) e.onclick = function () {
      UI.download('美术班全部作业记录_' + Store.todayStr() + '.csv', Store.exportCSV(Store.queryRecords({})), 'text/csv');
      UI.toast('已导出全部记录', 'ok');
    };
  }
};

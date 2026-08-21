/* ============================================================
   考勤（到班顺序 / 迟到时长 / 操作人记录）—— 教师端
   ============================================================ */
Views.attendance = {
  title: '考勤',
  render: function (ctx) {
    if (ctx && ctx.user && ctx.user.role === 'parent') return childAttendance(ctx);
    var today = Store.todayStr();
    var q = App.query();
    var attDate = q.date || today;
    var isToday = attDate === today;
    var students = Store.allStudents();
    var period = q.period || Store.PERIODS[0];
    var stats = Store.attendanceStats({ date: attDate, days: 14, period: period });

    var lateToday = stats.todayLate.length;
    var leaveToday = stats.todayLeave.length;
    var presentToday = students.length - lateToday - leaveToday;
    var rate = students.length ? Math.round(presentToday / students.length * 100) : 0;

    /* 课次选择器 */
    var periodOpts = Store.PERIODS.map(function (p) {
      return '<option value="' + p + '"' + (p === period ? ' selected' : '') + '>' + p + '</option>';
    }).join('');

    /* 出勤名册：每个学生一行，正常 / 迟到 / 请假 一键设定（针对所选课次） */
    var roster = students.map(function (st) {
      var cur = Store.getAttendance(st.id, attDate, period);
      var status = cur ? cur.status : 'present';
      function btn(s, label, cls) {
        return '<button class="att-btn ' + cls + (status === s ? ' on' : '') + '" data-att-sid="' + st.id + '" data-att-status="' + s + '">' + label + '</button>';
      }
      return '<div class="att-row">' +
        UI.avatar(st.name, st.color, 'sm') +
        '<div class="li-main"><b>' + UI.esc(st.name) + '</b><span>' + Store.className(st.classId) + ' · ' + UI.esc(st.no) + '</span></div>' +
        '<div class="att-actions">' + btn('present', '正常', 'ok') + btn('late', '迟到', 'warn') + btn('leave', '请假', 'danger') + '</div>' +
        '</div>';
    }).join('');

    /* 到班顺序：按到班时间排序（迟到也计入，便于看谁先到 / 谁迟到） */
    var order = Store.attendanceArrivalOrder(attDate, period);
    var orderHtml = order.length ? order.map(function (a, idx) {
      var st = Store.getStudent(a.studentId);
      var isLate = a.status === 'late';
      return '<div class="list-item">' +
        '<div style="width:26px;font-weight:800;color:' + (idx < 3 ? '#F59E0B' : 'var(--text-3)') + '">' + (idx + 1) + '</div>' +
        UI.avatar(st ? st.name : '?', st ? st.color : '#999', 'sm') +
        '<div class="li-main"><b>' + UI.esc(st ? st.name : '未知') + '</b>' +
          '<span>到班 ' + UI.fmtTime(a.arrivedAt) + (isLate ? '　迟到 ' + (a.lateMinutes || 0) + ' 分钟' : '　准时') + '</span></div>' +
        '<span class="badge ' + (isLate ? 'warn' : 'ok') + '">' + (isLate ? '迟到' : '正常') + '</span>' +
        (a.byUser ? '<span class="small muted">操作人 ' + UI.esc(a.byUser) + '</span>' : '') +
        '</div>';
    }).join('') : UI.empty('暂无到班记录', '老师点击「正常 / 迟到」后，这里会按到班先后排序显示', '🚪');

    /* 累计迟到榜（前 8，跨课次累计） */
    var lateRank = stats.students.slice().sort(function (a, b) { return b.late - a.late || b.leave - a.leave; }).slice(0, 8);
    var lateBar = lateRank.length ? Charts.bar({
      labels: lateRank.map(function (x) { return x.st.name; }),
      series: [{ name: '迟到', color: '#EF4444', data: lateRank.map(function (x) { return x.late; }) }],
      height: 220
    }) : UI.empty('还没有迟到记录', '同学们都很准时 🎉');

    /* 每日迟到趋势（近 14 天，所选课次） */
    var trend = stats.dailyLate;
    var trendChart = Charts.line({
      labels: trend.map(function (x) { return Store.mmdd(x.date); }),
      data: trend.map(function (x) { return x.count; }),
      max: Math.max(4, Math.max.apply(null, trend.map(function (x) { return x.count; }).concat([1]))),
      suffix: ' 人'
    });

    /* 各课次迟到 / 请假分布（所选日期，直观看出哪节课最易迟到） */
    var pb = stats.periodBreakdown;
    var periodBar = Charts.bar({
      labels: pb.map(function (x) { return x.period; }),
      series: [
        { name: '迟到', color: '#EF4444', data: pb.map(function (x) { return x.late; }) },
        { name: '请假', color: '#F59E0B', data: pb.map(function (x) { return x.leave; }) }
      ],
      height: 220
    });

    /* 请假明细（含操作人） */
    var leaves = Store.attendanceList().filter(function (a) { return a.status === 'leave'; })
      .sort(function (a, b) { return (b.date || '') < (a.date || '') ? -1 : 1; }).slice(0, 12);
    var leaveList = leaves.length ? leaves.map(function (a) {
      return '<div class="list-item"><span class="badge danger">请假</span>' +
        UI.avatar((Store.getStudent(a.studentId) || {}).name || '?', '#999', 'sm') +
        '<div class="li-main"><b>' + UI.esc((Store.getStudent(a.studentId) || {}).name || '未知') + '</b>' +
        '<span>' + a.date + ' · ' + (a.period || Store.PERIODS[0]) + (a.note ? '　' + UI.esc(a.note) : '') + '</span></div>' +
        (a.byUser ? '<span class="small muted">操作人 ' + UI.esc(a.byUser) + '</span>' : '') + '</div>';
    }).join('') : UI.empty('暂无解假记录', '', '📝');

    /* 学生迟到统计（近 30 天）：迟到天数 / 次数 / 累计时长，替代原「每天每课次迟到」矩阵 */
    var lateStats = Store.studentLateStats(30).filter(function (x) { return x.lateCount > 0; });
    var lateTableHtml = lateStats.length ? '<table class="tbl"><thead><tr><th>学生</th><th>迟到天数</th><th>迟到次数</th><th>累计时长</th><th>最近一次</th></tr></thead><tbody>' +
      lateStats.map(function (x) {
        var st = x.st, last = x.last;
        return '<tr><td>' + UI.avatar(st.name, st.color, 'sm') + ' <b>' + UI.esc(st.name) + '</b></td>' +
          '<td>' + x.lateDays + ' 天</td><td>' + x.lateCount + ' 次</td>' +
          '<td><b style="color:var(--danger)">' + x.minutes + '</b> 分钟</td>' +
          '<td>' + (last ? (last.date + ' 迟到 ' + (last.lateMinutes || 0) + ' 分' + (last.byUser ? '（' + UI.esc(last.byUser) + '）' : '')) : '–') + '</td></tr>';
      }).join('') + '</tbody></table>' : UI.empty('近 30 天无人迟到', '同学们都很准时 🎉', '⏰');

    return '' +
      '<div class="row wrap" style="margin-bottom:14px"><div><h2 style="font-size:20px">考勤管理</h2>' +
        '<div class="small muted">按课次记录出勤，支持到班顺序、迟到时长与操作人留痕（第1节 ~ 第6节）</div></div>' +
        '<div class="spacer"></div>' +
        '<div class="row wrap" style="gap:10px">' +
          '<div class="field" style="margin:0;min-width:150px"><label>考勤日期</label>' +
            '<input class="input" type="date" id="attDate" value="' + attDate + '" max="' + today + '"></div>' +
          '<div class="field" style="margin:0;min-width:120px"><label>课次</label>' +
            '<select class="select" id="attPeriod">' + periodOpts + '</select></div>' +
        '</div>' +
      '</div>' +

      '<div class="grid g-4">' +
        UI.statCard({ icon: '✅', bg: '#ECFDF5', fg: '#16A34A', value: presentToday, unit: '人', label: (isToday ? '今日' : attDate) + ' ' + period + ' 出勤', trend: '出勤率 ' + rate + '%', trendColor: rate >= 90 ? 'var(--ok)' : 'var(--warn)' }) +
        UI.statCard({ icon: '⏰', bg: '#FEF2F2', fg: '#EF4444', value: lateToday, unit: '人', label: period + ' 迟到', trend: stats.totalLate + ' 人次累计', trendColor: 'var(--danger)' }) +
        UI.statCard({ icon: '🤒', bg: '#FFF7ED', fg: '#F59E0B', value: leaveToday, unit: '人', label: period + ' 请假', trend: stats.totalLeave + ' 人次累计', trendColor: 'var(--warn)' }) +
        UI.statCard({ icon: '👥', bg: '#EDEBFB', fg: '#5A4FCF', value: students.length, unit: '人', label: '班级总人数' }) +
      '</div>' +

      '<div class="card section-gap"><div class="card-head"><h3>出勤名册 · ' + attDate + ' ' + period + ' ' + (isToday ? '（今天）' : '') + '</h3>' +
        '<div class="spacer"></div>' +
        '<button class="btn sm ghost" id="attAllPresent">本課次全班正常</button></div>' +
        '<div class="card-pad">' + (roster || UI.empty('暂无学生', '请先在「学生管理」添加学生')) + '</div></div>' +

      '<div class="card section-gap"><div class="card-head"><h3>🚪 到班顺序 · ' + attDate + ' ' + period + '</h3>' +
        '<div class="spacer"></div><span class="hint">按到班时间先后排序</span></div>' +
        '<div class="card-pad">' + (orderHtml || '') + '</div></div>' +

      '<div class="grid g-2 section-gap">' +
        '<div class="card"><div class="card-head"><h3>累计迟到榜（Top 8 · 跨课次）</h3></div><div class="card-pad">' + lateBar + '</div></div>' +
        '<div class="card"><div class="card-head"><h3>每日迟到趋势（近 14 天 · ' + period + '）</h3><div class="spacer"></div><span class="hint">单位：人</span></div>' +
          '<div class="card-pad">' + trendChart + '</div></div>' +
      '</div>' +

      '<div class="card section-gap"><div class="card-head"><h3>各课次迟到 / 请假分布 · ' + attDate + '</h3><div class="spacer"></div><span class="hint">直观看出哪节课最易迟到</span></div>' +
        '<div class="card-pad">' + periodBar + '</div></div>' +

      '<div class="grid g-2 section-gap">' +
        '<div class="card"><div class="card-head"><h3>请假明细</h3></div><div class="card-pad">' + leaveList + '</div></div>' +
        '<div class="card"><div class="card-head"><h3>学生迟到统计（近 30 天）</h3><div class="spacer"></div><span class="hint">迟到次数 + 迟到多久</span></div>' +
          '<div style="overflow:auto"><table class="tbl">' + lateTableHtml + '</table></div></div>' +
      '</div>';
  },
  mount: function (ctx) {
    if (ctx && ctx.user && ctx.user.role === 'parent') return;
    var today = Store.todayStr();
    var attDate = (App.query().date) || today;
    var period = (App.query().period) || Store.PERIODS[0];
    UI.el('#attDate').onchange = function () { App.go('#/attendance?date=' + this.value + '&period=' + period); };
    UI.el('#attPeriod').onchange = function () { App.go('#/attendance?date=' + attDate + '&period=' + this.value); };

    UI.els('[data-att-sid]').forEach(function (b) {
      b.onclick = function () {
        var sid = b.dataset.attSid;
        if (b.dataset.attStatus === 'late') {
          UI.modal({
            title: '标记迟到',
            body: '<div class="field"><label>迟到时长（分钟）</label><input class="input" id="lateMin" type="number" min="1" max="120" value="10"></div>' +
              '<div class="field"><label>备注（可选）</label><input class="input" id="lateNote" placeholder="如：堵车 / 赖床"></div>',
            okText: '确定',
            onOk: function (m) {
              var min = +UI.el('#lateMin', m).value || 0;
              var note = UI.el('#lateNote', m).value.trim();
              Store.setAttendance(sid, attDate, period, 'late', { lateMinutes: min, note: note });
              UI.toast('已记录迟到 ' + min + ' 分钟', 'ok');
              App.render();
            }
          });
        } else if (b.dataset.attStatus === 'leave') {
          UI.modal({
            title: '标记请假',
            body: '<div class="field"><label>请假原因</label>' +
              '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">' +
              '<button type="button" class="btn sm ghost" data-reason="病假">病假</button>' +
              '<button type="button" class="btn sm ghost" data-reason="事假">事假</button>' +
              '<button type="button" class="btn sm ghost" data-reason="其他">其他</button>' +
              '</div>' +
              '<input class="input" id="leaveNote" placeholder="可补充说明，如：感冒发烧 / 回老家"></div>',
            okText: '确定',
            onMount: function (m) {
              UI.els('[data-reason]', m).forEach(function (c) {
                c.onclick = function () { UI.el('#leaveNote', m).value = c.dataset.reason; UI.el('#leaveNote', m).focus(); };
              });
            },
            onOk: function (m) {
              var note = (UI.el('#leaveNote', m).value || '').trim() || '请假';
              Store.setAttendance(sid, attDate, period, 'leave', { note: note });
              UI.toast('已记录请假：' + note, 'ok');
              App.render();
            }
          });
        } else {
          Store.setAttendance(sid, attDate, period, b.dataset.attStatus);
          UI.toast('已记录', 'ok');
          App.render();
        }
      };
    });
    var allBtn = UI.el('#attAllPresent');
    if (allBtn) allBtn.onclick = function () {
      UI.confirm('本課次全班正常', '将把 ' + attDate + ' ' + period + ' 的所有迟到 / 请假记录清除（标记正常），确定吗？', function () {
        Store.allStudents().forEach(function (st) { Store.setAttendance(st.id, attDate, period, 'present'); });
        UI.toast('已设为全班正常', 'ok');
        App.render();
      }, true);
    };
  }
};

/* 家长端：查看自己孩子的到班顺序 / 迟到时长 / 出勤（只读） */
function childAttendance(ctx) {
  var sid = ctx.user.studentId;
  var st = Store.getStudent(sid);
  if (!st) return UI.empty('未绑定学生', '请联系老师为该家长账号绑定学生');
  var recs = Store.studentAttendance(sid);
  var late = recs.filter(function (a) { return a.status === 'late'; });
  var leave = recs.filter(function (a) { return a.status === 'leave'; });
  var summary = Store.studentLateSummary(sid);
  var arrival = Store.studentArrivalToday(sid);

  var days = Store.lastNDates(14).slice().reverse();
  var lateSeries = days.map(function (d) { return recs.filter(function (a) { return a.date === d && a.status === 'late'; }).length; });
  var leaveSeries = days.map(function (d) { return recs.filter(function (a) { return a.date === d && a.status === 'leave'; }).length; });

  var byPeriod = Store.PERIODS.map(function (p) {
    return {
      period: p,
      late: late.filter(function (a) { return a.period === p; }).length,
      leave: leave.filter(function (a) { return a.period === p; }).length
    };
  });
  var periodBar = Charts.bar({
    labels: byPeriod.map(function (x) { return x.period; }),
    series: [
      { name: '迟到', color: '#EF4444', data: byPeriod.map(function (x) { return x.late; }) },
      { name: '请假', color: '#F59E0B', data: byPeriod.map(function (x) { return x.leave; }) }
    ],
    height: 200
  });

  /* 今日到班情况 */
  var arrivalHtml = arrival
    ? '<div class="list-item">' +
        UI.avatar(st.name, st.color, 'sm') +
        '<div class="li-main"><b>' + UI.esc(st.name) + '</b>' +
          '<span>到班 ' + UI.fmtTime(arrival.arrivedAt) + (arrival.status === 'late' ? '　迟到 ' + (arrival.lateMinutes || 0) + ' 分钟' : '　准时到班') + '</span></div>' +
        '<span class="badge ' + (arrival.status === 'late' ? 'warn' : 'ok') + '">' + (arrival.status === 'late' ? '迟到' : '正常') + '</span></div>'
    : UI.empty('今天还没有到班记录', '老师点击「正常 / 迟到」后会显示到班时间', '🚪');

  /* 迟到 / 请假明细（含迟到时长） */
  var list = recs.length ? recs.map(function (a) {
    var isLate = a.status === 'late';
    return '<div class="list-item"><span class="badge ' + (isLate ? 'warn' : 'danger') + '">' + (isLate ? '迟到' : '请假') + '</span>' +
      '<div class="li-main"><b>' + a.date + ' · ' + (a.period || Store.PERIODS[0]) + '</b>' +
      (isLate ? '<span>迟到 ' + (a.lateMinutes || 0) + ' 分钟</span>' : (a.note ? '<span>' + UI.esc(a.note) + '</span>' : '<span>请假</span>')) +
      (a.byUser ? '<span class="small muted">　操作人 ' + UI.esc(a.byUser) + '</span>' : '') + '</div></div>';
  }).join('') : UI.empty('孩子出勤记录良好', '暂无迟到或请假记录 🎉', '✅');

  return '' +
    '<div class="row wrap" style="margin-bottom:14px"><div><h2 style="font-size:20px">孩子出勤情况</h2>' +
      '<div class="small muted">' + UI.esc(st.name) + ' 的到班顺序 / 迟到时长（只读）</div></div></div>' +
    '<div class="grid g-3">' +
      UI.statCard({ icon: '⏰', bg: '#FEF2F2', fg: '#EF4444', value: summary.count, unit: '次', label: '累计迟到' }) +
      UI.statCard({ icon: '📅', bg: '#FFF7ED', fg: '#F59E0B', value: summary.lateDays, unit: '天', label: '迟到天数' }) +
      UI.statCard({ icon: '⏱️', bg: '#FEF3F2', fg: '#DC2626', value: summary.minutes, unit: '分', label: '累计迟到时长' }) +
    '</div>' +
    '<div class="card section-gap"><div class="card-head"><h3>🚪 今日到班情况</h3></div><div class="card-pad">' + arrivalHtml + '</div></div>' +
    '<div class="grid g-2 section-gap">' +
      '<div class="card"><div class="card-head"><h3>迟到趋势（近 14 天）</h3><div class="spacer"></div><span class="hint">单位：次</span></div>' +
        '<div class="card-pad">' + (late.length ? Charts.line({ labels: days.map(function (d) { return Store.mmdd(d); }), data: lateSeries, suffix: ' 次' }) : UI.empty('近 14 天无迟到', '')) + '</div></div>' +
      '<div class="card"><div class="card-head"><h3>请假趋势（近 14 天）</h3><div class="spacer"></div><span class="hint">单位：次</span></div>' +
        '<div class="card-pad">' + (leave.length ? Charts.line({ labels: days.map(function (d) { return Store.mmdd(d); }), data: leaveSeries, suffix: ' 次' }) : UI.empty('近 14 天无请假', '')) + '</div></div>' +
    '</div>' +
    '<div class="grid g-2 section-gap">' +
      '<div class="card"><div class="card-head"><h3>各课次迟到 / 请假分布</h3></div><div class="card-pad">' + periodBar + '</div></div>' +
      '<div class="card"><div class="card-head"><h3>迟到 / 请假明细</h3></div><div class="card-pad">' + list + '</div></div>' +
    '</div>';
}

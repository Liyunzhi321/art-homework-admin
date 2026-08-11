/* ============================================================
   Views 第一部分：登录 / 工作台 / 交作业
   ============================================================ */
var Views = {};

/* 首次登录强制改密码：不可关闭的浮层，完成后才进入系统 */
function forceChange(user, done) {
  var ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(20,16,40,.55);display:flex;align-items:center;justify-content:center;padding:16px';
  ov.innerHTML =
    '<div style="background:#fff;border-radius:16px;max-width:380px;width:100%;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.3)">' +
      '<h3 style="margin:0 0 4px;font-size:18px">🔐 首次登录，请修改密码</h3>' +
      '<p style="margin:0 0 16px;color:#666;font-size:13px;line-height:1.6">为了你的账号安全，<b>首次登录必须设置新密码</b>（至少 4 位）。设置后其他设备也会同步生效。</p>' +
      '<div class="field"><label>当前密码</label><input class="input" id="fcOld" type="password" placeholder="请输入当前密码" style="width:100%"></div>' +
      '<div class="field"><label>新密码</label><input class="input" id="fcNew" type="password" placeholder="至少 4 位" style="width:100%"></div>' +
      '<div class="field"><label>确认新密码</label><input class="input" id="fcCfm" type="password" placeholder="再次输入新密码" style="width:100%"></div>' +
      '<div id="fcErr" style="color:#e23;font-size:13px;min-height:18px;margin-bottom:8px"></div>' +
      '<button class="btn lg block" id="fcOk" style="background:#5A4FCF;color:#fff;border:none">确认修改并进入</button>' +
    '</div>';
  document.body.appendChild(ov);
  setTimeout(function () { var o = document.getElementById('fcOld'); if (o) o.focus(); }, 60);
  document.getElementById('fcOk').onclick = function () {
    var old = document.getElementById('fcOld').value;
    var np = document.getElementById('fcNew').value;
    var cf = document.getElementById('fcCfm').value;
    var err = document.getElementById('fcErr');
    if (!old || !np || !cf) { err.textContent = '请填写全部字段'; return; }
    if (np.length < 4) { err.textContent = '新密码至少 4 位'; return; }
    if (np !== cf) { err.textContent = '两次输入的新密码不一致'; return; }
    var r = Store.changePassword(user.id, old, np);
    if (!r.ok) { err.textContent = r.msg || '修改失败'; return; }
    ov.remove();
    UI.toast('密码已设置，欢迎 ' + user.name, 'ok');
    done();
  };
}

/* -------------------------------------------------- 登录页 */
Views.login = {
  title: '登录',
  render: function () {
    var role = (typeof sessionStorage !== 'undefined') ? (sessionStorage.getItem('ahm_login_role') || 'teacher') : 'teacher';
    var roles = [
      { key: 'teacher', ico: '👩‍🏫', name: '教师' },
      { key: 'student', ico: '🎒', name: '学生' },
      { key: 'parent', ico: '👨‍👩‍👧', name: '家长' }
    ];
    var demo = {
      teacher: [['teacher', '123456', '江江 美术教师']],
      student: [['a01', '123456', '刘文轩 A01'], ['a02', '123456', '李彦良 A02']],
      parent: [['pa01', '123456', '刘文轩家长'], ['pa02', '123456', '李彦良家长']]
    };
    return '' +
      '<div class="login-page">' +
        '<div class="login-art">' +
          '<div class="login-brand"><div class="mark">🎨</div><span>画室作业管家</span></div>' +
          '<div class="login-hero">' +
            '<h1>每天的色彩、素描、速写<br>都值得被认真记录</h1>' +
            '<p>教师收作业与评级、学生打卡上传、家长随时查看成长轨迹。三端同一个链接，手机电脑都能用。</p>' +
            '<div class="login-features">' +
              '<span>🎨 色彩 / ✏️ 素描 / 🖌️ 速写</span>' +
              '<span>每日完成数量与完成程度</span>' +
              '<span>ABCD 四级评定</span>' +
              '<span>专属个人作品集</span>' +
            '</div>' +
          '</div>' +
          '<div class="login-foot">© 2026 高二六班 · 美术作业管理平台</div>' +
        '</div>' +
        '<div class="login-panel"><div class="login-card">' +
          '<h2>欢迎回来</h2>' +
          '<p class="sub">请选择身份后登录系统</p>' +
          '<div class="role-tabs" id="roleTabs">' +
            roles.map(function (r) {
              return '<button class="role-tab' + (r.key === role ? ' active' : '') + '" data-role="' + r.key + '">' +
                '<span class="rt-ico">' + r.ico + '</span>' + r.name + '</button>';
            }).join('') +
          '</div>' +
          '<div id="loginErr"></div>' +
          '<div class="field"><label>账号</label>' +
            '<input class="input" id="acc" placeholder="请输入账号" autocomplete="username"></div>' +
          '<div class="field"><label>密码</label>' +
            '<input class="input" id="pwd" type="password" placeholder="请输入密码" autocomplete="current-password"></div>' +
          '<button class="btn lg block" id="loginBtn">登 录</button>' +
          '<div class="demo-box">' +
            '<div class="t">演示账号（点击自动填充，密码均为 123456）</div>' +
            '<div class="demo-accounts" id="demoAccounts">' +
              (demo[role] || []).map(function (d) {
                return '<button class="demo-chip" data-acc="' + d[0] + '" data-pwd="' + d[1] + '">' + d[0] + ' · ' + d[2] + '</button>';
              }).join('') +
            '</div>' +
          '</div>' +
        '<div class="login-hint" id="accHint" style="margin-top:12px;font-size:12px;color:#8a85a8;line-height:1.6"></div>' +
        '</div></div>' +
      '</div>';
  },
  mount: function () {
    var role = (typeof sessionStorage !== 'undefined') ? (sessionStorage.getItem('ahm_login_role') || 'teacher') : 'teacher';
    function updateHint(r) {
      var map = {
        teacher: '教师账号通常为 <code>teacher</code>，初始密码 123456。',
        student: '学生账号为<b>学号小写</b>，例如 <code>a01</code>（对应学号 A01）。',
        parent: '家长账号为学生学号前加 <code>p</code>，例如 <code>pa01</code>。'
      };
      var el = document.getElementById('accHint');
      if (el) el.innerHTML = '📌 ' + (map[r] || '');
    }
    updateHint(role);
    UI.els('#roleTabs .role-tab').forEach(function (b) {
      b.onclick = function () {
        sessionStorage.setItem('ahm_login_role', b.dataset.role);
        updateHint(b.dataset.role);
        App.render();
      };
    });
    UI.els('#demoAccounts .demo-chip').forEach(function (b) {
      b.onclick = function () {
        UI.el('#acc').value = b.dataset.acc;
        UI.el('#pwd').value = b.dataset.pwd;
      };
    });
    function doLogin() {
      var acc = UI.el('#acc').value.trim();
      var pwd = UI.el('#pwd').value;
      if (!acc || !pwd) { UI.el('#loginErr').innerHTML = '<div class="login-error">请输入账号和密码</div>'; return; }
      var res = Store.login(role, acc, pwd);
      if (!res.ok) { UI.el('#loginErr').innerHTML = '<div class="login-error">' + UI.esc(res.msg) + '</div>'; return; }
      // 首次登录强制改密码：完成前不进入系统
      if (Store.needsPasswordChange(res.user)) {
        forceChange(res.user, function () { location.hash = '#/home'; App.render(); });
        return;
      }
      UI.toast('登录成功，欢迎 ' + res.user.name, 'ok');
      location.hash = '#/home';
      App.render();
    }
    UI.el('#loginBtn').onclick = doLogin;
    UI.el('#pwd').onkeydown = function (e) { if (e.key === 'Enter') doLogin(); };
    UI.el('#acc').onkeydown = function (e) { if (e.key === 'Enter') UI.el('#pwd').focus(); };
  }
};

/* -------------------------------------------------- 工作台 */
Views.home = {
  title: '工作台',
  render: function (ctx) {
    return ctx.user.role === 'teacher' ? teacherHome(ctx)
      : ctx.user.role === 'student' ? studentHome(ctx) : parentHome(ctx);
  },
  mount: function (ctx) {
    UI.hydrateImages();
    UI.els('[data-go]').forEach(function (e) {
      e.onclick = function () { location.hash = e.dataset.go; };
    });
    if (ctx.user.role === 'teacher') bindQuickGrade();
  }
};

function greetText() {
  var h = new Date().getHours();
  return h < 6 ? '夜深了' : h < 11 ? '早上好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好';
}

function dateHeader() {
  var t = Store.todayStr();
  return t + ' 星期' + Store.weekdayCN(t);
}

/* 今日老师布置的作业（学生 / 家长首页展示），按白天 / 晚上分段 */
function todayTasksCard() {
  var today = Store.todayStr();
  var list = Store.assignmentsByDate(today);
  if (!list.length) return '';
  var me = Store.currentUser();
  var mySid = me ? me.studentId : null;
  var submitted = mySid ? Store.todaySubmitted(mySid, today) : {};

  function renderGroup(items) {
    if (!items.length) return '';
    return items.map(function (a) {
      var subs = (a.subjects || []).map(function (k) {
        var s = Store.subject(k);
        var c = (a.counts && a.counts[k] != null) ? a.counts[k] : null;
        var rec = submitted[k];
        var done = rec ? (rec.count || 0) : 0;
        var doneCls = (c && done >= c) ? ' done' : '';
        return '<span class="sub-chip' + doneCls + '">' + s.icon + ' ' + s.name +
          (c ? ' <b>' + c + ' 张</b>' : '') +
          (c ? ' <span class="chip-done">已交 ' + done + '</span>' : '') + '</span>';
      }).join('');
      return '<div class="task-mini' + (items.length > 1 ? ' section-gap' : '') + '">' +
        '<div class="row wrap" style="gap:6px;margin-bottom:4px">' + subs +
          '<span class="small muted">' + UI.esc(a.byName || '教师') + ' 布置</span></div>' +
        '<div style="font-weight:700">' + UI.esc(a.title) + '</div>' +
        (a.content ? '<div class="small">' + UI.esc(a.content) + '</div>' : '') +
        (a.requirement ? '<div class="small muted">📌 ' + UI.esc(a.requirement) + '</div>' : '') +
        '</div>';
    }).join('');
  }

  var day = list.filter(function (a) { return a.shift !== 'night'; });
  var night = list.filter(function (a) { return a.shift === 'night'; });
  var html = '';
  if (day.length) {
    html += '<div class="shift-block"><div class="shift-head">☀️ 白天 · 正常上课作业</div>' + renderGroup(day) + '</div>';
  }
  if (night.length) {
    html += '<div class="shift-block night"><div class="shift-head">🌙 晚上 · 加班作业</div>' + renderGroup(night) + '</div>';
  }
  return '<div class="card" style="margin-bottom:16px"><div class="card-head"><h3>📋 今日布置 · ' + dateHeader() + '</h3>' +
    '<div class="spacer"></div><button class="btn sm" data-go="#/submit">去交作业</button></div>' +
    '<div class="card-pad">' + html + '</div></div>';
}

/* 学生作业完成率卡片（按「张」计算，默认本周：应交张数 vs 已交张数） */
function completionCard(studentId, label) {
  var c = Store.completionRate(studentId);
  if (!c.hasAssign) return '';
  var pct = Math.round(c.rate * 100);
  var color = c.rate >= 1 ? 'var(--ok)' : 'var(--brand)';
  return '<div class="card completion-card section-gap"><div class="card-pad row wrap" style="gap:16px;align-items:center">' +
    '<div style="flex:1;min-width:200px">' +
      '<div class="row" style="gap:8px;margin-bottom:8px"><b style="font-size:16px">📊 ' + (label || '本周') + '作业完成度</b>' +
        '<span class="badge ' + (c.rate >= 1 ? 'ok' : 'warn') + '">' + (c.rate >= 1 ? '已达标' : '进行中') + '</span></div>' +
      UI.pctBar(c.rate, { barStyle: 'height:14px;border-radius:8px' }) +
    '</div>' +
    '<div style="text-align:right"><div style="font-size:22px;font-weight:800;color:' + color + '">' + c.submitted +
      '<span style="font-size:14px;font-weight:600;color:var(--text-3)"> / ' + c.assigned + '</span></div>' +
      '<div class="small muted">已交 / 应交 张数</div></div>' +
    '</div></div>';
}

/* ---- 教师工作台 ---- */
function teacherHome() {
  var today = Store.todayStr();
  var students = Store.allStudents();
  var todayRecs = Store.queryRecords({ date: today });
  var submittedIds = {};
  todayRecs.forEach(function (r) { submittedIds[r.studentId] = 1; });
  var submittedCount = Object.keys(submittedIds).length;
  var pending = Store.queryRecords({ status: 'pending' });
  var weekFrom = Store.weekStart(today);
  var weekRecs = Store.queryRecords({ from: weekFrom });
  var sum = Store.summarize(weekRecs);
  var comp = { assigned: 0, submitted: 0 };
  students.forEach(function (st) {
    var c = Store.completionRate(st.id);
    comp.assigned += c.assigned; comp.submitted += c.submitted;
  });
  var compRate = comp.assigned ? Math.round(comp.submitted / comp.assigned * 100) : 0;

  var days = Store.lastNDates(7);
  var series = Store.SUBJECTS.map(function (s) {
    return {
      name: s.name, color: s.color,
      data: days.map(function (d) {
        return Store.queryRecords({ date: d, subject: s.key }).reduce(function (a, r) { return a + r.count; }, 0);
      })
    };
  });

  var rank = students.map(function (st) {
    var rs = Store.queryRecords({ studentId: st.id, from: weekFrom });
    var s2 = Store.summarize(rs);
    return { st: st, n: rs.length, pieces: s2.pieces, score: s2.avgScore, grade: s2.avgGrade };
  }).sort(function (a, b) { return b.pieces - a.pieces || b.score - a.score; }).slice(0, 6);

  var missing = students.filter(function (s) { return !submittedIds[s.id]; });

  var html = '' +
    '<div class="row wrap" style="margin-bottom:16px">' +
      '<div><h2 style="font-size:20px">' + greetText() + '，王老师 👋</h2>' +
        '<div class="small muted">' + dateHeader() + '　·　今日已有 ' + submittedCount + '/' + students.length + ' 名学生提交作业</div></div>' +
      '<div class="spacer"></div>' +
      '<button class="btn ghost" data-go="#/tasks">布置作业</button>' +
      '<button class="btn soft" data-go="#/review">去批改 (' + pending.length + ')</button>' +
    '</div>' +

    '<div class="grid g-4">' +
      UI.statCard({ icon: '📥', bg: '#EDEBFB', fg: '#5A4FCF', value: submittedCount + '<small>/' + students.length + '</small>', label: '今日提交人数', trend: (students.length - submittedCount) + ' 人未交', trendColor: 'var(--warn)' }) +
      UI.statCard({ icon: '🖼️', bg: '#FFF1EA', fg: '#F97316', value: todayRecs.reduce(function (a, r) { return a + r.count; }, 0), unit: '张', label: '今日作业总量' }) +
      UI.statCard({ icon: '⏳', bg: '#FEF2F2', fg: '#EF4444', value: pending.length, unit: '条', label: '待批改作业' }) +
      UI.statCard({ icon: '⭐', bg: '#ECFDF5', fg: '#16A34A', value: sum.avgGrade || '–', label: '本周平均评级', trend: '完成度均值 ' + sum.avgProgress + '%' }) +
      UI.statCard({ icon: '📊', bg: '#EFF6FF', fg: '#2563EB', value: compRate + '%', label: '本周作业完成率', trend: '应交 ' + comp.assigned + ' 张 · 已交 ' + comp.submitted + ' 张', trendColor: compRate >= 100 ? 'var(--ok)' : 'var(--warn)' }) +
    '</div>' +

    '<div class="grid g-2-1 section-gap">' +
      '<div class="card"><div class="card-head"><h3>近 7 天三科作业量</h3><div class="spacer"></div>' +
        '<span class="hint">单位：张</span></div>' +
        '<div class="card-pad">' + Charts.bar({
          labels: days.map(function (d) { return Store.mmdd(d); }), series: series, height: 250
        }) + '</div></div>' +
      '<div class="card"><div class="card-head"><h3>本周评级分布</h3></div>' +
        '<div class="card-pad">' + Charts.donut({
          items: Store.GRADES.map(function (g) {
            return { label: g + ' · ' + Store.GRADE_TEXT[g], value: sum.byGrade[g], color: Store.GRADE_COLOR[g] };
          }),
          centerValue: sum.graded, centerLabel: '已批改'
        }) + '</div></div>' +
    '</div>' +

    '<div class="grid g-2-1 section-gap">' +
      '<div class="card"><div class="card-head"><h3>待批改（最新 5 条）</h3><div class="spacer"></div>' +
        '<button class="btn sm ghost" data-go="#/review">全部</button></div>' +
        (pending.length ? pending.slice(0, 5).map(pendingRow).join('') : UI.empty('全部批改完成', '当前没有待处理的作业', '🎉')) +
      '</div>' +
      '<div class="card"><div class="card-head"><h3>本周活跃榜</h3></div>' +
        (rank.length ? rank.map(function (r, i) {
          return '<div class="list-item">' +
            '<div style="width:22px;font-weight:800;color:' + (i < 3 ? '#F59E0B' : 'var(--text-3)') + '">' + (i + 1) + '</div>' +
            UI.avatar(r.st.name, r.st.color, 'sm') +
            '<div class="li-main"><b>' + UI.esc(r.st.name) + '</b><span>' + Store.className(r.st.classId) + '</span></div>' +
            '<div style="text-align:right"><b style="font-size:14px">' + r.pieces + '</b><div class="small muted">张 · ' + (r.grade || '–') + '</div></div>' +
            '</div>';
        }).join('') : UI.empty('暂无数据', '')) +
      '</div>' +
    '</div>' +

    (missing.length ? '<div class="card section-gap"><div class="card-head"><h3>今日未交名单</h3><div class="spacer"></div>' +
      '<span class="badge warn">' + missing.length + ' 人</span></div><div class="card-pad"><div class="row wrap">' +
      missing.map(function (s) {
        return '<span class="chip" data-go="#/portfolio?student=' + s.id + '">' + UI.esc(s.name) + ' · ' + Store.className(s.classId).slice(0, 6) + '</span>';
      }).join('') + '</div></div></div>' : '');

  return html;
}

function pendingRow(r) {
  var st = Store.getStudent(r.studentId) || { name: '未知', color: '#999' };
  return '<div class="list-item">' +
    UI.avatar(st.name, st.color, 'sm') +
    '<div class="li-main"><b>' + UI.esc(st.name) + ' ' + UI.subjectBadge(r.subject) + '</b>' +
    '<span>' + r.date + '　' + r.count + ' 张　完成度 ' + r.progress + '%</span></div>' +
    '<div class="grade-picker">' + Store.GRADES.map(function (g) {
      return '<button class="gp-btn ' + g + '" data-quick-grade="' + r.id + '" data-g="' + g + '">' + g + '</button>';
    }).join('') + '</div>' +
    '</div>';
}

function bindQuickGrade() {
  UI.els('[data-quick-grade]').forEach(function (b) {
    b.onclick = function () {
      Store.gradeRecord(b.dataset.quickGrade, b.dataset.g, undefined, (Store.currentUser() || {}).name);
      UI.toast('已评定为 ' + b.dataset.g + ' 级', 'ok');
      App.render();
    };
  });
}

/* ---- 学生工作台 ---- */
function studentHome(ctx) {
  var sid = ctx.user.studentId;
  var st = Store.getStudent(sid) || { name: ctx.user.name, color: '#5A4FCF', classId: '' };
  var today = Store.todayStr();
  var submitted = Store.todaySubmitted(sid, today);
  var streak = Store.streakDays(sid);
  var weekFrom = Store.weekStart(today);
  var weekRecs = Store.queryRecords({ studentId: sid, from: weekFrom });
  var sum = Store.summarize(weekRecs);
  var all = Store.queryRecords({ studentId: sid });
  var allSum = Store.summarize(all);
  var days = Store.lastNDates(7);
  var progressData = days.map(function (d) {
    var rs = Store.queryRecords({ studentId: sid, date: d });
    if (!rs.length) return 0;
    return Math.round(rs.reduce(function (a, r) { return a + r.progress; }, 0) / rs.length);
  });
  var comments = all.filter(function (r) { return r.teacherComment; }).slice(0, 3);
  var recentImgs = [];
  all.forEach(function (r) { (r.images || []).forEach(function (i) { if (recentImgs.length < 6) recentImgs.push({ id: i, r: r }); }); });

  return '' +
    '<div class="streak-banner" style="margin-bottom:16px">' +
      '<div><div class="sb-num">' + streak + '<span style="font-size:16px"> 天</span></div>' +
        '<div class="sb-txt">连续交作业，别断哦！</div></div>' +
      '<div class="spacer"></div>' +
      '<div style="text-align:right"><div class="sb-txt">本周 ' + sum.pieces + ' 张 · 累计 ' + allSum.pieces + ' 张</div>' +
        '<div class="sb-txt">平均评级 ' + (allSum.avgGrade || '暂无') + '</div></div>' +
    '</div>' +

    todayTasksCard() +

    completionCard(sid, '本周') +

    '<div class="card"><div class="card-head"><h3>今日打卡 · ' + dateHeader() + '</h3><div class="spacer"></div>' +
      '<button class="btn sm" data-go="#/submit">去交作业</button></div>' +
      '<div class="card-pad"><div class="checkin">' +
        Store.SUBJECTS.map(function (s) {
          var r = submitted[s.key];
          return '<div class="ci-item ' + (r ? 'done' : 'todo') + '" data-go="#/submit?subject=' + s.key + '">' +
            '<div class="ci-ico">' + s.icon + '</div><b>' + s.name + '</b>' +
            '<div class="ci-state">' + (r ? '已交 ' + r.count + ' 张 · ' + r.progress + '%' : '未提交') + '</div></div>';
        }).join('') +
      '</div></div></div>' +

    '<div class="grid g-4 section-gap">' +
      UI.statCard({ icon: '🎨', bg: '#FDF2F8', fg: '#EC4899', value: allSum.bySubject.color, unit: '张', label: '色彩累计' }) +
      UI.statCard({ icon: '✏️', bg: '#F1F5F9', fg: '#64748B', value: allSum.bySubject.sketch, unit: '张', label: '素描累计' }) +
      UI.statCard({ icon: '🖌️', bg: '#FFFBEB', fg: '#B45309', value: allSum.bySubject.quick, unit: '张', label: '速写累计' }) +
      UI.statCard({ icon: '🖼️', bg: '#EDEBFB', fg: '#5A4FCF', value: allSum.images, unit: '幅', label: '作品集图片' }) +
    '</div>' +

    '<div class="grid g-2-1 section-gap">' +
      '<div class="card"><div class="card-head"><h3>近 7 天完成度</h3><span class="spacer"></span><span class="hint">单位：%</span></div>' +
        '<div class="card-pad">' + Charts.line({ labels: days.map(function (d) { return Store.mmdd(d); }), data: progressData, max: 100, suffix: '' }) + '</div></div>' +
      '<div class="card"><div class="card-head"><h3>我的评级分布</h3></div><div class="card-pad">' +
        Charts.donut({
          items: Store.GRADES.map(function (g) { return { label: g, value: allSum.byGrade[g], color: Store.GRADE_COLOR[g] }; }),
          centerValue: allSum.avgGrade || '–', centerLabel: '平均评级'
        }) + '</div></div>' +
    '</div>' +

    '<div class="grid g-2 section-gap">' +
      '<div class="card"><div class="card-head"><h3>老师最新评语</h3></div>' +
        (comments.length ? '<div class="card-pad">' + comments.map(function (r) {
          return '<div style="margin-bottom:12px">' +
            '<div class="row small muted">' + UI.subjectBadge(r.subject) + '<span>' + r.date + '</span>' + UI.gradeBadge(r.grade) + '</div>' +
            '<div class="comment-line">' + UI.esc(r.teacherComment) + '</div></div>';
        }).join('') + '</div>' : UI.empty('暂无评语', '交了作业老师就会来点评啦', '💬')) +
      '</div>' +
      '<div class="card"><div class="card-head"><h3>最近作品</h3><div class="spacer"></div>' +
        '<button class="btn sm ghost" data-go="#/portfolio">作品集</button></div>' +
        '<div class="card-pad">' + (recentImgs.length ?
          '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">' + recentImgs.map(function (x) {
            return '<div class="thumb" style="width:100%;height:82px"><img data-img-id="' + x.id + '" alt=""></div>';
          }).join('') + '</div>' : UI.empty('还没有作品', '上传作业照片即可生成作品集', '🖼️')) +
        '</div></div>' +
    '</div>';
}

/* ---- 家长工作台 ---- */
function parentHome(ctx) {
  var sid = ctx.user.studentId;
  var st = Store.getStudent(sid);
  if (!st) return UI.empty('未绑定学生', '请联系老师为该家长账号绑定学生');
  var today = Store.todayStr();
  var submitted = Store.todaySubmitted(sid, today);
  var all = Store.queryRecords({ studentId: sid });
  var allSum = Store.summarize(all);
  var weekRecs = Store.queryRecords({ studentId: sid, from: Store.weekStart(today) });
  var weekSum = Store.summarize(weekRecs);
  var days = Store.lastNDates(7);
  var series = Store.SUBJECTS.map(function (s) {
    return {
      name: s.name, color: s.color,
      data: days.map(function (d) {
        var r = Store.findRecord(sid, d, s.key);
        return r ? r.count : 0;
      })
    };
  });
  var comments = all.filter(function (r) { return r.teacherComment; }).slice(0, 4);

  return '' +
    '<div class="card" style="margin-bottom:16px"><div class="card-pad row wrap" style="gap:14px">' +
      UI.avatar(st.name, st.color, 'lg') +
      '<div><div style="font-size:17px;font-weight:700">' + UI.esc(st.name) + '</div>' +
        '<div class="small muted">' + Store.className(st.classId) + '　学号 ' + UI.esc(st.no) + '　入学 ' + st.joinedAt + '</div></div>' +
      '<div class="spacer"></div>' +
      '<div class="row wrap">' + Store.SUBJECTS.map(function (s) {
        var r = submitted[s.key];
        return '<span class="badge ' + (r ? 'ok' : 'warn') + '">' + s.icon + ' ' + s.name + (r ? ' 已交' : ' 未交') + '</span>';
      }).join('') + '</div>' +
    '</div></div>' +

    todayTasksCard() +

    completionCard(sid, '本周') +

    attendanceHomeCard(sid) +

    gradeTrendHomeCards(sid) +

    '<div class="grid g-4">' +
      UI.statCard({ icon: '📅', bg: '#EDEBFB', fg: '#5A4FCF', value: Store.streakDays(sid), unit: '天', label: '连续打卡' }) +
      UI.statCard({ icon: '🖼️', bg: '#FFF1EA', fg: '#F97316', value: weekSum.pieces, unit: '张', label: '本周完成量' }) +
      UI.statCard({ icon: '📈', bg: '#ECFDF5', fg: '#16A34A', value: weekSum.avgProgress + '%', label: '本周平均完成度' }) +
      UI.statCard({ icon: '⭐', bg: '#EFF6FF', fg: '#2563EB', value: allSum.avgGrade || '–', label: '累计平均评级', trend: '共 ' + allSum.graded + ' 次评定' }) +
    '</div>' +

    '<div class="grid g-2-1 section-gap">' +
      '<div class="card"><div class="card-head"><h3>近 7 天完成情况</h3></div><div class="card-pad">' +
        Charts.bar({ labels: days.map(function (d) { return Store.mmdd(d) + ' 周' + Store.weekdayCN(d); }), series: series, height: 240 }) +
      '</div></div>' +
      '<div class="card"><div class="card-head"><h3>评级分布</h3></div><div class="card-pad">' +
        Charts.donut({
          items: Store.GRADES.map(function (g) { return { label: g + ' · ' + Store.GRADE_TEXT[g], value: allSum.byGrade[g], color: Store.GRADE_COLOR[g] }; }),
          centerValue: allSum.avgGrade || '–', centerLabel: '平均'
        }) + '</div></div>' +
    '</div>' +

    '<div class="card section-gap"><div class="card-head"><h3>老师评语记录</h3><div class="spacer"></div>' +
      '<button class="btn sm ghost" data-go="#/portfolio">看作品集</button></div>' +
      (comments.length ? '<div class="card-pad">' + comments.map(function (r) {
        return '<div style="margin-bottom:12px"><div class="row small muted">' + UI.subjectBadge(r.subject) +
          '<span>' + r.date + '</span>' + UI.gradeBadge(r.grade) + '<span>' + UI.esc(r.reviewedBy || '') + '</span></div>' +
          '<div class="comment-line">' + UI.esc(r.teacherComment) + '</div></div>';
      }).join('') + '</div>' : UI.empty('暂无评语', '', '💬')) +
    '</div>';
}

/* 家长首页：今日出勤概览（状态 / 到班时间 / 迟到时长） */
function attendanceHomeCard(sid) {
  var st = Store.getStudent(sid);
  var today = Store.todayStr();
  var summary = Store.studentLateSummary(sid);
  var arrival = Store.studentArrivalToday(sid);
  var todayRecs = (Store.attendanceList() || []).filter(function (a) { return a.studentId === sid && a.date === today; });
  var status = (function () {
    if (todayRecs.some(function (a) { return a.status === 'late'; })) return { label: '迟到', cls: 'warn' };
    if (todayRecs.some(function (a) { return a.status === 'leave'; })) return { label: '请假', cls: 'danger' };
    if (todayRecs.some(function (a) { return a.status === 'present' && a.arrivedAt; })) return { label: '正常到班', cls: 'ok' };
    return { label: '未记录', cls: 'muted' };
  })();
  var arrivalTxt = arrival ? (UI.fmtTime(arrival.arrivedAt) + (arrival.status === 'late' ? '（迟到 ' + (arrival.lateMinutes || 0) + ' 分）' : ' 准时')) : '—';
  return '<div class="card section-gap"><div class="card-head"><h3>🚪 今日出勤</h3>' +
    '<div class="spacer"></div><button class="btn sm ghost" data-go="#/attendance">查看详情</button></div>' +
    '<div class="card-pad"><div class="row wrap" style="gap:14px;align-items:center">' +
      '<span class="badge ' + status.cls + '">' + status.label + '</span>' +
      '<div class="small">到班时间：<b>' + arrivalTxt + '</b></div>' +
      '<div class="spacer"></div>' +
      '<div class="row" style="gap:16px">' +
        '<div><div style="font-size:18px;font-weight:800;color:#EF4444">' + summary.count + '</div><div class="small muted">累计迟到(次)</div></div>' +
        '<div><div style="font-size:18px;font-weight:800;color:#DC2626">' + summary.minutes + '</div><div class="small muted">迟到时长(分)</div></div>' +
      '</div>' +
    '</div></div></div>';
}

/* 家长首页：总成绩走势（文化课 / 专业课），点击进入成绩页查看详情 */
function gradeTrendHomeCards(sid) {
  function mini(trend, name, color) {
    var labels = [], data = [];
    trend.labels.forEach(function (l, i) { if (trend.data[i] != null) { labels.push(l); data.push(trend.data[i]); } });
    return '<div class="card clickable" data-go="#/grades">' +
      '<div class="card-head"><h3>' + name + '总走势</h3><div class="spacer"></div><span class="hint">点击查看 ▸</span></div>' +
      '<div class="card-pad">' + (labels.length ? Charts.line({ labels: labels, data: data, max: 100, suffix: ' 分' }) : UI.empty('暂无成绩', '', '📊')) + '</div></div>';
  }
  var cult = Store.studentCultureTotalTrend(sid);
  var prof = Store.studentProfTotalTrend(sid);
  return '<div class="grid g-2 section-gap">' +
    mini(cult, '📚 文化课', '#2563EB') +
    mini(prof, '🎨 专业课', '#5A4FCF') +
    '</div>';
}

/* -------------------------------------------------- 交作业（学生） */
Views.submit = {
  title: '交作业',
  render: function (ctx) {
    var sid = ctx.user.studentId;
    var q = App.query();
    var today = Store.todayStr();
    var date = q.date || today;
    var mySubs = Store.studentSubjects(sid);
    var subj = (q.subject && mySubs.indexOf(q.subject) >= 0) ? q.subject : (mySubs[0] || 'color');
    var shiftPick = q.shift === 'night' ? 'night' : 'day';
    var exist = Store.findRecord(sid, date, subj, shiftPick);
    var submitted = Store.todaySubmitted(sid, date);
    var sh = Store.shift(shiftPick);

    return '' +
      '<div class="card" style="margin-bottom:14px"><div class="card-pad">' +
        '<div class="field"><label>作业日期</label>' +
          '<input class="input" type="date" id="sbDate" value="' + date + '" max="' + today + '"></div>' +
        '<div class="field"><label>时段</label>' +
          '<div class="seg" id="sbShift">' +
            Store.SHIFTS.map(function (s) {
              return '<div class="seg-item ' + (s.key === shiftPick ? 'on' : '') + '" data-shit="' + s.key + '">' + s.icon + ' ' + s.short + '</div>';
            }).join('') +
          '</div></div>' +
        '<div class="field"><label>选择科目</label><div class="subject-pick" id="sbSubject">' +
          Store.studentSubjects(sid).map(function (key) {
            var s = Store.subject(key);
            var done = submitted[key];
            return '<div class="sp-item ' + (key === subj ? 'on ' : '') + (done ? 'done' : '') + '" data-sub="' + key + '">' +
              '<div class="sp-ico">' + s.icon + '</div><b>' + s.name + '</b>' +
              '<span>' + (done ? '已交 ' + done.count + ' 张' : '未提交') + '</span></div>';
          }).join('') + '</div></div>' +
      '</div></div>' +

      '<div class="card"><div class="card-head"><h3>' + sh.icon + ' ' + sh.short + ' · ' + Store.subject(subj).icon + ' ' + Store.subject(subj).name +
        ' 作业' + (exist ? '（修改已提交内容）' : '') + '</h3></div><div class="card-pad">' +
        (function () {
          var list = Store.assignmentsByDate(date).filter(function (a) { return (a.subjects || []).indexOf(subj) >= 0 && a.shift === shiftPick; });
          if (!list.length) return '';
          var want = list[0].counts && list[0].counts[subj] != null ? list[0].counts[subj] : null;
          return '<div class="assign-hint">📋 老师布置（' + sh.short + '）：' + Store.subject(subj).name +
            (want ? ' <b>' + want + ' 张</b>（应完成）' : ' 若干张') +
            (list[0].requirement ? '　·　要求：' + UI.esc(list[0].requirement) : '') + '</div>';
        })() +

        '<div class="field"><label>完成数量（张）</label>' +
          '<div class="stepper"><button type="button" id="cMinus">−</button>' +
          '<input id="sbCount" type="number" min="1" max="99" value="' + (exist ? exist.count : 1) + '">' +
          '<button type="button" id="cPlus">＋</button></div></div>' +

        '<div class="field"><label>完成程度 <b id="progVal" style="color:var(--brand)">' + (exist ? exist.progress : 80) + '%</b> ' +
          '<span class="small muted" id="progTxt"></span></label>' +
          '<input type="range" id="sbProgress" min="10" max="100" step="5" value="' + (exist ? exist.progress : 80) + '">' +
          '<div class="row" style="gap:8px;margin-top:10px">' +
            [25, 50, 75, 100].map(function (v) { return '<button class="chip" data-prog="' + v + '">' + v + '%</button>'; }).join('') +
          '</div></div>' +

        '<div class="field"><label>作业照片（可多张，手机可直接拍照）</label>' +
          '<div class="uploader" id="upBox"><div class="u-ico">📸</div>' +
            '<b>点击上传 / 拍照</b><span>支持 JPG、PNG，自动压缩后保存</span></div>' +
          '<input type="file" id="upInput" accept="image/*" multiple class="hidden">' +
          '<div class="thumbs" id="upThumbs"></div></div>' +

        '<div class="field"><label>作业备注（可选）</label>' +
          '<textarea class="textarea" id="sbNote" placeholder="例如：色彩静物一张，用时 90 分钟，冷色调练习">' + UI.esc(exist ? exist.note : '') + '</textarea></div>' +

        '<button class="btn lg block" id="sbSave">' + (exist ? '更新作业' : '提交作业') + '</button>' +
        (exist && exist.grade ? '<div class="comment-line" style="margin-top:14px"><b>老师评级 ' + exist.grade + '（' + Store.GRADE_TEXT[exist.grade] + '）</b>' +
          (exist.teacherComment ? '<br>' + UI.esc(exist.teacherComment) : '') + '</div>' : '') +
      '</div></div>' +

      '<div class="card section-gap"><div class="card-head"><h3>' + date + ' 已交记录</h3></div>' +
        (Object.keys(submitted).length ? Object.keys(submitted).map(function (k) {
          var r = submitted[k];
          return '<div class="list-item">' + UI.subjectBadge(r.subject) +
            '<div class="li-main"><b>' + r.count + ' 张 · 完成度 ' + r.progress + '%</b>' +
            '<span>' + ((r.images || []).length ? (r.images.length + ' 张照片') : '未上传照片') + (r.note ? '　' + UI.esc(r.note) : '') + '</span></div>' +
            UI.gradeBadge(r.grade) +
            '<button class="icon-btn" data-del-rec="' + r.id + '">🗑</button></div>';
        }).join('') : UI.empty('今天还没有交作业', '选择科目后填写并提交', '📝')) +
      '</div>';
  },
  mount: function (ctx) {
    var sid = ctx.user.studentId;
    var q = App.query();
    var date = q.date || Store.todayStr();
    var subj = q.subject || 'color';
    var shiftPick = q.shift === 'night' ? 'night' : 'day';
    var exist = Store.findRecord(sid, date, subj, shiftPick);
    var images = exist ? (exist.images || []).slice() : [];

    function renderThumbs() {
      var box = UI.el('#upThumbs');
      box.innerHTML = images.map(function (id) {
        return '<div class="thumb"><img data-img-id="' + id + '" alt=""><button class="rm" data-rm="' + id + '">✕</button></div>';
      }).join('');
      UI.hydrateImages(box);
      UI.els('[data-rm]', box).forEach(function (b) {
        b.onclick = function (e) {
          e.stopPropagation();
          images = images.filter(function (i) { return i !== b.dataset.rm; });
          renderThumbs();
        };
      });
    }
    renderThumbs();

    UI.el('#sbDate').onchange = function () { App.go('#/submit?date=' + this.value + '&subject=' + subj + '&shift=' + shiftPick); };
    UI.els('#sbShift .seg-item').forEach(function (d) {
      d.onclick = function () { App.go('#/submit?date=' + date + '&subject=' + subj + '&shift=' + d.dataset.shit); };
    });
    UI.els('#sbSubject .sp-item').forEach(function (d) {
      d.onclick = function () { App.go('#/submit?date=' + date + '&subject=' + d.dataset.sub + '&shift=' + shiftPick); };
    });

    var cnt = UI.el('#sbCount');
    UI.el('#cMinus').onclick = function () { cnt.value = Math.max(1, (+cnt.value || 1) - 1); };
    UI.el('#cPlus').onclick = function () { cnt.value = Math.min(99, (+cnt.value || 1) + 1); };

    var range = UI.el('#sbProgress');
    function progText(v) {
      return v >= 100 ? '完整完成' : v >= 80 ? '基本完成' : v >= 50 ? '完成过半' : v >= 30 ? '刚开了个头' : '起稿阶段';
    }
    function syncProg() {
      UI.el('#progVal').textContent = range.value + '%';
      UI.el('#progTxt').textContent = '· ' + progText(+range.value);
    }
    range.oninput = syncProg; syncProg();
    UI.els('[data-prog]').forEach(function (b) {
      b.onclick = function () { range.value = b.dataset.prog; syncProg(); };
    });

    UI.el('#upBox').onclick = function () {
      uploadHomeworkPhotos(sid, date, subj).then(function (ids) {
        images = images.concat(ids);
        renderThumbs();
        UI.toast('图片已添加', 'ok');
      });
    };

    UI.el('#sbSave').onclick = function () {
      var payload = {
        studentId: sid, date: date, subject: subj, shift: shiftPick,
        count: Math.max(1, +cnt.value || 1),
        progress: +range.value,
        note: UI.el('#sbNote').value.trim(),
        images: images
      };
      Store.upsertRecord(payload);
      UI.toast(exist ? '作业已更新' : '作业提交成功，等待老师评级', 'ok');
      App.go('#/submit?date=' + date + '&subject=' + subj + '&shift=' + shiftPick);
    };

    UI.els('[data-del-rec]').forEach(function (b) {
      b.onclick = function () {
        UI.confirm('删除作业记录', '删除后该科目当天的记录与照片将一并移除，确定吗？', function () {
          Store.deleteRecord(b.dataset.delRec);
          UI.toast('已删除', 'ok');
          App.render();
        }, true);
      };
    });
  }
};

/* -------------------------------------------------- 上传作业图片（学生交作业 / 老师代交 共用）
   图片以「内联 data URL」形式存入记录：随云端 main 行同步，任意设备（手机/电脑）打开都直接显示，
   不再依赖 Supabase Storage 的公开访问权限（旧版存 Storage URL，私密桶/未公开时图片加载失败）。
   r.thumb 为压缩后的缩略图 data URL，体积可控、展示足够清晰。 */
function uploadHomeworkPhotos(sid, date, subj) {
  var input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*'; input.multiple = true;
  return new Promise(function (resolve) {
    input.onchange = function () {
      var files = Array.prototype.slice.call(input.files || []);
      if (!files.length) { resolve([]); return; }
      UI.toast('正在处理 ' + files.length + ' 张图片…');
      Promise.all(files.map(function (f) {
        return DB.compress(f, 1280, 0.82).then(function (r) {
          return r.thumb; // 直接以内联 data URL 作为图片标识，跨设备稳定显示
        });
      })).then(resolve).catch(function () { UI.toast('图片处理失败，请重试', 'err'); resolve([]); });
    };
    input.click();
  });
}

/* -------------------------------------------------- 老师代交作业（代替学生上传作品） */
function openTeacherUpload(studentId) {
  var students = Store.allStudents();
  var sid = studentId || (students[0] && students[0].id) || '';
  if (!sid) { UI.toast('请先在学生管理添加学生', 'err'); return; }
  var today = Store.todayStr();
  var tuImages = [];
  var tuSubj = 'color';
  var tuShift = 'day';

  var body =
    '<div class="field"><label>学生</label>' +
      (studentId
        ? '<div class="small" style="padding:4px 0;font-weight:600">' + UI.esc(Store.getStudent(sid) ? Store.getStudent(sid).name : '') + '</div>'
        : '<select class="select" id="tuSt" style="width:100%;padding:9px 12px">' +
            students.map(function (s) {
              return '<option value="' + s.id + '"' + (s.id === sid ? ' selected' : '') + '>' + UI.esc(s.name) + '（' + UI.esc(Store.className(s.classId)) + '）</option>';
            }).join('') + '</select>') +
    '</div>' +
    '<div class="field"><label>作业日期</label><input class="input" type="date" id="tuDate" value="' + today + '" max="' + today + '"></div>' +
    '<div class="field"><label>科目</label><div class="subject-pick" id="tuSubj">' +
      Store.SUBJECTS.map(function (s) {
        return '<div class="sp-item' + (s.key === 'color' ? ' on' : '') + '" data-sub="' + s.key + '"><div class="sp-ico">' + s.icon + '</div><b>' + s.name + '</b></div>';
      }).join('') +
    '</div></div>' +
    '<div class="field"><label>时段</label><div class="seg" id="tuShift">' +
      Store.SHIFTS.map(function (s) {
        return '<div class="seg-item' + (s.key === 'day' ? ' on' : '') + '" data-shift="' + s.key + '">' + s.icon + ' ' + s.short + '</div>';
      }).join('') +
    '</div></div>' +
    '<div class="field"><label>完成数量（张）</label><div class="stepper"><button type="button" id="tuMinus">−</button>' +
      '<input id="tuCount" type="number" min="1" max="99" value="1"><button type="button" id="tuPlus">＋</button></div></div>' +
    '<div class="field"><label>完成程度 <b id="tuProgVal" style="color:var(--brand)">80%</b></label>' +
      '<input type="range" id="tuProg" min="10" max="100" step="5" value="80"></div>' +
    '<div class="field"><label>作业照片（可多张，手机可拍照）</label>' +
      '<div class="uploader" id="tuUp"><div class="u-ico">📸</div><b>点击上传 / 拍照</b><span>支持 JPG、PNG，自动压缩后保存</span></div>' +
      '<div class="thumbs" id="tuThumbs"></div></div>' +
    '<div class="field"><label>作业备注（可选）</label><textarea class="textarea" id="tuNote" placeholder="例如：色彩静物一张，用时 90 分钟"></textarea></div>';

  UI.modal({
    title: '代交作业',
    okText: '提交',
    body: body,
    onMount: function (m) {
      function renderThumbs() {
        var box = UI.el('#tuThumbs', m); if (!box) return;
        box.innerHTML = tuImages.map(function (id) {
          return '<div class="thumb"><img data-img-id="' + id + '" alt=""><button class="rm" data-rm="' + id + '">✕</button></div>';
        }).join('');
        UI.hydrateImages(box);
        UI.els('[data-rm]', box).forEach(function (b) {
          b.onclick = function (e) { e.stopPropagation(); tuImages = tuImages.filter(function (i) { return i !== b.dataset.rm; }); renderThumbs(); };
        });
      }
      renderThumbs();
      UI.els('#tuSubj .sp-item', m).forEach(function (d) {
        d.onclick = function () {
          UI.els('#tuSubj .sp-item', m).forEach(function (x) { x.classList.remove('on'); });
          d.classList.add('on'); tuSubj = d.dataset.sub;
        };
      });
      UI.els('#tuShift .seg-item', m).forEach(function (d) {
        d.onclick = function () {
          UI.els('#tuShift .seg-item', m).forEach(function (x) { x.classList.remove('on'); });
          d.classList.add('on'); tuShift = d.dataset.shift;
        };
      });
      var cnt = UI.el('#tuCount', m);
      UI.el('#tuMinus', m).onclick = function () { cnt.value = Math.max(1, (+cnt.value || 1) - 1); };
      UI.el('#tuPlus', m).onclick = function () { cnt.value = Math.min(99, (+cnt.value || 1) + 1); };
      var range = UI.el('#tuProg', m);
      range.oninput = function () { UI.el('#tuProgVal', m).textContent = range.value + '%'; };
      UI.el('#tuUp', m).onclick = function () {
        uploadHomeworkPhotos(sid, UI.el('#tuDate', m).value, tuSubj).then(function (ids) {
          tuImages = tuImages.concat(ids); renderThumbs(); UI.toast('图片已添加', 'ok');
        });
      };
    },
    onOk: function (m) {
      var pickSid = studentId ? sid : UI.el('#tuSt', m).value;
      if (!pickSid) { UI.toast('请选择学生', 'err'); return false; }
      var date = UI.el('#tuDate', m).value || today;
      var subjEl = m.querySelector('#tuSubj .sp-item.on');
      var subj = subjEl ? subjEl.dataset.sub : 'color';
      var exist = Store.findRecord(pickSid, date, subj);
      var finalImages = exist ? (exist.images || []).concat(tuImages) : tuImages;
      Store.upsertRecord({
        studentId: pickSid, date: date, subject: subj, shift: tuShift,
        count: Math.max(1, +UI.el('#tuCount', m).value || 1),
        progress: +UI.el('#tuProg', m).value,
        note: UI.el('#tuNote', m).value.trim(),
        images: finalImages
      });
      UI.toast(exist ? '作业已更新' : '已代交作业', 'ok');
      App.render();
    }
  });
}

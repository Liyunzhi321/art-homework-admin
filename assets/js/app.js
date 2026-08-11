/* ============================================================
   App - 路由 / 外壳 / 启动
   ============================================================ */
var App = (function () {

  var NAV = {
    teacher: [
      { route: 'home', name: '工作台', icon: '📊' },
      { route: 'tasks', name: '布置作业', icon: '📋' },
      { route: 'review', name: '作业批改', icon: '✅', badge: 'pending' },
      { route: 'students', name: '学生管理', icon: '🎒' },
      { route: 'attendance', name: '考勤', icon: '🕒' },
      { route: 'grades', name: '成绩', icon: '🏆' },
      { route: 'portfolio', name: '作品集', icon: '🖼️' },
      { route: 'stats', name: '数据统计', icon: '📈' },
      { route: 'me', name: '我的', icon: '👤' }
    ],
    student: [
      { route: 'home', name: '首页', icon: '🏠' },
      { route: 'submit', name: '交作业', icon: '📝' },
      { route: 'records', name: '作业记录', icon: '📒' },
      { route: 'portfolio', name: '作品集', icon: '🖼️' },
      { route: 'grades', name: '成绩', icon: '🏆' },
      { route: 'me', name: '我的', icon: '👤' }
    ],
    parent: [
      { route: 'home', name: '首页', icon: '🏠' },
      { route: 'records', name: '作业记录', icon: '📒' },
      { route: 'portfolio', name: '作品集', icon: '🖼️' },
      { route: 'grades', name: '成绩', icon: '🏆' },
      { route: 'attendance', name: '出勤', icon: '🕒' },
      { route: 'stats', name: '统计', icon: '📈' },
      { route: 'me', name: '我的', icon: '👤' }
    ]
  };

  var TITLES = {
    home: { teacher: '工作台', student: '我的首页', parent: '孩子概览' },
    review: { teacher: '作业批改' },
    tasks: { teacher: '布置作业' },
    students: { teacher: '学生管理' },
    attendance: { teacher: '考勤', parent: '孩子出勤' },
    grades: { teacher: '成绩统计', student: '我的成绩', parent: '孩子成绩' },
    submit: { student: '交作业' },
    records: { student: '我的作业记录', parent: '孩子作业记录' },
    portfolio: { teacher: '学生作品集', student: '我的作品集', parent: '孩子作品集' },
    stats: { teacher: '数据统计', student: '我的统计', parent: '数据统计' },
    me: { teacher: '个人中心', student: '个人中心', parent: '个人中心' }
  };

  /* ---------- 路由解析 ---------- */
  function parseHash() {
    var h = location.hash.replace(/^#\/?/, '');
    var qi = h.indexOf('?');
    var path = qi >= 0 ? h.slice(0, qi) : h;
    var qs = qi >= 0 ? h.slice(qi + 1) : '';
    var q = {};
    qs.split('&').forEach(function (kv) {
      if (!kv) return;
      var p = kv.split('=');
      q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
    });
    return { path: path || 'home', query: q };
  }
  function query() { return parseHash().query; }
  function setQuery(k, v) {
    var r = parseHash();
    r.query[k] = v;
    if (v === '' || v === null || v === undefined) delete r.query[k];
    var qs = Object.keys(r.query).map(function (x) {
      return encodeURIComponent(x) + '=' + encodeURIComponent(r.query[x]);
    }).join('&');
    location.hash = '#/' + r.path + (qs ? '?' + qs : '');
  }
  function go(h) {
    if (location.hash === h) render(); else location.hash = h;
  }

  /* ---------- 渲染 ---------- */
  // 顶栏同步状态：显示最近一次与云端成功同步的时间
  function syncChipHTML() {
    var ts = Cloud.lastSync();
    var txt = ts ? ('已同步 ' + UI.fmtTime(ts)) : '同步中…';
    return '<span class="sync-chip" style="font-size:12px;color:var(--text-3);display:flex;align-items:center;gap:4px;white-space:nowrap">☁️ ' + UI.esc(txt) + '</span>';
  }

  function render() {
    var root = document.getElementById('app');
    var user = Store.currentUser();
    var r = parseHash();

    if (!user) {
      root.innerHTML = Views.login.render();
      Views.login.mount();
      return;
    }

    var nav = NAV[user.role] || NAV.student;
    var allowed = nav.map(function (n) { return n.route; });
    var path = r.path;
    if (allowed.indexOf(path) < 0) {
      path = 'home';
      location.hash = '#/home';
    }
    var view = Views[path] || Views.home;
    var ctx = { user: user, query: r.query, path: path };
    var pendingCount = user.role === 'teacher' ? Store.queryRecords({ status: 'pending' }).length : 0;

    var titleMap = TITLES[path] || {};
    var title = titleMap[user.role] || view.title || '';

    root.innerHTML =
      '<div class="shell">' +
        sidebar(user, nav, path, pendingCount) +
        '<div class="main">' +
          '<div class="topbar">' +
            '<div><h1>' + UI.esc(title) + '</h1>' +
              '<div class="tb-sub">' + UI.esc(Store.data().settings.schoolName) + '　' + Store.todayStr() + ' 周' + Store.weekdayCN(Store.todayStr()) + '</div></div>' +
            '<div class="spacer"></div>' +
            (user.role === 'student' && path !== 'submit' ? '<button class="btn sm" data-nav="submit">＋ 交作业</button>' : '') +
            (user.role === 'teacher' && path !== 'review' && pendingCount ? '<button class="btn sm" data-nav="review">待批改 ' + pendingCount + '</button>' : '') +
            (window.Cloud && Cloud.ready() ? syncChipHTML() : '') +
            '<div data-nav="me" style="cursor:pointer">' + UI.avatar(user.name, '#5A4FCF', '', user.avatar) + '</div>' +
          '</div>' +
          '<div class="content" id="viewRoot"></div>' +
        '</div>' +
        mobileNav(nav, path, pendingCount) +
      '</div>';

    var vr = document.getElementById('viewRoot');
    vr.innerHTML = view.render(ctx);
    if (view.mount) view.mount(ctx);

    UI.els('[data-nav]').forEach(function (b) {
      b.onclick = function () { go('#/' + b.dataset.nav); };
    });
    UI.els('[data-go]').forEach(function (b) {
      if (!b.onclick) b.onclick = function () { location.hash = b.dataset.go; };
    });
    window.scrollTo(0, 0);
  }

  function sidebar(user, nav, path, pending) {
    var st = user.studentId ? Store.getStudent(user.studentId) : null;
    return '<aside class="sidebar">' +
      '<div class="side-brand"><div class="mark">🎨</div>' +
        '<div class="txt"><b>画室作业管家</b><span>美术作业管理系统</span></div></div>' +
      '<nav class="side-nav">' +
        '<div class="group-title">' + Store.ROLE_TEXT[user.role] + '功能</div>' +
        nav.map(function (n) {
          return '<div class="nav-item' + (n.route === path ? ' active' : '') + '" data-nav="' + n.route + '">' +
            '<span class="ni-ico">' + n.icon + '</span><span>' + n.name + '</span>' +
            (n.badge === 'pending' && pending ? '<span class="badge-dot">' + pending + '</span>' : '') +
          '</div>';
        }).join('') +
      '</nav>' +
      '<div class="side-user">' + UI.avatar(user.name, st ? st.color : '#5A4FCF', 'sm', user.avatar) +
        '<div class="meta"><b>' + UI.esc(user.name) + '</b>' +
          '<span>' + Store.ROLE_TEXT[user.role] + (st ? ' · ' + UI.esc(st.no) : '') + '</span></div>' +
        '<button class="icon-btn" id="sideLogout" title="退出登录">⏻</button>' +
      '</div>' +
    '</aside>';
  }

  function mobileNav(nav, path, pending) {
    var items = nav;
    return '<nav class="mobile-nav">' +
      items.map(function (n) {
        return '<div class="mnav-item' + (n.route === path ? ' active' : '') + '" data-nav="' + n.route + '">' +
          '<span class="mi-ico">' + n.icon + '</span><span>' + n.name + '</span>' +
          (n.badge === 'pending' && pending ? '<span class="badge-dot">' + pending + '</span>' : '') +
        '</div>';
      }).join('') +
    '</nav>';
  }

  /* ---------- 启动 ---------- */
  function boot() {
    if (window.Cloud) Cloud.init();
    Store.load();
    Store.migrateInlineImages().then(function (n) { if (n > 0) render(); });
    if (!location.hash) location.hash = Store.currentUser() ? '#/home' : '#/login';
    window.addEventListener('hashchange', function () {
      try { render(); } catch (e) { console.error('render error:', e); }
    });
    render();
    // 云端同步：首次拉取 + 定时/切回前台时刷新，保证多设备共享同一份数据
    if (window.Cloud && Cloud.ready()) {
      Cloud.load().then(function (res) {
        if (res && res.payload && res.payload.users) {
          Store.merge(res.payload); render();
          Store.migrateInlineImages().then(function (n) { if (n > 0) render(); });
        } else if (Store.hasRealData && Store.hasRealData()) {
          // 云端为空但本机有真实数据 → 作为共享基线推上去（恢复）
          Cloud.save(Store.data(), new Date().toISOString());
        }
        // 云端空且本机也无真实数据：保持云端为空，等待有数据的设备恢复，避免用空壳覆盖
      });
      function syncTick() {
        Store.syncFromCloud().then(function (ts) {
          var modalOpen = document.getElementById('modal-root') && document.getElementById('modal-root').children.length;
          if (ts && !modalOpen) render();
        });
        Store.migrateInlineImages().then(function (n) { if (n > 0) render(); });
      }
      setInterval(syncTick, 30000);
      document.addEventListener('visibilitychange', function () { if (!document.hidden) syncTick(); });
    }
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('#sideLogout');
      if (t) {
        UI.confirm('退出登录', '确定要退出当前账号吗？', function () {
          Store.logout(); location.hash = '#/login'; render();
        });
      }
    });
  }

  return { boot: boot, render: render, query: query, setQuery: setQuery, go: go };
})();

document.addEventListener('DOMContentLoaded', function () {
  try { App.boot(); }
  catch (err) {
    console.error(err);
    document.getElementById('app').innerHTML =
      '<div class="boot-screen"><b>初始化失败</b><div class="small">' + (err && err.message ? err.message : err) + '</div></div>';
  }
});

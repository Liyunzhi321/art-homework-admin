/* ============================================================
   Store - 数据模型 / 鉴权 / 业务逻辑
   ============================================================ */
var Store = (function () {
  var KEY = 'ahm_data_v2';
  var SESSION_KEY = 'ahm_session_v2';

  var SUBJECTS = [
    { key: 'color', name: '色彩', icon: '🎨', cls: 'sub-color', color: '#EC4899' },
    { key: 'sketch', name: '素描', icon: '✏️', cls: 'sub-sketch', color: '#64748B' },
    { key: 'quick', name: '速写', icon: '🖌️', cls: 'sub-quick', color: '#F59E0B' }
  ];
  var GRADES = ['A', 'B', 'C', 'D'];
  var GRADE_TEXT = { A: '优秀', B: '良好', C: '合格', D: '待加强' };
  var GRADE_COLOR = { A: '#16A34A', B: '#2563EB', C: '#F59E0B', D: '#EF4444' };
  // 文化课科目（成绩统计 → 文化课成绩用）：学生可在「我的」中自选
  var CULTURE_SUBJECTS = ['语文', '数学', '英语', '政治', '历史', '地理', '物理', '化学', '生物'];
  var SHIFTS = [
    { key: 'day', name: '白天正常上课', icon: '☀️', short: '白天' },
    { key: 'night', name: '晚上加班', icon: '🌙', short: '晚上' }
  ];
  function shift(key) { return SHIFTS.filter(function (s) { return s.key === key; })[0] || SHIFTS[0]; }
  // 课次（考勤按课次更细统计）：第1节 ~ 第6节
  var PERIODS = ['第1节', '第2节', '第3节', '第4节', '第5节', '第6节'];
  var AVATAR_COLORS = ['#5A4FCF', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#0EA5E9', '#F97316', '#14B8A6'];

  var state = null;

  /* ---------------- 工具 ---------------- */
  function uid(p) { return (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dateStr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function shiftDate(str, days) {
    var p = str.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    d.setDate(d.getDate() + days);
    return dateStr(d);
  }
  function weekStart(str) {
    var p = (str || todayStr()).split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    var w = d.getDay() === 0 ? 6 : d.getDay() - 1; // 周一为一周之始
    d.setDate(d.getDate() - w);
    return dateStr(d);
  }
  function lastNDates(n, end) {
    var out = [], e = end || todayStr();
    for (var i = n - 1; i >= 0; i--) out.push(shiftDate(e, -i));
    return out;
  }
  function weekdayCN(str) {
    var p = str.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    return ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  }
  function mmdd(str) { var p = str.split('-'); return p[1] + '/' + p[2]; }
  function parseTime(str) { var t = Date.parse(str); return isNaN(t) ? 0 : t; }

  /* ---------------- 演示数据 ---------------- */
  // 种子（默认）账号统一用远古时间戳：保证任何真实修改（改密码/改名/选科目）在云端合并时都能压过默认值，
  // 避免"新设备重新初始化 → 默认密码时间戳更新 → 把已改的密码覆盖回 123456"的问题。
  var SEED_TS = '2000-01-01T00:00:00.000Z';
  var DEFAULT_PWD = '123456';
  function seed() {
    var classes = [
      { id: 'c1', name: '高二六班', teacher: '江江' }
    ];
    var NAMES = [
      '刘文轩', '李彦良', '邓浩竣', '李天骄', '赵依晨', '张大明', '刘洪美玉', '公辰如', '刘一霖', '马翔',
      '孙翔鸽', '崔言斌', '公惟滨', '王嘉豪', '公衍盛鑫', '巩梓烨', '李孟津', '李萍', '阚光耀', '邱若涵',
      '伊若涵', '李语萌', '郑温馨', '李彦霖', '文明泽'
    ];
    var students = [], users = [];

    users.push({
      id: 'u_teacher', role: 'teacher', account: 'teacher', password: '123456', pwdSet: false,
      name: '江江', title: '美术教师', createdAt: todayStr(), updatedAt: SEED_TS
    });

    NAMES.forEach(function (nm, i) {
      var sid = 'c1_s' + (i + 1);
      var no = 'A' + pad(i + 1);
      students.push({
        id: sid, name: nm, classId: 'c1', no: no,
        color: AVATAR_COLORS[i % AVATAR_COLORS.length],
        subjects: SUBJECTS.map(function (s) { return s.key; }), // 该生所修专业科目（学生可自选）
        cultureSubjects: CULTURE_SUBJECTS.slice(), // 该生所修文化课科目（学生可自选）
        joinedAt: '2026-03-01', active: true, updatedAt: SEED_TS
      });
      users.push({
        id: 'u_' + sid, role: 'student', account: no.toLowerCase(), password: '123456', pwdSet: false,
        name: nm, studentId: sid, createdAt: '2026-03-01', updatedAt: SEED_TS
      });
      users.push({
        id: 'u_p_' + sid, role: 'parent', account: 'p' + no.toLowerCase(), password: '123456', pwdSet: false,
        name: nm + '家长', studentId: sid, createdAt: '2026-03-01', updatedAt: SEED_TS
      });
    });

    // 作业记录不再预置演示数据：避免新账号 / 新设备登录时看到默认的“未批改”作业（真实作业由教师自行录入）
    var records = [];
    // 确定性伪随机（供演示数据生成使用，如文化课/专业课成绩）
    function hash(a, b, c) {
      var v = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
      return v - Math.floor(v);
    }

    // 演示：今日布置作业（教师可在「布置作业」页删除/编辑）
    var today = todayStr();
    var assignments = [
      {
        id: 'a_demo', date: today, subjects: ['color', 'sketch'], shift: 'day',
        title: '色彩静物写生 + 素描几何体',
        content: '完成色彩静物 20 张、素描几何体 10 张',
        requirement: '色彩构图完整、冷暖对比明确；素描注意明暗交界线',
        counts: { color: 20, sketch: 10 }, // 美术作业按张为单位布置
        createdAt: today + ' 09:00', updatedAt: today + ' 09:00', byName: '江江'
      },
      {
        id: 'a_night', date: today, subjects: ['quick', 'color'], shift: 'night',
        title: '晚间速写加练 + 色彩小稿',
        content: '速写人物 15 张、色彩小稿 5 张',
        requirement: '速写抓动态与比例，色彩小稿注意构图',
        counts: { quick: 15, color: 5 },
        createdAt: today + ' 19:30', updatedAt: today + ' 19:30', byName: '江江'
      }
    ];

    // 考勤记录不再预置演示数据：避免新账号 / 新设备登录时看到默认的演示迟到 / 请假 / 到班记录
    // （真实考勤由教师在「考勤」页按课次标记；已同步到云端的旧演示考勤会在 merge 时自动剥离，见 stripDemoAttendance）
    var attendance = [];

    // 演示：专业成绩（教师录入的评级 + 分数，分考试 / 小测，可归属不同考试场次）
    var profGrades = [];
    var profSessions = [
      { name: '9月专业测评', date: shiftDate(today, -20) },
      { name: '期中专业测评', date: shiftDate(today, -5) }
    ];
    profSessions.forEach(function (ps) {
      students.forEach(function (st, si) {
        SUBJECTS.forEach(function (sub, xi) {
          ['exam', 'quiz'].forEach(function (type) {
            if (hash(si + 1 + xi, xi + (type === 'exam' ? 2 : 5), 9) < 0.22) return; // 部分未录入，制造真实缺口
            var gi = Math.floor(hash(si + 3 + xi, xi + (type === 'exam' ? 1 : 4), 5) * 4);
            var base = type === 'exam' ? 82 : 88;
            var score = Math.max(40, Math.min(100, Math.round(base + (hash(si + 7, xi + (type === 'exam' ? 3 : 6), 9) - 0.5) * 40)));
            profGrades.push({
              id: 'pg_' + st.id + '_' + ps.name + '_' + sub.key + '_' + type, studentId: st.id, subject: sub.key, type: type,
              examName: ps.name, examDate: ps.date,
              grade: GRADES[gi], score: score, comment: '', date: today,
              updatedAt: SEED_TS, byName: '江江'
            });
          });
        });
      });
    });

    // 演示：文化课成绩（月考 + 期中）——成绩统计 → 文化课成绩 / 走势分析
    var cultureScores = [];
    var exams = [
      { name: '9月月考', date: shiftDate(today, -20) },
      { name: '期中考试', date: shiftDate(today, -5) }
    ];
    function cscore(si, ei, base) {
      var v = Math.sin((si + 1) * 3.1 + ei * 1.7) * 14;
      return Math.max(40, Math.min(100, Math.round(base + v)));
    }
    var CS_BASE = { '语文': 88, '数学': 82, '英语': 85, '政治': 80, '历史': 79, '地理': 78, '物理': 76, '化学': 77, '生物': 80 };
    exams.forEach(function (ex, ei) {
      students.forEach(function (st, si) {
        CULTURE_SUBJECTS.forEach(function (sub) {
          cultureScores.push({
            id: 'cs_' + st.id + '_' + ei + '_' + sub,
            studentId: st.id, examName: ex.name, examDate: ex.date, subject: sub,
            score: cscore(si, ei, CS_BASE[sub] != null ? CS_BASE[sub] : 78),
            fullScore: 100,
            createdAt: ex.date, updatedAt: ex.date + 'T10:00:00.000Z'
          });
        });
      });
    });

    return {
      version: 2,
      settings: { schoolName: '高二六班 · 美术作业', className: '高二六班', createdAt: todayStr(), updatedAt: '2000-01-01T00:00:00.000Z' },
      classes: classes,
      classesUpdatedAt: '2000-01-01T00:00:00.000Z',
      students: students,
      users: users,
      records: records,
      assignments: assignments,
      attendance: attendance,
      cultureScores: cultureScores,
      profGrades: profGrades,
      tomb: { users: {}, students: {}, records: {}, assignments: {}, attendance: {}, cultureScores: {}, profGrades: {} } // 删除墓碑：id -> 删除时间戳(ms)，用于跨设备同步删除
    };
  }

  /* ---------------- 持久化 ---------------- */
  var cloudTimer = null;
  var lastCloudAt = null; // 最近一次已知云端 updated_at；用于轻量轮询判断"是否有变化"
  var dirtySinceSync = false; // 本地自上次成功推送以来是否有未同步的改动（闲时/关闭前强推与防 ping-pong 用）
  var LAST_FULL_SYNC_KEY = 'ahm_last_full_sync'; // 最近一次"全量对账"时间戳（用于检测整夜关闭后的补偿同步）
  function scheduleCloud() {
    if (!window.Cloud || !Cloud.ready()) return;
    if (cloudTimer) clearTimeout(cloudTimer);
    cloudTimer = setTimeout(function () {
      cloudTimer = null;
      if (!state || !state.users) return;
      pushWithRetry(3);
    }, 600);
  }

  // 乐观并发写入：先拉云端最新并合并，再用「版本号条件更新」写回；
  // 若写入期间别人已改动云端（版本号不匹配），判定冲突后重拉、重合并、重试，
  // 直到成功或次数耗尽。彻底消除「跨设备 / 多标签页同时编辑 → 整行覆盖 → 数据丢失」。
  function pushWithRetry(tries) {
    if (tries <= 0) return Promise.resolve(false);
    if (!window.Cloud || !Cloud.ready()) return Promise.resolve(false);
    var expected = (typeof (state && state.version) === 'number') ? state.version : 0;
    var haveCloud = false;
    return Cloud.load().then(function (res) {
      if (res && res.payload && res.payload.users) {
        state = reconcile(res.payload, state);
        if (typeof res.payload.version === 'number') expected = res.payload.version;
        haveCloud = true;
      }
      var ts = new Date().toISOString();
      var payload = JSON.parse(JSON.stringify(state));
      if (typeof payload.version !== 'number') payload.version = expected;
      // 仅当确实读到过云端行时才做版本条件更新；云端为空的初始化场景走无条件写入(insert)
      var expArg = haveCloud ? expected : undefined;
      return Cloud.save(payload, ts, expArg).then(function (info) {
        if (info.conflict) {
          // 云端在我们读取后被别人改写，重拉重合并重试
          return pushWithRetry(tries - 1);
        }
        if (info.ok) {
          state.version = (typeof info.version === 'number') ? info.version : expected + 1;
          lastCloudAt = ts;
          dirtySinceSync = false; // 推送成功 → 本地无待同步改动
          try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
          return true;
        }
        return false;
      });
    }).catch(function () { return false; });
  }

  // 立即推送（供「立即同步」按钮等主动触发，带乐观并发保护）
  function pushNow() { return pushWithRetry(3); }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) { state = JSON.parse(raw); }
    } catch (e) { state = null; }
    if (state && !state.tomb) state.tomb = { users: {}, students: {}, records: {}, assignments: {}, attendance: {}, cultureScores: {}, profGrades: {} };
    if (state && !state.classesUpdatedAt) state.classesUpdatedAt = (state.settings && state.settings.updatedAt) || new Date().toISOString();
    // 兼容旧数据：考勤无 period 字段的记录归类到第1节，避免升级后旧考勤丢失
    if (state && state.attendance) {
      state.attendance.forEach(function (a) { if (!a.period) a.period = PERIODS[0]; });
    }
    if (!state || !state.users) { state = seed(); persistLocal(); }
    return state;
  }
  function save() {
    dirtySinceSync = true; // 本地产生改动，标记待同步（供闲时/关闭前强推与防 ping-pong）
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.warn('保存失败', e); }
    scheduleCloud();
  }
  // 仅写本地，不触发云端推送（用于首次打开没有本地数据时落种子，避免覆盖云端真实数据）
  function persistLocal() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.warn('保存失败', e); }
  }
  function resetDemo() {
    state = seed(); save();
    if (window.DB) DB.clearAll();
  }
  // 用云端数据覆盖本地（last-write-wins，仅当云端含有效用户数据）
  function hydrate(payload) {
    if (!payload || !payload.users) return false;
    state = payload;
    if (!state.tomb) state.tomb = { users: {}, students: {}, records: {}, assignments: {}, attendance: {}, cultureScores: {}, profGrades: {} };
    applyTomb(state);
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    return true;
  }
  // 墓碑辅助：删除标记 + 应用删除
  function tomb() {
    if (!state.tomb) state.tomb = { users: {}, students: {}, records: {}, assignments: {}, attendance: {}, cultureScores: {}, profGrades: {} };
    return state.tomb;
  }
  // 标记删除（幂等；同一 id 取较新时间戳）
  function markTomb(cat, id) {
    var t = tomb();
    if (!t[cat]) t[cat] = {};
    t[cat][id] = Date.now();
  }
  // 按墓碑剔除已删除条目（用于 merge / hydrate 之后）
  function applyTomb(d) {
    if (!d || !d.tomb) return;
    ['users', 'students', 'records', 'assignments', 'attendance', 'cultureScores', 'profGrades'].forEach(function (cat) {
      var t = d.tomb[cat] || {};
      var keys = Object.keys(t);
      if (!keys.length) return;
      if (!d[cat]) d[cat] = [];
      d[cat] = d[cat].filter(function (x) { return !x || !x.id || !t[x.id]; });
    });
  }
  // 云端 → 本地 增量合并（按 id 联合，保留本地已有；新增的账号/学生/作业不丢失；补回老师评级；同步删除墓碑）
  /* 双向合并（云端 ↔ 本地）：墓碑并集 + 逐项 updatedAt 后写覆盖（LWW）。
     删除以「墓碑」表示（tomb[cat][id] = 删除时间戳）；任意一方的墓碑都生效，
     从而保证「某端删除的数据在同步后不会复活」。作业记录采用字段级合并以保留评级。*/
  function reconcile(cloud, local) {
    if (!cloud || !cloud.users) return local;
    if (!local || !local.users) return cloud;
    function pt(x) { return parseTime(x && (x.updatedAt || x.createdAt)); }
    function st(x) { return parseTime(x && x.updatedAt); }
    var cats = ['users', 'students', 'records', 'assignments', 'attendance', 'cultureScores', 'profGrades'];
    var out = {
      version: cloud.version || local.version,
      settings: null, classes: null, classesUpdatedAt: null,
      students: [], users: [], records: [], assignments: [], attendance: [], cultureScores: [], profGrades: [],
      tomb: { users: {}, students: {}, records: {}, assignments: {}, attendance: {}, cultureScores: {}, profGrades: {} }
    };
    // 墓碑并集（取较新时间戳）——删除优先于复活
    cats.forEach(function (cat) {
      var srcs = [(cloud.tomb && cloud.tomb[cat]) || {}, (local.tomb && local.tomb[cat]) || {}];
      srcs.forEach(function (src) {
        Object.keys(src).forEach(function (id) {
          var ts = src[id];
          if (!out.tomb[cat][id] || ts > out.tomb[cat][id]) out.tomb[cat][id] = ts;
        });
      });
    });
    // 各数组并集 + LWW
    cats.forEach(function (cat) {
      var cm = {}, lm = {};
      (cloud[cat] || []).forEach(function (x) { if (x && x.id) cm[x.id] = x; });
      (local[cat] || []).forEach(function (x) { if (x && x.id) lm[x.id] = x; });
      var ids = {};
      Object.keys(cm).forEach(function (i) { ids[i] = 1; });
      Object.keys(lm).forEach(function (i) { ids[i] = 1; });
      Object.keys(ids).forEach(function (id) {
        var c = cm[id], l = lm[id];
        if (c && !l) { out[cat].push(c); return; }
        if (l && !c) { out[cat].push(l); return; }
        var winner = pt(c) >= pt(l) ? c : l;
        var loser = winner === c ? l : c;
        if (cat === 'records') {
          var base = JSON.parse(JSON.stringify(winner));
          ['count', 'progress', 'note', 'images', 'shift', 'subject', 'date'].forEach(function (f) {
            if (loser[f] !== undefined && pt(loser) >= pt(winner) && (f !== 'images' || (loser.images && loser.images.length))) base[f] = loser[f];
          });
          function applyGrade(src, dst) {
            dst.grade = src.grade;
            dst.teacherComment = src.teacherComment || dst.teacherComment;
            dst.reviewedBy = src.reviewedBy || dst.reviewedBy;
            dst.reviewedAt = src.reviewedAt || dst.reviewedAt;
          }
          if (winner.grade && !loser.grade) applyGrade(winner, base);
          else if (loser.grade && !winner.grade) applyGrade(loser, base);
          else if (winner.grade && loser.grade) { if (pt(loser) >= pt(winner)) applyGrade(loser, base); else applyGrade(winner, base); }
          base.password = winner.password;
          if (base.password === DEFAULT_PWD && loser.password && loser.password !== DEFAULT_PWD) base.password = loser.password;
          out[cat].push(base);
          return;
        }
        if (cat === 'users') {
          var u = JSON.parse(JSON.stringify(winner));
          ['name', 'avatar', 'title', 'password', 'classId', 'no', 'color', 'active', 'studentId'].forEach(function (f) {
            if (loser[f] !== undefined && pt(loser) >= pt(winner)) u[f] = loser[f];
          });
          if (u.password === DEFAULT_PWD && loser.password && loser.password !== DEFAULT_PWD) u.password = loser.password;
          // 登录轨迹保护：lastLoginAt 取较新、loginCount 取较大，避免被「未登录过的旧副本」(deepSync/flush 推送时带入空值)覆盖而丢失家长登录记录
          u.lastLoginAt = Math.max((c && c.lastLoginAt) || 0, (l && l.lastLoginAt) || 0) || (u.lastLoginAt || 0);
          u.loginCount = Math.max((c && c.loginCount) || 0, (l && l.loginCount) || 0) || (u.loginCount || 0);
          out[cat].push(u);
          return;
        }
        out[cat].push(winner);
      });
    });
    // 班级 / 设置 / 版本 LWW
    if (cloud.classes) {
      if (st(cloud.classesUpdatedAt) >= st(local.classesUpdatedAt)) { out.classes = cloud.classes; out.classesUpdatedAt = cloud.classesUpdatedAt; }
      else { out.classes = local.classes; out.classesUpdatedAt = local.classesUpdatedAt; }
    } else { out.classes = local.classes; out.classesUpdatedAt = local.classesUpdatedAt; }
    if (cloud.settings && st(cloud.settings.updatedAt) >= st((local.settings || {}).updatedAt)) out.settings = cloud.settings;
    else out.settings = local.settings;
    if (cloud.version) out.version = cloud.version;
    applyTomb(out);
    return out;
  }

  function merge(payload) {
    if (!payload || !payload.users) return false;
    if (!state) state = load(); // 防御：保证本地数据已加载（避免直接调用 merge 时 state 为空）
    // 统一走 reconcile：云端作为「对方」、本地作为「本端」做双向合并
    state = reconcile(payload, state);
    // 自动剔除历史演示数据（云端 main 行曾长期被旧种子污染，每次启动/同步都会把演示作业 / 演示考勤拉回来）。
    // 一并把清理结果写回云端，避免其他设备再次拉回 —— 实现「开机自愈」，无需手动点「清除演示作业」。
    var removed = stripDemoHomework(state) + stripDemoAttendance(state);
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    if (removed > 0) scheduleCloud();
    return true;
  }
  // 从云端拉取并水合；返回云端 updated_at（无变化返回 null）
  // 本地是否含有「真实业务数据」（区别于首次安装的默认种子 u_teacher）
  function hasRealData() {
    var d = data();
    if (!d) return false;
    var realUsers = (d.users || []).filter(function (u) { return u.id !== 'u_teacher' && !u.demo; });
    return !!( (d.students && d.students.length) ||
               (d.classes && d.classes.length) ||
               realUsers.length ||
               (d.records && d.records.length) ||
               (d.attendance && d.attendance.length) );
  }

  // 把仅存于本机 IndexedDB 的旧图片 id（如 img_xxx）转成内联 data URL 写回云端，
  // 使其他设备也能看到。仅在本机持有该图片时生效——上传设备重新打开 App 即自动自愈。
  function migrateInlineImages() {
    var d = data();
    var records = (d && d.records) || [];
    var tasks = [];
    records.forEach(function (r) {
      (r.images || []).forEach(function (imgId, idx) {
        if (typeof imgId !== 'string') return;
        if (imgId.indexOf('http') === 0 || imgId.indexOf('data:') === 0 || imgId.indexOf('seed:') === 0) return;
        tasks.push({ r: r, idx: idx, id: imgId });
      });
    });
    if (!tasks.length) return Promise.resolve(0);
    return Promise.all(tasks.map(function (t) {
      return DB.getImage(t.id).then(function (rec) {
        if (!rec) return false;
        var src = rec.full || rec.thumb;
        if (!src) return false;
        if (src.indexOf('data:') === 0) { t.r.images[t.idx] = src; return true; }
        if (src.indexOf('blob:') === 0) {
          return fetch(src).then(function (resp) { return resp.blob(); }).then(function (blob) {
            return new Promise(function (resolve) {
              var fr = new FileReader();
              fr.onload = function () { t.r.images[t.idx] = fr.result; resolve(true); };
              fr.onerror = function () { resolve(false); };
              fr.readAsDataURL(blob);
            });
          }).catch(function () { return false; });
        }
        return false;
      }).catch(function () { return false; });
    })).then(function (results) {
      var changed = results.filter(Boolean).length;
      if (changed) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} save(); }
      return changed;
    });
  }

  function syncFromCloud() {
    if (!window.Cloud || !Cloud.ready()) return Promise.resolve(null);
    return Cloud.load().then(function (res) {
      if (res && res.payload && res.payload.users) {
        merge(res.payload);
        lastCloudAt = res.updated_at; // 记录已同步的云端时间戳，供轻量轮询判断是否变化
        return { ok: true, action: 'pull', at: res.updated_at };
      }
      // 云端为空：本机若有真实数据则作为共享基线恢复上去（带乐观并发，避免覆盖他人刚写入的数据）
      if (hasRealData()) {
        return pushWithRetry(3).then(function (ok) {
          return ok ? { ok: true, action: 'push', at: new Date().toISOString() } : { ok: false, action: 'push-fail' };
        });
      }
      return null;
    }).catch(function () { return null; });
  }
  // 启动引导：云端优先。新域名/新设备打开时，本地可能残留「演示占位数据」（作业/考勤为空），
  // 必须以云端真实数据为基准，仅把本地「云端没有且非演示」的条目补回，杜绝演示占位覆盖真实数据。
  function bootstrap() {
    return Promise.resolve().then(function () {
      var localRaw = null, localData = null, localHas = false;
      try {
        localRaw = localStorage.getItem(KEY);
        if (localRaw) { localData = JSON.parse(localRaw); localHas = !!(localData && localData.users && localData.users.length); }
      } catch (e) {}
      if (window.Cloud && Cloud.ready()) {
        return Cloud.load().then(function (res) {
          if (res && res.payload && res.payload.users) {
            // 始终以云端真实数据为基准；仅补回本地独有且非演示的条目（防止本地缓存的空演示覆盖真实数据）
            hydrate(res.payload);
            lastCloudAt = res.updated_at;
            if (localData && localData.users) mergeLocalOnly(localData);
            stripDemoHomework(state); stripDemoAttendance(state);
            try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
            return 'cloud';
          }
          if (localHas) { load(); return 'local'; }
          state = seed(); persistLocal(); return 'seed';
        }).catch(function () {
          // 读取云端失败：保留本地数据，不推送，避免用本地覆盖云端
          if (localHas) { load(); return 'local'; }
          state = seed(); persistLocal(); return 'seed';
        });
      }
      if (localHas) { load(); return 'local'; }
      state = seed(); persistLocal(); return 'seed';
    });
  }
  // 仅把本地「云端没有、且非演示」的条目补回到 state；云端已有(按 id)的以云端为准，演示/已删除的不回写。
  function mergeLocalOnly(local) {
    if (!local || !local.users) return;
    var cats = ['users', 'students', 'records', 'assignments', 'attendance', 'cultureScores', 'profGrades'];
    cats.forEach(function (cat) {
      var cloudIds = {};
      (state[cat] || []).forEach(function (x) { if (x && x.id) cloudIds[x.id] = 1; });
      var tomb = (local.tomb && local.tomb[cat]) || {};
      (local[cat] || []).forEach(function (x) {
        if (!x || !x.id) return;
        if (x.demo) return;
        if (cloudIds[x.id]) return;
        if (tomb[x.id]) return;
        if (!state[cat]) state[cat] = [];
        state[cat].push(x);
      });
    });
  }
  // 轻量轮询：先只取云端 updated_at，没变化就跳过（省流量）；变了才拉完整数据并合并。
  // 返回 Promise<boolean>：本次是否真正拉取并合并了新数据。
  function poll() {
    if (!window.Cloud || !Cloud.ready()) return Promise.resolve(false);
    return Cloud.loadMeta().then(function (at) {
      if (!at) return false;
      if (at === lastCloudAt) return false; // 云端无变化，跳过繁重拉取
      lastCloudAt = at;
      return syncFromCloud().then(function (r) { return !!r; });
    }).catch(function () { return false; });
  }
  // 最近一次全量对账时间（供"整夜关闭后补偿同步"判断）
  function getLastFullSync() {
    try { var v = localStorage.getItem(LAST_FULL_SYNC_KEY); return v ? parseInt(v, 10) : 0; } catch (e) { return 0; }
  }
  function setLastFullSync(t) {
    try { localStorage.setItem(LAST_FULL_SYNC_KEY, (t || Date.now()).toString()); } catch (e) {}
  }
  // 全量对账（闲时/凌晨/打开补偿用）：以云端为基准做双向 reconcile，
  // 再把合并结果写回云端(乐观并发)，把本地未同步的改动一并补上传；
  // 同时拉回云端在此期间变化的真实数据。弥补"频繁使用期间因同步慢而漏掉的数据"。
  // 防 ping-pong：云端无变化且无本地待推改动时直接跳过，避免多设备空闲时互相刷版本。
  function deepSync() {
    if (!window.Cloud || !Cloud.ready()) return Promise.resolve(false);
    if (!state || !state.users) return Promise.resolve(false);
    return Cloud.loadMeta().then(function (at) {
      if (at && at === lastCloudAt && !dirtySinceSync) return false; // 无变化且无本地待推 → 跳过
      // 先拉云端最新并合并(含他人登录轨迹/最新业务)，再推送本地改动，避免用陈旧本地副本覆盖云端已记录的登录信息
      return syncFromCloud().then(function () {
        return pushWithRetry(3).then(function (ok) {
          if (ok) setLastFullSync(Date.now());
          return ok;
        });
      });
    }).catch(function () { return false; });
  }
  // 切后台/关闭页面前的强推：把本地尚未推送的改动立即写回云端，避免关闭导致改动丢失或滞后。
  function flush() {
    if (!dirtySinceSync) return Promise.resolve(false); // 没有待推改动就不打扰云端
    return pushWithRetry(3).then(function (ok) { if (ok) setLastFullSync(Date.now()); return ok; });
  }
  // 打开/切回前台时的全量拉取：无条件从云端完整拉回并合并（不像 poll 那样被 meta 跳过），
  // 保证"打开即最新"，并补回本机 IndexedDB 残留图片。
  function fullPull() {
    return syncFromCloud().then(function (r) {
      return migrateInlineImages().then(function (n) { return { r: r, n: n }; });
    });
  }
  function data() { return state || load(); }

  /* ---------------- 鉴权 ---------------- */
  var ROLE_TEXT = { teacher: '教师', student: '学生', parent: '家长' };

  function login(role, account, password) {
    var d = data();
    var acc = (account || '').trim().toLowerCase();
    // 先按所选角色精确查找；找不到再跨角色查找，避免选错角色标签误报“账号不存在”
    var u = d.users.filter(function (x) {
      return x.role === role && x.account.toLowerCase() === acc;
    })[0];
    if (!u) {
      u = d.users.filter(function (x) { return x.account.toLowerCase() === acc; })[0];
    }
    if (!u) return { ok: false, msg: '该账号不存在，请检查账号或切换角色标签后重试' };
    if (u.password !== password) return { ok: false, msg: '密码不正确' };
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: u.id, at: Date.now() }));
    // 记录登录轨迹：最近登录时间 + 登录次数（供教师后台「全部账号一览」查看谁登录过）
    u.lastLoginAt = Date.now();
    u.loginCount = (u.loginCount || 0) + 1;
    u.updatedAt = new Date().toISOString(); // 更新时间戳，确保登录轨迹在云端合并(LWW)时不被旧副本覆盖
    save();
    return { ok: true, user: u };
  }
  function logout() { localStorage.removeItem(SESSION_KEY); }
  // 首次登录强制改密码：账号尚未主动设置过密码(pwdSet 为 false/undefined)即需强制修改
  function needsPasswordChange(u) { return !!(u && !u.pwdSet); }
  function currentUser() {
    try {
      var s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (!s) return null;
      return data().users.filter(function (u) { return u.id === s.userId; })[0] || null;
    } catch (e) { return null; }
  }
  function changePassword(userId, oldPwd, newPwd) {
    var u = data().users.filter(function (x) { return x.id === userId; })[0];
    if (!u) return { ok: false, msg: '用户不存在' };
    if (u.password !== oldPwd) return { ok: false, msg: '原密码不正确' };
    u.password = newPwd;
    u.pwdSet = true; // 用户已主动修改过密码，解除首次强制改密
    u.updatedAt = new Date().toISOString(); // 必须更新时间戳，否则云端合并(last-write-wins)时默认密码可能因时间戳更旧而无法被新密码覆盖
    save();
    return { ok: true };
  }

  /* ---------------- 查询 ---------------- */
  function getStudent(id) { return data().students.filter(function (s) { return s.id === id; })[0] || null; }
  function getClass(id) { return data().classes.filter(function (c) { return c.id === id; })[0] || null; }
  function className(id) { var c = getClass(id); return c ? c.name : '未分班'; }
  function allStudents() { return data().students.filter(function (s) { return s.active !== false; }); }
  function studentUsers(studentId) {
    return data().users.filter(function (u) { return u.studentId === studentId; });
  }
  function subject(key) { return SUBJECTS.filter(function (s) { return s.key === key; })[0] || SUBJECTS[0]; }

  function queryRecords(opt) {
    opt = opt || {};
    var list = data().records.slice();
    if (opt.studentId) list = list.filter(function (r) { return r.studentId === opt.studentId; });
    if (opt.classId) list = list.filter(function (r) { return r.classId === opt.classId; });
    if (opt.subject) list = list.filter(function (r) { return r.subject === opt.subject; });
    if (opt.date) list = list.filter(function (r) { return r.date === opt.date; });
    if (opt.from) list = list.filter(function (r) { return r.date >= opt.from; });
    if (opt.to) list = list.filter(function (r) { return r.date <= opt.to; });
    if (opt.grade) list = list.filter(function (r) { return r.grade === opt.grade; });
    if (opt.status === 'pending') list = list.filter(function (r) { return !r.grade; });
    if (opt.status === 'reviewed') list = list.filter(function (r) { return !!r.grade; });
    if (opt.hasImage) list = list.filter(function (r) { return r.images && r.images.length; });
    if (opt.keyword) {
      var k = opt.keyword.trim();
      list = list.filter(function (r) {
        var st = getStudent(r.studentId);
        return st && (st.name.indexOf(k) >= 0 || st.no.toLowerCase().indexOf(k.toLowerCase()) >= 0);
      });
    }
    list.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (a.createdAt || '') < (b.createdAt || '') ? 1 : -1;
    });
    return list;
  }
  function findRecord(studentId, date, subj, shift) {
    return data().records.filter(function (r) {
      return r.studentId === studentId && r.date === date && r.subject === subj &&
        (shift ? r.shift === shift : true);
    })[0] || null;
  }

  /* ---------------- 写入 ---------------- */
  function upsertRecord(payload) {
    var d = data();
    var exist = findRecord(payload.studentId, payload.date, payload.subject);
    if (exist) {
      exist.count = payload.count;
      exist.progress = payload.progress;
      exist.note = payload.note || '';
      exist.images = payload.images || [];
      if (payload.shift) exist.shift = payload.shift === 'night' ? 'night' : 'day';
      exist.updatedAt = new Date().toISOString();
      save();
      return exist;
    }
    var st = getStudent(payload.studentId);
    var rec = {
      id: uid('r'),
      studentId: payload.studentId,
      classId: st ? st.classId : '',
      date: payload.date,
      subject: payload.subject,
      shift: payload.shift === 'night' ? 'night' : 'day',
      count: payload.count,
      progress: payload.progress,
      note: payload.note || '',
      images: payload.images || [],
      grade: null,
      teacherComment: '',
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date().toLocaleString('zh-CN'),
      updatedAt: new Date().toISOString()
    };
    d.records.push(rec);
    save();
    return rec;
  }
  function gradeRecord(recordId, grade, comment, byName) {
    var r = data().records.filter(function (x) { return x.id === recordId; })[0];
    if (!r) return null;
    if (grade !== undefined && grade !== null) r.grade = grade;
    if (comment !== undefined) r.teacherComment = comment;
    r.reviewedBy = byName || '教师';
    r.reviewedAt = todayStr();
    r.updatedAt = new Date().toISOString();
    save();
    return r;
  }
  function deleteRecord(recordId) {
    var d = data();
    var r = d.records.filter(function (x) { return x.id === recordId; })[0];
    if (r && r.images) r.images.forEach(function (id) { DB.delImage(id); });
    d.records = d.records.filter(function (x) { return x.id !== recordId; });
    markTomb('records', recordId);
    save();
  }
  // 判断一条作业是否为「种子演示作业」。
  // 识别依据：createdAt 为种子特有的 'YYYY-MM-DD 20:0X:00' 格式（真实记录用 toLocaleString / ISO，不会命中）。
  function isDemoRecord(r) {
    if (!r) return false;
    var re = /^\d{4}-\d{2}-\d{2} 20:0\d:00$/;
    return r.demo === true || (r.createdAt && re.test(r.createdAt));
  }
  // 从 state 就地剔除演示作业（仅改内存 + 墓碑，不读写存储/云端）；返回移除数量。
  // 供 merge（启动时自动清理历史演示）与 clearDemoHomework（手动清理）共用。
  function stripDemoHomework(s) {
    if (!s || !s.records) return 0;
    var before = s.records.length;
    s.records.forEach(function (r) { if (isDemoRecord(r)) markTomb('records', r.id); });
    s.records = s.records.filter(function (r) { return !isDemoRecord(r); });
    return before - s.records.length;
  }
  // 判断一条考勤是否为「种子演示考勤」。
  // 旧版本种子未打 demo 标记，但其 updatedAt 为固定演示时间、毫秒恒为 .000（真实录入为随机毫秒的当前时间），可据此识别；
  // 新版本种子（若有）可显式打 demo:true。
  var DEMO_ATT_UPDATED_AT = ['T08:30:00.000Z', 'T08:00:00.000Z', 'T07:42:00.000Z', 'T07:48:00.000Z', 'T07:51:00.000Z', 'T07:55:00.000Z', 'T07:58:00.000Z', 'T08:02:00.000Z', 'T08:05:00.000Z', 'T08:09:00.000Z', 'T08:12:00.000Z'];
  function isDemoAttendance(r) {
    if (!r) return false;
    if (r.demo === true) return true;
    if (!r.updatedAt) return false;
    for (var i = 0; i < DEMO_ATT_UPDATED_AT.length; i++) {
      if (r.updatedAt.indexOf(DEMO_ATT_UPDATED_AT[i]) !== -1) return true;
    }
    return false;
  }
  // 从 state 就地剔除演示考勤（含已同步到云端的旧演示），并打墓碑；返回移除数量。
  function stripDemoAttendance(s) {
    if (!s || !s.attendance) return 0;
    var before = s.attendance.length;
    s.attendance.forEach(function (r) { if (isDemoAttendance(r)) markTomb('attendance', r.id); });
    s.attendance = s.attendance.filter(function (r) { return !isDemoAttendance(r); });
    return before - s.attendance.length;
  }
  // 清除演示作业：移除种子生成的演示作业记录（含已同步到云端的旧演示）。
  // 识别依据同 isDemoRecord；不会误删教师真实录入的作业。
  function clearDemoHomework() {
    var d = data();
    var n = stripDemoHomework(d);
    save();
    return n;
  }
  // 仅删除某条作业里的单张图片（老师/本人可移除错传或多余的作品图）
  function removeImageFromRecord(recordId, imgId) {
    var d = data();
    var r = d.records.filter(function (x) { return x.id === recordId; })[0];
    if (!r) return;
    if (r.images) r.images = r.images.filter(function (i) { return i !== imgId; });
    r.updatedAt = new Date().toISOString();
    if (window.DB) DB.delImage(imgId);
    save();
  }

  function addStudent(payload) {
    var d = data();
    if (d.users.some(function (u) { return u.account.toLowerCase() === payload.account.toLowerCase(); })) {
      return { ok: false, msg: '学生账号已存在' };
    }
    var sid = uid('s');
    d.students.push({
      id: sid, name: payload.name, classId: payload.classId, no: payload.no,
      color: AVATAR_COLORS[d.students.length % AVATAR_COLORS.length],
      subjects: payload.subjects && payload.subjects.length ? payload.subjects : SUBJECTS.map(function (s) { return s.key; }),
      cultureSubjects: payload.cultureSubjects && payload.cultureSubjects.length ? payload.cultureSubjects : CULTURE_SUBJECTS.slice(),
      joinedAt: todayStr(), active: true, updatedAt: new Date().toISOString()
    });
    d.users.push({
      id: 'u_' + sid, role: 'student', account: payload.account, password: payload.password || '123456', pwdSet: false,
      name: payload.name, studentId: sid, createdAt: todayStr(), updatedAt: new Date().toISOString()
    });
    d.users.push({
      id: 'u_p_' + sid, role: 'parent', account: payload.parentAccount || ('p' + payload.account), pwdSet: false,
      password: payload.parentPassword || '123456', name: payload.name + '家长', studentId: sid, createdAt: todayStr(), updatedAt: new Date().toISOString()
    });
    save();
    return { ok: true, id: sid };
  }
  function updateStudent(id, payload) {
    var st = getStudent(id);
    if (!st) return { ok: false };
    st.name = payload.name; st.classId = payload.classId; st.no = payload.no;
    if (payload.subjects && payload.subjects.length) st.subjects = payload.subjects;
    st.updatedAt = new Date().toISOString();
    studentUsers(id).forEach(function (u) {
      u.name = u.role === 'parent' ? payload.name + '家长' : payload.name;
      u.updatedAt = st.updatedAt;
    });
    save();
    return { ok: true };
  }
  // 该生所修科目（学生端可自行选择；老师也可在编辑中设定）；缺省为全部科目
  function studentSubjects(studentId) {
    var st = getStudent(studentId);
    if (st && st.subjects && st.subjects.length) return st.subjects.slice();
    return SUBJECTS.map(function (s) { return s.key; });
  }
  function setStudentSubjects(studentId, keys) {
    var st = getStudent(studentId);
    if (!st) return;
    st.subjects = keys && keys.length ? keys.slice() : SUBJECTS.map(function (s) { return s.key; });
    st.updatedAt = new Date().toISOString();
    save();
  }
  // 该生所修文化课科目（学生端可自行选择；老师也可在编辑中设定）；缺省为全部文化课科目
  function studentCultureSubjects(studentId) {
    var st = getStudent(studentId);
    if (st && st.cultureSubjects && st.cultureSubjects.length) return st.cultureSubjects.slice();
    return CULTURE_SUBJECTS.slice();
  }
  function setStudentCultureSubjects(studentId, keys) {
    var st = getStudent(studentId);
    if (!st) return;
    st.cultureSubjects = keys && keys.length ? keys.slice() : CULTURE_SUBJECTS.slice();
    st.updatedAt = new Date().toISOString();
    save();
  }
  function removeStudent(id) {
    var d = data();
    d.records.filter(function (r) { return r.studentId === id; })
      .forEach(function (r) {
        (r.images || []).forEach(function (i) { DB.delImage(i); });
        markTomb('records', r.id);
      });
    d.records = d.records.filter(function (r) { return r.studentId !== id; });
    d.students = d.students.filter(function (s) { return s.id !== id; });
    d.users.filter(function (u) { return u.studentId === id; })
      .forEach(function (u) { markTomb('users', u.id); });
    d.users = d.users.filter(function (u) { return u.studentId !== id; });
    markTomb('students', id);
    save();
  }
  function resetPassword(userId, pwd) {
    var u = data().users.filter(function (x) { return x.id === userId; })[0];
    if (u) { u.password = pwd; u.pwdSet = false; u.updatedAt = new Date().toISOString(); save(); }
  }
  function addClass(name) {
    var d = data();
    d.classes.push({ id: uid('c'), name: name, teacher: '' });
    state.classesUpdatedAt = new Date().toISOString();
    save();
  }
  function addTeacher(payload) {
    var d = data();
    if (d.users.some(function (u) { return u.account.toLowerCase() === payload.account.toLowerCase(); })) {
      return { ok: false, msg: '该账号已存在' };
    }
    var id = uid('u');
    d.users.push({
      id: id, role: 'teacher', account: payload.account, password: payload.password || '123456', pwdSet: false,
      name: payload.name, title: payload.title || '美术教师', createdAt: todayStr(), updatedAt: new Date().toISOString()
    });
    save();
    return { ok: true, id: id };
  }
  function removeUser(id) {
    var d = data();
    d.users = d.users.filter(function (u) { return u.id !== id; });
    markTomb('users', id);
    save();
  }

  /* ---------------- 头像 ---------------- */
  // 头像以 dataURL 字符串存入 user/student，随 JSON 载荷自动跨设备同步
  function setUserAvatar(userId, url) {
    var u = data().users.filter(function (x) { return x.id === userId; })[0];
    if (!u) return;
    u.avatar = url || '';
    u.updatedAt = new Date().toISOString();
    if (u.studentId) {
      var st = getStudent(u.studentId);
      if (st) { st.avatar = url || ''; st.updatedAt = u.updatedAt; }
      // 同一学生的家长账号头像同步保持一致
      data().users.forEach(function (x) { if (x.role === 'parent' && x.studentId === u.studentId) { x.avatar = url || ''; x.updatedAt = u.updatedAt; } });
    }
    save();
  }
  function setStudentAvatar(sid, url) {
    var st = getStudent(sid); if (!st) return;
    st.avatar = url || '';
    st.updatedAt = new Date().toISOString();
    data().users.forEach(function (u) { if (u.studentId === sid) { u.avatar = url || ''; u.updatedAt = st.updatedAt; } });
    save();
  }

  /* ---------------- 年级 / 班级 ---------------- */
  function setSchoolName(name) {
    var d = data();
    if (!d.settings) d.settings = {};
    d.settings.schoolName = name;
    d.settings.updatedAt = new Date().toISOString();
    save();
  }
  function renameClass(classId, name) {
    var c = data().classes.filter(function (x) { return x.id === classId; })[0];
    if (c) { c.name = name; state.classesUpdatedAt = new Date().toISOString(); save(); }
  }
  function deleteClass(classId) {
    var d = data();
    var used = d.students.filter(function (s) { return s.classId === classId; }).length;
    if (used) return { ok: false, msg: '该班级还有 ' + used + ' 名学生，请先移除或转班后再删除' };
    d.classes = d.classes.filter(function (c) { return c.id !== classId; });
    state.classesUpdatedAt = new Date().toISOString();
    save();
    return { ok: true };
  }

  /* ---------------- 作品集（清空某生全部作业，保留账号） ---------------- */
  function deleteStudentPortfolio(studentId) {
    var d = data();
    var recs = d.records.filter(function (r) { return r.studentId === studentId; });
    recs.forEach(function (r) {
      (r.images || []).forEach(function (i) { if (window.DB) DB.delImage(i); });
      markTomb('records', r.id);
    });
    d.records = d.records.filter(function (r) { return r.studentId !== studentId; });
    save();
    return recs.length;
  }

  /* ---------------- 布置作业（教师发布任务） ---------------- */
  function assignmentsByDate(date) {
    return (data().assignments || []).filter(function (a) { return a.date === date; })
      .sort(function (a, b) { return (b.updatedAt || b.createdAt) < (a.updatedAt || a.createdAt) ? -1 : 1; });
  }
  function getAssignment(id) {
    return (data().assignments || []).filter(function (a) { return a.id === id; })[0] || null;
  }
  function addAssignment(payload) {
    var d = data();
    if (!d.assignments) d.assignments = [];
    var now = new Date().toISOString();
    var a = {
      id: uid('a'),
      date: payload.date || todayStr(),
      shift: payload.shift === 'night' ? 'night' : 'day', // 时段：白天正常上课 / 晚上加班
      subjects: payload.subjects && payload.subjects.length ? payload.subjects : Store.SUBJECTS.map(function (s) { return s.key; }),
      title: payload.title || '今日作业',
      content: payload.content || '',
      requirement: payload.requirement || '',
      counts: payload.counts || null, // 各科目布置张数（美术作业按张为单位），如 { color: 20, sketch: 10 }
      byName: payload.byName || '教师',
      createdAt: now,
      updatedAt: now
    };
    d.assignments.push(a);
    save();
    return a;
  }
  function updateAssignment(id, payload) {
    var a = getAssignment(id);
    if (!a) return null;
    if (payload.date) a.date = payload.date;
    if (payload.subjects) a.subjects = payload.subjects;
    if (payload.title !== undefined) a.title = payload.title;
    if (payload.content !== undefined) a.content = payload.content;
    if (payload.requirement !== undefined) a.requirement = payload.requirement;
    if (payload.counts !== undefined) a.counts = payload.counts;
    if (payload.byName) a.byName = payload.byName;
    if (payload.shift) a.shift = payload.shift === 'night' ? 'night' : 'day';
    a.updatedAt = new Date().toISOString();
    save();
    return a;
  }
  function removeAssignment(id) {
    var d = data();
    d.assignments = (d.assignments || []).filter(function (a) { return a.id !== id; });
    markTomb('assignments', id);
    save();
  }

  /* ---------------- 统计 ---------------- */
  function gradeScore(g) { return g === 'A' ? 4 : g === 'B' ? 3 : g === 'C' ? 2 : g === 'D' ? 1 : 0; }
  function scoreToGrade(s) { return s >= 3.5 ? 'A' : s >= 2.5 ? 'B' : s >= 1.5 ? 'C' : s > 0 ? 'D' : null; }
  // 0~100 分数 → 等级（导入专业成绩、无等级时自动评级用）
  function scoreToLetter(s) {
    s = +s; if (isNaN(s)) return null;
    return s >= 90 ? 'A' : s >= 80 ? 'B' : s >= 70 ? 'C' : 'D';
  }

  function summarize(records) {
    var total = records.length;
    var pieces = 0, progressSum = 0, graded = 0, scoreSum = 0, imgCount = 0;
    var byGrade = { A: 0, B: 0, C: 0, D: 0 };
    var bySubject = { color: 0, sketch: 0, quick: 0 };
    records.forEach(function (r) {
      pieces += r.count || 0;
      progressSum += r.progress || 0;
      imgCount += (r.images || []).length;
      bySubject[r.subject] = (bySubject[r.subject] || 0) + (r.count || 0);
      if (r.grade) { graded++; scoreSum += gradeScore(r.grade); byGrade[r.grade]++; }
    });
    return {
      total: total, pieces: pieces, images: imgCount,
      avgProgress: total ? Math.round(progressSum / total) : 0,
      graded: graded, pending: total - graded,
      avgScore: graded ? scoreSum / graded : 0,
      avgGrade: graded ? scoreToGrade(scoreSum / graded) : null,
      byGrade: byGrade, bySubject: bySubject
    };
  }

  function streakDays(studentId) {
    var d = todayStr(), n = 0, guard = 0;
    var set = {};
    queryRecords({ studentId: studentId }).forEach(function (r) { set[r.date] = true; });
    if (!set[d]) d = shiftDate(d, -1); // 今天还没交也不算断
    while (set[d] && guard < 400) { n++; d = shiftDate(d, -1); guard++; }
    return n;
  }

  function todaySubmitted(studentId, date) {
    var out = {};
    queryRecords({ studentId: studentId, date: date || todayStr() }).forEach(function (r) { out[r.subject] = r; });
    return out;
  }

  /* 作业完成率：按「张」为单位，比较老师布置张数与学生实交张数。
     opt.from / opt.to 限定日期范围（默认本周一 ~ 今天）。 */
  function completionRate(studentId, opt) {
    opt = opt || {};
    var d = data();
    var from = opt.from || weekStart(todayStr());
    var to = opt.to || todayStr();
    var shift = opt.shift; // 'day' | 'night' | undefined（不区分）
    // 只统计该生所修的科目：学生没选的科目不计入"应交"，避免完成率被别人的科目拉低
    var mine = {};
    studentSubjects(studentId).forEach(function (k) { mine[k] = true; });
    var assigned = 0, submitted = 0;
    (d.assignments || []).forEach(function (a) {
      if (a.date < from || a.date > to) return;
      if (shift && a.shift !== shift) return;
      (a.subjects || []).forEach(function (sub) {
        if (!mine[sub]) return;
        var want = (a.counts && a.counts[sub] != null) ? a.counts[sub] : 1;
        var rec = findRecord(studentId, a.date, sub, shift);
        var got = rec ? (rec.count || 0) : 0;
        assigned += want;
        submitted += got;
      });
    });
    var rate = assigned ? Math.min(1, submitted / assigned) : 0;
    return { assigned: assigned, submitted: submitted, rate: rate, hasAssign: assigned > 0 };
  }

  /* ---------------- 考勤（迟到 / 请假，按课次） ---------------- */
  function attendanceList() { return data().attendance || []; }
  // 取某学生在某天某课次的状态记录（period 缺省取该天“最严重”的一条：迟到>请假>正常）
  function getAttendance(studentId, date, period) {
    var list = attendanceList().filter(function (a) { return a.studentId === studentId && a.date === date; });
    if (period) return list.filter(function (a) { return a.period === period; })[0] || null;
    if (!list.length) return null;
    var late = list.filter(function (a) { return a.status === 'late'; })[0];
    if (late) return late;
    var leave = list.filter(function (a) { return a.status === 'leave'; })[0];
    if (leave) return leave;
    return list[0];
  }
  // 当前操作人（用于出勤记录留痕：哪个账号操作的）
  function operatorInfo() {
    var u = currentUser();
    return u ? { byUser: u.name, byUserId: u.id } : { byUser: '未知', byUserId: null };
  }
  // status: 'late' | 'leave' | 'present'（正常到班，记录到班时间）；period 必填
  // opts: { note, arrivedAt, lateMinutes, byUser, byUserId }
  // 说明：正常到班不再删除记录，而是保留一条 arrivedAt 的「到班」记录，便于按到班先后排序。
  function setAttendance(studentId, date, period, status, opts) {
    opts = opts || {};
    var d = data();
    if (!d.attendance) d.attendance = [];
    if (!period) period = PERIODS[0];
    var now = new Date().toISOString();
    var op = opts.byUser ? { byUser: opts.byUser, byUserId: opts.byUserId } : operatorInfo();
    var ex = getAttendance(studentId, date, period);
    function apply(ex) {
      ex.status = status;
      ex.note = opts.note || '';
      ex.byUser = op.byUser || '未知';
      ex.byUserId = op.byUserId || null;
      ex.updatedAt = now;
      if (status === 'present') { ex.arrivedAt = opts.arrivedAt || now; ex.lateMinutes = 0; }
      else if (status === 'late') { ex.arrivedAt = opts.arrivedAt || now; ex.lateMinutes = (opts.lateMinutes != null ? (+opts.lateMinutes) : 0); }
      else { ex.arrivedAt = null; ex.lateMinutes = 0; }
    }
    if (ex) {
      apply(ex);
    } else {
      var arrAt = status === 'leave' ? null : (opts.arrivedAt || now);
      var lmin = status === 'late' ? (opts.lateMinutes != null ? (+opts.lateMinutes) : 0) : 0;
      d.attendance.push({
        id: 'att_' + studentId + '_' + date + '_' + period, studentId: studentId, date: date, period: period,
        status: status, note: opts.note || '', arrivedAt: arrAt, lateMinutes: lmin,
        byUser: op.byUser || '未知', byUserId: op.byUserId || null, createdAt: date, updatedAt: now
      });
    }
    save();
    return getAttendance(studentId, date, period);
  }
  function removeAttendance(studentId, date, period) { setAttendance(studentId, date, period, 'present'); }
  // 批量删除指定状态的考勤记录（默认删除 迟到/请假，保留正常到班记录）。
  // 用于「清空历史迟到/请假数据」：删除后打墓碑并随 save() 同步到云端，其他设备一并清空。
  function deleteAttendanceByStatus(statuses) {
    statuses = statuses || ['late', 'leave'];
    var d = data();
    if (!d.attendance) return 0;
    var set = {};
    statuses.forEach(function (s) { set[s] = true; });
    var before = d.attendance.length;
    d.attendance.forEach(function (a) { if (set[a.status]) markTomb('attendance', a.id); });
    d.attendance = d.attendance.filter(function (a) { return !set[a.status]; });
    save(); // save() 会触发 scheduleCloud，把清空结果同步到云端
    return before - d.attendance.length;
  }
  // 清空全部文化课成绩（含演示数据），并打墓碑 + 同步云端（墓碑保证不会在 merge 时复活）
  function clearCultureScores() {
    var d = data();
    if (!d.cultureScores) return 0;
    var before = d.cultureScores.length;
    d.cultureScores.forEach(function (c) { markTomb('cultureScores', c.id); });
    d.cultureScores = [];
    save();
    return before;
  }
  // 清空全部专业课成绩（含演示数据），并打墓碑 + 同步云端
  function clearProfGrades() {
    var d = data();
    if (!d.profGrades) return 0;
    var before = d.profGrades.length;
    d.profGrades.forEach(function (c) { markTomb('profGrades', c.id); });
    d.profGrades = [];
    save();
    return before;
  }
  // 考勤统计：个人累计迟到/请假、指定日期/课次迟到请假、每日趋势、各课次分布
  function attendanceStats(opt) {
    opt = opt || {};
    var period = opt.period;
    var att = attendanceList().filter(function (a) { return a.status === 'late' || a.status === 'leave'; });
    var students = allStudents();
    var map = {};
    students.forEach(function (s) { map[s.id] = { st: s, late: 0, leave: 0 }; });
    var totalLate = 0, totalLeave = 0;
    att.forEach(function (a) {
      if (!map[a.studentId]) return;
      if (a.status === 'late') { map[a.studentId].late++; totalLate++; }
      else if (a.status === 'leave') { map[a.studentId].leave++; totalLeave++; }
    });
    var today = opt.date || todayStr();
    function matchPeriod(a) { return !period || a.period === period; }
    var todayLate = att.filter(function (a) { return a.date === today && matchPeriod(a) && a.status === 'late'; }).map(function (a) { return a.studentId; });
    var todayLeave = att.filter(function (a) { return a.date === today && matchPeriod(a) && a.status === 'leave'; }).map(function (a) { return a.studentId; });
    var n = opt.days || 14;
    var days = lastNDates(n);
    var dailyLate = days.map(function (dt) {
      return { date: dt, count: att.filter(function (a) { return a.date === dt && matchPeriod(a) && a.status === 'late'; }).length };
    });
    var dailyLeave = days.map(function (dt) {
      return { date: dt, count: att.filter(function (a) { return a.date === dt && matchPeriod(a) && a.status === 'leave'; }).length };
    });
    // 各课次迟到/请假分布（针对 opt.date）
    var periodBreakdown = PERIODS.map(function (p) {
      var recs = attendanceList().filter(function (a) { return a.date === today && a.period === p && (a.status === 'late' || a.status === 'leave'); });
      var late = recs.filter(function (a) { return a.status === 'late'; }).length;
      var leave = recs.filter(function (a) { return a.status === 'leave'; }).length;
      var present = students.length - late - leave;
      return { period: p, late: late, leave: leave, present: present < 0 ? 0 : present, total: students.length };
    });
    // 每天每课次迟到矩阵（每天迟到统计表用）
    var dailyByPeriod = days.slice().reverse().map(function (dt) {
      var row = { date: dt, total: 0, byPeriod: {} };
      PERIODS.forEach(function (p) {
        var c = att.filter(function (a) { return a.date === dt && a.period === p && a.status === 'late'; }).length;
        row.byPeriod[p] = c; row.total += c;
      });
      return row;
    });
    return {
      students: students.map(function (s) { return map[s.id]; }),
      totalLate: totalLate, totalLeave: totalLeave,
      todayLate: todayLate, todayLeave: todayLeave,
      dailyLate: dailyLate, dailyLeave: dailyLeave,
      periodBreakdown: periodBreakdown, dailyByPeriod: dailyByPeriod,
      period: period || null
    };
  }
  // 按姓名查找学生（导入成绩时匹配学生）
  function getStudentByName(name) {
    var n = (name || '').trim().replace(/\s/g, '');
    if (!n) return null;
    var list = data().students || [];
    var hit = list.filter(function (s) { return (s.name || '').replace(/\s/g, '') === n; })[0];
    return hit || null;
  }
  // 中文科目名 → 科目 key（专业成绩导入用；也接受 key 本身）
  function subjectByLabel(label) {
    var l = (label || '').trim();
    var map = {};
    SUBJECTS.forEach(function (s) { map[s.key] = s.key; map[s.name] = s.key; });
    if (map[l]) return map[l];
    var hit = SUBJECTS.filter(function (s) { return l.indexOf(s.name) >= 0 || s.name.indexOf(l) >= 0; })[0];
    return hit ? hit.key : null;
  }
  // 某学生的迟到 / 请假记录（家长端展示，按日期倒序）
  function studentAttendance(studentId) {
    return attendanceList().filter(function (a) {
      return a.studentId === studentId && (a.status === 'late' || a.status === 'leave');
    }).sort(function (a, b) { return (a.date || '') < (b.date || '') ? 1 : -1; });
  }
  // 到班顺序：某天某课次，按到班时间升序（迟到也计入，便于看谁先到 / 谁迟到）
  function attendanceArrivalOrder(date, period) {
    return (data().attendance || [])
      .filter(function (a) { return a.date === date && a.period === period && a.status !== 'leave' && a.arrivedAt; })
      .sort(function (a, b) { return parseTime(a.arrivedAt) - parseTime(b.arrivedAt); });
  }
  // 今日该生的到班记录（最早一条，含迟到），家长端首页展示
  function studentArrivalToday(sid) {
    var t = todayStr();
    return (data().attendance || [])
      .filter(function (a) { return a.studentId === sid && a.date === t && a.status !== 'leave' && a.arrivedAt; })
      .sort(function (a, b) { return parseTime(a.arrivedAt) - parseTime(b.arrivedAt); })[0] || null;
  }
  // 该生迟到汇总：次数 / 迟到天数 / 累计迟到分钟 / 最近一次
  function studentLateSummary(sid) {
    var recs = (data().attendance || []).filter(function (a) { return a.studentId === sid && a.status === 'late'; });
    var days = {}, minutes = 0, last = null;
    recs.forEach(function (a) {
      days[a.date] = true;
      minutes += (a.lateMinutes || 0);
      if (!last || a.date > last.date) last = a;
    });
    return { count: recs.length, lateDays: Object.keys(days).length, minutes: minutes, last: last };
  }
  // 全班学生迟到统计（近 n 天）：用于老师端「学生迟到排行」
  function studentLateStats(n) {
    n = n || 14;
    var set = {}; lastNDates(n).forEach(function (d) { set[d] = true; });
    return allStudents().map(function (s) {
      var recs = (data().attendance || []).filter(function (a) {
        return a.studentId === s.id && a.status === 'late' && set[a.date];
      });
      var daySet = {}, minutes = 0;
      recs.forEach(function (a) { daySet[a.date] = true; minutes += (a.lateMinutes || 0); });
      var last = recs.slice().sort(function (a, b) { return (a.date || '') < (b.date || '') ? 1 : -1; })[0] || null;
      return { st: s, lateCount: recs.length, lateDays: Object.keys(daySet).length, minutes: minutes, last: last };
    }).sort(function (a, b) {
      return b.lateCount - a.lateCount || b.minutes - a.minutes || ((a.st.name || '') < (b.st.name || '') ? -1 : 1);
    });
  }
  // 家长端首页：文化课总分走势（历次考试全班平均 / 该生平均）
  function studentCultureTotalTrend(sid) {
    var exams = cultureExams();
    return {
      labels: exams.map(function (e) { return e.name; }),
      data: exams.map(function (e) {
        var rows = cultureScores({ studentId: sid, examName: e.name });
        if (!rows.length) return null;
        return Math.round(rows.reduce(function (a, c) { return a + c.score; }, 0) / rows.length);
      })
    };
  }
  // 家长端首页：专业课总分走势（历次场次平均）
  function studentProfTotalTrend(sid) {
    var exams = profExams();
    return {
      labels: exams.map(function (e) { return e.name; }),
      data: exams.map(function (e) {
        var rows = profGrades({ studentId: sid, examName: e.name });
        var scored = rows.filter(function (c) { return c.score != null; });
        if (!scored.length) return null;
        return Math.round(scored.reduce(function (a, c) { return a + c.score; }, 0) / scored.length);
      })
    };
  }

  /* ---------------- 文化课成绩 ---------------- */
  function cultureScores(opt) {
    opt = opt || {};
    var list = (data().cultureScores || []).slice();
    if (opt.studentId) list = list.filter(function (c) { return c.studentId === opt.studentId; });
    if (opt.examName) list = list.filter(function (c) { return c.examName === opt.examName; });
    if (opt.subject) list = list.filter(function (c) { return c.subject === opt.subject; });
    list.sort(function (a, b) { return (a.examDate || '') < (b.examDate || '') ? -1 : 1; });
    return list;
  }
  function addCultureScore(payload) {
    var d = data();
    if (!d.cultureScores) d.cultureScores = [];
    var c = {
      id: uid('cs'), studentId: payload.studentId, examName: payload.examName, examDate: payload.examDate || todayStr(),
      subject: payload.subject, score: +payload.score || 0, fullScore: payload.fullScore || 100,
      note: payload.note || '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    d.cultureScores.push(c); save(); return c;
  }
  function updateCultureScore(id, payload) {
    var c = (data().cultureScores || []).filter(function (x) { return x.id === id; })[0];
    if (!c) return null;
    if (payload.examName !== undefined) c.examName = payload.examName;
    if (payload.examDate !== undefined) c.examDate = payload.examDate;
    if (payload.subject !== undefined) c.subject = payload.subject;
    if (payload.score !== undefined) c.score = +payload.score || 0;
    if (payload.fullScore !== undefined) c.fullScore = payload.fullScore || 100;
    c.updatedAt = new Date().toISOString();
    save(); return c;
  }
  function removeCultureScore(id) {
    var d = data();
    d.cultureScores = (d.cultureScores || []).filter(function (x) { return x.id !== id; });
    markTomb('cultureScores', id); save();
  }
  function cultureExams() {
    var map = {};
    (data().cultureScores || []).forEach(function (c) {
      if (!map[c.examName] || c.examDate > map[c.examName].date) map[c.examName] = { name: c.examName, date: c.examDate };
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return (a.date || '') < (b.date || '') ? -1 : 1; });
  }
  function studentCultureTrend(studentId, subject) {
    var list = cultureScores({ studentId: studentId, subject: subject });
    return {
      labels: list.map(function (c) { return c.examName; }),
      data: list.map(function (c) { return c.score; })
    };
  }
  function classCultureTrend(subject) {
    var exams = cultureExams();
    return {
      labels: exams.map(function (e) { return e.name; }),
      data: exams.map(function (e) {
        var rows = cultureScores({ examName: e.name, subject: subject });
        if (!rows.length) return 0;
        return Math.round(rows.reduce(function (a, c) { return a + c.score; }, 0) / rows.length);
      })
    };
  }
  function cultureExamTable(examName) {
    var rows = cultureScores({ examName: examName });
    var map = {};
    rows.forEach(function (c) { (map[c.studentId] = map[c.studentId] || {})[c.subject] = c; });
    var ids = {};
    rows.forEach(function (c) { ids[c.studentId] = 1; });
    var students = allStudents().filter(function (s) { return ids[s.id]; });
    var avg = {};
    CULTURE_SUBJECTS.forEach(function (sub) {
      var arr = rows.filter(function (c) { return c.subject === sub; });
      avg[sub] = arr.length ? Math.round(arr.reduce(function (a, c) { return a + c.score; }, 0) / arr.length) : null;
    });
    return { students: students, map: map, avg: avg, subjects: CULTURE_SUBJECTS.slice() };
  }

  /* ---------------- 专业成绩（教师录入，独立于作业批改） ---------------- */
  function profGrades(opt) {
    opt = opt || {};
    var list = (data().profGrades || []).slice();
    if (opt.studentId) list = list.filter(function (c) { return c.studentId === opt.studentId; });
    if (opt.subject) list = list.filter(function (c) { return c.subject === opt.subject; });
    if (opt.type) list = list.filter(function (c) { return c.type === opt.type; });
    if (opt.examName) list = list.filter(function (c) { return (c.examName || '') === opt.examName; });
    return list;
  }
  function addProfGrade(payload) {
    var d = data();
    if (!d.profGrades) d.profGrades = [];
    var type = payload.type === 'quiz' ? 'quiz' : 'exam';
    var examName = payload.examName || '';
    // 同 (studentId, subject, type, examName) 已存在则更新，避免重复条目
    var exist = d.profGrades.filter(function (x) {
      return x.studentId === payload.studentId && x.subject === payload.subject &&
        (x.type === 'quiz' ? 'quiz' : 'exam') === type && (x.examName || '') === examName;
    })[0];
    if (exist) return updateProfGrade(exist.id, payload);
    var c = {
      id: uid('pg'), studentId: payload.studentId, subject: payload.subject,
      type: type, examName: examName, examDate: payload.examDate || payload.date || todayStr(),
      grade: (payload.grade === '' || payload.grade == null) ? null : payload.grade,
      score: payload.score === '' || payload.score == null ? null : (+payload.score),
      comment: payload.comment || '',
      date: payload.date || todayStr(), byName: payload.byName || '教师',
      updatedAt: new Date().toISOString()
    };
    d.profGrades.push(c); save(); return c;
  }
  function updateProfGrade(id, payload) {
    var c = (data().profGrades || []).filter(function (x) { return x.id === id; })[0];
    if (!c) return null;
    if (payload.subject !== undefined) c.subject = payload.subject;
    if (payload.type !== undefined) c.type = payload.type;
    if (payload.examName !== undefined) c.examName = payload.examName;
    if (payload.examDate !== undefined) c.examDate = payload.examDate;
    if (payload.grade !== undefined) c.grade = (payload.grade === '' || payload.grade == null) ? null : payload.grade;
    if (payload.score !== undefined) c.score = (payload.score === '' || payload.score == null) ? null : (+payload.score);
    if (payload.comment !== undefined) c.comment = payload.comment;
    if (payload.date !== undefined) c.date = payload.date;
    if (payload.byName) c.byName = payload.byName;
    c.updatedAt = new Date().toISOString();
    save(); return c;
  }
  function removeProfGrade(id) {
    var d = data();
    d.profGrades = (d.profGrades || []).filter(function (x) { return x.id !== id; });
    markTomb('profGrades', id); save();
  }
  // 专业成绩表（student × subject），每个单元格分考试成绩与小测成绩（均含等级+分数）
  // examName 不传则返回所有场次合并后的最新结果；传入则只取该场次
  function profGradeTable(examName) {
    var rows = examName ? profGrades({ examName: examName }) : profGrades();
    var map = {};
    rows.forEach(function (c) {
      var sm = map[c.studentId] = map[c.studentId] || {};
      var sgm = sm[c.subject] = sm[c.subject] || { exam: null, quiz: null };
      if (c.type === 'quiz') sgm.quiz = c; else sgm.exam = c;
    });
    var ids = {};
    rows.forEach(function (c) { ids[c.studentId] = 1; });
    var students = allStudents().filter(function (s) { return ids[s.id]; });
    return { students: students, map: map, subjects: SUBJECTS.slice() };
  }
  // 专业成绩考试场次（从 profGrades 反推，类似 cultureExams）
  function profExams() {
    var map = {};
    (data().profGrades || []).forEach(function (c) {
      var nm = c.examName || '未分场次';
      if (!map[nm] || (c.examDate || '') > (map[nm].date || '')) map[nm] = { name: nm, date: c.examDate || '' };
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return (a.date || '') < (b.date || '') ? -1 : 1; });
  }
  // 专业成绩跨场次走势：某科某类型各场次班级平均分（type: 'exam'|'quiz'|'all'）
  function classProfTrend(subject, type) {
    var exams = profExams();
    return {
      labels: exams.map(function (e) { return e.name; }),
      data: exams.map(function (e) {
        var list = profGrades({ examName: e.name, subject: subject });
        if (type && type !== 'all') list = list.filter(function (c) { return c.type === type; });
        var scored = list.filter(function (c) { return c.score != null; });
        if (!scored.length) return 0;
        return Math.round(scored.reduce(function (a, c) { return a + c.score; }, 0) / scored.length);
      })
    };
  }
  function studentProfTrend(studentId, subject, type) {
    var exams = profExams();
    return {
      labels: exams.map(function (e) { return e.name; }),
      data: exams.map(function (e) {
        var list = profGrades({ studentId: studentId, examName: e.name, subject: subject });
        if (type && type !== 'all') list = list.filter(function (c) { return c.type === type; });
        var scored = list.filter(function (c) { return c.score != null; });
        if (!scored.length) return 0;
        return Math.round(scored.reduce(function (a, c) { return a + c.score; }, 0) / scored.length);
      })
    };
  }

  /* ---------------- 导入导出 ---------------- */
  function exportJSON() { return JSON.stringify(data(), null, 2); }
  function importJSON(text) {
    try {
      var obj = JSON.parse(text);
      if (!obj.users || !obj.students) return { ok: false, msg: '文件格式不正确' };
      state = obj; save();
      return { ok: true };
    } catch (e) { return { ok: false, msg: '解析失败：' + e.message }; }
  }
  function exportCSV(records) {
    var head = ['日期', '班级', '学号', '姓名', '科目', '完成数量', '完成程度(%)', '评级', '评语', '图片数'];
    var rows = records.map(function (r) {
      var st = getStudent(r.studentId) || { name: '', no: '' };
      return [r.date, className(r.classId), st.no, st.name, subject(r.subject).name,
        r.count, r.progress, r.grade || '待批改', (r.teacherComment || '').replace(/[,\n]/g, ' '), (r.images || []).length];
    });
    return [head].concat(rows).map(function (a) { return a.join(','); }).join('\n');
  }

  return {
    SUBJECTS: SUBJECTS, GRADES: GRADES, GRADE_TEXT: GRADE_TEXT, GRADE_COLOR: GRADE_COLOR, ROLE_TEXT: ROLE_TEXT,
    CULTURE_SUBJECTS: CULTURE_SUBJECTS, SHIFTS: SHIFTS, shift: shift, PERIODS: PERIODS,
    load: load, save: save, data: data, resetDemo: resetDemo, hydrate: hydrate, merge: merge, syncFromCloud: syncFromCloud, bootstrap: bootstrap, poll: poll, pushNow: pushNow, hasRealData: hasRealData, migrateInlineImages: migrateInlineImages,
    deepSync: deepSync, flush: flush, fullPull: fullPull, getLastFullSync: getLastFullSync,
    login: login, logout: logout, currentUser: currentUser, changePassword: changePassword, needsPasswordChange: needsPasswordChange,
    getStudent: getStudent, getClass: getClass, className: className, allStudents: allStudents,
    studentUsers: studentUsers, subject: subject, studentSubjects: studentSubjects, setStudentSubjects: setStudentSubjects,
    studentCultureSubjects: studentCultureSubjects, setStudentCultureSubjects: setStudentCultureSubjects,
    queryRecords: queryRecords, findRecord: findRecord,
    upsertRecord: upsertRecord, gradeRecord: gradeRecord, deleteRecord: deleteRecord, clearDemoHomework: clearDemoHomework, removeImageFromRecord: removeImageFromRecord,
    addStudent: addStudent, updateStudent: updateStudent, removeStudent: removeStudent,
    setUserAvatar: setUserAvatar, setStudentAvatar: setStudentAvatar,
    setSchoolName: setSchoolName, renameClass: renameClass, deleteClass: deleteClass,
    deleteStudentPortfolio: deleteStudentPortfolio,
    assignmentsByDate: assignmentsByDate, getAssignment: getAssignment,
    addAssignment: addAssignment, updateAssignment: updateAssignment, removeAssignment: removeAssignment,
    resetPassword: resetPassword, addClass: addClass, addTeacher: addTeacher, removeUser: removeUser,
    summarize: summarize, streakDays: streakDays, todaySubmitted: todaySubmitted, completionRate: completionRate,
    gradeScore: gradeScore, scoreToGrade: scoreToGrade, scoreToLetter: scoreToLetter,
    attendanceList: attendanceList, getAttendance: getAttendance, setAttendance: setAttendance, removeAttendance: removeAttendance, deleteAttendanceByStatus: deleteAttendanceByStatus, clearCultureScores: clearCultureScores, clearProfGrades: clearProfGrades, attendanceStats: attendanceStats,
    getStudentByName: getStudentByName, subjectByLabel: subjectByLabel, studentAttendance: studentAttendance,
    attendanceArrivalOrder: attendanceArrivalOrder, studentArrivalToday: studentArrivalToday,
    studentLateSummary: studentLateSummary, studentLateStats: studentLateStats,
    studentCultureTotalTrend: studentCultureTotalTrend, studentProfTotalTrend: studentProfTotalTrend,
    cultureScores: cultureScores, addCultureScore: addCultureScore, updateCultureScore: updateCultureScore, removeCultureScore: removeCultureScore,
    cultureExams: cultureExams, studentCultureTrend: studentCultureTrend, classCultureTrend: classCultureTrend, cultureExamTable: cultureExamTable,
    profGrades: profGrades, addProfGrade: addProfGrade, updateProfGrade: updateProfGrade, removeProfGrade: removeProfGrade, profGradeTable: profGradeTable,
    profExams: profExams, classProfTrend: classProfTrend, studentProfTrend: studentProfTrend,
    exportJSON: exportJSON, importJSON: importJSON, exportCSV: exportCSV,
    uid: uid, todayStr: todayStr, dateStr: dateStr, shiftDate: shiftDate,
    weekStart: weekStart, lastNDates: lastNDates, weekdayCN: weekdayCN, mmdd: mmdd
  };
})();

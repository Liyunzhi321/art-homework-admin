/* ============================================================
   学生管理（教师）
   ============================================================ */
Views.students = {
  title: '学生管理',
  render: function () {
    var q = App.query();
    var cls = q.cls || '';
    var classes = Store.data().classes;
    var list = Store.allStudents().filter(function (s) { return !cls || s.classId === cls; });
    var weekFrom = Store.weekStart(Store.todayStr());
    var attMap = {};
    Store.attendanceStats().students.forEach(function (x) { attMap[x.st.id] = x; });

    var rows = list.map(function (st) {
      var recs = Store.queryRecords({ studentId: st.id });
      var week = Store.queryRecords({ studentId: st.id, from: weekFrom });
      var sum = Store.summarize(recs);
      var ws = Store.summarize(week);
      var comp = Store.completionRate(st.id);
      var us = Store.studentUsers(st.id);
      var su = us.filter(function (u) { return u.role === 'student'; })[0] || {};
      var pu = us.filter(function (u) { return u.role === 'parent'; })[0] || {};
      return '<tr>' +
        '<td><div class="row">' + UI.avatar(st.name, st.color, 'sm', st.avatar) +
          '<div><b>' + UI.esc(st.name) + '</b><div class="small muted">学号 ' + UI.esc(st.no) + '</div></div></div></td>' +
        '<td>' + UI.esc(Store.className(st.classId)) + '</td>' +
        '<td><div class="small">学生 <code>' + UI.esc(su.account || '-') + '</code></div>' +
          '<div class="small muted">家长 <code>' + UI.esc(pu.account || '-') + '</code></div></td>' +
        '<td><b>' + ws.pieces + '</b> 张<div class="small muted">' + week.length + ' 次提交</div></td>' +
        '<td><b>' + sum.pieces + '</b> 张<div class="small muted">' + sum.images + ' 幅作品</div></td>' +
        '<td>' + UI.gradeBadge(sum.avgGrade) + '</td>' +
        '<td>' + (comp.hasAssign ? UI.pctBar(comp.rate) : '<span class="small muted">—</span>') + '</td>' +
        (function () {
          var a = attMap[st.id];
          var late = a ? a.late : 0, leave = a ? a.leave : 0;
          return '<td><div class="row" style="gap:5px;flex-wrap:wrap">' +
            (late ? '<span class="badge warn">迟到 ' + late + '</span>' : '<span class="small muted">准时</span>') +
            (leave ? '<span class="badge danger">请假 ' + leave + '</span>' : '') +
            '</div></td>';
        })() +
        '<td><div class="row" style="gap:6px">' +
          '<button class="btn sm ghost" data-go="#/portfolio?student=' + st.id + '">作品集</button>' +
          '<button class="btn sm" data-up-st="' + st.id + '" title="代替该学生交作业">代交作业</button>' +
          '<button class="icon-btn" data-edit-st="' + st.id + '" title="编辑">✎</button>' +
          '<button class="icon-btn" data-pwd-st="' + st.id + '" title="重置密码">🔑</button>' +
          '<button class="icon-btn" data-del-st="' + st.id + '" title="删除">🗑</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');

    var teachers = Store.data().users.filter(function (u) { return u.role === 'teacher'; });
    var curTeacherId = (Store.currentUser() && Store.currentUser().role === 'teacher') ? Store.currentUser().id : null;
    var trows = teachers.map(function (t) {
      var isMe = t.id === curTeacherId;
      return '<tr>' +
        '<td><div class="row">' + UI.avatar(t.name, '#5A4FCF', 'sm', t.avatar) +
          '<div><b>' + UI.esc(t.name) + '</b><div class="small muted">' + UI.esc(t.title || '教师') + (isMe ? ' · 当前账号' : '') + '</div></div></div></td>' +
        '<td><code>' + UI.esc(t.account) + '</code></td>' +
        '<td><span class="small muted">••••••</span></td>' +
        '<td><div class="row" style="gap:6px">' +
          '<button class="icon-btn" data-pwd-teacher="' + t.id + '" title="重置密码">🔑</button>' +
          (isMe ? '<span class="small muted">不可删除</span>' : '<button class="icon-btn" data-del-teacher="' + t.id + '" title="删除">🗑</button>') +
        '</div></td>' +
      '</tr>';
    }).join('');

    return '' +
      '<div class="filters">' +
        '<button class="chip' + (cls === '' ? ' active' : '') + '" data-f="cls" data-v="">全部班级</button>' +
        classes.map(function (c) {
          return '<button class="chip' + (cls === c.id ? ' active' : '') + '" data-f="cls" data-v="' + c.id + '">' + UI.esc(c.name) + '</button>';
        }).join('') +
        '<div class="spacer"></div>' +
        '<button class="btn sm ghost" id="manageCls">管理班级</button>' +
        '<button class="btn sm ghost" id="addCls">＋ 新建班级</button>' +
        '<button class="btn sm" id="addSt">＋ 添加学生</button>' +
      '</div>' +
      '<div class="card"><div class="table-wrap"><table class="tbl">' +
        '<thead><tr><th>学生</th><th>班级</th><th>登录账号</th><th>本周</th><th>累计</th><th>平均评级</th><th>完成率</th><th>考勤</th><th>操作</th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="9">' + UI.empty('暂无学生', '点击右上角添加学生', '🎒') + '</td></tr>') + '</tbody>' +
      '</table></div></div>' +
      '<div class="small muted section-gap">提示：添加学生后会自动生成学生账号与家长账号，初始密码 123456，可在此页面重置。</div>' +
      '<div class="section-gap"></div>' +
      '<div class="card"><div class="card-head"><div><h3>老师账号管理</h3>' +
        '<div class="small muted">教师账号可登录教师端，管理作业、学生与家长</div></div>' +
        '<button class="btn sm" id="addTeacher">＋ 添加老师</button></div>' +
      '<div class="table-wrap"><table class="tbl">' +
        '<thead><tr><th>姓名 / 职务</th><th>登录账号</th><th>密码</th><th>操作</th></tr></thead>' +
        '<tbody>' + (trows || '<tr><td colspan="4">' + UI.empty('暂无老师账号', '点击右上角添加', '👩‍🏫') + '</td></tr>') + '</tbody>' +
      '</table></div></div>' +
      '<div class="small muted section-gap">提示：初始密码 123456，可随时点击 🔑 重置；删除后该老师将无法登录（当前账号不可删除）。</div>';
  },
  mount: function () {
    UI.els('[data-f]').forEach(function (b) { b.onclick = function () { App.setQuery(b.dataset.f, b.dataset.v); }; });
    UI.els('[data-go]').forEach(function (b) { b.onclick = function () { location.hash = b.dataset.go; }; });

    var addBtn = UI.el('#addSt');
    if (addBtn) addBtn.onclick = function () { studentModal(null); };
    var manageClsBtn = UI.el('#manageCls');
    if (manageClsBtn) manageClsBtn.onclick = function () { classManageModal(); };
    var addClsBtn = UI.el('#addCls');
    if (addClsBtn) addClsBtn.onclick = function () {
      UI.modal({
        title: '新建班级',
        body: '<div class="field"><label>班级名称（可含年级，如 高二六班）</label><input class="input" id="clsName" placeholder="例如：暑期色彩强化班"></div>',
        onOk: function (m) {
          var v = UI.el('#clsName', m).value.trim();
          if (!v) { UI.toast('请输入班级名称', 'err'); return false; }
          Store.addClass(v); UI.toast('班级已创建', 'ok'); App.render();
        }
      });
    };

    UI.els('[data-edit-st]').forEach(function (b) {
      b.onclick = function () { studentModal(b.dataset.editSt); };
    });
    UI.els('[data-up-st]').forEach(function (b) {
      b.onclick = function () { openTeacherUpload(b.dataset.upSt); };
    });
    UI.els('[data-pwd-st]').forEach(function (b) {
      b.onclick = function () {
        var us = Store.studentUsers(b.dataset.pwdSt);
        var su = us.filter(function (u) { return u.role === 'student'; })[0];
        var pu = us.filter(function (u) { return u.role === 'parent'; })[0];
        UI.modal({
          title: '重置密码',
          body: '<div class="field"><label>学生账号 ' + UI.esc(su ? su.account : '') + ' 的新密码</label>' +
            '<input class="input" id="np1" value="123456"></div>' +
            '<div class="field"><label>家长账号 ' + UI.esc(pu ? pu.account : '') + ' 的新密码</label>' +
            '<input class="input" id="np2" value="123456"></div>',
          onOk: function (m) {
            if (su) Store.resetPassword(su.id, UI.el('#np1', m).value || '123456');
            if (pu) Store.resetPassword(pu.id, UI.el('#np2', m).value || '123456');
            UI.toast('密码已重置', 'ok');
          }
        });
      };
    });
    UI.els('[data-del-st]').forEach(function (b) {
      b.onclick = function () {
        var st = Store.getStudent(b.dataset.delSt);
        UI.confirm('删除学生', '将同时删除 ' + (st ? st.name : '') + ' 的全部作业记录、作品与账号，且不可恢复。', function () {
          Store.removeStudent(b.dataset.delSt);
          UI.toast('已删除', 'ok');
          App.render();
        }, true);
      };
    });

    var addTeacherBtn = UI.el('#addTeacher');
    if (addTeacherBtn) addTeacherBtn.onclick = function () { teacherModal(); };

    UI.els('[data-pwd-teacher]').forEach(function (b) {
      b.onclick = function () {
        var t = Store.data().users.filter(function (u) { return u.id === b.dataset.pwdTeacher; })[0];
        UI.modal({
          title: '重置老师密码',
          body: '<div class="field"><label>老师 ' + UI.esc(t ? t.name : '') + '（账号 ' + UI.esc(t ? t.account : '') + '）的新密码</label>' +
            '<input class="input" id="tp" value="123456"></div>',
          onOk: function (m) {
            Store.resetPassword(b.dataset.pwdTeacher, UI.el('#tp', m).value || '123456');
            UI.toast('密码已重置', 'ok');
          }
        });
      };
    });
    UI.els('[data-del-teacher]').forEach(function (b) {
      b.onclick = function () {
        var t = Store.data().users.filter(function (u) { return u.id === b.dataset.delTeacher; })[0];
        UI.confirm('删除老师账号', '将删除 ' + (t ? t.name : '') + ' 的登录账号，且不可恢复。', function () {
          Store.removeUser(b.dataset.delTeacher);
          UI.toast('已删除', 'ok');
          App.render();
        }, true);
      };
    });
  }
};

function studentModal(id) {
  var st = id ? Store.getStudent(id) : null;
  var us = id ? Store.studentUsers(id) : [];
  var su = us.filter(function (u) { return u.role === 'student'; })[0] || {};
  var pu = us.filter(function (u) { return u.role === 'parent'; })[0] || {};
  var classes = Store.data().classes;
  UI.modal({
    title: st ? '编辑学生' : '添加学生',
    okText: st ? '保存' : '创建',
    onMount: st ? function (m) {
      var prev = UI.el('#stAvatarPrev', m);
      if (prev) prev.onclick = function () {
        UI.pickAvatar(function (url) {
          if (!url) { UI.toast('读取图片失败', 'err'); return; }
          Store.setStudentAvatar(id, url);
          prev.innerHTML = UI.avatar(st.name, st.color, 'lg', url) +
            '<span class="avatar-edit" style="position:absolute;right:-2px;bottom:-2px;background:#fff;border:1px solid var(--border);border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 1px 3px rgba(0,0,0,.15)">✎</span>';
          UI.toast('头像已更新', 'ok');
        });
      };
    } : null,
    body:
      (st ? '<div class="row" style="gap:12px;margin-bottom:6px;align-items:center"><div style="position:relative;cursor:pointer" id="stAvatarPrev" title="点击更换头像">' +
        UI.avatar(st.name, st.color, 'lg', st.avatar) +
        '<span class="avatar-edit" style="position:absolute;right:-2px;bottom:-2px;background:#fff;border:1px solid var(--border);border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 1px 3px rgba(0,0,0,.15)">✎</span></div>' +
        '<div class="small muted">点击头像可上传 / 更换</div></div>' : '') +
      '<div class="field"><label>姓名</label><input class="input" id="mName" value="' + UI.esc(st ? st.name : '') + '" placeholder="学生姓名"></div>' +
      '<div class="field"><label>班级</label><select class="select" id="mCls">' +
        classes.map(function (c) { return '<option value="' + c.id + '"' + (st && st.classId === c.id ? ' selected' : '') + '>' + UI.esc(c.name) + '</option>'; }).join('') +
      '</select></div>' +
      (function () {
        var cur = (st && st.subjects) || Store.SUBJECTS.map(function (s) { return s.key; });
        var boxes = Store.SUBJECTS.map(function (s) {
          var on = cur.indexOf(s.key) >= 0;
          return '<label class="chk"><input type="checkbox" class="mSubj" value="' + s.key + '"' + (on ? ' checked' : '') + '> ' + s.icon + ' ' + s.name + '</label>';
        }).join('');
        return '<div class="field"><label>所修科目（该生实际学习的科目）</label><div class="chk-row">' + boxes + '</div>' +
          '<div class="small muted">学生登录后可在「我的」中自行修改自己的科目</div></div>';
      })() +
      '<div class="field"><label>学号</label><input class="input" id="mNo" value="' + UI.esc(st ? st.no : '') + '" placeholder="例如 A07"></div>' +
      (st ? '<div class="small muted">学生账号：' + UI.esc(su.account || '') + '　家长账号：' + UI.esc(pu.account || '') + '</div>' :
        '<div class="field"><label>学生登录账号</label><input class="input" id="mAcc" placeholder="例如 a07（登录时使用）"></div>' +
        '<div class="field"><label>初始密码</label><input class="input" id="mPwd" value="123456"></div>' +
        '<div class="small muted">系统会自动生成家长账号：p + 学生账号（如 pa07），密码同上。</div>'),
    onOk: function (m) {
      var name = UI.el('#mName', m).value.trim();
      var clsId = UI.el('#mCls', m).value;
      var no = UI.el('#mNo', m).value.trim();
      if (!name || !no) { UI.toast('请填写姓名和学号', 'err'); return false; }
      if (st) {
        var mSubs = [];
        UI.els('.mSubj', m).forEach(function (c) { if (c.checked) mSubs.push(c.value); });
        Store.updateStudent(id, { name: name, classId: clsId, no: no, subjects: mSubs });
        UI.toast('已保存', 'ok');
      } else {
        var acc = UI.el('#mAcc', m).value.trim().toLowerCase();
        var pwd = UI.el('#mPwd', m).value || '123456';
        if (!acc) { UI.toast('请填写学生登录账号', 'err'); return false; }
        var res = Store.addStudent({ name: name, classId: clsId, no: no, account: acc, password: pwd, parentAccount: 'p' + acc, parentPassword: pwd });
        if (!res.ok) { UI.toast(res.msg, 'err'); return false; }
        UI.toast('学生已添加', 'ok');
      }
      App.render();
    }
  });
}

function teacherModal() {
  UI.modal({
    title: '添加老师',
    okText: '创建',
    body:
      '<div class="field"><label>姓名</label><input class="input" id="tName" placeholder="老师姓名"></div>' +
      '<div class="field"><label>职务</label><input class="input" id="tTitle" value="美术教师" placeholder="例如 美术教师 / 助教"></div>' +
      '<div class="field"><label>登录账号</label><input class="input" id="tAcc" placeholder="例如 teacher2（登录时使用）"></div>' +
      '<div class="field"><label>初始密码</label><input class="input" id="tPwd" value="123456"></div>',
    onOk: function (m) {
      var name = UI.el('#tName', m).value.trim();
      var title = UI.el('#tTitle', m).value.trim() || '美术教师';
      var acc = UI.el('#tAcc', m).value.trim().toLowerCase();
      var pwd = UI.el('#tPwd', m).value || '123456';
      if (!name || !acc) { UI.toast('请填写姓名和登录账号', 'err'); return false; }
      var res = Store.addTeacher({ name: name, title: title, account: acc, password: pwd });
      if (!res.ok) { UI.toast(res.msg, 'err'); return false; }
      UI.toast('老师账号已创建', 'ok');
      App.render();
    }
  });
}

// 管理班级 / 年级：修改顶部显示名、重命名班级、删除空班级
function classManageModal() {
  var d = Store.data();
  var rows = d.classes.map(function (c) {
    var count = d.students.filter(function (s) { return s.classId === c.id; }).length;
    return '<div class="field row" style="gap:8px;align-items:center">' +
      '<input class="input" data-cls="' + c.id + '" value="' + UI.esc(c.name) + '" placeholder="班级名称">' +
      (count ? '<span class="small muted">' + count + ' 人</span>'
             : '<button class="icon-btn" data-del-cls="' + c.id + '" title="删除空班级">🗑</button>') +
    '</div>';
  }).join('');
  UI.modal({
    title: '管理班级 / 年级',
    okText: '保存',
    body:
      '<div class="field"><label>顶部显示的年级 / 班级名</label><input class="input" id="schoolName" value="' + UI.esc(d.settings.schoolName || '') + '"></div>' +
      '<div class="small muted" style="margin:4px 0 12px">修改后将在顶部标题、学生管理、作品集中同步显示。</div>' +
      '<div class="group-title">班级列表（可含年级，如 高二六班）</div>' + (rows || '<div class="small muted">暂无班级</div>'),
    onOk: function (m) {
      var sn = UI.el('#schoolName', m).value.trim();
      if (sn) Store.setSchoolName(sn);
      UI.els('[data-cls]', m).forEach(function (inp) {
        var nm = inp.value.trim();
        if (nm) Store.renameClass(inp.dataset.cls, nm);
      });
      UI.toast('已保存', 'ok');
      App.render();
    },
    onMount: function (m) {
      UI.els('[data-del-cls]', m).forEach(function (b) {
        b.onclick = function () {
          var id = b.dataset.delCls;
          UI.confirm('删除班级', '将移除该班级（仅可删除无学生的空班级）。', function () {
            var r = Store.deleteClass(id);
            if (!r.ok) { UI.toast(r.msg, 'err'); return; }
            UI.toast('已删除', 'ok');
            var mask = document.querySelector('.modal-mask');
            if (mask) mask.remove();
            classManageModal();
          }, true);
        };
      });
    }
  });
}

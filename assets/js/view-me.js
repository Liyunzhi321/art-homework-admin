/* ============================================================
   作业记录（学生 / 家长）与 个人中心
   ============================================================ */
var SB_SQL = "create table if not exists class_state(id text primary key default 'main', payload jsonb not null, updated_at timestamptz default now()); alter table class_state enable row level security; create policy \"public all\" on class_state for all using (true) with check (true); insert into class_state(id,payload) values('main','{}'::jsonb) on conflict(id) do nothing;";
var SB_STORAGE_SQL = "insert into storage.buckets (id, name, public) values ('artwork','artwork',true) on conflict (id) do nothing; create policy \"artwork upload\" on storage.objects for insert to anon with check ( bucket_id = 'artwork' ); create policy \"artwork read\" on storage.objects for select to anon using ( bucket_id = 'artwork' ); create policy \"artwork delete\" on storage.objects for delete to anon using ( bucket_id = 'artwork' );";
/* 账号密码清单：构造可复制/打印的文本与 HTML（含真实密码，仅教师可见） */
function buildAccSheetText(d) {
  var lines = [];
  lines.push('清大美术班学生考学数据系统 · 账号密码清单');
  lines.push('网址：' + location.origin + location.pathname);
  lines.push('');
  (d.users || []).filter(function (u) { return u.role === 'teacher'; }).forEach(function (u) {
    lines.push('【教师】' + u.name);
    lines.push('  账号：' + u.account + '    密码：' + u.password);
  });
  lines.push('');
  (d.students || []).forEach(function (s) {
    var su = (d.users || []).filter(function (u) { return u.role === 'student' && u.studentId === s.id; })[0];
    var pu = (d.users || []).filter(function (u) { return u.role === 'parent' && u.studentId === s.id; })[0];
    lines.push('【' + s.name + '（' + s.no + '）】');
    if (su) lines.push('  学生端：账号 ' + su.account + '    密码 ' + su.password);
    if (pu) lines.push('  家长端：账号 ' + pu.account + '    密码 ' + pu.password);
  });
  return lines.join('\n');
}
function buildAccSheetHTML(d) {
  var html = '';
  var teachers = (d.users || []).filter(function (u) { return u.role === 'teacher'; });
  if (teachers.length) {
    html += '<div class="sheet-sec"><b>教师</b>' + teachers.map(function (u) {
      return '<div class="sheet-row">👩‍🏫 ' + UI.esc(u.name) + '：账号 <code>' + UI.esc(u.account) + '</code>　密码 <code>' + UI.esc(u.password) + '</code></div>';
    }).join('') + '</div>';
  }
  (d.students || []).forEach(function (s) {
    var su = (d.users || []).filter(function (u) { return u.role === 'student' && u.studentId === s.id; })[0];
    var pu = (d.users || []).filter(function (u) { return u.role === 'parent' && u.studentId === s.id; })[0];
    html += '<div class="sheet-sec"><b>【' + UI.esc(s.name) + '（' + UI.esc(s.no) + '）】</b>';
    if (su) html += '<div class="sheet-row">🎒 学生端：账号 <code>' + UI.esc(su.account) + '</code>　密码 <code>' + UI.esc(su.password) + '</code></div>';
    if (pu) html += '<div class="sheet-row">👨‍👩‍👧 家长端：账号 <code>' + UI.esc(pu.account) + '</code>　密码 <code>' + UI.esc(pu.password) + '</code></div>';
    html += '</div>';
  });
  return html;
}
function fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); UI.toast('已复制全部账号密码', 'ok'); }
  catch (e) { UI.toast('复制失败，请手动选择', 'err'); }
  document.body.removeChild(ta);
}
Views.records = {
  title: '作业记录',
  render: function (ctx) {
    var sid = ctx.user.studentId;
    var q = App.query();
    var subj = q.subject || '';
    var range = q.range || 'month';
    var today = Store.todayStr();
    var opt = { studentId: sid, subject: subj };
    if (range === 'week') opt.from = Store.weekStart(today);
    else if (range === 'month') opt.from = Store.shiftDate(today, -29);
    var list = Store.queryRecords(opt);

    // 按日期分组
    var groups = {}, order = [];
    list.forEach(function (r) {
      if (!groups[r.date]) { groups[r.date] = []; order.push(r.date); }
      groups[r.date].push(r);
    });

    var head = '<div class="filters">' +
      [['week', '本周'], ['month', '近30天'], ['all', '全部']].map(function (r) {
        return '<button class="chip' + (range === r[0] ? ' active' : '') + '" data-f="range" data-v="' + r[0] + '">' + r[1] + '</button>';
      }).join('') +
      '<span style="width:1px;height:20px;background:var(--border)"></span>' +
      '<button class="chip' + (subj === '' ? ' active' : '') + '" data-f="subject" data-v="">全部科目</button>' +
      Store.SUBJECTS.map(function (s) {
        return '<button class="chip' + (subj === s.key ? ' active' : '') + '" data-f="subject" data-v="' + s.key + '">' + s.icon + ' ' + s.name + '</button>';
      }).join('') +
      '</div>';

    if (!order.length) return head + '<div class="card">' + UI.empty('暂无作业记录', '换个时间段看看', '📒') + '</div>';

    var body = order.map(function (d) {
      var rs = groups[d];
      var pieces = rs.reduce(function (a, r) { return a + r.count; }, 0);
      return '<div class="card" style="margin-bottom:12px">' +
        '<div class="card-head"><h3>' + d + ' 周' + Store.weekdayCN(d) + '</h3><div class="spacer"></div>' +
          '<span class="badge">' + rs.length + ' 科 · ' + pieces + ' 张</span></div>' +
        rs.map(function (r) {
          return '<div class="list-item">' + UI.subjectBadge(r.subject) +
            '<div class="li-main"><b>' + r.count + ' 张　完成度 ' + r.progress + '%</b>' +
            '<span>' + (r.teacherComment ? UI.esc(r.teacherComment) : (r.grade ? '老师已评定' : '等待老师批改')) + '</span></div>' +
            ((r.images || []).length ? '<div class="thumb" style="width:46px;height:46px" data-imgs="' + r.id + '"><img data-img-id="' + r.images[0] + '" alt=""></div>' : '') +
            UI.gradeBadge(r.grade) +
            '<button class="icon-btn" data-del-rec="' + r.id + '" title="删除此作业记录" style="margin-left:4px">🗑</button>' +
          '</div>';
        }).join('') +
      '</div>';
    }).join('');

    return head + body;
  },
  mount: function () {
    UI.hydrateImages();
    UI.els('[data-f]').forEach(function (b) { b.onclick = function () { App.setQuery(b.dataset.f, b.dataset.v); }; });
    UI.els('[data-imgs]').forEach(function (b) {
      b.onclick = function () {
        var r = Store.data().records.filter(function (x) { return x.id === b.dataset.imgs; })[0];
        if (!r) return;
        var st = Store.getStudent(r.studentId) || {};
        UI.openLightbox((r.images || []).map(function (id) {
          return { id: id, title: st.name + ' · ' + Store.subject(r.subject).name, sub: r.date + '　完成度 ' + r.progress + '%' };
        }), 0);
      };
    });
    UI.els('[data-del-rec]').forEach(function (b) {
      b.onclick = function () {
        UI.confirm('删除作业记录', '将删除该科目当天的作业记录与照片，确定吗？', function () {
          Store.deleteRecord(b.dataset.delRec);
          UI.toast('已删除', 'ok');
          App.render();
        }, true);
      };
    });
  }
};

/* -------------------------------------------------- 个人中心 */
Views.me = {
  title: '个人中心',
  render: function (ctx) {
    var u = ctx.user;
    var st = u.studentId ? Store.getStudent(u.studentId) : null;
    var d = Store.data();
    var isTeacher = u.role === 'teacher';
    var isStudent = u.role === 'student';

    return '' +
      '<div class="card" style="margin-bottom:14px"><div class="card-pad row wrap" style="gap:14px">' +
        '<div style="position:relative;cursor:pointer" id="meAvatar" title="点击更换头像">' +
          UI.avatar(u.name, st ? st.color : '#5A4FCF', 'lg', u.avatar) +
          '<span class="avatar-edit" style="position:absolute;right:-2px;bottom:-2px;background:#fff;border:1px solid var(--border);border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 1px 3px rgba(0,0,0,.15)">✎</span>' +
        '</div>' +
        '<div><div style="font-size:18px;font-weight:700">' + UI.esc(u.name) + '</div>' +
          '<div class="small muted">' + Store.ROLE_TEXT[u.role] + (u.title ? ' · ' + UI.esc(u.title) : '') +
          '　账号 ' + UI.esc(u.account) + (st ? '　' + Store.className(st.classId) : '') + '</div>' +
          '<button class="btn ghost sm" id="changeAvatar" style="margin-top:8px">更换头像</button></div>' +
        '<div class="spacer"></div>' +
        '<button class="btn ghost" id="logoutBtn">退出登录</button>' +
      '</div></div>' +

      '<div class="grid g-2">' +
        '<div class="card"><div class="card-head"><h3>账号安全</h3></div><div class="card-pad">' +
          '<div class="field"><label>原密码</label><input class="input" id="op" type="password" placeholder="请输入当前密码"></div>' +
          '<div class="field"><label>新密码</label><input class="input" id="np" type="password" placeholder="至少 4 位"></div>' +
          '<button class="btn" id="chgPwd">修改密码</button>' +
        '</div></div>' +

        '<div class="card"><div class="card-head"><h3>数据管理</h3></div><div class="card-pad">' +
          '<p class="small muted" style="margin-bottom:12px">数据保存在本设备浏览器中。建议教师定期备份，换设备时导入即可恢复。</p>' +
          '<div class="row wrap" style="gap:9px">' +
            '<button class="btn ghost sm" id="expJson">备份数据(JSON)</button>' +
            (isTeacher ? '<button class="btn ghost sm" id="impJson">导入备份</button>' : '') +
            (isTeacher ? '<button class="btn ghost sm" id="expAllCsv">导出全部记录(CSV)</button>' : '') +
            (isTeacher ? '<button class="btn ghost sm" id="clearDemoHw" style="color:var(--danger);border-color:#FECACA">清除演示作业</button>' : '') +
            (isTeacher ? '<button class="btn ghost sm" id="clearAtt" style="color:var(--danger);border-color:#FECACA">清除迟到/请假记录</button>' : '') +
            (isTeacher ? '<button class="btn ghost sm" id="clearGrades" style="color:var(--danger);border-color:#FECACA">清除成绩数据</button>' : '') +
            (isTeacher ? '<button class="btn ghost sm" id="resetDemo" style="color:var(--danger);border-color:#FECACA">重置演示数据</button>' : '') +
          '</div>' +
          '<input type="file" id="impFile" accept="application/json" class="hidden">' +
          '<div class="small muted" style="margin-top:14px">当前共 ' + d.students.length + ' 名学生 · ' +
            d.records.length + ' 条作业记录 · ' + d.classes.length + ' 个班级</div>' +
        '</div></div>' +
      '</div>' +

      (isStudent ? '<div class="card section-gap"><div class="card-head"><h3>📚 我的科目</h3><div class="spacer"></div>' +
        '<button class="btn sm" id="saveSubs">保存科目</button></div><div class="card-pad">' +
        '<div class="small muted" style="margin-bottom:10px">勾选你实际学习的专业科目，交作业页将只显示这些科目；老师布置的作业若包含你未选的科目，仍会照常提醒。</div>' +
        '<div class="chk-row" id="subChk">' +
        Store.SUBJECTS.map(function (s) {
          var on = Store.studentSubjects(st.id).indexOf(s.key) >= 0;
          return '<label class="chk"><input type="checkbox" class="mySubj" value="' + s.key + '"' + (on ? ' checked' : '') + '> ' + s.icon + ' ' + s.name + '</label>';
        }).join('') +
        '</div></div></div>' : '') +

      (isStudent ? '<div class="card section-gap"><div class="card-head"><h3>📖 我的文化课科目</h3><div class="spacer"></div>' +
        '<button class="btn sm" id="saveCult">保存文化课</button></div><div class="card-pad">' +
        '<div class="small muted" style="margin-bottom:10px">勾选你实际修读的文化课科目，成绩页「我的文化课成绩」将只显示这些科目。</div>' +
        '<div class="chk-row" id="cultChk">' +
        Store.CULTURE_SUBJECTS.map(function (s) {
          var on = Store.studentCultureSubjects(st.id).indexOf(s) >= 0;
          return '<label class="chk"><input type="checkbox" class="myCult" value="' + s + '"' + (on ? ' checked' : '') + '> ' + s + '</label>';
        }).join('') +
        '</div></div></div>' : '') +

      (isTeacher ? '<div class="card section-gap"><div class="card-head"><h3>☁️ 云端同步</h3><div class="spacer"></div>' +
        '<span class="hint" id="cloudStatus"></span></div><div class="card-pad">' +
        '<p class="small muted" style="margin-bottom:12px">开启后，账号 / 学生 / 作业数据保存在云端，<b>任意手机电脑登录同一链接即可共享同一份数据</b>，作业图片也会上传到云端 Storage，<b>跨设备一致</b>。首次启用会以上传当前数据为共享基线。</p>' +
        '<div class="field"><label>Supabase Project URL</label><input class="input" id="sbUrl" placeholder="https://xxxx.supabase.co"></div>' +
        '<div class="field"><label>anon public key</label><input class="input" id="sbKey" type="password" placeholder="Project Settings → API → anon public key"></div>' +
        '<div class="row wrap" style="gap:9px;margin-top:6px">' +
          '<button class="btn sm" id="cloudSave">保存并启用</button>' +
          '<button class="btn ghost sm" id="cloudTest">测试连接</button>' +
          '<button class="btn ghost sm" id="cloudPull">立即同步</button>' +
          '<button class="btn ghost sm" id="cloudTestImg">上传测试图</button>' +
          (window.Cloud && Cloud.ready() ? '<button class="btn ghost sm" id="cloudOff" style="color:var(--danger);border-color:#FECACA">关闭同步</button>' : '') +
        '</div>' +
        '<div class="small muted" style="margin-top:10px">建表 SQL：在 Supabase → SQL Editor 执行 <code>' + SB_SQL + '</code></div>' +
        '<div class="small muted" style="margin-top:6px">图片存储：新建名为 <code>artwork</code> 的 <b>公开(public)</b> 存储桶，并在 Storage 策略中允许 anon 的 insert / select / delete。SQL：<code>' + SB_STORAGE_SQL + '</code></div>' +
        '</div></div>' : '') +

      (isTeacher ? '<div class="card section-gap"><div class="card-head"><h3>全部账号一览</h3><div class="spacer"></div>' +
        '<span class="hint">可发给学生和家长</span></div><div class="table-wrap"><table class="tbl">' +
        '<thead><tr><th>姓名</th><th>身份</th><th>登录账号</th><th>密码</th><th>关联学生</th></tr></thead><tbody>' +
        d.users.map(function (x) {
          var s2 = x.studentId ? Store.getStudent(x.studentId) : null;
          return '<tr><td>' + UI.esc(x.name) + '</td>' +
            '<td><span class="badge ' + (x.role === 'teacher' ? 'info' : x.role === 'student' ? 'ok' : '') + '">' + Store.ROLE_TEXT[x.role] + '</span></td>' +
            '<td><code>' + UI.esc(x.account) + '</code></td>' +
            '<td class="small"><code>' + UI.esc(x.password) + '</code></td>' +
            '<td class="small">' + (s2 ? UI.esc(s2.name) + '（' + UI.esc(Store.className(s2.classId)) + '）' : '—') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>' : '') +

      (isTeacher ? '<div class="card section-gap"><div class="card-head"><h3>📋 账号密码清单（发给家长）</h3><div class="spacer"></div>' +
        '<span class="hint">含真实密码，注意保密</span></div><div class="card-pad">' +
        '<p class="small muted" style="margin-bottom:12px">下面列出每位学生的「学生端」与「家长端」登录账号和密码，可一键复制后发到家长群，或打印出来分发。账号格式：学生端=学号小写（如 a01），家长端=p+学号（如 pa01）。</p>' +
        '<style>.acc-sheet .sheet-sec{margin-bottom:12px}.acc-sheet .sheet-sec>b{display:block;margin-bottom:4px;color:#5A4FCF;font-weight:700}.acc-sheet .sheet-row{font-size:14px;line-height:1.9}.acc-sheet code{background:#f0eefb;padding:1px 6px;border-radius:4px;font-family:monospace}</style>' +
        '<div class="row wrap" style="gap:9px;margin-bottom:12px">' +
          '<button class="btn sm" id="copySheet">📋 复制全部</button>' +
          '<button class="btn ghost sm" id="printSheet">🖨️ 打印</button>' +
        '</div>' +
        '<div id="accSheet" class="acc-sheet">' + buildAccSheetHTML(d) + '</div>' +
      '</div></div>' : '') +

      '<div class="card section-gap"><div class="card-head"><h3>使用说明</h3></div><div class="card-pad small" style="color:var(--text-2);line-height:1.9">' +
        '<p><b>教师</b>：在「作业批改」中查看每天提交的色彩 / 素描 / 速写作业，点选 A/B/C/D 评级并写评语，也可删除整条记录；在「作品集」或「学生管理」中可<b>代替学生交作业</b>，并在作品集里<b>逐张删除</b>错传或多余的作品图；在「学生管理」中添加学生（会自动生成学生和家长账号）；在「数据统计」中查看班级与个人完成情况，可导出 CSV。</p>' +
        '<p><b>学生</b>：在「交作业」中选择日期与科目，填写完成数量、完成程度，并上传作业照片（手机可直接拍照），提交后进入个人作品集等待评级。</p>' +
        '<p><b>家长</b>：登录后可查看孩子每天的完成情况、评级、老师评语和作品集，只读不可修改。</p>' +
        '<p class="muted">评级说明：A 优秀 · B 良好 · C 合格 · D 待加强</p>' +
      '</div></div>';
  },
  mount: function (ctx) {
    UI.el('#logoutBtn').onclick = function () {
      UI.confirm('退出登录', '确定要退出当前账号吗？', function () {
        Store.logout(); location.hash = '#/login'; App.render();
      });
    };
    function changeAvatar() {
      UI.pickAvatar(function (url) {
        if (!url) { UI.toast('读取图片失败', 'err'); return; }
        Store.setUserAvatar(ctx.user.id, url);
        UI.toast('头像已更新', 'ok');
        App.render();
      });
    }
    var av = UI.el('#meAvatar'); if (av) av.onclick = changeAvatar;
    var ca = UI.el('#changeAvatar'); if (ca) ca.onclick = changeAvatar;

    var copyBtn = UI.el('#copySheet');
    if (copyBtn) copyBtn.onclick = function () {
      var text = buildAccSheetText(Store.data());
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { UI.toast('已复制全部账号密码', 'ok'); }, function () { fallbackCopy(text); });
      } else { fallbackCopy(text); }
    };
    var printBtn = UI.el('#printSheet');
    if (printBtn) printBtn.onclick = function () {
      var html = '<!doctype html><html><head><meta charset="utf-8"><title>账号密码清单</title>' +
        '<style>body{font-family:-apple-system,Segoe UI,sans-serif;padding:24px;color:#222}' +
        'h2{margin:0 0 4px}.sub{color:#888;margin:0 0 18px;font-size:13px}' +
        '.sheet-sec{margin-bottom:14px}.sheet-sec>b{display:block;margin-bottom:4px;color:#5A4FCF;font-weight:700}' +
        '.sheet-row{font-size:14px;line-height:1.9}code{background:#f0eefb;padding:1px 6px;border-radius:4px;font-family:monospace}' +
        '@media print{body{padding:0}}</style></head><body>' +
        '<h2>清大美术班学生考学数据系统 · 账号密码清单</h2>' +
        '<p class="sub">网址：' + location.origin + location.pathname + '</p>' +
        buildAccSheetHTML(Store.data()) + '</body></html>';
      var w = window.open('', '_blank');
      if (!w) { UI.toast('打印窗口被拦截，请允许弹窗或用「复制全部」', 'err'); return; }
      w.document.open(); w.document.write(html); w.document.close();
      setTimeout(function () { w.focus(); w.print(); }, 300);
    };
    var saveSubs = UI.el('#saveSubs');
    if (saveSubs) saveSubs.onclick = function () {
      var keys = [];
      UI.els('.mySubj').forEach(function (c) { if (c.checked) keys.push(c.value); });
      if (!keys.length) { UI.toast('请至少选择一门科目', 'err'); return; }
      Store.setStudentSubjects(ctx.user.studentId, keys);
      UI.toast('科目已更新', 'ok');
      App.render();
    };
    var saveCult = UI.el('#saveCult');
    if (saveCult) saveCult.onclick = function () {
      var keys = [];
      UI.els('.myCult').forEach(function (c) { if (c.checked) keys.push(c.value); });
      if (!keys.length) { UI.toast('请至少选择一门文化课', 'err'); return; }
      Store.setStudentCultureSubjects(ctx.user.studentId, keys);
      UI.toast('文化课科目已更新', 'ok');
      App.render();
    };
    UI.el('#chgPwd').onclick = function () {
      var op = UI.el('#op').value, np = UI.el('#np').value;
      if (!op || !np) { UI.toast('请填写完整', 'err'); return; }
      if (np.length < 4) { UI.toast('新密码至少 4 位', 'err'); return; }
      var r = Store.changePassword(ctx.user.id, op, np);
      if (!r.ok) { UI.toast(r.msg, 'err'); return; }
      UI.toast('密码修改成功', 'ok');
      UI.el('#op').value = ''; UI.el('#np').value = '';
    };
    UI.el('#expJson').onclick = function () {
      UI.download('美术班作业数据备份_' + Store.todayStr() + '.json', Store.exportJSON(), 'application/json');
      UI.toast('备份已下载', 'ok');
    };
    var imp = UI.el('#impJson');
    if (imp) {
      imp.onclick = function () { UI.el('#impFile').click(); };
      UI.el('#impFile').onchange = function (e) {
        var f = e.target.files[0]; if (!f) return;
        var fr = new FileReader();
        fr.onload = function () {
          var r = Store.importJSON(fr.result);
          if (!r.ok) { UI.toast(r.msg, 'err'); return; }
          UI.toast('数据已导入', 'ok'); App.render();
        };
        fr.readAsText(f);
      };
    }
    var expCsv = UI.el('#expAllCsv');
    if (expCsv) expCsv.onclick = function () {
      UI.download('美术班全部作业记录_' + Store.todayStr() + '.csv', Store.exportCSV(Store.queryRecords({})), 'text/csv');
      UI.toast('已导出', 'ok');
    };
    var cdh = UI.el('#clearDemoHw');
    if (cdh) cdh.onclick = function () {
      UI.confirm('清除演示作业', '将删除所有演示作业记录（不影响你真实录入的作业），确定吗？', function () {
        var n = Store.clearDemoHomework();
        UI.toast(n > 0 ? ('已清除 ' + n + ' 条演示作业') : '没有需要清除的演示作业', 'ok');
        App.render();
      }, true);
    };
    var rd = UI.el('#resetDemo');
    if (rd) rd.onclick = function () {
      UI.confirm('重置演示数据', '将清空当前所有数据并恢复到初始演示状态，此操作不可撤销。', function () {
        Store.resetDemo(); UI.toast('已重置', 'ok'); App.render();
      }, true);
    };
    var ca = UI.el('#clearAtt');
    if (ca) ca.onclick = function () {
      UI.confirm('清除迟到/请假记录', '将删除全部「迟到」与「请假」考勤记录（保留正常到班记录），并同步到云端，其他设备一并清空。此操作不可撤销。', function () {
        var n = Store.deleteAttendanceByStatus(['late', 'leave']);
        UI.toast(n > 0 ? ('已清除 ' + n + ' 条迟到/请假记录') : '没有迟到/请假记录', 'ok');
        App.render();
      }, true);
    };
    var cg = UI.el('#clearGrades');
    if (cg) cg.onclick = function () {
      UI.confirm('清除成绩数据', '将删除全部「文化课成绩」与「专业课成绩」（含演示数据），成绩走势图将变为空，并同步到云端，其他设备一并清空。此操作不可撤销。', function () {
        var n1 = Store.clearCultureScores();
        var n2 = Store.clearProfGrades();
        UI.toast('已清除 ' + (n1 + n2) + ' 条成绩记录（文化课 ' + n1 + ' · 专业课 ' + n2 + '）', 'ok');
        App.render();
      }, true);
    };
    /* ---- ☁️ 云端同步 ---- */
    var sbUrl = UI.el('#sbUrl');
    if (sbUrl) {
      var savedKey = '';
      try { savedKey = localStorage.getItem('ahm_sb_key') || ''; } catch (e) {}
      sbUrl.value = (window.Cloud && Cloud.url && Cloud.url()) || '';
      var sbKey = UI.el('#sbKey');
      if (savedKey) sbKey.placeholder = '已保存：' + savedKey.slice(0, 6) + '••••（留空则保持）';
      var stEl = UI.el('#cloudStatus');
      if (stEl) {
        var on = !!(window.Cloud && Cloud.ready());
        var txt = on ? '● 已连接云端' : '○ 未连接';
        var ls = (window.Cloud && Cloud.lastSync && Cloud.lastSync());
        if (ls) txt += '　·　上次同步 ' + UI.fmtTime(ls);
        stEl.textContent = txt;
        stEl.style.color = on ? 'var(--ok)' : 'var(--muted)';
      }
      UI.el('#cloudSave').onclick = function () {
        var u = sbUrl.value.trim();
        var k = sbKey.value.trim();
        if (!k) { try { k = localStorage.getItem('ahm_sb_key') || ''; } catch (e) {} }
        if (!u || !k) { UI.toast('请填写 URL 与 anon key', 'err'); return; }
        Cloud.persist(u, k);
        UI.toast('已保存，正在连接云端…', 'ok');
        Store.syncFromCloud().then(function (r) {
          if (r && r.ok) {
            UI.toast(r.action === 'push' ? '已启用，并用本机数据恢复云端' : '已启用，已拉取共享数据', 'ok');
          } else if (Store.hasRealData && Store.hasRealData()) {
            Store.pushNow();
            UI.toast('已启用，并用本机数据恢复云端', 'ok');
          } else {
            UI.toast('已启用（云端暂无数据，本机也无同步数据）', 'err');
          }
          App.render();
        });
      };
      UI.el('#cloudTest').onclick = function () {
        var u = sbUrl.value.trim();
        var k = sbKey.value.trim();
        if (!k) { try { k = localStorage.getItem('ahm_sb_key') || ''; } catch (e) {} }
        if (!u || !k) { UI.toast('请填写 URL 与 anon key', 'err'); return; }
        Cloud.test(u, k).then(function (r) { UI.toast(r.msg, r.ok ? 'ok' : 'err'); });
      };
      var pull = UI.el('#cloudPull');
      if (pull) pull.onclick = function () {
        if (!Cloud.ready()) { UI.toast('请先保存并启用', 'err'); return; }
        Store.syncFromCloud().then(function (r) {
          if (r && r.ok) {
            if (r.action === 'push') UI.toast('云端为空，已用本机数据恢复云端', 'ok');
            else UI.toast('已同步云端最新数据', 'ok');
          } else if (Store.hasRealData && Store.hasRealData()) {
            Store.pushNow();
            UI.toast('云端为空，已用本机数据恢复云端', 'ok');
          } else {
            UI.toast('云端暂无数据', 'err');
          }
          App.render();
        });
      };
      var off = UI.el('#cloudOff');
      if (off) off.onclick = function () {
        UI.confirm('关闭云端同步', '关闭后数据将只保存在本设备，不再与云端同步。', function () {
          try { localStorage.setItem('ahm_sb_key', ''); } catch (e) {}
          Cloud.setConfig(Cloud.url(), '');
          UI.toast('已关闭云端同步', 'ok'); App.render();
        });
      };
      /* ---- 上传测试图：验证图片跨设备一致 ---- */
      var testImg = UI.el('#cloudTestImg');
      if (testImg) testImg.onclick = function () {
        if (!Cloud.ready()) { UI.toast('请先保存并启用云端同步', 'err'); return; }
        var btn = testImg, old = btn.textContent;
        btn.disabled = true; btn.textContent = '上传中…';
        var canvas = document.createElement('canvas');
        canvas.width = 240; canvas.height = 140;
        var cx = canvas.getContext('2d');
        cx.fillStyle = '#5A4FCF'; cx.fillRect(0, 0, 240, 140);
        cx.fillStyle = '#fff'; cx.font = 'bold 22px sans-serif';
        cx.fillText('AHM 云端测试', 22, 62);
        cx.font = '13px sans-serif'; cx.fillStyle = '#ECE9FF';
        cx.fillText(new Date().toLocaleString('zh-CN'), 22, 100);
        var done = function (url, ok, msg) {
          btn.disabled = false; btn.textContent = old;
          if (ok) {
            UI.toast('测试图已上传，云端可访问（跨设备一致）', 'ok');
            UI.openLightbox([{ id: url, title: '云端测试图', sub: '跨设备一致验证 · ' + new Date().toLocaleString('zh-CN') }], 0);
          } else {
            UI.toast(msg || '上传失败', 'err');
          }
        };
        var afterUpload = function (url) {
          // 校验公开可访问（HEAD）。跨域可能阻止 HEAD，失败不判死，上传成功即视为通过
          fetch(url, { method: 'HEAD' }).then(function (r) {
            done(url, r.ok, r.ok ? '' : '已上传但公开访问校验未通过（请检查 Storage 策略）');
          }).catch(function () { done(url, true, ''); });
        };
        if (canvas.toBlob) {
          canvas.toBlob(function (blob) {
            var path = 'test/ahm_test_' + Date.now() + '.png';
            Cloud.uploadImage(blob, path).then(afterUpload)
              .catch(function (e) { done(null, false, '上传失败：' + (e && e.message ? e.message : e)); });
          }, 'image/png');
        } else {
          done(null, false, '当前浏览器不支持 canvas.toBlob');
        }
      };
    }
  }
};

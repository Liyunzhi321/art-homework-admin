/* ============================================================
   布置作业（教师发布任务）
   ============================================================ */
Views.tasks = {
  title: '布置作业',
  render: function () {
    var list = (Store.data().assignments || []).slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (b.updatedAt || b.createdAt) < (a.updatedAt || a.createdAt) ? -1 : 1;
    });
    var today = Store.todayStr();

    var head = '' +
      '<div class="row wrap" style="margin-bottom:14px">' +
        '<div><h2 style="font-size:20px">布置作业</h2>' +
        '<div class="small muted">发布每日 / 每周作业任务（按「张」为单位布置），学生与家长可在首页看到</div></div>' +
      '<div class="spacer"></div>' +
      '<button class="btn soft" id="addTask">＋ 布置作业</button>' +
      '</div>';

    if (!list.length) {
      return head + '<div class="card">' + UI.empty('还没有布置过作业', '点击右上角「＋ 布置作业」发布今天的任务吧', '📋') + '</div>';
    }

    var cards = list.map(function (a) {
      var subs = (a.subjects || []).map(function (k) {
        var s = Store.subject(k);
        var c = (a.counts && a.counts[k] != null) ? a.counts[k] : null;
        return '<span class="sub-chip2">' + UI.subjectBadge(k) + (c ? ' <b>' + c + ' 张</b>' : '') + '</span>';
      }).join(' ');
      var isToday = a.date === today;
      var sh = Store.shift(a.shift);
      return '<div class="card task-card" style="margin-bottom:12px">' +
        '<div class="card-pad">' +
          '<div class="row wrap" style="gap:8px;margin-bottom:8px">' +
            '<span class="badge ' + (isToday ? 'ok' : '') + '">' + a.date + ' 周' + Store.weekdayCN(a.date) + (isToday ? ' · 今天' : '') + '</span>' +
            '<span class="badge shift-' + a.shift + '">' + sh.icon + ' ' + sh.short + '</span>' +
            subs +
            '<div class="spacer"></div>' +
            '<button class="icon-btn" data-edit-task="' + a.id + '" title="编辑">✎</button>' +
            '<button class="icon-btn" data-del-task="' + a.id + '" title="删除">🗑</button>' +
          '</div>' +
          '<div style="font-size:16px;font-weight:700;margin-bottom:4px">' + UI.esc(a.title) + '</div>' +
          (a.content ? '<div class="small" style="margin-bottom:4px">📝 ' + UI.esc(a.content) + '</div>' : '') +
          (a.requirement ? '<div class="small muted">📌 要求：' + UI.esc(a.requirement) + '</div>' : '') +
          '<div class="small muted" style="margin-top:6px">布置人：' + UI.esc(a.byName || '教师') + '</div>' +
        '</div></div>';
    }).join('');

    return head + cards;
  },
  mount: function () {
    var addBtn = UI.el('#addTask');
    if (addBtn) addBtn.onclick = function () { assignmentModal(null); };
    UI.els('[data-edit-task]').forEach(function (b) {
      b.onclick = function () { assignmentModal(b.dataset.editTask); };
    });
    UI.els('[data-del-task]').forEach(function (b) {
      b.onclick = function () {
        UI.confirm('删除布置', '将删除该条作业布置（不影响学生已提交的作业），确定吗？', function () {
          Store.removeAssignment(b.dataset.delTask);
          UI.toast('已删除', 'ok');
          App.render();
        }, true);
      };
    });
  }
};

/* 自动生成标题：如「色彩 20 张 · 素描 10 张」 */
function assignmentAutoTitle(subjects, counts) {
  return subjects.map(function (k) {
    var s = Store.subject(k);
    var c = (counts && counts[k] != null) ? counts[k] : 1;
    return s.name + ' ' + c + ' 张';
  }).join(' · ');
}

/* 布置 / 编辑作业弹窗 */
function assignmentModal(editId) {
  var a = editId ? Store.getAssignment(editId) : null;
  var today = Store.todayStr();
  var date = a ? a.date : today;
  var shiftPick = a ? (a.shift || 'day') : 'day';
  var picked = {};
  (a ? (a.subjects || []) : ['color', 'sketch', 'quick']).forEach(function (k) { picked[k] = true; });
  var counts = (a && a.counts) ? JSON.parse(JSON.stringify(a.counts)) : {};

  var subjPills = Store.SUBJECTS.map(function (s) {
    return '<div class="sp-item' + (picked[s.key] ? ' on' : '') + '" data-sub="' + s.key + '">' +
      '<div class="sp-ico">' + s.icon + '</div><b>' + s.name + '</b></div>';
  }).join('');

  var body = '' +
    '<div class="field"><label>作业日期（要求完成的日期）</label>' +
      '<input class="input" type="date" id="tkDate" value="' + date + '"></div>' +
    '<div class="field"><label>时段</label>' +
      '<div class="seg" id="tkShift">' +
        Store.SHIFTS.map(function (s) {
          return '<div class="seg-item' + (s.key === shiftPick ? ' on' : '') + '" data-shift="' + s.key + '">' + s.icon + ' ' + s.name + '</div>';
        }).join('') +
      '</div></div>' +
    '<div class="field"><label>适用科目（可多选）</label>' +
      '<div class="subject-pick" id="tkSubj">' + subjPills + '</div></div>' +
    '<div class="field"><label>各科目布置张数（美术作业按「张」计算）</label>' +
      '<div id="tkCounts" class="tk-counts"></div></div>' +
    '<div class="field"><label>作业标题（留空则自动按张数生成，如「色彩 20 张 · 素描 10 张」）</label>' +
      '<input class="input" id="tkTitle" placeholder="例如：色彩静物写生" value="' + UI.esc(a ? a.title : '') + '"></div>' +
    '<div class="field"><label>作业内容</label>' +
      '<textarea class="textarea" id="tkContent" placeholder="例如：完成色彩静物 20 张、素描几何体 10 张">' + UI.esc(a ? a.content : '') + '</textarea></div>' +
    '<div class="field"><label>要求 / 备注（可选）</label>' +
      '<textarea class="textarea" id="tkReq" placeholder="例如：构图完整，冷暖对比明确，注意明暗交界线">' + UI.esc(a ? a.requirement : '') + '</textarea></div>';

  UI.modal({
    title: a ? '编辑作业布置' : '布置作业',
    okText: a ? '保存' : '发布',
    body: body,
    onMount: function (m) {
      UI.els('#tkShift .seg-item', m).forEach(function (d) {
        d.onclick = function () {
          UI.els('#tkShift .seg-item', m).forEach(function (x) { x.classList.remove('on'); });
          d.classList.add('on');
          shiftPick = d.dataset.shift;
        };
      });
      UI.els('#tkSubj .sp-item', m).forEach(function (d) {
        d.onclick = function () {
          d.classList.toggle('on');
          picked[d.dataset.sub] = d.classList.contains('on');
          renderCounts();
        };
      });
      function renderCounts() {
        var box = UI.el('#tkCounts', m);
        if (!box) return;
        var rows = Store.SUBJECTS.filter(function (s) { return picked[s.key]; }).map(function (s) {
          var v = counts[s.key];
          if (v === undefined || v === null || v === '') v = 1;
          return '<div class="tk-cnt-row" style="display:flex;align-items:center;gap:10px;margin-bottom:8px">' +
            '<span style="min-width:70px">' + s.icon + ' ' + s.name + '</span>' +
            '<div class="stepper"><button type="button" class="tk-cnt-minus">−</button>' +
            '<input type="number" min="1" max="999" step="1" class="tk-cnt-val" data-sub="' + s.key + '" value="' + v + '">' +
            '<button type="button" class="tk-cnt-plus">＋</button></div><span class="small muted">张</span></div>';
        }).join('');
        box.innerHTML = rows || '<div class="small muted">请先在上方选择科目</div>';
        UI.els('.tk-cnt-minus', box).forEach(function (b) {
          b.onclick = function () {
            var inp = b.parentNode.querySelector('.tk-cnt-val');
            inp.value = Math.max(1, (+inp.value || 1) - 1);
            counts[inp.dataset.sub] = +inp.value;
          };
        });
        UI.els('.tk-cnt-plus', box).forEach(function (b) {
          b.onclick = function () {
            var inp = b.parentNode.querySelector('.tk-cnt-val');
            inp.value = Math.min(999, (+inp.value || 1) + 1);
            counts[inp.dataset.sub] = +inp.value;
          };
        });
        UI.els('.tk-cnt-val', box).forEach(function (inp) {
          inp.oninput = function () { counts[inp.dataset.sub] = (+inp.value || 1); };
        });
      }
      renderCounts();
    },
    onOk: function (m) {
      var subs = Store.SUBJECTS.filter(function (s) { return picked[s.key]; }).map(function (s) { return s.key; });
      if (!subs.length) { UI.toast('请至少选择一个科目', 'err'); return false; }
      // 收集各科目张数
      var cnt = {};
      subs.forEach(function (k) {
        var v = counts[k];
        cnt[k] = (v && !isNaN(+v) && +v >= 1) ? +v : 1;
      });
      var titleRaw = UI.el('#tkTitle', m).value.trim();
      var title = titleRaw || assignmentAutoTitle(subs, cnt);
      var payload = {
        date: UI.el('#tkDate', m).value || today,
        shift: shiftPick,
        subjects: subs,
        title: title,
        content: UI.el('#tkContent', m).value.trim(),
        requirement: UI.el('#tkReq', m).value.trim(),
        counts: cnt,
        byName: ((Store.currentUser() || {}).name) || '教师'
      };
      if (a) { Store.updateAssignment(a.id, payload); UI.toast('已更新布置', 'ok'); }
      else { Store.addAssignment(payload); UI.toast('作业已发布', 'ok'); }
      App.render();
    }
  });
}

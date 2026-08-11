/* ============================================================
   UI - 通用组件与工具
   ============================================================ */
var UI = (function () {

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function el(sel, root) { return (root || document).querySelector(sel); }
  function els(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- Toast ---------- */
  function toast(msg, type) {
    var root = document.getElementById('toast-root');
    var d = document.createElement('div');
    d.className = 'toast ' + (type || '');
    d.innerHTML = (type === 'ok' ? '✓ ' : type === 'err' ? '✕ ' : '') + esc(msg);
    root.appendChild(d);
    setTimeout(function () {
      d.style.transition = 'opacity .25s, transform .25s';
      d.style.opacity = '0'; d.style.transform = 'translateY(-8px)';
      setTimeout(function () { d.remove(); }, 260);
    }, 2200);
  }

  /* ---------- Modal ---------- */
  function modal(opts) {
    var root = document.getElementById('modal-root');
    var mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML =
      '<div class="modal">' +
        '<div class="modal-head"><h3>' + esc(opts.title || '') + '</h3>' +
          '<button class="icon-btn" data-close>✕</button></div>' +
        '<div class="modal-body">' + (opts.body || '') + '</div>' +
        '<div class="modal-foot">' +
          (opts.cancelText === null ? '' : '<button class="btn ghost" data-close>' + esc(opts.cancelText || '取消') + '</button>') +
          '<button class="btn ' + (opts.danger ? 'danger' : '') + '" data-ok>' + esc(opts.okText || '确定') + '</button>' +
        '</div>' +
      '</div>';
    root.appendChild(mask);
    function close() { mask.remove(); }
    els('[data-close]', mask).forEach(function (b) { b.onclick = close; });
    mask.onclick = function (e) { if (e.target === mask) close(); };
    el('[data-ok]', mask).onclick = function () {
      if (opts.onOk) { if (opts.onOk(mask) === false) return; }
      close();
    };
    if (opts.onMount) opts.onMount(mask);
    var f = el('input,select,textarea', mask);
    if (f && window.innerWidth > 900) setTimeout(function () { f.focus(); }, 60);
    return { close: close, root: mask };
  }

  function confirm(title, text, onOk, danger) {
    modal({
      title: title,
      body: '<p style="color:var(--text-2);line-height:1.65">' + esc(text) + '</p>',
      okText: danger ? '确认删除' : '确定',
      danger: !!danger,
      onOk: onOk
    });
  }

  /* ---------- 头像 ---------- */
  function avatar(name, color, size, img) {
    if (img) {
      return '<div class="avatar ' + (size || '') + '" style="background:#E9E7F5;overflow:hidden">' +
        '<img src="' + esc(img) + '" alt="' + esc(name || '') + '" style="width:100%;height:100%;object-fit:cover;display:block">' +
      '</div>';
    }
    var t = (name || '?').slice(-2);
    return '<div class="avatar ' + (size || '') + '" style="background:' + (color || '#5A4FCF') + '">' + esc(t) + '</div>';
  }
  // 选择并压缩为方形头像（dataURL，直接可作 <img src>，随 JSON 自动跨设备同步）
  function pickAvatar(cb) {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      avatarDataURL(f, cb);
    };
    inp.click();
  }
  function avatarDataURL(file, cb) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var s = 160, dim = Math.min(img.width, img.height);
        var sx = (img.width - dim) / 2, sy = (img.height - dim) / 2;
        var c = document.createElement('canvas'); c.width = s; c.height = s;
        c.getContext('2d').drawImage(img, sx, sy, dim, dim, 0, 0, s, s);
        cb(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = function () { cb(null); };
      img.src = reader.result;
    };
    reader.onerror = function () { cb(null); };
    reader.readAsDataURL(file);
  }

  /* ---------- 徽标 ---------- */
  function subjectBadge(key) {
    var s = Store.subject(key);
    return '<span class="badge ' + s.cls + '">' + s.icon + ' ' + s.name + '</span>';
  }
  function gradeBadge(g) {
    if (!g) return '<span class="grade none">–</span>';
    return '<span class="grade ' + g + '">' + g + '</span>';
  }

  /* ---------- 图片懒加载 ---------- */
  function hydrateImages(root) {
    els('img[data-img-id]', root || document).forEach(function (img) {
      if (img.dataset.loaded) return;
      var id = img.dataset.imgId;
      var full = img.dataset.full === '1';
      DB.getImage(id).then(function (rec) {
        if (!rec) { img.src = placeholder(); img.dataset.loaded = '1'; return; }
        img.src = full ? (rec.full || rec.thumb) : (rec.thumb || rec.full);
        img.dataset.loaded = '1';
      });
    });
  }
  function placeholder() {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#EFEFF6"/></svg>');
  }

  /* ---------- 灯箱 ---------- */
  var lbState = null;
  function openLightbox(items, index) {
    lbState = { items: items, i: index || 0 };
    var root = document.getElementById('lightbox-root');
    root.innerHTML =
      '<div class="lightbox">' +
        '<button class="lb-close">✕</button>' +
        (items.length > 1 ? '<button class="lb-prev">‹</button><button class="lb-next">›</button>' : '') +
        '<img id="lb-img" alt="作品">' +
        '<div class="lb-info"><div class="lb-title" id="lb-title"></div><div class="lb-sub" id="lb-sub"></div></div>' +
      '</div>';
    function render() {
      var it = lbState.items[lbState.i];
      var img = document.getElementById('lb-img');
      img.src = placeholder();
      DB.getImage(it.id).then(function (rec) { if (rec) img.src = rec.full || rec.thumb; });
      document.getElementById('lb-title').innerHTML = it.title || '';
      document.getElementById('lb-sub').innerHTML = (it.sub || '') + (items.length > 1 ? '　·　' + (lbState.i + 1) + '/' + items.length : '');
    }
    function close() { root.innerHTML = ''; document.removeEventListener('keydown', onKey); lbState = null; }
    function step(n) { lbState.i = (lbState.i + n + lbState.items.length) % lbState.items.length; render(); }
    function onKey(e) {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    }
    root.querySelector('.lb-close').onclick = close;
    root.querySelector('.lightbox').onclick = function (e) { if (e.target.classList.contains('lightbox')) close(); };
    if (items.length > 1) {
      root.querySelector('.lb-prev').onclick = function (e) { e.stopPropagation(); step(-1); };
      root.querySelector('.lb-next').onclick = function (e) { e.stopPropagation(); step(1); };
    }
    document.addEventListener('keydown', onKey);
    render();
  }

  /* ---------- 其他 ---------- */
  function statCard(o) {
    return '<div class="stat">' +
      '<div class="st-ico" style="background:' + o.bg + ';color:' + o.fg + '">' + o.icon + '</div>' +
      '<div class="st-val">' + o.value + (o.unit ? '<small> ' + o.unit + '</small>' : '') + '</div>' +
      '<div class="st-label">' + esc(o.label) + '</div>' +
      (o.trend ? '<div class="st-trend" style="color:' + (o.trendColor || 'var(--text-3)') + '">' + o.trend + '</div>' : '') +
      '</div>';
  }

  function empty(title, text, icon) {
    return '<div class="empty"><div class="e-ico">' + (icon || '📭') + '</div><b>' + esc(title) + '</b>' +
      '<div class="small">' + esc(text || '') + '</div></div>';
  }

  function download(filename, content, mime) {
    var blob = new Blob(['\ufeff' + content], { type: (mime || 'text/plain') + ';charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function progressBar(v, color) {
    return '<div class="pbar"><i style="width:' + Math.max(0, Math.min(100, v)) + '%;background:' + (color || 'var(--brand)') + '"></i></div>';
  }

  /* 完成率进度条（rate 为 0~1）：达标绿、六成以上品牌紫、否则告警橙 */
  function pctBar(rate, opt) {
    opt = opt || {};
    var pct = Math.round((rate || 0) * 100);
    var color = rate >= 1 ? 'var(--ok)' : rate >= 0.6 ? 'var(--brand)' : 'var(--warn)';
    var bar = '<div class="pbar" style="' + (opt.barStyle || '') + '"><i style="width:' + pct + '%;background:' + color + '"></i></div>';
    if (opt.noText) return bar;
    return '<div class="pct-wrap"><span class="pct-num" style="color:' + color + '">' + pct + '%</span>' + bar + '</div>';
  }

  function fmtTime(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    function p(n) { return n < 10 ? '0' + n : '' + n; }
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  return {
    esc: esc, el: el, els: els, toast: toast, modal: modal, confirm: confirm,
    avatar: avatar, pickAvatar: pickAvatar, avatarDataURL: avatarDataURL,
    subjectBadge: subjectBadge, gradeBadge: gradeBadge,
    hydrateImages: hydrateImages, openLightbox: openLightbox, placeholder: placeholder,
    statCard: statCard, empty: empty, download: download, progressBar: progressBar, pctBar: pctBar, fmtTime: fmtTime
  };
})();

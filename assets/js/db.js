/* ============================================================
   DB - 图片存储层
   优先 IndexedDB（可存大量图片），失败时降级为内存 + localStorage
   ============================================================ */
var DB = (function () {
  var DB_NAME = 'art_homework_db';
  var STORE = 'images';
  var VERSION = 1;
  var dbPromise = null;
  var mem = {};
  var idbAvailable = true;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      try {
        if (!window.indexedDB) { idbAvailable = false; return reject('no-idb'); }
        var req = indexedDB.open(DB_NAME, VERSION);
        req.onupgradeneeded = function (e) {
          var db = e.target.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { idbAvailable = false; reject(req.error); };
      } catch (err) { idbAvailable = false; reject(err); }
    });
    return dbPromise;
  }

  function tx(mode) {
    return open().then(function (db) { return db.transaction(STORE, mode).objectStore(STORE); });
  }

  /* --------- 内置示例作品（程序化生成的 SVG，不占存储） --------- */
  var PALETTES = [
    ['#F7C948', '#F0932B', '#EB4D4B', '#6AB04C', '#4834D4'],
    ['#FF7675', '#FDCB6E', '#55EFC4', '#74B9FF', '#A29BFE'],
    ['#E17055', '#FAB1A0', '#00B894', '#0984E3', '#6C5CE7'],
    ['#D63031', '#E84393', '#FDCB6E', '#00CEC9', '#2D3436']
  ];

  function rnd(seed) {
    var x = Math.sin(seed * 9301 + 49297) * 233280;
    return x - Math.floor(x);
  }

  function artColor(seed) {
    var p = PALETTES[Math.floor(rnd(seed) * PALETTES.length)];
    var s = '<rect width="400" height="300" fill="#FDFBF7"/>';
    for (var i = 0; i < 7; i++) {
      var r = rnd(seed + i * 3);
      var c = p[Math.floor(rnd(seed + i * 7) * p.length)];
      var cx = 40 + r * 320, cy = 40 + rnd(seed + i * 11) * 220;
      var rad = 26 + rnd(seed + i * 13) * 62;
      s += '<circle cx="' + cx.toFixed(0) + '" cy="' + cy.toFixed(0) + '" r="' + rad.toFixed(0) + '" fill="' + c + '" opacity="0.55"/>';
    }
    s += '<rect x="0" y="228" width="400" height="72" fill="' + p[0] + '" opacity="0.28"/>';
    s += '<path d="M0 232 Q100 208 200 236 T400 224" stroke="' + p[4] + '" stroke-width="4" fill="none" opacity="0.6"/>';
    return s;
  }

  function artSketch(seed) {
    var s = '<rect width="400" height="300" fill="#F4F2EE"/>';
    s += '<ellipse cx="200" cy="252" rx="150" ry="20" fill="#DAD6CE"/>';
    // 几何静物
    s += '<rect x="118" y="140" width="92" height="112" fill="#E6E2DA" stroke="#9A958C" stroke-width="2"/>';
    s += '<polygon points="228,252 272,146 316,252" fill="#DEDAD2" stroke="#8E8981" stroke-width="2"/>';
    s += '<circle cx="145" cy="122" r="34" fill="#EDEAE3" stroke="#8E8981" stroke-width="2"/>';
    for (var i = 0; i < 26; i++) {
      var x1 = 100 + rnd(seed + i) * 220, y1 = 120 + rnd(seed + i * 5) * 130;
      s += '<line x1="' + x1.toFixed(0) + '" y1="' + y1.toFixed(0) + '" x2="' + (x1 + 16).toFixed(0) + '" y2="' + (y1 + 22).toFixed(0) + '" stroke="#6E6A63" stroke-width="1.1" opacity="0.32"/>';
    }
    s += '<rect x="0" y="0" width="400" height="300" fill="none" stroke="#C9C4BA" stroke-width="6"/>';
    return s;
  }

  function artQuick(seed) {
    var s = '<rect width="400" height="300" fill="#FFFDF8"/>';
    var ox = 150 + rnd(seed) * 60;
    s += '<g stroke="#2F2F35" stroke-width="3.2" fill="none" stroke-linecap="round">';
    s += '<circle cx="' + ox + '" cy="70" r="24"/>';
    s += '<path d="M' + ox + ' 94 L' + (ox - 6) + ' 172"/>';
    s += '<path d="M' + ox + ' 108 L' + (ox - 52) + ' 146"/>';
    s += '<path d="M' + ox + ' 108 L' + (ox + 48) + ' 138"/>';
    s += '<path d="M' + (ox - 6) + ' 172 L' + (ox - 44) + ' 244"/>';
    s += '<path d="M' + (ox - 6) + ' 172 L' + (ox + 36) + ' 246"/>';
    s += '</g>';
    for (var i = 0; i < 9; i++) {
      var y = 40 + rnd(seed + i * 2) * 220;
      s += '<path d="M' + (24 + rnd(seed + i) * 40).toFixed(0) + ' ' + y.toFixed(0) + ' q 50 ' + (rnd(seed + i * 3) * 40 - 20).toFixed(0) + ' 96 4" stroke="#B9B4AB" stroke-width="2" fill="none" opacity="0.5"/>';
    }
    return s;
  }

  function seedArt(kind, seed) {
    var inner = kind === 'color' ? artColor(seed) : kind === 'sketch' ? artSketch(seed) : artQuick(seed);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">' + inner + '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  /* --------- 公共 API --------- */
  function putImage(id, rec) {
    mem[id] = rec;
    if (!idbAvailable) return Promise.resolve(id);
    return tx('readwrite').then(function (store) {
      return new Promise(function (resolve, reject) {
        var r = store.put({ id: id, thumb: rec.thumb, full: rec.full, meta: rec.meta || {} });
        r.onsuccess = function () { resolve(id); };
        r.onerror = function () { reject(r.error); };
      });
    }).catch(function () { return id; });
  }

  function getImage(id) {
    if (!id) return Promise.resolve(null);
    // 云端图片：直接返回 URL（http/https/data:），无需再查本地
    if (id.indexOf('http') === 0 || id.indexOf('data:') === 0) {
      return Promise.resolve({ id: id, thumb: id, full: id });
    }
    if (id.indexOf('seed:') === 0) {
      var parts = id.split(':'); // seed:kind:n
      var url = seedArt(parts[1], parseInt(parts[2], 10) || 1);
      return Promise.resolve({ id: id, thumb: url, full: url });
    }
    if (mem[id]) return Promise.resolve(mem[id]);
    if (!idbAvailable) return Promise.resolve(null);
    return tx('readonly').then(function (store) {
      return new Promise(function (resolve) {
        var r = store.get(id);
        r.onsuccess = function () { if (r.result) mem[id] = r.result; resolve(r.result || null); };
        r.onerror = function () { resolve(null); };
      });
    }).catch(function () { return null; });
  }

  function delImage(id) {
    delete mem[id];
    if (!id) return Promise.resolve();
    // 云端图片：从 Supabase Storage 删除（fire-and-forget）
    if (id.indexOf('http') === 0) {
      if (window.Cloud && Cloud.ready()) Cloud.deleteImage(id);
      return Promise.resolve();
    }
    // 内联 data URL / 种子示例图：无需本地删除
    if (id.indexOf('data:') === 0 || id.indexOf('seed:') === 0) return Promise.resolve();
    if (!idbAvailable) return Promise.resolve();
    return tx('readwrite').then(function (store) { store.delete(id); }).catch(function () {});
  }

  function clearAll() {
    mem = {};
    if (!idbAvailable) return Promise.resolve();
    return tx('readwrite').then(function (store) { store.clear(); }).catch(function () {});
  }

  /* --------- 图片压缩 --------- */
  // dataURL -> Blob（用于上传到 Supabase Storage）
  function dataURLtoBlob(dataURL) {
    var parts = String(dataURL).split(',');
    var mime = (parts[0].match(/:(.*?);/) || [, 'image/jpeg'])[1];
    var bin = atob(parts[1]);
    var len = bin.length;
    var arr = new Uint8Array(len);
    for (var i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  function compress(file, maxSide, quality) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          function draw(side, q) {
            var w = img.width, h = img.height;
            var scale = Math.min(1, side / Math.max(w, h));
            var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
            var cv = document.createElement('canvas');
            cv.width = cw; cv.height = ch;
            var ctx = cv.getContext('2d');
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch);
            ctx.drawImage(img, 0, 0, cw, ch);
            return cv.toDataURL('image/jpeg', q);
          }
          try {
            resolve({ full: draw(maxSide || 1280, quality || 0.82), thumb: draw(420, 0.72) });
          } catch (e) { reject(e); }
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  return {
    putImage: putImage,
    getImage: getImage,
    delImage: delImage,
    clearAll: clearAll,
    compress: compress,
    seedArt: seedArt,
    dataURLtoBlob: dataURLtoBlob
  };
})();

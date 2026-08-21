/* ============================================================
   Cloud - Supabase 同步层（无自建后端，直接调用 Supabase REST）
   所有设备的账号 / 学生 / 作业结构化数据都读写同一份云端记录，
   实现跨设备共享。图片暂不进云端（留在各设备本地）。

   配置来源（优先级）：
   1) localStorage 中的 ahm_sb_url / ahm_sb_key（在「我的 → 云端同步」里填写）
   2) 下面的硬编码默认值（由助理预填 Project URL）
   ============================================================ */
var Cloud = (function () {
  /* ===== 默认配置：已预填你的 Project URL 与 anon key（零配置自动连云端） ===== */
  var DEFAULT_URL = 'https://qmcgrtgjytnaxlynijlb.supabase.co';
  var DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtY2dydGdqeXRuYXhseW5pamxiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyNTEzOTEsImV4cCI6MjEwMTgyNzM5MX0.72F8M8XuyeZQkLjT4tIxTE9vFopCVGnfeLBAMSQ7QzA';
  var SUPABASE_URL = '';
  var SUPABASE_ANON_KEY = '';
  var TABLE = 'class_state';
  var ROW_ID = 'main';
  var BUCKET = 'artwork';
  var LS_URL = 'ahm_sb_url';
  var LS_KEY = 'ahm_sb_key';
  var _lastSync = null; // 最近一次与云端成功同步的时间戳(ms)

  function ready() { return !!(SUPABASE_URL && SUPABASE_ANON_KEY); }

  // 记录一次成功同步（读取或写入均可），供 UI 显示「最后同步时间」
  function markSync() { _lastSync = Date.now(); }
  function lastSync() { return _lastSync; }

  // 启动时从 localStorage 读取用户填写的配置（覆盖默认值）
  function init() {
    try {
      var u = localStorage.getItem(LS_URL);
      var k = localStorage.getItem(LS_KEY);
      SUPABASE_URL = u ? u : DEFAULT_URL;
      SUPABASE_ANON_KEY = k ? k : DEFAULT_KEY;
    } catch (e) {
      SUPABASE_URL = DEFAULT_URL;
      SUPABASE_ANON_KEY = DEFAULT_KEY;
    }
  }

  // 运行时设置（来自设置页）
  function setConfig(url, key) {
    SUPABASE_URL = (url || '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '') || DEFAULT_URL;
    SUPABASE_ANON_KEY = (key || '').trim();
  }

  // 保存配置到 localStorage
  function persist(url, key) {
    try {
      localStorage.setItem(LS_URL, (url || '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '') || DEFAULT_URL);
      localStorage.setItem(LS_KEY, (key || '').trim());
    } catch (e) {}
    setConfig(url, key);
  }

  function apiHeaders() {
    return {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Prefer': 'return=minimal'
    };
  }
  function rest() { return SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/' + TABLE; }
  function selectUrl() { return rest() + '?id=eq.' + ROW_ID + '&select=payload,updated_at'; }

  // 拉取云端数据；返回 { payload, updated_at } 或 null
  function load() {
    if (!ready()) return Promise.resolve(null);
    return fetch(selectUrl(), { headers: apiHeaders() })
      .then(function (r) {
        if (r.ok) markSync();
        return r.ok ? r.json() : [];
      })
      .then(function (rows) {
        if (rows && rows[0]) return { payload: rows[0].payload, updated_at: rows[0].updated_at };
        return null;
      })
      .catch(function () { return null; });
  }

  // 轻量探活：只拉 updated_at，用于判断云端是否变化（避免每次轮询都下载整行大体积 JSON）
  function loadMeta() {
    if (!ready()) return Promise.resolve(null);
    return fetch(rest() + '?id=eq.' + ROW_ID + '&select=updated_at', { headers: apiHeaders() })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) { return (rows && rows[0]) ? rows[0].updated_at : null; })
      .catch(function () { return null; });
  }

  // 写入云端（先 PATCH，若行不存在则 POST 插入）
  // 乐观并发控制：传入 expectedVersion 时，仅在「云端版本号 == expectedVersion」时才允许覆盖，
  // 否则视为并发冲突（他人在我们读取后已改写云端），返回 { ok:false, conflict:true } 供上层重试。
  // 返回值：{ ok, conflict, version } —— version 为本次写入成功后的新版本号。
  function save(payload, updatedAt, expectedVersion) {
    if (!ready()) return Promise.resolve({ ok: false, conflict: false, version: null });
    var ts = updatedAt || new Date().toISOString();
    var payloadCopy = JSON.parse(JSON.stringify(payload || {}));
    var base = (typeof payloadCopy.version === 'number') ? payloadCopy.version
             : ((typeof expectedVersion === 'number') ? expectedVersion : 0);
    var newVersion = base + 1;
    payloadCopy.version = newVersion;
    var url = rest() + '?id=eq.' + ROW_ID;
    if (typeof expectedVersion === 'number') url += '&payload->>version=eq.' + expectedVersion;
    var patch = fetch(url, {
      method: 'PATCH',
      headers: Object.assign(apiHeaders(), { 'Prefer': 'return=minimal, count=exact' }),
      body: JSON.stringify({ payload: payloadCopy, updated_at: ts })
    });
    return patch.then(function (r) {
      if (r.status === 404 || r.status === 406) {
        return fetch(rest(), {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify({ id: ROW_ID, payload: payloadCopy, updated_at: ts })
        }).then(function (pr) { if (pr.ok) markSync(); return { ok: pr.ok, conflict: false, version: newVersion }; });
      }
      // 通过 Content-Range 的 count 判断是否真的更新到了行（冲突时为 0）
      var total = null;
      try {
        var cr = r.headers.get('Content-Range');
        if (cr && cr.indexOf('/') >= 0) total = parseInt(cr.split('/')[1], 10);
      } catch (e) {}
      var ok = (total === null) ? r.ok : (total > 0);
      if (ok) markSync();
      return { ok: ok, conflict: !ok && r.ok, version: newVersion };
    }).catch(function () { return { ok: false, conflict: false, version: newVersion }; });
  }

  // 测试连接：尝试 SELECT 一行，返回 { ok, msg }
  function test(url, key) {
    var savedUrl = SUPABASE_URL, savedKey = SUPABASE_ANON_KEY;
    setConfig(url, key);
    var ok = ready();
    var res;
    if (!ok) {
      res = Promise.resolve({ ok: false, msg: '请填写 Project URL 与 anon key' });
    } else {
      res = fetch(selectUrl(), { headers: apiHeaders() })
        .then(function (r) {
          if (r.ok || r.status === 406) return { ok: true, msg: '连接成功' };
          if (r.status === 401) return { ok: false, msg: 'anon key 无效或无权限（请确认已建表并开启策略）' };
          return { ok: false, msg: 'HTTP ' + r.status };
        })
        .catch(function (e) { return { ok: false, msg: '网络错误：' + (e && e.message ? e.message : e) }; });
    }
    // 还原（test 只是探测，不改动持久配置）
    SUPABASE_URL = savedUrl; SUPABASE_ANON_KEY = savedKey;
    return res;
  }

  /* ---------- 图片：Supabase Storage ---------- */
  function storageBase() { return SUPABASE_URL.replace(/\/$/, '') + '/storage/v1'; }
  function publicUrl(path) { return storageBase() + '/object/public/' + BUCKET + '/' + path; }
  function encPath(path) {
    return path.split('/').map(function (s) { return encodeURIComponent(s); }).join('/');
  }
  // 从公开 URL 反推对象路径（用于删除）
  function pathFromUrl(url) {
    var m = String(url).match(/\/object\/public\/(.+)$/);
    if (!m) return null;
    var p = decodeURIComponent(m[1]);
    if (p.indexOf(BUCKET + '/') === 0) p = p.slice(BUCKET.length + 1);
    return p;
  }
  // 上传图片（blob）到 storage，返回公开 URL
  function uploadImage(blob, path) {
    if (!ready()) return Promise.reject(new Error('云端未连接'));
    return fetch(storageBase() + '/object/' + BUCKET + '/' + encPath(path), {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': (blob && blob.type) || 'image/jpeg',
        'x-upsert': 'true',
        'Accept': 'application/json'
      },
      body: blob
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error('上传失败(' + r.status + ')：' + t); });
      return publicUrl(path);
    });
  }
  // 删除云端图片（接受完整 URL 或对象路径）
  function deleteImage(urlOrPath) {
    if (!ready()) return Promise.resolve(false);
    var p = (String(urlOrPath).indexOf('http') === 0) ? pathFromUrl(urlOrPath) : urlOrPath;
    if (!p) return Promise.resolve(false);
    return fetch(storageBase() + '/object/' + BUCKET + '/' + encPath(p), {
      method: 'DELETE',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + SUPABASE_ANON_KEY }
    }).then(function (r) { return r.ok || r.status === 404; }).catch(function () { return false; });
  }

  return {
    init: init, ready: ready, setConfig: setConfig, persist: persist,
    load: load, loadMeta: loadMeta, save: save, test: test,
    uploadImage: uploadImage, deleteImage: deleteImage,
    markSync: markSync, lastSync: lastSync,
    url: function () { return SUPABASE_URL; },
    keyMasked: function () { return SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.slice(0, 6) + '••••' : ''; }
  };
})();

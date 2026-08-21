/* ============================================================
   Charts - 纯 SVG 手写图表（无第三方依赖）
   ============================================================ */
var Charts = (function () {

  function esc(s) { return UI.esc(s); }

  function niceMax(v) {
    if (v <= 4) return 4;
    var step = Math.pow(10, Math.floor(Math.log(v) / Math.LN10)) / 2;
    return Math.ceil(v / step) * step;
  }

  /* ---------- 分组柱状图 ---------- */
  function bar(opts) {
    var W = 660, H = opts.height || 240;
    var padL = 34, padR = 12, padT = 14, padB = 30;
    var labels = opts.labels || [];
    var series = opts.series || [];
    var maxV = 0;
    series.forEach(function (s) { s.data.forEach(function (v) { maxV = Math.max(maxV, v); }); });
    maxV = niceMax(maxV);
    var iw = W - padL - padR, ih = H - padT - padB;
    var gw = labels.length ? iw / labels.length : iw;
    var bw = Math.max(4, Math.min(18, (gw - 10) / Math.max(1, series.length)));

    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" preserveAspectRatio="xMidYMid meet" style="display:block">';
    for (var g = 0; g <= 4; g++) {
      var y = padT + ih - (ih * g / 4);
      s += '<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) + '" stroke="#EDEDF5" stroke-width="1"/>';
      s += '<text x="' + (padL - 7) + '" y="' + (y + 3.5).toFixed(1) + '" font-size="10" fill="#8A8FA8" text-anchor="end">' + Math.round(maxV * g / 4) + '</text>';
    }
    labels.forEach(function (lb, i) {
      var cx = padL + gw * i + gw / 2;
      var totalW = bw * series.length + 3 * (series.length - 1);
      series.forEach(function (se, j) {
        var v = se.data[i] || 0;
        var h = maxV ? (v / maxV) * ih : 0;
        var x = cx - totalW / 2 + j * (bw + 3);
        var y = padT + ih - h;
        if (h > 0) {
          s += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) +
            '" rx="' + Math.min(4, bw / 2).toFixed(1) + '" fill="' + se.color + '"><title>' + esc(se.name + ' ' + lb + '：' + v) + '</title></rect>';
        }
      });
      s += '<text x="' + cx.toFixed(1) + '" y="' + (H - 10) + '" font-size="10.5" fill="#8A8FA8" text-anchor="middle">' + esc(lb) + '</text>';
    });
    s += '</svg>';

    var lg = '<div class="chart-legend">' + series.map(function (se) {
      return '<span><i style="background:' + se.color + '"></i>' + esc(se.name) + '</span>';
    }).join('') + '</div>';
    return s + lg;
  }

  /* ---------- 折线图 ---------- */
  function line(opts) {
    var W = 660, H = opts.height || 220;
    var padL = 34, padR = 14, padT = 14, padB = 30;
    var labels = opts.labels || [], data = opts.data || [];
    var maxV = opts.max || niceMax(Math.max.apply(null, data.concat([1])));
    var iw = W - padL - padR, ih = H - padT - padB;
    var step = labels.length > 1 ? iw / (labels.length - 1) : 0;
    var color = opts.color || '#5A4FCF';

    var pts = data.map(function (v, i) {
      return [padL + step * i, padT + ih - (maxV ? (v / maxV) * ih : 0)];
    });
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" preserveAspectRatio="xMidYMid meet" style="display:block">';
    s += '<defs><linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="' + color + '" stop-opacity=".26"/>' +
      '<stop offset="100%" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>';
    for (var g = 0; g <= 4; g++) {
      var y = padT + ih - (ih * g / 4);
      s += '<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) + '" stroke="#EDEDF5"/>';
      s += '<text x="' + (padL - 7) + '" y="' + (y + 3.5).toFixed(1) + '" font-size="10" fill="#8A8FA8" text-anchor="end">' + Math.round(maxV * g / 4) + (opts.suffix || '') + '</text>';
    }
    if (pts.length) {
      var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
      var area = d + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (padT + ih) + ' L' + pts[0][0].toFixed(1) + ' ' + (padT + ih) + ' Z';
      s += '<path d="' + area + '" fill="url(#lg1)"/>';
      s += '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>';
      pts.forEach(function (p, i) {
        s += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.6" fill="#fff" stroke="' + color + '" stroke-width="2.2">' +
          '<title>' + esc(labels[i] + '：' + data[i]) + '</title></circle>';
      });
    }
    labels.forEach(function (lb, i) {
      s += '<text x="' + (padL + step * i).toFixed(1) + '" y="' + (H - 10) + '" font-size="10.5" fill="#8A8FA8" text-anchor="middle">' + esc(lb) + '</text>';
    });
    s += '</svg>';
    return s;
  }

  /* ---------- 环形图 ---------- */
  function donut(opts) {
    var items = (opts.items || []).filter(function (i) { return i.value > 0; });
    var total = items.reduce(function (a, b) { return a + b.value; }, 0);
    var size = opts.size || 168, r = size / 2 - 16, cx = size / 2, cy = size / 2, sw = 22;
    var s = '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#F0F0F7" stroke-width="' + sw + '"/>';
    if (total > 0) {
      var C = 2 * Math.PI * r, offset = 0;
      items.forEach(function (it) {
        var len = C * (it.value / total);
        s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + it.color + '" stroke-width="' + sw +
          '" stroke-dasharray="' + (len - 1.5).toFixed(2) + ' ' + (C - len + 1.5).toFixed(2) + '" stroke-dashoffset="' + (-offset).toFixed(2) +
          '" transform="rotate(-90 ' + cx + ' ' + cy + ')" stroke-linecap="butt"><title>' + esc(it.label + '：' + it.value) + '</title></circle>';
        offset += len;
      });
    }
    s += '<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" font-size="24" font-weight="700" fill="#1E2033">' + (opts.centerValue !== undefined ? opts.centerValue : total) + '</text>';
    s += '<text x="' + cx + '" y="' + (cy + 17) + '" text-anchor="middle" font-size="11" fill="#8A8FA8">' + esc(opts.centerLabel || '总计') + '</text>';
    s += '</svg>';

    var legend = '<div class="donut-legend">' + (opts.items || []).map(function (it) {
      var pct = total ? Math.round(it.value / total * 100) : 0;
      return '<div class="dl"><i style="background:' + it.color + '"></i><span>' + esc(it.label) + '</span><b>' + it.value + ' · ' + pct + '%</b></div>';
    }).join('') + '</div>';
    return '<div class="donut-wrap">' + s + legend + '</div>';
  }

  /* ---------- 迷你条 ---------- */
  function miniBars(values, color) {
    var max = Math.max.apply(null, values.concat([1]));
    return '<div style="display:flex;align-items:flex-end;gap:3px;height:34px">' + values.map(function (v) {
      return '<div style="flex:1;background:' + (color || '#5A4FCF') + ';opacity:' + (v ? .85 : .15) +
        ';height:' + Math.max(4, (v / max) * 34) + 'px;border-radius:3px"></div>';
    }).join('') + '</div>';
  }

  return { bar: bar, line: line, donut: donut, miniBars: miniBars };
})();

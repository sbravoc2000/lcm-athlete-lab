/* ==========================================================
   Gráficos SVG propios (sin librerías externas)
   ========================================================== */
const Chart = (() => {
  const C = { R: '#f59e0b', L: '#22d3ee', B: '#3cc8f0', A: '#7c8cff', G: '#34d399', N: '#94a3b8' };
  const nice = (min, max, n = 5) => { if (min === max) { min -= 1; max += 1; } const span = max - min, step0 = span / n, mag = 10 ** Math.floor(Math.log10(step0)), step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0) || step0; const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step; const t = []; for (let v = lo; v <= hi + step / 2; v += step) t.push(+v.toFixed(10)); return { lo, hi, ticks: t }; };
  const fmt = v => Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.abs(v) < 10 && v % 1 ? v.toFixed(2).replace(/0$/, '') : String(+v.toFixed(1));
  const frame = (W, H, inner) => `<div class="chart"><svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${inner}</svg></div>`;

  /* líneas: series [{name,color,pts:[{x,y,label}]}]; x numérico o índice */
  function line({ series, W = 560, H = 240, yLabel = '', xLabel = '', xTicks = null, zeroY = false, band = null, markers = true, xNum = false }) {
    const all = series.flatMap(s => s.pts.filter(p => num(p.y) !== null));
    if (!all.length) return '<div class="empty small">Sin datos para graficar.</div>';
    const m = { l: 52, r: 14, t: 14, b: 38 };
    let ys = all.map(p => p.y); if (band) ys = ys.concat([band.lo, band.hi]); if (zeroY) ys.push(0);
    const Y = nice(Math.min(...ys), Math.max(...ys)); const xs = all.map(p => p.x);
    const X0 = Math.min(...xs), X1 = Math.max(...xs) === X0 ? X0 + 1 : Math.max(...xs);
    const sx = x => m.l + (x - X0) / (X1 - X0) * (W - m.l - m.r), sy = y => H - m.b - (y - Y.lo) / (Y.hi - Y.lo) * (H - m.t - m.b);
    let g = '<g class="grid">' + Y.ticks.map(t => `<line x1="${m.l}" x2="${W - m.r}" y1="${sy(t)}" y2="${sy(t)}"/>`).join('') + '</g>';
    g += Y.ticks.map(t => `<text x="${m.l - 6}" y="${sy(t) + 4}" text-anchor="end">${fmt(t)}</text>`).join('');
    if (band) g += `<rect x="${m.l}" width="${W - m.l - m.r}" y="${sy(band.hi)}" height="${Math.max(1, sy(band.lo) - sy(band.hi))}" fill="${band.color || '#7c8cff'}" opacity=".13"/>` + (band.label ? `<text x="${W - m.r - 4}" y="${sy(band.hi) + 12}" text-anchor="end" style="font-size:10px">${esc(band.label)}</text>` : '');
    const xt = xTicks || [...new Set(xs)].map(x => ({ x, label: all.find(p => p.x === x)?.label ?? fmt(x) }));
    g += '<g class="axis">' + `<line x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}"/>` + '</g>';
    const every = Math.ceil(xt.length / 10);
    g += xt.filter((_, i) => i % every === 0).map(t => `<text x="${sx(t.x)}" y="${H - m.b + 15}" text-anchor="middle">${esc(t.label)}</text>`).join('');
    if (yLabel) g += `<text transform="translate(12 ${(H - m.b + m.t) / 2}) rotate(-90)" text-anchor="middle">${esc(yLabel)}</text>`;
    if (xLabel) g += `<text x="${(W + m.l) / 2}" y="${H - 4}" text-anchor="middle">${esc(xLabel)}</text>`;
    series.forEach(s => {
      const p = s.pts.filter(q => num(q.y) !== null).sort((a, b) => a.x - b.x); if (!p.length) return;
      if (!s.noLine) g += `<polyline fill="none" stroke="${s.color}" stroke-width="${s.w || 2.2}" ${s.dash ? 'stroke-dasharray="5 4"' : ''} points="${p.map(q => sx(q.x) + ',' + sy(q.y)).join(' ')}"/>`;
      if (markers) g += p.map(q => `<circle cx="${sx(q.x)}" cy="${sy(q.y)}" r="${s.r || 3.6}" fill="${s.color}"><title>${esc(s.name)}: ${fmt(q.y)}</title></circle>`).join('');
      if (s.labels) g += p.map(q => `<text x="${sx(q.x)}" y="${sy(q.y) - 8}" text-anchor="middle" style="font-size:10.5px;fill:${s.color}">${fmt(q.y)}</text>`).join('');
    });
    return frame(W, H, g) + legend(series);
  }
  function legend(series) { return series.length > 1 || (series[0] && series[0].name) ? `<div class="legend">${series.filter(s => s.name).map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : ''; }

  /* dispersión + rectas/curvas ajustadas */
  function scatter({ series, fits = [], W = 560, H = 260, xLabel = '', yLabel = '' }) {
    const all = series.flatMap(s => s.pts); if (!all.length) return '<div class="empty small">Sin datos.</div>';
    const m = { l: 52, r: 14, t: 14, b: 40 };
    const X = nice(Math.min(...all.map(p => p.x), 0), Math.max(...all.map(p => p.x))), Y = nice(Math.min(...all.map(p => p.y), 0), Math.max(...all.map(p => p.y)) * 1.08);
    const sx = x => m.l + (x - X.lo) / (X.hi - X.lo) * (W - m.l - m.r), sy = y => H - m.b - (y - Y.lo) / (Y.hi - Y.lo) * (H - m.t - m.b);
    let g = '<g class="grid">' + Y.ticks.map(t => `<line x1="${m.l}" x2="${W - m.r}" y1="${sy(t)}" y2="${sy(t)}"/>`).join('') + '</g>';
    g += Y.ticks.map(t => `<text x="${m.l - 6}" y="${sy(t) + 4}" text-anchor="end">${fmt(t)}</text>`).join('') + X.ticks.map(t => `<text x="${sx(t)}" y="${H - m.b + 15}" text-anchor="middle">${fmt(t)}</text>`).join('');
    g += `<g class="axis"><line x1="${m.l}" x2="${W - m.r}" y1="${H - m.b}" y2="${H - m.b}"/><line x1="${m.l}" x2="${m.l}" y1="${m.t}" y2="${H - m.b}"/></g>`;
    g += `<text x="${(W + m.l) / 2}" y="${H - 5}" text-anchor="middle">${esc(xLabel)}</text><text transform="translate(12 ${(H - m.b + m.t) / 2}) rotate(-90)" text-anchor="middle">${esc(yLabel)}</text>`;
    fits.forEach(f => { const pts = []; for (let i = 0; i <= 40; i++) { const x = f.x0 + (f.x1 - f.x0) * i / 40, y = f.fn(x); if (y >= Y.lo && y <= Y.hi) pts.push(sx(x) + ',' + sy(y)); } g += `<polyline fill="none" stroke="${f.color}" stroke-width="1.8" stroke-dasharray="${f.dash ? '5 4' : ''}" points="${pts.join(' ')}"/>`; });
    series.forEach(s => g += s.pts.map(p => `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="${s.r || 4}" fill="${s.color}" ${s.hollow ? `fill-opacity=".15" stroke="${s.color}"` : ''}><title>${fmt(p.x)} → ${fmt(p.y)}</title></circle>`).join(''));
    return frame(W, H, g) + legend(series);
  }

  /* barras D vs I por métrica */
  function pairs({ rows, W = 560, unit = '' }) {
    if (!rows.length) return '<div class="empty small">Sin datos bilaterales.</div>';
    const rh = 34, H = rows.length * rh + 30, m = { l: 150, r: 60 };
    const bw = (v, r) => { const mx = Math.max(Math.abs(num(r.R) || 0), Math.abs(num(r.L) || 0)) || 1; return (Math.abs(num(v) || 0) / mx) * (W - m.l - m.r); };
    let g = '';
    rows.forEach((r, i) => { const y = 14 + i * rh; g += `<text x="${m.l - 8}" y="${y + 15}" text-anchor="end">${esc(r.label)}</text>` + `<rect x="${m.l}" y="${y}" width="${bw(r.R, r)}" height="11" rx="2" fill="${C.R}"/><text x="${m.l + bw(r.R, r) + 4}" y="${y + 9}" style="font-size:10px">D ${num(r.R) === null ? '—' : fmt(r.R)}</text>` + `<rect x="${m.l}" y="${y + 13}" width="${bw(r.L, r)}" height="11" rx="2" fill="${C.L}"/><text x="${m.l + bw(r.L, r) + 4}" y="${y + 22}" style="font-size:10px">I ${num(r.L) === null ? '—' : fmt(r.L)}</text>`; });
    return frame(W, H, g) + `<div class="legend"><span><i style="background:${C.R}"></i>Derecha</span><span><i style="background:${C.L}"></i>Izquierda</span>${unit ? `<span class="muted">${esc(unit)}</span>` : ''}<span class="muted">Barras escaladas por fila (cada variable respecto de su propio máximo)</span></div>`;
  }
  /* barras simples */
  function bars({ rows, W = 560, H = 220, yLabel = '', color = C.B }) {
    const vals = rows.map(r => num(r.v)).filter(v => v !== null); if (!vals.length) return '<div class="empty small">Sin datos.</div>';
    const m = { l: 48, r: 10, t: 12, b: 44 }; const Y = nice(Math.min(0, ...vals), Math.max(...vals));
    const sy = y => H - m.b - (y - Y.lo) / (Y.hi - Y.lo) * (H - m.t - m.b); const bw = (W - m.l - m.r) / rows.length;
    let g = '<g class="grid">' + Y.ticks.map(t => `<line x1="${m.l}" x2="${W - m.r}" y1="${sy(t)}" y2="${sy(t)}"/>`).join('') + '</g>' + Y.ticks.map(t => `<text x="${m.l - 6}" y="${sy(t) + 4}" text-anchor="end">${fmt(t)}</text>`).join('');
    rows.forEach((r, i) => { const v = num(r.v); if (v === null) return; const x = m.l + i * bw + bw * 0.18, w = bw * 0.64; g += `<rect x="${x}" y="${Math.min(sy(v), sy(0))}" width="${w}" height="${Math.abs(sy(0) - sy(v))}" rx="3" fill="${r.color || color}"><title>${esc(r.label)}: ${fmt(v)}</title></rect><text x="${x + w / 2}" y="${sy(v) - 4}" text-anchor="middle" style="font-size:10.5px">${fmt(v)}</text><text x="${x + w / 2}" y="${H - m.b + 14}" text-anchor="middle">${esc(r.label)}</text>`; });
    if (yLabel) g += `<text transform="translate(12 ${(H - m.b + m.t) / 2}) rotate(-90)" text-anchor="middle">${esc(yLabel)}</text>`;
    return frame(W, H, g);
  }
  /* señal fuerza–tiempo con marcadores */
  function signal({ y, fs, marks = [], W = 640, H = 220, yLabel = 'Fz (N)' }) {
    if (!y || !y.length) return '';
    const step = Math.max(1, Math.floor(y.length / 900)); const m = { l: 52, r: 10, t: 10, b: 30 };
    const vals = y.filter(v => v !== null); const Y = nice(Math.min(...vals), Math.max(...vals)); const n = y.length;
    const sx = i => m.l + i / (n - 1) * (W - m.l - m.r), sy = v => H - m.b - (v - Y.lo) / (Y.hi - Y.lo) * (H - m.t - m.b);
    let g = '<g class="grid">' + Y.ticks.map(t => `<line x1="${m.l}" x2="${W - m.r}" y1="${sy(t)}" y2="${sy(t)}"/>`).join('') + '</g>' + Y.ticks.map(t => `<text x="${m.l - 6}" y="${sy(t) + 4}" text-anchor="end">${fmt(t)}</text>`).join('');
    const pts = []; for (let i = 0; i < n; i += step) if (y[i] !== null) pts.push(sx(i).toFixed(1) + ',' + sy(y[i]).toFixed(1));
    g += `<polyline fill="none" stroke="${C.B}" stroke-width="1.4" points="${pts.join(' ')}"/>`;
    const secs = n / fs; const tstep = secs > 10 ? 2 : secs > 4 ? 1 : 0.5; for (let t = 0; t <= secs; t += tstep) g += `<text x="${sx(t * fs)}" y="${H - 12}" text-anchor="middle">${t.toFixed(1)} s</text>`;
    marks.forEach(mk => { if (mk.i === null || mk.i === undefined || mk.i < 0) return; g += `<line x1="${sx(mk.i)}" x2="${sx(mk.i)}" y1="${m.t}" y2="${H - m.b}" stroke="${mk.color || C.A}" stroke-dasharray="4 3"/><text x="${sx(mk.i) + 3}" y="${m.t + 10}" style="font-size:10px;fill:${mk.color || C.A}">${esc(mk.label)}</text>`; });
    g += `<text transform="translate(12 ${(H - m.b + m.t) / 2}) rotate(-90)" text-anchor="middle">${esc(yLabel)}</text>`;
    return frame(W, H, g);
  }
  return { line, scatter, pairs, bars, signal, C };
})();

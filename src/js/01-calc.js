/* ==========================================================
   Cálculos reutilizables (puros, sin efectos secundarios)
   Cada función devuelve null si los datos requeridos faltan.
   ========================================================== */
const G = 9.81;
const Calc = {
  clean(a) { return (a || []).map(num).filter(v => v !== null); },
  mean(a) { a = Calc.clean(a); return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null; },
  sd(a) { a = Calc.clean(a); if (a.length < 2) return null; const m = Calc.mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); },
  cv(a) { const m = Calc.mean(a), s = Calc.sd(a); return m && s !== null ? s / Math.abs(m) * 100 : null; },
  best(a, higherIsBetter = true) { a = Calc.clean(a); return a.length ? (higherIsBetter ? Math.max(...a) : Math.min(...a)) : null; },
  /* Asimetría % = |D − I| / máx(D, I) × 100  (Bishop et al., 2018) */
  asymmetry(r, l) { r = num(r); l = num(l); if (r === null || l === null || Math.max(Math.abs(r), Math.abs(l)) === 0) return null; return Math.abs(r - l) / Math.max(Math.abs(r), Math.abs(l)) * 100; },
  /* Relación D/I */
  ratioRL(r, l) { r = num(r); l = num(l); return r === null || l === null || l === 0 ? null : r / l; },
  /* LSI = extremidad de interés / extremidad de referencia × 100.
     Si no se define referencia: menor desempeño / mayor desempeño × 100 (según dirección). */
  lsi(r, l, refSide = null, higherIsBetter = true) {
    r = num(r); l = num(l); if (r === null || l === null || r === 0 || l === 0) return null;
    if (refSide === 'R') return higherIsBetter ? l / r * 100 : r / l * 100;
    if (refSide === 'L') return higherIsBetter ? r / l * 100 : l / r * 100;
    return higherIsBetter ? Math.min(r, l) / Math.max(r, l) * 100 : Math.min(r, l) / Math.max(r, l) * 100;
  },
  /* lado con mejor desempeño */
  betterSide(r, l, higherIsBetter = true) { r = num(r); l = num(l); if (r === null || l === null || r === l) return null; return (r > l) === higherIsBetter ? 'R' : 'L'; },
  changeAbs(a, b) { a = num(a); b = num(b); return a === null || b === null ? null : b - a; },
  changePct(a, b) { a = num(a); b = num(b); return a === null || b === null || a === 0 ? null : (b - a) / Math.abs(a) * 100; },
  perKg(v, mass) { v = num(v); mass = num(mass); return v === null || !mass ? null : v / mass; },
  /* altura por tiempo de vuelo: h = g·t²/8 (Bosco et al., 1983) */
  heightFromFlight(tf) { tf = num(tf); return tf === null || tf <= 0 ? null : G * tf * tf / 8 * 100; /* cm */ },
  /* RSI = altura (m) / tiempo de contacto (s) */
  rsi(heightCm, contactS) { heightCm = num(heightCm); contactS = num(contactS); return heightCm === null || !contactS ? null : (heightCm / 100) / contactS; },
  /* RSI modificado = altura (m) / tiempo hasta el despegue (s) */
  rsiMod(heightCm, ttoS) { return Calc.rsi(heightCm, ttoS); },
  /* RFD media en ventana = ΔF / Δt */
  rfd(f1, f0, dtS) { f1 = num(f1); f0 = num(f0); dtS = num(dtS); return f1 === null || f0 === null || !dtS ? null : (f1 - f0) / dtS; },
  /* impulso por integración trapezoidal (N·s) */
  impulse(force, fs, subtract = 0) { if (!force || force.length < 2 || !fs) return null; let s = 0; for (let i = 1; i < force.length; i++) s += ((force[i - 1] - subtract) + (force[i] - subtract)) / 2 / fs; return s; },
  /* Índice de decremento Sdec (Glaister et al., 2008): (1 − Σ/(mejor·n))·100 */
  sdec(a, higherIsBetter = true) { a = Calc.clean(a); if (a.length < 2) return null; const b = Calc.best(a, higherIsBetter), s = a.reduce((x, y) => x + y, 0); return higherIsBetter ? (1 - s / (b * a.length)) * 100 : (s / (b * a.length) - 1) * 100; },
  /* pérdida % primera→última (o mejor→última) */
  lossPct(a, from = 'first', higherIsBetter = true) { a = Calc.clean(a); if (a.length < 2) return null; const ref = from === 'best' ? Calc.best(a, higherIsBetter) : a[0], last = a[a.length - 1]; return ref === 0 ? null : (ref - last) / Math.abs(ref) * 100 * (higherIsBetter ? 1 : -1); },
  fatigueIndex(a, k = 3) { a = Calc.clean(a); if (a.length < 2 * k) k = Math.max(1, Math.floor(a.length / 2)); if (a.length < 2) return null; const f = Calc.mean(a.slice(0, k)), l = Calc.mean(a.slice(-k)); return f ? (f - l) / f * 100 : null; },
  /* regresión lineal simple */
  linreg(xs, ys) {
    const p = xs.map((x, i) => [num(x), num(ys[i])]).filter(([x, y]) => x !== null && y !== null); const n = p.length; if (n < 2) return null;
    const mx = p.reduce((s, q) => s + q[0], 0) / n, my = p.reduce((s, q) => s + q[1], 0) / n;
    let sxy = 0, sxx = 0, syy = 0; p.forEach(([x, y]) => { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; });
    if (sxx === 0) return null; const slope = sxy / sxx, icpt = my - slope * mx; const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
    return { slope, intercept: icpt, r2, n };
  },
  /* ajuste cuadrático y = a + b x + c x² (mínimos cuadrados) */
  quadfit(xs, ys) {
    const p = xs.map((x, i) => [num(x), num(ys[i])]).filter(([x, y]) => x !== null && y !== null); if (p.length < 3) return null;
    let S = [0, 0, 0, 0, 0], T = [0, 0, 0]; p.forEach(([x, y]) => { for (let k = 0; k < 5; k++) S[k] += x ** k; for (let k = 0; k < 3; k++) T[k] += y * x ** k; });
    const M = [[S[0], S[1], S[2]], [S[1], S[2], S[3]], [S[2], S[3], S[4]]];
    const det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
    const D = det(M); if (Math.abs(D) < 1e-12) return null;
    const col = (i) => M.map((r, j) => r.map((v, k) => k === i ? T[j] : v));
    return { a: det(col(0)) / D, b: det(col(1)) / D, c: det(col(2)) / D };
  },
  /* Potencia media en saltos continuos (Bosco et al., 1983): W/kg = g²·Tf·Tt / (4·n·(Tt − Tf)) */
  boscoPower(totalFlight, totalTime, n) { totalFlight = num(totalFlight); totalTime = num(totalTime); n = num(n); if (!totalFlight || !totalTime || !n || totalTime <= totalFlight) return null; return G * G * totalFlight * totalTime / (4 * n * (totalTime - totalFlight)); },
  /* DSI = PF dinámico (CMJ) / PF isométrico (IMTP) — ambos brutos (N) o ambos netos */
  dsi(pfDyn, pfIso) { pfDyn = num(pfDyn); pfIso = num(pfIso); return pfDyn === null || !pfIso ? null : pfDyn / pfIso; },
  /* MDC95 a partir de SEM: SEM·1.96·√2 */
  mdc95(sem) { sem = num(sem); return sem === null ? null : sem * 1.96 * Math.SQRT2; },
  semFromICC(sd, icc) { sd = num(sd); icc = num(icc); return sd === null || icc === null ? null : sd * Math.sqrt(1 - icc); },
  /* Tanaka et al., 2001: FCmáx estimada = 208 − 0.7·edad */
  hrMaxTanaka(age) { age = num(age); return age === null ? null : 208 - 0.7 * age; },
  /* VO2max ESTIMADO por protocolos de campo */
  vo2Estimate(protocol, d) {
    if (protocol === 'cooper') { const m = num(d.distance); return m ? { value: (m - 504.9) / 44.73, eq: 'VO₂max est. = (distancia 12 min [m] − 504.9) / 44.73', ref: 'cooper1968' } : null; }
    if (protocol === 'yoyoir1') { const m = num(d.distance); return m ? { value: m * 0.0084 + 36.4, eq: 'VO₂max est. = distancia YYIR1 [m] × 0.0084 + 36.4', ref: 'bangsbo2008' } : null; }
    if (protocol === 'leger20') { const s = num(d.finalSpeed); return s ? { value: -24.4 + 6.0 * s, eq: 'VO₂max est. (adultos ≥18 a) = −24.4 + 6.0 × velocidad final [km/h]', ref: 'leger1988' } : null; }
    return null;
  },
  bmi(mass, heightCm) { mass = num(mass); heightCm = num(heightCm); return mass && heightCm ? mass / ((heightCm / 100) ** 2) : null; },
  ageFrom(birth) { if (!birth) return null; const b = new Date(birth), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--; return a; }
};

/* ==========================================================
   Análisis de señales fuerza–tiempo (CSV de plataforma)
   Métodos documentados; umbrales explícitos y editables.
   ========================================================== */
const Signal = {
  parseCSV(text) {
    const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
    if (!lines.length) return { headers: [], rows: [] };
    const sep = [';', '\t', ','].map(s => [s, (lines[0].match(new RegExp(s === '\t' ? '\t' : '\\' + s, 'g')) || []).length]).sort((a, b) => b[1] - a[1])[0][0];
    const split = l => l.split(sep).map(x => x.trim().replace(/^"|"$/g, ''));
    let hi = 0; // primera línea con mayoría no numérica = encabezado
    for (let i = 0; i < Math.min(lines.length, 40); i++) { const c = split(lines[i]); const nn = c.filter(x => x !== '' && !isNaN(parseFloat(x.replace(',', '.')))).length; if (nn >= c.length * 0.8 && i > 0) { hi = i - 1; break; } }
    const headers = split(lines[hi]);
    const rows = lines.slice(hi + 1).map(split).filter(r => r.some(x => x !== ''));
    return { headers, rows, sep };
  },
  column(parsed, idx) { return parsed.rows.map(r => { const v = r[idx]; return v === undefined ? null : num(sep_fix(v)); }); function sep_fix(v) { return parsed.sep === ';' ? v.replace(',', '.') : v; } },
  /* Detecta masa corporal (primer segundo estable), inicio (BW ± 5 DE), despegue (<umbral), aterrizaje */
  analyzeJump(fz, fs, opts = {}) {
    const n = fz.length; if (n < fs) return { error: 'Registro demasiado corto (se requiere ≥ 1 s de pie quieto).' };
    const wWin = Math.round((opts.weighSec || 1) * fs); const w = fz.slice(0, wWin);
    const bw = Calc.mean(w), sdw = Calc.sd(w) || 0, mass = bw / G;
    const thrOn = opts.onsetSD ? opts.onsetSD : 5; const onsetThr = thrOn * sdw;
    const flightThr = opts.flightN ?? 20;
    let onset = -1; for (let i = wWin; i < n; i++) if (Math.abs(fz[i] - bw) > onsetThr) { onset = i; break; }
    if (onset < 0) return { error: 'No se detectó inicio del movimiento.' };
    // retroceder 30 ms (Owen et al., 2014)
    onset = Math.max(0, onset - Math.round(0.03 * fs));
    let to = -1; for (let i = onset; i < n; i++) if (fz[i] < flightThr) { to = i; break; }
    if (to < 0) return { error: 'No se detectó despegue (Fz < ' + flightThr + ' N).' };
    let land = -1; for (let i = to + 1; i < n; i++) if (fz[i] > flightThr) { land = i; break; }
    // velocidad por impulso-momento
    let v = 0, vmin = 0, pPeak = 0, vTO = 0; const vel = [];
    for (let i = onset; i < to; i++) { const a = (fz[i] - bw) / mass; v += a / fs; vel.push(v); if (v < vmin) vmin = v; const p = fz[i] * v; if (p > pPeak) pPeak = p; }
    vTO = v;
    const pf = Math.max(...fz.slice(onset, to));
    const hImp = vTO > 0 ? vTO * vTO / (2 * G) * 100 : null;
    const tf = land > 0 ? (land - to) / fs : null; const hTF = tf ? Calc.heightFromFlight(tf) : null;
    const netImp = Calc.impulse(fz.slice(onset, to), fs, bw);
    return { bodyWeightN: bw, massKg: mass, onsetIdx: onset, takeoffIdx: to, landingIdx: land, peakForceN: pf, peakForceRel: pf / mass, peakPowerW: pPeak, peakPowerRel: pPeak / mass, takeoffVel: vTO, heightImpulseCm: hImp, flightTimeS: tf, heightFlightCm: hTF, netImpulseNs: netImp, timeToTakeoffS: (to - onset) / fs, minVel: vmin, method: `Masa: media 1.º ${(opts.weighSec || 1)} s; inicio: |Fz−BW| > ${thrOn} DE (retroceso 30 ms); despegue/aterrizaje: Fz ${flightThr} N; altura por velocidad de despegue (impulso–momento) y por tiempo de vuelo.` };
  },
  analyzeIMTP(fz, fs, opts = {}) {
    const n = fz.length; const wWin = Math.round((opts.weighSec || 1) * fs); if (n < wWin + fs) return { error: 'Registro demasiado corto.' };
    const base = fz.slice(0, wWin), bw = Calc.mean(base), sdb = Calc.sd(base) || 0;
    const thr = (opts.onsetN ?? null) !== null ? opts.onsetN : 5 * sdb;
    let onset = -1; for (let i = wWin; i < n; i++) if (fz[i] - bw > thr) { onset = i; break; }
    if (onset < 0) return { error: 'No se detectó inicio del tirón.' };
    let pf = -Infinity, pfi = onset; for (let i = onset; i < n; i++) if (fz[i] > pf) { pf = fz[i]; pfi = i; }
    const at = ms => { const i = onset + Math.round(ms / 1000 * fs); return i < n ? fz[i] : null; };
    const f0 = fz[onset];
    const out = { baselineN: bw, massKg: bw / G, onsetIdx: onset, peakIdx: pfi, peakForceN: pf, netPeakForceN: pf - bw, peakForceRel: pf / (bw / G), timeToPeakS: (pfi - onset) / fs };
    [50, 100, 150, 200, 250].forEach(ms => { const f = at(ms); out['F' + ms] = f; out['RFD0_' + ms] = f === null ? null : (f - f0) / (ms / 1000); out['IMP0_' + ms] = Calc.impulse(fz.slice(onset, onset + Math.round(ms / 1000 * fs) + 1), fs, bw); });
    out.method = `Línea base: media 1.º s; inicio: Fz − base > ${opts.onsetN ?? '5 DE'} ${opts.onsetN ? 'N' : ''}; RFD media en ventanas desde el inicio; impulso neto (− línea base).`;
    return out;
  },
  /* contactos en carrera: segmentos donde Fz > umbral */
  analyzeContacts(fz, fs, massKg, opts = {}) {
    const thr = opts.thrN ?? 50; const contacts = []; let st = -1;
    for (let i = 0; i < fz.length; i++) { if (fz[i] > thr && st < 0) st = i; if ((fz[i] <= thr || i === fz.length - 1) && st >= 0) { if (i - st > 0.05 * fs) contacts.push([st, i]); st = -1; } }
    const bw = massKg ? massKg * G : null;
    return contacts.map(([a, b]) => {
      const seg = fz.slice(a, b); const pk = Math.max(...seg); const pki = a + seg.indexOf(pk);
      // pico de impacto: primer máximo local en los primeros 60 ms si existe
      let imp = null, impi = null; const lim = Math.min(b, a + Math.round(0.06 * fs));
      for (let i = a + 2; i < lim - 1; i++) if (fz[i] > fz[i - 1] && fz[i] >= fz[i + 1] && fz[i] > thr * 4) { imp = fz[i]; impi = i; break; }
      let valr = null; if (imp) { const i20 = a + seg.findIndex(v => v >= 0.2 * imp), i80 = a + seg.findIndex(v => v >= 0.8 * imp); if (i80 > i20) valr = (0.6 * imp) / ((i80 - i20) / fs); }
      return { start: a, end: b, contactS: (b - a) / fs, peakN: pk, peakBW: bw ? pk / bw : null, impactN: imp, impactBW: bw && imp ? imp / bw : null, valrNs: valr, valrBWs: bw && valr ? valr / bw : null, impulseNs: Calc.impulse(seg, fs, 0) };
    });
  }
};

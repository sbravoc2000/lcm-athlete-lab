/* ==========================================================
   IMPORTACIÓN QTM / AMTI — saltos con 2 plataformas (izquierda + derecha)
   Formatos admitidos:
   · Exportación TSV de QTM con datos de fuerza: un archivo por plataforma
     (p. ej., Measurement4_f_1.tsv y Measurement4_f_2.tsv) con encabezado
     (FREQUENCY, FORCE_PLATE_NAME, …) y columnas SAMPLE TIME Force_X Force_Y Force_Z …
   · Un único archivo con dos columnas verticales (Fz1/Fz2, FZ_L/FZ_R, etc.).
   · Se detecta y se informa la exportación 3D de QTM sin datos de fuerza.
   ========================================================== */
const QTM = {
  JUMP_TYPES: [
    ['cmj', 'CMJ'], ['sj', 'SJ (Squat Jump)'], ['abk', 'Abalakov'], ['cmju-R', 'CMJ unilateral derecho'], ['cmju-L', 'CMJ unilateral izquierdo'], ['cmjload', 'CMJ con carga'], ['sjload', 'SJ con carga']
  ],
  supports(testId) { return ['cmj', 'sj', 'abk', 'cmju', 'cmjload', 'sjload'].includes(testId); },
  /* ---------- lectura ---------- */
  parse(text, fileName = '') {
    const lines = text.replace(/\r/g, '').split('\n');
    const meta = {}; let hdrIdx = -1;
    for (let i = 0; i < Math.min(lines.length, 200); i++) {
      const l = lines[i]; if (!l.trim()) continue;
      const c = l.split('\t');
      if (c.length > 2 && c.some(x => /force[_ ]?z|^f?z\d?$|^fz|fz[_ ]?(l|r|1|2)/i.test(x.trim()))) { hdrIdx = i; break; }
      if (/^[A-Z_]+$/.test(c[0].trim()) && c.length <= 4) meta[c[0].trim()] = c.slice(1).join('\t').trim();
    }
    const freq = num(meta.FREQUENCY);
    if (hdrIdx < 0) {
      if (meta.DATA_INCLUDED || meta.NO_OF_MARKERS !== undefined) return { kind: '3d', fileName, meta, freq, frames: num(meta.NO_OF_FRAMES), markers: num(meta.NO_OF_MARKERS), error: `Archivo de trayectorias 3D de QTM (${meta.NO_OF_MARKERS ?? '?'} marcadores, ${meta.NO_OF_FRAMES ?? '?'} cuadros a ${meta.FREQUENCY ?? '?'} Hz). No contiene datos de fuerza.` };
      return { kind: 'unknown', fileName, meta, error: 'No se encontró una columna de fuerza vertical (Force_Z / Fz).' };
    }
    const heads = lines[hdrIdx].split('\t').map(x => x.trim());
    const rows = [];
    for (let i = hdrIdx + 1; i < lines.length; i++) { const l = lines[i]; if (!l.trim()) continue; const c = l.split('\t'); const v = c.map(x => { const n = parseFloat(x.trim().replace(',', '.')); return Number.isFinite(n) ? n : null; }); if (v.filter(x => x !== null).length >= 2) rows.push(v); }
    const col = re => heads.findIndex(h => re.test(h));
    const fzCols = heads.map((h, i) => [h, i]).filter(([h]) => /force[_ ]?z|^fz/i.test(h));
    let fs = freq;
    const ti = col(/^time$/i); if (!fs && ti >= 0 && rows.length > 2) { const dt = rows[1][ti] - rows[0][ti]; if (dt > 0) fs = Math.round(1 / dt); }
    const plates = fzCols.map(([h, i]) => ({ label: fzCols.length > 1 ? h : (meta.FORCE_PLATE_NAME || fileName), fz: rows.map(r => r[i]).filter(v => v !== null) }));
    const cop = { x: col(/cop[_ ]?x/i), y: col(/cop[_ ]?y/i) };
    if (fzCols.length === 1 && cop.x >= 0) plates[0].copX = rows.map(r => r[cop.x]);
    return { kind: 'force', fileName, meta, fs, plateName: meta.FORCE_PLATE_NAME || null, plateModel: meta.FORCE_PLATE_MODEL || null, nSamples: rows.length, plates, timeStamp: meta.TIME_STAMP || null };
  },
  /* agrupa archivos *_f_1 / *_f_2 por medición */
  group(parsed) {
    const g = {};
    parsed.forEach(p => {
      const m = p.fileName.match(/^(.*?)(?:[_-]f[_-]?(\d+))?\.(tsv|txt|csv)$/i); const base = m ? m[1] : p.fileName; const idx = m && m[2] ? +m[2] : null;
      (g[base] = g[base] || { base, files: [] }).files.push(Object.assign(p, { plateIdx: idx }));
    });
    return Object.values(g).map(x => { x.files.sort((a, b) => (a.plateIdx ?? 0) - (b.plateIdx ?? 0)); return x; });
  },
  /* asignación de plataformas → lado (persistente) */
  mapping() { return DB.setting('qtmPlateMap') || { 1: 'L', 2: 'R' }; },
  /* construye señales izquierda/derecha a partir de una medición agrupada */
  signals(grp) {
    const map = QTM.mapping(); const force = grp.files.filter(f => f.kind === 'force');
    let plates = [];
    force.forEach(f => f.plates.forEach((p, k) => plates.push({ idx: f.plates.length > 1 ? k + 1 : (f.plateIdx ?? plates.length + 1), name: p.label, fz: p.fz, fs: f.fs })));
    if (!plates.length) return { error: grp.files.map(f => f.error).filter(Boolean).join(' ') || 'Sin datos de fuerza.' };
    const fs = plates[0].fs; if (!fs) return { error: 'No se pudo determinar la frecuencia de muestreo.' };
    if (plates.some(p => p.fs !== fs)) return { error: 'Las plataformas tienen frecuencias distintas.' };
    const n = Math.min(...plates.map(p => p.fz.length));
    // signo: QTM puede exportar Fz negativo (fuerza sobre la plataforma). Se invierte si la media es negativa.
    const inverted = [];
    plates.forEach(p => { p.fz = p.fz.slice(0, n); const m = Calc.mean(p.fz); if (m < 0) { p.fz = p.fz.map(v => -v); inverted.push(p.idx); } });
    const out = { fs, n, inverted, plates: plates.map(p => ({ idx: p.idx, name: p.name, side: map[p.idx] || null })) };
    if (plates.length === 1) { out.single = true; out.total = plates[0].fz; out.L = null; out.R = null; out.sideOfSingle = map[plates[0].idx] || null; if (out.sideOfSingle === 'R') out.R = plates[0].fz; else if (out.sideOfSingle === 'L') out.L = plates[0].fz; return out; }
    const pL = plates.find(p => map[p.idx] === 'L') || plates[0], pR = plates.find(p => map[p.idx] === 'R' && p !== pL) || plates.find(p => p !== pL);
    out.L = pL.fz; out.R = pR.fz; out.total = pL.fz.map((v, i) => v + pR.fz[i]);
    if (plates.length > 2) out.warn = `Se encontraron ${plates.length} plataformas; se usan ${pL.name} (I) y ${pR.name} (D).`;
    return out;
  },
  /* ---------- análisis del salto ---------- */
  analyze(sig, opts) {
    const { fs } = sig; const F = sig.total, L = sig.L, R = sig.R; const n = F.length; const g = G;
    const type = opts.type; const load = num(opts.load) || 0; const flightThr = num(opts.flightThr) ?? 20;
    const flags = []; const res = { type, load, fs, method: [] };
    if (n < fs * 1.5) return { error: 'Registro demasiado corto (se requiere ≥ 1 s de pie quieto antes del salto).' };
    // 1) pesaje: ventana de 1 s más estable dentro de los primeros 3 s (o hasta el despegue)
    let firstFlight = -1; for (let i = 0; i < n; i++) if (F[i] < flightThr) { let k = i; while (k < n && F[k] < flightThr) k++; if (k - i >= 0.03 * fs) { firstFlight = i; break; } i = k; }
    if (firstFlight < 0) return { error: `No se detectó fase de vuelo (fuerza total < ${flightThr} N durante ≥ 30 ms). ¿El deportista salió de la plataforma o la señal no está en newtons?` };
    const win = Math.round(fs * (num(opts.weighSec) || 1)); const searchEnd = Math.min(firstFlight - win, Math.round(3 * fs));
    let best = null; for (let s0 = 0; s0 <= Math.max(0, searchEnd); s0 += Math.max(1, Math.round(fs / 50))) { const w = F.slice(s0, s0 + win); const sd = Calc.sd(w); if (!best || sd < best.sd) best = { s0, sd, m: Calc.mean(w) }; }
    if (!best) return { error: 'No hay 1 s de quietud antes del salto.' };
    const BW = best.m, SD = best.sd || 0.5, mSys = BW / g, mBody = mSys - load;
    if (mBody < 25) flags.push(['bad', `Masa corporal calculada ${fx(mBody, 1)} kg: revise la carga externa o las unidades.`]);
    if (SD > 0.02 * BW) flags.push(['warn', `Pesaje poco estable (DE ${fx(SD, 1)} N): el deportista no estuvo quieto 1 s; la altura por impulso puede verse afectada.`]);
    res.bodyWeightN = BW; res.systemMass = mSys; res.bodyMass = mBody; res.weighSD = SD;
    // 2) inicio del movimiento
    const thr = Math.max(5 * SD, 10);
    let onset = -1;
    if (type === 'sj' || type === 'sjload') {
      // SJ: último instante antes del pico propulsivo con fuerza dentro de BW ± umbral (posición mantenida)
      let pk = best.s0 + win; for (let i = pk; i < firstFlight; i++) if (F[i] > F[pk]) pk = i;
      for (let i = pk; i > best.s0 + win; i--) if (Math.abs(F[i] - BW) <= thr) { onset = i; break; }
      if (onset < 0) onset = best.s0 + win;
      const pre = F.slice(Math.max(0, onset - Math.round(0.3 * fs)), onset); if (pre.length && Calc.sd(pre) > 3 * SD + 5) flags.push(['warn', 'Posición inicial del SJ poco estable en los 300 ms previos.']);
    } else {
      for (let i = best.s0 + win; i < firstFlight; i++) if (Math.abs(F[i] - BW) > thr) { onset = i; break; }
      if (onset < 0) return { error: 'No se detectó el inicio del movimiento.' };
      onset = Math.max(0, onset - Math.round(0.03 * fs));
    }
    const to = firstFlight; let land = -1; for (let i = to; i < n; i++) if (F[i] > flightThr) { land = i; break; }
    // 3) cinemática del centro de masa del sistema (impulso–momento)
    const v = new Array(to - onset).fill(0), d = new Array(to - onset).fill(0), P = new Array(to - onset).fill(0);
    let vi = 0, di = 0; for (let i = onset; i < to; i++) { const k = i - onset; vi += (F[i] - BW) / mSys / fs; di += vi / fs; v[k] = vi; d[k] = di; P[k] = F[i] * vi; }
    const vTO = v[v.length - 1];
    let kVmin = 0; for (let k = 0; k < v.length; k++) if (v[k] < v[kVmin]) kVmin = k;
    let kV0 = kVmin; while (kV0 < v.length && v[kV0] < 0) kV0++;
    const hasCM = v[kVmin] < -0.05;
    if ((type === 'sj' || type === 'sjload') && hasCM) flags.push(['warn', `Posible contramovimiento en SJ (velocidad mínima ${fx(v[kVmin], 2)} m/s antes de la propulsión).`]);
    const propStart = onset + (hasCM ? kV0 : 0), brakeStart = onset + kVmin;
    res.phases = { onset, brakeStart: hasCM ? brakeStart : null, propStart, takeoff: to, landing: land };
    // 4) variables
    const slice = (arr, a, b) => arr ? arr.slice(a, b) : null;
    const prop = slice(F, propStart, to);
    res.takeoffVel = vTO; res.heightImpulse = vTO > 0 ? vTO * vTO / (2 * g) * 100 : null;
    res.flightTime = land > 0 ? (land - to) / fs : null; res.heightFlight = res.flightTime ? Calc.heightFromFlight(res.flightTime) : null;
    res.peakForce = Math.max(...prop); res.peakForceRelBody = res.peakForce / mBody;
    res.meanPropForce = Calc.mean(prop);
    res.peakPower = Math.max(...P); res.peakPowerRel = res.peakPower / mBody; res.meanPropPower = Calc.mean(P.slice(propStart - onset));
    res.netPropImpulse = Calc.impulse(prop, fs, BW);
    res.timeToTakeoff = (to - onset) / fs; res.rsimod = res.heightImpulse ? res.heightImpulse / 100 / res.timeToTakeoff : null;
    res.cmDepth = hasCM ? -Math.min(...d) * 100 : null;
    res.brakingDuration = hasCM ? (propStart - brakeStart) / fs : null; res.propDuration = (to - propStart) / fs;
    res.minVel = v[kVmin];
    if (land > 0) { const lw = F.slice(land, Math.min(n, land + Math.round(0.4 * fs))); res.landingPeak = Math.max(...lw); res.landingPeakBW = res.landingPeak / BW; }
    // 5) por pierna
    if (L && R) {
      const leg = (arr, a, b) => arr.slice(a, b);
      const pR = leg(R, propStart, to), pL = leg(L, propStart, to);
      res.legs = {
        R: { pf: Math.max(...pR), imp: Calc.impulse(pR, fs, 0), mean: Calc.mean(pR), brakeImp: hasCM ? Calc.impulse(leg(R, brakeStart, propStart), fs, 0) : null, weigh: Calc.mean(R.slice(best.s0, best.s0 + win)), lpf: land > 0 ? Math.max(...R.slice(land, Math.min(n, land + Math.round(0.4 * fs)))) : null },
        L: { pf: Math.max(...pL), imp: Calc.impulse(pL, fs, 0), mean: Calc.mean(pL), brakeImp: hasCM ? Calc.impulse(leg(L, brakeStart, propStart), fs, 0) : null, weigh: Calc.mean(L.slice(best.s0, best.s0 + win)), lpf: land > 0 ? Math.max(...L.slice(land, Math.min(n, land + Math.round(0.4 * fs)))) : null }
      };
      const unil = type === 'cmju-R' || type === 'cmju-L';
      if (unil) {
        const st = type === 'cmju-R' ? 'R' : 'L', ot = st === 'R' ? 'L' : 'R'; res.stance = st;
        const other = (st === 'R' ? L : R).slice(onset, to); const om = Math.max(...other);
        if (om > 50) flags.push(['bad', `Se registró fuerza en la plataforma ${sideName(ot).toLowerCase()} (máx. ${fx(om, 0)} N) durante el salto unilateral: posible apoyo de la otra pierna o pierna asignada a la plataforma equivocada.`]);
        if (res.legs[st].weigh < 0.8 * BW) flags.push(['warn', `Durante el pesaje la plataforma ${sideName(st).toLowerCase()} soportó solo ${fx(res.legs[st].weigh / BW * 100, 0)} % del peso: verifique el lado seleccionado.`]);
        const lpfO = res.legs[ot].lpf; if (lpfO && lpfO > 0.2 * BW) flags.push(['warn', 'Aterrizaje con contacto de la otra pierna (fuerza > 20 % del peso en la otra plataforma).']);
      } else {
        const wr = res.legs.R.weigh / BW * 100; res.weighDistR = wr;
        if (Math.abs(wr - 50) > 10) flags.push(['info', `Distribución del peso en el pesaje: D ${fx(wr, 0)} % / I ${fx(100 - wr, 0)} %.`]);
        res.asym = { pf: Calc.asymmetry(res.legs.R.pf, res.legs.L.pf), imp: Calc.asymmetry(res.legs.R.imp, res.legs.L.imp), brakeImp: Calc.asymmetry(res.legs.R.brakeImp, res.legs.L.brakeImp), lpf: Calc.asymmetry(res.legs.R.lpf, res.legs.L.lpf), mean: Calc.asymmetry(res.legs.R.mean, res.legs.L.mean) };
      }
    } else if (!sig.single) flags.push(['info', 'Una sola señal de fuerza: no se calculan variables por pierna.']);
    // 6) controles de calidad
    if (res.flightTime !== null && (res.flightTime < 0.1 || res.flightTime > 1.0)) flags.push(['bad', `Tiempo de vuelo inusual (${fx(res.flightTime, 3)} s).`]);
    if (land < 0) flags.push(['warn', 'No se detectó el aterrizaje dentro del registro: no hay tiempo de vuelo.']);
    if (res.heightImpulse !== null && res.heightFlight !== null && Math.abs(res.heightFlight - res.heightImpulse) > 3) flags.push(['warn', `Diferencia de ${fx(res.heightFlight - res.heightImpulse, 1)} cm entre la altura por tiempo de vuelo y por impulso: posible flexión de piernas en el vuelo (el tiempo de vuelo la sobreestima), aterrizaje en otra postura o error de pesaje.`]);
    if (vTO <= 0) flags.push(['bad', 'Velocidad de despegue no positiva: revise el pesaje, el inicio o el signo de la señal.']);
    if (sig.inverted.length) res.method.push(`Señal Fz invertida en la(s) plataforma(s) ${sig.inverted.join(', ')} (la exportación usaba signo negativo).`);
    res.method.push(`Pesaje: ventana de ${num(opts.weighSec) || 1} s más estable antes del salto (DE ${fx(SD, 1)} N). Inicio: |F − P| > ${fx(thr, 1)} N (5 DE, mín. 10 N) con retroceso de 30 ms${type.startsWith('sj') ? '; en SJ, último instante con F ≈ P antes del pico' : ''}. Despegue/aterrizaje: F total ${flightThr} N. Velocidad por impulso–momento con masa del sistema${load ? ' (deportista + carga)' : ''}. Fases: frenado desde la velocidad mínima; propulsión desde v ≥ 0 (McMahon et al., 2018). Impulsos por pierna: brutos (∫F dt).`);
    res.flags = flags; res.onset = onset; res.series = { total: F, L, R };
    return res;
  },
  /* valores para un intento de la prueba */
  toTrialValues(res, heightMethod = 'impulse') {
    const h = heightMethod === 'flight' ? res.heightFlight : res.heightImpulse;
    const v = { h: h === null ? null : +h.toFixed(2), tf: res.flightTime === null ? null : +res.flightTime.toFixed(3), pf: +res.peakForce.toFixed(0), pp: +res.peakPower.toFixed(0), imp: res.netPropImpulse === null ? null : +res.netPropImpulse.toFixed(1), tto: +res.timeToTakeoff.toFixed(3), depth: res.cmDepth === null ? null : +res.cmDepth.toFixed(1) };
    if (res.load) v.load = res.load;
    if (res.legs && !res.stance) Object.assign(v, { pfR: +res.legs.R.pf.toFixed(0), pfL: +res.legs.L.pf.toFixed(0), impR: +res.legs.R.imp.toFixed(1), impL: +res.legs.L.imp.toFixed(1), lpfR: res.legs.R.lpf === null ? null : +res.legs.R.lpf.toFixed(0), lpfL: res.legs.L.lpf === null ? null : +res.legs.L.lpf.toFixed(0) });
    return v;
  },
  testFor(type) { if (type.startsWith('cmju')) return { testId: 'cmju', side: type.slice(-1) }; return { testId: type, side: 'B' }; },
  /* ---------- presentación ---------- */
  plot(res) {
    const fs = res.fs, s = res.series; const step = Math.max(1, Math.floor(s.total.length / 1200)); const ds = a => a ? a.filter((_, i) => i % step === 0) : null;
    const W = 700, H = 230, m = { l: 52, r: 10, t: 12, b: 28 }; const T = ds(s.total), Ls = ds(s.L), Rs = ds(s.R); const n = T.length;
    const all = T.concat(Ls || [], Rs || []); const lo = Math.min(0, ...all), hi = Math.max(...all) * 1.05;
    const sx = i => m.l + i / (n - 1) * (W - m.l - m.r), sy = v => H - m.b - (v - lo) / (hi - lo) * (H - m.t - m.b);
    const pl = (a, c, w) => a ? `<polyline fill="none" stroke="${c}" stroke-width="${w}" points="${a.map((v, i) => sx(i).toFixed(1) + ',' + sy(v).toFixed(1)).join(' ')}"/>` : '';
    let g = ''; const tk = Math.pow(10, Math.floor(Math.log10(hi))) ; for (let v = 0; v <= hi; v += tk) g += `<line x1="${m.l}" x2="${W - m.r}" y1="${sy(v)}" y2="${sy(v)}" stroke="#1a2d48"/><text x="${m.l - 6}" y="${sy(v) + 4}" text-anchor="end">${v}</text>`;
    g += `<line x1="${m.l}" x2="${W - m.r}" y1="${sy(res.bodyWeightN)}" y2="${sy(res.bodyWeightN)}" stroke="#7f95b2" stroke-dasharray="4 3"/><text x="${W - m.r}" y="${sy(res.bodyWeightN) - 4}" text-anchor="end" style="font-size:10px">peso del sistema</text>`;
    g += pl(Rs, Chart.C.R, 1.3) + pl(Ls, Chart.C.L, 1.3) + pl(T, '#e8f0fb', 1.8);
    const secs = s.total.length / fs; for (let t = 0; t <= secs; t += secs > 6 ? 1 : 0.5) g += `<text x="${sx(t * fs / step)}" y="${H - 8}" text-anchor="middle">${t.toFixed(1)} s</text>`;
    const ph = res.phases; [[ph.onset, 'inicio', Chart.C.A], [ph.brakeStart, 'frenado', Chart.C.G], [ph.propStart, 'propulsión', Chart.C.B], [ph.takeoff, 'despegue', Chart.C.R], [ph.landing, 'aterrizaje', Chart.C.L]].forEach(([i, l, c], k) => { if (i === null || i < 0) return; const x = sx(i / step); g += `<line x1="${x}" x2="${x}" y1="${m.t}" y2="${H - m.b}" stroke="${c}" stroke-dasharray="3 3"/><text x="${x + 3}" y="${m.t + 10 + (k % 2) * 11}" style="font-size:10px;fill:${c}">${l}</text>`; });
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}">${g}</svg></div><div class="legend"><span><i style="background:#e8f0fb"></i>Total</span>${s.R ? `<span><i style="background:${Chart.C.R}"></i>Plataforma derecha</span>` : ''}${s.L ? `<span><i style="background:${Chart.C.L}"></i>Plataforma izquierda</span>` : ''}</div>`;
  },
  resultHTML(res) {
    const row = (l, v, u, d = 2) => `<tr><td>${l}</td><td class="num"><b>${fx(v, d)}</b> ${u}</td></tr>`;
    let h = `<div class="grid"><div class="c6"><table><tbody>
      ${row('Peso del sistema en el pesaje', res.bodyWeightN, 'N', 0)}${row('Masa corporal' + (res.load ? ` (sistema ${fx(res.systemMass, 1)} − carga ${res.load})` : ''), res.bodyMass, 'kg', 1)}
      ${row('Altura (impulso–momento)', res.heightImpulse, 'cm', 1)}${row('Altura (tiempo de vuelo)', res.heightFlight, 'cm', 1)}${row('Tiempo de vuelo', res.flightTime, 's', 3)}${row('Velocidad de despegue', res.takeoffVel, 'm/s', 2)}
      ${row('Tiempo hasta el despegue', res.timeToTakeoff, 's', 3)}${row('RSI modificado', res.rsimod, 'm/s', 2)}${res.cmDepth !== null ? row('Profundidad del contramovimiento', res.cmDepth, 'cm', 1) : ''}
      </tbody></table></div><div class="c6"><table><tbody>
      ${row('Fuerza pico propulsiva (total)', res.peakForce, 'N', 0)}${row('Fuerza pico relativa', res.peakForceRelBody, 'N/kg', 1)}${row('Fuerza media propulsiva', res.meanPropForce, 'N', 0)}
      ${row('Potencia pico', res.peakPower, 'W', 0)}${row('Potencia pico relativa (masa corporal)', res.peakPowerRel, 'W/kg', 1)}${row('Potencia media propulsiva', res.meanPropPower, 'W', 0)}
      ${row('Impulso neto propulsivo', res.netPropImpulse, 'N·s', 1)}${res.brakingDuration !== null ? row('Duración del frenado', res.brakingDuration, 's', 3) : ''}${row('Duración de la propulsión', res.propDuration, 's', 3)}${res.landingPeakBW ? row('Fuerza pico de aterrizaje', res.landingPeakBW, '× peso', 2) : ''}
      </tbody></table></div></div>`;
    if (res.legs && !res.stance) h += `<h4 style="margin-top:10px">Por pierna (2 plataformas)</h4><div class="tablewrap"><table><thead><tr><th>Variable</th><th class="num">Derecha</th><th class="num">Izquierda</th><th class="num">Asimetría %</th></tr></thead><tbody>
      <tr><td>Carga en el pesaje</td><td class="num">${fx(res.legs.R.weigh, 0)} N</td><td class="num">${fx(res.legs.L.weigh, 0)} N</td><td class="num">${fx(Calc.asymmetry(res.legs.R.weigh, res.legs.L.weigh), 1)}</td></tr>
      <tr><td>Fuerza pico propulsiva</td><td class="num">${fx(res.legs.R.pf, 0)} N</td><td class="num">${fx(res.legs.L.pf, 0)} N</td><td class="num"><b>${fx(res.asym.pf, 1)}</b></td></tr>
      <tr><td>Fuerza media propulsiva</td><td class="num">${fx(res.legs.R.mean, 0)} N</td><td class="num">${fx(res.legs.L.mean, 0)} N</td><td class="num">${fx(res.asym.mean, 1)}</td></tr>
      <tr><td>Impulso propulsivo (bruto)</td><td class="num">${fx(res.legs.R.imp, 1)} N·s</td><td class="num">${fx(res.legs.L.imp, 1)} N·s</td><td class="num"><b>${fx(res.asym.imp, 1)}</b></td></tr>
      ${res.legs.R.brakeImp !== null ? `<tr><td>Impulso de frenado (bruto)</td><td class="num">${fx(res.legs.R.brakeImp, 1)} N·s</td><td class="num">${fx(res.legs.L.brakeImp, 1)} N·s</td><td class="num">${fx(res.asym.brakeImp, 1)}</td></tr>` : ''}
      <tr><td>Fuerza pico de aterrizaje</td><td class="num">${fx(res.legs.R.lpf, 0)} N</td><td class="num">${fx(res.legs.L.lpf, 0)} N</td><td class="num">${fx(res.asym.lpf, 1)}</td></tr></tbody></table></div><p class="tiny muted">Asimetría % = |D − I| / máx × 100. Una asimetría en un solo salto es descriptiva; se interpreta frente al CV entre intentos al integrar la prueba.</p>`;
    if (res.stance) h += `<div class="note neutral small">Salto unilateral sobre la pierna <b>${sideName(res.stance).toLowerCase()}</b>.</div>`;
    h += res.flags.map(([t, m]) => `<div class="note ${t} small">${esc(m)}</div>`).join('');
    h += `<p class="tiny muted">${res.method.map(esc).join(' ')}</p>`;
    return h;
  },
  async readFiles(fileList) { const arr = []; for (const f of fileList) { const txt = await readFile(f); arr.push(QTM.parse(txt, f.name)); } return arr; },
  /* registrar el resultado como intento válido de la prueba */
  sendToTest(res, meta) {
    const { testId, side } = QTM.testFor(res.type); const ts = ensureTest(testId); if (!ts) return null;
    const trials = Ctx.trials(ts.id).filter(t => t.side === side && t.status === 'valid');
    const attempt = trials.length ? Math.max(...trials.map(t => t.attempt)) + 1 : 1;
    const values = QTM.toTrialValues(res, meta.heightMethod);
    const tr = DB.put('trials', { testSessionId: ts.id, attempt, side, status: 'valid', include: true, values, at: nowISO(), source: 'QTM/AMTI: ' + meta.fileLabel, qc: res.flags.map(f => f[1]) });
    ts.config = Object.assign({}, ts.config, { system: 'Plataforma de fuerza AMTI', heightMethod: meta.heightMethod === 'flight' ? 'Tiempo de vuelo (h = g·t²/8)' : 'Velocidad de despegue (impulso–momento)', fs: res.fs });
    if (ts.status === 'pending') { ts.status = 'in_progress'; ts.startedAt = nowISO(); }
    DB.put('testSessions', ts); Engine.save(ts);
    return { ts, attempt, tr };
  },
  /* desde el paso de intento de la toma guiada */
  pickForTrial(test, ts, side, body) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.accept = '.tsv,.txt,.csv'; inp.style.display = 'none'; document.body.appendChild(inp); setTimeout(() => inp.remove(), 600000);
    inp.onchange = async () => {
      const parsed = await QTM.readFiles(inp.files); const grp = QTM.group(parsed)[0]; if (!grp) return;
      const sig = QTM.signals(grp); if (sig.error) { modal({ title: 'No se pudo usar el archivo', body: `<div class="note bad">${esc(sig.error)}</div>${QTM.helpHTML()}` }); return; }
      const type = test.id === 'cmju' ? 'cmju-' + side : test.id; const load = num((ts.config || {}).load) || 0;
      const res = QTM.analyze(sig, { type, load, flightThr: DB.setting('qtmThr') || 20 }); if (res.error) { modal({ title: 'Análisis no posible', body: `<div class="note bad">${esc(res.error)}</div>` }); return; }
      const hm = DB.setting('qtmHeight') || 'impulse'; const vals = QTM.toTrialValues(res, hm);
      modal({ title: `QTM/AMTI · ${esc(grp.base)}`, wide: true, body: QTM.plot(res) + QTM.resultHTML(res), actions: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Copiar valores al intento', cls: 'ok', onClick: () => { Object.entries(vals).forEach(([k, v]) => { const x = $('#tr' + side + '_' + k, body); if (x && v !== null && v !== undefined) x.value = v; }); toast('Valores copiados. Revise y marque VÁLIDO o REPETIR.', 'info'); } }] });
    };
    inp.click();
  },
  helpHTML() {
    return `<div class="note neutral small"><b>Cómo exportar desde QTM:</b> en <i>File → Export → To TSV</i>, active la opción de <b>datos de fuerza</b> (force data). QTM genera un archivo por plataforma, típicamente <span class="mono">NombreMedición_f_1.tsv</span> y <span class="mono">NombreMedición_f_2.tsv</span>. Seleccione <b>ambos archivos a la vez</b>. El archivo <span class="mono">NombreMedición.tsv</span> sin sufijo contiene solo trayectorias 3D (marcadores) y no sirve para el análisis de fuerzas.</div>`;
  }
};

/* ---------- vista: importación por lotes ---------- */
let QTM_STATE = { groups: [], results: {} };
Views.m_qtm = el => {
  if (!guard(el)) return;
  const map = QTM.mapping(); const hm = DB.setting('qtmHeight') || 'impulse'; const thr = DB.setting('qtmThr') || 20;
  el.innerHTML = pageHead('Saltos en plataformas AMTI (QTM)', 'Importación de exportaciones TSV de QTM con dos plataformas: izquierda y derecha.', testBtn('cmj') + testBtn('cmju')) + QTM.helpHTML() + `
  <div class="card"><h3>Configuración del laboratorio</h3><div class="grid">
    <div class="c3"><label>Plataforma 1 (archivo _f_1)</label><select id="qm1"><option value="L" ${map[1] === 'L' ? 'selected' : ''}>Izquierda</option><option value="R" ${map[1] === 'R' ? 'selected' : ''}>Derecha</option></select></div>
    <div class="c3"><label>Plataforma 2 (archivo _f_2)</label><select id="qm2"><option value="R" ${map[2] === 'R' ? 'selected' : ''}>Derecha</option><option value="L" ${map[2] === 'L' ? 'selected' : ''}>Izquierda</option></select></div>
    <div class="c3"><label>Altura que se registra en la prueba</label><select id="qmH"><option value="impulse" ${hm === 'impulse' ? 'selected' : ''}>Impulso–momento (recomendado)</option><option value="flight" ${hm === 'flight' ? 'selected' : ''}>Tiempo de vuelo</option></select></div>
    <div class="c3"><label>Umbral de despegue/aterrizaje</label><div class="fieldunit"><input type="number" id="qmT" value="${thr}" min="5" max="100"><span>N</span></div></div>
  </div><p class="small muted">Verifique la lateralidad una vez: pida al deportista que se pare solo sobre la pierna derecha y confirme que el análisis muestra la carga en «Derecha». La asignación queda guardada.</p></div>
  <div class="card" style="margin-top:12px"><div class="row between"><div><h3 style="margin:0">Archivos de la sesión</h3><div class="small muted">Puede seleccionar varias mediciones a la vez (todos sus archivos _f_1 y _f_2).</div></div><label class="btn" style="margin:0">Seleccionar archivos TSV<input type="file" id="qmF" multiple accept=".tsv,.txt,.csv" hidden></label></div><div id="qmList" style="margin-top:12px"></div></div>`;
  const saveCfg = () => { const m = { 1: $('#qm1').value, 2: $('#qm2').value }; if (m[1] === m[2]) { toast('Las dos plataformas no pueden tener el mismo lado', 'bad'); return false; } DB.setting('qtmPlateMap', m); DB.setting('qtmHeight', $('#qmH').value); DB.setting('qtmThr', num($('#qmT').value) || 20); return true; };
  ['#qm1', '#qm2', '#qmH', '#qmT'].forEach(s => $(s).onchange = () => { if (saveCfg()) { QTM_STATE.results = {}; renderList(); } });
  $('#qmF').onchange = async ev => { const parsed = await QTM.readFiles(ev.target.files); const gs = QTM.group(parsed); gs.forEach(g => { const i = QTM_STATE.groups.findIndex(x => x.base === g.base); if (i >= 0) QTM_STATE.groups[i] = g; else QTM_STATE.groups.push(g); g.type = g.type || (/sj/i.test(g.base) ? 'sj' : /abk|abalakov/i.test(g.base) ? 'abk' : 'cmj'); g.load = g.load || 0; }); ev.target.value = ''; renderList(); };
  const renderList = () => {
    const box = $('#qmList'); if (!QTM_STATE.groups.length) { box.innerHTML = '<div class="empty small">Sin archivos cargados.</div>'; return; }
    box.innerHTML = QTM_STATE.groups.map((g, gi) => {
      const sig = QTM.signals(g); const res = QTM_STATE.results[g.base];
      const files = g.files.map(f => `<span class="pill ${f.kind === 'force' ? 'ok' : 'bad'}">${esc(f.fileName)}${f.kind === 'force' ? ` · ${f.fs} Hz · ${f.nSamples} muestras${f.plateIdx ? ` · plataforma ${f.plateIdx} → ${sideName(QTM.mapping()[f.plateIdx] || '?')}` : ''}` : ' · sin fuerzas'}</span>`).join('');
      return `<div class="card flat" style="margin-bottom:10px"><div class="cardhead"><h3>${esc(g.base)}</h3><button class="btn sm ghost" data-qrm="${gi}">${ICON.trash}</button></div><div>${files}</div>
      ${sig.error ? `<div class="note bad small">${esc(sig.error)}</div>` : `
      ${sig.warn ? `<div class="note warn small">${esc(sig.warn)}</div>` : ''}${sig.single ? '<div class="note warn small">Solo se cargó una plataforma: seleccione también el otro archivo (_f_1 / _f_2) para obtener datos por pierna.</div>' : ''}
      <div class="grid"><div class="c4"><label>Tipo de salto</label><select data-qtype="${gi}">${QTM.JUMP_TYPES.map(([v, l]) => `<option value="${v}" ${g.type === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div class="c3"><label>Carga externa</label><div class="fieldunit"><input type="number" min="0" max="200" step="0.5" data-qload="${gi}" value="${g.load || 0}"><span>kg</span></div></div><div class="c5" style="display:flex;align-items:flex-end;gap:8px"><button class="btn" data-qan="${gi}">Analizar</button>${res && !res.error ? `<button class="btn ok" data-qsend="${gi}" ${Ctx.evaluation() ? '' : 'disabled'}>${g.sent ? '✓ Registrado' : 'Registrar como intento válido'}</button>` : ''}</div></div>
      ${res ? (res.error ? `<div class="note bad" style="margin-top:8px">${esc(res.error)}</div>` : `<div style="margin-top:10px">${QTM.plot(res)}${QTM.resultHTML(res)}</div>`) : ''}`}</div>`;
    }).join('') + (Object.values(QTM_STATE.results).some(r => r && !r.error) ? `<div class="row"><button class="btn ok" id="qmAll">Registrar todos los analizados pendientes</button></div>` : '');
    $$('[data-qtype]', box).forEach(s => s.onchange = () => { const g = QTM_STATE.groups[+s.dataset.qtype]; g.type = s.value; delete QTM_STATE.results[g.base]; g.sent = false; renderList(); });
    $$('[data-qload]', box).forEach(s => s.onchange = () => { const g = QTM_STATE.groups[+s.dataset.qload]; g.load = num(s.value) || 0; delete QTM_STATE.results[g.base]; g.sent = false; renderList(); });
    $$('[data-qrm]', box).forEach(b => b.onclick = () => { const g = QTM_STATE.groups.splice(+b.dataset.qrm, 1)[0]; delete QTM_STATE.results[g.base]; renderList(); });
    $$('[data-qan]', box).forEach(b => b.onclick = () => { const g = QTM_STATE.groups[+b.dataset.qan]; analyze(g); renderList(); });
    $$('[data-qsend]', box).forEach(b => b.onclick = () => send(QTM_STATE.groups[+b.dataset.qsend]));
    if ($('#qmAll')) $('#qmAll').onclick = () => { let n = 0; QTM_STATE.groups.forEach(g => { const r = QTM_STATE.results[g.base]; if (r && !r.error && !g.sent) { send(g, true); n++; } }); toast(`${n} intentos registrados`); renderList(); };
  };
  const analyze = g => { const sig = QTM.signals(g); if (sig.error) return; if ((g.type === 'cmjload' || g.type === 'sjload') && !g.load) toast('Indique la carga externa para un salto con carga', 'warn'); QTM_STATE.results[g.base] = QTM.analyze(sig, { type: g.type, load: g.load, flightThr: DB.setting('qtmThr') || 20 }); };
  const send = (g, quiet) => {
    const res = QTM_STATE.results[g.base]; if (!res || res.error) return;
    if (res.flags.some(f => f[0] === 'bad') && !quiet && !confirm('El análisis tiene alertas de calidad (en rojo). ¿Registrar igualmente como intento válido?')) return;
    const r = QTM.sendToTest(res, { heightMethod: DB.setting('qtmHeight') || 'impulse', fileLabel: g.base });
    if (r) { g.sent = true; DB.put('imports', { athleteId: r.ts.athleteId, evaluationId: r.ts.evaluationId, testSessionId: r.ts.id, kind: 'qtm-jump', fileName: g.base, analysis: res.type, fs: res.fs, result: Object.fromEntries(Object.entries(res).filter(([k]) => k !== 'series')) }); if (!quiet) { toast(`${T(r.ts.testId).short}: intento ${r.attempt} registrado`); renderList(); } }
  };
  renderList();
};

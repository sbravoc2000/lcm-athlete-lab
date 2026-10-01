/* ==========================================================
   Motor de resultados, contexto y fases
   ========================================================== */
const Ctx = {
  athlete() { const id = DB.setting('activeAthlete'); return id ? DB.get('athletes', id) : null; },
  evaluation() { const id = DB.setting('activeEvaluation'); const e = id ? DB.get('evaluations', id) : null; const a = Ctx.athlete(); return e && a && e.athleteId === a.id ? e : null; },
  setAthlete(id) { DB.setting('activeAthlete', id); const evs = DB.where('evaluations', e => e.athleteId === id).sort(byDate); DB.setting('activeEvaluation', evs.length ? evs[evs.length - 1].id : null); },
  setEvaluation(id) { DB.setting('activeEvaluation', id); },
  sessions(evId) { return DB.where('sessions', s => s.evaluationId === evId).sort((a, b) => a.n - b.n); },
  testSessions(evId) { return DB.where('testSessions', t => t.evaluationId === evId); },
  ts(evId, testId) { return DB.where('testSessions', t => t.evaluationId === evId && t.testId === testId)[0] || null; },
  result(tsId) { return DB.where('results', r => r.testSessionId === tsId)[0] || null; },
  trials(tsId) { return DB.where('trials', t => t.testSessionId === tsId).sort((a, b) => (a.attempt - b.attempt) || String(a.createdAt).localeCompare(b.createdAt)); },
  injuries(aid) { return DB.where('injuries', i => i.athleteId === aid).sort(byDate); },
  consent(evId) { return DB.where('consents', c => c.evaluationId === evId).sort((a, b) => String(b.createdAt).localeCompare(a.createdAt))[0] || null; },
  questionnaires(evId) { return DB.where('questionnaires', q => q.evaluationId === evId); },
  /* masa para normalización: check-in de la sesión → InBody de la evaluación → ficha */
  mass(evId, sessionId) {
    const s = sessionId ? DB.get('sessions', sessionId) : null;
    if (s && s.checkin && num(s.checkin.mass)) return { value: num(s.checkin.mass), src: 'check-in de la sesión ' + s.n };
    const ib = evId ? Ctx.ts(evId, 'inbody') : null; const r = ib ? Ctx.result(ib.id) : null;
    const w = r ? r.metrics.find(m => m.fk === 'weight') : null; if (w && num(w.value)) return { value: num(w.value), src: 'InBody de esta evaluación' };
    if (evId) { const ss = Ctx.sessions(evId).find(x => x.checkin && num(x.checkin.mass)); if (ss) return { value: num(ss.checkin.mass), src: 'check-in de la sesión ' + ss.n }; }
    const a = evId ? DB.get('athletes', DB.get('evaluations', evId)?.athleteId) : Ctx.athlete();
    if (a && num(a.massKg)) return { value: num(a.massKg), src: 'ficha del deportista' };
    return null;
  }
};

const Engine = {
  sides(test) { return test.bilateral ? ['R', 'L'] : ['B']; },
  validTrials(tsId) { return Ctx.trials(tsId).filter(t => t.status === 'valid' && t.include !== false); },
  compute(ts) {
    const test = T(ts.testId); if (!test) return null;
    const out = { testSessionId: ts.id, athleteId: ts.athleteId, evaluationId: ts.evaluationId, testId: test.id, date: (DB.get('sessions', ts.sessionId) || {}).date || todayStr(), metrics: [], pairs: [], derived: [], notes: [] };
    const massObj = Ctx.mass(ts.evaluationId, ts.sessionId); const mass = massObj ? massObj.value : null; out.mass = massObj;
    const cfg = ts.config || {};
    const add = (fk, label, unit, side, stats, extra = {}) => out.metrics.push(Object.assign({ key: metricKey(test, fk) + (side !== 'B' ? '.' + side : ''), base: metricKey(test, fk), fk, label, unit, side }, stats, extra));
    const pair = (fk, label, unit, R, L, hib = true, cvR = null, cvL = null, key = false) => {
      if (num(R) === null && num(L) === null) return;
      const asym = Calc.asymmetry(R, L), cvm = Calc.mean([cvR, cvL]);
      out.pairs.push({ fk, label, unit, R: num(R), L: num(L), hib, asym, ratio: Calc.ratioRL(R, L), lsi: Calc.lsi(R, L, null, hib), better: Calc.betterSide(R, L, hib), cvMean: cvm, exceedsCV: asym !== null && cvm !== null ? asym > cvm : null, diff: num(R) !== null && num(L) !== null ? num(R) - num(L) : null, key, base: metricKey(test, fk) });
    };
    if (test.mode === 'standard' || test.mode === 'gait') {
      const trials = Engine.validTrials(ts.id).map(t => Object.assign({}, t, { values: trialCalc(test, t.values || {}, cfg) }));
      // Y-Balance: compuesto por intento
      if (test.id === 'ybal') trials.forEach(t => { const ll = num(t.side === 'R' ? cfg.llR : cfg.llL); const v = t.values; if (ll && num(v.ant) !== null && num(v.pm) !== null && num(v.pl) !== null) v.comp = +((num(v.ant) + num(v.pm) + num(v.pl)) / (3 * ll) * 100).toFixed(1); ['ant', 'pm', 'pl'].forEach(k => { if (ll && num(v[k]) !== null) v[k + 'N'] = num(v[k]) / ll * 100; }); });
      if (test.id === 'cmj') trials.forEach(t => { const v = t.values; const r = Calc.rsiMod(v.h, v.tto); v.rsimod = r === null ? null : +r.toFixed(3); });
      const fields = [...test.fields];
      if (test.id === 'cmj') fields.push({ k: 'rsimod', label: 'RSI modificado', unit: 'm/s' });
      if (test.id === 'ybal') fields.push({ k: 'antN', label: 'Anterior normalizado', unit: '%LMI' }, { k: 'pmN', label: 'Posteromedial normalizado', unit: '%LMI' }, { k: 'plN', label: 'Posterolateral normalizado', unit: '%LMI' });
      const sideStats = {};
      Engine.sides(test).forEach(side => {
        sideStats[side] = {};
        const st = trials.filter(t => t.side === side);
        fields.forEach(f => {
          const arr = st.map(t => num(t.values[f.k])).filter(v => v !== null); if (!arr.length) return;
          const hib = f.hib !== false; const best = Calc.best(arr, hib), mean = Calc.mean(arr), sd = Calc.sd(arr), cv = Calc.cv(arr);
          const value = f.sum === 'mean' ? mean : best;
          const s = { value, best, mean, sd, cv, n: arr.length, hib, sum: f.sum || 'best', primary: !!f.key };
          sideStats[side][f.k] = s; add(f.k, f.label, f.unit, side, s);
          if (f.perKg && mass) add(f.k + '_kg', f.label + ' relativa', f.unit + '/kg', side, { value: value / mass, derived: true, eq: `${f.label} / masa (${fx(mass, 1)} kg)` });
          if (f.k === 'pf' && num(cfg.lever)) { const tq = value * num(cfg.lever); add('torque', 'Torque pico', 'N·m', side, { value: tq, derived: true, eq: `F × brazo (${cfg.lever} m)` }); if (mass) add('torque_kg', 'Torque relativo', 'N·m/kg', side, { value: tq / mass, derived: true, eq: 'Torque / masa' }); }
        });
      });
      if (test.bilateral) fields.forEach(f => { const R = sideStats.R?.[f.k], L = sideStats.L?.[f.k]; if (R || L) pair(f.k, f.label, f.unit, R?.value, L?.value, f.hib !== false, R?.cv, L?.cv, !!f.key); if (f.perKg && mass && R && L) pair(f.k + '_kg', f.label + ' relativa', f.unit + '/kg', R.value / mass, L.value / mass, true, R.cv, L.cv); });
      // doble plataforma (CMJ/IMTP)
      if (['cmj', 'sj', 'abk', 'cmjload', 'sjload', 'imtp'].includes(test.id)) { const b = sideStats.B || {}; if (b.pfR || b.pfL) pair('pfLR', 'Fuerza pico propulsiva por pierna (2 plataformas)', 'N', b.pfR?.value, b.pfL?.value, true, b.pfR?.cv, b.pfL?.cv, true); if (b.impR || b.impL) pair('impLR', 'Impulso propulsivo por pierna (2 plataformas)', 'N·s', b.impR?.value, b.impL?.value, true, b.impR?.cv, b.impL?.cv, true); if (b.lpfR || b.lpfL) pair('lpfLR', 'Fuerza pico de aterrizaje por pierna', 'N', b.lpfR?.value, b.lpfL?.value, false, b.lpfR?.cv, b.lpfL?.cv, false); }
      if (['cmjload', 'sjload'].includes(test.id)) { const byLoad = {}; trials.forEach(t => { const L = num(t.values.load), h = num(t.values.h); if (L === null || h === null) return; if (!byLoad[L] || h > byLoad[L].h) byLoad[L] = { h, pp: num(t.values.pp) }; }); Object.keys(byLoad).map(Number).sort((a, b) => a - b).forEach(L => { out.derived.push({ key: `${test.id}.h@${L}`, label: `Altura mejor con ${L} kg`, value: byLoad[L].h, unit: 'cm', eq: 'Mejor intento por carga' }); if (byLoad[L].pp !== null) out.derived.push({ key: `${test.id}.pp@${L}`, label: `Potencia pico con ${L} kg`, value: byLoad[L].pp, unit: 'W', eq: 'Del intento de mayor altura' }); }); out.loadProfile = byLoad; }
      // derivadas específicas
      const B = sideStats.B || {};
      if (test.id === 'imtp' && B.pf && num(cfg.bwN ?? null) === null) { const bw = B.bw ? B.bw.value : (mass ? mass * G : null); if (bw) out.derived.push({ key: 'imtp.netpf', label: 'Fuerza pico neta', value: B.pf.value - bw, unit: 'N', eq: `F pico − peso corporal (${fx(bw, 0)} N${B.bw ? '' : ', estimado de la masa'})` }); }
      if (test.id === 'sprint10' && B.t10) out.derived.push({ key: 'sprint10.v', label: 'Velocidad media 0–10 m', value: 10 / B.t10.value, unit: 'm/s', eq: '10 / t' });
      if (test.id === 'sprint30' && B.t30) { out.derived.push({ key: 'sprint30.v', label: 'Velocidad media 0–30 m', value: 30 / B.t30.value, unit: 'm/s', eq: '30 / t30' }); if (B.t10) { const bestTrial = trials.slice().sort((a, b) => num(a.values.t30) - num(b.values.t30))[0]; if (bestTrial && num(bestTrial.values.t10) !== null) out.derived.push({ key: 'sprint30.v1030', label: 'Velocidad 10–30 m (mejor intento)', value: 20 / (num(bestTrial.values.t30) - num(bestTrial.values.t10)), unit: 'm/s', eq: '20 / (t30 − t10)' }); } }
      if (test.id === 'djprofile') { const best = trials.slice().sort((a, b) => (num(b.values.rsi) || 0) - (num(a.values.rsi) || 0))[0]; if (best && num(best.values.rsi) !== null) out.derived.push({ key: 'djprofile.opt', label: 'Altura de caída con mayor RSI', value: num(best.values.box), unit: 'cm', eq: `RSI máx = ${fx(best.values.rsi, 2)} m/s` }); }
      if (test.id === 'ybal') { const R = sideStats.R?.ant, L = sideStats.L?.ant; if (R && L) out.derived.push({ key: 'ybal.antdiff', label: 'Diferencia alcance anterior |D − I|', value: Math.abs(R.value - L.value), unit: 'cm', eq: '|D − I| (descriptiva; ver referencia poblacional)' }); if (!num(cfg.llR) || !num(cfg.llL)) out.notes.push('Sin longitud de miembro: no se calcula el compuesto normalizado.'); }
      if (['hop', 'triplehop', 'crosshop'].includes(test.id)) { const a = DB.get('athletes', ts.athleteId); ['R', 'L'].forEach(s => { const ll = num(s === 'R' ? a?.legLengthR : a?.legLengthL); const d = sideStats[s]?.d; if (ll && d) out.derived.push({ key: test.id + '.dLL.' + s, label: `Distancia relativa a LMI (${sideShort(s)})`, value: d.value / ll * 100, unit: '%LMI', eq: 'distancia / longitud del miembro × 100', side: s }); }); }
      if (test.id === 'hiprom') ['R', 'L'].forEach(s => { const ri = sideStats[s]?.ri, re = sideStats[s]?.re; if (ri && re) out.derived.push({ key: 'hiprom.arc.' + s, label: `Arco rotacional (${sideShort(s)})`, value: ri.value + re.value, unit: '°', eq: 'RI + RE', side: s }); });
      if (test.id === 'hiprom') { const aR = out.derived.find(d => d.key === 'hiprom.arc.R'), aL = out.derived.find(d => d.key === 'hiprom.arc.L'); if (aR && aL) pair('arc', 'Arco rotacional', '°', aR.value, aL.value); }
    }
    else if (test.mode === 'inbody') Engine.inbody(ts, out, pair);
    else if (test.mode === 'fatigue') Engine.fatigue(ts, out, pair, test);
    else if (test.mode === 'repeated') Engine.repeated(ts, out, mass);
    else if (test.mode === 'encoder') Engine.encoder(ts, out, mass);
    else if (test.mode === 'aero') Engine.aero(ts, out);
    out.statements = Engine.statements(test, out);
    return out;
  },
  inbody(ts, out, pair) {
    const d = ts.moduleData || {};
    INBODY_FIELDS.forEach(f => { if (num(d[f.k]) !== null) out.metrics.push({ key: 'inbody.' + f.k, base: 'inbody.' + f.k, fk: f.k, label: f.label, unit: f.unit, side: f.side || 'B', value: num(d[f.k]), primary: !!f.key }); });
    pair('leanArm', 'Masa magra brazo', 'kg', d.leanArmR, d.leanArmL, true, null, null, false);
    pair('leanLeg', 'Masa magra pierna', 'kg', d.leanLegR, d.leanLegL, true, null, null, true);
    pair('fatArm', 'Grasa segmentaria brazo', 'kg', d.fatArmR, d.fatArmL, false);
    pair('fatLeg', 'Grasa segmentaria pierna', 'kg', d.fatLegR, d.fatLegL, false);
    pair('circThigh', 'Circunferencia muslo', 'cm', d.circThighR, d.circThighL);
    pair('circArm', 'Circunferencia brazo', 'cm', d.circArmR, d.circArmL);
    out.pairs.forEach(p => p.note = 'Diferencia segmentaria descriptiva: no indica patología por sí misma.');
    if (num(d.weight) && num(d.heightCm) && num(d.bmi) === null) out.derived.push({ key: 'inbody.bmi', label: 'IMC calculado', value: Calc.bmi(d.weight, d.heightCm), unit: 'kg/m²', eq: 'masa / talla²' });
  },
  fatigue(ts, out, pair, test) {
    const d = ts.moduleData || {}; const unit = d.unit || 'N';
    const res = {};
    ['R', 'L'].forEach(s => {
      const a = Calc.clean((d['series' + s] || '').split(/[\s;,]+/)); const reps = num(d['reps' + s]) ?? (a.length || null);
      if (!a.length && reps === null) return;
      const lr = a.length >= 2 ? Calc.linreg(a.map((_, i) => i + 1), a) : null;
      const r = { initial: a[0] ?? null, final: a.length ? a[a.length - 1] : null, mean: Calc.mean(a), best: Calc.best(a), slope: lr ? lr.slope : null, decr: Calc.lossPct(a, 'first'), sdec: Calc.sdec(a), fi: Calc.fatigueIndex(a), reps, time: num(d['time' + s]), n: a.length, series: a };
      res[s] = r;
      const add = (k, l, u, v, eq) => { if (v !== null && v !== undefined) out.metrics.push({ key: `${test.id}.${k}.${s}`, base: `${test.id}.${k}`, fk: k, label: l, unit: u, side: s, value: v, eq, primary: k === (test.id === 'slcr' ? 'reps' : 'decr') }); };
      add('reps', 'Repeticiones', 'rep', reps); add('initial', 'Valor inicial', unit, r.initial); add('final', 'Valor final', unit, r.final); add('mean', 'Promedio', unit, r.mean); add('slope', 'Pendiente', unit + '/rep', r.slope, 'Regresión lineal valor ~ repetición'); add('decr', 'Decremento (inicial→final)', '%', r.decr, '(inicial − final) / inicial × 100'); add('sdec', 'Sdec', '%', r.sdec, '(1 − Σ / (mejor × n)) × 100'); add('time', 'Duración', 's', r.time);
    });
    out.series = { R: res.R?.series || [], L: res.L?.series || [], unit };
    if (res.R || res.L) { pair('reps', 'Repeticiones', 'rep', res.R?.reps, res.L?.reps, true, null, null, test.id === 'slcr'); pair('initial', 'Valor inicial', unit, res.R?.initial, res.L?.initial); pair('mean', 'Promedio', unit, res.R?.mean, res.L?.mean); pair('decr', 'Decremento', '%', res.R?.decr, res.L?.decr, false, null, null, test.id !== 'slcr'); }
  },
  repeated(ts, out, mass) {
    const d = ts.moduleData || {}; const tf = Calc.clean((d.flights || '').split(/[\s;,]+/)), tc = Calc.clean((d.contacts || '').split(/[\s;,]+/));
    const n = tf.length || num(d.n); const Tf = tf.length ? tf.reduce((a, b) => a + b, 0) : num(d.totalFlight); const Tt = num(d.dur) ?? (tf.length && tc.length ? Tf + tc.reduce((a, b) => a + b, 0) : null);
    const add = (k, l, u, v, eq, primary) => { if (v !== null && v !== undefined && !Number.isNaN(v)) out.metrics.push({ key: 'rj.' + k, base: 'rj.' + k, fk: k, label: l, unit: u, side: 'B', value: v, eq, primary }); };
    add('n', 'Número de saltos', 'n', n); add('Tf', 'Tiempo total de vuelo', 's', Tf); add('Tt', 'Tiempo total de prueba', 's', Tt);
    const P = Calc.boscoPower(Tf, Tt, n); add('power', 'Potencia media (Bosco)', 'W/kg', P, 'g²·Tf·Tt / (4·n·(Tt − Tf))', true); if (P && mass) add('powerAbs', 'Potencia media absoluta', 'W', P * mass, 'W/kg × masa');
    if (tf.length) { const h = tf.map(Calc.heightFromFlight); out.series = { h, rsi: tc.length === tf.length ? h.map((x, i) => Calc.rsi(x, tc[i])) : [] }; add('hmean', 'Altura media', 'cm', Calc.mean(h), 'h = g·tv²/8'); add('hbest', 'Altura máxima', 'cm', Calc.best(h)); add('fi', 'Índice de fatiga (altura)', '%', Calc.fatigueIndex(h), '(media primeros 3 − media últimos 3) / media primeros 3 × 100'); if (out.series.rsi.length) { add('rsimean', 'RSI medio', 'm/s', Calc.mean(out.series.rsi)); add('tcmean', 'Tiempo de contacto medio', 's', Calc.mean(tc)); } }
  },
  encoder(ts, out, mass) {
    const d = ts.moduleData || {}; const sets = d.sets || [];
    const reps = sets.flatMap((s, si) => (s.reps || []).map((r, ri) => Object.assign({ set: si + 1, rep: ri + 1, load: num(s.load) }, r)));
    const valid = reps.filter(r => num(r.mv) !== null && r.load !== null);
    const perLoad = {}; valid.forEach(r => { const k = r.load; if (!perLoad[k] || num(r.mv) > num(perLoad[k].mv)) perLoad[k] = r; });
    const bestReps = Object.values(perLoad).sort((a, b) => a.load - b.load);
    const lv = Calc.linreg(bestReps.map(r => r.load), bestReps.map(r => num(r.mv)));
    const lpPts = bestReps.filter(r => num(r.mp) !== null);
    const lp = Calc.quadfit(lpPts.map(r => r.load), lpPts.map(r => num(r.mp)));
    out.encoder = { exercise: d.exercise || '', side: d.side || 'B', reps, bestReps, lv, lp };
    const add = (k, l, u, v, eq, primary) => { if (v !== null && v !== undefined && Number.isFinite(v)) out.metrics.push({ key: `encoder.${(d.exercise || 'ej').toLowerCase().replace(/\W+/g, '')}.${k}`, base: 'encoder.' + k, fk: k, label: l, unit: u, side: d.side || 'B', value: v, eq, primary }); };
    if (lv) { add('slope', 'Pendiente carga–velocidad', 'm·s⁻¹·kg⁻¹', lv.slope, 'VM = a + b·carga'); add('intercept', 'Intercepto (V0 extrapolada)', 'm/s', lv.intercept); add('r2', 'R² carga–velocidad', '', lv.r2); if (lv.slope < 0) add('L0', 'Carga extrapolada a V = 0', 'kg', -lv.intercept / lv.slope, 'L0 = −a / b (extrapolación; interpretar con cautela)'); }
    const ppMax = Math.max(...valid.map(r => num(r.pp) ?? -Infinity)); if (Number.isFinite(ppMax)) { add('ppmax', 'Potencia pico máxima', 'W', ppMax, '', true); if (mass) add('ppmax_kg', 'Potencia pico máxima relativa', 'W/kg', ppMax / mass); }
    const mpMax = Math.max(...valid.map(r => num(r.mp) ?? -Infinity)); if (Number.isFinite(mpMax)) add('mpmax', 'Potencia media máxima', 'W', mpMax);
    if (lp && lp.c < 0) { const xopt = -lp.b / (2 * lp.c); add('lopt', 'Carga de potencia media máxima (ajuste)', 'kg', xopt, 'Vértice del ajuste cuadrático'); }
    out.encoder.setLoss = sets.map((s, si) => { const mv = (s.reps || []).map(r => num(r.mv)).filter(v => v !== null); const pw = (s.reps || []).map(r => num(r.mp)).filter(v => v !== null); return { set: si + 1, load: num(s.load), n: mv.length, vloss: mv.length >= 2 ? (Math.max(...mv) - mv[mv.length - 1]) / Math.max(...mv) * 100 : null, ploss: pw.length >= 2 ? (Math.max(...pw) - pw[pw.length - 1]) / Math.max(...pw) * 100 : null }; });
    const vl = out.encoder.setLoss.map(s => s.vloss).filter(v => v !== null); if (vl.length) add('vlossMax', 'Pérdida de velocidad máxima en una serie', '%', Math.max(...vl), '(VM mejor − VM última) / VM mejor × 100');
  },
  aero(ts, out) {
    const d = ts.moduleData || {}; const a = DB.get('athletes', ts.athleteId);
    const add = (k, l, u, v, eq, primary, estimated) => { if (v !== null && v !== undefined && Number.isFinite(v)) out.metrics.push({ key: 'aero.' + k, base: 'aero.' + k, fk: k, label: l, unit: u, side: 'B', value: v, eq, primary, estimated }); };
    ['hrRest', 'hrPeak', 'hr1', 'hr2', 'duration', 'distance', 'finalSpeed'].forEach(k => { const f = AERO_FIELDS.find(x => x.k === k); add(k, f.label, f.unit, num(d[k])); });
    if (num(d.hrPeak) && num(d.hr1)) add('hrr1', 'Recuperación de FC 1 min', 'lpm', num(d.hrPeak) - num(d.hr1), 'FC pico − FC 1 min');
    if (num(d.hrPeak) && num(d.hr2)) add('hrr2', 'Recuperación de FC 2 min', 'lpm', num(d.hrPeak) - num(d.hr2), 'FC pico − FC 2 min');
    const age = num(a?.age) ?? Calc.ageFrom(a?.birthDate); const hm = Calc.hrMaxTanaka(age);
    if (hm && num(d.hrPeak)) add('pctHRmax', 'FC pico / FCmáx estimada (Tanaka)', '%', num(d.hrPeak) / hm * 100, `FCmáx estimada = 208 − 0.7 × ${age} = ${fx(hm, 0)} lpm`, false, true);
    const v = Calc.vo2Estimate(d.protocol, d); if (v) add('vo2', 'VO₂max ESTIMADO', 'ml·kg⁻¹·min⁻¹', v.value, v.eq + ' — ESTIMADO (sin análisis de gases)', true, true);
    else if (d.protocol) out.notes.push('El protocolo seleccionado no tiene ecuación de estimación incorporada: no se calcula VO₂max.');
  },
  /* tres niveles de lectura */
  statements(test, out) {
    const st = [];
    const keyPairs = out.pairs.filter(p => p.key || out.pairs.length <= 2);
    keyPairs.forEach(p => {
      if (p.R === null || p.L === null) return;
      const l1 = `${test.short} — ${p.label}: D ${fx(p.R, 2)} ${p.unit} / I ${fx(p.L, 2)} ${p.unit}${p.asym !== null ? ` (diferencia ${fx(p.asym, 1)} %)` : ''}.`;
      let l2;
      if (p.asym === null) l2 = 'No es posible calcular la diferencia entre extremidades con los datos disponibles.';
      else if (p.cvMean !== null) l2 = p.exceedsCV ? `Se observa diferencia entre extremidades en esta prueba, mayor que la variabilidad entre intentos de la sesión (CV medio ${fx(p.cvMean, 1)} %). Mejor desempeño: ${sideName(p.better).toLowerCase()}.` : `La diferencia entre extremidades no supera la variabilidad entre intentos de la sesión (CV medio ${fx(p.cvMean, 1)} %).`;
      else l2 = `Se registra una diferencia descriptiva entre extremidades${p.better ? ` (mejor desempeño: ${sideName(p.better).toLowerCase()})` : ''}; no hay estimación de variabilidad intra-sesión para contrastarla.`;
      const l3 = (p.note ? p.note + ' ' : '') + 'Debe interpretarse junto con fuerza específica, síntomas, antecedentes y desempeño en otras tareas; no implica por sí misma lesión, causa ni criterio de aptitud.';
      st.push({ l1, l2, l3, pair: p });
    });
    if (!st.length) {
      const prim = out.metrics.filter(m => m.primary && m.side === 'B');
      prim.forEach(m => st.push({ l1: `${test.short} — ${m.label}: ${fx(m.value, 2)} ${m.unit}${m.estimated ? ' (ESTIMADO)' : ''}.`, l2: 'Valor absoluto de la sesión. ' + (refsFor(m.base).some(r => r.type === 'cutoff') ? '' : 'Sin punto de corte universal validado incorporado para esta prueba y población.'), l3: 'Interpretar con el historial del deportista, la fiabilidad de la prueba y el contexto de entrenamiento.' }));
    }
    return st;
  },
  save(ts) { const r = Engine.compute(ts); if (!r) return null; const prev = Ctx.result(ts.id); if (prev) r.id = prev.id; return DB.put('results', r); },
  /* DSI a nivel de evaluación */
  dsi(evId) {
    const c = Ctx.ts(evId, 'cmj'), i = Ctx.ts(evId, 'imtp'); if (!c || !i) return { ok: false, why: 'Requiere CMJ e IMTP en la misma evaluación.' };
    const rc = Ctx.result(c.id), ri = Ctx.result(i.id); const pc = rc?.metrics.find(m => m.fk === 'pf' && m.side === 'B'), pi = ri?.metrics.find(m => m.fk === 'pf' && m.side === 'B');
    if (!pc || !pi) return { ok: false, why: 'Falta la fuerza pico de CMJ y/o IMTP.' };
    if (c.sessionId !== i.sessionId) return { ok: true, value: Calc.dsi(pc.value, pi.value), warn: 'CMJ e IMTP se registraron en sesiones distintas: comparabilidad reducida.', eq: `DSI = PF CMJ (${fx(pc.value, 0)} N) / PF IMTP (${fx(pi.value, 0)} N); ambos valores brutos, mejor intento.` };
    return { ok: true, value: Calc.dsi(pc.value, pi.value), eq: `DSI = PF CMJ (${fx(pc.value, 0)} N) / PF IMTP (${fx(pi.value, 0)} N); ambos valores brutos, mejor intento, misma sesión.` };
  },
  evalSummary(evId) {
    const tss = Ctx.testSessions(evId); const results = tss.map(t => ({ ts: t, test: T(t.testId), r: Ctx.result(t.id) })).filter(x => x.test);
    return { tss, results, done: tss.filter(t => t.status === 'completed').length, nc: tss.filter(t => t.status === 'not_completed').length, total: tss.length };
  }
};

/* ---------- Check-in: alertas (sin diagnóstico) ---------- */
function checkinAlerts(c) {
  const a = []; if (!c) return a;
  if (num(c.sleep) !== null && num(c.sleep) < 6) a.push(['warn', `Sueño de ${c.sleep} h (< 6 h): puede reducir el rendimiento en pruebas máximas.`]);
  if (c.train24 === 'alta') a.push(['warn', 'Entrenamiento de alta intensidad en las últimas 24 h: fatiga residual posible.']);
  if (c.train48 === 'alta') a.push(['info', 'Entrenamiento de alta intensidad en las últimas 48 h.']);
  if (num(c.doms) !== null && num(c.doms) >= 4) a.push(['warn', `Dolor muscular de aparición tardía ${c.doms}/10.`]);
  if (num(c.fatigue) !== null && num(c.fatigue) >= 7) a.push(['warn', `Fatiga percibida ${c.fatigue}/10.`]);
  if (num(c.pain) !== null && num(c.pain) >= 3) a.push(['bad', `Dolor actual ${c.pain}/10: valorar si procede continuar; registrar localización.`]);
  if (c.newInjury === 'si') a.push(['bad', 'Lesión o molestia nueva reportada: requiere valoración profesional antes de pruebas máximas.']);
  if (c.medication === 'si') a.push(['info', 'Medicación reportada: registrar y valorar posible efecto sobre la evaluación.']);
  if (c.caffeine === 'si') a.push(['info', 'Consumo de cafeína previo: mantener la misma condición en reevaluaciones.']);
  if (c.meal === '<1h') a.push(['info', 'Comida < 1 h antes: puede afectar confort y composición corporal (BIA).']);
  if (c.meal === '>4h') a.push(['info', 'Más de 4 h sin comer.']);
  if (c.hydration === 'baja') a.push(['warn', 'Hidratación percibida baja: afecta la bioimpedancia y el rendimiento.']);
  if (num(c.rpe) !== null && num(c.rpe) >= 5) a.push(['info', `RPE/estado de esfuerzo previo ${c.rpe}/10.`]);
  if (c.general === 'malo') a.push(['warn', 'Estado general percibido como malo.']);
  return a;
}

/* ---------- fases ---------- */
const PHASES = [
  { id: 'athlete', label: 'Deportista', view: 'athletes' },
  { id: 'consent', label: 'Consentimiento', view: 'consent' },
  { id: 'anamnesis', label: 'Anamnesis', view: 'anamnesis' },
  { id: 'questionnaires', label: 'Cuestionarios', view: 'questionnaires' },
  { id: 'battery', label: 'Batería', view: 'library' },
  { id: 'schedule', label: 'Programación', view: 'schedule' },
  { id: 'checkin', label: 'Pretest', view: 'checkin' },
  { id: 'warmup', label: 'Calentamiento', view: 'checkin' },
  { id: 'capture', label: 'Toma', view: 'capture' },
  { id: 'integration', label: 'Integración', view: 'integration' },
  { id: 'report', label: 'Informe', view: 'report' },
  { id: 'evolution', label: 'Evolución', view: 'evolution' }
];
function phaseStatus() {
  const a = Ctx.athlete(), e = Ctx.evaluation(); const st = {};
  st.athlete = a ? 'done' : 'todo';
  if (!e) { PHASES.slice(1).forEach(p => st[p.id] = 'todo'); return st; }
  const c = Ctx.consent(e.id); st.consent = c && c.checks?.participate && c.athleteSig && c.evaluatorSig ? 'done' : 'todo';
  st.anamnesis = e.anamnesisReviewed ? 'done' : 'todo';
  const qs = e.questionnaires || []; const qd = Ctx.questionnaires(e.id);
  st.questionnaires = qs.length && qs.every(id => qd.some(q => q.instrument === id && q.scores)) ? 'done' : (qs.length === 0 && e.questionnairesSkipped ? 'done' : 'todo');
  st.battery = (e.battery || []).length ? 'done' : 'todo';
  const ss = Ctx.sessions(e.id); st.schedule = ss.length && ss.some(s => (s.testIds || []).length) ? 'done' : 'todo';
  const cur = ss.find(s => s.status !== 'closed') || ss[ss.length - 1];
  st.checkin = ss.length && ss.every(s => s.checkinDone || !(s.testIds || []).length) ? 'done' : (cur && cur.checkinDone ? 'partial' : 'todo');
  st.warmup = ss.length && ss.every(s => s.warmupDone || !(s.testIds || []).length) ? 'done' : (cur && cur.warmupDone ? 'partial' : 'todo');
  const sum = Engine.evalSummary(e.id); st.capture = sum.total && sum.done + sum.nc === sum.total ? 'done' : (sum.done ? 'partial' : 'todo');
  st.integration = e.integrationReviewed ? 'done' : 'todo';
  const rep = DB.where('reports', r => r.evaluationId === e.id)[0]; st.report = rep && rep.issuedAt ? 'done' : 'todo';
  st.evolution = DB.where('evaluations', x => x.athleteId === a.id).length > 1 ? 'done' : 'todo';
  return st;
}

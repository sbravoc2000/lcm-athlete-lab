/* ==========================================================
   TOMA GUIADA: lista de sesión y ejecución paso a paso
   ========================================================== */
Views.capture = (el, sidParam) => {
  if (!guard(el)) return;
  const e = Ctx.evaluation(); const ss = Ctx.sessions(e.id).filter(s => (s.testIds || []).length);
  if (!ss.length) { el.innerHTML = pageHead('Toma guiada', '') + `<div class="empty">No hay sesiones programadas.<br><br><button class="btn" onclick="App.go('schedule')">Ir a programación</button></div>`; return; }
  Sched.syncTS();
  const sid = sidParam && DB.get('sessions', sidParam) ? sidParam : (ss.find(s => (s.testIds || []).some(id => { const t = Ctx.ts(e.id, id); return t && !['completed', 'not_completed'].includes(t.status); })) || ss[0]).id;
  const s = DB.get('sessions', sid); const items = s.testIds.map(id => Ctx.ts(e.id, id)).filter(Boolean);
  const done = items.filter(t => ['completed', 'not_completed'].includes(t.status)).length;
  const next = items.find(t => !['completed', 'not_completed'].includes(t.status));
  el.innerHTML = pageHead('Toma guiada', 'El sistema conduce cada prueba: preparación → activación → familiarización → intentos → descansos → validación → resultado → interpretación.', ss.map(x => `<button class="btn ${x.id === sid ? '' : 'sec'} sm" onclick="App.go('capture','${x.id}')">Sesión ${x.n}</button>`).join('')) + `
  ${!s.checkinDone || !s.warmupDone ? `<div class="note warn">Esta sesión no tiene ${!s.checkinDone ? 'check-in pretest' : 'calentamiento'} registrado. <button class="btn sm warn" onclick="App.go('checkin','${s.id}')">Completar pretest</button></div>` : ''}
  ${(s.alerts || []).length ? `<div class="note warn small"><b>Alertas del check-in:</b> ${s.alerts.map(a => esc(a[1])).join(' · ')}</div>` : ''}
  <div class="card"><div class="row between"><div><h2 style="margin:0">Sesión ${s.n} ${s.date ? '· ' + fmtDate(s.date) : ''}</h2><div class="small muted">${done} de ${items.length} pruebas finalizadas</div></div>${next ? `<button class="btn lg" onclick="Runner.open('${next.id}')">${ICON.play} ${next.status === 'in_progress' ? 'Continuar' : 'Iniciar'}: ${esc(T(next.testId).short)}</button>` : '<span class="pill ok">Sesión completa</span>'}</div><div class="bar" style="margin-top:10px"><i style="width:${items.length ? done / items.length * 100 : 0}%"></i></div></div>
  <div class="list" style="margin-top:12px">${items.map((t, i) => { const test = T(t.testId); const pr = Runner.progress(t); return `<div class="item"><div style="display:flex;gap:12px;align-items:center;min-width:0"><div class="ring" style="--p:${t.status === 'completed' ? 100 : pr};width:46px;height:46px"><span style="width:36px;height:36px;font-size:11px">${t.status === 'completed' ? '✓' : t.status === 'not_completed' ? '✕' : pr + '%'}</span></div><div style="min-width:0"><b>${i + 1}. ${esc(test.name)}</b><div class="meta">${statusLabel(t.status)} · ≈ ${test.time} min · ${esc(test.equipment[0])}${t.status === 'not_completed' ? ' · Motivo: ' + esc(t.ncReason || '') : ''}</div></div></div><div class="row"><button class="btn sm sec" onclick="Lib.ficha('${test.id}')">Ficha</button><button class="btn sm ${t.status === 'completed' ? 'sec' : ''}" onclick="Runner.open('${t.id}')">${t.status === 'completed' ? 'Revisar' : t.status === 'in_progress' ? 'Continuar' : 'Abrir'}</button></div></div>`; }).join('')}</div>
  ${!next ? vitalsCard(s, 'post') + sessionCloseCard(s) + `<div class="runfoot"><span></span>${nextBtn()}</div>` : `<div class="row" style="margin-top:12px"><button class="btn sm sec" onclick="PdfReports.session(DB.get('sessions','${s.id}'))">${ICON.doc} PDF parcial de la sesión</button><button class="btn sm sec" onclick="App.go('checkin','${s.id}')">Signos vitales</button></div>`}`;
  if (!next) { bindVitals(el, s, () => App.refresh()); bindSessionClose(el, s); }
};
Views.runner = (el, tsId) => {
  const ts = DB.get('testSessions', tsId); if (!ts) { App.go('capture'); return; }
  Runner.render(el, ts);
};
const Runner = {
  open(id) { App.go('runner', id); },
  steps(test) {
    const s = [{ id: 'prep', label: 'Preparación' }];
    if (test.mode !== 'inbody') s.push({ id: 'act', label: 'Activación' }, { id: 'fam', label: 'Familiarización' });
    if (test.mode === 'standard' || test.mode === 'gait') { for (let i = 1; i <= test.nTrials; i++) { s.push({ id: 't' + i, label: 'Intento ' + i, attempt: i }); if (i < test.nTrials && test.rest) s.push({ id: 'r' + i, label: 'Descanso', rest: true }); } s.push({ id: 'val', label: 'Validación' }); }
    else s.push({ id: 'mod', label: { inbody: 'Registro InBody', fatigue: 'Registro de la serie', repeated: 'Registro de saltos', encoder: 'Series y repeticiones', aero: 'Registro del test' }[test.mode] });
    s.push({ id: 'res', label: 'Resultado' }, { id: 'int', label: 'Interpretación' });
    return s;
  },
  stepDone(ts, st, test) {
    const d = ts.stepsDone || {};
    if (st.attempt) { const tr = Ctx.trials(ts.id).filter(t => t.attempt === st.attempt && ['valid', 'nc'].includes(t.status)); return Engine.sides(test).every(sd => tr.some(t => t.side === sd)); }
    return !!d[st.id];
  },
  progress(ts) { const test = T(ts.testId); const st = Runner.steps(test); return Math.round(st.filter(s => Runner.stepDone(ts, s, test)).length / st.length * 100); },
  mark(ts, id, v = true) { ts.stepsDone = ts.stepsDone || {}; ts.stepsDone[id] = v; DB.put('testSessions', ts); },
  render(el, ts) {
    const test = T(ts.testId), e = DB.get('evaluations', ts.evaluationId), a = DB.get('athletes', ts.athleteId), ses = DB.get('sessions', ts.sessionId);
    if (ts.status === 'pending') { ts.status = 'in_progress'; ts.startedAt = nowISO(); DB.put('testSessions', ts); }
    const steps = Runner.steps(test); let cur = Math.min(ts.step || 0, steps.length - 1); const st = steps[cur];
    const pr = Runner.progress(ts);
    el.innerHTML = `<div class="pagehead"><div><div class="small muted"><a href="#" onclick="App.go('capture','${ts.sessionId}');return false">← Sesión ${ses?.n ?? ''}</a> · ${esc(fullName(a))}</div><h1>${esc(test.name)}</h1><div class="sub">${esc(test.capacity)}</div></div><div class="actions"><span class="pill ${ts.status === 'completed' ? 'ok' : ts.status === 'not_completed' ? 'bad' : 'acc'}">${statusLabel(ts.status)}</span><button class="btn sm sec" onclick="Lib.ficha('${test.id}')">Ficha completa</button><button class="btn sm bad" id="rnStop">Detener / no completada</button></div></div>
    <div class="row" style="margin-bottom:10px"><div class="bar" style="flex:1"><i style="width:${pr}%"></i></div><b>${pr}%</b></div>
    <div class="runner"><div class="card flat" style="padding:10px"><ol class="steps">${steps.map((s, i) => `<li class="${Runner.stepDone(ts, s, test) ? 'done' : ''} ${i === cur ? 'cur' : ''}"><button data-go="${i}"><span class="circ"></span>${s.label}</button></li>`).join('')}<li class="${ts.status === 'completed' ? 'done' : ''}"><button disabled><span class="circ"></span><b>Completada</b></button></li></ol></div>
    <div><div class="card" id="stepBody"></div>
    <div class="runfoot"><button class="btn sec" id="rnPrev" ${cur === 0 ? 'disabled' : ''}>← Anterior</button><div class="row" id="rnNextWrap"></div></div></div></div>`;
    $$('[data-go]').forEach(b => b.onclick = () => { ts.step = +b.dataset.go; DB.put('testSessions', ts); Runner.render(el, ts); });
    const go = d => { ts.step = clamp(cur + d, 0, steps.length - 1); DB.put('testSessions', ts); Runner.render(el, ts); };
    $('#rnPrev').onclick = () => go(-1);
    $('#rnStop').onclick = () => Runner.stop(ts, test);
    const body = $('#stepBody'), nw = $('#rnNextWrap');
    const nextBtnEl = (label = 'Siguiente →', fn = () => go(1), cls = '') => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = label; b.onclick = fn; nw.appendChild(b); return b; };
    const ctxRe = () => Runner.render(el, ts);
    /* ---------- pasos ---------- */
    if (st.id === 'prep') {
      const p = ts.prep || {}; const chk = p.checks || [];
      const pf = [{ k: 'equipment', label: 'Equipo utilizado', type: 'select', opts: test.equipment, span: 4 }, { k: 'equipmentCode', label: 'N.º / código del equipo', span: 4 }, { k: 'calibration', label: 'Estado de calibración', type: 'select', opts: [['', '—'], 'Cero/calibración verificada hoy', 'Calibración vigente (no verificada hoy)', 'No verificada', 'No aplica'], span: 4, req: true }, { k: 'surface', label: 'Superficie', span: 3 }, { k: 'footwear', label: 'Calzado', span: 3 }, { k: 'temp', label: 'Temperatura', type: 'number', unit: '°C', min: -5, max: 50, span: 3 }, { k: 'hum', label: 'Humedad', type: 'number', unit: '%', min: 0, max: 100, span: 3 }, { k: 'evaluator', label: 'Evaluador', span: 6, req: true }, { k: 'notes', label: 'Observaciones de preparación', span: 6 }];
      const ci = ses?.checkin || {}; const init = Object.assign({ surface: ci.surface, footwear: ci.footwear, temp: ci.temp, hum: ci.hum, evaluator: ci.evaluator || e.evaluator }, p);
      body.innerHTML = `<h2>1 · Preparación del equipo y del deportista</h2><div class="grid"><div class="c7"><h4>Lista de verificación</h4>${test.prep.map((x, i) => `<label class="check"><input type="checkbox" data-pc="${i}" ${chk[i] ? 'checked' : ''}> ${esc(x)}</label>`).join('')}<h4 style="margin-top:12px">Material necesario</h4><div>${test.equipment.map(x => `<span class="pill">${esc(x)}</span>`).join('')}</div>
      <h4 style="margin-top:12px">Registro de condiciones</h4><div class="grid">${pf.map(f => fieldHTML(f, init[f.k], 'pp')).join('')}</div>
      ${test.config.length ? `<h4 style="margin-top:12px">Parámetros del protocolo</h4><div class="grid">${test.config.map(f => fieldHTML(f, (ts.config || {})[f.k], 'cf')).join('')}</div>` : ''}</div>
      <div class="c5 stack">${DG.panels(test.diagram).map(p => `<figure class="diagram" style="margin:0">${p.svg}<figcaption>${p.kind === 'err' ? '<b style="color:var(--bad)">Error frecuente · </b>' : ''}${esc(p.title)}</figcaption></figure>`).join('')}<div class="note neutral small"><b>Posición inicial:</b> ${esc(test.startPos)}</div></div></div>`;
      nextBtnEl('Confirmar preparación →', () => {
        const r = readFields(body, pf, 'pp'), rc = readFields(body, test.config, 'cf'); if (!r.ok || !rc.ok) { toast([...r.errs, ...rc.errs].join(' · '), 'bad'); return; }
        const checks = $$('[data-pc]', body).map(x => x.checked);
        if (!checks.every(Boolean) && !confirm('Hay elementos de la lista de verificación sin marcar. ¿Continuar igualmente? (quedará registrado)')) return;
        ts.prep = Object.assign(r.values, { checks, checklistComplete: checks.every(Boolean), at: nowISO() }); ts.config = rc.values; Runner.mark(ts, 'prep'); go(1);
      });
    }
    else if (st.id === 'act') {
      body.innerHTML = `<h2>2 · Activación específica</h2><div class="grid"><div class="c7"><div class="note neutral" style="font-size:15px">${esc(test.activation)}</div><label class="check"><input type="checkbox" id="actOk" ${ts.stepsDone?.act ? 'checked' : ''}> Activación realizada según protocolo</label></div><div class="c5"><div class="timer" id="actTimer"></div></div></div>`;
      Timer.mount($('#actTimer'), 300, 'Temporizador de activación (opcional)');
      nextBtnEl('Siguiente →', () => { Runner.mark(ts, 'act', $('#actOk').checked || confirm('¿Registrar la activación como realizada?')); go(1); });
    }
    else if (st.id === 'fam') {
      body.innerHTML = `<h2>3 · Explicación y familiarización</h2><div class="grid"><div class="c7"><h4>Instrucción verbal exacta</h4><div class="cue">${esc(test.cue)}</div><h4 style="margin-top:14px">Ejecución</h4><p>${esc(test.execution)}</p><h4>Familiarización</h4><p>${esc(test.familiarization)}</p><h4>Criterios de intento válido</h4><ul>${test.valid.map(x => `<li>${esc(x)}</li>`).join('')}</ul><label class="check"><input type="checkbox" id="famOk" ${ts.stepsDone?.fam ? 'checked' : ''}> Familiarización completada; el deportista comprende la tarea</label></div><div class="c5 stack">${DG.panels(test.diagram).slice(0, 2).map(p => `<figure class="diagram" style="margin:0">${p.svg}<figcaption>${esc(p.title)}</figcaption></figure>`).join('')}</div></div>`;
      nextBtnEl('Comenzar intentos →', () => { if (!$('#famOk').checked) { toast('Confirme la familiarización antes de registrar intentos', 'warn'); return; } Runner.mark(ts, 'fam'); go(1); });
    }
    else if (st.attempt) Runner.trialStep(body, ts, test, st, ctxRe, nextBtnEl, go);
    else if (st.rest) {
      body.innerHTML = `<h2>Descanso</h2><div class="timer" id="restTimer"></div><p class="center muted">Descanso recomendado: ${test.rest} s. Próximo: ${steps[cur + 1]?.label || ''}</p>`;
      const tm = Timer.mount($('#restTimer'), test.rest, 'Descanso entre intentos', () => { Runner.mark(ts, st.id); }); tm.start();
      nextBtnEl('Continuar →', () => { Runner.mark(ts, st.id); go(1); });
    }
    else if (st.id === 'val') Runner.validation(body, ts, test, ctxRe, nextBtnEl, go);
    else if (st.id === 'mod') { ModForms[test.mode](body, ts, test, () => { Runner.mark(ts, 'mod'); Engine.save(ts); }); nextBtnEl('Guardar y ver resultado →', () => { const ok = body._save ? body._save() : true; if (ok === false) return; Runner.mark(ts, 'mod'); Engine.save(ts); go(1); }); }
    else if (st.id === 'res') {
      const r = Engine.save(ts); Runner.mark(ts, 'res');
      body.innerHTML = `<h2>Resultado</h2>${resultHTML(test, r, ts)}`;
      nextBtnEl('Interpretación →');
    }
    else if (st.id === 'int') {
      const r = Ctx.result(ts.id) || Engine.save(ts);
      const refs = [...new Map([...test.fields.map(f => metricKey(test, f.k)), test.id + '.*', '*.asym', '*.lsi'].flatMap(k => refsFor(k)).map(x => [x.id, x])).values()];
      body.innerHTML = `<h2>Interpretación</h2>${(r.statements || []).map(stm => `<div class="levels" style="margin-bottom:10px"><div class="lvl l1"><b>1 · Resultado objetivo</b><div>${esc(stm.l1)}</div></div><div class="lvl l2"><b>2 · Interpretación</b><div>${esc(stm.l2)}</div></div><div class="lvl l3"><b>3 · Consideración profesional</b><div>${esc(stm.l3)}</div></div></div>`).join('') || '<div class="empty small">Sin métricas suficientes para generar lectura.</div>'}
      <h3 style="margin-top:14px">Referencias aplicables</h3>${refs.length ? refs.map(refCard).join('') : ''}<div class="note neutral small"><b>Interpretación de la prueba:</b> ${esc(test.interpretation)}</div>
      <label>Nota profesional del evaluador (se incluye en el informe)</label><textarea id="intNote">${esc(ts.interpretationNote || '')}</textarea>`;
      $('#intNote').oninput = debounce(ev => { ts.interpretationNote = ev.target.value; DB.put('testSessions', ts); }, 400);
      const nextTs = Runner.nextTs(ts);
      nextBtnEl(ts.status === 'completed' ? '✓ Guardada' : 'GUARDAR PRUEBA', () => Runner.finish(ts, test, false), 'ok');
      if (nextTs) nextBtnEl(`Guardar → siguiente: ${T(nextTs.testId).short}`, () => Runner.finish(ts, test, true));
    }
  },
  nextTs(ts) { const s = DB.get('sessions', ts.sessionId); if (!s) return null; const ids = s.testIds; const i = ids.indexOf(ts.testId); for (let j = i + 1; j < ids.length; j++) { const t = Ctx.ts(ts.evaluationId, ids[j]); if (t && !['completed', 'not_completed'].includes(t.status)) return t; } return null; },
  finish(ts, test, goNext) {
    const r = Engine.save(ts); const hasData = r && (r.metrics.length > 0);
    if (!hasData) { toast('No hay datos válidos registrados. Registre intentos o marque la prueba como no completada.', 'warn'); return; }
    ts.status = 'completed'; ts.finishedAt = nowISO(); Runner.mark(ts, 'int'); DB.put('testSessions', ts); toast(`${test.short}: prueba guardada`);
    const n = Runner.nextTs(ts); if (goNext && n) Runner.open(n.id); else App.go('capture', ts.sessionId);
  },
  stop(ts, test) {
    modal({
      title: 'Detener prueba / registrar como no completada', body: `<h4>Criterios para detener</h4><ul>${test.stop.map(x => `<li>${esc(x)}</li>`).join('')}</ul><label>Motivo</label><select id="ncR"><option>Dolor / síntomas</option><option>Solicitud del deportista</option><option>Fatiga excesiva</option><option>Falla del equipo</option><option>Tiempo insuficiente</option><option>Contraindicación identificada en el check-in</option><option>Otro</option></select><label>Detalle</label><textarea id="ncD"></textarea><p class="small muted">Los intentos ya registrados se conservan.</p>`,
      actions: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Registrar NO COMPLETADA', cls: 'bad', onClick: bg => { ts.status = 'not_completed'; ts.ncReason = $('#ncR', bg).value + ($('#ncD', bg).value ? ': ' + $('#ncD', bg).value : ''); ts.finishedAt = nowISO(); DB.put('testSessions', ts); if (Ctx.trials(ts.id).length) Engine.save(ts); toast('Prueba registrada como no completada', 'warn'); App.go('capture', ts.sessionId); } }]
    });
  },
  trialStep(body, ts, test, st, rerender, nextBtnEl, go) {
    const sides = Engine.sides(test); const inputs = test.fields.filter(f => !f.calc);
    const trials = Ctx.trials(ts.id).filter(t => t.attempt === st.attempt);
    body.innerHTML = `<h2>${st.label} de ${test.nTrials}</h2><div class="cue" style="font-size:15px;margin-bottom:12px">${esc(test.cue)}</div>
    <div class="sidepanel">${sides.map(sd => { const sTr = trials.filter(t => t.side === sd); const ok = sTr.find(t => ['valid', 'nc'].includes(t.status)); return `<div class="sidebox ${sd}" data-side="${sd}"><h3>${sd === 'B' ? 'Registro' : sideName(sd)} <span class="tag">${sTr.filter(t => t.status === 'repeat').length ? `· ${sTr.filter(t => t.status === 'repeat').length} repetido(s)` : ''}</span></h3>
      ${ok ? `<div class="note ${ok.status === 'valid' ? 'ok' : 'bad'} small">${ok.status === 'valid' ? '✓ Intento VÁLIDO' : '✕ NO COMPLETADO: ' + esc(ok.reason || '')}<br>${inputs.map(f => ok.values[f.k] !== null && ok.values[f.k] !== undefined ? `${esc(f.label)}: <b>${ok.values[f.k]}</b> ${esc(f.unit)}` : '').filter(Boolean).join(' · ')}${(() => { const c = trialCalc(test, ok.values, ts.config || {}); return test.fields.filter(f => f.calc && c[f.k] !== null && c[f.k] !== undefined).map(f => ` · ${esc(f.label)}: <b>${fx(c[f.k], 2)}</b>`).join('') + (c._hFromTf ? ` · altura calculada por tiempo de vuelo: <b>${fx(c.h, 1)} cm</b>` : ''); })()}</div><button class="btn sm ghost" data-redo="${ok.id}">Corregir este intento</button>` :
        `<div class="grid">${inputs.map(f => fieldHTML(Object.assign({}, f, { type: 'number', span: inputs.length === 1 ? 12 : 6 }), (ts.config || {})[f.k] && f.k === 'box' ? ts.config.box : '', 'tr' + sd)).join('')}</div>
        ${QTM.supports(test.id) ? `<div class="row" style="margin-top:8px"><button class="btn sm sec" data-qtm="${sd}">⤓ Importar QTM/AMTI (_f_1 + _f_2)</button></div>` : ''}<div class="row" style="margin-top:10px"><button class="btn ok" data-valid="${sd}">✓ VÁLIDO</button><button class="btn warn" data-repeat="${sd}">↻ REPETIR</button><button class="btn ghost" data-nc="${sd}">✕ No completado</button></div>`}
      <div class="trialchips">${sTr.map(t => `<span class="tchip ${t.status === 'valid' ? 'valid' : t.status === 'repeat' ? 'repeat' : t.status === 'nc' ? 'nc' : ''}">${t.status === 'valid' ? 'válido' : t.status === 'repeat' ? 'repetir: ' + esc(t.reason || '') : t.status === 'nc' ? 'no completado' : 'corregido'} ${inputs.slice(0, 2).map(f => t.values[f.k] ?? '').filter(x => x !== '').join('/')}</span>`).join('')}</div></div>`; }).join('')}</div>
    <p class="small muted" style="margin-top:10px">Registre ${sides.length > 1 ? 'ambos lados (alternar D/I para evitar fatiga acumulada)' : 'el intento'} y marque su validez. «Repetir» registra el intento fallido con su motivo y permite un nuevo intento con el mismo número.</p>`;
    const readSide = sd => { const flds = inputs.map(f => Object.assign({}, f, { type: 'number' })); return readFields(body, flds, 'tr' + sd); };
    const saveTrial = (sd, status, reason = null) => {
      const r = readSide(sd);
      if (status === 'valid') { if (!r.ok) { toast(r.errs.join(' · '), 'bad'); return; } if (!inputs.some(f => r.values[f.k] !== null)) { toast('Ingrese al menos una variable', 'bad'); return; } if (['sj', 'cmj', 'abk', 'cmju', 'dj', 'djprofile', 'cmjload', 'sjload'].includes(test.id) && r.values.h === null && r.values.tf === null) { toast('Ingrese altura o tiempo de vuelo', 'bad'); return; } }
      DB.put('trials', { testSessionId: ts.id, attempt: st.attempt, side: sd, status, reason, values: r.values, include: status === 'valid', at: nowISO() });
      if (status === 'valid' || status === 'nc') { const allDone = sides.every(s => Ctx.trials(ts.id).some(t => t.attempt === st.attempt && t.side === s && ['valid', 'nc'].includes(t.status))); if (allDone) { toast(`${st.label} registrado`); Engine.save(ts); go(1); return; } }
      rerender();
    };
    $$('[data-valid]', body).forEach(b => b.onclick = () => saveTrial(b.dataset.valid, 'valid'));
    $$('[data-qtm]', body).forEach(b => b.onclick = () => QTM.pickForTrial(test, ts, b.dataset.qtm, body));
    $$('[data-repeat]', body).forEach(b => b.onclick = () => { const sd = b.dataset.repeat; modal({ title: 'Motivo para repetir', body: `<select id="rpR">${REPEAT_REASONS.map(x => `<option>${x}</option>`).join('')}</select><label>Detalle (opcional)</label><input id="rpD"><div class="note neutral small" style="margin-top:10px"><b>Criterios de esta prueba:</b><ul>${test.repeat.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`, actions: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Registrar y repetir', cls: 'warn', onClick: bg => { const reason = $('#rpR', bg).value + ($('#rpD', bg).value ? ': ' + $('#rpD', bg).value : ''); saveTrial(sd, 'repeat', reason); toast('Intento marcado para repetir: ' + reason, 'warn'); } }] }); });
    $$('[data-nc]', body).forEach(b => b.onclick = () => { const reason = prompt('Motivo por el que el intento no se completó:', 'Dolor / solicitud del deportista'); if (reason === null) return; saveTrial(b.dataset.nc, 'nc', reason); });
    $$('[data-redo]', body).forEach(b => b.onclick = () => { const t = DB.get('trials', b.dataset.redo); t.status = 'superseded'; t.include = false; t.reason = 'Corregido por el evaluador'; DB.put('trials', t); rerender(); setTimeout(() => { const inp = $(`[data-side="${t.side}"] input`, body); if (inp) { Object.entries(t.values).forEach(([k, v]) => { const x = $('#tr' + t.side + '_' + k, body); if (x && v !== null) x.value = v; }); inp.focus(); } }, 0); });
    const allDone = sides.every(s => trials.some(t => ['valid', 'nc'].includes(t.status) && t.side === s));
    nextBtnEl(allDone ? 'Siguiente →' : 'Omitir (sin registrar) →', () => { if (!allDone && !confirm('Este intento no está completo. ¿Avanzar igualmente?')) return; go(1); }, allDone ? '' : 'sec');
  },
  validation(body, ts, test, rerender, nextBtnEl, go) {
    const trials = Ctx.trials(ts.id); const inputs = test.fields.filter(f => !f.calc);
    const r = Engine.compute(ts);
    body.innerHTML = `<h2>Validación de intentos</h2><p class="small muted">Revise todos los intentos. Puede cambiar el estado o excluir un intento válido del cálculo (queda registrado).</p>
    <div class="tablewrap"><table><thead><tr><th>Intento</th><th>Lado</th>${inputs.map(f => `<th class="num">${esc(f.label)}<div class="tiny">${esc(f.unit)}</div></th>`).join('')}${test.fields.filter(f => f.calc).map(f => `<th class="num">${esc(f.label)}</th>`).join('')}<th>Estado</th><th>Incluir</th><th>Motivo</th></tr></thead>
    <tbody>${trials.map(t => { const c = trialCalc(test, t.values, ts.config || {}); return `<tr class="${t.status !== 'valid' || t.include === false ? 'dim' : ''}"><td>${t.attempt}</td><td>${sideShort(t.side)}</td>${inputs.map(f => `<td class="num">${t.values[f.k] ?? '—'}${f.k === 'h' && c._hFromTf ? `<div class="tiny">${fx(c.h, 1)} (tv)</div>` : ''}</td>`).join('')}${test.fields.filter(f => f.calc).map(f => `<td class="num">${fx(c[f.k], 2)}</td>`).join('')}<td><select data-ts="${t.id}" style="padding:4px">${[['valid', 'Válido'], ['repeat', 'Repetir'], ['nc', 'No completado'], ['superseded', 'Corregido']].map(([v, l]) => `<option value="${v}" ${t.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select></td><td><input type="checkbox" data-inc="${t.id}" ${t.include !== false && t.status === 'valid' ? 'checked' : ''} ${t.status === 'valid' ? '' : 'disabled'}></td><td class="small">${esc(t.reason || '')}</td></tr>`; }).join('') || `<tr><td colspan="9" class="muted">Sin intentos registrados.</td></tr>`}</tbody></table></div>
    <div class="row" style="margin-top:10px"><button class="btn sm sec" id="addTrial">${ICON.plus} Añadir intento adicional</button></div>
    ${r.metrics.filter(m => m.primary).length ? `<h3 style="margin-top:14px">Vista previa</h3>${r.metrics.filter(m => m.primary).map(m => `<span class="pill acc">${esc(m.label)} ${m.side !== 'B' ? sideShort(m.side) : ''}: ${fx(m.value, 2)} ${esc(m.unit)} · CV ${fx(m.cv, 1)} %</span>`).join('')}` : ''}
    ${r.metrics.some(m => m.primary && num(m.cv) !== null && m.cv > 10) ? '<div class="note warn small">Hay variables con CV entre intentos > 10 %: considere un intento adicional o revise la técnica/estandarización.</div>' : ''}`;
    $$('[data-ts]', body).forEach(s => s.onchange = () => { const t = DB.get('trials', s.dataset.ts); t.status = s.value; t.include = s.value === 'valid'; DB.put('trials', t); Engine.save(ts); rerender(); });
    $$('[data-inc]', body).forEach(c => c.onchange = () => { const t = DB.get('trials', c.dataset.inc); t.include = c.checked; DB.put('trials', t); Engine.save(ts); rerender(); });
    $('#addTrial').onclick = () => { const steps = Runner.steps(test); test.nTrialsExtra = true; const max = Math.max(0, ...trials.map(t => t.attempt)); modal({ title: 'Intento adicional', body: `<p>Se registrará como intento ${max + 1}.</p><div class="sidepanel">${Engine.sides(test).map(sd => `<div class="sidebox ${sd}"><h3>${sideName(sd)}</h3><div class="grid">${inputs.map(f => fieldHTML(Object.assign({}, f, { type: 'number', span: 6 }), '', 'ex' + sd)).join('')}</div></div>`).join('')}</div>`, actions: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Guardar como válido(s)', cls: 'ok', onClick: bg => { let n = 0; for (const sd of Engine.sides(test)) { const rr = readFields(bg, inputs.map(f => Object.assign({}, f, { type: 'number' })), 'ex' + sd); if (!rr.ok) { toast(rr.errs.join(' · '), 'bad'); return false; } if (inputs.some(f => rr.values[f.k] !== null)) { DB.put('trials', { testSessionId: ts.id, attempt: max + 1, side: sd, status: 'valid', include: true, values: rr.values, at: nowISO(), extra: true }); n++; } } if (!n) { toast('Sin valores', 'warn'); return false; } Engine.save(ts); rerender(); } }] }); };
    nextBtnEl('Confirmar validación →', () => { Runner.mark(ts, 'val'); Engine.save(ts); go(1); });
  }
};
/* ---------- tabla de resultados reutilizable ---------- */
function resultHTML(test, r, ts) {
  if (!r || (!r.metrics.length && !r.derived.length)) return '<div class="empty">Sin datos válidos para calcular.</div>';
  let h = r.mass ? `<div class="small muted">Masa usada para normalizar: ${fx(r.mass.value, 1)} kg (${esc(r.mass.src)})</div>` : '<div class="note warn small">Sin masa corporal registrada: no se calculan valores relativos. Regístrela en el check-in.</div>';
  const base = r.metrics.filter(m => !m.derived);
  const showStats = base.some(m => m.n);
  h += `<div class="tablewrap"><table><thead><tr><th>Variable</th><th>Lado</th><th class="num">Resultado</th>${showStats ? '<th class="num">Mejor</th><th class="num">Media</th><th class="num">DE</th><th class="num">CV %</th><th class="num">n</th>' : ''}</tr></thead><tbody>${r.metrics.map(m => `<tr><td>${esc(m.label)}${m.estimated ? ' <span class="pill warn">ESTIMADO</span>' : ''}${m.eq ? `<div class="tiny muted">${esc(m.eq)}</div>` : ''}</td><td>${m.side === 'B' ? '—' : `<span class="pill ${m.side}">${sideShort(m.side)}</span>`}</td><td class="num"><b>${fx(m.value, Math.abs(m.value) < 10 ? 2 : 1)}</b> ${esc(m.unit)}${m.sum ? `<div class="tiny muted">${m.sum === 'mean' ? 'media' : 'mejor'}</div>` : ''}</td>${showStats ? `<td class="num">${fx(m.best, 2)}</td><td class="num">${fx(m.mean, 2)}</td><td class="num">${fx(m.sd, 2)}</td><td class="num">${fx(m.cv, 1)}</td><td class="num">${m.n ?? ''}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
  if (r.derived.length) h += `<h3 style="margin-top:12px">Variables derivadas</h3><div class="tablewrap"><table><tbody>${r.derived.map(d => `<tr><td>${esc(d.label)}<div class="tiny muted">${esc(d.eq || '')}</div></td><td class="num"><b>${fx(d.value, 2)}</b> ${esc(d.unit)}</td></tr>`).join('')}</tbody></table></div>`;
  if (r.pairs.length) h += `<h3 style="margin-top:12px">Comparación derecha / izquierda</h3><div class="tablewrap"><table><thead><tr><th>Variable</th><th class="num">D</th><th class="num">I</th><th class="num">D − I</th><th class="num">Asimetría %</th><th class="num">D/I</th><th class="num">LSI %</th><th class="num">CV medio %</th><th>Lectura</th></tr></thead><tbody>${r.pairs.map(p => `<tr><td>${esc(p.label)} <span class="tiny muted">${esc(p.unit)}</span></td><td class="num">${fx(p.R, 2)}</td><td class="num">${fx(p.L, 2)}</td><td class="num">${fx(p.diff, 2)}</td><td class="num"><b>${fx(p.asym, 1)}</b></td><td class="num">${fx(p.ratio, 3)}</td><td class="num">${fx(p.lsi, 1)}</td><td class="num">${fx(p.cvMean, 1)}</td><td class="small">${p.exceedsCV === null ? 'Descriptiva' : p.exceedsCV ? 'Supera la variabilidad entre intentos' : 'Dentro de la variabilidad entre intentos'}</td></tr>`).join('')}</tbody></table></div><p class="tiny muted">Asimetría % = |D − I| / máx(D, I) × 100 · LSI = menor / mayor × 100 (sin extremidad de referencia definida) · Para variables donde menor es mejor (tiempos) se respeta la dirección.</p>` + Chart.pairs({ rows: r.pairs.filter(p => p.R !== null && p.L !== null).slice(0, 6).map(p => ({ label: p.label, R: p.R, L: p.L })) });
  if (ts && (test.mode === 'standard' || test.mode === 'gait')) { const tr = Engine.validTrials(ts.id); const key = test.fields.find(f => f.key) || test.fields[0]; if (key && tr.length > 1) h += `<h3 style="margin-top:12px">${esc(key.label)} por intento</h3>` + Chart.line({ H: 180, yLabel: key.unit, series: Engine.sides(test).map(sd => ({ name: sideName(sd), color: Chart.C[sd], pts: tr.filter(t => t.side === sd).map(t => ({ x: t.attempt, y: num(trialCalc(test, t.values, ts.config || {})[key.k]), label: 'Int. ' + t.attempt })) })) }); }
  if (r.notes?.length) h += r.notes.map(n => `<div class="note warn small">${esc(n)}</div>`).join('');
  return h;
}

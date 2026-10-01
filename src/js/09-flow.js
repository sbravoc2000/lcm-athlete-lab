/* ==========================================================
   CUESTIONARIOS
   ========================================================== */
Views.questionnaires = el => {
  if (!guard(el)) return;
  const a = Ctx.athlete(), e = Ctx.evaluation(); const sel = e.questionnaires || [];
  const resp = Ctx.questionnaires(e.id);
  el.innerHTML = pageHead('Cuestionarios autoadministrados', 'El deportista los completa en tablet o teléfono (modo deportista) sin ver la interpretación.', `<label class="check" style="margin:0"><input type="checkbox" id="qSkip" ${e.questionnairesSkipped ? 'checked' : ''}> No aplicar cuestionarios en esta evaluación</label>`) + `
  <div class="note warn small"><b>Texto de los ítems:</b> versión de trabajo en español incorporada para la operación del laboratorio. Para uso clínico o de investigación formal, reemplácela por la versión validada en español de cada instrumento y respete las condiciones de uso de sus autores.</div>
  <div class="grid">${Object.values(QDEFS).map(q => {
    const on = sel.includes(q.id); const rs = resp.filter(r => r.instrument === q.id).sort((x, y) => String(x.completedAt).localeCompare(y.completedAt)); const last = rs[rs.length - 1];
    return `<div class="card c6 ${on ? '' : 'flat'}" style="${on ? '' : 'opacity:.75'}"><div class="cardhead"><div><h2>${esc(q.short)}</h2><div class="small muted">${esc(q.region)} · ${esc(q.range)}</div></div><label class="check" style="margin:0"><input type="checkbox" data-qsel="${q.id}" ${on ? 'checked' : ''}> Incluir</label></div>
    ${on ? (last ? qResultHTML(q, last, a) : '<div class="empty small">Pendiente de respuesta.</div>') : ''}
    ${on ? `<div class="row" style="margin-top:10px"><button class="btn" onclick="QMode.open('${q.id}')">${ICON.form} ${last ? (q.id === 'OSTRC' ? 'Añadir otro problema (modo deportista)' : 'Repetir en modo deportista') : 'Modo deportista'}</button>${last ? `<button class="btn sec" onclick="QMode.open('${q.id}','${last.id}',true)">Revisar/corregir respuestas</button><button class="btn ghost" onclick="QMode.del('${last.id}')">${ICON.trash}</button>` : ''}</div>` : ''}
    <div class="tiny muted" style="margin-top:8px">Fuente: ${srcHTML(q.src)}</div></div>`;
  }).join('')}</div>
  <div class="runfoot"><span></span>${nextBtn()}</div>`;
  $$('[data-qsel]').forEach(x => x.onchange = () => { const s = new Set(e.questionnaires || []); x.checked ? s.add(x.dataset.qsel) : s.delete(x.dataset.qsel); e.questionnaires = [...s]; DB.put('evaluations', e); App.refresh(); });
  $('#qSkip').onchange = ev => { e.questionnairesSkipped = ev.target.checked; if (ev.target.checked) e.questionnaires = []; DB.put('evaluations', e); App.refresh(); };
};
function qResultHTML(q, r, a) {
  if (!r.scores) return `<div class="note bad">${esc(r.error || 'Respuesta incompleta')}</div>`;
  const prevEvs = DB.where('evaluations', x => x.athleteId === a.id).sort(byDate);
  const hist = prevEvs.map(ev => ({ ev, r: DB.where('questionnaires', x => x.evaluationId === ev.id && x.instrument === q.id && x.scores).sort((x, y) => String(x.completedAt).localeCompare(y.completedAt)).pop() })).filter(x => x.r);
  const idx = hist.findIndex(h => h.r.id === r.id); const prev = idx > 0 ? hist[idx - 1].r : null;
  let h = `<div class="small muted">Respondido: ${new Date(r.completedAt).toLocaleString('es-PE')} · ${r.completedBy === 'deportista' ? 'autocompletado por el deportista' : 'registrado por el evaluador'}${r.extra?.side ? ' · Rodilla: ' + sideName(r.extra.side) : ''}</div>`;
  h += `<div class="tablewrap"><table><thead><tr><th>Escala</th><th class="num">Bruto</th><th class="num">Puntaje</th>${prev ? '<th class="num">Previo</th><th class="num">Cambio</th><th>Lectura del cambio</th>' : ''}</tr></thead><tbody>`;
  Object.entries(r.scores).forEach(([k, s]) => {
    const mk = q.metricKey(k); let chg = '';
    if (prev && prev.scores[k]) { const d = s.value - prev.scores[k].value; const mdc = mdcFor(mk); const mcid = refsFor(mk).find(x => x.type === 'mcid' && num(x.value) !== null); chg = `<td class="num">${fx(prev.scores[k].value, 1)}</td><td class="num">${d > 0 ? '+' : ''}${fx(d, 1)}</td><td class="small">${mdc ? (Math.abs(d) >= mdc.value ? `${refBadge('mdc')} Cambio ≥ MDC (${fx(mdc.value, 1)})` : `Cambio observado, &lt; MDC (${fx(mdc.value, 1)})`) : 'Cambio observado (sin MDC incorporado)'}${mcid ? `<br>${refBadge('mcid')} MCID ${esc(mcid.value)}: ${Math.abs(d) >= num(mcid.value) ? 'alcanzado' : 'no alcanzado'}` : ''}</td>`; }
    else if (prev) chg = '<td></td><td></td><td></td>';
    h += `<tr><td>${esc(s.label)}${s.answered !== undefined ? `<div class="tiny muted">${s.answered} ítems puntuados</div>` : ''}${s.missing ? `<div class="tiny muted">${s.missing} ítem(s) sin responder</div>` : ''}</td><td class="num">${fx(s.raw, 0)}${s.max ? '/' + s.max : ''}</td><td class="num"><b>${fx(s.value, 1)}</b> ${esc(s.unit)}</td>${chg}</tr>`;
  });
  h += '</tbody></table></div>';
  if (r.classification) h += `<div class="note neutral small">${refBadge('method')} ${esc(r.classification)}</div>`;
  if (r.warnings?.length) h += `<div class="note warn small">${r.warnings.map(esc).join('<br>')}</div>`;
  const refs = Object.keys(r.scores).flatMap(k => refsFor(q.metricKey(k))); const uniq = [...new Map(refs.map(x => [x.id, x])).values()];
  h += uniq.length ? `<details><summary class="small">Referencias de interpretación (${uniq.length})</summary>${uniq.map(refCard).join('')}</details>` : `<div class="note neutral small">${refBadge('descriptive')} ${NO_CUTOFF}</div>`;
  if (hist.length > 1) { const keys = Object.keys(r.scores); h += Chart.line({ H: 170, series: keys.map((k, i) => ({ name: r.scores[k].label, color: [Chart.C.B, Chart.C.A, Chart.C.G, Chart.C.R, Chart.C.L][i % 5], pts: hist.map((x, j) => ({ x: j, y: x.r.scores[k]?.value ?? null, label: fmtDate(x.ev.date) })) })) }); }
  return h;
}
const QMode = {
  open(qid, respId = null, evaluator = false) {
    const q = QDEFS[qid], a = Ctx.athlete(), e = Ctx.evaluation(); const prev = respId ? DB.get('questionnaires', respId) : null;
    const ans = prev ? Object.assign({}, prev.answers) : {}; const extra = prev ? Object.assign({}, prev.extra || {}) : {};
    const ov = document.createElement('div'); ov.className = 'athletemode';
    const total = q.sections.reduce((s, x) => s + x.items.length, 0);
    const render = () => {
      const answered = Object.keys(ans).length;
      ov.innerHTML = `<div class="inner"><div class="row between"><div class="brand">${LOGO}<div>LCM <b>ATHLETE LAB</b><small>${evaluator ? 'Revisión por el evaluador' : 'Modo deportista'}</small></div></div><button class="btn ghost sm" id="qmExit">Salir</button></div>
      <h1 style="margin-top:16px">${esc(q.name)}</h1><p class="muted">${esc(fullName(a))}</p><div class="note neutral">${esc(q.intro)}</div>
      <div class="bar" style="position:sticky;top:0;z-index:2"><i style="width:${answered / total * 100}%"></i></div><div class="small muted" style="margin:4px 0 8px">${answered} de ${total} respondidas</div>
      ${q.askSide ? `<div class="qitem"><div class="qt">¿Qué rodilla evalúa este cuestionario?</div><div class="opts h">${[['R', 'Derecha'], ['L', 'Izquierda'], ['B', 'Ambas / sin síntomas']].map(([v, l]) => `<label class="opt ${extra.side === v ? 'on' : ''}"><input type="radio" name="qside" value="${v}">${l}</label>`).join('')}</div></div>` : ''}
      ${q.sections.map(s => `<h2 style="margin-top:22px">${esc(s.title)}</h2>${qItems(s).map((it, i) => { const k = s.id + '_' + i; return `<div class="qitem" id="qi_${k}"><div class="qt">${i + 1}. ${esc(it.text)}</div><div class="opts ${s.layout === 'h' && it.opts.length <= 5 ? 'h' : ''}">${it.opts.map(([v, l]) => `<label class="opt ${String(ans[k]) === String(v) ? 'on' : ''}"><input type="radio" name="${k}" value="${v}">${esc(l)}</label>`).join('')}</div></div>`; }).join('')}`).join('')}
      ${(q.extra || []).map(f => `<div class="qitem"><div class="qt">${esc(f.label)}</div>${f.type === 'select' ? `<select data-ex="${f.k}">${f.opts.map(([v, l]) => `<option value="${v}" ${extra[f.k] === v ? 'selected' : ''}>${l}</option>`).join('')}</select>` : `<input data-ex="${f.k}" type="${f.type}" ${f.min !== undefined ? `min="${f.min}" max="${f.max}"` : ''} value="${esc(extra[f.k] ?? '')}">`}</div>`).join('')}
      <div class="runfoot"><span></span><button class="btn lg ok" id="qmDone">Terminar y enviar</button></div></div>`;
      $$('.opt input', ov).forEach(inp => inp.onchange = () => { if (inp.name === 'qside') extra.side = inp.value; else ans[inp.name] = inp.value === 'na' ? 'na' : num(inp.value); $$(`input[name="${inp.name}"]`, ov).forEach(x => x.parentElement.classList.toggle('on', x.checked)); const n = Object.keys(ans).length; $('.bar i', ov).style.width = (n / total * 100) + '%'; $('.bar + .small', ov).textContent = `${n} de ${total} respondidas`; $('#qi_' + inp.name, ov)?.classList.remove('missing'); });
      $$('[data-ex]', ov).forEach(x => x.onchange = () => extra[x.dataset.ex] = x.value);
      $('#qmExit', ov).onclick = async () => { if (Object.keys(ans).length && !(await confirmBox('Salir del cuestionario', 'Las respuestas no enviadas se perderán.', 'Salir sin guardar', true))) return; ov.remove(); };
      $('#qmDone', ov).onclick = () => {
        const res = q.score(ans);
        const missingKeys = q.sections.flatMap(s => s.items.map((_, i) => s.id + '_' + i)).filter(k => ans[k] === undefined);
        if (q.askSide && !extra.side) { toast('Indique qué rodilla evalúa', 'warn'); return; }
        if (!res.valid) { missingKeys.forEach(k => $('#qi_' + k, ov)?.classList.add('missing')); toast('Faltan respuestas: ' + (res.error || ''), 'warn'); const f = missingKeys[0] && $('#qi_' + missingKeys[0], ov); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
        if (missingKeys.length && !confirm(`Hay ${missingKeys.length} ítem(s) sin responder. El instrumento lo permite, pero ¿desea enviar igualmente?`)) { missingKeys.forEach(k => $('#qi_' + k, ov)?.classList.add('missing')); return; }
        const rec = prev && evaluator ? prev : { athleteId: a.id, evaluationId: e.id, instrument: q.id };
        Object.assign(rec, { answers: ans, extra, scores: res.scores, classification: res.classification || null, warnings: res.warnings || [], completedAt: rec.completedAt || nowISO(), editedAt: evaluator ? nowISO() : null, completedBy: evaluator ? (prev?.completedBy || 'evaluador') : 'deportista', date: todayStr() });
        DB.put('questionnaires', rec);
        if (evaluator) { ov.remove(); toast('Respuestas actualizadas y recalculadas'); App.refresh(); return; }
        ov.innerHTML = `<div class="inner" style="text-align:center;padding-top:14vh">${LOGO.replace('class="logo"', 'class="logo" style="width:70px;height:70px"')}<h1 style="margin-top:20px">¡Gracias!</h1><p>Sus respuestas se registraron correctamente.</p><p class="muted">Por favor, entregue el dispositivo al evaluador.</p><button class="btn lg" id="qmBack" style="margin-top:20px">Devolver al evaluador</button></div>`;
        $('#qmBack', ov).onclick = () => { ov.remove(); App.refresh(); };
      };
    };
    render(); document.body.appendChild(ov);
  },
  async del(id) { if (await confirmBox('Eliminar respuesta', '¿Eliminar esta respuesta de cuestionario?', 'Eliminar', true)) { DB.del('questionnaires', id); toast('Respuesta eliminada', 'warn'); App.refresh(); } }
};

/* ==========================================================
   BIBLIOTECA Y BATERÍA
   ========================================================== */
let LIBF = { dom: '', q: '' };
Views.library = el => {
  const e = Ctx.evaluation(); const bat = e ? (e.battery || []) : [];
  const list = TESTS.filter(t => (!LIBF.dom || t.domains.includes(LIBF.dom)) && (!LIBF.q || (t.name + t.short + t.equipment.join(' ')).toLowerCase().includes(LIBF.q.toLowerCase())));
  const dur = bat.reduce((s, id) => s + (T(id)?.time || 0), 0);
  el.innerHTML = pageHead('Biblioteca de pruebas', e ? 'Seleccione la batería de la evaluación activa. Abra la ficha para ver el protocolo completo.' : 'Consulta de fichas. Para armar una batería, seleccione deportista y evaluación.', e ? `<span class="pill acc">${bat.length} seleccionadas · ≈ ${dur} min</span><button class="btn" onclick="App.go('schedule')" ${bat.length ? '' : 'disabled'}>Programar sesiones →</button>` : '') + `
  <div class="row" style="margin-bottom:8px"><input id="libQ" placeholder="Buscar prueba o equipo…" value="${esc(LIBF.q)}" style="max-width:320px"></div>
  <div class="filters">${['', ...FILTER_DOMAINS].map(d => `<button class="chipbtn ${LIBF.dom === d ? 'on' : ''}" data-dom="${d}">${d || 'Todas'}</button>`).join('')}</div>
  ${e ? `<div class="card flat" style="margin-bottom:12px"><div class="row between"><div><b>${TEST_GROUPS[0].name}</b><div class="small muted">${TEST_GROUPS[0].desc}</div></div><button class="btn sec" onclick="Lib.addGroup('bosco')">${ICON.plus} Añadir componentes</button></div></div>` : ''}
  <div class="tgrid">${list.map(t => `<div class="tcard ${bat.includes(t.id) ? 'sel' : ''}"><div class="thumb">${DG.thumb(t.diagram)}</div><h3>${esc(t.name)}</h3><div>${t.domains.map(d => `<span class="pill">${d}</span>`).join('')}${t.bilateral ? '<span class="pill R">D</span><span class="pill L">I</span>' : ''}</div><div class="small muted">${esc(t.equipment.slice(0, 2).join(' · '))} · ≈ ${t.time} min · S${t.session}</div><div class="foot"><button class="btn sm sec" onclick="Lib.ficha('${t.id}')">Ficha completa</button>${e ? `<button class="btn sm ${bat.includes(t.id) ? 'ok' : ''}" onclick="Lib.toggle('${t.id}')">${bat.includes(t.id) ? '✓ En batería' : '＋ Añadir'}</button>` : ''}</div></div>`).join('') || '<div class="empty">Sin pruebas para el filtro.</div>'}</div>`;
  $$('[data-dom]').forEach(b => b.onclick = () => { LIBF.dom = b.dataset.dom; App.refresh(); });
  $('#libQ').oninput = debounce(ev => { LIBF.q = ev.target.value; App.refresh(); setTimeout(() => { const i = $('#libQ'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 0); }, 300);
};
const Lib = {
  toggle(id) {
    const e = Ctx.evaluation(); if (!e) return; const s = new Set(e.battery || []);
    if (s.has(id)) { const ts = Ctx.ts(e.id, id); if (ts && Ctx.trials(ts.id).length) { toast('La prueba tiene intentos registrados; elimínelos desde la toma antes de quitarla.', 'warn'); return; } s.delete(id); if (ts) DB.del('testSessions', ts.id); Ctx.sessions(e.id).forEach(ss => { if ((ss.testIds || []).includes(id)) { ss.testIds = ss.testIds.filter(x => x !== id); DB.put('sessions', ss); } }); }
    else s.add(id);
    e.battery = [...s]; DB.put('evaluations', e); App.refresh();
  },
  addGroup(gid) { const e = Ctx.evaluation(); const g = TEST_GROUPS.find(x => x.id === gid); const s = new Set(e.battery || []); g.tests.forEach(t => s.add(t)); e.battery = [...s]; DB.put('evaluations', e); toast(g.name + ' añadida'); App.refresh(); },
  fichaHTML(t, compact = false) {
    const li = a => `<ul style="margin:4px 0;padding-left:18px">${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
    const panels = DG.panels(t.diagram);
    const refs = t.refs.map(k => `<li>${srcHTML(k)}</li>`).join('');
    const mrefs = [...new Map([...t.fields.map(f => metricKey(t, f.k)), t.id + '.*'].flatMap(k => refsFor(k)).filter(r => !r.metric.startsWith('*')).map(r => [r.id, r])).values()];
    return `<div class="ficha"><div>
      <dl>
        <dt>Objetivo</dt><dd>${esc(t.objective)}</dd><dt>Capacidad evaluada</dt><dd>${esc(t.capacity)}</dd><dt>Dominios</dt><dd>${t.domains.map(d => `<span class="pill">${d}</span>`).join('')}</dd>
        <dt>Material necesario</dt><dd>${li(t.equipment)}</dd><dt>Tiempo estimado</dt><dd>≈ ${t.time} min ${t.bilateral ? '(ambos lados)' : ''}</dd>
        <dt>Preparación</dt><dd>${li(t.prep)}</dd><dt>Activación</dt><dd>${esc(t.activation)}</dd><dt>Posición inicial</dt><dd>${esc(t.startPos)}</dd><dt>Ejecución</dt><dd>${esc(t.execution)}</dd>
        <dt>Instrucción verbal exacta</dt><dd><div class="cue">${esc(t.cue)}</div></dd>
        <dt>Familiarización</dt><dd>${esc(t.familiarization)}</dd><dt>Número de intentos</dt><dd>${t.mode === 'standard' || t.mode === 'gait' ? `${t.nTrials} válidos${t.bilateral ? ' por lado' : ''}` : 'Según módulo (serie única / repeticiones)'}</dd><dt>Descanso</dt><dd>${t.rest ? t.rest + ' s entre intentos' : '—'}</dd>
        <dt>Intento válido</dt><dd>${li(t.valid)}</dd><dt>Criterios para repetir</dt><dd>${li(t.repeat)}</dd><dt>Criterios para detener</dt><dd>${li(t.stop)}</dd>
        <dt>Variables registradas</dt><dd>${esc(t.variables)}</dd><dt>Ecuaciones</dt><dd>${t.equations.map(q => `<code class="eq">${esc(q)}</code>`).join('')}</dd><dt>Unidades</dt><dd>${esc(t.units)}</dd>
        <dt>Normalización</dt><dd>${esc(t.normalization)}</dd><dt>Interpretación</dt><dd>${esc(t.interpretation)}</dd><dt>Error de medición</dt><dd>${esc(t.error)}</dd>
        <dt>MDC / MCID / valores de referencia</dt><dd>${mrefs.length ? mrefs.map(refCard).join('') : `<div class="note neutral small">${refBadge('descriptive')} ${NO_CUTOFF}</div>`}</dd>
        <dt>Referencias científicas</dt><dd><ol style="padding-left:18px;margin:0" class="small">${refs}</ol></dd>
      </dl></div>
      <div class="stack">${panels.map(p => `<figure class="diagram" style="margin:0">${p.kind === 'err' ? '' : ''}${p.svg}<figcaption>${p.kind === 'err' ? '<b style="color:var(--bad)">Error frecuente · </b>' : ''}${esc(p.title)}</figcaption></figure>`).join('')}
      ${t.errorsCommon.length ? `<div class="card flat"><h3>Errores frecuentes</h3>${li(t.errorsCommon)}</div>` : ''}
      <p class="tiny muted">Diagramas esquemáticos originales del LCM (generados por código); no representan proporciones antropométricas reales.</p></div></div>`;
  },
  ficha(id) { const t = T(id); const e = Ctx.evaluation(); modal({ title: esc(t.name), wide: true, body: Lib.fichaHTML(t), actions: [{ label: 'Cerrar', cls: 'ghost' }, ...(e ? [{ label: (e.battery || []).includes(id) ? 'Quitar de la batería' : 'Añadir a la batería', cls: 'ok', onClick: () => Lib.toggle(id) }] : [])] }); }
};

/* ==========================================================
   PROGRAMACIÓN
   ========================================================== */
const SESSION_WARMUP_MIN = 15;
Views.schedule = el => {
  if (!guard(el)) return;
  const e = Ctx.evaluation(); const bat = e.battery || [];
  if (!bat.length) { el.innerHTML = pageHead('Programación de sesiones', '') + `<div class="empty">Seleccione primero la batería.<br><br><button class="btn" onclick="App.go('library')">Ir a la biblioteca</button></div>`; return; }
  let ss = Ctx.sessions(e.id);
  const planned = new Set(ss.flatMap(s => s.testIds || [])); const unplanned = bat.filter(id => !planned.has(id));
  el.innerHTML = pageHead('Programación de sesiones', 'Orden propuesto para evitar que pruebas fatigantes contaminen las posteriores. Puede modificarlo.', `<button class="btn sec" id="autoOrg">Organizar automáticamente</button><button class="btn sec" id="addSes">${ICON.plus} Añadir sesión</button>`) +
    (unplanned.length ? `<div class="note warn">Pruebas de la batería sin programar: ${unplanned.map(id => esc(T(id).short)).join(', ')}. Use «Organizar automáticamente» o asígnelas manualmente.</div><div class="row" style="margin-bottom:10px">${unplanned.map(id => `<button class="btn sm sec" onclick="Sched.assign('${id}')">${esc(T(id).short)} → Sesión…</button>`).join('')}</div>` : '') +
    `<div class="note neutral small">Criterio: sesión 1 — composición corporal (en ayunas relativo, sin ejercicio previo), cuestionarios, movilidad, fuerza máxima, IMTP, encoder. Sesión 2 — control postural, saltos, reactividad, hops, sprint, agilidad, carrera y, al final, pruebas de fatiga y aeróbica. Separación recomendada entre sesiones: ≥ 48 h.</div>
    <div class="grid">${ss.map(s => { const dur = (s.testIds || []).reduce((a, id) => a + T(id).time, 0) + SESSION_WARMUP_MIN + (s.n === 1 && (e.questionnaires || []).length ? 10 : 0); return `<div class="card c6"><div class="cardhead"><h2>Sesión ${s.n}</h2><span class="pill acc">≈ ${dur} min</span></div>
      <div class="grid"><div class="c6"><label>Fecha</label><input type="date" data-sd="${s.id}" value="${s.date || ''}"></div><div class="c6"><label>Hora</label><input type="time" data-st="${s.id}" value="${s.time || ''}"></div></div>
      <div class="list" style="margin-top:12px"><div class="item" style="opacity:.8"><div><b>Check-in pretest + calentamiento general</b><div class="meta">${SESSION_WARMUP_MIN} min</div></div></div>
      ${s.n === 1 && (e.questionnaires || []).length ? `<div class="item" style="opacity:.8"><div><b>Cuestionarios</b><div class="meta">${(e.questionnaires || []).join(', ')} · ≈ 10 min (pueden completarse antes)</div></div></div>` : ''}
      ${(s.testIds || []).map((id, i) => { const t = T(id); const ts = Ctx.ts(e.id, id); return `<div class="item"><div><b>${i + 1}. ${esc(t.name)}</b><div class="meta">${esc(t.domains.join(' · '))} · ≈ ${t.time} min · fatiga ${'●'.repeat(t.fatigue)}${'○'.repeat(3 - t.fatigue)}${ts && ts.status !== 'pending' ? ' · ' + statusLabel(ts.status) : ''}</div></div><div class="row"><button class="btn icon sm ghost" title="Subir" onclick="Sched.move('${s.id}',${i},-1)">${ICON.up}</button><button class="btn icon sm ghost" title="Bajar" onclick="Sched.move('${s.id}',${i},1)">${ICON.down}</button><select class="sm" style="width:auto;padding:5px" onchange="Sched.toSession('${id}',this.value)" title="Mover a sesión">${ss.map(o => `<option value="${o.id}" ${o.id === s.id ? 'selected' : ''}>S${o.n}</option>`).join('')}</select></div></div>`; }).join('') || '<div class="empty small">Sin pruebas.</div>'}</div>
      ${ss.length > 1 && !(s.testIds || []).length ? `<button class="btn sm ghost" style="margin-top:8px" onclick="Sched.removeSession('${s.id}')">Eliminar sesión vacía</button>` : ''}
      ${Sched.warnings(s).map(w => `<div class="note warn small">${w}</div>`).join('')}</div>`; }).join('')}</div>
    <div class="card" style="margin-top:14px"><div class="row between"><div><b>Duración total estimada:</b> ≈ ${ss.reduce((a, s) => a + (s.testIds || []).reduce((b, id) => b + T(id).time, 0) + SESSION_WARMUP_MIN, 0) + ((e.questionnaires || []).length ? 10 : 0)} min en ${ss.length} sesión(es)</div>${nextBtn('Continuar al pretest')}</div></div>`;
  if (!ss.length) { Sched.auto(false); return; }
  $('#autoOrg').onclick = () => Sched.auto(true); $('#addSes').onclick = () => { DB.put('sessions', { athleteId: e.athleteId, evaluationId: e.id, n: ss.length + 1, testIds: [], date: '', time: '' }); App.refresh(); };
  $$('[data-sd]').forEach(i => i.onchange = () => { const s = DB.get('sessions', i.dataset.sd); s.date = i.value; DB.put('sessions', s); Sched.syncTS(); toast('Fecha guardada'); });
  $$('[data-st]').forEach(i => i.onchange = () => { const s = DB.get('sessions', i.dataset.st); s.time = i.value; DB.put('sessions', s); toast('Hora guardada'); });
};
function statusLabel(s) { return { pending: 'pendiente', in_progress: 'en curso', completed: 'completada', not_completed: 'no completada' }[s] || s; }
const Sched = {
  async auto(ask) {
    const e = Ctx.evaluation(); let ss = Ctx.sessions(e.id);
    if (ask && ss.some(s => (s.testIds || []).length) && !(await confirmBox('Reorganizar', 'Se reemplazará el orden actual por el orden propuesto.', 'Reorganizar'))) return;
    const bat = (e.battery || []).map(T).filter(Boolean).sort((a, b) => (a.session - b.session) || (a.order - b.order));
    const nS = Math.max(...bat.map(t => t.session), 1);
    for (let n = 1; n <= nS; n++) { let s = ss.find(x => x.n === n); if (!s) { s = DB.put('sessions', { athleteId: e.athleteId, evaluationId: e.id, n, testIds: [], date: n === 1 ? e.date : '', time: '' }); ss.push(s); } s.testIds = bat.filter(t => t.session === n).map(t => t.id); DB.put('sessions', s); }
    ss.filter(s => s.n > nS).forEach(s => { s.testIds = []; DB.put('sessions', s); });
    Sched.syncTS(); toast('Orden propuesto aplicado'); App.refresh();
  },
  move(sid, i, d) { const s = DB.get('sessions', sid); const a = s.testIds; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; DB.put('sessions', s); App.refresh(); },
  toSession(tid, sid) { const e = Ctx.evaluation(); Ctx.sessions(e.id).forEach(s => { if ((s.testIds || []).includes(tid) && s.id !== sid) { s.testIds = s.testIds.filter(x => x !== tid); DB.put('sessions', s); } }); const t = DB.get('sessions', sid); if (!t.testIds.includes(tid)) t.testIds.push(tid); DB.put('sessions', t); Sched.syncTS(); App.refresh(); },
  assign(tid) { const e = Ctx.evaluation(); const ss = Ctx.sessions(e.id); const s = ss.find(x => x.n === Math.min(T(tid).session, ss.length)) || ss[0]; Sched.toSession(tid, s.id); },
  removeSession(sid) { DB.del('sessions', sid); const e = Ctx.evaluation(); Ctx.sessions(e.id).forEach((s, i) => { s.n = i + 1; DB.put('sessions', s); }); App.refresh(); },
  /* crea/actualiza TestSession para cada prueba programada */
  syncTS() {
    const e = Ctx.evaluation(); Ctx.sessions(e.id).forEach(s => (s.testIds || []).forEach(tid => { let ts = Ctx.ts(e.id, tid); if (!ts) ts = { athleteId: e.athleteId, evaluationId: e.id, testId: tid, status: 'pending', step: 0, prep: {}, config: {} }; ts.sessionId = s.id; DB.put('testSessions', ts); }));
  },
  warnings(s) {
    const w = []; const ids = s.testIds || [];
    ids.forEach((id, i) => { const t = T(id); ids.slice(i + 1).forEach(id2 => { const t2 = T(id2); if (t.fatigue === 3 && t2.fatigue < 3) w.push(`«${t.short}» (fatigante) está antes de «${t2.short}»: puede contaminar el resultado.`); }); if (id === 'inbody' && i > 0) w.push('Composición corporal debería medirse al inicio, antes de cualquier ejercicio.'); });
    return [...new Set(w)].slice(0, 4);
  }
};

/* ==========================================================
   PRETEST (CHECK-IN) Y CALENTAMIENTO
   ========================================================== */
const CHECKIN_FIELDS = [
  { k: 'sleep', label: 'Horas de sueño (noche previa)', type: 'number', min: 0, max: 16, unit: 'h', span: 3, req: true },
  { k: 'train24', label: 'Entrenamiento últimas 24 h', type: 'select', opts: [['no', 'No'], ['baja', 'Sí, baja intensidad'], ['moderada', 'Sí, moderada'], ['alta', 'Sí, alta intensidad']], span: 3 },
  { k: 'train48', label: 'Entrenamiento 24–48 h', type: 'select', opts: [['no', 'No'], ['baja', 'Baja'], ['moderada', 'Moderada'], ['alta', 'Alta']], span: 3 },
  { k: 'doms', label: 'Dolor muscular (DOMS) 0–10', type: 'number', min: 0, max: 10, span: 3 },
  { k: 'fatigue', label: 'Fatiga 0–10', type: 'number', min: 0, max: 10, span: 3, req: true }, { k: 'pain', label: 'Dolor actual 0–10', type: 'number', min: 0, max: 10, span: 3, req: true }, { k: 'painSite', label: 'Localización del dolor (si existe)', span: 6 },
  { k: 'caffeine', label: 'Cafeína hoy', type: 'select', opts: [['no', 'No'], ['si', 'Sí']], span: 3 }, { k: 'caffeineDetail', label: 'Cantidad / hora', span: 3 }, { k: 'meal', label: 'Última comida', type: 'select', opts: [['1-4h', 'Hace 1–4 h'], ['<1h', 'Hace < 1 h'], ['>4h', 'Hace > 4 h']], span: 3 }, { k: 'hydration', label: 'Hidratación percibida', type: 'select', opts: [['adecuada', 'Adecuada'], ['baja', 'Baja'], ['alta', 'Alta']], span: 3 },
  { k: 'medication', label: 'Medicación (últimas 24 h)', type: 'select', opts: [['no', 'No'], ['si', 'Sí']], span: 3 }, { k: 'medicationDetail', label: 'Detalle de medicación', span: 3 }, { k: 'newInjury', label: 'Lesión o molestia nueva', type: 'select', opts: [['no', 'No'], ['si', 'Sí']], span: 3 }, { k: 'newInjuryDetail', label: 'Detalle', span: 3 },
  { k: 'rpe', label: 'RPE de la última sesión / esfuerzo percibido hoy (0–10)', type: 'number', min: 0, max: 10, span: 4 }, { k: 'general', label: 'Estado general', type: 'select', opts: [['bueno', 'Bueno'], ['regular', 'Regular'], ['malo', 'Malo']], span: 4 }, { k: 'mass', label: 'Masa corporal del día', type: 'number', min: 25, max: 250, unit: 'kg', span: 4, help: 'Se usa para normalizar (N/kg, W/kg).' },
  { k: 'temp', label: 'Temperatura ambiente', type: 'number', min: -5, max: 50, unit: '°C', span: 3 }, { k: 'hum', label: 'Humedad relativa', type: 'number', min: 0, max: 100, unit: '%', span: 3 }, { k: 'footwear', label: 'Calzado de la sesión', span: 3 }, { k: 'surface', label: 'Superficie', span: 3 },
  { k: 'evaluator', label: 'Evaluador(es) de la sesión', span: 6, req: true }, { k: 'obs', label: 'Observaciones', type: 'textarea', span: 6 }
];
const WARMUP_STEPS = ['5 min de trote suave o cicloergómetro (RPE 3–4/10).', 'Movilidad dinámica: balanceos de pierna frontal/lateral (10 c/lado), zancadas con rotación (6 c/lado), movilidad de tobillo en carga (10 c/lado).', 'Activación: puente de glúteo (10), sentadilla con peso corporal (10), elevaciones de talón (15), skipping y talones al glúteo (2 × 15 m).', 'Progresiones específicas según la primera prueba (ver «Activación» de cada ficha).'];
Views.checkin = el => {
  if (!guard(el)) return;
  const e = Ctx.evaluation(); const ss = Ctx.sessions(e.id).filter(s => (s.testIds || []).length);
  if (!ss.length) { el.innerHTML = pageHead('Pretest', '') + `<div class="empty">Programe primero las sesiones.<br><br><button class="btn" onclick="App.go('schedule')">Ir a programación</button></div>`; return; }
  let sid = App.param && DB.get('sessions', App.param) ? App.param : (ss.find(s => !s.checkinDone || !s.warmupDone) || ss[ss.length - 1]).id; const s = DB.get('sessions', sid);
  const c = s.checkin || { evaluator: e.evaluator, train24: 'no', train48: 'no', caffeine: 'no', meal: '1-4h', hydration: 'adecuada', medication: 'no', newInjury: 'no', general: 'bueno' };
  el.innerHTML = pageHead('Preparación pretest y calentamiento', 'Check-in del deportista antes de iniciar la sesión.', ss.map(x => `<button class="btn ${x.id === sid ? '' : 'sec'} sm" onclick="App.go('checkin','${x.id}')">Sesión ${x.n}${x.checkinDone ? ' ✓' : ''}</button>`).join('')) + `
  <div class="card"><div class="cardhead"><h2>Check-in · Sesión ${s.n} ${s.date ? '· ' + fmtDate(s.date) : ''}</h2>${s.checkinDone ? '<span class="pill ok">Registrado</span>' : ''}</div><div class="grid" id="ciForm">${CHECKIN_FIELDS.map(f => fieldHTML(f, c[f.k], 'ci')).join('')}</div>
  <div id="ciAlerts" style="margin-top:12px"></div>
  <div class="row" style="margin-top:12px"><button class="btn ok" id="ciSave">Registrar check-in</button></div></div>
  ${vitalsCard(s, 'pre')}
  <div class="card" style="margin-top:14px ${s.checkinDone ? '' : ';opacity:.55'}"><div class="cardhead"><h2>Calentamiento general / activación</h2>${s.warmupDone ? '<span class="pill ok">Completado</span>' : ''}</div>
  <div class="grid"><div class="c7">${WARMUP_STEPS.map((w, i) => `<label class="check"><input type="checkbox" data-wu="${i}" ${(s.warmupChecks || [])[i] ? 'checked' : ''} ${s.checkinDone ? '' : 'disabled'}> ${w}</label>`).join('')}<p class="small muted">Primera prueba de la sesión: <b>${esc(T(s.testIds[0]).name)}</b> — ${esc(T(s.testIds[0]).activation)}</p></div>
  <div class="c5"><div class="timer" id="wuTimer"></div></div></div>
  <div class="runfoot"><span></span><div class="row"><button class="btn ${s.warmupDone ? 'ok' : ''}" id="wuDone" ${s.checkinDone ? '' : 'disabled'}>${s.warmupDone ? '✓ Calentamiento completado' : 'Marcar calentamiento completado'}</button><button class="btn" onclick="App.go('capture','${s.id}')" ${s.checkinDone && s.warmupDone ? '' : 'disabled'}>${ICON.play} Iniciar pruebas de la sesión</button></div></div></div>`;
  const showAlerts = () => { const r = readFields(el, CHECKIN_FIELDS, 'ci'); const al = checkinAlerts(r.values); $('#ciAlerts').innerHTML = al.length ? `<h3>Alertas para la validez de la evaluación</h3>${al.map(([t, m]) => `<div class="note ${t}">${esc(m)}</div>`).join('')}<p class="tiny muted">Las alertas no son diagnósticos. El evaluador decide si continuar, adaptar o reprogramar.</p>` : '<div class="note ok small">Sin alertas con la información registrada.</div>'; };
  $('#ciForm').addEventListener('change', showAlerts); showAlerts();
  $('#ciSave').onclick = () => { const r = readFields(el, CHECKIN_FIELDS, 'ci'); if (!r.ok) { toast(r.errs.join(' · '), 'bad'); return; } s.checkin = Object.assign(r.values, { at: nowISO() }); s.checkinDone = true; s.alerts = checkinAlerts(r.values); DB.put('sessions', s); Ctx.testSessions(e.id).filter(t => t.sessionId === s.id).forEach(t => { if (Ctx.result(t.id)) Engine.save(t); }); toast('Check-in registrado' + (s.alerts.length ? ` con ${s.alerts.length} alerta(s)` : '')); App.refresh(); };
  $$('[data-wu]').forEach(x => x.onchange = () => { s.warmupChecks = $$('[data-wu]').map(y => y.checked); DB.put('sessions', s); });
  $('#wuDone').onclick = () => { if (!s.warmupDone && !$$('[data-wu]').every(y => y.checked) && !confirm('No todos los pasos están marcados. ¿Registrar el calentamiento como completado igualmente?')) return; s.warmupDone = !s.warmupDone; s.warmupAt = nowISO(); DB.put('sessions', s); App.refresh(); };
  Timer.mount($('#wuTimer'), 600, 'Calentamiento');
  bindVitals(el, s, () => App.refresh());
};

/* ---------- temporizador reutilizable ---------- */
const Timer = {
  mount(el, secs, label = 'Descanso', onDone = null) {
    let left = secs, run = false, iv = null; const beep = () => { try { const ac = new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain(); o.connect(g); g.connect(ac.destination); o.frequency.value = 880; g.gain.value = 0.15; o.start(); setTimeout(() => { o.stop(); ac.close(); }, 450); } catch (e) { } if (navigator.vibrate) navigator.vibrate(300); };
    const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    el.innerHTML = `<div class="small muted">${esc(label)}</div><div class="clock">${fmt(left)}</div><div class="row"><button class="btn" data-t="go">Iniciar</button><button class="btn sec" data-t="reset">Reiniciar</button><button class="btn ghost" data-t="p30">+30 s</button></div>`;
    const clock = $('.clock', el), go = $('[data-t=go]', el);
    const tick = () => { left--; clock.textContent = fmt(Math.max(0, left)); if (left <= 0) { clearInterval(iv); iv = null; run = false; clock.classList.add('done'); clock.textContent = '¡Listo!'; go.textContent = 'Iniciar'; beep(); if (onDone) onDone(); } };
    go.onclick = () => { if (run) { clearInterval(iv); run = false; go.textContent = 'Continuar'; } else { if (left <= 0) left = secs; clock.classList.remove('done'); iv = setInterval(tick, 1000); App._timer = iv; run = true; go.textContent = 'Pausa'; } };
    $('[data-t=reset]', el).onclick = () => { clearInterval(iv); run = false; left = secs; clock.textContent = fmt(left); clock.classList.remove('done'); go.textContent = 'Iniciar'; };
    $('[data-t=p30]', el).onclick = () => { left += 30; clock.textContent = fmt(left); };
    return { start: () => go.click() };
  }
};

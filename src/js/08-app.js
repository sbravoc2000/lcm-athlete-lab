/* ==========================================================
   Aplicación: estructura, navegación, contexto
   ========================================================== */
const NAV = [
  { grp: 'Inicio' }, { v: 'dashboard', l: 'Panel', i: 'home' }, { v: 'athletes', l: 'Deportistas y evaluaciones', i: 'users' },
  { grp: 'Flujo de evaluación' }, { v: 'consent', l: 'Consentimiento', i: 'sign' }, { v: 'anamnesis', l: 'Anamnesis y lesiones', i: 'clip' }, { v: 'questionnaires', l: 'Cuestionarios', i: 'form' }, { v: 'library', l: 'Biblioteca y batería', i: 'lib' }, { v: 'schedule', l: 'Programación', i: 'cal' }, { v: 'checkin', l: 'Pretest y calentamiento', i: 'check' }, { v: 'capture', l: 'Toma guiada', i: 'play' },
  { grp: 'Módulos' }, { v: 'm_comp', l: 'Composición corporal', i: 'body' }, { v: 'm_jumps', l: 'Saltos / Bosco', i: 'jump' }, { v: 'm_qtm', l: 'Saltos AMTI (QTM)', i: 'force' }, { v: 'm_encoder', l: 'Encoder carga–velocidad', i: 'enc' }, { v: 'm_strength', l: 'Fuerza D/I · RFD · DSI', i: 'force' }, { v: 'm_fatigue', l: 'Fatiga', i: 'fatigue' }, { v: 'm_biomech', l: 'Biomecánica (CSV)', i: 'gait' }, { v: 'm_cardio', l: 'Cardiorrespiratorio', i: 'heart' },
  { grp: 'Análisis' }, { v: 'integration', l: 'Integración y mapa D/I', i: 'sym' }, { v: 'evolution', l: 'Evolución longitudinal', i: 'trend' }, { v: 'report', l: 'Informe', i: 'doc' },
  { grp: 'Sistema' }, { v: 'references', l: 'Referencias', i: 'book' }, { v: 'data', l: 'Datos, respaldo y privacidad', i: 'db' }
];
const Views = {};
const App = {
  view: 'dashboard', param: null,
  _dirtyT: null,
  dirty() { clearTimeout(this._dirtyT); this._dirtyT = setTimeout(() => { App.renderPhases(); App.renderCtx(); }, 60); },
  shell() {
    document.body.innerHTML = `
    <div class="app">
      <header class="topbar">
        <button class="hamb" id="hamb" aria-label="Menú">☰</button>
        <div class="brand">${LOGO}<div>LCM <b>ATHLETE LAB</b><small>${APP.lab} · UPC</small></div></div>
        <div class="spacer"></div>
        <div class="ctx" id="ctx"></div>
      </header>
      <nav class="phasebar" id="phasebar" aria-label="Fases de la evaluación"></nav>
      <aside class="sidebar" id="sidebar"></aside>
      <main class="main" id="main" tabindex="-1"></main>
    </div>`;
    $('#sidebar').innerHTML = NAV.map(n => n.grp ? `<div class="grp">${n.grp}</div>` : `<button data-v="${n.v}">${ICON[n.i]}<span>${n.l}</span></button>`).join('') + `<div class="storage" id="storageInfo"></div>`;
    $('#sidebar').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (b) { App.go(b.dataset.v); $('#sidebar').classList.remove('open'); } });
    $('#hamb').onclick = ev => { ev.stopPropagation(); $('#sidebar').classList.toggle('open'); }; $('#main').addEventListener('click', () => $('#sidebar').classList.remove('open'));
    $('#storageInfo').innerHTML = `<b>Almacenamiento local</b><br>${DB.mode === 'indexeddb' ? 'IndexedDB de este navegador' : DB.mode === 'localstorage' ? 'localStorage de este navegador' : '<span style="color:var(--bad)">Solo memoria: los datos se perderán al cerrar</span>'}. Sin envío a servidores.<br><a href="#" id="sgoData">Respaldo JSON →</a>`;
    $('#sgoData').onclick = e => { e.preventDefault(); App.go('data'); };
    window.addEventListener('hashchange', () => { let v = ''; try { v = location.hash; } catch (e) { } v = v.replace('#/', '').split('/')[0]; if (v && v !== App.view && Views[v]) App.go(v, null, true); });
  },
  go(v, param = null, fromHash = false) {
    if (!Views[v]) v = 'dashboard';
    if (App._leave && App._leave() === false) return;
    App._leave = null; if (App._timer) { clearInterval(App._timer); App._timer = null; }
    App.view = v; App.param = param;
    if (!fromHash) { try { history.replaceState(null, '', '#/' + v); } catch (e) { /* entorno aislado (vista previa): la navegación funciona sin actualizar la URL */ } } // la URL nunca contiene datos personales
    $$('#sidebar button').forEach(b => b.classList.toggle('active', b.dataset.v === v || (v === 'runner' && b.dataset.v === 'capture')));
    const main = $('#main'); main.innerHTML = '';
    try { Views[v](main, param); } catch (err) { console.error(err); main.innerHTML = `<div class="note bad"><b>Error al mostrar la vista.</b><br>${esc(err.message)}</div>`; }
    main.focus({ preventScroll: true }); window.scrollTo(0, 0);
    App.renderPhases();
  },
  refresh() { App.go(App.view, App.param, true); },
  renderCtx() {
    const a = Ctx.athlete(), e = Ctx.evaluation(); const ath = DB.all('athletes').slice().sort((x, y) => (x.lastName || '').localeCompare(y.lastName || ''));
    const evs = a ? DB.where('evaluations', x => x.athleteId === a.id).sort(byDate) : [];
    const el = $('#ctx'); if (!el) return;
    el.innerHTML = `<select id="ctxA" aria-label="Deportista activo"><option value="">— Deportista —</option>${ath.map(x => `<option value="${x.id}" ${a && a.id === x.id ? 'selected' : ''}>${esc(fullName(x))}</option>`).join('')}</select>
      <select id="ctxE" aria-label="Evaluación activa" ${a ? '' : 'disabled'}><option value="">— Evaluación —</option>${evs.map(x => `<option value="${x.id}" ${e && e.id === x.id ? 'selected' : ''}>${fmtDate(x.date)} · ${esc(x.label || 'Evaluación')}</option>`).join('')}</select>`;
    $('#ctxA').onchange = ev => { Ctx.setAthlete(ev.target.value || null); App.refresh(); };
    $('#ctxE').onchange = ev => { Ctx.setEvaluation(ev.target.value || null); App.refresh(); };
  },
  renderPhases() {
    const st = phaseStatus(); const cur = App.currentPhase(st);
    $('#phasebar').innerHTML = `<ol>${PHASES.map((p, i) => `${i ? '<li class="sep" aria-hidden="true"></li>' : ''}<li><button class="phase ${st[p.id] === 'done' ? 'done' : ''} ${p.id === cur ? 'current' : ''} ${st[p.id] === 'partial' ? 'warn' : ''}" data-v="${p.view}" title="${p.label}: ${st[p.id] === 'done' ? 'completada' : st[p.id] === 'partial' ? 'en curso' : 'pendiente'}"><span class="dot">${st[p.id] === 'done' ? '✓' : i + 1}</span>${p.label}</button></li>`).join('')}</ol>`;
    $$('#phasebar .phase').forEach(b => b.onclick = () => App.go(b.dataset.v));
    const c = $('#phasebar .current'); if (c) c.scrollIntoView({ block: 'nearest', inline: 'center' });
  },
  currentPhase(st) { const p = PHASES.find(p => st[p.id] !== 'done' && p.id !== 'evolution'); return p ? p.id : 'evolution'; },
  nextPhaseView() { const st = phaseStatus(); const p = PHASES.find(p => st[p.id] !== 'done' && p.id !== 'evolution'); return p ? p.view : 'evolution'; }
};
function fullName(a) { return a ? `${a.firstName || ''} ${a.lastName || ''}`.trim() || '(sin nombre)' : ''; }
function pageHead(title, sub, actions = '') { return `<div class="pagehead"><div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div><div class="actions">${actions}</div></div>`; }
function needAthlete(el) { el.innerHTML = pageHead('Seleccione un deportista', '') + `<div class="empty">No hay deportista activo.<br><br><button class="btn" onclick="App.go('athletes')">${ICON.users} Ir a deportistas</button></div>`; }
function needEval(el) { el.innerHTML = pageHead('Seleccione o cree una evaluación', '') + `<div class="empty">El deportista activo no tiene una evaluación seleccionada.<br><br><button class="btn" onclick="Act.newEvaluation()">${ICON.plus} Nueva evaluación</button></div>`; }
function guard(el, needE = true) { if (!Ctx.athlete()) { needAthlete(el); return false; } if (needE && !Ctx.evaluation()) { needEval(el); return false; } return true; }
function nextBtn(label = 'Continuar a la siguiente fase') { return `<button class="btn" onclick="App.go(App.nextPhaseView())">${label} →</button>`; }

/* ==========================================================
   Acciones globales
   ========================================================== */
const Act = {
  newEvaluation() {
    const a = Ctx.athlete(); if (!a) { toast('Primero cree o seleccione un deportista', 'warn'); return; }
    const flds = [{ k: 'date', label: 'Fecha', type: 'date', req: true, span: 4 }, { k: 'label', label: 'Etiqueta', type: 'text', span: 8, ph: 'p. ej., Evaluación inicial / Reevaluación 1' }, { k: 'evaluator', label: 'Evaluador responsable', type: 'text', span: 6, req: true }, { k: 'reason', label: 'Tipo', type: 'select', opts: ['Evaluación inicial', 'Reevaluación', 'Seguimiento', 'Pretemporada', 'Otra'], span: 6 }, { k: 'objective', label: 'Objetivo de la evaluación', type: 'textarea', span: 12 }];
    const prev = DB.where('evaluations', e => e.athleteId === a.id).sort(byDate).pop();
    const init = { date: todayStr(), label: prev ? 'Reevaluación' : 'Evaluación inicial', evaluator: prev?.evaluator || DB.setting('lastEvaluator') || '', objective: prev?.objective || a.objective || '', reason: prev ? 'Reevaluación' : 'Evaluación inicial' };
    modal({
      title: 'Nueva evaluación · ' + esc(fullName(a)), body: `<div class="grid">${flds.map(f => fieldHTML(f, init[f.k], 'ne')).join('')}</div>${prev ? `<label class="check"><input type="checkbox" id="neCopy" checked> Copiar la batería y cuestionarios de la evaluación del ${fmtDate(prev.date)} (para comparar con el mismo protocolo)</label>` : ''}`,
      actions: [{ label: 'Cancelar', cls: 'ghost' }, {
        label: 'Crear evaluación', cls: 'ok', onClick: bg => {
          const r = readFields(bg, flds, 'ne'); if (!r.ok) { toast(r.errs.join(' · '), 'bad'); return false; }
          const ev = Object.assign({ athleteId: a.id, battery: [], questionnaires: ['LEFS', 'FAAM', 'KOOS', 'OSTRC'], status: 'open' }, r.values);
          if (prev && $('#neCopy', bg)?.checked) { ev.battery = [...(prev.battery || [])]; ev.questionnaires = [...(prev.questionnaires || [])]; ev.copiedFrom = prev.id; }
          DB.put('evaluations', ev); DB.setting('lastEvaluator', r.values.evaluator); Ctx.setEvaluation(ev.id); toast('Evaluación creada'); App.go('consent');
        }
      }]
    });
  },
  exportAll() { const d = DB.exportData(); download(`LCM_AthleteLab_respaldo_${todayStr()}.json`, JSON.stringify(d, null, 1)); DB.setting('lastBackup', nowISO()); toast('Respaldo exportado'); },
  printSection(title) { const prev = document.title; document.title = title; window.print(); setTimeout(() => document.title = prev, 800); }
};

/* ==========================================================
   PANEL (dashboard)
   ========================================================== */
Views.dashboard = el => {
  const a = Ctx.athlete(), e = Ctx.evaluation();
  if (!DB.all('athletes').length) {
    el.innerHTML = pageHead('Bienvenido a LCM Athlete Lab', 'Sistema guiado de evaluación deportiva y clínica del Laboratorio de Ciencias del Movimiento.') + `
    <div class="grid"><div class="card c7"><h2>Comenzar</h2><p>El sistema le conducirá paso a paso: <b>deportista → consentimiento → anamnesis → cuestionarios → batería → programación → pretest → calentamiento → toma guiada → integración → informe → evolución</b>.</p>
    <div class="row" style="margin-top:14px"><button class="btn lg" onclick="Views.athleteForm()">${ICON.plus} Crear deportista</button><button class="btn sec lg" onclick="Demo.load()">${ICON.users} Cargar caso demo Xioveng</button></div>
    <p class="small muted" style="margin-top:10px">El caso demo carga datos personales, antecedentes y lesiones referidas. <b>No genera resultados de pruebas.</b></p></div>
    <div class="card c5"><h2>Privacidad</h2><p class="small">Los datos se guardan únicamente en este navegador (${DB.mode === 'indexeddb' ? 'IndexedDB' : DB.mode}). No se envían a ningún servidor ni se incluyen en la URL. Exporte respaldos JSON periódicamente y guárdelos en un medio institucional seguro.</p><button class="btn sec" onclick="App.go('data')">${ICON.db} Datos y respaldo</button></div></div>`;
    return;
  }
  if (!a) { el.innerHTML = pageHead('Panel', 'Seleccione un deportista en la barra superior o en la lista.') + `<div class="row"><button class="btn" onclick="App.go('athletes')">${ICON.users} Deportistas</button><button class="btn sec" onclick="Views.athleteForm()">${ICON.plus} Crear deportista</button></div>`; return; }
  const evs = DB.where('evaluations', x => x.athleteId === a.id).sort(byDate);
  const inj = Ctx.injuries(a.id); const st = phaseStatus();
  const sum = e ? Engine.evalSummary(e.id) : { total: 0, done: 0, nc: 0, results: [] };
  const pend = e ? sum.tss.filter(t => t.status !== 'completed' && t.status !== 'not_completed') : [];
  const phasesDone = PHASES.filter(p => st[p.id] === 'done' && p.id !== 'evolution').length, pct = Math.round(phasesDone / (PHASES.length - 1) * 100);
  const allPairs = e ? sum.results.flatMap(x => (x.r?.pairs || []).filter(p => p.asym !== null).map(p => Object.assign({ test: x.test }, p))) : [];
  const findings = allPairs.filter(p => p.exceedsCV).sort((x, y) => y.asym - x.asym);
  const ss = e ? Ctx.sessions(e.id) : [];
  const age = num(a.age) ?? Calc.ageFrom(a.birthDate);
  el.innerHTML = pageHead(`${esc(fullName(a))}`, `${esc(a.sport || '')}${a.event ? ' · ' + esc(a.event) : ''}${age ? ' · ' + age + ' años' : ''}${e ? ` · Evaluación activa: ${fmtDate(e.date)} (${esc(e.label || '')})` : ''}`,
    `${e ? `<button class="btn" onclick="App.go(App.nextPhaseView())">${ICON.play} Continuar: ${PHASES.find(p => p.id === App.currentPhase(st))?.label}</button>` : `<button class="btn" onclick="Act.newEvaluation()">${ICON.plus} Nueva evaluación</button>`}`) + `
  <div class="grid">
    <div class="card c3"><div class="kpi"><div class="ico">${ICON.users}</div><span class="l">Atleta</span><span class="v" style="font-size:18px">${esc(a.firstName || '')}</span><span class="s">${esc(a.level || 'Nivel no registrado')} · Dominancia: ${esc(a.dominance || '—')}</span></div></div>
    <div class="card c3"><div class="row between"><div class="kpi"><div class="ico">${ICON.check}</div><span class="l">Estado de evaluación</span><span class="v">${e ? pct + '%' : '—'}</span><span class="s">${e ? phasesDone + ' de ' + (PHASES.length - 1) + ' fases' : 'Sin evaluación activa'}</span></div><div class="ring" style="--p:${pct}"><span>${pct}%</span></div></div></div>
    <div class="card c3"><div class="kpi"><div class="ico">${ICON.cal}</div><span class="l">Sesiones</span><span class="v">${ss.length}</span><span class="s">${ss.map(s => `S${s.n}: ${fmtDate(s.date)}${s.checkinDone ? ' ✓' : ''}`).join(' · ') || 'No programadas'}</span></div></div>
    <div class="card c3"><div class="kpi"><div class="ico">${ICON.play}</div><span class="l">Pruebas completadas</span><span class="v">${sum.done}<span class="muted" style="font-size:15px"> / ${sum.total}</span></span><span class="s">${sum.nc ? sum.nc + ' no completadas · ' : ''}${pend.length} pendientes</span></div><div class="bar" style="margin-top:8px"><i style="width:${sum.total ? (sum.done + sum.nc) / sum.total * 100 : 0}%"></i></div></div>

    <div class="card c4"><div class="cardhead"><h3>Pruebas pendientes</h3><button class="btn sm sec" onclick="App.go('capture')">Toma guiada</button></div>${pend.length ? `<div class="list">${pend.slice(0, 7).map(t => `<div class="item"><div><b>${esc(T(t.testId)?.name)}</b><div class="meta">Sesión ${DB.get('sessions', t.sessionId)?.n ?? '—'} · ${t.status === 'in_progress' ? 'en curso' : 'pendiente'}</div></div><button class="btn sm" onclick="App.go('runner','${t.id}')">Abrir</button></div>`).join('')}</div>` : `<div class="empty small">${e ? (sum.total ? 'Todas las pruebas registradas.' : 'Sin batería programada.') : 'Sin evaluación activa.'}</div>`}</div>
    <div class="card c4"><div class="cardhead"><h3>Hallazgos (descriptivos)</h3><button class="btn sm sec" onclick="App.go('integration')">Integración</button></div>${findings.length ? findings.slice(0, 6).map(p => `<div class="note neutral" style="padding:7px 10px"><b>${esc(p.test.short)}</b> · ${esc(p.label)}: D ${fx(p.R, 1)} / I ${fx(p.L, 1)} ${esc(p.unit)} — diferencia ${fx(p.asym, 1)} % &gt; CV ${fx(p.cvMean, 1)} %</div>`).join('') : `<div class="empty small">No hay diferencias D/I que superen la variabilidad entre intentos${sum.done ? '' : ' (aún sin resultados)'}.</div>`}<p class="tiny muted">Se listan diferencias mayores que el CV intra-sesión. No constituyen diagnóstico.</p></div>
    <div class="card c4"><div class="cardhead"><h3>Asimetrías registradas</h3></div>${allPairs.length ? `<div class="tablewrap"><table><thead><tr><th>Prueba</th><th class="num">D</th><th class="num">I</th><th class="num">Dif. %</th></tr></thead><tbody>${allPairs.filter(p => p.key || allPairs.length < 12).slice(0, 10).map(p => `<tr><td>${esc(p.test.short)}<div class="tiny muted">${esc(p.label)}</div></td><td class="num">${fx(p.R, 1)}</td><td class="num">${fx(p.L, 1)}</td><td class="num">${fx(p.asym, 1)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty small">Sin datos bilaterales.</div>'}</div>

    <div class="card c8"><div class="cardhead"><h3>Línea temporal de lesiones</h3><button class="btn sm sec" onclick="App.go('anamnesis')">Anamnesis</button></div>${injuryTimeline(inj, evs)}</div>
    <div class="card c4"><div class="cardhead"><h3>Evolución</h3><button class="btn sm sec" onclick="App.go('evolution')">Ver</button></div>${evs.length > 1 ? `<p class="small">${evs.length} evaluaciones: ${evs.map(x => fmtDate(x.date)).join(' → ')}</p>${miniEvolution(a.id)}` : `<div class="empty small">Se necesita al menos una reevaluación para mostrar evolución.${e ? `<br><br><button class="btn sm" onclick="Act.newEvaluation()">${ICON.plus} Programar reevaluación</button>` : ''}</div>`}</div>
  </div>`;
};
function miniEvolution(aid) {
  const evs = DB.where('evaluations', x => x.athleteId === aid).sort(byDate);
  const series = {}; evs.forEach((e, i) => DB.where('results', r => r.evaluationId === e.id).forEach(r => r.metrics.filter(m => m.primary).forEach(m => { (series[m.key] = series[m.key] || { label: `${T(r.testId)?.short} ${m.label} ${m.side !== 'B' ? sideShort(m.side) : ''}`, unit: m.unit, pts: [] }).pts.push({ x: i, y: m.value, label: fmtDate(e.date) }); })));
  const s = Object.values(series).filter(x => x.pts.length > 1).slice(0, 3);
  return s.length ? s.map(x => `<div class="small"><b>${esc(x.label)}</b> <span class="muted">(${esc(x.unit)})</span>: ${x.pts.map(p => fx(p.y, 1)).join(' → ')}</div>`).join('') : '<div class="small muted">Aún no hay métricas repetidas entre evaluaciones.</div>';
}
function injuryTimeline(inj, evs = []) {
  const dated = inj.filter(i => /^\d{4}-\d{2}/.test(i.date || ''));
  if (!dated.length) return '<div class="empty small">Sin lesiones con fecha registrada.</div>';
  const toX = s => { const [y, m] = s.split('-').map(Number); return y * 12 + (m - 1); };
  const xs = dated.map(i => toX(i.date)).concat(evs.filter(e => e.date).map(e => toX(e.date))); const now = new Date(); xs.push(now.getFullYear() * 12 + now.getMonth());
  const x0 = Math.min(...xs) - 2, x1 = Math.max(...xs) + 2, W = 720, H = 210, m = 50; const sx = x => m + (x - x0) / (x1 - x0) * (W - 2 * m);
  let g = `<line x1="${m}" x2="${W - m}" y1="95" y2="95" stroke="#2d4a72" stroke-width="2"/>`;
  for (let y = Math.ceil(x0 / 12); y * 12 <= x1; y++) g += `<line x1="${sx(y * 12)}" x2="${sx(y * 12)}" y1="88" y2="102" stroke="#4b6b92"/><text x="${sx(y * 12)}" y="118" text-anchor="middle" style="font-size:11px;fill:#b7c7dc">${y}</text>`;
  const lv = { up: [], dn: [] }; dated.forEach((i, k) => { const x = sx(toX(i.date)), up = i.side === 'R', col = i.side === 'R' ? Chart.C.R : i.side === 'L' ? Chart.C.L : Chart.C.N; const arr = lv[up ? 'up' : 'dn']; let L = arr.findIndex(px => x - px > 105); if (L < 0) L = arr.length; arr[L] = x; L = Math.min(L, 3); const y = up ? 70 - L * 22 : 128 + L * 22; const w = num(i.timeLossDays) ? Math.max(4, num(i.timeLossDays) / 30.4 / (x1 - x0) * (W - 2 * m)) : 4; g += `<rect x="${x}" y="91" width="${w}" height="8" fill="${col}" opacity=".7"/><line x1="${x}" x2="${x}" y1="${up ? y + 14 : y - 12}" y2="95" stroke="${col}" stroke-dasharray="2 2"/><text x="${x}" y="${y}" text-anchor="middle" style="font-size:11px;fill:${col};font-weight:700">${esc((i.zone || '').slice(0, 22))} ${sideShort(i.side)}</text><text x="${x}" y="${y + 11}" text-anchor="middle" style="font-size:9.5px;fill:#7f95b2">${fmtDate(i.date)}${i.approx ? ' (aprox.)' : ''}</text>`; });
  evs.filter(e => e.date).forEach(e => { const x = sx(toX(e.date)); g += `<path d="M${x},80 l6,-10 h-12 z" fill="#7c8cff"/><text x="${x}" y="66" text-anchor="middle" style="font-size:9px;fill:#7c8cff">Eval.</text>`; });
  return `<div class="timeline"><svg viewBox="0 0 ${W} ${H}">${g}</svg></div><div class="legend"><span><i style="background:${Chart.C.R}"></i>Derecha (arriba)</span><span><i style="background:${Chart.C.L}"></i>Izquierda (abajo)</span><span><i style="background:#7c8cff"></i>Evaluaciones LCM</span><span class="muted">Barra = tiempo fuera registrado</span></div>`;
}

/* ==========================================================
   DEPORTISTAS
   ========================================================== */
const ATHLETE_FIELDS = [
  { k: 'firstName', label: 'Nombres', req: true, span: 4 }, { k: 'lastName', label: 'Apellidos', req: true, span: 4 }, { k: 'code', label: 'Código interno / documento', span: 4, help: 'Evite datos innecesarios; puede usar un código.' },
  { k: 'birthDate', label: 'Fecha de nacimiento', type: 'date', span: 3 }, { k: 'age', label: 'Edad (si no hay fecha)', type: 'number', min: 5, max: 100, unit: 'años', span: 3 }, { k: 'sex', label: 'Sexo', type: 'select', opts: [['', '—'], 'Masculino', 'Femenino', 'Otro / prefiere no indicar'], span: 3 }, { k: 'heightCm', label: 'Talla', type: 'number', min: 100, max: 230, unit: 'cm', span: 3 },
  { k: 'massKg', label: 'Masa corporal (referencial)', type: 'number', min: 25, max: 250, unit: 'kg', span: 3, help: 'Para normalizar se prioriza la masa del check-in o InBody.' }, { k: 'legLengthR', label: 'Longitud miembro inferior D', type: 'number', min: 50, max: 130, unit: 'cm', span: 3, help: 'EIAS–maléolo medial' }, { k: 'legLengthL', label: 'Longitud miembro inferior I', type: 'number', min: 50, max: 130, unit: 'cm', span: 3 }, { k: 'contact', label: 'Contacto (opcional)', span: 3 }
];
Views.athleteForm = (id = null) => {
  const a = id ? DB.get('athletes', id) : {};
  modal({
    title: id ? 'Editar deportista' : 'Crear deportista', wide: true, body: `<div class="grid">${ATHLETE_FIELDS.map(f => fieldHTML(f, a[f.k], 'af')).join('')}</div><p class="tiny muted">Los datos deportivos, de entrenamiento y las lesiones se registran en «Anamnesis».</p>`,
    actions: [{ label: 'Cancelar', cls: 'ghost' }, {
      label: id ? 'Guardar cambios' : 'Crear deportista', cls: 'ok', onClick: bg => {
        const r = readFields(bg, ATHLETE_FIELDS, 'af'); if (!r.ok) { toast(r.errs.join(' · '), 'bad'); return false; }
        if (!r.values.birthDate && r.values.age === null) { toast('Indique fecha de nacimiento o edad', 'warn'); $('#af_age', bg).classList.add('invalid'); return false; }
        const dup = !id && DB.all('athletes').find(x => (x.firstName + x.lastName).toLowerCase().replace(/\s/g, '') === (r.values.firstName + r.values.lastName).toLowerCase().replace(/\s/g, ''));
        if (dup) { toast('Ya existe un deportista con ese nombre', 'warn'); return false; }
        const obj = Object.assign(a, r.values); DB.put('athletes', obj);
        if (!id) { Ctx.setAthlete(obj.id); toast('Deportista creado. Ahora cree su primera evaluación.'); App.go('athletes'); setTimeout(Act.newEvaluation, 150); }
        else { toast('Deportista actualizado'); App.refresh(); }
      }
    }]
  });
};
Views.athletes = el => {
  const list = DB.all('athletes').slice().sort((x, y) => (x.lastName || '').localeCompare(y.lastName || '')); const a = Ctx.athlete();
  el.innerHTML = pageHead('Deportistas y evaluaciones', 'Cada deportista puede tener múltiples evaluaciones longitudinales.', `<button class="btn" onclick="Views.athleteForm()">${ICON.plus} Crear deportista</button><button class="btn sec" onclick="Demo.load()">Cargar caso demo Xioveng</button>`) +
    `<div class="grid"><div class="card c5"><h2>Deportistas (${list.length})</h2>${list.length ? `<div class="list">${list.map(x => { const n = DB.where('evaluations', e => e.athleteId === x.id).length; return `<div class="item" style="${a && a.id === x.id ? 'border-color:var(--accent)' : ''}"><div><b>${esc(fullName(x))}</b><div class="meta">${esc(x.sport || 'Deporte no registrado')} · ${n} evaluación(es)</div></div><div class="row"><button class="btn sm ${a && a.id === x.id ? 'ok' : 'sec'}" onclick="Ctx.setAthlete('${x.id}');App.refresh()">${a && a.id === x.id ? '✓ Activo' : 'Seleccionar'}</button></div></div>`; }).join('')}</div>` : '<div class="empty">Sin deportistas.</div>'}</div>
    <div class="card c7">${a ? athletePanel(a) : '<div class="empty">Seleccione un deportista para ver sus evaluaciones.</div>'}</div></div>`;
};
function athletePanel(a) {
  const evs = DB.where('evaluations', e => e.athleteId === a.id).sort(byDate); const cur = Ctx.evaluation();
  return `<div class="cardhead"><h2>${esc(fullName(a))}</h2><div class="row"><button class="btn sm sec" onclick="Views.athleteForm('${a.id}')">Editar datos</button><button class="btn sm bad" onclick="Views.deleteAthlete('${a.id}')">${ICON.trash} Eliminar</button></div></div>
  <div class="row small muted">${a.code ? 'Código: ' + esc(a.code) + ' · ' : ''}${a.sex ? esc(a.sex) + ' · ' : ''}${(num(a.age) ?? Calc.ageFrom(a.birthDate)) ?? '—'} años · Talla ${fx(a.heightCm, 0)} cm · Masa ref. ${fx(a.massKg, 1)} kg</div>
  <hr><div class="cardhead"><h3>Evaluaciones</h3><button class="btn sm" onclick="Act.newEvaluation()">${ICON.plus} Nueva evaluación</button></div>
  ${evs.length ? `<div class="list">${evs.map(e => { const s = Engine.evalSummary(e.id); const rep = DB.where('reports', r => r.evaluationId === e.id)[0]; return `<div class="item" style="${cur && cur.id === e.id ? 'border-color:var(--accent)' : ''}"><div><b>${fmtDate(e.date)} · ${esc(e.label || '')}</b><div class="meta">${s.done}/${s.total} pruebas · ${rep?.issuedAt ? 'Informe emitido' : 'Informe pendiente'} · Evaluador: ${esc(e.evaluator || '—')}</div></div><div class="row"><button class="btn sm ${cur && cur.id === e.id ? 'ok' : 'sec'}" onclick="Ctx.setEvaluation('${e.id}');App.go('dashboard')">${cur && cur.id === e.id ? '✓ Activa' : 'Abrir'}</button><button class="btn sm ghost" title="Eliminar evaluación" onclick="Views.deleteEvaluation('${e.id}')">${ICON.trash}</button></div></div>`; }).join('')}</div>` : '<div class="empty small">Sin evaluaciones.</div>'}`;
}
Views.deleteAthlete = async id => {
  const a = DB.get('athletes', id); if (!a) return;
  const ok = await confirmBox('Eliminar deportista', `Se eliminarán <b>definitivamente</b> ${esc(fullName(a))} y todas sus evaluaciones, consentimientos, cuestionarios, intentos, resultados, documentos e informes de este navegador. Se recomienda exportar un respaldo antes.`, 'Eliminar definitivamente', true, a.lastName || a.firstName);
  if (!ok) return; DB.deleteAthlete(id); if (DB.setting('activeAthlete') === id) { DB.setting('activeAthlete', null); DB.setting('activeEvaluation', null); } toast('Deportista eliminado', 'warn'); App.go('athletes');
};
Views.deleteEvaluation = async id => {
  const e = DB.get('evaluations', id); if (!e) return;
  const ok = await confirmBox('Eliminar evaluación', `Se eliminará la evaluación del ${fmtDate(e.date)} con sus sesiones, cuestionarios, intentos, resultados e informe.`, 'Eliminar', true);
  if (!ok) return;
  const tsIds = DB.where('testSessions', t => t.evaluationId === id).map(t => t.id);
  DB.where('trials', t => tsIds.includes(t.testSessionId)).forEach(t => DB.del('trials', t.id));
  ['consents', 'sessions', 'questionnaires', 'testSessions', 'results', 'reports', 'documents', 'imports'].forEach(c => DB.where(c, x => x.evaluationId === id).forEach(x => DB.del(c, x.id)));
  DB.del('evaluations', id); if (DB.setting('activeEvaluation') === id) DB.setting('activeEvaluation', null); toast('Evaluación eliminada', 'warn'); App.refresh();
};

/* ==========================================================
   CONSENTIMIENTO
   ========================================================== */
const CONSENT_VERSION = 'LCM-CI-2026.1';
function consentText(a, e) {
  const tests = (e.battery || []).map(id => T(id)?.name).filter(Boolean);
  const dur = (e.battery || []).reduce((s, id) => s + (T(id)?.time || 0), 0);
  return `
  <h3>Consentimiento informado para evaluación de capacidades físicas, funcionales y biomecánicas</h3>
  <p><b>${APP.lab}</b> — ${APP.institution}. Versión del documento: ${CONSENT_VERSION}.</p>
  <p><b>Participante:</b> ${esc(fullName(a))}${a.code ? ' · Código/documento: ' + esc(a.code) : ''} · <b>Evaluación:</b> ${fmtDate(e.date)} · <b>Evaluador responsable:</b> ${esc(e.evaluator || '')}</p>
  <h4>1. Propósito</h4><p>${esc(e.objective || 'Evaluar capacidades físicas, funcionales y biomecánicas para describir el estado actual del deportista y orientar su seguimiento.')}</p>
  <h4>2. Procedimientos</h4><p>La evaluación puede incluir: registro de antecedentes y cuestionarios autoadministrados; composición corporal por bioimpedancia; medición de movilidad y flexibilidad; pruebas de fuerza isométrica y dinámica (incluido encoder lineal); saltos verticales y horizontales sobre plataformas de fuerza; pruebas de equilibrio; esprints y agilidad; análisis tridimensional de la carrera con marcadores reflectantes adheridos a la piel y plataformas de fuerza; y una prueba aeróbica de campo con monitor de frecuencia cardiaca. Cada prueba se explicará y demostrará antes de realizarla e incluirá calentamiento y familiarización.</p>
  <p><b>Pruebas previstas en esta evaluación:</b> ${tests.length ? tests.map(esc).join('; ') : 'se definirán según la batería seleccionada y se le informarán antes de iniciar'}.</p>
  <h4>3. Duración aproximada</h4><p>${dur ? `Aproximadamente ${Math.round(dur / 5) * 5} minutos de pruebas, más calentamiento y pausas, distribuidos en una o más sesiones.` : 'Entre 60 y 120 minutos por sesión, en una o dos sesiones.'}</p>
  <h4>4. Molestias y riesgos previsibles</h4><ul><li>Fatiga muscular durante y después de las pruebas máximas.</li><li>Dolor muscular de aparición tardía (24–72 h), habitualmente leve y transitorio.</li><li>Riesgo de caída o pérdida de equilibrio en saltos unipodales, pruebas de equilibrio, esprints y cambios de dirección.</li><li>Riesgo bajo de lesión musculoesquelética propio de esfuerzos máximos.</li><li>Irritación leve de la piel por adhesivos de marcadores o electrodos.</li><li>En la prueba aeróbica: esfuerzo cardiorrespiratorio intenso (disnea, mareo transitorio).</li></ul>
  <p>Para minimizarlos se aplican calentamiento estandarizado, familiarización, pausas, supervisión permanente y criterios de detención.</p>
  <h4>5. Derechos del participante</h4><ul><li>Puede <b>detener cualquier prueba</b> en cualquier momento, sin necesidad de justificarlo.</li><li>Puede <b>retirarse</b> de la evaluación sin ninguna consecuencia.</li><li>Puede realizar preguntas antes, durante y después de la evaluación.</li></ul>
  <h4>6. Confidencialidad, uso y almacenamiento de datos</h4><p>Sus datos personales y de salud se tratarán de forma confidencial y solo por el equipo evaluador. En esta aplicación se almacenan localmente en el equipo del laboratorio; los respaldos se guardan en medios institucionales con acceso restringido. No se comparten con terceros (entrenadores, clubes, federaciones u otros) sin su autorización expresa. Puede solicitar acceso, rectificación o eliminación de sus datos.</p>
  <h4>7. Imágenes y videos</h4><p>Algunas pruebas pueden registrarse en video para análisis biomecánico. El registro de video y la toma de fotografías requieren su autorización <b>independiente</b> (casillas específicas abajo). Si no autoriza, la prueba se realizará sin grabación cuando sea técnicamente posible.</p>
  <h4>8. Alcance de los resultados</h4><ul><li>Las pruebas <b>no sustituyen un diagnóstico médico</b> ni una evaluación clínica.</li><li>Los resultados describen su desempeño en las condiciones evaluadas y <b>no constituyen automáticamente una autorización para el retorno deportivo</b> ni para competir.</li></ul>
  <h4>9. Declaración de antecedentes</h4><p>Declaro haber informado de forma veraz mis antecedentes de lesiones, enfermedades, medicación y síntomas actuales relevantes, y me comprometo a informar cualquier molestia durante la evaluación.</p>
  <h4>10. Reevaluaciones</h4><p>Se me podrá proponer repetir la evaluación en fechas posteriores para seguimiento; cada reevaluación será voluntaria.</p>`;
}
Views.consent = el => {
  if (!guard(el)) return;
  const a = Ctx.athlete(), e = Ctx.evaluation(); const c = Ctx.consent(e.id) || { checks: {} };
  const inj = Ctx.injuries(a.id);
  el.innerHTML = pageHead('Consentimiento informado', 'Debe completarse y firmarse antes de iniciar cualquier prueba.', `<button class="btn sec" onclick="Act.printSection('Consentimiento_LCM')">${ICON.print} Imprimir / PDF</button>`) + `
  <div class="card consentprint" id="consentDoc">${consentText(a, e)}
    <h4>Antecedentes declarados</h4><textarea id="cHist" placeholder="Antecedentes relevantes declarados por el participante">${esc(c.declaredHistory ?? inj.map(i => `${fmtDate(i.date)} · ${i.zone || ''} ${sideName(i.side)} · ${i.diagnosis || ''}`).join('\n'))}</textarea>
    <h4>Preguntas del participante y respuestas</h4><textarea id="cQ" placeholder="Registre preguntas y aclaraciones">${esc(c.questions || '')}</textarea>
    <h4>Autorizaciones (independientes)</h4>
    ${[['participate', '<b>Acepto participar</b> voluntariamente en la evaluación descrita.'], ['video', 'Autorizo el <b>registro de video</b> para análisis biomecánico.'], ['photo', 'Autorizo la toma de <b>fotografías</b>.'], ['teaching', 'Autorizo la utilización <b>anonimizada</b> de mis resultados con <b>fines docentes</b>.'], ['research', 'Autorizo la utilización <b>anonimizada</b> de mis resultados con <b>fines de investigación</b>, cuando corresponda y exista aprobación ética aplicable.']].map(([k, l]) => `<label class="check"><input type="checkbox" data-ck="${k}" ${c.checks?.[k] ? 'checked' : ''}> ${l}</label>`).join('')}
    <div class="grid" style="margin-top:10px">
      <div class="c6"><label>Firma del deportista</label>${c.athleteSig ? `<img class="sigimg" src="${c.athleteSig}" alt="firma deportista"><div class="noprint"><button class="btn sm ghost" id="reSigA">Volver a firmar</button></div>` : `<canvas class="sig" id="sigA"></canvas><div class="row noprint" style="margin-top:6px"><button class="btn sm ghost" id="clrA">Borrar</button></div>`}<div class="small">${esc(fullName(a))}</div></div>
      <div class="c6"><label>Firma del evaluador</label>${c.evaluatorSig ? `<img class="sigimg" src="${c.evaluatorSig}" alt="firma evaluador"><div class="noprint"><button class="btn sm ghost" id="reSigE">Volver a firmar</button></div>` : `<canvas class="sig" id="sigE"></canvas><div class="row noprint" style="margin-top:6px"><button class="btn sm ghost" id="clrE">Borrar</button></div>`}<input id="cEval" value="${esc(c.evaluatorName || e.evaluator || '')}" placeholder="Nombre del evaluador" style="margin-top:6px"></div>
      <div class="c3"><label>Fecha</label><input type="date" id="cDate" value="${c.date || todayStr()}"></div><div class="c3"><label>Hora</label><input type="time" id="cTime" value="${c.time || timeStr()}"></div>
      <div class="c6"><label>Representante legal (solo si el participante es menor de edad)</label><input id="cRep" value="${esc(c.guardian || '')}"></div>
    </div>
    ${c.signedAt ? `<div class="note ok">Consentimiento registrado el ${new Date(c.signedAt).toLocaleString('es-PE')} · versión ${esc(c.version)}.</div>` : ''}
  </div>
  <div class="runfoot noprint"><span class="small muted">Las firmas se guardan como imagen en este navegador.</span><div class="row"><button class="btn ok lg" id="cSave">Registrar consentimiento</button>${c.signedAt ? nextBtn() : ''}</div></div>`;
  const pads = {};
  const mkPad = (id) => { const cv = $('#' + id); if (!cv) return null; const r = cv.getBoundingClientRect(); cv.width = r.width * 2; cv.height = r.height * 2; const ctx = cv.getContext('2d'); ctx.scale(2, 2); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.strokeStyle = '#0b2540'; let d = false, used = false; const pos = ev => { const b = cv.getBoundingClientRect(); return [ev.clientX - b.left, ev.clientY - b.top]; }; cv.onpointerdown = ev => { d = true; used = true; cv.setPointerCapture(ev.pointerId); ctx.beginPath(); ctx.moveTo(...pos(ev)); }; cv.onpointermove = ev => { if (!d) return; ctx.lineTo(...pos(ev)); ctx.stroke(); }; cv.onpointerup = () => d = false; return { cv, clear: () => { ctx.clearRect(0, 0, cv.width, cv.height); used = false; }, used: () => used, data: () => cv.toDataURL('image/png') }; };
  pads.A = mkPad('sigA'); pads.E = mkPad('sigE');
  if ($('#clrA')) $('#clrA').onclick = () => pads.A.clear(); if ($('#clrE')) $('#clrE').onclick = () => pads.E.clear();
  if ($('#reSigA')) $('#reSigA').onclick = () => { c.athleteSig = null; if (c.id) DB.put('consents', c); App.refresh(); };
  if ($('#reSigE')) $('#reSigE').onclick = () => { c.evaluatorSig = null; if (c.id) DB.put('consents', c); App.refresh(); };
  $('#cSave').onclick = () => {
    const checks = {}; $$('[data-ck]').forEach(x => checks[x.dataset.ck] = x.checked);
    if (!checks.participate) { toast('Debe marcarse «Acepto participar» para registrar el consentimiento', 'bad'); return; }
    const aSig = c.athleteSig || (pads.A && pads.A.used() ? pads.A.data() : null), eSig = c.evaluatorSig || (pads.E && pads.E.used() ? pads.E.data() : null);
    if (!aSig || !eSig) { toast('Faltan firmas del deportista y/o del evaluador', 'bad'); return; }
    if (!$('#cEval').value.trim()) { toast('Indique el nombre del evaluador', 'bad'); $('#cEval').classList.add('invalid'); return; }
    Object.assign(c, { athleteId: a.id, evaluationId: e.id, version: CONSENT_VERSION, checks, athleteSig: aSig, evaluatorSig: eSig, evaluatorName: $('#cEval').value.trim(), date: $('#cDate').value, time: $('#cTime').value, guardian: $('#cRep').value.trim(), questions: $('#cQ').value, declaredHistory: $('#cHist').value, signedAt: nowISO(), textSnapshot: $('#consentDoc h3').textContent });
    DB.put('consents', c); toast('Consentimiento registrado'); App.refresh();
  };
};

/* ==========================================================
   ANAMNESIS
   ========================================================== */
const SPORT_FIELDS = [
  { k: 'sport', label: 'Deporte', span: 3, req: true }, { k: 'event', label: 'Especialidad / prueba', span: 3, ph: 'p. ej., 400 m, salto largo' }, { k: 'level', label: 'Nivel competitivo', type: 'select', opts: [['', '—'], 'Recreativo', 'Universitario', 'Regional', 'Nacional', 'Internacional', 'Élite'], span: 3 }, { k: 'yearsTraining', label: 'Años de entrenamiento', type: 'number', min: 0, max: 50, span: 3 },
  { k: 'sessionsWeek', label: 'Frecuencia semanal', type: 'number', min: 0, max: 21, unit: 'ses/sem', span: 3 }, { k: 'hoursWeek', label: 'Horas semanales', type: 'number', min: 0, max: 60, unit: 'h', span: 3 }, { k: 'surface', label: 'Superficie habitual', type: 'select', opts: [['', '—'], 'Pista sintética', 'Césped natural', 'Césped artificial', 'Tierra/grava', 'Asfalto', 'Interior (parquet/sintético)', 'Mixta'], span: 3 }, { k: 'footwear', label: 'Calzado habitual', span: 3, ph: 'p. ej., clavos de velocidad / zapatillas' },
  { k: 'dominance', label: 'Dominancia (miembro inferior)', type: 'select', opts: [['', '—'], 'Derecha', 'Izquierda', 'Mixta'], span: 3 }, { k: 'takeoffLeg', label: 'Pierna de impulso', type: 'select', opts: [['', '—'], 'Derecha', 'Izquierda', 'No aplica'], span: 3 }, { k: 'supportLeg', label: 'Pierna de apoyo', type: 'select', opts: [['', '—'], 'Derecha', 'Izquierda', 'No aplica'], span: 3 }, { k: 'handDominance', label: 'Mano dominante', type: 'select', opts: [['', '—'], 'Derecha', 'Izquierda', 'Ambidiestro'], span: 3 },
  { k: 'competitions', label: 'Competencias próximas', type: 'textarea', span: 6 }, { k: 'objective', label: 'Objetivo general del seguimiento', type: 'textarea', span: 6 }, { k: 'medical', label: 'Otros antecedentes médicos / medicación habitual', type: 'textarea', span: 12 }
];
const INJ_FIELDS = [
  { k: 'zone', label: 'Zona', type: 'select', opts: [['', '—'], 'Tobillo', 'Pie', 'Gemelo / pantorrilla', 'Aquiles', 'Rodilla', 'Cuádriceps', 'Isquiotibiales', 'Aductores', 'Glúteo', 'Cadera', 'Columna lumbar', 'Tronco', 'Hombro', 'Codo', 'Muñeca/mano', 'Otra'], span: 3, req: true }, { k: 'side', label: 'Lado', type: 'select', opts: [['R', 'Derecha'], ['L', 'Izquierda'], ['B', 'Bilateral / central']], span: 3 }, { k: 'date', label: 'Fecha (mes/año)', type: 'month', span: 3, req: true }, { k: 'approx', label: 'Fecha aproximada', type: 'check', span: 3 },
  { k: 'diagnosis', label: 'Diagnóstico (referido)', span: 6 }, { k: 'mechanism', label: 'Mecanismo', type: 'select', opts: [['', '—'], 'Sin contacto — aceleración/sprint', 'Sin contacto — salto/aterrizaje', 'Sin contacto — cambio de dirección', 'Contacto', 'Sobreuso / progresivo', 'Desconocido'], span: 6 },
  { k: 'severity', label: 'Gravedad', type: 'select', opts: [['', '—'], 'Sin gravedad referida', 'Leve (1–7 días)', 'Moderada (8–28 días)', 'Grave (> 28 días)', 'Desconocida'], span: 3 }, { k: 'timeLossDays', label: 'Tiempo fuera', type: 'number', min: 0, max: 1000, unit: 'días', span: 3 }, { k: 'surgery', label: 'Cirugía', type: 'select', opts: [['no', 'No'], ['si', 'Sí']], span: 3 }, { k: 'recurrence', label: 'Recurrencia', type: 'select', opts: [['no', 'No'], ['si', 'Sí (misma zona y tipo)'], ['desconocido', 'Desconocido']], span: 3 },
  { k: 'treatment', label: 'Tratamiento', type: 'textarea', span: 6 }, { k: 'rehab', label: 'Rehabilitación', type: 'textarea', span: 6 },
  { k: 'currentPain', label: 'Dolor actual (0–10)', type: 'number', min: 0, max: 10, span: 4 }, { k: 'recoveryPct', label: 'Sensación subjetiva de recuperación', type: 'number', min: 0, max: 100, unit: '%', span: 4 }, { k: 'status', label: 'Estado actual', type: 'select', opts: [['', '—'], 'Clínicamente recuperada (referido)', 'En rehabilitación', 'Sintomática', 'Desconocido'], span: 4 }, { k: 'notes', label: 'Notas', type: 'textarea', span: 12 }
];
Views.anamnesis = el => {
  if (!guard(el, false)) return;
  const a = Ctx.athlete(), e = Ctx.evaluation(); const inj = Ctx.injuries(a.id);
  el.innerHTML = pageHead('Anamnesis estructurada', 'Datos deportivos, exposición y registro individual de lesiones.', `${e ? `<button class="btn ${e.anamnesisReviewed ? 'ok' : ''}" id="anRev">${e.anamnesisReviewed ? '✓ Anamnesis revisada' : 'Marcar anamnesis revisada'}</button>` : ''}`) + `
  <div class="card"><div class="cardhead"><h2>Datos deportivos</h2><span class="small muted" id="anSaved">Guardado automático</span></div><div class="grid" id="anForm">${SPORT_FIELDS.map(f => fieldHTML(f, a[f.k], 'an')).join('')}</div></div>
  <div class="card" style="margin-top:14px"><div class="cardhead"><h2>Lesiones (${inj.length})</h2><button class="btn" onclick="Views.injuryForm()">${ICON.plus} Añadir lesión</button></div>
  ${inj.length ? `<div class="tablewrap"><table><thead><tr><th>Fecha</th><th>Zona</th><th>Lado</th><th>Diagnóstico</th><th>Gravedad</th><th class="num">Días fuera</th><th class="num">Dolor</th><th class="num">Recup. %</th><th>Estado</th><th></th></tr></thead><tbody>${inj.map(i => `<tr><td class="nowrap">${fmtDate(i.date)}${i.approx ? ' <span class="pill">aprox.</span>' : ''}</td><td>${esc(i.zone)}</td><td><span class="pill ${i.side}">${sideName(i.side)}</span></td><td>${esc(i.diagnosis || '—')}</td><td>${esc(i.severity || '—')}</td><td class="num">${i.timeLossDays ?? '—'}</td><td class="num">${i.currentPain ?? '—'}</td><td class="num">${i.recoveryPct ?? '—'}</td><td>${esc(i.status || '—')}</td><td class="nowrap"><button class="btn sm sec" onclick="Views.injuryForm('${i.id}')">Editar</button> <button class="btn sm ghost" onclick="Views.delInjury('${i.id}')">${ICON.trash}</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty small">Sin lesiones registradas.</div>'}
  </div>
  <div class="card" style="margin-top:14px"><h2>Línea temporal de lesiones</h2>${injuryTimeline(inj, DB.where('evaluations', x => x.athleteId === a.id))}</div>
  ${e ? `<div class="runfoot"><span></span>${nextBtn()}</div>` : ''}`;
  const save = debounce(() => { const r = readFields(el, SPORT_FIELDS, 'an'); Object.assign(a, r.values); DB.put('athletes', a); $('#anSaved').textContent = 'Guardado ' + timeStr(); }, 500);
  $('#anForm').addEventListener('input', save); $('#anForm').addEventListener('change', save);
  if ($('#anRev')) $('#anRev').onclick = () => { const r = readFields(el, SPORT_FIELDS, 'an'); if (!r.ok) { toast(r.errs.join(' · '), 'bad'); return; } Object.assign(a, r.values); DB.put('athletes', a); e.anamnesisReviewed = !e.anamnesisReviewed; DB.put('evaluations', e); toast(e.anamnesisReviewed ? 'Anamnesis marcada como revisada' : 'Marca retirada'); App.refresh(); };
};
Views.injuryForm = (id = null) => {
  const a = Ctx.athlete(); const i = id ? DB.get('injuries', id) : { side: 'R', surgery: 'no', recurrence: 'no' };
  modal({
    title: id ? 'Editar lesión' : 'Añadir lesión', wide: true, body: `<div class="grid">${INJ_FIELDS.map(f => fieldHTML(f, i[f.k], 'in')).join('')}</div>`,
    actions: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Guardar lesión', cls: 'ok', onClick: bg => { const r = readFields(bg, INJ_FIELDS, 'in'); if (!r.ok) { toast(r.errs.join(' · '), 'bad'); return false; } DB.put('injuries', Object.assign(i, r.values, { athleteId: a.id })); toast('Lesión guardada'); App.refresh(); } }]
  });
};
Views.delInjury = async id => { if (await confirmBox('Eliminar lesión', '¿Eliminar este registro de lesión?', 'Eliminar', true)) { DB.del('injuries', id); toast('Lesión eliminada', 'warn'); App.refresh(); } };

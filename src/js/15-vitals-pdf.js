/* ==========================================================
   SIGNOS VITALES · CIERRE DE SESIÓN · GENERADOR PDF PROPIO
   El PDF se construye en el navegador, sin librerías externas
   (fuentes estándar Helvetica, codificación WinAnsi).
   ========================================================== */
SOURCES.fletcher2013 = { cite: 'Fletcher GF, Ades PA, Kligfield P, et al. Exercise standards for testing and training: a scientific statement from the American Heart Association. Circulation. 2013;128(8):873-934.', doi: '10.1161/CIR.0b013e31829b5b44' };
SOURCES.whelton2018 = { cite: 'Whelton PK, Carey RM, Aronow WS, et al. 2017 ACC/AHA/AAPA/ABC/ACPM/AGS/APhA/ASH/ASPC/NMA/PCNA Guideline for the prevention, detection, evaluation, and management of high blood pressure in adults. Hypertension. 2018;71(6):e13-e115.', doi: '10.1161/HYP.0000000000000065' };
BUILTIN_REFS.push(
  { id: 'r_bp_contra', metric: 'vitals.bp', type: 'cutoff', value: 'PAS > 200 o PAD > 110', unit: 'mmHg (reposo)', population: 'Adultos candidatos a pruebas de esfuerzo', protocol: 'Contraindicación relativa para pruebas de esfuerzo', src: 'fletcher2013', note: 'Decisión final del profesional responsable.' },
  { id: 'r_bp_cat', metric: 'vitals.bp', type: 'normative', value: '<120/<80 · 120–129/<80 · 130–139 o 80–89 · ≥140 o ≥90', unit: 'mmHg', population: 'Adultos', protocol: 'Categorías normal / elevada / HTA estadio 1 / estadio 2. El diagnóstico requiere ≥ 2 mediciones en ≥ 2 ocasiones.', src: 'whelton2018', note: 'En el laboratorio se muestra la categoría de una medición aislada: no constituye diagnóstico.' }
);
const VITAL_MOMENTS = [['pre', 'Pre-sesión (reposo)'], ['entre', 'Entre pruebas'], ['post', 'Post-sesión (inmediato)'], ['rec5', 'Recuperación 5 min'], ['rec10', 'Recuperación 10 min'], ['otro', 'Otro']];
const VITAL_FIELDS = [
  { k: 'moment', label: 'Momento', type: 'select', opts: VITAL_MOMENTS, span: 3 }, { k: 'time', label: 'Hora', type: 'time', span: 2 },
  { k: 'sbp', label: 'PA sistólica', type: 'number', unit: 'mmHg', min: 60, max: 260, span: 2 }, { k: 'dbp', label: 'PA diastólica', type: 'number', unit: 'mmHg', min: 30, max: 160, span: 2 }, { k: 'hr', label: 'Frecuencia cardiaca', type: 'number', unit: 'lpm', min: 25, max: 230, span: 3 },
  { k: 'spo2', label: 'SpO₂', type: 'number', unit: '%', min: 70, max: 100, span: 2 }, { k: 'rr', label: 'Frecuencia respiratoria', type: 'number', unit: 'rpm', min: 4, max: 60, span: 3 }, { k: 'temp', label: 'Temperatura corporal', type: 'number', unit: '°C', min: 33, max: 42, step: 0.1, span: 3 },
  { k: 'position', label: 'Posición', type: 'select', opts: [['sentado', 'Sentado'], ['supino', 'Supino'], ['de pie', 'De pie']], span: 2 }, { k: 'arm', label: 'Brazo (PA)', type: 'select', opts: [['', '—'], ['D', 'Derecho'], ['I', 'Izquierdo']], span: 2 },
  { k: 'device', label: 'Equipo', span: 4, ph: 'p. ej., tensiómetro automático / oxímetro' }, { k: 'note', label: 'Observación', span: 8 }
];
function bpCategory(s, d, moment = 'pre') { if (!['pre', 'rec10', 'otro'].includes(moment)) return 'No aplica (post-esfuerzo)'; s = num(s); d = num(d); if (s === null || d === null) return null; if (s >= 140 || d >= 90) return 'HTA estadio 2*'; if (s >= 130 || d >= 80) return 'HTA estadio 1*'; if (s >= 120) return 'Elevada*'; return 'Normal*'; }
function vitalAlerts(v) {
  const a = []; const rest = ['pre', 'rec10', 'otro'].includes(v.moment) || v.moment === 'pre';
  if (v.moment === 'pre' && (num(v.sbp) > 200 || num(v.dbp) > 110)) a.push(['bad', `PA en reposo ${v.sbp}/${v.dbp} mmHg: supera el criterio de contraindicación relativa para pruebas de esfuerzo (PAS > 200 o PAD > 110; Fletcher et al., 2013). Repetir la medición y decisión del profesional responsable.`]);
  if (v.moment === 'pre' && num(v.hr) > 100) a.push(['warn', `FC en reposo ${v.hr} lpm (> 100 lpm): repetir tras 5 min de reposo y valorar antes de pruebas máximas.`]);
  if (num(v.spo2) !== null && num(v.spo2) < 95) a.push(['warn', `SpO₂ ${v.spo2} %: verificar la medición (umbral operativo del laboratorio, 95 %).`]);
  if (num(v.temp) !== null && num(v.temp) >= 37.5) a.push(['warn', `Temperatura ${v.temp} °C (umbral operativo del laboratorio, 37.5 °C): valorar antes de continuar.`]);
  return a;
}
function vitalsTableHTML(s, editable = true) {
  const vs = (s.vitals || []).slice().sort((a, b) => String(a.time).localeCompare(String(b.time)));
  if (!vs.length) return '<div class="empty small">Sin mediciones registradas.</div>';
  const pre = vs.find(v => v.moment === 'pre');
  return `<div class="tablewrap"><table><thead><tr><th>Momento</th><th>Hora</th><th class="num">PA (mmHg)</th><th>Categoría PA</th><th class="num">FC (lpm)</th><th class="num">ΔFC vs pre</th><th class="num">SpO₂ %</th><th class="num">FR</th><th class="num">T °C</th><th>Posición / brazo</th>${editable ? '<th></th>' : ''}</tr></thead><tbody>${vs.map(v => `<tr><td>${esc((VITAL_MOMENTS.find(m => m[0] === v.moment) || [, v.moment])[1])}</td><td>${esc(v.time || '')}</td><td class="num">${v.sbp ?? '—'}/${v.dbp ?? '—'}</td><td class="small">${esc(bpCategory(v.sbp, v.dbp, v.moment) || '—')}</td><td class="num">${v.hr ?? '—'}</td><td class="num">${pre && v !== pre && num(v.hr) !== null && num(pre.hr) !== null ? (v.hr - pre.hr > 0 ? '+' : '') + (v.hr - pre.hr) : '—'}</td><td class="num">${v.spo2 ?? '—'}</td><td class="num">${v.rr ?? '—'}</td><td class="num">${v.temp ?? '—'}</td><td class="small">${esc(v.position || '')}${v.arm ? ' · ' + v.arm : ''}</td>${editable ? `<td><button class="btn sm ghost" data-vdel="${v.id}">${ICON.trash}</button></td>` : ''}</tr>`).join('')}</tbody></table></div>
  <p class="tiny muted">*Categoría de una medición aislada según ACC/AHA 2017 (Whelton et al., 2018): descriptiva, no diagnóstica.</p>${vs.flatMap(vitalAlerts).map(([t, m]) => `<div class="note ${t} small">${esc(m)}</div>`).join('')}`;
}
/* tarjeta reutilizable: registro de signos vitales de una sesión */
function vitalsCard(s, defMoment = 'pre') {
  return `<div class="card" style="margin-top:14px" id="vitCard"><div class="cardhead"><h2>Signos vitales · Sesión ${s.n}</h2><span class="pill">${(s.vitals || []).length} medición(es)</span></div>
  <div id="vitTable">${vitalsTableHTML(s)}</div>
  <details open style="margin-top:10px"><summary><b>Añadir medición</b></summary><div class="grid">${VITAL_FIELDS.map(f => fieldHTML(f, f.k === 'moment' ? defMoment : f.k === 'time' ? timeStr() : f.k === 'position' ? 'sentado' : f.k === 'device' ? (s.vitals || []).slice(-1)[0]?.device || '' : '', 'vt')).join('')}</div>
  <div class="row" style="margin-top:10px"><button class="btn" id="vitAdd">${ICON.plus} Registrar signos vitales</button><span class="small muted">Mida tras ≥ 5 min de reposo sentado para el registro pre-sesión.</span></div></details></div>`;
}
function bindVitals(root, s, onChange) {
  const add = $('#vitAdd', root); if (!add) return;
  add.onclick = () => {
    const r = readFields(root, VITAL_FIELDS, 'vt'); if (!r.ok) { toast(r.errs.join(' · '), 'bad'); return; }
    const v = r.values; if ([v.sbp, v.dbp, v.hr, v.spo2, v.rr, v.temp].every(x => x === null)) { toast('Ingrese al menos un signo vital', 'warn'); return; }
    if ((v.sbp === null) !== (v.dbp === null)) { toast('Registre presión sistólica y diastólica juntas', 'warn'); return; }
    if (v.sbp !== null && v.dbp >= v.sbp) { toast('La diastólica debe ser menor que la sistólica', 'bad'); return; }
    s.vitals = s.vitals || []; s.vitals.push(Object.assign({ id: uid('vit'), at: nowISO() }, v)); DB.put('sessions', s);
    const al = vitalAlerts(v); toast(al.length ? `Signos vitales registrados con ${al.length} alerta(s)` : 'Signos vitales registrados', al.some(a => a[0] === 'bad') ? 'bad' : al.length ? 'warn' : 'ok');
    onChange();
  };
  $$('[data-vdel]', root).forEach(b => b.onclick = async () => { if (await confirmBox('Eliminar medición', '¿Eliminar esta medición de signos vitales?', 'Eliminar', true)) { s.vitals = s.vitals.filter(x => x.id !== b.dataset.vdel); DB.put('sessions', s); onChange(); } });
}
/* cierre de sesión */
function sessionCloseCard(s) {
  const e = DB.get('evaluations', s.evaluationId); const tss = Ctx.testSessions(e.id).filter(t => t.sessionId === s.id);
  const st = tss.map(t => t.startedAt).filter(Boolean).sort()[0], en = tss.map(t => t.finishedAt).filter(Boolean).sort().pop();
  const dur = s.close?.durationMin ?? (st && en ? Math.round((new Date(en) - new Date(st)) / 60000) : '');
  return `<div class="card hl" style="margin-top:14px"><div class="cardhead"><h2>Cierre de la sesión ${s.n}</h2>${s.status === 'closed' ? `<span class="pill ok">Cerrada ${new Date(s.close.closedAt).toLocaleString('es-PE')}</span>` : ''}</div>
  <div class="grid"><div class="c3"><label>RPE de la sesión (CR-10)</label><input type="number" id="clRpe" min="0" max="10" step="0.5" value="${s.close?.sRPE ?? ''}"></div><div class="c3"><label>Duración de las pruebas</label><div class="fieldunit"><input type="number" id="clDur" min="0" max="600" value="${dur}"><span>min</span></div></div><div class="c6"><label>Estado del deportista al finalizar</label><select id="clState">${['Sin molestias', 'Fatiga esperada', 'Molestia leve (registrar)', 'Dolor / síntoma que requiere seguimiento'].map(x => `<option ${s.close?.state === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
  <div class="c12"><label>Observaciones finales de la sesión</label><textarea id="clObs">${esc(s.close?.obs || '')}</textarea></div></div>
  ${(s.vitals || []).some(v => v.moment === 'post' || v.moment.startsWith('rec')) ? '' : '<div class="note warn small">No hay signos vitales post-sesión registrados. Regístrelos arriba antes de cerrar.</div>'}
  <div class="row" style="margin-top:10px"><button class="btn ok" id="clSave">${s.status === 'closed' ? 'Actualizar cierre' : 'Cerrar sesión'}</button><button class="btn" id="clPdf">${ICON.doc} Descargar PDF de la sesión</button></div></div>`;
}
function bindSessionClose(root, s) {
  const b = $('#clSave', root); if (!b) return;
  b.onclick = () => { const rpe = num($('#clRpe', root).value), dur = num($('#clDur', root).value); if (rpe !== null && (rpe < 0 || rpe > 10)) { toast('RPE fuera de rango (0–10)', 'bad'); return; } s.close = { sRPE: rpe, durationMin: dur, sessionLoad: rpe !== null && dur !== null ? rpe * dur : null, state: $('#clState', root).value, obs: $('#clObs', root).value, closedAt: nowISO() }; s.status = 'closed'; DB.put('sessions', s); toast(`Sesión ${s.n} cerrada`); App.refresh(); };
  $('#clPdf', root).onclick = () => PdfReports.session(s);
}

/* ==========================================================
   GENERADOR PDF (A4, Helvetica, WinAnsi)
   ========================================================== */
const PDF_W = { n: [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,761,556,556,222,556,333,1000,556,556,333,1000,667,333,1000,556,611,556,556,222,222,333,333,350,556,1000,333,1000,500,333,944,556,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500],
  b: [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,761,556,556,278,556,500,1000,556,556,333,1000,667,333,1000,556,611,556,556,278,278,500,500,350,556,1000,333,1000,556,333,944,556,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556] };
const CP1252 = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F };
const PDF_SUBST = { '≥': '>=', '≤': '<=', '−': '-', '→': '->', '←': '<-', '√': 'raiz', 'Δ': 'Delta ', '₂': '2', '⁻': '-', '¹': '1', '◆': '*', '✓': 'OK', '✕': 'x', '●': '*', '○': 'o', '≈': '~', 'θ': 'theta', '·': '·', '“': '"', '”': '"' };
class PdfDoc {
  constructor(meta = {}) { this.W = 595.28; this.H = 841.89; this.M = 42; this.pages = []; this.images = []; this.meta = meta; this.newPage(); }
  enc(str) { let o = ''; for (const ch of String(str ?? '')) { const s = PDF_SUBST[ch]; if (s !== undefined && s !== ch) { o += this.enc(s); continue; } const c = ch.codePointAt(0); if (c < 128 || (c >= 160 && c < 256)) o += String.fromCharCode(c); else if (CP1252[c]) o += String.fromCharCode(CP1252[c]); else o += '?'; } return o; }
  esc(s) { return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
  width(str, size, bold) { const w = bold ? PDF_W.b : PDF_W.n; let t = 0; for (const ch of this.enc(str)) { const c = ch.charCodeAt(0); t += (c >= 32 ? w[c - 32] : 500) || 556; } return t * size / 1000; }
  newPage() { this.page = { ops: [] }; this.pages.push(this.page); this.y = this.M + 18; }
  ensure(h) { if (this.y + h > this.H - this.M - 18) { this.newPage(); return true; } return false; }
  color(rgb, stroke = false) { const [r, g, b] = rgb; this.page.ops.push(`${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} ${stroke ? 'RG' : 'rg'}`); }
  text(x, y, str, size = 9.5, bold = false, rgb = [17, 24, 39], align = 'left') { const s = this.enc(str); let xx = x; if (align !== 'left') { const w = this.width(str, size, bold); xx = align === 'right' ? x - w : x - w / 2; } this.color(rgb); this.page.ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${xx.toFixed(2)} ${(this.H - y).toFixed(2)} Td (${this.esc(s)}) Tj ET`); }
  line(x1, y1, x2, y2, w = 0.5, rgb = [17, 24, 39]) { this.color(rgb, true); this.page.ops.push(`${w} w ${x1.toFixed(2)} ${(this.H - y1).toFixed(2)} m ${x2.toFixed(2)} ${(this.H - y2).toFixed(2)} l S`); }
  rect(x, y, w, h, rgb, stroke = null) { if (rgb) { this.color(rgb); this.page.ops.push(`${x.toFixed(2)} ${(this.H - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`); } if (stroke) { this.color(stroke, true); this.page.ops.push(`0.6 w ${x.toFixed(2)} ${(this.H - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`); } }
  wrap(str, width, size, bold) { const out = []; String(str ?? '').split('\n').forEach(par => { const words = par.split(/\s+/).filter(Boolean); let cur = ''; if (!words.length) { out.push(''); return; } words.forEach(w => { const t = cur ? cur + ' ' + w : w; if (this.width(t, size, bold) <= width) cur = t; else { if (cur) out.push(cur); while (this.width(w, size, bold) > width && w.length > 1) { let k = w.length; while (k > 1 && this.width(w.slice(0, k), size, bold) > width) k--; out.push(w.slice(0, k)); w = w.slice(k); } cur = w; } }); if (cur) out.push(cur); }); return out; }
  para(str, { size = 9.5, bold = false, rgb = [17, 24, 39], gap = 4, indent = 0, lh = 1.32 } = {}) { const lines = this.wrap(str, this.W - 2 * this.M - indent, size, bold); lines.forEach(l => { this.ensure(size * lh); this.text(this.M + indent, this.y + size, l, size, bold, rgb); this.y += size * lh; }); this.y += gap; }
  h1(str) { this.ensure(30); this.text(this.M, this.y + 16, str, 16, true, [11, 37, 64]); this.y += 24; }
  h2(str) { this.ensure(40); this.y += 8; this.text(this.M, this.y + 11, str, 11.5, true, [11, 37, 64]); this.y += 15; this.line(this.M, this.y, this.W - this.M, this.y, 1.2, [11, 37, 64]); this.y += 7; }
  h3(str) { this.ensure(30); this.y += 3; this.text(this.M, this.y + 9.5, str, 9.8, true, [11, 37, 64]); this.y += 14; }
  kv(pairs, cols = 2) { const cw = (this.W - 2 * this.M) / cols; for (let i = 0; i < pairs.length; i += cols) { const row = pairs.slice(i, i + cols); const hs = row.map(([k, v]) => Math.max(this.wrap(String(v ?? '—'), cw * 0.6 - 6, 9, false).length, this.wrap(k, cw * 0.4 - 6, 8.5, true).length)); const h = Math.max(...hs) * 11.5 + 4; this.ensure(h); row.forEach(([k, v], j) => { const x = this.M + j * cw; this.wrap(k, cw * 0.4 - 6, 8.5, true).forEach((kl, ki) => this.text(x, this.y + 9 + ki * 11.5, kl, 8.5, true, [75, 85, 99])); this.wrap(String(v ?? '—'), cw * 0.6 - 6, 9, false).forEach((l, li) => this.text(x + cw * 0.4, this.y + 9 + li * 11.5, l, 9)); }); this.y += h; } this.y += 4; }
  /* tabla abierta: solo líneas horizontales */
  table(cols, rows, { size = 8.6, head = true } = {}) {
    const total = this.W - 2 * this.M; const ws = cols.map(c => c.w * total);
    const drawHead = () => { this.line(this.M, this.y, this.W - this.M, this.y, 1); let x = this.M; const lines = cols.map((c, i) => this.wrap(c.label, ws[i] - 6, size, true)); const h = Math.max(...lines.map(l => l.length)) * (size + 2) + 6; cols.forEach((c, i) => { lines[i].forEach((l, k) => this.text(c.align === 'right' ? x + ws[i] - 3 : x + 3, this.y + size + 3 + k * (size + 2), l, size, true, [17, 24, 39], c.align === 'right' ? 'right' : 'left')); x += ws[i]; }); this.y += h; this.line(this.M, this.y, this.W - this.M, this.y, 0.5); };
    this.ensure(40); if (head) drawHead();
    rows.forEach(r => { const cells = cols.map((c, i) => this.wrap(String(r[i] ?? '—'), ws[i] - 6, size, !!c.bold)); const h = Math.max(...cells.map(l => l.length)) * (size + 2) + 5; if (this.ensure(h)) { if (head) drawHead(); } let x = this.M; cols.forEach((c, i) => { cells[i].forEach((l, k) => this.text(c.align === 'right' ? x + ws[i] - 3 : x + 3, this.y + size + 2.5 + k * (size + 2), l, size, !!c.bold, [17, 24, 39], c.align === 'right' ? 'right' : 'left')); x += ws[i]; }); this.y += h; });
    this.line(this.M, this.y, this.W - this.M, this.y, 1); this.y += 8;
  }
  /* barras D/I por fila (escaladas por fila) */
  pairBars(rows) {
    if (!rows.length) return; const lab = 170, bw = this.W - 2 * this.M - lab - 70;
    rows.forEach(r => { this.ensure(26); const mx = Math.max(Math.abs(r.R), Math.abs(r.L)) || 1; this.text(this.M, this.y + 12, r.label.slice(0, 40), 8.2, false, [55, 65, 81]); this.rect(this.M + lab, this.y + 3, Math.abs(r.R) / mx * bw, 7, [245, 158, 11]); this.text(this.M + lab + Math.abs(r.R) / mx * bw + 4, this.y + 9.5, 'D ' + fx(r.R, 1), 7.5); this.rect(this.M + lab, this.y + 12, Math.abs(r.L) / mx * bw, 7, [8, 145, 178]); this.text(this.M + lab + Math.abs(r.L) / mx * bw + 4, this.y + 18.5, 'I ' + fx(r.L, 1), 7.5); this.y += 24; });
    this.ensure(14); this.rect(this.M + lab, this.y + 2, 8, 7, [245, 158, 11]); this.text(this.M + lab + 11, this.y + 8.5, 'Derecha', 7.5); this.rect(this.M + lab + 60, this.y + 2, 8, 7, [8, 145, 178]); this.text(this.M + lab + 71, this.y + 8.5, 'Izquierda · barras escaladas por fila', 7.5); this.y += 16;
  }
  note(str, rgb = [243, 244, 246]) { const lines = this.wrap(str, this.W - 2 * this.M - 16, 8.6, false); const h = lines.length * 11 + 10; this.ensure(h); this.rect(this.M, this.y, this.W - 2 * this.M, h, rgb); lines.forEach((l, i) => this.text(this.M + 8, this.y + 14 + i * 11, l, 8.6)); this.y += h + 6; }
  async imageFromDataURL(dataUrl, wPt, hPt) {
    try {
      const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = dataUrl; });
      const c = document.createElement('canvas'); c.width = Math.min(600, img.width); c.height = Math.round(c.width * img.height / img.width); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      const jpg = atob(c.toDataURL('image/jpeg', 0.85).split(',')[1]); const id = this.images.length + 1; this.images.push({ id, data: jpg, w: c.width, h: c.height });
      this.ensure(hPt + 4); this.page.ops.push(`q ${wPt.toFixed(2)} 0 0 ${hPt.toFixed(2)} ${this.M.toFixed(2)} ${(this.H - this.y - hPt).toFixed(2)} cm /Im${id} Do Q`); this.y += hPt + 2; return true;
    } catch (e) { return false; }
  }
  build() {
    const N = this.pages.length; const objs = []; const add = s => { objs.push(s); return objs.length; };
    const catalog = add(null), pagesObj = add(null), f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'), f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const imgIds = this.images.map(im => add({ stream: im.data, dict: `/Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, id: im.id }));
    const xo = this.images.length ? `/XObject << ${this.images.map((im, i) => `/Im${im.id} ${imgIds[i]} 0 R`).join(' ')} >>` : '';
    const kids = [];
    this.pages.forEach((p, i) => {
      // pie y encabezado de página
      const foot = [];
      const t = (x, y, s, sz, b, al) => { const str = this.enc(s); let xx = x; if (al === 'right') xx = x - this.width(s, sz, b); foot.push(`0.29 0.33 0.39 rg BT /${b ? 'F2' : 'F1'} ${sz} Tf ${xx.toFixed(2)} ${(this.H - y).toFixed(2)} Td (${this.esc(str)}) Tj ET`); };
      t(this.M, this.M - 6, `${APP.lab} · ${APP.institution}`, 7.5, false); if (this.meta.header) t(this.W - this.M, this.M - 6, this.meta.header, 7.5, false, 'right');
      foot.push(`0.5 w 0.6 0.6 0.6 RG ${this.M} ${(this.H - this.M + 2).toFixed(2)} m ${this.W - this.M} ${(this.H - this.M + 2).toFixed(2)} l S`);
      t(this.M, this.H - this.M + 14, `Generado con ${APP.name} v${APP.version} · ${new Date().toLocaleString('es-PE')} · Documento de apoyo profesional; no constituye diagnóstico.`, 7, false); t(this.W - this.M, this.H - this.M + 14, `Página ${i + 1} de ${N}`, 7.5, true, 'right');
      const content = p.ops.concat(foot).join('\n');
      const c = add({ stream: content, dict: '' });
      kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${this.W} ${this.H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> ${xo} >> /Contents ${c} 0 R >>`));
    });
    objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
    objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${N} >>`;
    const info = add(`<< /Title (${this.esc(this.enc(this.meta.title || 'Informe LCM'))}) /Producer (${this.esc(APP.name)}) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}) >>`);
    let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'; const offs = [];
    objs.forEach((o, i) => { offs.push(out.length); if (typeof o === 'string') out += `${i + 1} 0 obj\n${o}\nendobj\n`; else out += `${i + 1} 0 obj\n<< ${o.dict} /Length ${o.stream.length} >>\nstream\n${o.stream}\nendstream\nendobj\n`; });
    const xref = out.length; out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const bytes = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255; return bytes;
  }
}

/* ==========================================================
   INFORMES PDF
   ========================================================== */
const PdfReports = {
  header(d, title, a, e, sub) {
    d.rect(d.M, d.y, 34, 34, [15, 27, 46]); d.text(d.M + 17, d.y + 21, 'LCM', 10, true, [60, 200, 240], 'center');
    d.text(d.M + 44, d.y + 14, title, 15, true, [11, 37, 64]); d.text(d.M + 44, d.y + 28, `${APP.lab} · ${APP.institution}`, 8.5, false, [75, 85, 99]);
    d.text(d.W - d.M, d.y + 14, sub, 9, true, [17, 24, 39], 'right'); d.text(d.W - d.M, d.y + 28, `Emitido: ${new Date().toLocaleDateString('es-PE')}`, 8.5, false, [75, 85, 99], 'right');
    d.y += 42; d.line(d.M, d.y, d.W - d.M, d.y, 2, [11, 37, 64]); d.y += 10;
  },
  athleteKV(d, a, e) { const age = num(a.age) ?? Calc.ageFrom(a.birthDate); d.kv([['Deportista', fullName(a)], ['Edad', age ? age + ' años' : '—'], ['Deporte / especialidad', (a.sport || '—') + (a.event ? ' · ' + a.event : '')], ['Nivel', a.level || '—'], ['Dominancia', a.dominance || '—'], ['Pierna de impulso', a.takeoffLeg || '—'], ['Evaluación', `${fmtDate(e.date)} · ${e.label || ''}`], ['Evaluador responsable', e.evaluator || '—']]); },
  vitals(d, s) {
    const vs = (s.vitals || []).slice().sort((a, b) => String(a.time).localeCompare(String(b.time)));
    if (!vs.length) { d.para('Sin signos vitales registrados en esta sesión.', { size: 9, rgb: [75, 85, 99] }); return; }
    const pre = vs.find(v => v.moment === 'pre');
    d.table([{ label: 'Momento', w: .2 }, { label: 'Hora', w: .08 }, { label: 'PA (mmHg)', w: .12, align: 'right' }, { label: 'Categoría PA*', w: .14 }, { label: 'FC (lpm)', w: .09, align: 'right' }, { label: 'Dif. FC', w: .07, align: 'right' }, { label: 'SpO2 %', w: .08, align: 'right' }, { label: 'FR', w: .06, align: 'right' }, { label: 'T °C', w: .07, align: 'right' }, { label: 'Posición', w: .09 }],
      vs.map(v => [(VITAL_MOMENTS.find(m => m[0] === v.moment) || [, v.moment])[1], v.time || '', `${v.sbp ?? '—'}/${v.dbp ?? '—'}`, bpCategory(v.sbp, v.dbp, v.moment) || '—', v.hr ?? '—', pre && v !== pre && num(v.hr) !== null && num(pre.hr) !== null ? (v.hr - pre.hr > 0 ? '+' : '') + (v.hr - pre.hr) : '—', v.spo2 ?? '—', v.rr ?? '—', v.temp ?? '—', (v.position || '') + (v.arm ? ' · ' + v.arm : '')]));
    d.para('*Categoría de una medición aislada según ACC/AHA 2017 (Whelton et al., 2018); descriptiva, no diagnóstica.', { size: 7.5, rgb: [75, 85, 99] });
    vs.flatMap(vitalAlerts).forEach(([t, m]) => d.note(m, t === 'bad' ? [254, 226, 226] : [254, 243, 199]));
  },
  results(d, tss) {
    tss.forEach(t => {
      const test = T(t.testId), r = Ctx.result(t.id); d.h3(`${test.name}${t.status === 'not_completed' ? ' — NO COMPLETADA' : ''}`);
      if (t.status === 'not_completed') { d.para('Motivo: ' + (t.ncReason || '—'), { size: 9 }); return; }
      if (!r || !r.metrics.length) { d.para('Sin datos válidos.', { size: 9, rgb: [75, 85, 99] }); return; }
      const ms = r.metrics.filter(m => m.primary || m.derived || r.metrics.length <= 12 || ['pf', 'h', 'pp', 'tf', 'weight', 'pbf', 'smm'].includes(m.fk)).slice(0, 16);
      d.table([{ label: 'Variable', w: .46 }, { label: 'Lado', w: .12 }, { label: 'Resultado', w: .2, align: 'right' }, { label: 'CV %', w: .1, align: 'right' }, { label: 'n', w: .12, align: 'right' }], ms.map(m => [m.label + (m.estimated ? ' (ESTIMADO)' : ''), m.side === 'B' ? '—' : sideName(m.side), `${fx(m.value, Math.abs(m.value) < 10 ? 2 : 1)} ${m.unit}`, fx(m.cv, 1), m.n ?? '']).concat(r.derived.map(x => [x.label, x.side ? sideName(x.side) : '—', `${fx(x.value, 2)} ${x.unit}`, '', ''])));
      if (r.pairs.length) d.table([{ label: 'Comparación D/I', w: .4 }, { label: 'Derecha', w: .14, align: 'right' }, { label: 'Izquierda', w: .14, align: 'right' }, { label: 'Asim. %', w: .1, align: 'right' }, { label: 'Lectura', w: .22 }], r.pairs.map(p => [`${p.label} (${p.unit})`, fx(p.R, 2), fx(p.L, 2), fx(p.asym, 1), p.exceedsCV === null ? 'Descriptiva' : p.exceedsCV ? 'Supera la variabilidad entre intentos' : 'Dentro de la variabilidad']));
      if (t.interpretationNote) d.para('Nota del evaluador: ' + t.interpretationNote, { size: 8.8 });
      (r.flagsQC || []).forEach(f => d.note(f));
    });
  },
  async signature(d, e, name) {
    const c = Ctx.consent(e.id); const rep = DB.where('reports', r => r.evaluationId === e.id)[0];
    d.ensure(90); d.y += 14; const sig = rep?.evaluatorSig || c?.evaluatorSig; if (sig) await d.imageFromDataURL(sig, 150, 50); else d.y += 40;
    d.line(d.M, d.y, d.M + 220, d.y, 0.8); d.y += 4; d.text(d.M, d.y + 9, name || e.evaluator || 'Evaluador', 9, true); d.text(d.M, d.y + 21, APP.lab, 8.5, false, [75, 85, 99]); d.y += 28;
  },
  save(d, name) { const bytes = d.build(); download(name, new Blob([bytes], { type: 'application/pdf' })); toast('PDF generado: ' + name); return bytes; },
  /* --------- PDF de una sesión --------- */
  async session(s) {
    const e = DB.get('evaluations', s.evaluationId), a = DB.get('athletes', s.athleteId); const tss = (s.testIds || []).map(id => Ctx.ts(e.id, id)).filter(Boolean);
    const d = new PdfDoc({ title: `Informe de sesión ${s.n} - ${fullName(a)}`, header: `${fullName(a)} · Sesión ${s.n} · ${fmtDate(s.date)}` });
    this.header(d, `Informe de la sesión ${s.n}`, a, e, `Sesión ${s.n} · ${fmtDate(s.date)}`);
    d.h2('1. Datos generales'); this.athleteKV(d, a, e);
    const st = tss.map(t => t.startedAt).filter(Boolean).sort()[0], en = tss.map(t => t.finishedAt).filter(Boolean).sort().pop();
    d.kv([['Fecha / hora programada', `${fmtDate(s.date)} ${s.time || ''}`], ['Inicio – fin de pruebas', st ? `${new Date(st).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })} – ${en ? new Date(en).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '—'}` : '—'], ['Evaluador(es) de la sesión', s.checkin?.evaluator || e.evaluator || '—'], ['Estado de la sesión', s.status === 'closed' ? 'Cerrada' : 'Abierta']]);
    d.h2('2. Condiciones pretest (check-in)');
    const c = s.checkin || {};
    if (s.checkin) d.kv([['Sueño', c.sleep != null ? c.sleep + ' h' : '—'], ['Fatiga / dolor', `${c.fatigue ?? '—'}/10 · ${c.pain ?? '—'}/10${c.painSite ? ' (' + c.painSite + ')' : ''}`], ['DOMS', c.doms != null ? c.doms + '/10' : '—'], ['Entrenamiento 24 h / 48 h', `${c.train24 || '—'} / ${c.train48 || '—'}`], ['Cafeína', c.caffeine === 'si' ? 'Sí ' + (c.caffeineDetail || '') : 'No'], ['Última comida', c.meal || '—'], ['Hidratación', c.hydration || '—'], ['Medicación', c.medication === 'si' ? 'Sí: ' + (c.medicationDetail || '') : 'No'], ['Lesión / molestia nueva', c.newInjury === 'si' ? 'Sí: ' + (c.newInjuryDetail || '') : 'No'], ['Masa del día', c.mass ? c.mass + ' kg' : '—'], ['Ambiente', `${c.temp ?? '—'} °C · ${c.hum ?? '—'} % HR`], ['Superficie / calzado', `${c.surface || '—'} / ${c.footwear || '—'}`]]);
    else d.para('Check-in no registrado.', { size: 9, rgb: [185, 28, 28] });
    (s.alerts || []).forEach(([t, m]) => d.note(m, t === 'bad' ? [254, 226, 226] : t === 'warn' ? [254, 243, 199] : [239, 246, 255]));
    d.h2('3. Signos vitales'); this.vitals(d, s);
    d.h2('4. Pruebas de la sesión');
    d.table([{ label: 'Prueba', w: .34 }, { label: 'Estado', w: .14 }, { label: 'Intentos (válidos / repetidos)', w: .16, align: 'right' }, { label: 'Equipo / código', w: .2 }, { label: 'Calibración', w: .16 }], tss.map(t => { const tr = Ctx.trials(t.id); return [T(t.testId).name, statusLabel(t.status), `${tr.filter(x => x.status === 'valid').length} / ${tr.filter(x => x.status === 'repeat').length}`, `${t.prep?.equipment || '—'} ${t.prep?.equipmentCode || ''}`, t.prep?.calibration || '—']; }));
    d.h2('5. Resultados'); this.results(d, tss.filter(t => ['completed', 'not_completed', 'in_progress'].includes(t.status)));
    const pairs = tss.flatMap(t => (Ctx.result(t.id)?.pairs || []).filter(p => p.key && p.R !== null && p.L !== null).map(p => ({ label: `${T(t.testId).short} · ${p.label}`, R: p.R, L: p.L })));
    if (pairs.length) { d.h3('Comparación derecha / izquierda (variables principales)'); d.pairBars(pairs.slice(0, 14)); }
    d.h2('6. Cierre de la sesión');
    if (s.close) d.kv([['RPE de la sesión', s.close.sRPE ?? '—'], ['Duración de las pruebas', s.close.durationMin != null ? s.close.durationMin + ' min' : '—'], ['Carga de la sesión (RPE × min)', s.close.sessionLoad ?? '—'], ['Estado al finalizar', s.close.state || '—']]);
    if (s.close?.obs) d.para('Observaciones: ' + s.close.obs, { size: 9 });
    if (!s.close) d.para('La sesión no ha sido cerrada formalmente.', { size: 9, rgb: [75, 85, 99] });
    d.note('Este informe describe el desempeño en las condiciones de la sesión. No constituye diagnóstico médico, identificación de causas de lesión ni autorización de retorno deportivo. Las diferencias entre extremidades se interpretan frente a la variabilidad entre intentos y junto con la valoración profesional.');
    await this.signature(d, e, s.checkin?.evaluator);
    return this.save(d, `LCM_Sesion${s.n}_${(a.lastName || 'deportista').split(' ')[0]}_${s.date || todayStr()}.pdf`);
  },
  /* --------- PDF del informe integrado de la evaluación --------- */
  async evaluation(e) {
    const a = DB.get('athletes', e.athleteId); const rep = DB.where('reports', r => r.evaluationId === e.id)[0] || reportDraft(e);
    const d = new PdfDoc({ title: `Informe integrado - ${fullName(a)}`, header: `${fullName(a)} · Evaluación ${fmtDate(e.date)}` });
    this.header(d, 'Informe de evaluación integrada', a, e, `Evaluación ${fmtDate(e.date)}`);
    if (!rep.issuedAt) d.note('BORRADOR: el informe aún no ha sido emitido por el evaluador.', [254, 243, 199]);
    let n = 1; const H = t => d.h2(`${n++}. ${t}`);
    H('Datos del deportista'); this.athleteKV(d, a, e);
    H('Objetivo'); d.para(e.objective || a.objective || '—');
    H('Antecedentes'); const inj = Ctx.injuries(a.id);
    if (inj.length) d.table([{ label: 'Fecha', w: .13 }, { label: 'Zona', w: .17 }, { label: 'Lado', w: .1 }, { label: 'Diagnóstico referido', w: .26 }, { label: 'Gravedad', w: .16 }, { label: 'Estado', w: .18 }], inj.map(i => [fmtDate(i.date) + (i.approx ? ' (aprox.)' : ''), i.zone, sideName(i.side), i.diagnosis || '—', i.severity || '—', i.status || '—'])); else d.para('Sin antecedentes registrados.');
    H('Cuestionarios'); const qs = Ctx.questionnaires(e.id).filter(q => q.scores);
    if (qs.length) d.table([{ label: 'Instrumento', w: .25 }, { label: 'Escala', w: .35 }, { label: 'Bruto', w: .2, align: 'right' }, { label: 'Puntaje', w: .2, align: 'right' }], qs.flatMap(q => Object.values(q.scores).map(sc => [q.instrument + (q.extra?.side ? ` (${sideName(q.extra.side)})` : ''), sc.label, `${fx(sc.raw, 0)}${sc.max ? '/' + sc.max : ''}`, `${fx(sc.value, 1)} ${sc.unit}`]))); else d.para('No se aplicaron o no se completaron.');
    H('Sesiones, condiciones y signos vitales');
    for (const s of Ctx.sessions(e.id)) { d.h3(`Sesión ${s.n} · ${fmtDate(s.date)} ${s.time || ''}`); const c = s.checkin; d.para(c ? `Sueño ${c.sleep ?? '—'} h · fatiga ${c.fatigue ?? '—'}/10 · dolor ${c.pain ?? '—'}/10 · masa ${c.mass ?? '—'} kg · ${c.temp ?? '—'} °C${s.close ? ` · RPE de sesión ${s.close.sRPE ?? '—'} · ${s.close.durationMin ?? '—'} min` : ''}` : 'Sin check-in.', { size: 8.8 }); this.vitals(d, s); }
    H('Resultados'); this.results(d, Ctx.testSessions(e.id).filter(t => t.status !== 'pending'));
    H('Comparación derecha / izquierda'); const pairs = collectPairs(e.id).filter(p => p.R !== null && p.L !== null);
    if (pairs.length) { d.table([{ label: 'Prueba · variable', w: .42 }, { label: 'D', w: .12, align: 'right' }, { label: 'I', w: .12, align: 'right' }, { label: 'Asim. %', w: .1, align: 'right' }, { label: 'Lectura', w: .24 }], pairs.map(p => [`${p.test.short} · ${p.label} (${p.unit})`, fx(p.R, 2), fx(p.L, 2), fx(p.asym, 1), p.exceedsCV === null ? 'Descriptiva' : p.exceedsCV ? 'Supera la variabilidad entre intentos' : 'Dentro de la variabilidad'])); d.pairBars(pairs.filter(p => p.key).slice(0, 12).map(p => ({ label: `${p.test.short} · ${p.label}`, R: p.R, L: p.L }))); }
    else d.para('Sin pruebas bilaterales registradas.');
    H('Hallazgos principales'); d.para(rep.findings || '—');
    const evs = DB.where('evaluations', x => x.athleteId === a.id).sort(byDate); const idx = evs.findIndex(x => x.id === e.id);
    if (idx > 0) { H('Evolución'); const prev = evs[idx - 1]; const cur = DB.where('results', r => r.evaluationId === e.id), old = DB.where('results', r => r.evaluationId === prev.id); const rows = []; cur.forEach(r => r.metrics.filter(m => m.primary).forEach(m => { const o = old.flatMap(x => x.metrics).find(x => x.key === m.key); if (o) { const dd = m.value - o.value, mdc = mdcFor(m.base); rows.push([`${T(r.testId).short} · ${m.label}${m.side !== 'B' ? ' ' + sideShort(m.side) : ''}`, fx(o.value, 2), fx(m.value, 2), (dd > 0 ? '+' : '') + fx(dd, 2), fx(Calc.changePct(o.value, m.value), 1) + ' %', mdc ? (Math.abs(dd) >= mdc.value ? 'Mayor al error de medición' : 'Dentro del error de medición') : 'Cambio observado (sin MDC)']); } })); d.para(`Comparación con la evaluación del ${fmtDate(prev.date)}.`, { size: 9 }); if (rows.length) d.table([{ label: 'Variable', w: .32 }, { label: 'Previa', w: .1, align: 'right' }, { label: 'Actual', w: .1, align: 'right' }, { label: 'Δ', w: .1, align: 'right' }, { label: 'Δ %', w: .1, align: 'right' }, { label: 'Clasificación', w: .28 }], rows); }
    H('Interpretación'); d.para(rep.interpretation || '—');
    H('Aspectos para seguimiento'); d.para(rep.followUp || '—');
    H('Sugerencias para entrenamiento / evaluación'); d.para(rep.suggestions || '—');
    if (rep.recommendations) { H('Recomendaciones'); d.para(rep.recommendations); }
    H('Limitaciones'); d.para(rep.limitations || '—');
    const c = Ctx.consent(e.id); d.note(`Este informe apoya la valoración profesional y el seguimiento. No establece por sí solo diagnóstico, causalidad de lesión ni autorización de retorno a la competencia.${c ? ` Consentimiento informado registrado el ${fmtDate(c.date)} (versión ${c.version}).` : ' Sin consentimiento registrado.'}`);
    await this.signature(d, e, rep.evaluatorName);
    return this.save(d, `LCM_Informe_${(a.lastName || 'deportista').split(' ')[0]}_${e.date}.pdf`);
  }
};

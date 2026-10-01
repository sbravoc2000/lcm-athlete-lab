'use strict';
/* ==========================================================
   LCM Athlete Lab — núcleo: utilidades, almacenamiento, UI
   Todos los datos permanecen en el navegador de este equipo
   (IndexedDB; respaldo en localStorage si IndexedDB no existe).
   No hay llamadas de red en ninguna parte de la aplicación.
   ========================================================== */
const APP = { name: 'LCM Athlete Lab', version: '2.2.0', schema: 2, lab: 'Laboratorio de Ciencias del Movimiento (LCM)', institution: 'Universidad Peruana de Ciencias Aplicadas' };

/* ---------- utilidades ---------- */
APP.sandboxed = (() => { try { if (location.href === 'about:srcdoc' || location.protocol === 'about:') return true; localStorage.getItem('__t'); return false; } catch (e) { return true; } })();
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = (p = 'id') => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nowISO = () => new Date().toISOString();
const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const timeStr = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const fmtDate = s => { if (!s) return '—'; const m = String(s).match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/); if (!m) return esc(s); return m[3] ? `${m[3]}/${m[2]}/${m[1]}` : `${m[2]}/${m[1]}`; };
const num = v => { if (v === '' || v === null || v === undefined) return null; const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const fx = (v, d = 1) => { const n = num(v); return n === null ? '—' : n.toFixed(d); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const debounce = (fn, ms = 400) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const byDate = (a, b) => String(a.date || '').localeCompare(String(b.date || ''));
const sideName = s => ({ R: 'Derecha', L: 'Izquierda', B: 'Bilateral / única' }[s] || s);
const sideShort = s => ({ R: 'D', L: 'I', B: '—' }[s] || s);

/* ---------- almacenamiento ---------- */
const COLLECTIONS = ['athletes', 'consents', 'injuries', 'evaluations', 'sessions', 'questionnaires', 'testSessions', 'trials', 'results', 'references', 'reports', 'documents', 'imports', 'settings'];
const DB = {
  idb: null, mode: 'memory', data: {}, ready: false,
  async init() {
    COLLECTIONS.forEach(c => this.data[c] = []);
    try {
      if (!('indexedDB' in window)) throw new Error('sin IndexedDB');
      this.idb = await new Promise((res, rej) => {
        const rq = indexedDB.open('lcm_athlete_lab', APP.schema);
        rq.onupgradeneeded = () => { const db = rq.result; COLLECTIONS.forEach(c => { if (!db.objectStoreNames.contains(c)) db.createObjectStore(c, { keyPath: 'id' }); }); };
        rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
        setTimeout(() => rej(new Error('timeout IndexedDB')), 4000);
      });
      for (const c of COLLECTIONS) {
        this.data[c] = await new Promise((res, rej) => { const tx = this.idb.transaction(c, 'readonly'); const rq = tx.objectStore(c).getAll(); rq.onsuccess = () => res(rq.result || []); rq.onerror = () => rej(rq.error); });
      }
      this.mode = 'indexeddb';
    } catch (e) {
      console.warn('IndexedDB no disponible, usando localStorage', e);
      try { const raw = localStorage.getItem('lcm_athlete_lab_v2'); if (raw) { const d = JSON.parse(raw); COLLECTIONS.forEach(c => this.data[c] = d[c] || []); } this.mode = 'localstorage'; }
      catch (e2) { this.mode = 'memory'; }
    }
    this.ready = true;
  },
  _lsSave: debounce(function () { try { localStorage.setItem('lcm_athlete_lab_v2', JSON.stringify(DB.data)); } catch (e) { toast('No se pudo guardar en localStorage (¿espacio lleno?)', 'bad'); } }, 250),
  _idbWrite(c, op, v) {
    if (this.mode === 'indexeddb') {
      try { const tx = this.idb.transaction(c, 'readwrite'); const st = tx.objectStore(c); op === 'put' ? st.put(v) : op === 'del' ? st.delete(v) : st.clear(); tx.onerror = () => toast('Error al guardar en IndexedDB: ' + tx.error, 'bad'); }
      catch (e) { toast('Error de almacenamiento: ' + e.message, 'bad'); }
    } else if (this.mode === 'localstorage') this._lsSave();
  },
  all(c) { return this.data[c]; },
  get(c, id) { return this.data[c].find(x => x.id === id) || null; },
  where(c, fn) { return this.data[c].filter(fn); },
  put(c, obj) {
    if (!obj.id) obj.id = uid(c.slice(0, 3));
    obj.updatedAt = nowISO(); if (!obj.createdAt) obj.createdAt = obj.updatedAt;
    const i = this.data[c].findIndex(x => x.id === obj.id);
    if (i >= 0) this.data[c][i] = obj; else this.data[c].push(obj);
    this._idbWrite(c, 'put', JSON.parse(JSON.stringify(obj)));
    App.dirty();
    return obj;
  },
  del(c, id) { this.data[c] = this.data[c].filter(x => x.id !== id); this._idbWrite(c, 'del', id); App.dirty(); },
  clearAll() { COLLECTIONS.forEach(c => { this.data[c] = []; this._idbWrite(c, 'clear'); }); },
  setting(k, v) { let s = this.get('settings', k); if (v === undefined) return s ? s.value : null; this.put('settings', { id: k, value: v }); },
  /* borra en cascada todo lo que pertenece a un deportista */
  deleteAthlete(aid) {
    const evIds = this.where('evaluations', e => e.athleteId === aid).map(e => e.id);
    const tsIds = this.where('testSessions', t => t.athleteId === aid).map(t => t.id);
    this.where('trials', t => tsIds.includes(t.testSessionId)).forEach(t => this.del('trials', t.id));
    ['consents', 'injuries', 'sessions', 'questionnaires', 'testSessions', 'results', 'documents', 'imports'].forEach(c => this.where(c, x => x.athleteId === aid).forEach(x => this.del(c, x.id)));
    this.where('reports', r => evIds.includes(r.evaluationId)).forEach(r => this.del('reports', r.id));
    evIds.forEach(id => this.del('evaluations', id));
    this.del('athletes', aid);
  },
  exportData(athleteId) {
    const out = { app: APP.name, version: APP.version, schema: APP.schema, exportedAt: nowISO(), scope: athleteId ? 'athlete' : 'all', data: {} };
    COLLECTIONS.forEach(c => {
      let rows = this.data[c];
      if (athleteId) {
        if (c === 'athletes') rows = rows.filter(a => a.id === athleteId);
        else if (c === 'trials') { const ts = this.where('testSessions', t => t.athleteId === athleteId).map(t => t.id); rows = rows.filter(t => ts.includes(t.testSessionId)); }
        else if (c === 'reports') { const ev = this.where('evaluations', e => e.athleteId === athleteId).map(e => e.id); rows = rows.filter(r => ev.includes(r.evaluationId)); }
        else if (c === 'settings') rows = [];
        else if (c === 'references') rows = rows;
        else rows = rows.filter(r => r.athleteId === athleteId);
      }
      out.data[c] = rows;
    });
    return out;
  },
  importData(obj, mode) {
    if (!obj || !obj.data || obj.app !== APP.name) throw new Error('El archivo no es un respaldo válido de LCM Athlete Lab.');
    if (mode === 'replace') this.clearAll();
    let n = 0;
    COLLECTIONS.forEach(c => (obj.data[c] || []).forEach(r => { if (r && r.id) { const keep = r.updatedAt, created = r.createdAt; this.put(c, r); r.updatedAt = keep || r.updatedAt; r.createdAt = created || r.createdAt; n++; } }));
    return n;
  }
};

/* ---------- UI: toast, modal, confirm ---------- */
function toast(msg, type = 'ok', ms = 3200) {
  let box = $('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div'); t.className = 'toast ' + type; t.setAttribute('role', 'status'); t.textContent = msg; box.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
function modal({ title, body, wide = false, actions = [], onOpen }) {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true"><div class="mhead"><h2>${title}</h2><button class="btn ghost sm" data-x aria-label="Cerrar">✕</button></div><div class="mbody">${body}</div><div class="mfoot"></div></div>`;
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  bg.addEventListener('click', e => { if (e.target === bg) close(); });
  $('[data-x]', bg).onclick = close;
  const foot = $('.mfoot', bg);
  actions.forEach(a => { const b = document.createElement('button'); b.className = 'btn ' + (a.cls || 'sec'); b.textContent = a.label; b.onclick = () => { const r = a.onClick ? a.onClick(bg) : true; if (r !== false) close(); }; foot.appendChild(b); });
  if (!actions.length) { const b = document.createElement('button'); b.className = 'btn sec'; b.textContent = 'Cerrar'; b.onclick = close; foot.appendChild(b); }
  document.body.appendChild(bg);
  if (onOpen) onOpen(bg, close);
  return { el: bg, close };
}
function confirmBox(title, text, okLabel = 'Confirmar', danger = false, requireText = null) {
  return new Promise(res => {
    let done = false;
    const m = modal({
      title, body: `<p>${text}</p>${requireText ? `<label>Para confirmar escriba: <b>${esc(requireText)}</b></label><input id="cfTxt" autocomplete="off">` : ''}`,
      actions: [{ label: 'Cancelar', cls: 'ghost', onClick: () => { done = true; res(false); } },
      { label: okLabel, cls: danger ? 'bad' : 'ok', onClick: bg => { if (requireText && $('#cfTxt', bg).value.trim() !== requireText) { toast('El texto no coincide', 'warn'); return false; } done = true; res(true); } }]
    });
    const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); if (!done) res(false); } });
    obs.observe(document.body, { childList: true });
  });
}
function download(filename, content, type = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function readFile(file, as = 'text') {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); as === 'dataurl' ? r.readAsDataURL(file) : r.readAsText(file); });
}

/* ---------- formularios declarativos ----------
   Un campo: {k,label,type,unit,opts,req,min,max,step,help,span,ph}
*/
function fieldHTML(f, val, prefix = 'f') {
  const id = prefix + '_' + f.k, span = 'c' + (f.span || 4);
  const req = f.req ? ' <span class="req">*</span>' : '';
  const v = val ?? '';
  let inp;
  if (f.type === 'select') inp = `<select id="${id}" data-k="${f.k}">${(f.opts || []).map(o => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${esc(ol)}</option>`; }).join('')}</select>`;
  else if (f.type === 'textarea') inp = `<textarea id="${id}" data-k="${f.k}" placeholder="${esc(f.ph || '')}">${esc(v)}</textarea>`;
  else if (f.type === 'check') return `<div class="${span}"><label class="check"><input type="checkbox" id="${id}" data-k="${f.k}" ${v ? 'checked' : ''}> ${f.label}</label>${f.help ? `<div class="help">${f.help}</div>` : ''}</div>`;
  else if (f.type === 'number') inp = `<div class="fieldunit"><input id="${id}" data-k="${f.k}" type="number" inputmode="decimal" ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.max !== undefined ? `max="${f.max}"` : ''} step="${f.step || 'any'}" value="${esc(v)}" placeholder="${esc(f.ph || '')}">${f.unit ? `<span>${esc(f.unit)}</span>` : ''}</div>`;
  else inp = `<input id="${id}" data-k="${f.k}" type="${f.type || 'text'}" value="${esc(v)}" placeholder="${esc(f.ph || '')}" ${f.type === 'text' || !f.type ? 'autocomplete="off"' : ''}>`;
  return `<div class="${span}"><label for="${id}">${f.label}${req}</label>${inp}${f.help ? `<div class="help">${f.help}</div>` : ''}</div>`;
}
function readFields(root, fields, prefix = 'f') {
  const out = {}; let ok = true; const errs = [];
  fields.forEach(f => {
    const el = $('#' + prefix + '_' + f.k, root); if (!el) return;
    el.classList.remove('invalid');
    let v = f.type === 'check' ? el.checked : el.value.trim();
    if (f.type === 'number' && v !== '') {
      const n = num(v);
      if (n === null) { ok = false; el.classList.add('invalid'); errs.push(f.label + ': no numérico'); }
      else if ((f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) { ok = false; el.classList.add('invalid'); errs.push(`${f.label}: fuera de rango (${f.min ?? '−∞'}–${f.max ?? '∞'})`); }
      else v = n;
    }
    if (f.req && (v === '' || v === null || v === false)) { ok = false; el.classList.add('invalid'); errs.push(f.label + ': obligatorio'); }
    out[f.k] = v === '' ? null : v;
  });
  return { ok, values: out, errs };
}

/* ---------- iconos (SVG propios) ---------- */
const ICON = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="4"/><path d="M1 21c0-4 4-6 8-6s8 2 8 6"/><path d="M17 4a4 4 0 0 1 0 8M23 21c0-3-2-5-5-6"/></svg>',
  sign: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16"/><path d="M5 16l10-10 3 3-10 10H5z"/></svg>',
  clip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h4"/></svg>',
  form: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/><circle cx="19" cy="18" r="2"/></svg>',
  lib: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4z" fill="currentColor"/></svg>',
  body: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="4" r="2"/><path d="M7 8h10M12 8v7M12 15l-3 7M12 15l3 7M7 8l-2 6M17 8l2 6"/></svg>',
  jump: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v10M8 6l4-4 4 4"/><path d="M3 22h18M6 18h12"/></svg>',
  enc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 20l6-8 4 4 8-12"/><circle cx="9" cy="12" r="1.5"/><circle cx="13" cy="16" r="1.5"/></svg>',
  force: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 18h18"/><path d="M5 18c2-10 4-12 6-12s3 4 4 8 2 4 4 4"/></svg>',
  fatigue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5v14h16"/><path d="M7 8l4 3 3 2 5 4"/></svg>',
  gait: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="14" cy="4" r="2"/><path d="M8 21l3-6 3 2 2 4M11 15l1-5 4 2 3-1M12 10l-4 1-2 3"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/><path d="M3 12h4l2-3 3 6 2-3h7"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/></svg>',
  trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>',
  db: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>',
  sym: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18"/><path d="M4 8h5v8H4zM15 6h5v12h-5z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12h14"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v8H6z"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 5v14M5 12l7 7 7-7"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/></svg>',
  timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></svg>'
};
const LOGO = `<svg class="logo" viewBox="0 0 40 40"><defs><linearGradient id="lg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#3cc8f0"/><stop offset="1" stop-color="#7c8cff"/></linearGradient></defs><rect x="1" y="1" width="38" height="38" rx="10" fill="#0f1b2e" stroke="url(#lg)" stroke-width="2"/><path d="M7 27 L13 27 L16 17 L20 31 L24 11 L27 23 L33 23" fill="none" stroke="url(#lg)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="11" r="2.2" fill="#3cc8f0"/></svg>`;
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
/* ==========================================================
   Base interna de referencias
   Tipos: cutoff (punto de corte validado), normative (referencia
   normativa), mdc, mcid, sem, descriptive, method (método/ecuación),
   device (referencia del fabricante).
   Solo se incluyen valores numéricos cuando existe una fuente
   identificable; el laboratorio debe verificar cada entrada antes de
   usarla en publicaciones. Las entradas propias del laboratorio
   (fiabilidad local) se agregan desde la vista «Referencias».
   ========================================================== */
const REF_TYPES = {
  cutoff: { label: 'Punto de corte validado', cls: 'rt-cutoff' },
  normative: { label: 'Valor de referencia', cls: 'rt-normative' },
  mdc: { label: 'MDC', cls: 'rt-mdc' },
  mcid: { label: 'MCID', cls: 'rt-mcid' },
  sem: { label: 'SEM', cls: 'rt-sem' },
  descriptive: { label: 'Diferencia descriptiva', cls: 'rt-descriptive' },
  method: { label: 'Método / ecuación', cls: 'rt-method' },
  device: { label: 'Referencia del fabricante', cls: 'rt-device' }
};
const NO_CUTOFF = 'No existe un punto de corte universal validado para esta prueba y población. Interpretar mediante valores absolutos, comparación bilateral, fiabilidad y evolución longitudinal.';

const SOURCES = {
  binkley1999: { cite: 'Binkley JM, Stratford PW, Lott SA, Riddle DL. The Lower Extremity Functional Scale (LEFS): scale development, measurement properties, and clinical application. Phys Ther. 1999;79(4):371-383.', doi: '10.1093/ptj/79.4.371' },
  martin2005: { cite: 'Martin RL, Irrgang JJ, Burdett RG, Conti SF, Van Swearingen JM. Evidence of validity for the Foot and Ankle Ability Measure (FAAM). Foot Ankle Int. 2005;26(11):968-983.', doi: '10.1177/107110070502601113' },
  roos2003: { cite: 'Roos EM, Lohmander LS. The Knee injury and Osteoarthritis Outcome Score (KOOS): from joint injury to osteoarthritis. Health Qual Life Outcomes. 2003;1:64.', doi: '10.1186/1477-7525-1-64' },
  clarsen2020: { cite: 'Clarsen B, Bahr R, Myklebust G, et al. Improved reporting of overuse injuries and health problems in sport: an update of the Oslo Sport Trauma Research Center questionnaires. Br J Sports Med. 2020;54(7):390-396.', doi: '10.1136/bjsports-2019-101337' },
  devet2006: { cite: 'de Vet HC, Terwee CB, Ostelo RW, Beckerman H, Knol DL, Bouter LM. Minimal changes in health status questionnaires: distinction between minimally detectable change and minimally important change. Health Qual Life Outcomes. 2006;4:54.', doi: '10.1186/1477-7525-4-54' },
  weir2005: { cite: 'Weir JP. Quantifying test-retest reliability using the intraclass correlation coefficient and the SEM. J Strength Cond Res. 2005;19(1):231-240.', doi: '10.1519/15184.1' },
  hopkins2000: { cite: 'Hopkins WG. Measures of reliability in sports medicine and science. Sports Med. 2000;30(1):1-15.', doi: '10.2165/00007256-200030010-00001' },
  bishop2018a: { cite: 'Bishop C, Turner A, Read P. Effects of inter-limb asymmetries on physical and sports performance: a systematic review. J Sports Sci. 2018;36(10):1135-1144.', doi: '10.1080/02640414.2017.1361894' },
  bishop2018b: { cite: 'Bishop C, Read P, Chavda S, Turner A. Asymmetries of the lower limb: the calculation conundrum in strength training and conditioning. Strength Cond J. 2016;38(6):27-32.', doi: '10.1519/SSC.0000000000000264' },
  ardern2016: { cite: 'Ardern CL, Glasgow P, Schneiders A, et al. 2016 Consensus statement on return to sport from the First World Congress in Sports Physical Therapy, Bern. Br J Sports Med. 2016;50(14):853-864.', doi: '10.1136/bjsports-2016-096278' },
  powden2015: { cite: 'Powden CJ, Hoch JM, Hoch MC. Reliability and minimal detectable change of the weight-bearing lunge test: a systematic review. Man Ther. 2015;20(4):524-532.', doi: '10.1016/j.math.2015.01.004' },
  wells1952: { cite: 'Wells KF, Dillon EK. The sit and reach—a test of back and leg flexibility. Res Q. 1952;23(1):115-118.', doi: '10.1080/10671188.1952.10761965' },
  roberts2011: { cite: 'Roberts HC, Denison HJ, Martin HJ, et al. A review of the measurement of grip strength in clinical and epidemiological studies: towards a standardised approach. Age Ageing. 2011;40(4):423-429.', doi: '10.1093/ageing/afr051' },
  dodds2014: { cite: 'Dodds RM, Syddall HE, Cooper R, et al. Grip strength across the life course: normative data from twelve British studies. PLoS One. 2014;9(12):e113637.', doi: '10.1371/journal.pone.0113637' },
  norkin: { cite: 'Norkin CC, White DJ. Measurement of Joint Motion: A Guide to Goniometry. 5th ed. Philadelphia: F.A. Davis; 2016.', doi: '' },
  thorborg2010: { cite: 'Thorborg K, Petersen J, Magnusson SP, Hölmich P. Clinical assessment of hip strength using a hand-held dynamometer is reliable. Scand J Med Sci Sports. 2010;20(3):493-501.', doi: '10.1111/j.1600-0838.2009.00958.x' },
  maffiuletti2016: { cite: 'Maffiuletti NA, Aagaard P, Blazevich AJ, Folland J, Tillin N, Duchateau J. Rate of force development: physiological and methodological considerations. Eur J Appl Physiol. 2016;116(6):1091-1116.', doi: '10.1007/s00421-016-3346-6' },
  comfort2019: { cite: 'Comfort P, Dos\'Santos T, Beckham GK, Stone MH, Guppy SN, Haff GG. Standardization and methodological considerations for the isometric midthigh pull. Strength Cond J. 2019;41(2):57-79.', doi: '10.1519/SSC.0000000000000433' },
  comfort2018: { cite: 'Comfort P, Thomas C, Dos\'Santos T, Jones PA, Suchomel TJ, McMahon JJ. Comparison of methods of calculating dynamic strength index. Int J Sports Physiol Perform. 2018;13(3):320-325.', doi: '10.1123/ijspp.2017-0255' },
  heberlosier2009: { cite: 'Hébert-Losier K, Newsham-West RJ, Schneiders AG, Sullivan SJ. Raising the standards of the calf-raise test: a systematic review. J Sci Med Sport. 2009;12(6):594-602.', doi: '10.1016/j.jsams.2008.12.628' },
  gonzalezbadillo2010: { cite: 'González-Badillo JJ, Sánchez-Medina L. Movement velocity as a measure of loading intensity in resistance training. Int J Sports Med. 2010;31(5):347-352.', doi: '10.1055/s-0030-1248333' },
  sanchezmedina2011: { cite: 'Sánchez-Medina L, González-Badillo JJ. Velocity loss as an indicator of neuromuscular fatigue during resistance training. Med Sci Sports Exerc. 2011;43(9):1725-1734.', doi: '10.1249/MSS.0b013e318213f880' },
  weakley2021: { cite: 'Weakley J, Mann B, Banyard H, McLaren S, Scott T, Garcia-Ramos A. Velocity-based training: from theory to application. Strength Cond J. 2021;43(2):31-49.', doi: '10.1519/SSC.0000000000000560' },
  bosco1983: { cite: 'Bosco C, Luhtanen P, Komi PV. A simple method for measurement of mechanical power in jumping. Eur J Appl Physiol Occup Physiol. 1983;50(2):273-282.', doi: '10.1007/BF00422166' },
  linthorne2001: { cite: 'Linthorne NP. Analysis of standing vertical jumps using a force platform. Am J Phys. 2001;69(11):1198-1204.', doi: '10.1119/1.1397460' },
  mcmahon2018: { cite: 'McMahon JJ, Suchomel TJ, Lake JP, Comfort P. Understanding the key phases of the countermovement jump force-time curve. Strength Cond J. 2018;40(4):96-106.', doi: '10.1519/SSC.0000000000000375' },
  owen2014: { cite: 'Owen NJ, Watkins J, Kilduff LP, Bevan HR, Bennett MA. Development of a criterion method to determine peak mechanical power output in a countermovement jump. J Strength Cond Res. 2014;28(6):1552-1558.', doi: '10.1519/JSC.0000000000000311' },
  impellizzeri2007: { cite: 'Impellizzeri FM, Rampinini E, Maffiuletti N, Marcora SM. A vertical jump force test for assessing bilateral strength asymmetry in athletes. Med Sci Sports Exerc. 2007;39(11):2044-2050.', doi: '10.1249/mss.0b013e31814fb55c' },
  flanagan2008: { cite: 'Flanagan EP, Comyns TM. The use of contact time and the reactive strength index to optimize fast stretch-shortening cycle training. Strength Cond J. 2008;30(5):32-38.', doi: '10.1519/SSC.0b013e318187e25b' },
  noyes1991: { cite: 'Noyes FR, Barber SD, Mangine RE. Abnormal lower limb symmetry determined by function hop tests after anterior cruciate ligament rupture. Am J Sports Med. 1991;19(5):513-518.', doi: '10.1177/036354659101900518' },
  wellsandt2017: { cite: 'Wellsandt E, Failla MJ, Snyder-Mackler L. Limb symmetry indexes can overestimate knee function after anterior cruciate ligament injury. J Orthop Sports Phys Ther. 2017;47(5):334-338.', doi: '10.2519/jospt.2017.7285' },
  plisky2006: { cite: 'Plisky PJ, Rauh MJ, Kaminski TW, Underwood FB. Star Excursion Balance Test as a predictor of lower extremity injury in high school basketball players. J Orthop Sports Phys Ther. 2006;36(12):911-919.', doi: '10.2519/jospt.2006.2244' },
  haugen2016: { cite: 'Haugen T, Buchheit M. Sprint running performance monitoring: methodological and practical considerations. Sports Med. 2016;46(5):641-656.', doi: '10.1007/s40279-015-0446-0' },
  hachana2013: { cite: 'Hachana Y, Chaabène H, Nabli MA, Attia A, Moualhi J, Farhat N, Elloumi M. Test-retest reliability, criterion-related validity, and minimal detectable change of the Illinois agility test in male team sport athletes. J Strength Cond Res. 2013;27(10):2752-2759.', doi: '10.1519/JSC.0b013e3182890ac3' },
  getchell1979: { cite: 'Getchell B. Physical Fitness: A Way of Life. 2nd ed. New York: John Wiley & Sons; 1979.', doi: '' },
  milner2006: { cite: 'Milner CE, Ferber R, Pollard CD, Hamill J, Davis IS. Biomechanical factors associated with tibial stress fracture in female runners. Med Sci Sports Exerc. 2006;38(2):323-328.', doi: '10.1249/01.mss.0000183477.75808.92' },
  winter2009: { cite: 'Winter DA. Biomechanics and Motor Control of Human Movement. 4th ed. Hoboken: Wiley; 2009.', doi: '10.1002/9780470549148' },
  cooper1968: { cite: 'Cooper KH. A means of assessing maximal oxygen intake: correlation between field and treadmill testing. JAMA. 1968;203(3):201-204.', doi: '10.1001/jama.1968.03140030033008' },
  bangsbo2008: { cite: 'Bangsbo J, Iaia FM, Krustrup P. The Yo-Yo intermittent recovery test: a useful tool for evaluation of physical performance in intermittent sports. Sports Med. 2008;38(1):37-51.', doi: '10.2165/00007256-200838010-00004' },
  leger1988: { cite: 'Léger LA, Mercier D, Gadoury C, Lambert J. The multistage 20 metre shuttle run test for aerobic fitness. J Sports Sci. 1988;6(2):93-101.', doi: '10.1080/02640418808729800' },
  tanaka2001: { cite: 'Tanaka H, Monahan KD, Seals DR. Age-predicted maximal heart rate revisited. J Am Coll Cardiol. 2001;37(1):153-156.', doi: '10.1016/S0735-1097(00)01054-8' },
  daanen2012: { cite: 'Daanen HA, Lamberts RP, Kallen VL, Jin A, Van Meeteren NL. A systematic review on heart-rate recovery to monitor changes in training status in athletes. Int J Sports Physiol Perform. 2012;7(3):251-260.', doi: '10.1123/ijspp.7.3.251' },
  gilgen2019: { cite: 'Gilgen-Ammann R, Schweizer T, Wyss T. RR interval signal quality of a heart rate monitor and an ECG Holter at rest and during exercise. Eur J Appl Physiol. 2019;119(7):1525-1532.', doi: '10.1007/s00421-019-04142-5' },
  mclester2020: { cite: 'McLester CN, Nickerson BS, Kliszczewicz BM, McLester JR. Reliability and agreement of various InBody body composition analyzers as compared to dual-energy X-ray absorptiometry in healthy men and women. J Clin Densitom. 2020;23(3):443-450.', doi: '10.1016/j.jocd.2018.10.008' },
  kyle2004: { cite: 'Kyle UG, Bosaeus I, De Lorenzo AD, et al. Bioelectrical impedance analysis—part II: utilization in clinical practice. Clin Nutr. 2004;23(6):1430-1453.', doi: '10.1016/j.clnu.2004.09.012' },
  glaister2008: { cite: 'Glaister M, Howatson G, Pattison JR, McInnes G. The reliability and validity of fatigue measures during multiple-sprint work: an issue revisited. J Strength Cond Res. 2008;22(5):1597-1601.', doi: '10.1519/JSC.0b013e318181ab80' },
  perezcastilla2019: { cite: 'Pérez-Castilla A, Piepoli A, Delgado-García G, Garrido-Blanca G, García-Ramos A. Reliability and concurrent validity of seven commercially available devices for the assessment of movement velocity at different intensities during the bench press. J Strength Cond Res. 2019;33(5):1258-1265.', doi: '10.1519/JSC.0000000000003118' },
  mayorga2014: { cite: 'Mayorga-Vega D, Merino-Marban R, Viciana J. Criterion-related validity of sit-and-reach tests for estimating hamstring and lumbar extensibility: a meta-analysis. J Sports Sci Med. 2014;13(1):1-14.', doi: '' },
  manufacturer: { cite: 'Manual de usuario / especificaciones técnicas del fabricante del equipo utilizado (versión vigente en el laboratorio).', doi: '' }
};

/* Referencias paramétricas (vinculadas a métricas) */
const BUILTIN_REFS = [
  { id: 'r_lefs_mcid', metric: 'q.LEFS.total', type: 'mcid', value: 9, unit: 'puntos', population: 'Pacientes con disfunción musculoesquelética de miembro inferior (ambulatorio)', protocol: 'LEFS 20 ítems, 0–80', src: 'binkley1999' },
  { id: 'r_lefs_mdc', metric: 'q.LEFS.total', type: 'mdc', value: 9, unit: 'puntos', population: 'Pacientes con disfunción musculoesquelética de miembro inferior', protocol: 'MDC (IC 90 %) informado en el estudio original', src: 'binkley1999' },
  { id: 'r_faamadl_mcid', metric: 'q.FAAM.adl', type: 'mcid', value: 8, unit: 'puntos (%)', population: 'Adultos con trastornos de pie y tobillo', protocol: 'FAAM subescala AVD', src: 'martin2005' },
  { id: 'r_faamadl_mdc', metric: 'q.FAAM.adl', type: 'mdc', value: 5.7, unit: 'puntos (%)', population: 'Adultos con trastornos de pie y tobillo', protocol: 'MDC95 subescala AVD', src: 'martin2005' },
  { id: 'r_faamsp_mcid', metric: 'q.FAAM.sport', type: 'mcid', value: 9, unit: 'puntos (%)', population: 'Adultos con trastornos de pie y tobillo', protocol: 'FAAM subescala Deporte', src: 'martin2005' },
  { id: 'r_faamsp_mdc', metric: 'q.FAAM.sport', type: 'mdc', value: 12.3, unit: 'puntos (%)', population: 'Adultos con trastornos de pie y tobillo', protocol: 'MDC95 subescala Deporte', src: 'martin2005' },
  { id: 'r_koos_mic', metric: 'q.KOOS.*', type: 'mcid', value: '8–10', unit: 'puntos', population: 'Lesión de rodilla / artrosis (orientativo)', protocol: 'Diferencia mínima importante sugerida por los autores; varía según población e intervención', src: 'roos2003', note: 'Orientativo: no se usa como umbral automático.' },
  { id: 'r_ostrc_method', metric: 'q.OSTRC.severity', type: 'method', value: '0–100', unit: 'puntos', population: 'Deportistas (vigilancia de problemas de salud)', protocol: '4 preguntas, últimos 7 días. Problema sustancial: reducción moderada/grave del volumen o rendimiento, o imposibilidad de participar.', src: 'clarsen2020' },
  { id: 'r_wblt_mdc', metric: 'wblt.angle', type: 'mdc', value: '≈4.6–4.7', unit: '°', population: 'Adultos sanos y con patología de tobillo (revisión sistemática)', protocol: 'WBLT con inclinómetro; valores intra/inter-evaluador reportados en la revisión', src: 'powden2015', note: 'Verifique el valor correspondiente a su protocolo (intra vs inter-evaluador).' },
  { id: 'r_wblt_mdcd', metric: 'wblt.dist', type: 'mdc', value: '≈1.1–1.9', unit: 'cm', population: 'Adultos (revisión sistemática)', protocol: 'WBLT distancia dedo–pared', src: 'powden2015', note: 'Verifique el valor correspondiente a su protocolo.' },
  { id: 'r_ybal_ant', metric: 'ybal.ant', type: 'descriptive', value: '≥ 4', unit: 'cm (diferencia anterior D/I)', population: 'Basquetbolistas escolares (EE. UU.)', protocol: 'SEBT, alcance anterior', src: 'plisky2006', note: 'Asociación en una población específica; NO es un punto de corte universal ni aplicable automáticamente a atletismo.' },
  { id: 'r_asym_method', metric: '*.asym', type: 'method', value: '|D−I|/máx(D,I)×100', unit: '%', population: 'General', protocol: 'Ecuación de asimetría interextremidad; interpretar frente a la variabilidad (CV) de la prueba', src: 'bishop2018a' },
  { id: 'r_lsi_caveat', metric: '*.lsi', type: 'descriptive', value: 'LSI', unit: '%', population: 'Post-reconstrucción LCA', protocol: 'El LSI puede sobrestimar la función si ambas extremidades presentan déficit', src: 'wellsandt2017' },
  { id: 'r_rsi_method', metric: 'dj.rsi', type: 'method', value: 'altura (m) / contacto (s)', unit: 'm/s', population: 'General', protocol: 'Drop jump', src: 'flanagan2008' },
  { id: 'r_dsi_method', metric: 'dsi', type: 'method', value: 'PF CMJ / PF IMTP', unit: 'ratio', population: 'Deportistas', protocol: 'Ambos PF brutos (o ambos netos), misma plataforma y sesión', src: 'comfort2018' },
  { id: 'r_bosco_method', metric: 'rj.power', type: 'method', value: 'g²·Tf·Tt/(4·n·(Tt−Tf))', unit: 'W/kg', population: 'General', protocol: 'Saltos continuos 15–60 s en plataforma de contacto', src: 'bosco1983' },
  { id: 'r_vo2_cooper', metric: 'aero.vo2', type: 'method', value: '(d − 504.9)/44.73', unit: 'ml·kg⁻¹·min⁻¹', population: 'Adultos varones (muestra original)', protocol: 'Test de Cooper 12 min', src: 'cooper1968', note: 'VO₂max ESTIMADO. No sustituye análisis de gases.' },
  { id: 'r_vo2_yoyo', metric: 'aero.vo2', type: 'method', value: 'd × 0.0084 + 36.4', unit: 'ml·kg⁻¹·min⁻¹', population: 'Deportistas de deportes intermitentes', protocol: 'Yo-Yo IR1', src: 'bangsbo2008', note: 'VO₂max ESTIMADO.' },
  { id: 'r_vo2_leger', metric: 'aero.vo2', type: 'method', value: '−24.4 + 6.0 × v', unit: 'ml·kg⁻¹·min⁻¹', population: 'Adultos ≥ 18 años', protocol: 'Course Navette 20 m', src: 'leger1988', note: 'VO₂max ESTIMADO.' },
  { id: 'r_hrmax', metric: 'aero.hrmax', type: 'method', value: '208 − 0.7·edad', unit: 'lpm', population: 'Adultos sanos', protocol: 'FCmáx predicha por edad', src: 'tanaka2001', note: 'Estimación poblacional con error individual amplio.' },
  { id: 'r_inbody_dev', metric: 'inbody.*', type: 'device', value: 'Rangos impresos por el equipo', unit: '—', population: 'Referencias internas del fabricante', protocol: 'InBody 370S', src: 'manufacturer', note: 'Los rangos «normal/alto/bajo» del informe InBody son del fabricante; no constituyen puntos de corte clínicos validados para deportistas.' },
  { id: 'r_mdc_formula', metric: '*.mdc', type: 'method', value: 'SEM × 1.96 × √2', unit: '—', population: 'General', protocol: 'MDC95 a partir del SEM', src: 'weir2005' }
];
function refsFor(metric) {
  const user = DB.all('references').filter(r => r.metric === metric);
  const built = BUILTIN_REFS.filter(r => r.metric === metric || (r.metric.endsWith('*') && metric.startsWith(r.metric.slice(0, -1))));
  return [...user, ...built];
}
/* MDC disponible (primero fiabilidad propia del laboratorio) */
function mdcFor(metric) {
  const rs = refsFor(metric);
  const own = rs.find(r => r.own && r.type === 'mdc' && num(r.value) !== null);
  if (own) return { value: num(own.value), ref: own };
  const ownSem = rs.find(r => r.own && r.type === 'sem' && num(r.value) !== null);
  if (ownSem) return { value: Calc.mdc95(ownSem.value), ref: ownSem, derived: true };
  const b = rs.find(r => r.type === 'mdc' && num(r.value) !== null);
  return b ? { value: num(b.value), ref: b } : null;
}
function srcHTML(key) { const s = SOURCES[key]; if (!s) return esc(key); return `${esc(s.cite)}${s.doi ? ` <span class="mono small">DOI: ${esc(s.doi)}</span>` : ''}`; }
function refBadge(type) { const t = REF_TYPES[type] || REF_TYPES.descriptive; return `<span class="reftype ${t.cls}">${t.label}</span>`; }
function refCard(r) {
  const src = r.own ? `Fiabilidad propia del laboratorio${r.srcText ? ' · ' + esc(r.srcText) : ''}` : srcHTML(r.src);
  return `<div class="note neutral" style="margin:6px 0">${refBadge(r.type)} <b>${esc(r.value)}</b> ${esc(r.unit || '')}
  <div class="small muted">Población: ${esc(r.population || '—')} · Protocolo: ${esc(r.protocol || '—')}</div>
  ${r.note ? `<div class="small">${esc(r.note)}</div>` : ''}<div class="tiny muted">Fuente: ${src}</div></div>`;
}
/* ==========================================================
   Cuestionarios autoadministrados y puntuación
   IMPORTANTE: el texto de los ítems es una versión de trabajo en
   español. Para uso clínico/científico formal el laboratorio debe
   reemplazarlo por la versión validada en español disponible para
   cada instrumento y respetar las condiciones de uso de sus autores.
   ========================================================== */
const LEFS_OPTS = [[0, 'Dificultad extrema o incapaz de realizarlo'], [1, 'Bastante dificultad'], [2, 'Dificultad moderada'], [3, 'Un poco de dificultad'], [4, 'Sin dificultad']];
const FAAM_OPTS = [[4, 'Sin dificultad'], [3, 'Dificultad leve'], [2, 'Dificultad moderada'], [1, 'Dificultad extrema'], [0, 'Incapaz de hacerlo'], ['na', 'No aplica']];
const K = { // KOOS: respuestas 0 (sin problema) → 4 (problema extremo)
  freq: ['Nunca', 'Rara vez', 'A veces', 'A menudo', 'Siempre'],
  freqR: ['Siempre', 'A menudo', 'A veces', 'Rara vez', 'Nunca'],
  sev: ['Ninguna', 'Leve', 'Moderada', 'Severa', 'Extrema'],
  painf: ['Nunca', 'Mensualmente', 'Semanalmente', 'Diariamente', 'Siempre'],
  aware: ['Nunca', 'Mensualmente', 'Semanalmente', 'Diariamente', 'Constantemente'],
  mod: ['En absoluto', 'Levemente', 'Moderadamente', 'Severamente', 'Totalmente'],
  conf: ['En absoluto', 'Levemente', 'Moderadamente', 'Severamente', 'Extremadamente']
};
const kopt = arr => arr.map((l, i) => [i, l]);

const QDEFS = {
  LEFS: {
    id: 'LEFS', name: 'LEFS — Lower Extremity Functional Scale', short: 'LEFS', region: 'Función de miembro inferior', range: '0–80 (mayor = mejor función)',
    intro: 'Hoy, ¿tiene o tendría dificultad para realizar alguna de las siguientes actividades debido a su problema de miembro inferior?',
    src: 'binkley1999',
    sections: [{ id: 'all', title: 'Actividades', opts: LEFS_OPTS, layout: 'v', items: [
      'Cualquier actividad habitual de trabajo, casa o estudio', 'Sus pasatiempos, actividades recreativas o deportivas habituales', 'Entrar o salir de la bañera/ducha', 'Caminar entre habitaciones', 'Ponerse los zapatos o calcetines', 'Ponerse en cuclillas', 'Levantar un objeto del suelo (p. ej., una bolsa de compras)', 'Realizar actividades ligeras en casa', 'Realizar actividades pesadas en casa', 'Subir o bajar de un auto', 'Caminar 2 cuadras', 'Caminar 1.5 km (una milla)', 'Subir o bajar 10 escalones (aprox. un piso)', 'Estar de pie 1 hora', 'Estar sentado 1 hora', 'Correr en terreno plano', 'Correr en terreno irregular', 'Hacer giros bruscos mientras corre rápido', 'Saltar en un pie', 'Darse vuelta en la cama']
    }],
    score(ans) {
      const v = QDEFS.LEFS.sections[0].items.map((_, i) => ans['all_' + i]);
      const miss = v.filter(x => x === undefined || x === null).length;
      if (miss) return { valid: false, error: `Faltan ${miss} ítems (el LEFS requiere los 20 ítems).` };
      const t = v.reduce((s, x) => s + num(x), 0);
      return { valid: true, scores: { total: { raw: t, value: t, max: 80, label: 'Total', unit: 'pts', pct: t / 80 * 100 } } };
    },
    metricKey: k => 'q.LEFS.' + k
  },
  FAAM: {
    id: 'FAAM', name: 'FAAM — Foot and Ankle Ability Measure (AVD + Deporte)', short: 'FAAM', region: 'Pie y tobillo', range: '0–100 % por subescala (mayor = mejor)',
    intro: 'Responda cada pregunta según su condición durante la última semana. Si la actividad está limitada por algo distinto de su pie o tobillo, marque «No aplica».',
    src: 'martin2005',
    sections: [
      { id: 'adl', title: 'Actividades de la vida diaria', opts: FAAM_OPTS, layout: 'v', items: ['Estar de pie', 'Caminar en terreno plano', 'Caminar en terreno plano sin zapatos', 'Subir cuestas', 'Bajar cuestas', 'Subir escaleras', 'Bajar escaleras', 'Caminar en terreno irregular', 'Subir y bajar bordillos/veredas', 'Ponerse en cuclillas', 'Ponerse de puntillas', 'Empezar a caminar', 'Caminar 5 minutos o menos', 'Caminar aproximadamente 10 minutos', 'Caminar 15 minutos o más', 'Responsabilidades del hogar', 'Actividades de la vida diaria', 'Cuidado personal', 'Trabajo ligero a moderado (de pie, caminando)', 'Trabajo pesado (empujar/tirar, trepar, cargar)', 'Actividades recreativas'] },
      { id: 'sport', title: 'Deporte', opts: FAAM_OPTS, layout: 'v', items: ['Correr', 'Saltar', 'Aterrizar', 'Arrancar y detenerse rápidamente', 'Movimientos laterales / cambios de dirección', 'Actividades de bajo impacto', 'Capacidad para realizar la actividad con su técnica normal', 'Capacidad para participar en su deporte deseado todo el tiempo que quiera'] }
    ],
    extra: [{ k: 'adl_level', label: '¿Cómo calificaría su nivel actual de función en AVD? (0–100 %)', type: 'number', min: 0, max: 100 }, { k: 'sport_level', label: '¿Cómo calificaría su nivel actual de función en deporte? (0–100 %)', type: 'number', min: 0, max: 100 }],
    score(ans) {
      const sc = {}; const errs = [];
      QDEFS.FAAM.sections.forEach(s => {
        const vals = s.items.map((_, i) => ans[s.id + '_' + i]);
        const miss = vals.filter(x => x === undefined || x === null).length;
        if (miss) { errs.push(`${s.title}: faltan ${miss} ítems`); return; }
        const used = vals.filter(x => x !== 'na').map(num);
        if (!used.length) { errs.push(`${s.title}: todos «No aplica»`); return; }
        const raw = used.reduce((a, b) => a + b, 0), max = used.length * 4;
        sc[s.id] = { raw, max, value: raw / max * 100, label: s.id === 'adl' ? 'AVD' : 'Deporte', unit: '%', answered: used.length };
      });
      if (errs.length) return { valid: false, error: errs.join('; ') };
      return { valid: true, scores: sc };
    },
    metricKey: k => 'q.FAAM.' + k
  },
  KOOS: {
    id: 'KOOS', name: 'KOOS — Knee injury and Osteoarthritis Outcome Score', short: 'KOOS', region: 'Rodilla', range: '0–100 por subescala (100 = sin problemas)',
    intro: 'Responda pensando en su rodilla durante la última semana. Marque una sola opción por pregunta.',
    src: 'roos2003', askSide: true,
    sections: [
      { id: 'S', title: 'Síntomas', layout: 'h', items: [['¿Ha tenido hinchazón en la rodilla?', K.freq], ['¿Ha sentido chasquidos o ruidos al mover la rodilla?', K.freq], ['¿Se le ha trabado o bloqueado la rodilla al moverla?', K.freq], ['¿Ha podido estirar (extender) completamente la rodilla?', K.freqR], ['¿Ha podido doblar (flexionar) completamente la rodilla?', K.freqR], ['¿Qué tan intensa es la rigidez al despertar por la mañana?', K.sev], ['¿Qué tan intensa es la rigidez después de estar sentado, acostado o en reposo más tarde en el día?', K.sev]] },
      { id: 'P', title: 'Dolor', layout: 'h', items: [['¿Con qué frecuencia siente dolor en la rodilla?', K.painf], ['Dolor al girar/pivotar sobre la rodilla', K.sev], ['Dolor al estirar completamente la rodilla', K.sev], ['Dolor al doblar completamente la rodilla', K.sev], ['Dolor al caminar en superficie plana', K.sev], ['Dolor al subir o bajar escaleras', K.sev], ['Dolor en la noche, en la cama', K.sev], ['Dolor sentado o acostado', K.sev], ['Dolor de pie', K.sev]] },
      { id: 'A', title: 'Función en la vida diaria', layout: 'h', items: [['Bajar escaleras', K.sev], ['Subir escaleras', K.sev], ['Levantarse estando sentado', K.sev], ['Estar de pie', K.sev], ['Agacharse / recoger un objeto del suelo', K.sev], ['Caminar en superficie plana', K.sev], ['Subir o bajar de un auto', K.sev], ['Ir de compras', K.sev], ['Ponerse los calcetines', K.sev], ['Levantarse de la cama', K.sev], ['Quitarse los calcetines', K.sev], ['Estar acostado en la cama (girarse, mantener la posición)', K.sev], ['Entrar o salir de la bañera/ducha', K.sev], ['Estar sentado', K.sev], ['Sentarse y levantarse del inodoro', K.sev], ['Tareas domésticas pesadas', K.sev], ['Tareas domésticas ligeras', K.sev]] },
      { id: 'SP', title: 'Deporte y recreación', layout: 'h', items: [['Ponerse en cuclillas', K.sev], ['Correr', K.sev], ['Saltar', K.sev], ['Girar/pivotar sobre la rodilla afectada', K.sev], ['Arrodillarse', K.sev]] },
      { id: 'QOL', title: 'Calidad de vida relacionada con la rodilla', layout: 'h', items: [['¿Con qué frecuencia es consciente de su problema de rodilla?', K.aware], ['¿Ha modificado su estilo de vida para evitar actividades que puedan dañar su rodilla?', K.mod], ['¿Cuánto le preocupa la falta de confianza en su rodilla?', K.conf], ['En general, ¿cuánta dificultad tiene con su rodilla?', K.sev]] }
    ],
    score(ans) {
      const sc = {}; const errs = []; const names = { S: 'Síntomas', P: 'Dolor', A: 'AVD', SP: 'Deporte/Rec', QOL: 'Calidad de vida' };
      QDEFS.KOOS.sections.forEach(s => {
        const vals = s.items.map((_, i) => ans[s.id + '_' + i]); const given = vals.filter(x => x !== undefined && x !== null).map(num);
        const miss = vals.length - given.length;
        if (miss > 2) { errs.push(`${names[s.id]}: ${miss} ítems sin responder (> 2; subescala no calculable)`); return; }
        const m = given.reduce((a, b) => a + b, 0) / given.length;
        sc[s.id] = { raw: given.reduce((a, b) => a + b, 0), meanItem: m, value: 100 - m * 25, label: names[s.id], unit: 'pts', missing: miss };
      });
      if (!Object.keys(sc).length) return { valid: false, error: errs.join('; ') };
      return { valid: true, scores: sc, warnings: errs };
    },
    metricKey: k => 'q.KOOS.' + k
  },
  OSTRC: {
    id: 'OSTRC', name: 'OSTRC-H2 — Cuestionario de problemas de salud (últimos 7 días)', short: 'OSTRC-H2', region: 'Problemas de salud del deportista', range: '0–100 por problema (mayor = mayor impacto)',
    intro: 'Responda pensando en los últimos 7 días. Si tuvo más de un problema de salud, complete un cuestionario por problema.',
    src: 'clarsen2020',
    sections: [{ id: 'q', title: 'Consecuencias del problema', layout: 'v', items: [
      ['¿Ha tenido alguna dificultad para participar en el entrenamiento y la competición normal debido a una lesión, enfermedad u otro problema de salud?', [[0, 'Participación completa sin problemas de salud'], [8, 'Participación completa, pero con un problema de salud'], [17, 'Participación reducida debido a un problema de salud'], [25, 'No pude participar debido a un problema de salud']]],
      ['¿En qué medida ha reducido su volumen de entrenamiento debido a una lesión, enfermedad u otro problema de salud?', [[0, 'Sin reducción'], [6, 'En poca medida'], [13, 'En medida moderada'], [19, 'En gran medida'], [25, 'No pude participar en absoluto']]],
      ['¿En qué medida una lesión, enfermedad u otro problema de salud ha afectado su rendimiento?', [[0, 'Sin efecto'], [6, 'En poca medida'], [13, 'En medida moderada'], [19, 'En gran medida'], [25, 'No pude participar en absoluto']]],
      ['¿En qué medida ha experimentado síntomas o molestias de salud?', [[0, 'Sin síntomas / molestias'], [8, 'En poca medida'], [17, 'En medida moderada'], [25, 'En gran medida']]]
    ] }],
    extra: [{ k: 'type', label: 'Tipo de problema (si existe)', type: 'select', opts: [['', '—'], ['lesion', 'Lesión'], ['enfermedad', 'Enfermedad'], ['otro', 'Otro']] }, { k: 'area', label: 'Zona corporal / sistema afectado', type: 'text' }, { k: 'days', label: 'Días completos sin poder participar (últimos 7 días)', type: 'number', min: 0, max: 7 }],
    score(ans) {
      const v = [0, 1, 2, 3].map(i => ans['q_' + i]); const miss = v.filter(x => x === undefined || x === null).length;
      if (miss) return { valid: false, error: `Faltan ${miss} preguntas.` };
      const n = v.map(num), t = n.reduce((a, b) => a + b, 0);
      const substantial = n[0] === 25 || n[1] >= 13 || n[2] >= 13;
      return { valid: true, scores: { severity: { raw: t, value: t, max: 100, label: 'Severidad', unit: 'pts' } }, classification: t === 0 ? 'Sin problema de salud reportado' : (substantial ? 'Problema de salud sustancial (definición OSTRC: reducción moderada/grave del volumen o rendimiento, o imposibilidad de participar)' : 'Problema de salud reportado (no sustancial según definición OSTRC)') };
    },
    metricKey: k => 'q.OSTRC.' + k
  }
};
function qItems(sec) { return sec.items.map(it => Array.isArray(it) ? { text: it[0], opts: Array.isArray(it[1][0]) ? it[1] : kopt(it[1]) } : { text: it, opts: sec.opts }); }
/* ==========================================================
   Biblioteca de pruebas (TestDefinition)
   ========================================================== */
const FILTER_DOMAINS = ['Composición corporal', 'Movilidad', 'Flexibilidad', 'Fuerza', 'RFD', 'Resistencia de fuerza', 'Fuerza–velocidad', 'Potencia', 'Salto', 'Reactividad', 'Equilibrio', 'Control motor', 'Pruebas funcionales', 'Velocidad', 'Agilidad', 'Carrera', 'Biomecánica', 'Capacidad cardiorrespiratoria'];
const DASH_DOMAINS = ['Composición', 'Movilidad', 'Fuerza', 'RFD', 'Resistencia', 'Potencia', 'Reactividad', 'Control', 'Velocidad', 'Biomecánica', 'Cardiorrespiratorio'];

const STOP_STD = ['Dolor agudo, punzante o que aumenta respecto al valor basal (≥ 2 puntos sobre la escala 0–10 registrada en el check-in).', 'Sensación de inestabilidad o bloqueo articular.', 'Mareo, náusea, palidez o malestar general.', 'Solicitud del deportista (derecho a detener sin justificación).', 'Falla del equipo o pérdida de registro que no pueda resolverse.'];
const REPEAT_REASONS = ['Técnica incorrecta', 'Pérdida de equilibrio / apoyo adicional', 'No respetó la posición inicial', 'Contramovimiento no permitido', 'Manos se separaron de la cadera', 'Aterrizaje fuera de zona / inestable', 'Esfuerzo no máximo (según evaluador o deportista)', 'Inicio anticipado / pre-tensión incorrecta', 'Error del equipo / señal defectuosa', 'Error de registro del evaluador', 'Otro'];

const ISO_COMMON = {
  domains: ['Fuerza', 'RFD'], dash: 'Fuerza', bilateral: true, nTrials: 3, rest: 60, time: 15, session: 1, fatigue: 2,
  activation: 'Calentamiento general 5 min (cicloergómetro o trote suave) + 3 contracciones submáximas progresivas en la posición de prueba (≈50 %, 75 % y 90 % del esfuerzo percibido), 3–5 s cada una, 20–30 s de pausa.',
  familiarization: '1–2 contracciones submáximas en posición exacta para verificar fijación, comodidad del contacto y ausencia de dolor.',
  valid: ['Posición y ángulo articular constantes (verificados con goniómetro).', 'Sin contramovimiento ni pre-tensión excesiva antes del inicio (señal estable).', 'Esfuerzo máximo sostenido 3–5 s.', 'Sin compensaciones visibles (elevación de pelvis, uso de manos no permitido).'],
  repeat: ['Pico > 5 % superior al anterior en el 3.er intento (realizar un intento adicional hasta que no haya mejora).', 'Movimiento de la fijación o del sensor.', 'Contramovimiento previo a la contracción.'],
  stop: STOP_STD,
  fields: [
    { k: 'pf', label: 'Fuerza pico', unit: 'N', min: 0, max: 5000, key: true, perKg: true, req: true },
    { k: 'rfd100', label: 'RFD 0–100 ms', unit: 'N/s', min: 0, max: 60000, perKg: false },
    { k: 'rfd200', label: 'RFD 0–200 ms', unit: 'N/s', min: 0, max: 60000 },
    { k: 'imp200', label: 'Impulso 0–200 ms', unit: 'N·s', min: 0, max: 2000 }
  ],
  config: [
    { k: 'angle', label: 'Ángulo articular de prueba', type: 'number', unit: '°', span: 3 },
    { k: 'lever', label: 'Brazo de palanca (eje articular–sensor)', type: 'number', unit: 'm', span: 3, help: 'Si se registra, se calcula el torque = F × brazo.' },
    { k: 'device', label: 'Sensor', type: 'select', opts: ['Celda de carga', 'Dinamómetro manual fijado con correa', 'Plataforma de fuerza AMTI', 'Otro'], span: 3 },
    { k: 'fs', label: 'Frecuencia de muestreo', type: 'number', unit: 'Hz', span: 3 }
  ],
  variables: 'Fuerza pico (N), fuerza relativa (N/kg), torque (N·m) y torque relativo (N·m/kg) si se registra brazo de palanca, RFD 0–100 y 0–200 ms (N/s), impulso 0–200 ms (N·s), asimetría D/I.',
  equations: ['Fuerza relativa = F pico / masa corporal', 'Torque = F pico × brazo de palanca', 'RFD(0–t) = [F(t) − F(0)] / t', 'Asimetría % = |D − I| / máx(D, I) × 100'],
  units: 'N, N/kg, N·m, N·m/kg, N/s, N·s, %',
  normalization: 'Por masa corporal del día (check-in) o de la composición corporal de la misma evaluación. El torque normaliza por brazo de palanca, lo que mejora la comparación entre sesiones si cambia la colocación.',
  interpretation: 'Comparar valores absolutos y relativos, diferencia D/I frente a la variabilidad intra-sesión (CV) y evolución. La RFD temprana (< 100 ms) es más variable que la fuerza pico; requiere onset identificado con el mismo criterio y frecuencia de muestreo suficiente (≥ 1000 Hz recomendado).',
  error: 'Depende del montaje (rigidez de fijación, ángulo, brazo de palanca). Se recomienda que el laboratorio estime su propio SEM/MDC (test–retest) y lo registre en Referencias.',
  refs: ['maffiuletti2016', 'thorborg2010', 'bishop2018a', 'weir2005']
};
const JUMP_COMMON = {
  domains: ['Potencia', 'Salto'], dash: 'Potencia', nTrials: 3, rest: 60, time: 10, session: 2, fatigue: 1,
  activation: '5 min de trote/skipping + movilidad dinámica de cadera y tobillo + 5 sentadillas con peso corporal + 2–3 saltos progresivos (50–75–90 %).',
  familiarization: '2 saltos submáximos con la técnica requerida; corregir posición de manos y aterrizaje.',
  stop: STOP_STD,
  valid: ['Manos en la cadera durante todo el salto (excepto Abalakov).', 'Despegue y aterrizaje en la misma zona de la plataforma.', 'Piernas extendidas durante el vuelo (no recoger rodillas).', 'Aterrizaje controlado.'],
  repeat: ['Manos se separan de la cadera.', 'Flexión de rodillas o caderas durante el vuelo (sobreestima el tiempo de vuelo).', 'Aterrizaje fuera de la plataforma.', 'Pérdida de equilibrio.'],
  config: [{ k: 'system', label: 'Sistema de medición', type: 'select', opts: ['Plataforma de fuerza AMTI', 'Plataforma de contacto', 'App/video (tiempo de vuelo)', 'Otro'], span: 4 }, { k: 'heightMethod', label: 'Método de cálculo de altura', type: 'select', opts: ['Tiempo de vuelo (h = g·t²/8)', 'Velocidad de despegue (impulso–momento)', 'Desplazamiento del centro de masa (3D)', 'Otro'], span: 4 }, { k: 'fs', label: 'Frecuencia de muestreo', type: 'number', unit: 'Hz', span: 4 }],
  equations: ['Altura por tiempo de vuelo: h = g · tv² / 8', 'Altura por impulso–momento: v_desp = ∫(F − P)/m dt ; h = v_desp² / (2g)', 'Potencia relativa = P pico / masa'],
  units: 'cm, s, N, N·s, W, W/kg',
  normalization: 'Potencia y fuerza por masa corporal (W/kg, N/kg). Altura no requiere normalización.',
  error: 'El método de altura (tiempo de vuelo vs impulso–momento) produce valores distintos: nunca mezclar métodos en el seguimiento. Registrar el SEM propio del laboratorio.',
  refs: ['bosco1983', 'linthorne2001', 'mcmahon2018', 'owen2014']
};
const JUMP_FIELDS = [
  { k: 'h', label: 'Altura de salto', unit: 'cm', min: 0, max: 120, key: true, help: 'Si se deja vacío y se ingresa tiempo de vuelo, se calcula.' },
  { k: 'tf', label: 'Tiempo de vuelo', unit: 's', min: 0, max: 1.2 },
  { k: 'pf', label: 'Fuerza pico', unit: 'N', min: 0, max: 10000, perKg: true },
  { k: 'pp', label: 'Potencia pico', unit: 'W', min: 0, max: 15000, perKg: true },
  { k: 'imp', label: 'Impulso neto propulsivo', unit: 'N·s', min: 0, max: 1000 }
];
/* variables por pierna con doble plataforma (AMTI izquierda + derecha) */
const DUAL_FIELDS = [
  { k: 'pfR', label: 'Fuerza pico propulsiva pierna D (2 plataformas)', unit: 'N', min: 0, max: 6000, opt: true },
  { k: 'pfL', label: 'Fuerza pico propulsiva pierna I (2 plataformas)', unit: 'N', min: 0, max: 6000, opt: true },
  { k: 'impR', label: 'Impulso propulsivo bruto pierna D', unit: 'N·s', min: 0, max: 1500, opt: true },
  { k: 'impL', label: 'Impulso propulsivo bruto pierna I', unit: 'N·s', min: 0, max: 1500, opt: true },
  { k: 'lpfR', label: 'Fuerza pico de aterrizaje pierna D', unit: 'N', min: 0, max: 12000, opt: true, hib: false },
  { k: 'lpfL', label: 'Fuerza pico de aterrizaje pierna I', unit: 'N', min: 0, max: 12000, opt: true, hib: false }
];
const HOP_COMMON = {
  domains: ['Pruebas funcionales', 'Potencia'], dash: 'Potencia', bilateral: true, nTrials: 3, rest: 45, time: 12, session: 2, fatigue: 1,
  activation: 'Trote 5 min, movilidad dinámica, 5 saltos bipodales submáximos y 3 saltos unipodales submáximos por lado.',
  familiarization: '1–3 saltos submáximos por pierna hasta ejecutar la técnica correctamente.',
  valid: ['Aterrizaje sobre la misma pierna, mantenido 2 s sin tocar el suelo con la otra pierna ni con las manos.', 'Sin saltos adicionales tras el aterrizaje.', 'Brazos libres (o según protocolo definido y constante).'],
  repeat: ['Pérdida de equilibrio o contacto de la otra pierna.', 'Salto adicional para estabilizar.', 'Pisar la línea (crossover).'],
  stop: STOP_STD,
  config: [{ k: 'arms', label: 'Uso de brazos', type: 'select', opts: ['Libres', 'Manos en la cadera'], span: 4 }, { k: 'measure', label: 'Medición', type: 'select', opts: ['Cinta métrica (punta del pie → talón)', 'Video (Kinovea)'], span: 4 }],
  units: 'cm, %',
  normalization: 'Opcional: distancia / longitud del miembro inferior (% LMI).',
  error: 'Registrar el SEM propio. El LSI puede sobrestimar la función si ambas piernas presentan déficit (Wellsandt 2017).',
  interpretation: 'Interpretar distancia absoluta, relativa a la longitud del miembro y diferencia D/I. Un porcentaje aislado no constituye criterio de alta ni de retorno deportivo.',
  refs: ['noyes1991', 'wellsandt2017', 'ardern2016', 'bishop2018a']
};

const TESTS = [
  /* ---------------- COMPOSICIÓN ---------------- */
  {
    id: 'inbody', name: 'Composición corporal — InBody 370S', short: 'InBody', mode: 'inbody', domains: ['Composición corporal'], dash: 'Composición', bilateral: false, session: 1, order: 1, fatigue: 0, time: 5, nTrials: 1, rest: 0, diagram: 'inbody',
    capacity: 'Composición corporal y masa magra segmentaria (bioimpedancia multifrecuencia).', objective: 'Cuantificar masa, grasa, masa muscular esquelética y distribución segmentaria de masa magra, incluyendo comparación D/I.',
    equipment: ['InBody 370S', 'Tallímetro', 'Toallitas con electrolito (si el fabricante lo indica)'],
    prep: ['Ayuno de 2–3 h (o condición estandarizada del laboratorio) y sin ejercicio intenso en las 12 h previas.', 'Vaciar vejiga antes de la medición.', 'Retirar objetos metálicos, calcetines y prendas pesadas.', 'Registrar hora, última comida, hidratación y fase menstrual cuando corresponda.', 'Limpiar electrodos; ingresar talla, edad y sexo en el equipo.'],
    activation: 'No aplica. Evitar ejercicio antes de la medición: la prueba debe realizarse al inicio de la sesión 1.',
    startPos: 'De pie, descalzo, talones sobre los electrodos posteriores y antepié en los anteriores; brazos separados del tronco ≈ 15–30°, sujetando los electrodos de mano con el pulgar sobre el electrodo superior.',
    execution: 'Permanecer inmóvil y en silencio hasta que el equipo complete la medición (≈ 30–60 s).',
    cue: 'Quédate quieto, respira normal y no hables hasta que termine la medición.',
    familiarization: 'No aplica.', valid: ['Contacto completo de manos y pies con los electrodos.', 'Postura estable durante toda la medición.', 'Condiciones pretest registradas.'],
    repeat: ['Error de contacto informado por el equipo.', 'Movimiento durante la medición.'], stop: ['Portador de marcapasos o dispositivo electrónico implantado (contraindicación del fabricante).', 'Embarazo (según indicaciones del fabricante).'],
    variables: 'Peso, IMC, % grasa, masa grasa, masa muscular esquelética (MME), agua corporal total, masa libre de grasa, masa magra blanda, proteínas, minerales, masa magra segmentaria (brazos, tronco, piernas), grasa segmentaria, impedancias, circunferencias estimadas.',
    equations: ['Diferencia absoluta D − I (kg)', 'Diferencia % = |D − I| / máx(D, I) × 100', 'Relación D/I = D / I'], units: 'kg, %, kg/m², L, Ω',
    normalization: 'Masa magra segmentaria puede expresarse relativa al peso; el seguimiento debe hacerse con el mismo equipo y condiciones.',
    interpretation: 'Los rangos «bajo/normal/alto» impresos por el equipo son referencias del fabricante, no puntos de corte clínicos para deportistas. Una diferencia segmentaria D/I es descriptiva y no indica patología por sí misma.',
    error: 'La BIA es sensible a hidratación, ingesta, ejercicio previo y temperatura. Estimar el error propio con mediciones repetidas.',
    refs: ['kyle2004', 'mclester2020', 'manufacturer'], errorsCommon: ['Medir después de entrenar o con vejiga llena.', 'Brazos pegados al tronco.', 'Pies mal apoyados en electrodos.', 'No registrar hora/ingesta: impide comparar evaluaciones.']
  },
  /* ---------------- FUERZA / PRENSIÓN ---------------- */
  {
    id: 'grip', name: 'Fuerza de prensión — Jamar Plus', short: 'Handgrip', domains: ['Fuerza'], dash: 'Fuerza', bilateral: true, session: 1, order: 20, fatigue: 1, time: 6, nTrials: 3, rest: 60, diagram: 'grip',
    capacity: 'Fuerza isométrica máxima de prensión.', objective: 'Registrar fuerza de prensión máxima por mano como indicador general de fuerza y para seguimiento.',
    equipment: ['Dinamómetro Jamar Plus (digital)', 'Silla sin apoyabrazos'],
    prep: ['Verificar cero del dinamómetro y registrar código del equipo.', 'Ajustar el agarre en la 2.ª posición (o la estandarizada del laboratorio) y mantenerla en reevaluaciones.', 'Registrar mano dominante.'],
    activation: '1–2 contracciones submáximas por mano.',
    startPos: 'Sentado, hombro aducido y en rotación neutra, codo a 90°, antebrazo en posición neutra, muñeca entre 0 y 30° de extensión (posición ASHT).',
    execution: 'Apretar al máximo durante 3 s. Alternar manos.', cue: 'Aprieta lo más fuerte que puedas… ¡fuerte, fuerte, fuerte! … y suelta.',
    familiarization: '1 intento submáximo por mano.', valid: ['Posición mantenida (codo 90°, sin apoyar el brazo).', 'Esfuerzo máximo 3 s.'], repeat: ['Cambio de posición del codo/hombro.', 'Dinamómetro apoyado en el cuerpo o en la silla.'], stop: STOP_STD,
    fields: [{ k: 'f', label: 'Fuerza', unit: 'kg', min: 0, max: 120, key: true, req: true }],
    variables: 'Fuerza máxima y media por mano (kg), fuerza relativa (kg/kg), asimetría.', equations: ['Fuerza relativa = F / masa corporal', 'Asimetría % = |D − I| / máx × 100'], units: 'kg',
    normalization: 'Por masa corporal (opcional).', interpretation: 'Existen datos normativos poblacionales por edad y sexo (p. ej., Dodds 2014, población británica). Úselos solo si coinciden población, dinamómetro y protocolo. En deportistas se interpreta mejor longitudinalmente.',
    error: 'Registrar el SEM propio del laboratorio.', refs: ['roberts2011', 'dodds2014'], errorsCommon: ['Codo extendido o apoyado.', 'Cambiar la posición del mango entre evaluaciones.', 'No alternar manos (fatiga).']
  },
  /* ---------------- FLEXIBILIDAD / MOVILIDAD ---------------- */
  {
    id: 'sitreach', name: 'Sit-and-Reach', short: 'Sit & Reach', domains: ['Flexibilidad'], dash: 'Movilidad', bilateral: false, session: 1, order: 10, fatigue: 0, time: 5, nTrials: 3, rest: 15, diagram: 'sitreach',
    capacity: 'Flexibilidad combinada de isquiosurales y región lumbar.', objective: 'Registrar la distancia máxima de alcance en sedestación.',
    equipment: ['Cajón de sit-and-reach', 'Colchoneta'], prep: ['Definir y registrar la convención del cero (p. ej., 23 cm a nivel de los pies o 0 = línea de los pies).', 'Sin calzado.'],
    activation: 'Calentamiento general 5 min; evitar estiramientos estáticos prolongados previos.',
    startPos: 'Sentado, rodillas extendidas, plantas de los pies apoyadas contra el cajón, manos superpuestas.',
    execution: 'Inclinar el tronco adelante deslizando las manos lentamente sobre la regla; mantener 2 s en el máximo.', cue: 'Mantén las rodillas estiradas y lleva las manos lo más lejos posible, despacio, sin rebotes. Aguanta dos segundos.',
    familiarization: '1 intento submáximo.', valid: ['Rodillas extendidas durante todo el alcance.', 'Manos juntas y a la misma altura.', 'Posición mantenida 2 s.'], repeat: ['Flexión de rodillas.', 'Rebote o impulso.', 'Manos desalineadas.'], stop: STOP_STD,
    fields: [{ k: 'd', label: 'Distancia', unit: 'cm', min: -40, max: 70, key: true, req: true }],
    config: [{ k: 'zero', label: 'Convención del cero', type: 'select', opts: ['0 = plantas de los pies', '23 cm = plantas (cajón estándar)', 'Otra'], span: 6 }],
    variables: 'Mejor distancia (cm).', equations: ['Resultado = mejor de 3 intentos'], units: 'cm', normalization: 'No aplica; registrar la convención del cero.',
    interpretation: 'La validez para estimar extensibilidad isquiosural es moderada y para la región lumbar baja (Mayorga-Vega 2014). No identifica el segmento limitante ni la lateralidad.', error: 'Registrar SEM propio.', refs: ['wells1952', 'mayorga2014'], errorsCommon: ['Flexionar rodillas.', 'Rebote.', 'Cambiar la convención del cero entre evaluaciones.']
  },
  {
    id: 'wblt', name: 'Weight-Bearing Lunge Test (WBLT)', short: 'WBLT', domains: ['Movilidad'], dash: 'Movilidad', bilateral: true, session: 1, order: 11, fatigue: 0, time: 8, nTrials: 3, rest: 10, diagram: 'wblt',
    capacity: 'Dorsiflexión de tobillo en carga.', objective: 'Cuantificar el rango de dorsiflexión en carga por lado.',
    equipment: ['Pared', 'Cinta métrica fijada al suelo perpendicular a la pared', 'Inclinómetro digital o app validada'],
    prep: ['Fijar cinta perpendicular a la pared.', 'Calibrar inclinómetro a 0° sobre superficie horizontal.', 'Descalzo.'],
    activation: 'Movilidad activa suave de tobillo (10 repeticiones); sin estiramiento agresivo.',
    startPos: 'Pie evaluado sobre la cinta, segundo dedo y centro del talón alineados con la cinta; pie contralateral atrás; manos en la pared.',
    execution: 'Llevar la rodilla hacia la pared sin despegar el talón. Alejar progresivamente el pie hasta la máxima distancia en que la rodilla toca la pared con el talón apoyado. Medir distancia dedo–pared (cm) y/o ángulo de la tibia con inclinómetro 15 cm bajo la tuberosidad tibial.',
    cue: 'Lleva la rodilla hacia la pared en línea con el segundo dedo, sin levantar el talón.',
    familiarization: '2–3 repeticiones por lado.', valid: ['Talón en contacto con el suelo.', 'Rodilla alineada con el 2.º dedo (sin valgo/varo).', 'Pie sin rotación.'], repeat: ['Talón se levanta.', 'Rodilla se desvía medial o lateralmente.', 'Pie rota.'], stop: STOP_STD,
    fields: [{ k: 'ang', label: 'Ángulo tibial', unit: '°', min: 0, max: 75, key: true, sum: 'mean' }, { k: 'dist', label: 'Distancia dedo–pared', unit: 'cm', min: 0, max: 25, sum: 'mean' }],
    variables: 'Ángulo tibia–vertical (°) y/o distancia (cm), media de 3 intentos por lado, diferencia D/I.', equations: ['Resultado = media de 3 intentos', 'Diferencia D − I (° o cm)'], units: '°, cm',
    normalization: 'No aplica.', interpretation: 'El MDC informado en la literatura permite juzgar cambios entre evaluaciones. No usar un valor como umbral universal de aptitud.',
    error: 'MDC ≈ 4.6–4.7° y ≈ 1.1–1.9 cm según revisión sistemática (Powden 2015); verificar para su protocolo.', refs: ['powden2015'],
    errorsCommon: ['Talón se despega.', 'Colapso de rodilla hacia medial.', 'Inclinómetro en posición distinta entre evaluaciones.'],
    metricMap: { ang: 'wblt.angle', dist: 'wblt.dist' }
  },
  {
    id: 'hiprom', name: 'ROM de cadera (goniometría)', short: 'ROM cadera', domains: ['Movilidad'], dash: 'Movilidad', bilateral: true, session: 1, order: 12, fatigue: 0, time: 12, nTrials: 2, rest: 5, diagram: 'hiprom',
    capacity: 'Rango de movimiento pasivo de cadera.', objective: 'Registrar flexión, extensión, rotaciones y abducción de cadera por lado.',
    equipment: ['Goniómetro universal o inclinómetro', 'Camilla'], prep: ['Estandarizar posiciones (supino/prono/sedente) y registrar el método.'], activation: 'No requiere.',
    startPos: 'Flexión: supino. Extensión: prono. Rotaciones: sedente con cadera y rodilla a 90° o prono con rodilla a 90° (registrar). Abducción: supino.',
    execution: 'Movimiento pasivo lento hasta la primera resistencia firme o compensación pélvica; registrar el ángulo.', cue: 'Relájate por completo, yo muevo tu pierna. Avísame si sientes dolor.',
    familiarization: 'Un movimiento de prueba.', valid: ['Pelvis estabilizada.', 'Fin de rango definido de forma constante.'], repeat: ['Compensación pélvica o lumbar.', 'Contracción activa del deportista.'], stop: STOP_STD,
    fields: [{ k: 'flex', label: 'Flexión', unit: '°', min: 0, max: 160, key: true, sum: 'mean' }, { k: 'ext', label: 'Extensión', unit: '°', min: -20, max: 50, sum: 'mean' }, { k: 'ri', label: 'Rotación interna', unit: '°', min: 0, max: 80, sum: 'mean' }, { k: 're', label: 'Rotación externa', unit: '°', min: 0, max: 90, sum: 'mean' }, { k: 'abd', label: 'Abducción', unit: '°', min: 0, max: 80, sum: 'mean' }],
    config: [{ k: 'rotpos', label: 'Posición para rotaciones', type: 'select', opts: ['Sedente 90/90', 'Prono, rodilla 90°'], span: 6 }],
    variables: 'Ángulos (°) por movimiento y lado; media de 2 mediciones; diferencia D/I; arco total de rotación (RI + RE).', equations: ['Arco rotacional = RI + RE', 'Diferencia D − I (°)'], units: '°',
    normalization: 'No aplica.', interpretation: NO_CUTOFF, error: 'La goniometría depende del evaluador; registrar el SEM propio (idealmente del mismo evaluador).', refs: ['norkin'], errorsCommon: ['No estabilizar la pelvis.', 'Cambiar de posición para rotaciones entre evaluaciones.']
  },
  {
    id: 'kneerom', name: 'ROM de rodilla (goniometría)', short: 'ROM rodilla', domains: ['Movilidad'], dash: 'Movilidad', bilateral: true, session: 1, order: 13, fatigue: 0, time: 6, nTrials: 2, rest: 5, diagram: 'kneerom',
    capacity: 'Rango de flexión y extensión de rodilla.', objective: 'Registrar flexión activa/pasiva y déficit de extensión por lado.',
    equipment: ['Goniómetro universal', 'Camilla'], prep: ['Referencias óseas: trocánter mayor, epicóndilo lateral del fémur, maléolo lateral.'], activation: 'No requiere.',
    startPos: 'Supino. Flexión: talón desliza hacia el glúteo. Extensión: talón sobre un soporte.', execution: 'Registrar el ángulo máximo alcanzado sin dolor.', cue: 'Dobla la rodilla todo lo que puedas llevando el talón hacia el glúteo… ahora relájala sobre el soporte.',
    familiarization: 'Un movimiento de prueba.', valid: ['Alineación del goniómetro con referencias óseas.'], repeat: ['Rotación de cadera.', 'Referencias mal localizadas.'], stop: STOP_STD,
    fields: [{ k: 'flex', label: 'Flexión', unit: '°', min: 0, max: 170, key: true, sum: 'mean' }, { k: 'ext', label: 'Extensión (negativo = déficit)', unit: '°', min: -30, max: 20, sum: 'mean' }],
    config: [{ k: 'type', label: 'Tipo', type: 'select', opts: ['Activo', 'Pasivo', 'Activo-asistido'], span: 4 }],
    variables: 'Flexión y extensión (°), media, diferencia D/I.', equations: ['Diferencia D − I (°)'], units: '°', normalization: 'No aplica.', interpretation: NO_CUTOFF, error: 'Registrar SEM propio.', refs: ['norkin'], errorsCommon: ['Goniómetro mal alineado.', 'No distinguir activo de pasivo.']
  },
  {
    id: 'slr', name: 'Straight Leg Raise (SLR pasivo)', short: 'SLR', domains: ['Flexibilidad', 'Movilidad'], dash: 'Movilidad', bilateral: true, session: 1, order: 14, fatigue: 0, time: 6, nTrials: 2, rest: 5, diagram: 'slr',
    capacity: 'Extensibilidad de la musculatura isquiosural (con componente neural).', objective: 'Registrar el ángulo de elevación pasiva de la pierna extendida.',
    equipment: ['Inclinómetro digital', 'Camilla', 'Correa de estabilización'], prep: ['Calibrar inclinómetro.', 'Fijar pierna contralateral y pelvis con correa.'], activation: 'No requiere.',
    startPos: 'Supino, pierna contralateral extendida y fijada, tobillo del lado evaluado en posición neutra.', execution: 'Elevar pasivamente la pierna con rodilla extendida hasta la primera resistencia firme o rotación pélvica; inclinómetro en la tibia proximal.', cue: 'Relájate, deja la pierna floja. Dime "ya" cuando sientas un estiramiento fuerte.',
    familiarization: '1 elevación.', valid: ['Rodilla extendida.', 'Pelvis sin rotación posterior.'], repeat: ['Flexión de rodilla.', 'Elevación de la pelvis contralateral.'], stop: STOP_STD,
    fields: [{ k: 'ang', label: 'Ángulo SLR', unit: '°', min: 0, max: 130, key: true, sum: 'mean' }],
    config: [{ k: 'endpoint', label: 'Criterio de fin', type: 'select', opts: ['Primera resistencia firme (evaluador)', 'Máxima tolerancia (deportista)', 'Inicio de rotación pélvica'], span: 6 }],
    variables: 'Ángulo (°) por lado; diferencia D/I.', equations: ['Diferencia D − I (°)'], units: '°', normalization: 'No aplica.', interpretation: NO_CUTOFF + ' Considerar la historia de lesión isquiosural izquierda al interpretar diferencias.', error: 'Registrar SEM propio y el criterio de fin utilizado.', refs: ['norkin'], errorsCommon: ['Permitir flexión de rodilla.', 'No fijar la pelvis.', 'Cambiar el criterio de fin.']
  },
  /* ---------------- FUERZA ISOMÉTRICA ---------------- */
  Object.assign({}, ISO_COMMON, {
    id: 'quadiso', name: 'Fuerza isométrica de cuádriceps', short: 'Iso cuádriceps', order: 30, diagram: 'quadiso',
    capacity: 'Fuerza isométrica máxima y RFD de extensores de rodilla.', objective: 'Cuantificar fuerza, RFD y asimetría de extensores de rodilla.',
    equipment: ['Silla/camilla de fuerza con fijación', 'Celda de carga o dinamómetro fijado', 'Goniómetro', 'Cinta para medir brazo de palanca'],
    prep: ['Verificar cero/calibración de la celda.', 'Sedente, cadera ≈ 90°, rodilla a 90° (o 60°, registrar).', 'Sensor 2–3 cm proximal al maléolo; medir brazo de palanca desde el epicóndilo lateral.', 'Fijar tronco y muslo.'],
    startPos: 'Sentado, brazos cruzados sobre el pecho, rodilla al ángulo definido, correa perpendicular a la tibia.',
    execution: 'Extender la rodilla contra la resistencia lo más rápido y fuerte posible durante 3–5 s.', cue: 'Cuando te diga "¡ya!", empuja lo más RÁPIDO y FUERTE que puedas… ¡empuja, empuja, empuja!… y relaja.',
    errorsCommon: ['Correa no perpendicular a la tibia.', 'Elevar la cadera de la silla.', 'Agarrarse con las manos.', 'Pre-tensión antes de la señal.']
  }),
  Object.assign({}, ISO_COMMON, {
    id: 'hamiso', name: 'Fuerza isométrica de isquiotibiales', short: 'Iso isquios', order: 31, diagram: 'hamiso',
    capacity: 'Fuerza isométrica máxima y RFD de flexores de rodilla.', objective: 'Cuantificar fuerza, RFD y asimetría de flexores de rodilla.',
    equipment: ['Camilla', 'Celda de carga o dinamómetro fijado', 'Goniómetro'],
    prep: ['Verificar cero/calibración.', 'Prono (rodilla 15–30°) o supino con cadera y rodilla a 90° — registrar posición y ángulo.', 'Sensor sobre el tendón de Aquiles/talón; medir brazo de palanca.'],
    startPos: 'Prono, pelvis fijada con correa, rodilla al ángulo definido.',
    execution: 'Flexionar la rodilla contra el sensor tan rápido y fuerte como sea posible, 3–5 s.', cue: 'Cuando diga "¡ya!", tira del talón hacia el glúteo lo más RÁPIDO y FUERTE que puedas… y relaja.',
    stop: [...STOP_STD, 'Antecedente reciente de lesión isquiosural: detener ante dolor en la zona de la lesión previa.'],
    errorsCommon: ['Elevar la pelvis.', 'Rotar la cadera.', 'Ángulo de rodilla distinto entre lados.']
  }),
  Object.assign({}, ISO_COMMON, {
    id: 'plantiso', name: 'Fuerza isométrica de flexores plantares', short: 'Iso flexores plantares', order: 32, diagram: 'plantiso',
    capacity: 'Fuerza isométrica máxima de tríceps sural.', objective: 'Cuantificar fuerza de flexión plantar por lado (rodilla flexionada: sesgo sóleo; extendida: incluye gastrocnemio).',
    equipment: ['Banco/rack con barra fija o dispositivo de flexión plantar', 'Plataforma o celda de carga'],
    prep: ['Verificar cero.', 'Definir y registrar posición: sedente rodilla 90° (sóleo) o de pie rodilla extendida.', 'Tobillo en posición neutra.'],
    startPos: 'Sentado, rodilla a 90°, antepié sobre el sensor/plataforma, muslo bajo barra fija con almohadilla.',
    execution: 'Empujar con el antepié hacia arriba contra la barra fija, lo más rápido y fuerte posible, 3–5 s.', cue: 'Empuja con la punta del pie hacia arriba contra la barra, RÁPIDO y FUERTE… ¡sigue!… relaja.',
    config: [{ k: 'knee', label: 'Posición de rodilla', type: 'select', opts: ['Flexionada 90° (sesgo sóleo)', 'Extendida (de pie)'], span: 4 }, ...ISO_COMMON.config.slice(2)],
    errorsCommon: ['Levantar el talón de la plataforma antes del inicio.', 'Empujar con la cadera.', 'Cambiar ángulo de tobillo.']
  }),
  Object.assign({}, ISO_COMMON, {
    id: 'hipext', name: 'Fuerza isométrica de extensores de cadera', short: 'Iso ext. cadera', order: 33, diagram: 'hipext',
    capacity: 'Fuerza isométrica de extensores de cadera (glúteo mayor/isquiosurales).', objective: 'Cuantificar fuerza de extensión de cadera por lado.',
    equipment: ['Camilla', 'Dinamómetro fijado con correa o celda de carga'],
    prep: ['Verificar cero.', 'Prono, rodilla flexionada 90° (reduce aporte isquiosural) — registrar.', 'Sensor en región posterior distal del muslo; medir brazo de palanca desde el trocánter mayor.'],
    startPos: 'Prono, pelvis fijada, rodilla a 90°.', execution: 'Extender la cadera contra la correa, 3–5 s, máximo y rápido.', cue: 'Empuja el muslo hacia el techo lo más fuerte y rápido que puedas… ¡sigue!… relaja.',
    errorsCommon: ['Hiperextensión lumbar.', 'Rotación de pelvis.']
  }),
  Object.assign({}, ISO_COMMON, {
    id: 'hipabd', name: 'Fuerza isométrica de abductores de cadera', short: 'Iso abd. cadera', order: 34, diagram: 'hipabd',
    capacity: 'Fuerza isométrica de abductores de cadera.', objective: 'Cuantificar fuerza de abducción por lado.',
    equipment: ['Camilla', 'Dinamómetro fijado con correa'],
    prep: ['Verificar cero.', 'Supino (Thorborg 2010) o decúbito lateral — registrar.', 'Sensor 5 cm proximal al maléolo lateral; medir brazo de palanca desde el trocánter mayor.'],
    startPos: 'Supino, cadera neutra, correa alrededor de la camilla.', execution: 'Separar la pierna contra la correa, 3–5 s, máximo.', cue: 'Empuja la pierna hacia afuera contra la correa, lo más fuerte que puedas… ¡sigue!… relaja.',
    errorsCommon: ['Rotación externa compensatoria.', 'Elevación de la pelvis.']
  }),
  {
    id: 'imtp', name: 'Isometric Mid-Thigh Pull (IMTP)', short: 'IMTP', domains: ['Fuerza', 'RFD'], dash: 'Fuerza', bilateral: false, session: 1, order: 40, fatigue: 2, time: 15, nTrials: 3, rest: 120, diagram: 'imtp',
    capacity: 'Fuerza isométrica máxima de tren inferior en cadena cinética cerrada y RFD.', objective: 'Cuantificar fuerza pico, fuerza neta, RFD e impulso; base para el DSI.',
    equipment: ['Plataforma(s) de fuerza AMTI', 'Rack con barra fija regulable', 'Straps/muñequeras', 'Goniómetro'],
    prep: ['Poner a cero la plataforma sin carga y verificar calibración.', 'Ajustar barra a mitad del muslo (≈ punto medio entre cresta ilíaca y rótula).', 'Rodilla 125–145°, cadera 140–150°, tronco erguido (registrar ángulos).', 'Frecuencia de muestreo ≥ 1000 Hz.'],
    activation: 'Calentamiento general 5 min + sentadillas/peso muerto rumano ligero + 3 tirones isométricos al 50 %, 75 % y 90 % (3 s), 1 min de pausa.',
    startPos: 'De pie sobre la plataforma, barra a mitad del muslo, hombros ligeramente por delante de la barra, brazos extendidos, agarre con straps.',
    execution: 'Pre-tensión mínima (sin superar ≈ 50 N por sobre el peso corporal), 1 s de quietud; a la señal, empujar el suelo lo más rápido y fuerte posible durante 3–5 s.',
    cue: 'Empuja el suelo con los pies lo más RÁPIDO y FUERTE que puedas… ¡empuja, empuja, empuja!',
    familiarization: '1–2 tirones submáximos en la posición definitiva.',
    valid: ['Peso corporal estable ≥ 1 s antes del inicio.', 'Sin contramovimiento (sin caída de fuerza bajo el peso corporal previo al inicio).', 'Posición articular dentro de los rangos definidos.'],
    repeat: ['Contramovimiento o pre-tensión excesiva.', 'Pico inferior al 95 % del mejor y el deportista refiere esfuerzo submáximo.', 'Pico > 250 N superior al anterior (hacer intento adicional).'], stop: STOP_STD,
    fields: [{ k: 'pf', label: 'Fuerza pico (bruta)', unit: 'N', min: 0, max: 8000, key: true, perKg: true, req: true }, { k: 'bw', label: 'Peso corporal en plataforma', unit: 'N', min: 200, max: 2000 }, { k: 'rfd100', label: 'RFD 0–100 ms', unit: 'N/s', min: 0, max: 80000 }, { k: 'rfd200', label: 'RFD 0–200 ms', unit: 'N/s', min: 0, max: 80000 }, { k: 'imp200', label: 'Impulso neto 0–200 ms', unit: 'N·s', min: 0, max: 2000 }, { k: 'pfR', label: 'Fuerza pico pierna D (doble plataforma)', unit: 'N', min: 0, max: 5000, opt: true }, { k: 'pfL', label: 'Fuerza pico pierna I (doble plataforma)', unit: 'N', min: 0, max: 5000, opt: true }],
    config: [{ k: 'knee', label: 'Ángulo de rodilla', type: 'number', unit: '°', span: 3 }, { k: 'hip', label: 'Ángulo de cadera', type: 'number', unit: '°', span: 3 }, { k: 'fs', label: 'Frecuencia de muestreo', type: 'number', unit: 'Hz', span: 3 }, { k: 'plates', label: 'Plataformas', type: 'select', opts: ['Una plataforma', 'Dos plataformas (D/I)'], span: 3 }],
    variables: 'Fuerza pico bruta y neta (N), relativa (N/kg), RFD (N/s), impulso (N·s), asimetría D/I si hay doble plataforma.', equations: ['Fuerza neta = F pico − peso corporal', 'Fuerza relativa = F pico / masa', 'RFD(0–t) = [F(t) − F(0)] / t', 'DSI = PF CMJ / PF IMTP'], units: 'N, N/kg, N/s, N·s',
    normalization: 'Por masa corporal. Reportar si se usa fuerza bruta o neta (no mezclar).', interpretation: NO_CUTOFF, error: 'La fuerza pico suele ser muy reproducible; la RFD temprana, menos. Registrar SEM propio.', refs: ['comfort2019', 'maffiuletti2016', 'comfort2018'],
    errorsCommon: ['Barra demasiado baja (postura de peso muerto) o alta.', 'Contramovimiento antes del tirón.', 'Flexión de codos.', 'Agarre sin straps (limita por prensión).']
  },
  {
    id: 'isofatigue', name: 'Fatigabilidad isométrica unilateral', short: 'Fatiga isométrica', mode: 'fatigue', domains: ['Resistencia de fuerza'], dash: 'Resistencia', bilateral: true, session: 2, order: 95, fatigue: 3, time: 15, nTrials: 1, rest: 180, diagram: 'quadiso',
    capacity: 'Capacidad de mantener fuerza ante contracciones repetidas.', objective: 'Cuantificar la caída de fuerza durante contracciones isométricas repetidas por lado.',
    equipment: ['Celda de carga / dinamómetro fijado', 'Metrónomo'], prep: ['Mismo montaje que la prueba de fuerza máxima del grupo muscular.', 'Definir protocolo: p. ej., 20 contracciones de 5 s con 5 s de pausa (registrar).', 'Criterio de finalización predefinido.'],
    activation: 'Realizar después de la fuerza máxima con ≥ 5 min de recuperación, y al final de la sesión (prueba fatigante).',
    startPos: 'Igual que la prueba isométrica del grupo muscular seleccionado.', execution: 'Contracciones máximas repetidas siguiendo el metrónomo; registrar el pico de cada contracción.', cue: 'Cada vez que suene, empuja al máximo hasta que te diga "relaja". Intenta mantener el máximo en todas.',
    familiarization: '2 ciclos submáximos con el metrónomo.', valid: ['Ritmo respetado.', 'Esfuerzo máximo en cada contracción.'], repeat: ['Error de montaje (repetir otro día; no repetir el mismo día).'], stop: STOP_STD,
    fields: [], config: [{ k: 'muscle', label: 'Grupo muscular', type: 'select', opts: ['Cuádriceps', 'Isquiotibiales', 'Flexores plantares', 'Extensores de cadera', 'Abductores de cadera'], span: 4 }, { k: 'protocol', label: 'Protocolo', type: 'text', span: 8, ph: 'p. ej., 20 × 5 s ON / 5 s OFF' }],
    variables: 'Valor inicial, final, promedio, pendiente (N/rep), decremento %, Sdec %, número de repeticiones, duración.', equations: ['Decremento % = (inicial − final) / inicial × 100', 'Sdec % = (1 − Σ valores / (mejor × n)) × 100', 'Pendiente = regresión lineal valor ~ repetición'], units: 'N, %, N/rep, s',
    normalization: 'Relativa al valor inicial de cada lado.', interpretation: NO_CUTOFF, error: 'Los índices de fatiga tienen fiabilidad menor que los valores absolutos (Glaister 2008).', refs: ['glaister2008'], errorsCommon: ['Primera contracción submáxima (infla o reduce el decremento).', 'Diferente protocolo entre lados o evaluaciones.']
  },
  {
    id: 'slcr', name: 'Single Leg Calf Raise (resistencia)', short: 'SL Calf Raise', mode: 'fatigue', domains: ['Resistencia de fuerza'], dash: 'Resistencia', bilateral: true, session: 2, order: 94, fatigue: 3, time: 10, nTrials: 1, rest: 180, diagram: 'slcr',
    capacity: 'Resistencia de fuerza del tríceps sural.', objective: 'Registrar repeticiones hasta el fallo y, con encoder, altura/velocidad por repetición.',
    equipment: ['Escalón o plano inclinado 10°', 'Metrónomo (≈ 30 rep/min o 60 lpm)', 'Encoder lineal (opcional)'], prep: ['Definir superficie (plana/escalón/cuña) y cadencia.', 'Si usa encoder, fijar el cable al talón/zapato y poner a cero.'],
    activation: 'Movilidad de tobillo + 10 elevaciones bipodales submáximas. Realizar al final de la sesión.',
    startPos: 'De pie sobre una pierna, rodilla extendida, puntas de dedos sobre la pared a la altura de los hombros para equilibrio.', execution: 'Elevar el talón al máximo y descender al ritmo del metrónomo hasta el fallo.', cue: 'Sube el talón lo más alto que puedas y baja completo, siguiendo el ritmo. No dobles la rodilla ni empujes con las manos.',
    familiarization: '3–5 repeticiones submáximas.', valid: ['Rodilla extendida.', 'Altura máxima en cada repetición.', 'Cadencia respetada.'], repeat: ['No aplica: finaliza por criterios.'],
    stop: [...STOP_STD, 'Finalización: 2 repeticiones consecutivas fuera de cadencia, altura < 50 % de la máxima, flexión de rodilla o apoyo de peso en las manos.'],
    fields: [], config: [{ k: 'surface', label: 'Superficie', type: 'select', opts: ['Plana', 'Escalón', 'Cuña 10°'], span: 4 }, { k: 'cadence', label: 'Cadencia', type: 'text', span: 4, ph: '30 rep/min' }],
    variables: 'Repeticiones, altura/velocidad por repetición (con encoder), pérdida de velocidad/altura, trabajo total.', equations: ['Pérdida % = (inicial − final) / inicial × 100', 'Pendiente de caída = regresión lineal'], units: 'rep, cm, m/s, %',
    normalization: 'Comparación D/I y longitudinal con protocolo idéntico.', interpretation: NO_CUTOFF, error: 'La estandarización (cadencia, superficie, criterio de fin) determina la fiabilidad (Hébert-Losier 2009).', refs: ['heberlosier2009'], errorsCommon: ['Flexionar la rodilla.', 'Empujar con las manos.', 'Perder la cadencia sin finalizar.']
  },
  {
    id: 'encoder', name: 'Perfil carga–velocidad con encoder', short: 'Carga–velocidad', mode: 'encoder', domains: ['Fuerza–velocidad', 'Potencia'], dash: 'Potencia', bilateral: false, session: 1, order: 50, fatigue: 2, time: 25, nTrials: 1, rest: 180, diagram: 'encoder',
    capacity: 'Relación carga–velocidad y carga–potencia.', objective: 'Construir las curvas carga–velocidad y carga–potencia individuales y registrar la pérdida de velocidad por serie.',
    equipment: ['Encoder lineal (registrar modelo)', 'Barra y discos calibrados', 'Rack con seguros'], prep: ['Fijar el encoder verticalmente bajo la barra; verificar cable perpendicular.', 'Definir ejercicio, profundidad (p. ej., muslo paralelo) y fase propulsiva.', 'Cargas progresivas predefinidas (p. ej., 20 kg → hasta velocidad media ≈ 0.5–0.6 m/s).'],
    activation: 'Movilidad + 2 series técnicas con barra sola.', startPos: 'Barra en posición alta (sentadilla) o según el ejercicio; pies a la anchura de caderas.',
    execution: 'Fase excéntrica controlada, fase concéntrica a la máxima velocidad intencional. 2–3 repeticiones por carga (menos con cargas altas).', cue: 'Baja controlado y sube lo más RÁPIDO posible en cada repetición.',
    familiarization: 'Barra sola: 5 repeticiones a máxima velocidad.', valid: ['Profundidad constante.', 'Máxima intención de velocidad.', 'Sin rebote.'], repeat: ['Profundidad insuficiente.', 'Técnica alterada.', 'Señal del encoder defectuosa.'], stop: [...STOP_STD, 'Velocidad media ≤ velocidad objetivo mínima definida (no progresar más carga).'],
    fields: [], config: [],
    variables: 'Por repetición: carga, desplazamiento, velocidad media y pico, potencia media y pico. Curvas carga–velocidad (lineal) y carga–potencia; pérdida de velocidad por serie.', equations: ['Carga–velocidad: VM = a + b·carga (regresión lineal)', 'Carga–potencia: ajuste cuadrático', 'Pérdida de velocidad % = (VM mejor − VM última) / VM mejor × 100'], units: 'kg, m, m/s, W',
    normalization: 'Carga relativa a masa corporal y potencia en W/kg.', interpretation: 'Interpretación individual y longitudinal. Los desplazamientos de la curva entre sesiones deben compararse con el error del dispositivo.', error: 'Depende del dispositivo (Pérez-Castilla 2019).', refs: ['gonzalezbadillo2010', 'sanchezmedina2011', 'weakley2021', 'perezcastilla2019'], errorsCommon: ['Cable del encoder inclinado.', 'Profundidad variable.', 'No indicar máxima velocidad intencional.']
  },
  /* ---------------- SALTOS ---------------- */
  Object.assign({}, JUMP_COMMON, {
    id: 'sj', name: 'Squat Jump (SJ)', short: 'SJ', bilateral: false, order: 60, diagram: 'sj', fields: [...JUMP_FIELDS, ...DUAL_FIELDS],
    capacity: 'Capacidad de producción de fuerza concéntrica sin ciclo estiramiento–acortamiento.', objective: 'Medir altura, fuerza y potencia en salto sin contramovimiento.',
    equipment: ['Plataforma AMTI o plataforma de contacto', 'Goniómetro / cajón de referencia para 90°'], prep: ['Poner a cero la plataforma sin carga.', 'Rodillas a 90° en la posición inicial (verificar).'],
    startPos: 'Semisentadilla con rodillas a 90°, manos en la cadera, mantener 2–3 s inmóvil.', execution: 'Saltar lo más alto posible sin realizar contramovimiento previo.', cue: 'Baja a la posición, quédate quieto… y cuando diga "¡ya!", salta lo más alto que puedas SIN bajar antes.',
    valid: [...JUMP_COMMON.valid, 'Sin contramovimiento (sin caída de fuerza bajo el peso corporal antes del despegue).'], repeat: [...JUMP_COMMON.repeat, 'Contramovimiento visible o en la curva.'],
    variables: 'Altura (cm), tiempo de vuelo (s), fuerza pico (N), potencia pico (W, W/kg), impulso.', interpretation: 'La comparación SJ vs CMJ describe el aprovechamiento del contramovimiento (índice descriptivo, no diagnóstico).'
  }),
  Object.assign({}, JUMP_COMMON, {
    id: 'cmj', name: 'Countermovement Jump (CMJ)', short: 'CMJ', bilateral: false, order: 61, diagram: 'cmj', fields: [...JUMP_FIELDS, { k: 'tto', label: 'Tiempo hasta el despegue', unit: 's', min: 0, max: 2 }, { k: 'depth', label: 'Profundidad del contramovimiento', unit: 'cm', min: 0, max: 80, opt: true }, ...DUAL_FIELDS],
    capacity: 'Potencia de tren inferior con ciclo estiramiento–acortamiento lento.', objective: 'Medir altura, fuerza, potencia, impulso y estrategia; asimetría D/I si hay doble plataforma.',
    equipment: ['Plataforma(s) AMTI'], prep: ['Poner a cero la plataforma.', 'Registrar si hay una o dos plataformas.'],
    startPos: 'De pie, erguido, manos en la cadera, pies a la anchura de caderas, quieto ≥ 1 s (pesaje).', execution: 'Contramovimiento rápido a profundidad auto-seleccionada e inmediatamente saltar lo más alto posible.', cue: 'Quédate quieto… cuando diga "¡ya!", baja rápido y salta lo más ALTO que puedas.',
    variables: 'Altura, tiempo de vuelo, fuerza pico, potencia pico (W, W/kg), impulso, tiempo hasta el despegue, RSI modificado, asimetría de fuerza pico (doble plataforma).', equations: [...JUMP_COMMON.equations, 'RSImod = altura (m) / tiempo hasta el despegue (s)', 'DSI = PF CMJ / PF IMTP'],
    interpretation: 'Registrar el método de cálculo de altura. La asimetría de fuerza en CMJ bilateral describe la estrategia de carga entre piernas (Impellizzeri 2007).', refs: [...JUMP_COMMON.refs, 'impellizzeri2007', 'comfort2018']
  }),
  Object.assign({}, JUMP_COMMON, {
    id: 'abk', name: 'Abalakov (CMJ con brazos)', short: 'Abalakov', bilateral: false, order: 62, diagram: 'abk', fields: [...JUMP_FIELDS, ...DUAL_FIELDS],
    capacity: 'Potencia de salto con contribución de miembros superiores.', objective: 'Medir altura de salto con impulso de brazos.',
    equipment: ['Plataforma AMTI o de contacto'], prep: ['Poner a cero la plataforma.'],
    startPos: 'De pie, erguido, brazos libres.', execution: 'Contramovimiento con balanceo de brazos y salto máximo.', cue: 'Usa los brazos: bájalos atrás mientras bajas y lánzalos arriba al saltar lo más ALTO posible.',
    valid: ['Despegue y aterrizaje en la misma zona.', 'Piernas extendidas en vuelo.', 'Aterrizaje controlado.'], repeat: ['Flexión de rodillas en vuelo.', 'Aterrizaje fuera de la plataforma.'],
    variables: 'Altura, tiempo de vuelo, potencia.', interpretation: 'La diferencia ABK − CMJ describe la contribución de los brazos (descriptiva).'
  }),
  Object.assign({}, JUMP_COMMON, {
    id: 'cmju', name: 'CMJ unilateral', short: 'CMJ unilateral', bilateral: true, order: 63, diagram: 'cmju', fields: [{ k: 'h', label: 'Altura', unit: 'cm', min: 0, max: 80, key: true }, { k: 'tf', label: 'Tiempo de vuelo', unit: 's', min: 0, max: 1 }, { k: 'pf', label: 'Fuerza pico', unit: 'N', min: 0, max: 6000, perKg: true }, { k: 'pp', label: 'Potencia pico', unit: 'W', min: 0, max: 10000, perKg: true }, { k: 'imp', label: 'Impulso neto', unit: 'N·s', min: 0, max: 600 }],
    domains: ['Potencia', 'Salto', 'Pruebas funcionales'], rest: 60, time: 12,
    capacity: 'Potencia unilateral de tren inferior.', objective: 'Medir altura, fuerza, potencia e impulso por pierna y su asimetría.',
    equipment: ['Plataforma AMTI'], prep: ['Poner a cero la plataforma.', 'Definir pierna inicial y alternar.'],
    startPos: 'De pie sobre la pierna evaluada, manos en la cadera, pierna libre flexionada con el pie a la altura del tobillo de apoyo, sin tocar la pierna de apoyo.', execution: 'Contramovimiento y salto máximo con una pierna; aterrizar sobre la misma pierna y estabilizar 2 s.', cue: 'Sobre una pierna, quieto… baja rápido y salta lo más ALTO posible. Aterriza con la misma pierna y quédate quieto.',
    familiarization: '2 saltos submáximos por pierna.',
    valid: ['Manos en la cadera.', 'Pierna libre sin balanceo.', 'Aterrizaje sobre la misma pierna, estable 2 s.'], repeat: ['Balanceo de la pierna libre.', 'Apoyo de la pierna contralateral.', 'Manos separadas de la cadera.'],
    variables: 'Altura, fuerza pico, potencia, impulso por lado; asimetría y LSI.', interpretation: 'Comparar desempeño absoluto de cada pierna y la diferencia D/I frente al CV de la prueba. La asimetría no equivale a patología.', refs: [...JUMP_COMMON.refs, 'bishop2018a']
  }),
  Object.assign({}, JUMP_COMMON, {
    id: 'cmjload', name: 'CMJ con carga externa (perfil de carga)', short: 'CMJ con carga', bilateral: false, order: 64, diagram: 'encoder', time: 15, rest: 90, nTrials: 4, domains: ['Potencia', 'Salto', 'Fuerza–velocidad'], fatigue: 2,
    fields: [{ k: 'load', label: 'Carga externa', unit: 'kg', min: 0, max: 200, req: true }, ...JUMP_FIELDS, { k: 'tto', label: 'Tiempo hasta el despegue', unit: 's', min: 0, max: 2 }, ...DUAL_FIELDS],
    capacity: 'Relación carga–altura/potencia en salto con contramovimiento.', objective: 'Registrar altura, fuerza y potencia del CMJ con cargas externas progresivas (barra o chaleco).',
    equipment: ['Plataformas AMTI (izquierda y derecha)', 'Barra olímpica / chaleco lastrado', 'Discos calibrados'], prep: ['Poner a cero las plataformas SIN carga.', 'El pesaje (≥ 1 s quieto) se realiza CON la carga: el sistema resta la carga para obtener la masa corporal.', 'Registrar la carga exacta en cada intento (cada intento = una carga).', 'Cargas progresivas (p. ej., 0, 20, 40, 60 % de la masa corporal).'],
    startPos: 'De pie con la barra sobre los trapecios (o chaleco), una pierna en cada plataforma, quieto ≥ 1 s.', execution: 'CMJ a máxima intención con la carga, manteniendo la barra fija al cuerpo.', cue: 'Quédate quieto con la barra… cuando diga "¡ya!", baja rápido y salta lo más ALTO posible sin separar la barra de los hombros.',
    valid: ['Barra sin separarse de los hombros.', 'Pies uno en cada plataforma.', 'Piernas extendidas en vuelo.'], repeat: ['Barra se despega de los hombros.', 'Pie fuera de la plataforma.', 'Flexión de rodillas en vuelo.'],
    variables: 'Por carga: altura (impulso–momento y tiempo de vuelo), fuerza pico, potencia pico (W, W/kg corporal), impulso, variables por pierna.', equations: [...JUMP_COMMON.equations, 'Masa del sistema = peso en plataforma / g ; masa corporal = masa del sistema − carga'],
    interpretation: 'La altura con carga corresponde al desplazamiento del sistema (deportista + carga). Interpretar la relación carga–altura/potencia de forma individual y longitudinal. ' + NO_CUTOFF
  }),
  Object.assign({}, JUMP_COMMON, {
    id: 'sjload', name: 'SJ con carga externa (perfil de carga)', short: 'SJ con carga', bilateral: false, order: 65, diagram: 'sj', time: 15, rest: 90, nTrials: 4, domains: ['Potencia', 'Salto', 'Fuerza–velocidad'], fatigue: 2,
    fields: [{ k: 'load', label: 'Carga externa', unit: 'kg', min: 0, max: 200, req: true }, ...JUMP_FIELDS, ...DUAL_FIELDS],
    capacity: 'Relación carga–altura/potencia en salto concéntrico.', objective: 'Registrar altura, fuerza y potencia del SJ con cargas externas progresivas.',
    equipment: ['Plataformas AMTI (izquierda y derecha)', 'Barra / chaleco lastrado', 'Referencia de 90° de rodilla'], prep: ['Poner a cero las plataformas SIN carga.', 'Pesaje con la carga (≥ 1 s de pie quieto).', 'Registrar la carga exacta en cada intento.'],
    startPos: 'Semisentadilla a 90° con la carga, inmóvil 2–3 s.', execution: 'Saltar lo más alto posible sin contramovimiento.', cue: 'Baja a la posición y quédate quieto… cuando diga "¡ya!", salta lo más alto posible SIN bajar antes.',
    valid: [...JUMP_COMMON.valid, 'Sin contramovimiento.'], repeat: ['Contramovimiento visible o en la curva.', 'Barra se despega de los hombros.'],
    variables: 'Por carga: altura, fuerza pico, potencia pico, impulso, variables por pierna.', equations: [...JUMP_COMMON.equations, 'Masa corporal = masa del sistema − carga'],
    interpretation: 'Altura del sistema deportista + carga. ' + NO_CUTOFF
  }),
  {
    id: 'dj', name: 'Drop Jump (DJ) / RSI', short: 'Drop Jump', domains: ['Reactividad', 'Salto'], dash: 'Reactividad', bilateral: false, session: 2, order: 70, fatigue: 2, time: 12, nTrials: 3, rest: 60, diagram: 'dj',
    capacity: 'Fuerza reactiva (ciclo estiramiento–acortamiento rápido).', objective: 'Medir tiempo de contacto, altura de salto y RSI desde una altura de caída definida.',
    equipment: ['Cajón de altura conocida', 'Plataforma AMTI o de contacto'], prep: ['Medir y registrar la altura real del cajón.', 'Cajón a 10–20 cm de la plataforma.'],
    activation: 'Pogos bipodales (2 × 10), saltos al cajón bajo y 2 caídas con aterrizaje controlado.',
    startPos: 'De pie sobre el cajón, manos en la cadera.', execution: 'Dejarse caer (dar un paso al vacío) sin saltar hacia arriba desde el cajón; al contactar, rebotar lo más alto y rápido posible.', cue: 'Da un paso al frente y déjate caer. Al tocar el suelo, salta lo más ALTO posible tocando el suelo el MENOR tiempo posible, como si el suelo quemara.',
    familiarization: '2–3 caídas submáximas.', valid: ['Caída sin impulso vertical desde el cajón.', 'Contacto con ambos pies simultáneo.', 'Talones sin contacto prolongado (según estrategia definida).', 'Manos en la cadera.'], repeat: ['Salto hacia arriba desde el cajón.', 'Contacto > 250 ms si el protocolo exige estrategia rápida.', 'Aterrizaje asimétrico.'], stop: STOP_STD,
    fields: [{ k: 'h', label: 'Altura de salto', unit: 'cm', min: 0, max: 100 }, { k: 'tf', label: 'Tiempo de vuelo', unit: 's', min: 0, max: 1 }, { k: 'tc', label: 'Tiempo de contacto', unit: 's', min: 0.05, max: 1.5, req: true, hib: false }, { k: 'rsi', label: 'RSI (calculado)', unit: 'm/s', calc: true, key: true }],
    config: [{ k: 'box', label: 'Altura del cajón', type: 'number', unit: 'cm', span: 4, req: true }, { k: 'system', label: 'Sistema', type: 'select', opts: ['Plataforma AMTI', 'Plataforma de contacto', 'Otro'], span: 4 }],
    variables: 'Altura (cm), tiempo de contacto (s), RSI (m/s).', equations: ['h = g · tv² / 8 (si solo hay tiempo de vuelo)', 'RSI = altura (m) / tiempo de contacto (s)'], units: 'cm, s, m/s', normalization: 'No aplica; la altura de caída debe ser idéntica en seguimientos.',
    interpretation: NO_CUTOFF, error: 'Registrar SEM propio; RSI depende de la altura de caída y de la instrucción.', refs: ['flanagan2008', 'bosco1983'], errorsCommon: ['Saltar desde el cajón (aumenta altura de caída).', 'Instrucción que prioriza solo altura (alarga contacto).']
  },
  {
    id: 'djprofile', name: 'Perfil RSI multialtura (Drop Jump 20–40 cm)', short: 'Perfil RSI', domains: ['Reactividad'], dash: 'Reactividad', bilateral: false, session: 2, order: 71, fatigue: 2, time: 15, nTrials: 3, rest: 60, diagram: 'dj',
    capacity: 'Tolerancia a cargas excéntricas rápidas crecientes.', objective: 'Identificar la altura de caída con mayor RSI.',
    equipment: ['Cajones de 20, 30 y 40 cm (o los disponibles)', 'Plataforma AMTI o de contacto'], prep: ['Medir alturas reales de cajones.', 'Orden ascendente de alturas.'],
    activation: 'Igual que Drop Jump.', startPos: 'Sobre el cajón, manos en la cadera.', execution: 'Un DJ por altura en cada ronda (intento = una altura); registrar altura de cajón en cada intento.', cue: 'Déjate caer y rebota lo más ALTO y RÁPIDO posible.',
    familiarization: 'DJ submáximo desde el cajón más bajo.', valid: ['Criterios de DJ.'], repeat: ['Criterios de DJ.'], stop: STOP_STD,
    fields: [{ k: 'box', label: 'Altura del cajón', unit: 'cm', min: 5, max: 100, req: true }, { k: 'h', label: 'Altura de salto', unit: 'cm', min: 0, max: 100 }, { k: 'tf', label: 'Tiempo de vuelo', unit: 's', min: 0, max: 1 }, { k: 'tc', label: 'Tiempo de contacto', unit: 's', min: 0.05, max: 1.5, req: true, hib: false }, { k: 'rsi', label: 'RSI (calculado)', unit: 'm/s', calc: true, key: true }],
    variables: 'RSI por altura; altura óptima (máximo RSI).', equations: ['RSI = altura (m) / contacto (s)'], units: 'cm, s, m/s', normalization: 'No aplica.', interpretation: NO_CUTOFF, error: 'Registrar SEM propio.', refs: ['flanagan2008'], errorsCommon: ['No medir la altura real del cajón.']
  },
  {
    id: 'rj', name: 'Saltos repetidos (Bosco 15 s)', short: 'Saltos repetidos', mode: 'repeated', domains: ['Reactividad', 'Resistencia de fuerza', 'Salto'], dash: 'Reactividad', bilateral: false, session: 2, order: 90, fatigue: 3, time: 8, nTrials: 1, rest: 240, diagram: 'rj',
    capacity: 'Potencia mecánica media y resistencia a la fatiga en saltos continuos.', objective: 'Registrar tiempos de vuelo y contacto en saltos continuos para calcular potencia (Bosco), RSI por salto e índice de fatiga.',
    equipment: ['Plataforma AMTI o de contacto', 'Cronómetro'], prep: ['Definir duración (15 s habitual; 30–60 s en protocolos de resistencia).', 'Exportar tiempos por salto si el sistema lo permite.'],
    activation: 'Pogos 2 × 10 y 2 saltos submáximos. Ubicar al final de la sesión (prueba fatigante).',
    startPos: 'De pie, manos en la cadera.', execution: 'Saltos máximos continuos, rodillas ≈ 90° en cada contacto, durante el tiempo definido.', cue: 'Salta lo más alto que puedas sin parar hasta que diga "¡alto!". Manos en la cadera todo el tiempo.',
    familiarization: '3–4 saltos continuos submáximos.', valid: ['Manos en la cadera.', 'Esfuerzo máximo sostenido.'], repeat: ['No se repite el mismo día (prueba fatigante); registrar como no completada si falla el sistema.'], stop: STOP_STD,
    fields: [], config: [{ k: 'dur', label: 'Duración', type: 'number', unit: 's', span: 4 }],
    variables: 'Número de saltos, tiempo total de vuelo, altura media, potencia media (W/kg), RSI por salto, índice de fatiga (primeros vs últimos saltos).', equations: ['W/kg = g² · Tf · Tt / (4 · n · (Tt − Tf))', 'Índice de fatiga % = (media primeros 3 − media últimos 3) / media primeros 3 × 100'], units: 's, cm, W/kg, m/s, %',
    normalization: 'Potencia por masa (la ecuación ya la expresa por kg).', interpretation: NO_CUTOFF, error: 'Registrar SEM propio.', refs: ['bosco1983', 'glaister2008'], errorsCommon: ['Flexión excesiva o insuficiente de rodillas.', 'Descansos entre saltos.']
  },
  /* ---------------- HOP ---------------- */
  Object.assign({}, HOP_COMMON, {
    id: 'hop', name: 'Single Leg Hop for Distance', short: 'Single Hop', order: 75, diagram: 'hop',
    capacity: 'Potencia horizontal unilateral y control del aterrizaje.', objective: 'Medir distancia de salto horizontal unipodal por lado.',
    equipment: ['Cinta métrica fijada al suelo (≥ 3 m)', 'Superficie antideslizante'], prep: ['Fijar cinta; marcar línea de salida.', 'Definir y registrar uso de brazos.'],
    startPos: 'Sobre la pierna evaluada, punta del pie detrás de la línea de salida.', execution: 'Saltar hacia adelante lo más lejos posible y aterrizar sobre la misma pierna, manteniendo 2 s.', cue: 'Salta lo más LEJOS que puedas con una pierna y aterriza en la misma pierna. Quédate quieto dos segundos.',
    fields: [{ k: 'd', label: 'Distancia', unit: 'cm', min: 0, max: 350, key: true, req: true }],
    variables: 'Distancia (cm) por lado, mejor y media, LSI, asimetría, distancia relativa a longitud del miembro.', equations: ['LSI = menor / mayor × 100 (o involucrado / no involucrado)', 'Asimetría % = |D − I| / máx × 100']
  }),
  Object.assign({}, HOP_COMMON, {
    id: 'triplehop', name: 'Triple Hop for Distance', short: 'Triple Hop', order: 76, diagram: 'triplehop',
    capacity: 'Potencia horizontal unilateral repetida y control.', objective: 'Medir distancia total de tres saltos consecutivos unipodales.',
    equipment: ['Cinta métrica fijada al suelo (≥ 8 m)'], prep: ['Fijar cinta; línea de salida.'],
    startPos: 'Sobre la pierna evaluada detrás de la línea.', execution: 'Tres saltos consecutivos hacia adelante con la misma pierna; aterrizaje final estable 2 s.', cue: 'Tres saltos seguidos lo más LEJOS posible con la misma pierna. En el último, quédate quieto dos segundos.',
    fields: [{ k: 'd', label: 'Distancia total', unit: 'cm', min: 0, max: 1000, key: true, req: true }],
    variables: 'Distancia total (cm), LSI, asimetría.', equations: ['LSI y asimetría como en Single Hop']
  }),
  Object.assign({}, HOP_COMMON, {
    id: 'crosshop', name: 'Crossover Hop for Distance', short: 'Crossover Hop', order: 77, diagram: 'crosshop', domains: ['Pruebas funcionales', 'Control motor'],
    capacity: 'Potencia unilateral con control frontal (cruces).', objective: 'Medir distancia total de tres saltos cruzando una franja de 15 cm.',
    equipment: ['Cinta métrica (≥ 8 m)', 'Franja de 15 cm marcada en el suelo'], prep: ['Marcar franja de 15 cm; cinta en el borde.', 'El primer salto cruza hacia medial.'],
    startPos: 'Sobre la pierna evaluada, a un lado de la franja.', execution: 'Tres saltos consecutivos cruzando la franja en cada salto; aterrizaje final estable 2 s.', cue: 'Tres saltos seguidos cruzando la línea en cada salto, lo más LEJOS posible. En el último, quédate quieto.',
    valid: [...HOP_COMMON.valid, 'No pisar la franja.'],
    fields: [{ k: 'd', label: 'Distancia total', unit: 'cm', min: 0, max: 1000, key: true, req: true }],
    variables: 'Distancia total (cm), LSI, asimetría.', equations: ['LSI y asimetría como en Single Hop']
  }),
  {
    id: 'ybal', name: 'Y-Balance Test / SEBT (miembro inferior)', short: 'Y-Balance', domains: ['Equilibrio', 'Control motor'], dash: 'Control', bilateral: true, session: 2, order: 15, fatigue: 1, time: 15, nTrials: 3, rest: 10, diagram: 'ybal',
    capacity: 'Control postural dinámico unipodal.', objective: 'Medir alcances anterior, posteromedial y posterolateral normalizados por longitud del miembro.',
    equipment: ['Kit Y-Balance o cintas en el suelo en Y (135°/135°/90°)', 'Cinta métrica'], prep: ['Medir longitud del miembro inferior (EIAS–maléolo medial) de cada lado, en supino.', 'Descalzo.'],
    activation: 'Movilidad suave.', startPos: 'Apoyo unipodal en el centro, dedos en la línea de inicio, manos en la cadera.', execution: 'Alcanzar con la pierna libre lo más lejos posible en cada dirección, tocar suavemente y volver al centro sin perder el equilibrio.', cue: 'Estira la pierna lo más lejos que puedas, toca suave con la punta y vuelve al centro sin apoyar.',
    familiarization: '4–6 intentos por dirección (el protocolo SEBT lo recomienda por efecto de aprendizaje).', valid: ['Talón de apoyo en el suelo.', 'Manos en la cadera.', 'Toque ligero sin transferir peso.', 'Retorno controlado al centro.'], repeat: ['Pérdida de equilibrio.', 'Apoyo del pie de alcance para sostenerse.', 'Talón de apoyo se despega.', 'Manos se separan de la cadera.'], stop: STOP_STD,
    fields: [{ k: 'ant', label: 'Anterior', unit: 'cm', min: 0, max: 150 }, { k: 'pm', label: 'Posteromedial', unit: 'cm', min: 0, max: 180 }, { k: 'pl', label: 'Posterolateral', unit: 'cm', min: 0, max: 180 }, { k: 'comp', label: 'Compuesto (calculado)', unit: '%LMI', calc: true, key: true }],
    config: [{ k: 'llR', label: 'Longitud miembro D', type: 'number', unit: 'cm', span: 3, req: true }, { k: 'llL', label: 'Longitud miembro I', type: 'number', unit: 'cm', span: 3, req: true }, { k: 'kit', label: 'Sistema', type: 'select', opts: ['Kit Y-Balance', 'SEBT (cintas)'], span: 3 }],
    variables: 'Alcance por dirección (cm y %LMI), compuesto (%), diferencia anterior D−I (cm).', equations: ['Alcance normalizado = alcance / LMI × 100', 'Compuesto = (ANT + PM + PL) / (3 × LMI) × 100'], units: 'cm, %',
    normalization: 'Por longitud del miembro inferior.', interpretation: 'Las asociaciones con riesgo de lesión se han descrito en poblaciones específicas (p. ej., Plisky 2006, basquetbolistas escolares) y no son puntos de corte universales para atletismo.', error: 'Registrar SEM propio.', refs: ['plisky2006'], errorsCommon: ['No normalizar por longitud del miembro.', 'Transferir peso al pie de alcance.'],
    metricMap: { ant: 'ybal.ant' }
  },
  /* ---------------- VELOCIDAD / AGILIDAD ---------------- */
  {
    id: 'sprint10', name: 'Sprint 10 m', short: 'Sprint 10 m', domains: ['Velocidad'], dash: 'Velocidad', bilateral: false, session: 2, order: 80, fatigue: 2, time: 12, nTrials: 3, rest: 180, diagram: 'sprint',
    capacity: 'Aceleración.', objective: 'Medir el tiempo de 0–10 m.', equipment: ['Fotocélulas (registrar modelo y altura)', 'Conos', 'Cinta métrica'],
    prep: ['Fotocélulas a 0 y 10 m, altura ≈ cadera (registrar).', 'Salida 0.3–0.5 m detrás de la primera fotocélula (registrar).', 'Registrar superficie, calzado (clavos o no) y viento si es exterior.'],
    activation: 'Calentamiento específico 10–15 min: trote, técnica de carrera, 3 aceleraciones progresivas (70–80–90 %).',
    startPos: 'Salida de pie (2 apoyos) o 3 apoyos — registrar y mantener.', execution: 'Esprintar a máxima velocidad hasta pasar la fotocélula final (continuar hasta el cono de desaceleración).', cue: 'Cuando estés listo, sal a TODA velocidad y no frenes hasta pasar el cono.',
    familiarization: '1 aceleración al 90 %.', valid: ['Sin balanceo previo (según salida definida).', 'Paso limpio por las fotocélulas.'], repeat: ['Corte de haz por brazo antes del tronco.', 'Resbalón.', 'Error de cronometraje.'], stop: STOP_STD,
    fields: [{ k: 't10', label: 'Tiempo 0–10 m', unit: 's', min: 1, max: 4, key: true, req: true, hib: false }],
    config: [{ k: 'start', label: 'Tipo de salida', type: 'select', opts: ['De pie 2 apoyos', '3 apoyos', 'Tacos'], span: 4 }, { k: 'offset', label: 'Distancia salida–1.ª fotocélula', type: 'number', unit: 'm', span: 4 }, { k: 'surface', label: 'Superficie', type: 'select', opts: ['Pista sintética', 'Césped', 'Interior'], span: 4 }],
    variables: 'Tiempo (s) mejor y medio, velocidad media (m/s).', equations: ['Velocidad media = 10 / t'], units: 's, m/s', normalization: 'No aplica.', interpretation: 'Comparar con el historial propio del deportista y, si existen, datos de la misma disciplina y protocolo.', error: 'La salida y la altura de fotocélulas modifican los tiempos (Haugen 2016).', refs: ['haugen2016'], errorsCommon: ['Cambiar la distancia de salida entre evaluaciones.', 'Fotocélulas simples a baja altura (cortes por brazos).']
  },
  {
    id: 'sprint30', name: 'Sprint 30 m (parciales 10/20/30 m)', short: 'Sprint 30 m', domains: ['Velocidad'], dash: 'Velocidad', bilateral: false, session: 2, order: 81, fatigue: 2, time: 15, nTrials: 3, rest: 240, diagram: 'sprint',
    capacity: 'Aceleración y velocidad máxima.', objective: 'Medir tiempos parciales y velocidad por tramo.', equipment: ['Fotocélulas a 0, 10, 20 y 30 m', 'Conos'],
    prep: ['Fotocélulas a 0–10–20–30 m.', 'Mismas condiciones de salida que sprint 10 m.'], activation: 'Igual que sprint 10 m + 1–2 sprints lanzados submáximos.',
    startPos: 'Salida definida (registrar).', execution: 'Esprint máximo hasta pasar los 30 m.', cue: 'Sal a TODA velocidad y no frenes hasta pasar el último cono.',
    familiarization: '1 carrera al 90 %.', valid: ['Paso limpio por todas las fotocélulas.'], repeat: ['Error de cronometraje.', 'Resbalón.'], stop: STOP_STD,
    fields: [{ k: 't10', label: 'Parcial 10 m', unit: 's', min: 1, max: 4, hib: false }, { k: 't20', label: 'Parcial 20 m', unit: 's', min: 2, max: 6, hib: false, opt: true }, { k: 't30', label: 'Tiempo 30 m', unit: 's', min: 3, max: 8, key: true, req: true, hib: false }],
    config: [{ k: 'start', label: 'Tipo de salida', type: 'select', opts: ['De pie 2 apoyos', '3 apoyos', 'Tacos'], span: 4 }, { k: 'offset', label: 'Distancia salida–1.ª fotocélula', type: 'number', unit: 'm', span: 4 }, { k: 'wind', label: 'Viento (si exterior)', type: 'text', span: 4 }],
    variables: 'Tiempos 10/20/30 m, tramo 10–30 m, velocidad media por tramo.', equations: ['Tramo 10–30 = t30 − t10', 'Velocidad 10–30 m = 20 / (t30 − t10)'], units: 's, m/s', normalization: 'No aplica.', interpretation: 'Comparación longitudinal y con datos propios de la disciplina.', error: 'Registrar SEM propio.', refs: ['haugen2016'], errorsCommon: ['No mantener el tipo de salida.']
  },
  {
    id: 'illinois', name: 'Illinois Agility Test', short: 'Illinois', domains: ['Agilidad'], dash: 'Velocidad', bilateral: false, session: 2, order: 85, fatigue: 2, time: 12, nTrials: 2, rest: 180, diagram: 'illinois',
    capacity: 'Agilidad (cambios de dirección pre-planificados).', objective: 'Medir el tiempo del recorrido Illinois (10 × 5 m).', equipment: ['8 conos', 'Fotocélulas o cronómetro', 'Cinta métrica'],
    prep: ['Montar el circuito: 10 m de largo × 5 m de ancho; 4 conos centrales separados 3.3 m.', 'Salida en decúbito prono, manos a la altura de los hombros.'], activation: 'Calentamiento de sprint + 2 recorridos de familiarización al 70–80 %.',
    startPos: 'Decúbito prono, cabeza en la línea de salida, manos junto a los hombros.', execution: 'A la señal, levantarse y completar el recorrido lo más rápido posible sin derribar conos.', cue: 'A la señal, levántate y haz el recorrido lo más RÁPIDO posible sin tocar los conos.',
    familiarization: '1 recorrido submáximo.', valid: ['Recorrido correcto sin derribar conos.'], repeat: ['Cono derribado.', 'Recorrido incorrecto.'], stop: STOP_STD,
    fields: [{ k: 't', label: 'Tiempo', unit: 's', min: 10, max: 30, key: true, req: true, hib: false }],
    variables: 'Tiempo (s).', equations: ['Resultado = mejor tiempo'], units: 's', normalization: 'No aplica.', interpretation: NO_CUTOFF, error: 'Ver fiabilidad y MDC en Hachana 2013 (deportistas de equipo); verificar aplicabilidad.', refs: ['getchell1979', 'hachana2013'], errorsCommon: ['Circuito mal medido.', 'Cronometraje manual inconsistente.']
  },
  /* ---------------- BIOMECÁNICA / CARRERA ---------------- */
  {
    id: 'gait', name: 'Análisis de carrera — Qualisys + AMTI', short: 'Carrera 3D', mode: 'gait', domains: ['Carrera', 'Biomecánica'], dash: 'Biomecánica', bilateral: true, session: 2, order: 88, fatigue: 1, time: 45, nTrials: 5, rest: 60, diagram: 'gait',
    capacity: 'Cinética y cinemática de la carrera.', objective: 'Registrar variables temporoespaciales, fuerzas de reacción, tasas de carga y cinemática por lado.',
    equipment: ['Sistema Qualisys (cámaras, marcadores)', 'Plataformas AMTI empotradas', 'Fotocélulas para controlar velocidad'], prep: ['Calibración del volumen (wand) y de plataformas; registrar residuo.', 'Colocación de marcadores según modelo definido (registrar).', 'Definir velocidad objetivo (± 5 %) y calzado.', 'Frecuencias: cámaras ≥ 200 Hz; plataformas ≥ 1000 Hz.'],
    activation: 'Trote 5–8 min en el pasillo; carreras de familiarización hasta pisar la plataforma sin ajustar la zancada.', startPos: 'Inicio del pasillo, a distancia suficiente para alcanzar velocidad estable.',
    execution: 'Correr a la velocidad objetivo; registrar ≥ 5 contactos válidos por lado.', cue: 'Corre a tu ritmo natural a esta velocidad, mirando al frente. No busques la plataforma.',
    familiarization: '3–5 carreras de prueba.', valid: ['Velocidad dentro de ± 5 % del objetivo.', 'Contacto completo del pie en la plataforma, sin ajuste visible de zancada.', 'Marcadores visibles.'], repeat: ['Pie fuera de la plataforma o apuntado.', 'Velocidad fuera de rango.', 'Pérdida de marcadores.'], stop: STOP_STD,
    fields: [{ k: 'tc', label: 'Tiempo de contacto', unit: 's', min: 0.08, max: 0.5, hib: false, key: true }, { k: 'vgrf', label: 'Pico vGRF', unit: 'BW', min: 0.5, max: 6 }, { k: 'impact', label: 'Pico de impacto', unit: 'BW', min: 0, max: 5, opt: true }, { k: 'valr', label: 'Tasa de carga media (VALR)', unit: 'BW/s', min: 0, max: 300, hib: false }, { k: 'brake', label: 'Impulso de frenado', unit: 'N·s/kg', min: 0, max: 1, hib: false, opt: true }, { k: 'prop', label: 'Impulso propulsivo', unit: 'N·s/kg', min: 0, max: 1, opt: true }, { k: 'kneeIC', label: 'Flexión de rodilla en contacto', unit: '°', min: -10, max: 60, opt: true }, { k: 'kneeMax', label: 'Flexión máx. de rodilla en apoyo', unit: '°', min: 0, max: 90, opt: true }, { k: 'ankleDF', label: 'Dorsiflexión máx. en apoyo', unit: '°', min: 0, max: 50, opt: true }, { k: 'hipAdd', label: 'Aducción máx. de cadera', unit: '°', min: -10, max: 30, opt: true }, { k: 'pelvDrop', label: 'Caída pélvica contralateral', unit: '°', min: -5, max: 20, opt: true }],
    config: [{ k: 'speed', label: 'Velocidad objetivo', type: 'number', unit: 'm/s', span: 3, req: true }, { k: 'shoe', label: 'Calzado', type: 'text', span: 3 }, { k: 'model', label: 'Modelo de marcadores', type: 'text', span: 3 }, { k: 'residual', label: 'Residuo de calibración', type: 'number', unit: 'mm', span: 3 }],
    variables: 'Tiempo de contacto, pico vGRF, pico de impacto, tasa de carga, impulsos de frenado/propulsión, ángulos articulares clave por lado; importación CSV de fuerza para cálculo automático.', equations: ['VALR = Δ fuerza (20–80 % del pico de impacto) / Δ tiempo', 'Normalización: fuerza / peso corporal (BW)'], units: 's, BW, BW/s, N·s/kg, °',
    normalization: 'Fuerzas en BW; impulsos por masa.', interpretation: 'Interpretación contextual; una diferencia cinemática aislada no demuestra causalidad de lesión.', error: 'Depende de la colocación de marcadores (mismo evaluador) y de la velocidad. Registrar SEM propio.', refs: ['winter2009', 'milner2006'], errorsCommon: ['Velocidad no controlada.', 'Apuntar a la plataforma.', 'Cambiar modelo de marcadores entre evaluaciones.']
  },
  /* ---------------- CARDIORRESPIRATORIO ---------------- */
  {
    id: 'aero', name: 'Test aeróbico de campo + Polar', short: 'Aeróbico campo', mode: 'aero', domains: ['Capacidad cardiorrespiratoria'], dash: 'Cardiorrespiratorio', bilateral: false, session: 2, order: 99, fatigue: 3, time: 30, nTrials: 1, rest: 0, diagram: 'aero',
    capacity: 'Capacidad aeróbica (estimación indirecta) y respuesta de frecuencia cardiaca.', objective: 'Registrar rendimiento en un test de campo y la FC (reposo, pico, recuperación) con Polar.',
    equipment: ['Banda Polar H10 / reloj Polar', 'Pista medida o pasillo de 20 m', 'Audio del protocolo (si aplica)', 'Conos'],
    prep: ['Colocar banda humedecida; verificar señal.', 'FC de reposo: 5 min sentado en silencio.', 'Registrar temperatura, humedad, superficie.', 'Idealmente realizar en sesión separada o al final (máxima fatiga).'],
    activation: 'Trote suave 5–8 min + 2–3 progresiones.', startPos: 'Línea de salida.', execution: 'Realizar el protocolo seleccionado hasta el agotamiento voluntario o fin del tiempo; al finalizar, permanecer de pie/caminar según protocolo de recuperación y registrar FC a 1 y 2 min.',
    cue: 'Da tu máximo esfuerzo hasta el final; cuando termines, quédate de pie a mi lado para registrar la recuperación.', familiarization: 'Explicación del protocolo y 1 tramo de prueba.',
    valid: ['Protocolo completado según reglas (p. ej., 2 fallos consecutivos de la señal en pruebas de lanzadera).', 'Señal de FC sin interrupciones.'], repeat: ['No se repite el mismo día.'], stop: [...STOP_STD, 'Dolor torácico, disnea desproporcionada, palpitaciones o síntomas cardiovasculares.'],
    fields: [], config: [],
    variables: 'FC reposo, FC pico, FC 1 y 2 min, recuperación de FC (lpm), % FCmáx estimada, duración, distancia, velocidad final, VO₂max ESTIMADO (solo si el protocolo tiene ecuación publicada).', equations: ['FCR1 = FC pico − FC 1 min', 'FCR2 = FC pico − FC 2 min', 'Cooper: VO₂ est. = (d − 504.9) / 44.73', 'Yo-Yo IR1: VO₂ est. = d × 0.0084 + 36.4', 'Léger 20 m (adultos): VO₂ est. = −24.4 + 6.0 × v'], units: 'lpm, m, km/h, min, ml·kg⁻¹·min⁻¹',
    normalization: 'VO₂ por masa corporal (ya incluido en la ecuación).', interpretation: 'VO₂max ESTIMADO: no es una medición directa (requiere análisis de gases). La recuperación de FC es sensible a condiciones ambientales y al protocolo.', error: 'El error de estimación de las ecuaciones de campo es considerable a nivel individual.', refs: ['cooper1968', 'bangsbo2008', 'leger1988', 'tanaka2001', 'daanen2012', 'gilgen2019'], errorsCommon: ['Rotular el valor como «VO₂max medido».', 'Banda mal humedecida (artefactos).']
  }
];
/* Pruebas compuestas (añaden varios componentes) */
const TEST_GROUPS = [{ id: 'bosco', name: 'Batería de saltos de Bosco', desc: 'SJ + CMJ + Abalakov + Drop Jump + Saltos repetidos 15 s', tests: ['sj', 'cmj', 'abk', 'dj', 'rj'] }];
const T = id => TESTS.find(t => t.id === id);
TESTS.forEach(t => { t.fields = t.fields || []; t.config = t.config || []; t.errorsCommon = t.errorsCommon || []; t.metricMap = t.metricMap || {}; t.mode = t.mode || 'standard'; });

/* Métricas calculadas a nivel de intento */
function trialCalc(test, vals, cfg) {
  const v = Object.assign({}, vals);
  if (['sj', 'cmj', 'abk', 'cmju', 'dj', 'djprofile', 'cmjload', 'sjload'].includes(test.id)) {
    if (num(v.h) === null && num(v.tf) !== null) { v.h = +Calc.heightFromFlight(v.tf).toFixed(2); v._hFromTf = true; }
  }
  if (test.id === 'dj' || test.id === 'djprofile') { const r = Calc.rsi(v.h, v.tc); v.rsi = r === null ? null : +r.toFixed(3); }
  return v;
}
/* Claves de métrica global (para referencias y evolución) */
function metricKey(test, fk) { return test.metricMap[fk] || `${test.id}.${fk}`; }
/* ==========================================================
   Diagramas esquemáticos originales (SVG generado por código)
   Figura humana paramétrica en vista sagital + escenas por prueba.
   ========================================================== */
const DG = (() => {
  let mk = 0;
  const rad = d => d * Math.PI / 180;
  const rot = ([x, y], a) => [x * Math.cos(rad(a)) - y * Math.sin(rad(a)), x * Math.sin(rad(a)) + y * Math.cos(rad(a))];
  const r1 = v => Math.round(v * 10) / 10;
  /* figura: ángulos de muslo/pierna desde la vertical descendente (+ hacia delante),
     tronco desde la vertical ascendente (+ hacia delante), brazos desde la vertical descendente */
  function fig(o) {
    const f = o.f || 1, s = (o.s || 1) * 0.8;
    const L = { t: 46 * s, s: 44 * s, tr: 50 * s, ua: 32 * s, fa: 30 * s, h: 9 * s };
    const P = (p, len, ang, down = true) => [p[0] + len * Math.sin(rad(ang)) * f, p[1] + (down ? 1 : -1) * len * Math.cos(rad(ang))];
    const hip = [0, 0];
    const legs = (o.legs || [{}, {}]).map(l => { const knee = P(hip, L.t, l.th || 0), ank = P(knee, L.s, l.sh || 0); const a = (l.ft || 0) * f + (l.fr || 0); const heel = [ank[0] + rot([-6 * f * s, 5 * s], a)[0], ank[1] + rot([-6 * f * s, 5 * s], a)[1]]; const toe = [ank[0] + rot([17 * f * s, 5 * s], a)[0], ank[1] + rot([17 * f * s, 5 * s], a)[1]]; return { knee, ank, heel, toe, hide: l.hide, contact: l.contact !== false }; });
    const sh = P(hip, L.tr, o.tr || 0, false), head = P(sh, L.h + 5 * s, o.tr || 0, false);
    const arms = (o.arms || [{}, {}]).map(a => { const el = P(sh, L.ua, a.ua || 0); const hd = P(el, L.fa, a.fa || 0); return { el, hd, hide: a.hide }; });
    // transformación
    const R = o.rot || 0; const all = [];
    const tp = p => rot(p, R);
    const T = { hip: tp(hip), sh: tp(sh), head: tp(head), legs: legs.map(l => ({ knee: tp(l.knee), ank: tp(l.ank), heel: tp(l.heel), toe: tp(l.toe), hide: l.hide, contact: l.contact })), arms: arms.map(a => ({ el: tp(a.el), hd: tp(a.hd), hide: a.hide })) };
    let tx = o.x || 0, ty = o.y || 0;
    if (o.ground !== undefined) { const c = T.legs.filter(l => !l.hide && l.contact); const my = Math.max(...c.flatMap(l => [l.heel[1], l.toe[1]])); ty = o.ground - my - 1.5; tx = (o.x || 0) - T.legs[0].ank[0]; }
    const M = p => [r1(p[0] + tx), r1(p[1] + ty)];
    const pts = { hip: M(T.hip), sh: M(T.sh), head: M(T.head), legs: T.legs.map(l => ({ knee: M(l.knee), ank: M(l.ank), heel: M(l.heel), toe: M(l.toe) })), arms: T.arms.map(a => ({ el: M(a.el), hd: M(a.hd) })) };
    const ln = (a, b, cls, w) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="${cls}" stroke-width="${w * s}" stroke-linecap="round"/>`;
    const hl = o.hl ? `d-${o.hl}` : 'd-fig';
    const hl2 = o.hl2 ? `d-${o.hl2}` : 'd-fig2';
    let g = '';
    // lejanos
    if (!T.arms[1].hide) g += ln(pts.sh, pts.arms[1].el, 'd-fig2', 5) + ln(pts.arms[1].el, pts.arms[1].hd, 'd-fig2', 4.5);
    if (!T.legs[1].hide) g += ln(pts.hip, pts.legs[1].knee, hl2, 6.5) + ln(pts.legs[1].knee, pts.legs[1].ank, hl2, 6) + ln(pts.legs[1].heel, pts.legs[1].toe, hl2, 4.5);
    // tronco y cabeza
    g += ln(pts.hip, pts.sh, 'd-fig', 8) + `<circle cx="${pts.head[0]}" cy="${pts.head[1]}" r="${L.h}" class="d-head"/>`;
    // cercanos
    g += ln(pts.hip, pts.legs[0].knee, hl, 7) + ln(pts.legs[0].knee, pts.legs[0].ank, hl, 6.5) + ln(pts.legs[0].heel, pts.legs[0].toe, hl, 5);
    if (!T.arms[0].hide) g += ln(pts.sh, pts.arms[0].el, 'd-fig', 5.5) + ln(pts.arms[0].el, pts.arms[0].hd, 'd-fig', 5);
    [pts.hip, pts.legs[0].knee, pts.legs[0].ank].forEach(p => g += `<circle cx="${p[0]}" cy="${p[1]}" r="${2.6 * s}" class="d-joint"/>`);
    return { svg: `<g>${g}</g>`, pts };
  }
  const ground = (y, x1 = 0, x2 = 400) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="d-ground"/><g class="d-hatch">${Array.from({ length: Math.floor((x2 - x1) / 12) }, (_, i) => `<line x1="${x1 + i * 12}" y1="${y + 1}" x2="${x1 + i * 12 - 6}" y2="${y + 7}"/>`).join('')}</g>`;
  const txt = (x, y, t, cls = 'd-lab', anchor = 'middle') => `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}">${t}</text>`;
  const arrow = (x1, y1, x2, y2, cls = 'd-arrow', id) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}" marker-end="url(#${id})"/>`;
  const rect = (x, y, w, h, cls = 'd-eq', rx = 3) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" class="${cls}"/>`;
  const plate = (x, y, w = 80, lab = 'AMTI') => rect(x, y - 6, w, 6, 'd-plate', 1) + txt(x + w / 2, y + 16, lab, 'd-tiny');
  const angleArc = (c, a1, a2, r, lab) => { const p1 = [c[0] + r * Math.cos(rad(a1)), c[1] + r * Math.sin(rad(a1))], p2 = [c[0] + r * Math.cos(rad(a2)), c[1] + r * Math.sin(rad(a2))]; return `<path d="M${r1(p1[0])},${r1(p1[1])} A${r},${r} 0 0,${a2 > a1 ? 1 : 0} ${r1(p2[0])},${r1(p2[1])}" class="d-angle"/>` + (lab ? txt(r1(c[0] + (r + 10) * Math.cos(rad((a1 + a2) / 2))), r1(c[1] + (r + 10) * Math.sin(rad((a1 + a2) / 2))) + 3, lab, 'd-tiny d-acc-t') : ''); };
  const xmark = (x, y) => `<g class="d-badx"><circle cx="${x}" cy="${y}" r="9"/><line x1="${x - 4}" y1="${y - 4}" x2="${x + 4}" y2="${y + 4}"/><line x1="${x + 4}" y1="${y - 4}" x2="${x - 4}" y2="${y + 4}"/></g>`;
  const okmark = (x, y) => `<g class="d-okm"><circle cx="${x}" cy="${y}" r="9"/><path d="M${x - 4},${y} l3,3 l5,-6"/></g>`;
  const angDeg = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
  function wrap(w, h, inner, cap, pad = 38) {
    const id = 'ah' + (++mk);
    inner = inner.replace(/url\(#AH\)/g, `url(#${id})`);
    return `<svg viewBox="0 ${-pad} ${w} ${h + pad}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(cap || 'diagrama')}"><defs><marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-arrowhead"/></marker></defs>${inner}</svg>`;
  }
  const HANDS_HIP = [{ ua: -32, fa: 35 }, { ua: -32, fa: 35 }];
  const panel = (title, svg, kind = '') => ({ title, svg, kind });

  const S = {};
  /* ---- CMJ: secuencia ---- */
  S.cmj = () => {
    const g = 150, frames = [
      fig({ x: 45, ground: g, arms: HANDS_HIP }),
      fig({ x: 135, ground: g, tr: 38, legs: [{ th: 72, sh: -38 }, { th: 72, sh: -38 }], arms: HANDS_HIP }),
      fig({ x: 225, ground: g - 4, legs: [{ ft: 40, contact: true }, { ft: 40 }], arms: HANDS_HIP }),
      fig({ x: 315, ground: g - 28, legs: [{ ft: 20 }, { ft: 20 }], arms: HANDS_HIP }),
      fig({ x: 400, ground: g, tr: 18, legs: [{ th: 35, sh: -25 }, { th: 35, sh: -25 }], arms: HANDS_HIP })];
    let inner = ground(g, 0, 450) + plate(10, g, 430, 'Plataforma AMTI · cero sin carga antes de cada serie');
    frames.forEach(f => inner += f.svg);
    const b = frames[1].pts; inner += angleArc(b.legs[0].knee, angDeg(b.legs[0].knee, b.hip), angDeg(b.legs[0].knee, b.legs[0].ank), 12, '');
    inner += arrow(135, 30, 135, 50, 'd-arrow', 'AH') + arrow(225, 45, 225, 22, 'd-arrow', 'AH');
    ['1 Inicio', '2 Contramov.', '3 Despegue', '4 Vuelo', '5 Aterrizaje'].forEach((t, i) => inner += txt(45 + i * 89, 190, t, 'd-tiny'));
    return [panel('Secuencia del movimiento', wrap(450, 200, inner, 'CMJ secuencia')), S._err('Error: flexionar rodillas en el vuelo (alarga el tiempo de vuelo)', fig({ x: 80, ground: 120, legs: [{ th: 60, sh: -80 }, { th: 60, sh: -80 }], arms: HANDS_HIP }), 150), S._err('Error: manos separadas de la cadera', fig({ x: 80, ground: 150, arms: [{ ua: 160, fa: 170 }, { ua: 150, fa: 165 }] }), 150)];
  };
  S._err = (title, f, g, extra = '') => panel(title, wrap(200, 170, ground(g, 0, 200) + f.svg + extra + xmark(170, 25), title), 'err');
  S.sj = () => {
    const g = 150, a = fig({ x: 70, ground: g, tr: 35, legs: [{ th: 70, sh: -20 }, { th: 70, sh: -20 }], arms: HANDS_HIP }), b = fig({ x: 190, ground: g - 4, legs: [{ ft: 40 }, { ft: 40 }], arms: HANDS_HIP });
    let inner = ground(g, 0, 280) + plate(20, g, 240) + a.svg + b.svg;
    const p = a.pts; inner += angleArc(p.legs[0].knee, angDeg(p.legs[0].knee, p.hip), angDeg(p.legs[0].knee, p.legs[0].ank), 14, '90°');
    inner += txt(70, 190, 'Rodillas 90°, quieto 2–3 s', 'd-tiny') + txt(200, 190, 'Sin contramovimiento', 'd-tiny') + arrow(190, 40, 190, 18, 'd-arrow', 'AH');
    return [panel('Posición inicial y despegue', wrap(280, 200, inner, 'SJ')), S._err('Error: descender antes de saltar (contramovimiento)', fig({ x: 90, ground: 150, tr: 45, legs: [{ th: 85, sh: -45 }, { th: 85, sh: -45 }], arms: HANDS_HIP }), 150, arrow(140, 60, 140, 90, 'd-bad', 'AH'))];
  };
  S.abk = () => {
    const g = 150, a = fig({ x: 60, ground: g, tr: 35, legs: [{ th: 70, sh: -35 }, { th: 70, sh: -35 }], arms: [{ ua: -60, fa: -50 }, { ua: -55, fa: -45 }] }), b = fig({ x: 180, ground: g - 4, legs: [{ ft: 40 }, { ft: 40 }], arms: [{ ua: 170, fa: 175 }, { ua: 165, fa: 172 }] });
    let inner = ground(g, 0, 260) + plate(15, g, 230) + a.svg + b.svg + arrow(40, 70, 70, 20, 'd-arrow', 'AH') + txt(60, 190, 'Brazos atrás', 'd-tiny') + txt(180, 190, 'Brazos arriba al despegar', 'd-tiny');
    return [panel('Balanceo de brazos', wrap(260, 200, inner, 'Abalakov'))];
  };
  S.cmju = () => {
    const g = 150, a = fig({ x: 60, ground: g, hl: 'R', legs: [{}, { th: 20, sh: -70, contact: false }], arms: HANDS_HIP }), b = fig({ x: 170, ground: g, hl: 'R', tr: 35, legs: [{ th: 70, sh: -38 }, { th: 55, sh: -85, contact: false }], arms: HANDS_HIP }), c = fig({ x: 270, ground: g - 20, hl: 'R', legs: [{ ft: 30 }, { th: 20, sh: -70, contact: false }], arms: HANDS_HIP });
    let inner = ground(g, 0, 330) + plate(15, g, 300) + a.svg + b.svg + c.svg + txt(60, 190, 'Apoyo unipodal', 'd-tiny') + txt(170, 190, 'Contramovimiento', 'd-tiny') + txt(275, 190, 'Misma pierna', 'd-tiny');
    return [panel('CMJ unilateral (pierna evaluada resaltada)', wrap(330, 200, inner, 'CMJ unilateral')), S._err('Error: balanceo de la pierna libre', fig({ x: 80, ground: 150, hl: 'R', legs: [{}, { th: 70, sh: 10, contact: false }], arms: HANDS_HIP }), 150, arrow(120, 110, 150, 80, 'd-bad', 'AH'))];
  };
  S.dj = () => {
    const g = 160, box = rect(10, g - 40, 60, 40, 'd-eq');
    const a = fig({ x: 35, ground: g - 40, arms: HANDS_HIP }), b = fig({ x: 140, ground: g, tr: 25, legs: [{ th: 45, sh: -30 }, { th: 45, sh: -30 }], arms: HANDS_HIP }), c = fig({ x: 235, ground: g - 30, legs: [{ ft: 30 }, { ft: 30 }], arms: HANDS_HIP });
    let inner = ground(g, 0, 300) + box + txt(40, g - 18, 'cajón', 'd-tiny') + txt(40, g - 6, 'h = __ cm', 'd-tiny') + plate(95, g, 180) + a.svg + b.svg + c.svg + arrow(75, 40, 110, 80, 'd-arrow', 'AH') + arrow(235, 50, 235, 25, 'd-arrow', 'AH') + txt(40, 195, '1 · Paso al vacío', 'd-tiny') + txt(140, 195, '2 · Contacto mínimo', 'd-tiny') + txt(235, 195, '3 · Rebote máximo', 'd-tiny');
    return [panel('Drop Jump', wrap(300, 205, inner, 'Drop jump')), S._err('Error: saltar hacia arriba desde el cajón (aumenta la altura de caída)', fig({ x: 60, ground: 110, legs: [{ ft: 30 }, { ft: 30 }], arms: HANDS_HIP }), 150, rect(20, 110, 60, 40) + arrow(90, 60, 110, 40, 'd-bad', 'AH'))];
  };
  S.rj = () => {
    const g = 150; let inner = ground(g, 0, 300) + plate(20, g, 260, 'Plataforma de contacto / AMTI');
    [0, 1, 2, 3].forEach(i => { const up = i % 2; inner += fig({ x: 50 + i * 65, ground: up ? g - 25 : g, tr: up ? 0 : 30, legs: up ? [{ ft: 35 }, { ft: 35 }] : [{ th: 65, sh: -35 }, { th: 65, sh: -35 }], arms: HANDS_HIP, s: 0.8 }).svg; });
    inner += txt(150, 190, 'Saltos máximos continuos · manos en la cadera', 'd-tiny');
    return [panel('Saltos continuos', wrap(300, 200, inner, 'Saltos repetidos'))];
  };
  /* ---- IMTP ---- */
  S.imtp = () => {
    const g = 175, f = fig({ x: 110, ground: g, tr: 18, legs: [{ th: 25, sh: -15 }, { th: 25, sh: -15 }], arms: [{ ua: -8, fa: -8 }, { ua: -8, fa: -8 }] });
    const h = f.pts.arms[0].hd; const p = f.pts;
    let inner = ground(g, 0, 300) + plate(60, g, 120) + rect(30, 20, 8, g - 26, 'd-eq', 1) + rect(200, 20, 8, g - 26, 'd-eq', 1) + `<line x1="20" y1="${h[1]}" x2="230" y2="${h[1]}" class="d-bar"/>` + f.svg;
    inner += angleArc(p.legs[0].knee, angDeg(p.legs[0].knee, p.hip), angDeg(p.legs[0].knee, p.legs[0].ank), 14, '125–145°');
    inner += angleArc(p.hip, angDeg(p.hip, p.sh), angDeg(p.hip, p.legs[0].knee), 16, '140–150°');
    inner += txt(245, h[1] - 6, 'Barra fija a', 'd-tiny', 'start') + txt(245, h[1] + 6, 'mitad del muslo', 'd-tiny', 'start') + txt(245, 50, 'Tronco erguido;', 'd-tiny', 'start') + txt(245, 62, 'hombros sobre', 'd-tiny', 'start') + txt(245, 74, 'la barra', 'd-tiny', 'start') + txt(245, 160, 'Brazos extendidos', 'd-tiny', 'start') + txt(245, 172, 'con straps', 'd-tiny', 'start') + arrow(110, g + 2, 110, g + 20, 'd-arrow', 'AH');
    const e = fig({ x: 100, ground: 150, tr: 55, legs: [{ th: 60, sh: -40 }, { th: 60, sh: -40 }], arms: [{ ua: 0, fa: 0 }, { ua: 0, fa: 0 }] });
    return [panel('Posición IMTP', wrap(330, 205, inner, 'IMTP')), S._err('Error: barra baja (postura de peso muerto)', e, 150, `<line x1="40" y1="${e.pts.arms[0].hd[1]}" x2="170" y2="${e.pts.arms[0].hd[1]}" class="d-bar"/>`)];
  };
  /* ---- isométricos ---- */
  S.quadiso = () => {
    const f = fig({ x: 0, y: 0, rot: 0, tr: -5, legs: [{ th: 90, sh: 0 }, { th: 90, sh: 0 }], arms: [{ ua: 15, fa: 95 }, { ua: 15, fa: 95 }], hl: 'R' });
    const off = [90, 110]; const tr = p => [p[0] + off[0], p[1] + off[1]];
    const k = tr(f.pts.legs[0].knee), a = tr(f.pts.legs[0].ank), hp = tr(f.pts.hip);
    let inner = ground(190, 0, 320) + `<g transform="translate(${off[0]},${off[1]})">${f.svg}</g>` + rect(hp[0] - 20, hp[1] + 4, 70, 10, 'd-eq') + rect(hp[0] - 22, hp[1] + 14, 8, 190 - hp[1] - 14, 'd-eq', 1) + rect(hp[0] + 40, hp[1] + 14, 8, 190 - hp[1] - 14, 'd-eq', 1);
    inner += `<line x1="${a[0]}" y1="${a[1] - 8}" x2="${a[0] + 60}" y2="${a[1] - 8}" class="d-strap"/>` + rect(a[0] + 58, a[1] - 18, 22, 20, 'd-sensor') + rect(a[0] + 80, a[1] - 40, 8, 190 - a[1] + 40, 'd-eq', 1);
    inner += txt(a[0] + 69, a[1] + 16, 'celda', 'd-tiny') + angleArc(k, angDeg(k, hp), angDeg(k, a), 14, '90°') + `<line x1="${k[0]}" y1="${k[1]}" x2="${a[0]}" y2="${a[1] - 8}" class="d-dim"/>` + txt(k[0] - 26, (k[1] + a[1]) / 2 + 8, 'brazo de', 'd-tiny', 'end') + txt(k[0] - 26, (k[1] + a[1]) / 2 + 19, 'palanca', 'd-tiny', 'end') + arrow(a[0] + 10, a[1] + 8, a[0] + 35, a[1] + 8, 'd-arrow', 'AH') + txt(230, 40, 'Correa perpendicular', 'd-tiny', 'start') + txt(230, 52, 'a la tibia, 2–3 cm', 'd-tiny', 'start') + txt(230, 64, 'sobre el maléolo', 'd-tiny', 'start');
    return [panel('Montaje: sedente, rodilla 90°', wrap(330, 200, inner, 'Isométrico cuádriceps'))];
  };
  S.hamiso = () => {
    const f = fig({ x: 0, y: 0, rot: 90, tr: 0, legs: [{ th: 0, sh: -30, ft: 0 }, { th: 0, sh: 0 }], arms: [{ ua: 160, fa: 160 }, { ua: 160, fa: 160 }], hl: 'R' });
    const off = [210, 110], tr = p => [p[0] + off[0], p[1] + off[1]]; const a = tr(f.pts.legs[0].ank), k = tr(f.pts.legs[0].knee), hp = tr(f.pts.hip);
    let inner = ground(190, 0, 330) + rect(20, 122, 290, 10, 'd-eq') + rect(30, 132, 8, 58, 'd-eq', 1) + rect(290, 132, 8, 58, 'd-eq', 1) + `<g transform="translate(${off[0]},${off[1]})">${f.svg}</g>`;
    inner += rect(a[0] - 8, a[1] - 26, 18, 16, 'd-sensor') + `<line x1="${a[0] + 1}" y1="${a[1] - 26}" x2="${a[0] + 1}" y2="20" class="d-strap"/>` + txt(a[0] + 30, a[1] - 16, 'celda', 'd-tiny') + `<line x1="${hp[0]}" y1="${hp[1] - 12}" x2="${hp[0]}" y2="${hp[1] + 12}" class="d-strap"/>` + txt(hp[0], hp[1] - 18, 'correa pélvica', 'd-tiny') + angleArc(k, angDeg(k, hp), angDeg(k, a), 12, '') + txt(165, 178, 'Prono · rodilla 15–30° · talón hacia el glúteo', 'd-tiny');
    return [panel('Montaje: prono', wrap(330, 200, inner, 'Isométrico isquiotibiales'))];
  };
  S.plantiso = () => {
    const f = fig({ x: 110, ground: 160, tr: -5, legs: [{ th: 90, sh: 0 }, { th: 90, sh: 0 }], arms: [{ ua: 10, fa: 60 }, { ua: 10, fa: 60 }], hl: 'R' });
    const k = f.pts.legs[0].knee;
    let inner = ground(190, 0, 300) + rect(20, 160, 260, 30, 'd-eq') + plate(k[0] - 20, 160, 70, 'plataforma') + rect(f.pts.hip[0] - 30, f.pts.hip[1] + 4, 60, 8, 'd-eq') + f.svg + rect(k[0] - 16, k[1] - 16, 36, 9, 'd-sensor') + rect(k[0] - 22, 10, 6, k[1] - 26, 'd-eq', 1) + `<line x1="${k[0] - 19}" y1="${k[1] - 16}" x2="${k[0] + 30}" y2="${k[1] - 16}" class="d-bar"/>` + arrow(k[0] + 40, 150, k[0] + 40, 125, 'd-arrow', 'AH') + txt(215, 60, 'Barra fija sobre', 'd-tiny', 'start') + txt(215, 72, 'el muslo', 'd-tiny', 'start') + txt(215, 110, 'Empujar con', 'd-tiny', 'start') + txt(215, 122, 'el antepié', 'd-tiny', 'start');
    return [panel('Montaje sedente (rodilla 90°)', wrap(330, 200, inner, 'Isométrico flexores plantares'))];
  };
  S.hipext = () => {
    const f = fig({ x: 0, y: 0, rot: 90, legs: [{ th: -8, sh: -90 }, { th: 0, sh: 0 }], arms: [{ ua: 160, fa: 160 }, { ua: 160, fa: 160 }], hl: 'R' });
    const off = [200, 115], tr = p => [p[0] + off[0], p[1] + off[1]]; const k = tr(f.pts.legs[0].knee);
    let inner = ground(190, 0, 330) + rect(20, 127, 290, 10, 'd-eq') + rect(30, 137, 8, 53, 'd-eq', 1) + rect(290, 137, 8, 53, 'd-eq', 1) + `<g transform="translate(${off[0]},${off[1]})">${f.svg}</g>` + rect(k[0] - 22, k[1] - 22, 16, 12, 'd-sensor') + `<line x1="${k[0] - 14}" y1="${k[1] - 22}" x2="${k[0] - 14}" y2="20" class="d-strap"/>` + arrow(k[0] + 20, k[1] - 5, k[0] + 20, k[1] - 30, 'd-arrow', 'AH') + txt(165, 180, 'Prono · rodilla 90° · pelvis fijada', 'd-tiny');
    return [panel('Montaje: extensión de cadera', wrap(330, 200, inner, 'Isométrico extensores cadera'))];
  };
  S.hipabd = () => {
    // vista superior esquemática
    let inner = rect(40, 60, 250, 70, 'd-eq', 8) + `<circle cx="70" cy="95" r="14" class="d-head"/>` + `<line x1="85" y1="95" x2="170" y2="95" class="d-fig" stroke-width="16" stroke-linecap="round"/>` + `<line x1="170" y1="88" x2="275" y2="80" class="d-R" stroke-width="9" stroke-linecap="round"/>` + `<line x1="170" y1="102" x2="275" y2="106" class="d-fig2" stroke-width="9" stroke-linecap="round"/>` + rect(262, 64, 16, 10, 'd-sensor') + `<path d="M270,64 C270,30 300,30 300,60 L300,150 C300,170 250,170 250,150" class="d-strap" fill="none"/>` + arrow(250, 70, 250, 45, 'd-arrow', 'AH') + txt(165, 160, 'Vista superior · supino · correa en la camilla', 'd-tiny') + txt(270, 40, 'sensor 5 cm sobre maléolo', 'd-tiny', 'end');
    return [panel('Montaje: abducción de cadera (supino)', wrap(330, 180, inner, 'Isométrico abductores'))];
  };
  /* ---- movilidad ---- */
  S.wblt = () => {
    const g = 170; const f = fig({ x: 150, ground: g, tr: 8, hl: 'R', legs: [{ th: 50, sh: -38 }, { th: -28, sh: -62, ft: 35 }], arms: [{ ua: 62, fa: 70 }, { ua: 62, fa: 70 }] });
    const p = f.pts; const wallX = p.legs[0].knee[0] + 3;
    let inner = ground(g, 0, 330) + rect(wallX, 10, 12, g - 10, 'd-wall', 0) + f.svg + `<line x1="${p.legs[0].toe[0]}" y1="${g + 6}" x2="${wallX}" y2="${g + 6}" class="d-dim"/>` + txt((p.legs[0].toe[0] + wallX) / 2, g + 20, 'distancia dedo–pared (cm)', 'd-tiny');
    const km = [(p.legs[0].knee[0] * 0.7 + p.legs[0].ank[0] * 0.3), (p.legs[0].knee[1] * 0.7 + p.legs[0].ank[1] * 0.3)];
    inner += rect(km[0] - 7, km[1] - 5, 14, 10, 'd-sensor') + txt(km[0] + 14, km[1] - 16, 'inclinómetro', 'd-tiny', 'start') + `<line x1="${p.legs[0].ank[0]}" y1="${p.legs[0].ank[1]}" x2="${p.legs[0].ank[0]}" y2="${p.legs[0].ank[1] - 50}" class="d-dim"/>` + angleArc(p.legs[0].ank, -90, angDeg(p.legs[0].ank, p.legs[0].knee), 30, 'θ') + okmark(p.legs[0].heel[0] - 14, g - 12) + txt(p.legs[0].heel[0] - 26, g - 8, 'talón apoyado', 'd-tiny', 'end') + arrow(p.legs[0].knee[0] - 30, p.legs[0].knee[1] - 12, p.legs[0].knee[0] - 5, p.legs[0].knee[1] - 12, 'd-arrow', 'AH') + txt(wallX + 16, 30, 'pared', 'd-tiny', 'start');
    const e = fig({ x: 80, ground: 150, hl: 'R', tr: 8, legs: [{ th: 58, sh: -50, ft: 22 }, { th: -28, sh: -62, ft: 35 }], arms: [{ ua: 62, fa: 70 }, { ua: 62, fa: 70 }] });
    return [panel('Posición y medición (lado derecho resaltado)', wrap(330, 195, inner, 'WBLT')), S._err('Error: talón despegado del suelo', e, 150, rect(e.pts.legs[0].knee[0] + 3, 10, 10, 140, 'd-wall', 0))];
  };
  S.sitreach = () => {
    const f = fig({ x: 0, y: 0, rot: -90, tr: 0, legs: [{ th: 0, sh: 0, ft: -5 }, { th: 0, sh: 0 }], arms: [{ ua: 0, fa: 0 }, { ua: 0, fa: 0 }] });
    // sentado: tronco inclinado adelante; construir directamente
    const g = 160; const s = fig({ x: 0, y: 0, tr: 42, legs: [{ th: 90, sh: 90, ft: -90 }, { th: 90, sh: 90, ft: -90 }], arms: [{ ua: 110, fa: 100 }, { ua: 110, fa: 100 }] });
    const off = [40, g - 8]; const T2 = p => [p[0] + off[0], p[1] + off[1]]; const toe = T2(s.pts.legs[0].ank);
    let inner = ground(g, 0, 330) + `<g transform="translate(${off[0]},${off[1]})">${s.svg}</g>` + rect(toe[0] + 4, g - 36, 60, 36, 'd-eq') + rect(toe[0] - 30, g - 40, 94, 4, 'd-plate', 1) + txt(toe[0] + 34, g - 16, 'cajón', 'd-tiny') + arrow(T2(s.pts.arms[0].hd)[0] - 10, g - 48, T2(s.pts.arms[0].hd)[0] + 20, g - 48, 'd-arrow', 'AH') + txt(165, 30, 'Rodillas extendidas · sin rebote · mantener 2 s', 'd-tiny');
    return [panel('Sit-and-Reach', wrap(330, 180, inner, 'Sit and reach'))];
  };
  S.hiprom = () => {
    const f = fig({ x: 0, y: 0, rot: -90, legs: [{ th: 110, sh: 20 }, { th: 0, sh: 0 }], arms: [{ ua: 10, fa: 10 }, { ua: 10, fa: 10 }], hl: 'R' });
    const off = [130, 120], tr = p => [p[0] + off[0], p[1] + off[1]]; const hp = tr(f.pts.hip), k = tr(f.pts.legs[0].knee);
    let inner = ground(190, 0, 330) + rect(20, 132, 290, 10, 'd-eq') + `<g transform="translate(${off[0]},${off[1]})">${f.svg}</g>` + angleArc(hp, 0, angDeg(hp, k), 22, 'flexión') + rect(hp[0] - 6, hp[1] - 6, 12, 12, 'd-sensor') + txt(165, 175, 'Supino · pelvis estabilizada · eje en trocánter mayor', 'd-tiny');
    return [panel('Flexión de cadera (ejemplo)', wrap(330, 195, inner, 'ROM cadera'))];
  };
  S.kneerom = () => {
    const f = fig({ x: 0, y: 0, rot: -90, legs: [{ th: 60, sh: -80 }, { th: 0, sh: 0 }], arms: [{ ua: 10, fa: 10 }, { ua: 10, fa: 10 }], hl: 'R' });
    const off = [130, 120], tr = p => [p[0] + off[0], p[1] + off[1]]; const hp = tr(f.pts.hip), k = tr(f.pts.legs[0].knee), a = tr(f.pts.legs[0].ank);
    let inner = ground(190, 0, 330) + rect(20, 132, 290, 10, 'd-eq') + `<g transform="translate(${off[0]},${off[1]})">${f.svg}</g>` + angleArc(k, angDeg(k, hp), angDeg(k, a), 14, '') + rect(k[0] - 6, k[1] - 6, 12, 12, 'd-sensor') + txt(165, 175, 'Trocánter mayor · epicóndilo lateral · maléolo lateral', 'd-tiny');
    return [panel('Flexión de rodilla', wrap(330, 195, inner, 'ROM rodilla'))];
  };
  S.slr = () => {
    const f = fig({ x: 0, y: 0, rot: -90, legs: [{ th: 70, sh: 70, ft: -10 }, { th: 0, sh: 0 }], arms: [{ ua: 10, fa: 10 }, { ua: 10, fa: 10 }], hl: 'L' });
    const off = [120, 120], tr = p => [p[0] + off[0], p[1] + off[1]]; const hp = tr(f.pts.hip), k = tr(f.pts.legs[0].knee), a = tr(f.pts.legs[0].ank);
    let inner = ground(190, 0, 330) + rect(20, 132, 290, 10, 'd-eq') + `<g transform="translate(${off[0]},${off[1]})">${f.svg}</g>` + angleArc(hp, 0, angDeg(hp, k), 30, 'SLR') + rect((k[0] + a[0]) / 2 - 8, (k[1] + a[1]) / 2 - 5, 16, 10, 'd-sensor') + `<line x1="250" y1="124" x2="250" y2="142" class="d-strap"/>` + txt(250, 116, 'correa', 'd-tiny') + txt(165, 175, 'Rodilla extendida · contralateral fijada', 'd-tiny');
    return [panel('Straight Leg Raise pasivo', wrap(330, 195, inner, 'SLR')), S._err('Error: flexión de rodilla / elevación de pelvis', fig({ x: 70, y: 125, rot: -90, legs: [{ th: 80, sh: 30 }, { th: 0, sh: 0 }], hl: 'L', arms: [{ ua: 10, fa: 10 }, { ua: 10, fa: 10 }] }), 150)];
  };
  S.grip = () => {
    const f = fig({ x: 120, ground: 170, tr: 0, legs: [{ th: 90, sh: 0 }, { th: 90, sh: 0 }], arms: [{ ua: 0, fa: 90 }, { ua: 0, fa: 90 }] });
    const h = f.pts.arms[0].hd, e = f.pts.arms[0].el;
    let inner = ground(170, 0, 300) + rect(f.pts.hip[0] - 25, f.pts.hip[1] + 5, 50, 8, 'd-eq') + rect(f.pts.hip[0] - 25, f.pts.hip[1] + 13, 6, 170 - f.pts.hip[1] - 13, 'd-eq', 1) + f.svg + rect(h[0] - 2, h[1] - 14, 10, 26, 'd-sensor') + angleArc(e, angDeg(e, f.pts.sh), angDeg(e, h), 12, '90°') + txt(230, 60, 'Hombro aducido', 'd-tiny', 'start') + txt(230, 72, 'Codo 90°', 'd-tiny', 'start') + txt(230, 84, 'Antebrazo neutro', 'd-tiny', 'start') + txt(230, 96, 'Muñeca 0–30° ext.', 'd-tiny', 'start');
    return [panel('Posición ASHT (sedente)', wrap(320, 190, inner, 'Handgrip')), S._err('Error: codo extendido o brazo apoyado', fig({ x: 90, ground: 150, legs: [{ th: 90, sh: 0 }, { th: 90, sh: 0 }], arms: [{ ua: 30, fa: 30 }, { ua: 20, fa: 20 }] }), 150)];
  };
  S.slcr = () => {
    const g = 170; const a = fig({ x: 70, ground: g - 18, hl: 'R', legs: [{ ft: -10 }, { th: 15, sh: -60, contact: false }], arms: [{ ua: 80, fa: 80 }, { ua: 80, fa: 80 }] }), b = fig({ x: 190, ground: g - 18, hl: 'R', legs: [{ ft: 45 }, { th: 15, sh: -60, contact: false }], arms: [{ ua: 80, fa: 80 }, { ua: 80, fa: 80 }] });
    let inner = ground(g, 0, 310) + rect(40, g - 18, 60, 18, 'd-eq') + rect(160, g - 18, 60, 18, 'd-eq') + rect(290, 10, 10, g - 10, 'd-wall', 0) + a.svg + b.svg + arrow(215, 150, 215, 120, 'd-arrow', 'AH') + txt(70, g + 20, 'Talón abajo', 'd-tiny') + txt(190, g + 20, 'Altura máxima', 'd-tiny') + txt(255, 30, 'dedos en la pared', 'd-tiny');
    return [panel('Single Leg Calf Raise', wrap(310, 200, inner, 'Calf raise'))];
  };
  S.encoder = () => {
    const g = 175; const a = fig({ x: 90, ground: g, tr: 35, legs: [{ th: 80, sh: -35 }, { th: 80, sh: -35 }], arms: [{ ua: 150, fa: -30 }, { ua: 150, fa: -30 }] }), b = fig({ x: 220, ground: g, legs: [{}, {}], arms: [{ ua: 150, fa: -30 }, { ua: 150, fa: -30 }] });
    let inner = ground(g, 0, 320);
    [a, b].forEach(f => { const s = f.pts.sh; inner += `<line x1="${s[0] - 40}" y1="${s[1] + 2}" x2="${s[0] + 40}" y2="${s[1] + 2}" class="d-bar"/>` + `<rect x="${s[0] - 46}" y="${s[1] - 12}" width="8" height="28" class="d-eq"/>` + `<line x1="${s[0] - 30}" y1="${s[1] + 2}" x2="${s[0] - 30}" y2="${g - 10}" class="d-cable"/>` + rect(s[0] - 38, g - 10, 16, 10, 'd-sensor'); });
    inner += a.svg + b.svg + arrow(260, 110, 260, 60, 'd-arrow', 'AH') + txt(90, g + 18, 'Excéntrica controlada', 'd-tiny') + txt(230, g + 18, 'Concéntrica máxima', 'd-tiny') + txt(160, 14, 'Cable del encoder vertical', 'd-tiny');
    return [panel('Sentadilla con encoder lineal', wrap(320, 200, inner, 'Encoder'))];
  };
  /* ---- hops ---- */
  S.hop = () => {
    const g = 150; const a = fig({ x: 40, ground: g, hl: 'R', tr: 30, legs: [{ th: 55, sh: -30 }, { th: 10, sh: -80, contact: false }], arms: [{ ua: -50, fa: -40 }, { ua: -50, fa: -40 }], s: 0.85 }), b = fig({ x: 250, ground: g, hl: 'R', tr: 25, legs: [{ th: 45, sh: -25 }, { th: 20, sh: -80, contact: false }], arms: [{ ua: 40, fa: 50 }, { ua: 40, fa: 50 }], s: 0.85 });
    let inner = ground(g, 0, 330) + `<line x1="52" y1="${g - 2}" x2="310" y2="${g - 2}" class="d-tape"/>` + `<line x1="52" y1="${g - 18}" x2="52" y2="${g + 4}" class="d-mark"/>` + a.svg + b.svg + `<path d="M70,90 Q150,10 235,90" class="d-traj" fill="none" marker-end="url(#AH)"/>` + `<line x1="52" y1="${g + 12}" x2="${b.pts.legs[0].heel[0]}" y2="${g + 12}" class="d-dim"/>` + txt((52 + b.pts.legs[0].heel[0]) / 2, g + 26, 'distancia: línea → talón', 'd-tiny') + txt(270, 40, 'Aterrizaje estable 2 s', 'd-tiny');
    return [panel('Single Leg Hop', wrap(330, 185, inner, 'Single hop')), S._err('Error: apoyo de la otra pierna al aterrizar', fig({ x: 80, ground: 150, hl: 'R', tr: 25, legs: [{ th: 45, sh: -25 }, { th: -20, sh: -10 }], arms: [{ ua: 60, fa: 60 }, { ua: 40, fa: 50 }] }), 150)];
  };
  S.triplehop = () => {
    let inner = ground(150, 0, 330) + `<line x1="20" y1="148" x2="320" y2="148" class="d-tape"/>` + `<line x1="20" y1="132" x2="20" y2="154" class="d-mark"/>`;
    [[20, 95], [95, 175], [175, 260]].forEach(([a, b]) => inner += `<path d="M${a + 8},140 Q${(a + b) / 2},${60} ${b},140" class="d-traj" fill="none" marker-end="url(#AH)"/>`);
    inner += fig({ x: 275, ground: 150, hl: 'R', tr: 25, legs: [{ th: 45, sh: -25 }, { th: 20, sh: -80, contact: false }], arms: [{ ua: 40, fa: 50 }, { ua: 40, fa: 50 }], s: 0.75 }).svg + txt(165, 175, 'Tres saltos · misma pierna · distancia total', 'd-tiny');
    return [panel('Triple Hop (vista lateral)', wrap(330, 185, inner, 'Triple hop'))];
  };
  S.crosshop = () => {
    let inner = rect(20, 72, 290, 16, 'd-strip', 0) + `<line x1="20" y1="72" x2="310" y2="72" class="d-tape"/>` + txt(165, 84, 'franja 15 cm', 'd-tiny');
    const pts = [[30, 60], [110, 102], [190, 58], [270, 102]];
    pts.forEach((p, i) => { inner += `<ellipse cx="${p[0]}" cy="${p[1]}" rx="11" ry="6" class="d-foot"/>`; if (i) inner += `<path d="M${pts[i - 1][0] + 8},${pts[i - 1][1]} L${p[0] - 10},${p[1]}" class="d-traj" marker-end="url(#AH)"/>`; });
    inner += txt(30, 45, 'salida', 'd-tiny') + txt(270, 125, 'aterrizaje final 2 s', 'd-tiny') + txt(165, 150, 'Vista superior · 1.er salto hacia medial', 'd-tiny');
    return [panel('Crossover Hop (vista superior)', wrap(330, 160, inner, 'Crossover hop'))];
  };
  S.ybal = () => {
    const c = [165, 95]; let inner = '';
    const dirs = [[-90, 'ANTERIOR'], [45, 'POSTEROLATERAL'], [135, 'POSTEROMEDIAL']];
    dirs.forEach(([a, l]) => { const e = [c[0] + 80 * Math.cos(rad(a)), c[1] + 80 * Math.sin(rad(a))]; inner += `<line x1="${c[0]}" y1="${c[1]}" x2="${r1(e[0])}" y2="${r1(e[1])}" class="d-tape"/>` + arrow(c[0] + 20 * Math.cos(rad(a)), c[1] + 20 * Math.sin(rad(a)), r1(c[0] + 70 * Math.cos(rad(a))), r1(c[1] + 70 * Math.sin(rad(a))), 'd-arrow', 'AH') + txt(r1(e[0]), r1(e[1] + (a < 0 ? -6 : 14)), l, 'd-tiny'); });
    inner += `<ellipse cx="${c[0]}" cy="${c[1] + 4}" rx="7" ry="13" class="d-foot d-R-f"/>` + txt(40, 190, 'Vista superior (pie D de apoyo)', 'd-tiny', 'start') + txt(290, 190, '135° / 135° / 90°', 'd-tiny', 'end');
    return [panel('Direcciones de alcance', wrap(330, 200, inner, 'Y-Balance'))];
  };
  S.sprint = () => {
    let inner = ground(150, 0, 330) + `<line x1="20" y1="148" x2="320" y2="148" class="d-tape"/>`;
    [[40, '0 m'], [140, '10 m'], [220, '20 m'], [300, '30 m']].forEach(([x, l]) => inner += rect(x - 3, 90, 6, 58, 'd-eq', 1) + `<circle cx="${x}" cy="92" r="5" class="d-sensor"/>` + `<line x1="${x}" y1="110" x2="${x + 30}" y2="110" class="d-beam"/>` + txt(x, 170, l, 'd-tiny'));
    inner += fig({ x: 22, ground: 150, tr: 45, legs: [{ th: 50, sh: -10 }, { th: -20, sh: -50, ft: 30 }], arms: [{ ua: 60, fa: 40 }, { ua: -40, fa: -10 }], s: 0.7 }).svg + txt(180, 30, 'Fotocélulas a altura de cadera · salida estandarizada', 'd-tiny');
    return [panel('Disposición de fotocélulas', wrap(330, 180, inner, 'Sprint'))];
  };
  S.illinois = () => {
    const X = x => 40 + x * 25, Y = y => 20 + y * 13; let inner = rect(X(0), Y(0), 250, 130, 'd-court', 4);
    const cones = [[0, 0], [10, 0], [0, 10], [10, 10], [5, 1.6], [5, 4.3], [5, 7], [5, 9.3]];
    cones.forEach(([x, y]) => inner += `<path d="M${X(x)},${Y(y) - 6} l5,10 h-10 z" class="d-cone"/>`);
    inner += `<path d="M${X(0) + 8},${Y(10)} L${X(0) + 10},${Y(0) + 8} L${X(4.2)},${Y(1)} L${X(5.8)},${Y(3)} L${X(4.2)},${Y(5.6)} L${X(5.8)},${Y(8.1)} L${X(4.2)},${Y(9.8)} L${X(5.8)},${Y(9.8)} L${X(4.2)},${Y(8.1)} L${X(5.8)},${Y(5.6)} L${X(4.2)},${Y(3)} L${X(5.8)},${Y(1)} L${X(10) - 10},${Y(0) + 8} L${X(10) - 8},${Y(10)}" class="d-traj" fill="none" marker-end="url(#AH)"/>`;
    inner += txt(X(0), Y(10) + 20, 'SALIDA', 'd-tiny') + txt(X(10), Y(10) + 20, 'LLEGADA', 'd-tiny') + txt(X(5), Y(10) + 20, '10 m × 5 m · conos centrales cada 3.3 m', 'd-tiny');
    return [panel('Circuito Illinois (vista superior)', wrap(330, 185, inner, 'Illinois'))];
  };
  S.gait = () => {
    let inner = ground(150, 0, 330) + rect(120, 144, 45, 6, 'd-plate', 1) + rect(170, 144, 45, 6, 'd-plate', 1) + txt(167, 168, 'AMTI 1 · AMTI 2', 'd-tiny');
    [[30, 30], [300, 30], [165, 12]].forEach(([x, y]) => inner += rect(x - 10, y - 6, 20, 12, 'd-sensor') + `<path d="M${x},${y + 6} L${x > 165 ? x - 40 : x < 165 ? x + 40 : x},${y + 40}" class="d-beam"/>`);
    inner += fig({ x: 150, ground: 150, tr: 10, hl: 'R', legs: [{ th: 15, sh: -10 }, { th: -40, sh: -95, contact: false }], arms: [{ ua: -40, fa: 50 }, { ua: 40, fa: 90 }] }).svg + `<line x1="20" y1="95" x2="20" y2="148" class="d-eq"/>` + `<line x1="310" y1="95" x2="310" y2="148" class="d-eq"/>` + txt(165, 190, 'Plataformas empotradas · cámaras Qualisys', 'd-tiny');
    return [panel('Montaje de laboratorio', wrap(330, 200, inner, 'Carrera 3D'))];
  };
  S.aero = () => {
    let inner = `<ellipse cx="165" cy="95" rx="140" ry="65" class="d-court"/>` + `<ellipse cx="165" cy="95" rx="110" ry="40" class="d-court"/>`;
    inner += fig({ x: 70, ground: 150, tr: 10, legs: [{ th: 30, sh: -10 }, { th: -30, sh: -80, contact: false }], arms: [{ ua: -30, fa: 60 }, { ua: 30, fa: 90 }], s: 0.6 }).svg;
    inner += `<path d="M238,112 C214,96 214,76 228,74 C234,73 238,78 238,82 C238,78 242,73 248,74 C262,76 262,96 238,112 Z" fill="none" stroke="#f87171" stroke-width="2.5"/><path d="M218,92 h10 l4,-7 l6,13 l4,-6 h14" fill="none" stroke="#f87171" stroke-width="1.8"/>` + txt(238, 128, 'Polar H10', 'd-tiny') + txt(165, 185, 'FC reposo · pico · 1 y 2 min · ambiente', 'd-tiny');
    return [panel('Test de campo con monitor de FC', wrap(330, 195, inner, 'Aeróbico'))];
  };
  S.inbody = () => {
    const f = fig({ x: 165, ground: 170, arms: [{ ua: 25, fa: 30 }, { ua: 25, fa: 30 }] });
    const h = f.pts.arms[0].hd;
    let inner = rect(120, 170, 90, 12, 'd-plate', 3) + rect(158, 60, 14, 110, 'd-eq', 2) + rect(140, 50, 50, 14, 'd-eq', 3) + f.svg + rect(h[0] - 4, h[1] - 10, 8, 20, 'd-sensor') + txt(260, 60, 'Brazos 15–30°', 'd-tiny') + txt(260, 72, 'del tronco', 'd-tiny') + txt(260, 130, 'Talón y antepié', 'd-tiny') + txt(260, 142, 'sobre electrodos', 'd-tiny') + txt(165, 196, 'Descalzo · sin ejercicio previo', 'd-tiny');
    return [panel('Posición de medición', wrap(330, 200, inner, 'InBody'))];
  };
  S.body = (vals) => {
    // esquema corporal frontal para masa segmentaria. vals: {armR, armL, trunk, legR, legL}
    const v = k => vals && num(vals[k]) !== null ? fx(vals[k], 2) + ' kg' : '—';
    let inner = `<circle cx="160" cy="28" r="16" class="d-bodyf"/>` + `<rect x="132" y="48" width="56" height="92" rx="14" class="d-bodyf d-seg-t"/>` + `<rect x="100" y="52" width="22" height="92" rx="10" class="d-bodyf d-seg-R" transform="rotate(8 111 52)"/>` + `<rect x="198" y="52" width="22" height="92" rx="10" class="d-bodyf d-seg-L" transform="rotate(-8 209 52)"/>` + `<rect x="134" y="142" width="24" height="112" rx="10" class="d-bodyf d-seg-R"/>` + `<rect x="162" y="142" width="24" height="112" rx="10" class="d-bodyf d-seg-L"/>`;
    inner += txt(60, 90, 'Brazo D', 'd-tiny') + txt(60, 104, v('armR'), 'd-val') + txt(260, 90, 'Brazo I', 'd-tiny') + txt(260, 104, v('armL'), 'd-val') + txt(160, 92, 'Tronco', 'd-tiny') + txt(160, 106, v('trunk'), 'd-val') + txt(60, 205, 'Pierna D', 'd-tiny') + txt(60, 219, v('legR'), 'd-val') + txt(260, 205, 'Pierna I', 'd-tiny') + txt(260, 219, v('legL'), 'd-val') + txt(160, 272, 'Vista frontal (derecha del deportista a la izquierda)', 'd-tiny');
    return wrap(320, 280, inner, 'Esquema corporal segmentario', 0);
  };
  function panels(key) { const f = S[key]; return f ? f() : []; }
  function thumb(key) { const p = panels(key); return p.length ? p[0].svg : ''; }
  return { panels, thumb, body: S.body, fig, wrap };
})();
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
/* ==========================================================
   MÓDULOS ESPECIALIZADOS: formularios de registro (ModForms)
   ========================================================== */
const INBODY_FIELDS = [
  { k: 'weight', label: 'Peso', unit: 'kg', min: 20, max: 250, key: true, grp: 'Composición' }, { k: 'heightCm', label: 'Talla', unit: 'cm', min: 100, max: 230, grp: 'Composición' }, { k: 'bmi', label: 'IMC', unit: 'kg/m²', min: 10, max: 60, grp: 'Composición' }, { k: 'pbf', label: '% grasa corporal', unit: '%', min: 2, max: 70, key: true, grp: 'Composición' },
  { k: 'bfm', label: 'Masa grasa corporal', unit: 'kg', min: 0, max: 150, grp: 'Composición' }, { k: 'smm', label: 'Masa musculoesquelética (MME)', unit: 'kg', min: 5, max: 80, key: true, grp: 'Composición' }, { k: 'tbw', label: 'Agua corporal total', unit: 'L', min: 10, max: 90, grp: 'Composición' }, { k: 'slm', label: 'Masa magra blanda', unit: 'kg', min: 10, max: 120, grp: 'Composición' },
  { k: 'ffm', label: 'Masa libre de grasa', unit: 'kg', min: 10, max: 130, grp: 'Composición' }, { k: 'protein', label: 'Proteínas', unit: 'kg', min: 1, max: 30, grp: 'Composición' }, { k: 'minerals', label: 'Minerales', unit: 'kg', min: 0.5, max: 10, grp: 'Composición' }, { k: 'bmc', label: 'Contenido mineral óseo', unit: 'kg', min: 0.5, max: 8, grp: 'Investigación' },
  { k: 'bmr', label: 'Tasa metabólica basal', unit: 'kcal', min: 600, max: 4000, grp: 'Investigación' }, { k: 'vfl', label: 'Nivel de grasa visceral', unit: 'nivel', min: 0, max: 30, grp: 'Investigación' }, { k: 'obesityDeg', label: 'Grado de obesidad', unit: '%', min: 40, max: 250, grp: 'Investigación' }, { k: 'ffmi', label: 'Índice de masa libre de grasa', unit: 'kg/m²', min: 5, max: 40, grp: 'Investigación' },
  { k: 'fmi', label: 'Índice de masa grasa', unit: 'kg/m²', min: 0, max: 40, grp: 'Investigación' }, { k: 'smi', label: 'IMME', unit: 'kg/m²', min: 3, max: 20, grp: 'Investigación' }, { k: 'smmWt', label: 'MME/Peso', unit: '%', min: 10, max: 70, grp: 'Investigación' }, { k: 'score', label: 'Puntuación InBody', unit: 'pts', min: 0, max: 130, grp: 'Investigación' },
  { k: 'leanArmR', label: 'Masa magra brazo D', unit: 'kg', min: 0.5, max: 10, side: 'R', grp: 'Magro segmentario' }, { k: 'leanArmL', label: 'Masa magra brazo I', unit: 'kg', min: 0.5, max: 10, side: 'L', grp: 'Magro segmentario' }, { k: 'leanTrunk', label: 'Masa magra tronco', unit: 'kg', min: 5, max: 60, grp: 'Magro segmentario' }, { k: 'leanLegR', label: 'Masa magra pierna D', unit: 'kg', min: 2, max: 25, side: 'R', grp: 'Magro segmentario' }, { k: 'leanLegL', label: 'Masa magra pierna I', unit: 'kg', min: 2, max: 25, side: 'L', grp: 'Magro segmentario' },
  { k: 'leanArmRPct', label: 'Magro brazo D (% evaluación)', unit: '%', min: 20, max: 250, side: 'R', grp: 'Magro segmentario' }, { k: 'leanArmLPct', label: 'Magro brazo I (% evaluación)', unit: '%', min: 20, max: 250, side: 'L', grp: 'Magro segmentario' }, { k: 'leanTrunkPct', label: 'Magro tronco (% evaluación)', unit: '%', min: 20, max: 250, grp: 'Magro segmentario' }, { k: 'leanLegRPct', label: 'Magro pierna D (% evaluación)', unit: '%', min: 20, max: 250, side: 'R', grp: 'Magro segmentario' }, { k: 'leanLegLPct', label: 'Magro pierna I (% evaluación)', unit: '%', min: 20, max: 250, side: 'L', grp: 'Magro segmentario' },
  { k: 'fatArmR', label: 'Grasa brazo D', unit: 'kg', min: 0, max: 20, side: 'R', grp: 'Grasa segmentaria (estimada)' }, { k: 'fatArmL', label: 'Grasa brazo I', unit: 'kg', min: 0, max: 20, side: 'L', grp: 'Grasa segmentaria (estimada)' }, { k: 'fatTrunk', label: 'Grasa tronco', unit: 'kg', min: 0, max: 80, grp: 'Grasa segmentaria (estimada)' }, { k: 'fatLegR', label: 'Grasa pierna D', unit: 'kg', min: 0, max: 30, side: 'R', grp: 'Grasa segmentaria (estimada)' }, { k: 'fatLegL', label: 'Grasa pierna I', unit: 'kg', min: 0, max: 30, side: 'L', grp: 'Grasa segmentaria (estimada)' },
  { k: 'circNeck', label: 'Cuello', unit: 'cm', min: 20, max: 70, grp: 'Circunferencias (estimadas por el equipo)' }, { k: 'circChest', label: 'Pecho', unit: 'cm', min: 50, max: 180, grp: 'Circunferencias (estimadas por el equipo)' }, { k: 'circAbd', label: 'Abdomen', unit: 'cm', min: 40, max: 200, grp: 'Circunferencias (estimadas por el equipo)' }, { k: 'circHip', label: 'Cadera', unit: 'cm', min: 50, max: 200, grp: 'Circunferencias (estimadas por el equipo)' },
  { k: 'circArmR', label: 'Brazo D', unit: 'cm', min: 15, max: 70, side: 'R', grp: 'Circunferencias (estimadas por el equipo)' }, { k: 'circArmL', label: 'Brazo I', unit: 'cm', min: 15, max: 70, side: 'L', grp: 'Circunferencias (estimadas por el equipo)' }, { k: 'circThighR', label: 'Muslo D', unit: 'cm', min: 30, max: 100, side: 'R', grp: 'Circunferencias (estimadas por el equipo)' }, { k: 'circThighL', label: 'Muslo I', unit: 'cm', min: 30, max: 100, side: 'L', grp: 'Circunferencias (estimadas por el equipo)' },
  { k: 'targetWeight', label: 'Peso objetivo (equipo)', unit: 'kg', min: 20, max: 250, grp: 'Control (equipo)' }, { k: 'weightControl', label: 'Control de peso', unit: 'kg', min: -100, max: 100, grp: 'Control (equipo)' }, { k: 'fatControl', label: 'Control de grasa', unit: 'kg', min: -100, max: 100, grp: 'Control (equipo)' }, { k: 'muscleControl', label: 'Control muscular', unit: 'kg', min: -50, max: 50, grp: 'Control (equipo)' }
];
['5', '50', '250'].forEach(f => ['RA', 'LA', 'TR', 'RL', 'LL'].forEach(s => INBODY_FIELDS.push({ k: `z${f}${s}`, label: `Z ${f} kHz ${{ RA: 'brazo D', LA: 'brazo I', TR: 'tronco', RL: 'pierna D', LL: 'pierna I' }[s]}`, unit: 'Ω', min: 0, max: 1500, grp: 'Impedancia (Ω)' })));
const AERO_FIELDS = [{ k: 'hrRest', label: 'FC reposo', unit: 'lpm', min: 25, max: 120 }, { k: 'hrPeak', label: 'FC pico', unit: 'lpm', min: 80, max: 230 }, { k: 'hr1', label: 'FC recuperación 1 min', unit: 'lpm', min: 40, max: 230 }, { k: 'hr2', label: 'FC recuperación 2 min', unit: 'lpm', min: 40, max: 230 }, { k: 'duration', label: 'Duración', unit: 'min', min: 0, max: 120 }, { k: 'distance', label: 'Distancia', unit: 'm', min: 0, max: 20000 }, { k: 'finalSpeed', label: 'Velocidad final', unit: 'km/h', min: 0, max: 30 }];

/* ---------- mapeo de encabezados CSV de InBody ---------- */
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%]+/g, ' ').trim();
function guessInbodyField(h) {
  const n = norm(h); const has = (...w) => w.some(x => n.includes(x));
  const seg = has('right arm', 'brazo derecho', ' ra ') ? 'ArmR' : has('left arm', 'brazo izquierdo') ? 'ArmL' : has('right leg', 'pierna derecha') ? 'LegR' : has('left leg', 'pierna izquierda') ? 'LegL' : has('trunk', 'tronco') ? 'Trunk' : null;
  if (/impedance|impedancia|^z\b/.test(n) || /\bkhz\b/.test(n)) return null;
  if (seg) { if (has('fat', 'grasa')) return 'fat' + seg; if (has('lean', 'ffm', 'magra', 'libre de grasa')) return (n.includes('%') || has('percent', 'evaluacion')) ? 'lean' + seg + 'Pct' : 'lean' + seg; if (has('circumference', 'circunferencia')) return seg === 'ArmR' ? 'circArmR' : seg === 'ArmL' ? 'circArmL' : seg === 'LegR' ? 'circThighR' : seg === 'LegL' ? 'circThighL' : null; return null; }
  const map = [['weight', ['weight', 'peso']], ['heightCm', ['height', 'altura', 'talla']], ['bmi', ['bmi', 'imc', 'body mass index']], ['pbf', ['percent body fat', 'pbf', 'porcentaje de grasa', '% grasa']], ['bfm', ['body fat mass', 'masa grasa', 'bfm']], ['smm', ['skeletal muscle mass', 'masa musculoesquel', 'smm']], ['tbw', ['total body water', 'agua corporal', 'tbw']], ['slm', ['soft lean', 'masa magra blanda', 'slm']], ['ffm', ['fat free mass', 'masa libre de grasa', 'ffm']], ['protein', ['protein', 'proteina']], ['bmc', ['bone mineral', 'mineral oseo', 'bmc']], ['minerals', ['mineral']], ['bmr', ['basal metabolic', 'metabolica basal', 'bmr']], ['vfl', ['visceral fat level', 'grasa visceral', 'vfl']], ['obesityDeg', ['obesity degree', 'grado de obesidad']], ['ffmi', ['ffmi', 'fat free mass index', 'indice de masa libre']], ['fmi', ['fmi', 'fat mass index', 'indice de masa grasa']], ['smi', ['smi', 'imme', 'skeletal muscle index']], ['score', ['inbody score', 'puntuacion']], ['targetWeight', ['target weight', 'peso objetivo']], ['weightControl', ['weight control', 'control de peso']], ['fatControl', ['fat control', 'control de grasa']], ['muscleControl', ['muscle control', 'control muscular']], ['circNeck', ['neck', 'cuello']], ['circChest', ['chest', 'pecho']], ['circAbd', ['abdomen', 'abdominal circ']], ['circHip', ['hip circ', 'cadera']]];
  for (const [k, ws] of map) if (ws.some(w => n.includes(w))) return k;
  return null;
}

const ModForms = {
  inbody(body, ts, test, onChange) {
    const d = ts.moduleData || {}; const grps = [...new Set(INBODY_FIELDS.map(f => f.grp))];
    const docs = DB.where('documents', x => x.testSessionId === ts.id);
    body.innerHTML = `<h2>Registro InBody 370S</h2>
    <div class="note neutral small">Tres vías: <b>A)</b> ingreso manual; <b>B)</b> importación de CSV exportado (LookinBody u otro) con verificación de columnas; <b>C)</b> adjuntar PDF/imagen del informe como documento. La lectura automática de PDF/imagen <b>no está implementada</b> (requiere OCR y el formato varía); el adjunto queda como respaldo documental.</div>
    <div class="note warn small"><b>Atención a la lateralidad:</b> en la hoja impresa del InBody 370S el segmento de la <b>izquierda</b> del esquema está rotulado «Izquierdo» y el de la derecha «Derecho». Transcriba según el rótulo impreso, no según la posición.</div>
    <div class="row" style="margin:10px 0"><label class="btn sec" style="margin:0">B) Importar CSV<input type="file" id="ibCsv" accept=".csv,.txt,.tsv" hidden></label><label class="btn sec" style="margin:0">C) Adjuntar PDF / imagen<input type="file" id="ibDoc" accept="application/pdf,image/*" hidden></label></div>
    ${docs.length ? `<div class="list">${docs.map(x => `<div class="item"><div><b>${esc(x.name)}</b><div class="meta">${x.type} · ${(x.size / 1024).toFixed(0)} KB · ${new Date(x.createdAt).toLocaleString('es-PE')}</div></div><div class="row"><button class="btn sm sec" onclick="Docs.view('${x.id}')">Ver</button><button class="btn sm ghost" onclick="Docs.del('${x.id}')">${ICON.trash}</button></div></div>`).join('')}</div>` : ''}
    <h3 style="margin-top:14px">A) Ingreso manual</h3>
    <div class="grid"><div class="c3"><label>Fecha/hora de la medición</label><input type="datetime-local" id="ib_dt" value="${esc(d.dt || '')}"></div><div class="c3"><label>ID en el equipo</label><input id="ib_devId" value="${esc(d.devId || '')}"></div><div class="c6"><label>Condiciones (ayuno, hidratación, hora, ejercicio previo)</label><input id="ib_cond" value="${esc(d.cond || '')}"></div></div>
    ${grps.map(g => `<details ${['Composición', 'Magro segmentario'].includes(g) ? 'open' : ''} style="margin-top:10px"><summary><b>${g}</b></summary><div class="grid">${INBODY_FIELDS.filter(f => f.grp === g).map(f => fieldHTML(Object.assign({}, f, { type: 'number', span: g.startsWith('Impedancia') ? 2 : 3 }), d[f.k], 'ib')).join('')}</div></details>`).join('')}
    <div id="ibPrev" style="margin-top:14px"></div>`;
    const flds = INBODY_FIELDS.map(f => Object.assign({}, f, { type: 'number' }));
    const preview = () => { const r = readFields(body, flds, 'ib'); const v = r.values; const rows = [['Brazo', v.leanArmR, v.leanArmL], ['Pierna', v.leanLegR, v.leanLegL]]; $('#ibPrev', body).innerHTML = `<div class="grid"><div class="c5">${DG.body({ armR: v.leanArmR, armL: v.leanArmL, trunk: v.leanTrunk, legR: v.leanLegR, legL: v.leanLegL })}</div><div class="c7"><h3>Masa magra segmentaria D/I</h3><table><thead><tr><th>Segmento</th><th class="num">D</th><th class="num">I</th><th class="num">D − I</th><th class="num">Dif. %</th><th class="num">D/I</th></tr></thead><tbody>${rows.map(([l, R, L]) => `<tr><td>${l}</td><td class="num">${fx(R, 2)}</td><td class="num">${fx(L, 2)}</td><td class="num">${fx(Calc.changeAbs(L, R), 2)}</td><td class="num">${fx(Calc.asymmetry(R, L), 1)}</td><td class="num">${fx(Calc.ratioRL(R, L), 3)}</td></tr>`).join('')}</tbody></table><p class="small muted">Diferencia segmentaria descriptiva: no se interpreta como patológica de forma automática.</p></div></div>`; };
    body.addEventListener('input', debounce(preview, 300)); preview();
    body._save = () => { const r = readFields(body, flds, 'ib'); if (!r.ok) { toast(r.errs.join(' · '), 'bad'); return false; } if (r.values.weight === null) { toast('El peso es obligatorio', 'bad'); $('#ib_weight', body).classList.add('invalid'); return false; } ts.moduleData = Object.assign(r.values, { dt: $('#ib_dt', body).value, devId: $('#ib_devId', body).value, cond: $('#ib_cond', body).value, source: ts.moduleData?.source || 'manual' }); DB.put('testSessions', ts); return true; };
    $('#ibCsv', body).onchange = async ev => {
      const f = ev.target.files[0]; if (!f) return; const txt = await readFile(f); const p = Signal.parseCSV(txt);
      if (!p.headers.length || !p.rows.length) { toast('No se pudo leer el CSV', 'bad'); return; }
      const guesses = p.headers.map(guessInbodyField);
      modal({
        title: 'Verificar columnas del CSV', wide: true, body: `<p class="small">Archivo: <b>${esc(f.name)}</b> · ${p.rows.length} fila(s). Verifique cada asignación antes de importar.</p>${p.rows.length > 1 ? `<label>Fila a importar</label><select id="csvRow">${p.rows.map((r, i) => `<option value="${i}" ${i === p.rows.length - 1 ? 'selected' : ''}>Fila ${i + 1}: ${esc(r.slice(0, 3).join(' · '))}</option>`).join('')}</select>` : ''}
        <div class="tablewrap" style="max-height:50vh;overflow:auto"><table><thead><tr><th>Columna del archivo</th><th>Valor</th><th>Campo LCM</th></tr></thead><tbody>${p.headers.map((h, i) => `<tr><td>${esc(h)}</td><td class="mono small">${esc(p.rows[p.rows.length - 1][i] ?? '')}</td><td><select data-map="${i}"><option value="">— ignorar —</option>${INBODY_FIELDS.map(x => `<option value="${x.k}" ${guesses[i] === x.k ? 'selected' : ''}>${esc(x.label)} (${x.unit})</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>`,
        actions: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Importar valores asignados', cls: 'ok', onClick: bg => { const ri = $('#csvRow', bg) ? +$('#csvRow', bg).value : p.rows.length - 1; let n = 0; $$('[data-map]', bg).forEach(s => { if (!s.value) return; const v = num(String(p.rows[ri][+s.dataset.map] || '').replace(',', '.')); if (v === null) return; const inp = $('#ib_' + s.value, body); if (inp) { inp.value = v; n++; } }); ts.moduleData = Object.assign(ts.moduleData || {}, { source: 'csv:' + f.name }); DB.put('testSessions', ts); DB.put('imports', { athleteId: ts.athleteId, evaluationId: ts.evaluationId, testSessionId: ts.id, kind: 'inbody-csv', fileName: f.name, fields: n }); preview(); toast(`${n} valores importados. Revise y guarde.`); } }]
      });
    };
    $('#ibDoc', body).onchange = async ev => { const f = ev.target.files[0]; if (!f) return; if (f.size > 15 * 1024 * 1024) { toast('Archivo > 15 MB', 'bad'); return; } const du = await readFile(f, 'dataurl'); DB.put('documents', { athleteId: ts.athleteId, evaluationId: ts.evaluationId, testSessionId: ts.id, name: f.name, type: f.type, size: f.size, dataUrl: du, note: 'Informe InBody adjunto (sin lectura automática)' }); toast('Documento adjuntado'); body._save(); Runner.render($('#main'), ts); };
  },
  fatigue(body, ts, test, onChange) {
    const d = ts.moduleData || {}; const units = test.id === 'slcr' ? [['cm', 'Altura (cm)'], ['m/s', 'Velocidad media (m/s)'], ['rep', 'Solo repeticiones']] : [['N', 'Fuerza pico (N)'], ['kg', 'Fuerza (kg)'], ['N·m', 'Torque (N·m)']];
    body.innerHTML = `<h2>Registro de la serie de fatiga</h2><div class="cue" style="font-size:15px">${esc(test.cue)}</div>
    <div class="grid" style="margin-top:10px"><div class="c4"><label>Variable registrada por repetición</label><select id="fgUnit">${units.map(([v, l]) => `<option value="${v}" ${d.unit === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div class="c8"><div class="help" style="margin-top:28px">Ingrese un valor por repetición/contracción en orden, separados por coma, espacio o salto de línea. Puede pegar una columna desde Excel.</div></div></div>
    <div class="sidepanel" style="margin-top:10px">${['R', 'L'].map(s => `<div class="sidebox ${s}"><h3>${sideName(s)}</h3><label>Valores por repetición</label><textarea id="fg_series${s}" placeholder="p. ej., 612, 598, 590, …">${esc(d['series' + s] || '')}</textarea><div class="grid"><div class="c6"><label>Repeticiones (si difiere)</label><input type="number" id="fg_reps${s}" value="${d['reps' + s] ?? ''}" min="0" max="500"></div><div class="c6"><label>Duración</label><div class="fieldunit"><input type="number" id="fg_time${s}" value="${d['time' + s] ?? ''}" min="0" max="3600"><span>s</span></div></div></div><label>Criterio de finalización / observaciones</label><input id="fg_end${s}" value="${esc(d['end' + s] || '')}"></div>`).join('')}</div><div id="fgPrev" style="margin-top:12px"></div>`;
    const collect = () => { const o = { unit: $('#fgUnit', body).value }; ['R', 'L'].forEach(s => { o['series' + s] = $('#fg_series' + s, body).value; o['reps' + s] = num($('#fg_reps' + s, body).value); o['time' + s] = num($('#fg_time' + s, body).value); o['end' + s] = $('#fg_end' + s, body).value; }); return o; };
    const prev = () => { const o = collect(); const tmp = Object.assign({}, ts, { moduleData: o }); const r = Engine.compute(tmp); const s = r.series || { R: [], L: [] }; $('#fgPrev', body).innerHTML = (s.R.length || s.L.length ? Chart.line({ H: 200, yLabel: o.unit, xLabel: 'Repetición', series: [{ name: 'Derecha', color: Chart.C.R, pts: s.R.map((y, i) => ({ x: i + 1, y, label: String(i + 1) })) }, { name: 'Izquierda', color: Chart.C.L, pts: s.L.map((y, i) => ({ x: i + 1, y, label: String(i + 1) })) }] }) : '') + (r.pairs.length ? `<table><thead><tr><th>Variable</th><th class="num">D</th><th class="num">I</th><th class="num">Dif. %</th></tr></thead><tbody>${r.pairs.map(p => `<tr><td>${esc(p.label)} (${esc(p.unit)})</td><td class="num">${fx(p.R, 1)}</td><td class="num">${fx(p.L, 1)}</td><td class="num">${fx(p.asym, 1)}</td></tr>`).join('')}</tbody></table>` : ''); };
    body.addEventListener('input', debounce(prev, 300)); prev();
    body._save = () => { const o = collect(); if (!o.seriesR && !o.seriesL && o.repsR === null && o.repsL === null) { toast('Ingrese al menos una serie o número de repeticiones', 'bad'); return false; } ts.moduleData = o; DB.put('testSessions', ts); return true; };
  },
  repeated(body, ts, test) {
    const d = ts.moduleData || {};
    body.innerHTML = `<h2>Registro de saltos repetidos</h2><div class="cue" style="font-size:15px">${esc(test.cue)}</div>
    <div class="grid" style="margin-top:10px"><div class="c3"><label>Duración total (Tt)</label><div class="fieldunit"><input type="number" id="rj_dur" value="${d.dur ?? (ts.config?.dur || 15)}" min="5" max="120"><span>s</span></div></div><div class="c9"><div class="help" style="margin-top:28px">Opción 1 (recomendada): pegue los tiempos de vuelo y de contacto por salto exportados por la plataforma. Opción 2: ingrese solo número de saltos y tiempo total de vuelo.</div></div>
    <div class="c6"><label>Tiempos de vuelo por salto (s)</label><textarea id="rj_fl" placeholder="0.512, 0.505, …">${esc(d.flights || '')}</textarea></div><div class="c6"><label>Tiempos de contacto por salto (s)</label><textarea id="rj_ct" placeholder="0.221, 0.230, …">${esc(d.contacts || '')}</textarea></div>
    <div class="c3"><label>N.º de saltos (opción 2)</label><input type="number" id="rj_n" value="${d.n ?? ''}" min="1" max="200"></div><div class="c3"><label>Tiempo total de vuelo (opción 2)</label><div class="fieldunit"><input type="number" id="rj_tf" value="${d.totalFlight ?? ''}" min="0" max="120" step="any"><span>s</span></div></div></div><div id="rjPrev" style="margin-top:12px"></div>`;
    const collect = () => ({ dur: num($('#rj_dur', body).value), flights: $('#rj_fl', body).value, contacts: $('#rj_ct', body).value, n: num($('#rj_n', body).value), totalFlight: num($('#rj_tf', body).value) });
    const prev = () => { const tmp = Object.assign({}, ts, { moduleData: collect() }); const r = Engine.compute(tmp); $('#rjPrev', body).innerHTML = r.metrics.length ? `<div class="row">${r.metrics.map(m => `<span class="pill acc">${esc(m.label)}: ${fx(m.value, 2)} ${esc(m.unit)}</span>`).join('')}</div>` + (r.series?.h?.length ? Chart.line({ H: 180, yLabel: 'cm', xLabel: 'Salto', series: [{ name: 'Altura', color: Chart.C.B, pts: r.series.h.map((y, i) => ({ x: i + 1, y, label: String(i + 1) })) }] }) : '') : '<div class="small muted">Ingrese datos para calcular.</div>'; };
    body.addEventListener('input', debounce(prev, 300)); prev();
    body._save = () => { const o = collect(); if (!o.flights && !(o.n && o.totalFlight)) { toast('Ingrese tiempos por salto o n + tiempo total de vuelo', 'bad'); return false; } ts.moduleData = o; DB.put('testSessions', ts); return true; };
  },
  encoder(body, ts, test) {
    const d = ts.moduleData || {}; d.blocks = d.blocks || [];
    const draw = () => {
      body.innerHTML = `<h2>Encoder: ejercicios, series y repeticiones</h2><div class="cue" style="font-size:15px">${esc(test.cue)}</div>
      <div class="row" style="margin:10px 0"><select id="enEx" style="width:auto">${['Sentadilla', 'Calf raise unilateral', 'Calf raise bilateral', 'Hip thrust', 'Peso muerto', 'Otro…'].map(x => `<option>${x}</option>`).join('')}</select><select id="enSide" style="width:auto"><option value="B">Bilateral</option><option value="R">Derecha</option><option value="L">Izquierda</option></select><input id="enDev" placeholder="Modelo de encoder" style="width:180px" value="${esc(d.device || '')}"><button class="btn sec" id="enAddB">${ICON.plus} Añadir ejercicio</button></div>
      ${d.blocks.map((b, bi) => `<div class="card flat" style="margin-top:10px"><div class="cardhead"><h3>${esc(b.exercise)} · ${sideName(b.side)}</h3><div class="row"><button class="btn sm sec" data-addset="${bi}">${ICON.plus} Serie/carga</button><button class="btn sm ghost" data-delb="${bi}">${ICON.trash}</button></div></div>
        ${(b.sets || []).map((s, si) => `<div style="border-top:1px solid var(--line);padding-top:8px;margin-top:8px"><div class="row"><b>Serie ${si + 1}</b><div class="fieldunit" style="width:140px"><input type="number" data-load="${bi}.${si}" value="${s.load ?? ''}" placeholder="carga" min="0" max="500"><span>kg</span></div><button class="btn sm sec" data-addrep="${bi}.${si}">+ rep</button><button class="btn sm sec" data-paste="${bi}.${si}">Pegar desde Excel</button><button class="btn sm ghost" data-dels="${bi}.${si}">${ICON.trash}</button></div>
          <div class="tablewrap"><table><thead><tr><th>Rep</th><th>Desplaz. (m)</th><th>V media (m/s)</th><th>V pico (m/s)</th><th>P media (W)</th><th>P pico (W)</th><th></th></tr></thead><tbody>${(s.reps || []).map((r, ri) => `<tr><td>${ri + 1}</td>${['disp', 'mv', 'pv', 'mp', 'pp'].map(k => `<td><input type="number" step="any" data-rep="${bi}.${si}.${ri}.${k}" value="${r[k] ?? ''}" style="padding:5px;min-width:70px"></td>`).join('')}<td><button class="btn sm ghost" data-delr="${bi}.${si}.${ri}">✕</button></td></tr>`).join('')}</tbody></table></div></div>`).join('') || '<div class="small muted">Añada una serie por carga.</div>'}</div>`).join('') || '<div class="empty small">Añada un ejercicio.</div>'}
      <div id="enPrev" style="margin-top:12px"></div>`;
      const P = s => s.split('.').map(Number);
      $('#enAddB', body).onclick = () => { let ex = $('#enEx', body).value; if (ex === 'Otro…') { ex = prompt('Nombre del ejercicio:'); if (!ex) return; } d.blocks.push({ exercise: ex, side: $('#enSide', body).value, sets: [{ load: null, reps: [{}, {}, {}] }] }); d.device = $('#enDev', body).value; draw(); };
      $$('[data-addset]', body).forEach(b => b.onclick = () => { const bl = d.blocks[+b.dataset.addset]; const last = bl.sets[bl.sets.length - 1]; bl.sets.push({ load: last && num(last.load) !== null ? num(last.load) + 10 : null, reps: [{}, {}, {}] }); draw(); });
      $$('[data-delb]', body).forEach(b => b.onclick = () => { if (confirm('¿Eliminar este ejercicio y sus series?')) { d.blocks.splice(+b.dataset.delb, 1); draw(); } });
      $$('[data-addrep]', body).forEach(b => b.onclick = () => { const [bi, si] = P(b.dataset.addrep); d.blocks[bi].sets[si].reps.push({}); draw(); });
      $$('[data-dels]', body).forEach(b => b.onclick = () => { const [bi, si] = P(b.dataset.dels); d.blocks[bi].sets.splice(si, 1); draw(); });
      $$('[data-delr]', body).forEach(b => b.onclick = () => { const [bi, si, ri] = P(b.dataset.delr); d.blocks[bi].sets[si].reps.splice(ri, 1); draw(); });
      $$('[data-load]', body).forEach(i => i.onchange = () => { const [bi, si] = P(i.dataset.load); d.blocks[bi].sets[si].load = num(i.value); prev(); });
      $$('[data-rep]', body).forEach(i => i.onchange = () => { const [bi, si, ri, k] = i.dataset.rep.split('.'); d.blocks[+bi].sets[+si].reps[+ri][k] = num(i.value); prev(); });
      $$('[data-paste]', body).forEach(b => b.onclick = () => { const [bi, si] = P(b.dataset.paste); modal({ title: 'Pegar repeticiones', body: '<p class="small">Pegue filas con columnas en este orden: <b>desplazamiento, V media, V pico, P media, P pico</b> (separadas por tabulación, punto y coma o coma). Una fila por repetición.</p><textarea id="pst" style="min-height:160px"></textarea>', actions: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Importar', cls: 'ok', onClick: bg => { const rows = $('#pst', bg).value.trim().split(/\n/).map(l => l.split(/\t|;|,(?=\s*\d)/).map(x => num(x.trim()))).filter(r => r.some(v => v !== null)); if (!rows.length) { toast('Sin filas válidas', 'warn'); return false; } d.blocks[bi].sets[si].reps = rows.map(r => ({ disp: r[0], mv: r[1], pv: r[2], mp: r[3], pp: r[4] })); draw(); toast(rows.length + ' repeticiones importadas'); } }] }); });
      prev();
    };
    const prev = () => { ts.moduleData = d; const r = Engine.compute(Object.assign({}, ts, { moduleData: d })); $('#enPrev', body).innerHTML = encoderCharts(r, null); };
    body._save = () => { d.device = $('#enDev', body)?.value || d.device; if (!d.blocks.some(b => b.sets.some(s => s.reps.some(r => num(r.mv) !== null)))) { toast('Registre al menos una repetición con velocidad media', 'bad'); return false; } if (d.blocks.some(b => b.sets.some(s => s.reps.some(r => num(r.mv) !== null) && num(s.load) === null))) { toast('Hay series sin carga registrada', 'bad'); return false; } ts.moduleData = d; DB.put('testSessions', ts); return true; };
    draw();
  },
  aero(body, ts, test) {
    const d = ts.moduleData || {};
    body.innerHTML = `<h2>Registro del test aeróbico de campo</h2><div class="grid"><div class="c4"><label>Protocolo</label><select id="ae_protocol">${[['', '—'], ['cooper', 'Test de Cooper (12 min)'], ['yoyoir1', 'Yo-Yo Intermittent Recovery 1'], ['leger20', 'Course Navette 20 m (Léger)'], ['otro', 'Otro (sin ecuación incorporada)']].map(([v, l]) => `<option value="${v}" ${d.protocol === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div class="c4"><label>Nivel / etapa final</label><input id="ae_level" value="${esc(d.level || '')}"></div><div class="c4"><label>Dispositivo</label><input id="ae_dev" value="${esc(d.device || 'Polar H10')}"></div>
    ${AERO_FIELDS.map(f => fieldHTML(Object.assign({}, f, { type: 'number', span: 3 }), d[f.k], 'ae')).join('')}<div class="c6"><label>Observaciones (ambiente, motivo de finalización)</label><input id="ae_obs" value="${esc(d.obs || '')}"></div></div>
    <div class="note warn small" style="margin-top:10px">Si el protocolo permite estimar VO₂max, el valor se rotula siempre como <b>VO₂max ESTIMADO</b>. Nunca se presenta como medido sin análisis de gases.</div><div id="aePrev"></div>`;
    const flds = AERO_FIELDS.map(f => Object.assign({}, f, { type: 'number' }));
    const collect = () => { const r = readFields(body, flds, 'ae'); return { r, o: Object.assign(r.values, { protocol: $('#ae_protocol', body).value, level: $('#ae_level', body).value, device: $('#ae_dev', body).value, obs: $('#ae_obs', body).value }) }; };
    const prev = () => { const { o } = collect(); const r = Engine.compute(Object.assign({}, ts, { moduleData: o })); $('#aePrev', body).innerHTML = `<div class="row" style="margin-top:10px">${r.metrics.filter(m => ['hrr1', 'hrr2', 'vo2', 'pctHRmax'].includes(m.fk)).map(m => `<span class="pill ${m.estimated ? 'warn' : 'acc'}">${esc(m.label)}: ${fx(m.value, 1)} ${esc(m.unit)}</span>`).join('')}</div>${r.notes.map(n => `<div class="note neutral small">${esc(n)}</div>`).join('')}`; };
    body.addEventListener('input', debounce(prev, 300)); body.addEventListener('change', prev); prev();
    body._save = () => { const { r, o } = collect(); if (!r.ok) { toast(r.errs.join(' · '), 'bad'); return false; } if (!o.protocol) { toast('Seleccione el protocolo', 'bad'); return false; } ts.moduleData = o; DB.put('testSessions', ts); return true; };
  }
};

/* Encoder: múltiples ejercicios por evaluación (reemplaza el cálculo base) */
Engine.encoder = function (ts, out, mass) {
  const d = ts.moduleData || {}; const blocks = d.blocks || []; out.encoder = { blocks: [] };
  blocks.forEach(b => {
    const reps = (b.sets || []).flatMap((s, si) => (s.reps || []).map((r, ri) => Object.assign({ set: si + 1, rep: ri + 1, load: num(s.load) }, r)));
    const valid = reps.filter(r => num(r.mv) !== null && r.load !== null);
    const perLoad = {}; valid.forEach(r => { if (!perLoad[r.load] || num(r.mv) > num(perLoad[r.load].mv)) perLoad[r.load] = r; });
    const best = Object.values(perLoad).sort((x, y) => x.load - y.load);
    const lv = Calc.linreg(best.map(r => r.load), best.map(r => num(r.mv)));
    const lpP = best.filter(r => num(r.mp) !== null); const lp = Calc.quadfit(lpP.map(r => r.load), lpP.map(r => num(r.mp)));
    const setLoss = (b.sets || []).map((s, si) => { const mv = (s.reps || []).map(r => num(r.mv)).filter(v => v !== null), pw = (s.reps || []).map(r => num(r.mp)).filter(v => v !== null); return { set: si + 1, load: num(s.load), n: mv.length, vloss: mv.length >= 2 ? (Math.max(...mv) - mv[mv.length - 1]) / Math.max(...mv) * 100 : null, ploss: pw.length >= 2 ? (Math.max(...pw) - pw[pw.length - 1]) / Math.max(...pw) * 100 : null }; });
    const slug = norm(b.exercise).replace(/\s+/g, '_');
    out.encoder.blocks.push({ exercise: b.exercise, side: b.side, slug, reps: valid, best, lv, lp, setLoss });
    const add = (k, l, u, v, eq, primary) => { if (v !== null && v !== undefined && Number.isFinite(v)) out.metrics.push({ key: `encoder.${slug}.${k}${b.side !== 'B' ? '.' + b.side : ''}`, base: `encoder.${slug}.${k}`, fk: k, label: `${b.exercise} · ${l}`, unit: u, side: b.side, value: v, eq, primary }); };
    if (lv) { add('slope', 'Pendiente carga–velocidad', 'm·s⁻¹·kg⁻¹', lv.slope, `VM = ${fx(lv.intercept, 3)} + (${fx(lv.slope, 4)})·carga; R² ${fx(lv.r2, 3)}`); add('v0', 'Intercepto de velocidad', 'm/s', lv.intercept, 'Extrapolación a carga 0'); if (lv.slope < 0) add('L0', 'Carga extrapolada a V = 0', 'kg', -lv.intercept / lv.slope, 'L0 = −a/b (extrapolación; cautela)'); }
    const pp = Math.max(...valid.map(r => num(r.pp) ?? -Infinity)); if (Number.isFinite(pp)) { add('ppmax', 'Potencia pico máxima', 'W', pp, '', true); if (mass) add('ppmax_kg', 'Potencia pico máxima relativa', 'W/kg', pp / mass, 'P / masa'); }
    const mp = Math.max(...valid.map(r => num(r.mp) ?? -Infinity)); if (Number.isFinite(mp)) add('mpmax', 'Potencia media máxima', 'W', mp);
    const mvB = Math.max(...valid.map(r => num(r.mv))); if (Number.isFinite(mvB)) add('mvmax', 'Velocidad media máxima', 'm/s', mvB);
    if (lp && lp.c < 0) add('lopt', 'Carga de potencia media máxima (ajuste cuadrático)', 'kg', -lp.b / (2 * lp.c), 'Vértice de P = a + b·x + c·x²');
    const vl = setLoss.map(s => s.vloss).filter(v => v !== null); if (vl.length) add('vloss', 'Pérdida de velocidad máx. en una serie', '%', Math.max(...vl), '(VM mejor − VM última) / VM mejor × 100');
    const pl = setLoss.map(s => s.ploss).filter(v => v !== null); if (pl.length) add('ploss', 'Pérdida de potencia máx. en una serie', '%', Math.max(...pl), '(PM mejor − PM última) / PM mejor × 100');
  });
  // pares D/I por ejercicio
  const byEx = {}; out.encoder.blocks.forEach(b => { (byEx[b.slug] = byEx[b.slug] || {})[b.side] = b; });
  Object.values(byEx).forEach(g => { if (g.R && g.L) { const m = (s, k) => out.metrics.find(x => x.side === s && x.base === `encoder.${g.R.slug}.${k}`)?.value; out.pairs.push(...[['ppmax', 'Potencia pico máx.', 'W', true], ['mvmax', 'Velocidad media máx.', 'm/s', true], ['vloss', 'Pérdida de velocidad', '%', false]].filter(([k]) => m('R', k) !== undefined && m('L', k) !== undefined).map(([k, l, u, hib]) => { const R = m('R', k), L = m('L', k); return { fk: k, label: `${g.R.exercise} · ${l}`, unit: u, R, L, hib, asym: Calc.asymmetry(R, L), ratio: Calc.ratioRL(R, L), lsi: Calc.lsi(R, L, null, hib), better: Calc.betterSide(R, L, hib), cvMean: null, exceedsCV: null, diff: R - L, key: k === 'ppmax', base: `encoder.${g.R.slug}.${k}` }; })); } });
};
function encoderCharts(r, prevR) {
  const bl = r?.encoder?.blocks || []; if (!bl.length) return '<div class="small muted">Sin repeticiones con velocidad.</div>';
  const cols = [Chart.C.B, Chart.C.R, Chart.C.L, Chart.C.A, Chart.C.G];
  const prevBl = prevR?.encoder?.blocks || [];
  return bl.map((b, i) => {
    const pb = prevBl.find(x => x.slug === b.slug && x.side === b.side);
    const col = b.side === 'R' ? Chart.C.R : b.side === 'L' ? Chart.C.L : cols[i % 5];
    const xs = b.best.map(r => r.load).concat(pb ? pb.best.map(r => r.load) : []); const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const fitsLV = [b.lv ? { x0, x1, fn: x => b.lv.intercept + b.lv.slope * x, color: col } : null, pb?.lv ? { x0, x1, fn: x => pb.lv.intercept + pb.lv.slope * x, color: Chart.C.N, dash: true } : null].filter(Boolean);
    const fitsLP = [b.lp ? { x0, x1, fn: x => b.lp.a + b.lp.b * x + b.lp.c * x * x, color: col } : null, pb?.lp ? { x0, x1, fn: x => pb.lp.a + pb.lp.b * x + pb.lp.c * x * x, color: Chart.C.N, dash: true } : null].filter(Boolean);
    return `<div class="card flat" style="margin-top:10px"><h3>${esc(b.exercise)} · ${sideName(b.side)}</h3><div class="grid"><div class="c6"><h4>Carga–velocidad</h4>${Chart.scatter({ H: 220, xLabel: 'Carga (kg)', yLabel: 'V media (m/s)', series: [{ name: 'Todas las repeticiones', color: col, hollow: true, r: 3, pts: b.reps.map(r => ({ x: r.load, y: num(r.mv) })) }, { name: 'Mejor por carga (actual)', color: col, pts: b.best.map(r => ({ x: r.load, y: num(r.mv) })) }, ...(pb ? [{ name: 'Evaluación previa', color: Chart.C.N, pts: pb.best.map(r => ({ x: r.load, y: num(r.mv) })) }] : [])], fits: fitsLV })}${b.lv ? `<div class="small mono">VM = ${fx(b.lv.intercept, 3)} ${b.lv.slope < 0 ? '−' : '+'} ${fx(Math.abs(b.lv.slope), 4)}·carga · R² = ${fx(b.lv.r2, 3)} · n cargas = ${b.lv.n}</div>` : '<div class="small muted">Se requieren ≥ 2 cargas para la recta.</div>'}</div>
    <div class="c6"><h4>Carga–potencia</h4>${Chart.scatter({ H: 220, xLabel: 'Carga (kg)', yLabel: 'P media (W)', series: [{ name: 'Mejor por carga', color: col, pts: b.best.filter(r => num(r.mp) !== null).map(r => ({ x: r.load, y: num(r.mp) })) }, ...(pb ? [{ name: 'Evaluación previa', color: Chart.C.N, pts: pb.best.filter(r => num(r.mp) !== null).map(r => ({ x: r.load, y: num(r.mp) })) }] : [])], fits: fitsLP })}${b.lp ? '' : '<div class="small muted">Se requieren ≥ 3 cargas con potencia para el ajuste.</div>'}</div></div>
    <table><thead><tr><th>Serie</th><th class="num">Carga</th><th class="num">Reps</th><th class="num">Pérdida de velocidad %</th><th class="num">Pérdida de potencia %</th></tr></thead><tbody>${b.setLoss.map(s => `<tr><td>${s.set}</td><td class="num">${fx(s.load, 1)} kg</td><td class="num">${s.n}</td><td class="num">${fx(s.vloss, 1)}</td><td class="num">${fx(s.ploss, 1)}</td></tr>`).join('')}</tbody></table></div>`;
  }).join('');
}
const Docs = {
  view(id) { const d = DB.get('documents', id); if (!d) return; if (d.type.startsWith('image/')) modal({ title: esc(d.name), wide: true, body: `<img src="${d.dataUrl}" style="max-width:100%;border-radius:8px" alt="${esc(d.name)}">` }); else { const b = atob(d.dataUrl.split(',')[1]); const arr = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) arr[i] = b.charCodeAt(i); const blob = new Blob([arr], { type: d.type }); let w = null; try { const url = URL.createObjectURL(blob); w = window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000); } catch (e) { } if (!w) download(d.name, blob); } },
  async del(id) { if (await confirmBox('Eliminar documento', '¿Eliminar el documento adjunto?', 'Eliminar', true)) { DB.del('documents', id); toast('Documento eliminado', 'warn'); App.refresh(); } }
};
/* garantiza que una prueba exista en la batería/sesión y devuelve su TestSession */
function ensureTest(testId) {
  const e = Ctx.evaluation(); if (!e) { toast('Seleccione una evaluación', 'warn'); return null; }
  if (!(e.battery || []).includes(testId)) { e.battery = [...(e.battery || []), testId]; DB.put('evaluations', e); }
  let ss = Ctx.sessions(e.id); if (!ss.length) { DB.put('sessions', { athleteId: e.athleteId, evaluationId: e.id, n: 1, testIds: [], date: e.date }); ss = Ctx.sessions(e.id); }
  if (!ss.some(s => (s.testIds || []).includes(testId))) { const s = ss.find(x => x.n === Math.min(T(testId).session, ss.length)) || ss[0]; s.testIds.push(testId); DB.put('sessions', s); }
  Sched.syncTS(); return Ctx.ts(e.id, testId);
}
function openTest(testId) { const ts = ensureTest(testId); if (ts) Runner.open(ts.id); }
/* ==========================================================
   VISTAS DE MÓDULOS, INTEGRACIÓN, EVOLUCIÓN
   ========================================================== */
function resFor(evId, testId) { const ts = evId ? Ctx.ts(evId, testId) : null; return ts ? { ts, r: Ctx.result(ts.id) } : { ts: null, r: null }; }
function prevEval(ev) { const evs = DB.where('evaluations', x => x.athleteId === ev.athleteId).sort(byDate); const i = evs.findIndex(x => x.id === ev.id); return i > 0 ? evs[i - 1] : null; }
function metricVal(r, fk, side = 'B') { const m = r?.metrics.find(x => x.fk === fk && x.side === side); return m ? m.value : null; }
function testBtn(testId, label) { const e = Ctx.evaluation(); const ts = e ? Ctx.ts(e.id, testId) : null; return `<button class="btn sm ${ts?.status === 'completed' ? 'sec' : ''}" onclick="openTest('${testId}')">${ts ? (ts.status === 'completed' ? 'Revisar' : 'Registrar') : 'Añadir y registrar'} ${esc(label || T(testId).short)}</button>`; }

Views.m_comp = el => {
  if (!guard(el)) return;
  const e = Ctx.evaluation(); const { r } = resFor(e.id, 'inbody'); const d = Ctx.ts(e.id, 'inbody')?.moduleData || {};
  const evs = DB.where('evaluations', x => x.athleteId === e.athleteId).sort(byDate);
  const hist = evs.map(ev => ({ ev, r: resFor(ev.id, 'inbody').r })).filter(x => x.r);
  el.innerHTML = pageHead('Composición corporal', 'InBody 370S · masa magra segmentaria y comparación D/I', testBtn('inbody', 'InBody')) + (r ? `
  <div class="grid"><div class="card c4"><h3>Esquema corporal (masa magra)</h3>${DG.body({ armR: d.leanArmR, armL: d.leanArmL, trunk: d.leanTrunk, legR: d.leanLegR, legL: d.leanLegL })}</div>
  <div class="card c8"><div class="grid">${['weight', 'bmi', 'pbf', 'bfm', 'smm', 'tbw', 'ffm', 'slm'].map(k => { const f = INBODY_FIELDS.find(x => x.k === k); return `<div class="c3"><div class="kpi"><span class="l">${esc(f.label)}</span><span class="v" style="font-size:21px">${fx(d[k], 1)}</span><span class="s">${esc(f.unit)}</span></div></div>`; }).join('')}</div><hr>
  <h3>Diferencias segmentarias D/I</h3><table><thead><tr><th>Segmento</th><th class="num">D</th><th class="num">I</th><th class="num">D − I</th><th class="num">Dif. %</th><th class="num">D/I</th></tr></thead><tbody>${r.pairs.map(p => `<tr><td>${esc(p.label)} (${esc(p.unit)})</td><td class="num">${fx(p.R, 2)}</td><td class="num">${fx(p.L, 2)}</td><td class="num">${fx(p.diff, 2)}</td><td class="num">${fx(p.asym, 1)}</td><td class="num">${fx(p.ratio, 3)}</td></tr>`).join('')}</tbody></table>
  <div class="note neutral small">${refBadge('device')} Los rangos del informe impreso son referencias del fabricante. ${refBadge('descriptive')} Una diferencia segmentaria no se declara patológica automáticamente.</div></div>
  <div class="card c12"><h3>Evolución temporal</h3>${hist.length > 1 ? `<div class="grid"><div class="c6">${Chart.line({ H: 200, yLabel: 'kg', series: [{ name: 'Peso', color: Chart.C.B, labels: true, pts: hist.map((h, i) => ({ x: i, y: metricVal(h.r, 'weight'), label: fmtDate(h.ev.date) })) }, { name: 'MME', color: Chart.C.G, labels: true, pts: hist.map((h, i) => ({ x: i, y: metricVal(h.r, 'smm'), label: fmtDate(h.ev.date) })) }] })}</div><div class="c6">${Chart.line({ H: 200, yLabel: 'kg', series: [{ name: 'Magra pierna D', color: Chart.C.R, labels: true, pts: hist.map((h, i) => ({ x: i, y: metricVal(h.r, 'leanLegR', 'R'), label: fmtDate(h.ev.date) })) }, { name: 'Magra pierna I', color: Chart.C.L, labels: true, pts: hist.map((h, i) => ({ x: i, y: metricVal(h.r, 'leanLegL', 'L'), label: fmtDate(h.ev.date) })) }] })}</div></div>` : '<div class="empty small">Se requieren al menos dos evaluaciones con InBody.</div>'}</div></div>` : `<div class="empty">Sin registro de composición corporal en esta evaluación.</div>`);
};
Views.m_jumps = el => {
  if (!guard(el)) return;
  const e = Ctx.evaluation(); const g = id => resFor(e.id, id).r; const sj = g('sj'), cmj = g('cmj'), abk = g('abk'), dj = g('dj'), rj = g('rj'), cmju = g('cmju');
  const h = r => metricVal(r, 'h'); const SJ = h(sj), CMJ = h(cmj), ABK = h(abk);
  const ei = SJ && CMJ ? (CMJ - SJ) / SJ * 100 : null, arm = CMJ && ABK ? (ABK - CMJ) / CMJ * 100 : null;
  const pe = prevEval(e); const pg = id => pe ? resFor(pe.id, id).r : null;
  el.innerHTML = pageHead('Saltos · perfil de Bosco', 'SJ · CMJ · Abalakov · Drop Jump · saltos repetidos · CMJ unilateral', ['sj', 'cmj', 'abk', 'dj', 'rj', 'cmju'].map(id => testBtn(id)).join('') + `<button class="btn sm sec" onclick="App.go('m_qtm')">Importar QTM/AMTI</button>`) + `
  <div class="grid"><div class="card c7"><h3>Altura de salto (mejor intento)</h3>${Chart.bars({ yLabel: 'cm', rows: [{ label: 'SJ', v: SJ }, { label: 'CMJ', v: CMJ }, { label: 'Abalakov', v: ABK }, { label: 'DJ', v: h(dj) }, { label: 'CMJ-U D', v: metricVal(cmju, 'h', 'R'), color: Chart.C.R }, { label: 'CMJ-U I', v: metricVal(cmju, 'h', 'L'), color: Chart.C.L }] })}${pe ? `<p class="small muted">Evaluación previa (${fmtDate(pe.date)}): SJ ${fx(h(pg('sj')), 1)} · CMJ ${fx(h(pg('cmj')), 1)} · ABK ${fx(h(pg('abk')), 1)} cm</p>` : ''}</div>
  <div class="card c5"><h3>Índices calculables con los datos disponibles</h3><table><tbody>
  <tr><td>Aprovechamiento del contramovimiento<div class="tiny muted">(CMJ − SJ) / SJ × 100 · descriptivo</div></td><td class="num"><b>${fx(ei, 1)}</b> %</td></tr>
  <tr><td>Contribución de brazos<div class="tiny muted">(ABK − CMJ) / CMJ × 100 · descriptivo</div></td><td class="num"><b>${fx(arm, 1)}</b> %</td></tr>
  <tr><td>RSI Drop Jump<div class="tiny muted">altura (m) / contacto (s)</div></td><td class="num"><b>${fx(metricVal(dj, 'rsi'), 2)}</b> m/s</td></tr>
  <tr><td>Contacto DJ</td><td class="num">${fx(metricVal(dj, 'tc'), 3)} s</td></tr>
  <tr><td>RSI modificado CMJ<div class="tiny muted">altura / tiempo hasta despegue</div></td><td class="num">${fx(metricVal(cmj, 'rsimod'), 2)} m/s</td></tr>
  <tr><td>Potencia media saltos repetidos (Bosco)</td><td class="num"><b>${fx(metricVal(rj, 'power'), 1)}</b> W/kg</td></tr>
  <tr><td>Índice de fatiga (altura) saltos repetidos</td><td class="num">${fx(metricVal(rj, 'fi'), 1)} %</td></tr>
  <tr><td>Potencia pico CMJ</td><td class="num">${fx(metricVal(cmj, 'pp'), 0)} W · ${fx(metricVal(cmj, 'pp_kg'), 1)} W/kg</td></tr>
  <tr><td>Tiempo de vuelo CMJ</td><td class="num">${fx(metricVal(cmj, 'tf'), 3)} s</td></tr>
  </tbody></table><p class="tiny muted">Solo se muestran índices cuando existen las variables necesarias. Los índices describen el perfil; no son diagnósticos ni tienen puntos de corte universales.</p></div>
  ${rj?.series?.h?.length ? `<div class="card c6"><h3>Saltos repetidos: altura por salto</h3>${Chart.line({ H: 200, yLabel: 'cm', xLabel: 'Salto', series: [{ name: 'Altura', color: Chart.C.B, pts: rj.series.h.map((y, i) => ({ x: i + 1, y, label: String(i + 1) })) }] })}</div>` : ''}
  ${cmju?.pairs?.length ? `<div class="card c6"><h3>CMJ unilateral D/I</h3>${Chart.pairs({ rows: cmju.pairs.filter(p => p.R !== null && p.L !== null).map(p => ({ label: p.label, R: p.R, L: p.L })) })}</div>` : ''}
  <div class="card c12"><h3>Evolución de saltos</h3>${evoChart(e.athleteId, [['sj.h', 'SJ', Chart.C.A], ['cmj.h', 'CMJ', Chart.C.B], ['abk.h', 'ABK', Chart.C.G], ['cmju.h.R', 'CMJ-U D', Chart.C.R], ['cmju.h.L', 'CMJ-U I', Chart.C.L]], 'cm')}</div></div>`;
};
function evoChart(aid, keys, unit) {
  const evs = DB.where('evaluations', x => x.athleteId === aid).sort(byDate); if (evs.length < 2) return '<div class="empty small">Se requieren al menos dos evaluaciones.</div>';
  const series = keys.map(([k, name, color]) => ({ name, color, labels: true, pts: evs.map((ev, i) => { const r = DB.where('results', x => x.evaluationId === ev.id).flatMap(x => x.metrics).find(m => m.key === k); return { x: i, y: r ? r.value : null, label: fmtDate(ev.date) }; }) })).filter(s => s.pts.some(p => p.y !== null));
  return series.length ? Chart.line({ series, yLabel: unit, H: 220 }) : '<div class="empty small">Sin métricas repetidas.</div>';
}
Views.m_encoder = el => {
  if (!guard(el)) return;
  const e = Ctx.evaluation(); const { r } = resFor(e.id, 'encoder'); const pe = prevEval(e); const pr = pe ? resFor(pe.id, 'encoder').r : null;
  el.innerHTML = pageHead('Encoder · perfil carga–velocidad', 'Curvas carga–velocidad y carga–potencia, pérdida de velocidad por serie y comparación entre sesiones.', testBtn('encoder', 'Encoder')) + (r ? `${pr ? `<div class="note neutral small">Línea discontinua gris: evaluación previa del ${fmtDate(pe.date)} (mismo ejercicio y lado).</div>` : ''}${encoderCharts(r, pr)}<div class="card" style="margin-top:12px"><h3>Métricas</h3>${resultHTML(T('encoder'), r, null)}</div>` : '<div class="empty">Sin datos de encoder en esta evaluación.</div>');
};
Views.m_strength = el => {
  if (!guard(el)) return;
  const e = Ctx.evaluation(); const iso = ['quadiso', 'hamiso', 'plantiso', 'hipext', 'hipabd', 'grip'];
  const rows = iso.map(id => ({ t: T(id), r: resFor(e.id, id).r })).filter(x => x.r);
  const dsi = Engine.dsi(e.id); const imtp = resFor(e.id, 'imtp').r;
  const ham = resFor(e.id, 'hamiso').r, quad = resFor(e.id, 'quadiso').r;
  const hq = s => { const h = metricVal(ham, 'torque', s) ?? null, q = metricVal(quad, 'torque', s) ?? null; return h && q ? h / q : null; };
  el.innerHTML = pageHead('Fuerza D/I · RFD · DSI', 'Pico de fuerza, fuerza relativa, torque, RFD, impulso, CV y asimetría.', [...iso, 'imtp'].map(id => testBtn(id)).join('')) + `
  <div class="grid"><div class="card c8"><h3>Fuerza pico por grupo muscular</h3>${Chart.pairs({ unit: 'N (Handgrip en kg)', rows: rows.map(x => { const p = x.r.pairs.find(p => p.fk === 'pf' || p.fk === 'f'); return p ? { label: x.t.short, R: p.R, L: p.L } : null; }).filter(Boolean) })}
  <div class="tablewrap"><table><thead><tr><th>Prueba</th><th class="num">D</th><th class="num">I</th><th class="num">D rel.</th><th class="num">I rel.</th><th class="num">Asim. %</th><th class="num">CV medio %</th><th class="num">RFD 0–100 D/I</th></tr></thead><tbody>${rows.map(x => { const p = x.r.pairs.find(p => p.fk === 'pf' || p.fk === 'f') || {}; const pk = x.r.pairs.find(p => p.fk === 'pf_kg') || {}; const rf = x.r.pairs.find(p => p.fk === 'rfd100') || {}; return `<tr><td>${esc(x.t.short)}</td><td class="num">${fx(p.R, 0)}</td><td class="num">${fx(p.L, 0)}</td><td class="num">${fx(pk.R, 2)}</td><td class="num">${fx(pk.L, 2)}</td><td class="num"><b>${fx(p.asym, 1)}</b></td><td class="num">${fx(p.cvMean, 1)}</td><td class="num">${fx(rf.R, 0)} / ${fx(rf.L, 0)}</td></tr>`; }).join('') || '<tr><td colspan="8" class="muted">Sin pruebas de fuerza registradas.</td></tr>'}</tbody></table></div></div>
  <div class="card c4"><h3>DSI — Dynamic Strength Index</h3>${dsi.ok ? `<div class="kpi"><span class="v">${fx(dsi.value, 2)}</span><span class="s">${esc(dsi.eq)}</span></div>${dsi.warn ? `<div class="note warn small">${esc(dsi.warn)}</div>` : ''}` : `<div class="note neutral small">No se calcula: ${esc(dsi.why)}</div>`}<div class="note neutral small">${refBadge('method')} DSI = PF dinámica (CMJ) / PF isométrica (IMTP). ${refBadge('descriptive')} ${NO_CUTOFF}</div>
  <hr><h3>IMTP</h3>${imtp ? `<table><tbody>${imtp.metrics.filter(m => ['pf', 'pf_kg', 'rfd100', 'rfd200', 'imp200'].includes(m.fk)).map(m => `<tr><td>${esc(m.label)}</td><td class="num">${fx(m.value, 1)} ${esc(m.unit)}</td></tr>`).join('')}${imtp.derived.map(d => `<tr><td>${esc(d.label)}</td><td class="num">${fx(d.value, 0)} ${esc(d.unit)}</td></tr>`).join('')}</tbody></table>` : '<div class="small muted">Sin IMTP.</div>'}
  <hr><h3>Relación isquiotibiales/cuádriceps (isométrica)</h3>${hq('R') || hq('L') ? `<p>D: <b>${fx(hq('R'), 2)}</b> · I: <b>${fx(hq('L'), 2)}</b></p><p class="tiny muted">Torque isquios / torque cuádriceps (requiere brazo de palanca en ambas pruebas). Ratio isométrico dependiente del ángulo; ${NO_CUTOFF}</p>` : '<p class="small muted">Requiere torque (brazo de palanca registrado) de isquiotibiales y cuádriceps.</p>'}</div></div>`;
};
Views.m_fatigue = el => {
  if (!guard(el)) return;
  const e = Ctx.evaluation(); const items = ['isofatigue', 'slcr'].map(id => ({ t: T(id), r: resFor(e.id, id).r })).filter(x => x.r);
  const rj = resFor(e.id, 'rj').r; const enc = resFor(e.id, 'encoder').r;
  el.innerHTML = pageHead('Fatiga y resistencia de fuerza', 'Valor inicial, final, promedio, pendiente, decremento, repeticiones y tiempo.', ['isofatigue', 'slcr', 'rj'].map(id => testBtn(id)).join('')) + (items.length || rj ? items.map(x => `<div class="card" style="margin-bottom:12px"><h3>${esc(x.t.name)}</h3><div class="grid"><div class="c6">${Chart.line({ H: 200, yLabel: x.r.series?.unit || '', xLabel: 'Repetición', series: [{ name: 'Derecha', color: Chart.C.R, pts: (x.r.series?.R || []).map((y, i) => ({ x: i + 1, y, label: String(i + 1) })) }, { name: 'Izquierda', color: Chart.C.L, pts: (x.r.series?.L || []).map((y, i) => ({ x: i + 1, y, label: String(i + 1) })) }] })}</div><div class="c6"><table><thead><tr><th>Variable</th><th class="num">D</th><th class="num">I</th></tr></thead><tbody>${[...new Set(x.r.metrics.map(m => m.fk))].map(fk => { const m = x.r.metrics.find(q => q.fk === fk); return `<tr><td>${esc(m.label)} <span class="tiny muted">${esc(m.unit)}</span></td><td class="num">${fx(metricVal(x.r, fk, 'R'), 2)}</td><td class="num">${fx(metricVal(x.r, fk, 'L'), 2)}</td></tr>`; }).join('')}</tbody></table></div></div></div>`).join('') + (rj ? `<div class="card"><h3>Saltos repetidos</h3>${resultHTML(T('rj'), rj, null)}</div>` : '') : '<div class="empty">Sin pruebas de fatiga registradas.</div>') + (enc?.encoder?.blocks?.length ? `<div class="card" style="margin-top:12px"><h3>Pérdida de velocidad/potencia en series de encoder</h3>${enc.encoder.blocks.map(b => `<p class="small"><b>${esc(b.exercise)} ${sideShort(b.side)}</b>: ${b.setLoss.map(s => `serie ${s.set} (${fx(s.load, 0)} kg) VL ${fx(s.vloss, 1)} % · PL ${fx(s.ploss, 1)} %`).join(' · ')}</p>`).join('')}</div>` : '');
};

/* ---------- Biomecánica: importación y análisis CSV ---------- */
Views.m_biomech = el => {
  if (!guard(el)) return;
  const e = Ctx.evaluation(); const imps = DB.where('imports', x => x.evaluationId === e.id && x.kind === 'force-csv');
  const gait = resFor(e.id, 'gait').r;
  el.innerHTML = pageHead('Biomecánica · importación CSV', 'Análisis de señales de plataforma de fuerza exportadas (AMTI/Qualisys). Sin conexión directa a hardware.', testBtn('gait', 'Carrera 3D')) + `
  <div class="note neutral small"><b>Qué hace este módulo:</b> lee un CSV/TXT exportado con columnas numéricas (p. ej., tiempo, Fx, Fy, Fz, Mx, My, Mz, COPx, COPy), permite elegir la columna vertical (Fz) y la frecuencia de muestreo, y calcula con métodos documentados: <b>salto</b> (masa, fuerza pico, potencia pico, velocidad de despegue, altura por impulso y por tiempo de vuelo, impulso neto), <b>IMTP</b> (fuerza pico bruta/neta, RFD 0–50/100/150/200/250 ms, impulso) o <b>contactos de carrera</b> (tiempo de contacto, pico vGRF, pico de impacto, tasa de carga 20–80 %, impulso). <b>Qué no hace:</b> no se conecta a QTM/AMTI en tiempo real ni lee formatos binarios (.qtm, .c3d); exporte a CSV/TSV desde el software del equipo.</div>
  <div class="card"><div class="grid"><div class="c4"><label>Archivo CSV/TXT/TSV</label><input type="file" id="bmFile" accept=".csv,.txt,.tsv"></div><div class="c3"><label>Tipo de análisis</label><select id="bmKind"><option value="jump">Salto (CMJ/SJ)</option><option value="imtp">IMTP</option><option value="run">Contactos de carrera</option></select></div><div class="c2"><label>Frecuencia (Hz)</label><input type="number" id="bmFs" value="1000" min="50" max="20000"></div><div class="c3"><label>Masa (kg) para carrera</label><input type="number" id="bmMass" value="${Ctx.mass(e.id)?.value ?? ''}"></div>
  <div class="c4"><label>Columna Fz (vertical)</label><select id="bmCol" disabled><option>—</option></select></div><div class="c4"><label>Umbral de vuelo / contacto (N)</label><input type="number" id="bmThr" value="20"></div><div class="c4"><label>Unidades de fuerza del archivo</label><select id="bmUnit"><option value="1">N</option><option value="9.81">kgf</option></select></div></div>
  <div class="row" style="margin-top:10px"><button class="btn" id="bmRun" disabled>Analizar</button></div><div id="bmOut" style="margin-top:12px"></div></div>
  <div class="card" style="margin-top:12px"><h3>Análisis guardados (${imps.length})</h3>${imps.length ? `<div class="list">${imps.map(x => `<div class="item"><div><b>${esc(x.fileName)}</b><div class="meta">${{ jump: 'Salto', imtp: 'IMTP', run: 'Carrera' }[x.analysis]} · ${x.fs} Hz · ${new Date(x.createdAt).toLocaleString('es-PE')}</div></div><div class="row"><button class="btn sm sec" onclick="BM.show('${x.id}')">Ver</button><button class="btn sm ghost" onclick="BM.del('${x.id}')">${ICON.trash}</button></div></div>`).join('')}</div>` : '<div class="small muted">Ninguno.</div>'}</div>
  ${gait ? `<div class="card" style="margin-top:12px"><h3>Carrera 3D: resultados registrados</h3>${resultHTML(T('gait'), gait, Ctx.ts(e.id, 'gait'))}</div>` : ''}`;
  let parsed = null, fname = '';
  $('#bmFile').onchange = async ev => { const f = ev.target.files[0]; if (!f) return; fname = f.name; parsed = Signal.parseCSV(await readFile(f)); if (!parsed.headers.length) { toast('Archivo sin columnas legibles', 'bad'); return; } const guess = parsed.headers.findIndex(h => /fz|force.?z|vertical/i.test(h)); $('#bmCol').innerHTML = parsed.headers.map((h, i) => `<option value="${i}" ${i === (guess >= 0 ? guess : parsed.headers.length - 1) ? 'selected' : ''}>${esc(h || 'col ' + (i + 1))}</option>`).join(''); $('#bmCol').disabled = false; $('#bmRun').disabled = false; const t = parsed.headers.findIndex(h => /^time|tiempo|^t$/i.test(h)); if (t >= 0 && parsed.rows.length > 2) { const dt = num(parsed.rows[1][t]) - num(parsed.rows[0][t]); if (dt > 0) $('#bmFs').value = Math.round(1 / dt); } toast(`${parsed.rows.length} muestras · ${parsed.headers.length} columnas`); };
  $('#bmRun').onclick = () => {
    const fs = num($('#bmFs').value), col = +$('#bmCol').value, k = $('#bmKind').value, u = num($('#bmUnit').value); if (!fs) { toast('Indique la frecuencia', 'bad'); return; }
    const fz = parsed.rows.map(r => { const v = num(String(r[col] ?? '').replace(',', '.')); return v === null ? null : v * u; }).filter(v => v !== null);
    let res; if (k === 'jump') res = Signal.analyzeJump(fz, fs, { flightN: num($('#bmThr').value) ?? 20 }); else if (k === 'imtp') res = Signal.analyzeIMTP(fz, fs, {}); else res = { contacts: Signal.analyzeContacts(fz, fs, num($('#bmMass').value), { thrN: num($('#bmThr').value) ?? 50 }) };
    if (res.error) { $('#bmOut').innerHTML = `<div class="note bad">${esc(res.error)}</div>`; return; }
    const step = Math.max(1, Math.floor(fz.length / 3000)); const ds = fz.filter((_, i) => i % step === 0);
    const rec = { athleteId: e.athleteId, evaluationId: e.id, kind: 'force-csv', analysis: k, fileName: fname, fs, column: parsed.headers[col], nSamples: fz.length, result: res, preview: ds, previewFs: fs / step };
    $('#bmOut').innerHTML = BM.render(rec) + `<div class="row" style="margin-top:10px"><button class="btn ok" id="bmSave">Guardar análisis</button></div>`;
    $('#bmSave').onclick = () => { DB.put('imports', rec); toast('Análisis guardado'); App.refresh(); };
  };
};
const BM = {
  render(rec) {
    const r = rec.result, fsd = rec.previewFs, sc = rec.fs / fsd; const mk = i => i === null || i === undefined || i < 0 ? null : Math.round(i / sc);
    let h = '';
    if (rec.analysis === 'jump') { h += Chart.signal({ y: rec.preview, fs: fsd, marks: [{ i: mk(r.onsetIdx), label: 'inicio' }, { i: mk(r.takeoffIdx), label: 'despegue', color: Chart.C.R }, { i: mk(r.landingIdx), label: 'aterrizaje', color: Chart.C.L }] }); h += `<table><tbody>${[['Peso corporal', r.bodyWeightN, 'N'], ['Masa', r.massKg, 'kg'], ['Fuerza pico', r.peakForceN, 'N'], ['Fuerza pico relativa', r.peakForceRel, 'N/kg'], ['Potencia pico', r.peakPowerW, 'W'], ['Potencia pico relativa', r.peakPowerRel, 'W/kg'], ['Velocidad de despegue', r.takeoffVel, 'm/s'], ['Altura (impulso–momento)', r.heightImpulseCm, 'cm'], ['Tiempo de vuelo', r.flightTimeS, 's'], ['Altura (tiempo de vuelo)', r.heightFlightCm, 'cm'], ['Impulso neto', r.netImpulseNs, 'N·s'], ['Tiempo hasta el despegue', r.timeToTakeoffS, 's']].map(([l, v, u]) => `<tr><td>${l}</td><td class="num"><b>${fx(v, Math.abs(v) < 10 ? 3 : 1)}</b> ${u}</td></tr>`).join('')}</tbody></table>`; }
    else if (rec.analysis === 'imtp') { h += Chart.signal({ y: rec.preview, fs: fsd, marks: [{ i: mk(r.onsetIdx), label: 'inicio' }, { i: mk(r.peakIdx), label: 'pico', color: Chart.C.R }] }); h += `<table><tbody>${[['Línea base (peso)', r.baselineN, 'N'], ['Fuerza pico bruta', r.peakForceN, 'N'], ['Fuerza pico neta', r.netPeakForceN, 'N'], ['Fuerza pico relativa', r.peakForceRel, 'N/kg'], ['Tiempo al pico', r.timeToPeakS, 's'], ...[50, 100, 150, 200, 250].map(ms => [`RFD 0–${ms} ms`, r['RFD0_' + ms], 'N/s']), ...[100, 200].map(ms => [`Impulso neto 0–${ms} ms`, r['IMP0_' + ms], 'N·s'])].map(([l, v, u]) => `<tr><td>${l}</td><td class="num"><b>${fx(v, 1)}</b> ${u}</td></tr>`).join('')}</tbody></table>`; }
    else { const c = r.contacts || []; h += Chart.signal({ y: rec.preview, fs: fsd, marks: c.slice(0, 12).map((x, i) => ({ i: mk(x.start), label: 'C' + (i + 1) })) }); h += c.length ? `<div class="tablewrap"><table><thead><tr><th>#</th><th class="num">Contacto (s)</th><th class="num">Pico (N)</th><th class="num">Pico (BW)</th><th class="num">Impacto (BW)</th><th class="num">VALR (BW/s)</th><th class="num">Impulso (N·s)</th></tr></thead><tbody>${c.map((x, i) => `<tr><td>${i + 1}</td><td class="num">${fx(x.contactS, 3)}</td><td class="num">${fx(x.peakN, 0)}</td><td class="num">${fx(x.peakBW, 2)}</td><td class="num">${fx(x.impactBW, 2)}</td><td class="num">${fx(x.valrBWs, 1)}</td><td class="num">${fx(x.impulseNs, 1)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="note warn">No se detectaron contactos con el umbral indicado.</div>'; }
    return h + `<p class="tiny muted">${esc(r.method || 'Contacto: Fz > umbral por > 50 ms; pico de impacto: primer máximo local en 60 ms; VALR: 20–80 % del pico de impacto.')} Verifique visualmente los marcadores antes de usar los valores.</p>`;
  },
  show(id) { const rec = DB.get('imports', id); modal({ title: esc(rec.fileName), wide: true, body: BM.render(rec) + `<p class="small muted">Para usar estos valores en una prueba, abra la prueba correspondiente y regístrelos como intento.</p>` }); },
  async del(id) { if (await confirmBox('Eliminar análisis', '¿Eliminar el análisis guardado?', 'Eliminar', true)) { DB.del('imports', id); App.refresh(); } }
};
Views.m_cardio = el => {
  if (!guard(el)) return;
  const e = Ctx.evaluation(); const { r, ts } = resFor(e.id, 'aero');
  el.innerHTML = pageHead('Capacidad cardiorrespiratoria', 'Test de campo con monitor Polar', testBtn('aero', 'Test aeróbico')) + (r ? `<div class="grid"><div class="card c6"><h3>Frecuencia cardiaca</h3>${Chart.bars({ yLabel: 'lpm', rows: [{ label: 'Reposo', v: metricVal(r, 'hrRest') }, { label: 'Pico', v: metricVal(r, 'hrPeak'), color: Chart.C.R }, { label: '1 min', v: metricVal(r, 'hr1') }, { label: '2 min', v: metricVal(r, 'hr2') }] })}</div><div class="card c6"><h3>Resultados</h3>${resultHTML(T('aero'), r, ts)}<p class="small">Protocolo: <b>${esc({ cooper: 'Cooper 12 min', yoyoir1: 'Yo-Yo IR1', leger20: 'Course Navette 20 m', otro: 'Otro' }[ts.moduleData?.protocol] || '—')}</b></p></div></div>` : '<div class="empty">Sin test aeróbico registrado.</div>');
};

/* ==========================================================
   INTEGRACIÓN
   ========================================================== */
const REGION_MAP = { inbody: 'Masa muscular', wblt: 'ROM tobillo', hiprom: 'ROM cadera', kneerom: 'ROM rodilla', slr: 'Flexibilidad isquios', quadiso: 'Fuerza cuádriceps', hamiso: 'Fuerza isquiotibiales', plantiso: 'Fuerza flexores plantares', hipext: 'Fuerza extensores cadera', hipabd: 'Fuerza abductores cadera', grip: 'Prensión (MS)', imtp: 'Fuerza global (IMTP)', cmj: 'Salto bilateral (fuerza por pierna)', cmju: 'Salto unilateral', hop: 'Hop', triplehop: 'Hop', crosshop: 'Hop', ybal: 'Control postural', isofatigue: 'Fatiga', slcr: 'Fatiga tríceps sural', encoder: 'Potencia (encoder)', gait: 'Carrera' };
const DIMAP_CATS = [['Masa muscular', ['inbody']], ['ROM', ['wblt', 'hiprom', 'kneerom', 'slr']], ['Fuerza', ['quadiso', 'hamiso', 'plantiso', 'hipext', 'hipabd', 'imtp', 'grip']], ['RFD', ['quadiso', 'hamiso', 'plantiso', 'hipext', 'hipabd', 'imtp'], 'rfd'], ['Potencia', ['cmj', 'cmju', 'encoder']], ['Salto / hop', ['cmju', 'hop', 'triplehop', 'crosshop']], ['Control', ['ybal']], ['Fatiga', ['isofatigue', 'slcr']], ['Carrera', ['gait']]];
function collectPairs(evId) {
  const out = [];
  Ctx.testSessions(evId).forEach(ts => { const r = Ctx.result(ts.id); const t = T(ts.testId); if (!r || !t) return; r.pairs.forEach(p => out.push(Object.assign({ test: t, testId: t.id }, p))); });
  return out;
}
Views.integration = el => {
  if (!guard(el)) return;
  const e = Ctx.evaluation(); const sum = Engine.evalSummary(e.id); const pairs = collectPairs(e.id); const dsi = Engine.dsi(e.id);
  const byDom = {}; sum.results.filter(x => x.r).forEach(x => (byDom[x.test.dash] = byDom[x.test.dash] || []).push(x));
  el.innerHTML = pageHead('Integración de resultados', 'Dashboard por dominios · mapa derecha/izquierda · lectura en tres niveles.', `<button class="btn ${e.integrationReviewed ? 'ok' : ''}" id="intRev">${e.integrationReviewed ? '✓ Integración revisada' : 'Marcar integración revisada'}</button>`) + `
  <div class="note neutral small"><b>Sobre gráficos radar:</b> no se muestran porque las variables de distintos dominios no comparten una normalización justificable (unidades y escalas diferentes, sin valores de referencia comunes). Se usa comparación D/I dentro de cada prueba y evolución longitudinal.</div>
  <div class="grid">${DASH_DOMAINS.map(d => { const xs = byDom[d] || []; return `<div class="card c4"><div class="cardhead"><h3>${d}</h3><span class="pill ${xs.length ? 'ok' : ''}">${xs.length} prueba(s)</span></div>${xs.length ? xs.map(x => `<div style="margin:6px 0"><b class="small">${esc(x.test.short)}</b>${x.ts.status === 'not_completed' ? ' <span class="pill bad">no completada</span>' : ''}<div class="small">${x.r.metrics.filter(m => m.primary).slice(0, 4).map(m => `${esc(m.label)}${m.side !== 'B' ? ' ' + sideShort(m.side) : ''}: <b>${fx(m.value, 2)}</b> ${esc(m.unit)}${m.estimated ? ' (ESTIMADO)' : ''}`).join(' · ') || x.r.metrics.slice(0, 2).map(m => `${esc(m.label)}: <b>${fx(m.value, 2)}</b> ${esc(m.unit)}`).join(' · ')}</div></div>`).join('') : '<div class="small muted">Sin datos en este dominio.</div>'}${d === 'Fuerza' && dsi.ok ? `<div class="small">DSI: <b>${fx(dsi.value, 2)}</b></div>` : ''}</div>`; }).join('')}</div>
  <div class="card" style="margin-top:14px"><div class="cardhead"><h2>Mapa derecha / izquierda</h2><div class="legend"><span><i style="background:var(--right)"></i>Pierna derecha</span><span><i style="background:var(--left)"></i>Pierna izquierda</span><span>◆ diferencia &gt; CV intra-sesión</span></div></div>
  <div class="grid"><div class="c4">${legMap(pairs)}</div><div class="c8"><div class="dimap-row" style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em"><div class="lab">Dimensión / variable</div><div class="right">Pierna derecha</div><div>Pierna izquierda</div><div class="right">Dif. %</div></div>
  ${DIMAP_CATS.map(([cat, ids, filt]) => { const ps = pairs.filter(p => ids.includes(p.testId) && p.R !== null && p.L !== null && (filt ? p.fk.startsWith(filt) : (!p.fk.startsWith('rfd') && (p.key || ['pf', 'f', 'h', 'd', 'leanLeg', 'ang', 'flex', 'comp', 'reps', 'decr', 'tc', 'vgrf', 'pfLR', 'ppmax'].includes(p.fk))))); if (!ps.length) return `<div class="dimap-row"><div class="lab"><b>${cat}</b></div><div class="small muted" style="grid-column:span 3">Sin datos bilaterales</div></div>`; return `<div style="margin-top:8px"><b>${cat}</b></div>` + ps.map(p => { const mx = Math.max(Math.abs(p.R), Math.abs(p.L)) || 1; return `<div class="dimap-row"><div class="lab small">${esc(p.test.short)} · ${esc(p.label)} <span class="tiny muted">${esc(p.unit)}</span></div><div class="row" style="justify-content:flex-end;gap:6px"><span class="small">${fx(p.R, 1)}</span><div class="dimap-bar R" style="width:65%"><i style="width:${Math.abs(p.R) / mx * 100}%"></i></div></div><div class="row" style="gap:6px"><div class="dimap-bar L" style="width:65%"><i style="width:${Math.abs(p.L) / mx * 100}%"></i></div><span class="small">${fx(p.L, 1)}</span></div><div class="right small">${p.exceedsCV ? '◆ ' : ''}<b>${fx(p.asym, 1)}</b>${p.hib === false ? '<div class="tiny muted">menor = mejor</div>' : ''}</div></div>`; }).join(''); }).join('')}</div></div></div>
  <div class="card" style="margin-top:14px"><h2>Lectura en tres niveles</h2>${sum.results.filter(x => x.r?.statements?.length).map(x => x.r.statements.map(s => `<div class="levels" style="margin-bottom:10px"><div class="lvl l1"><b>Resultado objetivo</b><div>${esc(s.l1)}</div></div><div class="lvl l2"><b>Interpretación</b><div>${esc(s.l2)}</div></div><div class="lvl l3"><b>Consideración profesional</b><div>${esc(s.l3)}</div></div></div>`).join('')).join('') || '<div class="empty small">Sin resultados.</div>'}</div>
  <div class="runfoot"><span></span>${nextBtn('Continuar al informe')}</div>`;
  $('#intRev').onclick = () => { e.integrationReviewed = !e.integrationReviewed; DB.put('evaluations', e); App.refresh(); };
};
function legMap(pairs) {
  const reg = { hip: ['hiprom', 'hipext', 'hipabd'], thighA: ['quadiso'], thighP: ['hamiso', 'slr'], knee: ['kneerom'], calf: ['plantiso', 'slcr'], ankle: ['wblt'], whole: ['cmju', 'hop', 'triplehop', 'crosshop', 'gait', 'ybal', 'inbody', 'isofatigue', 'cmj', 'encoder'] };
  const cnt = (ids) => { const ps = pairs.filter(p => ids.includes(p.testId)); return { n: ps.length, f: ps.filter(p => p.exceedsCV).length, better: { R: ps.filter(p => p.exceedsCV && p.better === 'R').length, L: ps.filter(p => p.exceedsCV && p.better === 'L').length } }; };
  const zone = (k, x, y, rx, ry, lab) => { const c = cnt(reg[k]); const op = c.n ? 0.15 + 0.6 * (c.f / c.n) : 0.05; return `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#7c8cff" opacity="${op.toFixed(2)}" stroke="#7c8cff" stroke-width="${c.f ? 1.5 : 0.5}"/>${c.n ? `<text x="${x}" y="${y + 4}" text-anchor="middle" style="font-size:10px;fill:#e8f0fb">${c.f}/${c.n}</text>` : ''}`; };
  const leg = (cx, side) => `<path d="M${cx - 22},40 Q${cx - 26},120 ${cx - 16},200 L${cx - 12},300 L${cx - 18},330 L${cx + 14},330 L${cx + 10},300 L${cx + 16},200 Q${cx + 24},120 ${cx + 20},40 Z" fill="none" stroke="${side === 'R' ? 'var(--right)' : 'var(--left)'}" stroke-width="2"/>`;
  let g = leg(70, 'R') + leg(170, 'L') + `<text x="70" y="352" text-anchor="middle" style="font-size:11px;fill:var(--right)">DERECHA</text><text x="170" y="352" text-anchor="middle" style="font-size:11px;fill:var(--left)">IZQUIERDA</text>`;
  [70, 170].forEach(cx => { g += zone('hip', cx, 55, 22, 14) + zone('thighA', cx - 6, 110, 12, 34) + zone('thighP', cx + 8, 130, 10, 34) + zone('knee', cx, 195, 13, 11) + zone('calf', cx + 2, 240, 11, 28) + zone('ankle', cx - 2, 305, 10, 9); });
  const w = cnt(reg.whole); g += `<text x="120" y="20" text-anchor="middle" style="font-size:10.5px;fill:#b7c7dc">Tareas globales: ${w.f}/${w.n} con diferencia &gt; CV</text>`;
  return `<div class="chart"><svg viewBox="0 0 240 360">${g}</svg></div><p class="tiny muted">Cada zona muestra «n.º de variables con diferencia D/I mayor que el CV intra-sesión / n.º de variables bilaterales registradas» en pruebas de esa región (el mismo valor para ambas piernas: la diferencia es entre ellas). Intensidad proporcional. No indica lesión ni causa.</p>`;
}

/* ==========================================================
   EVOLUCIÓN LONGITUDINAL
   ========================================================== */
let EVO_SEL = null;
Views.evolution = el => {
  if (!guard(el, false)) return;
  const a = Ctx.athlete(); const evs = DB.where('evaluations', x => x.athleteId === a.id).sort(byDate);
  const groups = {};
  evs.forEach((ev, i) => {
    DB.where('results', r => r.evaluationId === ev.id).forEach(r => { const t = T(r.testId); r.metrics.forEach(m => { const g = (groups[t.short + ' · ' + m.label] = groups[t.short + ' · ' + m.label] || { test: t, label: m.label, unit: m.unit, base: m.base, series: {} }); (g.series[m.side] = g.series[m.side] || [])[i] = { v: m.value, estimated: m.estimated }; }); });
    DB.where('questionnaires', q => q.evaluationId === ev.id && q.scores).forEach(q => Object.entries(q.scores).forEach(([k, s]) => { const g = (groups[q.instrument + ' · ' + s.label] = groups[q.instrument + ' · ' + s.label] || { test: { short: q.instrument }, label: s.label, unit: s.unit, base: QDEFS[q.instrument].metricKey(k), series: {} }); (g.series.B = g.series.B || [])[i] = { v: s.value }; }));
  });
  const keys = Object.keys(groups).filter(k => Object.values(groups[k].series).some(s => s.filter(Boolean).length >= 1)).sort();
  if (!EVO_SEL || !groups[EVO_SEL]) EVO_SEL = keys.find(k => Object.values(groups[k].series).some(s => s.filter(Boolean).length > 1)) || keys[0];
  const g = groups[EVO_SEL];
  el.innerHTML = pageHead('Evolución longitudinal', `${evs.length} evaluación(es): ${evs.map(x => fmtDate(x.date)).join(' → ')}`, `<button class="btn" onclick="Act.newEvaluation()">${ICON.plus} Nueva reevaluación</button>`) + (evs.length < 2 ? '<div class="note neutral">Se requiere al menos una reevaluación para comparar. Puede consultar igualmente los valores de la evaluación actual.</div>' : '') + (keys.length ? `
  <div class="grid"><div class="card c4"><h3>Variables</h3><input id="evoQ" placeholder="Filtrar…" style="margin-bottom:8px"><div class="list" style="max-height:65vh;overflow:auto" id="evoList">${keys.map(k => { const n = Math.max(...Object.values(groups[k].series).map(s => s.filter(Boolean).length)); return `<button class="item" data-k="${esc(k)}" style="text-align:left;cursor:pointer;color:var(--txt);font:inherit;${k === EVO_SEL ? 'border-color:var(--accent)' : ''}"><span class="small">${esc(k)}</span><span class="pill">${n}</span></button>`; }).join('')}</div></div>
  <div class="card c8">${g ? evoDetail(g, evs) : ''}</div></div>` : '<div class="empty">Aún no hay resultados.</div>');
  $$('#evoList [data-k]').forEach(b => b.onclick = () => { EVO_SEL = b.dataset.k; App.refresh(); });
  if ($('#evoQ')) $('#evoQ').oninput = ev => $$('#evoList [data-k]').forEach(b => b.style.display = b.dataset.k.toLowerCase().includes(ev.target.value.toLowerCase()) ? '' : 'none');
};
function evoDetail(g, evs) {
  const mdc = mdcFor(g.base); const sides = Object.keys(g.series);
  const chart = Chart.line({ H: 240, yLabel: g.unit, series: sides.map(s => ({ name: s === 'B' ? g.label : sideName(s), color: Chart.C[s], labels: true, pts: evs.map((ev, i) => ({ x: i, y: g.series[s][i]?.v ?? null, label: fmtDate(ev.date) })) })) });
  const rows = sides.map(s => { const pts = evs.map((ev, i) => ({ ev, v: g.series[s][i]?.v ?? null })).filter(p => p.v !== null); return pts.map((p, j) => { if (!j) return `<tr><td>${sideName(s)}</td><td>${fmtDate(p.ev.date)}</td><td class="num"><b>${fx(p.v, 2)}</b></td><td class="num">—</td><td class="num">—</td><td>Basal</td></tr>`; const d = p.v - pts[j - 1].v, pc = Calc.changePct(pts[j - 1].v, p.v); const cls = mdc ? (Math.abs(d) >= mdc.value ? `${refBadge('mdc')} <b>Cambio mayor al error de medición</b> (|Δ| ≥ MDC ${fx(mdc.value, 2)})` : `Cambio observado, dentro del error de medición (|Δ| &lt; MDC ${fx(mdc.value, 2)})`) : 'Cambio observado (no hay MDC disponible para esta prueba/población; registre la fiabilidad del laboratorio en Referencias)'; return `<tr><td>${sideName(s)}</td><td>${fmtDate(p.ev.date)}</td><td class="num"><b>${fx(p.v, 2)}</b></td><td class="num">${d > 0 ? '+' : ''}${fx(d, 2)}</td><td class="num">${pc > 0 ? '+' : ''}${fx(pc, 1)} %</td><td class="small">${cls}</td></tr>`; }).join(''); }).join('');
  return `<h2>${esc(g.test.short)} · ${esc(g.label)} <span class="muted small">(${esc(g.unit)})</span></h2>${chart}<div class="tablewrap"><table><thead><tr><th>Lado</th><th>Fecha</th><th class="num">Valor</th><th class="num">Δ abs.</th><th class="num">Δ %</th><th>Clasificación del cambio</th></tr></thead><tbody>${rows}</tbody></table></div>${mdc ? `<div class="small">MDC utilizado: ${mdc.ref.own ? 'fiabilidad propia del laboratorio' : srcHTML(mdc.ref.src)}${mdc.derived ? ' (derivado del SEM: SEM × 1.96 × √2)' : ''}</div>` : ''}<p class="tiny muted">Se distingue «cambio observado» de «cambio mayor al error de medición». Un cambio mayor al MDC no implica por sí mismo relevancia clínica (MCID) ni causalidad.</p>`;
}
/* ==========================================================
   INFORME, REFERENCIAS, DATOS, DEMO, ARRANQUE
   ========================================================== */
function reportDraft(e) {
  const a = DB.get('athletes', e.athleteId); const pairs = collectPairs(e.id); const sum = Engine.evalSummary(e.id);
  const flagged = pairs.filter(p => p.exceedsCV && p.R !== null && p.L !== null).sort((x, y) => y.asym - x.asym);
  const desc = pairs.filter(p => p.exceedsCV === null && p.asym !== null && p.key);
  const qs = Ctx.questionnaires(e.id).filter(q => q.scores);
  const findings = [];
  flagged.forEach(p => findings.push(`• ${p.test.short} — ${p.label}: D ${fx(p.R, 1)} / I ${fx(p.L, 1)} ${p.unit}; diferencia ${fx(p.asym, 1)} %, mayor que la variabilidad entre intentos (CV ${fx(p.cvMean, 1)} %). Mejor desempeño: ${sideName(p.better).toLowerCase()}.`));
  desc.forEach(p => findings.push(`• ${p.test.short} — ${p.label}: D ${fx(p.R, 1)} / I ${fx(p.L, 1)} ${p.unit}; diferencia descriptiva ${fx(p.asym, 1)} % (sin estimación de variabilidad para contrastar).`));
  qs.forEach(q => findings.push(`• ${q.instrument}: ${Object.values(q.scores).map(s => `${s.label} ${fx(s.value, 1)} ${s.unit}`).join('; ')}${q.classification ? ' — ' + q.classification : ''}.`));
  const dsi = Engine.dsi(e.id); if (dsi.ok) findings.push(`• DSI: ${fx(dsi.value, 2)} (${dsi.eq})`);
  if (!findings.length) findings.push('• No se registran diferencias entre extremidades que superen la variabilidad entre intentos en las pruebas realizadas.');
  const follow = [];
  flagged.slice(0, 6).forEach(p => follow.push(`• Reevaluar ${p.test.short} (${p.label}) con el mismo protocolo, equipo y condiciones para confirmar si la diferencia D/I persiste.`));
  sum.tss.filter(t => t.status === 'not_completed').forEach(t => follow.push(`• Completar ${T(t.testId).short} (no completada: ${t.ncReason || 'sin motivo'}).`));
  sum.tss.filter(t => ['pending', 'in_progress'].includes(t.status)).forEach(t => follow.push(`• Pendiente: ${T(t.testId).short}.`));
  Ctx.sessions(e.id).forEach(s => (s.alerts || []).filter(x => x[0] !== 'info').forEach(x => follow.push(`• Sesión ${s.n}: ${x[1]} Considerar al interpretar los resultados de esa sesión.`)));
  follow.push('• Estimar la fiabilidad test–retest del laboratorio (SEM/MDC) para las pruebas sin MDC publicado aplicable, y registrarla en Referencias.');
  const sugg = [];
  if (flagged.length) sugg.push(`• Considerar, a criterio del profesional responsable, trabajo específico de fuerza/potencia para las tareas donde la extremidad ${flagged.filter(p => p.better === 'R').length >= flagged.filter(p => p.better === 'L').length ? 'izquierda' : 'derecha'} mostró menor desempeño, con progresión supervisada y control de síntomas.`);
  sugg.push('• Integrar estos resultados con la valoración clínica, la carga de entrenamiento y los objetivos competitivos antes de modificar la planificación.');
  sugg.push('• Programar reevaluación con la misma batería y orden de pruebas para seguimiento longitudinal.');
  const lim = ['• Los resultados describen el desempeño en las condiciones de evaluación y no constituyen diagnóstico médico, identificación de causas de lesión ni autorización automática de retorno deportivo.', '• Para la mayoría de las pruebas no existe un punto de corte universal validado en esta población; se interpretan valores absolutos, comparación bilateral, fiabilidad y evolución.', '• La interpretación de diferencias D/I utiliza la variabilidad intra-sesión (CV) como referencia; no reemplaza el error de medición test–retest.'];
  if (sum.tss.some(t => t.testId === 'inbody')) lim.push('• La bioimpedancia es sensible a hidratación, ingesta y ejercicio previo.');
  if (sum.tss.some(t => t.testId === 'aero')) lim.push('• El VO₂max informado es ESTIMADO a partir de una prueba de campo; no se realizó análisis de gases.');
  if (Ctx.sessions(e.id).length > 1) lim.push('• La evaluación se distribuyó en varias sesiones; las condiciones pueden haber variado entre ellas.');
  return { findings: findings.join('\n'), followUp: follow.join('\n'), suggestions: sugg.join('\n'), limitations: lim.join('\n'), interpretation: 'La evaluación describe el perfil de capacidades físicas y la comparación entre extremidades en las pruebas realizadas. Las diferencias observadas deben interpretarse de forma conjunta con la fuerza específica, los síntomas, los antecedentes y el desempeño en otras tareas.', recommendations: '' };
}
Views.report = el => {
  if (!guard(el)) return;
  const e = Ctx.evaluation(), a = Ctx.athlete(); let rep = DB.where('reports', r => r.evaluationId === e.id)[0];
  if (!rep) { rep = DB.put('reports', Object.assign({ evaluationId: e.id, athleteId: a.id, evaluatorName: e.evaluator }, reportDraft(e))); }
  const sum = Engine.evalSummary(e.id); const inj = Ctx.injuries(a.id); const qs = Ctx.questionnaires(e.id).filter(q => q.scores); const pairs = collectPairs(e.id).filter(p => p.R !== null && p.L !== null);
  const evs = DB.where('evaluations', x => x.athleteId === a.id).sort(byDate); const idx = evs.findIndex(x => x.id === e.id); const prior = evs.slice(0, idx);
  const age = num(a.age) ?? Calc.ageFrom(a.birthDate); const c = Ctx.consent(e.id);
  const ta = (k, rows = 5) => `<textarea data-rep="${k}" rows="${rows}" style="min-height:${rows * 20}px">${esc(rep[k] || '')}</textarea>`;
  const evoRows = prior.length ? (() => { const prev = prior[prior.length - 1]; const cur = DB.where('results', r => r.evaluationId === e.id); const old = DB.where('results', r => r.evaluationId === prev.id); const rows = []; cur.forEach(r => r.metrics.filter(m => m.primary).forEach(m => { const o = old.flatMap(x => x.metrics).find(x => x.key === m.key); if (o) { const d = m.value - o.value; const mdc = mdcFor(m.base); rows.push(`<tr><td>${esc(T(r.testId).short)} · ${esc(m.label)} ${m.side !== 'B' ? sideShort(m.side) : ''}</td><td class="num">${fx(o.value, 2)}</td><td class="num">${fx(m.value, 2)}</td><td class="num">${d > 0 ? '+' : ''}${fx(d, 2)}</td><td class="num">${fx(Calc.changePct(o.value, m.value), 1)} %</td><td>${mdc ? (Math.abs(d) >= mdc.value ? 'Mayor al error de medición' : 'Dentro del error de medición') : 'Cambio observado (sin MDC)'}</td></tr>`); } })); return rows.length ? `<p class="small">Comparación con la evaluación del ${fmtDate(prev.date)}.</p><table><thead><tr><th>Variable</th><th class="num">Previa</th><th class="num">Actual</th><th class="num">Δ</th><th class="num">Δ %</th><th>Clasificación</th></tr></thead><tbody>${rows.join('')}</tbody></table>` : '<p class="small">No hay variables repetidas con la evaluación previa.</p>'; })() : '';
  el.innerHTML = pageHead('Informe profesional', 'Revise y edite las secciones antes de emitir. Imprima o guarde como PDF desde el diálogo de impresión.', `<button class="btn sec" id="rgRegen">Regenerar borrador</button><button class="btn sec" onclick="Act.printSection('Informe_LCM_${esc((a.lastName || '').split(' ')[0])}_${e.date}')">${ICON.print} Imprimir / PDF</button><button class="btn sec" id="rgPdf">${ICON.doc} Descargar PDF</button><button class="btn ${rep.issuedAt ? 'ok' : ''}" id="rgIssue">${rep.issuedAt ? '✓ Emitido' : 'Emitir informe'}</button>`) + `
  <div class="report" id="reportDoc">
    <div class="rhead"><div style="display:flex;gap:12px;align-items:center">${LOGO.replace('class="logo"', 'class="logo" style="width:46px;height:46px"')}<div><h1 style="margin:0">Informe de evaluación integrada</h1><div class="muted">${APP.lab} · ${APP.institution}</div></div></div><div class="right small">Fecha de evaluación: <b>${fmtDate(e.date)}</b><br>Emisión: ${rep.issuedAt ? new Date(rep.issuedAt).toLocaleDateString('es-PE') : 'borrador'}</div></div>
    <h2>1. Datos del deportista</h2><table><tbody><tr><td><b>Nombre</b></td><td>${esc(fullName(a))}</td><td><b>Edad</b></td><td>${age ?? '—'} años</td></tr><tr><td><b>Deporte / especialidad</b></td><td>${esc(a.sport || '—')}${a.event ? ' · ' + esc(a.event) : ''}</td><td><b>Nivel</b></td><td>${esc(a.level || '—')}</td></tr><tr><td><b>Dominancia</b></td><td>${esc(a.dominance || '—')}</td><td><b>Pierna de impulso</b></td><td>${esc(a.takeoffLeg || '—')}</td></tr><tr><td><b>Masa (normalización)</b></td><td>${Ctx.mass(e.id) ? fx(Ctx.mass(e.id).value, 1) + ' kg' : '—'}</td><td><b>Evaluador</b></td><td>${esc(e.evaluator || '—')}</td></tr></tbody></table>
    <h2>2. Objetivo</h2><p>${esc(e.objective || a.objective || '—')}</p>
    <h2>3. Antecedentes</h2>${inj.length ? `<table><thead><tr><th>Fecha</th><th>Zona</th><th>Lado</th><th>Diagnóstico referido</th><th>Gravedad</th><th>Estado</th></tr></thead><tbody>${inj.map(i => `<tr><td>${fmtDate(i.date)}${i.approx ? ' (aprox.)' : ''}</td><td>${esc(i.zone)}</td><td>${sideName(i.side)}</td><td>${esc(i.diagnosis || '—')}</td><td>${esc(i.severity || '—')}</td><td>${esc(i.status || '—')}</td></tr>`).join('')}</tbody></table>` : '<p>Sin antecedentes registrados.</p>'}
    <h2>4. Cuestionarios</h2>${qs.length ? `<table><thead><tr><th>Instrumento</th><th>Escala</th><th class="num">Bruto</th><th class="num">Puntaje</th></tr></thead><tbody>${qs.flatMap(q => Object.values(q.scores).map(s => `<tr><td>${q.instrument}${q.extra?.side ? ' (' + sideName(q.extra.side) + ')' : ''}</td><td>${esc(s.label)}</td><td class="num">${fx(s.raw, 0)}${s.max ? '/' + s.max : ''}</td><td class="num">${fx(s.value, 1)} ${esc(s.unit)}</td></tr>`)).join('')}</tbody></table>` : '<p>No se aplicaron o no se completaron cuestionarios.</p>'}
    <h2>5. Batería realizada y condiciones</h2><table><thead><tr><th>Prueba</th><th>Sesión</th><th>Estado</th><th>Equipo / código</th><th>Calibración</th></tr></thead><tbody>${sum.tss.map(t => `<tr><td>${esc(T(t.testId).name)}</td><td>${DB.get('sessions', t.sessionId)?.n ?? '—'}</td><td>${statusLabel(t.status)}${t.ncReason ? ': ' + esc(t.ncReason) : ''}</td><td>${esc(t.prep?.equipment || '—')} ${esc(t.prep?.equipmentCode || '')}</td><td>${esc(t.prep?.calibration || '—')}</td></tr>`).join('')}</tbody></table>
    <p class="small muted">${Ctx.sessions(e.id).map(s => `Sesión ${s.n}: ${fmtDate(s.date)} ${s.time || ''} · ${s.checkin ? `sueño ${s.checkin.sleep ?? '—'} h, fatiga ${s.checkin.fatigue ?? '—'}/10, dolor ${s.checkin.pain ?? '—'}/10, ${s.checkin.temp ?? '—'} °C` : 'sin check-in'}`).join(' · ')}</p>
    <h3>Signos vitales</h3>${Ctx.sessions(e.id).map(s => `<p class="small"><b>Sesión ${s.n}</b></p>${vitalsTableHTML(s, false)}`).join('')}
    <h2>6. Resultados</h2>${sum.results.filter(x => x.r && x.r.metrics.length).map(x => `<h3>${esc(x.test.name)}</h3><table><thead><tr><th>Variable</th><th>Lado</th><th class="num">Resultado</th><th class="num">CV %</th></tr></thead><tbody>${x.r.metrics.filter(m => m.primary || m.derived || x.r.metrics.length <= 10 || ['pf', 'h', 'pp', 'weight', 'pbf', 'smm'].includes(m.fk)).slice(0, 14).map(m => `<tr><td>${esc(m.label)}${m.estimated ? ' (ESTIMADO)' : ''}</td><td>${m.side === 'B' ? '—' : sideName(m.side)}</td><td class="num">${fx(m.value, 2)} ${esc(m.unit)}</td><td class="num">${fx(m.cv, 1)}</td></tr>`).join('')}${x.r.derived.map(d => `<tr><td>${esc(d.label)}</td><td>${d.side ? sideName(d.side) : '—'}</td><td class="num">${fx(d.value, 2)} ${esc(d.unit)}</td><td></td></tr>`).join('')}</tbody></table>${x.ts.interpretationNote ? `<p class="small"><i>Nota del evaluador:</i> ${esc(x.ts.interpretationNote)}</p>` : ''}`).join('') || '<p>Sin resultados registrados.</p>'}
    <h2>7. Comparación derecha / izquierda</h2>${pairs.length ? `<table><thead><tr><th>Prueba · variable</th><th class="num">D</th><th class="num">I</th><th class="num">Dif. %</th><th class="num">CV %</th><th>Lectura</th></tr></thead><tbody>${pairs.map(p => `<tr><td>${esc(p.test.short)} · ${esc(p.label)} (${esc(p.unit)})</td><td class="num">${fx(p.R, 2)}</td><td class="num">${fx(p.L, 2)}</td><td class="num">${fx(p.asym, 1)}</td><td class="num">${fx(p.cvMean, 1)}</td><td>${p.exceedsCV === null ? 'Descriptiva' : p.exceedsCV ? 'Supera la variabilidad entre intentos' : 'Dentro de la variabilidad'}</td></tr>`).join('')}</tbody></table>${Chart.pairs({ rows: pairs.filter(p => p.key).slice(0, 10).map(p => ({ label: p.test.short + ' ' + p.label.slice(0, 18), R: p.R, L: p.L })) })}<p class="tiny muted">Asimetría % = |D − I| / máx(D, I) × 100.</p>` : '<p>Sin pruebas bilaterales registradas.</p>'}
    <h2>8. Hallazgos principales</h2><p class="tiny muted">Resultados observados; no constituyen diagnóstico.</p>${ta('findings', 7)}
    ${prior.length ? `<h2>9. Evolución</h2>${evoRows}` : ''}
    <h2>${prior.length ? 10 : 9}. Interpretación</h2>${ta('interpretation', 4)}
    <h2>${prior.length ? 11 : 10}. Aspectos para seguimiento</h2>${ta('followUp', 5)}
    <h2>${prior.length ? 12 : 11}. Sugerencias para entrenamiento / evaluación</h2><p class="tiny muted">Editables por el profesional antes de emitir.</p>${ta('suggestions', 5)}
    <h2>${prior.length ? 13 : 12}. Recomendaciones</h2>${ta('recommendations', 3)}
    <h2>${prior.length ? 14 : 13}. Limitaciones</h2>${ta('limitations', 6)}
    <div class="note small">Este informe apoya la valoración profesional y el seguimiento. No establece por sí solo diagnóstico, causalidad de lesión ni autorización de retorno a la competencia.${c ? ` Consentimiento informado registrado el ${fmtDate(c.date)} (versión ${esc(c.version)}).` : ' <b>Sin consentimiento registrado.</b>'}</div>
    <div class="row" style="justify-content:space-between;align-items:flex-end;margin-top:20px"><div>${rep.evaluatorSig ? `<img src="${rep.evaluatorSig}" style="height:60px">` : (c?.evaluatorSig ? `<img src="${c.evaluatorSig}" style="height:60px">` : '')}<div class="sigline">${esc(rep.evaluatorName || e.evaluator || 'Evaluador')}<br>${APP.lab}</div></div><div class="small muted right">Generado con ${APP.name} v${APP.version}<br>Datos almacenados localmente</div></div>
  </div>`;
  $$('[data-rep]').forEach(t => t.oninput = debounce(() => { rep[t.dataset.rep] = t.value; DB.put('reports', rep); }, 400));
  $('#rgPdf').onclick = () => PdfReports.evaluation(e);
  $('#rgRegen').onclick = async () => { if (!(await confirmBox('Regenerar borrador', 'Se reemplazarán los textos editables (hallazgos, interpretación, seguimiento, sugerencias, limitaciones) por un nuevo borrador automático.', 'Regenerar'))) return; Object.assign(rep, reportDraft(e)); DB.put('reports', rep); App.refresh(); };
  $('#rgIssue').onclick = async () => { if (rep.issuedAt) { if (await confirmBox('Reabrir informe', 'El informe volverá a estado borrador.', 'Reabrir')) { rep.issuedAt = null; DB.put('reports', rep); App.refresh(); } return; } if (!c) { toast('No hay consentimiento registrado para esta evaluación', 'bad'); return; } if (!(await confirmBox('Emitir informe', 'Confirme que revisó los hallazgos, la interpretación y las sugerencias.', 'Emitir'))) return; rep.issuedAt = nowISO(); rep.evaluatorName = rep.evaluatorName || e.evaluator; DB.put('reports', rep); toast('Informe emitido'); App.refresh(); };
};

/* ==========================================================
   REFERENCIAS
   ========================================================== */
Views.references = el => {
  const own = DB.all('references'); const metrics = [...TESTS.flatMap(t => t.fields.map(f => [metricKey(t, f.k), `${t.short} · ${f.label} (${f.unit})`])), ...Object.values(QDEFS).flatMap(q => q.sections.length ? [[q.metricKey(q.id === 'LEFS' ? 'total' : q.id === 'OSTRC' ? 'severity' : 'adl'), `${q.short}`]] : [])];
  el.innerHTML = pageHead('Base interna de referencias', 'Cada parámetro indica su tipo, valor, población, protocolo y fuente.') + `
  <div class="card"><h3>Tipos</h3><div class="row">${Object.keys(REF_TYPES).map(k => refBadge(k)).join(' ')}</div><div class="note neutral small" style="margin-top:8px">Regla del sistema: no se inventan valores normativos. Si no existe referencia apropiada se muestra: «${NO_CUTOFF}»</div></div>
  <div class="card" style="margin-top:12px"><div class="cardhead"><h2>Fiabilidad propia del laboratorio</h2><button class="btn" id="refAdd">${ICON.plus} Añadir SEM / MDC propio</button></div>${own.length ? `<table><thead><tr><th>Métrica</th><th>Tipo</th><th class="num">Valor</th><th>Población / protocolo</th><th></th></tr></thead><tbody>${own.map(r => `<tr><td>${esc(metrics.find(m => m[0] === r.metric)?.[1] || r.metric)}</td><td>${refBadge(r.type)}</td><td class="num">${esc(r.value)} ${esc(r.unit || '')}</td><td class="small">${esc(r.population || '')} · ${esc(r.protocol || '')}${r.srcText ? '<br>' + esc(r.srcText) : ''}</td><td><button class="btn sm ghost" onclick="RefAct.del('${r.id}')">${ICON.trash}</button></td></tr>`).join('')}</tbody></table>` : '<div class="small muted">Aún no hay valores propios. Registre el SEM o MDC de sus estudios test–retest para que la evolución distinga cambios mayores al error de medición.</div>'}</div>
  <div class="card" style="margin-top:12px"><h2>Referencias incorporadas (${BUILTIN_REFS.length})</h2>${BUILTIN_REFS.map(refCard).join('')}</div>
  <div class="card" style="margin-top:12px"><h2>Fuentes bibliográficas</h2><ol class="small">${Object.keys(SOURCES).map(k => `<li>${srcHTML(k)}</li>`).join('')}</ol><p class="tiny muted">Verifique cada cita y DOI antes de su uso en publicaciones.</p></div>`;
  $('#refAdd').onclick = () => { const flds = [{ k: 'metric', label: 'Métrica', type: 'select', opts: metrics, span: 12, req: true }, { k: 'type', label: 'Tipo', type: 'select', opts: [['sem', 'SEM'], ['mdc', 'MDC95'], ['mcid', 'MCID']], span: 4 }, { k: 'value', label: 'Valor', type: 'number', span: 4, req: true }, { k: 'unit', label: 'Unidad', span: 4 }, { k: 'population', label: 'Población', span: 6 }, { k: 'protocol', label: 'Protocolo / n / ICC', span: 6 }, { k: 'srcText', label: 'Fuente (estudio interno, fecha)', span: 12 }]; modal({ title: 'Añadir fiabilidad propia', body: `<div class="grid">${flds.map(f => fieldHTML(f, '', 'rf')).join('')}</div><p class="tiny muted">Si registra SEM, el MDC95 se calcula como SEM × 1.96 × √2.</p>`, actions: [{ label: 'Cancelar', cls: 'ghost' }, { label: 'Guardar', cls: 'ok', onClick: bg => { const r = readFields(bg, flds, 'rf'); if (!r.ok) { toast(r.errs.join(' · '), 'bad'); return false; } DB.put('references', Object.assign(r.values, { own: true })); toast('Referencia guardada'); App.refresh(); } }] }); };
};
const RefAct = { async del(id) { if (await confirmBox('Eliminar referencia', '¿Eliminar este valor propio?', 'Eliminar', true)) { DB.del('references', id); App.refresh(); } } };

/* ==========================================================
   DATOS, RESPALDO Y PRIVACIDAD
   ========================================================== */
Views.data = async el => {
  const a = Ctx.athlete(); const last = DB.setting('lastBackup');
  let est = ''; try { if (navigator.storage?.estimate) { const s = await navigator.storage.estimate(); est = `${(s.usage / 1048576).toFixed(1)} MB usados de ≈ ${(s.quota / 1048576).toFixed(0)} MB disponibles`; } } catch (e) { }
  el.innerHTML = pageHead('Datos, respaldo y privacidad', 'Información personal y de salud: gestión local y responsable.') + `
  <div class="grid"><div class="card c6"><h2>Dónde se almacenan los datos</h2><p><b>${DB.mode === 'indexeddb' ? 'IndexedDB' : DB.mode === 'localstorage' ? 'localStorage' : 'Memoria temporal'}</b> del navegador en <b>este equipo</b> (base «lcm_athlete_lab»). ${est}</p><ul class="small"><li>No se envía información a servidores ni servicios externos; la aplicación no realiza solicitudes de red.</li><li>La URL solo contiene el nombre de la vista, nunca datos personales.</li><li>Borrar los datos del sitio en el navegador elimina la información: exporte respaldos periódicamente.</li><li>Otro navegador u otro equipo no ven estos datos (use importar respaldo).</li><li>Proteja el equipo con usuario y contraseña; los respaldos JSON contienen datos de salud: guárdelos en un medio institucional seguro.</li></ul>
  <table class="small"><tbody>${COLLECTIONS.filter(c => c !== 'settings').map(c => `<tr><td>${c}</td><td class="num">${DB.all(c).length}</td></tr>`).join('')}</tbody></table></div>
  <div class="card c6"><h2>Respaldo</h2><p class="small">Último respaldo exportado: <b>${last ? new Date(last).toLocaleString('es-PE') : 'nunca'}</b></p><div class="row"><button class="btn" onclick="Act.exportAll()">Exportar respaldo JSON (todo)</button>${a ? `<button class="btn sec" id="expA">Exportar solo ${esc(a.firstName)}</button>` : ''}</div>
  <hr><h3>Importar respaldo JSON</h3><input type="file" id="impF" accept=".json,application/json"><div class="row" style="margin-top:8px"><label class="check" style="margin:0"><input type="radio" name="impM" value="merge" checked> Combinar (actualiza registros con el mismo ID)</label><label class="check" style="margin:0"><input type="radio" name="impM" value="replace"> Reemplazar todo</label></div><button class="btn sec" id="impB" style="margin-top:8px">Importar</button>
  <hr><h3>Eliminar</h3><div class="row">${a ? `<button class="btn bad" onclick="Views.deleteAthlete('${a.id}')">${ICON.trash} Eliminar deportista activo</button>` : ''}<button class="btn bad" id="wipe">Borrar TODOS los datos</button></div></div>
  <div class="card c12"><h2>Funciones que NO realiza esta versión (declaración explícita)</h2><ul class="small"><li>No se conecta en tiempo real a AMTI, Qualisys, InBody, encoders ni Polar: los datos se ingresan manualmente o se importan desde archivos exportados (CSV/TSV).</li><li>No extrae automáticamente valores de PDF o imágenes del InBody (no hay OCR); se adjuntan como documento.</li><li>No lee formatos binarios propietarios (.qtm, .c3d, archivos nativos de encoders).</li><li>No sincroniza entre dispositivos ni tiene cuentas de usuario; el deportista completa los cuestionarios en el mismo dispositivo del laboratorio (modo deportista).</li><li>No genera diagnósticos, causas de lesión ni decisiones de aptitud o retorno deportivo.</li><li>El PDF se genera con la función de impresión del navegador («Guardar como PDF»).</li></ul></div></div>`;
  if ($('#expA')) $('#expA').onclick = () => { download(`LCM_${(a.lastName || 'deportista').replace(/\s+/g, '_')}_${todayStr()}.json`, JSON.stringify(DB.exportData(a.id), null, 1)); toast('Respaldo del deportista exportado'); };
  $('#impB').onclick = async () => { const f = $('#impF').files[0]; if (!f) { toast('Seleccione un archivo', 'warn'); return; } const mode = $('input[name=impM]:checked').value; let obj; try { obj = JSON.parse(await readFile(f)); } catch (e) { toast('JSON inválido', 'bad'); return; } if (mode === 'replace' && !(await confirmBox('Reemplazar todo', 'Se borrarán TODOS los datos actuales antes de importar.', 'Reemplazar', true, 'REEMPLAZAR'))) return; try { const n = DB.importData(obj, mode); toast(`${n} registros importados`); App.renderCtx(); App.refresh(); } catch (e) { toast(e.message, 'bad'); } };
  $('#wipe').onclick = async () => { if (await confirmBox('Borrar todos los datos', 'Se eliminarán definitivamente todos los deportistas, evaluaciones y resultados de este navegador.', 'Borrar todo', true, 'BORRAR')) { DB.clearAll(); toast('Datos eliminados', 'warn'); App.go('dashboard'); } };
};

/* ==========================================================
   CASO DEMO (antecedentes sin resultados)
   ========================================================== */
const Demo = {
  async load() {
    let a = DB.all('athletes').find(x => (x.firstName || '').startsWith('Xioveng'));
    if (a) { if (!(await confirmBox('Caso demo', 'El deportista demo ya existe. ¿Seleccionarlo?', 'Seleccionar'))) return; Ctx.setAthlete(a.id); App.go('dashboard'); return; }
    a = DB.put('athletes', { firstName: 'Xioveng Augusto', lastName: 'Moscoso Lozán', age: 20, sport: 'Atletismo', demo: true, objective: 'Determinar si persisten déficits funcionales, neuromusculares o biomecánicos que puedan relacionarse con una asimetría de fuerza entre las extremidades inferiores.' });
    const note = 'Lesiones sucesivas entre marzo y septiembre de 2024, ≈ 1–1.5 meses por lesión, sin gravedad referida. Mes aproximado (secuencia referida).';
    [['Tobillo', 'R', '2024-03', 'Lesión de tobillo (referida)'], ['Gemelo / pantorrilla', 'R', '2024-05', 'Lesión de gemelo (referida)'], ['Cuádriceps', 'R', '2024-06', 'Lesión de cuádriceps (referida)'], ['Glúteo', 'R', '2024-08', 'Lesión de glúteo (referida)']].forEach(([zone, side, date, dx]) => DB.put('injuries', { athleteId: a.id, zone, side, date, approx: true, diagnosis: dx, severity: 'Sin gravedad referida', surgery: 'no', recurrence: 'no', status: 'Clínicamente recuperada (referido)', notes: note }));
    DB.put('injuries', { athleteId: a.id, zone: 'Isquiotibiales', side: 'L', date: '2025-09', diagnosis: 'Desgarro de isquiotibiales (referido)', severity: 'Desconocida', surgery: 'no', recurrence: 'no', status: 'Clínicamente recuperada (referido)' });
    DB.put('injuries', { athleteId: a.id, zone: 'Rodilla', side: 'L', date: '2026-04', diagnosis: 'Condromalacia (referida)', severity: 'Desconocida', surgery: 'no', recurrence: 'no', status: 'Clínicamente recuperada (referido)' });
    const ev = DB.put('evaluations', { athleteId: a.id, date: todayStr(), label: 'Evaluación inicial', reason: 'Evaluación inicial', evaluator: '', objective: a.objective, questionnaires: ['LEFS', 'FAAM', 'KOOS', 'OSTRC'], battery: ['inbody', 'wblt', 'hiprom', 'kneerom', 'slr', 'quadiso', 'hamiso', 'plantiso', 'hipext', 'hipabd', 'imtp', 'encoder', 'ybal', 'sj', 'cmj', 'cmju', 'dj', 'hop', 'triplehop', 'crosshop', 'sprint30', 'gait', 'slcr', 'isofatigue'], status: 'open', demoBattery: true });
    Ctx.setAthlete(a.id); Ctx.setEvaluation(ev.id);
    toast('Caso demo cargado: antecedentes y batería propuesta (editable). Sin resultados de pruebas.', 'info', 5000);
    App.go('dashboard');
  }
};

/* ==========================================================
   ARRANQUE
   ========================================================== */
(async function boot() {
  await DB.init();
  App.shell();
  App.renderCtx();
  let v = ''; try { v = (location.hash || '').replace('#/', '').split('/')[0]; } catch (e) { }
  App.go(Views[v] && v !== 'runner' ? v : 'dashboard');
  window.addEventListener('beforeunload', ev => { if (DB.mode === 'memory' && DB.all('athletes').length) { ev.preventDefault(); ev.returnValue = ''; } });
  if (APP.sandboxed && DB.mode !== 'memory') { const bn = document.createElement('div'); bn.className = 'note neutral'; bn.style.cssText = 'margin:0;border-radius:0'; bn.innerHTML = '<b>Vista previa:</b> se está ejecutando dentro de otra página (p. ej., la vista previa de claude.ai). Los datos quedan en el almacenamiento de esa vista previa, no en el de su navegador habitual. Para el uso real en el laboratorio, descargue el archivo HTML y ábralo con doble clic.'; document.body.prepend(bn); }
  else if (DB.mode === 'memory') { const bn = document.createElement('div'); bn.className = 'note warn'; bn.style.cssText = 'margin:0;border-radius:0;position:sticky;top:0;z-index:40'; bn.innerHTML = '<b>Vista previa aislada:</b> este entorno (p. ej., la vista previa de claude.ai) bloquea el almacenamiento y la navegación del navegador. Puede explorar la aplicación, pero <b>los datos no se guardarán</b>. Para usarla en el laboratorio, <b>descargue el archivo HTML y ábralo con doble clic</b> en Chrome, Edge o Firefox.'; document.body.prepend(bn); }
  else   if (DB.mode !== 'indexeddb') toast(DB.mode === 'localstorage' ? 'IndexedDB no disponible: usando localStorage' : 'Sin almacenamiento persistente: exporte respaldos', 'warn', 6000);
})();
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

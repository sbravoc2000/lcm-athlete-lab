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

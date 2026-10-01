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

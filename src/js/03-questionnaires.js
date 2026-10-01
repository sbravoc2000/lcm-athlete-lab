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

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

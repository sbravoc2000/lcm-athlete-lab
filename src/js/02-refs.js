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

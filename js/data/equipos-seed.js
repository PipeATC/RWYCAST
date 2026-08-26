// Seed data — equipamiento e instalaciones por unidad (DEMOSTRACIÓN)
/* ============================================================
   SEED DEMO — Equipos e instalaciones por aeródromo
   ------------------------------------------------------------
   ⚠ DATOS DE DEMOSTRACIÓN. Sirven únicamente para mostrar el
   funcionamiento del módulo "Equipos e instalaciones" y del
   Cuadro de Mando mientras cada unidad aún no publica sus
   equipos reales. En cuanto una unidad publica su equipamiento
   en la BD (runcast/equipos/{icao}), esos datos REEMPLAZAN por
   completo a esta semilla para ese aeródromo (ver eqNormalizeAll
   en js/services/equipos.js). No borrar: es el respaldo/ejemplo.

   El equipamiento se basa en las radioayudas que cada aeródromo
   declara en js/data/seed.js (ILS/VOR según sus aproximaciones)
   y en el equipamiento típico de una unidad aeroportuaria. Las
   frecuencias, canales e identificadores son referenciales.

   Taxonomía (debe coincidir con EQ_TYPES en services/equipos.js):
     radar · comunicacion · radioayuda · instalacion
   Estados: OK · DEGR · MANT · U/S
   Cada ítem: {tipo,nombre,detalle,estado,obs}. El id, updatedAt y
   updatedBy los completa la normalización al cargar.
   ============================================================ */

// Marca de tiempo base para que las tarjetas muestren "Actualizado hace…".
// Se calcula una vez al cargar el módulo (datos de ejemplo, no en vivo).
const EQ_SEED_STAMP = Date.now() - 45 * 60 * 1000; // ~45 min atrás
const EQ_SEED_BY = 'Datos de demostración';

// Atajos para armar ítems con menos ruido: it(nombre,detalle,estado,obs)
function _eqIt(tipo){ return (nombre, detalle='', estado='OK', obs='') => ({tipo,nombre,detalle,estado,obs}); }
const _RAD = _eqIt('radar');
const _COM = _eqIt('comunicacion');
const _NAV = _eqIt('radioayuda');
const _INS = _eqIt('instalacion');

/* Equipamiento por OACI. Solo se listan las unidades sembradas; las demás
   quedan "SIN DATOS" hasta que su unidad las publique. */
const EQUIPOS_SEED_RAW = {
  // ---- CENTRO / CONTROL DE ÁREA + TORRE PRINCIPAL ----
  SCEL: {  // Santiago / A. Merino Benítez — la unidad más equipada
    items: [
      _RAD('PSR', 'Radar primario de aproximación', 'OK'),
      _RAD('MSSR Modo S', 'Radar secundario monopulso — Modo S', 'OK'),
      _RAD('SMR', 'Radar de movimiento de superficie', 'DEGR', 'Cobertura reducida en plataforma remota'),
      _RAD('Radar meteorológico', 'Enlace con estación DMC', 'OK'),
      _COM('Frecuencia TWR', '118.100 MHz', 'OK'),
      _COM('Frecuencia GND', '121.900 MHz', 'OK'),
      _COM('Frecuencia APP', '119.700 MHz', 'OK'),
      _COM('Frecuencia emergencia', '121.500 MHz', 'OK'),
      _COM('Enlace principal', 'VCS principal', 'OK'),
      _COM('Enlace de respaldo', 'VCS respaldo', 'OK'),
      _COM('Grabadora de voz', 'Sistema de grabación legal', 'OK'),
      _NAV('ILS RWY 17R', 'LOC/GP/DME CAT I', 'OK'),
      _NAV('ILS RWY 17L', 'LOC/GP/DME CAT I', 'OK'),
      _NAV('DME', 'Asociado a ILS 17L/17R', 'OK'),
      _NAV('VOR/DME', 'Referencia de aeródromo', 'OK'),
      _INS('Balizaje de pista', 'RWY 17L/35R y 17R/35L', 'OK'),
      _INS('Balizaje de rodaje', 'Calles de rodaje principales', 'OK'),
      _INS('PAPI', 'RWY 17L / 17R / 35L / 35R', 'OK'),
      _INS('Luces de aproximación', 'ALS RWY 17R', 'OK'),
      _INS('ATIS', 'ATIS de llegada/salida', 'OK'),
      _INS('Grupo electrógeno', 'Respaldo eléctrico', 'OK'),
      _INS('Energía comercial', 'Alimentación primaria', 'OK'),
      _INS('Estación meteorológica', 'Automática', 'OK'),
      _INS('Manga de viento', 'Iluminada', 'OK'),
    ],
    notams: [
      {numero:'A1287/26', texto:'SMR con cobertura degradada en plataforma remota. Verificar posición de aeronaves por procedimiento.', desde:'261200', hasta:'281200'},
    ],
  },

  // ---- NORTE ----
  SCAR: {  // Arica / Cacalluta — sin ILS (VOR/RNP)
    items: [
      _COM('Frecuencia TWR', '118.300 MHz', 'OK'),
      _COM('Frecuencia emergencia', '121.500 MHz', 'OK'),
      _COM('Grabadora de voz', 'Sistema de grabación legal', 'OK'),
      _NAV('VOR/DME', 'Referencia de aeródromo', 'OK'),
      _INS('Balizaje de pista', 'RWY 03/21', 'OK'),
      _INS('PAPI', 'RWY 03 / 21', 'OK'),
      _INS('Grupo electrógeno', 'Respaldo eléctrico', 'OK'),
      _INS('Estación meteorológica', 'Automática', 'OK'),
      _INS('Manga de viento', 'Iluminada', 'OK'),
    ],
    notams: [
      {numero:'A0912/26', texto:'Trabajos de mantenimiento en calle de rodaje C. Rodaje reducido a un tramo, coordinar con TWR.', desde:'260600', hasta:'262200'},
    ],
  },
  SCDA: {  // Iquique / Diego Aracena — ILS RWY 19
    items: [
      _COM('Frecuencia TWR', '118.100 MHz', 'OK'),
      _COM('Frecuencia emergencia', '121.500 MHz', 'OK'),
      _COM('Grabadora de voz', 'Sistema de grabación legal', 'OK'),
      _NAV('ILS RWY 19', 'LOC/GP/DME', 'OK'),
      _NAV('VOR/DME', 'Referencia de aeródromo', 'OK'),
      _INS('Balizaje de pista', 'RWY 01/19', 'OK'),
      _INS('PAPI', 'RWY 01 / 19', 'OK'),
      _INS('Luces de aproximación', 'ALS RWY 19', 'OK'),
      _INS('Grupo electrógeno', 'Respaldo eléctrico', 'OK'),
      _INS('Estación meteorológica', 'Automática', 'OK'),
      _INS('Manga de viento', 'Iluminada', 'OK'),
    ],
    notams: [
      {numero:'A1005/26', texto:'ILS RWY 19 sin novedad. PAPI RWY 01 con una unidad de luz inoperativa, senda de planeo utilizable.', desde:'251400', hasta:'PERM'},
    ],
  },
  SCCF: {  // Calama / El Loa — VOR/RNP
    items: [
      _COM('Frecuencia TWR', '118.500 MHz', 'OK'),
      _COM('Frecuencia emergencia', '121.500 MHz', 'OK'),
      _NAV('VOR/DME', 'Referencia de aeródromo', 'OK'),
      _INS('Balizaje de pista', 'RWY 10/28', 'OK'),
      _INS('PAPI', 'RWY 10 / 28', 'OK'),
      _INS('Grupo electrógeno', 'Respaldo eléctrico', 'OK'),
      _INS('Estación meteorológica', 'Automática', 'OK'),
      _INS('Manga de viento', 'Iluminada', 'OK'),
    ],
    notams: [],
  },
  SCFA: {  // Antofagasta / Andrés Sabella — ILS RWY 01
    items: [
      _RAD('MSSR Modo S', 'Radar secundario de aproximación', 'OK'),
      _COM('Frecuencia TWR', '118.300 MHz', 'OK'),
      _COM('Frecuencia APP', '119.100 MHz', 'OK'),
      _COM('Frecuencia emergencia', '121.500 MHz', 'OK'),
      _COM('Grabadora de voz', 'Sistema de grabación legal', 'OK'),
      _NAV('ILS RWY 01', 'LOC/GP/DME', 'OK'),
      _NAV('VOR/DME', 'Referencia de aeródromo', 'OK'),
      _INS('Balizaje de pista', 'RWY 01/19', 'OK'),
      _INS('PAPI', 'RWY 01 / 19', 'OK'),
      _INS('Luces de aproximación', 'ALS RWY 01', 'OK'),
      _INS('ATIS', 'ATIS de aeródromo', 'OK'),
      _INS('Grupo electrógeno', 'Respaldo eléctrico', 'OK'),
      _INS('Estación meteorológica', 'Automática', 'OK'),
      _INS('Manga de viento', 'Iluminada', 'OK'),
    ],
    notams: [
      {numero:'B0421/26', texto:'Actividad de aves en las cercanías del aeródromo, especialmente al amanecer y atardecer. Extremar precauciones.', desde:'260900', hasta:'302359'},
    ],
  },
  SCAT: {  // Caldera / Desierto de Atacama — ILS RWY 17
    items: [
      _COM('Frecuencia TWR', '118.700 MHz', 'OK'),
      _COM('Frecuencia emergencia', '121.500 MHz', 'OK'),
      _NAV('ILS RWY 17', 'LOC/GP/DME', 'MANT', 'GP en mantenimiento programado'),
      _NAV('VOR/DME', 'Referencia de aeródromo', 'OK'),
      _INS('Balizaje de pista', 'RWY 17/35', 'OK'),
      _INS('PAPI', 'RWY 17 / 35', 'OK'),
      _INS('Grupo electrógeno', 'Respaldo eléctrico', 'OK'),
      _INS('Estación meteorológica', 'Automática', 'OK'),
      _INS('Manga de viento', 'Iluminada', 'OK'),
    ],
    notams: [
      {numero:'C0345/26', texto:'GP del ILS RWY 17 fuera de servicio por mantenimiento. Disponible LOC/DME.', desde:'260800', hasta:'271800'},
    ],
  },
  SCSE: {  // La Serena / La Florida — VOR/RNP
    items: [
      _COM('Frecuencia TWR', '118.100 MHz', 'OK'),
      _COM('Frecuencia emergencia', '121.500 MHz', 'OK'),
      _NAV('VOR/DME', 'Referencia de aeródromo', 'OK'),
      _INS('Balizaje de pista', 'RWY 12/30', 'OK'),
      _INS('PAPI', 'RWY 12 / 30', 'OK'),
      _INS('Grupo electrógeno', 'Respaldo eléctrico', 'OK'),
      _INS('Estación meteorológica', 'Automática', 'OK'),
      _INS('Manga de viento', 'Iluminada', 'OK'),
    ],
    notams: [
      {numero:'C0233/26', texto:'Grúa operando a 1,2 NM del umbral RWY 12, altura máxima 45 M AGL, señalizada e iluminada.', desde:'240700', hasta:'271900'},
    ],
  },

  // ---- CENTRAL ----
  SCVM: {  // Viña del Mar / Torquemada — ILS RWY 05
    items: [
      _COM('Frecuencia TWR', '118.500 MHz', 'OK'),
      _COM('Frecuencia emergencia', '121.500 MHz', 'OK'),
      _NAV('ILS RWY 05', 'LOC/GP/DME', 'OK'),
      _NAV('VOR/DME', 'Referencia de aeródromo', 'OK'),
      _INS('Balizaje de pista', 'RWY 05/23', 'OK'),
      _INS('PAPI', 'RWY 05 / 23', 'OK'),
      _INS('Grupo electrógeno', 'Respaldo eléctrico', 'OK'),
      _INS('Manga de viento', 'Iluminada', 'OK'),
    ],
    notams: [],
  },

  // ---- SUR ----
  SCIE: {  // Concepción / Carriel Sur — ILS RWY 02
    items: [
      _RAD('MSSR Modo S', 'Radar secundario de aproximación', 'OK'),
      _COM('Frecuencia TWR', '118.300 MHz', 'OK'),
      _COM('Frecuencia APP', '119.500 MHz', 'OK'),
      _COM('Frecuencia emergencia', '121.500 MHz', 'OK'),
      _COM('Grabadora de voz', 'Sistema de grabación legal', 'OK'),
      _NAV('ILS RWY 02', 'LOC/GP/DME', 'OK'),
      _NAV('VOR/DME', 'Referencia de aeródromo', 'OK'),
      _INS('Balizaje de pista', 'RWY 02/20', 'OK'),
      _INS('PAPI', 'RWY 02 / 20', 'OK'),
      _INS('Luces de aproximación', 'ALS RWY 02', 'OK'),
      _INS('ATIS', 'ATIS de aeródromo', 'OK'),
      _INS('Grupo electrógeno', 'Respaldo eléctrico', 'OK'),
      _INS('Estación meteorológica', 'Automática', 'OK'),
      _INS('Manga de viento', 'Iluminada', 'OK'),
    ],
    notams: [
      {numero:'A0778/26', texto:'ATIS RWY 02 fuera de servicio. Información de aeródromo será entregada por TWR en frecuencia.', desde:'261100', hasta:'271100'},
    ],
  },
  SCQP: {  // Freire / La Araucanía — ILS RWY 01
    items: [
      _COM('Frecuencia TWR', '118.100 MHz', 'OK'),
      _COM('Frecuencia emergencia', '121.500 MHz', 'OK'),
      _NAV('ILS RWY 01', 'LOC/GP/DME', 'OK'),
      _NAV('VOR/DME', 'Referencia de aeródromo', 'OK'),
      _INS('Balizaje de pista', 'RWY 01/19', 'OK'),
      _INS('PAPI', 'RWY 01 / 19', 'OK'),
      _INS('Luces de aproximación', 'ALS RWY 01', 'OK'),
      _INS('ATIS', 'ATIS de aeródromo', 'OK'),
      _INS('Grupo electrógeno', 'Respaldo eléctrico', 'OK'),
      _INS('Estación meteorológica', 'Automática', 'OK'),
      _INS('Manga de viento', 'Iluminada', 'OK'),
    ],
    notams: [],
  },
  SCVD: {  // Valdivia / Pichoy — ILS RWY 35
    items: [
      _COM('Frecuencia TWR', '118.300 MHz', 'OK'),
      _COM('Frecuencia emergencia', '121.500 MHz', 'OK'),
      _NAV('ILS RWY 35', 'LOC/GP/DME', 'OK'),
      _NAV('VOR/DME', 'Referencia de aeródromo', 'OK'),
      _INS('Balizaje de pista', 'RWY 17/35', 'OK'),
      _INS('PAPI', 'RWY 17 / 35', 'OK'),
      _INS('Grupo electrógeno', 'Respaldo eléctrico', 'OK'),
      _INS('Manga de viento', 'Iluminada', 'OK'),
    ],
    notams: [],
  },
  SCJO: {  // Osorno / Cañal Bajo — VOR/RNP
    items: [
      _COM('Frecuencia TWR', '118.100 MHz', 'OK'),
      _COM('Frecuencia emergencia', '121.500 MHz', 'OK'),
      _NAV('VOR/DME', 'Referencia de aeródromo', 'DEGR', 'DME intermitente — en observación'),
      _INS('Balizaje de pista', 'RWY 15/33', 'OK'),
      _INS('PAPI', 'RWY 15 / 33', 'OK'),
      _INS('Grupo electrógeno', 'Respaldo eléctrico', 'OK'),
      _INS('Manga de viento', 'Iluminada', 'OK'),
    ],
    notams: [
      {numero:'A0640/26', texto:'DME asociado al VOR con funcionamiento intermitente. En observación técnica, verificar distancias con procedimiento alternativo.', desde:'251600', hasta:'281600'},
    ],
  },
  SCTE: {  // Puerto Montt / El Tepual — ILS RWY 35
    items: [
      _RAD('MSSR Modo S', 'Radar secundario de aproximación', 'OK'),
      _COM('Frecuencia TWR', '118.500 MHz', 'OK'),
      _COM('Frecuencia APP', '120.100 MHz', 'OK'),
      _COM('Frecuencia emergencia', '121.500 MHz', 'OK'),
      _COM('Grabadora de voz', 'Sistema de grabación legal', 'OK'),
      _NAV('ILS RWY 35', 'LOC/GP/DME', 'OK'),
      _NAV('VOR/DME', 'Referencia de aeródromo', 'OK'),
      _INS('Balizaje de pista', 'RWY 17/35', 'OK'),
      _INS('PAPI', 'RWY 17 / 35', 'OK'),
      _INS('Luces de aproximación', 'ALS RWY 35', 'OK'),
      _INS('ATIS', 'ATIS de aeródromo', 'OK'),
      _INS('Grupo electrógeno', 'Respaldo eléctrico', 'OK'),
      _INS('Estación meteorológica', 'Automática', 'OK'),
      _INS('Manga de viento', 'Iluminada', 'OK'),
    ],
    notams: [
      {numero:'A0511/26', texto:'RWY 17/35 con área de trabajo en plataforma. Puestos de estacionamiento 3 y 4 no disponibles.', desde:'260500', hasta:'282300'},
    ],
  },
  SCPQ: {  // Dalcahue / Mocopulli — ILS RWY 35
    items: [
      _COM('Frecuencia TWR', '118.300 MHz', 'OK'),
      _COM('Frecuencia emergencia', '121.500 MHz', 'OK'),
      _NAV('ILS RWY 35', 'LOC/GP/DME', 'OK'),
      _INS('Balizaje de pista', 'RWY 17/35', 'OK'),
      _INS('PAPI', 'RWY 17 / 35', 'OK'),
      _INS('Manga de viento', 'Iluminada', 'OK'),
    ],
    notams: [],
  },

  // ---- AUSTRAL ----
  SCBA: {  // Balmaceda — VOR/RNP
    items: [
      _COM('Frecuencia TWR', '118.100 MHz', 'OK'),
      _COM('Frecuencia emergencia', '121.500 MHz', 'OK'),
      _NAV('VOR/DME', 'Referencia de aeródromo', 'OK'),
      _INS('Balizaje de pista', 'RWY 09/27', 'OK'),
      _INS('PAPI', 'RWY 09 / 27', 'OK'),
      _INS('Grupo electrógeno', 'Respaldo eléctrico', 'OK'),
      _INS('Manga de viento', 'Iluminada', 'OK'),
    ],
    notams: [],
  },
  SCNT: {  // Natales / Teniente Julio Gallardo — VOR/RNP
    items: [
      _COM('Frecuencia TWR', '118.300 MHz', 'OK'),
      _COM('Frecuencia emergencia', '121.500 MHz', 'OK'),
      _NAV('VOR/DME', 'Referencia de aeródromo', 'OK'),
      _INS('Balizaje de pista', 'RWY 10/28', 'MANT', 'Recambio de luminarias programado'),
      _INS('Manga de viento', 'Iluminada', 'OK'),
    ],
    notams: [
      {numero:'A0388/26', texto:'Balizaje de pista RWY 10/28 en recambio de luminarias. Operaciones nocturnas sujetas a coordinación previa.', desde:'260800', hasta:'290800'},
    ],
  },
  SCCI: {  // Punta Arenas / Pdte. Carlos Ibáñez del Campo — ILS RWY 25
    items: [
      _RAD('MSSR Modo S', 'Radar secundario de aproximación', 'OK'),
      _COM('Frecuencia TWR', '118.100 MHz', 'OK'),
      _COM('Frecuencia APP', '119.300 MHz', 'OK'),
      _COM('Frecuencia emergencia', '121.500 MHz', 'OK'),
      _COM('Grabadora de voz', 'Sistema de grabación legal', 'OK'),
      _NAV('ILS RWY 25', 'LOC/GP/DME', 'OK'),
      _NAV('VOR/DME', 'Referencia de aeródromo', 'OK'),
      _INS('Balizaje de pista', 'RWY 07/25 · 01/19 · 12/30', 'OK'),
      _INS('PAPI', 'RWY 07 / 25', 'OK'),
      _INS('Luces de aproximación', 'ALS RWY 25', 'OK'),
      _INS('ATIS', 'ATIS de aeródromo', 'OK'),
      _INS('Grupo electrógeno', 'Respaldo eléctrico', 'OK'),
      _INS('Estación meteorológica', 'Automática', 'OK'),
      _INS('Faro aeronáutico', 'Faro de aeródromo', 'OK'),
      _INS('Manga de viento', 'Iluminada', 'OK'),
    ],
    notams: [
      {numero:'A0290/26', texto:'Viento fuerte en superficie previsto, ráfagas sobre 40 KT. Evaluar operaciones según limitaciones de aeronave.', desde:'261200', hasta:'270600'},
    ],
  },
};

/* Devuelve el documento semilla normalizado (con updatedAt/updatedBy) para un
   OACI, o null si no está sembrado. Lo consume eqNormalizeAll como respaldo. */
function equiposSeedDoc(icao){
  const raw = EQUIPOS_SEED_RAW[icao];
  if(!raw) return null;
  return {
    items: (raw.items||[]).map(x=>({...x, updatedAt:EQ_SEED_STAMP, updatedBy:EQ_SEED_BY})),
    notams: (raw.notams||[]).map(x=>({...x, updatedAt:EQ_SEED_STAMP})),
    updatedAt: EQ_SEED_STAMP,
    updatedBy: EQ_SEED_BY,
  };
}
function equiposSeedIcaos(){ return Object.keys(EQUIPOS_SEED_RAW); }

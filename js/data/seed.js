// Seed data — unidades ATC y aeropuertos de Chile
/* ============================================================
   SEED DATA — unidades ATC y aeropuertos de Chile
   ============================================================ */
const UNITS = [
  {code:'SCEL-TWR', name:'Santiago / A. Merino Benítez — Torre', region:'Central'},
  {code:'SCEL-APP', name:'Santiago — Aproximación', region:'Central'},
  {code:'SCDA-TWR', name:'Iquique / Diego Aracena — Torre', region:'Norte'},
  {code:'SCFA-TWR', name:'Antofagasta / Cerro Moreno — Torre', region:'Norte'},
  {code:'SCIE-TWR', name:'Concepción / Carriel Sur — Torre', region:'Sur'},
  {code:'SCTE-TWR', name:'Puerto Montt / El Tepual — Torre', region:'Sur'},
  {code:'SCCI-TWR', name:'Punta Arenas / C. Ibáñez — Torre', region:'Austral'},
  {code:'ACC-SANTIAGO', name:'Centro de Control de Área Santiago', region:'Nacional'},
];

/* Catálogo por aeródromo:
     rwys / apps  → numeración de pistas y nombres de aproximaciones disponibles
     eps          → puntos de entrada (IAF)
     stars        → [{name, eps:[...]}] cada STAR sirve a uno o más puntos de entrada
     charts       → {NOMBRE(MAYÚS): url} hipervínculo a la carta PDF (pista/aprox/STAR)
                    publicada en la IP; en el visor abre el documento en ventana emergente
   Operación (puede haber más de una en uso):
     rwyu / appu  → pistas y aproximaciones EN USO
     epuse        → {puntoEntrada: STAR en uso} — una STAR en uso por punto de entrada */
/* STAR e IAC (aprox.) cargadas desde la AIP CHILE — GEN 0.13/0.14 Lista de
   Verificación (AMDT NR 102, 14 MAY 2026). Punto de entrada (eps) y vínculo a
   carta (charts) quedan EN BLANCO para ingreso manual posterior. */
const AIRPORTS = [
  {icao:'SCEL', city:'Santiago', name:'A. Merino Benítez', owner:'SCEL-TWR',
   rwys:['17L','17R','35L','35R'],
   apps:['ILS Z RWY 17L','ILS Z RWY 17R','ILS Y o LOC Y RWY 17L','ILS T o LOC T RWY 17L','ILS Y o LOC Y RWY 17R','ILS X o LOC X RWY 17L','VOR RWY 17L','VOR RWY 17R','VOR RWY 35R','VOR RWY 35L','RNP Y RWY 17L','RNP Z RWY 17R','RNP Y RWY 17R','RNP RWY 35R','RNP RWY 35L','RNP X RWY 17L (AR)','RNP X RWY 17R (AR)','RNP T RWY 17R (AR)'],
   eps:[],
   stars:[{name:'ANDES 1',eps:[]},{name:'BAYOS 9 / UMKAL 6A',eps:[]},{name:'ASIMO 1B',eps:[]},{name:'EROLO 6E',eps:[]},{name:'EROLO 4C / KODVO 6',eps:[]},{name:'SIMOK 7B / ASIMO 7D / UMKAL 7C',eps:[]},{name:'EROLO 8A / EROLO 2D',eps:[]},{name:'EROLO 7F / VENTANAS 1D',eps:[]},{name:'SIMOK 6D / ASIMO 5C / UMKAL 7B',eps:[]},{name:'EROLO 4B / SABLA 5A',eps:[]},{name:'RNAV RWY 17R SUKSA 1A',eps:[]}],
   charts:{},
   rwyu:['17L','17R'], appu:[], epuse:{}},
  {icao:'SCDA', city:'Iquique', name:'Diego Aracena', owner:'SCDA-TWR',
   rwys:['06','24'],
   apps:['ILS o LOC RWY 19','VOR Z RWY 19','RNP Y RWY 19 (LNAV only)','RNP Z RWY 19 (AR)','RNP RWY 01 (AR)'],
   eps:[],
   stars:[{name:'PUGOT 5 / LOBAG 5A / IQUIQUE 1',eps:[]},{name:'GAXIR 5B / LOBAG 5B / LOKIR 5A',eps:[]},{name:'AKNUV 4 / VUREL 5B / GAXIR 4D / BRADA 3C',eps:[]},{name:'GAXIR 4C / LOBAG 4C / LOKIR 6B',eps:[]}],
   charts:{},
   rwyu:['06'], appu:[], epuse:{}},
  {icao:'SCFA', city:'Antofagasta', name:'Cerro Moreno', owner:'SCFA-TWR',
   rwys:['01','19'],
   apps:['ILS o LOC RWY 01','VOR Z RWY 19','VOR Y RWY 19','VOR X RWY 19','VOR Z RWY 01','VOR Y RWY 01','RNP X RWY 01','RNP Y RWY 01 (LNAV only)','RNP Y RWY 19 (LNAV only)','RNP Z RWY 01 (AR)','RNP Z RWY 19 (AR)'],
   eps:[],
   stars:[{name:'DOVRI 6C',eps:[]},{name:'BORO 9 / LOA 1',eps:[]},{name:'FAMEL 4 / CEMOR 3',eps:[]},{name:'REBOL 5 / ENLUS 5A / EKENO 5',eps:[]},{name:'DOVRI 4B',eps:[]},{name:'LONEK 2A / LONEK 2B',eps:[]}],
   charts:{},
   rwyu:['19'], appu:[], epuse:{}},
  {icao:'SCIE', city:'Concepción', name:'Carriel Sur', owner:'SCIE-TWR',
   rwys:['02','20'],
   apps:['ILS Z RWY 02','ILS Y RWY 02','ILS X o LOC X RWY 02','ILS W o LOC W RWY 02','ILS T o LOC T RWY 02','VOR Z RWY 20','VOR RWY 02','VOR Y RWY 20','RNP Y RWY 02','RNP RWY 20','RNP Z RWY 02 (AR)'],
   eps:[],
   stars:[{name:'SOSTA 5A / ANGOL 5C / PANEX 6A',eps:[]},{name:'ESIDO 4A / SOSTA 8D / ARUNI 8E / VUMIT 7C',eps:[]},{name:'ANGOL 5A / PANEX 5B',eps:[]},{name:'RNAV SOSTA 6C / ARUNI 6C / VUMIT 4B / ANGOL 4B / PANEX 6C',eps:[]},{name:'RNAV RWY 02 ESIDO 1B / SOSTA 1E / ARUNI 1D',eps:[]},{name:'RNAV RWY 02 ESIDO 1C / SOSTA 1B / ARUNI 1A',eps:[]}],
   charts:{},
   rwyu:['20'], appu:[], epuse:{}},
  {icao:'SCTE', city:'Puerto Montt', name:'El Tepual', owner:'SCTE-TWR',
   rwys:['07','17','25','35'],
   apps:['ILS Z o LOC Z RWY 35','ILS Y o LOC Y RWY 35','VOR Z RWY 17','VOR Z RWY 35','VOR Y RWY 35','VOR Y RWY 17','RNP Y RWY 35','RNP Y RWY 17','RNP Z RWY 35 (AR)','RNP Z RWY 17 (AR)'],
   eps:[],
   stars:[{name:'MIDOR 5',eps:[]},{name:'SARTO 2A / OSARA 2A / GENEK 2A / CAUKE 3A',eps:[]},{name:'SARTO 1B / OSARA 5B / GENEK 5B / GENEK 5C / CAUKE 5B',eps:[]}],
   charts:{},
   rwyu:['17'], appu:[], epuse:{}},
  {icao:'SCCI', city:'Punta Arenas', name:'Presidente C. Ibáñez', owner:'SCCI-TWR',
   rwys:['07','12','25','30'],
   apps:['ILS Z o LOC Z RWY 25','ILS Y o LOC Y RWY 25','ILS X o LOC X RWY 25','VOR Z RWY 07','VOR Z RWY 12','VOR Z RWY 25','VOR Z RWY 30','VOR Y RWY 07','VOR Y RWY 12','VOR RWY 19','VOR Y RWY 25','VOR Y RWY 30','RNP Y RWY 07','RNP RWY 12','RNP Y RWY 25','RNP Y RWY 30','RNP Z RWY 25 (AR)','RNP Z RWY 30 (AR)','RNP Z RWY 07 (AR)'],
   eps:[],
   stars:[{name:'RWY 25 NEDAX 3G / MUNER 3G',eps:[]},{name:'RNAV RWY 07/12 NEDAX 3F / MUNER 2F / EGOSA 2F',eps:[]},{name:'RNAV RWY 25/30 NEDAX 3E / MUNER 2E / EGOSA 2E',eps:[]}],
   charts:{},
   rwyu:['07'], appu:[], epuse:{}},
];

/* METAR en vivo: ya NO se usan datos sintéticos. El job de GitHub Actions
   (.github/workflows/metar.yml) baja los METAR de NOAA AWC cada 10 min y los
   escribe en Firebase RTDB bajo /runcast/metars. La app los lee en tiempo real
   (ver subscribeMetars). Sin datos reales, no se muestra METAR (nunca se inventa). */

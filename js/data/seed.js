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
const AIRPORTS = [
  {icao:'SCEL', city:'Santiago', name:'A. Merino Benítez', owner:'SCEL-TWR',
   rwys:['17L','17R','35L','35R'], apps:['ILS Z 17L','ILS Y 17R','RNP 35L','VOR 17R'],
   eps:['DOSO','IMLA','MORLA','TANGO'],
   stars:[{name:'DOSO1A',eps:['DOSO']},{name:'IMLA2B',eps:['IMLA','MORLA']},{name:'MORLA1C',eps:['MORLA']},{name:'TANGO3A',eps:['TANGO']}],
   rwyu:['17L','17R'], appu:['ILS Z 17L','ILS Y 17R'],
   epuse:{DOSO:'DOSO1A',IMLA:'IMLA2B',MORLA:'MORLA1C',TANGO:'TANGO3A'}},
  {icao:'SCDA', city:'Iquique', name:'Diego Aracena', owner:'SCDA-TWR',
   rwys:['06','24'], apps:['ILS 06','RNP 24','VOR 06'],
   eps:['UNGO','VITER'], stars:[{name:'UNGO1A',eps:['UNGO']},{name:'VITER2B',eps:['VITER']}],
   rwyu:['06'], appu:['ILS 06'], epuse:{UNGO:'UNGO1A',VITER:'VITER2B'}},
  {icao:'SCFA', city:'Antofagasta', name:'Cerro Moreno', owner:'SCFA-TWR',
   rwys:['01','19'], apps:['ILS 19','RNP 01','VOR 19'],
   eps:['MORNO','ASTOR'], stars:[{name:'MORNO1A',eps:['MORNO']},{name:'ASTOR2C',eps:['ASTOR']}],
   rwyu:['19'], appu:['ILS 19'], epuse:{MORNO:'MORNO1A',ASTOR:'ASTOR2C'}},
  {icao:'SCIE', city:'Concepción', name:'Carriel Sur', owner:'SCIE-TWR',
   rwys:['02','20'], apps:['ILS 20','RNP 02','VOR 20'],
   eps:['CARSU','BIOBI'], stars:[{name:'CARSU1A',eps:['CARSU']},{name:'BIOBI2B',eps:['BIOBI']}],
   rwyu:['20'], appu:['ILS 20'], epuse:{CARSU:'CARSU1A',BIOBI:'BIOBI2B'}},
  {icao:'SCTE', city:'Puerto Montt', name:'El Tepual', owner:'SCTE-TWR',
   rwys:['07','17','25','35'], apps:['ILS 17','RNP 35','VOR 25'],
   eps:['TEPUL','LLANQ'], stars:[{name:'TEPUL1A',eps:['TEPUL']},{name:'LLANQ2B',eps:['LLANQ']}],
   rwyu:['17'], appu:['ILS 17'], epuse:{TEPUL:'TEPUL1A',LLANQ:'LLANQ2B'}},
  {icao:'SCCI', city:'Punta Arenas', name:'Presidente C. Ibáñez', owner:'SCCI-TWR',
   rwys:['07','12','25','30'], apps:['ILS 07','RNP 25','VOR 12'],
   eps:['MAGAL','STREE'], stars:[{name:'MAGAL1A',eps:['MAGAL']},{name:'STREE2B',eps:['STREE']}],
   rwyu:['07'], appu:['ILS 07'], epuse:{MAGAL:'MAGAL1A',STREE:'STREE2B'}},
];

/* METAR en vivo: ya NO se usan datos sintéticos. El job de GitHub Actions
   (.github/workflows/metar.yml) baja los METAR de NOAA AWC cada 10 min y los
   escribe en Firebase RTDB bajo /runcast/metars. La app los lee en tiempo real
   (ver subscribeMetars). Sin datos reales, no se muestra METAR (nunca se inventa). */

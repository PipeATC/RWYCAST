// Equipos e instalaciones — subscribe / save + catálogo de tipos y estados
// Cada unidad aeroportuaria mantiene su equipamiento (radares, comunicaciones,
// radioayudas e instalaciones aeroportuarias) y sus NOTAM. La taxonomía de tipos
// está mapeada desde la planilla de Briefing (secciones IV Radares, V Frecuencias
// y VI Radioayudas y sistemas), más una cuarta categoría de instalaciones.
// Estructura en Firebase:
//   runcast/equipos/{icao}
//     { items:[{id,tipo,nombre,detalle,estado,obs,updatedAt,updatedBy}],
//       notams:[{id,numero,texto,desde,hasta,updatedAt}],
//       updatedAt, updatedBy }
let _eqRef=null;

// --- Taxonomía de equipamiento (mapeada desde el Briefing) ---
const EQ_TYPES=[
  {key:'radar',       label:'Radares',                    short:'RADAR',  icon:'radar',
   sug:['PSR','MSSR','Modo S','SMR','Radar meteorológico']},
  {key:'comunicacion',label:'Comunicaciones',             short:'COM',    icon:'radio',
   sug:['Frecuencia TWR','Frecuencia GND','Frecuencia APP','Frecuencia emergencia','Enlace principal','Enlace de respaldo','Grabadora de voz']},
  {key:'radioayuda',  label:'Radioayudas',                short:'NAV',    icon:'nav',
   sug:['ILS','LOC','GP','DME','VOR','VOR/DME','NDB','Marker']},
  {key:'instalacion', label:'Instalaciones aeroportuarias',short:'INST',  icon:'facility',
   sug:['Balizaje de pista','Balizaje de rodaje','PAPI','Luces de aproximación','Grupo electrógeno','Energía comercial','Faro aeronáutico','Estación meteorológica','ATIS','Manga de viento']},
];
function eqTypeMeta(key){ return EQ_TYPES.find(t=>t.key===key)||EQ_TYPES[EQ_TYPES.length-1]; }

// --- Estados operacionales del equipamiento ---
// OK operativo · DEGR degradado · MANT en mantenimiento · U/S fuera de servicio
const EQ_STATUS=['OK','DEGR','MANT','U/S'];
const EQ_STATUS_LABEL={OK:'Operativo',DEGR:'Degradado',MANT:'Mantenimiento','U/S':'Fuera de servicio'};
function eqCycleStatus(s){ const i=EQ_STATUS.indexOf(s); return EQ_STATUS[(i+1)%EQ_STATUS.length]; }
function eqStatusClass(s){
  if(s==='OK')   return 'st-ok';
  if(s==='DEGR') return 'st-obs';
  if(s==='MANT') return 'st-info';
  if(s==='U/S')  return 'st-us';
  return 'st-dash';
}
// Prioridad para resumir el "peor" estado de un conjunto (mayor = más crítico).
function eqStatusRank(s){ return s==='U/S'?3 : s==='DEGR'?2 : s==='MANT'?1 : 0; }
function eqWorstStatus(items){
  return (items||[]).reduce((w,it)=> eqStatusRank(it.estado)>eqStatusRank(w)?it.estado:w, 'OK');
}

function eqUid(){ return 'e'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }

function eqEmptyDoc(){ return {items:[],notams:[],updatedAt:0,updatedBy:''}; }
// Normaliza un documento crudo de la BD a la forma esperada por la UI.
function eqNormalize(raw){
  const d=eqEmptyDoc();
  if(!raw||typeof raw!=='object') return d;
  const items=Array.isArray(raw.items)?raw.items:[];
  const notams=Array.isArray(raw.notams)?raw.notams:[];
  return {
    items:items.map(x=>({
      id:x.id||eqUid(), tipo:EQ_TYPES.some(t=>t.key===x.tipo)?x.tipo:'instalacion',
      nombre:x.nombre||'', detalle:x.detalle||'',
      estado:EQ_STATUS.includes(x.estado)?x.estado:'OK', obs:x.obs||'',
      updatedAt:x.updatedAt||0, updatedBy:x.updatedBy||''})),
    notams:notams.map(x=>({
      id:x.id||eqUid(), numero:x.numero||'', texto:x.texto||'',
      desde:x.desde||'', hasta:x.hasta||'', updatedAt:x.updatedAt||0})),
    updatedAt:raw.updatedAt||0, updatedBy:raw.updatedBy||''};
}
// ¿Trae el documento crudo algún contenido real publicado por la unidad?
// (un nodo vacío en la BD no debe tapar la semilla de demostración)
function eqHasContent(raw){
  if(!raw||typeof raw!=='object') return false;
  const items=Array.isArray(raw.items)?raw.items:[];
  const notams=Array.isArray(raw.notams)?raw.notams:[];
  return items.length>0 || notams.length>0;
}
// Normaliza el nodo completo {icao:{…}} a {icao: docNormalizado}.
// Respaldo: para las unidades sin datos en la BD se usa la semilla de
// demostración (js/data/equipos-seed.js). Cuando la unidad publica su
// equipamiento real, ese documento reemplaza por completo a la semilla.
function eqNormalizeAll(raw){
  const out={};
  const hasSeed=typeof equiposSeedIcaos==='function';
  // 1) Semilla de demostración como base (respaldo/ejemplo).
  if(hasSeed) equiposSeedIcaos().forEach(icao=>{ const d=equiposSeedDoc(icao); if(d) out[icao]=eqNormalize(d); });
  // 2) Datos reales de la BD: sobrescriben la semilla del aeródromo que los tenga.
  if(raw&&typeof raw==='object') Object.keys(raw).forEach(icao=>{
    if(eqHasContent(raw[icao])) out[icao]=eqNormalize(raw[icao]);
    else if(!out[icao]) out[icao]=eqNormalize(raw[icao]);
  });
  return out;
}

/* Suscribe al nodo completo de equipos (todas las unidades). onData({icao:{items,notams,…}}).
   Lo usan tanto el módulo Equipos como el Cuadro de Mando. Devuelve {mode,stop}. */
function subscribeEquipos(onData){
  if(firebaseConfigured()){
    try{
      if(!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      _eqRef=firebase.database().ref(EQPATH);
      const cb=snap=>onData(eqNormalizeAll(snap.val()||{}));
      _eqRef.on('value',cb);
      return {mode:'firebase',stop:()=>{ try{_eqRef.off('value',cb);}catch(e){} }};
    }catch(e){ console.warn('[RWYCAST] Equipos Firebase no disponible:',e); _eqRef=null; }
  }
  // Fallback local (sandbox): un objeto {icao:{…}} en window.storage.
  let alive=true,lastVer=0;
  const read=async()=>{ try{ const r=await window.storage.get(EQKEY,true); return r&&r.value?JSON.parse(r.value):{}; }catch(e){ return {}; } };
  (async()=>{ const s=await read(); if(alive) onData(eqNormalizeAll(s)); })();
  const poll=setInterval(async()=>{
    if(!alive) return;
    const s=await read();
    if(s&&(s._ver||0)>lastVer){ lastVer=s._ver||0; onData(eqNormalizeAll(s)); }
  },2500);
  return {mode:'local',stop:()=>{ alive=false; clearInterval(poll); }};
}

/* Guarda el documento de equipos de una unidad aeroportuaria (runcast/equipos/{icao}). */
async function saveEquipos(icao,doc){
  const clean={items:doc.items||[],notams:doc.notams||[],updatedAt:doc.updatedAt||Date.now(),updatedBy:doc.updatedBy||''};
  if(_eqRef){
    try{ await _eqRef.child(icao).set(clean); return; }
    catch(e){ console.warn('[RWYCAST] saveEquipos falló:',e); }
  }
  let all={}; try{ const r=await window.storage.get(EQKEY,true); all=r&&r.value?JSON.parse(r.value):{}; }catch(e){}
  all[icao]=clean; all._ver=(all._ver||0)+1;
  try{ await window.storage.set(EQKEY,JSON.stringify(all),true); }catch(e){}
}

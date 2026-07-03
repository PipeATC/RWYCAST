// Briefing ACCS — subscribeBriefing / saveBriefing / bf* helpers
let _briefRef=null;

const BF_STATUS=['OK','U/S','OBS','—'];
const BF_RADAR_SITES=['Co Salado','Pajonales','Co Colorado','Yerbas Buenas','Pinares','Pto Montt','SMR SCEL'];
const BF_RADAR_TYPES=['PSR','MSSR','ModoS'];
const BF_FREQ_SITES=['Cerro Colorado','San Pablo','Extendido'];
const BF_METAR_ICAOS=['SCEL','SCDA','SCFA','SCIE','SCTE','SCCI'];
const BF_AFLU_TAGS=['NAC','INT'];

function bfCycleStatus(s){
  const i=BF_STATUS.indexOf(s||'—');
  return BF_STATUS[(i+1)%BF_STATUS.length];
}
function bfPillClass(s){
  if(s==='OK') return 'st-ok';
  if(s==='U/S') return 'st-us';
  if(s==='OBS') return 'st-obs';
  return 'st-dash';
}
function bfEmptyRadarGrid(){
  const g={PSR:{},MSSR:{},ModoS:{}};
  BF_RADAR_TYPES.forEach(t=>{ g[t]={}; BF_RADAR_SITES.forEach(s=>{ g[t][s]='—'; }); });
  return g;
}
function bfEmptyFreqGrid(){
  const g={};
  BF_FREQ_SITES.forEach(s=>{ g[s]={main:'OK',standby:'OK'}; });
  return g;
}
function defaultBriefDoc(turno,by){
  const d=new Date().toISOString().slice(0,10);
  return {
    date:d, turno:turno||'dia', updatedAt:Date.now(), updatedBy:by||'',
    meteo:{apreciacion:'',aireps:''},
    pistas:{rows:[{k:'17L/35R',status:'OK',txt:''},{k:'17R/35L',status:'OK',txt:''}],obs:'',modoOp:''},
    tma:{items:['']},
    radares:{grid:bfEmptyRadarGrid(),obs:''},
    frecuencias:{grid:bfEmptyFreqGrid(),otras:['']},
    radioayudas:{rows:[{k:'VOR/DME SCL',status:'OK',txt:''}]},
    afluencia:{items:[{tag:'NAC',body:''}]},
    pje:{rows:[{ubicacion:'',altfl:'',obs:''}]},
    frng:{rows:[{sector:'',altfl:'',tda:''}]},
    zonas:{rows:[{sector:'',altfl:'',tda:''}]},
    adCerrados:{rows:[{adrwy:'',fecha:'',obs:''}]},
    rpas:{items:['']},
    coordinaciones:{items:['']},
    infoOperativa:{items:['']},
    atcoTurno:{puestos:[{puesto:'ACC SUP',iniciales:''},{puesto:'ACC 1',iniciales:''},{puesto:'ACC 2',iniciales:''}]},
    observaciones:{items:['']},
    handoff:{outName:'',outAt:'',inName:'',inAt:''},
  };
}
function mergeBriefDoc(raw,turno){
  const d=defaultBriefDoc(turno,'');
  if(!raw||typeof raw!=='object') return d;
  const mg=(a,b)=>{ const o={...a}; if(b&&typeof b==='object') BF_RADAR_TYPES.forEach(t=>{ o[t]={...a[t],...(b[t]||{})}; }); return o; };
  const rg=raw.radares&&raw.radares.grid?{grid:mg(d.radares.grid,raw.radares.grid),obs:raw.radares.obs??d.radares.obs}:d.radares;
  const fg=raw.frecuencias&&raw.frecuencias.grid?{grid:{...d.frecuencias.grid,...raw.frecuencias.grid},otras:raw.frecuencias.otras?.length?raw.frecuencias.otras:d.frecuencias.otras}:d.frecuencias;
  return {
    ...d,...raw,turno:raw.turno||turno,
    meteo:{...d.meteo,...(raw.meteo||{})},
    pistas:{...d.pistas,...(raw.pistas||{}),rows:raw.pistas?.rows?.length?raw.pistas.rows:d.pistas.rows},
    tma:{items:raw.tma?.items?.length?raw.tma.items:d.tma.items},
    radares:rg,
    frecuencias:fg,
    radioayudas:{rows:raw.radioayudas?.rows?.length?raw.radioayudas.rows:d.radioayudas.rows},
    afluencia:{items:raw.afluencia?.items?.length?raw.afluencia.items:d.afluencia.items},
    pje:{rows:raw.pje?.rows?.length?raw.pje.rows:d.pje.rows},
    frng:{rows:raw.frng?.rows?.length?raw.frng.rows:d.frng.rows},
    zonas:{rows:raw.zonas?.rows?.length?raw.zonas.rows:d.zonas.rows},
    adCerrados:{rows:raw.adCerrados?.rows?.length?raw.adCerrados.rows:d.adCerrados.rows},
    rpas:{items:raw.rpas?.items?.length?raw.rpas.items:d.rpas.items},
    coordinaciones:{items:raw.coordinaciones?.items?.length?raw.coordinaciones.items:d.coordinaciones.items},
    infoOperativa:{items:raw.infoOperativa?.items?.length?raw.infoOperativa.items:d.infoOperativa.items},
    atcoTurno:{puestos:raw.atcoTurno?.puestos?.length?raw.atcoTurno.puestos:d.atcoTurno.puestos},
    observaciones:{items:raw.observaciones?.items?.length?raw.observaciones.items:d.observaciones.items},
    handoff:{...d.handoff,...(raw.handoff||{})},
  };
}
function normalizeBriefStore(s){
  return {dia:mergeBriefDoc(s&&s.dia,'dia'),noche:mergeBriefDoc(s&&s.noche,'noche')};
}
async function loadBriefingLocal(){
  try{ const r=await window.storage.get(BKEY,true); return r&&r.value?JSON.parse(r.value):{}; }catch(e){ return {}; }
}
async function saveBriefingLocal(all){
  try{ await window.storage.set(BKEY,JSON.stringify(all),true); }catch(e){}
}
function subscribeBriefing(onDoc){
  if(firebaseConfigured()){
    try{
      if(!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      _briefRef=firebase.database().ref(BPATH);
      let first=true;
      const cb=snap=>{
        const v=snap.val()||{};
        onDoc(normalizeBriefStore(v),first);
        first=false;
      };
      _briefRef.on('value',cb);
      return {mode:'firebase',stop:()=>{ try{_briefRef.off('value',cb);}catch(e){} }};
    }catch(e){ console.warn('[RWYCAST] Briefing Firebase no disponible:',e); _briefRef=null; }
  }
  let alive=true,lastVer=0;
  (async()=>{ const s=await loadBriefingLocal(); if(alive) onDoc(normalizeBriefStore(s),true); })();
  const poll=setInterval(async()=>{
    if(!alive) return;
    const s=await loadBriefingLocal();
    if(s&&(s._ver||0)>lastVer){ lastVer=s._ver||0; onDoc(normalizeBriefStore(s),false); }
  },2500);
  return {mode:'local',stop:()=>{ alive=false; clearInterval(poll); }};
}
async function saveBriefing(doc){
  const turno=doc.turno||'dia';
  if(_briefRef){
    try{ await _briefRef.child(turno).set(doc); return; }catch(e){ console.warn('[RWYCAST] saveBriefing falló:',e); }
  }
  const all=await loadBriefingLocal();
  all[turno]=doc;
  all._ver=(all._ver||0)+1;
  await saveBriefingLocal(all);
}

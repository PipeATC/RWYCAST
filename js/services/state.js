// Operational state — subscribeState / publishState / loadLocal / saveLocal
let _dbRef=null;

/* Suscribe a cambios remotos. onState(state, isInitial) se llama en cada actualización.
   Devuelve {mode:'firebase'|'local', stop:fn}. */
function subscribeState(onState){
  if(firebaseConfigured()){
    try{
      if(!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      _dbRef=firebase.database().ref(DBPATH);
      let first=true;
      const cb=snap=>{ const v=snap.val(); if(!v) return; onState(v, first); first=false; };
      _dbRef.on('value', cb);
      return {mode:'firebase', stop:()=>{ try{_dbRef.off('value',cb);}catch(e){} }};
    }catch(e){ console.warn('[RWYCAST] Firebase no disponible, modo local:', e); _dbRef=null; }
  }
  // Fallback local (sandbox). NO sincroniza entre dispositivos en GitHub Pages.
  let lastVer=0, alive=true;
  (async()=>{ const s=await loadLocal(); if(s&&alive) onState(s, true); })();
  const poll=setInterval(async()=>{
    if(!alive) return;
    const s=await loadLocal();
    if(s && (s._ver||0)>lastVer){ lastVer=s._ver||0; onState(s, false); }
  },2500);
  return {mode:'local', stop:()=>{ alive=false; clearInterval(poll); }};
}

/* Publica el estado completo a todas las unidades. */
async function publishState(s){
  if(_dbRef){ try{ await _dbRef.set(s); return; }catch(e){ console.warn('[RWYCAST] publish falló:', e); } }
  await saveLocal(s);
}
async function loadLocal(){
  try{ const r=await window.storage.get(SKEY,true); return r&&r.value?JSON.parse(r.value):null;}catch(e){return null;}
}
async function saveLocal(s){
  try{ await window.storage.set(SKEY, JSON.stringify(s), true);}catch(e){}
}

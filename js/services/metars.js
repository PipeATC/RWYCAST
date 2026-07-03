// METAR en vivo — subscribeMetars
/* Suscribe a los METAR en vivo (los escribe el job de GitHub Actions en /runcast/metars).
   onMetars({SCEL:{raw,cat,obsTime}, ...}). Devuelve función de limpieza. */
function subscribeMetars(onMetars){
  if(firebaseConfigured()){
    try{
      if(!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      const ref=firebase.database().ref('runcast/metars');
      const cb=snap=>onMetars(snap.val()||{});
      ref.on('value', cb);
      return ()=>{ try{ ref.off('value',cb); }catch(e){} };
    }catch(e){ console.warn('[RWYCAST] METAR no disponible:', e); }
  }
  return ()=>{};
}

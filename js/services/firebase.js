// Firebase connectivity — firebaseConfigured / ensureFirebase
function firebaseConfigured(){
  return !!(window.firebase && FIREBASE_CONFIG.databaseURL
            && FIREBASE_CONFIG.databaseURL.indexOf('TODO')===-1);
}
function ensureFirebase(){
  if(firebaseConfigured()){
    try{ if(!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG); return firebase.database(); }
    catch(e){ console.warn('[RWYCAST] Firebase no disponible (users):',e); }
  }
  return null;
}

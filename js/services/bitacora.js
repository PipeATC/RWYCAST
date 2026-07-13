// Bitácora de Posición (FORM ATC-6) — subscribe / save + helpers de tiempo UTC
// Estructura en Firebase:  runcast/bitacora/{dependencia}/{fecha}/{posición}
//   posición  = username del usuario de sector (clave válida garantizada)
//   valor     = { position, rows:[{id,entrada,salida,iniciales,controller,by}], updatedAt, updatedBy }
let _bitRef=null;

// Fecha operacional en UTC (00:00 → 23:59Z). Devuelve 'YYYY-MM-DD'.
function bitDateUTC(d){
  d=d||new Date();
  const p=n=>String(n).padStart(2,'0');
  return d.getUTCFullYear()+'-'+p(d.getUTCMonth()+1)+'-'+p(d.getUTCDate());
}
// Hora UTC actual como 'HHMM' (lo que se estampa en ENTRADA al presionar "Ingresar").
function bitNowHHMM(){
  const d=new Date(), p=n=>String(n).padStart(2,'0');
  return p(d.getUTCHours())+p(d.getUTCMinutes());
}
// Normaliza lo tecleado en una casilla de hora a 'HHMM' (o '' si queda vacío/ inválido).
function bitCleanHHMM(v){
  const digits=(v||'').replace(/\D/g,'').slice(0,4);
  return digits;
}
// Formato de despliegue de una hora HHMM → 'HH:MM' (para el reporte). '' si vacío.
function bitFmtHHMM(v){
  const d=bitCleanHHMM(v);
  if(d.length===4) return d.slice(0,2)+':'+d.slice(2);
  return d;
}
// Fecha larga para la cabecera del reporte: '12 JUL 2026'.
function bitLongDate(iso){
  const M=['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||'');
  if(!m) return iso||'';
  return String(+m[3])+' '+M[+m[2]-1]+' '+m[1];
}

/* Suscribe al nodo del día para una dependencia. onData(nodo) con
   nodo = { [posición]: {position, rows, …} }. Devuelve {mode, stop}. */
function subscribeBitacora(depCode,date,onData){
  if(firebaseConfigured()){
    try{
      if(!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      _bitRef=firebase.database().ref(BITPATH);
      const ref=_bitRef.child(depCode).child(date);
      const cb=snap=>onData(snap.val()||{});
      ref.on('value',cb);
      return {mode:'firebase',stop:()=>{ try{ref.off('value',cb);}catch(e){} }};
    }catch(e){ console.warn('[RWYCAST] Bitácora Firebase no disponible:',e); _bitRef=null; }
  }
  // Fallback local (sandbox): un solo objeto {dep:{fecha:{pos:{…}}}}.
  let alive=true;
  const read=()=>{ try{return JSON.parse(localStorage.getItem(BITKEY)||'{}');}catch(e){return {};} };
  const emit=()=>{ const all=read(); onData(((all[depCode]||{})[date])||{}); };
  emit();
  const poll=setInterval(()=>{ if(alive) emit(); },2500);
  return {mode:'local',stop:()=>{ alive=false; clearInterval(poll); }};
}

/* Guarda (o elimina si queda vacío) la bitácora de una posición. */
async function saveBitacoraPos(depCode,date,posKey,data){
  if(_bitRef){
    try{ await _bitRef.child(depCode).child(date).child(posKey).set(data); return; }
    catch(e){ console.warn('[RWYCAST] saveBitacoraPos falló:',e); }
  }
  let all={}; try{ all=JSON.parse(localStorage.getItem(BITKEY)||'{}'); }catch(e){}
  all[depCode]=all[depCode]||{}; all[depCode][date]=all[depCode][date]||{};
  all[depCode][date][posKey]=data;
  try{ localStorage.setItem(BITKEY,JSON.stringify(all)); }catch(e){}
}

// Rotación de estaciones de trabajo — subscribe / save + helpers
// Cuadro por dependencia + fecha + turno (día/noche). El usuario de unidad reparte a
// los ATC (usuarios general) entre las estaciones (usuarios sector) a lo largo de las
// vueltas (bandas horarias en hora LOCAL). Estructura en Firebase:
//   runcast/rotacion/{dependencia}/{fecha}/{turno}
//     turno   = 'dia' | 'noche'
//     valor   = { turno, date, supervisores, cicAdm, atcoCount, roster:[iniciales],
//                 columns:[{id,kind,label}], bands:[{id,start,end}],
//                 cells:{bandId:{colId:iniciales}}, merges:{bandId:[[colId,…]]},
//                 updatedAt, updatedBy }
let _rotRef=null;

// Plantillas de bandas por defecto (hora local). Editables por el supervisor.
const ROT_DAY_BANDS=[
  ['08:45','09:30'],['09:30','10:15'],['10:15','11:15'],['11:15','12:00'],
  ['12:00','12:45'],['12:45','13:30'],['13:30','14:15'],['14:15','15:15'],
  ['15:15','16:15'],['16:15','17:15'],['17:15','18:15'],['18:15','19:15'],['19:15','20:25'],
];
const ROT_NIGHT_BANDS=[
  ['20:20','21:30'],['21:30','22:30'],['22:30','23:30'],['23:30','00:30'],
  ['00:30','03:30'],['03:30','06:30'],['06:30','08:00'],['08:00','08:25'],['08:25','08:40'],
];

function rotUid(){ return 'k'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function rotToday(){ const d=new Date(),p=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); }
function rotNowMin(){ const d=new Date(); return d.getHours()*60+d.getMinutes(); }
function rotHM(s){ const m=/(\d{1,2}):(\d{2})/.exec(s||''); return m?(+m[1]*60+ +m[2]):null; }
// Filtra lo tecleado en una casilla de hora: deja solo dígitos y ':' (máx 5), SIN
// reformatear, para no mover el cursor ni impedir sobrescribir. Se normaliza en blur.
function rotTypeHM(v){ return (v||'').replace(/[^0-9:]/g,'').slice(0,5); }
// Normaliza a 'HH:MM' al salir del campo. '930'→09:30 · '2025'→20:25 · '8'→08:00.
function rotNormHM(v){
  const raw=(v||'').replace(/\D/g,''); if(!raw) return '';
  const d=raw.slice(0,4); let h,m;
  if(d.length<=2){ h=+d; m=0; } else { m=+d.slice(-2); h=+d.slice(0,d.length-2); }
  if(h>23) h=23; if(m>59) m=59;
  return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
}
function rotBandMin(b){ let a=rotHM(b&&b.start), c=rotHM(b&&b.end);
  if(a==null||c==null) return 0; let d=c-a; if(d<0) d+=1440; return d; }
function rotFmtDur(min){ return Math.floor(min/60)+':'+String(min%60).padStart(2,'0'); }
function rotBandIsNow(b,nowMin){ const a=rotHM(b&&b.start),c=rotHM(b&&b.end);
  if(a==null||c==null) return false;
  return c<a ? (nowMin>=a||nowMin<c) : (nowMin>=a&&nowMin<c); }

// Fecha larga para la cabecera: 'viernes, 05 de junio de 2026'.
function rotLongDate(iso){
  const D=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const M=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||''); if(!m) return iso||'';
  const dt=new Date(+m[1],+m[2]-1,+m[3]);
  return D[dt.getDay()]+', '+String(+m[3]).padStart(2,'0')+' de '+M[+m[2]-1]+' de '+m[1];
}

// Estaciones base = usuarios de sector de la dependencia (posición como etiqueta).
// La dependencia ES el usuario de unidad (username); sus sectores son los que lo tienen
// como parent (userDep(sector)===dep).
function rotStationsFor(dep,users){
  return Object.values(users||{})
    .filter(u=>u.role==='sector' && userDep(u)===dep)
    .sort((a,b)=>((a.posicion||a.username)).localeCompare(b.posicion||b.username))
    .map(u=>({id:u.username, kind:'station', label:u.posicion||u.username}));
}
// Roster por defecto = iniciales de los usuarios general de la dependencia.
function rotRosterFor(dep,users){
  return Object.values(users||{})
    .filter(u=>u.role==='general' && u.iniciales && userDep(u)===dep)
    .map(u=>u.iniciales).sort();
}
// Dependencias disponibles para el usuario. La dependencia ES el usuario de unidad
// (su username); el admin ve todos los usuarios de unidad existentes.
function rotDepsFor(user,users){
  if(user.role==='admin'){
    return Object.values(users||{})
      .filter(u=>u.role==='unit')
      .map(u=>u.username)
      .sort();
  }
  const d=userDep(user);
  return d?[d]:[];
}

function rotDefaultDoc(turno,dep,users){
  const bands=(turno==='noche'?ROT_NIGHT_BANDS:ROT_DAY_BANDS).map(([start,end])=>({id:rotUid(),start,end}));
  const roster=rotRosterFor(dep,users);
  return {
    turno, date:rotToday(), supervisores:'', cicAdm:'',
    atcoCount:roster.length, roster,
    columns:rotStationsFor(dep,users), bands, cells:{}, merges:{},
    updatedAt:0, updatedBy:'',
  };
}
function rotArr(x){ return Array.isArray(x)?x:(x&&typeof x==='object'?Object.values(x):[]); }
function mergeRotDoc(raw,turno,dep,users){
  const d=rotDefaultDoc(turno,dep,users);
  if(!raw||typeof raw!=='object') return d;
  return {
    ...d, ...raw, turno:raw.turno||turno,
    roster: rotArr(raw.roster).length?rotArr(raw.roster):d.roster,
    columns: rotArr(raw.columns).length?rotArr(raw.columns):d.columns,
    bands: rotArr(raw.bands).length?rotArr(raw.bands):d.bands,
    cells: raw.cells||{}, merges: raw.merges||{},
  };
}

// --- fusión de columnas por banda (refundición de sectores) ---
// Devuelve los grupos de columnas (en orden) de una banda, cubriendo todas las columnas.
function rotColGroups(columns,mergeList){
  const inG={}; (mergeList||[]).forEach(g=>rotArr(g).forEach(cid=>inG[cid]=rotArr(g)));
  const out=[],seen=new Set();
  columns.forEach(c=>{ if(seen.has(c.id))return;
    const g=inG[c.id];
    if(g){ g.forEach(x=>seen.add(x)); out.push(g); } else { seen.add(c.id); out.push([c.id]); } });
  return out;
}
function rotMergeNext(columns,merges,bandId,colId){
  const groups=rotColGroups(columns,merges[bandId]);
  const gi=groups.findIndex(g=>g.includes(colId));
  if(gi<0||gi>=groups.length-1) return merges;
  const merged=[...groups[gi],...groups[gi+1]];
  const list=groups.map((g,i)=> i===gi?merged:(i===gi+1?null:g)).filter(g=>g&&g.length>=2);
  const next={...merges}; if(list.length) next[bandId]=list; else delete next[bandId];
  return next;
}
function rotSplit(columns,merges,bandId,colId){
  const list=rotArr(merges[bandId]).filter(g=>!rotArr(g).includes(colId));
  const next={...merges}; if(list.length) next[bandId]=list; else delete next[bandId];
  return next;
}

// Horas trabajadas por ATC: suma la duración de las bandas en que trabaja en una
// estación (cuenta una vez por banda aunque refunda sectores). Respeta la fusión:
// solo cuenta el ATC líder de cada grupo, y solo si el grupo cubre alguna columna
// que NO sea relevo/descanso.
function rotHoursWorked(doc){
  const out={}, cols=rotArr(doc.columns);
  (doc.bands||[]).forEach(b=>{
    const min=rotBandMin(b), row=(doc.cells||{})[b.id]||{}, worked=new Set();
    rotColGroups(cols,(doc.merges||{})[b.id]).forEach(g=>{
      const ids=rotArr(g), lead=ids[0], v=row[lead];
      const anyWork=ids.some(id=>{ const c=cols.find(x=>x.id===id); return c&&c.kind!=='relevo'; });
      if(anyWork && v) worked.add(v);
    });
    worked.forEach(ini=>{ out[ini]=(out[ini]||0)+min; });
  });
  return out;
}

/* Suscribe al nodo del día (ambos turnos). onData({dia,noche}). Devuelve {mode,stop}. */
function subscribeRotacion(dep,date,onData){
  if(firebaseConfigured()){
    try{
      if(!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      _rotRef=firebase.database().ref(ROTPATH);
      const ref=_rotRef.child(dep).child(date);
      const cb=snap=>onData(snap.val()||{});
      ref.on('value',cb);
      return {mode:'firebase',stop:()=>{ try{ref.off('value',cb);}catch(e){} }};
    }catch(e){ console.warn('[RWYCAST] Rotación Firebase no disponible:',e); _rotRef=null; }
  }
  let alive=true;
  const read=()=>{ try{return JSON.parse(localStorage.getItem(ROTKEY)||'{}');}catch(e){return {};} };
  const emit=()=>{ const all=read(); onData(((all[dep]||{})[date])||{}); };
  emit();
  const poll=setInterval(()=>{ if(alive) emit(); },2500);
  return {mode:'local',stop:()=>{ alive=false; clearInterval(poll); }};
}
async function saveRotacion(dep,date,turno,doc){
  if(_rotRef){
    try{ await _rotRef.child(dep).child(date).child(turno).set(doc); return; }
    catch(e){ console.warn('[RWYCAST] saveRotacion falló:',e); }
  }
  let all={}; try{ all=JSON.parse(localStorage.getItem(ROTKEY)||'{}'); }catch(e){}
  all[dep]=all[dep]||{}; all[dep][date]=all[dep][date]||{};
  all[dep][date][turno]=doc;
  try{ localStorage.setItem(ROTKEY,JSON.stringify(all)); }catch(e){}
}

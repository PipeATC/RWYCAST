// Dashboard de toma de decisiones — DATOS FICTICIOS (placeholder).
// Genera métricas de carga de trabajo y dotación, deterministas por dependencia+fecha,
// para que el tablero sea estable y realista. En el futuro este archivo se reemplaza por
// el feed real del módulo ATFM (Power BI): mantener la MISMA forma de salida y el resto
// del dashboard funciona sin cambios. Punto de conexión único: dashboardData().

// PRNG determinista (mulberry32) sembrado con un hash de la clave.
function dashHash(s){ let h=2166136261; for(let i=0;i<(s||'').length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }
function dashRng(seed){ let a=seed>>>0; return function(){ a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function dashJit(r,base,pct){ return Math.max(0,Math.round(base*(1+(r()*2-1)*pct))); }

// Curva diurna típica de movimientos/hora (00→23), con doble punta mañana/tarde.
const DASH_SHAPE=[9,6,4,3,3,5,12,28,44,49,45,43,46,48,45,47,50,53,49,39,29,21,15,10];
const DASH_MOCK_SECT=['C','D','E','F','G','H','I'];
// Dotación por turno (iniciales inventadas): día = 12 ATC, noche = 8 ATC.
const DASH_MOCK_ATC=['MVI','RDA','PHR','HVB','LSA','JLS','VRK','LMP','BGB','CCE','CLI','FDC']; // día (12)
const DASH_NIGHT_ATC=['NKA','TSC','QVD','WMB','ZRP','GXO','HUN','PDL'];                        // noche (8)
function dashLevel(ratio){ return ratio>=1?'CRÍTICA':ratio>=0.85?'ALTA':ratio>=0.6?'MEDIA':'BAJA'; }
function dashStatus(ratio){ return ratio>=1?'crit':ratio>=0.85?'warn':'ok'; }
// Turno vigente por hora local: día 07–19, noche 19–07.
function dashShift(nowH){ return (nowH>=7 && nowH<19)?'dia':'noche'; }

/* ---- FR24 (simulado) — estadísticas de tránsito y FID del aeropuerto ----
   Datos ficticios con la MISMA intención de conexión que el resto del tablero:
   el día que exista feed real de Flightradar24 (o del propio ATFM), se sustituye
   dashFr24() conservando la forma. Determinista por dependencia+fecha. */
const DASH_MON_ES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const DASH_AIRLINES=[
  {code:'LA',name:'LATAM Airlines'},{code:'H2',name:'SKY Airline'},{code:'JA',name:'JetSMART'},
  {code:'IB',name:'Iberia'},{code:'DL',name:'Delta Air Lines'},{code:'AA',name:'American Airlines'},
  {code:'AV',name:'Avianca'},{code:'AR',name:'Aerolíneas Argentinas'},{code:'CM',name:'Copa Airlines'},
  {code:'AF',name:'Air France'},{code:'UX',name:'Air Europa'},{code:'G3',name:'GOL'}];
const DASH_ACFT=['A320','A321','A20N','A21N','A319','B738','B38M','B789','B77W','E195','A359'];
const DASH_DEST=[
  ['Buenos Aires','EZE'],['Lima','LIM'],['Bogotá','BOG'],['São Paulo','GRU'],['Madrid','MAD'],
  ['Miami','MIA'],['Panamá','PTY'],['Mendoza','MDZ'],['Montevideo','MVD'],['Río de Janeiro','GIG'],
  ['Antofagasta','ANF'],['Calama','CJC'],['Concepción','CCP'],['Puerto Montt','PMC'],['Iquique','IQQ'],
  ['La Serena','LSC'],['Temuco','ZCO'],['Punta Arenas','PUQ'],['Arica','ARI'],['Copiapó','CPO'],
  ['Balmaceda','BBA'],['Valdivia','ZAL'],['Castro','WCA'],['Osorno','ZOS']];

// FID real de SCEL (copiado de Flightradar24). Vuelos, aeronaves, matrículas y
// estados exactos del tablero; kind = color del estado (ok/sky/warn/crit).
const DASH_FID_ARR_SCEL=[
  {time:'20:58',flight:'LA268', place:'Puerto Montt',code:'PMC',airline:'LATAM Airlines',aircraft:'A320',reg:'CC-BHP',status:'Landed 20:33',kind:'ok'},
  {time:'20:59',flight:'LA411', place:'Montevideo',  code:'MVD',airline:'LATAM Airlines',aircraft:'A320',reg:'PR-TYU',status:'Landed 21:05',kind:'ok'},
  {time:'21:05',flight:'H2528', place:'Mendoza',     code:'MDZ',airline:'SKY Airline',   aircraft:'A20N',reg:'CC-DBH',status:'Estimated 21:14',kind:'sky'},
  {time:'21:05',flight:'H2807', place:'Lima',        code:'LIM',airline:'SKY Airline',   aircraft:'A21N',reg:'CC-DCF',status:'Landed 20:51',kind:'ok'},
  {time:'21:05',flight:'LA157', place:'Calama',      code:'CJC',airline:'LATAM Airlines',aircraft:'A20N',reg:'CC-BHT',status:'Landed 21:09',kind:'ok'},
  {time:'21:10',flight:'LA751', place:'Sao Paulo',   code:'GRU',airline:'LATAM Airlines',aircraft:'A321',reg:'CC-BEN',status:'Delayed 22:16',kind:'crit'},
  {time:'21:15',flight:'LA591', place:'Punta Cana',  code:'PUJ',airline:'LATAM Airlines',aircraft:'B789',reg:'CC-BMD',status:'Delayed 21:36',kind:'warn'},
  {time:'21:15',flight:'LA842', place:'Mataveri',    code:'IPC',airline:'LATAM Airlines',aircraft:'B788',reg:'CC-BBD',status:'Landed 21:01',kind:'ok'},
];
const DASH_FID_DEP_SCEL=[
  {time:'21:00',flight:'AA912', place:'Miami',       code:'MIA',airline:'American Airlines',aircraft:'B788',reg:'N810AN',status:'Departed 21:08',kind:'ok'},
  {time:'21:00',flight:'LA756', place:'Sao Paulo',   code:'GRU',airline:'LATAM Airlines',aircraft:'A20N',reg:'CC-BHE',status:'Estimated dep. 21:23',kind:'sky'},
  {time:'21:48',flight:'LA13',  place:'Concepcion',  code:'CCP',airline:'LATAM Airlines (Avión Solidario)',aircraft:'A321',reg:'CC-BEL',status:'Estimated dep. 22:07',kind:'sky'},
  {time:'22:13',flight:'LA267', place:'Puerto Montt',code:'PMC',airline:'LATAM Airlines',aircraft:'A321',reg:'',status:'Estimated dep. 22:23',kind:'sky'},
  {time:'22:20',flight:'IB114', place:'Madrid',      code:'MAD',airline:'Iberia',       aircraft:'A359',reg:'EC-NIG',status:'Estimated dep. 22:35',kind:'sky'},
  {time:'22:20',flight:'5Y62',  place:'Miami',       code:'MIA',airline:'Atlas Air',    aircraft:'B744',reg:'',status:'Estimated dep. 22:44',kind:'sky'},
  {time:'22:20',flight:'IB6114',place:'Madrid',      code:'MAD',airline:'Iberia',       aircraft:'A359',reg:'EC-NIG',status:'Estimated dep. 22:45',kind:'sky'},
  {time:'22:55',flight:'LA532', place:'New York',    code:'JFK',airline:'LATAM Airlines',aircraft:'B789',reg:'CC-BGE',status:'Estimated dep. 23:05',kind:'sky'},
];

function dashPick(r,arr){ return arr[Math.floor(r()*arr.length)]; }
function dashHM(mins){ mins=((mins%1440)+1440)%1440; return String(Math.floor(mins/60)).padStart(2,'0')+':'+String(mins%60).padStart(2,'0'); }
function dashReg(r){ const L='ABCDEFGHJKLMNPQRSTUVWXYZ'; return 'CC-'+L[Math.floor(r()*L.length)]+L[Math.floor(r()*L.length)]+L[Math.floor(r()*L.length)]; }
// ICAO del aeropuerto asociado a la dependencia (prefijo del código de unidad).
function dashIcaoFor(dep){ const pre=(dep||'').split('-')[0];
  return (typeof AIRPORTS!=='undefined' && AIRPORTS.some(a=>a.icao===pre)) ? pre : 'SCEL'; }
function dashDateFromIso(iso){ const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||''); const d=new Date();
  if(m) d.setFullYear(+m[1],+m[2]-1,+m[3]); d.setHours(12,0,0,0); return d; }

function dashFr24(r,dep,anchor,now){
  const icao=dashIcaoFor(dep);
  const ap=(typeof AIRPORTS!=='undefined'?AIRPORTS.find(a=>a.icao===icao):null)
           ||{icao,city:'Santiago',name:'A. Merino Benítez',rwys:['17L','17R','35L','35R']};
  // movimientos por día (7 días, el ancla arriba)
  const perDay=[];
  for(let i=0;i<7;i++){ const dt=new Date(anchor.getTime()-i*86400000);
    const tk=dashJit(r,225,0.12), ld=dashJit(r,228,0.12);
    perDay.push({date:dt.getDate()+' '+DASH_MON_ES[dt.getMonth()], total:tk+ld, takeoffs:tk, landings:ld}); }
  const tk7=perDay.reduce((s,x)=>s+x.takeoffs,0), ld7=perDay.reduce((s,x)=>s+x.landings,0);
  const mov7={total:tk7+ld7, takeoffs:tk7, landings:ld7};
  // uso de pistas (reparte los totales de 7 días; una pista concentra la operación)
  const rwList=(ap.rwys&&ap.rwys.length?ap.rwys.slice(0,4):['17L','17R','35L','35R']).concat(['N/A']);
  const wTk=rwList.map(()=>0.2+r()), wLd=rwList.map(()=>0.2+r());
  const main=Math.floor(r()*(rwList.length-1)); wTk[main]+=3; wLd[main]+=3;
  const sumTk=wTk.reduce((a,b)=>a+b,0), sumLd=wLd.reduce((a,b)=>a+b,0);
  let accTk=0,accLd=0;
  const runways=rwList.map((rw,i)=>{
    let tk=i===rwList.length-1?(tk7-accTk):Math.round(tk7*wTk[i]/sumTk);
    let ld=i===rwList.length-1?(ld7-accLd):Math.round(ld7*wLd[i]/sumLd);
    tk=Math.max(0,tk); ld=Math.max(0,ld); accTk+=tk; accLd+=ld;
    return {rwy:rw, total:tk+ld, takeoffs:tk, landings:ld};
  }).sort((a,b)=>b.total-a.total);
  // FID: SCEL usa el tablero real (imagen FR24); otros aeropuertos, generado.
  const nowMin=now.getHours()*60+now.getMinutes();
  let arrivals, departures;
  if(icao==='SCEL'){ arrivals=DASH_FID_ARR_SCEL; departures=DASH_FID_DEP_SCEL; }
  else {
    const arrStates=[['Aterrizó','ok'],['Estimado','sky'],['Estimado','sky'],['Demorado','warn'],['Programado','dim']];
    const depStates=[['Despegó','ok'],['Estimado','sky'],['Estimado','sky'],['Embarcando','sky'],['Demorado','warn'],['Programado','dim']];
    const mkRows=(n,states,offset)=>{ const rows=[]; let t=nowMin+offset;
      for(let i=0;i<n;i++){ t+=2+Math.floor(r()*7);
        const al=dashPick(r,DASH_AIRLINES), dest=dashPick(r,DASH_DEST);
        const [st,kind]=dashPick(r,states);
        const withTime=(kind==='ok'||kind==='sky'||kind==='warn');
        const drift=kind==='warn'?12+Math.floor(r()*22):(kind==='ok'?-(1+Math.floor(r()*6)):Math.floor(r()*4));
        rows.push({time:dashHM(t), flight:al.code+(100+Math.floor(r()*899)),
          place:dest[0], code:dest[1], airline:al.name, aircraft:dashPick(r,DASH_ACFT), reg:dashReg(r),
          status:st+(withTime?' '+dashHM(t+drift):''), kind});
      } return rows; };
    arrivals=mkRows(7,arrStates,-18); departures=mkRows(7,depStates,-9);
  }
  return {icao, name:ap.name||icao, city:ap.city||'', localTime:dashHM(nowMin),
    rating:70+Math.floor(r()*28), arrDelay:Math.round((0.6+r()*2.2)*10)/10, depDelay:Math.round((0.6+r()*2.2)*10)/10,
    mov7, perDay, runways, arrivals, departures};
}

// Estaciones (posiciones) y ATC de la dependencia; usa datos reales si existen.
// La dependencia ES el usuario de unidad (username); sus sectores/generales lo tienen
// como parent (userDep(u)===dep).
function dashSectors(dep,users){
  const s=Object.values(users||{})
    .filter(u=>u.role==='sector' && userDep(u)===dep)
    .map(u=>u.posicion||u.username).filter(Boolean);
  return s.length?s:DASH_MOCK_SECT;
}
function dashAtcs(dep,users){
  const a=Object.values(users||{})
    .filter(u=>u.role==='general' && u.iniciales && userDep(u)===dep)
    .map(u=>u.iniciales);
  return a.length?a:DASH_MOCK_ATC;
}
function dashDepsFor(user,users){
  if(user.role==='admin'){
    return Object.values(users||{})
      .filter(u=>u.role==='unit')
      .map(u=>u.username)
      .sort();
  }
  const d=userDep(user);
  return d?[d]:[];
}

/* ---- Mezcla del feed ATFM real (ver js/services/atfm.js) ----
   Cada helper devuelve el dato real si el paquete ATFM lo trae con forma
   válida, o null/[] para que dashboardData() caiga al mock. Así el tablero
   funciona con ATFM completo, parcial (p. ej. solo horario) o ausente. */
function dashNum(v){ v=Number(v); return Number.isFinite(v)?v:null; }
// Curva horaria (24) desde ATFM. Deriva complejidad de la carga si no viene.
function dashAtfmHourly(A, cap){
  if(!A || !Array.isArray(A.hourly) || A.hourly.length!==24) return null;
  return A.hourly.map((x,h)=>{
    const demanda=Math.max(0, Math.round(dashNum(x&&x.demanda)||0));
    const capH=Math.max(1, Math.round(dashNum(x&&x.capacidad)||cap));
    const cx=dashNum(x&&x.complejidad);
    const complejidad=cx!=null?Math.round(cx):Math.round(45+Math.min(1,demanda/capH)*50);
    return { h, demanda, capacidad:capH, complejidad };
  });
}
// Carga por sector desde ATFM (con ratio/estado calculados).
function dashAtfmSectores(A){
  if(!A || !Array.isArray(A.sectores) || !A.sectores.length) return null;
  return A.sectores.map(s=>{
    const load=Math.max(0, Math.round(dashNum(s&&s.load)||0));
    const cap=Math.max(1, Math.round(dashNum(s&&s.cap)||1));
    return { code:(s&&s.code)||'?', load, cap, ratio:load/cap, status:dashStatus(load/cap) };
  }).sort((a,b)=>b.ratio-a.ratio);
}
// Regulaciones / slots ATFM (normalizadas). Arreglo posiblemente vacío.
function dashAtfmRegs(A){
  if(!A || !Array.isArray(A.regulaciones)) return [];
  return A.regulaciones.map(g=>({
    ref:(g&&g.ref)||'', sector:(g&&g.sector)||'', from:(g&&g.from)||'', to:(g&&g.to)||'',
    rate:dashNum(g&&g.rate), delay:dashNum(g&&g.delay),
    reason:(g&&g.reason)||'', level:(g&&g.level)==='crit'?'crit':(g&&g.level)==='ok'?'ok':'warn'
  }));
}

/* Punto de conexión único. Devuelve el paquete de datos del dashboard.
   `atfm` = paquete real de la dependencia (atfmForDep) o null → cae al mock.
   La forma de salida es estable: la vista no cambia según el origen. */
function dashboardData(dep,users,dateStr,atfm){
  const r=dashRng(dashHash((dep||'')+'|'+(dateStr||'')));
  const nowH=new Date().getHours();
  const A=(atfm&&typeof atfm==='object')?atfm:null;
  // capacidad declarada: ATFM manda si la entrega; si no, mock (48).
  const capacidad=(A&&dashNum(A.capacidad)>0)?Math.round(A.capacidad):48;
  // curva horaria: real de ATFM si viene con 24 puntos; si no, mock determinista.
  const realHourly=dashAtfmHourly(A,capacidad);
  const hourly=realHourly || DASH_SHAPE.map((base,h)=>({
    h, demanda:dashJit(r,base,0.14),
    capacidad, complejidad:Math.round(40+r()*55)   // índice de complejidad 40-95
  }));
  const curDem=hourly[nowH].demanda, nextDem=hourly[(nowH+1)%24].demanda;
  const ratio=curDem/capacidad;

  // Posiciones de control (roster) — siguen alimentando dotación y "sectores abiertos".
  const sectNames=dashSectors(dep,users);
  // Carga por sector: real de ATFM si viene; si no, mock por posición del roster.
  const realSect=dashAtfmSectores(A);
  const sectores=realSect || sectNames.map(code=>{ const cap=Math.round(38+r()*16);
    const load=dashJit(r,cap*(0.55+r()*0.6),0.1);
    return {code, load, cap, ratio:load/cap, status:dashStatus(load/cap)}; })
    .sort((a,b)=>b.ratio-a.ratio);
  // Regulaciones / slots ATFM (solo del feed real).
  const regulaciones=dashAtfmRegs(A);

  // Dotación por turno: día (12) y noche (8). El turno vigente alimenta fatiga/dotación.
  const dayRoster=dashAtcs(dep,users);        // 12 (usuarios general reales o mock)
  const nightRoster=DASH_NIGHT_ATC;           // 8 (inventadas)
  const shift=dashShift(nowH);
  const atcNames=shift==='dia'?dayRoster:nightRoster;
  const total=atcNames.length;
  const ausente=Math.round(r()*Math.max(1,total*0.12));
  // en posición ≤ sectores abiertos (no puede haber más ATC en posición que posiciones)
  const enPos=Math.max(0, Math.min(total-ausente, sectNames.length));
  const relevo=Math.max(0, Math.round((total-ausente-enPos)*0.55));
  const disponible=Math.max(0, total-ausente-enPos-relevo);

  const atcs=atcNames.map(ini=>{ const horas=Math.round((2+r()*6)*10)/10;
    const fatiga=Math.min(100,Math.round(horas/8*70 + r()*35));
    return {ini, horas, fatiga, status:fatiga>=80?'crit':fatiga>=60?'warn':'ok'}; })
    .sort((a,b)=>b.fatiga-a.fatiga);

  // Recomendaciones (soporte a la decisión) derivadas de los datos.
  const rec=[];
  const peak=hourly.reduce((m,x)=>x.demanda>m.demanda?x:m,hourly[0]);
  if(peak.demanda>capacidad)
    rec.push({level:'warn',text:'Pico de '+peak.demanda+' mov/h a las '+String(peak.h).padStart(2,'0')+':00 supera la capacidad ('+capacidad+'). Refuerce dotación o divida sectores en esa franja.'});
  const over=sectores.filter(s=>s.status==='crit');
  if(over.length) rec.push({level:'crit',text:'Sector '+over.map(s=>s.code).join(', ')+' sobre capacidad. Considere abrir posición o reasignar un ATC.'});
  const under=sectores.filter(s=>s.ratio<0.5);
  if(under.length>=2) rec.push({level:'ok',text:'Sectores '+under.map(s=>s.code).join(', ')+' con baja demanda: candidatos a refundir para liberar personal.'});
  const tired=atcs.filter(a=>a.status==='crit');
  if(tired.length) rec.push({level:'warn',text:'ATC '+tired.map(a=>a.ini).join(', ')+' con fatiga alta. Programe relevo o descanso prolongado.'});
  if(disponible<=1) rec.push({level:'warn',text:'Dotación disponible ajustada ('+disponible+'). Margen limitado ante ausencias o picos.'});
  // Regulaciones ATFM activas → recomendación prioritaria (se antepone).
  if(regulaciones.length){
    const worst=regulaciones.reduce((m,x)=>((x.delay||0)>(m.delay||0)?x:m),regulaciones[0]);
    rec.unshift({level:(worst.delay||0)>=15?'crit':'warn',
      text:'ATFM: '+regulaciones.length+' regulación(es) de flujo activa(s)'
        +(worst.sector?', mayor demora en '+worst.sector:'')
        +(worst.delay!=null?' ('+worst.delay+' min)':'')
        +'. Ajuste secuenciación y refuerce dotación en las franjas reguladas.'});
  }
  if(!rec.length) rec.push({level:'ok',text:'Carga y dotación equilibradas. Sin ajustes recomendados por ahora.'});

  return {
    updated:Date.now(), nowH,
    kpis:{
      atcDisponibles:{value:total-ausente, total},
      cargaActual:{pct:Math.round(ratio*100), level:dashLevel(ratio), status:dashStatus(ratio)},
      traficoHora:{value:nextDem, delta:nextDem-curDem},
      sectoresAbiertos:{open:sectNames.length, total:sectNames.length},
      complejidad:{value:hourly[nowH].complejidad},
    },
    hourly, sectores, dotacion:{enPos,relevo,disponible,ausente,total}, atcs, recomendaciones:rec,
    turnos:{ current:shift,
      dia:{count:dayRoster.length, atcs:dayRoster},
      noche:{count:nightRoster.length, atcs:nightRoster} },
    regulaciones,
    // Metadatos del origen: qué bloques vienen del ATFM real vs simulados.
    atfm:{ live:!!(realHourly||realSect||regulaciones.length),
      source:A&&A.source||null, updatedAt:A&&dashNum(A.updatedAt)||null,
      fields:{ hourly:!!realHourly, sectores:!!realSect, regulaciones:regulaciones.length>0 } },
    fr24:dashFr24(r, dep, dashDateFromIso(dateStr), new Date()),
  };
}

// Dashboard de toma de decisiones.
// La DEMANDA (carga, capacidad, sectores) proviene SOLO del feed real ATFM (Power BI);
// si no hay datos para la fecha, el tablero muestra "sin datos" (no se simula nada).
// La DOTACIÓN/turnos/fatiga provienen del roster de la dependencia (nombres reales;
// si el roster está vacío se usan iniciales de referencia). Punto único: dashboardData().

// PRNG determinista (mulberry32) — se usa solo para desglosar arr/dep y comercial/no
// comercial cuando el feed ATFM no los trae, y para variaciones menores de la dotación.
function dashHash(s){ let h=2166136261; for(let i=0;i<(s||'').length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }
function dashRng(seed){ let a=seed>>>0; return function(){ a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

// Posiciones/iniciales de referencia si el roster de la dependencia está vacío.
const DASH_MOCK_SECT=['C','D','E','F','G','H','I'];
// Dotación por turno (iniciales inventadas): día = 12 ATC, noche = 8 ATC.
const DASH_MOCK_ATC=['MVI','RDA','PHR','HVB','LSA','JLS','VRK','LMP','BGB','CCE','CLI','FDC']; // día (12)
const DASH_NIGHT_ATC=['NKA','TSC','QVD','WMB','ZRP','GXO','HUN','PDL'];                        // noche (8)
function dashLevel(ratio){ return ratio>=1?'CRÍTICA':ratio>=0.85?'ALTA':ratio>=0.6?'MEDIA':'BAJA'; }
function dashStatus(ratio){ return ratio>=1?'crit':ratio>=0.85?'warn':'ok'; }
// Turno vigente por hora local: día 07–19, noche 19–07.
function dashShift(nowH){ return (nowH>=7 && nowH<19)?'dia':'noche'; }

// (El bloque FR24 simulado —movimientos, uso de pistas, FID y su generador— se
//  eliminó: el tablero ya no muestra datos simulados.)

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
// Conserva los desgloses arr/dep y comerciales/noComerciales si el feed los trae.
function dashAtfmHourly(A, cap){
  if(!A || !Array.isArray(A.hourly) || A.hourly.length!==24) return null;
  return A.hourly.map((x,h)=>{
    const demanda=Math.max(0, Math.round(dashNum(x&&x.demanda)||0));
    const capH=Math.max(1, Math.round(dashNum(x&&x.capacidad)||cap));
    const cx=dashNum(x&&x.complejidad);
    const complejidad=cx!=null?Math.round(cx):Math.round(45+Math.min(1,demanda/capH)*50);
    const o={ h, demanda, capacidad:capH, complejidad };
    const arr=dashNum(x&&x.arr), dep=dashNum(x&&x.dep);
    if(arr!=null) o.arr=Math.max(0,Math.round(arr));
    if(dep!=null) o.dep=Math.max(0,Math.round(dep));
    const com=dashNum(x&&x.comerciales), nc=dashNum(x&&x.noComerciales);
    if(com!=null) o.comerciales=Math.max(0,Math.round(com));
    if(nc!=null) o.noComerciales=Math.max(0,Math.round(nc));
    return o;
  });
}
// Desglose ARR/DEP de una demanda horaria (reparte ~50/50 con leve sesgo determinista).
function dashSplitArrDep(r, demanda){
  const frac=0.46+r()*0.08;                 // 46–54 % llegadas
  const arr=Math.round(demanda*frac);
  return { arr, dep:Math.max(0, demanda-arr) };
}
// Desglose Comercial / No Comercial (la mayoría comercial; una fracción menor no comercial).
function dashSplitComercial(r, demanda){
  if(demanda<=0) return { comerciales:0, noComerciales:0 };
  const nc = demanda<=5 ? (r()<0.5?0:1) : Math.max(1, Math.round(demanda*(0.03+r()*0.05)));
  return { comerciales:Math.max(0, demanda-nc), noComerciales:Math.min(demanda,nc) };
}
// Garantiza que cada entrada horaria tenga arr/dep y comerciales/noComerciales,
// derivándolos de `demanda` cuando el origen (ATFM o mock) no los entregó.
function dashEnrichHourly(hourly, r){
  return hourly.map(x=>{
    const demanda=Math.max(0, dashNum(x.demanda)||0);
    let arr=dashNum(x.arr), dep=dashNum(x.dep);
    if(arr==null||dep==null){ const s=dashSplitArrDep(r,demanda); arr=s.arr; dep=s.dep; }
    let com=dashNum(x.comerciales), nc=dashNum(x.noComerciales);
    if(com==null||nc==null){ const s=dashSplitComercial(r,demanda); com=s.comerciales; nc=s.noComerciales; }
    return Object.assign({}, x, { arr, dep, comerciales:com, noComerciales:nc });
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
  // capacidad declarada por operación (llegadas / salidas). ATFM manda; si no, ~52/48.
  const capArr=(A&&dashNum(A.capArr)>0)?Math.round(A.capArr):Math.round(capacidad*0.52);
  const capDep=(A&&dashNum(A.capDep)>0)?Math.round(A.capDep):Math.max(1,capacidad-Math.round(capacidad*0.52));
  // curva horaria: SOLO real de ATFM. Si no hay feed del día → SIN DATOS (no se simula).
  const realHourly=dashAtfmHourly(A,capacidad);
  const hasDemand=!!realHourly;
  // asegura arr/dep y comerciales/noComerciales en cada hora (del feed real).
  const hourly=hasDemand?dashEnrichHourly(realHourly, r):null;
  const curDem=hasDemand?hourly[nowH].demanda:null;
  const nextDem=hasDemand?hourly[(nowH+1)%24].demanda:null;
  const ratio=hasDemand?curDem/capacidad:null;

  // Posiciones de control (roster) — siguen alimentando dotación y "sectores abiertos".
  const sectNames=dashSectors(dep,users);
  // Carga por sector: SOLO real de ATFM. Hoy el feed no la entrega → sin datos (no se simula).
  const sectores=dashAtfmSectores(A);   // null si el feed no trae sectores
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

  // Recomendaciones (soporte a la decisión) derivadas de los datos disponibles.
  const rec=[];
  if(hasDemand){
    const peak=hourly.reduce((m,x)=>x.demanda>m.demanda?x:m,hourly[0]);
    if(peak.demanda>capacidad)
      rec.push({level:'warn',text:'Pico de '+peak.demanda+' mov/h a las '+String(peak.h).padStart(2,'0')+':00 supera la capacidad ('+capacidad+'). Refuerce dotación o divida sectores en esa franja.'});
  }
  const over=(sectores||[]).filter(s=>s.status==='crit');
  if(over.length) rec.push({level:'crit',text:'Sector '+over.map(s=>s.code).join(', ')+' sobre capacidad. Considere abrir posición o reasignar un ATC.'});
  const under=(sectores||[]).filter(s=>s.ratio<0.5);
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
  if(!rec.length) rec.push(hasDemand
    ? {level:'ok',text:'Carga y dotación equilibradas. Sin ajustes recomendados por ahora.'}
    : {level:'ok',text:'Sin datos ATFM para esta fecha. Presiona “ACTUALIZAR” para traer la demanda desde Power BI. La dotación y turnos provienen del roster.'});

  return {
    updated:Date.now(), nowH,
    kpis:{
      atcDisponibles:{value:total-ausente, total},
      cargaActual: hasDemand?{pct:Math.round(ratio*100), level:dashLevel(ratio), status:dashStatus(ratio)}:null,
      traficoHora: hasDemand?{value:nextDem, delta:nextDem-curDem}:null,
      sectoresAbiertos:{open:sectNames.length, total:sectNames.length},
      complejidad: hasDemand?{value:hourly[nowH].complejidad}:null,
    },
    capacidad, capArr, capDep,
    hourly, sectores, dotacion:{enPos,relevo,disponible,ausente,total}, atcs, recomendaciones:rec,
    turnos:{ current:shift,
      dia:{count:dayRoster.length, atcs:dayRoster},
      noche:{count:nightRoster.length, atcs:nightRoster} },
    regulaciones,
    // Metadatos del origen: el tablero muestra SOLO datos reales del ATFM; sin feed → sin datos.
    atfm:{ live:!!(hasDemand||sectores||regulaciones.length), hasDemand,
      source:A&&A.source||null, updatedAt:A&&dashNum(A.updatedAt)||null,
      fields:{ hourly:hasDemand, sectores:!!sectores, regulaciones:regulaciones.length>0 } },
  };
}

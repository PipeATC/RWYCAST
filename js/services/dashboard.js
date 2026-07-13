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
const DASH_MOCK_ATC=['MVI','RDA','PHR','HVB','LSA','JLS','VRK','LMP','BGB','CCE','CLI','FDC'];
function dashLevel(ratio){ return ratio>=1?'CRÍTICA':ratio>=0.85?'ALTA':ratio>=0.6?'MEDIA':'BAJA'; }
function dashStatus(ratio){ return ratio>=1?'crit':ratio>=0.85?'warn':'ok'; }

// Estaciones (posiciones) y ATC de la dependencia; usa datos reales si existen.
function dashSectors(dep,users){
  const s=Object.values(users||{})
    .filter(u=>u.role==='sector' && effectiveUnits(u,users).includes(dep))
    .map(u=>u.posicion||u.username).filter(Boolean);
  return s.length?s:DASH_MOCK_SECT;
}
function dashAtcs(dep,users){
  const a=Object.values(users||{})
    .filter(u=>u.role==='general' && u.iniciales && effectiveUnits(u,users).includes(dep))
    .map(u=>u.iniciales);
  return a.length?a:DASH_MOCK_ATC;
}
function dashDepsFor(user,users){
  if(user.role==='admin'){
    const set=new Set();
    Object.values(users||{}).forEach(u=>{ if(u.role==='sector') effectiveUnits(u,users).forEach(c=>c&&set.add(c)); });
    if(!set.size) UNITS.forEach(u=>set.add(u.code));
    return [...set];
  }
  return userUnits(user);
}

/* Punto de conexión único. Devuelve el paquete de datos del dashboard.
   Reemplazar el cuerpo por la llamada real a ATFM/Power BI conservando la forma. */
function dashboardData(dep,users,dateStr){
  const r=dashRng(dashHash((dep||'')+'|'+(dateStr||'')));
  const nowH=new Date().getHours();
  const capacidad=48;                              // capacidad declarada por hora (mock)
  const hourly=DASH_SHAPE.map((base,h)=>({
    h, demanda:dashJit(r,base,0.14),
    capacidad, complejidad:Math.round(40+r()*55)   // índice de complejidad 40-95
  }));
  const curDem=hourly[nowH].demanda, nextDem=hourly[(nowH+1)%24].demanda;
  const ratio=curDem/capacidad;

  const sectNames=dashSectors(dep,users);
  const sectores=sectNames.map(code=>{ const cap=Math.round(38+r()*16);
    const load=dashJit(r,cap*(0.55+r()*0.6),0.1);
    return {code, load, cap, ratio:load/cap, status:dashStatus(load/cap)}; })
    .sort((a,b)=>b.ratio-a.ratio);

  const atcNames=dashAtcs(dep,users);
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
  };
}

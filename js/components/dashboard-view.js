// Dashboard de toma de decisiones — carga de trabajo y dotación de la dependencia.
// DATOS FICTICIOS por ahora (ver js/services/dashboard.js). Pensado para decidir la
// asignación de personal a posiciones: picos de demanda vs capacidad, carga por sector,
// dotación disponible y fatiga por ATC, más recomendaciones derivadas.
function Dashboard({user,users}){
  const deps=dashDepsFor(user,users);
  const [depCode,setDepCode]=useState(()=> userUnits(user)[0]||deps[0]||'');
  const [date,setDate]=useState(()=>rotToday());
  const [,setTick]=useState(0);
  useEffect(()=>{ const t=setInterval(()=>setTick(x=>x+1),60000); return ()=>clearInterval(t); },[]);

  if(!depCode) return h('div',null,
    h('div',{className:'phead',style:{borderTop:'none'}},h('h3',null,'Dashboard de decisiones')),
    h('div',{className:'empty'},'No hay dependencia asociada a tu cuenta.'));

  const d=dashboardData(depCode,users,date);
  const P='var(--phos)',A='var(--amber)',R='var(--red)',SK='var(--sky)',VI='var(--violet)',DIM='var(--ink-faint)';
  const stColor=s=> s==='crit'?R : s==='warn'?A : P;

  // ---- KPI tiles ----
  const kpi=(label,value,sub,color)=>h('div',{className:'dash-kpi'},
    h('div',{className:'dash-kpi-l'},label),
    h('div',{className:'dash-kpi-v',style:color?{color}:null}, value),
    sub&&h('div',{className:'dash-kpi-s'},sub));
  const k=d.kpis;
  const kpis=h('div',{className:'dash-kpis'},
    kpi('ATC disponibles', k.atcDisponibles.value, 'de '+k.atcDisponibles.total+' en dotación'),
    kpi('Carga actual', k.cargaActual.pct+'%', k.cargaActual.level, stColor(k.cargaActual.status)),
    kpi('Tráfico próx. hora', k.traficoHora.value+' mov/h',
      (k.traficoHora.delta>=0?'▲ +':'▼ ')+k.traficoHora.delta+' vs actual', k.traficoHora.delta>0?A:P),
    kpi('Sectores abiertos', k.sectoresAbiertos.open, 'posiciones activas'),
    kpi('Complejidad', k.complejidad.value, 'índice (0-100)'));

  // ---- gráfico horario: demanda (área+línea) vs capacidad (línea de referencia) ----
  const H=d.hourly, W=760,HT=232,pL=30,pR=10,pT=12,pB=24;
  const maxY=Math.max(...H.map(x=>Math.max(x.demanda,x.capacidad)))*1.12||1;
  const X=i=>pL+(i/23)*(W-pL-pR);
  const Y=v=>HT-pB-(v/maxY)*(HT-pT-pB);
  const dLine=H.map((x,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(x.demanda).toFixed(1)).join(' ');
  const dArea=dLine+' L'+X(23).toFixed(1)+' '+(HT-pB)+' L'+X(0).toFixed(1)+' '+(HT-pB)+' Z';
  const capY=Y(H[0].capacidad);
  const yticks=[0,Math.round(maxY/2),Math.round(maxY*0.9)];
  const hourlyChart=h('div',{className:'dash-chartwrap'},
    h('svg',{className:'dash-svg',viewBox:'0 0 '+W+' '+HT,role:'img'},
      yticks.map((v,i)=>h('g',{key:'g'+i},
        h('line',{x1:pL,x2:W-pR,y1:Y(v),y2:Y(v),stroke:'var(--line-soft)',strokeWidth:1}),
        h('text',{x:pL-5,y:Y(v)+3,textAnchor:'end',className:'dash-axt'},v))),
      h('path',{d:dArea,fill:'rgba(63,240,168,.14)',stroke:'none'}),
      h('path',{d:dLine,fill:'none',stroke:P,strokeWidth:2,strokeLinejoin:'round'}),
      h('line',{x1:pL,x2:W-pR,y1:capY,y2:capY,stroke:DIM,strokeWidth:2,strokeDasharray:'5 4'}),
      h('text',{x:W-pR,y:capY-5,textAnchor:'end',className:'dash-axt'},'capacidad '+H[0].capacidad),
      // marca de hora actual
      h('line',{x1:X(d.nowH),x2:X(d.nowH),y1:pT,y2:HT-pB,stroke:A,strokeWidth:1.5}),
      h('circle',{cx:X(d.nowH),cy:Y(H[d.nowH].demanda),r:4,fill:A,stroke:'var(--panel)',strokeWidth:2}),
      [0,3,6,9,12,15,18,21,23].map(hh=>h('text',{key:'x'+hh,x:X(hh),y:HT-8,textAnchor:'middle',className:'dash-axt'},
        String(hh).padStart(2,'0'))),
      // zonas de hover por hora (tooltip nativo)
      H.map((x,i)=>h('rect',{key:'h'+i,x:X(i)-((W-pL-pR)/23)/2,y:pT,width:(W-pL-pR)/23,height:HT-pT-pB,
        fill:'transparent'}, h('title',null,String(i).padStart(2,'0')+':00 · demanda '+x.demanda+' · cap '+x.capacidad+' · compl '+x.complejidad)))),
    h('div',{className:'dash-legend'},
      h('span',null,h('i',{className:'lg',style:{background:P}}),'Demanda (mov/h)'),
      h('span',null,h('i',{className:'lg dash',style:{background:DIM}}),'Capacidad declarada'),
      h('span',null,h('i',{className:'lg',style:{background:A}}),'Hora actual')));

  // ---- carga por sector (barras horizontales, color por estado) ----
  const sectBars=h('div',{className:'dash-bars'},
    d.sectores.map(s=>h('div',{className:'dash-bar',key:s.code},
      h('span',{className:'dash-bar-k'},s.code),
      h('div',{className:'dash-bar-track'},
        h('div',{className:'dash-bar-fill',style:{width:Math.min(100,s.ratio*100)+'%',background:stColor(s.status)}})),
      h('span',{className:'dash-bar-v'}, s.load+'/'+s.cap,
        h('em',{className:'dash-tag '+s.status}, s.status==='crit'?'sobre cap':s.status==='warn'?'alta':'ok')))));

  // ---- dotación (barra apilada + leyenda) ----
  const dt=d.dotacion, segs=[['En posición',dt.enPos,P],['Relevo',dt.relevo,SK],['Disponible',dt.disponible,VI],['Ausente',dt.ausente,DIM]];
  const dotacion=h('div',null,
    h('div',{className:'dash-stack'},
      segs.filter(s=>s[1]>0).map((s,i)=>h('div',{className:'dash-seg',key:i,
        style:{flex:s[1],background:s[2]},title:s[0]+': '+s[1]}, s[1]))),
    h('div',{className:'dash-legend'},
      segs.map((s,i)=>h('span',{key:i}, h('i',{className:'lg',style:{background:s[2]}}), s[0]+' ('+s[1]+')'))));

  // ---- fatiga por ATC ----
  const fatiga=h('div',{className:'dash-fat'},
    d.atcs.map(a=>h('div',{className:'dash-fatrow',key:a.ini},
      h('span',{className:'dash-fatini'},a.ini),
      h('span',{className:'dash-fathrs'},a.horas+'h'),
      h('div',{className:'dash-fatmeter'},
        h('div',{className:'dash-fatfill',style:{width:a.fatiga+'%',background:stColor(a.status)}})),
      h('span',{className:'dash-fatv',style:{color:stColor(a.status)}}, a.fatiga))));

  // ---- recomendaciones ----
  const recos=h('div',{className:'dash-recos'},
    d.recomendaciones.map((rc,i)=>h('div',{className:'dash-reco '+rc.level,key:i},
      h('span',{className:'dash-reco-ic'}, rc.level==='crit'?'▲':rc.level==='warn'?'!':'✓'),
      h('span',null,rc.text))));

  const card=(title,sub,body,cls)=>h('div',{className:'dash-card'+(cls?' '+cls:'')},
    h('div',{className:'dash-card-h'}, h('h4',null,title), sub&&h('span',null,sub)), body);

  return h('div',null,
    h('div',{className:'phead',style:{borderTop:'none'}},
      h('h3',null,'Dashboard de decisiones · '+depAbbrev(depCode)),
      h('span',{className:'sub'}, 'CARGA Y DOTACIÓN · '+rotLongDate(date))),
    h('div',{className:'gridwrap'},
      h('div',{className:'toolbar'},
        deps.length>1 && h('select',{className:'bit-sel',value:depCode,onChange:e=>setDepCode(e.target.value)},
          deps.map(x=>h('option',{key:x,value:x}, depAbbrev(x)+' · '+x))),
        h('label',{className:'bit-date'}, h('span',null,'FECHA'),
          h('input',{type:'date',value:date,onChange:e=>setDate(e.target.value||rotToday())})),
        h('span',{className:'dash-sim'},'◆ DATOS SIMULADOS')),
      kpis,
      h('div',{className:'dash-grid'},
        card('Demanda vs capacidad por hora','movimientos/hora',hourlyChart,'wide'),
        card('Carga por sector','ahora',sectBars),
        card('Dotación de turno', dt.total+' ATC', dotacion),
        card('Fatiga por ATC','estimada',fatiga),
        card('Recomendaciones','soporte a la decisión',recos,'wide')),
      h('div',{className:'dash-note'},
        'Datos de demostración. Próximamente se vincularán con el módulo ATFM (Power BI) para alimentar la carga real y apoyar la asignación de personal a posiciones.')));
}

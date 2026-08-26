// Dashboard de toma de decisiones — carga de trabajo y dotación de la dependencia.
// DATOS FICTICIOS por ahora (ver js/services/dashboard.js). Pensado para decidir la
// asignación de personal a posiciones: picos de demanda vs capacidad, carga por sector,
// dotación disponible y fatiga por ATC, más recomendaciones derivadas.

// Paleta de los gráficos de barras (fija en ambos temas, como el color de marca de FR24):
// azul comercial / oro no comercial / naranjo capacidad; salmón ARR / celeste DEP; magenta
// y azul profundo para las capacidades por operación. Espejo de las imágenes de referencia.
const DASH_COL={ com:'#2e9bff', nc:'#f4c430', cap:'#e8733e',
  arr:'#f0a184', dep:'#9cc3e4', capArr:'#e5439b', capDep:'#2746c9' };

// --- Gráfico 1: Demanda por hora — barras apiladas Comercial/No Comercial + línea de capacidad ---
function dashDemandaChart(H, capacidad, nowH){
  const W=800,HT=250,pL=34,pR=14,pT=30,pB=32;
  const n=24, plotW=W-pL-pR, plotH=HT-pT-pB, base=pT+plotH;
  const maxY=(Math.max(capacidad, ...H.map(x=>x.demanda))||1)*1.16;
  const slot=plotW/n, bw=slot*0.62;
  const xl=i=>pL+slot*i+(slot-bw)/2, cx=i=>pL+slot*i+slot/2;
  const Y=v=>base-(v/maxY)*plotH;
  const ticks=[0,Math.round(maxY/3),Math.round(maxY*2/3)];
  const capY=Y(capacidad);
  return h('svg',{className:'dash-svg',viewBox:'0 0 '+W+' '+HT,role:'img',preserveAspectRatio:'xMidYMid meet'},
    ticks.map((v,i)=>h('g',{key:'g'+i},
      h('line',{x1:pL,x2:W-pR,y1:Y(v),y2:Y(v),stroke:'var(--line-soft)',strokeWidth:1}),
      h('text',{x:pL-6,y:Y(v)+3,textAnchor:'end',className:'dash-axt'},v))),
    H.map((x,i)=>{ const yc=Y(x.comerciales), ync=Y(x.comerciales+x.noComerciales);
      const lblY=Math.min(base-6,(yc+base)/2+3);
      return h('g',{key:'b'+i},
        h('rect',{x:xl(i),y:yc,width:bw,height:Math.max(0,base-yc),fill:DASH_COL.com}),
        x.noComerciales>0&&h('rect',{x:xl(i),y:ync,width:bw,height:Math.max(0,yc-ync),fill:DASH_COL.nc}),
        x.demanda>0&&h('text',{x:cx(i),y:lblY,textAnchor:'middle',className:'dash-barlbl'},x.comerciales),
        h('rect',{x:xl(i),y:pT,width:bw,height:base-pT,fill:'transparent'},
          h('title',null,String(x.h).padStart(2,'0')+':00 · demanda '+x.demanda+' mov (com '+x.comerciales+' / no com '+x.noComerciales+') · cap '+capacidad))); }),
    h('line',{x1:pL,x2:W-pR,y1:capY,y2:capY,stroke:DASH_COL.cap,strokeWidth:2.5}),
    H.map((x,i)=>h('text',{key:'c'+i,x:cx(i),y:capY-5,textAnchor:'middle',className:'dash-caplbl',
      style:{fill:DASH_COL.cap}},capacidad)),
    (nowH>=0&&nowH<24)&&h('line',{x1:cx(nowH),x2:cx(nowH),y1:pT,y2:base,stroke:'var(--amber)',
      strokeWidth:1,strokeDasharray:'3 3',opacity:.7}),
    H.map((x,i)=>h('text',{key:'x'+i,x:cx(i),y:base+13,textAnchor:'middle',className:'dash-hlbl'},
      String(x.h).padStart(2,'0')+':00')));
}
function dashDemandaLegend(){
  return h('div',{className:'dash-legend'},
    h('span',null,h('i',{className:'lg',style:{background:DASH_COL.com}}),'Comerciales'),
    h('span',null,h('i',{className:'lg',style:{background:DASH_COL.nc}}),'No Comerciales'),
    h('span',null,h('i',{className:'lg',style:{background:DASH_COL.cap}}),'Capacidad Total'));
}

// --- Gráfico 2: Tráfico programado por hora — barras agrupadas ARR/DEP + capacidades por operación ---
// opts: { showArr, showDep, from, to } — el modal las usa para filtrar; la tarjeta muestra todo.
function dashArrDepChart(H, capArr, capDep, opts){
  opts=opts||{}; const showArr=opts.showArr!==false, showDep=opts.showDep!==false;
  const from=opts.from!=null?opts.from:0, to=opts.to!=null?opts.to:23;
  const hours=H.filter(x=>x.h>=from&&x.h<=to);
  const W=800,HT=250,pL=34,pR=14,pT=36,pB=32;
  const n=Math.max(1,hours.length), plotW=W-pL-pR, plotH=HT-pT-pB, base=pT+plotH;
  const vals=[]; if(showArr){vals.push(capArr); hours.forEach(x=>vals.push(x.arr));}
  if(showDep){vals.push(capDep); hours.forEach(x=>vals.push(x.dep));}
  const maxY=(Math.max(1,...vals))*1.18;
  const slot=plotW/n, Y=v=>base-(v/maxY)*plotH, cx=i=>pL+slot*i+slot/2;
  const both=showArr&&showDep;
  const bw=both?slot*0.30:slot*0.46, gap=both?slot*0.06:0;
  const arrX=i=>both?(pL+slot*i+slot/2-gap/2-bw):(pL+slot*i+(slot-bw)/2);
  const depX=i=>both?(pL+slot*i+slot/2+gap/2):(pL+slot*i+(slot-bw)/2);
  const ticks=[0,Math.round(maxY/3),Math.round(maxY*2/3)];
  const capArrY=Y(capArr), capDepY=Y(capDep);
  const showLbl=n<=24;
  return h('svg',{className:'dash-svg',viewBox:'0 0 '+W+' '+HT,role:'img',preserveAspectRatio:'xMidYMid meet'},
    ticks.map((v,i)=>h('g',{key:'g'+i},
      h('line',{x1:pL,x2:W-pR,y1:Y(v),y2:Y(v),stroke:'var(--line-soft)',strokeWidth:1}),
      h('text',{x:pL-6,y:Y(v)+3,textAnchor:'end',className:'dash-axt'},v))),
    hours.map((x,i)=>h('g',{key:'b'+i},
      showArr&&h('rect',{x:arrX(i),y:Y(x.arr),width:bw,height:Math.max(0,base-Y(x.arr)),fill:DASH_COL.arr}),
      showDep&&h('rect',{x:depX(i),y:Y(x.dep),width:bw,height:Math.max(0,base-Y(x.dep)),fill:DASH_COL.dep}),
      showArr&&showLbl&&x.arr>0&&h('text',{x:arrX(i)+bw/2,y:Y(x.arr)-3,textAnchor:'middle',
        className:'dash-barlbl2',style:{fill:DASH_COL.arr}},x.arr),
      showDep&&showLbl&&x.dep>0&&h('text',{x:depX(i)+bw/2,y:Y(x.dep)-3,textAnchor:'middle',
        className:'dash-barlbl2',style:{fill:DASH_COL.dep}},x.dep),
      h('rect',{x:pL+slot*i,y:pT,width:slot,height:base-pT,fill:'transparent'},
        h('title',null,String(x.h).padStart(2,'0')+':00 · ARR '+x.arr+' / DEP '+x.dep
          +' · cap ARR '+capArr+' / cap DEP '+capDep)))),
    showArr&&h('line',{x1:pL,x2:W-pR,y1:capArrY,y2:capArrY,stroke:DASH_COL.capArr,strokeWidth:2}),
    showDep&&h('line',{x1:pL,x2:W-pR,y1:capDepY,y2:capDepY,stroke:DASH_COL.capDep,strokeWidth:2}),
    showLbl&&showArr&&hours.map((x,i)=>h('text',{key:'ca'+i,x:cx(i),y:capArrY-3,textAnchor:'middle',
      className:'dash-caplbl',style:{fill:DASH_COL.capArr}},capArr)),
    showLbl&&showDep&&hours.map((x,i)=>h('text',{key:'cd'+i,x:cx(i),y:capDepY-3,textAnchor:'middle',
      className:'dash-caplbl',style:{fill:DASH_COL.capDep}},capDep)),
    hours.map((x,i)=>h('text',{key:'x'+i,x:cx(i),y:base+13,textAnchor:'middle',className:'dash-hlbl'},
      String(x.h).padStart(2,'0')+':00')));
}
function dashArrDepLegend(showArr,showDep){
  return h('div',{className:'dash-legend'},
    showArr&&h('span',null,h('i',{className:'lg',style:{background:DASH_COL.arr}}),'ARR'),
    showDep&&h('span',null,h('i',{className:'lg',style:{background:DASH_COL.dep}}),'DEP'),
    showArr&&h('span',null,h('i',{className:'lg',style:{background:DASH_COL.capArr}}),'Capacidad de ARR'),
    showDep&&h('span',null,h('i',{className:'lg',style:{background:DASH_COL.capDep}}),'Capacidad de DEP'));
}

// --- Ventana emergente: explorador ARR/DEP con filtros (operación, fecha, rango horario, tabla) ---
function AtfmExplorer({depCode,depLabel,users,atfm,initialDate,onClose}){
  const [date,setDate]=useState(initialDate);
  const [showArr,setShowArr]=useState(true);
  const [showDep,setShowDep]=useState(true);
  const [from,setFrom]=useState(0);
  const [to,setTo]=useState(23);
  const [table,setTable]=useState(false);
  useEffect(()=>{ const k=e=>{ if(e.key==='Escape') onClose(); };
    window.addEventListener('keydown',k); return ()=>window.removeEventListener('keydown',k); },[]);

  const d=dashboardData(depCode,users,date, atfmForDep(atfm,depCode,date));
  const H=d.hourly;                       // null si no hay ATFM para la fecha
  const lo=Math.min(from,to), hi=Math.max(from,to);
  const rows=H?H.filter(x=>x.h>=lo&&x.h<=hi):[];
  // No permitir ocultar ambas operaciones a la vez.
  const setOp=(a,dp)=>{ if(!a&&!dp) return; setShowArr(a); setShowDep(dp); };
  const seg=(lbl,a,dp)=>h('button',{className:'dash-seg-btn'+((showArr===a&&showDep===dp)?' on':''),
    onClick:()=>setOp(a,dp)}, lbl);
  const hourOpts=(sel,on)=>h('select',{className:'bit-sel',value:sel,onChange:e=>on(+e.target.value)},
    Array.from({length:24},(_,i)=>h('option',{key:i,value:i},String(i).padStart(2,'0')+':00')));

  return h('div',{className:'dash-modal-ov',onClick:e=>{ if(e.target===e.currentTarget) onClose(); }},
    h('div',{className:'dash-modal',role:'dialog','aria-modal':'true'},
      h('div',{className:'dash-modal-h'},
        h('h3',null,'Tráfico ARR/DEP · '+depLabel),
        h('button',{className:'dash-modal-x',onClick:onClose,title:'Cerrar (Esc)'},'✕')),
      h('div',{className:'dash-modal-tools'},
        h('div',{className:'dash-seg'}, seg('Ambas',true,true), seg('Solo ARR',true,false), seg('Solo DEP',false,true)),
        h('label',{className:'bit-date'}, h('span',null,'FECHA'),
          h('input',{type:'date',value:date,onChange:e=>setDate(e.target.value||initialDate)})),
        h('label',{className:'dash-range'}, h('span',null,'DESDE'), hourOpts(from,setFrom)),
        h('label',{className:'dash-range'}, h('span',null,'HASTA'), hourOpts(to,setTo)),
        h('button',{className:'dash-seg-btn'+(table?' on':''),onClick:()=>setTable(t=>!t)},
          table?'Ocultar tabla':'Ver tabla')),
      h('div',{className:'dash-modal-body'},
        H ? h('div',{className:'dash-chartwrap'},
          dashArrDepChart(H, d.capArr, d.capDep, {showArr,showDep,from:lo,to:hi}),
          dashArrDepLegend(showArr,showDep))
          : h('div',{className:'dash-empty'},'Sin datos ATFM para esta fecha.'),
        table && H && h('div',{className:'dash-modal-tbl'},
          h('table',{className:'dash-tbl'},
            h('thead',null,h('tr',null,
              h('th',null,'Hora'),
              showArr&&h('th',{className:'r'},'ARR'),
              showDep&&h('th',{className:'r'},'DEP'),
              h('th',{className:'r'},'Total'))),
            h('tbody',null, rows.map(x=>h('tr',{key:x.h},
              h('td',{className:'b'},String(x.h).padStart(2,'0')+':00'),
              showArr&&h('td',{className:'r'},x.arr),
              showDep&&h('td',{className:'r'},x.dep),
              h('td',{className:'r b'},(showArr?x.arr:0)+(showDep?x.dep:0)))))))),
      h('div',{className:'dash-modal-foot'},
        (H?'Datos ATFM · programado':'Sin datos ATFM')
        +' · cap. ARR '+d.capArr+' / cap. DEP '+d.capDep+' mov/h · '+rotLongDate(date))));
}

function Dashboard({user,users,atfm}){
  const deps=dashDepsFor(user,users);
  const [depCode,setDepCode]=useState(()=> userDep(user)||deps[0]||'');
  const [date,setDate]=useState(()=>rotToday());
  const [explorer,setExplorer]=useState(false);
  const [sync,setSync]=useState({state:'idle',msg:''});
  const [,setTick]=useState(0);
  useEffect(()=>{ const t=setInterval(()=>setTick(x=>x+1),60000); return ()=>clearInterval(t); },[]);

  // Refresco manual desde el origen ATFM (Power BI). El navegador NO puede consultar
  // Power BI directo (CORS): se invoca el Cloudflare Worker (GET), que hace la consulta
  // server-side y escribe en RTDB; la app se refresca sola por la suscripción en vivo.
  const hasWorker=(typeof ATFM_WORKER_URL!=='undefined' && ATFM_WORKER_URL);
  const hasPbi=(typeof ATFM_POWERBI_URL!=='undefined' && ATFM_POWERBI_URL);
  const doRefresh=async()=>{
    if(sync.state==='loading') return;
    // Con Worker desplegado: consulta server-side y la app se refresca por la suscripción.
    if(hasWorker){
      setSync({state:'loading',msg:'⟳ Cargando datos ATFM desde Power BI… (esto puede tardar unos segundos)'});
      try{
        const res=await fetch(ATFM_WORKER_URL,{method:'GET',cache:'no-store'});
        let data={}; try{ data=await res.json(); }catch(e){}
        if(!res.ok || data.ok===false) throw new Error((data&&(data.msg||data.error))||('HTTP '+res.status));
        setSync({state:'done',msg:'Datos ATFM actualizados desde Power BI. La vista se refresca automáticamente.'});
      }catch(e){
        setSync({state:'error',msg:'No se pudo actualizar desde Power BI: '+(e.message||e)+'. Se mantienen los datos actuales.'});
      }
      return;
    }
    // Respaldo sin Worker: abre el reporte de Power BI (el navegador no puede volcar
    // los datos al Dashboard directo por CORS; el volcado automático necesita el Worker).
    if(hasPbi){
      window.open(ATFM_POWERBI_URL,'_blank','noopener');
      setSync({state:'done',msg:'Reporte ATFM (Power BI) abierto en una pestaña nueva. Para volcar sus datos automáticamente al Dashboard (barras + badge "Datos ATFM"), despliega el Worker y fija ATFM_WORKER_URL en js/config/keys.js.'});
      return;
    }
    setSync({state:'error',msg:'Configura ATFM_WORKER_URL (Worker desplegado) o ATFM_POWERBI_URL (enlace del reporte) en js/config/keys.js para actualizar desde Power BI.'});
  };

  if(!depCode) return h('div',null,
    h('div',{className:'phead',style:{borderTop:'none'}},h('h3',null,'Dashboard de decisiones')),
    h('div',{className:'empty'},'No hay dependencia asociada a tu cuenta.'));

  const d=dashboardData(depCode,users,date, atfmForDep(atfm,depCode,date));
  const P='var(--phos)',A='var(--amber)',R='var(--red)',SK='var(--sky)',VI='var(--violet)',DIM='var(--ink-faint)';
  const stColor=s=> s==='crit'?R : s==='warn'?A : P;

  // Estado "sin datos" reutilizable (cuando no hay feed ATFM para la fecha).
  const sinDatos=(msg)=>h('div',{className:'dash-empty'}, msg||'Sin datos ATFM para esta fecha.');

  // ---- KPI tiles ----
  const kpi=(label,value,sub,color)=>h('div',{className:'dash-kpi'},
    h('div',{className:'dash-kpi-l'},label),
    h('div',{className:'dash-kpi-v',style:color?{color}:null}, value),
    sub&&h('div',{className:'dash-kpi-s'},sub));
  const kpiSD=(label)=>kpi(label,'sin datos','—',DIM);   // KPI de demanda sin ATFM
  const k=d.kpis;
  const kpis=h('div',{className:'dash-kpis'},
    kpi('ATC disponibles', k.atcDisponibles.value, 'de '+k.atcDisponibles.total+' en dotación'),
    k.cargaActual
      ? kpi('Carga actual', k.cargaActual.pct+'%', k.cargaActual.level, stColor(k.cargaActual.status))
      : kpiSD('Carga actual'),
    k.traficoHora
      ? kpi('Tráfico próx. hora', k.traficoHora.value+' mov/h',
          (k.traficoHora.delta>=0?'▲ +':'▼ ')+k.traficoHora.delta+' vs actual', k.traficoHora.delta>0?A:P)
      : kpiSD('Tráfico próx. hora'),
    kpi('Sectores abiertos', k.sectoresAbiertos.open, 'posiciones activas'),
    k.complejidad ? kpi('Complejidad', k.complejidad.value, 'índice (0-100)') : kpiSD('Complejidad'));

  // ---- gráfico 1: demanda por hora (SOLO real de ATFM; sin feed → sin datos) ----
  const H=d.hourly;
  const hourlyChart = H
    ? h('div',{className:'dash-chartwrap'}, dashDemandaChart(H, d.capacidad, d.nowH), dashDemandaLegend())
    : sinDatos('Sin datos ATFM para esta fecha. Presiona “ACTUALIZAR” para traerlos desde Power BI.');

  // ---- gráfico 2: tráfico programado por hora ARR/DEP ----
  const arrDepChart = H
    ? h('div',{className:'dash-chartwrap'}, dashArrDepChart(H, d.capArr, d.capDep, {}), dashArrDepLegend(true,true))
    : sinDatos('Sin datos ATFM para esta fecha.');

  // ---- carga por sector (SOLO real de ATFM; sin feed → sin datos) ----
  const sectBars = (d.sectores && d.sectores.length)
    ? h('div',{className:'dash-bars'},
        d.sectores.map(s=>h('div',{className:'dash-bar',key:s.code},
          h('span',{className:'dash-bar-k'},s.code),
          h('div',{className:'dash-bar-track'},
            h('div',{className:'dash-bar-fill',style:{width:Math.min(100,s.ratio*100)+'%',background:stColor(s.status)}})),
          h('span',{className:'dash-bar-v'}, s.load+'/'+s.cap,
            h('em',{className:'dash-tag '+s.status}, s.status==='crit'?'sobre cap':s.status==='warn'?'alta':'ok')))))
    : sinDatos('Sin datos de sectores en el feed ATFM.');

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

  // ---- regulaciones / slots ATFM (solo si el feed real las entrega) ----
  const regs=d.regulaciones||[];
  const regBody=h('div',{className:'dash-regs'},
    regs.map((g,i)=>h('div',{className:'dash-reg '+(g.level||'warn'),key:i},
      h('div',{className:'dash-reg-top'},
        h('span',{className:'dash-reg-ref'}, g.ref||'—'),
        g.sector&&h('span',{className:'dash-reg-sec'}, g.sector),
        (g.from||g.to)&&h('span',{className:'dash-reg-win'}, (g.from||'')+(g.to?'–'+g.to:''))),
      h('div',{className:'dash-reg-bot'},
        g.rate!=null&&h('span',null,'Rate '+g.rate+'/h'),
        g.delay!=null&&h('span',{className:'dash-reg-delay'},'Demora '+g.delay+' min'),
        g.reason&&h('span',{className:'dash-reg-rsn'}, g.reason)))));

  // ---- dotación por turno: día (12) vs noche (8) ----
  const shiftBlock=(t)=>{ const T=d.turnos[t], isNow=d.turnos.current===t;
    return h('div',{className:'dash-shift '+t+(isNow?' now':''),key:t},
      h('div',{className:'dash-shift-h'},
        h('span',{className:'dash-shift-name'}, t==='dia'?'Turno día':'Turno noche'),
        isNow&&h('span',{className:'dash-shift-now'},'EN CURSO'),
        h('span',{className:'dash-shift-n'}, T.count+' ATC')),
      h('div',{className:'dash-shift-chips'},
        T.atcs.map(ini=>h('span',{className:'dash-chip',key:ini}, ini)))); };
  const turnos=h('div',null, shiftBlock('dia'), shiftBlock('noche'));

  // ---- FR24 (simulado): estadísticas de tránsito + FID ----
  const fr=d.fr24, nf=n=>Number(n).toLocaleString('es-CL');
  const movKpis=h('div',{className:'dash-kpis'},
    kpi('Total movimientos', nf(fr.mov7.total), 'últimos 7 días', SK),
    kpi('Despegues', nf(fr.mov7.takeoffs), 'últimos 7 días'),
    kpi('Aterrizajes', nf(fr.mov7.landings), 'últimos 7 días'));
  const statTable=(cols,rows,firstBold)=>h('table',{className:'dash-tbl'},
    h('thead',null,h('tr',null, cols.map((c,i)=>h('th',{key:i,className:i?'r':''},c)))),
    h('tbody',null, rows.map((row,ri)=>h('tr',{key:ri},
      row.map((cell,ci)=>h('td',{key:ci,className:(ci?'r ':'')+(ci===0&&firstBold?'b':'')+(ci===1?' b':'')},
        ci?nf(cell):cell))))));
  const movTable=statTable(['Fecha','Total','Despegues','Aterrizajes'],
    fr.perDay.map(x=>[x.date,x.total,x.takeoffs,x.landings]));
  const rwyTable=statTable(['Pista','Total','Despegues','Aterrizajes'],
    fr.runways.map(x=>[x.rwy,x.total,x.takeoffs,x.landings]), true);
  const fidCol=(title,rows,placeLbl)=>h('div',{className:'dash-fid-col'},
    h('div',{className:'dash-fid-h'}, title),
    h('table',{className:'dash-tbl fid'},
      h('thead',null,h('tr',null,
        h('th',null,'Hora'), h('th',null,'Vuelo'), h('th',null,placeLbl),
        h('th',null,'Aerolínea'), h('th',null,'Aeronave'), h('th',{className:'r'},'Estado'))),
      h('tbody',null, rows.map((x,i)=>h('tr',{key:i},
        h('td',{className:'mono'}, x.time),
        h('td',{className:'sky b'}, x.flight),
        h('td',null, x.place, h('span',{className:'dash-fid-code'}, ' '+x.code)),
        h('td',{className:'dim'}, x.airline),
        h('td',{className:'mono'}, x.aircraft, x.reg&&h('span',{className:'dash-fid-code'}, ' '+x.reg)),
        h('td',{className:'r'}, h('span',{className:'dash-fid-st '+x.kind}, x.status)))))));
  const fid=h('div',null,
    h('div',{className:'dash-fid-bar'},
      h('div',{className:'dash-fid-ap'}, h('b',null, fr.icao+' · '+fr.name),
        fr.city&&h('span',null, fr.city)),
      h('div',{className:'dash-fid-idx'},
        h('span',null, h('em',null,'MY RATING'), fr.rating+'%'),
        h('span',null, h('em',null,'DELAY LLEG.'), fr.arrDelay.toFixed(1)),
        h('span',null, h('em',null,'DELAY SAL.'), fr.depDelay.toFixed(1)),
        h('span',null, h('em',null,'LOCAL'), fr.localTime))),
    h('div',{className:'dash-fid'},
      fidCol('Llegadas', fr.arrivals, 'Origen'),
      fidCol('Salidas', fr.departures, 'Destino')));

  const card=(title,sub,body,cls)=>h('div',{className:'dash-card'+(cls?' '+cls:'')},
    h('div',{className:'dash-card-h'}, h('h4',null,title), sub&&h('span',null,sub)), body);

  // Tarjeta del gráfico ARR/DEP con botón que abre la ventana emergente (explorador).
  const arrDepCard=h('div',{className:'dash-card wide'},
    h('div',{className:'dash-card-h'},
      h('h4',null,'Tráfico programado por horas · ARR/DEP'),
      h('div',{className:'dash-card-hr'},
        h('span',null, d.atfm.fields.hourly?'ATFM · programado':'sin datos'),
        h('button',{className:'dash-expand',onClick:()=>setExplorer(true),
          title:'Abrir ventana para navegar y filtrar'},'⤢ Explorar'))),
    arrDepChart);

  return h('div',null,
    h('div',{className:'phead',style:{borderTop:'none'}},
      h('h3',null,'Dashboard de decisiones · '+depName(depCode,users)),
      h('span',{className:'sub'}, 'CARGA Y DOTACIÓN · '+rotLongDate(date))),
    h('div',{className:'gridwrap'},
      h('div',{className:'toolbar'},
        deps.length>1 && h('select',{className:'bit-sel',value:depCode,onChange:e=>setDepCode(e.target.value)},
          deps.map(x=>h('option',{key:x,value:x}, depName(x,users)))),
        h('label',{className:'bit-date'}, h('span',null,'FECHA'),
          h('input',{type:'date',value:date,onChange:e=>setDate(e.target.value||rotToday())})),
        h('button',{className:'dash-sim'+(d.atfm.live?' live':'')+(sync.state==='loading'?' loading':''),
          onClick:doRefresh, disabled:sync.state==='loading',
          title:d.atfm.live
            ? (d.atfm.updatedAt?('Última sincronización '+new Date(d.atfm.updatedAt).toLocaleString('es-CL')+' · pulsa para actualizar'):'Pulsa para actualizar desde Power BI')
            : (hasWorker ? 'Pulsa para actualizar desde el origen ATFM (Power BI)'
                : hasPbi ? 'Pulsa para abrir el reporte ATFM en Power BI'
                : 'Configura ATFM_WORKER_URL o ATFM_POWERBI_URL en keys.js')},
          sync.state==='loading'
            ? '⟳ ACTUALIZANDO…'
            : (d.atfm.live
                ? '● DATOS ATFM'+(d.atfm.updatedAt?' · '+new Date(d.atfm.updatedAt).toLocaleString('es-CL',{dateStyle:'short',timeStyle:'short'}):'')
                : '○ SIN DATOS · '+(hasWorker?'ACTUALIZAR':hasPbi?'VER ATFM':'ACTUALIZAR')))),
      sync.msg && h('div',{className:'dash-syncmsg '+sync.state}, sync.msg),
      kpis,
      h('div',{className:'dash-grid'},
        card('Demanda vs capacidad por hora', d.atfm.fields.hourly?'ATFM · mov/hora':'sin datos', hourlyChart,'wide'),
        arrDepCard,
        card('Rotación de turnos', d.turnos.dia.count+' día · '+d.turnos.noche.count+' noche', turnos),
        card('Carga por sector', d.atfm.fields.sectores?'ATFM · ahora':'sin datos', sectBars),
        card('Dotación de turno', dt.total+' ATC', dotacion),
        card('Fatiga por ATC','estimada',fatiga),
        regs.length ? card('Regulaciones ATFM', regs.length+' activa(s)', regBody,'wide') : null,
        card('Recomendaciones','soporte a la decisión',recos,'wide')),
      h('div',{className:'dash-sec'}, 'Tránsito del aeropuerto',
        h('span',null,'FR24 · SIMULADO · '+fr.icao)),
      movKpis,
      h('div',{className:'dash-grid'},
        card('Movimientos por día','últimos 7 días',movTable),
        card('Uso de pistas','últimos 7 días',rwyTable),
        card('FID · '+fr.icao,'llegadas y salidas',fid,'wide')),
      h('div',{className:'dash-note'},
        d.atfm.live
          ? ('Demanda, capacidad y regulaciones provienen del módulo ATFM'
             +(d.atfm.source?' ('+d.atfm.source+')':'')+'. La dotación, turnos y fatiga provienen del roster de la '
             +'dependencia; lo que el feed ATFM no entrega aparece como “sin datos”. Las estadísticas de '
             +'movimientos, uso de pistas y el FID simulan un feed tipo Flightradar24.')
          : ('Sin datos ATFM para esta fecha. Presiona “ACTUALIZAR” para traer la demanda desde Power BI. '
             +'La dotación, turnos y fatiga provienen del roster; las estadísticas de movimientos, uso de '
             +'pistas y el FID simulan un feed tipo Flightradar24.'))),
    explorer && h(AtfmExplorer,{depCode, depLabel:depName(depCode,users), users, atfm,
      initialDate:date, onClose:()=>setExplorer(false)}));
}

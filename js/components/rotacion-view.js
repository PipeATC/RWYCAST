// Rotación de estaciones de trabajo — cuadro del turno (día/noche) por dependencia.
// El usuario de unidad reparte a los ATC (general) entre estaciones (sector) a lo largo
// de las vueltas. Estaciones = columnas · vueltas = filas · celda = ATC. Los sectores se
// pueden refundir (fusionar columnas en una banda). Horas trabajadas automáticas.
function Rotacion({user,users}){
  const deps=rotDepsFor(user,users);
  const [depCode,setDepCode]=useState(()=> userUnits(user)[0]||deps[0]||'');
  const [date,setDate]=useState(()=>rotToday());
  const [turno,setTurno]=useState(()=> (rotNowMin()>=(20*60+20)||rotNowMin()<(8*60+45))?'noche':'dia');
  const [store,setStore]=useState(null);
  const [nowMin,setNowMin]=useState(rotNowMin());
  const storeRef=useRef({});
  const timer=useRef(null); const pending=useRef(null);
  const editable=canEditRotacion(user,depCode);
  const isToday=date===rotToday();

  useEffect(()=>{ const t=setInterval(()=>setNowMin(rotNowMin()),30000); return ()=>clearInterval(t); },[]);
  useEffect(()=>{
    if(!depCode){ setStore({}); return; }
    setStore(null); storeRef.current={};
    const sub=subscribeRotacion(depCode,date,v=>{ storeRef.current=v||{}; setStore(v||{}); });
    return sub.stop;
  },[depCode,date]);

  const getDoc=()=>mergeRotDoc((storeRef.current||{})[turno],turno,depCode,users);
  function flush(){ clearTimeout(timer.current);
    if(pending.current){ saveRotacion(depCode,date,pending.current.turno,pending.current.doc); pending.current=null; } }
  function commit(doc,immediate){
    clearTimeout(timer.current);
    const d={...doc,turno,date,updatedAt:Date.now(),updatedBy:user.name};
    storeRef.current={...storeRef.current,[turno]:d}; setStore({...storeRef.current});
    if(immediate){ pending.current=null; saveRotacion(depCode,date,turno,d); }
    else { pending.current={turno,doc:d};
      timer.current=setTimeout(()=>{ if(pending.current){ saveRotacion(depCode,date,pending.current.turno,pending.current.doc); pending.current=null; } },500); }
  }
  function upd(fn,immediate){ const cur=JSON.parse(JSON.stringify(getDoc())); commit(fn(cur)||cur,immediate); }
  function switchTurno(t){ flush(); setTurno(t); }

  // ---- operaciones ----
  function setCell(bandId,colId,val){ upd(d=>{ d.cells=d.cells||{}; d.cells[bandId]=d.cells[bandId]||{};
    if(val) d.cells[bandId][colId]=val; else delete d.cells[bandId][colId];
    if(!Object.keys(d.cells[bandId]).length) delete d.cells[bandId]; return d; },true); }
  function addColumn(kind){ const lbl=kind==='coord'?'COORD':kind==='relevo'?'R':'';
    upd(d=>{ d.columns=rotArr(d.columns); d.columns.push({id:rotUid(),kind,label:lbl}); return d; },true); }
  function renameColumn(id,label){ upd(d=>{ const c=rotArr(d.columns).find(x=>x.id===id); if(c) c.label=label; return d; },false); }
  function removeColumn(id){ if(!window.confirm('¿Eliminar esta columna y sus asignaciones?')) return;
    upd(d=>{ d.columns=rotArr(d.columns).filter(c=>c.id!==id);
      Object.keys(d.cells||{}).forEach(bid=>{ if(d.cells[bid]) delete d.cells[bid][id]; });
      Object.keys(d.merges||{}).forEach(bid=>{ d.merges[bid]=rotArr(d.merges[bid]).map(g=>rotArr(g).filter(x=>x!==id)).filter(g=>g.length>=2);
        if(!d.merges[bid].length) delete d.merges[bid]; }); return d; },true); }
  function addBand(){ upd(d=>{ d.bands=rotArr(d.bands); const last=d.bands[d.bands.length-1];
    d.bands.push({id:rotUid(),start:last?last.end:'00:00',end:''}); return d; },true); }
  function setBand(id,field,val){ upd(d=>{ const b=rotArr(d.bands).find(x=>x.id===id); if(b) b[field]=val; return d; },false); }
  function removeBand(id){ if(!window.confirm('¿Eliminar esta vuelta?')) return;
    upd(d=>{ d.bands=rotArr(d.bands).filter(b=>b.id!==id); if(d.cells) delete d.cells[id]; if(d.merges) delete d.merges[id]; return d; },true); }
  function mergeNext(bandId,colId){ upd(d=>{
    d.merges=rotMergeNext(rotArr(d.columns),d.merges||{},bandId,colId);
    // al refundir, la columna absorbida deja de tener su propio ATC (queda el líder)
    const grp=rotColGroups(rotArr(d.columns),d.merges[bandId]).find(g=>rotArr(g).includes(colId));
    if(grp && d.cells && d.cells[bandId]){ rotArr(grp).slice(1).forEach(id=>{ delete d.cells[bandId][id]; });
      if(!Object.keys(d.cells[bandId]).length) delete d.cells[bandId]; }
    return d; },true); }
  function splitCol(bandId,colId){ upd(d=>{ d.merges=rotSplit(rotArr(d.columns),d.merges||{},bandId,colId);
    // al separar, limpia asignaciones que quedaran en columnas ahora vacías salvo la líder
    return d; },true); }
  function addRoster(ini){ ini=(ini||'').trim().toUpperCase(); if(!ini) return;
    upd(d=>{ d.roster=rotArr(d.roster); if(!d.roster.includes(ini)) d.roster.push(ini); return d; },true); }
  function removeRoster(ini){ upd(d=>{ d.roster=rotArr(d.roster).filter(x=>x!==ini); return d; },true); }

  if(!depCode) return h('div',null,rotHead('—',date,turno),
    h('div',{className:'empty'},'No hay dependencia asociada a tu cuenta.'));
  if(store===null) return h('div',null,rotHead(depAbbrev(depCode),date,turno),
    h('div',{className:'empty'},'Cargando cuadro de rotación…'));

  const published=!!(storeRef.current&&storeRef.current[turno]);
  const doc=getDoc();
  const columns=rotArr(doc.columns);
  const bands=rotArr(doc.bands);
  const roster=rotArr(doc.roster);
  const hours=rotHoursWorked(doc);
  const generales=rotRosterFor(depCode,users).filter(i=>!roster.includes(i)); // disponibles para agregar

  function rotHead(dep,dt,tn){
    return h('div',{className:'phead',style:{borderTop:'none'}},
      h('h3',null,'Rotación de estaciones · '+dep),
      h('span',{className:'sub'}, (tn==='noche'?'TURNO NOCHE':'TURNO DÍA')+' · '+rotLongDate(dt)));
  }

  // barra de controles
  const toolbar=h('div',{className:'toolbar'},
    h('div',{className:'rot-toggrp'},
      h('button',{className:turno==='dia'?'on':'',onClick:()=>switchTurno('dia')},'DÍA'),
      h('button',{className:turno==='noche'?'on':'',onClick:()=>switchTurno('noche')},'NOCHE')),
    deps.length>1 && h('select',{className:'bit-sel',value:depCode,onChange:e=>setDepCode(e.target.value)},
      deps.map(d=>h('option',{key:d,value:d}, depAbbrev(d)+' · '+d))),
    h('label',{className:'bit-date'}, h('span',null,'FECHA'),
      h('input',{type:'date',value:date,onChange:e=>{ flush(); setDate(e.target.value||rotToday()); }})),
    !editable && h('span',{className:'bit-poschip'},'SOLO LECTURA'));

  // cabecera del cuadro (supervisores / cic-adm / cantidad + roster)
  const metaBlock=h('div',{className:'rot-meta'},
    h('div',{className:'rot-mrow'},
      h('label',null,'SUPERVISOR/ES'),
      editable?h('input',{value:doc.supervisores||'',placeholder:'Iniciales',
        onChange:e=>upd(d=>{d.supervisores=e.target.value;return d;},false),onBlur:flush})
        :h('span',{className:'rot-mval'},doc.supervisores||'—')),
    h('div',{className:'rot-mrow'},
      h('label',null,'CIC / ADM'),
      editable?h('input',{value:doc.cicAdm||'',placeholder:'0',
        onChange:e=>upd(d=>{d.cicAdm=e.target.value;return d;},false),onBlur:flush})
        :h('span',{className:'rot-mval'},doc.cicAdm||'—')),
    h('div',{className:'rot-mrow'},
      h('label',null,'ATCO'),
      editable?h('input',{type:'number',min:0,max:40,value:doc.atcoCount||0,style:{width:70},
        onChange:e=>upd(d=>{d.atcoCount=+e.target.value||0;return d;},false),onBlur:flush})
        :h('span',{className:'rot-mval'},(doc.atcoCount||0)+' ATCO')));

  // roster del turno
  const rosterBlock=h('div',{className:'rot-roster'},
    h('label',{className:'eyebrow'},'ATC del turno ('+roster.length+')'),
    h('div',{className:'rot-chips'},
      roster.length===0 && h('span',{className:'rot-empty'},'— sin ATC asignados —'),
      roster.map(ini=>h('span',{className:'rot-chip',key:ini}, ini,
        editable && h('button',{onClick:()=>removeRoster(ini),title:'Quitar'},'×'))),
      editable && generales.length>0 && h('select',{className:'rot-add',value:'',
        onChange:e=>{ if(e.target.value) addRoster(e.target.value); }},
        h('option',{value:''},'+ agregar…'),
        generales.map(i=>h('option',{key:i,value:i},i))),
      editable && h('input',{className:'rot-addtxt',placeholder:'+ otro',maxLength:5,
        onKeyDown:e=>{ if(e.key==='Enter'){ addRoster(e.target.value); e.target.value=''; } }})));

  // gestión de columnas
  const colTools=editable && h('div',{className:'rot-coltools'},
    h('button',{className:'filterbtn',onClick:()=>addColumn('station')},'+ Estación'),
    h('button',{className:'filterbtn',onClick:()=>addColumn('coord')},'+ COORD'),
    h('button',{className:'filterbtn',onClick:()=>addColumn('relevo')},'+ Relevo'));

  // ---- rejilla ----
  const rosterOpts=[...new Set([...roster])];
  const headerRow=h('tr',null,
    h('th',{className:'rot-th-t'},'INICIO'),
    h('th',{className:'rot-th-t'},'FIN'),
    columns.map(c=>h('th',{key:c.id,className:'rot-th-col '+c.kind},
      editable
        ? h('input',{className:'rot-collbl',value:c.label||'',placeholder:c.kind==='relevo'?'R':(c.kind==='coord'?'COORD':'?'),
            onChange:e=>renameColumn(c.id,e.target.value.toUpperCase()),onBlur:flush})
        : h('span',null,c.label||'—'),
      editable && h('button',{className:'rot-colrm',title:'Eliminar columna',onClick:()=>removeColumn(c.id)},'×'))),
    h('th',{className:'rot-th-h'},'HORAS'),
    editable && h('th',{className:'rot-th-x'},''));

  const bandRows=bands.map(b=>{
    const now=isToday && rotBandIsNow(b,nowMin);
    const groups=rotColGroups(columns,(doc.merges||{})[b.id]);
    const row=(doc.cells||{})[b.id]||{};
    const cells=groups.map((g,gi)=>{
      const ids=rotArr(g); const lead=ids[0];
      const cols=ids.map(id=>columns.find(c=>c.id===id)).filter(Boolean);
      const merged=ids.length>1;
      const kind=cols[0]?cols[0].kind:'station';
      const val=row[lead]||'';
      const canMerge=editable && gi<groups.length-1;
      return h('td',{key:lead,colSpan:ids.length,className:'rot-cell '+kind+(merged?' merged':'')},
        h('div',{className:'rot-cellwrap'},
          editable
            ? h('select',{className:'rot-atc',value:val,onChange:e=>setCell(b.id,lead,e.target.value)},
                h('option',{value:''},'—'),
                (val&&!rosterOpts.includes(val))?h('option',{value:val},val):null,
                rosterOpts.map(i=>h('option',{key:i,value:i},i)))
            : h('span',{className:'rot-atc-ro'+(val?'':' none')}, val||'·'),
          editable && merged && h('button',{className:'rot-mg split',title:'Separar',onClick:()=>splitCol(b.id,lead)},'⿲'),
          editable && canMerge && h('button',{className:'rot-mg',title:'Refundir con la siguiente',onClick:()=>mergeNext(b.id,lead)},'⇥')));
    });
    return h('tr',{key:b.id,className:now?'rot-now':''},
      h('td',{className:'rot-t'}, editable
        ? h('input',{className:'rot-tin',value:b.start||'',maxLength:5,inputMode:'numeric',placeholder:'HH:MM',
            onChange:e=>setBand(b.id,'start',rotTypeHM(e.target.value)),
            onBlur:e=>{ setBand(b.id,'start',rotNormHM(e.target.value)); flush(); }})
        : h('span',null,b.start||'—')),
      h('td',{className:'rot-t'}, editable
        ? h('input',{className:'rot-tin',value:b.end||'',maxLength:5,inputMode:'numeric',placeholder:'HH:MM',
            onChange:e=>setBand(b.id,'end',rotTypeHM(e.target.value)),
            onBlur:e=>{ setBand(b.id,'end',rotNormHM(e.target.value)); flush(); }})
        : h('span',null,b.end||'—')),
      cells,
      h('td',{className:'rot-h'}, rotFmtDur(rotBandMin(b))),
      editable && h('td',{className:'rot-x'},
        h('button',{className:'bit-rm',title:'Eliminar vuelta',onClick:()=>removeBand(b.id)},'×')));
  });

  const grid=h('div',{className:'rot-scroll'},
    h('table',{className:'rot-grid'},
      h('thead',null,headerRow),
      h('tbody',null, bandRows,
        editable && h('tr',null, h('td',{colSpan:columns.length+ (editable?4:3)},
          h('button',{className:'bf-add',onClick:addBand},'+ Vuelta'))))));

  // horas trabajadas
  const hoursList=Object.keys(hours).sort((a,b)=>hours[b]-hours[a]);
  const hoursPanel=h('div',{className:'rot-hours'},
    h('label',{className:'eyebrow'},'Horas trabajadas'),
    hoursList.length===0
      ? h('div',{className:'rot-empty'},'Sin asignaciones todavía.')
      : h('div',{className:'rot-hgrid'},
          hoursList.map(ini=>h('div',{className:'rot-hrow',key:ini},
            h('span',{className:'rot-hini'},ini),
            h('span',{className:'rot-hval'},rotFmtDur(hours[ini]))))));

  const foot=doc.updatedBy && h('div',{className:'bit-foot'},'Última edición · '+doc.updatedBy+' · '+ageMin(doc.updatedAt));

  return h('div',null,
    rotHead(depAbbrev(depCode),date,turno),
    h('div',{className:'gridwrap'},
      toolbar,
      (!editable && !published)
        ? h('div',{className:'empty'},'No hay rotación publicada para el turno '+(turno==='noche'?'de noche':'de día')+' de esta fecha.')
        : h('div',null,
            metaBlock,
            rosterBlock,
            colTools,
            columns.length===0
              ? h('div',{className:'empty'},'No hay estaciones. Agrega columnas o crea usuarios de sector en Gestión de usuarios.')
              : grid,
            hoursPanel,
            foot)));
}

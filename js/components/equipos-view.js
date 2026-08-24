// Equipos e instalaciones — Equipos / EquipoCard / EquiposEditor
// Cada unidad aeroportuaria mantiene su equipamiento (radares, comunicaciones,
// radioayudas e instalaciones aeroportuarias) y sus NOTAM, y actualiza el estado de
// funcionamiento de cada equipo. Misma lógica de jurisdicción del visor: buscador +
// "Mi jurisdicción" (watchlist personal) / "Toda la red".
function Equipos({airports,user,metars,equipos,onSave,watch,onAddWatch,onRemoveWatch}){
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState('mine');
  const [editing,setEditing]=useState(null);   // OACI en edición (drawer)
  const [adding,setAdding]=useState(false);     // selector "agregar a Mi jurisdicción"
  const mineMode=filter==='mine';
  const q=query.trim().toUpperCase();

  const visible=airports.filter(a=>{
    if(mineMode && !watch.includes(a.icao)) return false;
    if(q && !(a.icao.includes(q)||(a.city||'').toUpperCase().includes(q)||(a.name||'').toUpperCase().includes(q))) return false;
    return true;
  });
  if(mineMode){
    const pos=new Map(watch.map((ic,i)=>[ic,i]));
    visible.sort((x,y)=>(pos.has(x.icao)?pos.get(x.icao):1e9)-(pos.has(y.icao)?pos.get(y.icao):1e9));
  }
  const available=airports.filter(a=>!watch.includes(a.icao));
  const current=editing?airports.find(a=>a.icao===editing):null;

  return h('div',null,
    h('div',{className:'phead',style:{borderTop:'none'}},
      h('h3',null,'Equipos e instalaciones'),
      h('span',{className:'sub'}, visible.length+' AERÓDROMO'+(visible.length===1?'':'S')+' · '+(mineMode?'MI JURISDICCIÓN':'TODA LA RED'))),
    h('div',{className:'gridwrap'},
      h('div',{className:'catnote'},
        'Registra y edita el equipamiento de cada unidad — radares, comunicaciones, radioayudas e instalaciones ',
        'aeroportuarias — y actualiza su estado de funcionamiento. También mantiene los NOTAM de la unidad. ',
        'El estado se refleja de inmediato en el Cuadro de Mando.'),
      h('div',{className:'toolbar'},
        h('div',{className:'search'}, Ic.search({}),
          h('input',{value:query,placeholder:'Buscar OACI / ciudad…',onChange:e=>setQuery(e.target.value)})),
        h('button',{className:'filterbtn'+(mineMode?' on':''),onClick:()=>setFilter('mine')},'Mi jurisdicción'),
        h('button',{className:'filterbtn'+(filter==='all'?' on':''),onClick:()=>setFilter('all')},'Toda la red')),
      (!mineMode && visible.length===0)
        ? h('div',{className:'empty'},'Sin aeródromos que coincidan con el filtro.')
        : h('div',{className:'apgrid'},
            visible.map(a=>h(EquipoCard,{key:a.icao,a,user,
              doc:equipos[a.icao],onOpen:()=>setEditing(a.icao),
              onRemove:mineMode?onRemoveWatch:null})),
            mineMode && h(AddCard,{key:'__add',onClick:()=>setAdding(true)}))),
    adding && h(AddPicker,{available,onAdd:onAddWatch,onClose:()=>setAdding(false)}),
    current && h(EquiposEditor,{key:current.icao,a:current,user,
      doc:equipos[current.icao]||{items:[],notams:[]},
      onClose:()=>setEditing(null),
      onSave:async(icao,d)=>{const r=await onSave(icao,d); if(r&&r.ok)setEditing(null); return r;}})
  );
}

/* resumen compacto del equipamiento de una unidad, agrupado por categoría */
function EquipoCard({a,user,doc,onOpen,onRemove}){
  const canEdit=canEditEquipos(user,a);
  const items=(doc&&doc.items)||[];
  const notams=(doc&&doc.notams)||[];
  const dot=st=>h('span',{className:'eqdot '+eqStatusClass(st)});
  const catRow=t=>{
    const list=items.filter(x=>x.tipo===t.key);
    const worst=eqWorstStatus(list);
    return h('div',{className:'eqcat-row',key:t.key},
      h('span',{className:'eqcat-ic'}, Ic[t.icon]({})),
      h('span',{className:'eqcat-lbl'}, t.short),
      list.length===0
        ? h('span',{className:'eqcat-empty'},'—')
        : h('span',{className:'eqcat-sum'}, dot(worst), list.length+' equipo'+(list.length===1?'':'s')));
  };
  const usCount=items.filter(x=>x.estado==='U/S').length;
  const degCount=items.filter(x=>x.estado==='DEGR'||x.estado==='MANT').length;
  return h('div',{className:'apcard'},
    h('div',{className:'crest'},
      h('div',{className:'crest-l'},
        h('div',{className:'icao'},a.icao),
        h('div',{className:'nm'},a.name),
        h('div',{className:'city'},(a.city||'').toUpperCase())),
      h('div',{className:'crest-r'},
        h('div',{className:'k'},'Estado general'),
        h('div',{className:'eqhero '+eqStatusClass(eqWorstStatus(items))},
          items.length===0?'SIN DATOS':(usCount?usCount+' U/S':degCount?degCount+' OBS':'OPERATIVO')))),
    h('div',{className:'apstack eqcats'}, EQ_TYPES.map(catRow)),
    notams.length>0 && h('div',{className:'eqnotam-line'},
      Ic.notam({}), notams.length+' NOTAM vigente'+(notams.length===1?'':'s')),
    h('div',{className:'apfoot'},
      h('span',{className:'age'}, (doc&&doc.updatedAt)?('Actualizado '+ageMin(doc.updatedAt)):'Sin registros'),
      (doc&&doc.updatedBy)&&h('span',{className:'by'},'· '+doc.updatedBy),
      onRemove && h('span',{className:'editlink rm',title:'Quitar de Mi jurisdicción',
        onClick:()=>onRemove(a.icao)},'Quitar'),
      h('span',{className:'editlink',onClick:onOpen}, canEdit?'Editar equipos':'Ver detalle')))
}

/* ---------------- Editor de equipamiento y NOTAM (drawer) ---------------- */
function EquiposEditor({a,user,doc,onClose,onSave}){
  const canEdit=canEditEquipos(user,a);
  const [items,setItems]=useState(()=>JSON.parse(JSON.stringify(doc.items||[])));
  const [notams,setNotams]=useState(()=>JSON.parse(JSON.stringify(doc.notams||[])));
  const [err,setErr]=useState(''); const [busy,setBusy]=useState(false);
  const orig=useRef(JSON.stringify([doc.items||[],doc.notams||[]]));
  const dirty=JSON.stringify([items,notams])!==orig.current;

  const addItem=tipo=>setItems(prev=>[...prev,{id:eqUid(),tipo,nombre:'',detalle:'',estado:'OK',obs:'',updatedAt:Date.now(),updatedBy:user.name}]);
  const setItem=(id,patch)=>setItems(prev=>prev.map(x=>x.id===id?{...x,...patch}:x));
  const rmItem=id=>setItems(prev=>prev.filter(x=>x.id!==id));
  const cycle=it=>setItem(it.id,{estado:eqCycleStatus(it.estado),updatedAt:Date.now(),updatedBy:user.name});

  const addNotam=()=>setNotams(prev=>[...prev,{id:eqUid(),numero:'',texto:'',desde:'',hasta:'',updatedAt:Date.now()}]);
  const setNotam=(id,patch)=>setNotams(prev=>prev.map(x=>x.id===id?{...x,...patch,updatedAt:Date.now()}:x));
  const rmNotam=id=>setNotams(prev=>prev.filter(x=>x.id!==id));

  const save=async()=>{
    setBusy(true); setErr('');
    // descarta ítems sin nombre; conserva el resto
    const cleanItems=items.filter(x=>(x.nombre||'').trim());
    const cleanNotams=notams.filter(x=>(x.texto||'').trim()||(x.numero||'').trim());
    const r=await onSave(a.icao,{items:cleanItems,notams:cleanNotams});
    setBusy(false);
    if(r&&r.error) setErr(r.error);
  };

  const section=t=>{
    const list=items.filter(x=>x.tipo===t.key);
    return h('div',{className:'eqsec',key:t.key},
      h('div',{className:'eqsec-h'},
        h('span',{className:'eqsec-ic'}, Ic[t.icon]({})),
        h('h4',null,t.label),
        h('span',{className:'eqsec-n'}, list.length)),
      list.map(it=>h('div',{className:'eqitem',key:it.id},
        h('div',{className:'eqitem-top'},
          canEdit
            ? h('input',{className:'eqitem-nm',value:it.nombre,placeholder:'Nombre del equipo',
                autoCapitalize:'characters',autoCorrect:'off',spellCheck:false,
                onChange:e=>setItem(it.id,{nombre:e.target.value})})
            : h('div',{className:'eqitem-nm ro'}, it.nombre||'—'),
          h('button',{type:'button',className:'bfpill '+eqStatusClass(it.estado)+(canEdit?'':' readonly'),
            title:EQ_STATUS_LABEL[it.estado]||it.estado,
            onClick:canEdit?()=>cycle(it):undefined}, it.estado),
          canEdit && h('button',{type:'button',className:'eqrm',title:'Eliminar equipo',onClick:()=>rmItem(it.id)},'✕')),
        h('div',{className:'eqitem-bot'},
          canEdit
            ? h('input',{className:'eqitem-det',value:it.detalle,placeholder:'Detalle (frecuencia, canal, ubicación…)',
                onChange:e=>setItem(it.id,{detalle:e.target.value})})
            : (it.detalle && h('span',{className:'eqitem-det ro'}, it.detalle)),
          canEdit
            ? h('input',{className:'eqitem-obs',value:it.obs,placeholder:'Observación operacional…',
                onChange:e=>setItem(it.id,{obs:e.target.value})})
            : (it.obs && h('span',{className:'eqitem-obs ro'}, it.obs))))),
      canEdit && h('div',{className:'eqsug'},
        t.sug.map(s=>h('button',{key:s,type:'button',className:'eqsug-btn',
          title:'Agregar '+s,
          onClick:()=>{ const tipo=t.key; setItems(prev=>[...prev,{id:eqUid(),tipo,nombre:s,detalle:'',estado:'OK',obs:'',updatedAt:Date.now(),updatedBy:user.name}]); }},'+ '+s)),
        h('button',{type:'button',className:'eqsug-btn add',onClick:()=>addItem(t.key)},'+ Otro')));
  };

  const notamSection=h('div',{className:'eqsec',key:'__notam'},
    h('div',{className:'eqsec-h'},
      h('span',{className:'eqsec-ic'}, Ic.notam({})),
      h('h4',null,'NOTAM'),
      h('span',{className:'eqsec-n'}, notams.length)),
    notams.length===0 && !canEdit && h('div',{className:'eqcat-empty',style:{padding:'4px 2px'}},'Sin NOTAM vigentes.'),
    notams.map(n=>h('div',{className:'eqnotam',key:n.id},
      h('div',{className:'eqnotam-top'},
        canEdit
          ? h('input',{className:'eqnotam-num',value:n.numero,placeholder:'N° (ej. A1234/26)',
              autoCapitalize:'characters',autoCorrect:'off',spellCheck:false,
              onChange:e=>setNotam(n.id,{numero:e.target.value.toUpperCase()})})
          : h('span',{className:'eqnotam-num ro'}, n.numero||'NOTAM'),
        canEdit && h('button',{type:'button',className:'eqrm',title:'Eliminar NOTAM',onClick:()=>rmNotam(n.id)},'✕')),
      canEdit
        ? h('textarea',{className:'eqnotam-txt',value:n.texto,placeholder:'Texto del NOTAM…',
            onChange:e=>setNotam(n.id,{texto:e.target.value})})
        : h('div',{className:'eqnotam-txt ro'}, n.texto||'—'),
      h('div',{className:'eqnotam-win'},
        canEdit
          ? h('input',{value:n.desde,placeholder:'Desde (DDHHMM o texto)',onChange:e=>setNotam(n.id,{desde:e.target.value})})
          : (n.desde && h('span',null,'Desde '+n.desde)),
        canEdit
          ? h('input',{value:n.hasta,placeholder:'Hasta (DDHHMM / PERM)',onChange:e=>setNotam(n.id,{hasta:e.target.value})})
          : (n.hasta && h('span',null,'Hasta '+n.hasta))))),
    canEdit && h('div',{className:'eqsug'},
      h('button',{type:'button',className:'eqsug-btn add',onClick:addNotam},'+ Agregar NOTAM')));

  return h('div',{className:'scrim',onClick:e=>{if(e.target.className==='scrim')onClose();}},
    h('div',{className:'drawer'},
      h('div',{className:'dhead'},
        h('div',{className:'icao'},a.icao),
        h('div',null,
          h('div',{style:{fontFamily:'var(--mono)',fontSize:11,color:'var(--ink-dim)',letterSpacing:'.04em'}},a.name),
          h('div',{style:{fontFamily:'var(--mono)',fontSize:9.5,color:'var(--ink-faint)',marginTop:3,letterSpacing:'.1em'}},
            (canEdit?'EQUIPOS E INSTALACIONES':'SOLO LECTURA')+' · '+(a.owner||a.icao))),
        h('button',{className:'x',onClick:onClose},'✕')),
      h('div',{className:'dbody'},
        EQ_TYPES.map(section),
        notamSection,
        dirty && !err && h('div',{style:{fontFamily:'var(--mono)',fontSize:10.5,color:'var(--amber)',marginTop:4}},'● Cambios sin publicar'),
        err && h('div',{style:{fontFamily:'var(--mono)',fontSize:11,color:'var(--red)',marginTop:4}},'⚠ '+err)),
      h('div',{className:'dfoot'},
        h('button',{className:'btn ghost',style:{flex:1},onClick:onClose}, canEdit?'Cancelar':'Cerrar'),
        canEdit && h('button',{className:'btn primary',style:{flex:2},disabled:busy||!dirty,onClick:save},
          busy?'Publicando…':(dirty?'Publicar cambios':'Sin cambios')))
    )
  );
}

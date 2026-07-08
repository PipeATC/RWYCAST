// Data Base UI — CatalogAdmin / CatalogUnitEditor / AirportEditor, …
function CatalogAdmin({airports,user,onSave,onCreate,onDelete}){
  const [adding,setAdding]=useState(false);
  const [editing,setEditing]=useState(null);   // OACI del aeródromo en edición (drawer)
  const editable=airports.filter(a=>canEditAirport(user,a));
  const isAdmin=canManageAirports(user);
  const scope = user.role==='admin' ? 'TODA LA RED' : (userUnits(user).join(' · ')||'MI UNIDAD');
  const current=editing?airports.find(a=>a.icao===editing):null;
  return h('div',null,
    h('div',{className:'phead',style:{borderTop:'none'}},
      h('h3',null,'Data Base de unidades aeroportuarias'),
      h('span',{className:'sub'}, editable.length+' AERÓDROMO'+(editable.length===1?'':'S')+' · '+scope)),
    h('div',{className:'catwrap'},
      h('div',{className:'catnote'},
        'Selecciona una unidad y presiona Editar para modificar sus datos: nombre, ciudad, pistas (numeración), ',
        'aproximaciones, puntos de entrada y STAR. Al guardar, los cambios se publican a todas las unidades.',
        isAdmin && h('span',null,' Como Administrador General también puedes agregar o eliminar unidades aeroportuarias.')),
      isAdmin && h('div',{className:'toolbar'},
        h('button',{className:'filterbtn on',onClick:()=>setAdding(true)},'+ Nueva unidad')),
      (editable.length===0 && !isAdmin) &&
        h('div',{className:'empty'},'No tienes aeródromos asignados para editar.'),
      editable.length>0 && h('div',{className:'apgrid'},
        editable.map(a=>h(CatalogListRow,{key:a.icao,a,user,
          onEdit:()=>setEditing(a.icao),
          onDelete:isAdmin?onDelete:null}))),
      adding && h(AirportEditor,{user,onClose:()=>setAdding(false),
        onCreate:async d=>{const r=await onCreate(d); if(r&&r.ok)setAdding(false); return r;}}),
      current && h(CatalogUnitEditor,{key:current.icao+'_'+current.updatedAt, a:current, user,
        onClose:()=>setEditing(null),
        onSave:async(icao,d)=>{const r=await onSave(icao,d); if(r&&r.ok)setEditing(null); return r;},
        onDelete:isAdmin?async icao=>{const r=await onDelete(icao); if(r&&r.ok)setEditing(null); return r;}:null}))
  );
}

/* fila compacta de la lista de unidades del catálogo (con botón Editar) */
function CatalogListRow({a,user,onEdit,onDelete}){
  const owns=userUnits(user).includes(a.owner);
  const del=()=>{ if(window.confirm('¿Eliminar la unidad aeroportuaria "'+a.icao+'" ('+a.name+')?\nSe quitará de toda la red operacional.')) onDelete(a.icao); };
  return h('div',{className:'apcard'},
    h('div',{className:'crest'},
      h('div',null,
        h('div',{className:'icao',style:{fontSize:16}}, a.icao),
        h('div',{className:'nm'}, a.name),
        h('div',{className:'city'}, (a.city||'').toUpperCase()+' · '+a.owner)),
      h('div',{className:'owntag'},
        h('b',null, owns?'MI UNIDAD':(user.role==='admin'?'ADMIN':'')))),
    h('div',{className:'apfoot'},
      h('span',{className:'age'}, (a.rwys||[]).length+' pista(s) · '+(a.apps||[]).length+' aprox · '+(a.eps||[]).length+' entrada(s)'),
      h('span',{className:'editlink',onClick:onEdit},'Editar'),
      onDelete && h('span',{className:'editlink rm',onClick:del},'Eliminar')));
}

/* editor de una lista simple de strings (puntos de entrada): sin hipervínculo */
function EpsEditor({eps,onChange}){
  return h('div',{className:'catcol bare'},
    h('div',{className:'catlbl'}, 'Puntos de entrada',
      h('span',{className:'catn'}, eps.filter(x=>(x||'').trim()).length)),
    eps.map((v,i)=>h('div',{className:'catitem',key:i},
      h('input',{value:v,placeholder:'Ej. DOSO',autoCapitalize:'characters',autoCorrect:'off',spellCheck:false,
        onChange:e=>onChange(eps.map((x,j)=>j===i?e.target.value.toUpperCase():x))}),
      h('button',{className:'catrm',title:'Eliminar',
        onClick:()=>onChange(eps.filter((_,j)=>j!==i))},'✕'))),
    h('button',{className:'catadd',onClick:()=>onChange([...eps,''])},'+ Agregar'));
}

/* editor de una lista (pistas / aprox): agrega, edita y elimina ítems. Cada ítem es
   {name, url}: el nombre y un hipervínculo opcional a la carta PDF (aproximación/pista)
   publicada en la IP, que luego se abre en una ventana emergente desde el visor. */
function ListEditor({label,items,onChange,placeholder,urlPlaceholder}){
  const set=(i,patch)=>onChange(items.map((x,j)=>j===i?{...x,...patch}:x));
  return h('div',{className:'catcol bare'},
    h('div',{className:'catlbl'}, label,
      h('span',{className:'catn'}, items.filter(x=>(x.name||'').trim()).length)),
    items.map((it,i)=>h('div',{className:'catitem col',key:i},
      h('div',{className:'catitemrow'},
        h('input',{value:it.name||'',placeholder,autoCapitalize:'characters',autoCorrect:'off',spellCheck:false,
          onChange:e=>set(i,{name:e.target.value.toUpperCase()})}),
        h('button',{className:'catrm',title:'Eliminar',
          onClick:()=>onChange(items.filter((_,j)=>j!==i))},'✕')),
      h('input',{className:'charturl',type:'url',value:it.url||'',
        placeholder:urlPlaceholder||'https://… enlace a carta PDF (opcional)',
        autoCapitalize:'off',autoCorrect:'off',spellCheck:false,
        onChange:e=>set(i,{url:e.target.value.trim()})}))),
    h('button',{className:'catadd',onClick:()=>onChange([...items,{name:'',url:''}])},'+ Agregar'));
}

/* editor de STARs: cada STAR tiene un nombre y sirve a uno o más puntos de entrada
   (se seleccionan con chips desde la lista de puntos de entrada del aeródromo) */
function StarsEditor({stars,eps,onChange,className}){
  const validEps=(eps||[]).filter(x=>(x||'').trim());
  const setStar=(i,patch)=>onChange(stars.map((s,j)=>j===i?{...s,...patch}:s));
  const toggleEp=(i,ep)=>{
    const cur=stars[i].eps||[];
    setStar(i,{eps: cur.includes(ep)?cur.filter(x=>x!==ep):[...cur,ep]});
  };
  return h('div',{className:className||'catcol'},
    h('div',{className:'catlbl'},'STAR',
      h('span',{className:'catn'}, stars.filter(s=>(s.name||'').trim()).length)),
    stars.map((s,i)=>h('div',{className:'staritem',key:i},
      h('div',{className:'starhead'},
        h('input',{value:s.name||'',placeholder:'Nombre STAR (ej. DOSO1A)',autoCapitalize:'characters',autoCorrect:'off',spellCheck:false,
          onChange:e=>setStar(i,{name:e.target.value.toUpperCase()})}),
        h('button',{className:'catrm',title:'Eliminar',onClick:()=>onChange(stars.filter((_,j)=>j!==i))},'✕')),
      h('input',{className:'charturl',type:'url',value:s.url||'',
        placeholder:'https://… enlace a carta STAR PDF (opcional)',
        autoCapitalize:'off',autoCorrect:'off',spellCheck:false,
        onChange:e=>setStar(i,{url:e.target.value.trim()})}),
      h('div',{className:'starps'},
        h('span',{className:'starpslbl'},'Sirve a:'),
        validEps.length===0
          ? h('span',{className:'starempty'},'define primero puntos de entrada')
          : validEps.map(ep=>h('button',{key:ep,type:'button',
              className:'epchip'+((s.eps||[]).includes(ep)?' on':''),
              onClick:()=>toggleEp(i,ep)},ep))))),
    h('button',{className:'catadd',onClick:()=>onChange([...stars,{name:'',eps:[],url:''}])},'+ Agregar STAR'));
}

/* ---------------- Edición completa de una unidad aeroportuaria (drawer) ----------------
   Se abre desde el listado de la Data Base con el botón Editar. Permite modificar nombre,
   ciudad, pistas, aproximaciones, puntos de entrada y STAR. El OACI es la identidad y no
   se edita. admin → cualquier unidad; usuario de unidad → solo las suyas. */
function CatalogUnitEditor({a,user,onClose,onSave,onDelete}){
  // reconstruye los ítems con su carta PDF (mapa a.charts) para editarlos con su URL
  const initItems=list=>(list||[]).map(x=>({name:x, url:chartUrl(a.charts,x)}));
  const initStars=(a.stars||[]).map(s=>({...s, url:chartUrl(a.charts,s.name)}));
  const [name,setName]=useState(a.name||'');
  const [city,setCity]=useState(a.city||'');
  const [rwys,setRwys]=useState(initItems(a.rwys));
  const [apps,setApps]=useState(initItems(a.apps));
  const [eps,setEps]=useState(a.eps||[]);
  const [stars,setStars]=useState(initStars);
  const [err,setErr]=useState(''); const [busy,setBusy]=useState(false);
  const owns=userUnits(user).includes(a.owner);
  const dirty = JSON.stringify([name,city,rwys,apps,eps,stars])
              !==JSON.stringify([a.name||'',a.city||'',initItems(a.rwys),initItems(a.apps),a.eps||[],initStars]);
  const save=async()=>{
    setBusy(true); setErr('');
    const r=await onSave(a.icao,{name,city,rwys,apps,eps,stars});
    setBusy(false);
    if(r&&r.error) setErr(r.error);
  };
  const del=async()=>{
    if(!window.confirm('¿Eliminar la unidad aeroportuaria "'+a.icao+'" ('+a.name+')?\nSe quitará de toda la red operacional.')) return;
    setBusy(true); setErr('');
    const r=await onDelete(a.icao);
    if(r&&r.error){ setBusy(false); setErr(r.error); }
  };
  return h('div',{className:'scrim',onClick:e=>{if(e.target.className==='scrim')onClose();}},
    h('div',{className:'drawer'},
      h('div',{className:'dhead'},
        h('div',{className:'icao',style:{fontSize:18}}, a.icao),
        h('div',null,
          h('div',{style:{fontFamily:'var(--mono)',fontSize:11,color:'var(--ink-dim)',letterSpacing:'.04em'}},'Editar unidad aeroportuaria'),
          h('div',{style:{fontFamily:'var(--mono)',fontSize:9.5,color:'var(--ink-faint)',marginTop:3,letterSpacing:'.1em'}},
            (owns?'MI UNIDAD':(user.role==='admin'?'ACCESO ADMIN':''))+' · '+a.owner)),
        h('button',{className:'x',onClick:onClose},'✕')),
      h('div',{className:'dbody'},
        h('div',{className:'field'},
          h('label',null,'Ciudad'),
          h('input',{value:city,placeholder:'Santiago',style:{fontSize:14},onChange:e=>setCity(e.target.value)})),
        h('div',{className:'field'},
          h('label',null,'Nombre del aeródromo'),
          h('input',{value:name,placeholder:'A. Merino Benítez',style:{fontSize:14},onChange:e=>setName(e.target.value)})),
        h(ListEditor,{label:'Pistas', items:rwys, onChange:setRwys, placeholder:'Ej. 17L', urlPlaceholder:'https://… enlace a carta de pista PDF (opcional)'}),
        h(ListEditor,{label:'Aproximaciones', items:apps, onChange:setApps, placeholder:'Ej. ILS Z 17L', urlPlaceholder:'https://… enlace a carta de aproximación PDF (opcional)'}),
        h(EpsEditor,{eps, onChange:setEps}),
        h(StarsEditor,{stars, eps, onChange:setStars, className:'catcol bare'}),
        dirty && !err && h('div',{style:{fontFamily:'var(--mono)',fontSize:10.5,color:'var(--amber)',marginTop:4}},'● Cambios sin publicar'),
        err && h('div',{style:{fontFamily:'var(--mono)',fontSize:11,color:'var(--red)',marginTop:4}},'⚠ '+err)
      ),
      h('div',{className:'dfoot'},
        onDelete && h('button',{className:'btn ghost catdel',onClick:del,disabled:busy},'Eliminar'),
        h('button',{className:'btn ghost',style:{flex:1},onClick:onClose},'Cancelar'),
        h('button',{className:'btn primary',style:{flex:2},disabled:busy||!dirty,onClick:save},
          busy?'Publicando…':'Publicar cambios'))
    )
  );
}

/* ---------------- Alta de unidad aeroportuaria (Administrador General) ---------------- */
function AirportEditor({user,onClose,onCreate}){
  const [icao,setIcao]=useState('');
  const [city,setCity]=useState('');
  const [name,setName]=useState('');
  const [rwys,setRwys]=useState([{name:'',url:''}]);
  const [apps,setApps]=useState([]);
  const [eps,setEps]=useState([]);
  const [stars,setStars]=useState([]);
  const [err,setErr]=useState(''); const [busy,setBusy]=useState(false);
  const submit=async()=>{
    setBusy(true); setErr('');
    const r=await onCreate({icao,city,name,rwys,apps,eps,stars});
    setBusy(false);
    if(r&&r.error) setErr(r.error);
  };
  return h('div',{className:'scrim',onClick:e=>{if(e.target.className==='scrim')onClose();}},
    h('div',{className:'drawer'},
      h('div',{className:'dhead'},
        h('div',{className:'icao',style:{fontSize:18}}, icao.trim()?icao.trim().toUpperCase():'NUEVO'),
        h('div',null,
          h('div',{style:{fontFamily:'var(--mono)',fontSize:11,color:'var(--ink-dim)',letterSpacing:'.04em'}},'Agregar unidad aeroportuaria'),
          h('div',{style:{fontFamily:'var(--mono)',fontSize:9.5,color:'var(--ink-faint)',marginTop:3,letterSpacing:'.1em'}},'ALTA EN LA RED OPERACIONAL')),
        h('button',{className:'x',onClick:onClose},'✕')),
      h('div',{className:'dbody'},
        h('div',{className:'field'},
          h('label',null,'OACI ',h('span',{className:'hint'},'3-5 · ej. SCEL')),
          h('input',{value:icao,autoCapitalize:'characters',autoCorrect:'off',spellCheck:false,
            placeholder:'SCEL',onChange:e=>setIcao(e.target.value.toUpperCase())})),
        h('div',{className:'field'},
          h('label',null,'Ciudad'),
          h('input',{value:city,placeholder:'Santiago',style:{fontSize:14},onChange:e=>setCity(e.target.value)})),
        h('div',{className:'field'},
          h('label',null,'Nombre del aeródromo'),
          h('input',{value:name,placeholder:'A. Merino Benítez',style:{fontSize:14},onChange:e=>setName(e.target.value)})),
        h(ListEditor,{label:'Pistas', items:rwys, onChange:setRwys, placeholder:'Ej. 17L', urlPlaceholder:'https://… enlace a carta de pista PDF (opcional)'}),
        h(ListEditor,{label:'Aproximaciones', items:apps, onChange:setApps, placeholder:'Ej. ILS Z 17L', urlPlaceholder:'https://… enlace a carta de aproximación PDF (opcional)'}),
        h(EpsEditor,{eps, onChange:setEps}),
        h(StarsEditor,{stars, eps, onChange:setStars, className:'catcol bare'}),
        err && h('div',{style:{fontFamily:'var(--mono)',fontSize:11,color:'var(--red)',marginTop:4}},'⚠ '+err)
      ),
      h('div',{className:'dfoot'},
        h('button',{className:'btn ghost',style:{flex:1},onClick:onClose},'Cancelar'),
        h('button',{className:'btn primary',style:{flex:2},disabled:busy,onClick:submit},
          busy?'Creando…':'Crear aeródromo'))
    )
  );
}

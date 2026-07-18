// Bitácora de Posición (FORM ATC-6) — registro por dependencia + posición + día UTC
// Cada sector registra a los ATC que ocupan la posición (ENTRADA · INICIALES · SALIDA).
// La SALIDA de una fila se estampa automáticamente cuando entra el siguiente ATC; todo
// es editable para corregir errores. El usuario de unidad puede ver/editar todas las
// posiciones de su dependencia y generar un reporte imprimible de fin de día.

// Dependencias disponibles para el usuario. La dependencia ES el usuario de unidad
// (su username, p. ej. "ACCS"); el admin ve todos los usuarios de unidad existentes.
function bitDepsFor(user,users){
  if(user.role==='admin'){
    return Object.values(users||{})
      .filter(u=>u.role==='unit')
      .map(u=>u.username)
      .sort();
  }
  const d=userDep(user);
  return d?[d]:[];
}
// Posiciones (usuarios de sector) de una dependencia, uniendo las que ya tienen datos.
function bitPositions(depCode,users,node){
  const map=new Map();
  Object.values(users||{}).forEach(u=>{
    if(u.role==='sector' && userDep(u)===depCode)
      map.set(u.username,{key:u.username, position:u.posicion||'', name:u.name||u.username});
  });
  Object.keys(node||{}).forEach(k=>{
    if(!map.has(k)) map.set(k,{key:k, position:(node[k]&&node[k].position)||'', name:k});
  });
  return [...map.values()].sort((a,b)=>(a.position||a.name).localeCompare(b.position||b.name));
}
// Roster de controladores (usuarios generales con iniciales) de la dependencia.
function bitControllers(depCode,users){
  return Object.values(users||{})
    .filter(u=>u.role==='general' && u.iniciales && userDep(u)===depCode)
    .map(u=>({iniciales:u.iniciales, name:u.name||u.username, username:u.username}))
    .sort((a,b)=>a.iniciales.localeCompare(b.iniciales));
}
function bitPosLabel(p){ return p ? (p.position?('POS '+p.position):p.name) : '—'; }

function Bitacora({user,users}){
  const isSector=user.role==='sector';
  const deps=bitDepsFor(user,users);
  const [depCode,setDepCode]=useState(()=> isSector ? (userDep(user)||'') : (deps[0]||''));
  const [date,setDate]=useState(()=>bitDateUTC());
  const [posKey,setPosKey]=useState(()=> isSector ? user.username : '');
  const [node,setNode]=useState({});
  const [report,setReport]=useState(false);
  const nodeRef=useRef({});
  const pending=useRef({});
  const timer=useRef(null);
  const isToday=date===bitDateUTC();

  // suscripción en tiempo real al día de la dependencia
  useEffect(()=>{
    if(!depCode) return;
    nodeRef.current={}; setNode({});
    const sub=subscribeBitacora(depCode,date,v=>{ nodeRef.current=v||{}; setNode(v||{}); });
    return sub.stop;
  },[depCode,date]);

  const positions=bitPositions(depCode,users,node);
  const controllers=bitControllers(depCode,users);

  // mantiene una posición seleccionada válida (sector: siempre la suya)
  useEffect(()=>{
    if(isSector){ if(posKey!==user.username) setPosKey(user.username); return; }
    if(!posKey || !positions.some(p=>p.key===posKey))
      setPosKey(positions.length?positions[0].key:'');
  },[depCode,positions.length]);

  const meta=positions.find(p=>p.key===posKey) || (isSector?{key:user.username,position:user.posicion||'',name:user.name}:null);
  const rows=(node[posKey]&&node[posKey].rows)||[];
  const editable=canEditBitacora(user,depCode,posKey);

  function flushSave(){
    clearTimeout(timer.current);
    const p=pending.current; pending.current={};
    Object.keys(p).forEach(k=>saveBitacoraPos(depCode,date,k,p[k]));
  }
  function scheduleSave(k,data,immediate){
    pending.current[k]=data;
    clearTimeout(timer.current);
    if(immediate) flushSave();
    else timer.current=setTimeout(flushSave,500);
  }
  function mutatePos(k,mutate,immediate){
    const cur=nodeRef.current[k]||{rows:[]};
    const next=JSON.parse(JSON.stringify(cur.rows||[]));
    const nextRows=mutate(next)||next;
    const pm=positions.find(p=>p.key===k)||meta;
    const data={position:(pm&&pm.position)||cur.position||'', rows:nextRows, updatedAt:Date.now(), updatedBy:user.name};
    const nextNode={...nodeRef.current,[k]:data};
    nodeRef.current=nextNode; setNode(nextNode);
    scheduleSave(k,data,immediate);
  }
  function ingresar(){
    if(!editable) return;
    mutatePos(posKey,rs=>{
      const t=bitNowHHMM();
      if(rs.length && !rs[rs.length-1].salida) rs[rs.length-1].salida=t;
      rs.push({id:Date.now(),entrada:t,salida:'',iniciales:'',controller:''});
      return rs;
    },true);
  }
  function setField(i,field,val){
    mutatePos(posKey,rs=>{ if(rs[i]) rs[i][field]=val; return rs; },false);
  }
  function setIniciales(i,val){
    const ini=(val||'').toUpperCase().slice(0,5);
    const c=controllers.find(x=>x.iniciales===ini);
    mutatePos(posKey,rs=>{ if(rs[i]){ rs[i].iniciales=ini; rs[i].controller=c?c.username:''; } return rs; },false);
  }
  function removeRow(i){
    if(!editable) return;
    if(!window.confirm('¿Eliminar esta fila de la bitácora?')) return;
    mutatePos(posKey,rs=>{ rs.splice(i,1); return rs; },true);
  }

  // ---- reporte imprimible (todas las posiciones con datos del día) ----
  if(report){
    const sheets=positions.filter(p=>((node[p.key]&&node[p.key].rows)||[]).length);
    return h(BitReport,{depCode,depLabel:depName(depCode,users),date,positions:sheets.length?sheets:positions,node,onClose:()=>setReport(false)});
  }

  return h('div',null,
    h('div',{className:'phead',style:{borderTop:'none'}},
      h('h3',null,'Bitácora de posición · FORM ATC-6'),
      h('span',{className:'sub'}, depName(depCode,users)+' · '+bitLongDate(date))),
    h('div',{className:'gridwrap'},
      // ---- barra de controles ----
      h('div',{className:'toolbar'},
        deps.length>1 && h('select',{className:'bit-sel',value:depCode,onChange:e=>setDepCode(e.target.value)},
          deps.map(d=>h('option',{key:d,value:d}, depName(d,users)))),
        h('label',{className:'bit-date'},
          h('span',null,'FECHA'),
          h('input',{type:'date',value:date,max:bitDateUTC(),onChange:e=>{ flushSave(); setDate(e.target.value||bitDateUTC()); }})),
        isSector
          ? h('span',{className:'bit-poschip'},'POSICIÓN ', h('b',null, meta&&meta.position?meta.position:user.username))
          : (positions.length>0 && h('select',{className:'bit-sel',value:posKey,onChange:e=>{ flushSave(); setPosKey(e.target.value); }},
              positions.map(p=>h('option',{key:p.key,value:p.key}, bitPosLabel(p)+' · '+p.name)))),
        h('div',{style:{marginLeft:'auto',display:'flex',gap:10}},
          editable && h('button',{className:'filterbtn on',onClick:ingresar},'+ Ingresar ATC'),
          canReportBitacora(user) && h('button',{className:'filterbtn',onClick:()=>{ flushSave(); setReport(true); }},'Reporte / Imprimir'))),

      // ---- cuerpo ----
      (!depCode)
        ? h('div',{className:'empty'},'No hay dependencia asociada a tu cuenta.')
        : (!isSector && positions.length===0)
          ? h('div',{className:'empty'},'Esta dependencia no tiene posiciones (usuarios de sector) registradas. Créalas en Gestión de usuarios.')
          : h('div',{className:'bit-wrap'},
              h('datalist',{id:'bit-ini-list'},
                controllers.map(c=>h('option',{key:c.username,value:c.iniciales}, c.iniciales+' · '+c.name))),
              h('table',{className:'bit'},
                h('thead',null,h('tr',null,
                  h('th',{className:'n'},'#'),
                  h('th',null,'ENTRADA'),
                  h('th',null,'INICIALES'),
                  h('th',null,'SALIDA'),
                  editable && h('th',{className:'x'},''))),
                h('tbody',null,
                  rows.length===0
                    ? h('tr',null,h('td',{colSpan:editable?5:4,className:'bit-none'},
                        editable ? 'Sin registros. Presiona "Ingresar ATC" cuando un controlador ocupe la posición.'
                                 : 'Sin registros para esta posición en el día seleccionado.'))
                    : rows.map((r,i)=>{
                        const abierta=i===rows.length-1 && !r.salida;
                        return h('tr',{key:r.id||i, className:abierta?'open':''},
                          h('td',{className:'n'}, i+1),
                          h('td',null, editable
                            ? h('input',{className:'bit-t',value:bitFmtHHMM(r.entrada),maxLength:5,
                                inputMode:'numeric',placeholder:'HH:MM',
                                onChange:e=>setField(i,'entrada',bitCleanHHMM(e.target.value)),onBlur:flushSave})
                            : h('span',{className:'bit-ro'}, bitFmtHHMM(r.entrada)||'—')),
                          h('td',null, editable
                            ? h('input',{className:'bit-i',value:r.iniciales||'',list:'bit-ini-list',
                                autoCapitalize:'characters',placeholder:'INI',
                                onChange:e=>setIniciales(i,e.target.value),onBlur:flushSave})
                            : h('span',{className:'bit-ro'}, r.iniciales||'—')),
                          h('td',null, editable
                            ? h('input',{className:'bit-t',value:bitFmtHHMM(r.salida),maxLength:5,
                                inputMode:'numeric',placeholder: abierta?'en posición':'HH:MM',
                                onChange:e=>setField(i,'salida',bitCleanHHMM(e.target.value)),onBlur:flushSave})
                            : h('span',{className:'bit-ro'}, bitFmtHHMM(r.salida)|| (abierta?'en posición':'—'))),
                          editable && h('td',{className:'x'},
                            h('button',{className:'bit-rm',title:'Eliminar fila',onClick:()=>removeRow(i)},'×')));
                      }))),
              node[posKey]&&node[posKey].updatedBy && h('div',{className:'bit-foot'},
                'Última edición · '+node[posKey].updatedBy+' · '+ageMin(node[posKey].updatedAt)),
              !editable && h('div',{className:'bit-foot ro'},'Solo lectura — no tienes permiso para editar esta posición.'),
              isToday && editable && h('div',{className:'bit-hint'},
                'La SALIDA se estampa sola al ingresar el próximo ATC. Puedes corregir cualquier hora o inicial.'))
    )
  );
}

/* -------- Reporte imprimible: réplica del FORM ATC-6 por posición -------- */
function BitReport({depCode,depLabel,date,positions,node,onClose}){
  const depTxt=depLabel||depCode;
  const MINLINES=18;
  const sheet=(p,idx)=>{
    const rows=(node[p.key]&&node[p.key].rows)||[];
    const lines=rows.slice();
    while(lines.length<MINLINES) lines.push(null);
    return h('div',{className:'bitsheet',key:p.key},
      h('div',{className:'bs-formno'},'FORM. ATC - 6'),
      h('table',{className:'bs-head'},h('tbody',null,
        h('tr',null,
          h('td',{className:'bs-org',rowSpan:2},
            h('div',{className:'bs-l1'},'DIRECCION DE AERONAUTICA'),
            h('div',{className:'bs-l2'},'BITACORA DE POSICION')),
          h('td',{className:'bs-k'},'FECHA'),
          h('td',{className:'bs-v'}, bitLongDate(date))),
        h('tr',null,
          h('td',{className:'bs-k'},'PAGINA'),
          h('td',{className:'bs-v'}, String(idx+1).padStart(2,'0'))),
        h('tr',null,
          h('td',{className:'bs-k'},'DEPENDENCIA'),
          h('td',{className:'bs-v big'}, depTxt),
          h('td',{className:'bs-k'},'POSICION'),
          h('td',{className:'bs-v big'}, p.position||p.name)))),
      h('table',{className:'bs-grid'},
        h('thead',null,h('tr',null,
          h('th',null,'ENTRADA'),h('th',null,'INICIALES'),h('th',null,'SALIDA'))),
        h('tbody',null,
          lines.map((r,i)=>h('tr',{key:i},
            h('td',null, r?bitFmtHHMM(r.entrada):''),
            h('td',{className:'ini'}, r?(r.iniciales||''):''),
            h('td',null, r?bitFmtHHMM(r.salida):''))))));
  };
  return h('div',{className:'bitprint'},
    h('div',{className:'bitprint-bar'},
      h('div',null, h('b',null,'REPORTE BITÁCORA'),' · '+depTxt+' · '+bitLongDate(date)+' · '+positions.length+' posición(es)'),
      h('div',{style:{display:'flex',gap:10}},
        h('button',{className:'btn primary',onClick:()=>window.print()},'Imprimir'),
        h('button',{className:'btn ghost',onClick:onClose},'Cerrar'))),
    h('div',{className:'bitprint-body'},
      positions.length===0
        ? h('div',{style:{color:'#333',fontFamily:'var(--mono)',padding:20}},'No hay registros para imprimir en este día.')
        : positions.map((p,i)=>sheet(p,i))));
}

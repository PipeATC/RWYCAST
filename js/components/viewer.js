// Visor operacional — Viewer / AirportCard / Editor, …
function Viewer({airports,allAirports,allCount,mine,changedNow,query,setQuery,filter,setFilter,user,onEdit,editingIcao,onCancelEdit,onPublish,metars,watch,onAddWatch,onRemoveWatch,onReorder}){
  const [adding,setAdding]=useState(false);
  const [dragIcao,setDragIcao]=useState(null);   // OACI de la tarjeta que se arrastra
  const ifrCount=airports.filter(a=>{const m=metars[a.icao];return m&&(m.cat==='IFR'||m.cat==='LIFR');}).length;
  const mineMode=filter==='mine';
  const available=allAirports.filter(a=>!watch.includes(a.icao));
  // sólo se puede reordenar en Mi jurisdicción, sin búsqueda activa (orden = watch)
  const canReorder=mineMode && !query.trim() && typeof onReorder==='function' && airports.length>1;

  // arrastre con Pointer Events (mouse y táctil). Al pasar sobre otra tarjeta,
  // reordena en vivo; el nuevo orden se persiste en la configuración del usuario.
  const startDrag=icao=>e=>{
    if(!canReorder) return;
    e.preventDefault();
    setDragIcao(icao);
    let lastOver=icao;   // evita re-disparar (y oscilar) mientras se está sobre la misma tarjeta
    document.body.classList.add('reordering');
    const move=ev=>{
      const el=document.elementFromPoint(ev.clientX,ev.clientY);
      const card=el&&el.closest&&el.closest('[data-icao]');
      const over=card&&card.getAttribute('data-icao');
      if(over&&over!==icao&&over!==lastOver){ onReorder(icao,over); lastOver=over; }
      else if(over===icao) lastOver=icao;   // volvió sobre sí misma: permite reordenar de nuevo
    };
    const up=()=>{
      setDragIcao(null);
      document.body.classList.remove('reordering');
      window.removeEventListener('pointermove',move);
      window.removeEventListener('pointerup',up);
      window.removeEventListener('pointercancel',up);
    };
    window.addEventListener('pointermove',move);
    window.addEventListener('pointerup',up);
    window.addEventListener('pointercancel',up);
  };

  return h('div',null,
    h('div',{className:'gridwrap'},
      h('div',{className:'toolbar'},
        h('div',{className:'search'}, Ic.search({}),
          h('input',{value:query,placeholder:'Buscar OACI / ciudad…',onChange:e=>setQuery(e.target.value)})),
        h('button',{className:'filterbtn'+(mineMode?' on':''),onClick:()=>setFilter('mine')},'Mi jurisdicción'),
        h('button',{className:'filterbtn'+(filter==='all'?' on':''),onClick:()=>setFilter('all')},'Toda la red'),
      ),
      canReorder && h('div',{className:'reorderhint'},'↕ Arrastra el asa de cada tarjeta para reordenar tu jurisdicción'),
      (!mineMode && airports.length===0)
        ? h('div',{className:'empty'},'Sin aeródromos que coincidan con el filtro.')
        : h('div',{className:'apgrid'+(editingIcao?' editing':'')},
            airports.map(a=>h(AirportCard,{key:a.icao,a,user,onEdit,metars,
              edit:editingIcao===a.icao,onCancelEdit,onPublish,
              onRemove:mineMode?onRemoveWatch:null,
              onDragHandle:canReorder?startDrag(a.icao):null,
              dragging:dragIcao===a.icao})),
            mineMode && h(AddCard,{key:'__add',onClick:()=>setAdding(true)}))
    ),
    adding && h(AddPicker,{available,onAdd:onAddWatch,onClose:()=>setAdding(false)})
  );
}

/* tarjeta-botón para agregar aeródromos a la vista personal */
function AddCard({onClick}){
  return h('button',{className:'apcard addcard',onClick},
    h('div',{className:'addplus'},'+'),
    h('div',{className:'addtxt'},'Agregar aeródromo'),
    h('div',{className:'addsub'},'a Mi jurisdicción'));
}

/* selector de aeródromos disponibles para agregar */
function AddPicker({available,onAdd,onClose}){
  return h('div',{className:'scrim center',onClick:e=>{if(e.target===e.currentTarget)onClose();}},
    h('div',{className:'pickbox'},
      h('div',{className:'pickhead'},
        h('b',null,'Agregar a Mi jurisdicción'),
        h('button',{className:'x',onClick:onClose},'✕')),
      h('div',{className:'picklist'},
        available.length===0
          ? h('div',{className:'empty'},'Ya tienes todos los aeródromos de la red en tu vista.')
          : available.map(a=>h('button',{key:a.icao,className:'pickrow',onClick:()=>onAdd(a.icao)},
              h('span',{className:'pickicao'},a.icao),
              h('span',{className:'picknm'},a.name+' · '+a.city),
              h('span',{className:'pickplus'},'+ Agregar')))))
  );
}

// construye el src del PDF ocultando la barra de utilidades del visor de Chrome
function pdfSrc(url){
  return url + (url.includes('#')?'&':'#') + 'toolbar=0&navpanes=0&scrollbar=0';
}
// abre la carta PDF en una ventana emergente de Chrome, sin barra de herramientas PDF
// ni barra de direcciones/menús (popup minimal). El navegador puede forzar mostrar el
// origen por seguridad; con estos flags se obtiene la ventana más limpia posible.
function openChart(url){
  if(!url) return;
  const feats='popup=yes,location=no,menubar=no,toolbar=no,status=no,titlebar=no,'
    +'scrollbars=yes,resizable=yes,width=920,height=1040';
  window.open(pdfSrc(url),'rwycast_chart',feats);
}
// nombre de pista/aprox/STAR: si tiene carta PDF en el catálogo, se muestra como
// enlace que abre el documento en una ventana emergente
function chartName(name,charts,key,onOpen){
  const url=chartUrl(charts,name);
  return url
    ? h('a',{key,className:'chartlink',href:url,
        title:'Ver carta PDF de '+name,
        onClick:e=>{e.preventDefault(); onOpen(url,name);}},
        name, h('span',{className:'chartic',title:'Ver carta PDF'},' ↗'))
    : h('span',{key},name);
}
// lista de nombres separados por " / ", cada uno enlazable a su carta PDF
function chartList(names,charts,onOpen){
  const arr=names||[];
  if(!arr.length) return '—';
  const out=[];
  arr.forEach((n,i)=>{
    if(i) out.push(h('span',{key:'sep'+i,className:'chsep'},' / '));
    out.push(chartName(n,charts,'n'+i,onOpen));
  });
  return out;
}

// selector inline: al presionar despliega una lista seleccionable (modo edición)
function CardPick({value,options,onChange,renderVal,placeholder,className}){
  const [open,setOpen]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{
    if(!open) return;
    const close=e=>{ if(ref.current&&!ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown',close);
    return ()=>document.removeEventListener('pointerdown',close);
  },[open]);
  const empty=value===''||value==null;
  const cur=(options||[]).find(o=>o.value===value);
  const shown=empty?(placeholder||'—'):(renderVal?renderVal(value):(cur?cur.label:value));
  return h('div',{className:'cardpick-wrap'+(className?' '+className:''),ref:ref},
    h('button',{type:'button',className:'cardpick-btn'+(open?' open':'')+(empty?' empty':''),
      onClick:()=>setOpen(v=>!v)},
      h('span',{className:'cardpick-lbl'},shown),
      h('span',{className:'cardpick-caret'},open?'▴':'▾')),
    open&&h('div',{className:'cardpick-menu'},
      (options||[]).length===0
        ? h('div',{className:'cardpick-none'},'Sin opciones')
        : options.map(o=>h('button',{type:'button',key:String(o.value),
            className:'cardpick-opt'+(o.value===value?' on':''),
            onClick:()=>{ onChange(o.value); setOpen(false); }}, o.label))));
}

// fila fija (visor): EP + STAR (izq) | aproximación (der)
function EpFlowRow({ep,star,apps,charts,head}){
  if(head) return h('div',{className:'epflow head'},
    h('div',{className:'epflow-l'},
      h('span',{className:'k'},'Punto de entrada'),
      h('span',{className:'k sub'},'STAR en uso')),
    h('div',{className:'epflow-r k'},'Aproximación'));
  return h('div',{className:'epflow'},
    h('div',{className:'epflow-l'},
      h('div',{className:'ep-name'},ep||'—'),
      h('div',{className:'ep-star'+(star?'':' empty')},
        star?chartName(star,charts,'s',openChart):'—')),
    h('div',{className:'ep-app'+(apps.length?'':' empty')},
      apps.length?chartList(apps,charts,openChart):'—'));
}

// fila en edición: punto de entrada + STAR (izq) | aproximación (der), todo seleccionable
function EpEditRow({a,ep,usedEps,epuse,appuse,rwyu,onEp,onStar,onApp,onRemove}){
  const epOpts=(a.eps||[]).filter(e=>e===ep||!usedEps.includes(e)).map(e=>({value:e,label:e}));
  const star=epuse[ep]||'';
  const starOpts=starsForEp(a.stars,ep).map(s=>({value:s,label:s}));
  const app=appuse[ep]||'';
  const appPool=appsForStar(a.apps,a.apps,star,rwyu);
  const appOpts=(appPool.length?appPool:(a.apps||[])).map(x=>({value:x,label:x}));
  return h('div',{className:'epflow editing'},
    h('div',{className:'epflow-l'},
      h(CardPick,{className:'ep',value:ep,options:epOpts,onChange:onEp,placeholder:'Punto —'}),
      h(CardPick,{className:'star',value:star,options:starOpts,onChange:onStar,placeholder:'STAR —'})),
    h('div',{className:'epflow-r'},
      h(CardPick,{className:'app',value:app,options:appOpts,onChange:onApp,placeholder:'Aprox —'}),
      h('button',{type:'button',className:'eprm',title:'Quitar punto de entrada',onClick:onRemove},'✕')));
}

function AirportCard({a,user,onEdit,edit,onCancelEdit,onPublish,metars,onRemove,onDragHandle,dragging}){
  const canEdit=canEditAirport(user,a);
  const m=metars[a.icao];
  const chg=a.changed||[];
  const eps=a.eps||[];
  const [showAllEps,setShowAllEps]=useState(false);
  // borrador local para la edición inline
  const [dRwy,setDRwy]=useState('');
  const [dMode,setDMode]=useState('');
  const [dSel,setDSel]=useState([]);
  const [dEpuse,setDEpuse]=useState({});
  const [dAppuse,setDAppuse]=useState({});
  useEffect(()=>{ setShowAllEps(false); },[a.icao]);
  // al entrar en edición, inicializa el borrador desde la operación vigente
  useEffect(()=>{
    if(!edit) return;
    setDRwy((a.rwyu&&a.rwyu[0])||(a.rwys&&a.rwys[0])||'');
    setDMode(a.rwymode||'');
    const sel=((a.epsel&&a.epsel.length)?a.epsel:eps).filter(x=>eps.includes(x));
    setDSel(sel.length?sel.slice(0,8):eps.slice(0,4));
    setDEpuse({...(a.epuse||{})});
    setDAppuse({...(a.appuse||{})});
  },[edit,a.icao]);

  const rwyTxt=(a.rwyu&&a.rwyu.length)?a.rwyu.join(' / ').toUpperCase():'—';
  const modeTxt=a.rwymode||'—';
  // aproximación por punto de entrada (appuse); si el aeródromo aún no la tiene, se deriva de appu
  const appForEp=(ep,star)=>{
    if(a.appuse&&a.appuse[ep]) return [a.appuse[ep]];
    return appDisplayForStar(a.apps,a.appu,star,a.rwyu);
  };
  const epPrimary=(a.epsel&&a.epsel.length)
    ? a.epsel.filter(x=>eps.includes(x)).slice(0,4)
    : eps.slice(0,4);
  const epShown=showAllEps?eps:epPrimary;

  // ---------- modo edición inline ----------
  if(edit){
    const rwyOpts=(a.rwys||[]).map(r=>({value:r,label:r.toUpperCase()}));
    const modeOpts=[{value:'',label:'Ninguna'},{value:'Mixta',label:'Mixta'},
      {value:'Semi-Mixta',label:'Semi-Mixta'},{value:'Segregada',label:'Segregada'}];
    const draftRwyu=dRwy?[dRwy]:(a.rwyu||[]);
    const unused=eps.filter(e=>!dSel.includes(e));
    const setEpAt=(i,newEp)=>setDSel(prev=>prev.map((e,j)=>j===i?newEp:e));
    // diff contra la operación vigente
    const diff=[];
    const curRwy=(a.rwyu&&a.rwyu[0])||'';
    if(curRwy!==dRwy) diff.push({field:'rwyu',from:(curRwy||'—').toUpperCase(),to:(dRwy||'—').toUpperCase()});
    if((a.rwymode||'')!==dMode) diff.push({field:'rwymode',from:(a.rwymode||'Ninguna'),to:(dMode||'Ninguna')});
    if((a.epsel||[]).join(' / ')!==dSel.join(' / '))
      diff.push({field:'epsel',from:((a.epsel||[]).join(' / ')||'—'),to:(dSel.join(' / ')||'—')});
    dSel.forEach(ep=>{
      if(((a.epuse||{})[ep]||'')!==(dEpuse[ep]||''))
        diff.push({field:'epuse',from:ep+' → '+(((a.epuse||{})[ep])||'—'),to:ep+' → '+(dEpuse[ep]||'—')});
      if(((a.appuse||{})[ep]||'')!==(dAppuse[ep]||''))
        diff.push({field:'appuse',from:ep+' → '+(((a.appuse||{})[ep])||'—'),to:ep+' → '+(dAppuse[ep]||'—')});
    });
    const publish=()=>{
      const appu=[...new Set(dSel.map(ep=>dAppuse[ep]).filter(Boolean))];
      onPublish(a.icao,{rwyu:dRwy?[dRwy]:[],rwymode:dMode,epsel:dSel,epuse:dEpuse,appuse:dAppuse,appu},diff);
    };
    return h('div',{className:'apcard editmode'+(chg.length?' changed':''),'data-icao':a.icao},
      h('div',{className:'crest'},
        h('div',{className:'crest-l'},
          h('div',{className:'icao'},a.icao),
          h('div',{className:'nm'},a.name),
          h('div',{className:'city'},a.city.toUpperCase())),
        h('div',{className:'crest-r'},
          h('div',{className:'k'},'Pista en uso'),
          h(CardPick,{className:'rwy',value:dRwy,options:rwyOpts,onChange:setDRwy,
            renderVal:v=>(v||'—').toUpperCase(),placeholder:'—'}),
          h('div',{className:'k modek'},'Modalidad'),
          h(CardPick,{className:'mode',value:dMode,options:modeOpts,onChange:setDMode,
            renderVal:v=>v||'—',placeholder:'—'}))),
      h('div',{className:'apstack eplist'},
        h('div',{className:'epflow head'},
          h('div',{className:'epflow-l'},
            h('span',{className:'k'},'Punto de entrada'),
            h('span',{className:'k sub'},'STAR en uso')),
          h('div',{className:'epflow-r k'},'Aproximación')),
        dSel.map((ep,i)=>h(EpEditRow,{key:i,a,ep,usedEps:dSel,epuse:dEpuse,appuse:dAppuse,rwyu:draftRwyu,
          onEp:v=>setEpAt(i,v),
          onStar:v=>setDEpuse(prev=>({...prev,[ep]:v})),
          onApp:v=>setDAppuse(prev=>({...prev,[ep]:v})),
          onRemove:()=>setDSel(prev=>prev.filter((_,j)=>j!==i))})),
        unused.length>0 && h('button',{type:'button',className:'epmore',
          onClick:()=>setDSel(prev=>[...prev,unused[0]])},'+ Agregar punto de entrada')),
      h('div',{className:'apedit-foot'},
        h('button',{type:'button',className:'btn ghost',onClick:onCancelEdit},'Cancelar'),
        h('button',{type:'button',className:'btn primary',disabled:diff.length===0||!dRwy,onClick:publish},
          !dRwy?'Elige pista'
            :(diff.length?('Publicar '+diff.length+' cambio'+(diff.length>1?'s':'')):'Sin cambios'))));
  }

  // ---------- modo visor ----------
  return h('div',{className:'apcard'+(chg.length?' changed':'')+(dragging?' dragging':''),'data-icao':a.icao},
    h('div',{className:'crest'},
      onDragHandle && h('span',{className:'draghandle',title:'Arrastra para reordenar',
        onPointerDown:onDragHandle,style:{touchAction:'none'}},'⠿'),
      h('div',{className:'crest-l'},
        h('div',{className:'icao'},a.icao),
        h('div',{className:'nm'},a.name),
        h('div',{className:'city'},a.city.toUpperCase())),
      h('div',{className:'crest-r'},
        h('div',{className:'k'},'Pista en uso'),
        h('div',{className:'rwyhero'+(chg.includes('rwyu')?' changed':'')}, rwyTxt),
        h('div',{className:'rwymode'+(a.rwymode?'':' none')+(chg.includes('rwymode')?' changed':'')}, modeTxt))),
    eps.length>0
      ? h('div',{className:'apstack eplist'},
          h(EpFlowRow,{head:true}),
          epShown.map(ep=>{
            const star=starDisplayVal(a.stars,a.epuse,ep);
            const apps=appForEp(ep,star);
            return h(EpFlowRow,{key:ep,ep,star,apps,charts:a.charts});
          }),
          (eps.length>epPrimary.length)&&h('button',{type:'button',className:'epmore',
            onClick:()=>setShowAllEps(v=>!v)},
            showAllEps?'− Ver 4 puntos':('+ Ver los '+eps.length+' puntos de entrada')))
      : h('div',{className:'apstack'},
          h('div',{className:'opslot'},
            h('div',{className:'k'},'Aproximación'),
            h('div',{className:'val'+((a.appu&&a.appu.length)?'':' empty')},
              (a.appu&&a.appu.length)?chartList(a.appu,a.charts,openChart):'—'))),
    m && h('div',{className:'metarline'},
      m.cat && h('span',{className:'fr '+m.cat},m.cat),
      h('span',null,m.raw),
      m.obsTime && h('span',{className:'mage',title:'Antigüedad de la observación'}, ageMin(m.obsTime*1000))),
    h('div',{className:'apfoot'},
      h('span',{className:'age'},'Actualizado '+ageMin(a.updatedAt)),
      h('span',{className:'by'},'· '+(a.updatedBy||'—')),
      onRemove && h('span',{className:'editlink rm',title:'Quitar de Mi jurisdicción',
        onClick:()=>onRemove(a.icao)},'Quitar'),
      h('span',{className:'editlink'+(canEdit?'':' locked'),
        title:canEdit?'':'Tu rol no permite editar este aeródromo',
        onClick:()=>canEdit&&onEdit(a.icao)}, canEdit?'Editar':'Solo lectura'))
  );
}

// (edición operacional ahora es inline en la tarjeta — ver AirportCard modo edición)

// Visor operacional — Viewer / AirportCard / Editor, …
function Viewer({airports,allAirports,allCount,mine,changedNow,query,setQuery,filter,setFilter,user,onEdit,metars,watch,onAddWatch,onRemoveWatch,onReorder}){
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
        : h('div',{className:'apgrid'},
            airports.map(a=>h(AirportCard,{key:a.icao,a,user,onEdit,metars,
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

function AirportCard({a,user,onEdit,metars,onRemove,onDragHandle,dragging}){
  const owns=userUnits(user).includes(a.owner);
  const canEdit=canEditAirport(user,a);
  const m=metars[a.icao];
  const chg=a.changed||[];
  const fldNode=(key,label,arr)=>h('div',{className:'opf'+(chg.includes(key)?' changed':'')},
    h('div',{className:'k'},label),
    h('div',{className:'val'+((arr&&arr.length)?'':' empty')}, (arr&&arr.length)?chartList(arr,a.charts,openChart):'—'));
  return h('div',{className:'apcard'+(chg.length?' changed':'')+(dragging?' dragging':''),'data-icao':a.icao},
    h('div',{className:'crest'},
      onDragHandle && h('span',{className:'draghandle',title:'Arrastra para reordenar',
        onPointerDown:onDragHandle,style:{touchAction:'none'}},'⠿'),
      h('div',null,
        h('div',{className:'icao'},a.icao),
        h('div',{className:'nm'},a.name),
        h('div',{className:'city'},a.city.toUpperCase())),
      h('div',{className:'owntag'},
        h('b',null,a.owner),
        owns?h('span',{style:{color:'var(--phos)'}},'MI UNIDAD')
            :(user.role==='admin'?h('span',null,'ADMIN'):h('span',null,'')))),
    h('div',{className:'opfields two'},
      fldNode('rwyu','Pista en uso', a.rwyu),
      fldNode('appu','Aproximación', a.appu)),
    (a.eps&&a.eps.length>0) && h('div',{className:'eplist'},
      a.eps.map((ep,i)=>{
        const inUse=(a.epuse||{})[ep]||'';
        return h('div',{className:'eprow',key:i},
          h('div',{className:'epf'},
            h('div',{className:'k'},'Punto de entrada'),
            h('div',{className:'val'+(ep?'':' empty')}, ep||'—')),
          h('div',{className:'epf'},
            h('div',{className:'k'},'STAR en uso'),
            h('div',{className:'val'+(inUse?'':' empty')}, inUse?chartName(inUse,a.charts,'star',openChart):'—')));
      })),
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
        onClick:()=>canEdit&&onEdit(a)}, canEdit?'Editar':'Solo lectura'))
  );
}

/* ---------------- Editor Drawer ---------------- */
function Editor({ap,user,onClose,onSave}){
  const [rwyu,setRwyu]=useState(ap.rwyu||[]);
  const [appu,setAppu]=useState(ap.appu||[]);
  const [epuse,setEpuse]=useState(ap.epuse||{});
  const diff=[];
  const cmpUse=(field,oldArr,newArr)=>{
    const a=(oldArr||[]).join(' / '), b=(newArr||[]).join(' / ');
    if(a!==b) diff.push({field,from:a||'—',to:b||'—'});
  };
  cmpUse('rwyu',ap.rwyu,rwyu); cmpUse('appu',ap.appu,appu);
  if(epUseStr(ap.eps,ap.epuse)!==epUseStr(ap.eps,epuse))
    diff.push({field:'epuse',from:epUseStr(ap.eps,ap.epuse),to:epUseStr(ap.eps,epuse)});

  // selección múltiple: alterna la pertenencia de cada opción en el arreglo "en uso"
  const segMulti=(label,opts,sel,set)=>h('div',{className:'field'},
    h('label',null,label,' ',h('span',{className:'hint'},'una o más')),
    h('div',{className:'seg'}, opts.map(o=>h('button',{key:o,className:sel.includes(o)?'on':'',
      onClick:()=>set(sel.includes(o)?sel.filter(x=>x!==o):[...sel,o])},o))));

  return h('div',{className:'scrim',onClick:e=>{if(e.target.className==='scrim')onClose();}},
    h('div',{className:'drawer'},
      h('div',{className:'dhead'},
        h('div',{className:'icao'},ap.icao),
        h('div',null,
          h('div',{style:{fontFamily:'var(--mono)',fontSize:11,color:'var(--ink-dim)',letterSpacing:'.04em'}},ap.name),
          h('div',{style:{fontFamily:'var(--mono)',fontSize:9.5,color:'var(--ink-faint)',marginTop:3,letterSpacing:'.1em'}},'CONFIGURACIÓN OPERACIONAL')),
        h('button',{className:'x',onClick:onClose},'✕')),
      h('div',{className:'dbody'},
        diff.length>0 && h('div',{className:'diffbox'},
          h('div',{className:'dl'},'⚠ Cambios pendientes de publicación'),
          diff.map(d=>h('div',{className:'diffrow',key:d.field},
            h('b',null,fieldLabel(d.field)),
            h('span',{className:'from'},d.from), h('span',null,'→'), h('span',{className:'to'},d.to)))),
        segMulti('Pistas en uso', ap.rwys, rwyu, setRwyu),
        segMulti('Aproximaciones en uso', ap.apps, appu, setAppu),
        (ap.eps&&ap.eps.length>0) && h('div',{className:'field'},
          h('label',null,'STAR en uso por punto de entrada ',h('span',{className:'hint'},'una por punto')),
          h('div',{className:'epuse'},
            ap.eps.map((ep,i)=>{
              const opts=starsForEp(ap.stars,ep);
              return h('div',{className:'epuserow',key:i},
                h('div',{className:'epusep'}, ep),
                opts.length===0
                  ? h('span',{className:'epusenone'},'sin STAR en Data Base')
                  : h('div',{className:'seg'}, opts.map(o=>h('button',{key:o,
                      className:(epuse[ep]===o)?'on':'',
                      onClick:()=>setEpuse({...epuse,[ep]:o})},o))));
            }))),
        h('div',{className:'field'},
          h('label',null,'Observación operacional ',h('span',{className:'hint'},'opcional')),
          h('textarea',{placeholder:'Ej. cambio por viento 210/14, pista preferencial nocturna…'}))
      ),
      h('div',{className:'dfoot'},
        h('button',{className:'btn ghost',style:{flex:1},onClick:onClose},'Cancelar'),
        h('button',{className:'btn primary',style:{flex:2},disabled:diff.length===0||rwyu.length===0,
          onClick:()=>onSave(ap.icao,{rwyu,appu,epuse},diff)},
          rwyu.length===0?'Selecciona pista en uso'
            :(diff.length?('Publicar '+diff.length+' cambio'+(diff.length>1?'s':'')):'Sin cambios')))
    )
  );
}

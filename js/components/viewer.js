// Visor operacional — Viewer / AirportCard / Editor, …
function Viewer({airports,allAirports,allCount,mine,changedNow,query,setQuery,filter,setFilter,user,onEdit,metars,watch,onAddWatch,onRemoveWatch}){
  const [adding,setAdding]=useState(false);
  const ifrCount=airports.filter(a=>{const m=metars[a.icao];return m&&(m.cat==='IFR'||m.cat==='LIFR');}).length;
  const mineMode=filter==='mine';
  const available=allAirports.filter(a=>!watch.includes(a.icao));
  return h('div',null,
    h('div',{className:'gridwrap'},
      h('div',{className:'toolbar'},
        h('div',{className:'search'}, Ic.search({}),
          h('input',{value:query,placeholder:'Buscar OACI / ciudad…',onChange:e=>setQuery(e.target.value)})),
        h('button',{className:'filterbtn'+(mineMode?' on':''),onClick:()=>setFilter('mine')},'Mi jurisdicción'),
        h('button',{className:'filterbtn'+(filter==='all'?' on':''),onClick:()=>setFilter('all')},'Toda la red'),
      ),
      (!mineMode && airports.length===0)
        ? h('div',{className:'empty'},'Sin aeródromos que coincidan con el filtro.')
        : h('div',{className:'apgrid'},
            airports.map(a=>h(AirportCard,{key:a.icao,a,user,onEdit,metars,
              onRemove:mineMode?onRemoveWatch:null})),
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

function AirportCard({a,user,onEdit,metars,onRemove}){
  const owns=userUnits(user).includes(a.owner);
  const canEdit=canEditAirport(user,a);
  const m=metars[a.icao];
  const chg=a.changed||[];
  const fld=(key,label,val)=>h('div',{className:'opf'+(chg.includes(key)?' changed':'')},
    h('div',{className:'k'},label),
    h('div',{className:'val'+(val?'':' empty')}, val||'—'));
  return h('div',{className:'apcard'+(chg.length?' changed':'')},
    h('div',{className:'crest'},
      h('div',null,
        h('div',{className:'icao'},a.icao),
        h('div',{className:'nm'},a.name),
        h('div',{className:'city'},a.city.toUpperCase())),
      h('div',{className:'owntag'},
        h('b',null,a.owner),
        owns?h('span',{style:{color:'var(--phos)'}},'MI UNIDAD')
            :(user.role==='admin'?h('span',null,'ADMIN'):h('span',null,'')))),
    h('div',{className:'opfields two'},
      fld('rwyu','Pista en uso', (a.rwyu||[]).join(' / ')),
      fld('appu','Aproximación', (a.appu||[]).join(' / '))),
    (a.eps&&a.eps.length>0) && h('div',{className:'eplist'},
      a.eps.map((ep,i)=>{
        const inUse=(a.epuse||{})[ep]||'';
        return h('div',{className:'eprow',key:i},
          h('div',{className:'epf'},
            h('div',{className:'k'},'Punto de entrada'),
            h('div',{className:'val'+(ep?'':' empty')}, ep||'—')),
          h('div',{className:'epf'},
            h('div',{className:'k'},'STAR en uso'),
            h('div',{className:'val'+(inUse?'':' empty')}, inUse||'—')));
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
                  ? h('span',{className:'epusenone'},'sin STAR en catálogo')
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

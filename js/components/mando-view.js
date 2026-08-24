// Cuadro de Mando — dashboard gerencial de estado integral de la red.
// Replica la lógica del visor (buscador + "Mi jurisdicción" / "Toda la red") y muestra,
// por aeródromo, una tarjeta que resume pista en uso, METAR, estado de equipamiento y
// NOTAM; al hacer clic se expande de un resumen a la información completa.
function CuadroMando({airports,user,metars,equipos,watch,onAddWatch,onRemoveWatch}){
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState('mine');
  const [expanded,setExpanded]=useState(()=>new Set());
  const [adding,setAdding]=useState(false);
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

  const toggle=icao=>setExpanded(prev=>{ const n=new Set(prev); n.has(icao)?n.delete(icao):n.add(icao); return n; });
  const allOpen=visible.length>0 && visible.every(a=>expanded.has(a.icao));
  const setAll=open=>setExpanded(open?new Set(visible.map(a=>a.icao)):new Set());

  // KPIs de red sobre lo visible
  const usAir=visible.filter(a=>{const it=(equipos[a.icao]||{}).items||[];return it.some(x=>x.estado==='U/S');}).length;
  const ifrAir=visible.filter(a=>{const m=metars[a.icao];return m&&(m.cat==='IFR'||m.cat==='LIFR');}).length;
  const notamCount=visible.reduce((s,a)=>s+(((equipos[a.icao]||{}).notams||[]).length),0);
  const kpi=(label,value,color)=>h('div',{className:'dash-kpi'},
    h('div',{className:'dash-kpi-l'},label),
    h('div',{className:'dash-kpi-v',style:color?{color}:null}, value));

  return h('div',null,
    h('div',{className:'phead',style:{borderTop:'none'}},
      h('h3',null,'Cuadro de Mando'),
      h('span',{className:'sub'}, 'ESTADO INTEGRAL · '+(mineMode?'MI JURISDICCIÓN':'TODA LA RED'))),
    h('div',{className:'gridwrap'},
      h('div',{className:'toolbar'},
        h('div',{className:'search'}, Ic.search({}),
          h('input',{value:query,placeholder:'Buscar OACI / ciudad…',onChange:e=>setQuery(e.target.value)})),
        h('button',{className:'filterbtn'+(mineMode?' on':''),onClick:()=>setFilter('mine')},'Mi jurisdicción'),
        h('button',{className:'filterbtn'+(filter==='all'?' on':''),onClick:()=>setFilter('all')},'Toda la red'),
        visible.length>0 && h('button',{className:'filterbtn',style:{marginLeft:'auto'},
          onClick:()=>setAll(!allOpen)}, allOpen?'Contraer todo':'Expandir todo')),
      h('div',{className:'dash-kpis mando-kpis'},
        kpi('Aeródromos', visible.length),
        kpi('Con equipos U/S', usAir, usAir?'var(--red)':null),
        kpi('En IFR / LIFR', ifrAir, ifrAir?'var(--amber)':null),
        kpi('NOTAM vigentes', notamCount, notamCount?'var(--sky)':null)),
      (visible.length===0)
        ? h('div',{className:'empty'}, mineMode?'Aún no agregas aeródromos a Mi jurisdicción.':'Sin aeródromos que coincidan con el filtro.')
        : h('div',{className:'mandogrid'},
            visible.map(a=>h(MandoCard,{key:a.icao,a,metars,doc:equipos[a.icao],
              open:expanded.has(a.icao),onToggle:()=>toggle(a.icao),
              onRemove:mineMode?()=>onRemoveWatch(a.icao):null})),
            mineMode && h(AddCard,{key:'__add',onClick:()=>setAdding(true)}))),
    adding && h(AddPicker,{available,onAdd:onAddWatch,onClose:()=>setAdding(false)})
  );
}

/* tarjeta expandible: resumen ↔ información completa */
function MandoCard({a,metars,doc,open,onToggle,onRemove}){
  const m=metars[a.icao];
  const items=(doc&&doc.items)||[];
  const notams=(doc&&doc.notams)||[];
  const rwyTxt=(a.rwyu&&a.rwyu.length)?a.rwyu.join(' / ').toUpperCase():'—';
  const worst=eqWorstStatus(items);
  const usCount=items.filter(x=>x.estado==='U/S').length;
  const obsCount=items.filter(x=>x.estado==='DEGR'||x.estado==='MANT').length;
  const eqTxt=items.length===0?'sin datos':(usCount?usCount+' U/S':obsCount?obsCount+' en obs.':'operativo');
  const eps=a.eps||[];
  const epPrimary=(a.epsel&&a.epsel.length)?a.epsel.filter(x=>eps.includes(x)):eps.slice(0,4);

  // ---- cabecera (siempre visible): resumen ----
  const head=h('button',{type:'button',className:'mando-head',onClick:onToggle,
    title:open?'Contraer':'Ampliar información'},
    h('span',{className:'mando-chev'+(open?' open':'')},'▸'),
    h('div',{className:'mando-id'},
      h('div',{className:'icao'},a.icao),
      h('div',{className:'nm'},a.name),
      h('div',{className:'city'},(a.city||'').toUpperCase())),
    h('div',{className:'mando-badges'},
      h('div',{className:'mando-badge'},
        h('span',{className:'mb-k'},'PISTA'),
        h('span',{className:'mb-v rwy'}, rwyTxt)),
      h('div',{className:'mando-badge'},
        h('span',{className:'mb-k'},'METAR'),
        m&&m.cat?h('span',{className:'fr '+m.cat}, m.cat):h('span',{className:'mb-v dim'},'—')),
      h('div',{className:'mando-badge'},
        h('span',{className:'mb-k'},'EQUIPOS'),
        h('span',{className:'mb-v'}, h('span',{className:'eqdot '+eqStatusClass(worst)}), eqTxt)),
      h('div',{className:'mando-badge'},
        h('span',{className:'mb-k'},'NOTAM'),
        h('span',{className:'mb-v'+(notams.length?'':' dim')}, notams.length||'—'))));

  if(!open){
    return h('div',{className:'mando-card'+(usCount?' alert':'')}, head);
  }

  // ---- cuerpo expandido: información completa ----
  const metarBlock=h('div',{className:'mando-block'},
    h('div',{className:'mando-block-h'},'Meteorología'),
    m
      ? h('div',{className:'metarline',style:{border:'none',padding:'2px 0'}},
          m.cat && h('span',{className:'fr '+m.cat},m.cat),
          h('span',null,m.raw),
          m.obsTime && h('span',{className:'mage'}, ageMin(m.obsTime*1000)))
      : h('div',{className:'mando-empty'},'METAR no disponible'));

  const opBlock=h('div',{className:'mando-block'},
    h('div',{className:'mando-block-h'},'Operación en uso'),
    h('div',{className:'mando-op'},
      h('div',{className:'mando-op-row'},
        h('span',{className:'mando-op-k'},'Pista'), h('span',{className:'mando-op-v'},rwyTxt),
        a.rwymode && h('span',{className:'mando-op-mode'},a.rwymode)),
      (a.appu&&a.appu.length)&&h('div',{className:'mando-op-row'},
        h('span',{className:'mando-op-k'},'Aprox.'), h('span',{className:'mando-op-v'},a.appu.join(' / '))),
      eps.length>0 && epPrimary.map(ep=>{
        const star=starDisplayVal(a.stars,a.epuse,ep);
        const apps=appDisplayForEp(a.appuse,ep,a.apps,a.appu,star,a.rwyu);
        return h('div',{className:'mando-op-row ep',key:ep},
          h('span',{className:'mando-op-k'},ep),
          h('span',{className:'mando-op-v'}, star||'—'),
          h('span',{className:'mando-op-app'}, apps.length?apps.join(' / '):'—'));
      })));

  const eqBlock=h('div',{className:'mando-block'},
    h('div',{className:'mando-block-h'},'Equipamiento',
      h('span',{className:'mando-block-n'}, items.length+' equipo'+(items.length===1?'':'s'))),
    items.length===0
      ? h('div',{className:'mando-empty'},'Sin equipamiento registrado.')
      : EQ_TYPES.map(t=>{
          const list=items.filter(x=>x.tipo===t.key);
          if(!list.length) return null;
          return h('div',{className:'mando-eqcat',key:t.key},
            h('div',{className:'mando-eqcat-h'}, Ic[t.icon]({}), t.label),
            list.map(it=>h('div',{className:'mando-eqrow',key:it.id},
              h('span',{className:'bfpill '+eqStatusClass(it.estado)+' readonly mini'}, it.estado),
              h('span',{className:'mando-eqnm'}, it.nombre,
                it.detalle && h('span',{className:'mando-eqdet'},' · '+it.detalle)),
              it.obs && h('span',{className:'mando-eqobs'}, it.obs))));
        }));

  const notamBlock=h('div',{className:'mando-block'},
    h('div',{className:'mando-block-h'},'NOTAM',
      h('span',{className:'mando-block-n'}, notams.length)),
    notams.length===0
      ? h('div',{className:'mando-empty'},'Sin NOTAM vigentes.')
      : notams.map(n=>h('div',{className:'mando-notam',key:n.id},
          h('div',{className:'mando-notam-h'},
            h('span',{className:'mando-notam-num'}, n.numero||'NOTAM'),
            (n.desde||n.hasta)&&h('span',{className:'mando-notam-win'},
              (n.desde?n.desde:'')+(n.hasta?' → '+n.hasta:''))),
          h('div',{className:'mando-notam-txt'}, n.texto||'—'))));

  return h('div',{className:'mando-card open'+(usCount?' alert':'')},
    head,
    h('div',{className:'mando-body'}, metarBlock, opBlock, eqBlock, notamBlock,
      h('div',{className:'mando-foot'},
        h('span',null,(doc&&doc.updatedAt)?('Equipos actualizados '+ageMin(doc.updatedAt)):'Equipos sin registrar'),
        onRemove && h('span',{className:'editlink rm',onClick:onRemove},'Quitar de Mi jurisdicción'))));
}

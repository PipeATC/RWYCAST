// Bitácora — LogView
function LogView({logs,user}){
  return h('div',null,
    h('div',{className:'phead',style:{borderTop:'none'}},
      h('h3',null,'Bitácora de cambios operacionales'),
      h('span',{className:'sub'},logs.length+' EVENTOS · RED NACIONAL')),
    logs.length===0
      ? h('div',{className:'empty'},'Sin cambios registrados en este turno. Las publicaciones de cualquier unidad aparecerán aquí en tiempo real.')
      : h('div',{className:'feed'},
          logs.map(l=>h('div',{key:l.id,className:'levt upd'},
            h('div',{className:'tk'}, l.zulu),
            h('div',{className:'marker'},h('i')),
            h('div',{className:'body'},
              h('div',{className:'ttl'},'Actualización ',h('b',null,l.icao)),
              h('div',{className:'det'},
                l.diff.map((d,i)=>h('span',{key:i},
                  fieldLabel(d.field)+' ',
                  h('span',{className:'chg'},d.from+' → '+d.to),
                  i<l.diff.length-1?'  ·  ':''))),
              h('div',{className:'who2'}, l.user+' · '+l.unit+(userUnits(user).includes(l.unit)?' (esta unidad)':''))))))
  );
}

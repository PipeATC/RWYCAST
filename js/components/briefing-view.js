// Briefing UI — BfSec / BfPill / Briefing
function BfSec(num,title,...children){
  return h('div',{className:'bfsec'},
    h('div',{className:'bfsec-h'},h('span',{className:'bfsec-n'},num),h('h4',null,title)),
    h('div',{className:'bfsec-b'},...children));
}
function BfPill(status,onTap,editable){
  return h('button',{type:'button',className:'bfpill '+bfPillClass(status)+(editable?'':' readonly'),
    onClick:editable?onTap:undefined},status||'—');
}

function Briefing({airports,logs,user,metars}){
  const canEdit=user.role==='admin'||user.role==='unit';
  const [turno,setTurno]=useState('dia');
  const [uiMode,setUiMode]=useState(canEdit?'edit':'view');
  const [store,setStore]=useState(null);
  const storeRef=useRef({dia:null,noche:null});
  const saveTimer=useRef(null);
  const pendingRef=useRef(null);
  const turnoRef=useRef(turno);
  turnoRef.current=turno;
  const editable=canEdit&&uiMode==='edit';

  useEffect(()=>{
    const sub=subscribeBriefing(v=>{ storeRef.current=v; setStore(v); });
    return ()=>{ sub.stop(); clearTimeout(saveTimer.current); };
  },[]);

  const getDoc=()=>mergeBriefDoc(storeRef.current[turno],turno);

  const flushSave=useCallback(async()=>{
    clearTimeout(saveTimer.current);
    if(pendingRef.current){
      await saveBriefing(pendingRef.current);
      pendingRef.current=null;
    }
  },[]);

  const commit=useCallback(async(next,immediate)=>{
    clearTimeout(saveTimer.current);
    const d={...next,turno,updatedAt:Date.now(),updatedBy:user.name,
      date:next.date||new Date().toISOString().slice(0,10)};
    storeRef.current={...storeRef.current,[turno]:d};
    setStore({...storeRef.current});
    if(immediate){
      pendingRef.current=null;
      await saveBriefing(d);
    }else{
      pendingRef.current=d;
      saveTimer.current=setTimeout(async()=>{
        if(pendingRef.current&&pendingRef.current.turno===turnoRef.current){
          await saveBriefing(pendingRef.current);
          pendingRef.current=null;
        }
      },600);
    }
  },[turno,user.name]);

  const upd=useCallback((fn,now)=>{
    const cur=JSON.parse(JSON.stringify(getDoc()));
    commit(fn(cur),!!now);
  },[commit,turno,store]);

  const switchTurno=t=>{
    if(pendingRef.current){
      clearTimeout(saveTimer.current);
      saveBriefing(pendingRef.current);
      pendingRef.current=null;
    }
    setTurno(t);
  };

  if(!store) return h('div',{className:'brief'},h('div',{className:'bf-loading'},'Cargando planilla de briefing…'));

  const doc=getDoc();
  const units=userUnits(user);

  /* --- primitivos reutilizables --- */
  const txt=(label,val,onCh,multi)=>{
    const ro=!editable;
    return h('div',{className:'bf-field'+(ro?' readonly':'')},
      label&&h('label',null,label),
      multi
        ?h('textarea',{value:val||'',readOnly:ro,placeholder:label||'',
            onChange:e=>!ro&&onCh(e.target.value),onBlur:()=>!ro&&flushSave()})
        :h('input',{value:val||'',readOnly:ro,placeholder:label||'',
            onChange:e=>!ro&&onCh(e.target.value),onBlur:()=>!ro&&flushSave()}));
  };
  const statRow=(lbl,status,onStat,txtVal,onTxt,kEdit)=>{
    const ro=!editable;
    return h('div',{className:'bf-row'+(ro?' readonly':'')},
      kEdit
        ?h('input',{value:lbl,readOnly:ro,style:{minWidth:88,flex:'0 0 88px'},
            onChange:e=>!ro&&kEdit(e.target.value),onBlur:()=>!ro&&flushSave()})
        :h('span',{className:'lbl'},lbl),
      BfPill(status,()=>onStat(bfCycleStatus(status)),editable),
      h('input',{value:txtVal||'',readOnly:ro,placeholder:'Observaciones…',
        onChange:e=>!ro&&onTxt(e.target.value),onBlur:()=>!ro&&flushSave()}),
      editable&&kEdit&&h('button',{type:'button',className:'bf-rm',
        onClick:()=>onStat('__rm__')},'×'));
  };
  const dynText=(items,setPath,ph)=>{
    const rows=items.map((item,i)=>h('div',{className:'bf-dyn-row',key:i},
      h('input',{value:item||'',readOnly:!editable,placeholder:ph||'Texto…',
        onChange:e=>upd(d=>{ setPath(d)[i]=e.target.value; return d; },false),
        onBlur:()=>editable&&flushSave()}),
      editable&&h('button',{type:'button',className:'bf-rm',onClick:()=>upd(d=>{
        const a=setPath(d); a.splice(i,1); if(!a.length) a.push(''); return d; },true)},'×')
    ));
    if(editable){
      rows.push(h('button',{type:'button',className:'bf-add',style:{alignSelf:'flex-start'},
        onClick:()=>upd(d=>{ setPath(d).push(''); return d; },true)},'+'));
    }
    return h('div',{className:'bf-dyn'},rows);
  };
  const dynStruct=(rows,cols,emptyRow,setRows)=>{
    const gridCls='bf-struct-hd cols-'+cols.length;
    const body=rows.map((row,i)=>h('div',{className:'bf-dyn-row',key:i},
      cols.map(c=>h('input',{key:c.key,value:row[c.key]||'',readOnly:!editable,
        placeholder:c.label,
        onChange:e=>upd(d=>{ const r=setRows(d); r[i][c.key]=e.target.value; return d; },false),
        onBlur:()=>editable&&flushSave()})),
      editable&&h('button',{type:'button',className:'bf-rm',onClick:()=>upd(d=>{
        const r=setRows(d); r.splice(i,1); if(!r.length) r.push({...emptyRow}); return d; },true)},'×')
    ));
    if(editable){
      body.push(h('button',{type:'button',className:'bf-add',style:{alignSelf:'flex-start'},
        onClick:()=>upd(d=>{ setRows(d).push({...emptyRow}); return d; },true)},'+'));
    }
    return h('div',null,
      h('div',{className:gridCls},cols.map(c=>h('span',{key:c.key},c.label))),
      h('div',{className:'bf-dyn'},body)
    );
  };

  /* --- sección I: Meteorología --- */
  const metAuto=h('div',{className:'bf-auto'},
    h('div',{className:'bf-auto-hd'},
      h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2},
        h('rect',{x:5,y:11,width:14,height:10,rx:1}),h('path',{d:'M8 11V7a4 4 0 0 1 8 0v4'})),
      'Datos en vivo — no editable'),
    BF_METAR_ICAOS.map(icao=>{
      const m=metars[icao];
      return h('div',{className:'bf-metar-row',key:icao},
        h('span',{className:'icao'},icao),
        m?(m.cat?h('span',{className:'pill '+(m.cat==='VFR'?'ok':'warn'),style:{marginRight:8}},m.cat):null):null,
        m?m.raw:h('span',{style:{color:'var(--ink-faint)'}},'METAR no disponible'),
        h('div',{className:'taf'},'TAF — consultar fuente oficial / no sincronizado'));
    }));

  /* --- sección IV: Radares grilla --- */
  const radarGrid=h('div',{className:'bf-grid'},
    h('table',null,
      h('thead',null,h('tr',null,h('th',null,'Radar'),...BF_RADAR_TYPES.map(t=>h('th',{key:t},t.replace('ModoS','Modo S'))))),
      h('tbody',null,
        BF_RADAR_SITES.map(site=>h('tr',{key:site},
          h('td',null,site),
          BF_RADAR_TYPES.map(type=>{
            const st=(doc.radares.grid[type]||{})[site]||'—';
            return h('td',{key:type},
              BfPill(st,()=>upd(d=>{ d.radares.grid[type][site]=bfCycleStatus(st); return d; },true),editable));
          }))))));

  /* --- sección V: Frecuencias --- */
  const freqGrid=h('div',{className:'bf-dyn'},
    BF_FREQ_SITES.map(site=>{
      const g=doc.frecuencias.grid[site]||{main:'OK',standby:'OK'};
      return h('div',{className:'bf-row',key:site},
        h('span',{className:'lbl'},site),
        h('span',{style:{fontFamily:'var(--mono)',fontSize:9,color:'var(--ink-faint)'}},'MAIN'),
        BfPill(g.main,()=>upd(d=>{ d.frecuencias.grid[site].main=bfCycleStatus(g.main); return d; },true),editable),
        h('span',{style:{fontFamily:'var(--mono)',fontSize:9,color:'var(--ink-faint)'}},'STBY'),
        BfPill(g.standby,()=>upd(d=>{ d.frecuencias.grid[site].standby=bfCycleStatus(g.standby); return d; },true),editable));
    }));

  const secHandoff=h('div',{className:'bf-handoff'},
    h('div',{className:'bf-signbox'},
      h('div',{className:'role'},'Supervisor saliente'),
      h('div',{className:'nm'},doc.handoff.outName||'—'),
      editable&&h('input',{value:doc.handoff.outName||'',placeholder:'Nombre',
        onChange:e=>upd(d=>{ d.handoff.outName=e.target.value; return d; },false),
        onBlur:()=>flushSave()}),
      h('div',{className:'st '+(doc.handoff.outAt?'signed':'pending')},
        doc.handoff.outAt?'✓ Firmado '+doc.handoff.outAt:'Pendiente'),
      editable&&!doc.handoff.outAt&&h('button',{type:'button',className:'bf-signbtn',onClick:()=>upd(d=>{
        d.handoff.outName=d.handoff.outName||user.name; d.handoff.outAt=nowZ(); return d; },true)},'Firmar entrega')),
    h('div',{className:'bf-signbox'},
      h('div',{className:'role'},'Supervisor entrante'),
      h('div',{className:'nm'},doc.handoff.inName||'—'),
      editable&&h('input',{value:doc.handoff.inName||'',placeholder:'Nombre',
        onChange:e=>upd(d=>{ d.handoff.inName=e.target.value; return d; },false),
        onBlur:()=>flushSave()}),
      h('div',{className:'st '+(doc.handoff.inAt?'signed':'pending')},
        doc.handoff.inAt?'✓ Firmado '+doc.handoff.inAt:'Pendiente'),
      editable&&!doc.handoff.inAt&&h('button',{type:'button',className:'bf-signbtn',onClick:()=>upd(d=>{
        d.handoff.inName=d.handoff.inName||user.name; d.handoff.inAt=nowZ(); return d; },true)},'Confirmar recepción'))
  );
  const secAtcoRows=doc.atcoTurno.puestos.map((p,i)=>h('div',{className:'bf-dyn-row',key:i},
    h('input',{value:p.puesto||'',readOnly:!editable,placeholder:'Puesto',style:{flex:'0 0 120px'},
      onChange:e=>upd(d=>{ d.atcoTurno.puestos[i].puesto=e.target.value; return d; },false),
      onBlur:()=>editable&&flushSave()}),
    h('input',{value:p.iniciales||'',readOnly:!editable,placeholder:'Iniciales',
      onChange:e=>upd(d=>{ d.atcoTurno.puestos[i].iniciales=e.target.value; return d; },false),
      onBlur:()=>editable&&flushSave()}),
    editable&&h('button',{type:'button',className:'bf-rm',onClick:()=>upd(d=>{
      d.atcoTurno.puestos.splice(i,1); if(!d.atcoTurno.puestos.length) d.atcoTurno.puestos.push({puesto:'',iniciales:''}); return d; },true)},'×')
  ));
  if(editable){
    secAtcoRows.push(h('button',{type:'button',className:'bf-add',style:{alignSelf:'flex-start'},
      onClick:()=>upd(d=>{ d.atcoTurno.puestos.push({puesto:'',iniciales:''}); return d; },true)},'+ Puesto'));
  }

  return h('div',{className:'brief'},
    h('div',{className:'bf-toolbar'},
      h('span',{className:'bf-title'},'PLANILLA BRIEFING ACCS'),
      h('div',{className:'bf-toggrp'},
        h('button',{type:'button',className:turno==='dia'?'on':'',onClick:()=>switchTurno('dia')},'DÍA'),
        h('button',{type:'button',className:turno==='noche'?'on':'',onClick:()=>switchTurno('noche')},'NOCHE')),
      canEdit&&h('div',{className:'bf-toggrp'},
        h('button',{type:'button',className:uiMode==='edit'?'on':'',onClick:()=>setUiMode('edit')},'Editar'),
        h('button',{type:'button',className:uiMode==='view'?'on':'',onClick:()=>{ flushSave(); setUiMode('view'); }},'Vista')),
      h('div',{className:'bf-meta'},
        (units.join(' · ')||'ACCS')+' · '+doc.date,
        h('br'),'Actualizado '+ageMin(doc.updatedAt)+' · '+(doc.updatedBy||'—'))),
    BfSec('I','Meteorología',metAuto,
      txt('Apreciación general',doc.meteo.apreciacion,v=>upd(d=>{ d.meteo.apreciacion=v; return d; },false),true),
      txt('AIREPs',doc.meteo.aireps,v=>upd(d=>{ d.meteo.aireps=v; return d; },false),true)),
    BfSec('II','Pistas SCEL',
      h('div',{className:'bf-dyn'},
        doc.pistas.rows.map((row,i)=>statRow(row.k,row.status,
          s=>{ if(s==='__rm__') upd(d=>{ d.pistas.rows.splice(i,1); if(!d.pistas.rows.length) d.pistas.rows.push({k:'',status:'OK',txt:''}); return d; },true);
               else upd(d=>{ d.pistas.rows[i].status=s; return d; },true); },
          row.txt,v=>upd(d=>{ d.pistas.rows[i].txt=v; return d; },false),
          editable?v=>upd(d=>{ d.pistas.rows[i].k=v; return d; },false):undefined))),
      editable&&h('button',{type:'button',className:'bf-add',style:{marginTop:8},
        onClick:()=>upd(d=>{ d.pistas.rows.push({k:'',status:'OK',txt:''}); return d; },true)},'+ RWY'),
      txt('OBS',doc.pistas.obs,v=>upd(d=>{ d.pistas.obs=v; return d; },false),true),
      txt('Modo de operación',doc.pistas.modoOp,v=>upd(d=>{ d.pistas.modoOp=v; return d; },false))),
    BfSec('III','TMA Santiago',dynText(doc.tma.items,d=>d.tma.items,'Entrada TMA…')),
    BfSec('IV','Radares',radarGrid,
      txt('OBSERV',doc.radares.obs,v=>upd(d=>{ d.radares.obs=v; return d; },false),true)),
    BfSec('V','Frecuencias',freqGrid,
      h('div',{style:{marginTop:12}},
        h('label',{className:'eyebrow',style:{display:'block',marginBottom:8}},'Otras frecuencias'),
        dynText(doc.frecuencias.otras,d=>d.frecuencias.otras,'Frecuencia / obs…'))),
    BfSec('VI','Radioayudas y sistemas',
      h('div',{className:'bf-dyn'},
        doc.radioayudas.rows.map((row,i)=>statRow(row.k,row.status,
          s=>{ if(s==='__rm__') upd(d=>{ d.radioayudas.rows.splice(i,1); if(!d.radioayudas.rows.length) d.radioayudas.rows.push({k:'',status:'OK',txt:''}); return d; },true);
               else upd(d=>{ d.radioayudas.rows[i].status=s; return d; },true); },
          row.txt,v=>upd(d=>{ d.radioayudas.rows[i].txt=v; return d; },false),
          editable?v=>upd(d=>{ d.radioayudas.rows[i].k=v; return d; },false):undefined))),
      editable&&h('button',{type:'button',className:'bf-add',style:{marginTop:8},
        onClick:()=>upd(d=>{ d.radioayudas.rows.push({k:'',status:'OK',txt:''}); return d; },true)},'+ Equipo')),
    BfSec('VII','Control de afluencia',
      h('div',{className:'bf-dyn'},
        doc.afluencia.items.map((item,i)=>h('div',{className:'bf-dyn-row',key:i},
          h('button',{type:'button',className:'bf-tag'+(editable?'':' readonly'),
            onClick:editable?()=>upd(d=>{ const t=d.afluencia.items[i].tag;
              d.afluencia.items[i].tag=t==='NAC'?'INT':'NAC'; return d; },true):undefined},item.tag||'NAC'),
          h('input',{value:item.body||'',readOnly:!editable,placeholder:'Detalle afluencia…',
            onChange:e=>upd(d=>{ d.afluencia.items[i].body=e.target.value; return d; },false),
            onBlur:()=>editable&&flushSave()}),
          editable&&h('button',{type:'button',className:'bf-rm',onClick:()=>upd(d=>{
            d.afluencia.items.splice(i,1); if(!d.afluencia.items.length) d.afluencia.items.push({tag:'NAC',body:''}); return d; },true)},'×'))),
        editable&&h('button',{type:'button',className:'bf-add',style:{alignSelf:'flex-start'},
          onClick:()=>upd(d=>{ d.afluencia.items.push({tag:'NAC',body:''}); return d; },true)},'+'))),
    BfSec('VIII','Pasajes (PJE)',dynStruct(doc.pje.rows,
      [{key:'ubicacion',label:'Ubicación'},{key:'altfl',label:'ALT/FL'},{key:'obs',label:'OBS'}],
      {ubicacion:'',altfl:'',obs:''},d=>d.pje.rows)),
    BfSec('IX','FRNG',dynStruct(doc.frng.rows,
      [{key:'sector',label:'Sector'},{key:'altfl',label:'ALT/FL'},{key:'tda',label:'TDA'}],
      {sector:'',altfl:'',tda:''},d=>d.frng.rows)),
    BfSec('X','Zonas D-R-P',dynStruct(doc.zonas.rows,
      [{key:'sector',label:'Sector'},{key:'altfl',label:'ALT/FL'},{key:'tda',label:'TDA'}],
      {sector:'',altfl:'',tda:''},d=>d.zonas.rows)),
    BfSec('XI','AD/RWY cerrados y restricciones',dynStruct(doc.adCerrados.rows,
      [{key:'adrwy',label:'AD/RWY'},{key:'fecha',label:'Fecha'},{key:'obs',label:'OBS / restricción'}],
      {adrwy:'',fecha:'',obs:''},d=>d.adCerrados.rows)),
    BfSec('XII','RPAS / globos / planeadores',dynText(doc.rpas.items,d=>d.rpas.items,'Actividad…')),
    BfSec('XIII','Coordinaciones',dynText(doc.coordinaciones.items,d=>d.coordinaciones.items,'Coordinación…')),
    BfSec('XIV','Info operativa',dynText(doc.infoOperativa.items,d=>d.infoOperativa.items,'Información…')),
    BfSec('XV','Misceláneos, administrativos y personal',
      h('label',{className:'eyebrow',style:{display:'block',marginBottom:8}},'ATCO de turno'),
      h('div',{className:'bf-dyn',style:{marginBottom:14}},secAtcoRows),
      h('label',{className:'eyebrow',style:{display:'block',marginBottom:8}},'Traspaso supervisor'),
      secHandoff,
      h('div',{style:{marginTop:14}},
        h('label',{className:'eyebrow',style:{display:'block',marginBottom:8}},'Observaciones'),
        dynText(doc.observaciones.items,d=>d.observaciones.items,'Observación…')))
  );
}

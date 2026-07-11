// Data Base — fieldLabel / cleanList / cleanStars / reconcileEpUse, …
function fieldLabel(f){
  return f==='rwyu'?'PISTAS EN USO':f==='appu'?'APROX. EN USO':f==='epuse'?'STAR EN USO':
         f==='epsel'?'PTOS. ENTRADA (TARJETA)':
         f==='rwys'?'PISTAS':f==='apps'?'APROX.':f==='eps'?'PTOS. ENTRADA':f==='stars'?'STARS':
         f==='charts'?'CARTAS (PDF)':
         f==='name'?'NOMBRE':f==='city'?'CIUDAD':
         f==='alta'?'ALTA':f==='baja'?'BAJA':f;
}
// normaliza una lista de strings: recorta, descarta vacíos y duplicados (insensible a mayúsculas)
function cleanList(arr){
  const seen=new Set(), out=[];
  (arr||[]).forEach(x=>{ const v=(x||'').trim(), k=v.toUpperCase();
    if(v && !seen.has(k)){ seen.add(k); out.push(v); } });
  return out;
}
// normaliza una lista de ítems con carta [{name,url}]: recorta, descarta sin nombre y
// duplicados (insensible a mayúsculas), conserva el hipervínculo a la carta PDF.
function cleanItems(arr){
  const seen=new Set(), out=[];
  (arr||[]).forEach(it=>{
    const name=((it&&it.name)||'').trim(), k=name.toUpperCase(), url=((it&&it.url)||'').trim();
    if(name && !seen.has(k)){ seen.add(k); out.push({name, url}); }
  });
  return out;
}
// mapa NOMBRE(MAYÚS) → url a partir de uno o más grupos de ítems (solo con url no vacía)
function chartsFromItems(...groups){
  const m={};
  groups.forEach(items=>(items||[]).forEach(i=>{
    const name=((i&&i.name)||'').trim(), url=((i&&i.url)||'').trim();
    if(name && url) m[name.toUpperCase()]=url;
  }));
  return m;
}
// representación estable del mapa de cartas para diff/registro
function chartsStr(m){ return Object.keys(m||{}).sort().map(k=>k+'→'+m[k]).join(', '); }
// url de la carta PDF asociada a un nombre (pista/aprox/STAR), o '' si no hay
function chartUrl(charts, name){ return (charts||{})[((name||'')+'').trim().toUpperCase()]||''; }
// normaliza STARs [{name,eps:[...]}]: recorta nombres, dedup por nombre, filtra eps a los válidos
function cleanStars(arr, eps){
  const valid=new Set((eps||[]).map(x=>(x||'').trim().toUpperCase()).filter(Boolean));
  const seen=new Set(), out=[];
  (arr||[]).forEach(s=>{
    const name=((s&&s.name)||'').trim(), k=name.toUpperCase();
    if(name && !seen.has(k)){
      seen.add(k);
      const eList=[...new Set(((s&&s.eps)||[]).map(e=>(e||'').trim().toUpperCase()).filter(e=>valid.has(e)))];
      out.push({name, eps:eList, url:((s&&s.url)||'').trim()});
    }
  });
  return out;
}
function starsStr(arr){ return (arr||[]).map(s=>s.name+'['+(s.eps||[]).join('/')+']').join(', '); }
// STARs que sirven a un punto de entrada dado
function starsForEp(stars, ep){ return (stars||[]).filter(s=>(s.eps||[]).includes(ep)).map(s=>s.name); }
// reconcilia la STAR en uso por punto de entrada contra el catálogo vigente
function reconcileEpUse(eps, stars, prev){
  const out={};
  (eps||[]).forEach(ep=>{
    const serving=starsForEp(stars,ep), cur=(prev||{})[ep];
    out[ep] = (cur && serving.includes(cur)) ? cur : (serving[0]||'');
  });
  return out;
}
function epUseStr(eps, m){ return (eps||[]).map(ep=>ep+'/'+((m&&m[ep])||'—')).join(', '); }

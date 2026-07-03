// Catálogo — fieldLabel / cleanList / cleanStars / reconcileEpUse, …
function fieldLabel(f){
  return f==='rwyu'?'PISTAS EN USO':f==='appu'?'APROX. EN USO':f==='epuse'?'STAR EN USO':
         f==='rwys'?'PISTAS':f==='apps'?'APROX.':f==='eps'?'PTOS. ENTRADA':f==='stars'?'STARS':
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
// normaliza STARs [{name,eps:[...]}]: recorta nombres, dedup por nombre, filtra eps a los válidos
function cleanStars(arr, eps){
  const valid=new Set((eps||[]).map(x=>(x||'').trim().toUpperCase()).filter(Boolean));
  const seen=new Set(), out=[];
  (arr||[]).forEach(s=>{
    const name=((s&&s.name)||'').trim(), k=name.toUpperCase();
    if(name && !seen.has(k)){
      seen.add(k);
      const eList=[...new Set(((s&&s.eps)||[]).map(e=>(e||'').trim().toUpperCase()).filter(e=>valid.has(e)))];
      out.push({name, eps:eList});
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

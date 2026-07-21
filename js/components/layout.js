// Layout — TopBar / AlertBanner / Footer / MobileTabs

// Conmutador de tema (claro/oscuro). El tema vive como clase en <body> y se
// recuerda en el dispositivo; el script inline de index.html lo aplica al cargar
// para evitar parpadeo antes de que React monte.
const THEME_KEY='runcast:theme';
function applyTheme(mode){
  document.body.classList.toggle('theme-light', mode==='light');
  try{ localStorage.setItem(THEME_KEY, mode); }catch(e){}
  const m=document.querySelector('meta[name="theme-color"]');
  if(m) m.setAttribute('content', mode==='light'?'#eef1f5':'#070b0e');
}
const SunIcon=()=>h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':2,
  'stroke-linecap':'round','stroke-linejoin':'round'},
  h('circle',{cx:12,cy:12,r:4}),
  h('path',{d:'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'}));
const MoonIcon=()=>h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':2,
  'stroke-linecap':'round','stroke-linejoin':'round'},
  h('path',{d:'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'}));
const KeyIcon=()=>h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':2,
  'stroke-linecap':'round','stroke-linejoin':'round'},
  h('circle',{cx:8,cy:15,r:5}),
  h('path',{d:'M11.5 11.5 21 2M17 6l3 3M15.5 7.5l2 2'}));

// Orden personalizado de los módulos de la barra superior (persistido por usuario).
function navOrderKey(user){ return 'runcast:navorder:'+((user&&user.username)||'anon'); }
function loadNavOrder(user){ try{ const a=JSON.parse(localStorage.getItem(navOrderKey(user))||'null'); return Array.isArray(a)?a:null; }catch(e){ return null; } }
function saveNavOrder(user,order){ try{ localStorage.setItem(navOrderKey(user), JSON.stringify(order)); }catch(e){} }
// Respeta el orden guardado y agrega al final cualquier módulo nuevo o no visto,
// filtrando los que el rol ya no puede ver (permitidos = fuente de verdad).
function mergeNavOrder(allowed, saved){
  if(!saved||!saved.length) return allowed.slice();
  const kept=saved.filter(k=>allowed.includes(k));
  const rest=allowed.filter(k=>!kept.includes(k));
  return kept.concat(rest);
}

function TopBar({user,users,clock,view,setView,unread,onLogout,onManagePassword}){
  const [menuOpen,setMenuOpen]=useState(false);
  const [theme,setTheme]=useState(()=>document.body.classList.contains('theme-light')?'light':'dark');
  const [dragKey,setDragKey]=useState(null);            // módulo que se está arrastrando
  const [arrows,setArrows]=useState({left:false,right:false}); // flechas del deslizador
  const menuRef=useRef(null);
  const draggedRef=useRef(false);                        // hubo arrastre → no navegar al soltar
  const scrollRef=useRef(null);

  // Orden de módulos: permitidos por rol, reordenados según preferencia del usuario.
  const allowed=viewsFor(user.role);
  const allowedKey=allowed.join('|');
  const [order,setOrder]=useState(()=>mergeNavOrder(allowed, loadNavOrder(user)));
  // Re-sincroniza al cambiar de usuario o de módulos permitidos (cambio de rol).
  useEffect(()=>{ setOrder(mergeNavOrder(viewsFor(user.role), loadNavOrder(user))); },[user.username, allowedKey]);

  // Mueve dragK a la posición de overK y persiste el nuevo orden.
  const reorder=(dragK,overK)=>setOrder(prev=>{
    const from=prev.indexOf(dragK), to=prev.indexOf(overK);
    if(from<0||to<0||from===to) return prev;
    const next=prev.slice(); next.splice(to,0,next.splice(from,1)[0]);
    saveNavOrder(user,next); return next;
  });

  // Muestra/oculta las flechas del deslizador según haya contenido oculto a los lados.
  const updateArrows=()=>{ const el=scrollRef.current; if(!el) return;
    const left=el.scrollLeft>2, right=el.scrollLeft < el.scrollWidth-el.clientWidth-2;
    setArrows(a=>(a.left!==left||a.right!==right)?{left,right}:a); };
  const scrollStep=dx=>()=>{ const el=scrollRef.current; if(el) el.scrollBy({left:dx,behavior:'smooth'}); };
  const onWheel=e=>{ const el=scrollRef.current; if(el&&e.deltaY){ el.scrollLeft+=e.deltaY; } };

  useEffect(()=>{ updateArrows();
    const el=scrollRef.current; if(!el) return;
    const ro=(typeof ResizeObserver!=='undefined')?new ResizeObserver(updateArrows):null;
    if(ro) ro.observe(el);
    window.addEventListener('resize',updateArrows);
    return ()=>{ if(ro) ro.disconnect(); window.removeEventListener('resize',updateArrows); };
  },[order.length, allowedKey]);

  // Arrastre con Pointer Events (desktop). Umbral de 6px para distinguir de un clic;
  // si el puntero pasa sobre otro módulo, reordena en vivo; auto-scroll en los bordes.
  const startDrag=key=>e=>{
    if(e.button&&e.button!==0) return;
    const sx=e.clientX, sy=e.clientY; let dragging=false, lastOver=key;
    const move=ev=>{
      if(!dragging){
        if(Math.abs(ev.clientX-sx)<6 && Math.abs(ev.clientY-sy)<6) return;
        dragging=true; draggedRef.current=true; setDragKey(key); document.body.classList.add('reordering');
      }
      const el=document.elementFromPoint(ev.clientX,ev.clientY);
      const btn=el&&el.closest&&el.closest('[data-tab]');
      const over=btn&&btn.getAttribute('data-tab');
      if(over&&over!==key&&over!==lastOver){ reorder(key,over); lastOver=over; }
      else if(over===key) lastOver=key;
      const sc=scrollRef.current;
      if(sc){ const r=sc.getBoundingClientRect();
        if(ev.clientX<r.left+36) sc.scrollLeft-=14;
        else if(ev.clientX>r.right-36) sc.scrollLeft+=14; }
    };
    const up=()=>{
      window.removeEventListener('pointermove',move);
      window.removeEventListener('pointerup',up);
      window.removeEventListener('pointercancel',up);
      if(dragging){ setDragKey(null); document.body.classList.remove('reordering'); updateArrows(); }
    };
    window.addEventListener('pointermove',move);
    window.addEventListener('pointerup',up);
    window.addEventListener('pointercancel',up);
  };
  // Clic real (no arrastre, incl. teclado): navega. Si venía de arrastrar, lo ignora.
  const navClick=key=>()=>{ if(draggedRef.current){ draggedRef.current=false; return; } setView(key); };

  useEffect(()=>{
    if(!menuOpen) return;
    const close=e=>{ if(menuRef.current&&!menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('pointerdown',close);
    return ()=>document.removeEventListener('pointerdown',close);
  },[menuOpen]);
  function toggleTheme(){
    const next=theme==='light'?'dark':'light';
    applyTheme(next); setTheme(next); setMenuOpen(false);
  }
  return h('div',{className:'topbar'},
    h('div',{className:'brand'}, GLYPH, h('div',null,
      h('b',null,'RWYCAST'), h('small',null,'ATC · CHILE'))),
    h('div',{className:'navwrap'},
      arrows.left && h('button',{type:'button',className:'navarrow left',onClick:scrollStep(-180),
        title:'Ver módulos anteriores','aria-label':'Desplazar módulos a la izquierda'},'‹'),
      h('div',{className:'navscroll',ref:scrollRef,onScroll:updateArrows,onWheel:onWheel},
        h('div',{className:'nav'},
          order.map(k=>h('button',{key:k,'data-tab':k,
            className:(view===k?'on':'')+(dragKey===k?' drag':''),
            title:'Clic para abrir · arrastra para reordenar',
            onPointerDown:startDrag(k), onClick:navClick(k)},
            TAB_LABEL[k], (k==='log'&&unread>0)&&h('span',{className:'dot'}))))),
      arrows.right && h('button',{type:'button',className:'navarrow right',onClick:scrollStep(180),
        title:'Ver más módulos','aria-label':'Desplazar módulos a la derecha'},'›')),
    h('div',{className:'clock'},
      h('div',{className:'cgrp'},
        h('div',{className:'lbl'},'LOCAL'),
        h('div',{className:'z'},clock.local)),
      h('div',{className:'cgrp'},
        h('div',{className:'lbl'},'UTC'),
        h('div',{className:'z'},clock.utc)),
    ),
    h('div',{className:'who-wrap',ref:menuRef},
      h('button',{type:'button',className:'who'+(menuOpen?' open':''),onClick:()=>setMenuOpen(v=>!v),
        title:'Cuenta'},
        h('div',{className:'av'},user.name.replace(/[^A-Za-z]/g,'').slice(0,5).toUpperCase()),
        h('div',{className:'meta'},
          h('b',null,user.name),
          h('br'),h('span',null, (()=>{const dep=userDep(user);const lbl=dep?depName(dep,users):'';
            return lbl?(ROLE_SHORT[user.role]+' · '+lbl):ROLE_LABEL[user.role];})()))),
      menuOpen&&h('div',{className:'who-menu'},
        h('button',{type:'button',className:'who-item',onClick:toggleTheme,
          title:theme==='light'?'Cambiar a tema oscuro':'Cambiar a tema claro'},
          theme==='light'?h(MoonIcon):h(SunIcon),
          theme==='light'?'Tema oscuro':'Tema claro'),
        onManagePassword&&h('button',{type:'button',className:'who-item',
          onClick:()=>{ setMenuOpen(false); onManagePassword(); },
          title:'Cambiar tu contraseña'},
          h(KeyIcon),'Administrar contraseña'),
        h('div',{className:'who-sep'}),
        h('button',{type:'button',className:'who-logout',onClick:()=>{ setMenuOpen(false); onLogout(); }},
          'Cerrar sesión')))
  );
}
function AlertBanner({alerts,onAck,onAckAll}){
  const n=alerts.length;
  return h('div',{className:'alertbar'},
    h('div',{className:'ah'},
      h('div',{className:'ttl'}, h('span',{className:'ico'}),
        n+' cambio'+(n>1?'s':'')+' sin acuse · otras unidades'),
      h('button',{className:'ackall',onClick:onAckAll},'Enterado de todo')),
    h('div',{className:'alertlist'},
      alerts.map(a=>h('div',{className:'alertrow',key:a.id},
        h('span',{className:'ai'},a.icao),
        h('span',{className:'ax'},
          a.summary||'Cambio operacional',
          h('span',{className:'au'}, a.user+' · '+a.unit+' · '+a.zulu)),
        h('button',{className:'ack',onClick:()=>onAck(a.id)},'Enterado')))));
}
function Footer({user,users,clock,changedNow,syncMode}){
  const synced=syncMode==='firebase';
  const dep=userDep(user);
  return h('div',{className:'footer'},
    h('div',{className:'fi'},
      h('span',{className:'live',style:synced?null:{background:'var(--amber)',boxShadow:'0 0 8px var(--amber)'}}),
      h('b',{style:synced?null:{color:'var(--amber)'}},'RED OPERACIONAL'),
      synced?' · sincronizada':' · modo local (sin sync)'),
    h('div',{className:'fi'},'UNIDAD: ',h('b',null,'\u00A0'+(dep?depName(dep,users):ROLE_SHORT[user.role]))),
    h('div',{className:'fi'}, changedNow>0?h('span',{style:{color:'var(--amber)'}},'⚠ '+changedNow+' cambio(s) activo(s)'):'Sin alertas activas'),
    h('div',{className:'right'},
      h('div',{className:'fi ver'},'RWYCAST ',h('b',null,APP_VERSION)),
      h('div',{className:'fi'},'Sync '+clock.hms+' Z'))
  );
}
function MobileTabs({view,setView,changedNow,user}){
  const items=viewsFor(user.role).map(k=>[k,TAB_LABEL[k],RAIL_META[k][1]]);
  return h('div',{className:'mtab'},
    items.map(([k,l,Icon])=>h('button',{key:k,className:view===k?'on':'',onClick:()=>setView(k)},
      Icon({}), l, (k==='viewer'&&changedNow>0)&&h('span',{className:'dot'}))));
}

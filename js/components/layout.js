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

function TopBar({user,users,clock,view,setView,unread,onLogout,onManagePassword}){
  const tabs=viewsFor(user.role).map(k=>[k,TAB_LABEL[k]]);
  const [menuOpen,setMenuOpen]=useState(false);
  const [theme,setTheme]=useState(()=>document.body.classList.contains('theme-light')?'light':'dark');
  const menuRef=useRef(null);
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
    h('div',{className:'nav'},
      tabs.map(([k,l])=>h('button',{key:k,className:view===k?'on':'',onClick:()=>setView(k)},
        l, (k==='log'&&unread>0)&&h('span',{className:'dot'})))),
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

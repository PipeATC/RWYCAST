// Layout — TopBar / AlertBanner / Footer / MobileTabs
function TopBar({user,clock,view,setView,unread,onLogout}){
  const tabs=viewsFor(user.role).map(k=>[k,TAB_LABEL[k]]);
  const [menuOpen,setMenuOpen]=useState(false);
  const menuRef=useRef(null);
  useEffect(()=>{
    if(!menuOpen) return;
    const close=e=>{ if(menuRef.current&&!menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('pointerdown',close);
    return ()=>document.removeEventListener('pointerdown',close);
  },[menuOpen]);
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
          h('br'),h('span',null, (()=>{const us=userUnits(user);const lbl=us.length>1?us[0]+' +'+(us.length-1):us[0];
            return lbl?(ROLE_SHORT[user.role]+' · '+lbl):ROLE_LABEL[user.role];})()))),
      menuOpen&&h('div',{className:'who-menu'},
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
function Footer({user,clock,changedNow,syncMode}){
  const synced=syncMode==='firebase';
  return h('div',{className:'footer'},
    h('div',{className:'fi'},
      h('span',{className:'live',style:synced?null:{background:'var(--amber)',boxShadow:'0 0 8px var(--amber)'}}),
      h('b',{style:synced?null:{color:'var(--amber)'}},'RED OPERACIONAL'),
      synced?' · sincronizada':' · modo local (sin sync)'),
    h('div',{className:'fi'},'UNIDAD: ',h('b',null,'\u00A0'+(userUnits(user).join(' \u00B7 ')||ROLE_SHORT[user.role]))),
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

// App root — estado global y orquestación
function App(){
  // restaura la sesión recordada en el dispositivo (si el usuario marcó la casilla)
  const [user,setUser]=useState(()=>{
    try{ return JSON.parse(localStorage.getItem(SESSION_KEY)||'null'); }catch(e){ return null; }
  });
  const [airports,setAirports]=useState(()=>AIRPORTS.map(a=>({...a,updatedAt:Date.now()-Math.floor(Math.random()*4000000),updatedBy:'sistema',changed:[]})));
  const [logs,setLogs]=useState([]);
  const [view,setView]=useState('viewer');
  const [editing,setEditing]=useState(null);
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState('mine'); // all | mine — el visor inicia en "Mi jurisdicción"
  const [toasts,setToasts]=useState([]);
  const [clock,setClock]=useState(clockZ());
  const [unread,setUnread]=useState(0);
  const [alerts,setAlerts]=useState([]);   // cambios de otras unidades sin acuse
  const [syncMode,setSyncMode]=useState('local');
  const [metars,setMetars]=useState({});   // METAR en vivo desde /runcast/metars
  const [watch,setWatch]=useState([]);     // watchlist personal (ICAOs) de "Mi jurisdicción"
  const [users,setUsers]=useState({});       // base de usuarios (runcast/users)
  const [editingUser,setEditingUser]=useState(null); // usuario en edición (panel admin)
  const lastVer=useRef(0);
  const userRef=useRef(null); userRef.current=user;
  const usersMapRef=useRef({}); usersMapRef.current=users;
  const seenLogs=useRef(new Set());          // ids de eventos ya procesados

  // clock
  useEffect(()=>{const t=setInterval(()=>setClock(clockZ()),1000);return ()=>clearInterval(t);},[]);

  // suscripción en tiempo real a los cambios de cualquier unidad
  useEffect(()=>{
    const sub=subscribeState((s,isInitial)=>{
      // ignora el "eco" de nuestra propia publicación (mismo _ver ya aplicado)
      if(!isInitial && (s._ver||0)<=lastVer.current) return;
      applyRemote(s, !isInitial);
    });
    setSyncMode(sub.mode);
    return sub.stop;
  },[]);

  // suscripción en tiempo real a los METAR (alimentados por GitHub Actions)
  useEffect(()=>subscribeMetars(setMetars),[]);

  // base de usuarios: siembra el admin inicial y suscribe los cambios
  useEffect(()=>{
    ensureSeedAdmin().catch(e=>console.warn('[RWYCAST] seed admin:',e));
    return subscribeUsers(u=>setUsers(u||{}));
  },[]);

  // control de rutas: si la vista actual no está permitida para el rol, redirige
  useEffect(()=>{
    if(user && !viewsFor(user.role).includes(view)) setView(viewsFor(user.role)[0]);
  },[user,view]);

  // mantiene actualizada la sesión recordada (solo si existe) cuando cambia el perfil,
  // p. ej. al limpiar mustChangePassword tras un cambio de contraseña.
  useEffect(()=>{
    try{
      if(user && localStorage.getItem(SESSION_KEY)) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    }catch(e){}
  },[user]);

  // revalida la sesión recordada contra la base de usuarios ya sincronizada:
  // si la cuenta fue eliminada o desactivada, cierra la sesión automáticamente.
  useEffect(()=>{
    const u=userRef.current;
    if(!u || !users || !Object.keys(users).length) return;
    const rec=users[u.username];
    if(!rec || rec.active===false) logout();
  },[users]);

  // watchlist personal por unidad (persistida en el dispositivo)
  useEffect(()=>{
    if(!user) return;
    let saved=null;
    try{ saved=JSON.parse(localStorage.getItem('runcast:watch:'+user.username)||'null'); }catch(e){}
    const myUnits=userUnits(user);
    const def = user.role==='unit' ? AIRPORTS.filter(a=>myUnits.includes(a.owner)).map(a=>a.icao)
              : user.role==='general' ? []
              : AIRPORTS.map(a=>a.icao);   // admin / sector observan toda la red
    setWatch(Array.isArray(saved) ? saved : def);
  },[user]);
  useEffect(()=>{
    if(!user) return;
    try{ localStorage.setItem('runcast:watch:'+user.username, JSON.stringify(watch)); }catch(e){}
  },[watch,user]);

  const addWatch=icao=>setWatch(w=>w.includes(icao)?w:[...w,icao]);
  const removeWatch=icao=>setWatch(w=>w.filter(x=>x!==icao));
  // reordena "Mi jurisdicción": mueve la tarjeta dragIcao a la posición de overIcao.
  // El orden vive en el arreglo watch, que se persiste por usuario (localStorage).
  const reorderWatch=(dragIcao,overIcao)=>setWatch(w=>{
    const from=w.indexOf(dragIcao), to=w.indexOf(overIcao);
    if(from<0||to<0||from===to) return w;
    const next=w.slice();
    next.splice(to,0,next.splice(from,1)[0]);
    return next;
  });

  function applyRemote(s, signal){
    lastVer.current=s._ver||0;
    const me=userRef.current;
    if(s.airports){
      setAirports(prev=>{
        return s.airports.map(na=>{
          const old=prev.find(p=>p.icao===na.icao);
          // detecta cambio externo para el parpadeo
          const changed=[];
          if(old && signal){
            ['rwyu','appu'].forEach(f=>{ if((old[f]||[]).join('|')!==(na[f]||[]).join('|')) changed.push(f); });
            if(JSON.stringify(old.epuse||{})!==JSON.stringify(na.epuse||{})) changed.push('epuse');
            if((old.rwymode||'')!==(na.rwymode||'')) changed.push('rwymode');
          }
          // el parpadeo persiste hasta que se acuse (no se auto-borra)
          return {...na, changed: signal ? (changed.length?changed:(old?old.changed:[])) : [] };
        });
      });
    }
    if(s.logs) setLogs(s.logs);

    const logs=s.logs||[];
    // carga inicial: marca todo el historial como visto, sin alertar
    if(!signal){ logs.forEach(l=>seenLogs.current.add(l.id)); return; }

    // eventos nuevos de OTRAS unidades → alerta persistente + toast
    const myUnits=userUnits(me);
    const fresh=logs.filter(l=> !seenLogs.current.has(l.id) && (!me || !myUnits.includes(l.unit)));
    logs.forEach(l=>seenLogs.current.add(l.id)); // incluye los propios para no auto-alertar
    if(fresh.length){
      setAlerts(prev=>{
        const have=new Set(prev.map(a=>a.id));
        const add=fresh.filter(l=>!have.has(l.id)).map(l=>(
          {id:l.id, icao:l.icao, unit:l.unit, user:l.user, summary:l.summary, zulu:l.zulu}));
        return [...add, ...prev];
      });
      setUnread(u=>u+fresh.length);
      fresh.slice(0,3).forEach(l=>
        pushToast('warn','ACTUALIZACIÓN '+(l.icao||''), l.summary||'Cambio operacional recibido'));
    }
  }

  // acusar recibo: quita la alerta y, si no quedan más para ese aeropuerto, detiene el parpadeo
  function ackAlert(id){
    setAlerts(prev=>{
      const a=prev.find(x=>x.id===id);
      const rest=prev.filter(x=>x.id!==id);
      if(a && !rest.some(x=>x.icao===a.icao)){
        setAirports(ap=>ap.map(x=>x.icao===a.icao?{...x,changed:[]}:x));
      }
      return rest;
    });
    setUnread(u=>Math.max(0,u-1));
  }
  function ackAll(){
    setAirports(ap=>ap.map(x=>({...x,changed:[]})));
    setAlerts([]); setUnread(0);
  }

  function pushToast(kind,title,msg){
    const id=Math.random();
    setToasts(t=>[...t,{id,kind,title,msg}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),4500);
  }

  // publica un cambio y lo difunde a todas las unidades
  async function commitChange(icao, next, diff){
    // capa de permisos: revalida en el "commit", no solo en la UI
    const target=airports.find(a=>a.icao===icao);
    if(!canEditAirport(user,target)){
      pushToast('warn','ACCESO DENEGADO','Tu rol no permite editar '+icao);
      setEditing(null); return;
    }
    const ts=Date.now();
    // estampa con la unidad dueña del aeródromo (un usuario multi-unidad edita varias)
    const stamp=(user.role==='unit'?target.owner:user.unit)||ROLE_SHORT[user.role]||'ADMIN';
    const newAirports=airports.map(a=>a.icao===icao
      ? {...a,...next,updatedAt:ts,updatedBy:user.name+' · '+stamp,changed:[]}
      : a);
    const summary=diff.map(d=>fieldLabel(d.field)+': '+d.to).join(' · ');
    const logEntry={id:ts,type:'upd',icao,unit:stamp,user:user.name,ts,diff,summary,zulu:nowZ()};
    const newLogs=[logEntry,...logs].slice(0,200);
    seenLogs.current.add(ts);          // nuestro propio cambio no debe auto-alertarnos
    setAirports(newAirports);
    setLogs(newLogs);
    setEditing(null);
    pushToast('ok','PUBLICADO '+icao, summary+' — enviado a todas las unidades');
    const ver=Date.now();
    lastVer.current=ver;
    await publishState({_ver:ver, airports:newAirports, logs:newLogs});
  }

  // publica la edición de la DATA BASE maestra (numeración de pistas, aproximaciones y
  // puntos de entrada con su STAR) de un aeródromo y lo difunde a todas las unidades.
  // admin → cualquier unidad; unit → solo la suya (revalidado en el commit).
  async function commitCatalog(icao, lists){
    const target=airports.find(a=>a.icao===icao);
    if(!canEditAirport(user,target)){
      pushToast('warn','ACCESO DENEGADO','Tu rol no permite editar la Data Base de '+icao);
      return {error:'Sin permiso para esta unidad'};
    }
    const rwyItems=cleanItems(lists.rwys), appItems=cleanItems(lists.apps), eps=cleanList(lists.eps);
    const starItems=cleanStars(lists.stars, eps);
    const rwys=rwyItems.map(i=>i.name), apps=appItems.map(i=>i.name);
    const stars=starItems.map(s=>({name:s.name,eps:s.eps}));
    const charts=chartsFromItems(rwyItems, appItems, starItems);   // NOMBRE→url de carta PDF
    if(!rwys.length) return {error:'Debe existir al menos una pista'};
    // datos de identificación (edición completa); si no vienen, se conservan los actuales
    const name=(lists.name!==undefined ? (lists.name||'').trim() : target.name)||target.icao;
    const city=(lists.city!==undefined ? (lists.city||'').trim() : (target.city||''));
    // diff para el registro (solo lo que cambió)
    const diff=[];
    const cmp=(field,oldArr,newArr)=>{
      const a=(oldArr||[]).join(', '), b=newArr.join(', ');
      if(a!==b) diff.push({field, from:a||'—', to:b||'—'});
    };
    if((target.name||'')!==name) diff.push({field:'name', from:target.name||'—', to:name});
    if((target.city||'')!==city) diff.push({field:'city', from:target.city||'—', to:city||'—'});
    cmp('rwys',target.rwys,rwys); cmp('apps',target.apps,apps); cmp('eps',target.eps,eps);
    if(starsStr(target.stars)!==starsStr(stars))
      diff.push({field:'stars', from:starsStr(target.stars)||'—', to:starsStr(stars)||'—'});
    if(chartsStr(target.charts)!==chartsStr(charts))
      diff.push({field:'charts', from:chartsStr(target.charts)||'—', to:chartsStr(charts)||'—'});
    if(!diff.length){ pushToast('ok','SIN CAMBIOS '+icao,'El aeródromo ya estaba actualizado'); return {ok:true}; }
    // reconcilia la operación vigente (en uso) a lo que sigue existiendo en el catálogo
    let rwyu=(target.rwyu||[]).filter(x=>rwys.includes(x)); if(!rwyu.length) rwyu=[rwys[0]];
    const appu=(target.appu||[]).filter(x=>apps.includes(x));
    const epuse=reconcileEpUse(eps,stars,target.epuse);
    const ts=Date.now();
    const stamp=(user.role==='unit'?target.owner:user.unit)||ROLE_SHORT[user.role]||'ADMIN';
    const newAirports=airports.map(a=>a.icao===icao
      ? {...a,name,city,rwys,apps,eps,stars,charts,rwyu,appu,epuse,updatedAt:ts,updatedBy:user.name+' · '+stamp,changed:[]}
      : a);
    const summary='Data Base · '+diff.map(d=>fieldLabel(d.field)).join(', ')+' actualizado';
    const logEntry={id:ts,type:'cat',icao,unit:stamp,user:user.name,ts,diff,summary,zulu:nowZ()};
    const newLogs=[logEntry,...logs].slice(0,200);
    seenLogs.current.add(ts);          // nuestro propio cambio no debe auto-alertarnos
    setAirports(newAirports);
    setLogs(newLogs);
    pushToast('ok','DATA BASE '+icao, summary+' — enviado a todas las unidades');
    const ver=Date.now();
    lastVer.current=ver;
    await publishState({_ver:ver, airports:newAirports, logs:newLogs});
    return {ok:true};
  }

  // ALTA de una unidad aeroportuaria (solo Administrador General). Se difunde a la red.
  async function createAirport(data){
    if(!canManageAirports(userRef.current)) return {error:'Sin permiso'};
    const icao=(data.icao||'').trim().toUpperCase();
    if(!/^[A-Z0-9]{3,5}$/.test(icao)) return {error:'OACI inválido (3-5 caracteres alfanuméricos)'};
    if(airports.some(a=>a.icao===icao)) return {error:'Ya existe un aeródromo con ese OACI'};
    const rwyItems=cleanItems(data.rwys), appItems=cleanItems(data.apps), eps=cleanList(data.eps);
    const starItems=cleanStars(data.stars, eps);
    const rwys=rwyItems.map(i=>i.name), apps=appItems.map(i=>i.name);
    const stars=starItems.map(s=>({name:s.name,eps:s.eps}));
    const charts=chartsFromItems(rwyItems, appItems, starItems);
    if(!rwys.length) return {error:'Debe existir al menos una pista'};
    const ts=Date.now();
    const stamp=user.unit||ROLE_SHORT[user.role]||'ADMIN';
    // la unidad propietaria es el propio aeródromo (su OACI): se crea como nueva unidad
    const newAp={icao, city:(data.city||'').trim(), name:(data.name||'').trim()||icao, owner:icao,
      rwys, apps, eps, stars, charts, rwyu:[rwys[0]], appu:apps.length?[apps[0]]:[], epuse:reconcileEpUse(eps,stars,{}),
      updatedAt:ts, updatedBy:user.name+' · '+stamp, changed:[]};
    const newAirports=[...airports,newAp];
    const logEntry={id:ts,type:'cat',icao,unit:user.unit||stamp,user:user.name,ts,
      diff:[{field:'alta',from:'—',to:icao+' · '+newAp.name}],
      summary:'Aeródromo '+icao+' agregado a la red',zulu:nowZ()};
    const newLogs=[logEntry,...logs].slice(0,200);
    seenLogs.current.add(ts);
    setAirports(newAirports); setLogs(newLogs);
    pushToast('ok','AERÓDROMO CREADO',icao+' · '+newAp.name);
    const ver=Date.now(); lastVer.current=ver;
    await publishState({_ver:ver, airports:newAirports, logs:newLogs});
    return {ok:true};
  }

  // BAJA de una unidad aeroportuaria (solo Administrador General). Se difunde a la red.
  async function removeAirport(icao){
    if(!canManageAirports(userRef.current)) return {error:'Sin permiso'};
    const target=airports.find(a=>a.icao===icao);
    if(!target) return {error:'No existe'};
    const ts=Date.now();
    const stamp=user.unit||ROLE_SHORT[user.role]||'ADMIN';
    const newAirports=airports.filter(a=>a.icao!==icao);
    const logEntry={id:ts,type:'cat',icao,unit:user.unit||stamp,user:user.name,ts,
      diff:[{field:'baja',from:icao,to:'eliminado de la red'}],
      summary:'Aeródromo '+icao+' eliminado de la red',zulu:nowZ()};
    const newLogs=[logEntry,...logs].slice(0,200);
    seenLogs.current.add(ts);
    setAirports(newAirports); setLogs(newLogs);
    pushToast('ok','AERÓDROMO ELIMINADO',icao);
    const ver=Date.now(); lastVer.current=ver;
    await publishState({_ver:ver, airports:newAirports, logs:newLogs});
    return {ok:true};
  }

  // autenticación: valida credenciales contra la base de usuarios y, recién
  // autenticado, fija perfil (rol/unidad) y la vista inicial según atribuciones
  async function login(username,password,remember){
    const rec=(usersMapRef.current||{})[username];
    if(!rec) return {error:'Usuario no encontrado'};
    if(rec.active===false) return {error:'Usuario inactivo. Contacta al administrador.'};
    const hash=await hashPassword(password, rec.salt||'');
    if(hash!==rec.passHash) return {error:'Contraseña incorrecta'};
    // unit/admin usan sus propias unidades; sector/general heredan las de su usuario de unidad
    const units=effectiveUnits(rec, usersMapRef.current);
    const primary=units[0]||'';
    const unitObj=UNITS.find(x=>x.code===primary);
    const profile={
      username, name:rec.name, role:rec.role, unit:primary, units,
      region:unitObj?unitObj.region:'', mustChangePassword:!!rec.mustChangePassword
    };
    setUser(profile);
    // "Mantener sesión iniciada": persiste el perfil (sin contraseña) en el dispositivo.
    try{
      if(remember) localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
      else localStorage.removeItem(SESSION_KEY);
    }catch(e){}
    setView(viewsFor(rec.role)[0]);
    return {ok:true};
  }

  // cierre de sesión: limpia el estado y la sesión recordada del dispositivo
  function logout(){
    try{ localStorage.removeItem(SESSION_KEY); }catch(e){}
    setUser(null);
  }

  // cambio de contraseña propio (incl. obligatorio en primer ingreso)
  async function changeMyPassword(newPw){
    const me=userRef.current; if(!me) return {error:'Sesión inválida'};
    const cur=usersMapRef.current[me.username]||{};
    const salt=randSalt(); const passHash=await hashPassword(newPw,salt);
    await writeUserDb(me.username,{...cur,salt,passHash,mustChangePassword:false});
    setUser(u=>u?{...u,mustChangePassword:false}:u);
    pushToast('ok','CONTRASEÑA ACTUALIZADA','Tu nueva contraseña quedó activa.');
    return {ok:true};
  }

  // --- gestión de usuarios (solo Administrador General) ---
  async function createUser(data){
    if(!canManageUsers(userRef.current)) return {error:'Sin permiso'};
    if(!USERNAME_RE.test(data.username)) return {error:'Usuario inválido (3-32 · letras, números, _ o -)'};
    if(usersMapRef.current[data.username]) return {error:'Ya existe ese usuario'};
    if(!data.password||data.password.length<6) return {error:'La contraseña debe tener 6+ caracteres'};
    // unit → una o varias unidades del catálogo; sector/general → pertenecen a un
    // usuario de unidad (parent) y heredan sus unidades.
    let units=[], parent='';
    if(roleNeedsUnit(data.role)){
      units=(data.units||[]).filter(Boolean);
      if(!units.length) return {error:'Selecciona al menos una unidad asignada'};
    } else if(roleNeedsParent(data.role)){
      parent=(data.parent||'').trim();
      const p=usersMapRef.current[parent];
      if(!p || p.role!=='unit') return {error:'Selecciona el usuario de unidad al que pertenece'};
      units=userUnits(p);
    }
    const salt=randSalt(); const passHash=await hashPassword(data.password,salt);
    await writeUserDb(data.username,{
      username:data.username, name:data.name||data.username, role:data.role,
      parent,                              // usuario de unidad al que pertenece (sector/general)
      unit: units[0]||'', units,           // unit = primaria (compat); units = heredadas/propias
      salt, passHash, mustChangePassword:true, active:true,
      createdAt:Date.now(), createdBy:userRef.current.name
    });
    pushToast('ok','USUARIO CREADO',data.username+' · '+ROLE_LABEL[data.role]);
    return {ok:true};
  }
  async function saveUser(username,patch){
    if(!canManageUsers(userRef.current)) return {error:'Sin permiso'};
    const cur=usersMapRef.current[username]; if(!cur) return {error:'No existe'};
    let extra={};
    if(patch.password){
      if(patch.password.length<6) return {error:'La contraseña debe tener 6+ caracteres'};
      const salt=randSalt();
      extra={salt,passHash:await hashPassword(patch.password,salt),mustChangePassword:true};
    }
    const role=patch.role||cur.role;
    let units=[], parent='';
    if(roleNeedsUnit(role)){
      units = patch.units!==undefined ? (patch.units||[]).filter(Boolean) : userUnits(cur);
      if(!units.length) return {error:'Selecciona al menos una unidad asignada'};
    } else if(roleNeedsParent(role)){
      parent = patch.parent!==undefined ? (patch.parent||'').trim() : (cur.parent||'');
      const p=usersMapRef.current[parent];
      if(!p || p.role!=='unit') return {error:'Selecciona el usuario de unidad al que pertenece'};
      units=userUnits(p);
    }
    await writeUserDb(username,{
      ...cur,
      name:patch.name!==undefined?patch.name:cur.name,
      role, parent, unit:units[0]||'', units,
      active:patch.active!==undefined?patch.active:(cur.active!==false),
      ...extra
    });
    pushToast('ok','USUARIO ACTUALIZADO',username);
    return {ok:true};
  }
  async function removeUser(username){
    if(!canManageUsers(userRef.current)) return {error:'Sin permiso'};
    if(username===userRef.current.username) return {error:'No puedes eliminar tu propia cuenta'};
    await deleteUserDb(username);
    pushToast('ok','USUARIO ELIMINADO',username);
    return {ok:true};
  }

  if(!user) return h(Login,{onLogin:login});
  if(user.mustChangePassword) return h(ForcePassword,{user,onSubmit:changeMyPassword,onLogout:logout});

  const mine=airports.filter(a=>canEditAirport(user,a)); // aeródromos editables por el rol
  const visible=airports.filter(a=>{
    const q=query.trim().toUpperCase();
    if(filter==='mine' && !watch.includes(a.icao)) return false;
    if(q && !(a.icao.includes(q)||a.city.toUpperCase().includes(q)||a.name.toUpperCase().includes(q))) return false;
    return true;
  });
  // en "Mi jurisdicción" las tarjetas se ordenan según la posición guardada en watch
  if(filter==='mine'){
    const pos=new Map(watch.map((ic,i)=>[ic,i]));
    visible.sort((a,b)=>(pos.has(a.icao)?pos.get(a.icao):1e9)-(pos.has(b.icao)?pos.get(b.icao):1e9));
  }
  const changedNow=airports.filter(a=>a.changed&&a.changed.length).length;

  return h('div',{style:{display:'contents'}},
    h(TopBar,{user,clock,view,setView,unread,onLogout:logout}),
    h('div',{className:'stage'},
      h('div',{className:'content'},
        alerts.length>0 && h(AlertBanner,{alerts,onAck:ackAlert,onAckAll:ackAll}),
        view==='viewer' && h(Viewer,{airports:visible,allAirports:airports,allCount:airports.length,mine:mine.length,changedNow,
          query,setQuery,filter,setFilter,user,onEdit:setEditing,metars,
          watch,onAddWatch:addWatch,onRemoveWatch:removeWatch,onReorder:reorderWatch}),
        view==='log' && h(LogView,{logs,user}),
        view==='brief' && h(Briefing,{airports,logs,user,metars}),
        view==='catalog' && canUseCatalog(user) && h(CatalogAdmin,{airports,user,onSave:commitCatalog,
          onCreate:createAirport,onDelete:removeAirport}),
        view==='users' && canManageUsers(user) && h(UsersAdmin,{users,currentUser:user,
          onNew:()=>setEditingUser({__new:true}),onEdit:u=>setEditingUser(u),onDelete:removeUser}),
      )
    ),
    h(Footer,{user,clock,changedNow,syncMode}),
    h(MobileTabs,{view,setView,changedNow,user}),
    editing && h(Editor,{ap:editing,user,onClose:()=>setEditing(null),onSave:commitChange}),
    editingUser && h(UserEditor,{
      rec:editingUser.__new?null:editingUser, currentUser:user, airports, users,
      onClose:()=>setEditingUser(null),
      onCreate:async d=>{const r=await createUser(d); if(r&&r.ok)setEditingUser(null); return r;},
      onSave:async (un,p)=>{const r=await saveUser(un,p); if(r&&r.ok)setEditingUser(null); return r;},
    }),
    h('div',{className:'toasts'}, toasts.map(t=>
      h('div',{key:t.id,className:'toast'+(t.kind==='warn'?' warn':'')},
        h('b',null,t.title), h('span',null,t.msg))))
  );
}

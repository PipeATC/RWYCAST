// User database — subscribeUsers / writeUserDb / ensureSeedAdmin, …
function readLocalUsers(){ try{return JSON.parse(localStorage.getItem('runcast:users')||'{}');}catch(e){return {};} }
function writeLocalUsers(o){ try{localStorage.setItem('runcast:users',JSON.stringify(o));}catch(e){} }

// Suscribe a la base de usuarios. onUsers(mapUsuarios, modo). Devuelve cleanup.
function subscribeUsers(onUsers){
  const db=ensureFirebase();
  if(db){
    const ref=db.ref(UPATH);
    const cb=snap=>onUsers(snap.val()||{}, 'firebase');
    ref.on('value',cb);
    return ()=>{ try{ref.off('value',cb);}catch(e){} };
  }
  onUsers(readLocalUsers(),'local');
  const t=setInterval(()=>onUsers(readLocalUsers(),'local'),2500);
  return ()=>clearInterval(t);
}
async function writeUserDb(username,obj){
  const db=ensureFirebase();
  if(db){ await db.ref(UPATH+'/'+username).set(obj); return; }
  const all=readLocalUsers(); all[username]=obj; writeLocalUsers(all);
}
async function deleteUserDb(username){
  const db=ensureFirebase();
  if(db){ await db.ref(UPATH+'/'+username).remove(); return; }
  const all=readLocalUsers(); delete all[username]; writeLocalUsers(all);
}
async function loadUsersOnce(){
  const db=ensureFirebase();
  if(db){ try{ return (await db.ref(UPATH).get()).val()||{}; }catch(e){ return {}; } }
  return readLocalUsers();
}
// Crea el Administrador General inicial si la base de usuarios está vacía.
async function ensureSeedAdmin(){
  const existing=await loadUsersOnce();
  if(existing && Object.keys(existing).length) return;
  const salt=randSalt();
  const passHash=await hashPassword(SEED_ADMIN.password,salt);
  await writeUserDb(SEED_ADMIN.username,{
    username:SEED_ADMIN.username, name:SEED_ADMIN.name, role:'admin', unit:'',
    salt, passHash, mustChangePassword:true, active:true,
    createdAt:Date.now(), createdBy:'sistema'
  });
  console.info('[RWYCAST] Admin inicial creado → usuario "'+SEED_ADMIN.username+'". Cambia la contraseña al ingresar.');
}

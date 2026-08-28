# Sistema de Login y Usuarios de RWYCAST

Análisis del sistema de autenticación, sesión y control de acceso (RBAC) de RWYCAST,
pensado como **guía para reimplementarlo en otro proyecto**.

> Resumen en una línea: autenticación por **usuario + contraseña**, con contraseñas
> **hasheadas en el cliente (SHA-256 + sal)**, base de usuarios en **Firebase Realtime
> Database** (con fallback a `localStorage`), sesión recordada en `localStorage`, y un
> **RBAC de 4 roles** que decide vistas y permisos.

---

## 1. Arquitectura general

No hay backend propio ni servidor de auth: es una **SPA React** (vía CDN, sin build) que
habla directamente contra **Firebase RTDB**. La autenticación es "casera" (no usa Firebase
Auth): se valida la contraseña comparando hashes.

```
Navegador (React SPA)
   │
   ├── login()  ──► lee /runcast/users/<username> desde RTDB
   │                compara hash(SHA-256(salt+":"+password)) con passHash guardado
   │
   ├── sesión ──► perfil (sin contraseña) en localStorage  (SESSION_KEY)
   │
   └── RBAC ──► viewsFor(role) + canX(user,...) deciden qué se ve y qué se puede editar
```

### Piezas del código (RWYCAST)

| Archivo | Rol |
|---|---|
| [js/config/keys.js](../js/config/keys.js) | Config de Firebase y claves de storage (`SESSION_KEY`, `UPATH='runcast/users'`) |
| [js/services/firebase.js](../js/services/firebase.js) | `ensureFirebase()` / `firebaseConfigured()` — inicializa la conexión |
| [js/auth/password.js](../js/auth/password.js) | `randSalt()` y `hashPassword()` con Web Crypto |
| [js/auth/rbac.js](../js/auth/rbac.js) | Roles, `viewsFor()`, `canEditAirport()`, `canManageUsers()`, `SEED_ADMIN`, … |
| [js/services/users.js](../js/services/users.js) | CRUD de la base de usuarios + `ensureSeedAdmin()` |
| [js/components/login.js](../js/components/login.js) | UI: `Login`, `ForcePassword`, `PasswordModal` |
| [js/components/users-view.js](../js/components/users-view.js) | UI de administración: `UsersAdmin`, `UserEditor` |
| [js/components/app.js](../js/components/app.js) | Orquestación: `login()`, `logout()`, `createUser()`, `saveUser()`, `removeUser()`, cambio de contraseña |

Dependencias externas (cargadas por CDN en `index.html`): React 18 UMD, ReactDOM 18 UMD,
`firebase-app-compat` y `firebase-database-compat` 10.12.2. La app usa `h = React.createElement`
en lugar de JSX (ver [js/core/react-setup.js](../js/core/react-setup.js)).

---

## 2. Modelo de datos del usuario

Cada usuario se guarda en RTDB bajo `runcast/users/<username>` (la clave ES el username).
Registro completo:

```jsonc
{
  "username": "accs",              // clave; validada con /^[a-zA-Z0-9_-]{3,32}$/
  "name": "ACC Santiago",          // nombre para mostrar
  "role": "unit",                  // admin | unit | sector | general
  "parent": "",                    // (sector/general) username del "usuario de unidad" al que pertenece
  "unit": "SCEL",                  // unidad primaria (compat)
  "units": ["SCEL", "SCTB"],       // unidades asignadas (unit) o heredadas del parent (sector/general)
  "posicion": "",                  // (sector) código de posición — usado por el módulo Bitácora
  "iniciales": "",                 // (general) iniciales del controlador — usado por Bitácora
  "salt": "a1b2…",                 // sal aleatoria (16 bytes hex) por usuario
  "passHash": "9f8e…",             // SHA-256( salt + ":" + password ) en hex
  "mustChangePassword": true,      // fuerza cambio en el primer ingreso
  "active": true,                  // false = cuenta desactivada (no puede entrar)
  "createdAt": 1735600000000,
  "createdBy": "admin"
}
```

Campos mínimos imprescindibles para portar: `username`, `name`, `role`, `salt`, `passHash`,
`mustChangePassword`, `active`. Los campos `unit/units/parent/posicion/iniciales` son
específicos del dominio ATC de RWYCAST — reemplázalos por lo que necesite tu proyecto.

---

## 3. Hash de contraseñas

Las contraseñas **nunca se guardan en claro**. Se usa Web Crypto (`crypto.subtle`), disponible
nativamente en el navegador — sin librerías.

```js
// js/auth/password.js
function randSalt(){                                  // sal aleatoria por usuario
  const a = new Uint8Array(16); crypto.getRandomValues(a);
  return [...a].map(b => b.toString(16).padStart(2,'0')).join('');
}
async function hashPassword(pw, salt){                // SHA-256(salt + ":" + pw) → hex
  const data = new TextEncoder().encode((salt||'') + ':' + pw);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
}
```

Al crear/cambiar contraseña se genera una **sal nueva** y se guardan `salt` + `passHash`
juntos. Al validar, se re-hashea con la sal almacenada y se comparan los hex.

> ⚠️ **Limitación de seguridad a tener presente al portar.** El hash ocurre en el cliente y
> SHA-256 (una sola pasada) no es resistente a fuerza bruta como un KDF real. Como la
> comparación es en el navegador y RTDB es accesible desde el cliente, el modelo confía en
> las **reglas de seguridad de Firebase** para proteger la lectura de `passHash`. Para un
> sistema más robusto: mover la verificación a un backend/Cloud Function y usar un KDF lento
> (bcrypt/scrypt/Argon2/PBKDF2 con muchas iteraciones). Ver §9.

---

## 4. Base de usuarios (persistencia)

`js/services/users.js` abstrae el almacenamiento: si Firebase está configurado usa RTDB,
si no, cae a `localStorage` (útil para desarrollo/offline).

```js
const UPATH = 'runcast/users';

function subscribeUsers(onUsers){          // suscripción en tiempo real → onUsers(mapa, modo)
  const db = ensureFirebase();
  if(db){
    const ref = db.ref(UPATH);
    const cb  = snap => onUsers(snap.val()||{}, 'firebase');
    ref.on('value', cb);
    return () => ref.off('value', cb);     // cleanup
  }
  onUsers(readLocalUsers(), 'local');      // fallback local + polling cada 2.5s
  const t = setInterval(() => onUsers(readLocalUsers(),'local'), 2500);
  return () => clearInterval(t);
}

async function writeUserDb(username, obj){ /* set en RTDB o localStorage */ }
async function deleteUserDb(username){     /* remove */ }
async function loadUsersOnce(){           /* get puntual */ }
```

### Admin sembrado (bootstrap)

Si la base está vacía, se crea automáticamente un **Administrador General** con
`mustChangePassword: true`. Credenciales por defecto definidas en `rbac.js`:

```js
// js/auth/rbac.js
const SEED_ADMIN = { username:'admin', name:'Administrador General', password:'RWYCAST-admin-2026' };
```

```js
// js/services/users.js
async function ensureSeedAdmin(){
  const existing = await loadUsersOnce();
  if(existing && Object.keys(existing).length) return;   // ya hay usuarios → no hace nada
  const salt = randSalt();
  const passHash = await hashPassword(SEED_ADMIN.password, salt);
  await writeUserDb(SEED_ADMIN.username, {
    username:'admin', name:'Administrador General', role:'admin', unit:'',
    salt, passHash, mustChangePassword:true, active:true,
    createdAt:Date.now(), createdBy:'sistema'
  });
}
```

Se llama una vez al montar la app (ver `App` useEffect). **Al portar: cambia estas
credenciales por defecto de inmediato**, o mejor, siembra el admin por fuera del código.

---

## 5. Flujo de autenticación

`login()` vive en `js/components/app.js`. La base de usuarios ya está sincronizada en memoria
(`usersMapRef`), así que login solo compara hashes — no hace un fetch por intento.

```js
async function login(username, password, remember){
  const rec = usersMap[username];
  if(!rec)                return {error:'Usuario no encontrado'};
  if(rec.active === false) return {error:'Usuario inactivo. Contacta al administrador.'};
  const hash = await hashPassword(password, rec.salt||'');
  if(hash !== rec.passHash) return {error:'Contraseña incorrecta'};

  // arma el PERFIL de sesión (nunca incluye salt ni passHash)
  const units = effectiveUnits(rec, usersMap);      // propias o heredadas del parent
  const profile = {
    username, name:rec.name, role:rec.role,
    unit:units[0]||'', units,
    posicion:rec.posicion||'', iniciales:rec.iniciales||'',
    mustChangePassword: !!rec.mustChangePassword
  };
  setUser(profile);
  if(remember) localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
  else          localStorage.removeItem(SESSION_KEY);
  setView(viewsFor(rec.role)[0]);                    // vista inicial según rol
  return {ok:true};
}
```

Puntos clave para reimplementar:

1. **El perfil de sesión no contiene credenciales** — solo identidad y rol. Nunca guardes
   `salt`/`passHash` en el objeto de sesión ni en `localStorage`.
2. **Errores genéricos por campo** (usuario vs contraseña) — RWYCAST los distingue; si te
   importa no filtrar qué usuarios existen, usa un mensaje único ("credenciales inválidas").
3. **Cambio obligatorio de contraseña**: si `mustChangePassword`, la app muestra
   `ForcePassword` antes de dejar entrar (ver §7).

### Renderizado según estado (gate de la app)

```js
// js/components/app.js — al final del componente App
if(!user)                    return h(Login, {onLogin: login});
if(user.mustChangePassword)  return h(ForcePassword, {user, onSubmit: changeMyPassword, onLogout: logout});
// … resto de la app
```

---

## 6. Sesión: recordar, restaurar y revalidar

- **Recordar**: casilla "Mantener sesión iniciada". Si se marca, el perfil se persiste en
  `localStorage` bajo `SESSION_KEY = 'runcast:session'`.
- **Restaurar** (al abrir la app): el estado inicial de `user` se lee de `localStorage`.

  ```js
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch(e){ return null; }
  });
  ```

- **Revalidar contra la base**: cuando llega la base de usuarios sincronizada, se comprueba
  que la cuenta siga existiendo y activa; si fue eliminada o desactivada, cierra sesión sola.

  ```js
  useEffect(() => {
    const u = userRef.current;
    if(!u || !users || !Object.keys(users).length) return;
    const rec = users[u.username];
    if(!rec || rec.active === false) logout();
  }, [users]);
  ```

- **Sincronizar cambios del perfil**: si la sesión recordada existe, se reescribe cuando
  cambia el perfil (p. ej. al limpiar `mustChangePassword`).

- **Logout**: limpia `SESSION_KEY` y pone `user = null`.

  ```js
  function logout(){ localStorage.removeItem(SESSION_KEY); setUser(null); }
  ```

> Nota: la sesión recordada es un snapshot del perfil. Los cambios de **rol/unidades** hechos
> por un admin no se aplican a una sesión ya abierta hasta el próximo login (salvo la
> revalidación de existencia/activo). Si necesitas que el rol se actualice en vivo, resuélvelo
> desde `users[u.username]` en cada render en vez de confiar en el snapshot.

---

## 7. Cambio de contraseña

Tres caminos, todos en `app.js` + UI en `login.js`:

| Función | Cuándo | Verifica contraseña actual |
|---|---|---|
| `changeMyPassword(newPw)` | Cambio **obligatorio** (primer ingreso, `ForcePassword`) | No (ya autenticado en login) |
| `changeMyPasswordSecure(cur, newPw)` | Desde el menú de cuenta (`PasswordModal`) | Sí (re-hashea `cur` y compara) |
| `saveUser(username,{password})` | Admin **restablece** contraseña de otro | No (acción de admin); pone `mustChangePassword:true` |

Todos generan **sal nueva** y actualizan `salt`+`passHash`. Reglas de validación de la UI:
mínimo 6 caracteres, confirmación coincidente, y (en el modal seguro) distinta a la actual.

```js
async function changeMyPasswordSecure(currentPw, newPw){
  const cur = usersMap[me.username];
  const curHash = await hashPassword(currentPw, cur.salt||'');
  if(curHash !== cur.passHash) return {error:'La contraseña actual es incorrecta'};
  const salt = randSalt(); const passHash = await hashPassword(newPw, salt);
  await writeUserDb(me.username, {...cur, salt, passHash, mustChangePassword:false});
  setUser(u => u ? {...u, mustChangePassword:false} : u);
  return {ok:true};
}
```

---

## 8. RBAC — roles y permisos

Cuatro roles, definidos en `js/auth/rbac.js`:

| Rol | Etiqueta | Alcance |
|---|---|---|
| `admin` | Administrador General | Acceso total; gestiona usuarios y edita cualquier unidad |
| `unit` | Usuario de Unidad | Edita sus unidades asignadas (una o varias) |
| `sector` | Usuario de Sector de Control | Pertenece a un `unit` (hereda sus unidades); solo lectura operativa |
| `general` | Usuario General | Pertenece a un `unit`; acceso mínimo (Briefing/Rotación) |

### El patrón de permisos (lo reutilizable)

Dos capas:

1. **Navegación por rol** — `viewsFor(role)` devuelve las vistas/pestañas permitidas. La app
   redirige si la vista actual no está permitida.

   ```js
   function viewsFor(role){
     switch(role){
       case 'admin':  return ['viewer','mando','log','brief','dashboard','equipos','bitacora','rotacion','catalog','users'];
       case 'unit':   return ['viewer','mando','log','brief','dashboard','equipos','bitacora','rotacion','catalog'];
       case 'sector': return ['viewer','mando','log','brief','equipos','bitacora','rotacion'];
       default:       return ['brief','rotacion'];   // general
     }
   }
   ```

2. **Permisos sobre acciones/datos** — funciones puras `canX(user, ...)` consultadas por la
   UI Y **revalidadas en el commit** (no basta ocultar el botón):

   ```js
   function canManageUsers(user){ return !!user && user.role === 'admin'; }
   function canEditAirport(user, ap){
     if(!user || !ap) return false;
     if(user.role === 'admin') return true;
     if(user.role === 'unit')  return userUnits(user).includes(ap.owner);
     return false;   // sector / general → lectura
   }
   // … canUseBitacora, canEditBitacora, canUseRotacion, canEditRotacion,
   //     canUseDashboard, canUseMando, canUseEquipos, canManageAirports, …
   ```

   Ejemplo de la doble verificación (defensa en profundidad): el commit vuelve a chequear el
   permiso aunque la UI ya lo hiciera.

   ```js
   async function commitChange(icao, next, diff){
     const target = airports.find(a => a.icao === icao);
     if(!canEditAirport(user, target)){                 // ← revalida en el "commit"
       pushToast('warn','ACCESO DENEGADO','Tu rol no permite editar '+icao);
       return;
     }
     // … publica el cambio
   }
   ```

> **Patrón portable**: mantén un módulo `rbac` con (a) un mapa rol → vistas y (b) funciones
> `can*()` puras que reciben el `user` y el recurso. Úsalas tanto para pintar la UI como para
> autorizar cada mutación. En este proyecto la autorización es del lado cliente; para que sea
> real deben respaldarla las **reglas de Firebase** (§9).

### Herencia unit → sector/general

`sector` y `general` no eligen unidades: guardan un `parent` (el username de un `unit`) y
**heredan** sus unidades vía `effectiveUnits(rec, usersMap)`. Esto es específico del dominio,
pero el patrón "usuario hijo que hereda el alcance de un padre" es reutilizable.

---

## 9. Seguridad — reglas de Firebase (imprescindible al portar)

Como toda la lógica corre en el cliente, la seguridad real recae en las **reglas de RTDB**.
Sin reglas, cualquiera puede leer `passHash`/`salt` de todos y escribir usuarios. Un punto de
partida (endurécelo según tu caso):

```jsonc
{
  "rules": {
    "runcast": {
      "users": {
        // La app necesita leer la base para validar el login del lado cliente.
        // Esto EXPONE salt/passHash a la red. Alternativa robusta: verificar el
        // login en una Cloud Function y NO permitir lectura pública de este nodo.
        ".read": true,
        ".write": "auth != null && root.child('runcast/users').child(auth.uid).child('role').val() === 'admin'"
      }
    }
  }
}
```

**Recomendaciones para un port más seguro:**

1. Verificar la contraseña en un **backend/Cloud Function**, no en el navegador; no exponer
   `passHash` por lectura pública.
2. Usar un **KDF lento** (bcrypt/scrypt/Argon2/PBKDF2) en lugar de SHA-256 de una pasada.
3. Considerar **Firebase Auth** (email/password o custom tokens) y usar RTDB/Firestore solo
   para el **perfil y el rol**; las reglas leen `auth.uid` para autorizar.
4. No confiar en la autorización de cliente: cada regla de escritura debe validar el rol.
5. Cambiar `SEED_ADMIN` y forzar el cambio de contraseña en el primer uso (ya lo hace).

---

## 10. Cómo portarlo a otro proyecto — checklist

1. **Copiar el núcleo agnóstico**: `password.js` (hash/sal), el patrón de `users.js`
   (subscribe/write/delete/loadOnce + seed admin) y `rbac.js` (roles + `viewsFor` + `can*`).
2. **Config**: define tu `FIREBASE_CONFIG`, tu `UPATH` (ruta de usuarios) y tu `SESSION_KEY`.
   Si no usas Firebase, mantén solo la rama `localStorage` o cámbiala por tu API.
3. **Adaptar el modelo de usuario**: conserva `username/name/role/salt/passHash/
   mustChangePassword/active`; sustituye `unit/units/parent/posicion/iniciales` por los
   campos de tu dominio.
4. **Redefinir roles y permisos** en `rbac.js` (tu mapa rol→vistas y tus `can*()`).
5. **Reusar el flujo** `login/logout/changeMyPassword*` y el gate de render
   (`!user → Login`, `mustChangePassword → ForcePassword`).
6. **Sesión**: decide si quieres "recordar" en `localStorage` o algo más seguro
   (cookie httpOnly emitida por un backend).
7. **Escribir las reglas de Firebase** (§9) — no lo dejes para después.
8. **Endurecer** según §9 si el sistema maneja datos sensibles.

### Fragmento mínimo autocontenido (base para el otro proyecto)

```js
// --- hash ---
const randSalt = () => {
  const a = new Uint8Array(16); crypto.getRandomValues(a);
  return [...a].map(b => b.toString(16).padStart(2,'0')).join('');
};
const hashPassword = async (pw, salt) => {
  const data = new TextEncoder().encode((salt||'') + ':' + pw);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
};

// --- crear usuario ---
async function makeUser({username, name, role, password}){
  const salt = randSalt();
  const passHash = await hashPassword(password, salt);
  return { username, name, role, salt, passHash, mustChangePassword:true, active:true, createdAt:Date.now() };
}

// --- validar login ---
async function verify(rec, password){
  if(!rec || rec.active === false) return false;
  return (await hashPassword(password, rec.salt||'')) === rec.passHash;
}

// --- RBAC ---
const VIEWS = { admin:['*'], editor:['home','edit'], viewer:['home'] };
const can = {
  manageUsers: u => !!u && u.role === 'admin',
  edit:        u => !!u && (u.role === 'admin' || u.role === 'editor'),
};
```

---

## Apéndice — Glosario de campos específicos de RWYCAST

Estos campos son del dominio ATC; menciónalos solo si tu proyecto los necesita:

- `unit` / `units`: aeródromos/unidades ATC que el usuario puede editar.
- `parent`: username del "usuario de unidad" del que cuelga un `sector`/`general`.
- `posicion`: código de sector de control (rol `sector`) usado por el módulo Bitácora (FORM ATC-6).
- `iniciales`: iniciales del controlador (rol `general`) usadas por la Bitácora.
- `owner` (en aeródromos): unidad propietaria; `canEditAirport` compara contra `units`.

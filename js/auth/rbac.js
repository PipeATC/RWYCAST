// RBAC — roles, permisos, viewsFor, canEditAirport, …
const ROLES=['admin','unit','sector','general'];
const ROLE_LABEL={
  admin:'Administrador General',
  unit:'Usuario de Unidad',
  sector:'Usuario de Sector de Control',
  general:'Usuario General',
};
const ROLE_SHORT={admin:'ADMIN',unit:'UNIDAD',sector:'SECTOR',general:'GENERAL'};
const TAB_LABEL={viewer:'Visor',log:'Registro',brief:'Briefing',dashboard:'Dashboard',bitacora:'Bitácora',rotacion:'Rotación',catalog:'Data Base',users:'Usuarios'};
const RAIL_META={
  viewer:['Visor operacional',Ic.tower],
  log:['Registro de cambios',Ic.log],
  brief:['Briefing de turno',Ic.brief],
  dashboard:['Dashboard de decisiones',Ic.dash],
  bitacora:['Bitácora de posición',Ic.book],
  rotacion:['Rotación de estaciones',Ic.rot],
  catalog:['Data Base de unidades',Ic.cfg],
  users:['Gestión de usuarios',Ic.users],
};

// Abreviatura de dependencia para la cabecera de la bitácora (FORM ATC-6).
// Mapea códigos conocidos; para el resto deriva quitando el sufijo de tipo de unidad.
const DEP_ABBREV={'ACC-SANTIAGO':'ACCS'};
function depAbbrev(code){
  if(!code) return '—';
  if(DEP_ABBREV[code]) return DEP_ABBREV[code];
  return code.replace(/-(TWR|APP|ACC|CTR)$/,'');
}

// Roles que gestionan directamente unidades aeroportuarias del catálogo (solo unit).
function roleNeedsUnit(role){ return role==='unit'; }
// Roles que pertenecen a un usuario de unidad (sector y general): heredan sus unidades.
function roleNeedsParent(role){ return role==='sector'||role==='general'; }
// Unidades aeroportuarias asociadas al registro. El usuario de unidad las gestiona
// directamente (units[]); sector/general guardan una copia heredada de su usuario de
// unidad padre. Acepta tanto un perfil de sesión como un registro DB.
function userUnits(u){
  if(!u) return [];
  if(Array.isArray(u.units) && u.units.length) return u.units;
  return u.unit ? [u.unit] : [];
}
// Unidades efectivas: propias (unit/admin) o, si pertenece a un usuario de unidad
// (sector/general), las de su usuario de unidad padre resuelto desde la base.
function effectiveUnits(rec, usersMap){
  if(!rec) return [];
  if(roleNeedsParent(rec.role)){
    const p = rec.parent && (usersMap||{})[rec.parent];
    return p ? userUnits(p) : userUnits(rec);
  }
  return userUnits(rec);
}
// Dependencia (unidad ATC) a la que pertenece el usuario para Briefing, Rotación y
// Bitácora. Un usuario de unidad ES una dependencia: su identidad es su propio username
// (p. ej. "ACCS"), independiente de los aeródromos que tenga asignados para EDITAR en
// units[] (esos son solo su jurisdicción editable en el visor). Sector y general
// pertenecen a un usuario de unidad (parent) y comparten esa dependencia. El admin no
// tiene dependencia propia (las ve todas).
function userDep(u){
  if(!u) return '';
  if(u.role==='unit') return u.username;
  if(roleNeedsParent(u.role)) return u.parent||'';
  return '';
}
// Etiqueta de una dependencia para Briefing/Rotación/Bitácora/Dashboard. El código de la
// dependencia ES el username del usuario de unidad (p. ej. "ACCS"), que es su identificador
// operacional; se muestra tal cual. (El campo "Nombre para mostrar" del usuario puede ser
// un nombre de persona, por eso no se usa aquí.) `users` se mantiene por si a futuro se
// agrega un nombre de unidad dedicado.
function depName(depCode, users){
  return depCode||'—';
}

// Pestañas permitidas por rol (control de rutas / navegación)
function viewsFor(role){
  switch(role){
    case 'admin':  return ['viewer','log','brief','dashboard','bitacora','rotacion','catalog','users'];
    case 'unit':   return ['viewer','log','brief','dashboard','bitacora','rotacion','catalog'];
    case 'sector': return ['viewer','log','brief','bitacora','rotacion'];
    default:       return ['brief','rotacion']; // general — ve el Briefing y su rotación
  }
}
// ¿Puede el usuario editar este aeródromo? (capa de permisos sobre los datos)
function canEditAirport(user,ap){
  if(!user||!ap) return false;
  if(user.role==='admin') return true;            // total: cualquier unidad
  if(user.role==='unit')  return userUnits(user).includes(ap.owner); // solo sus unidades
  return false;                                    // sector / general → lectura
}
function canManageUsers(user){ return !!user && user.role==='admin'; }
// --- Bitácora de posición (FORM ATC-6) ---
// ¿Puede acceder al módulo? admin, usuario de unidad y usuario de sector.
function canUseBitacora(user){ return !!user && (user.role==='admin'||user.role==='unit'||user.role==='sector'); }
// ¿Puede ESCRIBIR en la bitácora de una posición (dependencia + sector)?
//   admin → cualquiera · unit → posiciones de su dependencia · sector → solo su propia posición.
function canEditBitacora(user,depCode,sectorUsername){
  if(!user) return false;
  if(user.role==='admin') return true;
  if(user.role==='unit')  return userDep(user)===depCode;
  if(user.role==='sector') return user.username===sectorUsername && userDep(user)===depCode;
  return false;
}
// ¿Puede generar el reporte imprimible de fin de día? admin y usuario de unidad.
function canReportBitacora(user){ return !!user && (user.role==='admin'||user.role==='unit'); }
// --- Rotación de estaciones de trabajo ---
// ¿Puede ver el módulo? Todos los roles con sesión (cada ATC ve su rotación).
function canUseRotacion(user){ return !!user; }
// ¿Puede armar/editar la rotación? admin (cualquier dependencia) y unit (la suya).
function canEditRotacion(user,depCode){
  if(!user) return false;
  if(user.role==='admin') return true;
  if(user.role==='unit')  return userDep(user)===depCode;
  return false;
}
// --- Dashboard de toma de decisiones (carga de trabajo / dotación) ---
// Herramienta de decisión del supervisor: admin y usuario de unidad.
function canUseDashboard(user){ return !!user && (user.role==='admin'||user.role==='unit'); }
// ¿Puede el usuario acceder al módulo Data Base? (admin = toda la red, unit = su unidad)
function canUseCatalog(user){ return !!user && (user.role==='admin'||user.role==='unit'); }
// ¿Puede agregar/eliminar unidades aeroportuarias? (solo Administrador General)
function canManageAirports(user){ return !!user && user.role==='admin'; }
const USERNAME_RE=/^[a-zA-Z0-9_-]{3,32}$/;          // claves válidas en RTDB

// Admin sembrado en código (bootstrap). Se obliga a cambiar la contraseña en
// el primer ingreso. Cambia estas credenciales por defecto cuanto antes.
const SEED_ADMIN={username:'admin', name:'Administrador General', password:'RWYCAST-admin-2026'};

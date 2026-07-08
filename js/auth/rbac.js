// RBAC — roles, permisos, viewsFor, canEditAirport, …
const ROLES=['admin','unit','sector','general'];
const ROLE_LABEL={
  admin:'Administrador General',
  unit:'Usuario de Unidad',
  sector:'Usuario de Sector de Control',
  general:'Usuario General',
};
const ROLE_SHORT={admin:'ADMIN',unit:'UNIDAD',sector:'SECTOR',general:'GENERAL'};
const TAB_LABEL={viewer:'Visor',log:'Bitácora',brief:'Briefing',catalog:'Catálogo',users:'Usuarios'};
const RAIL_META={
  viewer:['Visor operacional',Ic.tower],
  log:['Bitácora de cambios',Ic.log],
  brief:['Briefing de turno',Ic.brief],
  catalog:['Catálogo de datos',Ic.cfg],
  users:['Gestión de usuarios',Ic.users],
};

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

// Pestañas permitidas por rol (control de rutas / navegación)
function viewsFor(role){
  switch(role){
    case 'admin':  return ['viewer','log','brief','catalog','users'];
    case 'unit':   return ['viewer','log','brief','catalog'];
    case 'sector': return ['viewer','log','brief'];
    default:       return ['brief']; // general
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
// ¿Puede el usuario acceder al módulo Catálogo? (admin = toda la red, unit = su unidad)
function canUseCatalog(user){ return !!user && (user.role==='admin'||user.role==='unit'); }
// ¿Puede agregar/eliminar unidades aeroportuarias? (solo Administrador General)
function canManageAirports(user){ return !!user && user.role==='admin'; }
const USERNAME_RE=/^[a-zA-Z0-9_-]{3,32}$/;          // claves válidas en RTDB

// Admin sembrado en código (bootstrap). Se obliga a cambiar la contraseña en
// el primer ingreso. Cambia estas credenciales por defecto cuanto antes.
const SEED_ADMIN={username:'admin', name:'Administrador General', password:'RWYCAST-admin-2026'};

import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const m = html.match(/<script type="text\/babel">\r?\n([\s\S]*?)\r?\n<\/script>/);
if (!m) throw new Error('babel block not found');
const src = m[1].replace(/\r\n/g, '\n');

function between(start, end) {
  const i = src.indexOf(start);
  if (i < 0) throw new Error('start not found: ' + JSON.stringify(start.slice(0, 80)));
  const j = end ? src.indexOf(end, i + start.length) : src.length;
  if (j < 0) throw new Error('end not found after: ' + JSON.stringify(start.slice(0, 80)));
  return src.slice(i, j).trimEnd() + '\n';
}

function write(rel, body, header = '') {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, (header ? header + '\n' : '') + body);
  console.log('wrote', rel);
}

write('js/core/react-setup.js', between('const {useState', '/* ============================================================\n   SEED DATA'), '// React helpers');
write('js/data/seed.js', between('/* ============================================================\n   SEED DATA', '/* ============================================================\n   ICONS'), '// Seed data — unidades ATC y aeropuertos de Chile');
write('js/data/icons.js', between('/* ============================================================\n   ICONS', '/* ============================================================\n   SYNC LAYER'), '// SVG icon components');

write('js/config/keys.js',
  between('const FIREBASE_CONFIG = {', 'let _dbRef=null') +
  between("const BKEY='runcast:briefing:v1'", 'let _briefRef=null') +
  between("const UPATH='runcast/users'", 'function ensureFirebase') +
  between("const SESSION_KEY='runcast:session'", 'function App()'),
  '// Firebase config and storage keys\n// 👉 CONFIGURA AQUÍ tu proyecto Firebase');

write('js/services/firebase.js',
  between('function firebaseConfigured()', '/* Suscribe a cambios remotos') +
  between('function ensureFirebase()', 'function readLocalUsers()'),
  '// Firebase connectivity — firebaseConfigured / ensureFirebase');

write('js/services/state.js',
  'let _dbRef=null;\n\n' +
  between('/* Suscribe a cambios remotos', '/* Suscribe a los METAR') +
  between('async function loadLocal()', '/* ---- Briefing ACCS'),
  '// Operational state — subscribeState / publishState / loadLocal / saveLocal');

write('js/services/metars.js',
  between('/* Suscribe a los METAR', 'async function loadLocal()'),
  '// METAR en vivo — subscribeMetars');

write('js/services/briefing.js',
  'let _briefRef=null;\n\n' +
  between('const BF_STATUS=[', '/* ============================================================\n   RBAC'),
  '// Briefing ACCS — subscribeBriefing / saveBriefing / bf* helpers');

write('js/auth/rbac.js',
  between('const ROLES=[', '/* ---- Hash de contraseñas'),
  '// RBAC — roles, permisos, viewsFor, canEditAirport, …');

write('js/auth/password.js',
  between('/* ---- Hash de contraseñas', '/* ---- Backend de usuarios'),
  '// Password hashing — randSalt / hashPassword');

write('js/services/users.js',
  between('function readLocalUsers()', 'function nowZ()'),
  '// User database — subscribeUsers / writeUserDb / ensureSeedAdmin, …');

write('js/utils/time.js', between('function nowZ()', '/* ============================================================\n   APP'), '// Zulu clock — nowZ / clockZ / ageMin');

write('js/utils/catalog.js', between('function fieldLabel(f)', '/* ---------------- Login ----------------'), '// Catálogo — fieldLabel / cleanList / cleanStars / reconcileEpUse, …');

write('js/components/app.js', between('function App()', 'function fieldLabel(f)'), '// App root — estado global y orquestación');
write('js/components/login.js', between('function Login({onLogin})', '/* ---------------- Top Bar ----------------'), '// Login — Login / ForcePassword');
write('js/components/layout.js',
  between('function TopBar({user,clock', '/* ---------------- Viewer ----------------') +
  between('function AlertBanner({alerts', '/* ---------------- Footer ----------------') +
  between('function Footer({user,clock', '/* ---------------- Mobile Tabs ----------------') +
  between('function MobileTabs({view', '/* ---------------- Catálogo:'),
  '// Layout — TopBar / AlertBanner / Footer / MobileTabs');
write('js/components/viewer.js', between('function Viewer({airports', '/* ---------------- Log ----------------'), '// Visor operacional — Viewer / AirportCard / Editor, …');
write('js/components/log.js', between('function LogView({logs', '/* ---------------- Briefing ----------------'), '// Bitácora — LogView');
write('js/components/briefing-view.js', between('function BfSec(num,title', '/* ---------------- Alert Banner'), '// Briefing UI — BfSec / BfPill / Briefing');
write('js/components/catalog-view.js', between('function CatalogAdmin({airports', '/* ---------------- Gestión de usuarios'), '// Catálogo UI — CatalogAdmin / CatalogUnitEditor / AirportEditor, …');
write('js/components/users-view.js', between('function UsersAdmin({users', 'ReactDOM.createRoot'), '// Usuarios UI — UsersAdmin / UserEditor');

write('js/main.js',
  "ReactDOM.createRoot(document.getElementById('root')).render(h(App));\n\n" +
  "if ('serviceWorker' in navigator) {\n" +
  "  window.addEventListener('load', () => {\n" +
  "    navigator.serviceWorker.register('sw.js')\n" +
  "      .catch(err => console.warn('[RWYCAST] Service worker no registrado:', err));\n" +
  "  });\n" +
  "}\n",
  '// Bootstrap — monta la aplicación React y registra el service worker (PWA)');

console.log('done');

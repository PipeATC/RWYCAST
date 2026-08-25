// Firebase config and storage keys
// 👉 CONFIGURA AQUÍ tu proyecto Firebase
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCHzfEjS4xWeM2EWWaP5OR6a2AZEWdUG58",
  authDomain:        "atcbrief.firebaseapp.com",
  databaseURL:       "https://atcbrief-default-rtdb.firebaseio.com",
  projectId:         "atcbrief",
  storageBucket:     "atcbrief.firebasestorage.app",
  messagingSenderId: "394162283361",
  appId:             "1:394162283361:web:1ecbebce83c4ada8745b20",
};

const SKEY='runcast:state:v1';            // clave en modo local (window.storage)
const DBPATH='runcast/state/v1';          // ruta del estado compartido en Firebase
const BKEY='runcast:briefing:v1';
const BPATH='runcast/briefing/current';
const UPATH='runcast/users';
const BITKEY='runcast:bitacora:v1';    // clave local de la Bitácora de Posición (FORM ATC-6)
const BITPATH='runcast/bitacora';      // ruta compartida de la Bitácora en Firebase
const ROTKEY='runcast:rotacion:v1';    // clave local del cuadro de Rotación de estaciones
const ROTPATH='runcast/rotacion';      // ruta compartida de la Rotación en Firebase
const ATFMPATH='runcast/atfm';         // feed ATFM por dependencia (lo escribe el Worker; ver js/services/atfm.js)
const EQKEY='runcast:equipos:v1';      // clave local del módulo Equipos e instalaciones
const EQPATH='runcast/equipos';        // ruta compartida de Equipos en Firebase ({icao:{items,notams,…}})
// URL pública del Cloudflare Worker ATFM (cloudflare/atfm/worker.js). El botón
// "Actualizar desde Power BI" del Dashboard hace GET a esta URL → el Worker consulta
// Power BI server-side y escribe en RTDB → la app se refresca sola por la suscripción.
// Déjala vacía hasta hacer `wrangler deploy`; pega aquí la URL (p. ej. https://rwycast-atfm.<tu-subdominio>.workers.dev).
const ATFM_WORKER_URL='';
const SESSION_KEY='runcast:session';   // sesión recordada ("mantener sesión iniciada")

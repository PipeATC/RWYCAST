// Feed ATFM en vivo — subscribeAtfm / atfmForDep
/* ------------------------------------------------------------------
   CAPA DE DESACOPLE del Dashboard respecto del origen ATFM.

   El Dashboard NO habla con Power BI directamente. Un job server-side
   (Cloudflare Worker, ver cloudflare/atfm-worker.js) lee el ATFM —hoy el
   reporte público "publish to web" de Power BI— lo transforma a la forma
   de abajo y lo publica en Firebase RTDB bajo /runcast/atfm/<dependencia>.
   La app se suscribe en tiempo real y dashboardData() lo mezcla con el
   roster propio. Si el nodo no existe (o falta un campo), el Dashboard cae
   limpio a los datos simulados: nunca se rompe.

   Cambiar de origen (export CSV, API oficial, carga manual) = cambiar el
   Worker; la app no se toca mientras se respete este contrato.

   CONTRATO  /runcast/atfm/<dep>   (todos los campos son OPCIONALES):
   {
     updatedAt: 1721563200000,   // ms epoch de la última escritura del feed
     source:    'powerbi-ptw',   // origen: powerbi-ptw | api | manual
     capacidad: 48,              // capacidad declarada por hora (nº)
     hourly: [                   // EXACTAMENTE 24 entradas, h:0..23
       { h:0, demanda:9, capacidad:48, complejidad:41 }, ...
     ],
     sectores: [                 // carga por sector de ATFM
       { code:'R15', load:41, cap:44 }, ...
     ],
     regulaciones: [             // slots / regulaciones de flujo activas
       { ref:'SCEL01', sector:'R15', from:'21:00', to:'22:00',
         rate:30, delay:12, reason:'Capacidad', level:'warn' }, ...
     ]
   }
   dep = username del usuario de unidad (p. ej. "ACCS"), = clave del nodo.
   ------------------------------------------------------------------ */

// Suscribe al feed ATFM compartido. onAtfm({ <dep>:{...}, ... }). Devuelve limpieza.
function subscribeAtfm(onAtfm){
  if(firebaseConfigured()){
    try{
      if(!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      const ref=firebase.database().ref(ATFMPATH);
      const cb=snap=>onAtfm(snap.val()||{});
      ref.on('value', cb);
      return ()=>{ try{ ref.off('value',cb); }catch(e){} };
    }catch(e){ console.warn('[RWYCAST] ATFM no disponible:', e); }
  }
  return ()=>{};
}

// Selecciona el paquete ATFM de una dependencia del mapa suscrito (o null).
function atfmForDep(atfmMap, dep){
  if(!atfmMap || !dep) return null;
  const a=atfmMap[dep];
  return (a && typeof a==='object') ? a : null;
}

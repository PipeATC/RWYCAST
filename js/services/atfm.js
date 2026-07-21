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

   CONTRATO  /runcast/atfm/<dep>   (todos los campos son OPCIONALES).

   Un DÍA es este paquete:
   {
     capacidad: 48,              // capacidad declarada por hora (nº)
     hourly: [                   // EXACTAMENTE 24 entradas, h:0..23
       { h:0, demanda:9, capacidad:48, complejidad:41 }, ...
     ],
     sectores: [ { code:'R15', load:41, cap:44 }, ... ],   // carga por sector
     regulaciones: [                                        // slots / regulaciones
       { ref:'SCEL01', sector:'R15', from:'21:00', to:'22:00',
         rate:30, delay:12, reason:'Capacidad', level:'warn' }, ...
     ]
   }

   El nodo del dep admite DOS formas:
   (A) MULTI-DÍA (horizonte, p. ej. hoy +3) — lo escribe el Worker diario:
       {
         updatedAt: 1721563200000, source:'powerbi-ptw',
         days: { "2026-07-21": <DÍA>, "2026-07-22": <DÍA>, ... }  // clave = fecha
       }
       El Dashboard muestra el día de su selector de fecha (days[fecha]).
   (B) UN SOLO DÍA (compat / carga manual) — el nodo ES el <DÍA> más
       {updatedAt, source}. Se usa para cualquier fecha seleccionada.

   dep = username del usuario de unidad (p. ej. "ACCS"), = clave del nodo.
   fecha = "YYYY-MM-DD" (misma que usa el selector del Dashboard, rotToday()).
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

// Selecciona el paquete ATFM de una dependencia para la fecha del Dashboard.
// - Nodo MULTI-DÍA (con `days`): devuelve el día pedido (o null → simula ese día).
// - Nodo de UN SOLO DÍA (compat/manual): lo devuelve para cualquier fecha.
function atfmForDep(atfmMap, dep, dateStr){
  if(!atfmMap || !dep) return null;
  const node=atfmMap[dep];
  if(!node || typeof node!=='object') return null;
  if(node.days && typeof node.days==='object'){
    const day = dateStr && node.days[dateStr];
    if(day && typeof day==='object')
      return Object.assign({ source:node.source, updatedAt:node.updatedAt }, day);
    return null;               // hay horizonte pero no ese día → cae a simulado
  }
  return node;                 // formato de un solo día (compat)
}

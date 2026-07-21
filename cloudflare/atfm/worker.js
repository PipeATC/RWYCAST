/**
 * RWYCAST — ATFM feed (Cloudflare Worker + Cron Trigger)
 * -----------------------------------------------------------------------------
 * Alimenta el Dashboard de decisiones con datos ATFM reales, publicándolos en
 * Firebase RTDB bajo /runcast/atfm/<dependencia>. La app los lee en tiempo real
 * (subscribeAtfm → dashboardData los mezcla con el roster). Contrato de datos:
 * ver js/services/atfm.js. Si este Worker no escribe, el Dashboard cae limpio a
 * los datos simulados: nunca se rompe.
 *
 * ORIGEN HOY: reporte público "Publicar en la web" de Power BI (ATFM). Como es
 * publish-to-web (anónimo), NO requiere Azure AD ni service principal. Estrategia
 * robusta y honesta: **capturar una vez** la petición `querydata` del reporte
 * (desde el navegador) y **reproducirla** aquí en cada cron. Evita reversear el
 * flujo de descubrimiento de Power BI (frágil) — el host de región, el modelId y
 * el cuerpo de la consulta salen de la captura.
 *
 *   ⚠️ CAVEATS del publish-to-web (dile esto a quien lo opere):
 *   - Los datos van con RETARDO (Power BI cachea publish-to-web, ~1 h o más).
 *   - El endpoint querydata NO está documentado: Microsoft puede cambiarlo.
 *   - Es un reporte de OTRA organización en "fase de prueba": puede cambiar de
 *     estructura o desaparecer. Lo robusto a futuro es un export/API oficial.
 *
 * TRES MODOS (los tres escriben la MISMA forma en RTDB):
 *   GET  /            → refresca desde Power BI (replay de la captura) y resume.
 *   GET  /demo        → escribe un paquete SINTÉTICO válido (para ver el tablero
 *                       en "ATFM EN VIVO" end-to-end sin resolver la captura).
 *   POST /feed?dep=X  → ingesta manual: el cuerpo JSON (ya en forma de contrato)
 *                       se valida y se escribe. Sirve para carga manual o para
 *                       alimentar desde cualquier script externo. Requiere FEED_KEY.
 *
 * VARIABLES (wrangler.toml [vars] + secrets):
 *   RTDB_URL           URL base de la Realtime Database (sin barra final).
 *   DEP                Clave de dependencia por defecto (p. ej. "ACCS").
 *   RTDB_SECRET        (secret, opcional) database secret de Firebase (auth de escritura).
 *   FEED_KEY           (secret, opcional) protege POST /feed y GET /demo.
 *   PBI_RESOURCE_KEY   (secret) el "k" del token del reporte (X-PowerBI-ResourceKey).
 *   PBI_QUERYDATA_URL  (var/secret) URL EXACTA de querydata capturada del reporte.
 *   PBI_QUERY_BODY     (secret) cuerpo JSON EXACTO de esa petición (como string).
 *                      Cómo capturarlos: ver README.md → "Capturar la consulta".
 */

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(refreshFromPbi(env).catch((e) => console.error('ATFM cron:', e)));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === 'POST' && url.pathname === '/feed') {
        return await handleManualFeed(request, env, url);
      }
      if (url.pathname === '/demo') {
        requireFeedKey(env, url);
        const dep = url.searchParams.get('dep') || env.DEP || 'ACCS';
        const payload = demoPayload();
        await writeAtfm(env, dep, payload);
        return json({ ok: true, mode: 'demo', dep, wrote: summarize(payload) }, 200);
      }
      // GET / (o cualquier otra) → refresco desde Power BI.
      const result = await refreshFromPbi(env);
      return json(result, result.ok ? 200 : 502);
    } catch (err) {
      return json({ ok: false, error: String((err && err.message) || err) }, 500);
    }
  },
};

/* ---------------------------------------------------------------------------
 * 1) REFRESCO DESDE POWER BI (replay de la captura)
 * ------------------------------------------------------------------------- */
async function refreshFromPbi(env) {
  const dep = env.DEP || 'ACCS';
  const queryUrl = env.PBI_QUERYDATA_URL;
  const body = env.PBI_QUERY_BODY;
  const key = env.PBI_RESOURCE_KEY;
  if (!queryUrl || !body || !key) {
    return {
      ok: false,
      msg: 'Falta configurar la captura de Power BI (PBI_QUERYDATA_URL / PBI_QUERY_BODY / PBI_RESOURCE_KEY). ' +
           'Ver README.md → "Capturar la consulta". Mientras tanto usa GET /demo o POST /feed.',
    };
  }

  const resp = await fetch(queryUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'X-PowerBI-ResourceKey': key,
      // ActivityId/RequestId ayudan a que Power BI no rechace la petición.
      'ActivityId': crypto.randomUUID(),
      'RequestId': crypto.randomUUID(),
    },
    body,
    cf: { cacheTtl: 0 },
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    return { ok: false, msg: `Power BI querydata respondió ${resp.status}`, detail: text.slice(0, 400) };
  }
  const raw = await resp.json();

  const payload = mapPbiToContract(raw);
  payload.updatedAt = Date.now();
  payload.source = 'powerbi-ptw';
  const problems = validateContract(payload);
  if (problems.length) {
    // No pisamos datos previos con algo inválido; devolvemos el diagnóstico.
    return { ok: false, msg: 'El mapeo no produjo un paquete válido; revisa mapPbiToContract().', problems };
  }
  await writeAtfm(env, dep, payload);
  return { ok: true, mode: 'powerbi', dep, wrote: summarize(payload), updatedAt: payload.updatedAt };
}

/* Convierte la RESPUESTA de querydata de Power BI al contrato /runcast/atfm/<dep>.
 * ⚠️ ESTE MAPEO ES ESPECÍFICO DEL REPORTE: depende de qué medidas/columnas pediste
 * en la consulta capturada. La respuesta de Power BI trae los datos en
 * results[0].result.data.dsr.DS[0].PH[...].DM0[] (matriz comprimida). Cuando tengas
 * una respuesta real (GET / imprime `detail` si algo falla; o inspecciónala en el
 * navegador), completa la extracción. Abajo queda un lector genérico + TODOs. */
function mapPbiToContract(raw) {
  // Lector tolerante del "data shape result" (DSR) de Power BI.
  const rows = extractDsrRows(raw); // → [[c0, c1, ...], ...] según el orden de tu Select
  // TODO(captura): mapear columnas de `rows` a demanda/capacidad por hora y sectores.
  // Ejemplo ILUSTRATIVO (ajusta índices/orden a tu consulta):
  //   rows = [ [hora(0-23), demanda, capacidad], ... ]
  const hourly = [];
  if (rows.length) {
    const byHour = new Map();
    for (const r of rows) {
      const h = Number(r[0]);
      if (Number.isInteger(h) && h >= 0 && h <= 23) {
        byHour.set(h, { h, demanda: Number(r[1]) || 0, capacidad: Number(r[2]) || undefined });
      }
    }
    if (byHour.size === 24) for (let h = 0; h < 24; h++) hourly.push(byHour.get(h));
  }

  const payload = {};
  if (hourly.length === 24) payload.hourly = hourly;
  // TODO(captura): payload.sectores = [...]; payload.regulaciones = [...]; payload.capacidad = N;
  return payload;
}

/* Aplana el DSR de Power BI a filas. Maneja el esquema comprimido (R/Ø/copia del
 * valor anterior) de forma básica; suficiente para consultas simples de tabla. */
function extractDsrRows(raw) {
  try {
    const dsr = raw.results[0].result.data.dsr;
    const ds = dsr.DS[0];
    const cols = (ds.ValueDicts && ds.ValueDicts) || null; // diccionarios de valores (si hay)
    const dm = (ds.PH && ds.PH[0] && ds.PH[0].DM0) || ds.DM0 || [];
    const out = [];
    let prev = [];
    for (const item of dm) {
      const c = item.C || []; // valores de la fila
      const restated = [];
      // R = bitmask de columnas "repetidas" (copiar de la fila anterior)
      const R = item.R || 0;
      let ci = 0;
      for (let col = 0; col < Math.max(c.length + countBits(R), prev.length); col++) {
        if (R & (1 << col)) restated[col] = prev[col];
        else restated[col] = c[ci++];
      }
      out.push(restated);
      prev = restated;
    }
    return out;
  } catch (_) {
    return [];
  }
}
function countBits(n) { let b = 0; while (n) { b += n & 1; n >>= 1; } return b; }

/* ---------------------------------------------------------------------------
 * 2) INGESTA MANUAL  (POST /feed?dep=ACCS)  — cuerpo ya en forma de contrato
 * ------------------------------------------------------------------------- */
async function handleManualFeed(request, env, url) {
  requireFeedKey(env, url);
  const dep = url.searchParams.get('dep') || env.DEP || 'ACCS';
  let payload;
  try { payload = await request.json(); }
  catch (_) { return json({ ok: false, error: 'Cuerpo JSON inválido' }, 400); }

  // normaliza metadatos
  payload.updatedAt = Date.now();
  payload.source = payload.source || 'manual';
  const problems = validateContract(payload);
  if (problems.length) return json({ ok: false, error: 'Paquete inválido', problems }, 400);

  await writeAtfm(env, dep, payload);
  return json({ ok: true, mode: 'manual', dep, wrote: summarize(payload) }, 200);
}

/* ---------------------------------------------------------------------------
 * Validación del contrato (misma forma que espera js/services/atfm.js)
 * ------------------------------------------------------------------------- */
function validateContract(p) {
  const problems = [];
  if (!p || typeof p !== 'object') { return ['payload no es objeto']; }
  const hasSomething = p.hourly || p.sectores || p.regulaciones || p.capacidad != null;
  if (!hasSomething) problems.push('el paquete no trae hourly, sectores, regulaciones ni capacidad');
  if (p.hourly !== undefined) {
    if (!Array.isArray(p.hourly) || p.hourly.length !== 24) problems.push('hourly debe ser un arreglo de 24 elementos');
    else p.hourly.forEach((x, i) => { if (!x || !Number.isFinite(Number(x.demanda))) problems.push(`hourly[${i}].demanda inválida`); });
  }
  if (p.sectores !== undefined && !Array.isArray(p.sectores)) problems.push('sectores debe ser arreglo');
  if (p.regulaciones !== undefined && !Array.isArray(p.regulaciones)) problems.push('regulaciones debe ser arreglo');
  return problems;
}

function summarize(p) {
  return {
    hourly: Array.isArray(p.hourly) ? p.hourly.length : 0,
    sectores: Array.isArray(p.sectores) ? p.sectores.length : 0,
    regulaciones: Array.isArray(p.regulaciones) ? p.regulaciones.length : 0,
    capacidad: p.capacidad ?? null,
  };
}

/* ---------------------------------------------------------------------------
 * RTDB write  → /runcast/atfm/<dep>
 * ------------------------------------------------------------------------- */
async function writeAtfm(env, dep, payload) {
  const base = (env.RTDB_URL || '').replace(/\/+$/, '');
  if (!base) throw new Error('Falta RTDB_URL');
  const auth = env.RTDB_SECRET ? `?auth=${encodeURIComponent(env.RTDB_SECRET)}` : '';
  const key = encodeURIComponent(dep);
  const put = await fetch(`${base}/runcast/atfm/${key}.json${auth}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!put.ok) throw new Error(`RTDB PUT respondió ${put.status}`);
}

function requireFeedKey(env, url) {
  if (!env.FEED_KEY) return; // si no se configuró, no se exige (útil en pruebas)
  const given = url.searchParams.get('key');
  if (given !== env.FEED_KEY) {
    const e = new Error('FEED_KEY inválida o ausente'); e.status = 401; throw e;
  }
}

/* Paquete sintético pero VÁLIDO — para probar el pipeline end-to-end sin resolver
 * la captura. Curva con punta a las 21:00 y una regulación activa. */
function demoPayload() {
  const shape = [9,6,4,3,3,5,12,28,44,49,45,43,46,48,45,47,50,53,49,39,29,21,15,10];
  const capacidad = 48;
  const hourly = shape.map((demanda, h) => ({ h, demanda, capacidad }));
  return {
    capacidad,
    hourly,
    sectores: [
      { code: 'R15', load: 52, cap: 44 },
      { code: 'R05', load: 30, cap: 40 },
      { code: 'APP', load: 22, cap: 36 },
    ],
    regulaciones: [
      { ref: 'SCEL01', sector: 'R15', from: '20:00', to: '22:00', rate: 30, delay: 14, reason: 'Capacidad de pista', level: 'warn' },
    ],
  };
}

function json(obj, status) {
  return new Response(JSON.stringify(obj, null, 2), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

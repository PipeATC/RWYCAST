/**
 * RWYCAST — ATFM feed (Cloudflare Worker + Cron Trigger)  ·  MULTI-DÍA
 * -----------------------------------------------------------------------------
 * Alimenta el Dashboard de decisiones con datos ATFM reales, publicándolos en
 * Firebase RTDB bajo /runcast/atfm/<dependencia>. La app los lee en tiempo real
 * (subscribeAtfm → atfmForDep → dashboardData). Contrato: ver js/services/atfm.js.
 * Si este Worker no escribe, el Dashboard cae limpio a los datos simulados.
 *
 * CASO OBJETIVO: los datos de la Power BI de SCEL se muestran en el Dashboard de
 * ACCS (el ACC controla el área de SCEL). Se ACTUALIZA UNA VEZ AL DÍA con un
 * HORIZONTE de HORIZON_DAYS días en adelante (por defecto 3 → hoy + 3 días).
 * Se escribe el nodo MULTI-DÍA: { source, updatedAt, days:{ "YYYY-MM-DD":<día> } }.
 * El PUT reemplaza el nodo completo, así los días viejos se purgan solos.
 *
 * ORIGEN: reporte público "Publicar en la web" de Power BI (publish-to-web,
 * anónimo, sin Azure AD). Estrategia robusta: **capturar una vez** la petición
 * `querydata` del reporte (DevTools → Network, ver README) y **reproducirla** aquí.
 *
 *   ⚠️ Publish-to-web va con RETARDO (caché ~1 h) y el endpoint no está
 *   documentado. Para un pronóstico diario a 3 días eso es aceptable, pero para
 *   producción operacional lo robusto es un export/API oficial del dueño.
 *
 * FECHAS: las claves de día son fecha LOCAL de Chile (America/Santiago), para
 * calzar con rotToday() del Dashboard.
 *
 * MODOS (todos escriben la misma forma multi-día):
 *   GET  /            → refresca desde Power BI (replay) y escribe el horizonte.
 *   GET  /demo        → escribe días SINTÉTICOS (hoy..+HORIZON) para ver el
 *                       Dashboard "ATFM EN VIVO" y probar el selector de fecha.
 *   POST /feed?dep=X  → ingesta manual: cuerpo {days:{...}} o un día suelto.
 *
 * VARIABLES (wrangler.toml [vars] + secrets):
 *   RTDB_URL           URL base de la Realtime Database (sin barra final).
 *   DEP                Dependencia destino (por defecto "ACCS").
 *   HORIZON_DAYS       Días en adelante además de hoy (por defecto "3").
 *   RTDB_SECRET        (secret, opcional) database secret de Firebase.
 *   FEED_KEY           (secret, opcional) protege POST /feed y GET /demo.
 *   PBI_RESOURCE_KEY   (secret) el "k" del token del reporte (X-PowerBI-ResourceKey).
 *   PBI_QUERYDATA_URL  (secret) URL EXACTA de querydata capturada del reporte.
 *   PBI_QUERY_BODY     (secret) cuerpo JSON EXACTO de esa petición (string).
 *                      Cómo capturarlos: ver README.md → "Capturar la consulta".
 */

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(refreshFromPbi(env).catch((e) => console.error('ATFM cron:', e)));
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === 'POST' && url.pathname === '/feed') return await handleManualFeed(request, env, url);
      if (url.pathname === '/demo') {
        requireFeedKey(env, url);
        const dep = url.searchParams.get('dep') || env.DEP || 'ACCS';
        const node = { source: 'demo', updatedAt: Date.now(), days: demoDays(horizonDays(env)) };
        await writeNode(env, dep, node);
        return json({ ok: true, mode: 'demo', dep, days: Object.keys(node.days) }, 200);
      }
      const result = await refreshFromPbi(env);
      return json(result, result.ok ? 200 : 502);
    } catch (err) {
      return json({ ok: false, error: String((err && err.message) || err) }, err && err.status || 500);
    }
  },
};

/* ---------------------------------------------------------------------------
 * Fechas: horizonte hoy..+N en zona de Chile (calza con rotToday del Dashboard)
 * ------------------------------------------------------------------------- */
function horizonDays(env) { const n = parseInt(env.HORIZON_DAYS, 10); return Number.isFinite(n) && n >= 0 ? n : 3; }
function chileDate(offsetDays) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  // 'en-CA' formatea como YYYY-MM-DD; timeZone fija la fecha local de Chile.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function horizonDates(env) { const out = []; const n = horizonDays(env); for (let i = 0; i <= n; i++) out.push(chileDate(i)); return out; }

/* ---------------------------------------------------------------------------
 * 1) REFRESCO DESDE POWER BI (replay de la captura) → escribe el horizonte
 * ------------------------------------------------------------------------- */
async function refreshFromPbi(env) {
  const dep = env.DEP || 'ACCS';
  const queryUrl = env.PBI_QUERYDATA_URL, body = env.PBI_QUERY_BODY, key = env.PBI_RESOURCE_KEY;
  if (!queryUrl || !body || !key) {
    return { ok: false, msg: 'Falta la captura de Power BI (PBI_QUERYDATA_URL / PBI_QUERY_BODY / PBI_RESOURCE_KEY). ' +
      'Ver README.md → "Capturar la consulta". Mientras tanto usa GET /demo o POST /feed.' };
  }
  const resp = await fetch(queryUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'X-PowerBI-ResourceKey': key,
      'ActivityId': crypto.randomUUID(), 'RequestId': crypto.randomUUID(),
    },
    body, cf: { cacheTtl: 0 },
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    return { ok: false, msg: `Power BI querydata respondió ${resp.status}`, detail: text.slice(0, 400) };
  }
  const raw = await resp.json();

  const wanted = horizonDates(env);
  const allDays = mapPbiToDays(raw);            // { "YYYY-MM-DD": <día> }
  const days = {};
  for (const dstr of wanted) if (allDays[dstr]) days[dstr] = allDays[dstr];

  if (!Object.keys(days).length) {
    return { ok: false, msg: 'El mapeo no produjo ningún día del horizonte; revisa mapPbiToDays() y las fechas.',
      wanted, gotDates: Object.keys(allDays) };
  }
  const problems = validateNode({ days });
  if (problems.length) return { ok: false, msg: 'Días inválidos tras el mapeo.', problems };

  const node = { source: 'powerbi-ptw', updatedAt: Date.now(), days };
  await writeNode(env, dep, node);
  return { ok: true, mode: 'powerbi', dep, wroteDays: Object.keys(days), horizon: wanted };
}

/* Convierte la RESPUESTA de querydata de Power BI a { fecha: <día> }.
 * ⚠️ ESPECÍFICO DEL REPORTE: depende de qué medidas/columnas pediste en la
 * consulta capturada. La respuesta trae los datos en
 * results[0].result.data.dsr.DS[0].PH[0].DM0[] (matriz comprimida). Cuando tengas
 * una respuesta real (GET / imprime `detail`; o inspecciónala en DevTools),
 * completa el mapeo. Abajo: lector genérico de filas + esqueleto de agrupación. */
function mapPbiToDays(raw) {
  const rows = extractDsrRows(raw); // → [[c0,c1,...], ...] según el orden de tu Select
  // TODO(captura): ajustar los índices de columna a tu consulta. Se asume que cada
  // fila trae: [fecha "YYYY-MM-DD", hora 0-23, demanda, capacidad?]. Adáptalo.
  const byDate = {};
  for (const r of rows) {
    const dstr = normDate(r[0]);
    const h = Number(r[1]);
    if (!dstr || !Number.isInteger(h) || h < 0 || h > 23) continue;
    if (!byDate[dstr]) byDate[dstr] = { _h: new Map() };
    byDate[dstr]._h.set(h, { h, demanda: Math.max(0, Math.round(Number(r[2]) || 0)),
      capacidad: Number.isFinite(Number(r[3])) ? Math.round(Number(r[3])) : undefined });
  }
  const out = {};
  for (const dstr of Object.keys(byDate)) {
    const m = byDate[dstr]._h;
    if (m.size !== 24) continue;                 // día incompleto → se omite
    const hourly = []; for (let h = 0; h < 24; h++) hourly.push(m.get(h));
    out[dstr] = { hourly };
    // TODO(captura): out[dstr].sectores = [...]; out[dstr].regulaciones = [...]; out[dstr].capacidad = N;
  }
  return out;
}

// Normaliza distintos formatos de fecha a "YYYY-MM-DD".
function normDate(v) {
  if (v == null) return null;
  if (typeof v === 'number') { // epoch ms de Power BI
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(v)); } catch (_) { return null; }
  }
  const s = String(v);
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{2})[\/-](\d{2})[\/-](\d{4})/.exec(s); if (m) return `${m[3]}-${m[2]}-${m[1]}`; // dd/mm/yyyy
  const t = Date.parse(s); if (!Number.isNaN(t)) return normDate(t);
  return null;
}

/* Aplana el DSR de Power BI a filas, manejando el esquema comprimido (R = bitmask
 * de columnas repetidas de la fila anterior). Suficiente para tablas simples. */
function extractDsrRows(raw) {
  try {
    const ds = raw.results[0].result.data.dsr.DS[0];
    const dm = (ds.PH && ds.PH[0] && ds.PH[0].DM0) || ds.DM0 || [];
    const out = []; let prev = [];
    for (const item of dm) {
      const c = item.C || []; const R = item.R || 0; const restated = []; let ci = 0;
      for (let col = 0; col < Math.max(c.length + countBits(R), prev.length); col++) {
        if (R & (1 << col)) restated[col] = prev[col]; else restated[col] = c[ci++];
      }
      out.push(restated); prev = restated;
    }
    return out;
  } catch (_) { return []; }
}
function countBits(n) { let b = 0; while (n) { b += n & 1; n >>= 1; } return b; }

/* ---------------------------------------------------------------------------
 * 2) INGESTA MANUAL  (POST /feed?dep=ACCS)  — {days:{...}} o un día suelto
 * ------------------------------------------------------------------------- */
async function handleManualFeed(request, env, url) {
  requireFeedKey(env, url);
  const dep = url.searchParams.get('dep') || env.DEP || 'ACCS';
  let payload; try { payload = await request.json(); } catch (_) { return json({ ok: false, error: 'Cuerpo JSON inválido' }, 400); }

  let node;
  if (payload && payload.days && typeof payload.days === 'object') {
    node = { source: payload.source || 'manual', updatedAt: Date.now(), days: payload.days };
  } else {
    // un día suelto → nodo de un solo día (compat): el nodo ES el día + meta.
    node = Object.assign({ source: payload.source || 'manual', updatedAt: Date.now() }, payload);
    delete node.days;
  }
  const problems = validateNode(node);
  if (problems.length) return json({ ok: false, error: 'Paquete inválido', problems }, 400);
  await writeNode(env, dep, node);
  return json({ ok: true, mode: 'manual', dep, days: node.days ? Object.keys(node.days) : ['(único)'] }, 200);
}

/* ---------------------------------------------------------------------------
 * Validación
 * ------------------------------------------------------------------------- */
function validateDay(p, tag) {
  const pr = [];
  if (!p || typeof p !== 'object') return [`${tag}: no es objeto`];
  const has = p.hourly || p.sectores || p.regulaciones || p.capacidad != null;
  if (!has) pr.push(`${tag}: sin hourly/sectores/regulaciones/capacidad`);
  if (p.hourly !== undefined) {
    if (!Array.isArray(p.hourly) || p.hourly.length !== 24) pr.push(`${tag}: hourly debe tener 24 elementos`);
    else p.hourly.forEach((x, i) => { if (!x || !Number.isFinite(Number(x.demanda))) pr.push(`${tag}: hourly[${i}].demanda inválida`); });
  }
  if (p.sectores !== undefined && !Array.isArray(p.sectores)) pr.push(`${tag}: sectores debe ser arreglo`);
  if (p.regulaciones !== undefined && !Array.isArray(p.regulaciones)) pr.push(`${tag}: regulaciones debe ser arreglo`);
  return pr;
}
function validateNode(node) {
  if (node && node.days && typeof node.days === 'object') {
    const keys = Object.keys(node.days);
    if (!keys.length) return ['days vacío'];
    let pr = [];
    for (const k of keys) { if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) pr.push(`clave de día inválida: ${k}`); pr = pr.concat(validateDay(node.days[k], k)); }
    return pr;
  }
  return validateDay(node, 'día');
}

/* ---------------------------------------------------------------------------
 * RTDB write  → PUT /runcast/atfm/<dep>  (reemplaza el nodo: purga días viejos)
 * ------------------------------------------------------------------------- */
async function writeNode(env, dep, node) {
  const base = (env.RTDB_URL || '').replace(/\/+$/, '');
  if (!base) throw new Error('Falta RTDB_URL');
  const auth = env.RTDB_SECRET ? `?auth=${encodeURIComponent(env.RTDB_SECRET)}` : '';
  const put = await fetch(`${base}/runcast/atfm/${encodeURIComponent(dep)}.json${auth}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(node),
  });
  if (!put.ok) throw new Error(`RTDB PUT respondió ${put.status}`);
}

function requireFeedKey(env, url) {
  if (!env.FEED_KEY) return;
  if (url.searchParams.get('key') !== env.FEED_KEY) { const e = new Error('FEED_KEY inválida o ausente'); e.status = 401; throw e; }
}

/* Días sintéticos válidos (hoy..+N) — para probar el pipeline y el selector de
 * fecha sin resolver la captura. Cada día varía un poco la punta. */
function demoDays(n) {
  const base = [9, 6, 4, 3, 3, 5, 12, 28, 44, 49, 45, 43, 46, 48, 45, 47, 50, 53, 49, 39, 29, 21, 15, 10];
  const cap = 48; const days = {};
  for (let i = 0; i <= n; i++) {
    const f = 1 + (i * 0.06);                    // días futuros con demanda algo mayor
    const hourly = base.map((v, h) => ({ h, demanda: Math.round(v * f), capacidad: cap }));
    const peak = Math.round(53 * f);
    days[chileDate(i)] = {
      capacidad: cap, hourly,
      sectores: [{ code: 'R15', load: Math.round(46 * f), cap: 44 }, { code: 'R05', load: 30, cap: 40 }, { code: 'APP', load: 22, cap: 36 }],
      regulaciones: peak > cap ? [{ ref: 'DEMO0' + (i + 1), sector: 'R15', from: '17:00', to: '19:00', rate: cap, delay: Math.round((peak - cap) * 1.5), reason: 'DEMO - dato de prueba (borrar)', level: peak - cap > 8 ? 'crit' : 'warn' }] : [],
    };
  }
  return days;
}

function json(obj, status) {
  return new Response(JSON.stringify(obj, null, 2), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

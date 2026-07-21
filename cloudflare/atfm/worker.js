/**
 * RWYCAST — ATFM feed (Cloudflare Worker + Cron Trigger)  ·  SCEL → ACCS · MULTI-DÍA
 * -----------------------------------------------------------------------------
 * Alimenta el Dashboard de decisiones con datos ATFM reales, publicándolos en
 * Firebase RTDB bajo /runcast/atfm/<dependencia>. La app los lee en tiempo real
 * (subscribeAtfm → atfmForDep → dashboardData). Contrato: ver js/services/atfm.js.
 * Si este Worker no escribe, el Dashboard cae limpio a los datos simulados.
 *
 * CASO OBJETIVO: la demanda horaria de SCEL (aeropuerto de Santiago) se muestra en
 * el Dashboard de ACCS (el ACC controla el área de SCEL). Se ACTUALIZA UNA VEZ AL
 * DÍA con un HORIZONTE de HORIZON_DAYS en adelante (por defecto 3 → hoy + 3 días).
 * Se escribe el nodo MULTI-DÍA: { source, updatedAt, days:{ "YYYY-MM-DD":<día> } }.
 * El PUT reemplaza el nodo completo, así los días viejos se purgan solos.
 *
 * ORIGEN: reporte público "Publicar en la web" de Power BI (publish-to-web,
 * anónimo, sin Azure AD). La consulta `querydata` del panel "Tráfico por Horas"
 * se CAPTURÓ una vez (ver captured-query.md) y aquí se RECONSTRUYE por fecha:
 * para cada día del horizonte se reescriben los filtros Dia/Mês/Ano y se pide al
 * endpoint. La medida es `Qtd T_Proy2` (movimientos PROYECTADOS), por eso las
 * fechas futuras devuelven datos (tráfico programado por temporada IATA).
 *
 *   ⚠️ Publish-to-web va con RETARDO (caché ~1 h) y el endpoint no está
 *   documentado. Para un pronóstico diario a 3 días es aceptable; para producción
 *   operacional lo robusto es un export/API oficial del dueño (mismo contrato,
 *   solo cambia este Worker).
 *
 * QUÉ TRAE / QUÉ NO: el reporte da SÓLO demanda (ARR+DEP por hora). No trae
 * capacidad declarada, sectores ni regulaciones ATFM. El Worker publica el
 * `hourly` real + una `capacidad` DECLARADA configurable (DECLARED_CAP, NO viene
 * de Power BI); el Dashboard usa el roster para sectores/dotación. Todos esos
 * campos son opcionales en el contrato.
 *
 * FECHAS: las claves de día son fecha LOCAL de Chile (America/Santiago), para
 * calzar con rotToday() del Dashboard.
 *
 * MODOS:
 *   GET  /            → refresca desde Power BI (reconstruye el horizonte) y escribe.
 *   GET  /demo        → escribe días SINTÉTICOS (hoy..+HORIZON) para ver el
 *                       Dashboard "ATFM EN VIVO" y probar el selector de fecha.
 *   POST /feed?dep=X  → ingesta manual: cuerpo {days:{...}} o un día suelto.
 *
 * VARIABLES (wrangler.toml [vars] + secrets):
 *   RTDB_URL           URL base de la Realtime Database (sin barra final).
 *   DEP                Dependencia destino (por defecto "ACCS").
 *   HORIZON_DAYS       Días en adelante además de hoy (por defecto "3").
 *   PBI_TORRE          Aeropuerto/torre en el reporte (por defecto "SCEL").
 *   DECLARED_CAP       Capacidad declarada mov/h (config operacional, NO de PBI).
 *   PBI_RESOURCE_KEY   El "k" del token del reporte (default = el del enlace dado).
 *   PBI_QUERYDATA_URL  Endpoint querydata (default = backend scus capturado).
 *   RTDB_SECRET        (secret, opcional) database secret de Firebase.
 *   FEED_KEY           (secret, opcional) protege POST /feed y GET /demo.
 */

const DEFAULTS = {
  RESOURCE_KEY: '27f1b136-4ceb-4924-b258-bec1e5114813',
  QUERYDATA_URL: 'https://wabi-paas-1-scus-api.analysis.windows.net/public/reports/querydata?synchronous=true',
  DATASET_ID: '25057441-c5dd-43bc-af78-9b2b1a4982f3',
  REPORT_ID: 'dbc6b9c6-ec83-450e-9954-270ea0a33f27',
  VISUAL_ID: '6706422d744946bd1b49',
  MODEL_ID: 6172451,
  // Tabla de fecha auto-generada del modelo (LocalDateTable del campo de fecha).
  DATE_TABLE: 'LocalDateTable_80370dcc-e5ed-4f9d-946f-091564468d5f',
  // Temporadas IATA incluidas en el filtro del reporte.
  SEASONS: ['S24', 'S25', 'S26', 'W23', 'W24', 'W25'],
  DECLARED_CAP: 40, // mov/h declarados para SCEL — parámetro operacional, NO de PBI.
};
const MESES_PT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

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
        const node = { source: 'demo', updatedAt: Date.now(), days: demoDays(horizonDays(env), declaredCap(env)) };
        await writeNode(env, dep, node);
        return json({ ok: true, mode: 'demo', dep, days: Object.keys(node.days) }, 200);
      }
      const result = await refreshFromPbi(env);
      return json(result, result.ok ? 200 : 502);
    } catch (err) {
      return json({ ok: false, error: String((err && err.message) || err) }, (err && err.status) || 500);
    }
  },
};

/* ---------------------------------------------------------------------------
 * Config / fechas (horizonte hoy..+N en zona de Chile, calza con rotToday)
 * ------------------------------------------------------------------------- */
function horizonDays(env) { const n = parseInt(env.HORIZON_DAYS, 10); return Number.isFinite(n) && n >= 0 ? n : 3; }
function declaredCap(env) { const n = parseInt(env.DECLARED_CAP, 10); return Number.isFinite(n) && n > 0 ? n : DEFAULTS.DECLARED_CAP; }
function torre(env) { return env.PBI_TORRE || 'SCEL'; }
function resourceKey(env) { return env.PBI_RESOURCE_KEY || DEFAULTS.RESOURCE_KEY; }
function queryUrl(env) { return env.PBI_QUERYDATA_URL || DEFAULTS.QUERYDATA_URL; }

// Fecha local de Chile a +offset días → { iso:"YYYY-MM-DD", y, m(1-12), d }.
function chileParts(offsetDays) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t).value;
  const iso = `${get('year')}-${get('month')}-${get('day')}`;
  return { iso, y: +get('year'), m: +get('month'), d: +get('day') };
}
function horizonParts(env) { const out = []; const n = horizonDays(env); for (let i = 0; i <= n; i++) out.push(chileParts(i)); return out; }

/* ---------------------------------------------------------------------------
 * 1) REFRESCO DESDE POWER BI — reconstruye la consulta por fecha del horizonte
 * ------------------------------------------------------------------------- */
async function refreshFromPbi(env) {
  const dep = env.DEP || 'ACCS';
  const cap = declaredCap(env);
  const wanted = horizonParts(env);
  const days = {};
  const errors = [];
  for (const p of wanted) {
    try {
      const raw = await queryPbi(env, p.y, p.m, p.d);
      const hourly = mapPbiToHourly(raw, cap);
      if (!hourly) { errors.push(`${p.iso}: respuesta sin 24 horas`); continue; }
      days[p.iso] = { capacidad: cap, hourly };
    } catch (e) {
      errors.push(`${p.iso}: ${String((e && e.message) || e)}`);
    }
  }
  if (!Object.keys(days).length) {
    return { ok: false, msg: 'No se pudo mapear ningún día del horizonte desde Power BI.', errors };
  }
  const node = { source: 'powerbi-ptw', updatedAt: Date.now(), days };
  await writeNode(env, dep, node);
  return { ok: true, mode: 'powerbi', dep, torre: torre(env), wroteDays: Object.keys(days), errors: errors.length ? errors : undefined };
}

// Ejecuta la consulta "Tráfico por Horas" para una fecha concreta.
async function queryPbi(env, y, m, d) {
  const body = buildBody(torre(env), y, m, d);
  const resp = await fetch(queryUrl(env), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'X-PowerBI-ResourceKey': resourceKey(env),
      'ActivityId': crypto.randomUUID(), 'RequestId': crypto.randomUUID(),
    },
    body: JSON.stringify(body), cf: { cacheTtl: 0 },
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    const e = new Error(`querydata ${resp.status} ${text.slice(0, 200)}`); e.status = 502; throw e;
  }
  return resp.json();
}

/* Reconstruye el cuerpo `querydata` del panel "Tráfico por Horas" filtrado a una
 * fecha. Fiel a la captura (captured-query.md); solo cambian Dia/Mês/Ano y Torre.
 * CacheKey se regenera como JSON de los Commands (probado: el endpoint lo acepta). */
function buildBody(torreVal, y, m, d) {
  const col = (src, prop) => ({ Column: { Expression: { SourceRef: { Source: src } }, Property: prop } });
  const lit = (v) => ({ Literal: { Value: v } });
  const inCond = (exprs, values) => ({ Condition: { In: { Expressions: exprs, Values: values } } });
  const fonte = (src) => inCond([col(src, 'Fonte_Estado')], [[lit('1L')]]);

  const Query = {
    Version: 2,
    From: [
      { Name: '#', Entity: '#Metricas', Type: 0 },
      { Name: 'd', Entity: 'Dim_Oper', Type: 0 },
      { Name: 'd1', Entity: 'Dim_Hora', Type: 0 },
      { Name: 'l', Entity: DEFAULTS.DATE_TABLE, Type: 0 },
      { Name: 'd11', Entity: 'Dim_Torres', Type: 0 },
      { Name: 'd2', Entity: 'Dim_Estado', Type: 0 },
      { Name: 'd3', Entity: 'Dados_SAM', Type: 0 },
      { Name: 'd4', Entity: 'Dados_SAM_AA', Type: 0 },
      { Name: 'd5', Entity: 'Dados_SAM_P', Type: 0 },
      { Name: 'd6', Entity: 'Dados_SAM_A', Type: 0 },
      { Name: 'd7', Entity: 'Dim_Data', Type: 0 },
    ],
    Select: [
      { Column: { Expression: { SourceRef: { Source: 'd' } }, Property: 'Operacao' }, Name: 'Dim_Oper.Operacao', NativeReferenceName: 'Operacao' },
      { Column: { Expression: { SourceRef: { Source: 'd1' } }, Property: 'Hora' }, Name: 'Dim_Hora.Hora', NativeReferenceName: 'Hora' },
      { Measure: { Expression: { SourceRef: { Source: '#' } }, Property: 'Qtd T_Proy2' }, Name: '#Metricas.Qtd T_Proy2', NativeReferenceName: 'Qtd T_Proy2' },
    ],
    Where: [
      inCond([col('d', 'Operacao')], [[lit("'DEP'")], [lit("'ARR'")]]),
      inCond([col('l', 'Dia')], [[lit(d + 'L')]]),
      inCond([col('l', 'Ano'), col('l', 'Mês')], [[lit(y + 'L'), lit("'" + MESES_PT[m - 1] + "'")]]),
      inCond([col('d11', 'Torre')], [[lit("'" + torreVal + "'")]]),
      inCond([col('d2', 'Estado')], [[lit("'CHI'")]]),
      fonte('d3'), fonte('d4'), fonte('d5'), fonte('d6'),
      inCond([col('d7', 'Season')], DEFAULTS.SEASONS.map((s) => [lit("'" + s + "'")])),
      { Condition: { Not: { Expression: { In: { Expressions: [col('d1', 'Horario')], Values: [[lit('null')]] } } } } },
    ],
    OrderBy: [{ Direction: 1, Expression: col('d1', 'Hora') }],
  };
  const Command = {
    SemanticQueryDataShapeCommand: {
      Query,
      Binding: {
        Primary: { Groupings: [{ Projections: [1, 2] }] },
        Secondary: { Groupings: [{ Projections: [0] }] },
        DataReduction: { DataVolume: 4, Primary: { Window: { Count: 200 } }, Secondary: { Top: { Count: 60 } } },
        Version: 1,
      },
      ExecutionMetricsKind: 1,
    },
  };
  const Commands = [Command];
  return {
    version: '1.0.0',
    queries: [{
      Query: { Commands, CacheKey: JSON.stringify({ Commands }), QueryId: '',
        ApplicationContext: { DatasetId: DEFAULTS.DATASET_ID, Sources: [{ ReportId: DEFAULTS.REPORT_ID, VisualId: DEFAULTS.VISUAL_ID }] } },
    }],
    cancelQueries: [], modelId: DEFAULTS.MODEL_ID,
  };
}

/* Convierte la respuesta DSR (matriz Operacao × Hora, medida Qtd T_Proy2) al
 * `hourly[24]` del contrato: demanda = ARR + DEP. Devuelve null si no hay 24 horas. */
function mapPbiToHourly(raw, cap) {
  let ds, ops, dm0;
  try {
    ds = raw.results[0].result.data.dsr.DS[0];
    ops = ((ds.SH && ds.SH[0] && ds.SH[0].DM1) || []).map((o) => o.G1); // p.ej. ["ARR","DEP"]
    dm0 = (ds.PH && ds.PH[0] && ds.PH[0].DM0) || [];
  } catch (_) { return null; }
  if (!ops.length || !dm0.length) return null;

  const byHour = new Map();
  for (const row of dm0) {
    const hr = hourOf(row.G0);
    if (hr == null) continue;
    const X = row.X || [];
    let arr = 0, dep = 0;
    X.forEach((x, idx) => {
      const v = x && typeof x.M0 === 'number' ? x.M0 : 0; // {R:n} → sin M0 → 0
      const op = ops[idx];
      if (op === 'ARR') arr = v; else if (op === 'DEP') dep = v;
    });
    byHour.set(hr, Math.max(0, Math.round(arr + dep)));
  }
  if (!byHour.size) return null;
  const hourly = [];
  for (let h = 0; h < 24; h++) hourly.push({ h, demanda: byHour.get(h) || 0, capacidad: cap });
  return hourly;
}

// La hora viene como "1899-12-30THH:00:00" (solo interesa HH).
function hourOf(g0) {
  const m = /T(\d{2}):/.exec(String(g0 || ''));
  if (!m) return null;
  const h = +m[1];
  return h >= 0 && h <= 23 ? h : null;
}

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
 * fecha sin llamar a Power BI. Cada día varía un poco la punta. */
function demoDays(n, cap) {
  const base = [9, 6, 4, 3, 3, 5, 12, 28, 44, 49, 45, 43, 46, 48, 45, 47, 50, 53, 49, 39, 29, 21, 15, 10];
  const days = {};
  for (let i = 0; i <= n; i++) {
    const f = 1 + i * 0.06;
    const hourly = base.map((v, h) => ({ h, demanda: Math.round(v * f), capacidad: cap }));
    days[chileParts(i).iso] = { capacidad: cap, hourly };
  }
  return days;
}

function json(obj, status) {
  return new Response(JSON.stringify(obj, null, 2), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

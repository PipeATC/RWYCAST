/**
 * RWYCAST — ATFM refresh (GitHub Actions)  ·  SCEL → ACCS · MULTI-DÍA
 * -----------------------------------------------------------------------------
 * Equivalente en Node del Cloudflare Worker (cloudflare/atfm/worker.js) para
 * quien NO quiere/puede desplegar Cloudflare. Corre en el runner de GitHub
 * Actions (ver .github/workflows/atfm.yml), escrapea el reporte público
 * "Publicar en la web" de Power BI (panel "Tráfico por Horas") y publica la
 * demanda horaria de SCEL en Firebase RTDB bajo /runcast/atfm/<DEP>. La app la
 * lee en tiempo real (subscribeAtfm → atfmForDep → dashboardData). Contrato:
 * ver js/services/atfm.js. Si no escribe, el Dashboard cae limpio a lo simulado.
 *
 * DIFERENCIA con el Worker: aquí NO hay endpoint HTTP, así que el botón del
 * Dashboard no puede dispararlo en vivo; el refresco es por CRON (una vez al
 * día). El dato igual aparece solo en el Dashboard. Para el gatillo por botón
 * en vivo hay que usar el Cloudflare Worker.
 *
 * Requiere Node 18+ (usa fetch, crypto.randomUUID, Intl — todo nativo).
 *
 * VARIABLES (env, con defaults iguales al Worker):
 *   RTDB_URL       URL base de la Realtime Database (sin barra final).
 *   DEP            Dependencia destino (por defecto "ACCS").
 *   HORIZON_DAYS   Días en adelante además de hoy (por defecto "3").
 *   PBI_TORRE      Aeropuerto/torre en el reporte (por defecto "SCEL").
 *   DECLARED_CAP   Capacidad declarada mov/h (config operacional, NO de PBI).
 *   RTDB_SECRET    (opcional) database secret de Firebase para escribir con auth.
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

const env = process.env;

/* Config / fechas (horizonte hoy..+N en zona de Chile, calza con rotToday) */
function horizonDays() { const n = parseInt(env.HORIZON_DAYS, 10); return Number.isFinite(n) && n >= 0 ? n : 3; }
function declaredCap() { const n = parseInt(env.DECLARED_CAP, 10); return Number.isFinite(n) && n > 0 ? n : DEFAULTS.DECLARED_CAP; }
function torre() { return env.PBI_TORRE || 'SCEL'; }
function resourceKey() { return env.PBI_RESOURCE_KEY || DEFAULTS.RESOURCE_KEY; }
function queryUrl() { return env.PBI_QUERYDATA_URL || DEFAULTS.QUERYDATA_URL; }
// Medida de movimientos PROYECTADOS. La original 'Qtd T_Proy2' fue renombrada en
// el reporte; se prueban las candidatas de #Metricas hasta dar con una que mapee.
// Override fijo con PBI_MEASURE. Orden: total proyectado primero.
function measureCandidates() {
  if (env.PBI_MEASURE) return [env.PBI_MEASURE];
  return ['Qtd T_Proy', 'Qtd T_Proy3', 'Qtd T_Proy2'];
}
const sumHourly = (hourly) => hourly.reduce((a, x) => a + (x.demanda || 0), 0);

// Fecha local de Chile a +offset días → { iso:"YYYY-MM-DD", y, m(1-12), d }.
function chileParts(offsetDays) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t).value;
  const iso = `${get('year')}-${get('month')}-${get('day')}`;
  return { iso, y: +get('year'), m: +get('month'), d: +get('day') };
}
function horizonParts() { const out = []; const n = horizonDays(); for (let i = 0; i <= n; i++) out.push(chileParts(i)); return out; }

/* 1) REFRESCO DESDE POWER BI — reconstruye la consulta por fecha del horizonte */
async function refreshFromPbi() {
  const dep = env.DEP || 'ACCS';
  const cap = declaredCap();
  const wanted = horizonParts();
  const days = {};
  const errors = [];

  // Elige la medida que mapea (probando candidatas contra el 1er día del horizonte).
  const measure = await pickMeasure(wanted[0], cap, errors);
  if (!measure) {
    return { ok: false, msg: 'Ninguna medida candidata devolvió datos mapeables.', tried: measureCandidates(), errors };
  }

  for (const p of wanted) {
    try {
      const raw = await queryPbi(p.y, p.m, p.d, measure);
      const hourly = mapPbiToHourly(raw, cap);
      if (!hourly) { errors.push(`${p.iso}: respuesta sin 24 horas`); continue; }
      const cs = capSplit(cap);
      days[p.iso] = { capacidad: cap, capArr: cs.capArr, capDep: cs.capDep, hourly };
    } catch (e) {
      errors.push(`${p.iso}: ${String((e && e.message) || e)}`);
    }
  }
  if (!Object.keys(days).length) {
    return { ok: false, msg: 'No se pudo mapear ningún día del horizonte desde Power BI.', measure, errors };
  }
  const node = { source: 'powerbi-ptw-gha', measure, updatedAt: Date.now(), days };
  await writeNode(dep, node);
  return { ok: true, mode: 'powerbi', dep, torre: torre(), measure, wroteDays: Object.keys(days), errors: errors.length ? errors : undefined };
}

/* Prueba las medidas candidatas contra un día y devuelve la 1ª que mapea. Imprime
 * la suma diaria de CADA candidata (para verificar magnitud vs. la referencia
 * conocida de SCEL ~430-480 mov/día) y, ante fallo total, vuelca el diagnóstico. */
async function pickMeasure(p, cap, errors) {
  const cands = measureCandidates();
  let chosen = null;
  let dumped = false;
  for (const m of cands) {
    try {
      const raw = await queryPbi(p.y, p.m, p.d, m);
      const hourly = mapPbiToHourly(raw, cap);
      if (hourly) {
        console.error(`· medida '${m}' → mapea. Suma ${p.iso}: ${sumHourly(hourly)} mov`);
        if (!chosen) chosen = m; // la 1ª que mapea (orden = preferencia)
      } else {
        console.error(`· medida '${m}' → 200 sin datos mapeables`);
        if (!dumped) { dumped = true; await dumpRaw(`${p.iso}/${m}`, raw); }
      }
    } catch (e) {
      const msg = String((e && e.message) || e);
      console.error(`· medida '${m}' → error: ${msg.slice(0, 160)}`);
      errors.push(`pickMeasure ${m}: ${msg}`);
    }
  }
  if (chosen) console.error(`✔ Medida elegida: '${chosen}' (override con PBI_MEASURE si prefieres otra).`);
  return chosen;
}

/* Diagnóstico: cuando una respuesta 200 no mapea, imprime pistas de POR QUÉ para
 * poder ajustar buildBody()/mapPbiToHourly() sin adivinar. Se llama una sola vez. */
async function dumpRaw(iso, raw) {
  console.error(`\n===== DIAGNÓSTICO ATFM (${iso}) — Power BI respondió 200 pero no se pudo mapear =====`);
  let rawStr; try { rawStr = JSON.stringify(raw); } catch (_) { rawStr = String(raw); }
  try {
    // ¿Error semántico embebido? (dataset/report/modelo/tabla cambiaron al republicar)
    const err = raw && (raw.error || (raw.results && raw.results[0] && raw.results[0].result && raw.results[0].result.error));
    if (err) console.error('· Error embebido de Power BI:', JSON.stringify(err).slice(0, 800));

    // Caso conocido: la MEDIDA fue renombrada/eliminada. Descubrimos las medidas
    // reales del modelo y las imprimimos para poder actualizar `Qtd T_Proy2`.
    if (/CouldNotResolve|invalid Measure reference|Could not resolve model references/i.test(rawStr || '')) {
      console.error('\n· Parece que la MEDIDA cambió de nombre. Descubriendo medidas del modelo…');
      await probeMeasures();
    }

    const ds = raw && raw.results && raw.results[0] && raw.results[0].result && raw.results[0].result.data && raw.results[0].result.data.dsr && raw.results[0].result.data.dsr.DS && raw.results[0].result.data.dsr.DS[0];
    if (!ds) {
      console.error('· No existe results[0].result.data.dsr.DS[0] → estructura distinta o error (ver arriba).');
    } else {
      const ops = (ds.SH && ds.SH[0] && ds.SH[0].DM1) ? ds.SH[0].DM1.map((o) => o && o.G1) : null;
      const dm0 = (ds.PH && ds.PH[0] && ds.PH[0].DM0) || null;
      console.error('· DS[0] presente. Operaciones (SH.DM1):', JSON.stringify(ops));
      console.error('· Filas por hora (PH.DM0):', dm0 ? dm0.length : dm0);
      if (dm0 && dm0.length) console.error('· 1ª fila de ejemplo:', JSON.stringify(dm0[0]).slice(0, 400));
      if ((!dm0 || !dm0.length) && (!ops || !ops.length)) console.error('· Dataset VACÍO: los filtros (fecha/torre/temporada) no calzan con datos → probable cambio de IDs/tabla de fecha al republicar el reporte.');
    }
  } catch (e) {
    console.error('· No se pudo analizar la respuesta:', (e && e.message) || e);
  }
  // Volcado crudo truncado para inspección manual (los IDs viven en ApplicationContext del request, no aquí).
  console.error('· Respuesta cruda (primeros 2500 chars):\n' + (rawStr || '').slice(0, 2500));
  console.error('===== FIN DIAGNÓSTICO =====\n');
}

/* Descubre las MEDIDAS reales del modelo publish-to-web vía `conceptualschema` y
 * las imprime, resaltando las que parezcan de proyección (para reemplazar
 * `Qtd T_Proy2`). Prueba dos formas de cuerpo (el nombre del campo ha variado
 * entre versiones del backend). No lanza: es solo diagnóstico. */
async function probeMeasures() {
  const backend = queryUrl().replace(/\/public\/reports\/.*$/, '');
  const url = `${backend}/public/reports/conceptualschema`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'X-PowerBI-ResourceKey': resourceKey(),
        'ActivityId': crypto.randomUUID(), 'RequestId': crypto.randomUUID(),
      },
      body: JSON.stringify({ modelIds: [DEFAULTS.MODEL_ID], userPreferredLocale: 'en-US' }),
    });
    const text = await resp.text();
    console.error(`  · conceptualschema → HTTP ${resp.status}, ${text.length} bytes`);
    if (!resp.ok) { console.error('    ' + text.slice(0, 300)); return; }

    let schema; try { schema = JSON.parse(text); } catch (_) { console.error('    (no es JSON)'); return; }

    // En este esquema, una MEDIDA es una Property que trae un objeto `Measure`
    // (las columnas traen `Column`). Recorremos toda entidad (objeto con Name +
    // Properties[]) y recogemos "Entidad[Medida]".
    const found = [];
    (function walk(node) {
      if (!node || typeof node !== 'object') return;
      const entName = node.Name || node.name;
      const props = node.Properties || node.properties;
      if (entName && Array.isArray(props)) {
        for (const pr of props) {
          if (pr && (pr.Measure || pr.measure)) { const mn = pr.Name || pr.name; if (mn) found.push(`${entName}[${mn}]`); }
        }
      }
      for (const k in node) { const v = node[k]; if (v && typeof v === 'object') walk(v); }
    })(schema);

    if (!found.length) { console.error('    (No se hallaron medidas; volcado parcial): ' + text.slice(0, 800)); return; }

    const proy = found.filter((f) => /proy|proj|prev|estim|program|forecast|prog/i.test(f));
    const metricas = found.filter((f) => /Metricas/i.test(f));
    console.error(`    ► Total de medidas en el modelo: ${found.length}`);
    console.error('    ► Medidas que parecen de PROYECCIÓN (candidatas a reemplazar Qtd T_Proy2):');
    console.error('      ' + (proy.length ? proy.join('\n      ') : '(ninguna coincidió)'));
    console.error('    ► Todas las medidas de #Metricas:');
    console.error('      ' + (metricas.length ? metricas.join('\n      ') : '(ninguna bajo #Metricas)'));
  } catch (e) {
    console.error('  · conceptualschema falló:', (e && e.message) || e);
  }
}

// Ejecuta la consulta "Tráfico por Horas" para una fecha y una medida concretas.
async function queryPbi(y, m, d, measure) {
  const body = buildBody(torre(), y, m, d, measure);
  const resp = await fetch(queryUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'X-PowerBI-ResourceKey': resourceKey(),
      'ActivityId': crypto.randomUUID(), 'RequestId': crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    const e = new Error(`querydata ${resp.status} ${text.slice(0, 200)}`); e.status = 502; throw e;
  }
  return resp.json();
}

/* Reconstruye el cuerpo `querydata` del panel "Tráfico por Horas" filtrado a una
 * fecha. Fiel a la captura (cloudflare/atfm/captured-query.md); solo cambian
 * Dia/Mês/Ano y Torre. CacheKey se regenera como JSON de los Commands. */
function buildBody(torreVal, y, m, d, measure) {
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
      { Measure: { Expression: { SourceRef: { Source: '#' } }, Property: measure }, Name: '#Metricas.' + measure, NativeReferenceName: measure },
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
 * `hourly[24]` del contrato: demanda = ARR + DEP. Devuelve null si no hay datos. */
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
    byHour.set(hr, { arr: Math.max(0, Math.round(arr)), dep: Math.max(0, Math.round(dep)) });
  }
  if (!byHour.size) return null;
  const hourly = [];
  for (let h = 0; h < 24; h++) {
    const o = byHour.get(h) || { arr: 0, dep: 0 };
    hourly.push({ h, demanda: o.arr + o.dep, arr: o.arr, dep: o.dep, capacidad: cap });
  }
  return hourly;
}
// Capacidad declarada por operación (~52/48 de la total) — config operacional.
function capSplit(cap) { const capArr = Math.round(cap * 0.52); return { capArr, capDep: Math.max(1, cap - capArr) }; }

// La hora viene como "1899-12-30THH:00:00" (solo interesa HH).
function hourOf(g0) {
  const m = /T(\d{2}):/.exec(String(g0 || ''));
  if (!m) return null;
  const h = +m[1];
  return h >= 0 && h <= 23 ? h : null;
}

/* RTDB write → PUT /runcast/atfm/<dep> (reemplaza el nodo: purga días viejos) */
async function writeNode(dep, node) {
  const base = (env.RTDB_URL || '').replace(/\/+$/, '');
  if (!base) throw new Error('Falta RTDB_URL');
  const auth = env.RTDB_SECRET ? `?auth=${encodeURIComponent(env.RTDB_SECRET)}` : '';
  const put = await fetch(`${base}/runcast/atfm/${encodeURIComponent(dep)}.json${auth}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(node),
  });
  if (!put.ok) throw new Error(`RTDB PUT respondió ${put.status}`);
}

/* Entrada: corre el refresco, imprime el resumen y sale con código de error si
 * no logró escribir ningún día (para que la corrida de Actions salga en rojo y
 * no se pisen los datos previos con vacío). */
refreshFromPbi()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exit(1);
  })
  .catch((err) => {
    console.error('ATFM refresh falló:', (err && err.stack) || err);
    process.exit(1);
  });

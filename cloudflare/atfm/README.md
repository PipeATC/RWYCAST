# RWYCAST — ATFM feed (Cloudflare Worker)

Publica datos ATFM reales en Firebase RTDB (`/runcast/atfm/<dependencia>`) para
que el **Dashboard de decisiones** los muestre en tiempo real. La app los mezcla
con su propio roster (`dashboardData`); si este Worker no escribe, el Dashboard
cae limpio a datos simulados. Contrato de datos: `js/services/atfm.js`.

> **Origen hoy:** el reporte público *"Publicar en la web"* de Power BI (ATFM).
> Al ser publish-to-web (anónimo) **no** necesita Azure AD ni service principal.

## ⚠️ Antes de depender de esto, ten claro

- **Va con retardo.** Power BI cachea publish-to-web (~1 h o más). No es tiempo real.
- **Es frágil.** El endpoint `querydata` no está documentado; Microsoft puede cambiarlo.
- **Es un reporte ajeno en "fase de prueba".** Puede cambiar de estructura o caerse.
  Lo robusto a futuro es pedir al dueño (¿DGAC/ATFM?) un **export o API oficial**;
  ese día solo se cambia este Worker, la app no se toca.

## Tres formas de alimentar el feed (todas escriben la misma forma)

| Ruta | Qué hace | Cuándo usar |
|------|----------|-------------|
| `GET /demo` | Escribe un paquete **sintético válido** | Ver el tablero en "ATFM EN VIVO" end-to-end **ya**, sin resolver la captura |
| `POST /feed?dep=ACCS` | Ingesta **manual**: el cuerpo JSON (en forma de contrato) se valida y escribe | Carga manual, o alimentar desde cualquier script externo |
| `GET /` | **Replay** de la consulta capturada de Power BI y escribe | Producción, una vez configurada la captura |

### Probar el pipeline en 1 minuto (modo demo)

```bash
wrangler deploy
curl "https://rwycast-atfm.<tu-subdominio>.workers.dev/demo?dep=ACCS"
```

Abre el Dashboard: el badge debe pasar a **● ATFM EN VIVO**, la curva y la carga
por sector reflejan el demo y aparece la tarjeta **Regulaciones ATFM**.

## Capturar la consulta de Power BI (para `GET /` real)

El enfoque es **capturar una vez y reproducir**: en vez de reversear el flujo de
descubrimiento de Power BI (frágil), copiamos la petición `querydata` que el
reporte ya hace y la repetimos en el cron.

1. Abre el reporte publish-to-web en el navegador con **DevTools → Network**.
2. Filtra por `querydata`. Navega a la página con los datos que quieres (p. ej.
   *"Tráfico por Horas"* o *"R15/R05 Demand"*).
3. En la petición `POST .../public/reports/querydata?synchronous=true`:
   - **Request URL** → guárdala en `PBI_QUERYDATA_URL`.
   - **Request Headers → `X-PowerBI-ResourceKey`** → guárdalo en `PBI_RESOURCE_KEY`
     (es el `k` del token `?r=` del enlace, decodificado por Power BI).
   - **Request Payload** (el JSON completo) → guárdalo en `PBI_QUERY_BODY`.
4. Mira la **Response**: con su forma real completas `mapPbiToContract()` en
   `worker.js` (qué columna es la hora, cuál la demanda, la capacidad, el sector…).

Helper para copiar la petición desde la consola de DevTools (pégalo y recarga):

```js
// Registra en consola la URL y el body de cada querydata (para copiar/pegar).
(() => {
  const of = window.fetch;
  window.fetch = async (...a) => {
    try { if (String(a[0]).includes('querydata'))
      console.log('QUERYDATA URL:', a[0], '\nBODY:', a[1] && a[1].body); } catch {}
    return of(...a);
  };
  console.log('Hook listo. Navega por el reporte y mira la consola.');
})();
```

Carga los secrets y despliega:

```bash
wrangler secret put PBI_RESOURCE_KEY
wrangler secret put PBI_QUERYDATA_URL
wrangler secret put PBI_QUERY_BODY
wrangler deploy
curl "https://rwycast-atfm.<tu-subdominio>.workers.dev/"   # dispara un refresco
```

Si `GET /` devuelve `ok:false`, el JSON trae `problems`/`detail` para depurar el
mapeo o la petición.

## Forma del contrato (`/runcast/atfm/<dep>`)

Todos los campos son **opcionales**; el Dashboard usa lo que llegue y simula el resto.

```json
{
  "updatedAt": 1721563200000,
  "source": "powerbi-ptw",
  "capacidad": 48,
  "hourly": [ { "h": 0, "demanda": 9, "capacidad": 48, "complejidad": 41 } ],
  "sectores": [ { "code": "R15", "load": 41, "cap": 44 } ],
  "regulaciones": [
    { "ref": "SCEL01", "sector": "R15", "from": "21:00", "to": "22:00",
      "rate": 30, "delay": 12, "reason": "Capacidad", "level": "warn" }
  ]
}
```

`dep` = username del usuario de unidad (p. ej. `ACCS`) = clave del nodo en RTDB.
`hourly` debe traer **exactamente 24** entradas (h 0..23) o se ignora.

## Variables

| Nombre | Dónde | Descripción |
|--------|-------|-------------|
| `RTDB_URL` | `wrangler.toml` | URL base de la RTDB, sin barra final. |
| `DEP` | `wrangler.toml` | Dependencia por defecto a la que se escribe. |
| `PBI_RESOURCE_KEY` | `wrangler secret` | El `k` del token del reporte (`X-PowerBI-ResourceKey`). |
| `PBI_QUERYDATA_URL` | `wrangler secret` | URL exacta de `querydata` capturada. |
| `PBI_QUERY_BODY` | `wrangler secret` | Cuerpo JSON exacto de esa petición. |
| `FEED_KEY` | `wrangler secret` | (Opcional) protege `POST /feed` y `GET /demo` con `?key=`. |
| `RTDB_SECRET` | `wrangler secret` | (Opcional) database secret de Firebase (escritura con auth). |

## Endurecer Firebase (recomendado)

Igual que el worker de METAR: deja `/runcast/atfm` de solo lectura para el público
y escritura solo con `auth`, y carga `RTDB_SECRET` en el Worker.

```json
{
  "rules": {
    "runcast": {
      "atfm": { ".read": true, ".write": "auth != null" }
    }
  }
}
```

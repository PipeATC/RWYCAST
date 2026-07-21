# RWYCAST — ATFM feed (Cloudflare Worker) · SCEL → ACCS, multi-día

Publica datos ATFM de **SCEL** en Firebase RTDB para que se vean en el **Dashboard
de decisiones de ACCS** (el ACC controla el área de SCEL). Actualiza **una vez al
día** con un **horizonte de 3 días en adelante** (configurable). La app los lee en
tiempo real; si el Worker no escribe, el Dashboard cae limpio a datos simulados.
Contrato de datos: `js/services/atfm.js`.

> **Origen:** el reporte público *"Publicar en la web"* de Power BI (SCEL). Al ser
> publish-to-web (anónimo) **no** necesita Azure AD ni service principal.

## Forma que se escribe (nodo multi-día)

```json
/runcast/atfm/ACCS = {
  "source": "powerbi-ptw",
  "updatedAt": 1753120800000,
  "days": {
    "2026-07-21": { "capacidad": 48, "hourly": [ {"h":0,"demanda":9,"capacidad":48}, … 24 ],
                    "sectores": [ {"code":"R15","load":41,"cap":44} ],
                    "regulaciones": [ … ] },
    "2026-07-22": { … },
    "2026-07-23": { … },
    "2026-07-24": { … }
  }
}
```

El Dashboard muestra el día de su **selector de fecha** (`days[fecha]`). Las claves
son fecha **local de Chile** (`YYYY-MM-DD`), iguales a `rotToday()`. El PUT reemplaza
el nodo entero, así los días pasados se purgan solos.

## ⚠️ Antes de depender de esto

- **Va con retardo**: publish-to-web cachea (~1 h). Para un pronóstico diario a 3
  días es aceptable; para tiempo real, no.
- **Es frágil**: el endpoint `querydata` no está documentado; Microsoft puede
  cambiarlo. Lo robusto a futuro: un export/API oficial del dueño (mismo contrato,
  solo cambia el Worker).

## Verlo YA sin resolver la captura (modo demo)

```bash
wrangler deploy
curl "https://rwycast-atfm.<tu-subdominio>.workers.dev/demo?dep=ACCS"
```

Escribe días sintéticos hoy..+3 en ACCS. Abre el Dashboard de ACCS: badge **● ATFM
EN VIVO · DEMO**, y **cambia la fecha** en el selector para ver cada día del
horizonte. (Borra el demo cuando termines: es una dependencia real — ver abajo.)

## Capturar la consulta de Power BI (para el feed real)

**Debe hacerse en TU navegador** (DevTools Network ve el tráfico que un hook de JS
no ve — Power BI consulta desde un Web Worker).

1. Abre el reporte publish-to-web de SCEL con **DevTools (F12) → Network**.
2. Filtra por `querydata`. Navega a la página con los datos que quieres (p. ej.
   *"Tráfico por Horas"* / *"R15/R05 Demand"* / *"Análisis ATFM"*).
3. En la petición `POST .../public/reports/querydata?synchronous=true`:
   - **Request URL** → `PBI_QUERYDATA_URL`.
   - **Header `X-PowerBI-ResourceKey`** → `PBI_RESOURCE_KEY`.
   - **Request Payload** (JSON completo) → `PBI_QUERY_BODY`.
4. Mira la **Response** (pestaña Response/Preview) y pásamela: con su forma real
   completo `mapPbiToDays()` en `worker.js` (qué columna es la fecha, la hora, la
   demanda, la capacidad, el sector). Ese es el único paso que queda por definir.

> **Horizonte de 3 días:** idealmente la consulta ya trae varios días (filtro de
> fecha **relativo**: Hoy … Hoy+3). Si trae fechas fijas, el replay se congelaría;
> en ese caso hay que reescribir la ventana de fechas en `PBI_QUERY_BODY` por corrida
> (te ayudo cuando veamos el body real).

Carga los secrets y despliega:

```bash
wrangler secret put PBI_RESOURCE_KEY
wrangler secret put PBI_QUERYDATA_URL
wrangler secret put PBI_QUERY_BODY
wrangler deploy
curl "https://rwycast-atfm.<tu-subdominio>.workers.dev/"   # dispara un refresco
```

Si `GET /` devuelve `ok:false`, trae `detail`/`problems`/`gotDates` para depurar.

## Variables

| Nombre | Dónde | Descripción |
|--------|-------|-------------|
| `RTDB_URL` | `wrangler.toml` | URL base de la RTDB, sin barra final. |
| `DEP` | `wrangler.toml` | Dependencia destino (`ACCS`). |
| `HORIZON_DAYS` | `wrangler.toml` | Días en adelante además de hoy (`3`). |
| `PBI_RESOURCE_KEY` | `wrangler secret` | El `k` del token (`X-PowerBI-ResourceKey`). |
| `PBI_QUERYDATA_URL` | `wrangler secret` | URL exacta de `querydata`. |
| `PBI_QUERY_BODY` | `wrangler secret` | Cuerpo JSON exacto de esa petición. |
| `FEED_KEY` | `wrangler secret` | (Opcional) protege `/feed` y `/demo` con `?key=`. |
| `RTDB_SECRET` | `wrangler secret` | (Opcional) database secret de Firebase. |

## Borrar el demo / endurecer Firebase

Borrar el nodo (consola del navegador en la app, o curl):
```js
firebase.database().ref('runcast/atfm/ACCS').remove()
```
Reglas recomendadas: `/runcast/atfm` de solo lectura pública y escritura con `auth`
(carga `RTDB_SECRET` en el Worker), igual que el worker de METAR.

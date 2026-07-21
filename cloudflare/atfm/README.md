# RWYCAST — ATFM feed (Cloudflare Worker) · SCEL → ACCS, multi-día

Publica la **demanda horaria de SCEL** en Firebase RTDB para que se vea en el
**Dashboard de decisiones de ACCS** (el ACC controla el área de SCEL). Actualiza
**una vez al día** con un **horizonte de 3 días en adelante** (configurable). La
app la lee en tiempo real; si el Worker no escribe, el Dashboard cae limpio a
datos simulados. Contrato de datos: `js/services/atfm.js`.

> **Origen:** el reporte público *"Publicar en la web"* de Power BI (panel
> *Tráfico por Horas*). Al ser publish-to-web (anónimo) **no** necesita Azure AD
> ni service principal. La consulta se capturó una vez (ver `captured-query.md`)
> y el Worker la **reconstruye por fecha** en cada corrida.

## Cómo funciona

Para cada día del horizonte (hoy … hoy+`HORIZON_DAYS`, fecha local de Chile) el
Worker arma el cuerpo `querydata` del panel *Tráfico por Horas* filtrado a esa
fecha (`Torre=SCEL`, `Estado=CHI`, `Dia/Mês/Ano`, temporadas IATA), lo pide al
endpoint y transforma la respuesta a `hourly[24]` con `demanda = ARR + DEP`. La
medida del reporte es `Qtd T_Proy2` (movimientos **proyectados**), por eso las
fechas futuras traen datos. Todo esto está probado contra el endpoint real.

## Qué trae y qué no

- ✅ **Demanda por hora** (real, proyectada) para los 4 días.
- ➕ **Capacidad declarada** (`DECLARED_CAP`): NO viene de Power BI (el reporte no
  la entrega). Es un parámetro operacional que fijas tú; ajústalo al valor real
  de SCEL. Sirve para la línea de capacidad y las alertas de saturación.
- ❌ **Sectores / regulaciones ATFM**: no están en esta consulta. El Dashboard usa
  el roster para sectores/dotación (son campos opcionales del contrato).

## Forma que se escribe (nodo multi-día)

```json
/runcast/atfm/ACCS = {
  "source": "powerbi-ptw",
  "updatedAt": 1753120800000,
  "days": {
    "2026-07-21": { "capacidad": 40, "hourly": [ {"h":0,"demanda":27,"capacidad":40}, … 24 ] },
    "2026-07-22": { … },
    "2026-07-23": { … },
    "2026-07-24": { … }
  }
}
```

El Dashboard muestra el día de su **selector de fecha** (`days[fecha]`). Las claves
son fecha **local de Chile** (`YYYY-MM-DD`), iguales a `rotToday()`. El PUT reemplaza
el nodo entero, así los días pasados se purgan solos.

## Desplegar

El Worker es **autocontenido**: el endpoint y el resource key traen por defecto
los del enlace público, así que no hacen falta secrets para el feed.

```bash
cd cloudflare/atfm
# Ajusta RTDB_URL / DECLARED_CAP en wrangler.toml si hace falta
wrangler deploy
curl "https://rwycast-atfm.<tu-subdominio>.workers.dev/"   # dispara un refresco ya
```

`GET /` devuelve `{ ok, wroteDays:[…], errors? }`. El cron (`10 9 * * *`) lo repite
a diario. Si algún día falla el mapeo, `errors[]` lo dice y ese día cae a simulado.

## Modo demo (sin llamar a Power BI)

```bash
curl "https://rwycast-atfm.<tu-subdominio>.workers.dev/demo?dep=ACCS"
```

Escribe días sintéticos hoy..+3 en ACCS. Abre el Dashboard de ACCS: badge **● ATFM
EN VIVO · DEMO**, y **cambia la fecha** en el selector para ver cada día. Bórralo al
terminar (ver abajo).

## ⚠️ Antes de depender de esto

- **Va con retardo**: publish-to-web cachea (~1 h). Para un pronóstico diario a 3
  días es aceptable; para tiempo real, no.
- **Es frágil**: el endpoint `querydata` no está documentado; Microsoft o el dueño
  del reporte pueden cambiarlo (token, backend, medidas). Si cambia, recaptura
  (`captured-query.md`) y ajusta `buildBody()`/`mapPbiToHourly()`. Lo robusto a
  futuro: un export/API oficial del dueño (mismo contrato, solo cambia el Worker).

## Variables

| Nombre | Dónde | Descripción |
|--------|-------|-------------|
| `RTDB_URL` | `wrangler.toml` | URL base de la RTDB, sin barra final. |
| `DEP` | `wrangler.toml` | Dependencia destino (`ACCS`). |
| `HORIZON_DAYS` | `wrangler.toml` | Días en adelante además de hoy (`3`). |
| `PBI_TORRE` | `wrangler.toml` | Aeropuerto en el filtro `Dim_Torres` (`SCEL`). |
| `DECLARED_CAP` | `wrangler.toml` | Capacidad declarada mov/h (config, NO de PBI). |
| `PBI_RESOURCE_KEY` | var/secret (opcional) | Override del `k` del token. |
| `PBI_QUERYDATA_URL` | var/secret (opcional) | Override del endpoint querydata. |
| `FEED_KEY` | `wrangler secret` | (Opcional) protege `/feed` y `/demo` con `?key=`. |
| `RTDB_SECRET` | `wrangler secret` | (Opcional) database secret de Firebase. |

## Borrar el demo / endurecer Firebase

Borrar el nodo (consola del navegador en la app, o curl):
```js
firebase.database().ref('runcast/atfm/ACCS').remove()
```
Reglas recomendadas: `/runcast/atfm` de solo lectura pública y escritura con `auth`
(carga `RTDB_SECRET` en el Worker), igual que el worker de METAR.

# Captura de la consulta Power BI — SCEL "Tráfico por Horas"

Capturado el 2026-07-21 desde el reporte publish-to-web
(`https://app.powerbi.com/view?r=…`), hilo principal, hook XHR sobre
`querydata`. Es la fuente de verdad que reproduce `worker.js`.

## Endpoint

```
POST https://wabi-paas-1-scus-api.analysis.windows.net/public/reports/querydata?synchronous=true
Header  X-PowerBI-ResourceKey: 27f1b136-4ceb-4924-b258-bec1e5114813   (= "k" del token del enlace)
Content-Type: application/json;charset=UTF-8
```

`ActivityId` y `RequestId` son GUID nuevos por petición (no importan).

## Consulta (semantic query)

- **Select**: `Dim_Oper.Operacao` (DEP/ARR), `Dim_Hora.Hora` (0-23),
  medida `#Metricas.Qtd T_Proy2` (cantidad **proyectada** de movimientos).
- **Where** (filtros fijos salvo la fecha):
  - `Dim_Oper.Operacao` IN ('DEP','ARR')
  - `LocalDateTable_…Dia` = `<día del mes>` ← se reescribe por fecha
  - `LocalDateTable_…Ano` = `<año>`, `Mês` = `'<mes en portugués>'` ← se reescribe
  - `Dim_Torres.Torre` = `'SCEL'`  ← aeropuerto (parametrizable)
  - `Dim_Estado.Estado` = `'CHI'` (Chile)
  - `Dados_SAM / _AA / _P / _A . Fonte_Estado` = 1
  - `Dim_Data.Season` IN ('S24','S25','S26','W23','W24','W25')
  - `Dim_Hora.Horario` NOT null
- **OrderBy**: `Hora` asc.
- **ApplicationContext**: DatasetId `25057441-c5dd-43bc-af78-9b2b1a4982f3`,
  ReportId `dbc6b9c6-ec83-450e-9954-270ea0a33f27`,
  VisualId `6706422d744946bd1b49`. `modelId` 6172451.

Meses en portugués (los usa el filtro `Mês`): janeiro, fevereiro, março,
abril, maio, junho, julho, agosto, setembro, outubro, novembro, dezembro.

`CacheKey` puede **regenerarse** como `JSON.stringify({Commands:[…]})`
(probado: la respuesta es 200 igual). No hace falta conservar la original.

## Forma de la respuesta (DSR matriz)

```
results[0].result.data.dsr.DS[0]
  ├─ SH[0].DM1  → orden de operaciones: [{G1:"ARR"},{G1:"DEP"}]  (índice = columna de X)
  └─ PH[0].DM0  → una fila por hora:
        { G0:"1899-12-30THH:00:00",  X:[ {M0:<ARR>}, {M0:<DEP>} ] }
        - la hora sale de G0 (solo interesa HH).
        - X alinea con el orden de DM1. {R:1} = valor nulo (0).
        - demanda(hora) = ARR + DEP.
```

Nota `{R:n}`: en X, `R` marca que el valor se omite/repite → se trata como 0/nulo.

## Verificación del replay (2026-07-21)

Reescribiendo `Dia/Ano/Mês` a hoy..+3, el endpoint devolvió 24 h para los
4 días (las fechas **futuras** traen datos porque `Qtd T_Proy2` es tráfico
programado/proyectado). Sumas de movimientos/día:

| Fecha | Σ mov |
|-------|-------|
| 2026-07-21 | 427 |
| 2026-07-22 | 476 |
| 2026-07-23 | 438 |
| 2026-07-24 | 450 |

## Lo que el reporte NO entrega en esta consulta

Sólo **demanda** (movimientos proyectados por hora). No hay capacidad
declarada, sectores ATFM ni regulaciones. En el contrato del Dashboard esos
campos son opcionales: el Worker publica `hourly` real + una `capacidad`
declarada configurable, y el Dashboard cae al roster para sectores/dotación.

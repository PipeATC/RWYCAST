# RWYCAST · Sistema Operacional ATC Chile

> Pista en uso, aproximación en uso y STAR en uso, **en tiempo real**, compartido entre
> el ACC Santiago y las torres/aproximaciones de la red. La idea es simple: que cada
> unidad publique al instante qué está usando para **dejar de gastar tiempo en el
> comunicador oral** preguntando "¿qué pista están ocupando?".

RWYCAST **no entrega autorizaciones** ("autorizado a aterrizar pista 20"). Es puramente
**informativo/previsional**: sirve para que el controlador pueda decir al piloto
*"prevea pista 20"* o *"prevea aproximación ILS 17L"* con la información que la propia
unidad responsable acaba de publicar.

Creado por **Felipe Loyola**. Mantenido entre Felipe y Sebastián (controladores del
Centro de Control de Área de Santiago).

---

## ¿Qué hace, en concreto?

- **Visor operacional**: tarjeta por aeródromo con la **pista en uso**, **aproximación
  en uso** y, por cada **punto de entrada (IAF)**, la **STAR en uso**.
- **Tiempo real**: cuando una unidad cambia su configuración, a todos los demás les
  parpadea el cambio (marca `▲ UPD`) y queda registrado.
- **METAR/SPECI en vivo**: se descargan automáticamente desde NOAA AWC y se muestran por
  aeródromo (sin inventar datos: si no hay METAR real, no se muestra).
- **Roles y permisos** (RBAC):
  - `admin` — Administrador General: acceso total, gestiona usuarios y cualquier unidad.
  - `unit` — Usuario de Unidad: edita pistas/aprox/STAR **solo de su(s) unidad(es)**.
  - `sector` — Usuario de Sector de Control: solo visualización.
  - `general` — Usuario General: solo el Briefing de turno.
- **Registro de cambios** y **Briefing de turno**.
- **PWA instalable** en Android e iOS (funciona como app y abre sin red gracias al
  Service Worker).

---

## ¿Cómo está construido? (arquitectura)

No hay framework ni build: **todo vive en `index.html`** (React + Babel cargados por CDN).
Esto lo hace muy fácil de editar y desplegar, pero es un archivo grande.

| Pieza | Para qué sirve |
|-------|----------------|
| `index.html` | La app completa: estilos, React, lógica, roles, datos semilla. |
| `manifest.webmanifest` | Metadatos de la PWA (nombre, icono, colores). |
| `sw.js` | Service Worker: cachea la app para que abra offline. |
| `icon-512.png` | Icono de la app. |
| `cloudflare/` | Worker que baja METAR cada 1 minuto y los escribe en Firebase. |
| `.github/workflows/` | Despliegue a GitHub Pages + job de METAR (respaldo). |

**Datos en tiempo real**: Firebase Realtime Database (proyecto `atcbrief`).
- `runcast/state/v1` → estado compartido (aeródromos, pistas/aprox/STAR en uso, logs).
- `runcast/metars` → METAR en vivo.
- `runcast/users` → base de usuarios.

**Hosting**: GitHub Pages. Cada vez que se hace *push* a `main`, GitHub publica el sitio
en `https://pipeatc.github.io/RWYCAST/` (o el dominio que tengan configurado).

---

## Cómo trabajar en el proyecto (GUÍA PARA FELIPE)

> Esta sección es un paso a paso para subir cambios sin miedo. Si algo sale raro,
> **no borres nada**: avísale a Sebastián y lo vemos juntos.

### 0. Una sola vez: preparar el computador

1. Instala **Git**: https://git-scm.com/downloads
2. (Recomendado) Instala **GitHub Desktop** (https://desktop.github.com/) si prefieres
   botones en vez de comandos. Igual abajo dejo los comandos por si los necesitas.
3. Configura tu nombre y correo (esto firma tus cambios). En la terminal:

```bash
git config --global user.name "Felipe Loyola"
git config --global user.email "TU-CORREO@ejemplo.com"
```

### 1. Una sola vez: bajar el proyecto (clonar)

```bash
git clone https://github.com/PipeATC/RWYCAST.git
cd RWYCAST
```

Esto crea la carpeta `RWYCAST` con todo el código. Desde ahí trabajas.

### 2. El ciclo de trabajo de cada día

Siempre que te sientes a trabajar, **primero baja lo último** (puede que Sebastián haya
subido cambios):

```bash
git pull
```

Luego edita lo que quieras (por ejemplo `index.html`). Para ver qué cambiaste:

```bash
git status      # qué archivos tocaste
git diff        # exactamente qué líneas cambiaste
```

Cuando estés conforme, **guarda tus cambios en un "commit"** (una foto de tu trabajo con
un mensaje que explica qué hiciste):

```bash
git add .                                  # marca TODOS los archivos cambiados
git commit -m "Agrega STAR nueva para SCEL"
```

> El mensaje del commit debe explicar **qué** cambiaste, en pocas palabras.
> Ejemplos buenos: `"Corrige aproximación en uso de SCFA"`, `"Agrega aeródromo SCSE"`.

Finalmente, **súbelo a GitHub** para que se publique y Sebastián lo vea:

```bash
git push
```

A los 1–2 minutos GitHub Pages publica la nueva versión del sitio. Listo.

### 3. Resumen ultra-rápido (lo que harás el 90% del tiempo)

```bash
git pull                          # 1. bajar lo último
# ...editas index.html...
git add .                         # 2. marcar cambios
git commit -m "describe tu cambio"# 3. guardar con mensaje
git push                          # 4. subir y publicar
```

### 4. Comandos útiles extra

| Quiero... | Comando |
|-----------|---------|
| Ver el historial de cambios | `git log --oneline` |
| Ver qué archivos cambié | `git status` |
| Ver las líneas exactas que cambié | `git diff` |
| Bajar lo último del repo | `git pull` |
| Deshacer cambios de un archivo (antes de commitear) | `git checkout -- index.html` |
| Ver en qué rama estoy | `git branch --show-current` |

### 5. (Opcional, más seguro) Trabajar con ramas

Para cambios grandes conviene NO tocar `main` directo, sino crear una **rama** y luego
mezclarla con una *Pull Request* en GitHub (así el otro la revisa antes de publicar):

```bash
git checkout -b mejora-briefing    # crea y entra a una rama nueva
# ...editas, git add, git commit...
git push -u origin mejora-briefing # sube la rama
```

Después, en GitHub, aparece un botón verde para abrir la **Pull Request**.

### 6. Si aparece un "conflicto" (merge conflict)

Pasa cuando los dos editamos lo mismo. Git marca el archivo con líneas tipo:

```
<<<<<<< HEAD
tu versión
=======
la versión del repo
>>>>>>> main
```

Edita el archivo, deja **solo** lo correcto (borra las líneas `<<<`, `===`, `>>>`),
guarda y luego:

```bash
git add index.html
git commit -m "Resuelve conflicto en index.html"
git push
```

Si no estás seguro, **no fuerces nada**: mejor lo vemos juntos.

---

## Cómo probar la app localmente

Como es un sitio estático, basta con servirlo. La forma más simple:

```bash
# Opción A: con Python (viene en Mac)
python3 -m http.server 8080
# luego abre http://localhost:8080 en el navegador

# Opción B: con Node
npx serve .
```

> Nota: abrir `index.html` con doble clic (protocolo `file://`) puede romper el Service
> Worker y algunas cosas. Es mejor servirlo con uno de los comandos de arriba.

**Acceso inicial**: el primer ingreso usa el admin sembrado en el código
(`usuario: admin`). La contraseña por defecto está en `index.html` (`SEED_ADMIN`) y la
app **obliga a cambiarla** al entrar. Conviene cambiarla cuanto antes.

---

## Configuración de servicios

- **Firebase**: la config está en `index.html` (`FIREBASE_CONFIG`). Apunta al proyecto
  `atcbrief`. Para administrar la base: Firebase Console del proyecto.
- **METAR (Cloudflare Worker)**: ver `cloudflare/README.md` para desplegar el refresco
  al minuto. Hay un respaldo en GitHub Actions (`.github/workflows/metar.yml`).

---

## Reglas de oro para los dos

1. **Siempre `git pull` antes de empezar** a editar.
2. **Commits chicos y descriptivos** (uno por cambio lógico).
3. **No subir secretos** (contraseñas, tokens) al código.
4. Si algo se ve raro tras un push, revisar la pestaña **Actions** en GitHub: ahí se ve
   si el despliegue falló.
5. Ante la duda, preguntar antes de borrar o forzar (`--force`).

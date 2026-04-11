# CLAUDE.md — App Comisiones Itaka

## Qué es esta app

Herramienta para que guías turísticos registren y calculen comisiones de tours diarios (Santa María). Cada guía tiene sus propios datos separados. Se registran pasajeros por plataforma de origen y cobros recibidos; la app calcula comisiones y ganancia neta automáticamente.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | HTML + CSS + JS vanilla — `index.html` + `style.css` + `app.js` |
| Base de datos | Firebase Firestore (SDK compat v10.14.1 vía CDN) |
| Hosting | Cloudflare Pages |
| Repositorio | GitHub (`morgantin29-bit/app-comisiones-itaka`) |
| Fuente | Google Fonts (Inter) |

**Sin framework, sin build step, sin bundler.** Deploy directo: push a GitHub → Cloudflare Pages publica automáticamente (sirve los archivos estáticos sin configuración adicional).

---

## URLs

- **Producción:** https://app-comisiones-itaka.pages.dev
- **Firebase Console:** https://console.firebase.google.com/project/app-comisiones-itaka

---

## Acceso y autenticación

- **Firebase Authentication (email/password)**
- Login en pantalla inicial; Firebase mantiene la sesión activa automáticamente
- **Registro controlado:** los nuevos usuarios solo pueden crear cuenta si su email está aprobado en la colección `approved_emails` de Firestore. Para aprobar un email: agregar un documento con ID = email en esa colección (campo `activo: "si"`)
- `onAuthStateChanged` controla la visibilidad; `signOut()` cierra sesión

> **Nota:** La API key correcta para Cloudflare es la **"Browser key (auto created by Firebase)"** de Google Cloud → APIs & Services → Credenciales.

---

## Firebase

- **Proyecto:** `app-comisiones-itaka`
- **SDK:** Firebase compat v10.14.1 — Firestore + Auth
- **Listener:** `onSnapshot` en tiempo real — actualiza la UI en todos los dispositivos sin recargar
- **Persistencia offline:** `db.enablePersistence({ synchronizeTabs: true })`

### Claves de Firebase

No están hardcodeadas. Al iniciar, la app hace `fetch('/firebase-config')` → `functions/firebase-config.js` (Cloudflare Pages Function) → lee desde variables de entorno de Cloudflare.

Variables de entorno requeridas: `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`

### Estructura de Firestore

```
approved_emails/
  {email}              ← emails autorizados a registrarse

users/
  {uid}/
    config/
      settings         ← plataformas/tarifas y medios de pago del usuario
    registros/
      {timestamp}      ← registros de tours del usuario
```

### Reglas de Firestore

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /approved_emails/{email} {
      allow read: if true;
      allow write: if false;
    }
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

---

## Estructura del proyecto

```
Appcomisiones-itaka/
├── index.html                 # Esqueleto HTML
├── style.css                  # Todos los estilos
├── app.js                     # Toda la lógica JS
├── icon.svg                   # Ícono PWA (lápiz violeta sobre fondo oscuro)
├── manifest.json              # Web App Manifest para instalación en home screen
├── functions/
│   └── firebase-config.js     # Cloudflare Pages Function — sirve config de Firebase
└── CLAUDE.md
```

---

## Lógica de negocio

### Tours y horarios
**Completamente configurables por usuario** desde la pestaña Configuración. Defaults iniciales:
- San Marco 10:00 / San Marco 10:30 / San Marco 13:00 / San Marco 13:30

Cada entrada tiene: nombre del tour + hora. En el dropdown de Registro se muestran combinados ("San Marco 10:00"). En el historial se separan en columnas Tour y Horario.

### Tarifas y medios de pago
**Completamente configurables por usuario** desde la pestaña Configuración. Defaults iniciales:
- Plataformas: Civitatis €3/pax · Viabam €2.50/pax · Web €2/pax
- Medios de pago: Efectivo · Revolut · Sumup

### Cálculo por registro
- Total PAX = suma de PAX por plataforma
- Comisión por plataforma = PAX × tarifa configurada
- Ganancia neta = Total cobros − Total comisiones

---

## Funcionalidades

### Vista Registrar
- Formulario dinámico: fecha, dropdown "Tour" (configurable), PAX por plataforma, **Pasajeros captados** (input único sin comisión), cobros por medio de pago
- Preview en tiempo real de todos los cálculos — "PAX total" refleja plataformas + captados (gente real del tour)
- Guardar / Limpiar

### Vista Historial — Por mes
- Navegación mes a mes, **6 tarjetas de resumen** (Tours · PAX total · Promedio pax global · Comisiones · Total cobros · Ganancia neta)
- Tabla dinámica con columnas: Fecha · Tour · Horario · PAX · **Capt.** · [plataformas] · **Promedio** · Comisiones · Cobros · Neta · acciones
- El footer de la tabla muestra los totales del mes + el promedio pax global en la columna Promedio
- Editar (modal slide-up en móvil) / Eliminar con confirmación
- Exportar CSV (BOM UTF-8, separador `;`, compatible con Excel) — incluye Tour, Horario, Captados y Promedio pax como columnas separadas

### Vista Historial — Hoy
- Tercer modo del historial; muestra solo los registros del día actual
- Estado vacío si no hay tours registrados en el día
- 6 tarjetas de resumen (Tours · PAX total · Promedio pax global · Comisiones · Total cobros · Ganancia neta) + tabla sin columna Fecha, con columnas Capt. y Promedio
- Botón **"Exportar datos de hoy"** (con logo WhatsApp) → abre popup con resumen en texto plano
- Formato del popup: fecha única al inicio (`📅 08/04 —`), luego cada tour con nombre + hora y pax por plataforma
- Solo aparecen plataformas con pax > 0 — **captados NO se muestran en el popup** (decisión explícita)
- Botón **"Copiar para WhatsApp"** (con logo WhatsApp) copia el texto al portapapeles; confirma con "¡Copiado!" por 2 segundos
- Popup se cierra tocando el fondo o el botón "Cerrar"

### Vista Historial — Por período
- Filtro libre por rango de fechas
- Breakdown grid con tarjetas dinámicas: PAX total · Promedio pax global · una tarjeta por plataforma (comisiones) · Total comisiones · una tarjeta por medio de pago · Total cobros · Ganancia neta
- Tabla detallada con columnas Fecha, Tour, Horario, PAX, Capt., plataformas, Promedio, Comisiones, Cobros, Neta
- Footer de la tabla muestra totales del período + promedio pax global en la columna Promedio
- Exportar CSV del período (mismas columnas que el CSV mensual)

### Vista Configuración
- Campo "Tu nombre" — se guarda en Firestore y aparece como saludo en el header
- **Tours y horarios:** agregar, editar y eliminar tours (nombre + hora)
- Agregar, editar y eliminar plataformas/tarifas
- Agregar, editar y eliminar medios de pago
- Se guarda en `users/{uid}/config/settings` y se aplica globalmente

### Indicador de sincronización
Gris (conectando) → Naranja (guardando) → Verde (sincronizado) → Rojo (sin conexión)

### Saludo personalizado en header
- Muestra "Hola, [Nombre]" al iniciar sesión
- El nombre se guarda en `users/{uid}/config/settings` como campo `userName`
- Se configura desde la vista Configuración; se actualiza en el header al instante
- Si no hay nombre guardado, el saludo no aparece (no rompe nada)

### Responsive
- Header: logo + `.header-right` (greeting · sync · salir) en fila 1; nav full-width en fila 2
- Inputs `font-size: 16px` para evitar zoom en iOS
- Touch targets mínimos 44–48px
- Modal como bottom sheet en móvil

### PWA / Ícono
- `icon.svg` + `manifest.json` para instalación en home screen (Android)
- Ícono: lápiz violeta diagonal sobre fondo oscuro redondeado

---

## Modelo de datos

### Registro (formato actual — v1.9+)
```js
{
  id:         1234567890123,      // Date.now() — también ID del documento
  fecha:      "2026-04-07",       // YYYY-MM-DD
  horario:    "San Marco 10:00",  // combined — mantenido para compat y CSV
  tour:       "San Marco",        // campo separado — agregado en v1.7
  time:       "10:00",            // campo separado — agregado en v1.7
  pax:        { 'Civitatis': 5, 'Viabam': 3, 'Web': 2 },
  fees:       { 'Civitatis': 15, 'Viabam': 7.5, 'Web': 4 },
  payments:   { 'Efectivo': 80, 'Revolut': 30 },
  captados:   2,                   // agregado en v1.9 — pasajeros sin comisión
  totalPax:   10,                  // SOLO plataformas (no incluye captados)
  totalComm:  26.50,
  totalCash:  110.00,
  netGain:    83.50
}
```

**Notas sobre `totalPax` y captados:**
- `totalPax` sigue contando **solo plataformas** para no romper la migración ni `compute()`.
- El "PAX total real" (gente física del tour) se calcula al vuelo como `totalPax + captados` en cards y tablas.
- **"Promedio pax global"** (tarjeta de resumen) = `Σ(totalCash) / Σ(totalPax + captados)` sobre todo el periodo visible. Es un promedio ponderado.
- **"Promedio"** (columna por fila en la tabla) = `totalCash_tour / (totalPax_tour + captados_tour)` del tour individual.
- Ambos promedios usan la misma fórmula conceptual (cobros ÷ gente real, captados incluidos aunque paguen €0). La tarjeta da la lectura agregada del periodo, la columna la lectura tour-por-tour. Coinciden si el periodo tiene un único tour.
- Popup WhatsApp NO incluye captados (decisión del usuario — solo interesa comunicar pax por plataforma a los compañeros).

**Compatibilidad con registros anteriores:**
- v1.0–v1.2: helpers `getRecordPax(r)`, `getRecordFees(r)`, `getRecordPayments(r)` detectan campos viejos (`civitatis`, `viabam`, etc.)
- v1.3–v1.6: registros con `horario: "SM 10:00"` sin `tour`/`time` → migración automática al abrir la app (`migrateOldRecords()`) + helpers `getRecordTour(r)` / `getRecordTime(r)` parsean al vuelo si la migración aún no corrió
- v1.7–v1.8.1: registros sin campo `captados` → helper `getRecordCaptados(r)` devuelve 0 por default. Sin migración necesaria.

### Config de usuario
```js
// users/{uid}/config/settings
{
  platforms:      [{ name: 'Civitatis', rate: 3 }, ...],
  paymentMethods: ['Efectivo', 'Revolut', 'Sumup'],
  schedules:      [{ tour: 'San Marco', time: '10:00' }, ...],  // agregado en v1.7
  userName:       'Julian'   // opcional — campo agregado en v1.6
}
```

---

## Decisiones técnicas

- **Multiusuario vía subcolecciones:** cada usuario tiene `users/{uid}/registros/` y `users/{uid}/config/settings`. Las reglas de Firestore garantizan aislamiento total.
- **Registro controlado:** verificación client-side de `approved_emails/{email}` antes de `createUserWithEmailAndPassword`. El admin aprueba emails desde Firebase Console.
- **Formularios y tablas 100% dinámicos:** se generan con `buildForms()` al iniciar sesión, según la config del usuario. Si cambia la config, se reconstruyen.
- **Claves Firebase en env vars:** `functions/firebase-config.js` evita exponer claves en el código fuente público.
- **Tres archivos separados (index.html / style.css / app.js):** mantenibilidad sin sacrificar simplicidad. Cloudflare Pages los sirve estáticos sin configuración extra.
- **SDK compat (no modular):** más simple para un proyecto sin bundler.
- **`onSnapshot` como única fuente de verdad:** no hay estado local; Firestore actualiza la UI automáticamente.
- **IDs como `Date.now()`:** suficiente para uso personal; sin riesgo de colisión con un usuario a la vez.
- **CSV con BOM UTF-8 y separador `;`:** necesario para Excel en español.

---

## Historial de versiones

### v1.0 — 06/04/2026
- Versión inicial: registro de tours, historial, CSV, PIN de acceso, Firestore

### v1.1 — 06/04/2026
- Claves Firebase movidas a variables de entorno de Cloudflare (`functions/firebase-config.js`)

### v1.2 — 06/04/2026
- Reemplazado PIN por Firebase Authentication (email/password)
- Reglas de Firestore actualizadas: `if request.auth != null`

### v1.3 — 07/04/2026
- **Multiusuario:** datos separados por usuario en `users/{uid}/registros/`
- **Registro controlado:** solo emails aprobados en `approved_emails` pueden crear cuenta
- **Vista Configuración:** plataformas/tarifas y medios de pago completamente personalizables por usuario
- **Formularios y tablas dinámicos:** se adaptan a la config de cada usuario
- Migración de datos existentes de `/registros/` → `/users/{uid}/registros/`
- Nuevo modelo de datos con `pax`, `fees`, `payments` (objetos dinámicos)
- Compatibilidad hacia atrás con registros en formato anterior

### v1.4 — 07/04/2026
- **Refactor estructural:** CSS y JS extraídos del `index.html` a `style.css` y `app.js`
- `index.html` reducido de ~1935 líneas a ~290 (solo HTML)
- Sin cambios en funcionalidad ni en el proceso de deploy

### v1.5 — 07/04/2026
- **Fix: eliminado parpadeo de login al recargar (F5)**
- Agregado `#loading-screen` (fondo oscuro + logo) que se muestra mientras Firebase resuelve el auth state
- `#login-screen` ahora inicia oculto; solo aparece cuando `onAuthStateChanged` confirma que no hay sesión activa
- Sin cambios en funcionalidad

### v1.6 — 07/04/2026
- **Saludo personalizado:** campo `userName` en `users/{uid}/config/settings`; header muestra "Hola, [Nombre]"
- **Header reestructurado:** logo | nav | `.header-right` (greeting + sync + salir) en desktop; logo | header-right | nav en móvil
- **Campo "Tu nombre" en Configuración:** se guarda en Firestore y sincroniza entre dispositivos
- **PWA:** agregados `icon.svg` (lápiz violeta) y `manifest.json`; favicon en tab del browser

### v1.7 — 08/04/2026
- **Tours y horarios configurables:** cada guía define sus propios tours (nombre + hora) desde Configuración
- **Dropdown "Tour" dinámico** en Registro y modal Editar — generado desde `userConfig.schedules`
- **Historial:** columna "Horario" reemplazada por dos columnas separadas: Tour (truncado en mobile) y Horario
- **CSV:** columnas Tour y Horario exportadas por separado
- **Migración automática:** al iniciar sesión, `migrateOldRecords()` parsea registros con `horario: "SM HH:MM"` y les agrega `tour` y `time` en Firestore — sin intervención manual
- **Nuevos helpers:** `getRecordTour(r)` / `getRecordTime(r)` con backward compat total
- **Nuevo campo en config:** `schedules: [{ tour, time }]` en `users/{uid}/config/settings`

### v1.8 — 08/04/2026
- **Pestaña "Hoy" en Historial:** tercer modo junto a "Por mes" y "Por período"
- Filtra y muestra solo los registros del día actual (resumen + tabla sin columna Fecha)
- Estado vacío: "Hoy no has registrado ningún tour todavía"
- **Exportar datos de hoy** (con logo WhatsApp): abre popup con resumen del día en formato texto
- Formato del popup: fecha única al inicio (`📅 08/04 —`), luego cada tour con nombre + hora y pax por plataforma separados; plataformas con 0 pax omitidas
- **Copiar para WhatsApp** (con logo WhatsApp): copia el texto al portapapeles; confirma con "¡Copiado!" durante 2 segundos
- Popup cierra tocando el fondo o el botón "Cerrar"
- Logos WhatsApp: SVG inline en ambos botones — verde (#25D366) en "Exportar", color del botón en "Copiar"

### v1.8.1 — 10/04/2026
- **Fix responsive móvil:** `.pax-row` y `.preview-row` con `minmax(120px)` en vez de `minmax(80px)` — con 4+ plataformas se distribuyen en 2+2 filas en lugar de 4 apretadas
- **Nuevo breakpoint ≤380px:** fuerza 2 columnas y reduce labels para pantallas muy pequeñas (iPhone SE, etc.)

### v1.9 — 11/04/2026
- **Pasajeros captados:** nuevo campo fijo en el formulario Registro (y modal Editar) entre "Pasajeros por origen" y "Cobros recibidos". Input único con hint "sin comisión". Comisión 0, no genera `fees`.
- **Promedio pax:** nueva tarjeta de resumen en las 3 pestañas del Historial (Por mes, Por período, Hoy), ubicada antes de "Comisiones". Fórmula: `totalCash ÷ (totalPax + captados)` — los captados cuentan como asistentes reales del tour aunque hayan pagado €0, así que bajan el promedio (refleja cuánto dejó cada persona del tour al total).
- **PAX total realista:** la tarjeta "PAX total" en los 3 modos del historial ahora muestra plataformas + captados (gente física del tour).
- **Columna "Capt." en tablas:** entre PAX y las plataformas, en las tablas de los 3 modos. Ancho 52px, centrada. Muestra "—" si el tour no tuvo captados.
- **CSV actualizado:** columna "Captados" entre "PAX Total" y las plataformas.
- **Popup WhatsApp sin cambios:** los captados NO aparecen en el texto copiado (decisión del usuario — los compañeros solo quieren saber pax por plataforma).
- **Nuevo helper `getRecordCaptados(r)`:** con fallback a 0 — compatibilidad total con registros anteriores sin migración.
- **Modelo de datos:** nuevo campo `captados` en los registros nuevos. `totalPax` mantiene su semántica original (solo plataformas) para no romper `compute()` ni la migración previa.

### v1.9.1 — 11/04/2026 — ✅ ESTADO ACTUAL EN PRODUCCIÓN
- **Tarjeta renombrada** `"Promedio pax"` → **`"Promedio pax global"`** en las 3 vistas del resumen, para distinguirla del promedio por tour individual.
- **Nueva columna "Promedio" en las tablas** del historial: ubicada entre las plataformas y "Comisiones", en los 3 modos (Por mes, Hoy, Por período). Muestra el promedio por tour individual: `totalCash_tour / (totalPax_tour + captados_tour)`. Coloreada en acento violeta (`var(--accent)`) para distinguirla visualmente. Ancho 82px.
- **Footer de las tablas** (Por mes y Por período) muestra el promedio global del periodo en la columna Promedio — coincide con el valor de la tarjeta superior.
- **CSV** incluye la nueva columna "Promedio pax" por tour, entre las plataformas y "Total Comisiones".
- **Semántica importante:** "Promedio pax global" (tarjeta) ≠ "Promedio" por fila. La tarjeta es un promedio ponderado de todo el periodo (total cobros ÷ total gente). La columna por fila es el promedio específico de ese tour. Coinciden cuando el periodo tiene un único tour; divergen según varíen los tours del periodo.

---

## Estado del repo y deploy (snapshot al 11/04/2026)

### Rama y commits
- **Rama activa en producción:** `main` — commit `a14f6fb` (feat: columna Promedio por tour + renombrar tarjeta a Promedio pax global, v1.9.1)
- **Commit inmediatamente anterior:** `99cfe4f` (feat: pasajeros captados + tarjeta Promedio pax, v1.9)
- **Tag de checkpoint:** `v1.8.1-stable` → apunta al commit `a119db7` (docs: agregar v1.8.1 al historial). Es el último punto estable antes de la feature de captados/promedio. Si hace falta revertir v1.9.x completo, usar este tag.
- **Rama `feature/captados-promedio`**: todavía existe en `origin` (remote). Ya fue fusionada a `main` vía fast-forward. Se puede borrar con seguridad cuando convenga limpiar: `git push origin --delete feature/captados-promedio` + `git branch -d feature/captados-promedio`. No es urgente.

### Deploy
- Cada push a `main` dispara deploy automático a **https://app-comisiones-itaka.pages.dev** (~1 min).
- **Variables de entorno de Firebase:** configuradas solo para el entorno **Production** de Cloudflare Pages. **NO están configuradas para Preview** → los preview deployments de ramas feature se cuelgan en el loading screen porque `/firebase-config` devuelve valores `undefined`.
- **Implicancia práctica:** para probar cambios grandes sin arriesgar producción, las opciones son: (a) configurar las mismas env vars también en Preview en Cloudflare Pages Settings → Variables, o (b) hacer merge directo a main y usar un tag stable como red de seguridad para revertir con `git reset --hard <tag>` + `git push --force origin main` si algo falla. En la sesión del 11/04/2026 se usó la opción (b).

### Comandos de emergencia — volver a v1.8.1
Si v1.9.x presenta algún bug crítico en producción y hay que revertir al estado pre-captados:

```bash
cd "d:/Herramientas personales/Appcomisiones-itaka"
git checkout main
git reset --hard v1.8.1-stable
git push origin main --force
```

Cloudflare redeploya la versión vieja en ~1 min. Los registros nuevos con captados quedan guardados en Firestore pero la UI vieja los ignora (es un campo extra, no rompe nada). Al re-mergear v1.9.x, los captados vuelven a aparecer.

---

## Próximos pasos sugeridos (ideas abiertas, no compromisos)

- **Borrar rama `feature/captados-promedio`** del remoto cuando estés cómodo con v1.9.1 ya corriendo unos días en producción.
- **Configurar env vars de Cloudflare para Preview** si en el futuro querés probar ramas feature sin tocar main.
- **Input de captados en el preview del formulario:** actualmente el preview de "PAX total" muestra plataformas + captados pero no hay una celda dedicada de "captados" en el preview. Agregar si se vuelve confuso.
- **Tooltip sobre "Promedio"** explicando que incluye captados, por si un compañero lo ve y no entiende la divergencia con otras cuentas. Baja prioridad.
- **Mostrar "PAX real" en cada fila** (actualmente la fila muestra solo `totalPax` = plataformas y Capt. en columna aparte — la suma queda implícita). Evaluar si ayuda.

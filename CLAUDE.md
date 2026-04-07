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

**Sin framework, sin build step, sin bundler.** Deploy directo: push a GitHub → Cloudflare Pages publica automáticamente (sirve los tres archivos estáticos sin configuración adicional).

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
├── index.html                 # Esqueleto HTML (~290 líneas)
├── style.css                  # Todos los estilos (~765 líneas)
├── app.js                     # Toda la lógica JS (~878 líneas)
├── functions/
│   └── firebase-config.js     # Cloudflare Pages Function — sirve config de Firebase
└── CLAUDE.md
```

---

## Lógica de negocio

### Horarios disponibles
SM 10:00 / SM 10:30 / SM 13:00 / SM 13:30

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
- Formulario dinámico: fecha, horario, PAX por plataforma, cobros por medio de pago
- Preview en tiempo real de todos los cálculos
- Guardar / Limpiar

### Vista Historial — Por mes
- Navegación mes a mes, 5 tarjetas de resumen
- Tabla dinámica con columnas según las plataformas del usuario
- Editar (modal slide-up en móvil) / Eliminar con confirmación
- Exportar CSV (BOM UTF-8, separador `;`, compatible con Excel)

### Vista Historial — Por período
- Filtro libre por rango de fechas
- Tarjetas de breakdown por plataforma y medio de pago
- Tabla detallada + exportar CSV del período

### Vista Configuración
- Agregar, editar y eliminar plataformas/tarifas
- Agregar, editar y eliminar medios de pago
- Se guarda en `users/{uid}/config/settings` y se aplica globalmente

### Indicador de sincronización
Gris (conectando) → Naranja (guardando) → Verde (sincronizado) → Rojo (sin conexión)

### Responsive
- Header de dos filas en móvil, nav full-width
- Inputs `font-size: 16px` para evitar zoom en iOS
- Touch targets mínimos 44–48px
- Modal como bottom sheet en móvil

---

## Modelo de datos

### Registro (nuevo formato — v1.3+)
```js
{
  id:         1234567890123,      // Date.now() — también ID del documento
  fecha:      "2026-04-07",       // YYYY-MM-DD
  horario:    "SM 10:30",
  pax:        { 'Civitatis': 5, 'Viabam': 3, 'Web': 2 },
  fees:       { 'Civitatis': 15, 'Viabam': 7.5, 'Web': 4 },
  payments:   { 'Efectivo': 80, 'Revolut': 30 },
  totalPax:   10,
  totalComm:  26.50,
  totalCash:  110.00,
  netGain:    83.50
}
```

**Compatibilidad con registros anteriores (v1.0–v1.2):** los helpers `getRecordPax(r)`, `getRecordFees(r)`, `getRecordPayments(r)` detectan el formato viejo (`civitatis`, `viabam`, `web`, `efectivo`, `revolut`, `sumup`) y lo convierten al vuelo.

### Config de usuario
```js
// users/{uid}/config/settings
{
  platforms:      [{ name: 'Civitatis', rate: 3 }, ...],
  paymentMethods: ['Efectivo', 'Revolut', 'Sumup']
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

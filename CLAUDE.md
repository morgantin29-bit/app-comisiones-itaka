# CLAUDE.md — App Comisiones Itaka

## Qué es esta app

Herramienta personal para registrar y calcular comisiones de tours diarios (Santa María). Cada día se hacen 1 o 2 tours en horarios fijos; por cada tour se registra cuántos pasajeros vinieron de cada plataforma y los cobros recibidos (Efectivo, Revolut, Sumup). La app calcula automáticamente las comisiones y la ganancia neta.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | HTML + CSS + JS vanilla — un único archivo `index.html` |
| Base de datos | Firebase Firestore (SDK compat v10.14.1 vía CDN) |
| Hosting | Cloudflare Pages |
| Repositorio | GitHub |
| Fuente | Google Fonts (Inter) |

**Sin framework, sin build step, sin bundler.** El deploy es directo: push a GitHub → Cloudflare Pages detecta el cambio y publica automáticamente.

---

## URLs

- **Producción:** https://app-comisiones-itaka.pages.dev
- **Firebase Console:** https://console.firebase.google.com/project/app-comisiones-itaka
- **Repositorio GitHub:** _(completar con la URL del repo)_

---

## Acceso

La app está protegida por un **PIN numérico de 4 dígitos: `1680`**.

- Al entrar se muestra una pantalla de PIN; sin el PIN correcto no se ve nada.
- El PIN queda guardado en `localStorage` — en el mismo dispositivo no hay que volver a ingresarlo.
- El botón **Salir** en el header borra el PIN del localStorage y vuelve a la pantalla de PIN.
- No hay autenticación de servidor (Firebase Auth no se usa). La protección es solo client-side, adecuada para uso personal.

> **Nota:** Se intentó implementar Google Login con Firebase Authentication pero se descartó por problemas irresolubles con la API key (`auth/api-key-not-valid`). Se reemplazó por PIN simple.

---

## Firebase

- **Proyecto:** `app-comisiones-itaka`
- **SDK:** Firebase compat v10.14.1 (cargado desde `www.gstatic.com`) — solo Firestore, sin Auth
- **Colección Firestore:** `registros`
- **ID de documento:** timestamp Unix (`Date.now()`) convertido a string
- **Listener:** `onSnapshot` en tiempo real — cualquier cambio en Firestore actualiza la UI en todos los dispositivos sin recargar
- **Persistencia offline:** `db.enablePersistence({ synchronizeTabs: true })` — la app funciona sin internet y sincroniza al reconectar

### Configuración de claves (desde 2026-04-06)

Las claves de Firebase **ya no están hardcodeadas** en `index.html`. Al iniciar, la app hace un `fetch('/firebase-config')` que llama a la Cloudflare Pages Function `functions/firebase-config.js`, la cual lee las claves desde las variables de entorno del proyecto en Cloudflare y las devuelve como JSON.

Variables de entorno requeridas en Cloudflare Pages:
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`

### Reglas de Firestore actuales
```
allow read, write: if true;
```
(uso personal, acceso controlado solo por PIN en el frontend)

---

## Estructura del proyecto

```
Appcomisiones-itaka/
├── index.html                    # Toda la app (HTML + CSS + JS)
├── functions/
│   └── firebase-config.js        # Cloudflare Pages Function — sirve la config de Firebase desde env vars
└── CLAUDE.md                     # Este archivo
```

Si se agrega un archivo `_headers` en la raíz, Cloudflare Pages lo usa para definir cabeceras HTTP (necesario si hay problemas de CSP con el CDN de Firebase).

---

## Lógica de negocio

### Horarios disponibles
- SM 10:00
- SM 10:30
- SM 13:00
- SM 13:30

### Tarifas de comisión
- **Civitatis:** €3 por pasajero
- **Viabam:** €2.50 por pasajero
- **Web:** €2 por pasajero

### Cálculos automáticos por registro
- Total PAX = Civitatis + Viabam + Web
- Comisión Civitatis = PAX × €3
- Comisión Viabam = PAX × €2.50
- Comisión Web = PAX × €2
- Total comisiones = suma de las tres
- Total cobros = Efectivo + Revolut + Sumup
- Ganancia neta = Total cobros − Total comisiones

---

## Funcionalidades implementadas

### Vista Registrar
- Formulario con: fecha (default hoy), horario (selector), PAX por origen, cobros recibidos (tres campos: Efectivo / Revolut / Sumup)
- Preview en tiempo real de todos los cálculos mientras se tipea
- Guardar en Firestore con un click
- Limpiar formulario

### Vista Historial — modo "Por mes"
- Navegación mes a mes con flechas
- 5 tarjetas de resumen del mes: tours, PAX total, comisiones, cobros totales, ganancia neta
- Tabla completa con todos los registros del mes — columna "Cobros" muestra total; si hay Revolut o Sumup, muestra desglose en sub-línea (Ef / Rv / Su)
- Fila de totales al pie de la tabla
- Editar cualquier registro (modal slide-up en móvil) — incluye los tres campos de cobro
- Eliminar registro con confirmación
- Exportar CSV del mes (con BOM UTF-8, separador `;`, compatible con Excel) — incluye columnas Efectivo, Revolut, Sumup y Total Cobros

### Vista Historial — modo "Por período"
- Filtro libre por rango de fechas (desde / hasta), independiente del mes calendario
- Resumen del período con 9 tarjetas: Civitatis, Viabam, Web, Total comisiones, Efectivo, Revolut, Sumup, Total cobros, Ganancia neta
- Tabla detallada del período con totales al pie
- Exportar CSV del período (nombre de archivo incluye fechas del rango) — mismas columnas extendidas

### Indicador de sincronización (header)
| Estado | Color | Cuándo |
|---|---|---|
| Conectando… | Gris | Al iniciar |
| Guardando… | Naranja | Escritura pendiente de confirmar |
| Sincronizado | Verde | Datos confirmados en servidor |
| Sin conexión | Rojo | Sin internet o error de Firestore |

### Responsive / móvil
- Header de dos filas en móvil (logo + nav)
- Inputs a `font-size: 16px` para evitar zoom automático en iOS
- Touch targets mínimos de 44–48px
- Modal como bottom sheet en móvil (slide-up desde el borde inferior)
- Toast full-width en móvil

---

## Modelo de datos (documento Firestore)

```js
{
  id:           1234567890123,   // Date.now() — también es el ID del documento
  fecha:        "2026-03-15",    // YYYY-MM-DD
  horario:      "SM 10:30",
  civitatis:    5,               // PAX
  viabam:       3,               // PAX
  web:          2,               // PAX
  efectivo:     80.00,           // cobro en efectivo
  revolut:      30.00,           // cobro por Revolut
  sumup:        10.00,           // cobro por Sumup
  totalCash:    120.00,          // efectivo + revolut + sumup
  totalPax:     10,
  civitatisFee: 15.00,
  viabamFee:    7.50,
  webFee:       4.00,
  totalComm:    26.50,
  netGain:      93.50            // totalCash - totalComm
}
```

**Compatibilidad hacia atrás:** registros anteriores no tienen `revolut`, `sumup` ni `totalCash`. El helper `getTotalCash(r)` detecta esto y usa `r.efectivo` directamente.

---

## Decisiones técnicas relevantes

- **Claves Firebase en env vars (no hardcodeadas):** `functions/firebase-config.js` es una Cloudflare Pages Function que sirve la config vía `GET /firebase-config`; el frontend la fetchea al arrancar antes de inicializar Firebase. Evita exponer claves en el código fuente público
- **Un solo archivo principal:** facilita el deploy en Cloudflare Pages sin configuración de build
- **SDK compat (no modular):** más simple para un archivo sin bundler; la diferencia de tamaño no importa en este contexto
- **`onSnapshot` como única fuente de verdad:** todas las escrituras (add/edit/delete) van a Firestore y el listener se encarga de actualizar la UI; no hay estado local que gestionar manualmente
- **`enablePersistence` se registra después del listener:** evita que un fallo de persistencia bloquee la conexión inicial a Firestore
- **IDs como `Date.now()`:** simple y suficiente para uso personal de un solo usuario; no hay riesgo de colisión
- **CSV con BOM UTF-8 y separador `;`:** necesario para que Excel en español abra el archivo correctamente sin configuración adicional
- **PIN en localStorage:** la sesión queda recordada indefinidamente en el dispositivo; el botón Salir la borra manualmente

---

## Historial de versiones

### v1.0 — 06/04/2026
- Versión inicial estable con registro de tours, historial, exportación CSV y PIN de acceso
- Firebase Firestore como base de datos
- Deploy en Cloudflare Pages

### v1.1 — 06/04/2026
- Claves de Firebase movidas a variables de entorno de Cloudflare
- Agregada función `functions/firebase-config.js` para cargar config de forma segura

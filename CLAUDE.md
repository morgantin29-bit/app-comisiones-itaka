# CLAUDE.md — App Comisiones Itaka

## Qué es esta app

Herramienta personal para registrar y calcular comisiones de tours diarios (Santa María). Cada día se hacen 1 o 2 tours en horarios fijos; por cada tour se registra cuántos pasajeros vinieron de cada plataforma y el efectivo recibido. La app calcula automáticamente las comisiones y la ganancia neta.

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

## Firebase

- **Proyecto:** `app-comisiones-itaka`
- **SDK:** Firebase compat v10.14.1 (cargado desde `www.gstatic.com`)
- **Colección Firestore:** `registros`
- **ID de documento:** timestamp Unix (`Date.now()`) convertido a string
- **Listener:** `onSnapshot` en tiempo real — cualquier cambio en Firestore actualiza la UI en todos los dispositivos sin recargar
- **Persistencia offline:** `db.enablePersistence({ synchronizeTabs: true })` — la app funciona sin internet y sincroniza al reconectar

### Reglas de Firestore actuales
```
allow read, write: if true;
```
(uso personal, sin autenticación)

---

## Estructura del proyecto

```
Appcomisiones-itaka/
├── index.html      # Toda la app (HTML + CSS + JS)
└── CLAUDE.md       # Este archivo
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
- Ganancia neta = Efectivo recibido − Total comisiones

---

## Funcionalidades implementadas

### Vista Registrar
- Formulario con: fecha (default hoy), horario (selector), PAX por origen, efectivo recibido
- Preview en tiempo real de todos los cálculos mientras se tipea
- Guardar en Firestore con un click
- Limpiar formulario

### Vista Historial — modo "Por mes"
- Navegación mes a mes con flechas
- 5 tarjetas de resumen del mes: tours, PAX total, comisiones, efectivo, ganancia neta
- Tabla completa con todos los registros del mes
- Fila de totales al pie de la tabla
- Editar cualquier registro (modal slide-up en móvil)
- Eliminar registro con confirmación
- Exportar CSV del mes (con BOM UTF-8, separador `;`, compatible con Excel)

### Vista Historial — modo "Por período"
- Filtro libre por rango de fechas (desde / hasta), independiente del mes calendario
- Resumen del período con 6 tarjetas: comisiones Civitatis, Viabam, Web, total comisiones, efectivo, ganancia neta
- Tabla detallada del período con totales al pie
- Exportar CSV del período (nombre de archivo incluye fechas del rango)

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
  efectivo:     120.00,
  totalPax:     10,
  civitatisFee: 15.00,
  viabamFee:    7.50,
  webFee:       4.00,
  totalComm:    26.50,
  netGain:      93.50
}
```

---

## Decisiones técnicas relevantes

- **Un solo archivo:** facilita el deploy en Cloudflare Pages sin configuración de build
- **SDK compat (no modular):** más simple para un archivo sin bundler; la diferencia de tamaño no importa en este contexto
- **`onSnapshot` como única fuente de verdad:** todas las escrituras (add/edit/delete) van a Firestore y el listener se encarga de actualizar la UI; no hay estado local que gestionar manualmente
- **`enablePersistence` se registra después del listener:** evita que un fallo de persistencia bloquee la conexión inicial a Firestore
- **IDs como `Date.now()`:** simple y suficiente para uso personal de un solo usuario; no hay riesgo de colisión
- **CSV con BOM UTF-8 y separador `;`:** necesario para que Excel en español abra el archivo correctamente sin configuración adicional

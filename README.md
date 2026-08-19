# M.A.T.S. Mutual Aid Tracking System

=====================================================================
PEGAR TAL CUAL EN LOVABLE — PROMPT ÚNICO “COMUNIDAD EX SOS”
(Generar proyecto completo multi-archivo: React+Vite+Tailwind + PWA + Supabase + Leaflet)
Incluye: privacidad extrema, pánico, tránsito seguro, sismos “4/10” y “14”, modo desastre,
mesh BLE solo en desastre (con wrapper opcional), invitaciones (código manual + QR),
versión + auto-update, reportes de camino con foto+audio, ayuda urgente con foto+audio,
+ COMPRESIÓN AUTOMÁTICA DE FOTOS y LÍMITE/RECORTE DE AUDIO.
=====================================================================

ROL DEL GENERADOR:
Actúa como arquitecto senior de apps de misión crítica / seguridad pública. Prioriza: seguridad, privacidad, estabilidad, UX ultrarrápida y modo oscuro minimalista.

NOMBRE APP:
COMUNIDAD EX SOS (PWA instalable)

IDENTIDAD VISUAL:
- Logo: estrella de la vida verde con siglas “M.A.T.S.” (SVG)
- UI minimalista, dark-mode por defecto
- Botón de pánico (FAB) central siempre visible en rojo/naranja vibrante

PRIVACIDAD (REGLA DE ORO):
En el mapa, los usuarios SOLO se ven como iconos M.A.T.S. SIN nombres, apodos, fotos, teléfonos.
No mostrar PII en mapa ni en listas. PII solo en perfil propio (RLS).

PÚBLICO Y ROLES:
- RESCATISTA: acceso completo
- FAMILIAR: funciones mínimas
  - Puede usar botón de pánico para sí mismo
  - Puede registrar Tránsito Seguro (carretera y vuelos)
  - Puede usar “14 AYUDA” y reportar sismos
  - NO puede publicar en Marketplace
  - En cualquier solicitud de ayuda del FAMILIAR se agrega disclaimer obligatorio:
    “FAMILIAR – NO PARAMÉDICO / NO EX PARAMÉDICO”

STACK OBLIGATORIO:
- Frontend: React + Vite + TypeScript + Tailwind
- Mapa: Leaflet + OpenStreetMap
- Backend/DB/Auth/Realtime/Storage: Supabase (plan gratuito)
- PWA: manifest + service worker + prompt instalación
- (Opcional recomendado para BLE Mesh real iOS/Android): Capacitor wrapper con plugin BLE
  - En Web/PWA puro: mostrar “Mesh no disponible” en iOS Safari; mantener arquitectura con interfaz MeshTransport.

REQUERIMIENTOS DE FUNCIONALIDAD (CORE):
1) Onboarding rápido (registro):
   - Nombre Completo, Apodo, Especialidad, Teléfono, Tipo (RESCATISTA/FAMILIAR)
   - Requiere invitación: Código manual o escaneo QR (payload JSON mínimo: {"t":"invite","c":"EXS-XXXXXX"})
2) Mapa:
   - Mostrar ubicación de usuarios activos (tabla user_locations) con icono M.A.T.S.
   - Actualizar ubicación con watchPosition (foreground)
3) Botón Pánico:
   - Opciones: Ambulancia Propia, Ambulancia Tercero, Patrulla, Mecánico, Protección Civil
   - Alerta por radio 5 km (server-side PostGIS)
   - WhatsApp: generar wa.me con tipo + GPS exacto + link Google Maps
4) Tránsito Seguro (ETA):
   - ROAD: Placas, Acompañantes, Origen, Destino, Medio
   - FLIGHT: Aerolínea, Nº vuelo, Aeropuertos, Horarios
   - Si no confirma llegada 30 min después del ETA: estado “ALERTA DESAPARECIDO” visible en mapa + notificación
5) Alertas globales:
   - USGS (sismos) y NOAA/NWS (RSS clima extremo) en tab “Alertas”
6) NUEVO: “¿Lo sentiste?” (sismo):
   - Al seleccionar evento USGS: reportar intensidad 1-10 y daños (OK/DAMAGE/UNSURE)
   - Botón rápido “4 de 10” = OK
   - Botón “14” = AYUDA: captura GPS exacto, dispara alerta urgente app-wide y marca punto en mapa con halo rojo y badge “14”
   - AYUDA 14 permite adjuntar fotos + nota de voz (ver módulo media)
7) NUEVO: Reportes de trayecto (bloqueos, accidentes, manifestantes, peligros, etc.):
   - Desde Tránsito: “Reportar incidente en el camino”
   - Campos: categoría (BLOCKADE/ACCIDENT/PROTEST/HAZARD/OTHER), severidad 1-4, título, descripción
   - GPS exacto y opcional vincular a trip activo
   - Adjuntar fotos + nota de voz
   - Mostrar feed de reportes recientes (sin PII), y puntos en el mapa
8) Modo Desastre Mayor:
   - Switch global disaster_mode en app_state
   - Si activo: bloquear Marketplace y priorizar “Estado” + “Necesito ayuda”
   - Activar MESH solo en desastre
9) Mesh BLE (solo en desastre):
   - Solo transmite mensajes críticos: PANIC, STATUS_OK/NEED_HELP, DRILL_TEST/ACK, HELP_14
   - En Web: stub (sin BLE real), pero mantiene cola offline y sync cuando vuelve internet
   - En Capacitor: implementar MeshTransport BLE (scan/advertise/store-forward)
10) TEST MENSUAL:
   - Botón “TEST MENSUAL” visible
   - Descarga llave mensual mesh_group_keys SOLO en Test Mensual (Edge Function monthly-test-key)
   - Registra ACK y prueba notificaciones/realtime
11) Invitaciones dentro de la app:
   - Generar código + QR (sin deep links)
12) Versión + actualización:
   - Mostrar versión actual vX.Y.Z + build time
   - Siempre que abra la app:
     - forzar update() del service worker
     - consultar release-check (app_releases) para latest/min_supported
     - si must_update: bloquear con pantalla de actualización requerida

MEDIA (IMÁGENES + AUDIO) — ULTRA RÁPIDO:
A) LÍMITE + COMPRESIÓN AUTOMÁTICA DE FOTOS (antes de subir):
   - Máx 3 fotos por reporte/ayuda
   - Máx peso original por foto: 8MB (si supera, rechazar con mensaje)
   - Redimensionar a MAX_DIM = 1280px (lado mayor)
   - Convertir a JPEG/WEBP (preferir WEBP si disponible) con calidad inicial 0.72
   - Reintentar bajando calidad hasta que cada imagen quede <= 450KB (límite objetivo), mínimo calidad 0.45
   - Si aún > 900KB, rechazar (para no matar rendimiento) y pedir otra foto
   - Implementar con canvas: createImageBitmap -> drawImage -> canvas.toBlob
B) AUDIO (nota de voz) — máx 30 segundos con recorte:
   - Duración máxima: 30s (configurable a 20–30s; usar 30s)
   - “Recorte” = autostop a los 30s (no permitir más); mostrar contador
   - Formato: audio/webm (Opus) si soportado, si no audio/mp4
   - Tamaño máximo: 1.5MB (si excede, advertir y pedir regrabar más corto)
   - Al detener, guardar blob final y permitir reproducción antes de enviar

STORAGE + SEGURIDAD:
- Bucket privado “reports_media”
- Policies:
  - lectura: authenticated (comunidad)
  - insert/update/delete: solo owner
- En DB, guardar referencias en report_media (report_type, report_id, media_type, storage_path, mime, duration_ms)
- Visualización: usar signed URLs (1 hora)

ARQUITECTURA FRONTEND:
- Pestañas: Mapa, Tránsito, Alertas, (Market solo si no desastre y rol rescatista), Estado, Config
- Mapa principal siempre
- FAB pánico siempre visible
- Componentes:
  - MediaCapture (fotos)
  - VoiceRecorder (audio max 30s)
  - MediaPreview (ver adjuntos usando signed URLs)
- Cola offline (IndexedDB) para eventos si no hay conectividad (subir al volver)

BACKEND / DB (SUPABASE):
Generar migraciones SQL:
- 001_init.sql: base (profiles, user_locations, app_state, disaster_sessions, mesh_group_keys, device_keys, mesh_ingress, panic_events, status_messages, help_requests, quake_checkins, transit_trips, announcements, drill windows/ack, app_releases, invites/invite_uses)
- 002_media_and_reports.sql: bucket/policies + road_reports + report_media

EDGE FUNCTIONS (SUPABASE) a generar:
- release-check
- invites-create
- invites-consume
- panic-create
- status-set
- transit-create
- quake-checkin
- help-create (DEBE aceptar id opcional + media[])
- road-report-create (DEBE aceptar id opcional + media[])
- monthly-test-key
- rotate-mesh-key (cron)
- mesh-ingest (firma+descifrado+canonización) — MVP: recibir envelope y registrar

IMPORTANTE: NO exponer mesh_group_keys al cliente; solo monthly-test-key por service role.

MAPA VISUAL:
- Usuarios: icono M.A.T.S.
- Help 14: halo rojo + badge “14”
- Road reports: círculo naranja/verde según severidad
- Overdue: estado “ALERTA DESAPARECIDO” (icono/halo distintivo)

ENTREGABLE (LO QUE DEBES GENERAR COMO CÓDIGO):
1) Proyecto Vite+React+TS+Tailwind con PWA (vite-plugin-pwa)
2) UI completa minimalista en dark mode, móvil-first
3) Implementación Supabase client + RLS-friendly
4) Leaflet map + realtime updates
5) Pantallas:
   - AuthGate (OTP por teléfono) + consumo de invitación por código
   - MapScreen
   - AlertsScreen (USGS + “4/10” + “14” + adjuntos)
   - TransitScreen (registro + “Reportar incidente” + feed + adjuntos)
   - StatusScreen (Estoy Bien / Necesito Ayuda + Test Mensual)
   - SettingsScreen (Invitar código+QR + versión + cerrar sesión)
6) Media:
   - util: compressImages(files) con límites y compresión
   - util: uploadMedia (usa reports_media bucket)
   - VoiceRecorder con auto-stop 30s + contador + límite tamaño
7) SQL migrations completas (001 y 002) listas para pegar
8) Edge functions completas (todas las listadas)
9) README breve con:
   - variables env VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
   - pasos para correr migraciones y desplegar functions
   - nota iOS: BLE mesh real requiere Capacitor; en web es stub

DETALLES ESPECÍFICOS QUE DEBES IMPLEMENTAR EN CÓDIGO:
A) COMPRESIÓN DE IMÁGENES (implementación obligatoria):
- Crear archivo src/lib/imageCompress.ts con:
  - MAX_FILES = 3
  - MAX_ORIGINAL_BYTES = 8*1024*1024
  - MAX_DIM = 1280
  - TARGET_BYTES = 450*1024
  - HARD_MAX_BYTES = 900*1024
  - QUALITY_START = 0.72
  - QUALITY_MIN = 0.45
  - QUALITY_STEP = 0.07
- Función:
  async function compressImages(files: File[]): Promise<File[]>
  - Validar límites
  - Para cada file:
    - decode a bitmap
    - scale manteniendo aspect ratio a MAX_DIM
    - export a blob (prefer webp si soporta canvas.toBlob('image/webp'), si no jpeg)
    - si blob.size > TARGET_BYTES: bajar calidad en loop
    - si blob.size > HARD_MAX_BYTES: throw con mensaje “Foto demasiado pesada…”
  - Devolver nuevos Files (con nombre y type)
- Integrar en el flujo antes de upload (help y road reports)

B) AUDIO MAX 30s (implementación obligatoria):
- En VoiceRecorder:
  - maxDurationMs = 30000
  - Al iniciar: setTimeout(stop, maxDurationMs)
  - Mostrar contador “mm:ss restante”
  - Al stop: si duration > maxDurationMs, usar maxDurationMs (ya se autostop)
  - Validar blob.size <= 1.5MB; si excede: mostrar error y descartar blob (pedir regrabar)

C) AYUDA 14 CON MEDIA:
- Flujo:
  - generar helpId (uuid)
  - comprimir fotos -> subir -> subir audio -> obtener mediaRefs
  - llamar help-create con {id: helpId, ... , media: mediaRefs}
- Realtime:
  - al INSERT help_requests kind=’SISMO_AYUDA_14’: overlay urgente

D) REPORTES DE CAMINO CON MEDIA:
- Flujo:
  - generar reportId
  - comprimir fotos -> subir -> subir audio -> call road-report-create con mediaRefs
- Feed:
  - listar road_reports recientes
  - al abrir uno: consultar report_media -> signed URLs -> mostrar imágenes/audio

E) LIMITES UX:
- Por defecto permitir:
  - 1–3 fotos
  - 1 audio <= 30s
- Mensajes UX claros si excede límites

BLE MESH (SOLO EN DESASTRE):
- Crear interfaz MeshTransport:
  - isAvailable(): boolean
  - start(): void
  - stop(): void
  - broadcast(envelope): void
- Implementar WebMeshTransport como stub (no BLE real)
- Dejar anotaciones para Capacitor plugin (no requerir implementación nativa en MVP web)

LISTA DE DEPENDENCIAS:
- react, react-dom
- leaflet, react-leaflet
- @supabase/supabase-js
- qrcode (generar QR)
- @zxing/browser (scanner QR)
- idb-keyval (cola offline)
- vite-plugin-pwa
- (no usar librerías pesadas de compresión; usar canvas nativo)

IMPORTANTE:
- Mantener código listo para copiar/pegar
- Generar los archivos con delimitadores claros “FILE: …”
- No omitir SQL ni Edge functions
- No inventar PII en UI del mapa
- Todo debe correr como PWA en móvil/tablet/desktop

AHORA GENERA:
1) Árbol de archivos completo
2) Contenido completo de cada archivo (código)
3) Las 2 migraciones SQL (001 y 002)
4) Todas las Edge Functions
5) README de despliegue

=====================================================================
FIN DEL PROMPT ÚNICO
=====================================================================

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://safe-guard-link.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d9e2fc11-83ac-4ac8-afca-2eafa7a26069).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

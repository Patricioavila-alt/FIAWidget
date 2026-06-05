# API FiA — Guía de Consumo

> AI Concierge de Salud "Sana" / FiA — documentación de los endpoints en producción.
> Generado el 2026-06-05. Revisión desplegada: `sana-api-00026-4pv`.

**Base URL:** `https://sana-api-771646345314.us-central1.run.app`

Toda la funcionalidad se expone a través de **2 flujos principales**:

- **Concierge conversacional** → WebSocket (`/ws/chat/...`)
- **Validador de recetas** → SSE streaming (`POST /validate`)

Ambos requieren un **JWT** que se obtiene primero en `/auth/token`.

---

## Índice

1. [Autenticación](#1-autenticación)
2. [Flujo A — Concierge (chat) vía WebSocket](#2-flujo-a--concierge-chat-vía-websocket)
3. [Flujo B — Validar receta vía SSE](#3-flujo-b--validar-receta-vía-sse-streaming)
4. [Otros endpoints](#4-otros-endpoints)
5. [Resumen rápido](#5-resumen-rápido)
6. [Notas de datos y comportamiento](#6-notas-de-datos-y-comportamiento)

---

## 1. Autenticación

Todos los flujos de negocio requieren un **JWT Bearer (HS256)**. Se obtiene así:

```bash
curl "https://sana-api-771646345314.us-central1.run.app/auth/token?role=demo"
```

**Respuesta:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 86400,
  "role": "demo"
}
```

| Detalle | Valor |
|---|---|
| Parámetro `role` | `demo` \| `patient` \| `doctor` (si pides `admin` se degrada a `demo`) |
| Vigencia | 24 h |
| Algoritmo | HS256 |
| Rate limit | 20 / min |
| CORS | Si `ALLOWED_ORIGINS` está configurado, solo responde a esos orígenes (hoy abierto) |

---

## 2. Flujo A — Concierge (chat) vía WebSocket

```
WSS /ws/chat/{session_id}?token=<JWT>&platform=web&user_id=<id>
```

| Query param | Obligatorio | Descripción |
|---|---|---|
| `session_id` (en la ruta) | sí | ID que tú generas; mantiene la conversación (TTL 30 min en Firestore) |
| `token` | sí | El JWT del paso 1 (va en query param, **no** en header) |
| `platform` | no | `web` (default), `whatsapp`, etc. |
| `user_id` | no | **Clave**: las tools lo usan para traer datos reales del paciente. Si se omite, usa `session_id` y cae a datos demo |

**Mensaje que envías:**
```json
{ "message": "Hola, ¿qué medicamentos tomo hoy?" }
```

**Mensajes que recibes:**
```json
{ "type": "typing" }
{ "type": "response", "message": "...", "session_id": "..." }
```

### Ejemplo (JavaScript / navegador)

```js
const base = "sana-api-771646345314.us-central1.run.app";

// 1. Token
const { access_token } = await (
  await fetch(`https://${base}/auth/token?role=patient`)
).json();

// 2. WebSocket
const sid = crypto.randomUUID();
const ws = new WebSocket(
  `wss://${base}/ws/chat/${sid}?token=${access_token}&user_id=patient_123`
);

ws.onopen    = () => ws.send(JSON.stringify({ message: "¿Qué medicamentos tomo hoy?" }));
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === "response") console.log("FiA:", msg.message);
};
```

**Notas:**
- Pasa por **input_guard** (entrada) y **output_guard** (salida) automáticamente.
- Historial: `GET /chat/history/{session_id}`
- Borrar conversación: `DELETE /chat/history/{session_id}`

---

## 3. Flujo B — Validar receta vía SSE (streaming)

```
POST /validate
Authorization: Bearer <JWT>
Content-Type: application/json
```

### Cuerpo del request (`ValidateRequest`)

| Campo | Tipo | Notas |
|---|---|---|
| `input_mode` | string | `"image"` (default) o `"text"` |
| `cart` | object | **requerido** — `{"Amoxicilina": 21}` (medicamento → cantidad) |
| `image_b64` | string | solo modo imagen (base64 sin el prefijo `data:`) |
| `prescription_text` | string | solo modo texto |
| `use_mock` | bool / null | `null` = usa el default del server (en prod = **false**, valida real) |
| `mock_issue_date` | string | `YYYY-MM-DD`, para pruebas |
| `mock_cedula` | string | cédula 10 dígitos, para pruebas |
| `session_id` | string | opcional |
| `user_id` | string | opcional |
| `platform` | string | opcional (default `web`) |

### Ejemplo modo texto (curl)

```bash
TOKEN=$(curl -s "https://sana-api-771646345314.us-central1.run.app/auth/token?role=doctor" \
  | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

curl -N -X POST "https://sana-api-771646345314.us-central1.run.app/validate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input_mode": "text",
    "prescription_text": "Amoxicilina 500mg, tomar cada 8h por 7 dias. Dr. Perez. Cedula 1713175071.",
    "cart": { "Amoxicilina": 21 },
    "mock_issue_date": "2026-06-05",
    "mock_cedula": "1713175071"
  }'
```

### Ejemplo modo imagen

```json
{
  "input_mode": "image",
  "image_b64": "<base64 de la foto de la receta, sin prefijo data:>",
  "cart": { "Amoxicilina": 21 }
}
```

### Respuesta (Server-Sent Events)

`Content-Type: text/event-stream`. Eventos emitidos:

| Evento | Payload | Significado |
|---|---|---|
| `node` | `{ "node": "...", "data": { ...estado acumulado... } }` | Paso del pipeline completado (`interceptor`, `extractor`/`text_extractor`, `matcher`, `auditor`, `resolver`) |
| `done` | `{}` | Fin del stream |
| `error` | `{ "message": "..." }` | Error durante la validación |

El **veredicto final** (`APPROVED` / `REJECTED` / `FRAUD`) y el `validation_token` llegan en el `data` del último nodo (`resolver`).

**Rate limit:** 10 / min (configurable desde el panel `/admin`).

---

## 4. Otros endpoints

| Método | Ruta | Auth | Para qué |
|---|---|---|---|
| `GET` | `/health` | — | Estado del servicio (modelo, persistencia, sesiones activas) |
| `GET` | `/` | — | Sirve el widget (`frontend.html`) |
| `GET` | `/chat/history/{session_id}` | — | Historial de una conversación |
| `DELETE` | `/chat/history/{session_id}` | — | Borra una conversación |
| `POST` | `/auth/admin` | — | Login admin (`{"password": "..."}`) → token admin |
| `GET` | `/admin` | — | Panel HTML de administración |
| `GET` | `/admin/api/stats` | admin | Métricas de uso |
| `GET` | `/admin/api/sessions` | admin | Sesiones activas |
| `GET` / `POST` | `/admin/api/config` | admin | Settings dinámicos (rate limits, etc.) |
| `POST` | `/admin/api/killswitch` | admin | Apagar / encender el agente |
| `GET` / `POST` | `/webhook/whatsapp` | HMAC Meta | Integración WhatsApp Business (requiere cuenta business) |

**Ejemplo `/health`:**
```json
{
  "status": "ok",
  "project": "gen-lang-client-0389658532",
  "model": "gemini-2.5-flash",
  "mock_ai": false,
  "persistence": "firestore",
  "agent_runtime": "adk",
  "active_sessions": 0
}
```

---

## 5. Resumen rápido

1. **`GET /auth/token`** → guarda el `access_token`.
2. **Chat:** abre un WebSocket a `/ws/chat/{sid}?token=…&user_id=…` y envía `{ "message": "..." }`.
3. **Validación:** `POST /validate` con `Authorization: Bearer …` y lee el SSE hasta el evento `done`.

---

## 6. Notas de datos y comportamiento

- **Datos de paciente:** las colecciones Firestore (`patient_profiles`, `medication_schedules`, `pharmacies`) están **vacías** actualmente. Por eso perfil / recordatorios / farmacias devuelven **datos demo** hasta que se pueblen. Pasando un `user_id` que exista en Firestore se obtienen datos reales **sin cambiar nada del cliente**.
- **Validación real:** en producción `MOCK_AI=false`, por lo que `/validate` (y la tool `validate_prescription` del concierge) ejecutan extracción y auditoría reales con Gemini 2.5 Flash.
- **Guardrails:** tanto el WebSocket como el webhook de WhatsApp aplican input_guard (entrada) y output_guard (salida).
- **Sesiones:** TTL de 30 min en Firestore (`chat_sessions`). La memoria conversacional se rehidrata desde Firestore si la instancia de Cloud Run está fría.
- **Anti-fraude:** las recetas procesadas se registran en `processed_recipes` con TTL de 90 días.

---

## Stack de referencia

- **Backend:** FastAPI + Uvicorn sobre Google Cloud Run
- **Concierge:** Google ADK 1.14.1 + Gemini 2.5 Flash (6 tools nativas)
- **Pipeline de validación:** LangGraph (6 nodos)
- **Persistencia:** Firestore (sesiones, anti-fraude, datos de paciente)
- **Auth:** JWT Bearer HS256 + RBAC (`demo` / `patient` / `doctor` / `admin`)
- **Secretos:** Google Secret Manager

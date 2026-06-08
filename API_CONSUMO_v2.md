# API FiA — Guía de Consumo

> AI Concierge de Salud "Sana" / FiA — documentación de los endpoints en producción.
> Generado el 2026-06-06. Revisión desplegada: `sana-api-00026-4pv`.
> **Actualización:** Fase 1 del Módulo de Expediente Clínico implementada.

**Base URL:** `https://sana-api-771646345314.us-central1.run.app`

Toda la funcionalidad se expone a través de **4 flujos principales**:

- **Registro de usuario** → REST (`POST /users/register`)
- **Análisis de laboratorio** → REST (`POST /analyze/lab`)
- **Concierge conversacional** → WebSocket (`/ws/chat/...`)
- **Validador de recetas** → SSE streaming (`POST /validate`)

Los flujos de negocio requieren un **JWT** obtenido en `/auth/token` o emitido por `/users/register`.

---

## Índice

1. [Autenticación y roles](#1-autenticación-y-roles)
2. [Flujo 0 — Registro de usuario (CURP + OTP)](#2-flujo-0--registro-de-usuario)
3. [Flujo A — Análisis de laboratorio](#3-flujo-a--análisis-de-laboratorio)
4. [Flujo B — Concierge (chat) vía WebSocket](#4-flujo-b--concierge-chat-vía-websocket)
5. [Flujo C — Validar receta vía SSE](#5-flujo-c--validar-receta-vía-sse-streaming)
6. [Otros endpoints](#6-otros-endpoints)
7. [Resumen rápido](#7-resumen-rápido)
8. [Colecciones Firestore](#8-colecciones-firestore)
9. [Notas de datos y comportamiento](#9-notas-de-datos-y-comportamiento)

---

## 1. Autenticación y roles

### 1.1 Token de desarrollo / pruebas

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

### 1.2 Roles y límites

| Rol | Origen | Rate limit `/analyze/lab` | Rate limit `/validate` | Notas |
|---|---|---|---|---|
| `demo` | OTP 0000 o `/auth/token?role=demo` | 3 req/min | 10 req/min | Perfil demo, datos sintéticos |
| `patient` | `/users/register` verificado | 10 req/min | 10 req/min | Perfil real en Firestore |
| `doctor` | `/auth/token?role=doctor` | 20 req/min | 20 req/min | Acceso ampliado |
| `admin` | `/auth/admin` | Sin límite | Sin límite | Panel de administración |

> **OTP demo 0000:** Para pruebas sin SMS real, ingresar `0000` en el paso de verificación de `/users/register`. El JWT resultante tendrá `role=demo` y el perfil se marca como `is_demo: true` en Firestore con rate limits reducidos.

---

## 2. Flujo 0 — Registro de usuario (CURP + OTP)

Nuevo flujo de dos pasos para activar el Módulo de Expediente Clínico. Vincula el CURP del usuario con un `user_id` en Firestore.

### Paso 1 — Solicitar OTP

```
POST /users/register
Content-Type: application/json
Rate limit: 5/min por IP — sin JWT requerido
```

**Request:**
```json
{
  "step": "request_otp",
  "curp": "GARM850315HDFXXX04",
  "phone": "+525512345678"
}
```

**Respuesta (producción):**
```json
{
  "status": "otp_sent",
  "phone_hint": "••••4821",
  "expires_in": 300
}
```

**Respuesta (MOCK_AI=true — desarrollo):**
```json
{
  "status": "otp_sent",
  "phone_hint": "••••4821",
  "expires_in": 300,
  "debug_otp": "847392"
}
```

> **Nota:** El OTP `0000` siempre es aceptado en cualquier entorno. Produce un perfil `demo` con rate limits reducidos. Usar solo para pruebas.

### Paso 2 — Verificar OTP y registrar

```
POST /users/register
Content-Type: application/json
```

**Request:**
```json
{
  "step": "verify_otp",
  "curp": "GARM850315HDFXXX04",
  "phone": "+525512345678",
  "otp": "847392",
  "sex": "M",
  "dob": "1985-03-15"
}
```

> `sex` y `dob` se derivan del CURP del lado del cliente — no requieren que el usuario los ingrese manualmente.

**Respuesta exitosa:**
```json
{
  "status": "registered",
  "user_id": "usr_a1b2c3d4e5f6",
  "access_token": "eyJ...",
  "role": "patient",
  "is_demo": false,
  "expires_in": 86400
}
```

**Respuesta con OTP 0000 (modo demo):**
```json
{
  "status": "registered",
  "user_id": "usr_demo_xxxx",
  "access_token": "eyJ...",
  "role": "demo",
  "is_demo": true,
  "expires_in": 86400
}
```

**Colecciones escritas en Firestore:**
- `otp_tokens/{phone_hash}` — TTL 5 minutos (requiere política TTL configurada)
- `curp_identity_map/{curp_hash}` — vincula CURP ↔ user_id ↔ phone
- `patient_profiles/{user_id}` — perfil básico creado al registrar

**Errores:**
| Código | Descripción |
|---|---|
| 409 | CURP ya registrado con otro user_id — posible conflicto |
| 422 | OTP incorrecto o expirado (máx 3 intentos antes de expirar) |
| 429 | Rate limit excedido |

---

## 3. Flujo A — Análisis de laboratorio

Nuevo endpoint. Recibe un documento de laboratorio y retorna análisis estructurado del Agente 3.

```
POST /analyze/lab
Authorization: Bearer <JWT>
Content-Type: application/json
Rate limit: 10/min (patient) | 3/min (demo)
```

### Request (`LabAnalysisRequest`)

| Campo | Tipo | Notas |
|---|---|---|
| `input_mode` | string | `"image"` \| `"text"` \| `"manual"` |
| `image_b64` | string | Base64 sin prefijo `data:` — solo modo imagen |
| `lab_text` | string | Texto libre del laboratorio — solo modo texto |
| `manual_values` | object | `{"glucose_fasting": 112, "ldl": 128}` — solo modo manual |
| `user_id` | string | Opcional. Si se omite, el análisis no se persiste en Firestore |
| `session_id` | string | Opcional |
| `platform` | string | Default `"web"` |

### Ejemplo modo imagen

```bash
TOKEN="eyJ..."

curl -X POST "https://sana-api-771646345314.us-central1.run.app/analyze/lab" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "input_mode": "image",
    "image_b64": "<base64 sin prefijo data:>",
    "user_id": "usr_a1b2c3d4e5f6"
  }'
```

### Ejemplo modo manual

```json
{
  "input_mode": "manual",
  "manual_values": {
    "glucose_fasting": 112,
    "ldl": 128,
    "hdl": 54,
    "cholesterol_total": 198
  },
  "user_id": "usr_a1b2c3d4e5f6"
}
```

### Respuesta

```json
{
  "status": "analyzed",
  "doc_id": "doc_a1b2c3_20260606",
  "type": "lipidos",
  "lab_name": "Chopo",
  "study_date": "2026-06-06",
  "owner_name": "ROBERTO GARCIA MENDOZA",
  "name_matched": true,
  "third_party": false,
  "markers": [
    {
      "marker_key": "glucose_fasting",
      "name": "Glucosa en ayunas",
      "value": 112.0,
      "unit": "mg/dL",
      "ref_low": 70.0,
      "ref_high": 100.0,
      "status": "high",
      "source": "ocr",
      "confidence": 0.97
    },
    {
      "marker_key": "ldl",
      "name": "LDL",
      "value": 128.0,
      "unit": "mg/dL",
      "ref_low": null,
      "ref_high": 100.0,
      "status": "high",
      "source": "ocr",
      "confidence": 0.95
    }
  ],
  "ai_analysis": {
    "summary": {
      "total_markers": 9,
      "alert_count": 2,
      "normal_count": 7,
      "cross_pattern": "metabolic_risk",
      "cross_insight": "Tu glucosa y tu perfil lipídico muestran un patrón asociado a mayor riesgo metabólico según la ADA y la AHA.",
      "sources": ["American Diabetes Association", "American Heart Association / ACC 2026"]
    },
    "insights": [
      {
        "marker_key": "glucose_fasting",
        "scenario": "prediabetes",
        "layer1": "Tu glucosa en ayunas está por encima del rango normal.",
        "layer2": "Según la American Diabetes Association (ADA), valores entre 100–125 mg/dL se asocian a prediabetes, una condición que incrementa el riesgo de desarrollar diabetes tipo 2, enfermedades cardíacas y accidentes cerebrovasculares.",
        "source": "American Diabetes Association — diabetes.org",
        "cta_type": "doctor"
      },
      {
        "marker_key": "ldl",
        "scenario": "borderline",
        "layer1": "Tu LDL está en límite. Es el colesterol que puede acumularse en las arterias.",
        "layer2": "Según la guía ACC/AHA 2026, LDL entre 100–129 mg/dL se considera límite alto. La AHA señala que reducir el LDL disminuye el riesgo de infarto y derrame cerebral.",
        "source": "American Heart Association / ACC 2026 — heart.org",
        "cta_type": "doctor_products"
      }
    ]
  }
}
```

**Respuesta duplicado:**
```json
{
  "status": "duplicate",
  "doc_id": "doc_a1b2c3_20260601",
  "message": "Este documento ya fue procesado."
}
```

**Errores:**
| Código | Descripción |
|---|---|
| 401 | JWT inválido o expirado |
| 422 | Formato de request inválido |
| 429 | Rate limit excedido (3/min demo, 10/min patient) |
| 500 | Error en el Agente 3 — el documento puede ser ilegible |

**Colecciones escritas en Firestore (si user_id presente):**
- `lab_documents/{doc_id}` — análisis completo
- `lab_markers_history/{user_id}_{marker_key}` — serie temporal por marcador
- `patient_profiles/{user_id}.lab_summary` — últimos valores de cada marcador

> **Importante:** Los textos de insights provienen del catálogo estático `CATALOGO_INSIGHTS_LABORATORIO.txt`. Requieren validación médica antes de activar en producción.

---

## 4. Flujo B — Concierge (chat) vía WebSocket

Sin cambios en el contrato. Se agregan 3 tools nuevas que el LLM puede invocar automáticamente.

```
WSS /ws/chat/{session_id}?token=<JWT>&platform=web&user_id=<id>
```

| Query param | Obligatorio | Descripción |
|---|---|---|
| `session_id` | sí | UUID generado por el cliente |
| `token` | sí | JWT en query param, no en header |
| `platform` | no | `web` (default), `whatsapp` |
| `user_id` | no | Si se omite, cae a datos demo |

**Mensaje enviado:**
```json
{ "message": "¿Cómo está mi glucosa?" }
```

**Mensajes recibidos:**
```json
{ "type": "typing" }
{ "type": "response", "message": "...", "session_id": "..." }
```

### Tools disponibles del Concierge (9 total)

| # | Tool | Descripción | Nueva |
|---|---|---|---|
| 1 | `validate_prescription` | Valida receta vs carrito | — |
| 2 | `schedule_appointment` | Agenda cita médica | — |
| 3 | `check_pharmacy_availability` | Disponibilidad de medicamentos | — |
| 4 | `get_patient_profile` | Perfil de salud del usuario | — |
| 5 | `get_medication_reminders` | Calendario de medicamentos | — |
| 6 | `get_health_content` | Contenido educativo con RAG | — |
| 7 | `get_lab_insights` | Historial y tendencia de un marcador | ✅ Nuevo |
| 8 | `update_patient_profile` | Actualiza condiciones, alergias, medicamentos | ✅ Nuevo |
| 9 | `get_patient_documents` | Lista documentos de laboratorio del usuario | ✅ Nuevo |

### Tool 7 — get_lab_insights

Invocada cuando el usuario menciona un marcador de laboratorio (glucosa, colesterol, etc.).

**Parámetro:** `marker_key` — clave estandarizada (ej: `"glucose_fasting"`, `"ldl"`, `"hdl"`)

**Retorna:** valor actual, tendencia, insight del catálogo, historial de las últimas 5 lecturas, CTA type.

### Tool 8 — update_patient_profile

Invocada cuando el usuario declara información de salud ("tengo hipertensión", "soy alérgico a la penicilina").

**Parámetros:** `field` (conditions / allergies / active_medications / blood_type / height_cm), `action` (add / remove / set), `value`.

**El LLM confirma con el usuario antes de ejecutar.**

### Tool 9 — get_patient_documents

Invocada cuando el usuario pregunta por sus laboratorios.

**Parámetros:** `doc_type` (opcional: biometria / lipidos / orina / hba1c / tiroides), `limit` (máx 10).

---

## 5. Flujo C — Validar receta vía SSE (streaming)

Sin cambios en el contrato. Cambio interno: el nodo AUDITOR fue eliminado del pipeline.

```
POST /validate
Authorization: Bearer <JWT>
Content-Type: application/json
```

### Flujo actual del Agente 1 (4 nodos — AUDITOR eliminado)

```
START → [INTERCEPTOR] → [EXTRACTOR | TEXT_EXTRACTOR] → [MATCHER] → [RESOLVER] → END
```

> El nodo AUDITOR (validación de cédula SEP/DINARDAP) fue eliminado en Fase 1 por indisponibilidad frecuente de las APIs externas. La validación de formato del CURP sigue activa.

### El token de validación ahora incluye user_id

```json
{
  "token_id": "uuid-...",
  "user_id": "usr_a1b2c3d4e5f6",
  "issued_at": "2026-06-06T...",
  "expires_at": "2026-06-07T...",
  "patient": { "name": "...", "cedula": "..." },
  "doctor": { "name": "...", "license": "..." },
  "approved_substances": [...],
  "recipe_hash": "sha256...",
  "status": "APPROVED"
}
```

El campo `user_id` permite vincular la receta surtida al historial del paciente.

### Request (`ValidateRequest`) — sin cambios

| Campo | Tipo | Notas |
|---|---|---|
| `input_mode` | string | `"image"` (default) o `"text"` |
| `cart` | object | **requerido** |
| `image_b64` | string | solo modo imagen |
| `prescription_text` | string | solo modo texto |
| `use_mock` | bool / null | default false en producción |
| `mock_issue_date` | string | para pruebas |
| `mock_cedula` | string | para pruebas |
| `session_id` | string | opcional |
| `user_id` | string | opcional — se incluye en el token si se provee |
| `platform` | string | default `"web"` |

---

## 6. Otros endpoints

| Método | Ruta | Auth | Para qué |
|---|---|---|---|
| `GET` | `/health` | — | Estado del servicio |
| `GET` | `/` | — | Widget frontend.html |
| `GET` | `/chat/history/{session_id}` | — | Historial de conversación |
| `DELETE` | `/chat/history/{session_id}` | — | Borra conversación |
| `POST` | `/auth/admin` | — | Login admin |
| `GET` | `/admin` | — | Panel HTML de administración |
| `GET` | `/admin/api/stats` | admin | Métricas de uso |
| `GET` | `/admin/api/sessions` | admin | Sesiones activas |
| `GET` / `POST` | `/admin/api/config` | admin | Settings dinámicos |
| `POST` | `/admin/api/killswitch` | admin | Apagar/encender agente |
| `GET` / `POST` | `/webhook/whatsapp` | HMAC Meta | WhatsApp Business |

**Ejemplo `/health` actualizado:**
```json
{
  "status": "ok",
  "project": "gen-lang-client-0389658532",
  "model": "gemini-2.5-flash",
  "mock_ai": false,
  "persistence": "firestore",
  "agent_runtime": "adk",
  "active_sessions": 0,
  "agents": {
    "agent1_recipe_validator": "active",
    "agent2_concierge": "active",
    "agent3_lab_analyzer": "active"
  }
}
```

---

## 7. Resumen rápido

1. **Registro:** `POST /users/register` (paso 1 OTP + paso 2 verificación) → guarda `user_id` y `access_token`.
2. **Análisis de lab:** `POST /analyze/lab` con JWT + documento → análisis completo con insights.
3. **Chat:** WebSocket a `/ws/chat/{sid}?token=…&user_id=…` → FiA con contexto del expediente.
4. **Validación de receta:** `POST /validate` con JWT → SSE hasta evento `done`.

> **Para pruebas sin SMS:** usar OTP `0000` en el paso 2 del registro. Produce perfil `demo` con rate limits reducidos (3 req/min en `/analyze/lab`).

---

## 8. Colecciones Firestore

### Colecciones existentes (modificadas)

| Colección | Cambio |
|---|---|
| `patient_profiles/{user_id}` | **READ-WRITE** habilitado. Campos nuevos: `curp_hash`, `height_cm`, `sex`, `dob`, `lab_summary`, `verified_curp`, `is_demo`, `role` |
| `processed_recipes/{hash}` | Sin cambios |
| `chat_sessions/{session_id}` | Sin cambios |
| `medication_schedules/{user_id}` | Sin cambios (READ-ONLY aún) |
| `appointments/{folio}` | Sin cambios |
| `pharmacies/{name}` | Sin cambios |
| `knowledge_corpus/{doc_id}` | Expandido: +12 documentos de laboratorio |

### Colecciones nuevas (Fase 1)

| Colección | Descripción | TTL |
|---|---|---|
| `otp_tokens/{phone_hash}` | OTPs de registro. Campo: `expires_at` | 5 minutos ⚠️ Requiere política TTL en GCP |
| `curp_identity_map/{curp_hash}` | Vincula CURP hash ↔ user_id ↔ phone | Sin TTL |
| `lab_documents/{doc_id}` | Documentos de laboratorio analizados | Sin TTL |
| `lab_markers_history/{user_id}_{marker_key}` | Serie temporal de valores por marcador | Sin TTL |

> **⚠️ Acción pendiente:** Configurar política TTL en Firestore para `otp_tokens` usando el campo `expires_at`. Sin esto, los tokens expirados se acumulan indefinidamente.

---

## 9. Notas de datos y comportamiento

- **OTP demo:** El código `0000` siempre es aceptado. Produce JWT con `role=demo` e `is_demo=true`. Los perfiles demo tienen rate limits reducidos para proteger el presupuesto de Gemini en pruebas.
- **Catálogo de insights:** Los textos de análisis provienen de `CATALOGO_INSIGHTS_LABORATORIO.txt` con estructura de 3 capas (dato contextualizado / asociaciones con fuente médica / CTA). **Requieren validación del equipo médico antes de activar en producción.**
- **Fuentes médicas del catálogo:** American Diabetes Association (ADA), American Heart Association / ACC 2026, Middlesex Health / Mayo Clinic, Fundación Española del Corazón / JACC. Los rangos de referencia siguen la NOM-007-SSA3-2011.
- **Datos de paciente:** Si el `user_id` existe en `patient_profiles`, las tools del Concierge y el Agente 3 usan datos reales. Si no existe o es demo, usan datos sintéticos.
- **Anti-fraude laboratorio:** El Agente 3 calcula SHA-256 del documento antes de procesar. Si el hash existe en `lab_documents`, retorna `status: "duplicate"`.
- **Documentos de terceros:** Si el nombre extraído del documento no coincide con el perfil del usuario, el campo `third_party: true` se activa. El frontend muestra opciones al usuario (soy yo / es un familiar / me equivoqué).
- **Validación RENAPO:** Pendiente de contrato. Hoy el registro acepta cualquier CURP con formato válido (18 caracteres, estructura correcta).
- **SMS real:** Pendiente de credenciales de negocio (Twilio/MessageBird). Hoy solo funciona OTP demo `0000` o el OTP retornado en `debug_otp` con `MOCK_AI=true`.
- **Agente 1 — AUDITOR eliminado:** El nodo de validación de cédula profesional fue removido. El pipeline ahora es: Interceptor → Extractor → Matcher → Resolver.

---

## Stack de referencia

- **Backend:** FastAPI + Uvicorn sobre Google Cloud Run
- **Agente 1:** LangGraph (4 nodos — AUDITOR eliminado)
- **Agente 2:** Google ADK 1.14.1 + Gemini 2.5 Flash (9 tools)
- **Agente 3:** LangGraph (4 nodos: Parser, Classifier, Analyst, Insight_Generator) ✅ Nuevo
- **Persistencia:** Firestore (9 colecciones — 4 nuevas en Fase 1)
- **Auth:** JWT Bearer HS256 + RBAC (`demo` / `patient` / `doctor` / `admin`)
- **Secretos:** Google Secret Manager
- **Proyecto GCP:** gen-lang-client-0389658532

---

## Pendientes antes de producción completa

| # | Pendiente | Área |
|---|---|---|
| 1 | Validación médica de `CATALOGO_INSIGHTS_LABORATORIO.txt` | Médica |
| 2 | Configurar política TTL en Firestore para `otp_tokens` | Backend / GCP |
| 3 | Integrar SMS real (Twilio/MessageBird) con credenciales de negocio | Negocio + Backend |
| 4 | Migrar perfiles existentes: `python scripts/migrate_patient_profiles.py --apply` | Backend |
| 5 | Configurar `MOCK_AI=false` en producción para activar Gemini real en Agente 3 | DevOps |
| 6 | Rebuild y redeploy imagen Docker con módulo `lab_analyzer/` incluido | DevOps |
| 7 | Configurar validación RENAPO cuando esté disponible el contrato | Negocio + Backend |

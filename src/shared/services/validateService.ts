// ============================================================
// FiA Validate Service — SSE Streaming
//
// Flujo:
//   POST /validate  con  Authorization: Bearer <JWT>
//   Respuesta: Server-Sent Events
//     { "event": "node",  "data": { "node": "...", "data": {...} } }
//     { "event": "done",  "data": {} }
//     { "event": "error", "data": { "message": "..." } }
//
// El veredicto final (APPROVED / REJECTED / FRAUD) llega en el
// nodo "resolver" dentro de data.
// ============================================================

import { BASE_URL, getAuthToken } from './authService';

export interface ValidateRequest {
  input_mode:          'image' | 'text';
  cart:                Record<string, number>;   // { "Amoxicilina": 21 }
  image_b64?:          string;                   // base64 sin prefijo data:
  prescription_text?:  string;
  session_id?:         string;
  user_id?:            string;
  use_mock?:           boolean | null;
}

export interface ValidateNode {
  node: string;
  data: Record<string, unknown>;
}

export type ValidateVerdict = 'APPROVED' | 'REJECTED' | 'FRAUD' | string;

export interface ValidateCallbacks {
  onNode:    (node: ValidateNode) => void;
  onDone:    (verdict: ValidateVerdict, token?: string) => void;
  onError:   (message: string) => void;
}

/**
 * Envía una solicitud de validación de receta y escucha los eventos SSE.
 * Retorna una función para abortar el stream.
 */
export async function validatePrescription(
  request:   ValidateRequest,
  callbacks: ValidateCallbacks,
): Promise<() => void> {
  const jwt        = await getAuthToken('doctor');
  const controller = new AbortController();

  fetch(`${BASE_URL}/validate`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${jwt}`,
    },
    body:   JSON.stringify(request),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const txt = await res.text();
        callbacks.onError(`Error ${res.status}: ${txt}`);
        return;
      }
      if (!res.body) { callbacks.onError('Sin cuerpo de respuesta'); return; }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';          // El último puede estar incompleto

        let eventType = '';
        let dataLine  = '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventType = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLine = line.slice(5).trim();
          } else if (line === '' && eventType) {
            // Línea vacía → evento completo
            try {
              const parsed = JSON.parse(dataLine) as Record<string, unknown>;

              if (eventType === 'node') {
                const nodePayload = parsed as ValidateNode;
                callbacks.onNode(nodePayload);

                // Extraer veredicto del nodo "resolver"
                if (nodePayload.node === 'resolver') {
                  const d       = nodePayload.data as Record<string, unknown>;
                  const verdict = (d.verdict ?? d.status ?? '') as ValidateVerdict;
                  const token   = d.validation_token as string | undefined;
                  callbacks.onDone(verdict, token);
                }
              } else if (eventType === 'done') {
                // done sin resolver (fallback)
                callbacks.onDone('', undefined);
              } else if (eventType === 'error') {
                callbacks.onError((parsed.message as string) ?? 'Error desconocido');
              }
            } catch {
              // JSON inválido, ignorar
            }
            eventType = '';
            dataLine  = '';
          }
        }
      }
    })
    .catch((err: unknown) => {
      if (err instanceof Error && err.name !== 'AbortError') {
        callbacks.onError(err.message);
      }
    });

  return () => controller.abort();
}

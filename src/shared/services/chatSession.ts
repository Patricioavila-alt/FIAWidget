// ============================================================
// FiA Agent Service — WebSocket Chat
//
// Flujo:
//   1. getAuthToken()  →  JWT
//   2. WebSocket  wss://.../ws/chat/{sessionId}?token=JWT&user_id=...
//   3. send({ message: "...", image_b64?: "..." })
//        image_b64: base64 puro o data-URI — ambos aceptados.
//        Se normaliza a base64 puro antes de enviar.
//   4. onmessage:
//        { type: "typing" }   → el agente está escribiendo
//        { type: "response", message: "..." } → respuesta final
//
// El WebSocket se mantiene abierto por sesión.
// Se reconecta automáticamente si se pierde la conexión.
// ============================================================

import { BASE_URL, getAuthToken } from './authService';

const WS_BASE = BASE_URL.replace('https://', 'wss://');

type TypingCallback   = () => void;
type MessageCallback  = (text: string) => void;
type ErrorCallback    = (err: Error) => void;

export interface ChatCallbacks {
  onTyping:   TypingCallback;
  onMessage:  MessageCallback;
  onError:    ErrorCallback;
}

export class FiAChatSession {
  private ws:        WebSocket | null = null;
  private sessionId: string;
  private userId:    string;
  private token:     string           = '';
  private callbacks: ChatCallbacks;
  private closed:    boolean          = false;
  private sendQueue: string[]         = [];

  constructor(sessionId: string, userId: string, callbacks: ChatCallbacks) {
    this.sessionId = sessionId;
    this.userId    = userId;
    this.callbacks = callbacks;
  }

  /** Conecta (o reconecta) el WebSocket. Llama antes del primer send(). */
  async connect(): Promise<void> {
    this.token = await getAuthToken('patient');
    this._openSocket();
  }

  private _openSocket() {
    if (this.closed) return;

    const url = `${WS_BASE}/ws/chat/${this.sessionId}?token=${this.token}&platform=web&user_id=${encodeURIComponent(this.userId)}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      // Enviar mensajes encolados mientras se conectaba
      while (this.sendQueue.length > 0) {
        const msg = this.sendQueue.shift()!;
        this.ws?.send(msg);
      }
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as {
          type: 'typing' | 'response';
          message?: string;
        };

        if (data.type === 'typing') {
          this.callbacks.onTyping();
        } else if (data.type === 'response' && data.message) {
          this.callbacks.onMessage(data.message);
        }
      } catch {
        // Mensaje no-JSON ignorado
      }
    };

    this.ws.onerror = () => {
      this.callbacks.onError(new Error('Error de conexión con el agente FiA'));
    };

    this.ws.onclose = (event) => {
      if (!this.closed && !event.wasClean) {
        // Reconectar tras 2 segundos si el cierre no fue intencional
        setTimeout(() => this._openSocket(), 2000);
      }
    };
  }

  /**
   * Envía un mensaje al agente.
   * @param text       Texto del mensaje (requerido; puede ser cadena vacía si solo se manda imagen).
   * @param image_b64  Imagen en base64 puro o data-URI (data:image/...;base64,...). Opcional.
   */
  send(text: string, image_b64?: string): void {
    // Normalizar: quitar el prefijo data-URI si existe
    const pureB64 = image_b64
      ? image_b64.replace(/^data:[^;]+;base64,/, '')
      : undefined;

    const body: Record<string, string> = { message: text };
    if (pureB64) body.image_b64 = pureB64;

    const payload = JSON.stringify(body);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
    } else {
      // Encolar si el socket aún no está listo
      this.sendQueue.push(payload);
    }
  }

  /** Cierra la conexión permanentemente. */
  close(): void {
    this.closed = true;
    this.ws?.close(1000, 'Session ended');
    this.ws = null;
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// ============================================================
// History Service — carga historial desde la API FiA
// GET /chat/history/{session_id}  (sin auth)
//
// Formato de respuesta esperado:
// { messages: [{ role, content, timestamp }] }
// ============================================================

import { BASE_URL } from './authService';
import type { Message } from '@/shared/types';
import { nanoid } from 'nanoid';

interface ApiHistoryMessage {
  role:      'user' | 'assistant' | 'model';   // "model" = alias de assistant en Gemini
  content:   string;
  timestamp?: string;
}

interface ApiHistoryResponse {
  session_id: string;
  messages:   ApiHistoryMessage[];
}

/**
 * Carga el historial de una sesión desde el servidor.
 * Retorna un array de Message listo para hidratar el store.
 * Si falla (sesión no existe, red, etc.) retorna [].
 */
export async function fetchSessionHistory(sessionId: string): Promise<Message[]> {
  try {
    const res = await fetch(`${BASE_URL}/chat/history/${encodeURIComponent(sessionId)}`);
    if (!res.ok) return [];

    const data = (await res.json()) as ApiHistoryResponse;
    const raw  = data.messages ?? [];

    return raw.map((m): Message => ({
      id:        nanoid(),
      role:      m.role === 'model' ? 'assistant' : m.role,
      parts:     [{ type: 'text', text: m.content }],
      timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
    }));
  } catch {
    // Red caída o formato inesperado — no bloquear la UI
    return [];
  }
}

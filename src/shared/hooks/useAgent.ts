// ============================================================
// useAgent — hook principal del chat con FiA
//
// Gestiona:
//   - Ciclo de vida del WebSocket (FiAChatSession)
//   - Añadir mensajes al store (usuario + agente)
//   - Indicador de typing mientras el agente responde
//   - Auto-título de la sesión
//   - Soporte de imágenes: se convierten a descripción de texto
//     (el WS sólo acepta texto; las imágenes se envían al
//      validador POST /validate por separado)
// ============================================================

import { useCallback, useEffect, useRef } from 'react';
import { useChatStore } from '@/shared/stores/chatStore';
import { useAuthStore }  from '@/shared/stores/authStore';
import { FiAChatSession } from '@/shared/services/chatSession';
import type { MessagePart } from '@/shared/types';

export function useAgent() {
  const { user }           = useAuthStore();
  const {
    activeSession,
    activeSessionId,
    addMessage,
    updateSessionTitle,
    setAgentTyping,
  } = useChatStore();

  // Un FiAChatSession por sesión activa
  const sessionRef = useRef<FiAChatSession | null>(null);
  const lastSidRef = useRef<string | null>(null);

  // ── Abre / reconecta el WebSocket cuando cambia la sesión activa ──
  useEffect(() => {
    if (!activeSessionId || !user) return;
    if (lastSidRef.current === activeSessionId) return;   // ya conectado

    // Cerrar conexión anterior
    sessionRef.current?.close();

    const fiaSess = new FiAChatSession(activeSessionId, user.uid, {
      onTyping: () => {
        setAgentTyping(true);
      },
      onMessage: (text) => {
        setAgentTyping(false);
        addMessage(activeSessionId, {
          role:  'assistant',
          parts: [{ type: 'text', text }],
        });
      },
      onError: (err) => {
        setAgentTyping(false);
        addMessage(activeSessionId, {
          role:  'assistant',
          parts: [{ type: 'text', text: `⚠️ ${err.message}` }],
        });
      },
    });

    fiaSess.connect().catch((err: Error) => {
      addMessage(activeSessionId, {
        role:  'assistant',
        parts: [{ type: 'text', text: `⚠️ No se pudo conectar: ${err.message}` }],
      });
    });

    sessionRef.current = fiaSess;
    lastSidRef.current = activeSessionId;

    return () => {
      fiaSess.close();
      sessionRef.current = null;
      lastSidRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId, user]);

  // ── Enviar mensaje ──────────────────────────────────────────
  const send = useCallback(
    async (parts: MessagePart[]) => {
      if (!user || !activeSessionId) return;
      const session = activeSession();
      if (!session) return;

      // Añadir mensaje del usuario al store
      addMessage(activeSessionId, { role: 'user', parts });

      // Auto-título de la sesión con el primer texto
      if (session.messages.length === 0) {
        const firstText = parts.find((p) => p.type === 'text');
        if (firstText?.type === 'text') {
          updateSessionTitle(
            activeSessionId,
            firstText.text.slice(0, 50) + (firstText.text.length > 50 ? '…' : ''),
          );
        }
      }

      // Construir el texto a enviar al WebSocket
      // Las imágenes se mencionan como contexto textual
      const textParts   = parts.filter((p) => p.type === 'text').map((p) => (p as { type: 'text'; text: string }).text);
      const imageParts  = parts.filter((p) => p.type === 'image');
      const imageNote   = imageParts.length > 0
        ? `[El usuario adjuntó ${imageParts.length} imagen${imageParts.length > 1 ? 's' : ''}]`
        : '';

      const fullText = [imageNote, ...textParts].filter(Boolean).join('\n').trim();

      if (!fullText) return;

      // Asegurarse de que el WS esté conectado
      if (!sessionRef.current?.isConnected) {
        try {
          await sessionRef.current?.connect();
        } catch (err) {
          addMessage(activeSessionId, {
            role:  'assistant',
            parts: [{ type: 'text', text: `⚠️ Sin conexión con el agente` }],
          });
          return;
        }
      }

      sessionRef.current?.send(fullText);
    },
    [user, activeSessionId, activeSession, addMessage, updateSessionTitle],
  );

  // ── Abortar (cierra el WS, el agente dejará de responder) ──
  const abort = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    lastSidRef.current = null;
    setAgentTyping(false);
  }, [setAgentTyping]);

  return { send, abort };
}

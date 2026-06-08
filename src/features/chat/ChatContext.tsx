// ============================================================
// Chat Context — expone send/abort/isTyping a toda la UI
// Resuelve el problema de UserPanel que necesita send()
// sin pasar props a través de múltiples niveles.
// ============================================================

import React, { createContext, useContext, useCallback, useRef, useEffect } from 'react';
import { useChatStore }    from '@/shared/stores/chatStore';
import { useAuthStore }    from '@/shared/stores/authStore';
import { FiAChatSession }  from '@/shared/services/chatSession';
import type { MessagePart } from '@/shared/types';

interface ChatContextValue {
  send:       (parts: MessagePart[]) => Promise<void>;
  abort:      () => void;
  isTyping:   boolean;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export const useChatContext = (): ChatContextValue => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used inside ChatProvider');
  return ctx;
};

interface ChatProviderProps {
  children: React.ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const { user }         = useAuthStore();
  const {
    activeSession,
    activeSessionId,
    addMessage,
    updateSessionTitle,
    setAgentTyping,
    isAgentTyping,
  } = useChatStore();

  const sessionRef  = useRef<FiAChatSession | null>(null);
  const lastSidRef  = useRef<string | null>(null);
  const abortedRef  = useRef(false);          // flag para saber si abort fue manual

  // ── Gestión del WebSocket por sesión activa ────────────────
  useEffect(() => {
    if (!activeSessionId || !user) return;
    if (lastSidRef.current === activeSessionId) return;

    // Limpiar la sesión anterior
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    setAgentTyping(false);   // ← FIX Error 4: limpia typing al cambiar sesión
    abortedRef.current = false;

    const fiaSess = new FiAChatSession(activeSessionId, user.uid, {
      onTyping: () => {
        if (!abortedRef.current) setAgentTyping(true);
      },
      onMessage: (text) => {
        setAgentTyping(false);
        abortedRef.current = false;
        addMessage(activeSessionId, {
          role:  'assistant',
          parts: [{ type: 'text', text }],
        });
      },
      onError: (err) => {
        setAgentTyping(false);
        if (!abortedRef.current) {
          addMessage(activeSessionId, {
            role:  'assistant',
            parts: [{ type: 'text', text: `⚠️ ${err.message}` }],
          });
        }
      },
    }, {
      userName:     user.name ?? '',
      isNewSession: (activeSession()?.messages.length ?? 0) === 0,
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
      setAgentTyping(false);   // cleanup al desmontar
    };
  }, [activeSessionId, user, addMessage, setAgentTyping]);

  // ── Send ────────────────────────────────────────────────────
  const send = useCallback(async (parts: MessagePart[]) => {
    if (!user || !activeSessionId) return;
    const session = activeSession();
    if (!session) return;

    abortedRef.current = false;

    // Añadir al store
    addMessage(activeSessionId, { role: 'user', parts });

    // Auto-título
    if (session.messages.length === 0) {
      const firstText = parts.find((p) => p.type === 'text');
      const titleSrc = firstText?.type === 'text' ? firstText.text : '📷 Imagen adjunta';
      updateSessionTitle(
        activeSessionId,
        titleSrc.slice(0, 50) + (titleSrc.length > 50 ? '\u2026' : ''),
      );
    }

    // ── Extraer partes ────────────────────────────────────────
    const textParts  = parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text);

    const imageParts = parts
      .filter((p): p is { type: 'image'; mimeType: string; data: string; previewUrl?: string } => p.type === 'image');

    const fullText = textParts.join('\n').trim();

    // Necesitamos al menos texto o imagen para enviar
    if (!fullText && imageParts.length === 0) return;

    // Solo usamos la primera imagen (el API acepta una por mensaje)
    const firstImage = imageParts[0];
    // data puede venir como base64 puro o data-URI — el WS lo acepta ambos
    // chatSession.send() normaliza internamente
    const image_b64 = firstImage?.data ?? undefined;

    // Re-conectar si fue abortado anteriormente o WS cerrado
    if (!sessionRef.current?.isConnected) {
      const fiaSess = new FiAChatSession(activeSessionId, user.uid, {
        onTyping: () => {
          if (!abortedRef.current) setAgentTyping(true);
        },
        onMessage: (text) => {
          setAgentTyping(false);
          abortedRef.current = false;
          addMessage(activeSessionId, {
            role:  'assistant',
            parts: [{ type: 'text', text }],
          });
        },
        onError: (err) => {
          setAgentTyping(false);
          if (!abortedRef.current) {
            addMessage(activeSessionId, {
              role:  'assistant',
              parts: [{ type: 'text', text: `⚠️ ${err.message}` }],
            });
          }
        },
      }, {
        userName:     user.name ?? '',
        isNewSession: false, // Reconexión: el agente ya conoce el contexto
      });
      try {
        await fiaSess.connect();
        sessionRef.current = fiaSess;
      } catch (err) {
        addMessage(activeSessionId, {
          role:  'assistant',
          parts: [{ type: 'text', text: '⚠️ Sin conexión con el agente. Intenta de nuevo.' }],
        });
        return;
      }
    }

    sessionRef.current?.send(fullText, image_b64);
  }, [user, activeSessionId, activeSession, addMessage, updateSessionTitle, setAgentTyping]);

  // ── Abort ────────────────────────────────────────────────────
  // FIX Error 2: cierra WS limpiamente sin congelar el chat
  const abort = useCallback(() => {
    abortedRef.current = true;
    setAgentTyping(false);
    // Cierra la conexión actual pero NO limpia lastSidRef
    // para que se pueda reconectar en el próximo send()
    sessionRef.current?.close();
    sessionRef.current = null;
    // Importante: NO limpiar lastSidRef aquí para que el useEffect
    // no intente reconectar automáticamente
  }, [setAgentTyping]);

  return (
    <ChatContext.Provider value={{ send, abort, isTyping: isAgentTyping }}>
      {children}
    </ChatContext.Provider>
  );
};

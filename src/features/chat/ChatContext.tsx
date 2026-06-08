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

  const sessionsMapRef = useRef<Record<string, FiAChatSession>>({});
  const abortedRef  = useRef(false);          // flag para saber si abort fue manual

  const getOrCreateSession = useCallback((sid: string) => {
    if (!user) return null;
    let sess = sessionsMapRef.current[sid];
    if (sess) {
      if (!sess.isConnected) {
        sess.connect().catch(() => {});
      }
      return sess;
    }

    const fiaSess = new FiAChatSession(sid, user.uid, {
      onTyping: () => {
        if (useChatStore.getState().activeSessionId === sid && !abortedRef.current) {
          setAgentTyping(true);
        }
      },
      onMessage: (text) => {
        if (useChatStore.getState().activeSessionId === sid) {
          setAgentTyping(false);
        }
        abortedRef.current = false;
        addMessage(sid, {
          role:  'assistant',
          parts: [{ type: 'text', text }],
        });
      },
      onError: (err) => {
        if (useChatStore.getState().activeSessionId === sid) {
          setAgentTyping(false);
        }
        if (!abortedRef.current) {
          addMessage(sid, {
            role:  'assistant',
            parts: [{ type: 'text', text: `⚠️ ${err.message}` }],
          });
        }
      },
    }, {
      userName:     user.name ?? '',
      isNewSession: (useChatStore.getState().sessions.find(s => s.id === sid)?.messages.length ?? 0) === 0,
    });

    fiaSess.connect().catch((err: Error) => {
      addMessage(sid, {
        role:  'assistant',
        parts: [{ type: 'text', text: `⚠️ No se pudo conectar: ${err.message}` }],
      });
    });

    sessionsMapRef.current[sid] = fiaSess;
    return fiaSess;
  }, [user, addMessage, setAgentTyping]);

  // ── Gestión del WebSocket por sesión activa ────────────────
  useEffect(() => {
    if (!activeSessionId || !user) return;

    // Al cambiar de sesión, aseguramos que la nueva tenga su conexión iniciada
    setAgentTyping(false);
    abortedRef.current = false;
    getOrCreateSession(activeSessionId);
  }, [activeSessionId, user, getOrCreateSession, setAgentTyping]);

  // Cerrar todas las conexiones en background al desmontar
  useEffect(() => {
    return () => {
      Object.values(sessionsMapRef.current).forEach((sess) => sess.close());
      sessionsMapRef.current = {};
    };
  }, []);

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

    const firstImage = imageParts[0];
    const image_b64 = firstImage?.data ?? undefined;

    const sess = getOrCreateSession(activeSessionId);
    sess?.send(fullText, image_b64);
  }, [user, activeSessionId, activeSession, addMessage, updateSessionTitle, getOrCreateSession]);

  // ── Abort ────────────────────────────────────────────────────
  const abort = useCallback(() => {
    if (!activeSessionId) return;
    abortedRef.current = true;
    setAgentTyping(false);

    const sess = sessionsMapRef.current[activeSessionId];
    if (sess) {
      sess.close();
      delete sessionsMapRef.current[activeSessionId];
    }
  }, [activeSessionId, setAgentTyping]);

  return (
    <ChatContext.Provider value={{ send, abort, isTyping: isAgentTyping }}>
      {children}
    </ChatContext.Provider>
  );
};

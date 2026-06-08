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
      if (firstText?.type === 'text') {
        updateSessionTitle(
          activeSessionId,
          firstText.text.slice(0, 50) + (firstText.text.length > 50 ? '…' : ''),
        );
      }
    }

    // Construir texto para el WS
    const textParts  = parts.filter((p) => p.type === 'text').map((p) => (p as { type: 'text'; text: string }).text);
    const imageParts = parts.filter((p) => p.type === 'image');
    const imageNote  = imageParts.length > 0
      ? `[El usuario adjuntó ${imageParts.length} imagen${imageParts.length > 1 ? 's' : ''}]`
      : '';

    const fullText = [imageNote, ...textParts].filter(Boolean).join('\n').trim();
    if (!fullText) return;

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

    sessionRef.current?.send(fullText);
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

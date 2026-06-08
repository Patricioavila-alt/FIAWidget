import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Message, ChatSession } from '@/shared/types';
import { nanoid } from 'nanoid';

interface ChatState {
  sessions:        ChatSession[];
  activeSessionId: string | null;
  isAgentTyping:   boolean;
  editingText:     string | null;

  // Selectors
  activeSession: () => ChatSession | undefined;

  // Actions
  createSession:      (userId: string) => string;
  setActiveSession:   (id: string) => void;
  addMessage:         (sessionId: string, message: Omit<Message, 'id' | 'timestamp'>) => string;
  updateMessage:      (sessionId: string, messageId: string, patch: Partial<Message>) => void;
  appendToMessage:    (sessionId: string, messageId: string, token: string) => void;
  updateSessionTitle: (sessionId: string, title: string) => void;
  setAgentTyping:     (typing: boolean) => void;
  setEditingText:     (text: string | null) => void;
  deleteSession:      (sessionId: string) => void;
  hydrateSession:     (sessionId: string, messages: Message[]) => void;
  clearTypingOnSwitch: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessions:        [],
      activeSessionId: null,
      isAgentTyping:   false,
      editingText:     null,

      activeSession: () => {
        const { sessions, activeSessionId } = get();
        return sessions.find((s) => s.id === activeSessionId);
      },

      createSession: (userId) => {
        const id: string = nanoid();
        const now = new Date();
        const session: ChatSession = {
          id,
          userId,
          title:     'Nueva conversación',
          messages:  [],
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          sessions:        [session, ...state.sessions],
          activeSessionId: id,
        }));
        return id;
      },

      setActiveSession: (id) => {
        // Limpiar typing indicator al cambiar de sesión
        set({ activeSessionId: id, isAgentTyping: false });
      },

      addMessage: (sessionId, msg) => {
        const id: string = nanoid();
        const message: Message = { ...msg, id, timestamp: new Date() };
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, messages: [...s.messages, message], updatedAt: new Date() }
              : s,
          ),
        }));
        return id;
      },

      updateMessage: (sessionId, messageId, patch) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === messageId ? { ...m, ...patch } : m,
                  ),
                }
              : s,
          ),
        }));
      },

      appendToMessage: (sessionId, messageId, token) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) => {
                    if (m.id !== messageId) return m;
                    const parts = m.parts.map((p, i) =>
                      i === m.parts.length - 1 && p.type === 'text'
                        ? { ...p, text: p.text + token }
                        : p,
                    );
                    return { ...m, parts };
                  }),
                }
              : s,
          ),
        }));
      },

      updateSessionTitle: (sessionId, title) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, title } : s,
          ),
        }));
      },

      setAgentTyping: (typing) => set({ isAgentTyping: typing }),

      setEditingText: (text) => set({ editingText: text }),

      clearTypingOnSwitch: () => set({ isAgentTyping: false }),

      deleteSession: (sessionId) => {
        set((state) => {
          const sessions = state.sessions.filter((s) => s.id !== sessionId);
          return {
            sessions,
            activeSessionId:
              state.activeSessionId === sessionId
                ? (sessions[0]?.id ?? null)
                : state.activeSessionId,
          };
        });
      },

      // Hidrata mensajes desde el servidor sin duplicar
      hydrateSession: (sessionId, messages) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId && s.messages.length === 0
              ? { ...s, messages, updatedAt: new Date() }
              : s,
          ),
        }));
      },
    }),
    {
      name:    'fia-chat-store',    // clave en localStorage
      partialize: (state) => ({
        sessions:        state.sessions,
        activeSessionId: state.activeSessionId,
        // No persistimos isAgentTyping — siempre arranca en false
      }),
      // Deserializar fechas correctamente (localStorage guarda strings)
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.sessions = state.sessions.map((s) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
          messages:  s.messages.map((m) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })),
        }));
      },
    },
  ),
);

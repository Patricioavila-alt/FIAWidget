import { useCallback, useRef } from 'react';
import { useChatStore } from '@/shared/stores/chatStore';
import { useAuthStore } from '@/shared/stores/authStore';
import {
  sendToAgent,
  sendToAgentStreaming,
  supportsStreaming,
} from '@/shared/services/agentService';
import type { MessagePart } from '@/shared/types';

export function useAgent() {
  const { user } = useAuthStore();
  const {
    activeSession,
    activeSessionId,
    addMessage,
    updateMessage,
    appendToMessage,
    updateSessionTitle,
    setAgentTyping,
  } = useChatStore();

  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (parts: MessagePart[]) => {
      if (!user || !activeSessionId) return;
      const session = activeSession();
      if (!session) return;

      // Add user message
      addMessage(activeSessionId, { role: 'user', parts });

      // Auto-title the session from first message
      if (session.messages.length === 0) {
        const firstText = parts.find((p) => p.type === 'text');
        if (firstText && firstText.type === 'text') {
          const title = firstText.text.slice(0, 50) + (firstText.text.length > 50 ? '…' : '');
          updateSessionTitle(activeSessionId, title);
        }
      }

      setAgentTyping(true);

      // Build history for the API
      const history = session.messages.map((m) => ({
        role: m.role,
        content: m.parts
          .filter((p) => p.type === 'text')
          .map((p) => (p.type === 'text' ? p.text : ''))
          .join('\n'),
      }));

      try {
        if (supportsStreaming) {
          // Add empty assistant message to stream into
          const msgId = addMessage(activeSessionId, {
            role: 'assistant',
            parts: [{ type: 'text', text: '' }],
            isStreaming: true,
          });

          abortRef.current = new AbortController();

          for await (const token of sendToAgentStreaming({
            sessionId: activeSessionId,
            userId: user.uid,
            userName: user.name,
            history,
            message: parts,
          })) {
            appendToMessage(activeSessionId, msgId, token);
          }

          updateMessage(activeSessionId, msgId, { isStreaming: false });
        } else {
          // Standard single response
          const response = await sendToAgent({
            sessionId: activeSessionId,
            userId: user.uid,
            userName: user.name,
            history,
            message: parts,
          });

          addMessage(activeSessionId, {
            role: 'assistant',
            parts: [{ type: 'text', text: response.text }],
          });
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Error al conectar con el agente';
        addMessage(activeSessionId, {
          role: 'assistant',
          parts: [{ type: 'text', text: `⚠️ ${errorMsg}` }],
        });
      } finally {
        setAgentTyping(false);
      }
    },
    [
      user,
      activeSessionId,
      activeSession,
      addMessage,
      appendToMessage,
      updateMessage,
      updateSessionTitle,
      setAgentTyping,
    ],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
    setAgentTyping(false);
  }, [setAgentTyping]);

  return { send, abort };
}

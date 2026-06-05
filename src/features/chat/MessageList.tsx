import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useChatStore } from '@/shared/stores/chatStore';
import { useAuthStore } from '@/shared/stores/authStore';
import { Avatar, MessageRenderer } from '@/shared/components';
import type { Message } from '@/shared/types';
import './MessageList.css';

const TypingIndicator: React.FC = () => (
  <motion.div
    className="message message--agent"
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
  >
    <Avatar name="Agent" isAgent size="sm" />
    <div className="message__bubble message__bubble--agent">
      <div className="typing-indicator">
        <span /><span /><span />
      </div>
    </div>
  </motion.div>
);

const MessageBubble: React.FC<{ message: Message; isUser: boolean; userName: string }> = ({
  message,
  isUser,
  userName,
}) => {
  const textParts  = message.parts.filter((p) => p.type === 'text');
  const imageParts = message.parts.filter((p) => p.type === 'image');
  const fullText   = textParts.map((p) => (p.type === 'text' ? p.text : '')).join('\n');

  return (
    <motion.div
      className={`message ${isUser ? 'message--user' : 'message--agent'}`}
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25 }}
    >
      {!isUser && <Avatar name="Agent" isAgent size="sm" />}

      <div className={`message__bubble ${isUser ? 'message__bubble--user' : 'message__bubble--agent'}`}>
        {/* Image attachments */}
        {imageParts.map((p, i) =>
          p.type === 'image' ? (
            <img
              key={i}
              src={p.previewUrl ?? `data:${p.mimeType};base64,${p.data}`}
              alt="Imagen adjunta"
              className="message__image"
            />
          ) : null,
        )}

        {/* Text content */}
        {fullText && (
          isUser ? (
            <p className="message__user-text">{fullText}</p>
          ) : (
            <MessageRenderer content={fullText} isStreaming={message.isStreaming} />
          )
        )}

        <time className="message__time">
          {message.timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
        </time>
      </div>

      {isUser && <Avatar name={userName} size="sm" />}
    </motion.div>
  );
};

export const MessageList: React.FC = () => {
  const { activeSession, isAgentTyping } = useChatStore();
  const { user } = useAuthStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  const session  = activeSession();
  const messages = session?.messages ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isAgentTyping]);

  if (messages.length === 0) {
    return (
      <div className="message-list message-list--empty">
        <motion.div
          className="message-list__empty-state"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="message-list__empty-icon">🤖</div>
          <h2 className="message-list__empty-title">¡Hola, {user?.name?.split(' ')[0] ?? 'amigo'}!</h2>
          <p className="message-list__empty-subtitle">
            Puedo ayudarte con texto e imágenes.<br />¿Por dónde empezamos?
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="message-list" role="log" aria-label="Conversación">
      <AnimatePresence initial={false}>
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isUser={msg.role === 'user'}
            userName={user?.name ?? 'Tú'}
          />
        ))}
        {isAgentTyping && <TypingIndicator key="typing" />}
      </AnimatePresence>
      <div ref={bottomRef} />
    </div>
  );
};

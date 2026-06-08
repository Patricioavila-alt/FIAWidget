import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore }   from '@/shared/stores/chatStore';
import { useAuthStore }   from '@/shared/stores/authStore';
import { ChatProvider }   from './ChatContext';          // ← provee send/abort/isTyping
import { SessionList }    from '@/features/sessions/SessionList';
import { MessageList }    from './MessageList';
import { MessageInput }   from './MessageInput';
import { UserPanel }      from '@/features/user/UserPanel';
import './ChatPage.css';

export const ChatPage: React.FC = () => {
  const { user }                           = useAuthStore();
  const { createSession, activeSessionId } = useChatStore();

  const [leftOpen,  setLeftOpen]  = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  // Crear sesión inicial si no existe
  React.useEffect(() => {
    if (!activeSessionId && user) {
      createSession(user.uid);
    }
  }, [activeSessionId, user, createSession]);

  return (
    // ChatProvider envuelve toda la UI de chat para que
    // UserPanel, MessageInput y MessageList compartan
    // el mismo WebSocket y estado de typing
    <ChatProvider>
      <div className="chat-page">
        {/* Header */}
        <header className="chat-header glass">
          <button
            id="toggle-sessions"
            className="chat-header__menu-btn"
            onClick={() => setLeftOpen((o) => !o)}
            aria-label="Ver sesiones"
          >
            ☰
          </button>

          <div className="chat-header__brand">
            <span className="chat-header__icon">🤖</span>
            <span className="chat-header__title gradient-text">Agente IA</span>
          </div>

          <button
            id="toggle-user-panel"
            className="chat-header__user-btn"
            onClick={() => setRightOpen((o) => !o)}
            aria-label="Ver perfil"
          >
            <div className="chat-header__avatar">
              {user?.name?.charAt(0).toUpperCase() ?? '?'}
            </div>
          </button>
        </header>

        {/* Main layout */}
        <div className="chat-layout">
          {/* LEFT — Sessions */}
          <aside className={`chat-sidebar chat-sidebar--left ${leftOpen ? 'chat-sidebar--open' : ''}`}>
            <SessionList onClose={() => setLeftOpen(false)} />
          </aside>

          {/* Mobile overlay — FIX: clic afuera cierra paneles */}
          <AnimatePresence>
            {(leftOpen || rightOpen) && (
              <motion.div
                className="chat-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => { setLeftOpen(false); setRightOpen(false); }}
              />
            )}
          </AnimatePresence>

          {/* CENTER — Chat */}
          <main className="chat-main">
            <MessageList />
            <MessageInput />
          </main>

          {/* RIGHT — User + Capabilities */}
          <aside className={`chat-sidebar chat-sidebar--right ${rightOpen ? 'chat-sidebar--open' : ''}`}>
            <UserPanel onClose={() => setRightOpen(false)} />
          </aside>
        </div>
      </div>
    </ChatProvider>
  );
};

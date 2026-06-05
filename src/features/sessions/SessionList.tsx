import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from '@/shared/stores/chatStore';
import { useAuthStore } from '@/shared/stores/authStore';
import './SessionList.css';

interface SessionListProps {
  onClose?: () => void;
}

export const SessionList: React.FC<SessionListProps> = ({ onClose }) => {
  const { user } = useAuthStore();
  const {
    sessions,
    activeSessionId,
    setActiveSession,
    createSession,
    deleteSession,
  } = useChatStore();

  const handleNew = () => {
    if (user) {
      createSession(user.uid);
      onClose?.();
    }
  };

  const handleSelect = (id: string) => {
    setActiveSession(id);
    onClose?.();
  };

  const groupByDate = () => {
    const today     = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const groups: Record<string, typeof sessions> = {};
    sessions.forEach((s) => {
      const d = new Date(s.createdAt).toDateString();
      const label =
        d === today     ? 'Hoy' :
        d === yesterday ? 'Ayer' :
        new Date(s.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
      (groups[label] ??= []).push(s);
    });
    return groups;
  };

  const groups = groupByDate();

  return (
    <div className="session-list">
      {/* Header */}
      <div className="session-list__header">
        <span className="session-list__title">Conversaciones</span>
        <button
          id="new-session-btn"
          className="session-list__new-btn"
          onClick={handleNew}
          title="Nueva conversación"
          aria-label="Nueva conversación"
        >
          ✏️
        </button>
      </div>

      {/* List */}
      <div className="session-list__body">
        {sessions.length === 0 ? (
          <p className="session-list__empty">No hay conversaciones aún</p>
        ) : (
          Object.entries(groups).map(([label, items]) => (
            <div key={label} className="session-group">
              <span className="session-group__label">{label}</span>
              <AnimatePresence initial={false}>
                {items.map((session) => (
                  <motion.div
                    key={session.id}
                    className={`session-item ${session.id === activeSessionId ? 'session-item--active' : ''}`}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12, height: 0, marginBottom: 0 }}
                    onClick={() => handleSelect(session.id)}
                    layout
                  >
                    <div className="session-item__icon">💬</div>
                    <div className="session-item__content">
                      <span className="session-item__title">{session.title}</span>
                      <span className="session-item__meta">
                        {session.messages.length} mensajes
                      </span>
                    </div>
                    <button
                      className="session-item__delete"
                      onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
                      aria-label="Eliminar sesión"
                      title="Eliminar"
                    >
                      🗑
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

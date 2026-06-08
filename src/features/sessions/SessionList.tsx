import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore }         from '@/shared/stores/chatStore';
import { useAuthStore }          from '@/shared/stores/authStore';
import { fetchSessionHistory }   from '@/shared/services/historyService';
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
    hydrateSession,
  } = useChatStore();

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleNew = () => {
    if (user) {
      createSession(user.uid);
      onClose?.();
    }
  };

  // FIX Error 3: carga historial del servidor al seleccionar sesión
  const handleSelect = async (id: string) => {
    setActiveSession(id);
    onClose?.();

    // Si la sesión está vacía localmente, intentar cargar desde el servidor
    const session = sessions.find((s) => s.id === id);
    if (session && session.messages.length === 0) {
      setLoadingId(id);
      try {
        const messages = await fetchSessionHistory(id);
        if (messages.length > 0) {
          hydrateSession(id, messages);
        }
      } finally {
        setLoadingId(null);
      }
    }
  };

  // FIX Error 5: confirmación antes de borrar
  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const confirmDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteSession(id);
    setDeleteConfirmId(null);
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(null);
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
        <div className="session-list__actions" style={{ display: 'flex', gap: '6px' }}>
          <button
            id="new-session-btn"
            className="session-list__new-btn"
            onClick={handleNew}
            title="Nueva conversación"
            aria-label="Nueva conversación"
          >
            ✏️
          </button>
          {onClose && (
            <button
              className="session-list__close-btn"
              onClick={onClose}
              title="Cerrar panel"
              aria-label="Cerrar panel"
            >
              ✕
            </button>
          )}
        </div>
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
                    onClick={() => void handleSelect(session.id)}
                    layout
                  >
                    <div className="session-item__icon">
                      {loadingId === session.id ? (
                        <span className="session-item__spinner" />
                      ) : '💬'}
                    </div>
                    <div className="session-item__content">
                      <span className="session-item__title">{session.title}</span>
                      <span className="session-item__meta">
                        {session.messages.length} mensajes
                      </span>
                    </div>

                    {/* Confirm delete */}
                    {deleteConfirmId === session.id ? (
                      <div className="session-item__confirm" onClick={(e) => e.stopPropagation()}>
                        <button className="session-item__confirm-yes" onClick={(e) => confirmDelete(e, session.id)}>Sí</button>
                        <button className="session-item__confirm-no"  onClick={cancelDelete}>No</button>
                      </div>
                    ) : (
                      <button
                        className="session-item__delete"
                        onClick={(e) => handleDeleteClick(e, session.id)}
                        aria-label="Eliminar sesión"
                        title="Eliminar"
                      >
                        🗑
                      </button>
                    )}
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

import React from 'react';
import { useNavigate }    from 'react-router-dom';
import { motion }         from 'framer-motion';
import { useAuthStore }   from '@/shared/stores/authStore';
import { useChatStore }   from '@/shared/stores/chatStore';
import { useChatContext } from '@/features/chat/ChatContext';   // ← FIX Error 1
import { Avatar }         from '@/shared/components';
import type { Capability } from '@/shared/types';
import './UserPanel.css';

const CAPABILITIES: Capability[] = [
  {
    id:          'diagnose',
    icon:        '🩺',
    title:       'Diagnóstico',
    description: 'Describe tus síntomas y recibe orientación',
    prompt:      'Quiero describir mis síntomas para recibir orientación médica.',
  },
  {
    id:          'appointment',
    icon:        '📅',
    title:       'Agendar cita',
    description: 'Solicita una cita médica',
    prompt:      'Quiero agendar una cita médica.',
  },
  {
    id:          'medication',
    icon:        '💊',
    title:       'Medicamentos',
    description: 'Información sobre tu medicación',
    prompt:      'Necesito información sobre mis medicamentos.',
  },
  {
    id:          'history',
    icon:        '📋',
    title:       'Historial',
    description: 'Consulta tu historial clínico',
    prompt:      'Quiero ver mi historial clínico.',
  },
  {
    id:          'nutrition',
    icon:        '🥗',
    title:       'Nutrición',
    description: 'Consejos de alimentación saludable',
    prompt:      'Dame consejos de nutrición y alimentación saludable.',
  },
  {
    id:          'faq',
    icon:        '❓',
    title:       'Preguntas frecuentes',
    description: 'Resuelve tus dudas comunes',
    prompt:      '¿Cuáles son las preguntas frecuentes que puedes resolver?',
  },
];

interface UserPanelProps {
  onClose?: () => void;
}

export const UserPanel: React.FC<UserPanelProps> = ({ onClose }) => {
  const navigate              = useNavigate();
  const { user, clearUser }   = useAuthStore();
  const { createSession, activeSessionId } = useChatStore();
  const { send }              = useChatContext();

  const [showSignOutConfirm, setShowSignOutConfirm] = React.useState(false);
  const [darkMode, setDarkMode] = React.useState(() => {
    return document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark';
  });

  const toggleDarkMode = () => {
    const nextMode = !darkMode;
    setDarkMode(nextMode);
    if (nextMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  React.useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleCapability = (cap: Capability) => {
    if (!user) return;

    if (!activeSessionId) {
      createSession(user.uid);
    }

    void send([{ type: 'text', text: cap.prompt }]);
    onClose?.();
  };

  const handleSignOut = async () => {
    try {
      const { auth } = await import('@/shared/services/firebase');
      if (auth) {
        const { signOut } = await import('firebase/auth');
        await signOut(auth as import('firebase/auth').Auth);
      }
    } catch {
      // mock mode
    }
    clearUser();
    navigate('/');
  };

  return (
    <div className="user-panel">
      {/* User info / Confirm Signout */}
      <div className="user-panel__profile">
        {showSignOutConfirm ? (
          <div className="user-panel__signout-confirm">
            <span className="confirm-text">¿Cerrar sesión?</span>
            <div className="confirm-actions">
              <button className="confirm-btn confirm-btn--yes" onClick={() => void handleSignOut()}>Sí</button>
              <button className="confirm-btn confirm-btn--no" onClick={() => setShowSignOutConfirm(false)}>No</button>
            </div>
          </div>
        ) : (
          <>
            <Avatar name={user?.name ?? '?'} size="lg" />
            <div className="user-panel__info">
              <span className="user-panel__name">{user?.name}</span>
              <span className="user-panel__phone">{user?.phone}</span>
            </div>
            <div className="user-panel__actions">
              {onClose && (
                <button
                  className="user-panel__close-btn"
                  onClick={onClose}
                  aria-label="Cerrar panel"
                  title="Cerrar panel"
                >
                  ✕
                </button>
              )}
              <button
                id="sign-out-btn"
                className="user-panel__signout"
                onClick={() => setShowSignOutConfirm(true)}
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                ↩
              </button>
            </div>
          </>
        )}
      </div>

      <div className="user-panel__divider" />

      {/* Settings (Modo Oscuro) */}
      <div className="user-panel__section-title">Ajustes</div>
      <div className="user-panel__settings">
        <div className="user-panel__setting-row">
          <span className="setting-label">🌓 Modo Oscuro</span>
          <button 
            className="theme-toggle-btn"
            onClick={toggleDarkMode}
            title={darkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          >
            {darkMode ? 'Activado 🌙' : 'Desactivado ☀️'}
          </button>
        </div>
      </div>

      <div className="user-panel__divider" />

      {/* Capabilities */}
      <div className="user-panel__section-title">Capacidades</div>
      <div className="user-panel__capabilities">
        {CAPABILITIES.map((cap, i) => (
          <motion.button
            key={cap.id}
            id={`capability-${cap.id}`}
            className="capability-card"
            onClick={() => handleCapability(cap)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span className="capability-card__icon">{cap.icon}</span>
            <div className="capability-card__text">
              <span className="capability-card__title">{cap.title}</span>
              <span className="capability-card__desc">{cap.description}</span>
            </div>
            <span className="capability-card__arrow">›</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

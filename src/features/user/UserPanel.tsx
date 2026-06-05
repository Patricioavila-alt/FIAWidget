import React from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { motion } from 'framer-motion';
import { auth } from '@/shared/services/firebase';
import { useAuthStore } from '@/shared/stores/authStore';
import { useChatStore } from '@/shared/stores/chatStore';
import { Avatar } from '@/shared/components';
import type { Capability } from '@/shared/types';
import './UserPanel.css';

const CAPABILITIES: Capability[] = [
  {
    id: 'diagnose',
    icon: '🩺',
    title: 'Diagnóstico',
    description: 'Describe tus síntomas y recibe orientación',
    prompt: 'Quiero describir mis síntomas para recibir orientación médica.',
  },
  {
    id: 'appointment',
    icon: '📅',
    title: 'Agendar cita',
    description: 'Solicita una cita médica',
    prompt: 'Quiero agendar una cita médica.',
  },
  {
    id: 'medication',
    icon: '💊',
    title: 'Medicamentos',
    description: 'Información sobre tu medicación',
    prompt: 'Necesito información sobre mis medicamentos.',
  },
  {
    id: 'history',
    icon: '📋',
    title: 'Historial',
    description: 'Consulta tu historial clínico',
    prompt: 'Quiero ver mi historial clínico.',
  },
  {
    id: 'nutrition',
    icon: '🥗',
    title: 'Nutrición',
    description: 'Consejos de alimentación saludable',
    prompt: 'Dame consejos de nutrición y alimentación saludable.',
  },
  {
    id: 'faq',
    icon: '❓',
    title: 'Preguntas frecuentes',
    description: 'Resuelve tus dudas comunes',
    prompt: '¿Cuáles son las preguntas frecuentes que puedes resolver?',
  },
];

interface UserPanelProps {
  onClose?: () => void;
}

export const UserPanel: React.FC<UserPanelProps> = ({ onClose }) => {
  const navigate   = useNavigate();
  const { user, clearUser } = useAuthStore();
  const { addMessage, activeSessionId, createSession } = useChatStore();

  const handleCapability = (cap: Capability) => {
    if (!user) return;
    let sessionId = activeSessionId;
    if (!sessionId) {
      sessionId = createSession(user.uid);
    }
    addMessage(sessionId, {
      role: 'user',
      parts: [{ type: 'text', text: cap.prompt }],
    });
    onClose?.();
  };

  const handleSignOut = async () => {
    await signOut(auth);
    clearUser();
    navigate('/');
  };

  return (
    <div className="user-panel">
      {/* User info */}
      <div className="user-panel__profile">
        <Avatar name={user?.name ?? '?'} size="lg" />
        <div className="user-panel__info">
          <span className="user-panel__name">{user?.name}</span>
          <span className="user-panel__phone">{user?.phone}</span>
        </div>
        <button
          id="sign-out-btn"
          className="user-panel__signout"
          onClick={() => void handleSignOut()}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          ↩
        </button>
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

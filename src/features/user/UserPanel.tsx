import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate }    from 'react-router-dom';
import { motion }         from 'framer-motion';
import { useAuthStore }   from '@/shared/stores/authStore';
import { useChatStore }   from '@/shared/stores/chatStore';
import { useChatContext } from '@/features/chat/ChatContext';
import { Avatar }         from '@/shared/components';
import { fetchUserProfile } from '@/shared/services/authService';
import type { UserProfile } from '@/shared/services/authService';
import type { Capability } from '@/shared/types';
import './UserPanel.css';

const CAPABILITIES: Capability[] = [
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
  const { createSession, activeSessionId, activeSession, reset: resetChat } = useChatStore();
  const { send }              = useChatContext();

  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark';
  });

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    expediente: true,
    medications: false,
    appointments: false
  });

  const toggleSection = (sec: string) => {
    setOpenSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

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

  const loadProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const p = await fetchUserProfile();
      setProfile(p);
    } catch {
      // Fallback
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  const session = activeSession();
  const messagesCount = session?.messages.length ?? 0;

  useEffect(() => {
    loadProfile();
  }, [loadProfile, messagesCount]);

  const parsedCurpInfo = useMemo(() => {
    if (!user?.curp) return null;
    const clean = user.curp.toUpperCase().trim();
    if (clean.length < 10) return null;
    const yy = clean.substring(4, 6);
    const mm = clean.substring(6, 8);
    const dd = clean.substring(8, 10);
    const sexChar = clean.charAt(10);
    const centuryChar = clean.charAt(16);
    const is21stCentury = isNaN(Number(centuryChar));
    const yearPrefix = is21stCentury ? '20' : '19';
    const dob = `${yearPrefix}${yy}-${mm}-${dd}`;
    
    // Calcular edad
    const birthDate = new Date(dob);
    let age = '';
    if (!isNaN(birthDate.getTime())) {
      const today = new Date();
      let ageNum = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        ageNum--;
      }
      age = `${ageNum} años`;
    }
    
    return {
      sex: sexChar === 'H' ? 'Masculino' : sexChar === 'M' ? 'Femenino' : 'Otro',
      dob,
      age
    };
  }, [user?.curp]);

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
    resetChat();
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
              <span className="user-panel__name">{profile?.name || user?.name}</span>
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

      {/* Expediente Clínico / Health File */}
      <div className="user-panel__section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Expediente Clínico</span>
        {loadingProfile && <span style={{ fontSize: '10px', textTransform: 'none', color: 'var(--clr-text-muted)', animation: 'btn-spin 1s linear infinite' }}>⟳</span>}
      </div>
      <div className="user-panel__accordions">
        {/* Sección: Datos Generales */}
        <div className="panel-accordion">
          <button className="panel-accordion__header" onClick={() => toggleSection('expediente')}>
            <span className="panel-accordion__title">📋 Datos Generales</span>
            <span className="panel-accordion__arrow">{openSections.expediente ? '▲' : '▼'}</span>
          </button>
          {openSections.expediente && (
            <div className="panel-accordion__content">
              {user?.curp && (
                <div className="info-item">
                  <span className="info-label">CURP</span>
                  <span className="info-value">{user.curp}</span>
                </div>
              )}
              {parsedCurpInfo && (
                <>
                  <div className="info-item">
                    <span className="info-label">Edad</span>
                    <span className="info-value">{parsedCurpInfo.age}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Sexo</span>
                    <span className="info-value">{parsedCurpInfo.sex}</span>
                  </div>
                </>
              )}
              {profile && (
                <>
                  <div className="info-item">
                    <span className="info-label">Grupo Sanguíneo</span>
                    <span className="info-value badge badge--blood">{profile.blood_type || 'No especificado'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Alergias</span>
                    <span className="info-value text-red">
                      {profile.allergies && profile.allergies.length > 0 
                        ? profile.allergies.join(', ') 
                        : 'Ninguna detectada'}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Condiciones</span>
                    <span className="info-value">
                      {profile.conditions && profile.conditions.length > 0 
                        ? profile.conditions.join(', ') 
                        : 'Ninguna registrada'}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Sección: Medicación Activa */}
        <div className="panel-accordion">
          <button className="panel-accordion__header" onClick={() => toggleSection('medications')}>
            <span className="panel-accordion__title">💊 Medicamentos Activos ({profile?.active_medications?.length ?? 0})</span>
            <span className="panel-accordion__arrow">{openSections.medications ? '▲' : '▼'}</span>
          </button>
          {openSections.medications && (
            <div className="panel-accordion__content">
              {profile?.active_medications && profile.active_medications.length > 0 ? (
                <div className="meds-list">
                  {profile.active_medications.map((med, i) => (
                    <div key={i} className="med-item">
                      <span className="med-name">🔹 {med.name}</span>
                      <span className="med-freq">{med.frequency}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="accordion-empty">Sin medicamentos activos en el perfil.</span>
              )}
            </div>
          )}
        </div>

        {/* Sección: Próximas Citas */}
        <div className="panel-accordion">
          <button className="panel-accordion__header" onClick={() => toggleSection('appointments')}>
            <span className="panel-accordion__title">📅 Próximas Citas ({profile?.upcoming_appointments?.length ?? 0})</span>
            <span className="panel-accordion__arrow">{openSections.appointments ? '▲' : '▼'}</span>
          </button>
          {openSections.appointments && (
            <div className="panel-accordion__content">
              {profile?.upcoming_appointments && profile.upcoming_appointments.length > 0 ? (
                <div className="appointments-list">
                  {profile.upcoming_appointments.map((app, i) => (
                    <div key={i} className="app-item">
                      <span className="app-spec">🩺 Cita en {app.specialty}</span>
                      <span className="app-date">
                        📅 {new Date(app.date).toLocaleDateString('es-MX', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="accordion-empty">No tienes citas médicas agendadas.</span>
              )}
            </div>
          )}
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

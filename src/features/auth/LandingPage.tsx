import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/shared/components';
import { useAuthStore } from '@/shared/stores/authStore';
import './LandingPage.css';

const features = [
  { icon: '🖼️', text: 'Envía imágenes y texto' },
  { icon: '🧠', text: 'Memoria entre sesiones' },
  { icon: '⚡', text: 'Respuestas en tiempo real' },
  { icon: '🔒', text: 'Acceso seguro con OTP' },
];

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/chat', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="landing">
      {/* Background orbs */}
      <div className="landing__orb landing__orb--1" />
      <div className="landing__orb landing__orb--2" />

      <motion.div
        className="landing__content"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        {/* Badge */}
        <motion.div
          className="landing__badge"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <span className="landing__badge-dot" />
          Agente Multimodal con IA
        </motion.div>

        {/* Hero */}
        <h1 className="landing__title">
          Tu asistente<br />
          <span className="gradient-text">inteligente</span>
        </h1>
        <p className="landing__subtitle">
          Conversa con nuestro agente de IA enviando texto e imágenes.
          Recuerda tus sesiones y aprende de ti con cada conversación.
        </p>

        {/* Features grid */}
        <div className="landing__features">
          {features.map((f, i) => (
            <motion.div
              key={i}
              className="landing__feature glass"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.08 }}
            >
              <span className="landing__feature-icon">{f.icon}</span>
              <span className="landing__feature-text">{f.text}</span>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          className="landing__cta"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <Button size="lg" onClick={() => navigate('/auth')}>
            Comenzar gratis →
          </Button>
          <p className="landing__cta-note">Sin contraseña · Solo tu número de teléfono</p>
        </motion.div>
      </motion.div>

      {/* Floating agent icon */}
      <motion.div
        className="landing__agent"
        animate={{ y: [0, -16, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        🤖
      </motion.div>
    </div>
  );
};

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/shared/stores/authStore';
import { OTPInput } from '@/shared/components';
import './AuthPage.css';

// ─────────────────────────────────────────────
// MOCK MODE: código OTP = "0000" (4 dígitos)
// ─────────────────────────────────────────────
const MOCK_OTP = '0000';

type Step = 'phone' | 'otp' | 'name';

export const AuthPage: React.FC = () => {
  const navigate    = useNavigate();
  const { setUser } = useAuthStore();

  const [step,      setStep]      = useState<Step>('phone');
  const [phone,     setPhone]     = useState('');
  const [otp,       setOtp]       = useState('');
  const [name,      setName]      = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [accepted,  setAccepted]  = useState(false);
  const [countdown, setCountdown] = useState(0);

  const startCountdown = () => {
    setCountdown(30);
    const interval = setInterval(() => {
      setCountdown((c) => { if (c <= 1) { clearInterval(interval); return 0; } return c - 1; });
    }, 1000);
  };

  const handleSendOTP = () => {
    setError('');
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) { setError('Ingresa un número válido de 10 dígitos'); return; }
    if (!accepted)           { setError('Debes aceptar el Aviso de Privacidad para continuar'); return; }
    setLoading(true);
    setTimeout(() => { setLoading(false); setStep('otp'); startCountdown(); }, 800);
  };

  const handleVerifyOTP = () => {
    if (otp.length < 4) return;
    setError('');
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (otp === MOCK_OTP) { setStep('name'); }
      else { setError(`Código incorrecto. Usa "${MOCK_OTP}" por ahora.`); setOtp(''); }
    }, 600);
  };

  const handleSaveName = () => {
    if (name.trim().length < 2) { setError('Ingresa tu nombre completo'); return; }
    setError('');
    setLoading(true);
    setTimeout(() => {
      setUser({ uid: `mock-${phone.replace(/\D/g, '')}`, phone: `+52${phone.replace(/\D/g, '')}`, name: name.trim(), createdAt: new Date() });
      setLoading(false);
      navigate('/chat');
    }, 500);
  };

  const stepVariants = {
    hidden:  { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
    exit:    { opacity: 0, y: -12, transition: { duration: 0.18 } },
  };

  return (
    <div className="auth-page">
      {/* Left decorative panel */}
      <div className="auth-page__panel">
        <div className="auth-page__panel-inner">
          <div className="auth-panel__logo-wrap">
            <div className="auth-panel__icon">
              <span className="auth-panel__icon-a">A</span>
            </div>
            <div className="auth-panel__brand">
              <span className="auth-panel__brand-name">Salud Digital</span>
              <span className="auth-panel__brand-tagline">Te queremos… bien.</span>
            </div>
          </div>
          <h2 className="auth-panel__headline">Tu salud,<br />siempre contigo.</h2>
          <p className="auth-panel__sub">
            Accede a nuestro agente de IA para consultas médicas,
            medicamentos y mucho más — en segundos.
          </p>
          <div className="auth-panel__features">
            {['🩺 Orientación médica', '💊 Información de medicamentos', '📅 Agenda citas', '🔒 100% privado y seguro'].map((f) => (
              <div key={f} className="auth-panel__feature">{f}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="auth-page__form">
        <motion.div
          className="auth-card"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          {/* Mobile logo */}
          <div className="auth-card__mobile-logo">
            <div className="auth-panel__icon auth-panel__icon--sm">
              <span className="auth-panel__icon-a">A</span>
            </div>
            <span className="auth-card__mobile-brand">Salud Digital</span>
          </div>

          {/* Stepper dots */}
          <div className="auth-stepper">
            {(['phone','otp','name'] as Step[]).map((s, i) => {
              const current = ['phone','otp','name'].indexOf(step);
              return (
                <div key={s} className={`auth-stepper__step ${step === s ? 'active' : ''} ${current > i ? 'done' : ''}`}>
                  <div className="auth-stepper__dot">
                    {current > i ? '✓' : i + 1}
                  </div>
                  {i < 2 && <div className="auth-stepper__line" />}
                </div>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {/* ── STEP 1: Teléfono ── */}
            {step === 'phone' && (
              <motion.div key="phone" className="auth-step" variants={stepVariants} initial="hidden" animate="visible" exit="exit">
                <div className="auth-step__header">
                  <h1 className="auth-step__title">Identifícate</h1>
                  <p className="auth-step__subtitle">Ingresa tu número de celular y te enviaremos un código de verificación</p>
                </div>

                <div className="auth-field">
                  <label className="auth-field__label" htmlFor="phone-input">Número de celular</label>
                  <div className="auth-field__phone-wrap">
                    <span className="auth-field__prefix">
                      <span className="auth-field__flag">🇲🇽</span>
                      <span className="auth-field__code">+52</span>
                    </span>
                    <div className="auth-field__divider" />
                    <input
                      id="phone-input"
                      type="tel"
                      className="auth-field__input"
                      placeholder="55 1234 5678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendOTP()}
                      maxLength={15}
                      autoFocus
                    />
                  </div>
                </div>

                {/* Terms checkbox */}
                <label className="auth-terms" htmlFor="terms-checkbox">
                  <input
                    id="terms-checkbox"
                    type="checkbox"
                    className="auth-terms__checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                  />
                  <span className="auth-terms__text">
                    He leído y acepto el{' '}
                    <a href="#" onClick={(e) => e.preventDefault()}>Aviso de Privacidad</a>
                    {' '}y los{' '}
                    <a href="#" onClick={(e) => e.preventDefault()}>Términos y Condiciones</a>.
                    Comprendo que mis datos de salud son <strong>datos personales sensibles</strong> (LFPDPPP Art. 9) y autorizo expresamente su tratamiento.
                  </span>
                </label>

                {error && <p className="auth-error">{error}</p>}

                <button
                  id="send-otp-btn"
                  className={`auth-cta-btn ${loading ? 'auth-cta-btn--loading' : ''}`}
                  onClick={handleSendOTP}
                  disabled={loading}
                >
                  <span className="auth-cta-btn__arrow">
                    {loading ? <span className="auth-cta-btn__spinner" /> : '›'}
                  </span>
                  <span className="auth-cta-btn__label">
                    {loading ? 'Enviando...' : 'Continuar ›››'}
                  </span>
                </button>
              </motion.div>
            )}

            {/* ── STEP 2: OTP ── */}
            {step === 'otp' && (
              <motion.div key="otp" className="auth-step" variants={stepVariants} initial="hidden" animate="visible" exit="exit">
                <div className="auth-step__header">
                  <h1 className="auth-step__title">Verifica tu número</h1>
                  <p className="auth-step__subtitle">
                    Ingresa el código enviado a <strong>+52 {phone}</strong>
                  </p>
                </div>

                <div className="auth-mock-hint">
                  🧪 Modo demo — usa el código <strong>{MOCK_OTP}</strong>
                </div>

                <OTPInput value={otp} onChange={setOtp} length={4} disabled={loading} />

                {error && <p className="auth-error">{error}</p>}

                <button
                  id="verify-otp-btn"
                  className={`auth-cta-btn ${loading || otp.length < 4 ? 'auth-cta-btn--disabled' : ''}`}
                  onClick={handleVerifyOTP}
                  disabled={loading || otp.length < 4}
                >
                  <span className="auth-cta-btn__arrow">
                    {loading ? <span className="auth-cta-btn__spinner" /> : '›'}
                  </span>
                  <span className="auth-cta-btn__label">
                    {loading ? 'Verificando...' : 'Verificar código ›››'}
                  </span>
                </button>

                <button className="auth-resend" disabled={countdown > 0 || loading} onClick={handleSendOTP}>
                  {countdown > 0 ? `Reenviar código en ${countdown}s` : 'Reenviar código'}
                </button>
              </motion.div>
            )}

            {/* ── STEP 3: Nombre ── */}
            {step === 'name' && (
              <motion.div key="name" className="auth-step" variants={stepVariants} initial="hidden" animate="visible" exit="exit">
                <div className="auth-step__header">
                  <h1 className="auth-step__title">¿Cómo te llamas?</h1>
                  <p className="auth-step__subtitle">El agente te recordará por tu nombre en cada sesión</p>
                </div>

                <div className="auth-field">
                  <label className="auth-field__label" htmlFor="name-input">Nombre completo</label>
                  <input
                    id="name-input"
                    type="text"
                    className="auth-field__input auth-field__input--standalone"
                    placeholder="Ej. Juan Martínez"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                    autoFocus
                  />
                </div>

                {error && <p className="auth-error">{error}</p>}

                <button
                  id="save-name-btn"
                  className={`auth-cta-btn ${loading ? 'auth-cta-btn--loading' : ''}`}
                  onClick={handleSaveName}
                  disabled={loading}
                >
                  <span className="auth-cta-btn__arrow">
                    {loading ? <span className="auth-cta-btn__spinner" /> : '›'}
                  </span>
                  <span className="auth-cta-btn__label">
                    {loading ? 'Entrando...' : 'Comenzar ›››'}
                  </span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

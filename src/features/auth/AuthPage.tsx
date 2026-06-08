import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/shared/stores/authStore';
import { useChatStore } from '@/shared/stores/chatStore';
import { OTPInput } from '@/shared/components';
import { requestOtp, verifyOtpAndRegister } from '@/shared/services/authService';
import './AuthPage.css';

// ─────────────────────────────────────────────
// REGEX Y PARSEO DE CURP
// ─────────────────────────────────────────────
const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;

function parseCurp(curp: string): { sex: 'H' | 'M'; dob: string } | null {
  const clean = curp.toUpperCase().trim();
  if (!CURP_REGEX.test(clean)) return null;

  const yy = clean.substring(4, 6);
  const mm = clean.substring(6, 8);
  const dd = clean.substring(8, 10);
  const sexChar = clean.charAt(10);
  
  const centuryChar = clean.charAt(16);
  const is21stCentury = isNaN(Number(centuryChar));
  const yearPrefix = is21stCentury ? '20' : '19';
  const dob = `${yearPrefix}${yy}-${mm}-${dd}`;

  return {
    sex: sexChar as 'H' | 'M',
    dob,
  };
}

type Step = 'phone' | 'otp' | 'name';

export const AuthPage: React.FC = () => {
  const navigate    = useNavigate();
  const { setUser, isAuthenticated } = useAuthStore();

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/chat', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const [step,          setStep]          = useState<Step>('phone');
  const [phone,         setPhone]         = useState('');
  const [curp,          setCurp]          = useState('');
  const [otp,           setOtp]           = useState('');
  const [name,          setName]          = useState('');
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState('');
  const [accepted,      setAccepted]      = useState(false);
  const [countdown,     setCountdown]     = useState(0);
  const [debugOtpHint,  setDebugOtpHint]  = useState('');
  const [regResult,     setRegResult]     = useState<{ userId: string; accessToken: string; isDemo: boolean } | null>(null);

  const startCountdown = () => {
    setCountdown(30);
    const interval = setInterval(() => {
      setCountdown((c) => { if (c <= 1) { clearInterval(interval); return 0; } return c - 1; });
    }, 1000);
  };

  const handleSendOTP = async () => {
    setError('');
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) { setError('Ingresa un número de celular de 10 dígitos'); return; }
    
    const curpVal = curp.toUpperCase().trim();
    if (!curpVal) { setError('Ingresa tu CURP'); return; }
    if (!CURP_REGEX.test(curpVal)) { setError('Ingresa una CURP válida (18 caracteres)'); return; }
    
    if (!accepted) { setError('Debes aceptar el Aviso de Privacidad para continuar'); return; }
    
    setLoading(true);
    try {
      const formattedPhone = `+52${digits}`;
      const res = await requestOtp(curpVal, formattedPhone);
      setLoading(false);
      setStep('otp');
      startCountdown();
      
      if (res.debug_otp) {
        setDebugOtpHint(res.debug_otp);
      } else {
        setDebugOtpHint('');
      }
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Error al solicitar el código OTP. Intenta de nuevo.');
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length < 4) return;
    setError('');
    setLoading(true);

    const curpVal = curp.toUpperCase().trim();
    const digits = phone.replace(/\D/g, '');
    const formattedPhone = `+52${digits}`;

    const parsed = parseCurp(curpVal);
    if (!parsed) {
      setLoading(false);
      setError('Formato de CURP inválido');
      return;
    }

    try {
      const res = await verifyOtpAndRegister(
        curpVal,
        formattedPhone,
        otp,
        parsed.sex,
        parsed.dob
      );
      setLoading(false);
      setRegResult({
        userId: res.user_id,
        accessToken: res.access_token,
        isDemo: res.is_demo
      });
      setStep('name');
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Código OTP incorrecto o expirado.');
    }
  };

  const handleSaveName = () => {
    if (name.trim().length < 2) { setError('Ingresa tu nombre completo'); return; }
    setError('');
    setLoading(true);
    setTimeout(() => {
      const digits = phone.replace(/\D/g, '');
      useChatStore.getState().reset();
      setUser({ 
        uid: regResult?.userId || `+52${digits}`, 
        phone: `+52${digits}`, 
        name: name.trim(), 
        createdAt: new Date(),
        token: regResult?.accessToken,
        curp: curp.toUpperCase().trim()
      });
      setLoading(false);
      navigate('/chat');
    }, 500);
  };

  const stepVariants = {
    hidden:  { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
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
            {/* ── STEP 1: Teléfono & CURP ── */}
            {step === 'phone' && (
              <motion.div key="phone" className="auth-step" variants={stepVariants} initial="hidden" animate="visible" exit="exit">
                <div className="auth-step__header">
                  <h1 className="auth-step__title">Identifícate</h1>
                  <p className="auth-step__subtitle">Ingresa tu número de celular y tu CURP para vincular tu expediente clínico</p>
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
                      maxLength={15}
                      autoFocus
                    />
                  </div>
                </div>

                <div className="auth-field" style={{ marginTop: '16px' }}>
                  <label className="auth-field__label" htmlFor="curp-input">CURP</label>
                  <input
                    id="curp-input"
                    type="text"
                    className="auth-field__input auth-field__input--standalone"
                    placeholder="Ej. GARM850315HDFXXX04"
                    value={curp}
                    onChange={(e) => setCurp(e.target.value.toUpperCase())}
                    maxLength={18}
                  />
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
                  {debugOtpHint ? (
                    <>🧪 Código real de prueba: <strong>{debugOtpHint}</strong></>
                  ) : (
                    <>🧪 Modo demo — usa el código <strong>0000</strong></>
                  )}
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

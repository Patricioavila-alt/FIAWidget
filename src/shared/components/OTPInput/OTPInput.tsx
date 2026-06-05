import React, { useRef } from 'react';
import './OTPInput.css';

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const OTPInput: React.FC<OTPInputProps> = ({
  length = 6,
  value,
  onChange,
  disabled = false,
}) => {
  const inputsRef = useRef<HTMLInputElement[]>([]);
  const digits = value.split('').concat(Array(length).fill('')).slice(0, length);

  const handleChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = clean;
    onChange(newDigits.join(''));
    if (clean && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    onChange(pasted.padEnd(length, '').slice(0, length));
    e.preventDefault();
    if (pasted.length < length) {
      inputsRef.current[pasted.length]?.focus();
    }
  };

  return (
    <div className="otp-input" onPaste={handlePaste}>
      {digits.map((digit, i) => (
        <input
          key={i}
          id={`otp-digit-${i}`}
          ref={(el) => { if (el) inputsRef.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          disabled={disabled}
          className={`otp-input__cell ${digit ? 'otp-input__cell--filled' : ''}`}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Dígito ${i + 1} del código OTP`}
        />
      ))}
    </div>
  );
};

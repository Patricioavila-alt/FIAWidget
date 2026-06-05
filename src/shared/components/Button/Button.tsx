import React from 'react';
import { motion } from 'framer-motion';
import './Button.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size    = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  children,
  disabled,
  className = '',
  ...props
}) => {
  return (
    <motion.button
      className={`btn btn--${variant} btn--${size} ${fullWidth ? 'btn--full' : ''} ${className}`}
      disabled={disabled || loading}
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
      {...(props as React.ComponentProps<typeof motion.button>)}
    >
      {loading ? (
        <span className="btn__spinner" aria-label="Cargando" />
      ) : (
        leftIcon && <span className="btn__icon">{leftIcon}</span>
      )}
      {children}
      {rightIcon && !loading && <span className="btn__icon">{rightIcon}</span>}
    </motion.button>
  );
};

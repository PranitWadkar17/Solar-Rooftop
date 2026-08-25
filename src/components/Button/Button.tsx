import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ButtonVariant, ButtonSize } from '../../types';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  to?: string;
  children: ReactNode;
  icon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  href,
  to,
  children,
  icon,
  className = '',
  onClick,
  ...props
}: ButtonProps) {
  const navigate = useNavigate();

  const classNames = [
    styles.button,
    styles[variant],
    styles[size],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (to) {
      e.preventDefault();
      navigate(to);
    } else if (href) {
      e.preventDefault();
      const el = document.querySelector(href);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
    onClick?.(e);
  };

  return (
    <button className={classNames} onClick={handleClick} {...props}>
      {icon && <span className={styles.icon}>{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

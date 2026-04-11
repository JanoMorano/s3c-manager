/**
 * Layer 3 — Button
 * Variants: primary | secondary | ghost | danger | dangerSolid
 * Sizes: sm | md | lg
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerSolid';
export type ButtonSize    = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size    = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  const cls = [
    styles.btn,
    styles[variant],
    styles[size],
    loading ? styles.loading : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {loading ? <span aria-hidden>…</span> : null}
      {children}
    </button>
  );
}

/**
 * Layer 3 — Checkbox
 * Variants: default (inline) | pill (for tag/domain selection)
 */
import type { InputHTMLAttributes } from 'react';
import styles from './Checkbox.module.css';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  variant?: 'default' | 'pill';
}

export function Checkbox({ label, variant = 'default', disabled, className, ...rest }: CheckboxProps) {
  if (variant === 'pill') {
    return (
      <label className={[styles.pill, className ?? ''].filter(Boolean).join(' ')}>
        <input type="checkbox" disabled={disabled} {...rest} />
        <span>{label}</span>
      </label>
    );
  }

  return (
    <label className={[styles.label, disabled ? styles.disabled : '', className ?? ''].filter(Boolean).join(' ')}>
      <input type="checkbox" className={styles.input} disabled={disabled} {...rest} />
      <span>{label}</span>
    </label>
  );
}

/**
 * Layer 3 — Toggle (on/off switch)
 */
import type { InputHTMLAttributes } from 'react';
import styles from './Toggle.module.css';

interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export function Toggle({ label, disabled, className, ...rest }: ToggleProps) {
  return (
    <label className={[styles.wrapper, disabled ? styles.disabled : '', className ?? ''].filter(Boolean).join(' ')}>
      <input type="checkbox" className={styles.input} disabled={disabled} {...rest} />
      <span className={styles.track} />
      {label && <span className={styles.labelText}>{label}</span>}
    </label>
  );
}

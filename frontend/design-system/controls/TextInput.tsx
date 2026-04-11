/**
 * Layer 3 — TextInput
 * Wraps label + input + error message into a consistent field unit.
 */
import type { InputHTMLAttributes } from 'react';
import styles from './TextInput.module.css';

interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  fieldSize?: 'sm' | 'md' | 'lg';
}

export function TextInput({
  label,
  error,
  hint,
  required,
  fieldSize = 'md',
  className,
  id,
  ...rest
}: TextInputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={[styles.wrapper, error ? styles.error : '', styles[fieldSize], className ?? ''].filter(Boolean).join(' ')}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
          {required && <span className={styles.required} aria-hidden>*</span>}
        </label>
      )}
      <input id={inputId} className={styles.input} aria-invalid={!!error} aria-describedby={error ? `${inputId}-err` : undefined} {...rest} />
      {error && <span id={`${inputId}-err`} className={styles.errorMsg} role="alert">{error}</span>}
      {hint && !error && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

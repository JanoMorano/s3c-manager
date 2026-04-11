/**
 * Layer 3 — Select
 * Single-value select with label + error message.
 */
import type { SelectHTMLAttributes } from 'react';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  options?: SelectOption[];
  placeholder?: string;
}

export function Select({
  label,
  error,
  hint,
  required,
  options,
  placeholder,
  className,
  id,
  children,
  ...rest
}: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={[styles.wrapper, error ? styles.error : '', className ?? ''].filter(Boolean).join(' ')}>
      {label && (
        <label htmlFor={selectId} className={styles.label}>
          {label}
          {required && <span className={styles.required} aria-hidden>*</span>}
        </label>
      )}
      <select id={selectId} className={styles.select} aria-invalid={!!error} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options
          ? options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)
          : children}
      </select>
      {error && <span className={styles.errorMsg} role="alert">{error}</span>}
      {hint && !error && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

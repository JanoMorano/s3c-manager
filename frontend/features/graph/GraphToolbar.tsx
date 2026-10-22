'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import styles from './GraphToolbar.module.css';

export { styles as graphToolbarStyles };

interface GraphSegmentedProps<T extends string | number> {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

/** A small set of mutually exclusive toggle buttons (view switch, layout, depth…). */
export function GraphSegmented<T extends string | number>({ label, value, options, onChange }: GraphSegmentedProps<T>) {
  return (
    <div className={styles.segmented} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          className={`${styles.segment} ${option.value === value ? styles.segmentOn : ''}`}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** A labelled row inside the options menu. */
export function GraphOptionGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.optionGroup}>
      <span className={styles.optionLabel}>{label}</span>
      {children}
    </div>
  );
}

/**
 * Disclosure menu for less frequent display options, so the toolbar stays one row.
 * Closes on Escape and on a click outside.
 */
export function GraphOptionsMenu({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement | null>(null);
  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const el = ref.current;
      if (el?.open && event.target instanceof globalThis.Node && !el.contains(event.target)) el.open = false;
    }
    function onKeyDown(event: KeyboardEvent) {
      const el = ref.current;
      if (event.key === 'Escape' && el?.open) {
        el.open = false;
        el.querySelector('summary')?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);
  return (
    <details ref={ref} className={styles.menu}>
      <summary className={styles.menuSummary}>
        <SlidersHorizontal size={14} aria-hidden="true" />
        {label}
      </summary>
      <div className={styles.menuPanel}>{children}</div>
    </details>
  );
}

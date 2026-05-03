'use client';

import { useEffect, useState } from 'react';
import styles from '../layout.module.css';

export type ViewMode = 'business' | 'technical';

export const VIEW_MODE_STORAGE_KEY = 'sc_view_mode';
export const VIEW_MODE_EVENT = 'sc-view-mode-changed';

function readStoredViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'business';
  return window.localStorage.getItem(VIEW_MODE_STORAGE_KEY) === 'technical' ? 'technical' : 'business';
}

function normalizeRemoteViewMode(value: unknown): ViewMode | null {
  if (!value || typeof value !== 'object') return null;
  const mode = (value as { mode?: unknown }).mode;
  return mode === 'technical' ? 'technical' : mode === 'business' ? 'business' : null;
}

export default function ViewModeSwitch({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useState<ViewMode>('business');

  useEffect(() => {
    setMode(readStoredViewMode());

    function syncMode(event: Event) {
      const custom = event as CustomEvent<{ mode?: ViewMode }>;
      setMode(custom.detail?.mode ?? readStoredViewMode());
    }

    window.addEventListener(VIEW_MODE_EVENT, syncMode);
    window.addEventListener('storage', syncMode);
    return () => {
      window.removeEventListener(VIEW_MODE_EVENT, syncMode);
      window.removeEventListener('storage', syncMode);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPreference() {
      try {
        const res = await fetch('/api/v1/auth/preferences/view_mode', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) return;
        const payload = await res.json() as { preference_value?: unknown };
        const remoteMode = normalizeRemoteViewMode(payload.preference_value);
        if (!remoteMode || cancelled) return;
        window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, remoteMode);
        setMode(remoteMode);
        window.dispatchEvent(new CustomEvent(VIEW_MODE_EVENT, { detail: { mode: remoteMode } }));
      } catch {
        // localStorage remains the offline fallback.
      }
    }

    void loadPreference();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateMode(next: ViewMode) {
    setMode(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, next);
      window.dispatchEvent(new CustomEvent(VIEW_MODE_EVENT, { detail: { mode: next } }));
      fetch('/api/v1/auth/preferences/view_mode', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preference_value: { mode: next } }),
      }).catch(() => {});
    }
  }

  return (
    <div className={`${styles.viewSwitch} ${compact ? styles.viewSwitchCompact : ''}`} aria-label="View mode">
      <button
        type="button"
        className={`${styles.viewSwitchButton} ${mode === 'business' ? styles.viewSwitchButtonActive : ''}`}
        aria-pressed={mode === 'business'}
        onClick={() => updateMode('business')}
      >
        Business
      </button>
      <button
        type="button"
        className={`${styles.viewSwitchButton} ${mode === 'technical' ? styles.viewSwitchButtonActive : ''}`}
        aria-pressed={mode === 'technical'}
        onClick={() => updateMode('technical')}
      >
        Technical
      </button>
    </div>
  );
}

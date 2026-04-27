'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
type AppliedTheme = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  appliedTheme: AppliedTheme;
  setMode: (mode: ThemeMode) => void;
}

const STORAGE_KEY = 's3c_theme_mode';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const value = window.localStorage.getItem(STORAGE_KEY);
  return isThemeMode(value) ? value : 'system';
}

function resolveAppliedTheme(mode: ThemeMode): AppliedTheme {
  if (mode === 'light' || mode === 'dark') return mode;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: AppliedTheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [appliedTheme, setAppliedTheme] = useState<AppliedTheme>('light');

  useEffect(() => {
    const initialMode = readStoredMode();
    const nextTheme = resolveAppliedTheme(initialMode);
    setModeState(initialMode);
    setAppliedTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  useEffect(() => {
    if (mode !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const nextTheme = resolveAppliedTheme('system');
      setAppliedTheme(nextTheme);
      applyTheme(nextTheme);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [mode]);

  function setMode(nextMode: ThemeMode) {
    window.localStorage.setItem(STORAGE_KEY, nextMode);
    const nextTheme = resolveAppliedTheme(nextMode);
    setModeState(nextMode);
    setAppliedTheme(nextTheme);
    applyTheme(nextTheme);
  }

  const value = useMemo(() => ({ mode, appliedTheme, setMode }), [appliedTheme, mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used within ThemeProvider');
  return value;
}

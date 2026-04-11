'use client';

import { useEffect, useState } from 'react';

export interface InstallModuleInfo {
  code: string;
  label?: string;
  is_mandatory?: boolean;
  enabled: boolean;
  ui_visible?: boolean;
  api_enabled?: boolean;
}

export interface InstallStatusSnapshot {
  mode?: string;
  status: string;
  install_locked?: boolean;
  locked_by?: string | null;
  app_version?: string;
  schema_version?: string;
  admin_exists?: boolean;
  modules: InstallModuleInfo[];
  db_error?: string;
}

export const INSTALL_STATUS_EVENT = 'sc-install-status-changed';

let installStatusCache: { data: InstallStatusSnapshot; checkedAt: number } | null = null;
const INSTALL_CACHE_TTL = 30_000;

function dispatchInstallStatusEvent() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(INSTALL_STATUS_EVENT));
}

export function getCachedInstallStatus() {
  return installStatusCache?.data ?? null;
}

export async function fetchInstallStatusSnapshot(force = false): Promise<InstallStatusSnapshot> {
  if (!force && installStatusCache && Date.now() - installStatusCache.checkedAt < INSTALL_CACHE_TTL) {
    return installStatusCache.data;
  }

  const res = await fetch('/api/v1/install/status', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Install status fetch selhal (${res.status}).`);
  }

  const data = await res.json() as InstallStatusSnapshot;
  installStatusCache = { data, checkedAt: Date.now() };
  return data;
}

export function invalidateInstallStatusCache() {
  installStatusCache = null;
  dispatchInstallStatusEvent();
}

export function markInstallReady(modules: InstallModuleInfo[] = []) {
  const previous = installStatusCache?.data;
  installStatusCache = {
    data: {
      mode: 'ready',
      status: 'READY',
      install_locked: false,
      locked_by: null,
      app_version: previous?.app_version,
      schema_version: previous?.schema_version,
      admin_exists: previous?.admin_exists ?? true,
      modules,
    },
    checkedAt: Date.now(),
  };
  dispatchInstallStatusEvent();
}

export function isModuleEnabled(status: InstallStatusSnapshot | null | undefined, moduleCode: string) {
  const module = status?.modules?.find((item) => item.code === moduleCode);
  return Boolean(module?.enabled);
}

export function isModuleUiVisible(status: InstallStatusSnapshot | null | undefined, moduleCode: string) {
  const module = status?.modules?.find((item) => item.code === moduleCode);
  if (!module) return false;
  return Boolean(module.enabled && (module.ui_visible ?? true));
}

export function useInstallStatus() {
  const [status, setStatus] = useState<InstallStatusSnapshot | null>(() => getCachedInstallStatus());
  const [loading, setLoading] = useState(() => !getCachedInstallStatus());

  useEffect(() => {
    let cancelled = false;

    const sync = async (force = false) => {
      try {
        const nextStatus = await fetchInstallStatusSnapshot(force);
        if (!cancelled) setStatus(nextStatus);
      } catch {
        if (!cancelled) setStatus(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    sync(false);
    const onStatusChange = () => {
      const nextStatus = getCachedInstallStatus();
      setStatus(nextStatus);
      setLoading(false);
    };

    window.addEventListener(INSTALL_STATUS_EVENT, onStatusChange);
    return () => {
      cancelled = true;
      window.removeEventListener(INSTALL_STATUS_EVENT, onStatusChange);
    };
  }, []);

  return {
    status,
    loading,
    c3Enabled: isModuleEnabled(status, 'C3_TAXONOMY'),
    c3Visible: isModuleUiVisible(status, 'C3_TAXONOMY'),
  };
}

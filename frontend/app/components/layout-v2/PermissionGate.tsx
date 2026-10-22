'use client';

import type { ReactNode } from 'react';
import { useT } from '@/app/i18n/useI18n';
import styles from './PermissionGate.module.css';

interface PermissionGateProps {
  allowed: boolean;
  title?: string;
  message?: string;
  children: ReactNode;
}

export default function PermissionGate({
  allowed,
  title,
  message,
  children,
}: PermissionGateProps) {
  const t = useT();
  if (allowed) {
    return <>{children}</>;
  }

  return (
    <section className={styles.panel} role="alert" aria-live="polite">
      <strong>{title ?? t('layout.permission_gate.title')}</strong>
      <p>{message ?? t('layout.permission_gate.message')}</p>
    </section>
  );
}

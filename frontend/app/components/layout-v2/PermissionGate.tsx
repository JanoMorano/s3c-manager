import type { ReactNode } from 'react';
import styles from './PermissionGate.module.css';

interface PermissionGateProps {
  allowed: boolean;
  title?: string;
  message?: string;
  children: ReactNode;
}

export default function PermissionGate({
  allowed,
  title = 'Nemáte oprávnění',
  message = 'Tato část vyžaduje vyšší oprávnění nebo přiřazení role.',
  children,
}: PermissionGateProps) {
  if (allowed) {
    return <>{children}</>;
  }

  return (
    <section className={styles.panel} role="alert" aria-live="polite">
      <strong>{title}</strong>
      <p>{message}</p>
    </section>
  );
}

import type { ReactNode } from 'react';
import styles from './C3EntityWorkspace.module.css';

interface C3EntityWorkspaceProps {
  children: ReactNode;
  className?: string;
}

export default function C3EntityWorkspace({ children, className }: C3EntityWorkspaceProps) {
  return (
    <div className={`${styles.workspace} ${className ?? ''}`}>
      {children}
    </div>
  );
}

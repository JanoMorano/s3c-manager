import type { ReactNode } from 'react';
import styles from './KbdChip.module.css';

export default function KbdChip({ children }: { children: ReactNode }) {
  return <kbd className={styles.kbd}>{children}</kbd>;
}

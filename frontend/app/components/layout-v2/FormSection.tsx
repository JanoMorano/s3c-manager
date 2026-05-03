import type { ReactNode } from 'react';
import styles from './FormSection.module.css';

interface FormSectionProps {
  id?: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  compact?: boolean;
}

export default function FormSection({ id, title, description, children, compact = false }: FormSectionProps) {
  return (
    <section id={id} className={`${styles.section} ${compact ? styles.compact : ''}`}>
      <div className={styles.header}>
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      <div className={styles.body}>{children}</div>
    </section>
  );
}

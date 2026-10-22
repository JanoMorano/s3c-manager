'use client';

import { useT } from '@/app/i18n/useI18n';
import styles from './ConflictModal.module.css';

interface ConflictModalProps {
  title?: string;
  message?: string;
  details?: string | null;
  onReload: () => void;
  onClose: () => void;
}

export default function ConflictModal({
  title,
  message,
  details,
  onReload,
  onClose,
}: ConflictModalProps) {
  const t = useT();
  return (
    <div className={styles.backdrop} role="presentation">
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="conflict-modal-title">
        <div className={styles.header}>
          <div>
            <h2 id="conflict-modal-title">{title ?? t('layout.conflict_modal.title')}</h2>
            <p>{message ?? t('layout.conflict_modal.message')}</p>
          </div>
          <button type="button" className={styles.close} onClick={onClose}>
            {t('layout.conflict_modal.close')}
          </button>
        </div>
        {details ? <pre className={styles.details}>{details}</pre> : null}
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            {t('layout.conflict_modal.stay')}
          </button>
          <button type="button" className={styles.primary} onClick={onReload}>
            {t('layout.conflict_modal.reload')}
          </button>
        </div>
      </section>
    </div>
  );
}

'use client';

import styles from './ConflictModal.module.css';

interface ConflictModalProps {
  title?: string;
  message?: string;
  details?: string | null;
  onReload: () => void;
  onClose: () => void;
}

export default function ConflictModal({
  title = 'Záznam se mezitím změnil',
  message = 'Server odmítl uložení, protože někdo nebo import změnil stejný záznam po načtení editoru.',
  details,
  onReload,
  onClose,
}: ConflictModalProps) {
  return (
    <div className={styles.backdrop} role="presentation">
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="conflict-modal-title">
        <div className={styles.header}>
          <div>
            <h2 id="conflict-modal-title">{title}</h2>
            <p>{message}</p>
          </div>
          <button type="button" className={styles.close} onClick={onClose}>
            Zavřít
          </button>
        </div>
        {details ? <pre className={styles.details}>{details}</pre> : null}
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            Zůstat v editoru
          </button>
          <button type="button" className={styles.primary} onClick={onReload}>
            Načíst aktuální data
          </button>
        </div>
      </section>
    </div>
  );
}

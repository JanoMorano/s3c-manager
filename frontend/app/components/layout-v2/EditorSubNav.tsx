import styles from './EditorSubNav.module.css';

export type EditorSubNavTone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'purple' | 'orange';

export interface EditorSubNavSection {
  id: string;
  label: string;
  hint?: string;
  badge?: string | number;
  tone?: EditorSubNavTone;
}

interface EditorSubNavProps {
  sections: EditorSubNavSection[];
  activeId?: string;
  title?: string;
  summary?: string;
  onSelect?: (id: string) => void;
}

export default function EditorSubNav({
  sections,
  activeId,
  title = 'Editor',
  summary = 'Vyplňte části v pořadí, ve kterém rozhodují o připravenosti.',
  onSelect,
}: EditorSubNavProps) {
  return (
    <aside className={styles.nav} aria-label={title}>
      <div className={styles.header}>
        <strong>{title}</strong>
        <span>{summary}</span>
      </div>
      <nav className={styles.items}>
        {sections.map((section) => {
          const active = section.id === activeId;
          return (
            <button
              key={section.id}
              type="button"
              className={`${styles.item} ${active ? styles.active : ''}`}
              onClick={() => onSelect?.(section.id)}
              aria-current={active ? 'step' : undefined}
            >
              <span className={styles.itemText}>
                <span className={styles.label}>{section.label}</span>
                {section.hint ? <span className={styles.hint}>{section.hint}</span> : null}
              </span>
              {section.badge !== undefined && section.badge !== null && section.badge !== '' ? (
                <span className={`${styles.badge} ${styles[`tone_${section.tone ?? 'neutral'}`]}`}>
                  {section.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

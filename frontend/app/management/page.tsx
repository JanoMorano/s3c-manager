'use client';

import Link from '@/app/components/AppLink';
import { useInstallStatus } from '@/features/install/installStatus';
import styles from '../admin/admin.module.css';

const BASE_ACTIONS = [
  {
    href: '/management/new-service',
    icon: '➕',
    title: 'New Service',
    desc: 'Ruční vytvoření nového záznamu služby přes POST /services.',
    meta: 'POST /services',
  },
  {
    href: '/import/upload',
    icon: '📤',
    title: 'Import CSV/JSON/XLSX',
    desc: 'Nahrát soubor a hromadně vytvořit nebo aktualizovat záznamy Service Catalogue nebo C3.',
    meta: 'POST /import/csv',
  },
];

const C3_ACTION = {
  href: '/management/new-c3',
  icon: '🧩',
  title: 'New C3 Capability',
  desc: 'Vytvoření nové C3 položky v taxonomii přes POST /taxonomy/c3.',
  meta: 'POST /taxonomy/c3',
};

export default function ManagementPage() {
  const { c3Visible } = useInstallStatus();
  const actions = c3Visible ? [BASE_ACTIONS[0], C3_ACTION, BASE_ACTIONS[1]] : BASE_ACTIONS;

  return (
    <div className={styles.shell}>
      <h1 className={styles.pageTitle}>Content Admin</h1>
      <p className={styles.pageSubtitle}>
        Operativní workspace pro zakládání nových služeb, řízený import dat a volitelné C3 capability workflow.
      </p>

      <div className={styles.cardGrid}>
        {actions.map((action) => (
          <Link key={action.href} href={action.href} className={styles.card}>
            <div className={styles.cardIcon}>{action.icon}</div>
            <div className={styles.cardTitle}>{action.title}</div>
            <div className={styles.cardDesc}>{action.desc}</div>
            <div className={styles.cardMeta}>{action.meta}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

'use client';

import Link from '@/app/components/AppLink';
import { useInstallStatus } from '@/features/install/installStatus';
import styles from './administration.module.css';

const USER_MANAGEMENT_SECTION = {
  title: 'User management',
  cards: [
    {
      href: '/administration/users',
      title: 'User Management',
      desc: 'Zakládání uživatelů, přiřazení rolí User / Content Admin / Admin a správa AD / SSO účtů.',
      icon: '👥',
    },
    {
      href: '/admin/groups',
      title: 'Group Management',
      desc: 'Skupiny definují přístupová práva ke sloupcům a číselníkům Service Catalogue a C3 Taxonomy.',
      icon: '🔐',
    },
    {
      href: '/administration/web',
      title: 'Web',
      desc: 'Nastavení parametrů pro ADFS / SSO trusted-header login a mapování doménových hlaviček.',
      icon: '🌐',
    },
  ],
};

const AUDIT_SECTION = {
  title: 'Audit',
  cards: [
    {
      href: '/import',
      title: 'Import History',
      desc: 'Browse import batches, issue counts and historical import execution details.',
      icon: '📋',
    },
    {
      href: '/admin/import',
      title: 'Import Audit',
      desc: 'Review import audit details, relation parsing outputs and re-parse troubleshooting data.',
      icon: '📥',
    },
    {
      href: '/administration/logs',
      title: 'Audit Logs',
      desc: 'View admin action logs from GET /api/v1/admin/logs.',
      icon: '📜',
    },
  ],
};

const BASE_DATA_MANAGEMENT_CARDS = [
  {
    href: '/admin/installation',
    title: 'Installation & Modules',
    desc: 'Stav instalace, aktivní moduly, repair flow a kontrola release/schema handshake.',
    icon: '🛠️',
  },
  {
    href: '/admin/catalogue-ref',
    title: 'Catalogue Column Edit',
    desc: 'Editace referenčních číselníků Service Catalogue: Service Type, Status, Relation Type, Portfolio Group a dalších tabulek.',
    icon: '🗃️',
  },
];

const C3_DATA_MANAGEMENT_CARDS = [
  {
    href: '/admin/c3-ref',
    title: 'C3 Column Edit',
    desc: 'Editace referenčních číselníků C3 Taxonomy včetně C3 Mapping Type a C3 Capability Domain.',
    icon: '🧩',
  },
  {
    href: '/admin/c3-capability-builder',
    title: 'C3 Capability Builder',
    desc: 'Editace finální C3 Capability Map a nadpisu stránky generované z poster seed dat.',
    icon: '🧱',
  },
];

export default function AdministrationPage() {
  const { c3Visible } = useInstallStatus();
  const sections = [
    USER_MANAGEMENT_SECTION,
    {
      title: 'Data management',
      cards: c3Visible ? [...BASE_DATA_MANAGEMENT_CARDS, ...C3_DATA_MANAGEMENT_CARDS] : BASE_DATA_MANAGEMENT_CARDS,
    },
    AUDIT_SECTION,
  ];

  return (
    <div className={styles.shell}>
      <h1 className={styles.pageTitle}>Administration</h1>
      <p className={styles.pageDesc}>
        System administration pro uživatele, referenční data, audit a provozní správu aplikace.
      </p>

      <div className={styles.sectionList}>
        {sections.map((section) => (
          <section key={section.title} className={styles.section}>
            <div className={styles.sectionHeader}>{section.title}</div>
            <div className={styles.cardGrid}>
              {section.cards.map((card) => (
                <Link key={card.href} href={card.href} className={styles.card}>
                  <span className={styles.cardIcon}>{card.icon}</span>
                  <span className={styles.cardTitle}>{card.title}</span>
                  <span className={styles.cardDesc}>{card.desc}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

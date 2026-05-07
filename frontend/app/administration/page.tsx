'use client';

import Link from '@/app/components/AppLink';
import { useInstallStatus } from '@/features/install/installStatus';
import { useT } from '@/app/i18n/useI18n';
import styles from './administration.module.css';

export default function AdministrationPage() {
  const t = useT();
  const { c3Visible } = useInstallStatus();

  const sections = [
    {
      title: t('administration.section.user_management'),
      cards: [
        {
          href: '/administration/users',
          title: t('administration.card.users.title'),
          desc: t('administration.card.users.desc'),
          icon: '👥',
        },
        {
          href: '/administration/groups',
          title: t('administration.card.groups.title'),
          desc: t('administration.card.groups.desc'),
          icon: '🔐',
        },
        {
          href: '/administration/web',
          title: t('administration.card.web.title'),
          desc: t('administration.card.web.desc'),
          icon: '🌐',
        },
      ],
    },
    {
      title: t('administration.section.data_management'),
      cards: c3Visible
        ? [
            {
              href: '/administration/installation',
              title: t('administration.card.installation.title'),
              desc: t('administration.card.installation.desc'),
              icon: '🛠️',
            },
            {
              href: '/administration/catalogue-ref',
              title: t('administration.card.catalogue_ref.title'),
              desc: t('administration.card.catalogue_ref.desc'),
              icon: '🗃️',
            },
            {
              href: '/administration/c3-ref',
              title: t('administration.card.c3_ref.title'),
              desc: t('administration.card.c3_ref.desc'),
              icon: '🧩',
            },
            {
              href: '/administration/c3-capability-builder',
              title: t('administration.card.c3_builder.title'),
              desc: t('administration.card.c3_builder.desc'),
              icon: '🧱',
            },
          ]
        : [
            {
              href: '/administration/installation',
              title: t('administration.card.installation.title'),
              desc: t('administration.card.installation.desc'),
              icon: '🛠️',
            },
            {
              href: '/administration/catalogue-ref',
              title: t('administration.card.catalogue_ref.title'),
              desc: t('administration.card.catalogue_ref.desc'),
              icon: '🗃️',
            },
          ],
    },
    {
      title: t('administration.section.audit'),
      cards: [
        {
          href: '/import',
          title: t('administration.card.import_history.title'),
          desc: t('administration.card.import_history.desc'),
          icon: '📋',
        },
        {
          href: '/administration/import',
          title: t('administration.card.import_audit.title'),
          desc: t('administration.card.import_audit.desc'),
          icon: '📥',
        },
        {
          href: '/administration/logs',
          title: t('administration.card.audit_logs.title'),
          desc: t('administration.card.audit_logs.desc'),
          icon: '📜',
        },
      ],
    },
  ];

  return (
    <div className={styles.shell}>
      <h1 className={styles.pageTitle}>{t('administration.title')}</h1>
      <p className={styles.pageDesc}>{t('administration.subtitle')}</p>

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

'use client';

import Link from '@/app/components/AppLink';
import { useT } from '@/app/i18n/useI18n';
import { useInstallStatus } from '@/features/install/installStatus';
import styles from './administration/administration.module.css';
import { C3_ROUTES } from './lib/c3Routes';

export default function HomePage() {
  const t = useT();
  const { c3Visible } = useInstallStatus();
  const cards = c3Visible
    ? [
        {
          href: '/catalogue',
          title: t('home.card.service_catalogue.title'),
          desc: t('home.card.service_catalogue.desc'),
          icon: '🧭',
        },
        {
          href: '/c3/dashboard',
          title: t('home.card.c3_taxonomy.title'),
          desc: t('home.card.c3_taxonomy.desc'),
          icon: '🧩',
        },
        {
          href: C3_ROUTES.capabilityMapSpiral7,
          title: t('home.card.c3_dashboard.title'),
          desc: t('home.card.c3_dashboard.desc'),
          icon: '🗺',
        },
        {
          href: C3_ROUTES.fmnAirC2,
          title: 'FMN Air C2 Coverage',
          desc: 'Vyhodnocení pokrytí aplikací proti FMN Spiral 5 Air požadavkům.',
          icon: '✈️',
        },
      ]
    : [
        {
          href: '/catalogue',
          title: t('home.card.service_catalogue.title'),
          desc: t('home.card.service_catalogue.desc'),
          icon: '🧭',
        },
      ];

  return (
    <div className={styles.shell}>
      <h1 className={styles.pageTitle}>{t('home.title')}</h1>
      <p className={styles.pageDesc}>{t('home.subtitle')}</p>
      <div className={styles.homeCardGrid}>
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className={styles.card}>
            <span className={styles.cardIcon}>{card.icon}</span>
            <span className={styles.cardTitle}>{card.title}</span>
            <span className={styles.cardDesc}>{card.desc}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

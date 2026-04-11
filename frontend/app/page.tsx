'use client';

import Link from '@/app/components/AppLink';
import { useInstallStatus } from '@/features/install/installStatus';
import styles from './administration/administration.module.css';
import { C3_ROUTES } from './lib/c3Routes';

const BASE_CARDS = [
  {
    href: '/services/dashboard',
    title: 'Service Catalogue',
    desc: 'Přehled služeb, KPI a navigace do seznamu a grafu Service Catalogue.',
    icon: '🧭',
  },
];

const C3_CARDS = [
  {
    href: '/c3/dashboard',
    title: 'C3 Taxonomy',
    desc: 'Dashboard C3 taxonomie, kategorií a navigace do C3 seznamů.',
    icon: '🧩',
  },
  {
    href: C3_ROUTES.capabilityMapSpiral7,
    title: 'C3 Dashboard',
    desc: 'Vizualizace C3 Capability Map.',
    icon: '🗺',
  },
];

export default function HomePage() {
  const { c3Visible } = useInstallStatus();
  const cards = c3Visible ? [...BASE_CARDS, ...C3_CARDS] : BASE_CARDS;

  return (
    <div className={styles.shell}>
      <h1 className={styles.pageTitle}>Service Catalogue</h1>
      <p className={styles.pageDesc}>
        Hlavní rozcestník po přihlášení. Vyber si dostupné moduly aplikace podle aktivované instalace.
      </p>
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

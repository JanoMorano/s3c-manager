/**
 * Admin — Catalogue Column Edit
 * Reference table editor for all Service Catalogue lookup tables.
 * Uses the generic RefTableEditor backed by /api/v1/ref/:table
 */
'use client';

import { useState } from 'react';
import Link from '@/app/components/AppLink';
import { useT } from '@/app/i18n/useI18n';
import { RefTableEditor } from '@/features/admin/components/RefTableEditor';
import styles from '../../admin/ref.module.css';

const CORE_CATALOGUE_TABLES = [
  'ref_ServiceType',
  'ref_ServiceStatus',
  'ref_RelationType',
  'ref_PortfolioGroup',
  'ref_ServiceLine',
  'ref_NetworkDomain',
  'ref_SecurityClassification',
  'ref_SupportWindow',
  'ref_ServiceRole',
] as const;

const LEGACY_CATALOGUE_TABLES = [
  'ref_GlobalServiceGroup',
  'ref_OrganizationalElement',
  'ref_FlavourStatus',
  'ref_PaceCategory',
] as const;

type CatTable = typeof CORE_CATALOGUE_TABLES[number] | typeof LEGACY_CATALOGUE_TABLES[number];

const TABLE_LABEL_KEYS: Record<CatTable, string> = {
  ref_ServiceType:            'administration.catalogue_ref.table.service_type',
  ref_ServiceStatus:          'administration.catalogue_ref.table.service_status',
  ref_RelationType:           'administration.catalogue_ref.table.relation_type',
  ref_PortfolioGroup:         'administration.catalogue_ref.table.portfolio_group',
  ref_GlobalServiceGroup:     'administration.catalogue_ref.table.global_service_group',
  ref_ServiceLine:            'administration.catalogue_ref.table.service_line',
  ref_OrganizationalElement:  'administration.catalogue_ref.table.organizational_element',
  ref_NetworkDomain:          'administration.catalogue_ref.table.network_domain',
  ref_SecurityClassification: 'administration.catalogue_ref.table.security_classification',
  ref_SupportWindow:          'administration.catalogue_ref.table.support_window',
  ref_FlavourStatus:          'administration.catalogue_ref.table.legacy_variant_status',
  ref_ServiceRole:            'administration.catalogue_ref.table.service_role',
  ref_PaceCategory:           'administration.catalogue_ref.table.pace_category',
};

function isLegacyTable(table: CatTable) {
  return (LEGACY_CATALOGUE_TABLES as readonly CatTable[]).includes(table);
}

export default function CatalogueRefPage() {
  const t = useT();
  const [activeTable, setActiveTable] = useState<CatTable>(CORE_CATALOGUE_TABLES[0]);

  return (
    <div className={styles.shell}>
      <div className={styles.pageHeader}>
        <Link href="/administration" className={styles.pageBack}>← {t('nav.administration')}</Link>
        <h1 className={styles.pageTitle}>{t('administration.card.catalogue_ref.title')}</h1>
      </div>
      <p className={styles.pageSub}>
        {t('administration.catalogue_ref.subtitle')}
      </p>

      <div className={styles.tabs} aria-label={t('administration.catalogue_ref.core_tabs_aria')}>
        {CORE_CATALOGUE_TABLES.map(table => (
          <button
            key={table}
            className={`${styles.tab} ${activeTable === table ? styles.tabActive : ''}`}
            onClick={() => setActiveTable(table)}
            aria-pressed={activeTable === table}
          >
            {t(TABLE_LABEL_KEYS[table])}
          </button>
        ))}
      </div>

      <details className={styles.advancedRefGroup} open={isLegacyTable(activeTable)}>
        <summary className={styles.advancedRefSummary}>
          <span>{t('administration.catalogue_ref.legacy_title')}</span>
          <small>{t('administration.catalogue_ref.legacy_hint')}</small>
        </summary>
        <div className={styles.tabs} aria-label={t('administration.catalogue_ref.legacy_tabs_aria')}>
          {LEGACY_CATALOGUE_TABLES.map(table => (
            <button
              key={table}
              className={`${styles.tab} ${activeTable === table ? styles.tabActive : ''}`}
              onClick={() => setActiveTable(table)}
              aria-pressed={activeTable === table}
            >
              {t(TABLE_LABEL_KEYS[table])}
            </button>
          ))}
        </div>
      </details>

      {/* Editor */}
      <RefTableEditor table={activeTable} />
    </div>
  );
}

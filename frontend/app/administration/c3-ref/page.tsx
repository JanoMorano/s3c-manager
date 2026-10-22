/**
 * Admin — C3 Column Edit
 * Reference table editor for the C3 Taxonomy database.
 *
 * Covers:
 *  - ref_C3MappingType
 *  - ref_C3CapabilityDomain
 *  - C3 entity lists: Data Objects, Applications, Services, Technology Interactions
 *  - Notes on inline values item_type and item_status (defined as CHECK constraints)
 */
'use client';

import { useState } from 'react';
import Link from '@/app/components/AppLink';
import { useT } from '@/app/i18n/useI18n';
import { RefTableEditor } from '@/features/admin/components/RefTableEditor';
import { C3EntityListPage } from '../../admin/c3-entities/C3EntityListPage';
import {
  c3ApplicationsConfig,
  c3DataObjectsConfig,
  c3ServicesConfig,
  c3TechnologyInteractionsConfig,
} from '../../admin/c3-entities/config';
import {
  buildEntityEditHref,
  publicC3ApplicationsConfig,
  publicC3DataObjectsConfig,
  publicC3ServicesConfig,
  publicC3TechnologyInteractionsConfig,
} from '../../c3-entities/public-config';
import styles from '../../admin/ref.module.css';

// Reference tables exposed via /api/v1/ref (whitelisted in middleware)
const C3_REF_TABLES = [
  'ref_C3MappingType',
  'ref_C3CapabilityDomain',
] as const;

type C3Table = typeof C3_REF_TABLES[number];

const TABLE_LABEL_KEYS: Record<C3Table, string> = {
  ref_C3MappingType: 'administration.c3_ref.table.mapping_type',
  ref_C3CapabilityDomain: 'administration.c3_ref.table.capability_domain',
};

// Inline (hardcoded) enumerations — not stored in ref tables, displayed for reference only
const INLINE_ENUMS = [
  {
    key:      'item_type',
    labelKey: 'administration.c3_ref.inline.item_type.label',
    descKey:  'administration.c3_ref.inline.item_type.desc',
    values: [
      { code: 'BusinessProcess',       descKey: 'administration.c3_ref.inline.item_type.business_process' },
      { code: 'CapabilityRequirement', descKey: 'administration.c3_ref.inline.item_type.capability_requirement' },
      { code: 'UserActivity',          descKey: 'administration.c3_ref.inline.item_type.user_activity' },
      { code: 'CIOrComponent',         descKey: 'administration.c3_ref.inline.item_type.ci_or_component' },
      { code: 'ComplianceControl',     descKey: 'administration.c3_ref.inline.item_type.compliance_control' },
    ],
  },
  {
    key:      'item_status',
    labelKey: 'administration.c3_ref.inline.item_status.label',
    descKey:  'administration.c3_ref.inline.item_status.desc',
    values: [
      { code: 'active',      descKey: 'administration.c3_ref.inline.item_status.active' },
      { code: 'deprecated',  descKey: 'administration.c3_ref.inline.item_status.deprecated' },
      { code: 'proposed',    descKey: 'administration.c3_ref.inline.item_status.proposed' },
    ],
  },
];

type C3RefTab = C3Table | 'data_objects' | 'applications' | 'services' | 'technology_interactions' | 'inline';

export default function C3RefPage() {
  const t = useT();
  const [activeTab, setActiveTab] = useState<C3RefTab>(C3_REF_TABLES[0]);

  return (
    <div className={styles.shell}>
      <div className={styles.pageHeader}>
        <Link href="/administration" className={styles.pageBack}>← {t('nav.administration')}</Link>
        <h1 className={styles.pageTitle}>{t('administration.card.c3_ref.title')}</h1>
      </div>
      <p className={styles.pageSub}>
        {t('administration.c3_ref.subtitle')}
      </p>

      {/* Tabs */}
      <div className={styles.tabs}>
        {C3_REF_TABLES.map(table => (
          <button
            key={table}
            className={`${styles.tab} ${activeTab === table ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(table)}
          >
            {t(TABLE_LABEL_KEYS[table])}
          </button>
        ))}
        <button
          className={`${styles.tab} ${activeTab === 'data_objects' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('data_objects')}
        >
          {t('administration.c3_ref.tab.data_objects')}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'applications' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('applications')}
        >
          {t('administration.c3_ref.tab.applications')}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'services' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('services')}
        >
          {t('administration.c3_ref.tab.services')}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'technology_interactions' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('technology_interactions')}
        >
          {t('administration.c3_ref.tab.technology_interactions')}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'inline' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('inline')}
        >
          {t('administration.c3_ref.tab.inline')}
        </button>
      </div>

      {/* Editor, entity lists or inline enum overview */}
      {activeTab === 'ref_C3MappingType' && <RefTableEditor table="ref_C3MappingType" />}
      {activeTab === 'ref_C3CapabilityDomain' && <RefTableEditor table="ref_C3CapabilityDomain" />}
      {activeTab === 'data_objects' && <C3EntityListPage {...c3DataObjectsConfig} embedded rowEditHref={(row) => buildEntityEditHref(publicC3DataObjectsConfig, row)} />}
      {activeTab === 'applications' && <C3EntityListPage {...c3ApplicationsConfig} embedded rowEditHref={(row) => buildEntityEditHref(publicC3ApplicationsConfig, row)} />}
      {activeTab === 'services' && <C3EntityListPage {...c3ServicesConfig} embedded rowEditHref={(row) => buildEntityEditHref(publicC3ServicesConfig, row)} />}
      {activeTab === 'technology_interactions' && <C3EntityListPage {...c3TechnologyInteractionsConfig} embedded rowEditHref={(row) => buildEntityEditHref(publicC3TechnologyInteractionsConfig, row)} />}
      {activeTab === 'inline' && <InlineEnumView />}
    </div>
  );
}

// ── Inline enum overview (read-only) ─────────────────────────────────────────
function InlineEnumView() {
  const t = useT();
  return (
    <div>
      {INLINE_ENUMS.map(en => (
        <div key={en.key} className={styles.editorPanel} style={{ marginBottom: 'var(--space-5)' }}>
          <div className={styles.editorToolbar}>
            <span className={styles.editorTitle}>{t(en.labelKey)}</span>
            <span className={styles.editorMeta}>{t('administration.c3_ref.inline.check_constraint_meta')}</span>
          </div>
          <div style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'color-mix(in srgb, var(--color-warning) 8%, var(--color-bg-surface))',
            borderBottom: '1px solid var(--color-border-default)',
            font: 'var(--text-body-sm)',
            color: 'var(--color-text-muted)',
          }}>
            ⚠ {t(en.descKey)}
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.refTable}>
              <thead>
                <tr>
                  <th>{t('administration.c3_ref.inline.column_code')}</th>
                  <th>{t('administration.c3_ref.inline.column_description')}</th>
                </tr>
              </thead>
              <tbody>
                {en.values.map(v => (
                  <tr key={v.code}>
                    <td className={styles.tdCode}><code>{v.code}</code></td>
                    <td>{t(v.descKey)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

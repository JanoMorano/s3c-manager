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

const TABLE_LABELS: Record<C3Table, string> = {
  ref_C3MappingType: 'C3 Mapping Type',
  ref_C3CapabilityDomain: 'C3 Capability Domain',
};

// Inline (hardcoded) enumerations — not stored in ref tables, displayed for reference only
const INLINE_ENUMS = [
  {
    key:   'item_type',
    label: 'C3 Item Type',
    desc:  'Typ C3 schopnosti. Definovaný jako CHECK constraint v DB — nelze editovat bez změny schématu.',
    values: [
      { code: 'BusinessProcess',    desc: 'Byznys proces' },
      { code: 'CapabilityRequirement', desc: 'Byznys požadavek' },
      { code: 'UserActivity',       desc: 'Uživatelská aktivita' },
      { code: 'CIOrComponent',      desc: 'CI nebo komponenta' },
      { code: 'ComplianceControl',  desc: 'Compliance kontrola' },
    ],
  },
  {
    key:   'item_status',
    label: 'C3 Item Status',
    desc:  'Stav C3 položky. Definovaný jako CHECK constraint v DB — nelze editovat bez změny schématu.',
    values: [
      { code: 'active',      desc: 'Aktivní' },
      { code: 'deprecated',  desc: 'Zastaralý' },
      { code: 'proposed',    desc: 'Navrhovaný' },
    ],
  },
];

type C3RefTab = C3Table | 'data_objects' | 'applications' | 'services' | 'technology_interactions' | 'inline';

export default function C3RefPage() {
  const [activeTab, setActiveTab] = useState<C3RefTab>(C3_REF_TABLES[0]);

  return (
    <div className={styles.shell}>
      <div className={styles.pageHeader}>
        <Link href="/administration" className={styles.pageBack}>← Administration</Link>
        <h1 className={styles.pageTitle}>C3 Column Edit</h1>
      </div>
      <p className={styles.pageSub}>
        Editace referenčních číselníků databáze C3 Taxonomy stejným způsobem jako v Catalogue Column Edit.
        Záložky C3 entit (Data Objects, Applications, Services, Technology Interactions) umožňují prohlížet
        a spravovat entity importované do katalogu přes plný editor. Inline enumerace `item_type` a `item_status` zůstávají
        read-only, protože jsou definované DB constrainty.
      </p>

      {/* Tabs */}
      <div className={styles.tabs}>
        {C3_REF_TABLES.map(table => (
          <button
            key={table}
            className={`${styles.tab} ${activeTab === table ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(table)}
          >
            {TABLE_LABELS[table]}
          </button>
        ))}
        <button
          className={`${styles.tab} ${activeTab === 'data_objects' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('data_objects')}
        >
          Data Objects
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'applications' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('applications')}
        >
          Applications
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'services' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('services')}
        >
          Services
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'technology_interactions' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('technology_interactions')}
        >
          Technology Interactions
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'inline' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('inline')}
        >
          Inline enumerace (read-only)
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
  return (
    <div>
      {INLINE_ENUMS.map(en => (
        <div key={en.key} className={styles.editorPanel} style={{ marginBottom: 'var(--space-5)' }}>
          <div className={styles.editorToolbar}>
            <span className={styles.editorTitle}>{en.label}</span>
            <span className={styles.editorMeta}>CHECK constraint · read-only</span>
          </div>
          <div style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--color-bg-surface)be6',
            borderBottom: '1px solid var(--color-border-default)',
            font: 'var(--text-body-sm)',
            color: 'var(--color-text-muted)',
          }}>
            ⚠ {en.desc}
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.refTable}>
              <thead>
                <tr>
                  <th>Kód</th>
                  <th>Popis</th>
                </tr>
              </thead>
              <tbody>
                {en.values.map(v => (
                  <tr key={v.code}>
                    <td className={styles.tdCode}><code>{v.code}</code></td>
                    <td>{v.desc}</td>
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

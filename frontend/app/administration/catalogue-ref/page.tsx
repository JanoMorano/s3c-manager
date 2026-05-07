/**
 * Admin — Catalogue Column Edit
 * Reference table editor for all Service Catalogue lookup tables.
 * Uses the generic RefTableEditor backed by /api/v1/ref/:table
 */
'use client';

import { useState } from 'react';
import Link from '@/app/components/AppLink';
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

const TABLE_LABELS: Record<CatTable, string> = {
  ref_ServiceType:            'Service Type',
  ref_ServiceStatus:          'Service Status',
  ref_RelationType:           'Relation Type',
  ref_PortfolioGroup:         'Portfolio Group',
  ref_GlobalServiceGroup:     'Global Service Group (legacy)',
  ref_ServiceLine:            'Service Line',
  ref_OrganizationalElement:  'Organizational Element (legacy)',
  ref_NetworkDomain:          'Network Domain',
  ref_SecurityClassification: 'Security Classification',
  ref_SupportWindow:          'Support Window',
  ref_FlavourStatus:          'Legacy Variant Status',
  ref_ServiceRole:            'Service Role',
  ref_PaceCategory:           'PACE Category (legacy)',
};

function isLegacyTable(table: CatTable) {
  return (LEGACY_CATALOGUE_TABLES as readonly CatTable[]).includes(table);
}

export default function CatalogueRefPage() {
  const [activeTable, setActiveTable] = useState<CatTable>(CORE_CATALOGUE_TABLES[0]);

  return (
    <div className={styles.shell}>
      <div className={styles.pageHeader}>
        <Link href="/administration" className={styles.pageBack}>← Administration</Link>
        <h1 className={styles.pageTitle}>Catalogue Column Edit</h1>
      </div>
      <p className={styles.pageSub}>
        Editace referenčních číselníků databáze Service Catalogue.
        Změny se okamžitě projeví ve formulářích a filtrech.
      </p>

      <div className={styles.tabs} aria-label="Core catalogue reference data">
        {CORE_CATALOGUE_TABLES.map(table => (
          <button
            key={table}
            className={`${styles.tab} ${activeTable === table ? styles.tabActive : ''}`}
            onClick={() => setActiveTable(table)}
            aria-pressed={activeTable === table}
          >
            {TABLE_LABELS[table]}
          </button>
        ))}
      </div>

      <details className={styles.advancedRefGroup} open={isLegacyTable(activeTable)}>
        <summary className={styles.advancedRefSummary}>
          <span>Advanced / Legacy reference data</span>
          <small>Use only for historical imports, compatibility evidence, or controlled cleanup.</small>
        </summary>
        <div className={styles.tabs} aria-label="Advanced and legacy catalogue reference data">
          {LEGACY_CATALOGUE_TABLES.map(table => (
            <button
              key={table}
              className={`${styles.tab} ${activeTable === table ? styles.tabActive : ''}`}
              onClick={() => setActiveTable(table)}
              aria-pressed={activeTable === table}
            >
              {TABLE_LABELS[table]}
            </button>
          ))}
        </div>
      </details>

      {/* Editor */}
      <RefTableEditor table={activeTable} />
    </div>
  );
}

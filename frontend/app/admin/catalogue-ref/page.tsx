/**
 * Admin — Catalogue Column Edit
 * Reference table editor for all Service Catalogue lookup tables.
 * Uses the generic RefTableEditor backed by /api/v1/ref/:table
 */
'use client';

import Link from '@/app/components/AppLink';
import { RefTableEditor } from '@/features/admin/components/RefTableEditor';
import styles from '../ref.module.css';

const CATALOGUE_TABLES = [
  'ref_ServiceType',
  'ref_ServiceStatus',
  'ref_RelationType',
  'ref_PortfolioGroup',
  'ref_GlobalServiceGroup',
  'ref_ServiceLine',
  'ref_OrganizationalElement',
  'ref_NetworkDomain',
  'ref_SecurityClassification',
  'ref_SupportWindow',
  'ref_FlavourStatus',
  'ref_ServiceRole',
  'ref_PaceCategory',
] as const;

type CatTable = typeof CATALOGUE_TABLES[number];

const TABLE_LABELS: Record<CatTable, string> = {
  ref_ServiceType:            'Service Type',
  ref_ServiceStatus:          'Service Status',
  ref_RelationType:           'Relation Type',
  ref_PortfolioGroup:         'Portfolio Group',
  ref_GlobalServiceGroup:     'Global Service Group',
  ref_ServiceLine:            'Service Line',
  ref_OrganizationalElement:  'Organizational Element',
  ref_NetworkDomain:          'Network Domain',
  ref_SecurityClassification: 'Security Classification',
  ref_SupportWindow:          'Support Window',
  ref_FlavourStatus:          'Flavour Status',
  ref_ServiceRole:            'Service Role',
  ref_PaceCategory:           'PACE Category',
};

import { useState } from 'react';

export default function CatalogueRefPage() {
  const [activeTable, setActiveTable] = useState<CatTable>(CATALOGUE_TABLES[0]);

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

      {/* Tabs */}
      <div className={styles.tabs}>
        {CATALOGUE_TABLES.map(table => (
          <button
            key={table}
            className={`${styles.tab} ${activeTable === table ? styles.tabActive : ''}`}
            onClick={() => setActiveTable(table)}
          >
            {TABLE_LABELS[table]}
          </button>
        ))}
      </div>

      {/* Editor */}
      <RefTableEditor table={activeTable} />
    </div>
  );
}

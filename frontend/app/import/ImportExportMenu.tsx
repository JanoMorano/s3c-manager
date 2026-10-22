/**
 * Import page "Export" menu — one secondary control that holds the contract
 * info, the import/export profile and every export/report download.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from '@/app/components/AppLink';
import useSWR from 'swr';
import { apiFetch } from '@/features/services/api/services.api';
import { useI18n } from '@/app/i18n/useI18n';
import { helpIndexHref } from '@/app/lib/helpRoutes';
import styles from './import.module.css';

interface ExportManifestResponse {
  contract_version: string;
  schema_version: string;
}

interface ImportProfile {
  key: string;
  label: string;
  mode: string;
  required_fields: string[];
  description?: string;
}

const DOWNLOADS: Array<{ href: string; labelKey: string }> = [
  { href: '/api/v1/export/bundle', labelKey: 'administration.import.export_bundle' },
  { href: '/api/v1/export/manifest', labelKey: 'administration.import.export_manifest' },
  { href: '/api/v1/export/governance-report', labelKey: 'administration.import.governance_report' },
  { href: '/api/v1/export/capabilities/coverage', labelKey: 'administration.import.capability_coverage_export' },
  { href: '/api/v1/export/backstage/catalog-info', labelKey: 'administration.import.backstage_catalog_info' },
];

export default function ImportExportMenu() {
  const { locale, t } = useI18n();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [selectedProfileKey, setSelectedProfileKey] = useState('s3c-service-catalogue-json');

  const { data: manifest } = useSWR<ExportManifestResponse>('/api/v1/export/manifest?scope=import', apiFetch, { revalidateOnFocus: false });
  const { data: profiles } = useSWR<{ items: ImportProfile[] }>('/api/v1/import/profiles', apiFetch, { revalidateOnFocus: false });
  const selectedProfile = (profiles?.items ?? []).find((profile) => profile.key === selectedProfileKey) ?? profiles?.items?.[0];

  // Close the popover on an outside click or Escape.
  useEffect(() => {
    const close = (event: MouseEvent | KeyboardEvent) => {
      const menu = menuRef.current;
      if (!menu?.open) return;
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !menu.contains(event.target as Node)) {
        menu.open = false;
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, []);

  return (
    <details ref={menuRef} className={styles.exportMenu}>
      <summary className={styles.secondaryBtn}>{t('service_graph.text.export')} ▾</summary>
      <div className={styles.exportPanel}>
        {(manifest?.contract_version || manifest?.schema_version) && (
          <p className={styles.exportMeta}>
            {[
              manifest?.contract_version ? t('administration.import.contract_version', { version: manifest.contract_version }) : null,
              manifest?.schema_version ? t('administration.import.schema_version', { version: manifest.schema_version }) : null,
            ].filter(Boolean).join(' · ')}
          </p>
        )}

        <label className={styles.exportField}>
          <span>{t('administration.import.profile_label')}</span>
          <select
            aria-label={t('administration.import.profile_label')}
            value={selectedProfileKey}
            onChange={(event) => setSelectedProfileKey(event.target.value)}
          >
            {(profiles?.items ?? []).map((profile) => (
              <option key={profile.key} value={profile.key}>{profile.label}</option>
            ))}
          </select>
        </label>
        <div className={styles.exportProfile}>
          <span>{selectedProfile?.description ?? t('administration.import.profile_default_description')}</span>
          <div className={styles.fieldList}>
            {(selectedProfile?.required_fields ?? ['service_id', 'title']).map((field) => (
              <code key={field}>{field}</code>
            ))}
          </div>
        </div>

        <ul className={styles.exportLinks}>
          {DOWNLOADS.map((item) => (
            <li key={item.href}><a href={item.href}>{t(item.labelKey)}</a></li>
          ))}
          <li><Link href={`${helpIndexHref(locale)}#data`}>{t('administration.import.integration_mappings')}</Link></li>
        </ul>
      </div>
    </details>
  );
}

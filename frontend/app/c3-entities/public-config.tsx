'use client';

import Link from '@/app/components/AppLink';
import styles from '../admin/c3-entities/entity-list.module.css';
import type { ColumnDef, EditFieldDef } from '../admin/c3-entities/C3EntityListPage';
import {
  c3ApplicationsConfig,
  c3DataObjectsConfig,
  c3ServicesConfig,
  c3TechnologyInteractionsConfig,
} from '../admin/c3-entities/config';

type LinkTargetKind = 'services' | 'applications' | 'data-objects';

interface LinkFieldDef {
  key: string;
  label: string;
  target: LinkTargetKind;
}

export interface PublicC3EntityConfig {
  title: string;
  subtitle: string;
  endpoint: string;
  exactSearchKeys: string[];
  columns: ColumnDef[];
  codeKey: string;
  codeLabel: string;
  listPath: string;
  detailBasePath: string;
  editBasePath: string;
  detailEndpointBase: string;
  editEndpoint: string;
  metadataKeys: string[];
  descriptionKeys: string[];
  rawKeys: string[];
  editFields: EditFieldDef[];
  linkFields?: LinkFieldDef[];
  labels: Record<string, string>;
}

export function filterPublicColumnsByRole(columns: ColumnDef[], isAdmin: boolean) {
  return isAdmin ? columns : columns.filter((column) => column.key !== 'uuid');
}

function normalize(value: unknown) {
  return String(value ?? '').trim();
}

function withDetailLinks(columns: ColumnDef[], codeKey: string, detailBasePath: string): ColumnDef[] {
  return columns.map((column) => {
    if (column.key !== codeKey && column.key !== 'title') return column;
    return {
      ...column,
      render: (row) => {
        const code = normalize(row[codeKey]);
        const value = normalize(row[column.key]);
        if (!code || !value) return value || '—';
        return (
          <Link href={`${detailBasePath}/${encodeURIComponent(code)}`} className={styles.cellLink}>
            {value}
          </Link>
        );
      },
    };
  });
}

function buildLabels(columns: ColumnDef[]) {
  return columns.reduce<Record<string, string>>((acc, column) => {
    acc[column.key] = column.label;
    return acc;
  }, {});
}

function buildPublicConfig(
  base: {
    title: string;
    subtitle: string;
    endpoint: string;
    exactSearchKeys: string[];
    columns: ColumnDef[];
    editFields: EditFieldDef[];
  },
  options: Omit<PublicC3EntityConfig, 'title' | 'subtitle' | 'endpoint' | 'exactSearchKeys' | 'columns' | 'editFields' | 'labels'>
): PublicC3EntityConfig {
  const columns = withDetailLinks(base.columns, options.codeKey, options.detailBasePath);
  return {
    title: base.title,
    subtitle: base.subtitle,
    endpoint: base.endpoint,
    exactSearchKeys: base.exactSearchKeys,
    columns,
    editFields: base.editFields,
    labels: buildLabels(base.columns),
    ...options,
  };
}

export function buildEntityEditHref(config: PublicC3EntityConfig, row: Record<string, unknown>) {
  const code = normalize(row[config.codeKey]);
  if (!code) return config.listPath;
  return `${config.editBasePath}/${encodeURIComponent(code)}/edit`;
}

export function renderLinkedJsonList(value: unknown, target: LinkTargetKind) {
  const basePath = target === 'services'
    ? '/c3/services'
    : target === 'applications'
      ? '/c3/applications'
      : '/c3/data-objects';

  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value) as Array<{ code?: string; title?: string }>;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return (
      <div className={styles.cellStack}>
        {parsed.map((item, index) => {
          const code = normalize(item.code);
          const title = normalize(item.title);
          const label = code && title ? `${code} — ${title}` : code || title || `Link ${index + 1}`;
          return code ? (
            <Link key={`${code}-${index}`} href={`${basePath}/${encodeURIComponent(code)}`} className={styles.cellLink}>
              {label}
            </Link>
          ) : (
            <span key={`${label}-${index}`} className={styles.cellText}>{label}</span>
          );
        })}
      </div>
    );
  } catch {
    return null;
  }
}

export const publicC3DataObjectsConfig = buildPublicConfig(c3DataObjectsConfig, {
  codeKey: 'data_object_code',
  codeLabel: 'Data Object',
  listPath: '/c3/data-objects',
  detailBasePath: '/c3/data-objects',
  editBasePath: '/c3/data-objects',
  detailEndpointBase: '/api/v1/taxonomy/c3-data-objects',
  editEndpoint: '/api/v1/taxonomy/c3-data-objects',
  metadataKeys: ['uuid', 'modification_date', 'order_num', 'ss_overall_status', 'ss_baseline_status', 'item_status'],
  descriptionKeys: ['description'],
  rawKeys: ['provenance_raw', 'references_raw', 'standards_raw'],
});

export const publicC3ApplicationsConfig = buildPublicConfig(c3ApplicationsConfig, {
  codeKey: 'application_code',
  codeLabel: 'Application',
  listPath: '/c3/applications',
  detailBasePath: '/c3/applications',
  editBasePath: '/c3/applications',
  detailEndpointBase: '/api/v1/taxonomy/c3-applications',
  editEndpoint: '/api/v1/taxonomy/c3-application',
  metadataKeys: [
    'uuid',
    'modification_date',
    'order_num',
    'ss_overall_status',
    'ss_baseline_status',
    'item_status',
    'data_source',
    'external_id',
    'data_qualifier',
    'revised',
  ],
  descriptionKeys: ['source_description', 'revised_description', 'description'],
  rawKeys: [],
});

export const publicC3ServicesConfig = buildPublicConfig(c3ServicesConfig, {
  codeKey: 'service_code',
  codeLabel: 'Service',
  listPath: '/c3/services',
  detailBasePath: '/c3/services',
  editBasePath: '/c3/services',
  detailEndpointBase: '/api/v1/taxonomy/c3-services',
  editEndpoint: '/api/v1/taxonomy/c3-services',
  metadataKeys: [
    'uuid',
    'modification_date',
    'order_num',
    'ss_overall_status',
    'ss_baseline_status',
    'item_status',
    'data_source',
    'external_id',
    'data_qualifier',
    'revised',
  ],
  descriptionKeys: ['source_description', 'revised_description', 'description'],
  rawKeys: [],
});

export const publicC3TechnologyInteractionsConfig = buildPublicConfig(c3TechnologyInteractionsConfig, {
  codeKey: 'technology_interaction_code',
  codeLabel: 'Technology Interaction',
  listPath: '/c3/technology-interactions',
  detailBasePath: '/c3/technology-interactions',
  editBasePath: '/c3/technology-interactions',
  detailEndpointBase: '/api/v1/taxonomy/c3-technology-interactions',
  editEndpoint: '/api/v1/taxonomy/c3-technology-interactions',
  metadataKeys: [
    'uuid',
    'modification_date',
    'order_num',
    'ss_overall_status',
    'ss_baseline_status',
    'item_status',
    'ciav_review_status',
    'mcsma_review_status',
    'technology_interaction_type',
    'technology_interaction_maturity',
  ],
  descriptionKeys: ['service_instructions', 'description', 'conditionality'],
  rawKeys: [
    'technology_interactions_1_raw',
    'services_1_raw',
    'applications_1_raw',
    'services_2_raw',
    'technology_interactions_2_raw',
    'technology_interactions_3_raw',
    'services_3_raw',
    'applications_2_raw',
    'data_objects_raw',
  ],
  linkFields: [
    { key: 'linked_services_json', label: 'Linked C3 Services', target: 'services' },
    { key: 'linked_applications_json', label: 'Linked C3 Applications', target: 'applications' },
    { key: 'linked_data_objects_json', label: 'Linked C3 Data Objects', target: 'data-objects' },
  ],
});

'use client';

import Link from '@/app/components/AppLink';
import { useT } from '@/app/i18n/useI18n';
import styles from './entity-list.module.css';
import type { ColumnDef, EditFieldDef } from './C3EntityListPage';

// title, subtitle and every column/field label are i18n keys; translate them with t() at render time
// (C3EntityListPage does this; other consumers can use translateC3EntityConfig).
interface C3EntityConfig {
  title: string;
  subtitle: string;
  endpoint: string;
  exactSearchKeys: string[];
  columns: ColumnDef[];
  editFields: EditFieldDef[];
}

type Translate = (key: string) => string;

/** Returns a copy of an entity config with title, subtitle, column/field labels and the labels map translated. */
export function translateC3EntityConfig<T extends {
  title: string;
  subtitle: string;
  columns: ColumnDef[];
  editFields: EditFieldDef[];
  labels?: Record<string, string>;
}>(config: T, t: Translate): T {
  return {
    ...config,
    title: t(config.title),
    subtitle: t(config.subtitle),
    columns: config.columns.map((column) => ({ ...column, label: t(column.label) })),
    editFields: config.editFields.map((field) => ({ ...field, label: t(field.label) })),
    ...(config.labels
      ? { labels: Object.fromEntries(Object.entries(config.labels).map(([key, label]) => [key, t(label)])) }
      : {}),
  };
}

interface LinkedEntity {
  id: number;
  code: string;
  uuid: string;
  title: string;
}

export const c3DataObjectsConfig: C3EntityConfig = {
  title: 'c3_entities.data_objects.title',
  subtitle: 'c3_entities.data_objects.subtitle',
  endpoint: '/api/v1/taxonomy/c3-data-objects',
  exactSearchKeys: ['data_object_code', 'uuid'],
  columns: [
    { key: 'data_object_code', label: 'c3_entities.field.data_object_code', mono: true },
    { key: 'uuid', label: 'c3_entities.field.uuid', mono: true },
    { key: 'modification_date', label: 'c3_entities.field.modification_date', render: (row) => renderDateTime(row.modification_date) },
    { key: 'order_num', label: 'c3_entities.field.order_num' },
    { key: 'ss_overall_status', label: 'c3_entities.field.ss_overall_status' },
    { key: 'ss_baseline_status', label: 'c3_entities.field.ss_baseline_status' },
    { key: 'item_status', label: 'c3_entities.field.item_status' },
    { key: 'title', label: 'c3_entities.field.title' },
    { key: 'description', label: 'c3_entities.field.description', render: (row) => renderLongText(row.description) },
    { key: 'provenance_raw', label: 'c3_entities.field.provenance_raw', render: (row) => renderLongText(row.provenance_raw) },
    { key: 'references_raw', label: 'c3_entities.field.references_raw', render: (row) => renderLongText(row.references_raw) },
    { key: 'standards_raw', label: 'c3_entities.field.standards_raw', render: (row) => renderLongText(row.standards_raw) },
  ],
  editFields: [
    { key: 'data_object_code', label: 'c3_entities.field.data_object_code', required: true },
    { key: 'uuid', label: 'c3_entities.field.uuid', required: true },
    { key: 'modification_date', label: 'c3_entities.field.modification_date', type: 'datetime-local' },
    { key: 'order_num', label: 'c3_entities.field.order_num', type: 'number' },
    { key: 'ss_overall_status', label: 'c3_entities.field.ss_overall_status' },
    { key: 'ss_baseline_status', label: 'c3_entities.field.ss_baseline_status' },
    { key: 'item_status', label: 'c3_entities.field.item_status' },
    { key: 'title', label: 'c3_entities.field.title', required: true },
    { key: 'description', label: 'c3_entities.field.description', type: 'textarea' },
    { key: 'provenance_raw', label: 'c3_entities.field.provenance_raw', type: 'textarea' },
    { key: 'references_raw', label: 'c3_entities.field.references_raw', type: 'textarea' },
    { key: 'standards_raw', label: 'c3_entities.field.standards_raw', type: 'textarea' },
  ],
};

export const c3ApplicationsConfig: C3EntityConfig = {
  title: 'c3_entities.applications.title',
  subtitle: 'c3_entities.applications.subtitle',
  endpoint: '/api/v1/taxonomy/c3-application',
  exactSearchKeys: ['application_code', 'uuid'],
  columns: [
    { key: 'application_code', label: 'c3_entities.field.application_code', mono: true },
    { key: 'uuid', label: 'c3_entities.field.uuid', mono: true },
    { key: 'modification_date', label: 'c3_entities.field.modification_date', render: (row) => renderDateTime(row.modification_date) },
    { key: 'order_num', label: 'c3_entities.field.order_num' },
    { key: 'ss_overall_status', label: 'c3_entities.field.ss_overall_status' },
    { key: 'ss_baseline_status', label: 'c3_entities.field.ss_baseline_status' },
    { key: 'item_status', label: 'c3_entities.field.item_status' },
    { key: 'data_source', label: 'c3_entities.field.data_source' },
    { key: 'external_id', label: 'c3_entities.field.external_id', mono: true },
    { key: 'data_qualifier', label: 'c3_entities.field.data_qualifier' },
    { key: 'title', label: 'c3_entities.field.title' },
    { key: 'source_description', label: 'c3_entities.field.source_description', render: (row) => renderLongText(row.source_description) },
    { key: 'revised_description', label: 'c3_entities.field.revised_description', render: (row) => renderLongText(row.revised_description) },
    { key: 'description', label: 'c3_entities.field.description', render: (row) => renderLongText(row.description) },
    { key: 'revised', label: 'c3_entities.field.revised', render: (row) => renderBoolean(row.revised) },
  ],
  editFields: [
    { key: 'application_code', label: 'c3_entities.field.application_code', required: true },
    { key: 'uuid', label: 'c3_entities.field.uuid', required: true },
    { key: 'modification_date', label: 'c3_entities.field.modification_date', type: 'datetime-local' },
    { key: 'order_num', label: 'c3_entities.field.order_num', type: 'number' },
    { key: 'ss_overall_status', label: 'c3_entities.field.ss_overall_status' },
    { key: 'ss_baseline_status', label: 'c3_entities.field.ss_baseline_status' },
    { key: 'item_status', label: 'c3_entities.field.item_status' },
    { key: 'data_source', label: 'c3_entities.field.data_source' },
    { key: 'external_id', label: 'c3_entities.field.external_id' },
    { key: 'data_qualifier', label: 'c3_entities.field.data_qualifier' },
    { key: 'title', label: 'c3_entities.field.title', required: true },
    { key: 'source_description', label: 'c3_entities.field.source_description', type: 'textarea' },
    { key: 'revised_description', label: 'c3_entities.field.revised_description', type: 'textarea' },
    { key: 'description', label: 'c3_entities.field.description', type: 'textarea' },
    { key: 'revised', label: 'c3_entities.field.revised', type: 'checkbox' },
  ],
};

export const c3ServicesConfig: C3EntityConfig = {
  title: 'c3_entities.services.title',
  subtitle: 'c3_entities.services.subtitle',
  endpoint: '/api/v1/taxonomy/c3-services',
  exactSearchKeys: ['service_code', 'uuid'],
  columns: [
    { key: 'service_code', label: 'c3_entities.field.service_code', mono: true },
    { key: 'uuid', label: 'c3_entities.field.uuid', mono: true },
    { key: 'modification_date', label: 'c3_entities.field.modification_date', render: (row) => renderDateTime(row.modification_date) },
    { key: 'order_num', label: 'c3_entities.field.order_num' },
    { key: 'ss_overall_status', label: 'c3_entities.field.ss_overall_status' },
    { key: 'ss_baseline_status', label: 'c3_entities.field.ss_baseline_status' },
    { key: 'item_status', label: 'c3_entities.field.item_status' },
    { key: 'data_source', label: 'c3_entities.field.data_source' },
    { key: 'external_id', label: 'c3_entities.field.external_id', mono: true },
    { key: 'data_qualifier', label: 'c3_entities.field.data_qualifier' },
    { key: 'title', label: 'c3_entities.field.title' },
    { key: 'source_description', label: 'c3_entities.field.source_description', render: (row) => renderLongText(row.source_description) },
    { key: 'revised_description', label: 'c3_entities.field.revised_description', render: (row) => renderLongText(row.revised_description) },
    { key: 'description', label: 'c3_entities.field.description', render: (row) => renderLongText(row.description) },
    { key: 'revised', label: 'c3_entities.field.revised', render: (row) => renderBoolean(row.revised) },
  ],
  editFields: [
    { key: 'service_code', label: 'c3_entities.field.service_code', required: true },
    { key: 'uuid', label: 'c3_entities.field.uuid', required: true },
    { key: 'modification_date', label: 'c3_entities.field.modification_date', type: 'datetime-local' },
    { key: 'order_num', label: 'c3_entities.field.order_num', type: 'number' },
    { key: 'ss_overall_status', label: 'c3_entities.field.ss_overall_status' },
    { key: 'ss_baseline_status', label: 'c3_entities.field.ss_baseline_status' },
    { key: 'item_status', label: 'c3_entities.field.item_status' },
    { key: 'data_source', label: 'c3_entities.field.data_source' },
    { key: 'external_id', label: 'c3_entities.field.external_id' },
    { key: 'data_qualifier', label: 'c3_entities.field.data_qualifier' },
    { key: 'title', label: 'c3_entities.field.title', required: true },
    { key: 'source_description', label: 'c3_entities.field.source_description', type: 'textarea' },
    { key: 'revised_description', label: 'c3_entities.field.revised_description', type: 'textarea' },
    { key: 'description', label: 'c3_entities.field.description', type: 'textarea' },
    { key: 'revised', label: 'c3_entities.field.revised', type: 'checkbox' },
  ],
};

export const c3TechnologyInteractionsConfig: C3EntityConfig = {
  title: 'c3_entities.technology_interactions.title',
  subtitle: 'c3_entities.technology_interactions.subtitle',
  endpoint: '/api/v1/taxonomy/c3-technology-interactions',
  exactSearchKeys: ['technology_interaction_code', 'uuid'],
  columns: [
    { key: 'technology_interaction_code', label: 'c3_entities.field.technology_interaction_code', mono: true },
    { key: 'uuid', label: 'c3_entities.field.uuid', mono: true },
    { key: 'modification_date', label: 'c3_entities.field.modification_date', render: (row) => renderDateTime(row.modification_date) },
    { key: 'order_num', label: 'c3_entities.field.order_num' },
    { key: 'ss_overall_status', label: 'c3_entities.field.ss_overall_status' },
    { key: 'ss_baseline_status', label: 'c3_entities.field.ss_baseline_status' },
    { key: 'item_status', label: 'c3_entities.field.item_status' },
    { key: 'ciav_review_status', label: 'c3_entities.field.ciav_review_status' },
    { key: 'mcsma_review_status', label: 'c3_entities.field.mcsma_review_status' },
    { key: 'service_instructions', label: 'c3_entities.field.service_instructions', render: (row) => renderLongText(row.service_instructions) },
    { key: 'title', label: 'c3_entities.field.title' },
    { key: 'technology_interaction_type', label: 'c3_entities.field.technology_interaction_type' },
    { key: 'technology_interaction_maturity', label: 'c3_entities.field.technology_interaction_maturity' },
    { key: 'technology_interactions_1_raw', label: 'c3_entities.field.technology_interactions_1_raw', render: (row) => renderLongText(row.technology_interactions_1_raw) },
    { key: 'description', label: 'c3_entities.field.description', render: (row) => renderLongText(row.description) },
    { key: 'conditionality', label: 'c3_entities.field.conditionality', render: (row) => renderLongText(row.conditionality) },
    { key: 'services_1_raw', label: 'c3_entities.field.services_1_raw', render: (row) => renderLongText(row.services_1_raw) },
    { key: 'applications_1_raw', label: 'c3_entities.field.applications_1_raw', render: (row) => renderLongText(row.applications_1_raw) },
    { key: 'services_2_raw', label: 'c3_entities.field.services_2_raw', render: (row) => renderLongText(row.services_2_raw) },
    { key: 'technology_interactions_2_raw', label: 'c3_entities.field.technology_interactions_2_raw', render: (row) => renderLongText(row.technology_interactions_2_raw) },
    { key: 'technology_interactions_3_raw', label: 'c3_entities.field.technology_interactions_3_raw', render: (row) => renderLongText(row.technology_interactions_3_raw) },
    { key: 'services_3_raw', label: 'c3_entities.field.services_3_raw', render: (row) => renderLongText(row.services_3_raw) },
    { key: 'applications_2_raw', label: 'c3_entities.field.applications_2_raw', render: (row) => renderLongText(row.applications_2_raw) },
    { key: 'data_objects_raw', label: 'c3_entities.field.data_objects_raw', render: (row) => renderLongText(row.data_objects_raw) },
    {
      key: 'linked_services_json',
      label: 'c3_entities.field.linked_services_json',
      render: (row) => renderReferenceColumn(row.linked_services_json, row.unresolved_service_refs, '/c3/services'),
      sortable: false,
    },
    {
      key: 'linked_applications_json',
      label: 'c3_entities.field.linked_applications_json',
      render: (row) => renderReferenceColumn(row.linked_applications_json, row.unresolved_application_refs, '/c3/applications'),
      sortable: false,
    },
    {
      key: 'linked_data_objects_json',
      label: 'c3_entities.field.linked_data_objects_json',
      render: (row) => renderReferenceColumn(row.linked_data_objects_json, row.unresolved_data_object_refs, '/c3/data-objects'),
      sortable: false,
    },
  ],
  editFields: [
    { key: 'technology_interaction_code', label: 'c3_entities.field.technology_interaction_code', required: true },
    { key: 'uuid', label: 'c3_entities.field.uuid', required: true },
    { key: 'modification_date', label: 'c3_entities.field.modification_date', type: 'datetime-local' },
    { key: 'order_num', label: 'c3_entities.field.order_num', type: 'number' },
    { key: 'ss_overall_status', label: 'c3_entities.field.ss_overall_status' },
    { key: 'ss_baseline_status', label: 'c3_entities.field.ss_baseline_status' },
    { key: 'item_status', label: 'c3_entities.field.item_status' },
    { key: 'ciav_review_status', label: 'c3_entities.field.ciav_review_status' },
    { key: 'mcsma_review_status', label: 'c3_entities.field.mcsma_review_status' },
    { key: 'service_instructions', label: 'c3_entities.field.service_instructions', type: 'textarea' },
    { key: 'title', label: 'c3_entities.field.title', required: true },
    { key: 'technology_interaction_type', label: 'c3_entities.field.technology_interaction_type' },
    { key: 'technology_interaction_maturity', label: 'c3_entities.field.technology_interaction_maturity' },
    { key: 'technology_interactions_1_raw', label: 'c3_entities.field.technology_interactions_1_raw', type: 'textarea' },
    { key: 'description', label: 'c3_entities.field.description', type: 'textarea' },
    { key: 'conditionality', label: 'c3_entities.field.conditionality', type: 'textarea' },
    { key: 'services_1_raw', label: 'c3_entities.field.services_1_raw', type: 'textarea' },
    { key: 'applications_1_raw', label: 'c3_entities.field.applications_1_raw', type: 'textarea' },
    { key: 'services_2_raw', label: 'c3_entities.field.services_2_raw', type: 'textarea' },
    { key: 'technology_interactions_2_raw', label: 'c3_entities.field.technology_interactions_2_raw', type: 'textarea' },
    { key: 'technology_interactions_3_raw', label: 'c3_entities.field.technology_interactions_3_raw', type: 'textarea' },
    { key: 'services_3_raw', label: 'c3_entities.field.services_3_raw', type: 'textarea' },
    { key: 'applications_2_raw', label: 'c3_entities.field.applications_2_raw', type: 'textarea' },
    { key: 'data_objects_raw', label: 'c3_entities.field.data_objects_raw', type: 'textarea' },
  ],
};

function renderLongText(value: unknown) {
  const text = String(value ?? '').trim();
  return text ? <span className={styles.cellText}>{text}</span> : '—';
}

function BooleanLabel({ value }: { value: boolean }) {
  const t = useT();
  return <>{value ? t('common.yes') : t('common.no')}</>;
}

function renderBoolean(value: unknown) {
  if (value == null || value === '') return '—';
  const normalized = typeof value === 'boolean' ? value : ['1', 'true', 'yes', 'y'].includes(String(value).trim().toLowerCase());
  return <BooleanLabel value={normalized} />;
}

function renderDateTime(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('cs-CZ');
}

function parseLinkedEntities(value: unknown): LinkedEntity[] {
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as LinkedEntity[] : [];
  } catch {
    return [];
  }
}

function parseReferenceValues(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return [];
  const seen = new Set<string>();
  return value
    .replace(/\r/g, '\n')
    .split(/[\n;,|]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function renderReferenceColumn(linkedValue: unknown, unresolvedValue: unknown, basePath: string) {
  const linkedItems = parseLinkedEntities(linkedValue);
  const linkedKeys = new Set(linkedItems.map((item) => `${item.code}`.toLowerCase()));
  const unresolvedItems = parseReferenceValues(unresolvedValue).filter((item) => !linkedKeys.has(item.toLowerCase()));

  if (linkedItems.length === 0 && unresolvedItems.length === 0) return '—';

  return (
    <div className={styles.cellStack}>
      {linkedItems.map((item) => (
        <Link
          key={`${item.code}-${item.uuid}`}
          href={item.code ? `${basePath}/${encodeURIComponent(item.code)}` : `${basePath}?exact=${encodeURIComponent(item.uuid)}&search=${encodeURIComponent(item.uuid)}`}
          className={styles.cellLink}
        >
          {item.code} — {item.title}
        </Link>
      ))}
      {unresolvedItems.map((value) => (
        <span key={value} className={styles.cellText}>{value}</span>
      ))}
    </div>
  );
}

'use client';

import Link from '@/app/components/AppLink';
import styles from './entity-list.module.css';
import type { ColumnDef, EditFieldDef } from './C3EntityListPage';

interface C3EntityConfig {
  title: string;
  subtitle: string;
  endpoint: string;
  exactSearchKeys: string[];
  columns: ColumnDef[];
  editFields: EditFieldDef[];
}

interface LinkedEntity {
  id: number;
  code: string;
  uuid: string;
  title: string;
}

export const c3DataObjectsConfig: C3EntityConfig = {
  title: 'C3 Data Objects',
  subtitle: 'Editovatelný seznam importovaných C3 Data Objects.',
  endpoint: '/api/v1/taxonomy/c3-data-objects',
  exactSearchKeys: ['data_object_code', 'uuid'],
  columns: [
    { key: 'data_object_code', label: 'Data Object', mono: true },
    { key: 'uuid', label: 'UUID', mono: true },
    { key: 'modification_date', label: 'Modification date', render: (row) => renderDateTime(row.modification_date) },
    { key: 'order_num', label: 'Order' },
    { key: 'ss_overall_status', label: 'SS overall status' },
    { key: 'ss_baseline_status', label: 'SS baseline status' },
    { key: 'item_status', label: 'Item status' },
    { key: 'title', label: 'Title' },
    { key: 'description', label: 'Description', render: (row) => renderLongText(row.description) },
    { key: 'provenance_raw', label: 'Provenance', render: (row) => renderLongText(row.provenance_raw) },
    { key: 'references_raw', label: 'References', render: (row) => renderLongText(row.references_raw) },
    { key: 'standards_raw', label: 'Standards', render: (row) => renderLongText(row.standards_raw) },
  ],
  editFields: [
    { key: 'data_object_code', label: 'Data Object', required: true },
    { key: 'uuid', label: 'UUID', required: true },
    { key: 'modification_date', label: 'Modification date', type: 'datetime-local' },
    { key: 'order_num', label: 'Order', type: 'number' },
    { key: 'ss_overall_status', label: 'SS overall status' },
    { key: 'ss_baseline_status', label: 'SS baseline status' },
    { key: 'item_status', label: 'Item status' },
    { key: 'title', label: 'Title', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'provenance_raw', label: 'Provenance', type: 'textarea' },
    { key: 'references_raw', label: 'References', type: 'textarea' },
    { key: 'standards_raw', label: 'Standards', type: 'textarea' },
  ],
};

export const c3ApplicationsConfig: C3EntityConfig = {
  title: 'C3 Applications',
  subtitle: 'Editovatelný seznam importovaných C3 Applications.',
  endpoint: '/api/v1/taxonomy/c3-application',
  exactSearchKeys: ['application_code', 'uuid'],
  columns: [
    { key: 'application_code', label: 'Application', mono: true },
    { key: 'uuid', label: 'UUID', mono: true },
    { key: 'modification_date', label: 'Modification date', render: (row) => renderDateTime(row.modification_date) },
    { key: 'order_num', label: 'Order' },
    { key: 'ss_overall_status', label: 'SS overall status' },
    { key: 'ss_baseline_status', label: 'SS baseline status' },
    { key: 'item_status', label: 'Item status' },
    { key: 'data_source', label: 'Data source' },
    { key: 'external_id', label: 'External id', mono: true },
    { key: 'data_qualifier', label: 'Data qualifier' },
    { key: 'title', label: 'Title' },
    { key: 'source_description', label: 'Source description', render: (row) => renderLongText(row.source_description) },
    { key: 'revised_description', label: 'Revised description', render: (row) => renderLongText(row.revised_description) },
    { key: 'description', label: 'Description', render: (row) => renderLongText(row.description) },
    { key: 'revised', label: 'Revised', render: (row) => renderBoolean(row.revised) },
  ],
  editFields: [
    { key: 'application_code', label: 'Application', required: true },
    { key: 'uuid', label: 'UUID', required: true },
    { key: 'modification_date', label: 'Modification date', type: 'datetime-local' },
    { key: 'order_num', label: 'Order', type: 'number' },
    { key: 'ss_overall_status', label: 'SS overall status' },
    { key: 'ss_baseline_status', label: 'SS baseline status' },
    { key: 'item_status', label: 'Item status' },
    { key: 'data_source', label: 'Data source' },
    { key: 'external_id', label: 'External id' },
    { key: 'data_qualifier', label: 'Data qualifier' },
    { key: 'title', label: 'Title', required: true },
    { key: 'source_description', label: 'Source description', type: 'textarea' },
    { key: 'revised_description', label: 'Revised description', type: 'textarea' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'revised', label: 'Revised', type: 'checkbox' },
  ],
};

export const c3ServicesConfig: C3EntityConfig = {
  title: 'C3 Services',
  subtitle: 'Editovatelný seznam importovaných C3 Services.',
  endpoint: '/api/v1/taxonomy/c3-services',
  exactSearchKeys: ['service_code', 'uuid'],
  columns: [
    { key: 'service_code', label: 'Service', mono: true },
    { key: 'uuid', label: 'UUID', mono: true },
    { key: 'modification_date', label: 'Modification date', render: (row) => renderDateTime(row.modification_date) },
    { key: 'order_num', label: 'Order' },
    { key: 'ss_overall_status', label: 'SS overall status' },
    { key: 'ss_baseline_status', label: 'SS baseline status' },
    { key: 'item_status', label: 'Item status' },
    { key: 'data_source', label: 'Data source' },
    { key: 'external_id', label: 'External id', mono: true },
    { key: 'data_qualifier', label: 'Data qualifier' },
    { key: 'title', label: 'Title' },
    { key: 'source_description', label: 'Source description', render: (row) => renderLongText(row.source_description) },
    { key: 'revised_description', label: 'Revised description', render: (row) => renderLongText(row.revised_description) },
    { key: 'description', label: 'Description', render: (row) => renderLongText(row.description) },
    { key: 'revised', label: 'Revised', render: (row) => renderBoolean(row.revised) },
  ],
  editFields: [
    { key: 'service_code', label: 'Service', required: true },
    { key: 'uuid', label: 'UUID', required: true },
    { key: 'modification_date', label: 'Modification date', type: 'datetime-local' },
    { key: 'order_num', label: 'Order', type: 'number' },
    { key: 'ss_overall_status', label: 'SS overall status' },
    { key: 'ss_baseline_status', label: 'SS baseline status' },
    { key: 'item_status', label: 'Item status' },
    { key: 'data_source', label: 'Data source' },
    { key: 'external_id', label: 'External id' },
    { key: 'data_qualifier', label: 'Data qualifier' },
    { key: 'title', label: 'Title', required: true },
    { key: 'source_description', label: 'Source description', type: 'textarea' },
    { key: 'revised_description', label: 'Revised description', type: 'textarea' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'revised', label: 'Revised', type: 'checkbox' },
  ],
};

export const c3TechnologyInteractionsConfig: C3EntityConfig = {
  title: 'C3 Technology Interactions',
  subtitle: 'Editovatelný seznam importovaných C3 Technology Interactions s odkazy na navázané Services / Applications / Data Objects.',
  endpoint: '/api/v1/taxonomy/c3-technology-interactions',
  exactSearchKeys: ['technology_interaction_code', 'uuid'],
  columns: [
    { key: 'technology_interaction_code', label: 'Technology Interaction', mono: true },
    { key: 'uuid', label: 'UUID', mono: true },
    { key: 'modification_date', label: 'Modification date', render: (row) => renderDateTime(row.modification_date) },
    { key: 'order_num', label: 'Order' },
    { key: 'ss_overall_status', label: 'SS overall status' },
    { key: 'ss_baseline_status', label: 'SS baseline status' },
    { key: 'item_status', label: 'Item status' },
    { key: 'ciav_review_status', label: 'CIAV review status' },
    { key: 'mcsma_review_status', label: 'MCSMA review status' },
    { key: 'service_instructions', label: 'Service Instructions', render: (row) => renderLongText(row.service_instructions) },
    { key: 'title', label: 'Title' },
    { key: 'technology_interaction_type', label: 'Technology interaction type' },
    { key: 'technology_interaction_maturity', label: 'Technology interaction maturity' },
    { key: 'technology_interactions_1_raw', label: 'Technology Interactions 1', render: (row) => renderLongText(row.technology_interactions_1_raw) },
    { key: 'description', label: 'Description', render: (row) => renderLongText(row.description) },
    { key: 'conditionality', label: 'Conditionality', render: (row) => renderLongText(row.conditionality) },
    { key: 'services_1_raw', label: 'Services 1', render: (row) => renderLongText(row.services_1_raw) },
    { key: 'applications_1_raw', label: 'Applications 1', render: (row) => renderLongText(row.applications_1_raw) },
    { key: 'services_2_raw', label: 'Services 2', render: (row) => renderLongText(row.services_2_raw) },
    { key: 'technology_interactions_2_raw', label: 'Technology Interactions 2', render: (row) => renderLongText(row.technology_interactions_2_raw) },
    { key: 'technology_interactions_3_raw', label: 'Technology Interactions 3', render: (row) => renderLongText(row.technology_interactions_3_raw) },
    { key: 'services_3_raw', label: 'Services 3', render: (row) => renderLongText(row.services_3_raw) },
    { key: 'applications_2_raw', label: 'Applications 2', render: (row) => renderLongText(row.applications_2_raw) },
    { key: 'data_objects_raw', label: 'Data Objects', render: (row) => renderLongText(row.data_objects_raw) },
    {
      key: 'linked_services_json',
      label: 'Linked C3 Services',
      render: (row) => renderReferenceColumn(row.linked_services_json, row.unresolved_service_refs, '/c3/services'),
      sortable: false,
    },
    {
      key: 'linked_applications_json',
      label: 'Linked C3 Applications',
      render: (row) => renderReferenceColumn(row.linked_applications_json, row.unresolved_application_refs, '/c3/applications'),
      sortable: false,
    },
    {
      key: 'linked_data_objects_json',
      label: 'Linked C3 Data Objects',
      render: (row) => renderReferenceColumn(row.linked_data_objects_json, row.unresolved_data_object_refs, '/c3/data-objects'),
      sortable: false,
    },
  ],
  editFields: [
    { key: 'technology_interaction_code', label: 'Technology Interaction', required: true },
    { key: 'uuid', label: 'UUID', required: true },
    { key: 'modification_date', label: 'Modification date', type: 'datetime-local' },
    { key: 'order_num', label: 'Order', type: 'number' },
    { key: 'ss_overall_status', label: 'SS overall status' },
    { key: 'ss_baseline_status', label: 'SS baseline status' },
    { key: 'item_status', label: 'Item status' },
    { key: 'ciav_review_status', label: 'CIAV review status' },
    { key: 'mcsma_review_status', label: 'MCSMA review status' },
    { key: 'service_instructions', label: 'Service Instructions', type: 'textarea' },
    { key: 'title', label: 'Title', required: true },
    { key: 'technology_interaction_type', label: 'Technology interaction type' },
    { key: 'technology_interaction_maturity', label: 'Technology interaction maturity' },
    { key: 'technology_interactions_1_raw', label: 'Technology Interactions 1', type: 'textarea' },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'conditionality', label: 'Conditionality', type: 'textarea' },
    { key: 'services_1_raw', label: 'Services 1', type: 'textarea' },
    { key: 'applications_1_raw', label: 'Applications 1', type: 'textarea' },
    { key: 'services_2_raw', label: 'Services 2', type: 'textarea' },
    { key: 'technology_interactions_2_raw', label: 'Technology Interactions 2', type: 'textarea' },
    { key: 'technology_interactions_3_raw', label: 'Technology Interactions 3', type: 'textarea' },
    { key: 'services_3_raw', label: 'Services 3', type: 'textarea' },
    { key: 'applications_2_raw', label: 'Applications 2', type: 'textarea' },
    { key: 'data_objects_raw', label: 'Data Objects', type: 'textarea' },
  ],
};

function renderLongText(value: unknown) {
  const text = String(value ?? '').trim();
  return text ? <span className={styles.cellText}>{text}</span> : '—';
}

function renderBoolean(value: unknown) {
  if (value == null || value === '') return '—';
  const normalized = typeof value === 'boolean' ? value : ['1', 'true', 'yes', 'y'].includes(String(value).trim().toLowerCase());
  return normalized ? 'Yes' : 'No';
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

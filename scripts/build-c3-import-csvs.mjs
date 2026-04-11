import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(projectRoot, 'shared', 'c3');
const outputDir = path.join(sourceDir, 'import-csv');

function csvEscape(value) {
  if (value == null) return '';
  const text = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n\r;]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(columns, rows) {
  const header = columns.join(',');
  const body = rows.map((row) => columns.map((column) => csvEscape(row[column])).join(',')).join('\n');
  return `${header}\n${body}\n`;
}

async function loadJson(filename) {
  const raw = await fs.readFile(path.join(sourceDir, filename), 'utf8');
  return JSON.parse(raw);
}

const EXPORTS = [
  {
    input: 'c3-taxonomy-seed.json',
    output: 'c3-taxonomy-import.csv',
    columns: [
      'UUID', 'Application', 'Title', 'Description', 'Source description', 'Revised description', 'Page',
      'Data qualifier', 'Source', 'SS overall status', 'SS baseline status', 'State', 'Order',
      'Modification date', 'Revised', 'Abbreviation', 'Synonym', 'Script', 'Dataset', 'Standards',
      'References', 'Provenance', 'Item type', 'Parent', 'Parent UUID',
    ],
    map: (row) => ({
      'UUID': row.uuid,
      'Application': row.application,
      'Title': row.title,
      'Description': row.description,
      'Source description': row.source_description,
      'Revised description': row.revised_description,
      'Page': row.external_id,
      'Data qualifier': row.data_qualifier,
      'Source': row.data_source,
      'SS overall status': row.ss_overall_status,
      'SS baseline status': row.ss_baseline_status,
      'State': row.item_status,
      'Order': row.order_num,
      'Modification date': row.modification_date,
      'Revised': row.revised,
      'Abbreviation': row.abbreviation,
      'Synonym': row.synonym,
      'Script': row.script_raw,
      'Dataset': row.datasets_raw,
      'Standards': row.standards_raw,
      'References': row.references_raw,
      'Provenance': row.provenance_raw,
      'Item type': row.item_type,
      'Parent': row.parent_code,
      'Parent UUID': row.parent_uuid,
    }),
  },
  {
    input: 'c3-services-seed.json',
    output: 'c3-services-import.csv',
    columns: [
      'Service', 'UUID', 'Modification date', 'Order', 'SS overall status', 'SS baseline status', 'Item status',
      'Data source', 'External id', 'Data qualifier', 'Title', 'Source description', 'Revised description',
      'Description', 'Revised',
    ],
    map: (row) => ({
      'Service': row.service_code,
      'UUID': row.uuid,
      'Modification date': row.modification_date,
      'Order': row.order_num,
      'SS overall status': row.ss_overall_status,
      'SS baseline status': row.ss_baseline_status,
      'Item status': row.item_status,
      'Data source': row.data_source,
      'External id': row.external_id,
      'Data qualifier': row.data_qualifier,
      'Title': row.title,
      'Source description': row.source_description,
      'Revised description': row.revised_description,
      'Description': row.description,
      'Revised': row.revised,
    }),
  },
  {
    input: 'c3-applications-seed.json',
    output: 'c3-applications-import.csv',
    columns: [
      'Application', 'UUID', 'Modification date', 'Order', 'SS overall status', 'SS baseline status', 'Item status',
      'Data source', 'External id', 'Data qualifier', 'Title', 'Source description', 'Revised description',
      'Description', 'Revised',
    ],
    map: (row) => ({
      'Application': row.application_code,
      'UUID': row.uuid,
      'Modification date': row.modification_date,
      'Order': row.order_num,
      'SS overall status': row.ss_overall_status,
      'SS baseline status': row.ss_baseline_status,
      'Item status': row.item_status,
      'Data source': row.data_source,
      'External id': row.external_id,
      'Data qualifier': row.data_qualifier,
      'Title': row.title,
      'Source description': row.source_description,
      'Revised description': row.revised_description,
      'Description': row.description,
      'Revised': row.revised,
    }),
  },
  {
    input: 'c3-data-objects-seed.json',
    output: 'c3-data-objects-import.csv',
    columns: [
      'Data Object', 'UUID', 'Modification date', 'Order', 'SS overall status', 'SS baseline status', 'Item status',
      'Title', 'Description', 'Provenance', 'References', 'Standards',
    ],
    map: (row) => ({
      'Data Object': row.data_object_code,
      'UUID': row.uuid,
      'Modification date': row.modification_date,
      'Order': row.order_num,
      'SS overall status': row.ss_overall_status,
      'SS baseline status': row.ss_baseline_status,
      'Item status': row.item_status,
      'Title': row.title,
      'Description': row.description,
      'Provenance': row.provenance_raw,
      'References': row.references_raw,
      'Standards': row.standards_raw,
    }),
  },
  {
    input: 'c3-technology-interactions-seed.json',
    output: 'c3-technology-interactions-import.csv',
    columns: [
      'Technology Interaction', 'UUID', 'Modification date', 'Order', 'SS overall status', 'SS baseline status',
      'Item status', 'CIAV review status', 'MCSMA review status', 'Service Instructions', 'Title',
      'Technology interaction type', 'Technology interaction maturity', 'Technology Interactions', 'Description',
      'Conditionality', 'Services', 'Applications', 'Services__2', 'Technology Interactions__2',
      'Technology Interactions__3', 'Services__3', 'Applications__2', 'Data Objects',
    ],
    map: (row) => ({
      'Technology Interaction': row.technology_interaction_code,
      'UUID': row.uuid,
      'Modification date': row.modification_date,
      'Order': row.order_num,
      'SS overall status': row.ss_overall_status,
      'SS baseline status': row.ss_baseline_status,
      'Item status': row.item_status,
      'CIAV review status': row.ciav_review_status,
      'MCSMA review status': row.mcsma_review_status,
      'Service Instructions': row.service_instructions,
      'Title': row.title,
      'Technology interaction type': row.technology_interaction_type,
      'Technology interaction maturity': row.technology_interaction_maturity,
      'Technology Interactions': row.technology_interactions_1_raw,
      'Description': row.description,
      'Conditionality': row.conditionality,
      'Services': row.services_1_raw,
      'Applications': row.applications_1_raw,
      'Services__2': row.services_2_raw,
      'Technology Interactions__2': row.technology_interactions_2_raw,
      'Technology Interactions__3': row.technology_interactions_3_raw,
      'Services__3': row.services_3_raw,
      'Applications__2': row.applications_2_raw,
      'Data Objects': row.data_objects_raw,
    }),
  },
  {
    input: 'capability-map-spiral7.json',
    output: 'c3-capability-map-import.csv',
    columns: ['Page ID', 'UUID', 'Title', 'Parent ID', 'Level', 'State', 'Domain'],
    map: (row) => ({
      'Page ID': row.pageId,
      'UUID': row.uuid,
      'Title': row.title,
      'Parent ID': row.parentId,
      'Level': row.level,
      'State': row.state,
      'Domain': row.domain,
    }),
  },
];

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  for (const item of EXPORTS) {
    const rows = await loadJson(item.input);
    const csv = toCsv(item.columns, rows.map(item.map));
    await fs.writeFile(path.join(outputDir, item.output), csv, 'utf8');
    process.stdout.write(`Wrote import-csv/${item.output} (${rows.length} rows)\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

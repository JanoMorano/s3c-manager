/**
 * Import Upload — drag & drop CSV/JSON/XLSX → the corresponding import endpoint
 *
 * Default import is intentionally small: service catalogue CSV/JSON, plus
 * C3 baseline/capability map when the C3 module is active. Detailed C3/FMN
 * targets stay in the admin expert section so the page does not look like a
 * generic integration studio.
 *
 * The Spiral selector at the top sets the spiral_code for all C3/FMN imports.
 */
'use client';

import { useState, useCallback, useEffect, useMemo, useRef, DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from '@/app/components/AppLink';
import useSWR from 'swr';
import styles from './upload.module.css';
import { apiFetch, authHeaders } from '@/features/services/api/services.api';
import { AUTH_STATE_EVENT, getAuthSnapshot } from '@/features/auth/authStore';
import { hasRoleAccess } from '@/features/auth/roles';
import { useInstallStatus } from '@/features/install/installStatus';

const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

type Target =
  | 'services'
  | 'services-narodni'
  | 'c3'
  | 'c3-capability-builder'
  | 'c3-application'
  | 'c3-data-objects'
  | 'c3-services'
  | 'c3-technology-interactions'
  | 'c3-taxonomy-business-processes'
  | 'c3-taxonomy-business-roles'
  | 'c3-taxonomy-capabilities'
  | 'c3-taxonomy-coi-services'
  | 'c3-taxonomy-communications-services'
  | 'c3-taxonomy-core-services'
  | 'c3-taxonomy-information-products'
  | 'c3-taxonomy-user-applications';

type Format = 'csv' | 'json' | 'xlsx' | 'xml';
type TargetSection = 'service-catalogue' | 'c3-taxonomy' | 'fmn-spirals';

const TARGET_OPTIONS: Array<{
  value: Target;
  label: string;
  section: TargetSection;
  supportedFormats: Format[];
  supportsDryRun: boolean;
  redirectToImport: boolean;
  usesSpiral: boolean;
  csvEndpoint?: (fileName: string, spiralCode: string | null) => string;
  jsonEndpoint?: (spiralCode: string | null) => string;
  xlsxEndpoint?: (fileName: string, spiralCode: string | null) => string;
  xmlEndpoint?: (fileName: string, spiralCode: string | null, dryRun?: boolean) => string;
  hints: Partial<Record<Format, string>>;
}> = [
  // ── Service Catalogue ──────────────────────────────────────────────────────
  {
    value: 'services',
    label: 'NCIA Service Catalogue',
    section: 'service-catalogue',
    supportedFormats: ['csv', 'json'],
    supportsDryRun: true,
    redirectToImport: true,
    usesSpiral: false,
    csvEndpoint: (fileName) => `/api/v1/import/services/csv?source_name=${encodeURIComponent(fileName)}`,
    jsonEndpoint: () => '/api/v1/import/services',
    hints: {
      csv: 'CSV s oddělovačem ; nebo ,. Povinné sloupce: service_id, title, service_type_code.',
      json: 'JSON pole objektů, { "items": [...] }, nebo 3-table payload se ServiceCatalog/ServiceFlavours/ServiceRelations.',
    },
  },
  {
    value: 'services-narodni',
    label: 'Národní Service Catalogue',
    section: 'service-catalogue',
    supportedFormats: ['csv', 'json'],
    supportsDryRun: true,
    redirectToImport: true,
    usesSpiral: false,
    csvEndpoint: (fileName) => `/api/v1/import/services/csv?source_name=${encodeURIComponent(fileName)}&source_type=narodni`,
    jsonEndpoint: () => '/api/v1/import/services',
    hints: {
      csv: 'CSV s oddělovačem ; nebo ,. Povinné sloupce: service_id, title, service_type_code. Zdroj: Národní SC.',
      json: 'JSON pole objektů nebo { "items": [...] }. Zdroj: Národní SC.',
    },
  },
  // ── C3 Taxonomy ────────────────────────────────────────────────────────────
  {
    value: 'c3',
    label: 'C3 Taxonomie',
    section: 'c3-taxonomy',
    supportedFormats: ['csv', 'json', 'xlsx'],
    supportsDryRun: false,
    redirectToImport: false,
    usesSpiral: true,
    csvEndpoint: (fileName, sc) => `/api/v1/taxonomy/c3/csv?source_name=${encodeURIComponent(fileName)}${sc ? `&spiral_code=${encodeURIComponent(sc)}` : ''}`,
    jsonEndpoint: (sc) => `/api/v1/taxonomy/c3/sync${sc ? `?spiral_code=${encodeURIComponent(sc)}` : ''}`,
    xlsxEndpoint: (fileName, sc) => `/api/v1/taxonomy/c3/xlsx?source_name=${encodeURIComponent(fileName)}${sc ? `&spiral_code=${encodeURIComponent(sc)}` : ''}`,
    hints: {
      csv: 'CSV s oddělovačem ; nebo ,. Povinné sloupce: uuid, title.',
      json: 'JSON pole objektů nebo { "items": [...] }. Každý objekt musí mít uuid a title.',
      xlsx: 'XLSX report s jedním listem. List i Page prefix určují typ C3 taxonomy záznamů.',
    },
  },
  {
    value: 'c3-application',
    label: 'C3 Application',
    section: 'c3-taxonomy',
    supportedFormats: ['csv', 'json'],
    supportsDryRun: true,
    redirectToImport: true,
    usesSpiral: true,
    csvEndpoint: (fileName, sc) => `/api/v1/taxonomy/c3-application/csv?source_name=${encodeURIComponent(fileName)}${sc ? `&spiral_code=${encodeURIComponent(sc)}` : ''}`,
    jsonEndpoint: (sc) => `/api/v1/taxonomy/c3-application/sync${sc ? `?spiral_code=${encodeURIComponent(sc)}` : ''}`,
    hints: {
      csv: 'CSV dle Applications.csv. Klíčové sloupce: Application, UUID, Title.',
      json: 'JSON pole objektů nebo { "items": [...] } s poli odpovídajícími Applications.csv.',
    },
  },
  {
    value: 'c3-data-objects',
    label: 'C3 Data Object',
    section: 'c3-taxonomy',
    supportedFormats: ['csv', 'json'],
    supportsDryRun: true,
    redirectToImport: true,
    usesSpiral: true,
    csvEndpoint: (fileName, sc) => `/api/v1/taxonomy/c3-data-objects/csv?source_name=${encodeURIComponent(fileName)}${sc ? `&spiral_code=${encodeURIComponent(sc)}` : ''}`,
    jsonEndpoint: (sc) => `/api/v1/taxonomy/c3-data-objects/sync${sc ? `?spiral_code=${encodeURIComponent(sc)}` : ''}`,
    hints: {
      csv: 'CSV dle Data Objects.csv. Klíčové sloupce: Data Object, UUID, Title.',
      json: 'JSON pole objektů nebo { "items": [...] } s poli odpovídajícími Data Objects.csv.',
    },
  },
  {
    value: 'c3-services',
    label: 'C3 Services',
    section: 'c3-taxonomy',
    supportedFormats: ['csv', 'json'],
    supportsDryRun: true,
    redirectToImport: true,
    usesSpiral: true,
    csvEndpoint: (fileName, sc) => `/api/v1/taxonomy/c3-services/csv?source_name=${encodeURIComponent(fileName)}${sc ? `&spiral_code=${encodeURIComponent(sc)}` : ''}`,
    jsonEndpoint: (sc) => `/api/v1/taxonomy/c3-services/sync${sc ? `?spiral_code=${encodeURIComponent(sc)}` : ''}`,
    hints: {
      csv: 'CSV dle Services.csv. Klíčové sloupce: Service, UUID, Title.',
      json: 'JSON pole objektů nebo { "items": [...] } s poli odpovídajícími Services.csv.',
    },
  },
  {
    value: 'c3-technology-interactions',
    label: 'C3 Technology Interactions',
    section: 'c3-taxonomy',
    supportedFormats: ['csv', 'json'],
    supportsDryRun: true,
    redirectToImport: true,
    usesSpiral: true,
    csvEndpoint: (fileName, sc) => `/api/v1/taxonomy/c3-technology-interactions/csv?source_name=${encodeURIComponent(fileName)}${sc ? `&spiral_code=${encodeURIComponent(sc)}` : ''}`,
    jsonEndpoint: (sc) => `/api/v1/taxonomy/c3-technology-interactions/sync${sc ? `?spiral_code=${encodeURIComponent(sc)}` : ''}`,
    hints: {
      csv: 'CSV dle Technology Interactions.csv včetně duplicitních hlaviček Services/Applications/Technology Interactions.',
      json: 'JSON pole objektů nebo { "items": [...] } s poli odpovídajícími Technology Interactions.csv.',
    },
  },
  // ── FMN Spirals ────────────────────────────────────────────────────────────
  {
    value: 'c3-capability-builder',
    label: 'C3 Capability Map',
    section: 'fmn-spirals',
    supportedFormats: ['csv', 'json'],
    supportsDryRun: true,
    redirectToImport: false,
    usesSpiral: true,
    csvEndpoint: (fileName, sc) => `/api/v1/taxonomy/c3-capability-builder/csv?source_name=${encodeURIComponent(fileName)}${sc ? `&spiral_code=${encodeURIComponent(sc)}` : ''}`,
    jsonEndpoint: (sc) => `/api/v1/taxonomy/c3-capability-builder/sync${sc ? `?spiral_code=${encodeURIComponent(sc)}` : ''}`,
    hints: {
      csv: 'CSV se sloupci Page ID, UUID, Title, Parent ID, Level, State, Domain. Snapshot: shared/c3/import-csv/c3-capability-map-import.csv.',
      json: 'JSON pole objektů nebo { "items": [...] } s poli pageId/page_id, uuid, title, parentId/parent_id, level, state, domain/domain_code.',
    },
  },
  {
    value: 'c3-taxonomy-business-processes',
    label: 'C3 Business Processes',
    section: 'fmn-spirals',
    supportedFormats: ['xlsx', 'xml'],
    supportsDryRun: true,
    redirectToImport: false,
    usesSpiral: true,
    xlsxEndpoint: (fileName, sc) => `/api/v1/taxonomy/c3/xlsx?target_key=business-processes&source_name=${encodeURIComponent(fileName)}${sc ? `&spiral_code=${encodeURIComponent(sc)}` : ''}`,
    xmlEndpoint: (fileName, sc, dryRun = false) => `/api/v1/taxonomy/c3/business-processes/xml-archimate?source_name=${encodeURIComponent(fileName)}${sc ? `&spiral_code=${encodeURIComponent(sc)}` : ''}${dryRun ? '&dry_run=true' : ''}`,
    hints: { xml: 'ArchiMate XML: 20221208_Business_Processes_Taxonomy.xml', xlsx: 'Taxonomy Report for C3 Business Processes.xlsx' },
  },
  {
    value: 'c3-taxonomy-business-roles',
    label: 'C3 Business Roles',
    section: 'fmn-spirals',
    supportedFormats: ['xlsx', 'xml'],
    supportsDryRun: true,
    redirectToImport: false,
    usesSpiral: true,
    xlsxEndpoint: (fileName, sc) => `/api/v1/taxonomy/c3/xlsx?target_key=business-roles&source_name=${encodeURIComponent(fileName)}${sc ? `&spiral_code=${encodeURIComponent(sc)}` : ''}`,
    xmlEndpoint: (fileName, sc, dryRun = false) => `/api/v1/taxonomy/c3/business-roles/xml-archimate?source_name=${encodeURIComponent(fileName)}${sc ? `&spiral_code=${encodeURIComponent(sc)}` : ''}${dryRun ? '&dry_run=true' : ''}`,
    hints: { xml: 'ArchiMate XML: 20221208_Business_Roles_Taxonomy.xml', xlsx: 'Taxonomy Report for C3 Business Roles.xlsx' },
  },
  {
    value: 'c3-taxonomy-capabilities',
    label: 'C3 Capabilities',
    section: 'fmn-spirals',
    supportedFormats: ['xlsx'],
    supportsDryRun: false,
    redirectToImport: false,
    usesSpiral: true,
    xlsxEndpoint: (fileName, sc) => `/api/v1/taxonomy/c3/xlsx?target_key=capabilities&source_name=${encodeURIComponent(fileName)}${sc ? `&spiral_code=${encodeURIComponent(sc)}` : ''}`,
    hints: { xlsx: 'Taxonomy Report for C3 Capabilities.xlsx' },
  },
  {
    value: 'c3-taxonomy-coi-services',
    label: 'C3 COI Services',
    section: 'fmn-spirals',
    supportedFormats: ['xlsx', 'xml'],
    supportsDryRun: true,
    redirectToImport: false,
    usesSpiral: true,
    xlsxEndpoint: (fileName, sc) => `/api/v1/taxonomy/c3/xlsx?target_key=coi-services&source_name=${encodeURIComponent(fileName)}${sc ? `&spiral_code=${encodeURIComponent(sc)}` : ''}`,
    xmlEndpoint: (fileName, sc, dryRun = false) => `/api/v1/taxonomy/c3/coi-services/xml-archimate?source_name=${encodeURIComponent(fileName)}${sc ? `&spiral_code=${encodeURIComponent(sc)}` : ''}${dryRun ? '&dry_run=true' : ''}`,
    hints: { xml: 'ArchiMate XML: 20221208_COI_Services_Taxonomy.xml', xlsx: 'Taxonomy Report for C3 COI Services.xlsx' },
  },
  {
    value: 'c3-taxonomy-communications-services',
    label: 'C3 Communication Services',
    section: 'fmn-spirals',
    supportedFormats: ['xlsx', 'xml'],
    supportsDryRun: true,
    redirectToImport: false,
    usesSpiral: true,
    xlsxEndpoint: (fileName, sc) => `/api/v1/taxonomy/c3/xlsx?target_key=communications-services&source_name=${encodeURIComponent(fileName)}${sc ? `&spiral_code=${encodeURIComponent(sc)}` : ''}`,
    xmlEndpoint: (fileName, sc, dryRun = false) => `/api/v1/taxonomy/c3/communications-services/xml-archimate?source_name=${encodeURIComponent(fileName)}${sc ? `&spiral_code=${encodeURIComponent(sc)}` : ''}${dryRun ? '&dry_run=true' : ''}`,
    hints: { xml: 'ArchiMate XML: 20221208_Communications_Services_Taxonomy.xml', xlsx: 'Taxonomy Report for C3 Communications Services.xlsx' },
  },
  {
    value: 'c3-taxonomy-core-services',
    label: 'C3 Core Services',
    section: 'fmn-spirals',
    supportedFormats: ['xlsx', 'xml'],
    supportsDryRun: true,
    redirectToImport: false,
    usesSpiral: true,
    xlsxEndpoint: (fileName, sc) => `/api/v1/taxonomy/c3/xlsx?target_key=core-services&source_name=${encodeURIComponent(fileName)}${sc ? `&spiral_code=${encodeURIComponent(sc)}` : ''}`,
    xmlEndpoint: (fileName, sc, dryRun = false) => `/api/v1/taxonomy/c3/core-services/xml-archimate?source_name=${encodeURIComponent(fileName)}${sc ? `&spiral_code=${encodeURIComponent(sc)}` : ''}${dryRun ? '&dry_run=true' : ''}`,
    hints: { xml: 'ArchiMate XML: 20221208_Core_Services_Taxonomy.xml', xlsx: 'Taxonomy Report for C3 Core Services.xlsx' },
  },
  {
    value: 'c3-taxonomy-information-products',
    label: 'C3 Information Products',
    section: 'fmn-spirals',
    supportedFormats: ['xlsx'],
    supportsDryRun: false,
    redirectToImport: false,
    usesSpiral: true,
    xlsxEndpoint: (fileName, sc) => `/api/v1/taxonomy/c3/xlsx?target_key=information-products&source_name=${encodeURIComponent(fileName)}${sc ? `&spiral_code=${encodeURIComponent(sc)}` : ''}`,
    hints: { xlsx: 'Taxonomy Report for C3 Information Products.xlsx' },
  },
  {
    value: 'c3-taxonomy-user-applications',
    label: 'C3 User Application',
    section: 'fmn-spirals',
    supportedFormats: ['xlsx', 'xml'],
    supportsDryRun: true,
    redirectToImport: false,
    usesSpiral: true,
    xlsxEndpoint: (fileName, sc) => `/api/v1/taxonomy/c3/xlsx?target_key=user-applications&source_name=${encodeURIComponent(fileName)}${sc ? `&spiral_code=${encodeURIComponent(sc)}` : ''}`,
    xmlEndpoint: (fileName, sc, dryRun = false) => `/api/v1/taxonomy/c3/user-applications/xml-archimate?source_name=${encodeURIComponent(fileName)}${sc ? `&spiral_code=${encodeURIComponent(sc)}` : ''}${dryRun ? '&dry_run=true' : ''}`,
    hints: { xml: 'ArchiMate XML: 20221208_User_Applications_Taxonomy.xml', xlsx: 'Taxonomy Report for C3 User Applications.xlsx' },
  },
];

interface ImportPreflightSummary {
  source_name: string;
  source_hash_sha256?: string;
  item_count: number;
  flavour_count: number;
  explicit_relation_count: number;
  raw_prerequisite_count: number;
  missing_target_count: number;
  stub_count: number;
  unresolved_ref_count: number;
  missing_targets: string[];
  unresolved_refs: Array<{ kind: string; service_id: string | null; raw_value: string }>;
}

interface C3EntityDryRunSummary {
  target: string;
  label: string;
  rowsParsed: number;
  valid_row_count: number;
  warn_count: number;
  error_count: number;
  issue_count: number;
  issues: Array<{
    row_number: number;
    severity: string;
    issue_code: string;
    field_name: string | null;
    raw_value: string | null;
    message: string | null;
  }>;
}

interface SeedStatus {
  taxonomy: {
    mode: 'baseline' | 'xlsx-import' | 'manual' | 'none' | 'unknown';
    active_seed_key: string | null;
    total: number;
    by_item_type: Array<{ item_type: string; total: number }>;
  };
  entities: {
    services: number;
    applications: number;
    data_objects: number;
    technology_interactions: number;
  };
  capability_map: {
    mode: 'baseline' | 'modified' | 'manual' | 'none' | 'unknown';
    total_rows: number;
  };
}

interface SpiralBaseline {
  id: number;
  spiral_code: string;
  spiral_label: string;
  is_active: boolean;
  notes: string | null;
}

interface SpiralResponse {
  active: SpiralBaseline | string | null;
  all?: SpiralBaseline[];
  baselines?: SpiralBaseline[];
}

type DryRunSummary = ImportPreflightSummary | C3EntityDryRunSummary;

function isServicePreflight(summary: DryRunSummary): summary is ImportPreflightSummary {
  return 'item_count' in summary;
}

interface ImportResult {
  inserted: number;
  updated: number;
  failed: number;
  rowsParsed?: number;
  batchId?: number;
  ok?: boolean;
  target_label?: string;
}

const SECTION_LABELS: Record<TargetSection, string> = {
  'service-catalogue': 'Katalog služeb',
  'c3-taxonomy': 'C3 baseline',
  'fmn-spirals': 'Capability map',
};

const SECTION_ORDER: TargetSection[] = ['service-catalogue', 'c3-taxonomy', 'fmn-spirals'];
const DEFAULT_C3_TARGETS = new Set<Target>(['c3', 'c3-capability-builder']);
const FALLBACK_SPIRALS: SpiralBaseline[] = [
  { id: 6, spiral_code: 'Spiral_6', spiral_label: 'Spiral 6', is_active: false, notes: null },
  { id: 7, spiral_code: 'Spiral_7', spiral_label: 'Spiral 7', is_active: true, notes: null },
];

function isDefaultTarget(option: (typeof TARGET_OPTIONS)[number], c3Visible: boolean) {
  return option.section === 'service-catalogue' || (c3Visible && DEFAULT_C3_TARGETS.has(option.value));
}

function spiralNumber(code: string) {
  return Number(code.match(/^Spiral_(\d+)$/)?.[1] ?? Number.MAX_SAFE_INTEGER);
}

function activeSpiralCode(data: SpiralResponse | undefined) {
  if (!data?.active) return null;
  return typeof data.active === 'string' ? data.active : data.active.spiral_code;
}

export default function ImportUploadPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const { c3Visible } = useInstallStatus();
  const [role, setRole] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const syncRole = () => {
      setRole(getAuthSnapshot()?.role ?? null);
      setHydrated(true);
    };
    syncRole();
    window.addEventListener('focus', syncRole);
    window.addEventListener('storage', syncRole);
    window.addEventListener(AUTH_STATE_EVENT, syncRole);
    return () => {
      window.removeEventListener('focus', syncRole);
      window.removeEventListener('storage', syncRole);
      window.removeEventListener(AUTH_STATE_EVENT, syncRole);
    };
  }, []);

  const isExpertImportUser = hydrated && c3Visible && hasRoleAccess(role, 'admin');
  const canSeeSeedStatus = isExpertImportUser;

  const { data: seedStatus } = useSWR<SeedStatus>(
    canSeeSeedStatus ? '/api/v1/admin/seed-status' : null,
    apiFetch,
    { revalidateOnFocus: false },
  );

  const { data: spiralData } = useSWR<SpiralResponse>(
    canSeeSeedStatus ? '/api/v1/taxonomy/spiral' : null,
    apiFetch,
    { revalidateOnFocus: false },
  );

  // Spiral selection: default to active baseline from server, then user can override
  const [selectedSpiral, setSelectedSpiral] = useState<string | null>(null);
  const serverActiveSpiral = activeSpiralCode(spiralData);
  const availableSpirals = useMemo(() => {
    const byCode = new Map<string, SpiralBaseline>();
    FALLBACK_SPIRALS.forEach((spiral) => byCode.set(spiral.spiral_code, spiral));
    (spiralData?.baselines ?? spiralData?.all ?? []).forEach((spiral) => {
      if (spiral?.spiral_code) byCode.set(spiral.spiral_code, spiral);
    });
    if (spiralData?.active && typeof spiralData.active !== 'string') {
      byCode.set(spiralData.active.spiral_code, spiralData.active);
    }
    return [...byCode.values()].sort((left, right) => spiralNumber(left.spiral_code) - spiralNumber(right.spiral_code));
  }, [spiralData]);

  /* eslint-disable react-hooks/set-state-in-effect -- U5: upload defaults to the active spiral once server metadata is available. */
  useEffect(() => {
    if (serverActiveSpiral && selectedSpiral === null) {
      setSelectedSpiral(serverActiveSpiral);
    }
  }, [selectedSpiral, serverActiveSpiral]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const effectiveSpiral = selectedSpiral
    ?? serverActiveSpiral
    ?? availableSpirals.find((spiral) => spiral.is_active)?.spiral_code
    ?? 'Spiral_7';

  const [target, setTarget] = useState<Target>('services');
  const [format, setFormat] = useState<Format>('csv');
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preflighting, setPreflighting] = useState(false);
  const [preflight, setPreflight] = useState<DryRunSummary | null>(null);

  const defaultTargetOptions = useMemo(
    () => TARGET_OPTIONS.filter((item) => isDefaultTarget(item, c3Visible)),
    [c3Visible],
  );
  const expertTargetOptions = useMemo(
    () => isExpertImportUser
      ? TARGET_OPTIONS.filter((item) => c3Visible && !isDefaultTarget(item, c3Visible))
      : [],
    [c3Visible, isExpertImportUser],
  );
  const visibleTargetOptions = useMemo(
    () => [...defaultTargetOptions, ...expertTargetOptions],
    [defaultTargetOptions, expertTargetOptions],
  );
  const targetConfig = visibleTargetOptions.find((item) => item.value === target) ?? visibleTargetOptions[0];
  const spiral = targetConfig.usesSpiral ? effectiveSpiral : null;

  /* eslint-disable react-hooks/set-state-in-effect -- U5: target/format state is clamped when available import modules change. */
  useEffect(() => {
    if (!visibleTargetOptions.some((item) => item.value === target)) {
      const nextTarget = visibleTargetOptions[0];
      if (nextTarget) {
        setTarget(nextTarget.value);
        setFormat(nextTarget.supportedFormats[0]);
      }
      setFile(null);
      setPreflight(null);
      setResult(null);
      setError(null);
    }
  }, [target, visibleTargetOptions]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const acceptedExtensions = format === 'csv'
    ? ['.csv', '.txt']
    : format === 'json'
      ? ['.json']
      : format === 'xml'
        ? ['.xml']
        : ['.xlsx'];

  const validateFile = (f: File): string | null => {
    const name = f.name.toLowerCase();
    if (format === 'csv' && !name.endsWith('.csv') && !name.endsWith('.txt'))
      return 'Pouze .csv nebo .txt soubory.';
    if (format === 'json' && !name.endsWith('.json'))
      return 'Pouze .json soubory.';
    if (format === 'xlsx' && !name.endsWith('.xlsx'))
      return 'Pouze .xlsx soubory.';
    if (format === 'xml' && !name.endsWith('.xml'))
      return 'Pouze .xml soubory.';
    if (f.size > MAX_SIZE_BYTES)
      return `Soubor je příliš velký. Maximum je ${MAX_SIZE_MB} MB.`;
    return null;
  };

  const selectFile = useCallback((f: File) => {
    const err = validateFile(f);
    if (err) { setError(err); return; }
    setError(null);
    setFile(f);
    setPreflight(null);
    setResult(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format]);

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) selectFile(f);
  }, [selectFile]);

  const onDragOver  = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const handleTargetChange = (t: Target) => {
    const nextTarget = visibleTargetOptions.find((item) => item.value === t) ?? visibleTargetOptions[0];
    setTarget(nextTarget.value);
    if (!nextTarget.supportedFormats.includes(format)) {
      setFormat(nextTarget.supportedFormats[0]);
    }
    setFile(null);
    setError(null);
    setProgress(null);
    setPreflight(null);
    setResult(null);
  };

  const handleFormatChange = (f: Format) => {
    if (!targetConfig.supportedFormats.includes(f)) return;
    setFormat(f);
    setFile(null);
    setError(null);
    setProgress(null);
    setPreflight(null);
    setResult(null);
  };

  const handleDryRun = async () => {
    if (!file || !targetConfig.supportsDryRun) return;
    setPreflighting(true);
    setError(null);
    setResult(null);

    try {
      let res: Response;

      if (format === 'json') {
        const text = await file.text();
        let parsed: unknown;
        try { parsed = JSON.parse(text); } catch { throw new Error('Soubor není platný JSON.'); }

        const body = (Array.isArray(parsed) || (parsed && typeof parsed === 'object'))
          ? { ...(Array.isArray(parsed) ? { items: parsed } : parsed as Record<string, unknown>), source_name: file.name }
          : { items: [], source_name: file.name };

        if (spiral) Object.assign(body, { spiral_code: spiral });

        const endpoint = target === 'services' || target === 'services-narodni'
          ? '/api/v1/import/services/dry-run'
          : `/api/v1/taxonomy/${target}/dry-run`;

        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(body),
        });
      } else if (format === 'xml') {
        const text = await file.text();
        const endpoint = targetConfig.xmlEndpoint?.(file.name, spiral, true);
        if (!endpoint) throw new Error('Pro zvolený cíl není XML dry-run dostupný.');

        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/xml', ...authHeaders() },
          body: text,
        });
      } else {
        const text = await file.text();
        const endpoint = target === 'services' || target === 'services-narodni'
          ? `/api/v1/import/services/csv/dry-run?source_name=${encodeURIComponent(file.name)}`
          : `/api/v1/taxonomy/${target}/csv/dry-run${spiral ? `?spiral_code=${encodeURIComponent(spiral)}` : ''}`;

        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'text/csv', ...authHeaders() },
          body: text,
        });
      }

      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(payload.error ?? `HTTP ${res.status}`);
      }

      const data = await res.json() as DryRunSummary;
      setPreflight(data);
      setProgress('Dry-run hotov. Souhrn je níže.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Dry-run selhal');
    } finally {
      setPreflighting(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress('Nahrávám…');
    setError(null);
    setResult(null);

    try {
      if (format === 'csv') {
        const text = await file.text();
        const endpoint = targetConfig.csvEndpoint?.(file.name, spiral);
        if (!endpoint) throw new Error('Pro zvolený cíl není CSV import dostupný.');

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'text/csv', ...authHeaders() },
          body: text,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const data = await res.json() as ImportResult;
        setResult(data);
        setProgress(null);
        if (targetConfig.redirectToImport) {
          setTimeout(() => {
            router.push(data.batchId ? `/import?batchId=${data.batchId}` : '/import');
          }, 1500);
        }

      } else if (format === 'json') {
        const text = await file.text();
        let parsed: unknown;
        try { parsed = JSON.parse(text); } catch { throw new Error('Soubor není platný JSON.'); }

        const parsedObject = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
        const isThreeTablePayload = !!parsedObject && Array.isArray(parsedObject.ServiceCatalog);
        const rawItems = Array.isArray(parsed)
          ? parsed
          : parsedObject?.items ?? parsedObject?.data ?? null;

        if (!Array.isArray(rawItems) && !isThreeTablePayload)
          throw new Error('JSON musí být pole objektů, objekt s klíčem "items", nebo 3-table payload se ServiceCatalog.');

        const endpoint = targetConfig.jsonEndpoint?.(spiral);
        if (!endpoint) throw new Error('Pro zvolený cíl není JSON import dostupný.');

        const isServices = target === 'services' || target === 'services-narodni';
        const requestBody = isServices
          ? (isThreeTablePayload
            ? { ...parsedObject, source_name: file.name }
            : { items: rawItems, source_name: file.name })
          : { items: rawItems, source_name: file.name, ...(spiral ? { spiral_code: spiral } : {}) };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(requestBody),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const data = await res.json() as ImportResult;
        setResult(data);
        setProgress(null);
        if (targetConfig.redirectToImport) {
          setTimeout(() => router.push(data.batchId ? `/import?batchId=${data.batchId}` : '/import'), 1500);
        }

      } else if (format === 'xml') {
        const endpoint = targetConfig.xmlEndpoint?.(file.name, spiral, false);
        if (!endpoint) throw new Error('Pro zvolený cíl není XML import dostupný.');

        const text = await file.text();
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/xml', ...authHeaders() },
          body: text,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const data = await res.json() as ImportResult;
        setResult(data);
        setProgress(null);

      } else {
        const endpoint = targetConfig.xlsxEndpoint?.(file.name, spiral);
        if (!endpoint) throw new Error('Pro zvolený cíl není XLSX import dostupný.');

        const arrayBuffer = await file.arrayBuffer();
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ...authHeaders(),
          },
          body: arrayBuffer,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const data = await res.json() as ImportResult;
        setResult(data);
        setProgress(null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload selhal');
      setProgress(null);
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadPreflight = () => {
    if (!preflight) return;
    const blob = new Blob([JSON.stringify(preflight, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    const fileLabel = isServicePreflight(preflight)
      ? preflight.source_name || 'preflight'
      : `${preflight.target}-dry-run`;
    anchor.download = `${fileLabel.replace(/[^a-z0-9._-]+/gi, '_')}.preflight.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const formatHint = targetConfig.hints[format];

  return (
    <div className={styles.shell}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Import dat</h1>
        <Link href="/import" className={styles.backLink}>← Zpět na historii importů</Link>
      </div>

      <div className={styles.body}>
        <section className={styles.guidancePanel}>
          <div>
            <h2>Bezpečný import katalogu</h2>
            <p>Nahrajte CSV nebo JSON katalog služeb, nejdřív spusťte dry-run a teprve po kontrole issues potvrďte import.</p>
          </div>
          <ol>
            <li>Dry-run ukáže chyby před zápisem.</li>
            <li>Commit vytvoří dávku, issues a auditní stopu.</li>
            <li>Rollback: použijte export bundle/manifest z historie importů.</li>
          </ol>
        </section>

        {/* ── Spiral selector ─────────────────────────────────────────────── */}
        {c3Visible && (
          <div className={styles.spiralStrip}>
            <span className={styles.spiralLabel}>C3 baseline:</span>
            <div className={styles.spiralToggleGroup}>
              {availableSpirals.map((sp) => (
                <button
                  key={sp.spiral_code}
                  type="button"
                  className={`${styles.spiralBtn} ${effectiveSpiral === sp.spiral_code ? styles.spiralBtnActive : ''}`}
                  onClick={() => setSelectedSpiral(sp.spiral_code)}
                  title={sp.notes ?? sp.spiral_label}
                >
                  {sp.spiral_label}
                  {sp.is_active && <span className={styles.spiralActiveDot} title="Aktuální aktivní baseline" />}
                </button>
              ))}
            </div>
            <span className={styles.spiralHint}>
              Hodnota se zapíše do C3/FMN evidence u importů, které baseline používají.
            </span>
          </div>
        )}

        {/* ── Seed status ──────────────────────────────────────────────────── */}
        {seedStatus && (
          <div className={styles.seedInfo}>
            <div className={styles.seedInfoTitle}>Expert C3 evidence</div>
            <div className={styles.seedInfoGrid}>
              <span className={styles.seedPill}>Taxonomy {seedStatus.taxonomy.total}</span>
              <span className={styles.seedPill}>Services {seedStatus.entities.services}</span>
              <span className={styles.seedPill}>Applications {seedStatus.entities.applications}</span>
              <span className={styles.seedPill}>Data Objects {seedStatus.entities.data_objects}</span>
              <span className={styles.seedPill}>TI {seedStatus.entities.technology_interactions}</span>
              <span className={styles.seedPill}>Capability Map {seedStatus.capability_map.total_rows}</span>
            </div>
            {seedStatus.taxonomy.by_item_type.length > 0 && (
              <div className={styles.seedInfoMeta}>
                {seedStatus.taxonomy.by_item_type.map((item) => (
                  <span key={item.item_type} className={styles.seedMetaItem}>
                    {item.item_type}: {item.total}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Default target selection ────────────────────────────────────── */}
        {SECTION_ORDER.map((section) => {
          const sectionTargets = defaultTargetOptions.filter((t) => t.section === section);
          if (sectionTargets.length === 0) return null;
          return (
            <div key={section} className={styles.targetSection}>
              <div className={styles.targetSectionLabel}>{SECTION_LABELS[section]}</div>
              <div className={styles.toggleGroup}>
                {sectionTargets.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`${styles.toggleBtn} ${target === option.value ? styles.toggleBtnActive : ''}`}
                    onClick={() => handleTargetChange(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {isExpertImportUser && expertTargetOptions.length > 0 && (
          <section className={styles.expertPanel}>
            <div className={styles.expertHeader}>
              <div>
                <h2>Expert C3/FMNs import</h2>
                <p>Jen pro administrační a taxonomy práci. Běžný katalogový import výše zůstává hlavní cesta.</p>
              </div>
              <span className={styles.expertBadge}>admin</span>
            </div>
            {SECTION_ORDER.map((section) => {
              const sectionTargets = expertTargetOptions.filter((t) => t.section === section);
              if (sectionTargets.length === 0) return null;
              return (
                <div key={`expert-${section}`} className={styles.targetSection}>
                  <div className={styles.targetSectionLabel}>{SECTION_LABELS[section]}</div>
                  <div className={styles.toggleGroup}>
                    {sectionTargets.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`${styles.toggleBtn} ${target === option.value ? styles.toggleBtnActive : ''}`}
                        onClick={() => handleTargetChange(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* ── Active spiral indicator for C3/FMN ──────────────────────────── */}
        {c3Visible && targetConfig.usesSpiral && (
          <div className={styles.spiralActiveIndicator}>
            Import bude označen jako <strong>{effectiveSpiral}</strong>
          </div>
        )}

        {/* ── Format ──────────────────────────────────────────────────────── */}
        <div className={styles.toggleRow}>
          <span className={styles.toggleLabel}>Formát:</span>
          <div className={styles.toggleGroup}>
            {targetConfig.supportedFormats.includes('csv') && (
              <button
                type="button"
                className={`${styles.toggleBtn} ${format === 'csv' ? styles.toggleBtnActive : ''}`}
                onClick={() => handleFormatChange('csv')}
              >
                CSV / TXT
              </button>
            )}
            {targetConfig.supportedFormats.includes('json') && (
              <button
                type="button"
                className={`${styles.toggleBtn} ${format === 'json' ? styles.toggleBtnActive : ''}`}
                onClick={() => handleFormatChange('json')}
              >
                JSON
              </button>
            )}
            {targetConfig.supportedFormats.includes('xml') && (
              <button
                type="button"
                className={`${styles.toggleBtn} ${format === 'xml' ? styles.toggleBtnActive : ''}`}
                onClick={() => handleFormatChange('xml')}
              >
                XML
              </button>
            )}
            {targetConfig.supportedFormats.includes('xlsx') && (
              <button
                type="button"
                className={`${styles.toggleBtn} ${format === 'xlsx' ? styles.toggleBtnActive : ''}`}
                onClick={() => handleFormatChange('xlsx')}
              >
                XLSX
              </button>
            )}
          </div>
        </div>

        {/* ── Drop zone ────────────────────────────────────────────────────── */}
        <div
          className={`${styles.dropZone} ${dragging ? styles.dragging : ''} ${file ? styles.hasFile : ''}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => !file && fileRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label={`Přetáhněte ${format.toUpperCase()} soubor nebo klikněte pro výběr`}
          onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept={acceptedExtensions.join(',')}
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) selectFile(f); }}
          />
          {!file ? (
            <>
              <div className={styles.dropIcon}>{format === 'json' ? '{ }' : format === 'xlsx' ? '📊' : format === 'xml' ? '<>' : '📄'}</div>
              <div className={styles.dropTitle}>Přetáhněte {format.toUpperCase()} soubor</div>
              <div className={styles.dropSubtitle}>nebo klikněte pro výběr — max {MAX_SIZE_MB} MB</div>
            </>
          ) : (
            <>
              <div className={styles.dropIcon}>✓</div>
              <div className={styles.dropTitle}>{file.name}</div>
              <div className={styles.dropSubtitle}>{(file.size / 1024).toFixed(1)} KB</div>
              <button className={styles.clearBtn} onClick={e => { e.stopPropagation(); setFile(null); setError(null); setResult(null); }}>
                Odebrat
              </button>
            </>
          )}
        </div>

        {/* ── Status / chyby ───────────────────────────────────────────────── */}
        {error    && <div className={styles.errorBanner}>{error}</div>}
        {progress && <div className={styles.progressBanner}>{progress}</div>}

        {/* ── Import result (diff indicator) ──────────────────────────────── */}
        {result && (
          <div className={styles.resultBox}>
            <div className={styles.resultTitle}>Import dokončen</div>
            <div className={styles.resultGrid}>
              <div className={`${styles.resultStat} ${styles.resultInserted}`}>
                <span className={styles.resultNum}>{result.inserted}</span>
                <span className={styles.resultStatLabel}>vloženo</span>
              </div>
              <div className={`${styles.resultStat} ${result.updated > 0 ? styles.resultUpdated : styles.resultUpdatedZero}`}>
                <span className={styles.resultNum}>{result.updated}</span>
                <span className={styles.resultStatLabel}>
                  aktualizováno
                  {result.updated > 0 && targetConfig.usesSpiral && (
                    <span className={styles.diffBadge} title={`${result.updated} záznamů bylo přepsáno z ${effectiveSpiral}`}>
                      diff {effectiveSpiral}
                    </span>
                  )}
                </span>
              </div>
              <div className={`${styles.resultStat} ${result.failed > 0 ? styles.resultFailed : styles.resultFailedZero}`}>
                <span className={styles.resultNum}>{result.failed}</span>
                <span className={styles.resultStatLabel}>chyb</span>
              </div>
              {result.rowsParsed != null && (
                <div className={styles.resultStat}>
                  <span className={styles.resultNum}>{result.rowsParsed}</span>
                  <span className={styles.resultStatLabel}>řádků celkem</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Akce ─────────────────────────────────────────────────────────── */}
        <div className={styles.actions}>
          {targetConfig.supportsDryRun && format !== 'xlsx' && (
            <button
              className={styles.secondaryBtn}
              disabled={!file || uploading || preflighting}
              onClick={handleDryRun}
            >
              {preflighting ? 'Počítám…' : 'Dry-run (zkontrolovat)'}
            </button>
          )}
          <button
            className={styles.uploadBtn}
            disabled={!file || uploading}
            onClick={handleUpload}
          >
            {uploading ? 'Nahrávám…' : 'Nahrát a importovat'}
          </button>
        </div>

        {/* ── Preflight result ─────────────────────────────────────────────── */}
        {preflight && (
          <div className={styles.preflightBox}>
            <strong>Výsledek dry-run</strong>
            <div className={styles.preflightMeta}>
              <span>{isServicePreflight(preflight) ? preflight.source_name : preflight.label}</span>
              {isServicePreflight(preflight) && preflight.source_hash_sha256 && (
                <code className={styles.mono}>{preflight.source_hash_sha256}</code>
              )}
              <button type="button" className={styles.secondaryBtn} onClick={handleDownloadPreflight}>
                Stáhnout JSON
              </button>
            </div>
            {isServicePreflight(preflight) ? (
              <>
                <div className={styles.preflightGrid}>
                  <span className={styles.preflightPill}>Služby {preflight.item_count}</span>
                  <span className={styles.preflightPill}>Varianty {preflight.flavour_count}</span>
                  <span className={styles.preflightPill}>Vazby {preflight.explicit_relation_count}</span>
                  <span className={styles.preflightPill}>Zdrojové vazby k dořešení {preflight.raw_prerequisite_count}</span>
                  <span className={styles.preflightPill}>Chybějící služby {preflight.missing_target_count}</span>
                  <span className={styles.preflightPill}>Dočasné záznamy {preflight.stub_count}</span>
                  <span className={styles.preflightPill}>Nejasné reference {preflight.unresolved_ref_count}</span>
                </div>
                <div className={styles.preflightSection}>
                  <div className={styles.preflightSectionTitle}>Chybějící služby</div>
                  {preflight.missing_targets.length === 0 ? (
                    <div className={styles.emptyNote}>Žádné chybějící target služby.</div>
                  ) : (
                    <div className={styles.preflightTable}>
                      <div className={`${styles.preflightRowSingle} ${styles.preflightHead}`}>
                        <span>Service ID</span>
                      </div>
                      {preflight.missing_targets.map((serviceId) => (
                        <div key={serviceId} className={styles.preflightRowSingle}>
                          <span className={styles.mono}>{serviceId}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className={styles.preflightSection}>
                  <div className={styles.preflightSectionTitle}>Nejasné reference</div>
                  {preflight.unresolved_refs.length === 0 ? (
                    <div className={styles.emptyNote}>Žádné nerozpoznané reference.</div>
                  ) : (
                    <div className={styles.preflightTable}>
                      <div className={`${styles.preflightRow} ${styles.preflightHead}`}>
                        <span>Typ</span><span>Service ID</span><span>Raw value</span>
                      </div>
                      {preflight.unresolved_refs.map((ref, index) => (
                        <div key={`${ref.kind}-${ref.service_id ?? 'n-a'}-${index}`} className={styles.preflightRow}>
                          <span>{ref.kind}</span>
                          <span className={styles.mono}>{ref.service_id ?? '—'}</span>
                          <span>{ref.raw_value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className={styles.preflightGrid}>
                  <span className={styles.preflightPill}>Rows {preflight.rowsParsed}</span>
                  <span className={styles.preflightPill}>Valid {preflight.valid_row_count}</span>
                  <span className={styles.preflightPill}>Warnings {preflight.warn_count}</span>
                  <span className={styles.preflightPill}>Errors {preflight.error_count}</span>
                  <span className={styles.preflightPill}>Issues {preflight.issue_count}</span>
                </div>
                <div className={styles.preflightSection}>
                  <div className={styles.preflightSectionTitle}>Validační issues</div>
                  {preflight.issues.length === 0 ? (
                    <div className={styles.emptyNote}>Dry-run nenašel žádné validační problémy.</div>
                  ) : (
                    <div className={styles.preflightTable}>
                      <div className={`${styles.preflightRow} ${styles.preflightHead}`}>
                        <span>Row</span><span>Severity</span><span>Issue</span>
                      </div>
                      {preflight.issues.map((issue, index) => (
                        <div key={`${issue.issue_code}-${issue.row_number}-${index}`} className={styles.preflightRow}>
                          <span className={styles.mono}>{issue.row_number}</span>
                          <span>{issue.severity}</span>
                          <span>{issue.message ?? issue.issue_code}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Format hint ──────────────────────────────────────────────────── */}
        {formatHint && (
          <div className={styles.hint}>
            <strong>Očekávaný formát:</strong> {formatHint}
          </div>
        )}
      </div>
    </div>
  );
}

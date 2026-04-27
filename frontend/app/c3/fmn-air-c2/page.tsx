'use client';

import Link from '@/app/components/AppLink';
import { useMemo, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { apiFetch } from '@/features/services/api/services.api';
import { C3_ROUTES } from '../../lib/c3Routes';
import { useT } from '@/app/i18n/useI18n';
import styles from './fmn-air-c2.module.css';

interface FmnRequirement {
  code: string;
  uuid: string | null;
  title: string;
  entity_kind: string;
  role: 'core' | 'supporting' | string;
  source_documents: string[];
  item_status: string | null;
  note: string;
  is_resolved: boolean;
}

interface FmnServiceCoverage {
  service_id: string;
  title: string;
  service_status_code: string | null;
  coverage_percent: number;
  covered_count: number;
  covered_core_count: number;
  total_core_count: number;
  total_requirement_count: number;
  total_c3_mapping_count: number;
  covered_requirements: FmnRequirement[];
  missing_core_requirements: FmnRequirement[];
}

interface DuplicateCoverage {
  requirement: FmnRequirement;
  services: Array<{ service_id: string; title: string }>;
}

interface FmnAirCoverageResponse {
  framework: {
    name: string;
    spiral: string;
    domain: string;
    source_model_note: string;
  };
  summary: {
    total_requirements: number;
    resolved_requirements: number;
    core_requirements: number;
    unresolved_references: number;
    matching_services: number;
    duplicate_requirement_count: number;
  };
  requirements: FmnRequirement[];
  services: FmnServiceCoverage[];
  duplicate_coverage: DuplicateCoverage[];
}

function buildEndpoint(service: string) {
  const params = new URLSearchParams();
  if (service.trim()) params.set('service', service.trim());
  const query = params.toString();
  return `/api/v1/taxonomy/c3/fmn-air-c2/coverage${query ? `?${query}` : ''}`;
}

function requirementHref(requirement: FmnRequirement) {
  if (requirement.entity_kind === 'technology_interaction') return `/c3/technology-interactions/${encodeURIComponent(requirement.code)}`;
  if (requirement.entity_kind === 'data_object') return `/c3/data-objects/${encodeURIComponent(requirement.code)}`;
  if (requirement.entity_kind === 'application') return `/c3/applications/${encodeURIComponent(requirement.code)}`;
  if (requirement.entity_kind === 'c3_service') return `/c3/services/${encodeURIComponent(requirement.code)}`;
  if (requirement.uuid) return `/c3/${encodeURIComponent(requirement.uuid)}`;
  return null;
}

function entityKindLabel(kind: string) {
  if (kind === 'technology_interaction') return 'TIN';
  if (kind === 'data_object') return 'Data Object';
  if (kind === 'application') return 'Application';
  if (kind === 'c3_service') return 'C3 Service';
  return 'Reference';
}

function RequirementChip({ requirement }: { requirement: FmnRequirement }) {
  const href = requirementHref(requirement);
  const content = (
    <>
      <span className={styles.reqCode}>{requirement.code}</span>
      <span>{requirement.title}</span>
    </>
  );
  return href ? (
    <Link className={styles.reqChip} href={href}>{content}</Link>
  ) : (
    <span className={`${styles.reqChip} ${styles.unresolved}`}>{content}</span>
  );
}

export default function FmnAirC2CoveragePage() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialService = searchParams?.get('service') ?? '';
  const [service, setService] = useState(initialService);
  const endpoint = useMemo(() => buildEndpoint(initialService), [initialService]);
  const { data, error, isLoading } = useSWR<FmnAirCoverageResponse>(endpoint, apiFetch, { revalidateOnFocus: false });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (service.trim()) params.set('service', service.trim());
    router.push(params.toString() ? `/c3/fmn-air-c2?${params}` : '/c3/fmn-air-c2');
  }

  if (error) return <div className={styles.stateError}>{t('fmn_air_c2.error')}</div>;

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>{t('fmn_air_c2.eyebrow')}</div>
          <h1>{t('fmn_air_c2.title')}</h1>
          <p>{t('fmn_air_c2.lead')}</p>
        </div>
        <Link href={C3_ROUTES.graph} className={styles.heroLink}>{t('fmn_air_c2.open_graph')}</Link>
      </header>

      <form className={styles.searchBar} onSubmit={submit}>
        <label>
          {t('fmn_air_c2.service_label')}
          <input value={service} onChange={(event) => setService(event.target.value)} placeholder={t('fmn_air_c2.service_placeholder')} />
        </label>
        <button type="submit">{t('fmn_air_c2.evaluate')}</button>
        <Link href="/c3/fmn-air-c2">{t('fmn_air_c2.show_portfolio')}</Link>
      </form>

      {isLoading || !data ? (
        <div className={styles.state}>{t('fmn_air_c2.loading')}</div>
      ) : (
        <>
          <section className={styles.kpiGrid}>
            <div className={styles.kpi}><span>{t('fmn_air_c2.kpi.resolved')}</span><strong>{data.summary.resolved_requirements}/{data.summary.total_requirements}</strong></div>
            <div className={styles.kpi}><span>{t('fmn_air_c2.kpi.core')}</span><strong>{data.summary.core_requirements}</strong></div>
            <div className={styles.kpi}><span>{t('fmn_air_c2.kpi.services')}</span><strong>{data.summary.matching_services}</strong></div>
          </section>

          <section className={styles.grid}>
            <div className={styles.panel}>
              <h2>{t('fmn_air_c2.best_coverage')}</h2>
              {data.services.length === 0 ? (
                <p className={styles.empty}>{t('fmn_air_c2.empty.services')}</p>
              ) : data.services.map((svc) => (
                <article key={svc.service_id} className={styles.serviceCard}>
                  <div className={styles.serviceHeader}>
                    <div>
                      <Link href={`/services/${encodeURIComponent(svc.service_id)}`} className={styles.serviceTitle}>{svc.service_id} · {svc.title}</Link>
                      <div className={styles.meta}>{svc.covered_core_count}/{svc.total_core_count} {t('fmn_air_c2.core')} · {svc.total_c3_mapping_count} {t('fmn_air_c2.c3_mappings')}</div>
                    </div>
                    <strong className={styles.percent}>{svc.coverage_percent}%</strong>
                  </div>
                  <div className={styles.progress}><span style={{ width: `${Math.min(100, Math.max(0, svc.coverage_percent))}%` }} /></div>
                  <div className={styles.reqList}>
                    {svc.covered_requirements.slice(0, 8).map((req) => <RequirementChip key={`${svc.service_id}-${req.code}`} requirement={req} />)}
                  </div>
                  {svc.missing_core_requirements.length > 0 && (
                    <details className={styles.missing}>
                      <summary>{t('fmn_air_c2.missing')} ({svc.missing_core_requirements.length})</summary>
                      <div className={styles.reqList}>
                        {svc.missing_core_requirements.map((req) => <RequirementChip key={`${svc.service_id}-missing-${req.code}`} requirement={req} />)}
                      </div>
                    </details>
                  )}
                </article>
              ))}
            </div>

            <div className={styles.panel}>
              <h2>{t('fmn_air_c2.requirements')}</h2>
              <div className={styles.requirementTable}>
                {data.requirements.map((req) => (
                  <div key={req.code} className={styles.requirementRow}>
                    <RequirementChip requirement={req} />
                    <span>{entityKindLabel(req.entity_kind)}</span>
                    <span className={req.role === 'core' ? styles.coreBadge : styles.supportBadge}>{req.role}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className={styles.panel}>
            <h2>{t('fmn_air_c2.duplicates')}</h2>
            {data.duplicate_coverage.length === 0 ? (
              <p className={styles.empty}>{t('fmn_air_c2.empty.duplicates')}</p>
            ) : (
              <div className={styles.duplicateGrid}>
                {data.duplicate_coverage.slice(0, 12).map((dup) => (
                  <article key={dup.requirement.code} className={styles.duplicateCard}>
                    <RequirementChip requirement={dup.requirement} />
                    <div className={styles.meta}>{t('fmn_air_c2.duplicate_services', { count: dup.services.length })}</div>
                    <div className={styles.serviceList}>
                      {dup.services.map((svc) => <Link key={svc.service_id} href={`/services/${encodeURIComponent(svc.service_id)}`}>{svc.service_id}</Link>)}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <p className={styles.note}>{data.framework.source_model_note}</p>
        </>
      )}
    </main>
  );
}

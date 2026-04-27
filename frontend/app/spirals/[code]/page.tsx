'use client';

import useSWR from 'swr';
import Link from '@/app/components/AppLink';
import { useParams, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/features/services/api/services.api';
import { Badge, EmptyState } from '@/design-system/controls';
import styles from '@/features/capabilities/capabilities.module.css';

interface HeatmapResponse {
  spiral: { code: string; name?: string | null };
  capabilities: Array<{ slug: string; title: string; coverage_percent: number; requirement_count: number; gap_count: number; status_band: string; recommended_action: string }>;
  top_gaps: Array<{ slug: string; title: string; gap_count: number }>;
}
interface PlanResponse { buckets: Record<string, Array<{ id: string; action: string; confidence: number; gap_count?: number; affected_capabilities: Array<{ slug: string; title: string }> }>> }

export default function SpiralDetailPage() {
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const code = params?.code ?? '';
  const tab = search?.get('tab') ?? 'heatmap';
  const { data, isLoading, error } = useSWR<HeatmapResponse>(code ? `/api/v1/spirals/${code}/heatmap` : null, apiFetch, { revalidateOnFocus: false });
  const plan = useSWR<PlanResponse>(tab === 'fulfillment' && code ? `/api/v1/spirals/${code}/fulfillment-plan` : null, apiFetch, { revalidateOnFocus: false });
  if (isLoading) return <div className={styles.state}>Loading spiral…</div>;
  if (error || !data) return <div className={styles.state}>Spiral unavailable.</div>;
  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div><p className={styles.lead}>Spirals / {data.spiral.code}</p><h1 className={styles.title}>{data.spiral.name ?? data.spiral.code}</h1></div>
        <nav className={styles.pills}><Link href={`/spirals/${code}`} className={`${styles.pill} ${tab === 'heatmap' ? styles.activePill : ''}`}>Heatmap</Link><Link href={`/spirals/${code}?tab=fulfillment`} className={`${styles.pill} ${tab === 'fulfillment' ? styles.activePill : ''}`}>Fulfillment Plan</Link></nav>
      </header>
      {tab === 'fulfillment' ? <Fulfillment plan={plan.data} /> : <Heatmap data={data} />}
    </main>
  );
}

function Heatmap({ data }: { data: HeatmapResponse }) {
  return (
    <section className={styles.layout}>
      <div className={styles.heatmap}>
        {data.capabilities.map((capability) => (
          <Link key={capability.slug} href={`/capabilities/${capability.slug}?spiral=${data.spiral.code}`} className={`${styles.cell} ${styles[capability.status_band] ?? ''}`}>
            <Badge variant={capability.coverage_percent >= 80 ? 'success' : capability.coverage_percent >= 50 ? 'warning' : 'danger'}>{capability.coverage_percent}%</Badge>
            <strong>{capability.title}</strong>
            <small>{capability.gap_count} gaps · {capability.recommended_action}</small>
          </Link>
        ))}
      </div>
      <aside className={styles.panel}><h2 className={styles.panelTitle}>Needs attention</h2>{data.top_gaps.map((gap) => <p key={gap.slug}><Link href={`/capabilities/${gap.slug}?spiral=${data.spiral.code}`}>{gap.title}</Link> · {gap.gap_count} gaps</p>)}</aside>
    </section>
  );
}

function Fulfillment({ plan }: { plan?: PlanResponse }) {
  if (!plan) return <div className={styles.state}>Loading fulfillment plan…</div>;
  const entries = Object.entries(plan.buckets);
  return <section className={styles.grid}>{entries.map(([bucket, rows]) => <article key={bucket} className={styles.panel}><h2 className={styles.panelTitle}>{bucket.replaceAll('_', ' ')}</h2>{rows.length === 0 ? <EmptyState title="No actions in this bucket" /> : rows.map((row) => <p key={row.id}>{row.action} · confidence {Math.round(row.confidence * 100)}%</p>)}</article>)}</section>;
}

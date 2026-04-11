'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CapabilityDetailPage } from '@/features/c3/components/CapabilityDetailPage';
import { authHeaders } from '@/features/services/api/services.api';

interface Props {
  params: Promise<{ uuid: string }>;
}

type ResolveState =
  | { kind: 'resolving' }
  | { kind: 'capability' }
  | { kind: 'redirecting' }
  | { kind: 'missing' }
  | { kind: 'error'; message: string };

interface PickerRow {
  id: number;
  uuid: string;
  code: string;
}

const ENTITY_EDIT_TARGETS = [
  { endpoint: '/api/v1/taxonomy/c3-data-objects', editBasePath: '/c3/data-objects' },
  { endpoint: '/api/v1/taxonomy/c3-applications', editBasePath: '/c3/applications' },
  { endpoint: '/api/v1/taxonomy/c3-services-list', editBasePath: '/c3/services' },
  { endpoint: '/api/v1/taxonomy/c3-tins', editBasePath: '/c3/technology-interactions' },
] as const;

async function fetchEditTarget(url: string) {
  let response = await fetch(url, {
    cache: 'no-store',
    headers: {
      ...authHeaders(),
      'Cache-Control': 'no-cache',
    },
  });
  if (response.status === 304) {
    response = await fetch(url, {
      cache: 'no-store',
      headers: {
        ...authHeaders(),
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });
  }
  return response;
}

function buildEntityEditHref(editBasePath: string, row: PickerRow) {
  const code = String(row.code ?? '').trim();
  if (!code) return editBasePath;
  return `${editBasePath}/${encodeURIComponent(code)}/edit`;
}

export default function C3ItemEditPage({ params }: Props) {
  const { uuid } = use(params);
  const router = useRouter();
  const [state, setState] = useState<ResolveState>({ kind: 'resolving' });

  useEffect(() => {
    let cancelled = false;

    async function resolveTarget() {
      try {
        const capabilityResponse = await fetchEditTarget(`/api/v1/taxonomy/c3/${encodeURIComponent(uuid)}`);
        if (capabilityResponse.ok) {
          if (!cancelled) setState({ kind: 'capability' });
          return;
        }
        if (capabilityResponse.status !== 404) {
          const text = await capabilityResponse.text().catch(() => '');
          throw new Error(text || `Capability lookup selhal (${capabilityResponse.status}).`);
        }

        for (const target of ENTITY_EDIT_TARGETS) {
          const response = await fetchEditTarget(target.endpoint);
          if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(text || `Entity lookup selhal (${response.status}).`);
          }

          const rows = (await response.json()) as PickerRow[];
          const match = rows.find((row) => String(row.uuid ?? '').trim() === uuid);
          if (!match) continue;

          if (!cancelled) {
            setState({ kind: 'redirecting' });
            router.replace(buildEntityEditHref(target.editBasePath, match));
          }
          return;
        }

        if (!cancelled) setState({ kind: 'missing' });
      } catch (error) {
        if (!cancelled) {
          setState({
            kind: 'error',
            message: error instanceof Error ? error.message : 'Nepodařilo se rozpoznat správný editor C3 položky.',
          });
        }
      }
    }

    resolveTarget();
    return () => {
      cancelled = true;
    };
  }, [router, uuid]);

  if (state.kind === 'capability') {
    return <CapabilityDetailPage uuid={uuid} mode="edit" />;
  }
  if (state.kind === 'redirecting' || state.kind === 'resolving') {
    return <div style={{ padding: '2rem' }}>Načítám správný editor…</div>;
  }
  if (state.kind === 'missing') {
    return <div style={{ padding: '2rem' }}>Chyba: C3 položka nenalezena.</div>;
  }
  return <div style={{ padding: '2rem' }}>Chyba: {state.message}</div>;
}

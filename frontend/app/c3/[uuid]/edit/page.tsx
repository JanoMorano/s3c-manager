'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CapabilityDetailPage } from '@/features/c3/components/CapabilityDetailPage';
import { authHeaders } from '@/features/services/api/services.api';
import { useT } from '@/app/i18n/useI18n';

interface Props {
  params: Promise<{ uuid: string }>;
}

type ResolveState =
  | { kind: 'resolving' }
  | { kind: 'capability' }
  | { kind: 'redirecting' }
  | { kind: 'missing' }
  | { kind: 'error'; message: string | null; lookup?: LookupKind; status?: number };

type LookupKind = 'capability' | 'entity';

/** Lookup failure without a server message; translated at render time. */
class LookupFailure extends Error {
  constructor(readonly lookup: LookupKind, readonly status: number) {
    super('');
  }
}

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
  const t = useT();
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
          if (text) throw new Error(text);
          throw new LookupFailure('capability', capabilityResponse.status);
        }

        for (const target of ENTITY_EDIT_TARGETS) {
          const response = await fetchEditTarget(target.endpoint);
          if (!response.ok) {
            const text = await response.text().catch(() => '');
            if (text) throw new Error(text);
            throw new LookupFailure('entity', response.status);
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
          setState(error instanceof LookupFailure
            ? { kind: 'error', message: null, lookup: error.lookup, status: error.status }
            : { kind: 'error', message: error instanceof Error ? error.message : null });
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
    return <div style={{ padding: '2rem' }}>{t('c3.edit.resolving')}</div>;
  }
  if (state.kind === 'missing') {
    return <div style={{ padding: '2rem' }}>{t('c3.edit.not_found')}</div>;
  }
  const message = state.message
    ?? (state.lookup === 'capability'
      ? t('c3.edit.capability_lookup_failed', { status: state.status ?? '' })
      : state.lookup === 'entity'
        ? t('c3.edit.entity_lookup_failed', { status: state.status ?? '' })
        : t('c3.edit.resolve_failed'));
  return <div style={{ padding: '2rem' }}>{t('c3.edit.error', { message })}</div>;
}

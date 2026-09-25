import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { fetchServiceFlavours, type FlavourRecord } from '@/features/services/api/editor.api';
import { authHeaders } from '@/features/services/api/services.api';

interface RawField {
  id: number;
  field_name: string;
  raw_value: string;
  parser_version: string | null;
  created_at: string;
}

const NO_FLAVOURS: FlavourRecord[] = [];

/** Import evidence of the service editor: raw import fields (loaded when opened) and legacy flavours. */
export function useFlavourEvidence({ id }: { id: string }) {
  // ── Import source evidence — audit trail ─────────────────────────────────
  const [rawFields, setRawFields] = useState<RawField[]>([]);
  const [rawFieldsOpen, setRawFieldsOpen] = useState(false);
  useEffect(() => {
    if (!rawFieldsOpen) return;
    fetch(`/api/v1/services/${id}/raw-fields`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(setRawFields)
      .catch(() => {});
  }, [id, rawFieldsOpen]);

  // ── Legacy flavours (read-only evidence) ─────────────────────────────────
  const { data: flavours = NO_FLAVOURS, error } = useSWR<FlavourRecord[]>(
    `editor:flavours:${id}`,
    () => fetchServiceFlavours(id),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
  const flavourError = error
    ? (error instanceof Error ? error.message : 'Legacy variant evidence could not be loaded')
    : null;

  return {
    rawFields,
    rawFieldsOpen,
    setRawFieldsOpen,
    flavours,
    flavourError,
  };
}

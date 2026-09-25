import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { authHeaders } from '@/features/services/api/services.api';
import type { ServiceC3Mapping } from '@/features/services/model/service.types';
import type { C3TaxonomyCapabilityRow, Level3CapabilityOption, PreviewMappingResponse } from './schema';
import type { Translate } from './EditorFields';
import { useEditorList } from './editorData';

interface PreviewState {
  key: string;
  preview: PreviewMappingResponse | null;
  error: string | null;
  busy: boolean;
}

const NO_CAPABILITIES: Level3CapabilityOption[] = [];

async function fetchLevel3Capabilities(): Promise<Level3CapabilityOption[]> {
  const response = await fetch('/api/v1/taxonomy/c3?item_type=CP&limit=1000', {
    credentials: 'include',
    headers: { ...authHeaders(), 'Cache-Control': 'no-cache' },
  });
  const payload = response.ok ? await response.json() : [];
  return (Array.isArray(payload) ? payload : [])
    .filter((item: C3TaxonomyCapabilityRow) => String(item.item_type ?? '').toUpperCase() === 'CP')
    .filter((item: C3TaxonomyCapabilityRow) => Number(item.level_num) === 3)
    .map((item: C3TaxonomyCapabilityRow) => ({
      uuid: item.uuid,
      page_id: item.external_id ?? item.source_external_id ?? null,
      title: item.title ?? item.uuid,
      parent: item.parent_title ? { title: item.parent_title } : null,
    }));
}

/** C3 capability mappings of the service editor, with the coverage preview of a new mapping. */
export function useC3MappingEditor({ id, mutateReadiness, t }: { id: string; mutateReadiness: () => Promise<unknown>; t: Translate }) {
  // ── C3 Taxonomy mappings ──────────────────────────────────────────────────
  const { items: c3Mappings, reload: loadC3Mappings } = useEditorList<ServiceC3Mapping>(
    `editor:c3-mappings:${id}`,
    async () => {
      const r = await fetch(`/api/v1/taxonomy/mapping/${id}`, { headers: authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
  );
  const [c3Busy,       setC3Busy]       = useState(false);
  const [c3Error,      setC3Error]      = useState<string | null>(null);
  const [showC3Add,    setShowC3Add]    = useState(false);
  const [c3Form,       setC3Form]       = useState({ c3_uuid: '', mapping_type_code: 'supports', is_primary: false, mapping_note: '' });

  // Level 3 capabilities for the picker, loaded when the add form opens.
  const { data: level3Capabilities = NO_CAPABILITIES } = useSWR<Level3CapabilityOption[]>(
    showC3Add ? 'editor:c3-level3-capabilities' : null,
    fetchLevel3Capabilities,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );

  // Coverage preview of the capability being added; results belong to one
  // capability + mapping type, so switching them never shows a stale preview.
  const previewKey = showC3Add && c3Form.c3_uuid ? `${c3Form.c3_uuid}|${c3Form.mapping_type_code}` : null;
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const currentPreview = previewState && previewState.key === previewKey ? previewState : null;
  const c3Preview = currentPreview?.preview ?? null;
  const c3PreviewBusy = currentPreview?.busy ?? false;
  const c3PreviewError = currentPreview?.error ?? null;

  useEffect(() => {
    if (!previewKey) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPreviewState({ key: previewKey, preview: null, error: null, busy: true });
      try {
        const response = await fetch(`/api/v1/services/${id}/preview-mapping`, {
          method: 'POST',
          credentials: 'include',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ capability_uuid: c3Form.c3_uuid, mapping_type_code: c3Form.mapping_type_code }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error((payload as { error?: string }).error ?? `HTTP ${response.status}`);
        setPreviewState({ key: previewKey, preview: payload as PreviewMappingResponse, error: null, busy: false });
      } catch (error: unknown) {
        if (!controller.signal.aborted) {
          setPreviewState({
            key: previewKey,
            preview: null,
            error: error instanceof Error ? error.message : t('service_editor.c3.preview.failed'),
            busy: false,
          });
        }
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [c3Form.c3_uuid, c3Form.mapping_type_code, id, previewKey, t]);

  const handleC3Add = async () => {
    if (!c3Form.c3_uuid.trim()) { setC3Error(t('service_editor.c3.error_required')); return; }
    setC3Busy(true); setC3Error(null);
    try {
      const r = await fetch(`/api/v1/taxonomy/mapping/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(c3Form),
      });
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.error ?? `HTTP ${r.status}`); }
      setC3Form({ c3_uuid: '', mapping_type_code: 'supports', is_primary: false, mapping_note: '' });
      setPreviewState(null);
      setShowC3Add(false);
      await loadC3Mappings();
      await mutateReadiness();
    } catch (e: unknown) { setC3Error(e instanceof Error ? e.message : t('common.failed')); }
    finally { setC3Busy(false); }
  };

  const handleC3Delete = async (mappingId: number) => {
    if (!confirm(t('service_editor.c3.confirm_remove'))) return;
    setC3Busy(true); setC3Error(null);
    try {
      const r = await fetch(`/api/v1/taxonomy/mapping/${id}/${mappingId}`, { method: 'DELETE', headers: authHeaders() });
      if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        throw new Error((b as { error?: string }).error ?? `HTTP ${r.status}`);
      }
      await loadC3Mappings();
      await mutateReadiness();
    } catch (e: unknown) { setC3Error(e instanceof Error ? e.message : t('service_editor.c3.delete_failed')); }
    finally { setC3Busy(false); }
  };

  return {
    c3Mappings,
    c3Busy,
    c3Error,
    showC3Add,
    setShowC3Add,
    c3Form,
    setC3Form,
    c3Preview,
    c3PreviewBusy,
    c3PreviewError,
    level3Capabilities,
    handleC3Add,
    handleC3Delete,
  };
}

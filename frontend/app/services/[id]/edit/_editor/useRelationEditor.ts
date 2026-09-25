import { useState } from 'react';
import { createRelation, deleteRelation, updateRelation, type RelationPatch } from '@/features/services/api/editor.api';
import { useT } from '@/app/i18n/useI18n';

/** Service relations of the service editor: add, inline edit and delete. */
export function useRelationEditor({ id, mutate, mutateReadiness }: { id: string; mutate: () => Promise<unknown>; mutateReadiness: () => Promise<unknown> }) {
  // ── Relations state ──────────────────────────────────────────────────────
  const t = useT();
  const [relBusy,       setRelBusy]       = useState(false);
  const [relError,      setRelError]      = useState<string | null>(null);
  const [showRelAdd,    setShowRelAdd]    = useState(false);
  const [relForm,       setRelForm]       = useState({ to_service_id: '', relation_type: 'depends_on', relation_label: '' });
  // Inline edit existing relation
  const [editRelId,     setEditRelId]     = useState<number | null>(null);
  const [editRelForm,   setEditRelForm]   = useState<RelationPatch>({});

  const handleRelAdd = async () => {
    if (!relForm.to_service_id.trim()) { setRelError(t('service_editor.text.target_service_id_is_required')); return; }
    setRelBusy(true); setRelError(null);
    try {
      await createRelation({ from_service_id: id, to_service_id: relForm.to_service_id.trim(), relation_type: relForm.relation_type, relation_label: relForm.relation_label || undefined });
      setRelForm({ to_service_id: '', relation_type: 'depends_on', relation_label: '' });
      setShowRelAdd(false);
      await mutate();
      await mutateReadiness();
    } catch (e: unknown) { setRelError(e instanceof Error ? e.message : t('service_editor.text.failed_to_add')); }
    finally { setRelBusy(false); }
  };

  const handleRelEditOpen = (r: { id: number; relation_type: string; relation_label?: string | null; impact_mode?: string | null; impact_level?: string | null; is_verified?: boolean | null; pace_code?: string | null }) => {
    setEditRelId(r.id);
    setEditRelForm({
      relation_type:  r.relation_type,
      relation_label: r.relation_label ?? undefined,
      impact_mode:    r.impact_mode    ?? undefined,
      impact_level:   r.impact_level   ?? undefined,
      is_verified:    r.is_verified    ?? undefined,
      pace_code:      r.pace_code      ?? undefined,
    });
  };

  const handleRelEditSave = async () => {
    if (editRelId == null) return;
    setRelBusy(true); setRelError(null);
    try {
      await updateRelation(editRelId, editRelForm);
      setEditRelId(null); setEditRelForm({});
      await mutate();
      await mutateReadiness();
    } catch (e: unknown) { setRelError(e instanceof Error ? e.message : t('service_editor.text.save_failed')); }
    finally { setRelBusy(false); }
  };

  const handleRelDelete = async (relId: number) => {
    if (!confirm(t('service_editor.text.delete_this_relationship'))) return;
    setRelBusy(true); setRelError(null);
    try { await deleteRelation(relId); await mutate(); await mutateReadiness(); }
    catch (e: unknown) { setRelError(e instanceof Error ? e.message : t('service_editor.text.delete_failed')); }
    finally { setRelBusy(false); }
  };

  return {
    relBusy,
    relError,
    showRelAdd,
    setShowRelAdd,
    relForm,
    setRelForm,
    editRelId,
    setEditRelId,
    editRelForm,
    setEditRelForm,
    handleRelAdd,
    handleRelEditOpen,
    handleRelEditSave,
    handleRelDelete,
  };
}

import { useMemo, useState } from 'react';
import {
  fetchServiceOfferingsEditor, createOffering, updateOffering, deleteOffering,
  fetchServiceSupportModelEditor, replaceSupportModel,
  fetchServiceAudienceEditor, replaceAudiencePolicies,
  fetchServiceOperationalLinksEditor, createOperationalLink, updateOperationalLink, deleteOperationalLink,
  type ServiceOfferingBody, type ServiceSupportModelBody, type ServiceAudiencePolicyBody, type ServiceOperationalLinkBody,
} from '@/features/services/api/editor.api';
import type { ServiceOffering, ServiceOperationalLink } from '@/features/services/model/service.types';
import { useDraftList, useEditorList } from './editorData';

/** Offerings, support model, audience policies and operational links of the service editor. */
export function useServiceModelEditor({ id, mutate, setPhase4Saved }: { id: string; mutate: () => Promise<unknown>; setPhase4Saved: (message: string | null) => void }) {
  // ── Offerings state ──────────────────────────────────────────────────────
  const { items: offerings, reload: loadOfferings } = useEditorList<ServiceOffering>(
    `editor:offerings:${id}`, () => fetchServiceOfferingsEditor(id),
  );
  const [offeringBusy, setOfferingBusy] = useState(false);
  const [offeringError, setOfferingError] = useState<string | null>(null);
  const [editOfferingId, setEditOfferingId] = useState<number | null>(null);
  const [showOfferingAdd, setShowOfferingAdd] = useState(false);
  const [offeringForm, setOfferingForm] = useState<ServiceOfferingBody>({});

  // ── Support model state ──────────────────────────────────────────────────
  const supportModelList = useEditorList<ServiceSupportModelBody>(
    `editor:support-model:${id}`, () => fetchServiceSupportModelEditor(id),
  );
  const [supportModels, setSupportModels] = useDraftList(supportModelList.items);
  const [supportBusy, setSupportBusy] = useState(false);
  const [supportError, setSupportError] = useState<string | null>(null);

  // ── Audience state ───────────────────────────────────────────────────────
  const audienceList = useEditorList<ServiceAudiencePolicyBody>(
    `editor:audience:${id}`, () => fetchServiceAudienceEditor(id),
  );
  const [audiencePolicies, setAudiencePolicies] = useDraftList(audienceList.items);
  const [audienceBusy, setAudienceBusy] = useState(false);
  const [audienceError, setAudienceError] = useState<string | null>(null);

  // ── Operational links state ──────────────────────────────────────────────
  const { items: operationalLinks, reload: loadOperationalLinks } = useEditorList<ServiceOperationalLink>(
    `editor:operational-links:${id}`, () => fetchServiceOperationalLinksEditor(id),
  );
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [editLinkId, setEditLinkId] = useState<number | null>(null);
  const [showLinkAdd, setShowLinkAdd] = useState(false);
  const [linkForm, setLinkForm] = useState<ServiceOperationalLinkBody>({});

  const sortedOfferings = useMemo(
    () => [...offerings].sort((a, b) => {
      const orderA = a.display_order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.display_order ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.title.localeCompare(b.title);
    }),
    [offerings],
  );

  const defaultOffering = useMemo(
    () => sortedOfferings.find((offering) => offering.is_default) ?? null,
    [sortedOfferings],
  );

  const handleOfferingSave = async () => {
    setOfferingBusy(true); setOfferingError(null); setPhase4Saved(null);
    try {
      const body = {
        ...offeringForm,
        is_default: offeringForm.is_default ?? offerings.length === 0,
        display_order: offeringForm.display_order ?? sortedOfferings.length + 1,
      };
      let savedOffering: ServiceOffering;
      if (editOfferingId != null) {
        savedOffering = await updateOffering(id, editOfferingId, body);
      } else {
        savedOffering = await createOffering(id, body);
      }
      if (savedOffering.is_default) {
        await Promise.all(
          offerings
            .filter((item) => item.id !== savedOffering.id && item.is_default)
            .map((item) => updateOffering(id, item.id, { is_default: false })),
        );
      }
      setEditOfferingId(null);
      setOfferingForm({});
      setShowOfferingAdd(false);
      await loadOfferings();
      await mutate();
      setPhase4Saved('Offerings saved');
    } catch (e: unknown) {
      setOfferingError(e instanceof Error ? e.message : 'Offering save failed');
    } finally {
      setOfferingBusy(false);
    }
  };

  const handleOfferingMakeDefault = async (offering: ServiceOffering) => {
    setOfferingBusy(true); setOfferingError(null); setPhase4Saved(null);
    try {
      await Promise.all(
        offerings.map((item) => updateOffering(id, item.id, { is_default: item.id === offering.id })),
      );
      await loadOfferings();
      await mutate();
      setPhase4Saved(`${offering.title} is now the default offering`);
    } catch (e: unknown) {
      setOfferingError(e instanceof Error ? e.message : 'Default offering update failed');
    } finally {
      setOfferingBusy(false);
    }
  };

  const handleOfferingReorder = async (offeringId: number, direction: -1 | 1) => {
    const currentIndex = sortedOfferings.findIndex((offering) => offering.id === offeringId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= sortedOfferings.length) return;
    const reordered = [...sortedOfferings];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, moved);
    setOfferingBusy(true); setOfferingError(null); setPhase4Saved(null);
    try {
      await Promise.all(
        reordered.map((offering, index) => (
          offering.display_order === index + 1
            ? Promise.resolve(offering)
            : updateOffering(id, offering.id, { display_order: index + 1 })
        )),
      );
      await loadOfferings();
      await mutate();
      setPhase4Saved('Offering order saved');
    } catch (e: unknown) {
      setOfferingError(e instanceof Error ? e.message : 'Offering reorder failed');
    } finally {
      setOfferingBusy(false);
    }
  };

  const handleOfferingDelete = async (offeringId: number) => {
    if (!confirm('Delete this service offering?')) return;
    setOfferingBusy(true); setOfferingError(null); setPhase4Saved(null);
    try {
      await deleteOffering(id, offeringId);
      await loadOfferings();
      await mutate();
      setPhase4Saved('Offering deleted');
    } catch (e: unknown) {
      setOfferingError(e instanceof Error ? e.message : 'Offering delete failed');
    } finally {
      setOfferingBusy(false);
    }
  };

  const handleSupportSave = async () => {
    setSupportBusy(true); setSupportError(null); setPhase4Saved(null);
    try {
      const filtered = supportModels.filter(item =>
        item.offering_id != null ||
        item.support_owner_name ||
        item.resolver_group ||
        item.support_hours_code ||
        item.support_channel ||
        item.escalation_path ||
        item.maintenance_window ||
        item.review_cadence
      );
      await supportModelList.replace(await replaceSupportModel(id, filtered));
      setPhase4Saved('Support model saved');
      await mutate();
    } catch (e: unknown) {
      setSupportError(e instanceof Error ? e.message : 'Support model save failed');
    } finally {
      setSupportBusy(false);
    }
  };

  const handleAudienceSave = async () => {
    setAudienceBusy(true); setAudienceError(null); setPhase4Saved(null);
    try {
      const filtered = audiencePolicies.filter(item =>
        item.offering_id != null ||
        item.audience_type ||
        item.business_unit ||
        item.region_code ||
        item.eligibility_rule ||
        item.notes
      );
      await audienceList.replace(await replaceAudiencePolicies(id, filtered));
      setPhase4Saved('Audience policies saved');
      await mutate();
    } catch (e: unknown) {
      setAudienceError(e instanceof Error ? e.message : 'Audience save failed');
    } finally {
      setAudienceBusy(false);
    }
  };

  const handleLinkSave = async () => {
    setLinkBusy(true); setLinkError(null); setPhase4Saved(null);
    try {
      if (editLinkId != null) {
        await updateOperationalLink(id, editLinkId, linkForm);
      } else {
        await createOperationalLink(id, linkForm);
      }
      setEditLinkId(null);
      setLinkForm({});
      setShowLinkAdd(false);
      await loadOperationalLinks();
      setPhase4Saved('Operational links saved');
    } catch (e: unknown) {
      setLinkError(e instanceof Error ? e.message : 'Operational link save failed');
    } finally {
      setLinkBusy(false);
    }
  };

  const handleLinkDelete = async (linkId: number) => {
    if (!confirm('Delete this operational link?')) return;
    setLinkBusy(true); setLinkError(null); setPhase4Saved(null);
    try {
      await deleteOperationalLink(id, linkId);
      await loadOperationalLinks();
      setPhase4Saved('Operational link deleted');
    } catch (e: unknown) {
      setLinkError(e instanceof Error ? e.message : 'Operational link delete failed');
    } finally {
      setLinkBusy(false);
    }
  };

  return {
    offerings,
    offeringBusy,
    offeringError,
    editOfferingId,
    setEditOfferingId,
    showOfferingAdd,
    setShowOfferingAdd,
    offeringForm,
    setOfferingForm,
    supportModels,
    setSupportModels,
    supportBusy,
    supportError,
    audiencePolicies,
    setAudiencePolicies,
    audienceBusy,
    audienceError,
    operationalLinks,
    linkBusy,
    linkError,
    editLinkId,
    setEditLinkId,
    showLinkAdd,
    setShowLinkAdd,
    linkForm,
    setLinkForm,
    sortedOfferings,
    defaultOffering,
    handleOfferingSave,
    handleOfferingMakeDefault,
    handleOfferingReorder,
    handleOfferingDelete,
    handleSupportSave,
    handleAudienceSave,
    handleLinkSave,
    handleLinkDelete,
  };
}

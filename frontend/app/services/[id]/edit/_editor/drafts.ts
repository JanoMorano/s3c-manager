import type { Dispatch, SetStateAction } from 'react';
import type { ServiceAudiencePolicyBody, ServiceSupportModelBody } from '@/features/services/api/editor.api';

export function emptySupportModel(): ServiceSupportModelBody {
  return {
    offering_id: null,
    support_owner_name: null,
    resolver_group: null,
    support_hours_code: null,
    support_channel: null,
    escalation_path: null,
    maintenance_window: null,
    review_cadence: null,
  };
}

export function emptyAudiencePolicy(): ServiceAudiencePolicyBody {
  return {
    offering_id: null,
    audience_type: null,
    business_unit: null,
    region_code: null,
    eligibility_rule: null,
    notes: null,
  };
}

export function updateSupportDraft<K extends keyof ServiceSupportModelBody>(
  setter: Dispatch<SetStateAction<ServiceSupportModelBody[]>>,
  index: number,
  key: K,
  value: ServiceSupportModelBody[K],
) {
  setter((items) => items.map((item, currentIndex) => currentIndex === index ? { ...item, [key]: value } : item));
}

export function updateAudienceDraft<K extends keyof ServiceAudiencePolicyBody>(
  setter: Dispatch<SetStateAction<ServiceAudiencePolicyBody[]>>,
  index: number,
  key: K,
  value: ServiceAudiencePolicyBody[K],
) {
  setter((items) => items.map((item, currentIndex) => currentIndex === index ? { ...item, [key]: value } : item));
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useGlobalServiceGroups,
  useNetworkDomains,
  useOrganizationalElements,
  usePortfolioGroups,
  useSecurityClassifications,
  useServiceLines,
  useServiceTypes,
} from '@/features/services/hooks/useServices';
import { authHeaders } from '@/features/services/api/services.api';
import { updateDomains, updateRole } from '@/features/services/api/editor.api';
import { StatusPill } from '@/features/services/components/StatusPill';
import { Button } from '@/design-system/controls/Button';
import styles from './editor.module.css';

const schema = z.object({
  service_id:              z.string().min(1, 'Service ID is required').max(20, 'Max 20 characters'),
  title:                   z.string().min(1, 'Title is required'),
  service_type:            z.string().min(1, 'Service type is required'),
  service_status:          z.string().optional(),
  portfolio_group_code:    z.string().optional(),
  global_service_group_code:z.string().optional(),
  service_line_code:       z.string().optional(),
  organizational_element_code: z.string().optional(),
  summary:                 z.string().optional(),
  detailed_description:    z.string().optional(),
  value_proposition:       z.string().optional(),
  business_purpose:        z.string().optional(),
  service_features:        z.string().optional(),
  scope_text:              z.string().optional(),
  operational_notes_raw:   z.string().optional(),
  sla_restoration_text:    z.string().optional(),
  sla_delivery_text:       z.string().optional(),
  exclusions:              z.string().optional(),
  service_area:            z.string().optional(),
  security_classification: z.string().optional(),
  source_url:              z.string().url('Must be a valid URL').optional().or(z.literal('')),
  unit_of_measure:         z.string().optional(),
  charging_basis:          z.string().optional(),
  rate_note:               z.string().optional(),
  ordering_note:           z.string().optional(),
  retired_note:            z.string().optional(),
  customer_type:           z.string().optional(),
  notes_json:              z.string().optional(),
  sla_availability:        z.coerce.number().min(0).max(100).optional().nullable(),
  sla_restoration:         z.coerce.number().min(0).optional().nullable(),
  sla_delivery:            z.coerce.number().min(0).optional().nullable(),
  service_owner:           z.string().optional(),
  service_owner_email:     z.string().email().optional().or(z.literal('')),
  vlastnik:                z.string().optional(),
  manager:                 z.string().optional(),
  service_owner_org:       z.string().optional(),
  domains:                 z.array(z.string()).optional(),
});

type FormData = z.infer<typeof schema>;

const STATUS_OPTIONS = ['active', 'retired', 'deprecated', 'draft'];

export default function NewServicePage() {
  const router = useRouter();
  const { data: portfolioGroups } = usePortfolioGroups();
  const { data: serviceTypes } = useServiceTypes();
  const { data: networkDomains } = useNetworkDomains();
  const { data: serviceLines } = useServiceLines();
  const { data: orgElements } = useOrganizationalElements();
  const { data: globalServiceGroups } = useGlobalServiceGroups();
  const { data: securityClassifications } = useSecurityClassifications();
  const securityClassificationOptions = securityClassifications?.length
    ? securityClassifications
    : [
        { code: 'OPEN',       name: 'Open',        sort_order: 0 },
        { code: 'STANDARD',   name: 'Standard',    sort_order: 0 },
        { code: 'ELEVATED',   name: 'Elevated',    sort_order: 0 },
        { code: 'RESTRICTED', name: 'Restricted',  sort_order: 0 },
        { code: 'PROTECTED',  name: 'Protected',   sort_order: 0 },
        { code: 'CLASSIFIED', name: 'Classified',  sort_order: 0 },
        { code: 'SENSITIVE',  name: 'Sensitive',   sort_order: 0 },
        { code: 'CONTROLLED', name: 'Controlled',  sort_order: 0 },
      ];

  const domainOptions =
    networkDomains?.map((domain) => domain.code) ??
    ['NEXUS', 'VERTEX', 'ORBIT', 'PULSE', 'RELAY', 'CLOUD', 'GRID', 'PRISM', 'HELIX', 'ZENITH', 'APEX', 'VORTEX', 'MATRIX'];

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty, dirtyFields },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      service_id: '',
      title: '',
      service_type: '',
      service_status: 'draft',
      portfolio_group_code: '',
      global_service_group_code: '',
      service_line_code: '',
      organizational_element_code: '',
      summary: '',
      detailed_description: '',
      value_proposition: '',
      business_purpose: '',
      service_features: '',
      scope_text: '',
      operational_notes_raw: '',
      sla_restoration_text: '',
      sla_delivery_text: '',
      exclusions: '',
      service_area: '',
      security_classification: '',
      source_url: '',
      unit_of_measure: '',
      charging_basis: '',
      rate_note: '',
      ordering_note: '',
      retired_note: '',
      customer_type: '',
      notes_json: '',
      service_owner: '',
      service_owner_email: '',
      vlastnik: '',
      manager: '',
      service_owner_org: '',
      domains: [],
    },
  });

  const watchedDomains = watch('domains') ?? [];
  const dirtyCount = Object.keys(dirtyFields).length;
  const watchedTitle = watch('title');
  const watchedServiceId = watch('service_id');
  const watchedStatus = watch('service_status');
  const serviceIdField = register('service_id', {
    setValueAs: (value) => String(value ?? '').toUpperCase(),
  });

  const onSubmit = async (data: FormData) => {
    const serviceId = data.service_id.trim().toUpperCase();

    setSaving(true);
    setSaveError(null);
    setSaved(false);

    try {
      const body = compactPayload({
        service_id: serviceId,
        title: data.title.trim(),
        service_type: data.service_type,
        service_status: data.service_status,
        portfolio_group_code: data.portfolio_group_code,
        global_service_group_code: data.global_service_group_code,
        service_line_code: data.service_line_code,
        organizational_element_code: data.organizational_element_code,
        summary: data.summary?.trim(),
        detailed_description: data.detailed_description?.trim(),
        value_proposition: data.value_proposition?.trim(),
        business_purpose: data.business_purpose?.trim(),
        service_features: data.service_features?.trim(),
        scope_text: data.scope_text?.trim(),
        operational_notes_raw: data.operational_notes_raw?.trim(),
        sla_restoration_text: data.sla_restoration_text?.trim(),
        sla_delivery_text: data.sla_delivery_text?.trim(),
        exclusions: data.exclusions?.trim(),
        service_area: data.service_area?.trim(),
        security_classification: data.security_classification,
        source_url: data.source_url?.trim(),
        unit_of_measure: data.unit_of_measure?.trim(),
        charging_basis: data.charging_basis?.trim(),
        rate_note: data.rate_note?.trim(),
        ordering_note: data.ordering_note?.trim(),
        retired_note: data.retired_note?.trim(),
        customer_type: data.customer_type
          ? JSON.stringify(
              data.customer_type
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
            )
          : null,
        notes_json: data.notes_json?.trim(),
        sla_availability: data.sla_availability ?? null,
        sla_restoration: data.sla_restoration ?? null,
        sla_delivery: data.sla_delivery ?? null,
      });

      const res = await fetch('/api/v1/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const responseText = await res.text().catch(() => '');
        let responseBody: { error?: string; errors?: Array<{ message?: string }> } | null = null;
        if (responseText) {
          try {
            responseBody = JSON.parse(responseText) as { error?: string; errors?: Array<{ message?: string }> };
          } catch {
            responseBody = null;
          }
        }
        const firstError = Array.isArray(responseBody?.errors) ? responseBody.errors[0]?.message : null;
        throw new Error(firstError || responseBody?.error || responseText || `POST /services ${res.status}`);
      }

      const created = (await res.json()) as { service_id?: string };
      const createdId = created.service_id ?? serviceId;

      if ((dirtyFields.domains || watchedDomains.length > 0) && watchedDomains.length > 0) {
        await updateDomains(createdId, watchedDomains);
      }

      if (dirtyFields.service_owner || dirtyFields.service_owner_email || dirtyFields.service_owner_org) {
        await updateRole(createdId, {
          roleCode: 'service_owner',
          displayName: data.service_owner?.trim() || null,
          email: data.service_owner_email?.trim() || '',
          orgName: data.service_owner_org?.trim() || undefined,
        });
      }

      if (dirtyFields.vlastnik && data.vlastnik?.trim()) {
        await updateRole(createdId, {
          roleCode: 'service_area_owner',
          displayName: data.vlastnik.trim(),
        });
      }

      if (dirtyFields.manager && data.manager?.trim()) {
        await updateRole(createdId, {
          roleCode: 'service_delivery_manager',
          displayName: data.manager.trim(),
        });
      }

      setSaved(true);
      router.push(`/services/${createdId}/edit`);
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={styles.shell} onSubmit={handleSubmit(onSubmit)}>
      <div className={styles.editorHeader}>
        <div>
          <span className={styles.serviceId}>{watchedServiceId?.trim() ? watchedServiceId.trim().toUpperCase() : 'NEW SERVICE'}</span>
          <h1 className={styles.editorTitle}>{watchedTitle?.trim() || 'New Service'}</h1>
        </div>
        <StatusPill status={watchedStatus || 'draft'} />
      </div>

      <div className={styles.editorBody}>
        <div className={styles.formArea}>
          <EditorSection id="identity" title="1. Basic Identity">
            <div className={styles.fieldRow}>
              <Field label="Service ID *" error={errors.service_id?.message}>
                <input
                  {...serviceIdField}
                  className={fieldClass(errors.service_id)}
                  placeholder="e.g. WPS001"
                  maxLength={20}
                  style={{ textTransform: 'uppercase' }}
                />
              </Field>
              <Field label="Title *" error={errors.title?.message}>
                <input {...register('title')} className={fieldClass(errors.title)} />
              </Field>
              <Field label="Service Type *" error={errors.service_type?.message}>
                <select {...register('service_type')} className={fieldClass(errors.service_type)}>
                  <option value="">— select —</option>
                  {serviceTypes?.map((type) => (
                    <option key={type.code} value={type.code}>
                      {type.code} — {type.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select {...register('service_status')} className={styles.input}>
                  <option value="">— select —</option>
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </EditorSection>

          <EditorSection id="description" title="2. Description">
            <Field label="Short Description (summary)">
              <textarea {...register('summary')} rows={2} className={styles.textarea} />
            </Field>
            <Field label="Detailed Description">
              <textarea {...register('detailed_description')} rows={4} className={styles.textarea} />
            </Field>
            <Field label="Value Proposition">
              <textarea {...register('value_proposition')} rows={3} className={styles.textarea} />
            </Field>
            <Field label="Business Purpose">
              <textarea
                {...register('business_purpose')}
                rows={3}
                className={styles.textarea}
                placeholder="Describe the business purpose and customer value…"
              />
            </Field>
            <Field label="Service Features">
              <textarea {...register('service_features')} rows={3} className={styles.textarea} />
            </Field>
            <Field label="Scope">
              <textarea
                {...register('scope_text')}
                rows={3}
                className={styles.textarea}
                placeholder="Describe the scope of this service…"
              />
            </Field>
          </EditorSection>

          <EditorSection id="classification" title="3. Classification">
            <div className={styles.fieldRow}>
              <Field label="Portfolio Group">
                <select {...register('portfolio_group_code')} className={styles.input}>
                  <option value="">— select —</option>
                  {portfolioGroups?.map((group) => (
                    <option key={group.code} value={group.code}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Security Classification">
                <select {...register('security_classification')} className={styles.input}>
                  <option value="">— select —</option>
                  {securityClassificationOptions.map((classification) => (
                    <option key={classification.code} value={classification.code}>
                      {classification.code} — {classification.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Service Area">
                <input {...register('service_area')} className={styles.input} placeholder="e.g. IT, Finance, HR…" />
              </Field>
            </div>
            <div className={styles.fieldRow}>
              <Field label="Global Service Group">
                <select {...register('global_service_group_code')} className={styles.input}>
                  <option value="">— select —</option>
                  {globalServiceGroups?.map((group) => (
                    <option key={group.code} value={group.code}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Service Line">
                <select {...register('service_line_code')} className={styles.input}>
                  <option value="">— select —</option>
                  {serviceLines?.map((line) => (
                    <option key={line.code} value={line.code}>
                      {line.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Organizational Element">
                <select {...register('organizational_element_code')} className={styles.input}>
                  <option value="">— select —</option>
                  {orgElements?.map((element) => (
                    <option key={element.code} value={element.code}>
                      {element.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </EditorSection>

          <EditorSection id="ownership" title="4. Ownership">
            <div className={styles.fieldRow}>
              <Field label="Service Owner">
                <input {...register('service_owner')} className={styles.input} placeholder="Display name" />
              </Field>
              <Field label="Owner Email" error={errors.service_owner_email?.message}>
                <input
                  {...register('service_owner_email')}
                  className={fieldClass(errors.service_owner_email)}
                  placeholder="email@example.com"
                />
              </Field>
            </div>
            <div className={styles.fieldRow}>
              <Field label="Service Area Owner (vlastnik)">
                <input {...register('vlastnik')} className={styles.input} />
              </Field>
              <Field label="Service Delivery Manager">
                <input {...register('manager')} className={styles.input} />
              </Field>
            </div>
            <div className={styles.fieldRow}>
              <Field label="Owner Organization">
                <input
                  className={styles.input}
                  placeholder="Organizace vlastníka"
                  value={watch('service_owner_org') ?? ''}
                  onChange={(event) =>
                    setValue('service_owner_org', event.target.value, {
                      shouldDirty: true,
                    })
                  }
                />
              </Field>
            </div>
            <p className={styles.hint}>Role records are created after the base service is saved.</p>
          </EditorSection>

          <EditorSection id="availability" title="5. Availability & Domains">
            <div className={styles.fieldRow}>
              <Field label="SLA Availability (%)" error={errors.sla_availability?.message}>
                <input type="number" min={0} max={100} step={0.01} {...register('sla_availability')} className={fieldClass(errors.sla_availability)} />
              </Field>
              <Field label="SLA Restoration (hours)" error={errors.sla_restoration?.message}>
                <input type="number" min={0} {...register('sla_restoration')} className={fieldClass(errors.sla_restoration)} />
              </Field>
              <Field label="SLA Delivery (days)" error={errors.sla_delivery?.message}>
                <input type="number" min={0} {...register('sla_delivery')} className={fieldClass(errors.sla_delivery)} />
              </Field>
            </div>
            <Field label="Available On (domains)">
              <div className={styles.domainGrid}>
                {domainOptions.map((domain) => (
                  <label key={domain} className={styles.domainCheck}>
                    <input
                      type="checkbox"
                      checked={watchedDomains.includes(domain)}
                      onChange={(event) => {
                        const next = event.target.checked
                          ? [...watchedDomains, domain]
                          : watchedDomains.filter((item) => item !== domain);
                        setValue('domains', next, { shouldDirty: true });
                      }}
                    />
                    <span>{domain}</span>
                  </label>
                ))}
              </div>
            </Field>
            <p className={styles.hint}>Domain assignments will be written immediately after the service is created.</p>
          </EditorSection>

          <LockedSection
            id="flavours"
            title="6. Pricing Variants"
            description="Pricing variants become available after the first save, when the new service ID exists in the catalog."
          />
          <LockedSection
            id="relationships"
            title="7. Relationships"
            description="Dependencies and related services can be added after the service record has been created."
          />
          <LockedSection
            id="c3mapping"
            title="7b. C3 Taxonomy Mappings"
            description="C3 mappings are attached to an existing service, so this section unlocks after creation."
          />
          <LockedSection
            id="pace"
            title="7c. PACE"
            description="PACE vazby pro dependencies a C3 taxonomy mappingy se nastavují až po vytvoření služby."
          />

          <EditorSection id="governance" title="8. Governance">
            <Field label="Retired / End-of-life Note">
              <textarea {...register('retired_note')} rows={3} className={styles.textarea} />
            </Field>
          </EditorSection>

          <EditorSection id="technical" title="9. Technical">
            <div className={styles.fieldRow}>
              <Field label="Service URL" error={errors.source_url?.message}>
                <input {...register('source_url')} className={fieldClass(errors.source_url)} placeholder="https://…" />
              </Field>
            </div>
            <div className={styles.fieldRow}>
              <Field label="Unit of Measure">
                <input {...register('unit_of_measure')} className={styles.input} />
              </Field>
              <Field label="Charging Basis">
                <input {...register('charging_basis')} className={styles.input} />
              </Field>
              <Field label="Rate Note">
                <input {...register('rate_note')} className={styles.input} />
              </Field>
            </div>
            <Field label="Ordering Note">
              <textarea {...register('ordering_note')} rows={2} className={styles.textarea} />
            </Field>
            <Field label="Operational Notes">
              <textarea
                {...register('operational_notes_raw')}
                rows={3}
                className={styles.textarea}
                placeholder="Internal operational notes, escalation paths, etc."
              />
            </Field>
            <Field label="Exclusions">
              <textarea
                {...register('exclusions')}
                rows={3}
                className={styles.textarea}
                placeholder="What is explicitly not covered by this service…"
              />
            </Field>
            <div className={styles.fieldRow}>
              <Field label="SLA Restoration Text">
                <textarea
                  {...register('sla_restoration_text')}
                  rows={2}
                  className={styles.textarea}
                  placeholder="Free-text restoration SLA description"
                />
              </Field>
              <Field label="SLA Delivery Text">
                <textarea
                  {...register('sla_delivery_text')}
                  rows={2}
                  className={styles.textarea}
                  placeholder="Free-text delivery SLA description"
                />
              </Field>
            </div>
            <Field label="Customer Type">
              <input
                {...register('customer_type')}
                className={styles.input}
                placeholder="e.g. Internal, External, Partner (comma-separated)"
              />
              <span className={styles.hint}>Customer segments this service targets. Comma-separated values, e.g. "Internal, External".</span>
            </Field>
            <Field label="Notes (JSON)">
              <textarea
                {...register('notes_json')}
                rows={4}
                className={styles.textarea}
                placeholder={'{\n  "key": "value"\n}'}
                style={{ fontFamily: 'monospace', fontSize: '12px' }}
              />
              <span className={styles.hint}>Free-form JSON notes stored with the service record.</span>
            </Field>
          </EditorSection>

          <LockedSection
            id="raw-fields"
            title="10. Raw Fields (audit trail)"
            description="Imported raw fields appear only for an already created service and stay read-only."
          />

          <EditorSection id="review" title="11. Review">
            <p className={styles.hint}>Create the base service first. After redirect to edit mode, the remaining management sections stay on the same visual pattern.</p>
            {saveError && <div className={styles.errorBanner}>{saveError}</div>}
            {saved && <div className={styles.successBanner}>Service created successfully.</div>}
          </EditorSection>
        </div>

        <aside className={styles.rail}>
          <div className={styles.railCard}>
            <div className={styles.railTitle}>Save Status</div>
            {saving && <div className={styles.saving}>Creating…</div>}
            {saved && !saving && <div className={styles.savedOk}>✓ Created</div>}
            {saveError && <div className={styles.railError}>{saveError}</div>}
            {isDirty && <div className={styles.dirtyNote}>{dirtyCount} field(s) changed</div>}

            <Button type="submit" loading={saving} style={{ width: '100%', marginBottom: 'var(--space-2)' }}>
              Create service
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              style={{ width: '100%' }}
              onClick={() => {
                if (isDirty && !confirm('You have unsaved changes. Leave anyway?')) return;
                router.push('/management');
              }}
            >
              Cancel
            </Button>
          </div>

          <div className={styles.railCard}>
            <div className={styles.railTitle}>Sections</div>
            <nav className={styles.sectionNav}>
              {['identity', 'description', 'classification', 'ownership', 'availability', 'flavours', 'relationships', 'c3mapping', 'pace', 'governance', 'technical', 'review'].map((section, index) => (
                <a key={section} href={`#${section}`} className={styles.sectionNavItem}>
                  {index + 1}. {section === 'c3mapping' ? 'C3 Taxonomy' : section === 'pace' ? 'PACE' : section.charAt(0).toUpperCase() + section.slice(1)}
                </a>
              ))}
            </nav>
          </div>

          <div className={styles.railCard}>
            <div className={styles.railTitle}>Validation</div>
            {Object.entries(errors).length > 0 ? (
              Object.entries(errors).map(([field, error]) => (
                <div key={field} className={styles.validationError}>
                  {field}: {(error as { message?: string }).message}
                </div>
              ))
            ) : (
              <div className={styles.validOk}>No errors</div>
            )}
          </div>
        </aside>
      </div>
    </form>
  );
}

function EditorSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function LockedSection({ id, title, description }: { id: string; title: string; description: string }) {
  return (
    <EditorSection id={id} title={title}>
      <div className={styles.lockedSection}>
        <p className={styles.hint}>{description}</p>
      </div>
    </EditorSection>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      {children}
      {error && <span className={styles.fieldError}>{error}</span>}
    </div>
  );
}

function fieldClass(error?: { message?: string }) {
  return error ? `${styles.input} ${styles.inputError}` : styles.input;
}

function compactPayload<T extends Record<string, unknown>>(input: T): T {
  const entries = Object.entries(input).filter(([, value]) => value !== undefined && value !== '');
  return Object.fromEntries(entries) as T;
}

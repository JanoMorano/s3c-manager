'use client';

import { use, useMemo, useState } from 'react';
import Link from '@/app/components/AppLink';
import { Button } from '@/design-system/controls/Button';
import { useMyServiceRequests, useService } from '@/features/services/hooks/useServices';
import type { ServiceRequestResponse } from '@/features/services/model/service.types';
import { safeHref } from '@/shared/utils/safeHref';
import styles from './request.module.css';

interface Props { params: Promise<{ id: string }> }

function formatDate(value: string | null | undefined) {
  if (!value) return 'bez data';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'bez data';
  return new Intl.DateTimeFormat('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function ServiceRequestPage({ params }: Props) {
  const { id } = use(params);
  const { data: service, isLoading, error } = useService(id);
  const myRequests = useMyServiceRequests();
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [created, setCreated] = useState<ServiceRequestResponse | null>(null);

  const offering = service?.primary_offering ?? service?.offerings?.find((item) => item.is_default) ?? service?.offerings?.[0] ?? null;
  const externalHref = safeHref(offering?.request_channel_url ?? service?.request_channel_url ?? null);
  const requestable = Boolean((offering?.requestable ?? service?.requestable) || externalHref);
  const approvalRequired = Boolean(offering?.approval_required ?? service?.approval_required);
  const serviceRequests = useMemo(
    () => (myRequests.data?.items ?? []).filter((item) => item.service_id === id).slice(0, 5),
    [id, myRequests.data?.items]
  );

  async function submitRequest() {
    if (!service || !requestable) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/v1/service-requests', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: id,
          offering_id: offering?.id ?? null,
          request_note: note.trim() || null,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Request could not be submitted');
      setCreated(payload as ServiceRequestResponse);
      setNote('');
      await myRequests.mutate();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Request could not be submitted');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <main className={styles.shell}>Načítám request flow...</main>;
  if (error || !service) return <main className={styles.shell}>Službu se nepodařilo načíst.</main>;

  const externalTarget = created?.external_redirect_url ?? externalHref;

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <Link href={`/services/${id}`} className={styles.backLink}>Back to Service 360</Link>
        <div className={styles.titleBlock}>
          <span className={styles.eyebrow}>Request a service</span>
          <h1 className={styles.title}>{service.title}</h1>
          <p className={styles.lead}>
            This wrapper creates a lightweight S3C request log first. If the service uses an external ticketing or ordering channel, the link remains available after submission.
          </p>
        </div>
      </header>

      <section className={styles.grid}>
        <article className={styles.panel}>
          <h2>Request details</h2>
          <div className={styles.facts}>
            <div className={styles.fact}><span>Service ID</span><strong>{service.service_id}</strong></div>
            <div className={styles.fact}><span>Offering</span><strong>{offering?.title ?? offering?.offering_code ?? 'Default service request'}</strong></div>
            <div className={styles.fact}><span>Approval</span><strong>{approvalRequired ? 'Required' : 'Not marked'}</strong></div>
            <div className={styles.fact}><span>Lead time</span><strong>{offering?.lead_time_text ?? service.fulfillment_lead_time_text ?? 'Not specified'}</strong></div>
            <div className={styles.fact}><span>Channel</span><strong>{offering?.request_channel_type ?? service.request_channel_type ?? 'S3C log'}</strong></div>
          </div>

          {requestable ? (
            <div className={styles.form}>
              <label className={styles.label}>
                Business note
                <textarea
                  className={styles.textarea}
                  value={note}
                  onChange={(event) => setNote(event.currentTarget.value)}
                  placeholder="What do you need, for whom, and by when?"
                />
              </label>
              <div className={styles.actions}>
                <Button onClick={submitRequest} disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit request'}
                </Button>
                {externalTarget && (
                  <a href={externalTarget} target="_blank" rel="noreferrer" className={styles.externalLink}>
                    Open external channel
                  </a>
                )}
                <Link href={`/services/${id}`} className={styles.secondaryLink}>Cancel</Link>
              </div>
              {created && (
                <p className={styles.statusGood}>
                  Request {created.item.request_number} is tracked in S3C Manager with status {created.item.status}.
                </p>
              )}
              {submitError && <p className={styles.statusBad}>{submitError}</p>}
            </div>
          ) : (
            <p className={styles.statusBad}>
              This service is not marked requestable and does not expose an ordering channel. Contact the owner or update Service Design data first.
            </p>
          )}
        </article>

        <aside className={styles.panel}>
          <h3>My requests for this service</h3>
          {serviceRequests.length ? (
            <div className={styles.requestList}>
              {serviceRequests.map((item) => (
                <div key={item.id} className={styles.requestRow}>
                  <strong>{item.request_number}</strong>
                  <span>{item.status} · {formatDate(item.created_at)}</span>
                  {item.request_note && <span>{item.request_note}</span>}
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>No previous request logged for your account.</p>
          )}
        </aside>
      </section>
    </main>
  );
}

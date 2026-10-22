'use client';

import Link from '@/app/components/AppLink';
import { useT } from '@/app/i18n/useI18n';
import { formatCountLabel } from '@/app/lib/counts';
import type { CatalogQualitySummary } from '@/features/services/model/service.types';
import { useStoredToggle } from '@/hooks/useStoredToggle';
import styles from './GettingStarted.module.css';

interface Step {
  id: string;
  done: boolean;
  title: string;
  detail: string;
  actions: Array<{ href: string; label: string }>;
}

/**
 * First-run checklist on the home page: the three things that make the
 * catalogue useful (services, owners, capability mapping). Hidden once
 * everything is done or when the user dismisses it.
 */
export default function GettingStarted({
  quality,
  includeCapabilities,
}: {
  quality: CatalogQualitySummary;
  includeCapabilities: boolean;
}) {
  const t = useT();
  const [dismissed, toggleDismissed] = useStoredToggle('s3c_getting_started_dismissed');
  const hasServices = quality.total_services > 0;
  const servicesForms = {
    one: t('home.getting_started.services_count.one'),
    few: t('home.getting_started.services_count.few'),
    many: t('home.getting_started.services_count.many'),
  };

  const steps: Step[] = [
    {
      id: 'services',
      done: hasServices,
      title: t('home.getting_started.services.title'),
      detail: hasServices
        ? t('home.getting_started.services.done', { count: formatCountLabel(quality.total_services, servicesForms) })
        : t('home.getting_started.services.todo'),
      actions: [
        { href: '/import', label: t('home.getting_started.services.import') },
        { href: '/management/new-service', label: t('home.getting_started.services.create') },
      ],
    },
    {
      id: 'owners',
      done: hasServices && quality.missing_owner_count === 0,
      title: t('home.getting_started.owners.title'),
      detail: quality.missing_owner_count > 0
        ? t('home.getting_started.owners.todo', { count: formatCountLabel(quality.missing_owner_count, servicesForms) })
        : t('home.getting_started.owners.done'),
      actions: [{ href: '/services/list?readiness=missing_owner', label: t('home.getting_started.owners.action') }],
    },
  ];
  if (includeCapabilities) {
    steps.push({
      id: 'capabilities',
      done: hasServices && quality.missing_capability_count === 0,
      title: t('home.getting_started.capabilities.title'),
      detail: quality.missing_capability_count > 0
        ? t('home.getting_started.capabilities.todo', { count: formatCountLabel(quality.missing_capability_count, servicesForms) })
        : t('home.getting_started.capabilities.done'),
      actions: [{ href: '/services/list?readiness=missing_capability', label: t('home.getting_started.capabilities.action') }],
    });
  }

  const doneCount = steps.filter((step) => step.done).length;
  if (dismissed || doneCount === steps.length) return null;
  const nextStep = steps.find((step) => !step.done);

  return (
    <section className={styles.panel} aria-labelledby="getting-started-title">
      <header className={styles.header}>
        <h2 id="getting-started-title" className={styles.title}>{t('home.getting_started.title')}</h2>
        <span className={styles.progress}>{t('home.getting_started.progress', { done: doneCount, total: steps.length })}</span>
        <button type="button" className={styles.dismiss} onClick={toggleDismissed}>{t('home.getting_started.dismiss')}</button>
      </header>
      <ol className={styles.steps}>
        {steps.map((step, index) => (
          <li key={step.id} className={`${styles.step} ${step.done ? styles.stepDone : ''} ${step === nextStep ? styles.stepNext : ''}`}>
            <span className={styles.marker} aria-hidden="true">{step.done ? '✓' : index + 1}</span>
            <div className={styles.stepBody}>
              <strong>{step.title}</strong>
              <span className={styles.detail}>{step.detail}</span>
            </div>
            {!step.done && (
              <div className={styles.actions}>
                {step.actions.map((action, actionIndex) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className={step === nextStep && actionIndex === 0 ? styles.primary : styles.secondary}
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

'use client';

import Link from '@/app/components/AppLink';
import { EmptyState } from '@/design-system/controls';
import { useT } from '@/app/i18n/useI18n';
import type { ModuleDefinition } from '@/features/modules/manifest';
import styles from './ModuleInactive.module.css';

// Shown instead of silently redirecting when a route belongs to a module
// whose UI is switched off in this installation.
export default function ModuleInactive({ module }: { module: ModuleDefinition }) {
  const t = useT();
  const labelKey = `modules.label.${module.code}`;
  const translated = t(labelKey);
  const moduleName = translated === labelKey ? module.label : translated;

  return (
    <div className={styles.wrap}>
      <EmptyState
        title={t('modules.inactive.title')}
        description={t('modules.inactive.description', { module: moduleName })}
        action={(
          <div className={styles.actions}>
            <Link href="/administration/installation" className={styles.primary}>{t('modules.inactive.open_settings')}</Link>
            <Link href="/" className={styles.secondary}>{t('modules.inactive.back_home')}</Link>
          </div>
        )}
      />
    </div>
  );
}

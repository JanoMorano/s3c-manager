'use client';

import { useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from '@/app/components/AppLink';
import { useI18n } from '@/app/i18n/useI18n';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import styles from './NavHelpCenter.module.css';

type HelpEntry = {
  id: string;
  title: string;
  text: string;
  href: string;
  tags: string[];
};

function pageContext(pathname: string): string {
  if (pathname.startsWith('/services/list')) return 'seznam služeb';
  if (pathname.startsWith('/services/graph')) return 'graf služeb';
  if (pathname.startsWith('/services/dashboard')) return 'dashboard služeb';
  if (pathname.startsWith('/administration/users')) return 'správa uživatelů';
  if (pathname.startsWith('/admin/import')) return 'import dat';
  if (pathname.startsWith('/operations')) return 'operations';
  if (pathname.startsWith('/c3')) return 'c3 taxonomie';
  return 'aktuální stránka';
}

export default function NavHelpCenter() {
  const { t } = useI18n();
  const pathname = usePathname() ?? '/';
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const context = pageContext(pathname);

  const entries = useMemo<HelpEntry[]>(() => [
    {
      id: 'quick-start',
      title: t('help.article.quick_start_title'),
      text: t('help.article.quick_start_body'),
      href: '/',
      tags: ['start', 'dashboard', 'navigace'],
    },
    {
      id: 'services-list',
      title: t('help.article.services_list_title'),
      text: t('help.article.services_list_body'),
      href: '/services/list',
      tags: ['služby', 'filtr', 'tabulka', 'export'],
    },
    {
      id: 'service-graph',
      title: t('help.article.service_graph_title'),
      text: t('help.article.service_graph_body'),
      href: '/services/graph',
      tags: ['vztahy', 'graf', 'závislosti'],
    },
    {
      id: 'c3',
      title: t('help.article.c3_title'),
      text: t('help.article.c3_body'),
      href: '/c3/dashboard',
      tags: ['c3', 'taxonomie', 'capability map'],
    },
    {
      id: 'user-profile',
      title: t('help.article.profile_title'),
      text: t('help.article.profile_body'),
      href: '/user-info',
      tags: ['profil', 'heslo', 'uživatel'],
    },
  ], [t]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return entries;
    return entries.filter((entry) =>
      `${entry.title} ${entry.text} ${entry.tags.join(' ')}`.toLowerCase().includes(term),
    );
  }, [entries, query]);

  function openContextHelp() {
    setQuery(context);
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className={styles.stack}>
        <DialogTrigger asChild>
          <button type="button" className={styles.trigger}>
            {t('nav.help')}
          </button>
        </DialogTrigger>
        <button type="button" className={styles.contextBtn} onClick={openContextHelp}>
          {t('help.this_page')}
        </button>
      </div>

      <DialogContent className={styles.content}>
        <DialogHeader>
          <DialogTitle>{t('help.title')}</DialogTitle>
          <DialogDescription>{t('help.description')}</DialogDescription>
        </DialogHeader>

        <label htmlFor="help-search" className={styles.searchLabel}>
          {t('help.search_label')}
        </label>
        <Input
          id="help-search"
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('help.search_placeholder')}
          autoComplete="off"
          enterKeyHint="search"
        />

        <div className={styles.results} role="list" aria-label={t('help.results_aria')}>
          {filtered.map((entry) => (
            <article key={entry.id} className={styles.resultCard} role="listitem">
              <h3 className={styles.resultTitle}>{entry.title}</h3>
              <p className={styles.resultText}>{entry.text}</p>
              <Link href={entry.href} className={styles.resultLink} onClick={() => setOpen(false)}>
                {t('help.open_article')}
              </Link>
            </article>
          ))}
          {filtered.length === 0 && (
            <p className={styles.empty}>{t('help.empty')}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

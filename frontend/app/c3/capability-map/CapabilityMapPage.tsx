'use client';

import Link from '@/app/components/AppLink';
import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { apiFetch } from '@/features/services/api/services.api';
import { readStoredC3TaxonomySort } from '../../lib/c3Routes';
import { compareText } from '@/app/i18n/format';
import { useLocale } from '@/app/i18n/useI18n';
import styles from './capability-map.module.css';

const CATALOGUE_STATE_KEY = 'czech_army_sharepoint_live_v2';
const CATALOGUE_STATE_EVENT = 'c3_catalogue_state';

interface CapabilityDomain {
  code: string;
  css_class: string;
  heading_color: string;
  background_color: string;
  label: string;
  sort_order: number;
}

interface CapabilityItem {
  id: number;
  page_id: string;
  uuid: string;
  title: string;
  parent_id: string | null;
  parent_title: string | null;
  level: number;
  state: string | null;
  domain_code: string;
  domain_label: string;
  domain_order: number;
  linked_c3_uuid?: string | null;
  linked_c3_external_id?: string | null;
  linked_c3_title?: string | null;
  linked_service_mapping_count?: number | null;
  linked_has_service_mapping?: boolean | null;
  linked_completeness_status?: string | null;
}

interface CapabilityMapResponse {
  page_title?: string;
  summary: {
    total: number;
    domain_count: number;
  };
  domains: CapabilityDomain[];
  items: CapabilityItem[];
}

interface TooltipState {
  visible: boolean;
  text: string;
  x: number;
  y: number;
}

interface PosterChip {
  item: CapabilityItem;
  mapped: boolean;
  tooltip: string;
  isL2: boolean;
}

interface PosterGroup {
  l2: CapabilityItem;
  mapped: boolean;
  chips: PosterChip[];
}

interface PosterDomainView {
  domain: CapabilityDomain;
  mappedPosterNodesCount: number;
  totalPosterNodesCount: number;
  uaChips: PosterChip[];
  groups: PosterGroup[];
  /** Flat level-1 items shown when domain has no L2 structure (fallback view) */
  flatChips: PosterChip[];
}

interface PosterRuntime {
  stats: {
    totalL4: number;
    mappedL4: number;
    mappedL3: number;
  };
  domains: PosterDomainView[];
  domainByCode: Map<string, CapabilityDomain>;
  getDescendants(pageId: string): CapabilityItem[];
  isMapped(item: CapabilityItem): boolean;
  totalItems: number;
}

interface CapabilityMapPageProps {
  apiPath: string;
  defaultTitle: string;
  activeSpiralCode?: string;
  builderHref?: string;
  emptyStateDescription?: string;
}

interface SpiralBaseline {
  id: number;
  spiral_code: string;
  spiral_label: string;
  is_active: boolean;
  notes: string | null;
}

interface SpiralResponse {
  active: SpiralBaseline | null;
  all: SpiralBaseline[];
}

const FALLBACK_SPIRAL_MAP_LINKS = [
  { code: 'Spiral_6', label: 'Spiral 6', href: '/c3/capability-map-spiral6' },
  { code: 'Spiral_7', label: 'Spiral 7', href: '/c3/capability-map-spiral7' },
];

function spiralNumber(code: string) {
  return code.match(/^Spiral_(\d+)$/)?.[1] ?? code.replace(/\D+/g, '');
}

function buildSpiralHref(code: string) {
  return `/c3/capability-map-spiral${spiralNumber(code)}`;
}

function setsEqual(left: Set<string>, right: Set<string>) {
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

function parseCatalogueState() {
  if (typeof window === 'undefined') return { pageIds: new Set<string>(), uuids: new Set<string>() };
  try {
    const raw = window.localStorage.getItem(CATALOGUE_STATE_KEY);
    if (!raw) return { pageIds: new Set<string>(), uuids: new Set<string>() };
    const state = JSON.parse(raw) as { services?: Array<{ serviceId?: string; c3Uuid?: string }> };
    const services = Array.isArray(state.services) ? state.services : [];
    return {
      pageIds: new Set(services.filter((item) => item.serviceId).map((item) => String(item.serviceId))),
      uuids: new Set(services.filter((item) => item.c3Uuid).map((item) => String(item.c3Uuid))),
    };
  } catch {
    return { pageIds: new Set<string>(), uuids: new Set<string>() };
  }
}

function formatDomainDisplayName(domainCode: string) {
  return domainCode.replace(/([A-Z])/g, ' $1').trim();
}

function buildParentListHref(title: string) {
  const params = new URLSearchParams();
  params.set('parent', title);
  const storedSort = readStoredC3TaxonomySort();
  if (storedSort?.sort) {
    params.set('sort', storedSort.sort);
    params.set('dir', storedSort.dir);
  }
  return `/c3/list?${params.toString()}`;
}

export default function CapabilityMapPage({
  apiPath,
  defaultTitle,
  activeSpiralCode = 'Spiral_7',
  builderHref,
  emptyStateDescription,
}: CapabilityMapPageProps) {
  const router = useRouter();
  const locale = useLocale();
  const { data, isLoading, error } = useSWR<CapabilityMapResponse>(
    apiPath,
    apiFetch,
    { revalidateOnFocus: false },
  );
  const { data: spiralData } = useSWR<SpiralResponse>('/api/v1/taxonomy/spiral', apiFetch, {
    revalidateOnFocus: false,
  });

  const [showUnmapped, setShowUnmapped] = useState(true);
  const [mappedPageIds, setMappedPageIds] = useState<Set<string>>(() => new Set());
  const [mappedUuids, setMappedUuids] = useState<Set<string>>(() => new Set());
  const [infoNode, setInfoNode] = useState<CapabilityItem | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, text: '', x: 0, y: 0 });
  const spiralMapLinks = useMemo(() => {
    const byCode = new Map(FALLBACK_SPIRAL_MAP_LINKS.map((spiral) => [spiral.code, spiral]));
    (spiralData?.all ?? []).forEach((spiral) => {
      byCode.set(spiral.spiral_code, {
        code: spiral.spiral_code,
        label: spiral.spiral_label,
        href: buildSpiralHref(spiral.spiral_code),
      });
    });
    if (activeSpiralCode && !byCode.has(activeSpiralCode)) {
      byCode.set(activeSpiralCode, {
        code: activeSpiralCode,
        label: `Spiral ${spiralNumber(activeSpiralCode) || activeSpiralCode}`,
        href: buildSpiralHref(activeSpiralCode),
      });
    }
    return [...byCode.values()].sort((left, right) => Number(spiralNumber(left.code)) - Number(spiralNumber(right.code)));
  }, [activeSpiralCode, spiralData?.all]);

  useEffect(() => {
    const localState = parseCatalogueState();
    setMappedPageIds(localState.pageIds);
    setMappedUuids(localState.uuids);

    function handleMessage(event: MessageEvent) {
      if (event.data?.type !== CATALOGUE_STATE_EVENT) return;

      const services = Array.isArray(event.data.services) ? event.data.services : [];
      const nextPageIds = new Set<string>(services.filter((item: { serviceId?: string }) => item.serviceId).map((item: { serviceId?: string }) => String(item.serviceId)));
      const nextUuids = new Set<string>(services.filter((item: { c3Uuid?: string }) => item.c3Uuid).map((item: { c3Uuid?: string }) => String(item.c3Uuid)));
      setMappedPageIds(nextPageIds);
      setMappedUuids(nextUuids);
    }

    function pollLocalStorage() {
      const nextState = parseCatalogueState();
      setMappedPageIds((current) => (setsEqual(current, nextState.pageIds) ? current : nextState.pageIds));
      setMappedUuids((current) => (setsEqual(current, nextState.uuids) ? current : nextState.uuids));
    }

    window.addEventListener('message', handleMessage);
    const timer = window.setInterval(pollLocalStorage, 2000);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.clearInterval(timer);
    };
  }, []);

  const pageById = useMemo(
    () => new Map((data?.items ?? []).map((item) => [item.page_id, item])),
    [data?.items],
  );

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setInfoNode(null);
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const runtime = useMemo<PosterRuntime | null>(() => {
    if (!data) return null;

    const domainByCode = new Map(data.domains.map((domain) => [domain.code, domain]));
    const sortedDomains = [...data.domains].sort((left, right) =>
      left.sort_order - right.sort_order || compareText(locale, left.code, right.code),
    );
    const byDomain = new Map<string, CapabilityItem[]>();
    const childrenByParentId = new Map<string, CapabilityItem[]>();
    const descendantsCache = new Map<string, CapabilityItem[]>();

    data.items.forEach((item) => {
      const domainBucket = byDomain.get(item.domain_code) ?? [];
      domainBucket.push(item);
      byDomain.set(item.domain_code, domainBucket);

      const parentKey = item.parent_id ?? '__root__';
      const childBucket = childrenByParentId.get(parentKey) ?? [];
      childBucket.push(item);
      childrenByParentId.set(parentKey, childBucket);
    });

    function getChildren(pageId: string) {
      return [...(childrenByParentId.get(pageId) ?? [])].sort((left, right) => compareText(locale, left.title, right.title));
    }

    function getDescendants(pageId: string) {
      const cached = descendantsCache.get(pageId);
      if (cached) return cached;

      const result: CapabilityItem[] = [];
      const queue: string[] = [pageId];
      while (queue.length > 0) {
        const current = queue.shift();
        if (!current) continue;
        const children = getChildren(current);
        children.forEach((child) => {
          result.push(child);
          queue.push(child.page_id);
        });
      }
      descendantsCache.set(pageId, result);
      return result;
    }

    const isMapped = (item: CapabilityItem) =>
      item.linked_has_service_mapping === true ||
      Number(item.linked_service_mapping_count ?? 0) > 0 ||
      mappedPageIds.has(item.page_id) ||
      (Boolean(item.uuid) && mappedUuids.has(item.uuid));
    const isMappedDeep = (item: CapabilityItem) => isMapped(item) || getDescendants(item.page_id).some((descendant) => isMapped(descendant));

    const totalL4 = data.items.filter((item) => item.level === 4).length;
    const mappedL4 = data.items.filter((item) => item.level === 4 && isMapped(item)).length;
    const mappedL3 = data.items.filter((item) => item.level === 3 && isMappedDeep(item)).length;

    const domains = sortedDomains.map((domain) => {
      const nodes = [...(byDomain.get(domain.code) ?? [])];
      const l2s = nodes.filter((node) => node.level === 2).sort((left, right) => compareText(locale, left.title, right.title));
      const l3Map = new Map<string, CapabilityItem[]>();

      nodes.filter((node) => node.level === 3).forEach((node) => {
        const bucket = l3Map.get(node.parent_id ?? '') ?? [];
        bucket.push(node);
        l3Map.set(node.parent_id ?? '', bucket);
      });

      const mappedPosterNodesCount = nodes.filter((node) => node.level >= 3 && isMapped(node)).length;
      const totalPosterNodesCount = nodes.filter((node) => node.level >= 3).length;

      // Flat fallback: level-1 items shown as chips when domain has no L2 structure
      const l1s = nodes.filter((node) => node.level === 1 && node.parent_id === null).sort((left, right) => compareText(locale, left.title, right.title));

      if (domain.code === 'UserApplications') {
        const uaChips = l2s.reduce<PosterChip[]>((chips, l2) => {
          const children = [...(l3Map.get(l2.page_id) ?? [])].sort((left, right) => compareText(locale, left.title, right.title));
          const mapped = isMappedDeep(l2) || children.some((child) => isMappedDeep(child));
          if (!showUnmapped && !mapped) return chips;

          const mappedCount = children.filter((child) => isMapped(child)).length;
          chips.push({
            item: l2,
            mapped,
            tooltip: `${children.length} aplikací${mappedCount ? ` · ${mappedCount} mapováno` : ''}`,
            isL2: true,
          });
          return chips;
        }, []);

        // Fallback: show L1 items when there are no L2 items
        const flatChips: PosterChip[] = uaChips.length === 0 ? l1s.reduce<PosterChip[]>((chips, l1) => {
          const mapped = isMappedDeep(l1);
          if (!showUnmapped && !mapped) return chips;
          chips.push({ item: l1, mapped, tooltip: '', isL2: true });
          return chips;
        }, []) : [];

        return {
          domain,
          mappedPosterNodesCount,
          totalPosterNodesCount,
          uaChips,
          groups: [],
          flatChips,
        };
      }

      const groups = l2s.reduce<PosterGroup[]>((acc, l2) => {
        const children = [...(l3Map.get(l2.page_id) ?? [])].sort((left, right) => compareText(locale, left.title, right.title));
        const mapped = isMappedDeep(l2) || children.some((child) => isMappedDeep(child));
        if (!showUnmapped && !mapped) return acc;

        const chips: PosterChip[] = [];
        if (children.length === 0) {
          chips.push({
            item: l2,
            mapped,
            tooltip: '',
            isL2: false,
          });
        } else {
          children.forEach((l3) => {
            const l3Mapped = isMappedDeep(l3);
            if (!showUnmapped && !l3Mapped) return;

            const l4s = getDescendants(l3.page_id).filter((node) => node.level === 4);
            const mappedCount = l4s.filter((node) => isMapped(node)).length;
            const tooltipText = l4s.length > 0
              ? mappedCount === l4s.length
                ? `✓ ${l4s.length} L4 mapováno`
                : mappedCount > 0
                  ? `${mappedCount}/${l4s.length} L4 mapováno`
                  : ''
              : isMapped(l3)
                ? '✓ mapováno'
                : '';

            chips.push({
              item: l3,
              mapped: l3Mapped,
              tooltip: tooltipText,
              isL2: false,
            });
          });
        }

        acc.push({
          l2,
          mapped,
          chips,
        });
        return acc;
      }, []);

      // Flat fallback: show L1 root items when domain has no L2 groups
      const flatChips: PosterChip[] = groups.length === 0 ? l1s.reduce<PosterChip[]>((chips, l1) => {
        const mapped = isMappedDeep(l1);
        if (!showUnmapped && !mapped) return chips;
        const l4s = getDescendants(l1.page_id).filter((node) => node.level === 4);
        const mappedCount = l4s.filter((node) => isMapped(node)).length;
        const tooltipText = l4s.length > 0
          ? mappedCount > 0 ? `${mappedCount}/${l4s.length} L4` : ''
          : isMapped(l1) ? '✓' : '';
        chips.push({ item: l1, mapped, tooltip: tooltipText, isL2: false });
        return chips;
      }, []) : [];

      return {
        domain,
        mappedPosterNodesCount,
        totalPosterNodesCount,
        uaChips: [],
        groups,
        flatChips,
      };
    });

    return {
      stats: {
        totalL4,
        mappedL4,
        mappedL3,
      },
      domains,
      domainByCode,
      getDescendants,
      isMapped,
      totalItems: data.items.length,
    };
  }, [data, locale, mappedPageIds, mappedUuids, showUnmapped]);

  const infoDomain = infoNode && runtime?.domainByCode.get(infoNode.domain_code);
  const infoDescendants = infoNode && runtime ? runtime.getDescendants(infoNode.page_id) : [];
  const infoL4s = infoDescendants?.filter((node) => node.level === 4) ?? [];
  const infoMappedL4s = infoL4s.filter((node) => runtime?.isMapped(node));
  const linkedC3Href = infoNode?.linked_c3_uuid ? `/c3/${infoNode.linked_c3_uuid}` : null;
  const canOpenCatalogue = Boolean(linkedC3Href);

  function getNearestL3PageId(item: CapabilityItem | null) {
    if (!item) return null;
    if (item.level === 3) return item.page_id;
    if (item.level < 3) return null;

    let current = item.parent_id ? pageById.get(item.parent_id) ?? null : null;
    while (current) {
      if (current.level === 3) return current.page_id;
      current = current.parent_id ? pageById.get(current.parent_id) ?? null : null;
    }
    return null;
  }

  const infoGraphL3PageId = getNearestL3PageId(infoNode);
  const graphCapabilityHref = infoNode
    ? `/c3/graph?domain=${encodeURIComponent(infoNode.domain_code)}${infoGraphL3PageId ? `&l3=${encodeURIComponent(infoGraphL3PageId)}` : ''}`
    : null;
  const infoChildrenHref = infoNode ? buildParentListHref(infoNode.title) : null;

  function openNodeInCatalogue(item: CapabilityItem) {
    setInfoNode(item);
  }

  function filterCatalogueToNode(item: CapabilityItem) {
    if (!item.linked_c3_uuid) {
      return;
    }
    setInfoNode(null);
    router.push(`/c3/${item.linked_c3_uuid}`);
  }

  function handleNodeMouseEnter(event: ReactMouseEvent<HTMLButtonElement>, text: string) {
    if (!text) return;
    setTooltip({
      visible: true,
      text,
      x: event.clientX + 12,
      y: event.clientY - 8,
    });
  }

  function handleNodeMouseMove(event: ReactMouseEvent<HTMLButtonElement>) {
    setTooltip((current) => ({
      ...current,
      x: event.clientX + 12,
      y: event.clientY - 8,
    }));
  }

  function hideTooltip() {
    setTooltip((current) => ({ ...current, visible: false }));
  }

  return (
    <div className={styles.page}>
      {tooltip.visible && (
        <div className={styles.tooltip} style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.text}
        </div>
      )}

      <div className={styles.infoBar}>
        <div className={styles.spiralSwitch} aria-label="Capability map spirals">
          {spiralMapLinks.map((spiral) => (
            <Link
              key={spiral.code}
              href={spiral.href}
              className={`${styles.spiralChip} ${activeSpiralCode === spiral.code ? styles.spiralChipActive : ''}`}
              aria-current={activeSpiralCode === spiral.code ? 'page' : undefined}
            >
              {spiral.label}
            </Link>
          ))}
        </div>
        <strong>{data?.page_title || defaultTitle}</strong>
        {runtime ? (
          <span>
            <strong>{runtime.stats.mappedL4}</strong> / {runtime.stats.totalL4} L4 služeb mapováno &nbsp;|&nbsp; <strong>{runtime.stats.mappedL3}</strong> kategorií aktivních
          </span>
        ) : (
          <span>Načítám…</span>
        )}
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: 'var(--color-info)', opacity: 1 }} />
            Mapováno v katalogu
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: 'var(--color-text-muted)', opacity: 0.35 }} />
            Není mapováno
          </span>
        </div>
        <button type="button" className={styles.barButton} onClick={() => setShowUnmapped((current) => !current)}>
          {showUnmapped ? 'Skrýt nemapované' : 'Zobrazit vše'}
        </button>
      </div>

      {!runtime && isLoading && (
        <div className={styles.poster}>
          <p className={styles.loadingState}>Načítám taxonomii…</p>
        </div>
      )}

      {!runtime && error && (
        <div className={styles.poster}>
          <div className={styles.emptyState}>C3 Capability Map není dostupná. Zkontroluj middleware nebo zdrojová data capability mapy.</div>
        </div>
      )}

      {!runtime && !isLoading && !error && (
        <div className={styles.poster}>
          <div className={styles.emptyState}>
            {emptyStateDescription ?? 'Pro C3 Capability Map zatím nejsou dostupná žádná data.'}
            {builderHref ? (
              <div style={{ marginTop: 12 }}>
                <Link href={builderHref}>Otevřít C3 Capability Builder</Link>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {runtime && runtime.totalItems === 0 && (
        <div className={styles.poster}>
          <div className={styles.emptyState}>
            {emptyStateDescription ?? 'Pro tuto Capability Map zatím nejsou v builderu žádná data.'}
            {builderHref ? (
              <div style={{ marginTop: 12 }}>
                <Link href={builderHref}>Otevřít C3 Capability Builder</Link>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {runtime && runtime.totalItems > 0 && (
        <div className={styles.poster}>
          {runtime.domains.map((domainView) => (
            <section
              key={domainView.domain.code}
              className={styles.domain}
              style={{
                background: domainView.domain.background_color,
                borderColor: domainView.domain.background_color,
              }}
            >
              <div
                className={styles.domainTitle}
                style={{
                  color: domainView.domain.heading_color,
                  borderBottom: `2px solid ${domainView.domain.background_color}`,
                }}
              >
                <span>{domainView.domain.label}</span>
                <span className={styles.domainMeta}>
                  {domainView.mappedPosterNodesCount}/{domainView.totalPosterNodesCount} napamováno
                </span>
              </div>

              {domainView.domain.code === 'UserApplications' ? (
                <div className={styles.uaWrap}>
                  {domainView.uaChips.map((chip) => (
                    <PosterNodeChip
                      key={chip.item.page_id}
                      chip={chip}
                      headingColor={domainView.domain.heading_color}
                      backgroundColor={domainView.domain.background_color}
                      onMouseEnter={handleNodeMouseEnter}
                      onMouseMove={handleNodeMouseMove}
                      onMouseLeave={hideTooltip}
                      onOpen={openNodeInCatalogue}
                    />
                  ))}
                  {domainView.flatChips.map((chip) => (
                    <PosterNodeChip
                      key={chip.item.page_id}
                      chip={chip}
                      headingColor={domainView.domain.heading_color}
                      backgroundColor={domainView.domain.background_color}
                      onMouseEnter={handleNodeMouseEnter}
                      onMouseMove={handleNodeMouseMove}
                      onMouseLeave={hideTooltip}
                      onOpen={openNodeInCatalogue}
                    />
                  ))}
                </div>
              ) : (
                <div className={styles.l2Row}>
                  {domainView.groups.map((group) => (
                    <div key={group.l2.page_id} className={styles.l2Group}>
                      <Link
                        href={buildParentListHref(group.l2.title)}
                        className={styles.l2Label}
                        style={{
                          background: group.mapped ? `${domainView.domain.heading_color}22` : 'var(--color-bg-subtle)',
                          color: group.mapped ? domainView.domain.heading_color : 'var(--color-text-muted)',
                          borderColor: group.mapped ? domainView.domain.background_color : 'var(--color-border-default)',
                        }}
                        onClick={(event) => event.stopPropagation()}
                      >
                        {group.l2.title}
                      </Link>
                      <div className={styles.l3Wrap}>
                        {group.chips.map((chip) => (
                          <PosterNodeChip
                            key={chip.item.page_id}
                            chip={chip}
                            headingColor={domainView.domain.heading_color}
                            backgroundColor={domainView.domain.background_color}
                            onMouseEnter={handleNodeMouseEnter}
                            onMouseMove={handleNodeMouseMove}
                            onMouseLeave={hideTooltip}
                            onOpen={openNodeInCatalogue}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                  {/* Flat fallback: show L1 root items when domain has no L2 groups */}
                  {domainView.flatChips.length > 0 && (
                    <div className={styles.l3Wrap} style={{ width: '100%' }}>
                      {domainView.flatChips.map((chip) => (
                        <PosterNodeChip
                          key={chip.item.page_id}
                          chip={chip}
                          headingColor={domainView.domain.heading_color}
                          backgroundColor={domainView.domain.background_color}
                          onMouseEnter={handleNodeMouseEnter}
                          onMouseMove={handleNodeMouseMove}
                          onMouseLeave={hideTooltip}
                          onOpen={openNodeInCatalogue}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {infoNode && infoDomain && (
        <div className={styles.settingsModal} onClick={(event) => {
          if (event.target === event.currentTarget) setInfoNode(null);
        }}>
          <div
            className={styles.infoDialog}
            style={{ border: `2px solid ${infoDomain.background_color}` }}
          >
            <div className={styles.infoHeader}>
              <div>
                <code className={styles.infoCode} style={{ color: infoDomain.heading_color }}>{infoNode.page_id}</code>
                <div className={styles.infoMeta}>L{infoNode.level} · {formatDomainDisplayName(infoNode.domain_code)}</div>
              </div>
              <button type="button" className={styles.closeIconButton} onClick={() => setInfoNode(null)}>✕</button>
            </div>
            <h3 className={styles.infoTitle} style={{ color: infoDomain.heading_color }}>{infoNode.title}</h3>
            {linkedC3Href && (
              <div className={styles.infoC3LinkWrap}>
                <Link href={linkedC3Href} className={styles.infoC3Link}>
                  ↗ Otevřít C3 záznam
                </Link>
                <span className={styles.infoC3Meta}>
                  {infoNode.linked_c3_external_id ?? infoNode.linked_c3_uuid}
                  {infoNode.linked_c3_title ? ` · ${infoNode.linked_c3_title}` : ''}
                </span>
              </div>
            )}
            <div className={styles.infoSummary}>
              {infoL4s.length > 0 ? (
                <>
                  <strong>{infoMappedL4s.length}</strong> / {infoL4s.length} L4 položek namapováno v katalogu
                </>
              ) : runtime?.isMapped(infoNode) ? (
                <span style={{ color: 'var(--color-success)' }}>✓ Namapováno v katalogu</span>
              ) : (
                <span style={{ color: 'var(--color-text-muted)' }}>— Není namapováno</span>
              )}
            </div>
            {infoMappedL4s.length > 0 && (
              <div className={styles.infoMappedList}>
                {infoMappedL4s.map((item) => (
                  <div key={item.page_id} className={styles.infoMappedRow}>
                    ✓ {item.page_id} – {item.title}
                  </div>
                ))}
              </div>
            )}
            <div className={styles.infoActions}>
              <button
                type="button"
                className={styles.infoPrimaryBtn}
                style={{ background: infoDomain.heading_color }}
                disabled={!canOpenCatalogue}
                onClick={() => filterCatalogueToNode(infoNode)}
              >
                → Otevřít v katalogu
              </button>
              {graphCapabilityHref && (
                <Link
                  href={graphCapabilityHref}
                  className={styles.infoActionLink}
                  style={{ color: infoDomain.heading_color, borderColor: infoDomain.background_color }}
                  onClick={() => setInfoNode(null)}
                >
                  ↗ Graf capability
                </Link>
              )}
              {infoChildrenHref && (
                <Link
                  href={infoChildrenHref}
                  className={styles.infoActionLink}
                  style={{ color: infoDomain.heading_color, borderColor: infoDomain.background_color }}
                  onClick={() => setInfoNode(null)}
                >
                  ↗ Podřízené v seznamu
                </Link>
              )}
              <button type="button" className={styles.infoSecondaryBtn} onClick={() => setInfoNode(null)}>
                Zavřít
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PosterNodeChip({
  chip,
  headingColor,
  backgroundColor,
  onMouseEnter,
  onMouseMove,
  onMouseLeave,
  onOpen,
}: {
  chip: PosterChip;
  headingColor: string;
  backgroundColor: string;
  onMouseEnter(event: ReactMouseEvent<HTMLButtonElement>, text: string): void;
  onMouseMove(event: ReactMouseEvent<HTMLButtonElement>): void;
  onMouseLeave(): void;
  onOpen(item: CapabilityItem): void;
}) {
  return (
    <button
      type="button"
      className={`${styles.node} ${chip.mapped ? styles.nodeMapped : styles.nodeUnmapped}`}
      style={{
        background: chip.mapped ? `${headingColor}22` : 'var(--color-bg-subtle)',
        borderColor: chip.mapped ? backgroundColor : 'var(--color-border-default)',
        color: chip.mapped ? headingColor : 'var(--color-text-muted)',
        fontWeight: chip.isL2 ? 700 : undefined,
      }}
      onMouseEnter={(event) => onMouseEnter(event, `${chip.item.title}${chip.tooltip ? ` · ${chip.tooltip}` : ''}`)}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={() => onOpen(chip.item)}
    >
      {chip.item.title}
      {chip.mapped && <span className={styles.nodeMappedDot}>●</span>}
    </button>
  );
}

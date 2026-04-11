/**
 * §6.2 DomainDotGroup — §2.2: domains = dot group. One pattern.
 * Accepts comma-separated string (from API) or string[].
 */
import { cn } from '@/shared/utils/cn';
import styles from './DomainDotGroup.module.css';

// Color key → css var mapping (covers all known domains)
const DOMAIN_CLASS: Record<string, string> = {
  // Primary domains
  NEXUS: 'nexus', VERTEX: 'vertex', ORBIT: 'orbit', PULSE: 'pulse',
  RELAY: 'relay', CLOUD: 'cloud', GRID: 'grid', PRISM: 'prism',
  HELIX: 'helix', ZENITH: 'zenith', APEX: 'apex', VORTEX: 'vortex', MATRIX: 'matrix',
  // Extended domains
  'ZONE-1': 'zone1', 'ZONE-2': 'zone2', 'ZONE-3': 'zone3',
  'ZONE-4': 'zone4', 'ZONE-4-NS': 'zone4ns', 'ZONE-4-GR': 'zone4gr', 'ZONE-4-PK': 'zone4pk',
  'ZONE-5': 'zone5', 'ZONE-6': 'zone6',
  'ZONE-7': 'zone7', 'ZONE-7-U': 'zone7u', 'ZONE-7-R': 'zone7r', 'ZONE-7-S': 'zone7s',
  'ZONE-8': 'zone8', 'ZONE-9': 'zone9', ALL: 'all', HYBRID: 'hybrid',
};

interface DomainDotGroupProps {
  domains: string | string[] | null | undefined;
  maxVisible?: number;
}

export function DomainDotGroup({ domains, maxVisible = 6 }: DomainDotGroupProps) {
  const list: string[] = Array.isArray(domains)
    ? domains
    : (domains ?? '').split(',').map(d => d.trim()).filter(Boolean);

  if (!list.length) return <span className={styles.empty}>—</span>;

  const visible = list.slice(0, maxVisible);
  const overflow = list.length - maxVisible;

  return (
    <span className={styles.group} title={list.join(', ')}>
      {visible.map(d => (
        <span key={d} className={cn(styles.dot, styles[DOMAIN_CLASS[d] ?? 'default'])} title={d} />
      ))}
      {overflow > 0 && <span className={styles.overflow}>+{overflow}</span>}
    </span>
  );
}

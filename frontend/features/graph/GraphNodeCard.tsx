'use client';

import { Handle, Position, type NodeProps, type NodeTypes } from '@xyflow/react';
import { StatusPill } from '@/features/services/components/StatusPill';
import styles from './GraphNodeCard.module.css';

export type GraphNodeVariant = 'service' | 'flavour' | 'capability' | 'entity';

/** What a graph node card shows; graph pages put it in `node.data.card`. */
export interface GraphNodeCardData {
  variant: GraphNodeVariant;
  title: string;
  code?: string | null;
  /** Service status (shown as a pill) or entity status (shown as text). */
  status?: string | null;
  /** Small uppercase kind label (C3 entities). */
  kindLabel?: string | null;
  meta?: Array<string | null | undefined>;
  isRoot?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  /** Leaf nodes (e.g. flavours) have no outgoing handle. */
  hasSource?: boolean;
}

function GraphNodeCardNode({ data }: NodeProps) {
  const card = data.card as GraphNodeCardData;
  const className = [
    styles.card,
    card.variant !== 'service' ? styles[card.variant] : '',
    card.isRoot ? styles.root : '',
    card.selected ? styles.selected : '',
  ].filter(Boolean).join(' ');
  const meta = (card.meta ?? []).filter((item): item is string => Boolean(item));
  return (
    <button
      type="button"
      className={className}
      onClick={card.onSelect}
      title={card.title}
      aria-label={card.code ? `${card.code} ${card.title}` : card.title}
      aria-pressed={card.selected ? 'true' : 'false'}
    >
      <Handle type="target" position={Position.Left} />
      {card.kindLabel && <div className={styles.kind}>{card.kindLabel}</div>}
      {card.code && <div className={styles.code}>{card.code}</div>}
      <div className={styles.title}>{card.title}</div>
      {card.variant === 'service' && (
        <div className={styles.status}>
          <StatusPill status={card.status ?? 'draft'} size="sm" />
        </div>
      )}
      {card.variant !== 'service' && card.status && <div className={styles.meta}>{card.status}</div>}
      {meta.map((line) => <div key={line} className={styles.meta}>{line}</div>)}
      {card.hasSource !== false && <Handle type="source" position={Position.Right} />}
    </button>
  );
}

export const GRAPH_NODE_TYPE = 'graphCard';
export const GRAPH_NODE_TYPES: NodeTypes = { [GRAPH_NODE_TYPE]: GraphNodeCardNode };

/**
 * §6.1 Layer 2 — Primitives
 * Box, Stack, Inline, Surface, Text
 * All token-driven, no hardcoded values.
 */
import React from 'react';
import type { CSSProperties, ReactNode, ElementType } from 'react';

// ── Box ──────────────────────────────────────────────────────────────────────
interface BoxProps {
  children?: ReactNode;
  padding?: string;
  gap?: string;
  style?: CSSProperties;
  className?: string;
  as?: ElementType;
}
export function Box({ children, padding, gap, style, className, as: Tag = 'div' }: BoxProps) {
  return (
    <Tag className={className} style={{ padding, gap, ...style }}>
      {children}
    </Tag>
  );
}

// ── Stack (vertical flex) ────────────────────────────────────────────────────
interface StackProps {
  children?: ReactNode;
  gap?: string;
  align?: CSSProperties['alignItems'];
  style?: CSSProperties;
  className?: string;
}
export function Stack({ children, gap = 'var(--space-3)', align, style, className }: StackProps) {
  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap, alignItems: align, ...style }}>
      {children}
    </div>
  );
}

// ── Inline (horizontal flex) ─────────────────────────────────────────────────
interface InlineProps {
  children?: ReactNode;
  gap?: string;
  align?: CSSProperties['alignItems'];
  wrap?: boolean;
  style?: CSSProperties;
  className?: string;
}
export function Inline({ children, gap = 'var(--space-2)', align = 'center', wrap, style, className }: InlineProps) {
  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'row', gap, alignItems: align, flexWrap: wrap ? 'wrap' : undefined, ...style }}>
      {children}
    </div>
  );
}

// ── Surface (card/panel) ─────────────────────────────────────────────────────
interface SurfaceProps {
  children?: ReactNode;
  raised?: boolean;
  padding?: string;
  style?: CSSProperties;
  className?: string;
}
export function Surface({ children, raised, padding = 'var(--space-4)', style, className }: SurfaceProps) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        borderRadius: 'var(--radius-md)',
        boxShadow: raised ? 'var(--shadow-low)' : 'var(--shadow-none)',
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Text ─────────────────────────────────────────────────────────────────────
type TextRole = 'display' | 'title-lg' | 'title-md' | 'title-sm' | 'body-md' | 'body-sm' | 'label-md' | 'label-sm' | 'mono-sm';
type TextColor = 'primary' | 'secondary' | 'muted';

interface TextProps {
  children?: ReactNode;
  role?: TextRole;
  color?: TextColor;
  as?: ElementType;
  style?: CSSProperties;
  className?: string;
}
export function Text({ children, role = 'body-md', color = 'primary', as: Tag = 'span', style, className }: TextProps) {
  const colorMap: Record<TextColor, string> = {
    primary:   'var(--color-text-primary)',
    secondary: 'var(--color-text-secondary)',
    muted:     'var(--color-text-muted)',
  };
  return (
    <Tag
      className={className}
      style={{ font: `var(--text-${role})`, color: colorMap[color], ...style }}
    >
      {children}
    </Tag>
  );
}

// ── Divider ──────────────────────────────────────────────────────────────────
export function Divider({ style }: { style?: CSSProperties }) {
  return <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-default)', margin: 0, ...style }} />;
}

'use client';

import { createElement, useState, type ReactNode } from 'react';
import type { HelpNode } from './types';

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'meta', 'link']);

interface Props {
  nodes: HelpNode[];
}

function reactPropsFromAttrs(
  attrs: Record<string, string> | undefined,
  toggleSidebar: () => void,
  sidebarOpen: boolean,
) {
  const props: Record<string, unknown> = {};

  for (const [name, value] of Object.entries(attrs ?? {})) {
    if (name === 'class') {
      props.className = value;
      continue;
    }
    if (name === 'for') {
      props.htmlFor = value;
      continue;
    }
    if (name === 'colspan') {
      props.colSpan = Number(value);
      continue;
    }
    if (name === 'rowspan') {
      props.rowSpan = Number(value);
      continue;
    }
    props[name] = value;
  }

  if (attrs?.id === 'sidebar' && typeof props.className === 'string') {
    props.className = sidebarOpen ? `${props.className} open` : props.className;
  }
  if (attrs?.class?.split(/\s+/).includes('hamburger')) {
    props.onClick = toggleSidebar;
  }

  return props;
}

function renderNode(
  node: HelpNode,
  key: string,
  toggleSidebar: () => void,
  sidebarOpen: boolean,
): ReactNode {
  if (typeof node.text === 'string') return node.text;
  if (!node.tag) return null;

  const props = {
    ...reactPropsFromAttrs(node.attrs, toggleSidebar, sidebarOpen),
    key,
  };

  if (VOID_TAGS.has(node.tag)) {
    return createElement(node.tag, props);
  }

  return createElement(
    node.tag,
    props,
    node.children?.map((child, index) => renderNode(child, `${key}-${index}`, toggleSidebar, sidebarOpen)),
  );
}

export default function HelpManual({ nodes }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = () => setSidebarOpen((open) => !open);

  return (
    <div className="helpManual" data-i18n-skip="true">
      {nodes.map((node, index) => renderNode(node, String(index), toggleSidebar, sidebarOpen))}
    </div>
  );
}

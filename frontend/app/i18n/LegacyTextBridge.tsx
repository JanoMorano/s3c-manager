'use client';

import { useEffect } from 'react';
import generatedUiTexts from '../../../shared/i18n/generated-ui-texts.json';
import type { Locale } from './messages';
import { useLocale } from './useI18n';

type GeneratedEntry = {
  source: string;
  cs: string;
  en: string;
};

const ATTRIBUTE_NAMES = ['aria-label', 'alt', 'placeholder', 'title'];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'NOSCRIPT']);
const TEXT_SOURCE = new WeakMap<Text, string>();

function normalizeUiText(value: string | null | undefined): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

const SOURCE_TO_ENTRY = new Map<string, GeneratedEntry>(
  (generatedUiTexts.entries as GeneratedEntry[]).map((entry) => [normalizeUiText(entry.source), entry]),
);

function shouldSkipNode(node: Node): boolean {
  const parent = node.parentElement;
  if (!parent) return true;
  if (SKIP_TAGS.has(parent.tagName)) return true;
  if (parent.closest('[data-i18n-skip="true"]')) return true;
  return false;
}

function translatedValue(source: string, locale: Locale): string | null {
  const entry = SOURCE_TO_ENTRY.get(normalizeUiText(source));
  if (!entry) return null;
  return entry[locale] || entry.cs || entry.source;
}

function translateTextNode(node: Text, locale: Locale) {
  if (shouldSkipNode(node)) return;
  const current = node.nodeValue ?? '';
  if (!node.parentElement) return;
  const normalizedCurrent = normalizeUiText(current);
  const source = TEXT_SOURCE.get(node) || normalizedCurrent;
  if (!source) return;

  const translated = translatedValue(source, locale);
  if (!translated) return;

  if (!TEXT_SOURCE.has(node)) TEXT_SOURCE.set(node, source);
  const leading = current.match(/^\s*/)?.[0] ?? '';
  const trailing = current.match(/\s*$/)?.[0] ?? '';
  node.nodeValue = `${leading}${translated}${trailing}`;
}

function translateAttributes(element: Element, locale: Locale) {
  for (const attr of ATTRIBUTE_NAMES) {
    if (!element.hasAttribute(attr)) continue;
    const sourceAttr = `data-i18n-source-${attr.replace(/[^a-z0-9]+/gi, '-')}`;
    const storedSource = element.getAttribute(sourceAttr);
    const current = element.getAttribute(attr);
    const source = storedSource || current;
    if (!source) continue;

    const translated = translatedValue(source, locale);
    if (!translated) continue;

    if (!storedSource) element.setAttribute(sourceAttr, normalizeUiText(source));
    if (element.getAttribute(attr) !== translated) element.setAttribute(attr, translated);
  }
}

function applyTranslations(root: ParentNode, locale: Locale) {
  const doc = root.ownerDocument ?? document;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    translateTextNode(node as Text, locale);
    node = walker.nextNode();
  }

  const elements = root instanceof Element ? [root, ...Array.from(root.querySelectorAll('*'))] : Array.from(root.querySelectorAll('*'));
  elements.forEach((element) => translateAttributes(element, locale));
}

export default function LegacyTextBridge() {
  const locale = useLocale();

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    applyTranslations(document.body, locale);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            translateTextNode(node as Text, locale);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            applyTranslations(node as Element, locale);
          }
        });
        if (mutation.type === 'attributes' && mutation.target instanceof Element) {
          translateAttributes(mutation.target, locale);
        }
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ATTRIBUTE_NAMES,
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [locale]);

  return null;
}

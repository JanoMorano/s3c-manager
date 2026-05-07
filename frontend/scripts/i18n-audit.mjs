#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_ROOT = path.resolve(__dirname, '..');
const WORKSPACE_ROOT = path.resolve(FRONTEND_ROOT, '..');
const OUTPUT_FILE = path.join(WORKSPACE_ROOT, 'shared/i18n/generated-ui-texts.json');
const SOURCE_DIRS = ['app', 'features', 'design-system'].map((dir) => path.join(FRONTEND_ROOT, dir));
const SUPPORTED_LOCALES = ['cs', 'en'];
const resetTranslations = process.argv.includes('--reset-translations');

const JSX_TEXT_ATTRIBUTES = new Set([
  'aria-label',
  'alt',
  'description',
  'emptyTitle',
  'eyebrow',
  'helper',
  'hint',
  'label',
  'message',
  'placeholder',
  'primaryAction',
  'purpose',
  'secondaryAction',
  'subtitle',
  'title',
]);

const NON_UI_ATTRIBUTES = new Set([
  'accept',
  'action',
  'aria-controls',
  'aria-describedby',
  'aria-expanded',
  'aria-hidden',
  'aria-labelledby',
  'aria-live',
  'aria-modal',
  'aria-pressed',
  'className',
  'data-testid',
  'dir',
  'download',
  'draggable',
  'fill',
  'height',
  'href',
  'htmlFor',
  'id',
  'key',
  'lang',
  'method',
  'name',
  'rel',
  'role',
  'scope',
  'src',
  'style',
  'target',
  'type',
  'value',
  'variant',
  'viewBox',
  'width',
]);

const UI_PROPERTY_NAMES = new Set([
  'action',
  'body',
  'can',
  'desc',
  'description',
  'detail',
  'empty',
  'eyebrow',
  'helper',
  'hint',
  'label',
  'lead',
  'message',
  'next',
  'outcome',
  'persona',
  'placeholder',
  'purpose',
  'role',
  'start',
  'subtitle',
  'text',
  'title',
]);

const EXCLUDED_FILE_PARTS = [
  '/app/_help/',
  '/app/i18n/',
  '/node_modules/',
  '/.next/',
];

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, out);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function normalizeUiText(value) {
  return String(value)
    .replace(/\s+/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function hasLetters(value) {
  return /\p{L}/u.test(value);
}

function looksLikeTechnicalToken(value) {
  if (/^https?:\/\//i.test(value)) return true;
  if (/^\/(api|admin|c3|services|operations|catalogue|management|import|search|help|portfolio|spirals)(\/|$|\?)/.test(value)) return true;
  if (/^[@.#]/.test(value)) return true;
  if (/^var\(|^--/.test(value)) return true;
  if (/^[a-z0-9_./:-]+$/.test(value) && !/[A-Z]/.test(value) && !/\s/.test(value)) return true;
  if (/^[A-Z0-9_./:-]+$/.test(value) && value.length > 2 && !/\s/.test(value)) return true;
  if (/^\{.*\}$/.test(value)) return true;
  if (/^[a-z]+\/[a-z0-9.+-]+$/i.test(value)) return true;
  return false;
}

function shouldInclude(value) {
  const text = normalizeUiText(value);
  if (text.length < 2) return false;
  if (!hasLetters(text)) return false;
  if (looksLikeTechnicalToken(text)) return false;
  if (/^[A-Z]{2,6}$/.test(text)) return false;
  return true;
}

function getPropertyName(name) {
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return null;
}

function isImportOrExportSpecifier(node) {
  let current = node.parent;
  while (current) {
    if (ts.isImportDeclaration(current) || ts.isExportDeclaration(current)) return true;
    if (ts.isSourceFile(current)) return false;
    current = current.parent;
  }
  return false;
}

function isJsxAttributeValue(node) {
  return ts.isJsxAttribute(node.parent) && node.parent.initializer === node;
}

function shouldIncludeStringLiteral(node) {
  if (isImportOrExportSpecifier(node)) return false;
  if (isJsxAttributeValue(node)) {
    const attrName = node.parent.name.text;
    if (NON_UI_ATTRIBUTES.has(attrName)) return false;
    return JSX_TEXT_ATTRIBUTES.has(attrName) || shouldInclude(node.text);
  }

  if (ts.isPropertyAssignment(node.parent) && node.parent.initializer === node) {
    const propertyName = getPropertyName(node.parent.name);
    if (propertyName && !UI_PROPERTY_NAMES.has(propertyName)) return false;
  }

  return shouldInclude(node.text);
}

function extractFromFile(file) {
  const source = fs.readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const texts = [];

  function visit(node) {
    if (ts.isJsxText(node)) {
      const text = normalizeUiText(node.getText(sourceFile));
      if (shouldInclude(text)) texts.push({ text, file });
    } else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && shouldIncludeStringLiteral(node)) {
      texts.push({ text: normalizeUiText(node.text), file });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return texts;
}

function extractUiTexts() {
  const files = SOURCE_DIRS
    .flatMap((dir) => walkFiles(dir))
    .filter((file) => !EXCLUDED_FILE_PARTS.some((part) => file.includes(part)));

  const byText = new Map();
  for (const file of files) {
    for (const item of extractFromFile(file)) {
      const current = byText.get(item.text) ?? { source: item.text, files: new Set() };
      current.files.add(path.relative(WORKSPACE_ROOT, item.file));
      byText.set(item.text, current);
    }
  }

  return [...byText.values()]
    .map((item) => ({
      source: item.source,
      files: [...item.files].sort(),
    }))
    .sort((left, right) => left.source.localeCompare(right.source, 'en', { sensitivity: 'base' }));
}

function keyFor(source) {
  const slug = source
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'text';
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0;
  }
  return `ui.generated.${slug}.${Math.abs(hash).toString(36)}`;
}

function readExisting() {
  if (!fs.existsSync(OUTPUT_FILE)) return null;
  return JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
}

function buildCatalog(extracted, existing) {
  const existingBySource = new Map((existing?.entries ?? []).map((entry) => [entry.source, entry]));
  const entries = extracted.map((item) => {
    const previous = existingBySource.get(item.source);
    const entry = {
      key: previous?.key ?? keyFor(item.source),
      source: item.source,
      cs: resetTranslations ? item.source : previous?.cs ?? item.source,
      en: resetTranslations ? item.source : previous?.en ?? item.source,
      files: item.files,
    };
    for (const locale of SUPPORTED_LOCALES) {
      if (!entry[locale]) entry[locale] = item.source;
    }
    return entry;
  });

  return {
    generated_at: new Date().toISOString(),
    description: 'Generated corpus of legacy/static frontend UI strings. Translate cs/en values; do not edit source keys manually.',
    locales: SUPPORTED_LOCALES,
    entries,
  };
}

function diffCatalog(extracted, existing) {
  const current = new Set(extracted.map((item) => item.source));
  const known = new Set((existing?.entries ?? []).map((entry) => entry.source));
  return {
    missing: [...current].filter((source) => !known.has(source)).sort(),
    stale: [...known].filter((source) => !current.has(source)).sort(),
  };
}

function printSummary(catalog, diff) {
  console.log(`i18n generated UI strings: ${catalog.entries.length}`);
  console.log(`missing in catalog: ${diff.missing.length}`);
  console.log(`stale in catalog: ${diff.stale.length}`);
  if (diff.missing.length) {
    console.log('\nMissing strings:');
    diff.missing.slice(0, 50).forEach((item) => console.log(`- ${item}`));
  }
}

const mode = process.argv.includes('--update') ? 'update' : process.argv.includes('--check') ? 'check' : 'summary';
const extracted = extractUiTexts();
const existing = readExisting();
const catalog = buildCatalog(extracted, existing);
const diff = diffCatalog(extracted, existing);

if (mode === 'update') {
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  printSummary(catalog, { missing: [], stale: [] });
} else if (mode === 'check') {
  printSummary(existing ?? catalog, diff);
  if (!existing || diff.missing.length > 0) process.exit(1);
} else {
  printSummary(existing ?? catalog, diff);
}

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_SOURCE = '/Users/janmoravec/Desktop/Service_catalog_OLD/c3_poster_v2.html';
const sourcePath = process.argv[2] || process.env.C3_POSTER_SOURCE || DEFAULT_SOURCE;
const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, 'shared', 'c3');
const taxonomyOutputPath = path.join(outputDir, 'capability-map2-taxonomy.json');
const domainOutputPath = path.join(outputDir, 'capability-map2-domain-config.json');

function extractSection(source, startToken, endToken) {
  const startIndex = source.indexOf(startToken);
  if (startIndex === -1) {
    throw new Error(`Token not found: ${startToken}`);
  }

  const endIndex = source.indexOf(endToken, startIndex);
  if (endIndex === -1) {
    throw new Error(`Token not found: ${endToken}`);
  }

  return source
    .slice(startIndex + startToken.length, endIndex)
    .trim()
    .replace(/;\s*$/, '');
}

const html = fs.readFileSync(sourcePath, 'utf8');
const taxonomyText = extractSection(html, 'const TAXONOMY = ', '// ── Domain config');
const domainConfigText = extractSection(html, 'const DOMAIN_CFG = ', '// ── Build lookup structures');

const taxonomy = JSON.parse(taxonomyText);
const domainConfigObject = Function(`"use strict"; return (${domainConfigText});`)();
const domainConfig = Object.entries(domainConfigObject).map(([code, value]) => ({
  code,
  css_class: value.cls,
  heading_color: value.hc,
  background_color: value.bc,
  label: value.label,
  sort_order: value.order,
}));

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(taxonomyOutputPath, `${JSON.stringify(taxonomy, null, 2)}\n`, 'utf8');
fs.writeFileSync(domainOutputPath, `${JSON.stringify(domainConfig, null, 2)}\n`, 'utf8');

console.log(`Generated ${taxonomy.length} taxonomy rows to ${taxonomyOutputPath}`);
console.log(`Generated ${domainConfig.length} domain rows to ${domainOutputPath}`);

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['app', 'features', 'design-system/controls', 'components/ui'].map((root) => join(process.cwd(), root));
const violations = [];

function walk(directory, predicate, files = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath, predicate, files);
    if (entry.isFile() && predicate(entry.name)) files.push(fullPath);
  }
  return files;
}

function report(file, lineNumber, line, reason) {
  violations.push(`${file}:${lineNumber}: ${reason}: ${line.trim()}`);
}

for (const file of ROOTS.flatMap((root) => walk(root, (name) => name.endsWith('.module.css')))) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    if (/#[0-9a-fA-F]{3,8}\b/.test(line)) report(file, index + 1, line, 'hex color in CSS module');
    if (/(?:linear|radial|conic)-gradient/.test(line)) report(file, index + 1, line, 'gradient in CSS module');
    const radius = line.match(/border-radius:\s*([0-9]+)px/);
    if (radius && !['4', '6', '10', '999'].includes(radius[1])) {
      report(file, index + 1, line, 'non-token border radius');
    }
    if (/box-shadow:.*rgba\(/.test(line)) report(file, index + 1, line, 'ad-hoc rgba box-shadow');
  });
}

for (const file of ROOTS.flatMap((root) => walk(root, (name) => name.endsWith('.tsx')))) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    if (/style=\{\{[^\n]*#[0-9a-fA-F]{3,8}\b/.test(line)) {
      report(file, index + 1, line, 'inline style hex color');
    }
  });
}

if (violations.length > 0) {
  console.error(`Style lint failed with ${violations.length} violation(s):`);
  console.error(violations.join('\n'));
  process.exit(1);
}

console.log('Style lint passed: no CSS module hex/gradients, bad radii, rgba shadows, or inline style hex colors.');

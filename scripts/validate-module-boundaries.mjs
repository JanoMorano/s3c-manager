import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function findRepoRoot(startDir) {
  let current = startDir;
  while (current && current !== path.dirname(current)) {
    if (
      fs.existsSync(path.join(current, 'backend')) &&
      fs.existsSync(path.join(current, 'middleware')) &&
      fs.existsSync(path.join(current, 'frontend'))
    ) {
      return current;
    }
    current = path.dirname(current);
  }
  throw new Error('Unable to locate repository root.');
}

const root = findRepoRoot(process.cwd());
const backendManifest = require(path.join(root, 'middleware/src/modules/manifest.js'));
const dbManifest = JSON.parse(fs.readFileSync(path.join(root, 'backend/db/postgres/modules/manifest.json'), 'utf8'));
const boundaries = JSON.parse(fs.readFileSync(path.join(root, 'modules/module-boundaries.json'), 'utf8'));
const buildUnits = JSON.parse(fs.readFileSync(path.join(root, 'modules/build-units.json'), 'utf8'));

const errors = [];

function fail(message) {
  errors.push(message);
}

function relExists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function normalizeSliceName(fileName) {
  return fileName.replace(/\.sql$/i, '');
}

const moduleCodes = backendManifest.MODULE_DEFINITIONS.map((definition) => definition.code);
const moduleCodeSet = new Set(moduleCodes);

if (buildUnits.deployable !== 'module-runtime') {
  fail(`Build units deployable must be module-runtime, got ${buildUnits.deployable}.`);
}

for (const code of moduleCodes) {
  const dbModule = dbManifest.modules.find((item) => item.code === code);
  const boundary = boundaries.rules.find((item) => item.code === code);
  const unit = buildUnits.units.find((item) => item.code === code);
  const definition = backendManifest.getModuleDefinition(code);

  if (!dbModule) fail(`Missing DB module manifest for ${code}.`);
  if (!boundary) fail(`Missing module boundary rule for ${code}.`);
  if (!unit) fail(`Missing build unit for ${code}.`);

  if (dbModule) {
    if (!relExists(`backend/db/postgres/modules/${dbModule.entrypoint}`)) {
      fail(`Missing DB entrypoint ${dbModule.entrypoint} for ${code}.`);
    }
    for (const sourceSlice of dbModule.source_slices ?? []) {
      if (!relExists(`backend/db/postgres/schema/${sourceSlice}`)) {
        fail(`Missing DB source slice ${sourceSlice} for ${code}.`);
      }
    }
    const expectedSlices = (definition.dbSlices ?? []).map((slice) => `${slice}.sql`).sort();
    const actualSlices = [...(dbModule.source_slices ?? [])].sort();
    if (JSON.stringify(expectedSlices) !== JSON.stringify(actualSlices)) {
      fail(`DB slices for ${code} differ between backend manifest and DB module manifest.`);
    }
  }

  if (boundary) {
    for (const dependency of boundary.depends_on ?? []) {
      if (!moduleCodeSet.has(dependency)) fail(`${code} depends on unknown module ${dependency}.`);
    }
    for (const ownedPath of boundary.owned_paths ?? []) {
      if (!relExists(ownedPath)) fail(`Boundary path for ${code} does not exist: ${ownedPath}`);
    }
  }

  if (unit) {
    for (const field of ['db_entrypoint', 'backend_owner', 'frontend_owner']) {
      if (unit[field] && !relExists(unit[field])) {
        fail(`Build unit ${code} references missing ${field}: ${unit[field]}`);
      }
    }
    if (!Array.isArray(unit.active_modules) || unit.active_modules.length === 0) {
      fail(`Build unit ${code} must declare active_modules.`);
    } else {
      for (const activeModule of unit.active_modules) {
        if (!moduleCodeSet.has(activeModule)) {
          fail(`Build unit ${code} activates unknown module ${activeModule}.`);
        }
      }
      if (!unit.active_modules.includes(code)) {
        fail(`Build unit ${code} active_modules must include its own module code.`);
      }
    }
  }
}

const schemaDir = path.join(root, 'backend/db/postgres/schema');
const allSchemaSlices = fs.readdirSync(schemaDir)
  .filter((fileName) => fileName.endsWith('.sql'))
  .sort();
const ownedSlices = dbManifest.modules.flatMap((item) => item.source_slices ?? []);
const duplicateSlices = ownedSlices.filter((slice, index) => ownedSlices.indexOf(slice) !== index);
const unownedSlices = allSchemaSlices.filter((slice) => !ownedSlices.includes(slice));

if (duplicateSlices.length > 0) {
  fail(`DB slices owned by multiple modules: ${[...new Set(duplicateSlices)].join(', ')}`);
}
if (unownedSlices.length > 0) {
  fail(`DB slices without module owner: ${unownedSlices.join(', ')}`);
}

for (const dbModule of dbManifest.modules) {
  const entrypoint = path.join(root, 'backend/db/postgres/modules', dbModule.entrypoint);
  if (!fs.existsSync(entrypoint)) continue;
  const content = fs.readFileSync(entrypoint, 'utf8');
  for (const sourceSlice of dbModule.source_slices ?? []) {
    if (!content.includes(`../../schema/${sourceSlice}`)) {
      fail(`${dbModule.entrypoint} does not include ${sourceSlice}.`);
    }
  }
}

const routeGroupSource = fs.readFileSync(path.join(root, 'middleware/src/modules/api-route-groups.js'), 'utf8');
if (routeGroupSource.includes("require('../routes/")) {
  fail('api-route-groups.js must delegate route ownership to module route files.');
}

if (!relExists('deploy/modules/docker-compose.modules.yml')) {
  fail('Missing deploy/modules/docker-compose.modules.yml.');
} else {
  const composeSource = fs.readFileSync(path.join(root, 'deploy/modules/docker-compose.modules.yml'), 'utf8');
  for (const unit of buildUnits.units) {
    for (const activeModule of unit.active_modules ?? []) {
      if (!composeSource.includes(`S3C_ACTIVE_MODULES: "${activeModule}"`)) {
        fail(`Compose module deploy file does not configure S3C_ACTIVE_MODULES for ${activeModule}.`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(`Module boundary validation failed (${errors.length} issue${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Module boundary validation passed for ${moduleCodes.length} modules and ${allSchemaSlices.length} DB slices.`);

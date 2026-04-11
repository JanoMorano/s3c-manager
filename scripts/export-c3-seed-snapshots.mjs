import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const requireFromMiddleware = createRequire(path.join(projectRoot, 'middleware', 'package.json'));
const { Client } = requireFromMiddleware('pg');

const outputDir = path.join(projectRoot, 'shared', 'c3');

const client = new Client({
  connectionString:
    process.env.DATABASE_URL ||
    `postgresql://${process.env.DB_USER || process.env.POSTGRES_USER || 'postgres'}:${process.env.DB_PASSWORD || process.env.POSTGRES_PASSWORD || 'postgres'}@${process.env.DB_HOST || process.env.POSTGRES_HOST || '127.0.0.1'}:${process.env.DB_PORT || process.env.POSTGRES_PORT || '5432'}/${process.env.DB_NAME || process.env.POSTGRES_DB || 'service_catalogue'}`,
});

const SNAPSHOTS = [
  { filename: 'c3-taxonomy-seed.json', query: 'SELECT * FROM data.c3_taxonomy ORDER BY id' },
  { filename: 'c3-services-seed.json', query: 'SELECT * FROM data.c3_service ORDER BY id' },
  { filename: 'c3-applications-seed.json', query: 'SELECT * FROM data.c3_application ORDER BY id' },
  { filename: 'c3-data-objects-seed.json', query: 'SELECT * FROM data.c3_data_object ORDER BY id' },
  { filename: 'c3-technology-interactions-seed.json', query: 'SELECT * FROM data.c3_technology_interaction ORDER BY id' },
  { filename: 'c3-ti-service-links-seed.json', query: 'SELECT * FROM data.c3_technology_interaction_service_link ORDER BY id' },
  { filename: 'c3-ti-application-links-seed.json', query: 'SELECT * FROM data.c3_technology_interaction_application_link ORDER BY id' },
  { filename: 'c3-ti-data-object-links-seed.json', query: 'SELECT * FROM data.c3_technology_interaction_data_object_link ORDER BY id' },
];

async function main() {
  await fs.mkdir(outputDir, { recursive: true });
  await client.connect();
  await client.query('SET search_path TO data, platform, public');

  try {
    for (const snapshot of SNAPSHOTS) {
      const result = await client.query(snapshot.query);
      const outputPath = path.join(outputDir, snapshot.filename);
      await fs.writeFile(outputPath, JSON.stringify(result.rows, null, 2) + '\n', 'utf8');
      process.stdout.write(`Wrote ${snapshot.filename} (${result.rows.length} rows)\n`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

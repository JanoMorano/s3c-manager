'use strict';

const { initDb, closePools, getPlatformPool } = require('../db/pool');
const { seedDemoData } = require('../utils/demo-data-seed');

async function main() {
    await initDb();
    try {
        const pool = getPlatformPool();
        const result = await seedDemoData(pool, {
            locale: process.env.DEMO_SEED_LOCALE || process.env.APP_DEFAULT_LOCALE,
        });
        if (!result?.ok) {
            throw new Error(result?.error || 'Demo data seed failed without details.');
        }
        console.log('✅ Demo governance cockpit seeds applied successfully.');
    } finally {
        await closePools().catch(() => {});
    }
}

main().catch((err) => {
    console.error(`❌ Demo test seeds failed: ${err.message}`);
    process.exit(1);
});

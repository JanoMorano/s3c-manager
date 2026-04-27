'use strict';

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { canAdmin } = require('../middleware/rbac');
const { createC3EntityImportRun } = require('../utils/c3-entity-import');
const { inferSpiralCode, detectTargetKey, sourceKindFromFile, validateSpiralSelection } = require('../utils/spiral-routing');

const router = express.Router();
router.use(requireAuth, canAdmin);

async function hashFile(filePath) {
    const data = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(data).digest('hex');
}

async function collectFiles(folderPath) {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const fullPath = path.join(folderPath, entry.name);
        if (entry.isDirectory()) files.push(...await collectFiles(fullPath));
        else files.push(fullPath);
    }
    return files;
}

async function buildPlan({ folderPath, files = [], selectedSpiral = null, allowOverride = false }) {
    const filePaths = folderPath ? await collectFiles(folderPath) : files;
    const plan = [];
    for (const filePath of filePaths) {
        const fileName = path.basename(filePath);
        const inferred = inferSpiralCode(filePath);
        const routing = validateSpiralSelection({ inferred, selected: selectedSpiral, allowOverride });
        const targetKey = detectTargetKey(fileName);
        const sourceKind = sourceKindFromFile(fileName);
        let sha256 = null;
        let rowCount = 0;
        try {
            sha256 = await hashFile(filePath);
            const text = await fs.readFile(filePath, 'utf8').catch(() => '');
            rowCount = sourceKind === 'json' ? JSON.parse(text || '[]').length : Math.max(0, text.split(/\r?\n/).filter(Boolean).length - 1);
        } catch {
            // binary or unreadable previews still produce a plan row
        }
        const issues = [];
        if (!targetKey) issues.push({ severity: 'blocking', code: 'unknown_target', message: 'Target cannot be inferred from filename.' });
        if (!routing.ok) issues.push({ severity: 'blocking', code: routing.issue, message: 'Spiral cannot be safely inferred.' });
        plan.push({ file: filePath, file_name: fileName, target_key: targetKey, source_kind: sourceKind, spiral_code: routing.spiralCode ?? inferred, row_count: rowCount, sha256, duplicate_status: 'not_checked', issues });
    }
    return plan;
}

router.post('/bulk-folder/dry-run', async (req, res, next) => {
    try {
        const plan = await buildPlan(req.body ?? {});
        res.json({ plan, blocking_count: plan.reduce((sum, row) => sum + row.issues.filter((issue) => issue.severity === 'blocking').length, 0) });
    } catch (err) { next(err); }
});

router.post('/bulk-folder/commit', async (req, res, next) => {
    try {
        const plan = req.body?.plan ?? await buildPlan(req.body ?? {});
        const selected = plan.filter((row) => !row.issues?.some((issue) => issue.severity === 'blocking'));
        const runs = [];
        for (const row of selected) {
            const runId = await createC3EntityImportRun({
                targetKey: row.target_key,
                sourceName: row.file_name ?? row.file,
                sourceKind: row.source_kind,
                isDryRun: false,
                spiralCode: row.spiral_code,
                rowCount: row.row_count ?? 0,
                okCount: row.row_count ?? 0,
                warnCount: 0,
                errorCount: 0,
                insertedCount: 0,
                updatedCount: 0,
                failedCount: 0,
                createdBy: req.user?.username,
                notes: JSON.stringify({ bulk: true, sha256: row.sha256, routed_only: true }),
            });
            runs.push({ ...row, run_id: runId });
        }
        res.json({ committed_count: runs.length, skipped_count: plan.length - runs.length, runs });
    } catch (err) { next(err); }
});

module.exports = { router, _private: { buildPlan } };

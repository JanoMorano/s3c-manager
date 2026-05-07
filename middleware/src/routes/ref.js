'use strict';
/**
 * routes/ref.js — generic CRUD editor for reference dictionaries
 *
 * Mounting point: /api/v1/ref
 *
 * GET    /api/v1/ref                 — list available reference tables (authenticated read)
 * GET    /api/v1/ref/:table          — list all records (authenticated read)
 * POST   /api/v1/ref/:table          — create record (canAdmin)
 * PUT    /api/v1/ref/:table/:code    — update record (canAdmin)
 * DELETE /api/v1/ref/:table/:code    — delete record (canAdmin)
 *
 * Security: table and column names are validated against the TABLES whitelist.
 * No dynamic concatenation is used without validation, so the SQL surface remains injection-safe.
 */

const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');
const { canAdmin }    = require('../middleware/rbac');
const { getPool } = require('../db/pool');

// ─── Allowed table whitelist + column metadata ────────────────────────────────
// Column order defines both result ordering and form field ordering.
// Special types:
//   pk        — primary key, readonly on UPDATE and required on INSERT
//   bool      — BIT (0/1), rendered as a checkbox in the form
//   int       — INT
//   color     — NVARCHAR, rendered with a color-picker hint
//   fk:TABLE  — FK reference; values are loaded from TABLE
const TABLES = {
    ref_ServiceType: {
        label:   'Service Type',
        order:   'code',
        columns: [
            { key: 'code',        type: 'pk',   label: 'Kód',     maxlen: 50  },
            { key: 'name',        type: 'text', label: 'Název',   maxlen: 100, required: true },
            { key: 'description', type: 'text', label: 'Popis',   maxlen: 500 },
        ],
    },
    ref_ServiceStatus: {
        label:   'Service Status',
        order:   'sort_order',
        columns: [
            { key: 'code',       type: 'pk',   label: 'Kód',       maxlen: 50  },
            { key: 'name',       type: 'text', label: 'Název',     maxlen: 100, required: true },
            { key: 'sort_order', type: 'int',  label: 'Pořadí'    },
            { key: 'is_active',  type: 'bool', label: 'Aktivní'   },
        ],
    },
    ref_RelationType: {
        label:   'Relation Type',
        order:   'code',
        columns: [
            { key: 'code',                      type: 'pk',   label: 'Kód',                  maxlen: 50  },
            { key: 'name',                      type: 'text', label: 'Název',                maxlen: 100, required: true },
            { key: 'description',               type: 'text', label: 'Popis',                maxlen: 500 },
            { key: 'is_directional',            type: 'bool', label: 'Směrová'              },
            { key: 'is_operational_dependency', type: 'bool', label: 'Provozní závislost'   },
            { key: 'default_impact_mode',       type: 'text', label: 'Výchozí impact mode', maxlen: 30  },
            { key: 'default_impact_level',      type: 'text', label: 'Výchozí impact level',maxlen: 20  },
        ],
    },
    ref_PortfolioGroup: {
        label:   'Portfolio Group',
        order:   'sort_order',
        columns: [
            { key: 'code',       type: 'pk',   label: 'Kód',     maxlen: 100 },
            { key: 'name',       type: 'text', label: 'Název',   maxlen: 200, required: true },
            { key: 'sort_order', type: 'int',  label: 'Pořadí'  },
            { key: 'is_active',  type: 'bool', label: 'Aktivní' },
        ],
    },
    ref_GlobalServiceGroup: {
        label:   'Global Service Group',
        order:   'sort_order',
        columns: [
            { key: 'code',                 type: 'pk',              label: 'Kód',              maxlen: 150 },
            { key: 'name',                 type: 'text',            label: 'Název',            maxlen: 200, required: true },
            { key: 'portfolio_group_code', type: 'fk:ref_PortfolioGroup', label: 'Portfolio Group' },
            { key: 'sort_order',           type: 'int',             label: 'Pořadí'           },
        ],
    },
    ref_ServiceLine: {
        label:   'Service Line',
        order:   'sort_order',
        columns: [
            { key: 'code',                      type: 'pk',                       label: 'Kód',                maxlen: 150 },
            { key: 'name',                      type: 'text',                     label: 'Název',              maxlen: 200, required: true },
            { key: 'global_service_group_code', type: 'fk:ref_GlobalServiceGroup', label: 'Global Service Group' },
            { key: 'sort_order',                type: 'int',                      label: 'Pořadí'             },
        ],
    },
    ref_OrganizationalElement: {
        label:   'Organizational Element',
        order:   'sort_order',
        columns: [
            { key: 'code',       type: 'pk',   label: 'Kód',   maxlen: 150 },
            { key: 'name',       type: 'text', label: 'Název', maxlen: 200, required: true },
            { key: 'sort_order', type: 'int',  label: 'Pořadí' },
        ],
    },
    ref_NetworkDomain: {
        label:   'Network Domain',
        order:   'sort_order',
        columns: [
            { key: 'code',       type: 'pk',    label: 'Kód',      maxlen: 30  },
            { key: 'name',       type: 'text',  label: 'Název',    maxlen: 100, required: true },
            { key: 'color_hex',  type: 'color', label: 'Barva',    maxlen: 10  },
            { key: 'sort_order', type: 'int',   label: 'Pořadí'   },
        ],
    },
    ref_SecurityClassification: {
        label:   'Security Classification',
        order:   'sort_order',
        columns: [
            { key: 'code',       type: 'pk',   label: 'Kód',   maxlen: 30  },
            { key: 'name',       type: 'text', label: 'Název', maxlen: 100, required: true },
            { key: 'sort_order', type: 'int',  label: 'Pořadí' },
        ],
    },
    ref_SupportWindow: {
        label:   'Support Window',
        order:   'sort_order',
        columns: [
            { key: 'code',        type: 'pk',   label: 'Kód',   maxlen: 50  },
            { key: 'name',        type: 'text', label: 'Název', maxlen: 100, required: true },
            { key: 'description', type: 'text', label: 'Popis', maxlen: 255 },
            { key: 'sort_order',  type: 'int',  label: 'Pořadí' },
        ],
    },
    ref_FlavourStatus: {
        label:   'Legacy Variant Status',
        order:   'sort_order',
        columns: [
            { key: 'code',       type: 'pk',   label: 'Kód',   maxlen: 50  },
            { key: 'name',       type: 'text', label: 'Název', maxlen: 100, required: true },
            { key: 'sort_order', type: 'int',  label: 'Pořadí' },
        ],
    },
    ref_ServiceRole: {
        label:   'Service Role',
        order:   'sort_order',
        columns: [
            { key: 'code',       type: 'pk',   label: 'Kód',   maxlen: 50  },
            { key: 'name',       type: 'text', label: 'Název', maxlen: 100, required: true },
            { key: 'sort_order', type: 'int',  label: 'Pořadí' },
        ],
    },
    ref_PaceCategory: {
        label:   'PACE Category',
        order:   'sort_order',
        columns: [
            { key: 'code',        type: 'pk',   label: 'Kód',   maxlen: 10  },
            { key: 'name',        type: 'text', label: 'Název', maxlen: 50,  required: true },
            { key: 'sort_order',  type: 'int',  label: 'Pořadí' },
            { key: 'description', type: 'text', label: 'Popis', maxlen: 255 },
        ],
    },
    ref_C3MappingType: {
        label:   'C3 Mapping Type',
        order:   'code',
        columns: [
            { key: 'code',        type: 'pk',   label: 'Kód',   maxlen: 50  },
            { key: 'name',        type: 'text', label: 'Název', maxlen: 100, required: true },
            { key: 'description', type: 'text', label: 'Popis', maxlen: 500 },
        ],
    },
    ref_C3CapabilityDomain: {
        label:   'C3 Capability Domain',
        order:   'sort_order',
        columns: [
            { key: 'code',             type: 'pk',    label: 'Kód',              maxlen: 100 },
            { key: 'css_class',        type: 'text',  label: 'CSS Class',        maxlen: 50,  required: true },
            { key: 'heading_color',    type: 'color', label: 'Heading Color',    maxlen: 20,  required: true },
            { key: 'background_color', type: 'color', label: 'Background Color', maxlen: 20,  required: true },
            { key: 'label',            type: 'text',  label: 'Label',            maxlen: 200, required: true },
            { key: 'sort_order',       type: 'int',   label: 'Pořadí' },
            { key: 'is_active',        type: 'bool',  label: 'Aktivní' },
        ],
    },
};

function toSnakeCase(name) {
    return String(name)
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/__/g, '_')
        .toLowerCase();
}

function getTableName(tableKey) {
    return `data.${toSnakeCase(tableKey)}`;
}

function normalizeValue(col, value) {
    if (value === undefined) return null;
    if (col.type === 'bool') return value != null ? Boolean(value) : null;
    if (col.type === 'int') {
        if (value === null || value === '') return null;
        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return value ?? null;
}

// ─── GET /api/v1/ref (list available tables) ──────────────────────────────────
router.get('/', requireAuth, (req, res) => {
    res.json(Object.entries(TABLES).map(([table, meta]) => ({
        table,
        label:   meta.label,
        columns: meta.columns,
    })));
});

// ─── GET /api/v1/ref/:table ───────────────────────────────────────────────────
router.get('/:table', requireAuth, async (req, res, next) => {
    try {
        const meta = TABLES[req.params.table];
        if (!meta) return res.status(404).json({ error: 'Tabulka nenalezena' });

        const colList = meta.columns.map(c => c.key).join(', ');
        const result = await getPool().query(`
            SELECT ${colList}
            FROM ${getTableName(req.params.table)}
            ORDER BY ${meta.order}
        `);
        res.json({ meta: { table: req.params.table, label: meta.label, columns: meta.columns }, rows: result.rows });
    } catch (err) { next(err); }
});

// ─── POST /api/v1/ref/:table ──────────────────────────────────────────────────
router.post('/:table', requireAuth, canAdmin, async (req, res, next) => {
    try {
        const meta = TABLES[req.params.table];
        if (!meta) return res.status(404).json({ error: 'Tabulka nenalezena' });

        const pkCol  = meta.columns.find(c => c.type === 'pk');
        if (!req.body[pkCol.key]) return res.status(400).json({ error: `Pole ${pkCol.key} je povinné` });

        const cols   = meta.columns.map(c => c.key).join(', ');
        const values = meta.columns.map((col) => normalizeValue(col, req.body[col.key]));
        const params = meta.columns.map((_, index) => `$${index + 1}`).join(', ');

        await getPool().query(
            `INSERT INTO ${getTableName(req.params.table)} (${cols}) VALUES (${params})`,
            values
        );
        res.status(201).json({ ok: true });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Záznam s tímto kódem již existuje' });
        }
        next(err);
    }
});

// ─── PUT /api/v1/ref/:table/:code ─────────────────────────────────────────────
router.put('/:table/:code', requireAuth, canAdmin, async (req, res, next) => {
    try {
        const meta = TABLES[req.params.table];
        if (!meta) return res.status(404).json({ error: 'Tabulka nenalezena' });

        const pkCol    = meta.columns.find(c => c.type === 'pk');
        const editCols = meta.columns.filter(c => c.type !== 'pk');
        if (editCols.length === 0) return res.status(400).json({ error: 'Žádné editovatelné sloupce' });

        const setClause = editCols.map((c, index) => `${c.key} = $${index + 1}`).join(', ');
        const values = editCols.map((col) => normalizeValue(col, req.body[col.key]));
        values.push(req.params.code);
        const result = await getPool().query(`
            UPDATE ${getTableName(req.params.table)}
            SET    ${setClause}
            WHERE  ${pkCol.key} = $${values.length}
        `, values);

        if (result.rowCount === 0) return res.status(404).json({ error: 'Záznam nenalezen' });
        res.json({ ok: true });
    } catch (err) { next(err); }
});

// ─── DELETE /api/v1/ref/:table/:code ─────────────────────────────────────────
router.delete('/:table/:code', requireAuth, canAdmin, async (req, res, next) => {
    try {
        const meta = TABLES[req.params.table];
        if (!meta) return res.status(404).json({ error: 'Tabulka nenalezena' });

        const pkCol = meta.columns.find(c => c.type === 'pk');
        const result = await getPool().query(
            `DELETE FROM ${getTableName(req.params.table)} WHERE ${pkCol.key} = $1`,
            [req.params.code]
        );

        if (result.rowCount === 0) return res.status(404).json({ error: 'Záznam nenalezen' });
        res.json({ ok: true });
    } catch (err) {
        if (err.code === '23503') {
            return res.status(409).json({ error: 'Záznam nelze smazat — je referencován jinými daty' });
        }
        next(err);
    }
});

module.exports = { router, TABLES };

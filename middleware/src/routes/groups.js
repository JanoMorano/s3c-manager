'use strict';
/**
 * routes/groups.js — Group Management API
 *
 * All endpoints require the admin role.
 *
 * GET    /api/v1/admin/groups
 * POST   /api/v1/admin/groups
 * GET    /api/v1/admin/groups/:id
 * PUT    /api/v1/admin/groups/:id
 * DELETE /api/v1/admin/groups/:id
 * PUT    /api/v1/admin/groups/:id/permissions
 * GET    /api/v1/admin/groups/:id/members
 * POST   /api/v1/admin/groups/:id/members
 * DELETE /api/v1/admin/groups/:id/members/:userSub
 * GET    /api/v1/admin/users/:sub/groups
 */
const express = require('express');
const router  = express.Router();
const { requireAuth } = require('../middleware/auth');
const { canAdmin }    = require('../middleware/rbac');
const repo = require('../db/groups.repo');

router.use(requireAuth, canAdmin);

// ─── Groups ─────────────────────────────────────────────────────────────────

router.get('/groups', async (req, res, next) => {
    try {
        res.json(await repo.listGroups());
    } catch (err) { next(err); }
});

router.post('/groups', async (req, res, next) => {
    try {
        const { group_code, group_name, description } = req.body;
        if (!group_code || !group_name)
            return res.status(400).json({ error: 'group_code a group_name jsou povinné' });
        const group = await repo.createGroup({ group_code, group_name, description });
        res.status(201).json(group);
    } catch (err) {
        if (err.code === '23505')
            return res.status(409).json({ error: 'group_code již existuje' });
        next(err);
    }
});

router.get('/groups/:id', async (req, res, next) => {
    try {
        const group = await repo.getGroup(Number(req.params.id));
        if (!group) return res.status(404).json({ error: 'Skupina nenalezena' });
        res.json(group);
    } catch (err) { next(err); }
});

router.put('/groups/:id', async (req, res, next) => {
    try {
        const { group_name, description, is_active } = req.body;
        if (!group_name)
            return res.status(400).json({ error: 'group_name je povinné' });
        const group = await repo.updateGroup(Number(req.params.id), {
            group_name, description,
            is_active: is_active !== false,
        });
        if (!group) return res.status(404).json({ error: 'Skupina nenalezena' });
        res.json(group);
    } catch (err) { next(err); }
});

router.delete('/groups/:id', async (req, res, next) => {
    try {
        const ok = await repo.deleteGroup(Number(req.params.id));
        if (!ok) return res.status(404).json({ error: 'Skupina nenalezena' });
        res.json({ ok: true });
    } catch (err) { next(err); }
});

// ─── Permissions ────────────────────────────────────────────────────────────

router.put('/groups/:id/permissions', async (req, res, next) => {
    try {
        const { permissions } = req.body;
        if (!Array.isArray(permissions))
            return res.status(400).json({ error: 'permissions musí být pole' });

        const VALID_SCOPES = ['service_catalogue', 'c3_taxonomy'];
        const VALID_PERMS  = ['view_column', 'edit_column', 'edit_ref'];

        for (const p of permissions) {
            if (!VALID_SCOPES.includes(p.scope) || !VALID_PERMS.includes(p.permission) || !p.resource)
                return res.status(400).json({ error: `Neplatná permission: ${JSON.stringify(p)}` });
        }

        await repo.setGroupPermissions(Number(req.params.id), permissions);
        res.json({ ok: true, count: permissions.length });
    } catch (err) { next(err); }
});

// ─── Members ─────────────────────────────────────────────────────────────────

router.get('/groups/:id/members', async (req, res, next) => {
    try {
        res.json(await repo.listGroupMembers(Number(req.params.id)));
    } catch (err) { next(err); }
});

router.post('/groups/:id/members', async (req, res, next) => {
    try {
        const { user_sub } = req.body;
        if (!user_sub)
            return res.status(400).json({ error: 'user_sub je povinný' });
        await repo.addGroupMember(Number(req.params.id), user_sub, req.user?.username);
        res.status(201).json({ ok: true });
    } catch (err) { next(err); }
});

router.delete('/groups/:id/members/:userSub', async (req, res, next) => {
    try {
        const ok = await repo.removeGroupMember(Number(req.params.id), req.params.userSub);
        if (!ok) return res.status(404).json({ error: 'Member nenalezen' });
        res.json({ ok: true });
    } catch (err) { next(err); }
});

// ─── User → groups lookup ────────────────────────────────────────────────────

router.get('/users/:sub/groups', async (req, res, next) => {
    try {
        res.json(await repo.getUserGroups(req.params.sub));
    } catch (err) { next(err); }
});

module.exports = router;

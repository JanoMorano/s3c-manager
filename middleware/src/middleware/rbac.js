'use strict';
/**
 * Role-Based Access Control
 * Usage: router.delete('/:id', requireAuth, requireRole('admin'), handler)
 */

const ROLE_LEVELS = { viewer: 1, editor: 2, admin: 3 };

/**
 * Requires a minimum role.
 * @param {'viewer'|'editor'|'admin'} minRole
 */
function requireRole(minRole) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Není přihlášen' });
        const userLevel = ROLE_LEVELS[req.user.role] || 0;
        const required  = ROLE_LEVELS[minRole]       || 99;
        if (userLevel < required) {
            return res.status(403).json({
                error: `Nedostatečná oprávnění. Požadovaná role: ${minRole}, vaše role: ${req.user.role}`
            });
        }
        next();
    };
}

const canView   = requireRole('viewer');
const canEdit   = requireRole('editor');
const canAdmin  = requireRole('admin');

module.exports = { requireRole, canView, canEdit, canAdmin, ROLE_LEVELS };

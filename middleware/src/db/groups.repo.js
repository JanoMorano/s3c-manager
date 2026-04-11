'use strict';

const { getPlatformPool } = require('./pool');

async function listGroups() {
    const result = await getPlatformPool().query(`
        SELECT
            g.id,
            g.group_code,
            g.group_name,
            g.description,
            g.is_active,
            g.created_at,
            g.updated_at,
            COUNT(ug.id)::integer AS member_count
        FROM platform.app_group g
        LEFT JOIN platform.app_user_group ug ON ug.group_id = g.id
        GROUP BY g.id, g.group_code, g.group_name, g.description, g.is_active, g.created_at, g.updated_at
        ORDER BY g.group_name
    `);
    return result.rows;
}

async function getGroup(id) {
    const pool = getPlatformPool();
    const [groupRes, permsRes, membersRes] = await Promise.all([
        pool.query(`
            SELECT id, group_code, group_name, description, is_active, created_at, updated_at
            FROM platform.app_group
            WHERE id = $1
        `, [id]),
        pool.query(`
            SELECT scope, permission, resource
            FROM platform.app_group_permission
            WHERE group_id = $1
            ORDER BY scope, permission, resource
        `, [id]),
        pool.query(`
            SELECT user_sub, assigned_at, assigned_by
            FROM platform.app_user_group
            WHERE group_id = $1
            ORDER BY assigned_at DESC
        `, [id]),
    ]);

    if (!groupRes.rows[0]) return null;
    return {
        ...groupRes.rows[0],
        permissions: permsRes.rows,
        members: membersRes.rows,
    };
}

async function createGroup({ group_code, group_name, description }) {
    const result = await getPlatformPool().query(`
        INSERT INTO platform.app_group (group_code, group_name, description)
        VALUES ($1, $2, $3)
        RETURNING id, group_code, group_name, description, is_active, created_at, updated_at
    `, [group_code, group_name, description ?? null]);
    return result.rows[0];
}

async function updateGroup(id, { group_name, description, is_active }) {
    const result = await getPlatformPool().query(`
        UPDATE platform.app_group
        SET group_name = $2,
            description = $3,
            is_active = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, group_code, group_name, description, is_active, updated_at
    `, [id, group_name, description ?? null, is_active]);
    return result.rows[0] ?? null;
}

async function deleteGroup(id) {
    const result = await getPlatformPool().query(`
        DELETE FROM platform.app_group
        WHERE id = $1
    `, [id]);
    return result.rowCount > 0;
}

async function setGroupPermissions(groupId, permissions) {
    const client = await getPlatformPool().raw.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM platform.app_group_permission WHERE group_id = $1', [groupId]);

        for (const permission of permissions) {
            await client.query(`
                INSERT INTO platform.app_group_permission (group_id, scope, permission, resource)
                VALUES ($1, $2, $3, $4)
            `, [groupId, permission.scope, permission.permission, permission.resource]);
        }

        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function listGroupMembers(groupId) {
    const result = await getPlatformPool().query(`
        SELECT user_sub, assigned_at, assigned_by
        FROM platform.app_user_group
        WHERE group_id = $1
        ORDER BY assigned_at DESC
    `, [groupId]);
    return result.rows;
}

async function addGroupMember(groupId, userSub, assignedBy) {
    await getPlatformPool().query(`
        INSERT INTO platform.app_user_group (group_id, user_sub, assigned_by)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_sub, group_id) DO NOTHING
    `, [groupId, userSub, assignedBy ?? null]);
}

async function removeGroupMember(groupId, userSub) {
    const result = await getPlatformPool().query(`
        DELETE FROM platform.app_user_group
        WHERE group_id = $1 AND user_sub = $2
    `, [groupId, userSub]);
    return result.rowCount > 0;
}

async function getUserGroups(userSub) {
    const result = await getPlatformPool().query(`
        SELECT
            g.id,
            g.group_code,
            g.group_name,
            g.is_active,
            p.scope,
            p.permission,
            p.resource
        FROM platform.app_user_group ug
        JOIN platform.app_group g ON g.id = ug.group_id
        LEFT JOIN platform.app_group_permission p ON p.group_id = g.id
        WHERE ug.user_sub = $1
          AND g.is_active = TRUE
        ORDER BY g.group_code, p.scope, p.permission
    `, [userSub]);

    const groups = {};
    for (const row of result.rows) {
        if (!groups[row.id]) {
            groups[row.id] = {
                id: row.id,
                group_code: row.group_code,
                group_name: row.group_name,
                is_active: row.is_active,
                permissions: [],
            };
        }
        if (row.scope) {
            groups[row.id].permissions.push({
                scope: row.scope,
                permission: row.permission,
                resource: row.resource,
            });
        }
    }

    return Object.values(groups);
}

module.exports = {
    listGroups,
    getGroup,
    createGroup,
    updateGroup,
    deleteGroup,
    setGroupPermissions,
    listGroupMembers,
    addGroupMember,
    removeGroupMember,
    getUserGroups,
};

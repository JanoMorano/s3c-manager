'use strict';

const { getPool } = require('../db/pool');

const AUTO_CREATED_BY = 'system:capability-backfill';

async function syncCapabilityDerivedLinksForAll() {
    return syncCapabilityDerivedLinksInternal(null);
}

async function syncCapabilityDerivedLinksForCapability(capabilityUuid) {
    if (!capabilityUuid) return;
    return syncCapabilityDerivedLinksInternal(capabilityUuid);
}

async function syncCapabilityDerivedLinksInternal(capabilityUuid) {
    const scoped = !!capabilityUuid;
    const pool = getPool();
    const scopedClause = scoped ? 'AND capability_uuid = $2' : '';
    const scopedValues = scoped ? [AUTO_CREATED_BY, capabilityUuid] : [AUTO_CREATED_BY];

    await pool.query(`DELETE FROM data.c3_capability_c3_service_link WHERE created_by = $1 ${scopedClause}`, scopedValues);
    await pool.query(`DELETE FROM data.c3_capability_data_object_link WHERE created_by = $1 ${scopedClause}`, scopedValues);
    await pool.query(`DELETE FROM data.c3_capability_tin_link WHERE created_by = $1 ${scopedClause}`, scopedValues);
    await pool.query(`DELETE FROM data.c3_capability_application_link WHERE created_by = $1 ${scopedClause}`, scopedValues);

    await pool.query(`
        INSERT INTO data.c3_capability_application_link (
            capability_uuid,
            c3_application_id,
            link_role,
            created_by
        )
        SELECT DISTINCT
            c.uuid,
            a.id,
            'primary_application',
            $1
        FROM data.c3_taxonomy c
        JOIN data.c3_application a
          ON a.application_code = c.application
        WHERE NULLIF(BTRIM(c.application), '') IS NOT NULL
          ${scoped ? 'AND c.uuid = $2' : ''}
          AND NOT EXISTS (
              SELECT 1
              FROM data.c3_capability_application_link existing
              WHERE existing.capability_uuid = c.uuid
                AND existing.c3_application_id = a.id
          )
    `, scopedValues);

    await pool.query(`
        INSERT INTO data.c3_capability_tin_link (
            capability_uuid,
            c3_tin_id,
            link_role,
            created_by
        )
        SELECT DISTINCT
            cal.capability_uuid,
            tial.technology_interaction_id,
            'via_application',
            $1
        FROM data.c3_capability_application_link cal
        JOIN data.c3_technology_interaction_application_link tial
          ON tial.c3_application_id = cal.c3_application_id
        WHERE 1 = 1
          ${scoped ? 'AND cal.capability_uuid = $2' : ''}
          AND NOT EXISTS (
              SELECT 1
              FROM data.c3_capability_tin_link existing
              WHERE existing.capability_uuid = cal.capability_uuid
                AND existing.c3_tin_id = tial.technology_interaction_id
          )
    `, scopedValues);

    await pool.query(`
        INSERT INTO data.c3_capability_data_object_link (
            capability_uuid,
            c3_data_object_id,
            link_role,
            created_by
        )
        SELECT DISTINCT
            ctl.capability_uuid,
            tdol.c3_data_object_id,
            'via_tin',
            $1
        FROM data.c3_capability_tin_link ctl
        JOIN data.c3_technology_interaction_data_object_link tdol
          ON tdol.technology_interaction_id = ctl.c3_tin_id
        WHERE 1 = 1
          ${scoped ? 'AND ctl.capability_uuid = $2' : ''}
          AND NOT EXISTS (
              SELECT 1
              FROM data.c3_capability_data_object_link existing
              WHERE existing.capability_uuid = ctl.capability_uuid
                AND existing.c3_data_object_id = tdol.c3_data_object_id
          )
    `, scopedValues);

    await pool.query(`
        INSERT INTO data.c3_capability_c3_service_link (
            capability_uuid,
            c3_service_id,
            link_role,
            created_by
        )
        SELECT DISTINCT
            ctl.capability_uuid,
            tisl.c3_service_id,
            'via_tin',
            $1
        FROM data.c3_capability_tin_link ctl
        JOIN data.c3_technology_interaction_service_link tisl
          ON tisl.technology_interaction_id = ctl.c3_tin_id
        WHERE 1 = 1
          ${scoped ? 'AND ctl.capability_uuid = $2' : ''}
          AND NOT EXISTS (
              SELECT 1
              FROM data.c3_capability_c3_service_link existing
              WHERE existing.capability_uuid = ctl.capability_uuid
                AND existing.c3_service_id = tisl.c3_service_id
          )
    `, scopedValues);
}

module.exports = {
    AUTO_CREATED_BY,
    syncCapabilityDerivedLinksForAll,
    syncCapabilityDerivedLinksForCapability,
};

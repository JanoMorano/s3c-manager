'use strict';

const { getPool } = require('./pool');
const logger = require('../utils/logger');

async function getServicePk(serviceId) {
    const result = await getPool().query(`
        SELECT id
        FROM data.service_catalog
        WHERE service_id = $1
          AND is_deleted = FALSE
    `, [serviceId]);
    return result.rows[0]?.id ?? null;
}

async function createBatch({ filename, importedBy, parserVersion = '1.0', sourceHashSha256 = null }) {
    const result = await getPool().query(`
        INSERT INTO data.import_batch (filename, imported_by, parser_version, source_hash_sha256)
        VALUES ($1, $2, $3, $4)
        RETURNING id
    `, [filename, importedBy ?? null, parserVersion, sourceHashSha256]);
    return result.rows[0].id;
}

async function closeBatch(batchId, { okCount, warnCount, errorCount, rowCount, notes }) {
    await getPool().query(`
        UPDATE data.import_batch
        SET ok_count = $2,
            warn_count = $3,
            error_count = $4,
            row_count = $5,
            notes = $6
        WHERE id = $1
    `, [batchId, okCount, warnCount, errorCount, rowCount, notes ?? null]);
}

async function createRow(batchId, rowNumber, serviceId, rawJson, status) {
    const result = await getPool().query(`
        INSERT INTO data.import_row (batch_id, row_number, service_id, raw_json, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
    `, [batchId, rowNumber, serviceId ?? null, JSON.stringify(rawJson), status]);
    return result.rows[0].id;
}

async function updateRowStatus(rowId, status) {
    if (!rowId) return;
    await getPool().query(`
        UPDATE data.import_row
        SET status = $2
        WHERE id = $1
    `, [rowId, status]);
}

async function logIssue({ batchId, rowId, serviceId, severity, issueCode, fieldName, rawValue, message }) {
    await getPool().query(`
        INSERT INTO data.import_issue
            (batch_id, row_id, service_id, severity, issue_code, field_name, raw_value, message)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [batchId, rowId ?? null, serviceId ?? null, severity, issueCode, fieldName ?? null, rawValue ?? null, message ?? null]);
}

async function upsertService(svc) {
    const updateResult = await getPool().query(`
        UPDATE data.service_catalog
        SET title = $2,
            short_description = $3,
            description = $4,
            service_status_code = $5,
            service_type_code = $6,
            portfolio_group_code = $7,
            global_service_group_code = $8,
            service_line_code = $9,
            organizational_element_code = $10,
            service_url = $11,
            cp_service_type_raw = $12,
            is_available_status_ambiguous = $13,
            service_area_raw = $14,
            business_purpose = $15,
            service_features_raw = $16,
            request_process_raw = $17,
            support_locations_raw = $18,
            operational_notes_raw = $19,
            other_info_raw = $20,
            ext_tools_raw = $21,
            legacy_ssl_mapping_raw = $22,
            budget_activity_code = $23,
            pricing_note_raw = $24,
            modified_at_source = $25,
            updated_at = CURRENT_TIMESTAMP
        WHERE service_id = $1
          AND is_stub = FALSE
    `, [
        svc.serviceId,
        svc.title,
        svc.shortDescription ?? null,
        svc.description ?? null,
        svc.serviceStatusCode ?? null,
        svc.serviceTypeCode ?? null,
        svc.portfolioGroupCode ?? null,
        svc.globalServiceGroupCode ?? null,
        svc.serviceLineCode ?? null,
        svc.organizationalElementCode ?? null,
        svc.serviceUrl ?? null,
        svc.cpServiceTypeRaw ?? null,
        svc.isAvailableStatusAmbiguous ?? false,
        svc.serviceAreaRaw ?? null,
        svc.businessPurpose ?? null,
        svc.serviceFeaturesRaw ?? null,
        svc.requestProcessRaw ?? null,
        svc.supportLocationsRaw ?? null,
        svc.operationalNotesRaw ?? null,
        svc.otherInfoRaw ?? null,
        svc.extToolsRaw ?? null,
        svc.legacySslMappingRaw ?? null,
        svc.budgetActivityCode ?? null,
        svc.pricingNoteRaw ?? null,
        svc.modifiedAtSource ?? null,
    ]);

    if (updateResult.rowCount > 0) return;

    await getPool().query(`
        INSERT INTO data.service_catalog (
            service_id, title, short_description, description,
            service_status_code, service_type_code,
            portfolio_group_code, global_service_group_code,
            service_line_code, organizational_element_code,
            service_url, cp_service_type_raw,
            is_available_status_ambiguous, service_area_raw, is_stub,
            business_purpose, service_features_raw, request_process_raw,
            support_locations_raw, operational_notes_raw, other_info_raw,
            ext_tools_raw, legacy_ssl_mapping_raw, budget_activity_code,
            pricing_note_raw, created_at_source, modified_at_source
        ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8,
            $9, $10, $11, $12,
            $13, $14, $15, $16, $17, $18,
            $19, $20, $21, $22, $23, $24,
            $25, $26, $27
        )
        ON CONFLICT (service_id) DO NOTHING
    `, [
        svc.serviceId,
        svc.title,
        svc.shortDescription ?? null,
        svc.description ?? null,
        svc.serviceStatusCode ?? null,
        svc.serviceTypeCode ?? null,
        svc.portfolioGroupCode ?? null,
        svc.globalServiceGroupCode ?? null,
        svc.serviceLineCode ?? null,
        svc.organizationalElementCode ?? null,
        svc.serviceUrl ?? null,
        svc.cpServiceTypeRaw ?? null,
        svc.isAvailableStatusAmbiguous ?? false,
        svc.serviceAreaRaw ?? null,
        svc.isStub ?? false,
        svc.businessPurpose ?? null,
        svc.serviceFeaturesRaw ?? null,
        svc.requestProcessRaw ?? null,
        svc.supportLocationsRaw ?? null,
        svc.operationalNotesRaw ?? null,
        svc.otherInfoRaw ?? null,
        svc.extToolsRaw ?? null,
        svc.legacySslMappingRaw ?? null,
        svc.budgetActivityCode ?? null,
        svc.pricingNoteRaw ?? null,
        svc.createdAtSource ?? null,
        svc.modifiedAtSource ?? null,
    ]);
}

async function upsertDomains(serviceId, domains) {
    for (const domain of domains) {
        if (!domain.domainCode || domain.domainCode.length > 30) {
            logger.warn({ serviceId, domainCode: domain.domainCode }, 'import.repo: upsertDomains — domainCode exceeds 30 characters or is empty; skipping');
            continue;
        }

        const servicePk = await getServicePk(serviceId);
        if (!servicePk) continue;

        await getPool().query(`
            INSERT INTO data.service_available_on (service_id, domain_code, source_field, notes)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (service_id, domain_code) DO UPDATE SET
                source_field = EXCLUDED.source_field,
                notes = COALESCE(EXCLUDED.notes, data.service_available_on.notes)
        `, [
            servicePk,
            domain.domainCode,
            domain.sourceField ?? 'Available Networks',
            domain.notes ?? null,
        ]);
    }
}

async function upsertRole(serviceId, roleCode, displayName, email, organizationName) {
    if (!displayName) return;
    const servicePk = await getServicePk(serviceId);
    if (!servicePk) return;

    await getPool().query(`
        UPDATE data.service_role_assignment
        SET valid_to = CURRENT_TIMESTAMP
        WHERE service_id = $1
          AND role_code = $2
          AND valid_to IS NULL
          AND (
            display_name <> $3
            OR (email IS NULL AND $4 IS NOT NULL)
            OR (email IS NOT NULL AND $4 IS NULL)
            OR email <> $4
          )
    `, [servicePk, roleCode, displayName, email ?? null]);

    await getPool().query(`
        INSERT INTO data.service_role_assignment
            (service_id, role_code, display_name, email, organization_name, valid_from, valid_to)
        SELECT $1, $2, $3, $4, $5, CURRENT_TIMESTAMP, NULL
        WHERE NOT EXISTS (
            SELECT 1
            FROM data.service_role_assignment
            WHERE service_id = $1
              AND role_code = $2
              AND display_name = $3
              AND valid_to IS NULL
        )
    `, [servicePk, roleCode, displayName, email ?? null, organizationName ?? null]);
}

async function upsertRelation({ fromServiceId, toServiceId, relationTypeCode, sourceField, rawText, isInferred, parseConfidence, isVerified }) {
    const idsResult = await getPool().query(`
        SELECT
            (SELECT id FROM data.service_catalog WHERE service_id = $1) AS from_id,
            (SELECT id FROM data.service_catalog WHERE service_id = $2) AS to_id
    `, [fromServiceId, toServiceId]);
    const { from_id: fromId, to_id: toId } = idsResult.rows[0] ?? {};
    if (!fromId || !toId) return;

    const updateResult = await getPool().query(`
        UPDATE data.service_relation
        SET raw_text = COALESCE($4, raw_text),
            parse_confidence = GREATEST(COALESCE(parse_confidence, 0), COALESCE($5, 0)),
            updated_at = CURRENT_TIMESTAMP
        WHERE from_service_id = $1
          AND to_service_id = $2
          AND relation_type_code = $3
          AND is_deleted = FALSE
    `, [fromId, toId, relationTypeCode, rawText ?? null, parseConfidence ?? 0.5]);

    if (updateResult.rowCount > 0) return;

    await getPool().query(`
        INSERT INTO data.service_relation
            (from_service_id, to_service_id, relation_type_code, source_field, raw_text, is_inferred, parse_confidence, is_verified)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [fromId, toId, relationTypeCode, sourceField ?? null, rawText ?? null, isInferred ?? false, parseConfidence ?? 0.5, isVerified ?? false]);
}

async function insertRelationRaw({ serviceId, sourceField, rawValue, parsedOk, parserVersion, notes }) {
    const servicePk = await getServicePk(serviceId);
    if (!servicePk) return;

    await getPool().query(`
        INSERT INTO data.service_relation_raw
            (service_id, source_field, raw_value, parsed_ok, parser_version, parsed_at, notes)
        VALUES
            ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6)
    `, [servicePk, sourceField, rawValue, parsedOk ?? false, parserVersion ?? '1.0', notes ?? null]);
}

async function upsertFlavour(flavour) {
    const servicePk = await getServicePk(flavour.serviceId);
    if (!servicePk) return;

    await getPool().query(`
        INSERT INTO data.service_flavour
            (service_id, flavour_code, title, service_unit, price_value, currency_code, billing_period_code, flavour_status_code, is_orderable, display_order, pricing_note_raw)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (service_id, flavour_code) WHERE is_deleted = FALSE DO UPDATE SET
            title = EXCLUDED.title,
            service_unit = EXCLUDED.service_unit,
            price_value = EXCLUDED.price_value,
            currency_code = EXCLUDED.currency_code,
            flavour_status_code = EXCLUDED.flavour_status_code,
            pricing_note_raw = EXCLUDED.pricing_note_raw,
            updated_at = CURRENT_TIMESTAMP
    `, [
        servicePk,
        flavour.flavourCode,
        flavour.title ?? null,
        flavour.serviceUnit ?? null,
        flavour.priceValue ?? null,
        flavour.currencyCode ?? 'EUR',
        flavour.billingPeriodCode ?? null,
        flavour.flavourStatusCode ?? 'available',
        flavour.isOrderable ?? true,
        flavour.displayOrder ?? 0,
        flavour.pricingNoteRaw ?? null,
    ]);
}

async function upsertSla(sla) {
    const servicePk = await getServicePk(sla.serviceId);
    if (!servicePk) return;

    const updateResult = await getPool().query(`
        UPDATE data.service_sla
        SET support_window_code = $3,
            availability_pct = $4,
            restoration_hours = $5,
            delivery_days = $6,
            sla_note_raw = $7,
            updated_at = CURRENT_TIMESTAMP
        WHERE service_id = $1
          AND flavour_id IS NOT DISTINCT FROM $2
    `, [
        servicePk,
        sla.flavourId ?? null,
        sla.supportWindowCode ?? null,
        sla.availabilityPct ?? null,
        sla.restorationHours ?? null,
        sla.deliveryDays ?? null,
        sla.slaNoteRaw ?? null,
    ]);

    if (updateResult.rowCount > 0) return;

    await getPool().query(`
        INSERT INTO data.service_sla
            (service_id, flavour_id, support_window_code, availability_pct, restoration_hours, delivery_days, sla_note_raw, source_field)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
        servicePk,
        sla.flavourId ?? null,
        sla.supportWindowCode ?? null,
        sla.availabilityPct ?? null,
        sla.restorationHours ?? null,
        sla.deliveryDays ?? null,
        sla.slaNoteRaw ?? null,
        sla.sourceField ?? 'Support Availability',
    ]);
}

async function ensureLookup(table, code, label) {
    if (!code) return;
    const tableMap = {
        ref_ServiceType: 'data.ref_service_type',
        ref_ServiceStatus: 'data.ref_service_status',
        ref_PortfolioGroup: 'data.ref_portfolio_group',
        ref_GlobalServiceGroup: 'data.ref_global_service_group',
        ref_ServiceLine: 'data.ref_service_line',
        ref_OrganizationalElement: 'data.ref_organizational_element',
        ref_NetworkDomain: 'data.ref_network_domain',
        ref_FlavourStatus: 'data.ref_flavour_status',
        ref_SupportWindow: 'data.ref_support_window',
    };
    const tableName = tableMap[table];
    if (!tableName) return;

    await getPool().query(`
        INSERT INTO ${tableName} (code, name)
        VALUES ($1, $2)
        ON CONFLICT (code) DO NOTHING
    `, [code, label ?? code]);
}

async function listBatches(limit = 50) {
    const result = await getPool().query(`
        SELECT
            id, filename, imported_by, parser_version,
            ok_count, warn_count, error_count, row_count,
            imported_at, notes, source_hash_sha256
        FROM data.import_batch
        ORDER BY imported_at DESC
        LIMIT $1
    `, [Math.min(200, limit)]);
    return result.rows;
}

async function getBatchWithIssues(batchId) {
    const [batchRes, issuesRes] = await Promise.all([
        getPool().query('SELECT * FROM data.import_batch WHERE id = $1', [batchId]),
        getPool().query(`
            SELECT id, row_id, service_id, severity, issue_code, field_name, raw_value, message, created_at
            FROM data.import_issue
            WHERE batch_id = $1
            ORDER BY severity DESC, created_at ASC
        `, [batchId]),
    ]);

    const batch = batchRes.rows[0] ?? null;
    if (!batch) return null;
    return { ...batch, issues: issuesRes.rows };
}

async function createContractReport({
    sourceName,
    sourceKind,
    createdBy,
    sourceHashSha256,
    itemCount,
    flavourCount,
    explicitRelationCount,
    rawPrerequisiteCount,
    missingTargetCount,
    stubCount,
    unresolvedRefCount,
    unresolvedRefsJson,
    missingTargetsJson,
    summaryJson,
}) {
    const result = await getPool().query(`
        INSERT INTO data.import_contract_report
            (source_name, source_kind, created_by, source_hash_sha256, item_count, flavour_count, explicit_relation_count, raw_prerequisite_count, missing_target_count, stub_count, unresolved_ref_count, unresolved_refs_json, missing_targets_json, summary_json)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id
    `, [
        sourceName,
        sourceKind,
        createdBy ?? null,
        sourceHashSha256 ?? null,
        itemCount,
        flavourCount,
        explicitRelationCount,
        rawPrerequisiteCount,
        missingTargetCount,
        stubCount,
        unresolvedRefCount,
        unresolvedRefsJson ?? null,
        missingTargetsJson ?? null,
        summaryJson ?? null,
    ]);
    return result.rows[0]?.id ?? null;
}

async function getLatestContractReport() {
    const result = await getPool().query('SELECT * FROM data.v_importcontractreportlatest');
    return result.rows[0] ?? null;
}

async function getContractReportByHash(sourceHashSha256) {
    const result = await getPool().query(`
        SELECT *
        FROM data.v_importcontractreportbyhash
        WHERE source_hash_sha256 = $1
    `, [sourceHashSha256]);
    return result.rows[0] ?? null;
}

async function getBatchPairingByHash(sourceHashSha256) {
    const result = await getPool().query(`
        SELECT *
        FROM data.v_importbatchcontractpairing
        WHERE source_hash_sha256 = $1
        ORDER BY imported_at DESC, batch_id DESC
    `, [sourceHashSha256]);
    return result.rows;
}

async function insertRawField({ serviceId, fieldName, rawValue, parserVersion, notes }) {
    if (!rawValue) return;
    const servicePk = await getServicePk(serviceId);
    if (!servicePk) return;

    const updateResult = await getPool().query(`
        UPDATE data.service_raw_field
        SET raw_value = $3,
            parser_version = $4,
            notes = $5,
            parse_status = NULL,
            created_at = CURRENT_TIMESTAMP
        WHERE service_id = $1
          AND field_name = $2
    `, [servicePk, fieldName, rawValue, parserVersion ?? '2.1', notes ?? null]);

    if (updateResult.rowCount > 0) return;

    await getPool().query(`
        INSERT INTO data.service_raw_field
            (service_id, field_name, raw_value, parser_version, notes, parsed_value, parse_status)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7)
    `, [servicePk, fieldName, rawValue, parserVersion ?? '2.1', notes ?? null, null, null]);
}

module.exports = {
    createBatch,
    closeBatch,
    createRow,
    updateRowStatus,
    logIssue,
    upsertService,
    upsertDomains,
    upsertRole,
    upsertRelation,
    insertRelationRaw,
    insertRawField,
    upsertFlavour,
    upsertSla,
    ensureLookup,
    listBatches,
    getBatchWithIssues,
    createContractReport,
    getLatestContractReport,
    getContractReportByHash,
    getBatchPairingByHash,
};

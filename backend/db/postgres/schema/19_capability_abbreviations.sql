-- =============================================================================
-- SERVICE CATALOGUE — PostgreSQL canonical schema
-- 19_capability_abbreviations.sql | Level-3 capability abbreviations and slugs
-- =============================================================================

SET search_path TO data, public;

UPDATE c3_taxonomy SET abbreviation = 'Cap' WHERE external_id = 'CP-1000';
UPDATE c3_taxonomy SET abbreviation = 'BMC' WHERE external_id = 'CP-1010';
UPDATE c3_taxonomy SET abbreviation = 'CIS' WHERE external_id = 'CP-1023';
UPDATE c3_taxonomy SET abbreviation = 'CON' WHERE external_id = 'CP-1027';
UPDATE c3_taxonomy SET abbreviation = 'C2C' WHERE external_id = 'CP-1022';
UPDATE c3_taxonomy SET abbreviation = 'IMC' WHERE external_id = 'CP-1059';

UPDATE c3_taxonomy SET abbreviation = 'Air-BMC' WHERE external_id = 'CP-1004';
UPDATE c3_taxonomy SET abbreviation = 'CIS-Sec' WHERE external_id = 'CP-1016';
UPDATE c3_taxonomy SET abbreviation = 'Info-Collect' WHERE external_id = 'CP-1020';
UPDATE c3_taxonomy SET abbreviation = 'Comms-Infra' WHERE external_id = 'CP-1024';
UPDATE c3_taxonomy SET abbreviation = 'Cyber-BMC' WHERE external_id = 'CP-1030';
UPDATE c3_taxonomy SET abbreviation = 'Info-Exploit' WHERE external_id = 'CP-1033';
UPDATE c3_taxonomy SET abbreviation = 'Transform-CapBuild' WHERE external_id = 'CP-1038';
UPDATE c3_taxonomy SET abbreviation = 'Info-Dissem' WHERE external_id = 'CP-1041';
UPDATE c3_taxonomy SET abbreviation = 'ESM' WHERE external_id = 'CP-1043';
UPDATE c3_taxonomy SET abbreviation = 'Coop-RelBuild' WHERE external_id = 'CP-1052';
UPDATE c3_taxonomy SET abbreviation = 'IT-Infra' WHERE external_id = 'CP-1067';
UPDATE c3_taxonomy SET abbreviation = 'Joint-BMC' WHERE external_id = 'CP-1068';
UPDATE c3_taxonomy SET abbreviation = 'Land-BMC' WHERE external_id = 'CP-1072';
UPDATE c3_taxonomy SET abbreviation = 'Maritime-BMC' WHERE external_id = 'CP-1079';
UPDATE c3_taxonomy SET abbreviation = 'Strategic-C2' WHERE external_id = 'CP-1087';
UPDATE c3_taxonomy SET abbreviation = 'Operational-C2' WHERE external_id = 'CP-1091';
UPDATE c3_taxonomy SET abbreviation = 'Info-Process' WHERE external_id = 'CP-1097';
UPDATE c3_taxonomy SET abbreviation = 'Research-Innovation' WHERE external_id = 'CP-1102';
UPDATE c3_taxonomy SET abbreviation = 'Svc-Mgmt' WHERE external_id = 'CP-1104';
UPDATE c3_taxonomy SET abbreviation = 'Space-BMC' WHERE external_id = 'CP-1107';
UPDATE c3_taxonomy SET abbreviation = 'Tactical-C2' WHERE external_id = 'CP-1117';
UPDATE c3_taxonomy SET abbreviation = 'IT-Svc' WHERE external_id = 'CP-1122';
UPDATE c3_taxonomy SET abbreviation = 'Info-Protect' WHERE external_id = 'CP-1123';
UPDATE c3_taxonomy SET abbreviation = 'Policy-Strategy' WHERE external_id = 'CP-1124';
UPDATE c3_taxonomy SET abbreviation = 'Budget-Resources' WHERE external_id = 'CP-1125';
UPDATE c3_taxonomy SET abbreviation = 'Crisis-Response' WHERE external_id = 'CP-1126';
UPDATE c3_taxonomy SET abbreviation = 'Comms-Svc' WHERE external_id = 'CP-1127';

SET search_path TO platform, public;
INSERT INTO schema_migrations (migration_key, migration_label, schema_version, notes)
VALUES (
    '19_capability_abbreviations',
    'Capability abbreviations for stable Level-3 slugs',
    '2.2.0',
    'Populates C3 capability abbreviations for L1/L2/L3 URL slugs'
)
ON CONFLICT (migration_key) DO UPDATE SET
    migration_label = EXCLUDED.migration_label,
    applied_at      = CURRENT_TIMESTAMP,
    notes           = EXCLUDED.notes;

-- =============================================================================
-- SERVICE CATALOGUE — PostgreSQL canonical schema
-- 07_domains.sql | schema: data
-- Converted from backend/db/05_domains.sql
-- =============================================================================

SET search_path TO data, public;

CREATE TABLE IF NOT EXISTS service_available_on (
    service_id    BIGINT       NOT NULL REFERENCES service_catalog(id),
    domain_code   VARCHAR(30)  NOT NULL REFERENCES ref_network_domain(code),
    source_field  VARCHAR(100) NULL,
    notes         TEXT         NULL,
    PRIMARY KEY (service_id, domain_code)
);

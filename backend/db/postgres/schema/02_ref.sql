-- =============================================================================
-- SERVICE CATALOGUE — PostgreSQL canonical schema
-- 02_ref.sql | schema: data
-- Converted from backend/db/01_ref.sql
-- =============================================================================

SET search_path TO data, public;

CREATE TABLE IF NOT EXISTS ref_service_type (
    code        VARCHAR(50)  PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(500) NULL
);

INSERT INTO ref_service_type (code, name)
VALUES
    ('CF',  'Customer Facing'),
    ('CFS', 'Customer Facing / Support'),
    ('ES',  'Enabling Service'),
    ('SS',  'Supporting Service'),
    ('MS',  'Managed Service'),
    ('AS',  'Advisory Service')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name;

CREATE TABLE IF NOT EXISTS ref_service_status (
    code       VARCHAR(50)  PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    sort_order INTEGER      NOT NULL,
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE
);

INSERT INTO ref_service_status (code, name, sort_order, is_active)
VALUES
    ('draft',              'Draft',                     1, TRUE),
    ('planned',            'Planned',                   2, TRUE),
    ('active',             'Active',                    3, TRUE),
    ('deprecated',         'Deprecated',                4, FALSE),
    ('retired',            'Retired',                   5, FALSE),
    ('external_reference', 'External Reference (Stub)', 99, FALSE)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

CREATE TABLE IF NOT EXISTS ref_relation_type (
    code                      VARCHAR(50)  PRIMARY KEY,
    name                      VARCHAR(100) NOT NULL,
    description               VARCHAR(500) NULL,
    is_directional            BOOLEAN      NOT NULL DEFAULT TRUE,
    is_operational_dependency BOOLEAN      NOT NULL DEFAULT TRUE,
    default_impact_mode       VARCHAR(30)  NULL,
    default_impact_level      VARCHAR(20)  NULL
);

INSERT INTO ref_relation_type
    (code, name, is_directional, is_operational_dependency, default_impact_mode, default_impact_level)
VALUES
    ('depends_on',       'Depends on',               TRUE,  TRUE,  'hard_stop', 'high'),
    ('prerequisite',     'Prerequisite',             TRUE,  TRUE,  'hard_stop', 'high'),
    ('underlying',       'Underlying service',       TRUE,  TRUE,  'hard_stop', 'high'),
    ('requires_account', 'Requires account',         TRUE,  TRUE,  NULL,        NULL),
    ('uses',             'Uses',                     TRUE,  TRUE,  NULL,        NULL),
    ('provides',         'Provides',                 TRUE,  TRUE,  NULL,        NULL),
    ('provided_by',      'Provided by',              TRUE,  TRUE,  NULL,        NULL),
    ('replaces',         'Replaces',                 TRUE,  FALSE, NULL,        NULL),
    ('replaced_by',      'Replaced by',              TRUE,  FALSE, NULL,        NULL),
    ('integrates_with',  'Integrates with',          TRUE,  FALSE, NULL,        NULL),
    ('related_to',       'Related to',               FALSE, FALSE, NULL,        NULL),
    ('part_of',          'Part of',                  TRUE,  FALSE, NULL,        NULL),
    ('child_of',         'Child Of (Parent-Child)',  TRUE,  FALSE, NULL,        NULL)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    is_directional = EXCLUDED.is_directional,
    is_operational_dependency = EXCLUDED.is_operational_dependency,
    default_impact_mode = EXCLUDED.default_impact_mode,
    default_impact_level = EXCLUDED.default_impact_level;

CREATE TABLE IF NOT EXISTS ref_portfolio_group (
    code       VARCHAR(100) PRIMARY KEY,
    name       VARCHAR(200) NOT NULL,
    sort_order INTEGER NULL,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS ref_portfolio_group_alias (
    id                   BIGSERIAL PRIMARY KEY,
    alias_key            VARCHAR(200) NOT NULL,
    portfolio_group_code VARCHAR(100) NOT NULL REFERENCES ref_portfolio_group(code) ON DELETE CASCADE,
    source_kind          VARCHAR(50)  NOT NULL DEFAULT 'manual',
    is_active            BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ux_ref_portfolio_group_alias UNIQUE (alias_key)
);

INSERT INTO ref_portfolio_group (code, name, sort_order)
VALUES
    ('Workplace Services',               'Workplace Services',                1),
    ('Application Services',             'Application Services',              2),
    ('Infrastructure Services',          'Infrastructure Services',           3),
    ('Platform Services',                'Platform Services',                 4),
    ('Security Services',                'Security Services',                 5),
    ('Network Services',                 'Network Services',                  6),
    ('Logistic Services',                'Logistic Services',                 7),
    ('Other Services',                   'Other Services',                    8),
    ('Digital Workplace Services',  'Digital Workplace Services',   9),
    ('Subject Matter Expertise Services','Subject Matter Expertise Services',10),
    ('Training Services',                'Training Services',                20)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order,
    is_active = TRUE;

INSERT INTO ref_portfolio_group_alias (alias_key, portfolio_group_code, source_kind, is_active)
VALUES
    ('application service',               'Application Services',            'seed', TRUE),
    ('application services',              'Application Services',            'seed', TRUE),
    ('infrastructure service',            'Infrastructure Services',         'seed', TRUE),
    ('infrastructure services',           'Infrastructure Services',         'seed', TRUE),
    ('platform service',                  'Platform Services',               'seed', TRUE),
    ('platform services',                 'Platform Services',               'seed', TRUE),
    ('platform service s',                'Platform Services',               'seed', TRUE),
    ('security service',                  'Security Services',               'seed', TRUE),
    ('security services',                 'Security Services',               'seed', TRUE),
    ('network service',                   'Network Services',                'seed', TRUE),
    ('network services',                  'Network Services',                'seed', TRUE),
    ('workplace service',                 'Workplace Services',              'seed', TRUE),
    ('workplace services',                'Workplace Services',              'seed', TRUE),
    ('subject matter expertise service',  'Subject Matter Expertise Services','seed', TRUE),
    ('subject matter expertise services', 'Subject Matter Expertise Services','seed', TRUE),
    ('training service',                  'Training Services',               'seed', TRUE),
    ('training services',                 'Training Services',               'seed', TRUE),
    ('logistic service',                  'Logistic Services',               'seed', TRUE),
    ('logistic services',                 'Logistic Services',               'seed', TRUE),
    ('other service',                     'Other Services',                  'seed', TRUE),
    ('other services',                    'Other Services',                  'seed', TRUE),
    ('digital workplace service',    'Digital Workplace Services', 'seed', TRUE),
    ('digital workplace services',   'Digital Workplace Services', 'seed', TRUE)
ON CONFLICT (alias_key) DO UPDATE SET
    portfolio_group_code = EXCLUDED.portfolio_group_code,
    source_kind = EXCLUDED.source_kind,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS ref_global_service_group (
    code                 VARCHAR(150) PRIMARY KEY,
    name                 VARCHAR(200) NOT NULL,
    portfolio_group_code VARCHAR(100) NULL REFERENCES ref_portfolio_group(code),
    sort_order           INTEGER NULL
);

CREATE TABLE IF NOT EXISTS ref_service_line (
    code                      VARCHAR(150) PRIMARY KEY,
    name                      VARCHAR(200) NOT NULL,
    global_service_group_code VARCHAR(150) NULL REFERENCES ref_global_service_group(code),
    sort_order                INTEGER NULL
);

CREATE TABLE IF NOT EXISTS ref_organizational_element (
    code       VARCHAR(150) PRIMARY KEY,
    name       VARCHAR(200) NOT NULL,
    sort_order INTEGER NULL
);

CREATE TABLE IF NOT EXISTS ref_network_domain (
    code       VARCHAR(30)  PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    color_hex  VARCHAR(10)  NULL,
    sort_order INTEGER NULL
);

INSERT INTO ref_network_domain (code, name, color_hex, sort_order)
VALUES
    ('NEXUS',  'Nexus',   '#22c55e', 1),
    ('VERTEX', 'Vertex',  '#3b82f6', 2),
    ('ORBIT',  'Orbit',   '#ef4444', 3),
    ('PULSE',  'Pulse',   '#a855f7', 4),
    ('RELAY',  'Relay',   '#f97316', 5),
    ('CLOUD',  'Cloud',   '#06b6d4', 6),
    ('GRID',   'Grid',    '#8b5cf6', 7),
    ('PRISM',  'Prism',   '#0ea5e9', 8),
    ('HELIX',  'Helix',   '#64748b', 9),
    ('ZENITH', 'Zenith',  '#78716c', 10),
    ('APEX',   'Apex',    '#d97706', 11),
    ('VORTEX', 'Vortex',  '#06b6d4', 12),
    ('MATRIX', 'Matrix',  '#f97316', 13)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    color_hex = EXCLUDED.color_hex,
    sort_order = EXCLUDED.sort_order;

CREATE TABLE IF NOT EXISTS ref_security_classification (
    code       VARCHAR(30) PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    sort_order INTEGER NULL
);

INSERT INTO ref_security_classification (code, name, sort_order)
VALUES
    ('OPEN',       'Open',        1),
    ('STANDARD',   'Standard',    2),
    ('ELEVATED',   'Elevated',    3),
    ('RESTRICTED', 'Restricted',  4),
    ('PROTECTED',  'Protected',   5),
    ('CLASSIFIED', 'Classified',  6),
    ('SENSITIVE',  'Sensitive',   7),
    ('CONTROLLED', 'Controlled',  8)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order;

CREATE TABLE IF NOT EXISTS ref_support_window (
    code        VARCHAR(50)  PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(255) NULL,
    sort_order  INTEGER NULL
);

INSERT INTO ref_support_window (code, name, sort_order)
VALUES
    ('24x7',           '24x7',           1),
    ('business_hours', 'Business hours', 2),
    ('best_effort',    'Best effort',    3)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order;

CREATE TABLE IF NOT EXISTS ref_flavour_status (
    code       VARCHAR(50)  PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    sort_order INTEGER NULL
);

INSERT INTO ref_flavour_status (code, name, sort_order)
VALUES
    ('available',     'Available',     1),
    ('active',        'Active',        2),
    ('no_new_orders', 'No new orders', 3),
    ('retired',       'Retired',       4)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order;

CREATE TABLE IF NOT EXISTS ref_service_role (
    code       VARCHAR(50)  PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    sort_order INTEGER NULL
);

INSERT INTO ref_service_role (code, name, sort_order)
VALUES
    ('service_owner',            'Service Owner',            1),
    ('service_area_owner',       'Service Area Owner',       2),
    ('service_delivery_manager', 'Service Delivery Manager', 3)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order;

CREATE TABLE IF NOT EXISTS ref_pace_category (
    code        VARCHAR(10) PRIMARY KEY,
    name        VARCHAR(50) NOT NULL,
    sort_order  INTEGER NOT NULL,
    description VARCHAR(255) NULL
);

INSERT INTO ref_pace_category (code, name, sort_order, description)
VALUES
    ('P', 'Primary',     1, 'Primary service / primary path'),
    ('A', 'Alternate',   2, 'Alternate service / alternate path'),
    ('C', 'Contingency', 3, 'Contingency service / contingency path'),
    ('E', 'Emergency',   4, 'Emergency service / emergency path')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order,
    description = EXCLUDED.description;

CREATE TABLE IF NOT EXISTS ref_c3_mapping_type (
    code        VARCHAR(50) PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(500) NULL
);

INSERT INTO ref_c3_mapping_type (code, name, description)
VALUES
    ('supports',           'Supports',           'Service supports fulfilment of a C3 requirement'),
    ('enables',            'Enables',            'Service enables fulfilment of a C3 requirement'),
    ('fully_fulfills',     'Fully fulfills',     'Service fully fulfils a C3 requirement'),
    ('partially_fulfills', 'Partially fulfills', 'Service partially fulfils a C3 requirement')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

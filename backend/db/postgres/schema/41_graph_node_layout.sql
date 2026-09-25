-- =============================================================================
-- SERVICE CATALOGUE — PostgreSQL canonical schema
-- 41_graph_node_layout.sql | schema: data
--
-- Per-view graph layout. Node positions were one global pair of columns
-- (service_catalog.graph_x/graph_y), usable only for service nodes and shared
-- by every graph. data.graph_node_layout stores a position per graph view and
-- node id (the graph node id, e.g. 'svc:SVC-001', 'c3:<uuid>', 'app:<uuid>'):
--   service-overview/portfolio   service overview, portfolio grid
--   service-overview/dependency  service overview, dependency layout
--   service/<SERVICE_ID>         graph of one service
--   c3-relations                 C3 relation canvas
--
-- Existing graph_x/graph_y values were positions in the portfolio grid; they
-- move to 'service-overview/portfolio'. graph_layout_audit records the view and
-- node id, so layout changes of non-service nodes are audited too.
-- Idempotent: the copy runs only while service_catalog.graph_x exists.
-- =============================================================================

SET search_path TO data, public;

CREATE TABLE IF NOT EXISTS graph_node_layout (
    view_key    VARCHAR(120)     NOT NULL,
    node_id     VARCHAR(200)     NOT NULL,
    x           DOUBLE PRECISION NOT NULL,
    y           DOUBLE PRECISION NOT NULL,
    updated_by  VARCHAR(200)     NULL,
    updated_at  TIMESTAMPTZ      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (view_key, node_id)
);

COMMENT ON TABLE graph_node_layout IS
    'Saved node positions per graph view (view_key) and graph node id (node_id).';

ALTER TABLE graph_layout_audit ADD COLUMN IF NOT EXISTS view_key VARCHAR(120) NULL;
ALTER TABLE graph_layout_audit ADD COLUMN IF NOT EXISTS node_id VARCHAR(200) NULL;
ALTER TABLE graph_layout_audit ALTER COLUMN service_id DROP NOT NULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'data' AND table_name = 'service_catalog'
                 AND column_name = 'graph_x') THEN
        EXECUTE $sql$
            INSERT INTO graph_node_layout (view_key, node_id, x, y, updated_by)
            SELECT 'service-overview/portfolio', CONCAT('svc:', service_id), graph_x, graph_y, 'migration-41'
            FROM service_catalog
            WHERE graph_x IS NOT NULL AND graph_y IS NOT NULL
            ON CONFLICT (view_key, node_id) DO NOTHING
        $sql$;

        UPDATE graph_layout_audit gla
        SET view_key = 'service-overview/portfolio',
            node_id = CONCAT('svc:', sc.service_id)
        FROM service_catalog sc
        WHERE sc.id = gla.service_id
          AND gla.view_key IS NULL;

        DROP VIEW IF EXISTS v_graphoverviewnodes;
        ALTER TABLE service_catalog DROP COLUMN IF EXISTS graph_x;
        ALTER TABLE service_catalog DROP COLUMN IF EXISTS graph_y;
    END IF;
END $$;

-- Service nodes of the overview graph; positions come from graph_node_layout.
CREATE OR REPLACE VIEW v_graphoverviewnodes AS
SELECT
    sc.id AS service_pk,
    CONCAT('svc:', sc.service_id) AS id,
    'service' AS node_kind,
    sc.title,
    sc.service_id,
    sc.service_type_code AS service_type,
    fn_service_status_code(sc.lifecycle_stage_code, sc.is_stub) AS service_status,
    sp.portfolio_code AS portfolio_group,
    (
        SELECT string_agg(sao.domain_code, ',')
        FROM service_available_on sao
        WHERE sao.service_id = sc.id
    ) AS available_on,
    sla.availability_pct AS sla_availability
FROM service_catalog sc
LEFT JOIN service_portfolio sp ON sp.id = sc.portfolio_id
LEFT JOIN service_sla sla ON sla.id = fn_service_primary_sla_id(sc.id)
WHERE sc.is_deleted = FALSE;

SET search_path TO platform, public;

INSERT INTO schema_migrations (migration_key, migration_label, schema_version, notes)
VALUES (
    '41_graph_node_layout',
    'Per-view graph node layout',
    '3.8.0',
    'Adds data.graph_node_layout (view_key, node_id); moves service_catalog.graph_x/graph_y to the service-overview/portfolio view.'
)
ON CONFLICT (migration_key) DO UPDATE SET
    migration_label = EXCLUDED.migration_label,
    schema_version  = EXCLUDED.schema_version,
    applied_at      = CURRENT_TIMESTAMP,
    notes           = EXCLUDED.notes;

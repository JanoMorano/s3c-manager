-- =============================================================================
-- S3C Manager — PostgreSQL schema baseline (generated, do not edit)
-- Built by scripts/build-schema-baseline.sh from backend/db/postgres/schema/.
-- Contains the files listed in manifest.txt; later files are applied by the
-- init runner on top of it.
-- =============================================================================
--
-- PostgreSQL database dump
--



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: data; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA data;


--
-- Name: platform; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA platform;


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: fn_lifecycle_stage_from_state(text); Type: FUNCTION; Schema: data; Owner: -
--

CREATE FUNCTION data.fn_lifecycle_stage_from_state(p_state text) RETURNS character varying
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'data', 'public'
    AS $$
    SELECT CASE LOWER(BTRIM(COALESCE(p_state, '')))
        WHEN 'draft' THEN 'draft'
        WHEN 'design' THEN 'design'
        WHEN 'planned' THEN 'design'
        WHEN 'under_review' THEN 'design'
        WHEN 'approved' THEN 'active'
        WHEN 'live' THEN 'active'
        WHEN 'production' THEN 'active'
        WHEN 'published' THEN 'active'
        WHEN 'active' THEN 'active'
        WHEN 'deprecated' THEN 'retiring'
        WHEN 'retiring' THEN 'retiring'
        WHEN 'retired' THEN 'retired'
        ELSE NULL
    END
$$;


--
-- Name: fn_lifecycle_state_from_stage(text); Type: FUNCTION; Schema: data; Owner: -
--

CREATE FUNCTION data.fn_lifecycle_state_from_stage(p_stage text) RETURNS character varying
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'data', 'public'
    AS $$
    SELECT CASE p_stage
        WHEN 'draft' THEN 'draft'
        WHEN 'design' THEN 'draft'
        WHEN 'active' THEN 'live'
        WHEN 'retiring' THEN 'deprecated'
        WHEN 'retired' THEN 'retired'
        ELSE NULL
    END
$$;


--
-- Name: fn_ref_portfolio_group_sync_portfolio(); Type: FUNCTION; Schema: data; Owner: -
--

CREATE FUNCTION data.fn_ref_portfolio_group_sync_portfolio() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'data', 'public'
    AS $$
BEGIN
    INSERT INTO service_portfolio (portfolio_code, title, status_code)
    VALUES (NEW.code, NEW.name, 'active')
    ON CONFLICT (portfolio_code) DO UPDATE SET title = EXCLUDED.title, updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: fn_service_primary_sla_id(bigint); Type: FUNCTION; Schema: data; Owner: -
--

CREATE FUNCTION data.fn_service_primary_sla_id(p_service_id bigint) RETURNS bigint
    LANGUAGE sql STABLE
    SET search_path TO 'data', 'public'
    AS $$
    SELECT MIN(id) FROM service_sla WHERE service_id = p_service_id AND flavour_id IS NULL
$$;


--
-- Name: fn_service_status_code(text, boolean); Type: FUNCTION; Schema: data; Owner: -
--

CREATE FUNCTION data.fn_service_status_code(p_stage text, p_is_stub boolean) RETURNS character varying
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'data', 'public'
    AS $$
    SELECT CASE WHEN p_is_stub THEN 'external_reference'::varchar(50)
                ELSE fn_service_status_from_stage(p_stage)::varchar(50) END
$$;


--
-- Name: fn_service_status_from_stage(text); Type: FUNCTION; Schema: data; Owner: -
--

CREATE FUNCTION data.fn_service_status_from_stage(p_stage text) RETURNS character varying
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'data', 'public'
    AS $$
    SELECT CASE p_stage
        WHEN 'draft' THEN 'draft'
        WHEN 'design' THEN 'planned'
        WHEN 'active' THEN 'active'
        WHEN 'retiring' THEN 'deprecated'
        WHEN 'retired' THEN 'retired'
        ELSE NULL
    END
$$;


--
-- Name: parse_seed_timestamptz(text); Type: FUNCTION; Schema: data; Owner: -
--

CREATE FUNCTION data.parse_seed_timestamptz(p_value text) RETURNS timestamp with time zone
    LANGUAGE sql IMMUTABLE
    AS $$
    SELECT CASE
        WHEN p_value IS NULL OR btrim(p_value) = '' THEN NULL
        ELSE p_value::timestamp AT TIME ZONE 'UTC'
    END
$$;


--
-- Name: run_retention_purge(character varying); Type: FUNCTION; Schema: data; Owner: -
--

CREATE FUNCTION data.run_retention_purge(p_trigger_source character varying DEFAULT 'app-inline'::character varying) RETURNS TABLE(job_id bigint, status character varying, deleted_import_issue integer, deleted_import_row integer, deleted_import_batch integer, deleted_taxonomy_audit integer, deleted_graph_audit integer, started_at timestamp with time zone, completed_at timestamp with time zone, error_message text)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_lock_acquired BOOLEAN := FALSE;
    v_job_id BIGINT := NULL;
    v_started_at TIMESTAMPTZ := CURRENT_TIMESTAMP;
    v_issue_retention_days INTEGER := NULL;
    v_issue_archive_days INTEGER := NULL;
    v_row_retention_days INTEGER := NULL;
    v_row_archive_days INTEGER := NULL;
    v_batch_retention_days INTEGER := NULL;
    v_batch_archive_days INTEGER := NULL;
    v_taxonomy_retention_days INTEGER := NULL;
    v_taxonomy_archive_days INTEGER := NULL;
    v_graph_retention_days INTEGER := NULL;
    v_graph_archive_days INTEGER := NULL;
    v_deleted_import_issue INTEGER := 0;
    v_deleted_import_row INTEGER := 0;
    v_deleted_import_batch INTEGER := 0;
    v_deleted_taxonomy_audit INTEGER := 0;
    v_deleted_graph_audit INTEGER := 0;
BEGIN
    SELECT pg_try_advisory_lock(9042, 1201) INTO v_lock_acquired;
    IF NOT v_lock_acquired THEN
        RETURN QUERY
        SELECT
            NULL::BIGINT,
            'skipped'::VARCHAR(20),
            0, 0, 0, 0, 0,
            v_started_at,
            CURRENT_TIMESTAMP,
            'Retention purge already running'::TEXT;
        RETURN;
    END IF;

    INSERT INTO retention_job_audit (
        trigger_source,
        status,
        started_at
    )
    VALUES (
        COALESCE(NULLIF(p_trigger_source, ''), 'app-inline'),
        'running',
        v_started_at
    )
    RETURNING id INTO v_job_id;

    SELECT retention_days, archive_after_days
    INTO v_issue_retention_days, v_issue_archive_days
    FROM audit_retention_policy
    WHERE policy_key = 'import_issue' AND is_active = TRUE;

    SELECT retention_days, archive_after_days
    INTO v_row_retention_days, v_row_archive_days
    FROM audit_retention_policy
    WHERE policy_key = 'import_row' AND is_active = TRUE;

    SELECT retention_days, archive_after_days
    INTO v_batch_retention_days, v_batch_archive_days
    FROM audit_retention_policy
    WHERE policy_key = 'import_batch' AND is_active = TRUE;

    SELECT retention_days, archive_after_days
    INTO v_taxonomy_retention_days, v_taxonomy_archive_days
    FROM audit_retention_policy
    WHERE policy_key = 'taxonomy_mapping_audit' AND is_active = TRUE;

    SELECT retention_days, archive_after_days
    INTO v_graph_retention_days, v_graph_archive_days
    FROM audit_retention_policy
    WHERE policy_key = 'graph_layout_audit' AND is_active = TRUE;

    IF v_issue_archive_days IS NOT NULL OR v_row_archive_days IS NOT NULL OR v_batch_archive_days IS NOT NULL THEN
        INSERT INTO import_issue_archive
        SELECT CURRENT_TIMESTAMP, v_job_id, i.*
        FROM import_issue i
        WHERE (
            v_issue_archive_days IS NOT NULL
            AND i.created_at < (CURRENT_TIMESTAMP - make_interval(days => v_issue_archive_days))
        )
        OR EXISTS (
            SELECT 1
            FROM import_row r
            WHERE r.id = i.row_id
              AND v_row_archive_days IS NOT NULL
              AND r.created_at < (CURRENT_TIMESTAMP - make_interval(days => v_row_archive_days))
        )
        OR EXISTS (
            SELECT 1
            FROM import_batch b
            WHERE b.id = i.batch_id
              AND v_batch_archive_days IS NOT NULL
              AND b.imported_at < (CURRENT_TIMESTAMP - make_interval(days => v_batch_archive_days))
        )
        ON CONFLICT (id) DO NOTHING;
    END IF;

    IF v_row_archive_days IS NOT NULL THEN
        INSERT INTO import_row_archive
        SELECT CURRENT_TIMESTAMP, v_job_id, r.*
        FROM import_row r
        WHERE r.created_at < (CURRENT_TIMESTAMP - make_interval(days => v_row_archive_days))
        ON CONFLICT (id) DO NOTHING;
    END IF;

    IF v_batch_archive_days IS NOT NULL THEN
        INSERT INTO import_batch_archive
        SELECT CURRENT_TIMESTAMP, v_job_id, b.*
        FROM import_batch b
        WHERE b.imported_at < (CURRENT_TIMESTAMP - make_interval(days => v_batch_archive_days))
        ON CONFLICT (id) DO NOTHING;
    END IF;

    IF v_taxonomy_archive_days IS NOT NULL THEN
        INSERT INTO taxonomy_mapping_audit_archive
        SELECT CURRENT_TIMESTAMP, v_job_id, a.*
        FROM taxonomy_mapping_audit a
        WHERE a.changed_at < (CURRENT_TIMESTAMP - make_interval(days => v_taxonomy_archive_days))
        ON CONFLICT (id) DO NOTHING;
    END IF;

    IF v_graph_archive_days IS NOT NULL THEN
        INSERT INTO graph_layout_audit_archive
        SELECT CURRENT_TIMESTAMP, v_job_id, a.*
        FROM graph_layout_audit a
        WHERE a.changed_at < (CURRENT_TIMESTAMP - make_interval(days => v_graph_archive_days))
        ON CONFLICT (id) DO NOTHING;
    END IF;

    WITH deleted AS (
        DELETE FROM import_issue i
        WHERE (
            v_issue_retention_days IS NOT NULL
            AND i.created_at < (CURRENT_TIMESTAMP - make_interval(days => v_issue_retention_days))
        )
        OR EXISTS (
            SELECT 1
            FROM import_row r
            WHERE r.id = i.row_id
              AND v_row_retention_days IS NOT NULL
              AND r.created_at < (CURRENT_TIMESTAMP - make_interval(days => v_row_retention_days))
        )
        OR EXISTS (
            SELECT 1
            FROM import_batch b
            WHERE b.id = i.batch_id
              AND v_batch_retention_days IS NOT NULL
              AND b.imported_at < (CURRENT_TIMESTAMP - make_interval(days => v_batch_retention_days))
        )
        RETURNING 1
    )
    SELECT COUNT(*)::INTEGER INTO v_deleted_import_issue FROM deleted;

    WITH deleted AS (
        DELETE FROM import_row r
        WHERE v_row_retention_days IS NOT NULL
          AND r.created_at < (CURRENT_TIMESTAMP - make_interval(days => v_row_retention_days))
        RETURNING 1
    )
    SELECT COUNT(*)::INTEGER INTO v_deleted_import_row FROM deleted;

    WITH deleted AS (
        DELETE FROM import_batch b
        WHERE v_batch_retention_days IS NOT NULL
          AND b.imported_at < (CURRENT_TIMESTAMP - make_interval(days => v_batch_retention_days))
        RETURNING 1
    )
    SELECT COUNT(*)::INTEGER INTO v_deleted_import_batch FROM deleted;

    WITH deleted AS (
        DELETE FROM taxonomy_mapping_audit a
        WHERE v_taxonomy_retention_days IS NOT NULL
          AND a.changed_at < (CURRENT_TIMESTAMP - make_interval(days => v_taxonomy_retention_days))
        RETURNING 1
    )
    SELECT COUNT(*)::INTEGER INTO v_deleted_taxonomy_audit FROM deleted;

    WITH deleted AS (
        DELETE FROM graph_layout_audit a
        WHERE v_graph_retention_days IS NOT NULL
          AND a.changed_at < (CURRENT_TIMESTAMP - make_interval(days => v_graph_retention_days))
        RETURNING 1
    )
    SELECT COUNT(*)::INTEGER INTO v_deleted_graph_audit FROM deleted;

    UPDATE retention_job_audit
    SET
        status = 'success',
        deleted_import_issue = v_deleted_import_issue,
        deleted_import_row = v_deleted_import_row,
        deleted_import_batch = v_deleted_import_batch,
        deleted_taxonomy_audit = v_deleted_taxonomy_audit,
        deleted_graph_audit = v_deleted_graph_audit,
        completed_at = CURRENT_TIMESTAMP,
        error_message = NULL
    WHERE id = v_job_id;

    RETURN QUERY
    SELECT
        r.id,
        r.status,
        r.deleted_import_issue,
        r.deleted_import_row,
        r.deleted_import_batch,
        r.deleted_taxonomy_audit,
        r.deleted_graph_audit,
        r.started_at,
        r.completed_at,
        r.error_message
    FROM retention_job_audit r
    WHERE r.id = v_job_id;

    PERFORM pg_advisory_unlock(9042, 1201);
    RETURN;
EXCEPTION WHEN OTHERS THEN
    IF v_job_id IS NULL THEN
        INSERT INTO retention_job_audit (
            trigger_source,
            status,
            started_at,
            completed_at,
            error_message
        )
        VALUES (
            COALESCE(NULLIF(p_trigger_source, ''), 'app-inline'),
            'failed',
            v_started_at,
            CURRENT_TIMESTAMP,
            SQLERRM
        )
        RETURNING id INTO v_job_id;
    ELSE
        UPDATE retention_job_audit
        SET
            status = 'failed',
            deleted_import_issue = v_deleted_import_issue,
            deleted_import_row = v_deleted_import_row,
            deleted_import_batch = v_deleted_import_batch,
            deleted_taxonomy_audit = v_deleted_taxonomy_audit,
            deleted_graph_audit = v_deleted_graph_audit,
            completed_at = CURRENT_TIMESTAMP,
            error_message = SQLERRM
        WHERE id = v_job_id;
    END IF;

    IF v_lock_acquired THEN
        PERFORM pg_advisory_unlock(9042, 1201);
    END IF;

    RETURN QUERY
    SELECT
        r.id,
        r.status,
        r.deleted_import_issue,
        r.deleted_import_row,
        r.deleted_import_batch,
        r.deleted_taxonomy_audit,
        r.deleted_graph_audit,
        r.started_at,
        r.completed_at,
        r.error_message
    FROM retention_job_audit r
    WHERE r.id = v_job_id;
    RETURN;
END;
$$;


--
-- Name: upsert_retention_runner_heartbeat(character varying, character varying, character varying, timestamp with time zone, timestamp with time zone, character varying, text); Type: FUNCTION; Schema: data; Owner: -
--

CREATE FUNCTION data.upsert_retention_runner_heartbeat(p_runner_name character varying, p_runner_kind character varying DEFAULT 'app-inline'::character varying, p_status character varying DEFAULT 'idle'::character varying, p_last_run_started_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_last_run_completed_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_last_job_status character varying DEFAULT NULL::character varying, p_last_error_message text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO retention_runner_heartbeat (
        runner_name,
        runner_kind,
        status,
        last_seen_at,
        last_run_started_at,
        last_run_completed_at,
        last_job_status,
        last_error_message,
        updated_at
    )
    VALUES (
        p_runner_name,
        COALESCE(NULLIF(p_runner_kind, ''), 'app-inline'),
        COALESCE(NULLIF(p_status, ''), 'idle'),
        CURRENT_TIMESTAMP,
        p_last_run_started_at,
        p_last_run_completed_at,
        p_last_job_status,
        p_last_error_message,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (runner_name) DO UPDATE SET
        runner_kind = EXCLUDED.runner_kind,
        status = EXCLUDED.status,
        last_seen_at = CURRENT_TIMESTAMP,
        last_run_started_at = COALESCE(EXCLUDED.last_run_started_at, retention_runner_heartbeat.last_run_started_at),
        last_run_completed_at = COALESCE(EXCLUDED.last_run_completed_at, retention_runner_heartbeat.last_run_completed_at),
        last_job_status = COALESCE(EXCLUDED.last_job_status, retention_runner_heartbeat.last_job_status),
        last_error_message = EXCLUDED.last_error_message,
        updated_at = CURRENT_TIMESTAMP;
END;
$$;


--
-- Name: cleanup_expired_tokens(); Type: FUNCTION; Schema: platform; Owner: -
--

CREATE FUNCTION platform.cleanup_expired_tokens() RETURNS TABLE(deleted_count integer)
    LANGUAGE plpgsql
    AS $$
DECLARE
    affected_rows INTEGER;
BEGIN
    DELETE FROM refresh_tokens
    WHERE expires_at < CURRENT_TIMESTAMP OR revoked_at IS NOT NULL;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RETURN QUERY SELECT affected_rows;
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: platform; Owner: -
--

CREATE FUNCTION platform.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: trim_audit_log(integer); Type: FUNCTION; Schema: platform; Owner: -
--

CREATE FUNCTION platform.trim_audit_log(p_retention_days integer DEFAULT 365) RETURNS TABLE(deleted_count integer, cutoff_date timestamp with time zone)
    LANGUAGE plpgsql
    AS $$
DECLARE
    affected_rows INTEGER;
    cutoff TIMESTAMPTZ;
BEGIN
    cutoff := CURRENT_TIMESTAMP - make_interval(days => p_retention_days);

    DELETE FROM audit_log
    WHERE performed_at < cutoff;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RETURN QUERY SELECT affected_rows, cutoff;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: audit_retention_policy; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.audit_retention_policy (
    policy_key character varying(100) NOT NULL,
    target_table character varying(128) NOT NULL,
    retention_days integer NOT NULL,
    archive_after_days integer,
    is_active boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: c3_application; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.c3_application (
    id bigint NOT NULL,
    application_code character varying(100) NOT NULL,
    uuid character varying(100) NOT NULL,
    modification_date timestamp with time zone,
    order_num integer,
    ss_overall_status character varying(100),
    ss_baseline_status character varying(100),
    item_status character varying(50),
    data_source character varying(200),
    external_id character varying(200),
    data_qualifier character varying(500),
    title character varying(500) NOT NULL,
    source_description text,
    revised_description text,
    description text,
    revised boolean DEFAULT false,
    raw_json text,
    synced_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fmn_spiral character varying(20)
);


--
-- Name: c3_application_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.c3_application ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.c3_application_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: c3_board_state; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.c3_board_state (
    c3_uuid character varying(100) NOT NULL,
    board_state character varying(40) DEFAULT 'imported'::character varying NOT NULL,
    validation_status character varying(40),
    board_state_reason text,
    reviewed_at timestamp with time zone,
    reviewed_by character varying(255),
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by character varying(255),
    CONSTRAINT chk_c3_board_state CHECK (((board_state)::text = ANY ((ARRAY['imported'::character varying, 'validated'::character varying, 'mapped'::character varying, 'used'::character varying, 'reviewed'::character varying])::text[])))
);


--
-- Name: TABLE c3_board_state; Type: COMMENT; Schema: data; Owner: -
--

COMMENT ON TABLE data.c3_board_state IS 'Governance board state for C3 items. Source item_status remains content/source status.';


--
-- Name: c3_capability_application_link; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.c3_capability_application_link (
    id bigint NOT NULL,
    capability_uuid character varying(100) NOT NULL,
    c3_application_id bigint NOT NULL,
    link_role character varying(50),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(255)
);


--
-- Name: c3_capability_application_link_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.c3_capability_application_link ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.c3_capability_application_link_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: c3_capability_builder; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.c3_capability_builder (
    id bigint NOT NULL,
    page_id character varying(100) NOT NULL,
    uuid character varying(100) NOT NULL,
    title character varying(500) NOT NULL,
    parent_id character varying(100),
    level integer NOT NULL,
    state character varying(50),
    domain_code character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fmn_spiral character varying(20),
    CONSTRAINT c3_capability_builder_level_check CHECK (((level >= 1) AND (level <= 20)))
);


--
-- Name: c3_capability_builder_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.c3_capability_builder ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.c3_capability_builder_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: c3_capability_builder_seed_state; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.c3_capability_builder_seed_state (
    seed_version character varying(100) NOT NULL,
    seed_source character varying(400),
    seeded_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: c3_capability_c3_service_link; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.c3_capability_c3_service_link (
    id bigint NOT NULL,
    capability_uuid character varying(100) NOT NULL,
    c3_service_id bigint NOT NULL,
    link_role character varying(50),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(255)
);


--
-- Name: c3_capability_c3_service_link_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.c3_capability_c3_service_link ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.c3_capability_c3_service_link_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: c3_capability_data_object_link; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.c3_capability_data_object_link (
    id bigint NOT NULL,
    capability_uuid character varying(100) NOT NULL,
    c3_data_object_id bigint NOT NULL,
    link_role character varying(50),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(255)
);


--
-- Name: c3_capability_data_object_link_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.c3_capability_data_object_link ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.c3_capability_data_object_link_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: c3_capability_tin_link; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.c3_capability_tin_link (
    id bigint NOT NULL,
    capability_uuid character varying(100) NOT NULL,
    c3_tin_id bigint NOT NULL,
    link_role character varying(50),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(255)
);


--
-- Name: c3_capability_tin_link_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.c3_capability_tin_link ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.c3_capability_tin_link_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: c3_data_object; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.c3_data_object (
    id bigint NOT NULL,
    data_object_code character varying(100) NOT NULL,
    uuid character varying(100) NOT NULL,
    modification_date timestamp with time zone,
    order_num integer,
    ss_overall_status character varying(100),
    ss_baseline_status character varying(100),
    item_status character varying(50),
    title character varying(500) NOT NULL,
    description text,
    provenance_raw text,
    references_raw text,
    standards_raw text,
    raw_json text,
    synced_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fmn_spiral character varying(20)
);


--
-- Name: c3_data_object_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.c3_data_object ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.c3_data_object_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: c3_entity_import_issue; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.c3_entity_import_issue (
    id bigint NOT NULL,
    run_id bigint NOT NULL,
    row_number integer,
    severity character varying(20) NOT NULL,
    issue_code character varying(100) NOT NULL,
    field_name character varying(100),
    raw_value text,
    message text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: c3_entity_import_issue_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.c3_entity_import_issue ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.c3_entity_import_issue_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: c3_entity_import_run; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.c3_entity_import_run (
    id bigint NOT NULL,
    target_key character varying(100) NOT NULL,
    source_name character varying(500),
    source_kind character varying(20) NOT NULL,
    is_dry_run boolean DEFAULT false NOT NULL,
    row_count integer DEFAULT 0 NOT NULL,
    ok_count integer DEFAULT 0 NOT NULL,
    warn_count integer DEFAULT 0 NOT NULL,
    error_count integer DEFAULT 0 NOT NULL,
    inserted_count integer DEFAULT 0 NOT NULL,
    updated_count integer DEFAULT 0 NOT NULL,
    failed_count integer DEFAULT 0 NOT NULL,
    created_by character varying(255),
    notes text,
    spiral_code character varying(20),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: c3_entity_import_run_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.c3_entity_import_run ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.c3_entity_import_run_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: c3_entity_seed_snapshot_state; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.c3_entity_seed_snapshot_state (
    seed_key character varying(100) NOT NULL,
    seed_source character varying(400),
    seeded_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: c3_entity_spiral_membership; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.c3_entity_spiral_membership (
    id bigint NOT NULL,
    entity_kind character varying(50) NOT NULL,
    entity_uuid character varying(100) NOT NULL,
    spiral_code character varying(20) NOT NULL,
    status_in_spiral character varying(50),
    ss_overall_status character varying(100),
    ss_baseline_status character varying(100),
    item_status character varying(50),
    source_run_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_c3_entity_spiral_membership_kind CHECK (((entity_kind)::text = ANY ((ARRAY['application'::character varying, 'data_object'::character varying, 'c3_service'::character varying, 'technology_interaction'::character varying, 'capability'::character varying])::text[])))
);


--
-- Name: c3_entity_spiral_membership_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.c3_entity_spiral_membership ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.c3_entity_spiral_membership_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: c3_service; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.c3_service (
    id bigint NOT NULL,
    service_code character varying(100) NOT NULL,
    uuid character varying(100) NOT NULL,
    modification_date timestamp with time zone,
    order_num integer,
    ss_overall_status character varying(100),
    ss_baseline_status character varying(100),
    item_status character varying(50),
    data_source character varying(200),
    external_id character varying(200),
    data_qualifier character varying(500),
    title character varying(500) NOT NULL,
    source_description text,
    revised_description text,
    description text,
    revised boolean DEFAULT false,
    raw_json text,
    synced_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fmn_spiral character varying(20)
);


--
-- Name: c3_service_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.c3_service ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.c3_service_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: c3_taxonomy; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.c3_taxonomy (
    id bigint NOT NULL,
    uuid character varying(100) NOT NULL,
    application character varying(100),
    title character varying(500) NOT NULL,
    description text,
    source_description text,
    revised_description text,
    external_id character varying(200),
    source_external_id character varying(200),
    data_qualifier character varying(500),
    data_source character varying(200),
    ss_overall_status character varying(100),
    ss_baseline_status character varying(100),
    item_status character varying(50),
    order_num integer,
    modification_date timestamp with time zone,
    revised boolean DEFAULT false,
    synced_at timestamp with time zone,
    abbreviation character varying(200),
    synonym text,
    script_raw text,
    datasets_raw text,
    standards_raw text,
    references_raw text,
    provenance_raw text,
    item_type character varying(10),
    level_num integer,
    parent_code character varying(50),
    parent_uuid character varying(100),
    fmn_spiral character varying(20)
);


--
-- Name: c3_taxonomy_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.c3_taxonomy ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.c3_taxonomy_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: c3_technology_interaction; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.c3_technology_interaction (
    id bigint NOT NULL,
    technology_interaction_code character varying(100) NOT NULL,
    uuid character varying(100) NOT NULL,
    modification_date timestamp with time zone,
    order_num integer,
    ss_overall_status character varying(100),
    ss_baseline_status character varying(100),
    item_status character varying(50),
    ciav_review_status character varying(100),
    mcsma_review_status character varying(100),
    service_instructions text,
    title character varying(500) NOT NULL,
    technology_interaction_type character varying(200),
    technology_interaction_maturity character varying(200),
    technology_interactions_1_raw text,
    description text,
    conditionality text,
    services_1_raw text,
    applications_1_raw text,
    services_2_raw text,
    technology_interactions_2_raw text,
    technology_interactions_3_raw text,
    services_3_raw text,
    applications_2_raw text,
    data_objects_raw text,
    raw_json text,
    synced_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    fmn_spiral character varying(20)
);


--
-- Name: c3_technology_interaction_application_link; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.c3_technology_interaction_application_link (
    id bigint NOT NULL,
    technology_interaction_id bigint NOT NULL,
    c3_application_id bigint NOT NULL,
    source_slot character varying(50) NOT NULL,
    ref_value character varying(200),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: c3_technology_interaction_application_link_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.c3_technology_interaction_application_link ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.c3_technology_interaction_application_link_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: c3_technology_interaction_data_object_link; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.c3_technology_interaction_data_object_link (
    id bigint NOT NULL,
    technology_interaction_id bigint NOT NULL,
    c3_data_object_id bigint NOT NULL,
    source_slot character varying(50) NOT NULL,
    ref_value character varying(200),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: c3_technology_interaction_data_object_link_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.c3_technology_interaction_data_object_link ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.c3_technology_interaction_data_object_link_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: c3_technology_interaction_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.c3_technology_interaction ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.c3_technology_interaction_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: c3_technology_interaction_service_link; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.c3_technology_interaction_service_link (
    id bigint NOT NULL,
    technology_interaction_id bigint NOT NULL,
    c3_service_id bigint NOT NULL,
    source_slot character varying(50) NOT NULL,
    ref_value character varying(200),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: c3_technology_interaction_service_link_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.c3_technology_interaction_service_link ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.c3_technology_interaction_service_link_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: governance_decision; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.governance_decision (
    id bigint NOT NULL,
    service_id bigint NOT NULL,
    decision_type character varying(80) NOT NULL,
    decision character varying(40) NOT NULL,
    rationale text,
    decided_by character varying(255),
    decided_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_governance_decision_status CHECK (((decision)::text = ANY ((ARRAY['approved'::character varying, 'rejected'::character varying, 'deferred'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: governance_decision_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

CREATE SEQUENCE data.governance_decision_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: governance_decision_id_seq; Type: SEQUENCE OWNED BY; Schema: data; Owner: -
--

ALTER SEQUENCE data.governance_decision_id_seq OWNED BY data.governance_decision.id;


--
-- Name: governance_review; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.governance_review (
    id bigint NOT NULL,
    service_id bigint NOT NULL,
    review_type character varying(80) NOT NULL,
    status character varying(40) DEFAULT 'pending'::character varying NOT NULL,
    requested_by character varying(255),
    assigned_to character varying(255),
    due_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_governance_review_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'in_review'::character varying, 'approved'::character varying, 'rejected'::character varying, 'deferred'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: governance_review_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

CREATE SEQUENCE data.governance_review_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: governance_review_id_seq; Type: SEQUENCE OWNED BY; Schema: data; Owner: -
--

ALTER SEQUENCE data.governance_review_id_seq OWNED BY data.governance_review.id;


--
-- Name: graph_layout_audit; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.graph_layout_audit (
    id bigint NOT NULL,
    service_id bigint NOT NULL,
    node_kind character varying(30) NOT NULL,
    old_x double precision,
    old_y double precision,
    new_x double precision,
    new_y double precision,
    changed_by character varying(200),
    changed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: graph_layout_audit_archive; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.graph_layout_audit_archive (
    archived_at timestamp with time zone,
    retention_job_audit_id bigint,
    id bigint,
    service_id bigint,
    node_kind character varying(30),
    old_x double precision,
    old_y double precision,
    new_x double precision,
    new_y double precision,
    changed_by character varying(200),
    changed_at timestamp with time zone
);


--
-- Name: graph_layout_audit_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.graph_layout_audit ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.graph_layout_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: import_batch; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.import_batch (
    id bigint NOT NULL,
    filename character varying(500) NOT NULL,
    imported_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    imported_by character varying(255),
    row_count integer DEFAULT 0 NOT NULL,
    ok_count integer DEFAULT 0 NOT NULL,
    warn_count integer DEFAULT 0 NOT NULL,
    error_count integer DEFAULT 0 NOT NULL,
    parser_version character varying(50) DEFAULT '1.0'::character varying NOT NULL,
    source_hash_sha256 character varying(64),
    notes text
);


--
-- Name: import_batch_archive; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.import_batch_archive (
    archived_at timestamp with time zone,
    retention_job_audit_id bigint,
    id bigint,
    filename character varying(500),
    imported_at timestamp with time zone,
    imported_by character varying(255),
    row_count integer,
    ok_count integer,
    warn_count integer,
    error_count integer,
    parser_version character varying(50),
    source_hash_sha256 character varying(64),
    notes text
);


--
-- Name: import_batch_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.import_batch ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.import_batch_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: import_contract_report; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.import_contract_report (
    id bigint NOT NULL,
    source_name character varying(500) NOT NULL,
    source_kind character varying(50) NOT NULL,
    created_by character varying(255),
    contract_version character varying(50) DEFAULT '2026-03-30.import-v1'::character varying NOT NULL,
    source_hash_sha256 character varying(64),
    item_count integer DEFAULT 0 NOT NULL,
    flavour_count integer DEFAULT 0 NOT NULL,
    explicit_relation_count integer DEFAULT 0 NOT NULL,
    raw_prerequisite_count integer DEFAULT 0 NOT NULL,
    missing_target_count integer DEFAULT 0 NOT NULL,
    stub_count integer DEFAULT 0 NOT NULL,
    unresolved_ref_count integer DEFAULT 0 NOT NULL,
    unresolved_refs_json text,
    missing_targets_json text,
    summary_json text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: import_contract_report_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.import_contract_report ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.import_contract_report_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: import_issue; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.import_issue (
    id bigint NOT NULL,
    batch_id bigint NOT NULL,
    row_id bigint,
    service_id character varying(50),
    severity character varying(10) NOT NULL,
    issue_code character varying(100) NOT NULL,
    field_name character varying(100),
    raw_value text,
    message text,
    resolved boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT import_issue_severity_check CHECK (((severity)::text = ANY ((ARRAY['error'::character varying, 'warn'::character varying, 'info'::character varying])::text[])))
);


--
-- Name: import_issue_archive; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.import_issue_archive (
    archived_at timestamp with time zone,
    retention_job_audit_id bigint,
    id bigint,
    batch_id bigint,
    row_id bigint,
    service_id character varying(50),
    severity character varying(10),
    issue_code character varying(100),
    field_name character varying(100),
    raw_value text,
    message text,
    resolved boolean,
    created_at timestamp with time zone
);


--
-- Name: import_issue_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.import_issue ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.import_issue_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: import_row; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.import_row (
    id bigint NOT NULL,
    batch_id bigint NOT NULL,
    row_number integer NOT NULL,
    service_id character varying(50),
    raw_json text,
    status character varying(20) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT import_row_status_check CHECK (((status)::text = ANY ((ARRAY['ok'::character varying, 'warn'::character varying, 'error'::character varying, 'skipped'::character varying, 'processing'::character varying])::text[])))
);


--
-- Name: import_row_archive; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.import_row_archive (
    archived_at timestamp with time zone,
    retention_job_audit_id bigint,
    id bigint,
    batch_id bigint,
    row_number integer,
    service_id character varying(50),
    raw_json text,
    status character varying(20),
    created_at timestamp with time zone
);


--
-- Name: import_row_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.import_row ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.import_row_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: readiness_exception; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.readiness_exception (
    id bigint NOT NULL,
    service_id bigint NOT NULL,
    rule_key character varying(120) NOT NULL,
    reason text NOT NULL,
    expires_at timestamp with time zone,
    approved_by character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: readiness_exception_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

CREATE SEQUENCE data.readiness_exception_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: readiness_exception_id_seq; Type: SEQUENCE OWNED BY; Schema: data; Owner: -
--

ALTER SEQUENCE data.readiness_exception_id_seq OWNED BY data.readiness_exception.id;


--
-- Name: readiness_rule; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.readiness_rule (
    rule_key character varying(120) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    severity character varying(20) DEFAULT 'P2'::character varying NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    blocking boolean DEFAULT false NOT NULL,
    applies_to_lifecycle_stage character varying(80)[],
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    title_text text,
    why_text text,
    howto_text text,
    evidence_hint text,
    CONSTRAINT chk_readiness_rule_severity CHECK (((severity)::text = ANY ((ARRAY['P0'::character varying, 'P1'::character varying, 'P2'::character varying, 'info'::character varying])::text[])))
);


--
-- Name: ref_c3_capability_domain; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.ref_c3_capability_domain (
    code character varying(100) NOT NULL,
    css_class character varying(50) NOT NULL,
    heading_color character varying(20) NOT NULL,
    background_color character varying(20) NOT NULL,
    label character varying(200) NOT NULL,
    sort_order integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ref_c3_mapping_type; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.ref_c3_mapping_type (
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(500)
);


--
-- Name: ref_flavour_status; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.ref_flavour_status (
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    sort_order integer
);


--
-- Name: ref_global_service_group; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.ref_global_service_group (
    code character varying(150) NOT NULL,
    name character varying(200) NOT NULL,
    portfolio_group_code character varying(100),
    sort_order integer
);


--
-- Name: ref_network_domain; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.ref_network_domain (
    code character varying(30) NOT NULL,
    name character varying(100) NOT NULL,
    color_hex character varying(10),
    sort_order integer
);


--
-- Name: ref_organizational_element; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.ref_organizational_element (
    code character varying(150) NOT NULL,
    name character varying(200) NOT NULL,
    sort_order integer
);


--
-- Name: ref_pace_category; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.ref_pace_category (
    code character varying(10) NOT NULL,
    name character varying(50) NOT NULL,
    sort_order integer NOT NULL,
    description character varying(255)
);


--
-- Name: ref_portfolio_group; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.ref_portfolio_group (
    code character varying(100) NOT NULL,
    name character varying(200) NOT NULL,
    sort_order integer,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: ref_portfolio_group_alias; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.ref_portfolio_group_alias (
    id bigint NOT NULL,
    alias_key character varying(200) NOT NULL,
    portfolio_group_code character varying(100) NOT NULL,
    source_kind character varying(50) DEFAULT 'manual'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ref_portfolio_group_alias_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

CREATE SEQUENCE data.ref_portfolio_group_alias_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ref_portfolio_group_alias_id_seq; Type: SEQUENCE OWNED BY; Schema: data; Owner: -
--

ALTER SEQUENCE data.ref_portfolio_group_alias_id_seq OWNED BY data.ref_portfolio_group_alias.id;


--
-- Name: ref_relation_type; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.ref_relation_type (
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(500),
    is_directional boolean DEFAULT true NOT NULL,
    is_operational_dependency boolean DEFAULT true NOT NULL,
    default_impact_mode character varying(30),
    default_impact_level character varying(20)
);


--
-- Name: ref_security_classification; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.ref_security_classification (
    code character varying(30) NOT NULL,
    name character varying(100) NOT NULL,
    sort_order integer
);


--
-- Name: ref_service_criticality; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.ref_service_criticality (
    code character varying(50) NOT NULL,
    name character varying(120) NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: ref_service_lifecycle_stage; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.ref_service_lifecycle_stage (
    code character varying(50) NOT NULL,
    name character varying(120) NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: ref_service_line; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.ref_service_line (
    code character varying(150) NOT NULL,
    name character varying(200) NOT NULL,
    global_service_group_code character varying(150),
    sort_order integer
);


--
-- Name: ref_service_role; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.ref_service_role (
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    sort_order integer
);


--
-- Name: ref_service_status; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.ref_service_status (
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    sort_order integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: ref_service_type; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.ref_service_type (
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(500)
);


--
-- Name: ref_spiral_baseline; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.ref_spiral_baseline (
    id integer NOT NULL,
    spiral_code character varying(20) NOT NULL,
    spiral_label character varying(100) NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    notes text,
    activated_at timestamp with time zone,
    activated_by character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: ref_spiral_baseline_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.ref_spiral_baseline ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.ref_spiral_baseline_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: ref_support_window; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.ref_support_window (
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(255),
    sort_order integer
);


--
-- Name: retention_job_audit; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.retention_job_audit (
    id bigint NOT NULL,
    trigger_source character varying(100) NOT NULL,
    status character varying(20) NOT NULL,
    deleted_import_issue integer DEFAULT 0 NOT NULL,
    deleted_import_row integer DEFAULT 0 NOT NULL,
    deleted_import_batch integer DEFAULT 0 NOT NULL,
    deleted_taxonomy_audit integer DEFAULT 0 NOT NULL,
    deleted_graph_audit integer DEFAULT 0 NOT NULL,
    started_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp with time zone,
    error_message text
);


--
-- Name: retention_job_audit_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.retention_job_audit ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.retention_job_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: retention_runner_heartbeat; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.retention_runner_heartbeat (
    runner_name character varying(120) NOT NULL,
    runner_kind character varying(50) DEFAULT 'docker-service'::character varying NOT NULL,
    status character varying(20) DEFAULT 'unknown'::character varying NOT NULL,
    last_seen_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_run_started_at timestamp with time zone,
    last_run_completed_at timestamp with time zone,
    last_job_status character varying(20),
    last_error_message text,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: service_audience_policy; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.service_audience_policy (
    id bigint NOT NULL,
    service_id bigint NOT NULL,
    offering_id bigint,
    audience_type character varying(100),
    business_unit character varying(255),
    region_code character varying(100),
    eligibility_rule text,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: service_audience_policy_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.service_audience_policy ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.service_audience_policy_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: service_available_on; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.service_available_on (
    service_id bigint NOT NULL,
    domain_code character varying(30) NOT NULL,
    source_field character varying(100),
    notes text
);


--
-- Name: service_c3_mapping; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.service_c3_mapping (
    id bigint NOT NULL,
    service_id bigint NOT NULL,
    c3_uuid character varying(100) NOT NULL,
    c3_parent_uuid character varying(100),
    c3_level integer,
    c3_domain character varying(255),
    c3_source character varying(255),
    c3_reference character varying(255),
    mapping_type_code character varying(50) NOT NULL,
    pace_code character varying(10),
    is_primary boolean DEFAULT false NOT NULL,
    mapping_note text,
    synced_at timestamp with time zone,
    sync_status character varying(50),
    source_sp_id integer,
    source_etag character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: service_c3_mapping_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.service_c3_mapping ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.service_c3_mapping_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: service_catalog; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.service_catalog (
    id bigint NOT NULL,
    service_id character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    short_description character varying(1000),
    description text,
    service_type_code character varying(50),
    catalogue_version character varying(50),
    global_service_group_code character varying(150),
    service_line_code character varying(150),
    organizational_element_code character varying(150),
    service_url character varying(2000),
    security_classification_code character varying(30),
    service_features text,
    scope_text text,
    unit_of_measure character varying(100),
    charging_basis character varying(255),
    rate_note text,
    ordering_note text,
    exclusions text,
    graph_x double precision,
    graph_y double precision,
    operational_notes_raw text,
    retired_note text,
    budget_activity_code character varying(100),
    is_stub boolean DEFAULT false NOT NULL,
    notes_json text,
    is_deleted boolean DEFAULT false NOT NULL,
    completeness_score numeric(5,2),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(255),
    updated_by character varying(255),
    requestable boolean,
    target_audience_summary text,
    request_channel_type character varying(100),
    request_channel_url character varying(2000),
    approval_required boolean,
    fulfillment_lead_time_text text,
    review_owner_user_id integer,
    consumer_value text,
    portfolio_id bigint,
    lifecycle_stage_code character varying(50),
    review_due_at timestamp with time zone,
    criticality_code character varying(50)
);


--
-- Name: COLUMN service_catalog.is_stub; Type: COMMENT; Schema: data; Owner: -
--

COMMENT ON COLUMN data.service_catalog.is_stub IS 'D4: Placeholder for external refs and parent stubs. Hidden in UI (WHERE is_stub = FALSE).';


--
-- Name: service_catalog_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.service_catalog ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.service_catalog_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: service_catalog_source; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.service_catalog_source (
    service_catalog_id bigint NOT NULL,
    source_local_id character varying(100),
    source_sp_id integer,
    source_etag character varying(255),
    created_at_source timestamp with time zone,
    modified_at_source timestamp with time zone,
    is_available_status_ambiguous boolean DEFAULT false NOT NULL,
    raw_fields jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TABLE service_catalog_source; Type: COMMENT; Schema: data; Owner: -
--

COMMENT ON TABLE data.service_catalog_source IS 'Import provenance of a catalogue service: source identifiers and raw imported fields (raw_fields keys = former service_catalog column names).';


--
-- Name: COLUMN service_catalog_source.is_available_status_ambiguous; Type: COMMENT; Schema: data; Owner: -
--

COMMENT ON COLUMN data.service_catalog_source.is_available_status_ambiguous IS 'TRUE when "Not Available" was mapped to planned during import.';


--
-- Name: service_flavour; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.service_flavour (
    id bigint NOT NULL,
    service_id bigint NOT NULL,
    flavour_code character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    service_unit character varying(100),
    price_value numeric(18,2),
    currency_code character varying(10) DEFAULT 'EUR'::character varying,
    billing_period_code character varying(30),
    initiation_cost numeric(18,2),
    lifecycle_cost numeric(18,2),
    lifetime_years integer,
    nations_rate text,
    dependency_text text,
    short_note text,
    pricing_note_raw text,
    delivery_note text,
    technical_note text,
    flavour_status_code character varying(50),
    display_order integer,
    is_orderable boolean DEFAULT true NOT NULL,
    source_local_id character varying(100),
    is_deleted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: service_flavour_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.service_flavour ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.service_flavour_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: service_offering; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.service_offering (
    id bigint NOT NULL,
    service_id bigint NOT NULL,
    offering_code character varying(100) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    is_default boolean DEFAULT false NOT NULL,
    requestable boolean,
    approval_required boolean,
    request_channel_type character varying(100),
    request_channel_url character varying(2000),
    lead_time_text text,
    support_tier_code character varying(50),
    status character varying(50) DEFAULT 'draft'::character varying NOT NULL,
    display_order integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: COLUMN service_offering.requestable; Type: COMMENT; Schema: data; Owner: -
--

COMMENT ON COLUMN data.service_offering.requestable IS 'NULL = inherit service_catalog.requestable; see v_service_offering_effective.';


--
-- Name: service_offering_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.service_offering ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.service_offering_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: service_operational_link; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.service_operational_link (
    id bigint NOT NULL,
    service_id bigint NOT NULL,
    offering_id bigint,
    link_type character varying(100),
    title character varying(255) NOT NULL,
    url character varying(2000) NOT NULL,
    sort_order integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: service_operational_link_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.service_operational_link ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.service_operational_link_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: service_portfolio; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.service_portfolio (
    id bigint NOT NULL,
    portfolio_code character varying(100) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    status_code character varying(50) DEFAULT 'active'::character varying NOT NULL,
    owner_group_id integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: service_portfolio_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.service_portfolio ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.service_portfolio_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: service_raw_field; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.service_raw_field (
    id bigint NOT NULL,
    service_id bigint NOT NULL,
    field_name character varying(100) NOT NULL,
    raw_value text,
    parsed_value text,
    parse_status character varying(50),
    parser_version character varying(50),
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: service_raw_field_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.service_raw_field ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.service_raw_field_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: service_relation; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.service_relation (
    id bigint NOT NULL,
    from_service_id bigint NOT NULL,
    to_service_id bigint NOT NULL,
    relation_type_code character varying(50) NOT NULL,
    pace_code character varying(10),
    pace_code_normalized character varying(10) GENERATED ALWAYS AS (COALESCE(pace_code, 'NONE'::character varying)) STORED,
    is_mandatory boolean DEFAULT true NOT NULL,
    impact_mode character varying(30) DEFAULT 'hard_stop'::character varying NOT NULL,
    impact_level character varying(20) DEFAULT 'high'::character varying NOT NULL,
    relation_label character varying(255),
    relation_note text,
    source_field character varying(100),
    raw_text text,
    parse_confidence numeric(5,4),
    is_inferred boolean DEFAULT false NOT NULL,
    is_verified boolean DEFAULT false NOT NULL,
    valid_from timestamp with time zone,
    valid_to timestamp with time zone,
    source_local_id character varying(100),
    source_sp_id integer,
    source_etag character varying(255),
    is_deleted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(255),
    CONSTRAINT chk_service_relation_no_self_loop CHECK ((from_service_id <> to_service_id))
);


--
-- Name: service_relation_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.service_relation ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.service_relation_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: service_relation_raw; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.service_relation_raw (
    id bigint NOT NULL,
    service_id bigint NOT NULL,
    source_field character varying(100) NOT NULL,
    raw_value text NOT NULL,
    parser_version character varying(50),
    parsed_ok boolean DEFAULT false NOT NULL,
    parsed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: service_relation_raw_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.service_relation_raw ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.service_relation_raw_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: service_role_assignment; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.service_role_assignment (
    id bigint NOT NULL,
    service_id bigint NOT NULL,
    role_code character varying(50) NOT NULL,
    display_name character varying(255) NOT NULL,
    email character varying(255),
    organization_name character varying(255),
    valid_from timestamp with time zone,
    valid_to timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: service_role_assignment_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.service_role_assignment ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.service_role_assignment_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: service_sla; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.service_sla (
    id bigint NOT NULL,
    service_id bigint NOT NULL,
    flavour_id bigint,
    support_window_code character varying(50),
    availability_pct numeric(5,2),
    restoration_hours integer,
    delivery_days integer,
    priority_model_raw text,
    sla_note_raw text,
    source_field character varying(100),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    restoration_text text,
    delivery_text text
);


--
-- Name: service_sla_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.service_sla ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.service_sla_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: service_support_model; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.service_support_model (
    id bigint NOT NULL,
    service_id bigint NOT NULL,
    offering_id bigint,
    support_owner_name character varying(255),
    resolver_group character varying(255),
    support_hours_code character varying(50),
    support_channel character varying(255),
    escalation_path text,
    maintenance_window text,
    review_cadence character varying(100),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: service_support_model_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.service_support_model ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.service_support_model_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: taxonomy_mapping_audit; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.taxonomy_mapping_audit (
    id bigint NOT NULL,
    service_id bigint NOT NULL,
    c3_uuid character varying(100),
    mapping_id bigint,
    action_type character varying(30) NOT NULL,
    changed_by character varying(200),
    old_values_json text,
    new_values_json text,
    changed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: taxonomy_mapping_audit_archive; Type: TABLE; Schema: data; Owner: -
--

CREATE TABLE data.taxonomy_mapping_audit_archive (
    archived_at timestamp with time zone,
    retention_job_audit_id bigint,
    id bigint,
    service_id bigint,
    c3_uuid character varying(100),
    mapping_id bigint,
    action_type character varying(30),
    changed_by character varying(200),
    old_values_json text,
    new_values_json text,
    changed_at timestamp with time zone
);


--
-- Name: taxonomy_mapping_audit_id_seq; Type: SEQUENCE; Schema: data; Owner: -
--

ALTER TABLE data.taxonomy_mapping_audit ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME data.taxonomy_mapping_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: v_auditretentionpolicy; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_auditretentionpolicy AS
 SELECT policy_key,
    target_table,
    retention_days,
    archive_after_days,
    is_active,
    updated_at
   FROM data.audit_retention_policy
  WHERE (is_active = true);


--
-- Name: v_c3_board_lane; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_c3_board_lane AS
 SELECT c.uuid,
    c.title,
    c.item_type,
    c.external_id,
    c.item_status,
    COALESCE(bs.board_state, (
        CASE
            WHEN (lower((COALESCE(c.item_status, c.ss_overall_status, c.ss_baseline_status, ''::character varying))::text) = ANY (ARRAY['reviewed'::text, 'approved'::text, 'baselined'::text])) THEN 'reviewed'::text
            WHEN (EXISTS ( SELECT 1
               FROM (data.service_c3_mapping scm
                 JOIN data.service_catalog sc ON ((sc.id = scm.service_id)))
              WHERE (((scm.c3_uuid)::text = (c.uuid)::text) AND (sc.is_deleted = false) AND ((sc.lifecycle_stage_code)::text = 'active'::text)))) THEN 'used'::text
            WHEN (EXISTS ( SELECT 1
               FROM data.service_c3_mapping scm
              WHERE ((scm.c3_uuid)::text = (c.uuid)::text))) THEN 'mapped'::text
            WHEN (COALESCE(NULLIF(btrim((c.item_status)::text), ''::text), NULLIF(btrim((c.ss_overall_status)::text), ''::text), NULLIF(btrim((c.ss_baseline_status)::text), ''::text)) IS NOT NULL) THEN 'validated'::text
            ELSE 'imported'::text
        END)::character varying) AS board_state,
    COALESCE(bs.validation_status, (NULLIF(btrim((c.item_status)::text), ''::text))::character varying, (NULLIF(btrim((c.ss_overall_status)::text), ''::text))::character varying, (NULLIF(btrim((c.ss_baseline_status)::text), ''::text))::character varying) AS validation_status,
    bs.board_state_reason,
    bs.reviewed_at,
    bs.reviewed_by,
    COALESCE(bs.updated_at, c.synced_at, c.modification_date, CURRENT_TIMESTAMP) AS updated_at
   FROM (data.c3_taxonomy c
     LEFT JOIN data.c3_board_state bs ON (((bs.c3_uuid)::text = (c.uuid)::text)));


--
-- Name: v_c3_entity_link; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_c3_entity_link AS
 SELECT 'capability_application'::character varying(40) AS link_kind,
    'capability'::character varying(20) AS source_kind,
    l.capability_uuid AS source_uuid,
    NULL::bigint AS source_id,
    'application'::character varying(20) AS target_kind,
    app.id AS target_id,
    app.uuid AS target_uuid,
    app.application_code AS target_code,
    app.title AS target_title,
    app.item_status AS target_item_status,
    l.link_role
   FROM (data.c3_capability_application_link l
     JOIN data.c3_application app ON ((app.id = l.c3_application_id)))
UNION ALL
 SELECT 'capability_data_object'::character varying AS link_kind,
    'capability'::character varying AS source_kind,
    l.capability_uuid AS source_uuid,
    NULL::bigint AS source_id,
    'data_object'::character varying AS target_kind,
    dob.id AS target_id,
    dob.uuid AS target_uuid,
    dob.data_object_code AS target_code,
    dob.title AS target_title,
    dob.item_status AS target_item_status,
    l.link_role
   FROM (data.c3_capability_data_object_link l
     JOIN data.c3_data_object dob ON ((dob.id = l.c3_data_object_id)))
UNION ALL
 SELECT 'capability_tin'::character varying AS link_kind,
    'capability'::character varying AS source_kind,
    l.capability_uuid AS source_uuid,
    NULL::bigint AS source_id,
    'tin'::character varying AS target_kind,
    tin.id AS target_id,
    tin.uuid AS target_uuid,
    tin.technology_interaction_code AS target_code,
    tin.title AS target_title,
    tin.item_status AS target_item_status,
    l.link_role
   FROM (data.c3_capability_tin_link l
     JOIN data.c3_technology_interaction tin ON ((tin.id = l.c3_tin_id)))
UNION ALL
 SELECT 'capability_c3_service'::character varying AS link_kind,
    'capability'::character varying AS source_kind,
    l.capability_uuid AS source_uuid,
    NULL::bigint AS source_id,
    'c3_service'::character varying AS target_kind,
    svc.id AS target_id,
    svc.uuid AS target_uuid,
    svc.service_code AS target_code,
    svc.title AS target_title,
    svc.item_status AS target_item_status,
    l.link_role
   FROM (data.c3_capability_c3_service_link l
     JOIN data.c3_service svc ON ((svc.id = l.c3_service_id)))
UNION ALL
 SELECT 'tin_application'::character varying AS link_kind,
    'tin'::character varying AS source_kind,
    ti.uuid AS source_uuid,
    ti.id AS source_id,
    'application'::character varying AS target_kind,
    app.id AS target_id,
    app.uuid AS target_uuid,
    app.application_code AS target_code,
    app.title AS target_title,
    app.item_status AS target_item_status,
    l.source_slot AS link_role
   FROM ((data.c3_technology_interaction_application_link l
     JOIN data.c3_technology_interaction ti ON ((ti.id = l.technology_interaction_id)))
     JOIN data.c3_application app ON ((app.id = l.c3_application_id)))
UNION ALL
 SELECT 'tin_data_object'::character varying AS link_kind,
    'tin'::character varying AS source_kind,
    ti.uuid AS source_uuid,
    ti.id AS source_id,
    'data_object'::character varying AS target_kind,
    dob.id AS target_id,
    dob.uuid AS target_uuid,
    dob.data_object_code AS target_code,
    dob.title AS target_title,
    dob.item_status AS target_item_status,
    l.source_slot AS link_role
   FROM ((data.c3_technology_interaction_data_object_link l
     JOIN data.c3_technology_interaction ti ON ((ti.id = l.technology_interaction_id)))
     JOIN data.c3_data_object dob ON ((dob.id = l.c3_data_object_id)))
UNION ALL
 SELECT 'tin_c3_service'::character varying AS link_kind,
    'tin'::character varying AS source_kind,
    ti.uuid AS source_uuid,
    ti.id AS source_id,
    'c3_service'::character varying AS target_kind,
    svc.id AS target_id,
    svc.uuid AS target_uuid,
    svc.service_code AS target_code,
    svc.title AS target_title,
    svc.item_status AS target_item_status,
    l.source_slot AS link_role
   FROM ((data.c3_technology_interaction_service_link l
     JOIN data.c3_technology_interaction ti ON ((ti.id = l.technology_interaction_id)))
     JOIN data.c3_service svc ON ((svc.id = l.c3_service_id)));


--
-- Name: VIEW v_c3_entity_link; Type: COMMENT; Schema: data; Owner: -
--

COMMENT ON VIEW data.v_c3_entity_link IS 'Unified read model over the seven C3 link tables; link_kind matches graph edge_kind.';


--
-- Name: v_c3_entity_membership_matrix; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_c3_entity_membership_matrix AS
 SELECT entity_kind,
    entity_uuid,
    bool_or(((spiral_code)::text = 'Spiral_4'::text)) AS in_spiral_4,
    bool_or(((spiral_code)::text = 'Spiral_5'::text)) AS in_spiral_5,
    bool_or(((spiral_code)::text = 'Spiral_6'::text)) AS in_spiral_6,
    bool_or(((spiral_code)::text = 'Spiral_7'::text)) AS in_spiral_7,
    array_agg(spiral_code ORDER BY spiral_code) AS spiral_codes,
    max(updated_at) AS last_membership_update
   FROM data.c3_entity_spiral_membership
  GROUP BY entity_kind, entity_uuid;


--
-- Name: v_c3applicationexport; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_c3applicationexport AS
 SELECT id,
    application_code,
    uuid,
    modification_date,
    order_num,
    ss_overall_status,
    ss_baseline_status,
    item_status,
    data_source,
    external_id,
    data_qualifier,
    title,
    source_description,
    revised_description,
    description,
    revised,
    raw_json,
    synced_at,
    created_at,
    updated_at
   FROM data.c3_application;


--
-- Name: v_c3applicationlist; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_c3applicationlist AS
 SELECT id,
    application_code,
    uuid,
    modification_date,
    order_num,
    ss_overall_status,
    ss_baseline_status,
    item_status,
    data_source,
    external_id,
    data_qualifier,
    title,
    source_description,
    revised_description,
    description,
    revised,
    synced_at,
    updated_at
   FROM data.c3_application;


--
-- Name: v_c3capabilityapplicationlinkexport; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_c3capabilityapplicationlinkexport AS
 SELECT id,
    capability_uuid,
    c3_application_id,
    link_role,
    created_at,
    created_by
   FROM data.c3_capability_application_link;


--
-- Name: v_c3capabilitybuilderdomain; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_c3capabilitybuilderdomain AS
 SELECT code,
    css_class,
    heading_color,
    background_color,
    label,
    sort_order,
    is_active
   FROM data.ref_c3_capability_domain
  WHERE (is_active = true);


--
-- Name: v_c3capabilitybuilderlist; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_c3capabilitybuilderlist AS
 SELECT b.id,
    b.page_id,
    b.uuid,
    b.title,
    b.parent_id,
    parent.title AS parent_title,
    b.level,
    b.state,
    b.domain_code,
    d.css_class,
    d.heading_color,
    d.background_color,
    d.label AS domain_label,
    d.sort_order AS domain_order,
    b.created_at,
    b.updated_at
   FROM ((data.c3_capability_builder b
     JOIN data.ref_c3_capability_domain d ON (((d.code)::text = (b.domain_code)::text)))
     LEFT JOIN data.c3_capability_builder parent ON (((parent.page_id)::text = (b.parent_id)::text)))
  WHERE (d.is_active = true);


--
-- Name: v_c3capabilityc3servicelinkexport; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_c3capabilityc3servicelinkexport AS
 SELECT id,
    capability_uuid,
    c3_service_id,
    link_role,
    created_at,
    created_by
   FROM data.c3_capability_c3_service_link;


--
-- Name: v_c3capabilitycompleteness; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_c3capabilitycompleteness AS
 SELECT c.uuid,
    c.external_id,
    c.title,
    c.item_type,
    c.item_status,
    COALESCE(app.cnt, (0)::bigint) AS app_count,
    COALESCE(do_.cnt, (0)::bigint) AS data_object_count,
    COALESCE(tin.cnt, (0)::bigint) AS tin_count,
    COALESCE(svc.cnt, (0)::bigint) AS c3_service_count,
    COALESCE(scm.cnt, (0)::bigint) AS service_mapping_count,
        CASE
            WHEN (COALESCE(app.cnt, (0)::bigint) > 0) THEN true
            ELSE false
        END AS has_app,
        CASE
            WHEN (COALESCE(do_.cnt, (0)::bigint) > 0) THEN true
            ELSE false
        END AS has_data_object,
        CASE
            WHEN (COALESCE(tin.cnt, (0)::bigint) > 0) THEN true
            ELSE false
        END AS has_tin,
        CASE
            WHEN (COALESCE(svc.cnt, (0)::bigint) > 0) THEN true
            ELSE false
        END AS has_c3_service,
        CASE
            WHEN (COALESCE(scm.cnt, (0)::bigint) > 0) THEN true
            ELSE false
        END AS has_service_mapping,
        CASE
            WHEN ((COALESCE(app.cnt, (0)::bigint) > 0) AND (COALESCE(do_.cnt, (0)::bigint) > 0) AND (COALESCE(tin.cnt, (0)::bigint) > 0)) THEN 'complete'::text
            WHEN (((((COALESCE(app.cnt, (0)::bigint) + COALESCE(do_.cnt, (0)::bigint)) + COALESCE(tin.cnt, (0)::bigint)) + COALESCE(svc.cnt, (0)::bigint)) + COALESCE(scm.cnt, (0)::bigint)) > 0) THEN 'partial'::text
            ELSE 'incomplete'::text
        END AS completeness_status
   FROM (((((data.c3_taxonomy c
     LEFT JOIN ( SELECT c3_capability_application_link.capability_uuid,
            count(*) AS cnt
           FROM data.c3_capability_application_link
          GROUP BY c3_capability_application_link.capability_uuid) app ON (((app.capability_uuid)::text = (c.uuid)::text)))
     LEFT JOIN ( SELECT c3_capability_data_object_link.capability_uuid,
            count(*) AS cnt
           FROM data.c3_capability_data_object_link
          GROUP BY c3_capability_data_object_link.capability_uuid) do_ ON (((do_.capability_uuid)::text = (c.uuid)::text)))
     LEFT JOIN ( SELECT c3_capability_tin_link.capability_uuid,
            count(*) AS cnt
           FROM data.c3_capability_tin_link
          GROUP BY c3_capability_tin_link.capability_uuid) tin ON (((tin.capability_uuid)::text = (c.uuid)::text)))
     LEFT JOIN ( SELECT c3_capability_c3_service_link.capability_uuid,
            count(*) AS cnt
           FROM data.c3_capability_c3_service_link
          GROUP BY c3_capability_c3_service_link.capability_uuid) svc ON (((svc.capability_uuid)::text = (c.uuid)::text)))
     LEFT JOIN ( SELECT service_c3_mapping.c3_uuid,
            count(*) AS cnt
           FROM data.service_c3_mapping
          GROUP BY service_c3_mapping.c3_uuid) scm ON (((scm.c3_uuid)::text = (c.uuid)::text)));


--
-- Name: v_c3capabilitydataobjectlinkexport; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_c3capabilitydataobjectlinkexport AS
 SELECT id,
    capability_uuid,
    c3_data_object_id,
    link_role,
    created_at,
    created_by
   FROM data.c3_capability_data_object_link;


--
-- Name: v_c3capabilitymaphierarchyexport; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_c3capabilitymaphierarchyexport AS
 WITH mapped AS (
         SELECT DISTINCT service_c3_mapping.c3_uuid
           FROM data.service_c3_mapping
          WHERE (service_c3_mapping.c3_uuid IS NOT NULL)
        ), mapping_counts AS (
         SELECT service_c3_mapping.c3_uuid,
            count(*) AS mapping_count
           FROM data.service_c3_mapping
          WHERE (service_c3_mapping.c3_uuid IS NOT NULL)
          GROUP BY service_c3_mapping.c3_uuid
        )
 SELECT c.uuid,
    c.external_id,
    c.title,
    c.item_type,
    c.application,
    c.item_status,
    c.parent_uuid,
    c.parent_code,
    p.title AS parent_title,
    p.external_id AS parent_external_id,
        CASE
            WHEN (m.c3_uuid IS NULL) THEN false
            ELSE true
        END AS is_mapped,
    COALESCE(mc.mapping_count, (0)::bigint) AS mapping_count,
    c.order_num,
    c.synced_at
   FROM (((data.c3_taxonomy c
     LEFT JOIN data.c3_taxonomy p ON (((p.uuid)::text = (c.parent_uuid)::text)))
     LEFT JOIN mapped m ON (((m.c3_uuid)::text = (c.uuid)::text)))
     LEFT JOIN mapping_counts mc ON (((mc.c3_uuid)::text = (c.uuid)::text)));


--
-- Name: v_c3capabilitytinlinkexport; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_c3capabilitytinlinkexport AS
 SELECT id,
    capability_uuid,
    c3_tin_id,
    link_role,
    created_at,
    created_by
   FROM data.c3_capability_tin_link;


--
-- Name: v_c3dashboardsummary; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_c3dashboardsummary AS
 WITH mapped AS (
         SELECT DISTINCT service_c3_mapping.c3_uuid
           FROM data.service_c3_mapping
          WHERE (service_c3_mapping.c3_uuid IS NOT NULL)
        ), mapping_counts AS (
         SELECT service_c3_mapping.c3_uuid,
            count(*) AS mapping_count
           FROM data.service_c3_mapping
          WHERE (service_c3_mapping.c3_uuid IS NOT NULL)
          GROUP BY service_c3_mapping.c3_uuid
        )
 SELECT count(*) AS total_items,
    sum(
        CASE
            WHEN (m.c3_uuid IS NOT NULL) THEN 1
            ELSE 0
        END) AS mapped_items,
    sum(
        CASE
            WHEN (m.c3_uuid IS NULL) THEN 1
            ELSE 0
        END) AS unmapped_items,
    COALESCE(sum(mc.mapping_count), (0)::numeric) AS total_mappings,
    count(DISTINCT c.item_type) AS item_type_count,
    count(DISTINCT c.application) AS application_count
   FROM ((data.c3_taxonomy c
     LEFT JOIN mapped m ON (((m.c3_uuid)::text = (c.uuid)::text)))
     LEFT JOIN mapping_counts mc ON (((mc.c3_uuid)::text = (c.uuid)::text)));


--
-- Name: v_c3dataobjectexport; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_c3dataobjectexport AS
 SELECT id,
    data_object_code,
    uuid,
    modification_date,
    order_num,
    ss_overall_status,
    ss_baseline_status,
    item_status,
    title,
    description,
    provenance_raw,
    references_raw,
    standards_raw,
    raw_json,
    synced_at,
    created_at,
    updated_at
   FROM data.c3_data_object;


--
-- Name: v_c3dataobjectlist; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_c3dataobjectlist AS
 SELECT id,
    data_object_code,
    uuid,
    modification_date,
    order_num,
    ss_overall_status,
    ss_baseline_status,
    item_status,
    title,
    description,
    provenance_raw,
    references_raw,
    standards_raw,
    synced_at,
    updated_at
   FROM data.c3_data_object;


--
-- Name: v_c3entityimportissueexport; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_c3entityimportissueexport AS
 SELECT id,
    run_id,
    row_number,
    severity,
    issue_code,
    field_name,
    raw_value,
    message,
    created_at
   FROM data.c3_entity_import_issue;


--
-- Name: v_c3entityimportrunexport; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_c3entityimportrunexport AS
 SELECT id,
    target_key,
    source_name,
    source_kind,
    is_dry_run,
    row_count,
    ok_count,
    warn_count,
    error_count,
    inserted_count,
    updated_count,
    failed_count,
    created_by,
    notes,
    spiral_code,
    created_at
   FROM data.c3_entity_import_run;


--
-- Name: v_c3entityimportrunlatest; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_c3entityimportrunlatest AS
 WITH ranked AS (
         SELECT c3_entity_import_run.id,
            c3_entity_import_run.target_key,
            c3_entity_import_run.source_name,
            c3_entity_import_run.source_kind,
            c3_entity_import_run.is_dry_run,
            c3_entity_import_run.row_count,
            c3_entity_import_run.ok_count,
            c3_entity_import_run.warn_count,
            c3_entity_import_run.error_count,
            c3_entity_import_run.inserted_count,
            c3_entity_import_run.updated_count,
            c3_entity_import_run.failed_count,
            c3_entity_import_run.created_by,
            c3_entity_import_run.notes,
            c3_entity_import_run.spiral_code,
            c3_entity_import_run.created_at,
            row_number() OVER (PARTITION BY c3_entity_import_run.target_key ORDER BY c3_entity_import_run.created_at DESC, c3_entity_import_run.id DESC) AS rn
           FROM data.c3_entity_import_run
          WHERE (c3_entity_import_run.is_dry_run = false)
        )
 SELECT id,
    target_key,
    source_name,
    source_kind,
    is_dry_run,
    row_count,
    ok_count,
    warn_count,
    error_count,
    inserted_count,
    updated_count,
    failed_count,
    created_by,
    notes,
    spiral_code,
    created_at
   FROM ranked
  WHERE (rn = 1);


--
-- Name: v_c3relationshipexport; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_c3relationshipexport AS
 SELECT 'c3'::text AS source_kind,
    parent.uuid AS source_id,
    COALESCE(parent.title, parent.external_id, parent.uuid) AS source_label,
    'c3'::text AS target_kind,
    child.uuid AS target_id,
    COALESCE(child.title, child.external_id, child.uuid) AS target_label,
    'parent_child'::text AS edge_kind,
    NULL::character varying(50) AS mapping_type_code,
    false AS is_primary
   FROM (data.c3_taxonomy child
     JOIN data.c3_taxonomy parent ON (((parent.uuid)::text = (child.parent_uuid)::text)))
UNION ALL
 SELECT 'service'::text AS source_kind,
    sc.service_id AS source_id,
    COALESCE(sc.title, sc.service_id) AS source_label,
    'c3'::text AS target_kind,
    scm.c3_uuid AS target_id,
    COALESCE(c.title, c.external_id, scm.c3_uuid) AS target_label,
    'service_mapping'::text AS edge_kind,
    scm.mapping_type_code,
    scm.is_primary
   FROM ((data.service_c3_mapping scm
     JOIN data.service_catalog sc ON (((sc.id = scm.service_id) AND (sc.is_deleted = false))))
     LEFT JOIN data.c3_taxonomy c ON (((c.uuid)::text = (scm.c3_uuid)::text)));


--
-- Name: v_c3serviceexport; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_c3serviceexport AS
 SELECT id,
    service_code,
    uuid,
    modification_date,
    order_num,
    ss_overall_status,
    ss_baseline_status,
    item_status,
    data_source,
    external_id,
    data_qualifier,
    title,
    source_description,
    revised_description,
    description,
    revised,
    raw_json,
    synced_at,
    created_at,
    updated_at
   FROM data.c3_service;


--
-- Name: v_c3servicelist; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_c3servicelist AS
 SELECT id,
    service_code,
    uuid,
    modification_date,
    order_num,
    ss_overall_status,
    ss_baseline_status,
    item_status,
    data_source,
    external_id,
    data_qualifier,
    title,
    source_description,
    revised_description,
    description,
    revised,
    synced_at,
    updated_at
   FROM data.c3_service;


--
-- Name: v_c3technologyinteractionapplicationlinkexport; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_c3technologyinteractionapplicationlinkexport AS
 SELECT id,
    technology_interaction_id,
    c3_application_id,
    source_slot,
    ref_value,
    created_at
   FROM data.c3_technology_interaction_application_link;


--
-- Name: v_c3technologyinteractiondataobjectlinkexport; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_c3technologyinteractiondataobjectlinkexport AS
 SELECT id,
    technology_interaction_id,
    c3_data_object_id,
    source_slot,
    ref_value,
    created_at
   FROM data.c3_technology_interaction_data_object_link;


--
-- Name: v_c3technologyinteractionexport; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_c3technologyinteractionexport AS
 SELECT id,
    technology_interaction_code,
    uuid,
    modification_date,
    order_num,
    ss_overall_status,
    ss_baseline_status,
    item_status,
    ciav_review_status,
    mcsma_review_status,
    service_instructions,
    title,
    technology_interaction_type,
    technology_interaction_maturity,
    technology_interactions_1_raw,
    description,
    conditionality,
    services_1_raw,
    applications_1_raw,
    services_2_raw,
    technology_interactions_2_raw,
    technology_interactions_3_raw,
    services_3_raw,
    applications_2_raw,
    data_objects_raw,
    raw_json,
    synced_at,
    created_at,
    updated_at
   FROM data.c3_technology_interaction;


--
-- Name: v_c3technologyinteractionlinkreport; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_c3technologyinteractionlinkreport AS
 WITH service_raw AS (
         SELECT ti_1.id,
            btrim(value.value) AS ref_value
           FROM (data.c3_technology_interaction ti_1
             CROSS JOIN LATERAL regexp_split_to_table(regexp_replace(concat_ws(','::text, ti_1.services_1_raw, ti_1.services_2_raw, ti_1.services_3_raw), '[\r\n;]+'::text, ','::text, 'g'::text), ','::text) value(value))
          WHERE (btrim(value.value) <> ''::text)
        ), application_raw AS (
         SELECT ti_1.id,
            btrim(value.value) AS ref_value
           FROM (data.c3_technology_interaction ti_1
             CROSS JOIN LATERAL regexp_split_to_table(regexp_replace(concat_ws(','::text, ti_1.applications_1_raw, ti_1.applications_2_raw), '[\r\n;]+'::text, ','::text, 'g'::text), ','::text) value(value))
          WHERE (btrim(value.value) <> ''::text)
        ), data_object_raw AS (
         SELECT ti_1.id,
            btrim(value.value) AS ref_value
           FROM (data.c3_technology_interaction ti_1
             CROSS JOIN LATERAL regexp_split_to_table(regexp_replace(COALESCE(ti_1.data_objects_raw, ''::text), '[\r\n;]+'::text, ','::text, 'g'::text), ','::text) value(value))
          WHERE (btrim(value.value) <> ''::text)
        ), service_agg AS (
         SELECT r.id,
            count(*) AS service_ref_count,
            count(s.id) AS matched_service_count,
            string_agg(
                CASE
                    WHEN (s.id IS NULL) THEN r.ref_value
                    ELSE NULL::text
                END, ', '::text ORDER BY r.ref_value) AS unresolved_service_refs
           FROM (service_raw r
             LEFT JOIN data.c3_service s ON ((((s.service_code)::text = r.ref_value) OR ((s.uuid)::text = r.ref_value))))
          GROUP BY r.id
        ), application_agg AS (
         SELECT r.id,
            count(*) AS application_ref_count,
            count(a.id) AS matched_application_count,
            string_agg(
                CASE
                    WHEN (a.id IS NULL) THEN r.ref_value
                    ELSE NULL::text
                END, ', '::text ORDER BY r.ref_value) AS unresolved_application_refs
           FROM (application_raw r
             LEFT JOIN data.c3_application a ON ((((a.application_code)::text = r.ref_value) OR ((a.uuid)::text = r.ref_value))))
          GROUP BY r.id
        ), data_object_agg AS (
         SELECT r.id,
            count(*) AS data_object_ref_count,
            count(d.id) AS matched_data_object_count,
            string_agg(
                CASE
                    WHEN (d.id IS NULL) THEN r.ref_value
                    ELSE NULL::text
                END, ', '::text ORDER BY r.ref_value) AS unresolved_data_object_refs
           FROM (data_object_raw r
             LEFT JOIN data.c3_data_object d ON ((((d.data_object_code)::text = r.ref_value) OR ((d.uuid)::text = r.ref_value))))
          GROUP BY r.id
        ), service_links AS (
         SELECT l.technology_interaction_id AS id,
            (jsonb_agg(jsonb_build_object('id', s.id, 'code', s.service_code, 'uuid', s.uuid, 'title', s.title) ORDER BY s.service_code))::text AS linked_services_json
           FROM (data.c3_technology_interaction_service_link l
             JOIN data.c3_service s ON ((s.id = l.c3_service_id)))
          GROUP BY l.technology_interaction_id
        ), application_links AS (
         SELECT l.technology_interaction_id AS id,
            (jsonb_agg(jsonb_build_object('id', a.id, 'code', a.application_code, 'uuid', a.uuid, 'title', a.title) ORDER BY a.application_code))::text AS linked_applications_json
           FROM (data.c3_technology_interaction_application_link l
             JOIN data.c3_application a ON ((a.id = l.c3_application_id)))
          GROUP BY l.technology_interaction_id
        ), data_object_links AS (
         SELECT l.technology_interaction_id AS id,
            (jsonb_agg(jsonb_build_object('id', d.id, 'code', d.data_object_code, 'uuid', d.uuid, 'title', d.title) ORDER BY d.data_object_code))::text AS linked_data_objects_json
           FROM (data.c3_technology_interaction_data_object_link l
             JOIN data.c3_data_object d ON ((d.id = l.c3_data_object_id)))
          GROUP BY l.technology_interaction_id
        )
 SELECT ti.id,
    ti.technology_interaction_code,
    ti.uuid,
    ti.title,
    ti.item_status,
    ti.technology_interaction_type,
    ti.technology_interaction_maturity,
    COALESCE(sa.service_ref_count, (0)::bigint) AS service_ref_count,
    COALESCE(sa.matched_service_count, (0)::bigint) AS matched_service_count,
    sl.linked_services_json,
    sa.unresolved_service_refs,
    COALESCE(aa.application_ref_count, (0)::bigint) AS application_ref_count,
    COALESCE(aa.matched_application_count, (0)::bigint) AS matched_application_count,
    al.linked_applications_json,
    aa.unresolved_application_refs,
    COALESCE(da.data_object_ref_count, (0)::bigint) AS data_object_ref_count,
    COALESCE(da.matched_data_object_count, (0)::bigint) AS matched_data_object_count,
    dl.linked_data_objects_json,
    da.unresolved_data_object_refs,
    ti.synced_at,
    ti.updated_at
   FROM ((((((data.c3_technology_interaction ti
     LEFT JOIN service_agg sa ON ((sa.id = ti.id)))
     LEFT JOIN service_links sl ON ((sl.id = ti.id)))
     LEFT JOIN application_agg aa ON ((aa.id = ti.id)))
     LEFT JOIN application_links al ON ((al.id = ti.id)))
     LEFT JOIN data_object_agg da ON ((da.id = ti.id)))
     LEFT JOIN data_object_links dl ON ((dl.id = ti.id)));


--
-- Name: v_c3technologyinteractionlist; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_c3technologyinteractionlist AS
 SELECT ti.id,
    ti.technology_interaction_code,
    ti.uuid,
    ti.modification_date,
    ti.order_num,
    ti.ss_overall_status,
    ti.ss_baseline_status,
    ti.item_status,
    ti.ciav_review_status,
    ti.mcsma_review_status,
    ti.service_instructions,
    ti.title,
    ti.technology_interaction_type,
    ti.technology_interaction_maturity,
    ti.technology_interactions_1_raw,
    ti.description,
    ti.conditionality,
    ti.services_1_raw,
    ti.applications_1_raw,
    ti.services_2_raw,
    ti.technology_interactions_2_raw,
    ti.technology_interactions_3_raw,
    ti.services_3_raw,
    ti.applications_2_raw,
    ti.data_objects_raw,
    lr.matched_service_count,
    lr.matched_application_count,
    lr.matched_data_object_count,
    lr.linked_services_json,
    lr.linked_applications_json,
    lr.linked_data_objects_json,
    lr.unresolved_service_refs,
    lr.unresolved_application_refs,
    lr.unresolved_data_object_refs,
    ti.synced_at,
    ti.updated_at
   FROM (data.c3_technology_interaction ti
     LEFT JOIN data.v_c3technologyinteractionlinkreport lr ON ((lr.id = ti.id)));


--
-- Name: v_c3technologyinteractionservicelinkexport; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_c3technologyinteractionservicelinkexport AS
 SELECT id,
    technology_interaction_id,
    c3_service_id,
    source_slot,
    ref_value,
    created_at
   FROM data.c3_technology_interaction_service_link;


--
-- Name: v_capability_requirement; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_capability_requirement AS
 SELECT l.capability_uuid,
    'application'::text AS entity_kind,
    a.uuid AS entity_uuid,
    a.application_code AS code,
    a.title,
    l.link_role
   FROM (data.c3_capability_application_link l
     JOIN data.c3_application a ON ((a.id = l.c3_application_id)))
UNION ALL
 SELECT l.capability_uuid,
    'data_object'::text AS entity_kind,
    d.uuid AS entity_uuid,
    d.data_object_code AS code,
    d.title,
    l.link_role
   FROM (data.c3_capability_data_object_link l
     JOIN data.c3_data_object d ON ((d.id = l.c3_data_object_id)))
UNION ALL
 SELECT l.capability_uuid,
    'technology_interaction'::text AS entity_kind,
    t.uuid AS entity_uuid,
    t.technology_interaction_code AS code,
    t.title,
    l.link_role
   FROM (data.c3_capability_tin_link l
     JOIN data.c3_technology_interaction t ON ((t.id = l.c3_tin_id)))
UNION ALL
 SELECT l.capability_uuid,
    'c3_service'::text AS entity_kind,
    s.uuid AS entity_uuid,
    s.service_code AS code,
    s.title,
    l.link_role
   FROM (data.c3_capability_c3_service_link l
     JOIN data.c3_service s ON ((s.id = l.c3_service_id)));


--
-- Name: v_capability_gap_evidence; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_capability_gap_evidence AS
 SELECT r.capability_uuid,
    m.spiral_code,
    r.entity_kind,
    r.entity_uuid,
    1 AS evidence_count,
    1 AS source_document_count
   FROM (data.v_capability_requirement r
     JOIN data.c3_entity_spiral_membership m ON ((((m.entity_uuid)::text = (r.entity_uuid)::text) AND ((m.entity_kind)::text = r.entity_kind) AND ((m.status_in_spiral)::text IS DISTINCT FROM 'removed'::text))));


--
-- Name: v_servicepublishreadiness; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_servicepublishreadiness AS
 WITH active_flavours AS (
         SELECT sf.service_id,
            count(*) AS active_flavour_count
           FROM data.service_flavour sf
          WHERE ((sf.is_deleted = false) AND (lower((COALESCE(sf.flavour_status_code, ''::character varying))::text) = ANY (ARRAY['available'::text, 'active'::text])))
          GROUP BY sf.service_id
        ), relation_counts AS (
         SELECT sc_1.id AS service_id,
            count(sr.id) AS relation_count,
            sum(
                CASE
                    WHEN ((sr.relation_type_code)::text = ANY ((ARRAY['depends_on'::character varying, 'prerequisite'::character varying, 'underlying'::character varying, 'requires_account'::character varying, 'uses'::character varying])::text[])) THEN 1
                    ELSE 0
                END) AS dependency_relation_count
           FROM (data.service_catalog sc_1
             LEFT JOIN data.service_relation sr ON (((sr.is_deleted = false) AND ((sr.from_service_id = sc_1.id) OR (sr.to_service_id = sc_1.id)))))
          WHERE (sc_1.is_deleted = false)
          GROUP BY sc_1.id
        ), primary_mapping AS (
         SELECT scm.service_id,
            count(*) AS primary_mapping_count,
            max((
                CASE
                    WHEN (scm.is_primary = true) THEN scm.c3_uuid
                    ELSE NULL::character varying
                END)::text) AS primary_c3_uuid
           FROM (data.service_c3_mapping scm
             JOIN data.service_catalog sc_1 ON (((sc_1.id = scm.service_id) AND (sc_1.is_deleted = false))))
          WHERE (scm.is_primary = true)
          GROUP BY scm.service_id
        )
 SELECT sc.id AS service_pk,
    sc.service_id,
    sc.title,
    data.fn_service_status_code((sc.lifecycle_stage_code)::text, sc.is_stub) AS service_status,
    pm.primary_mapping_count,
    pm.primary_c3_uuid,
    cap.title AS primary_c3_title,
    cap.external_id AS primary_c3_code,
    comp.completeness_status AS primary_c3_completeness_status,
    comp.app_count AS primary_c3_app_count,
    comp.data_object_count AS primary_c3_data_object_count,
    comp.tin_count AS primary_c3_tin_count,
    comp.c3_service_count AS primary_c3_c3_service_count,
    comp.service_mapping_count AS primary_c3_service_mapping_count,
    COALESCE(af.active_flavour_count, (0)::bigint) AS active_flavour_count,
    COALESCE(rc.relation_count, (0)::bigint) AS relation_count,
    COALESCE(rc.dependency_relation_count, (0)::bigint) AS dependency_relation_count,
        CASE
            WHEN ((COALESCE(pm.primary_mapping_count, (0)::bigint) = 1) AND (pm.primary_c3_uuid IS NOT NULL)) THEN true
            ELSE false
        END AS has_single_primary_mapping,
        CASE
            WHEN (comp.completeness_status = 'complete'::text) THEN true
            ELSE false
        END AS has_complete_primary_capability,
        CASE
            WHEN (COALESCE(af.active_flavour_count, (0)::bigint) > 0) THEN true
            ELSE false
        END AS has_active_flavour,
        CASE
            WHEN ((COALESCE(pm.primary_mapping_count, (0)::bigint) = 1) AND (pm.primary_c3_uuid IS NOT NULL) AND (comp.completeness_status = 'complete'::text) AND (COALESCE(af.active_flavour_count, (0)::bigint) > 0)) THEN true
            ELSE false
        END AS is_publishable
   FROM (((((data.service_catalog sc
     LEFT JOIN primary_mapping pm ON ((pm.service_id = sc.id)))
     LEFT JOIN data.c3_taxonomy cap ON (((cap.uuid)::text = pm.primary_c3_uuid)))
     LEFT JOIN data.v_c3capabilitycompleteness comp ON (((comp.uuid)::text = pm.primary_c3_uuid)))
     LEFT JOIN active_flavours af ON ((af.service_id = sc.id)))
     LEFT JOIN relation_counts rc ON ((rc.service_id = sc.id)))
  WHERE ((sc.is_deleted = false) AND (sc.is_stub = false));


--
-- Name: v_capability_governance_mapping; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_capability_governance_mapping AS
 SELECT scm.id AS mapping_id,
    sc.id AS service_pk,
    sc.service_id,
    sc.title AS service_title,
    data.fn_service_status_code((sc.lifecycle_stage_code)::text, sc.is_stub) AS service_status,
    sc.lifecycle_stage_code,
    data.fn_lifecycle_state_from_stage((sc.lifecycle_stage_code)::text) AS lifecycle_state,
    scm.c3_uuid AS capability_uuid,
    ct.external_id AS capability_code,
    ct.title AS capability_title,
    ct.item_type AS capability_item_type,
    parent.uuid AS parent_uuid,
    parent.external_id AS parent_code,
    parent.title AS parent_title,
    parent.abbreviation AS parent_abbreviation,
    COALESCE(m.spiral_code, ct.fmn_spiral) AS spiral_code,
    scm.c3_domain AS mapping_domain,
    scm.mapping_type_code,
    scm.pace_code,
    scm.is_primary,
        CASE
            WHEN ((scm.is_primary = true) OR ((scm.mapping_type_code)::text = 'fully_fulfills'::text)) THEN 'primary'::text
            WHEN ((scm.mapping_type_code)::text = 'supports'::text) THEN 'supporting'::text
            WHEN ((scm.mapping_type_code)::text = 'enables'::text) THEN 'enabling'::text
            ELSE 'dependent'::text
        END AS normalized_role,
    owner.display_name AS owner_name,
    owner.email AS owner_email,
        CASE
            WHEN (COALESCE(readiness.is_publishable, false) = true) THEN 'ready'::text
            ELSE 'blocked'::text
        END AS readiness_state
   FROM ((((((data.service_c3_mapping scm
     JOIN data.service_catalog sc ON (((sc.id = scm.service_id) AND (sc.is_deleted = false) AND (sc.is_stub = false))))
     LEFT JOIN data.c3_taxonomy ct ON (((ct.uuid)::text = (scm.c3_uuid)::text)))
     LEFT JOIN data.c3_taxonomy parent ON (((parent.uuid)::text = (ct.parent_uuid)::text)))
     LEFT JOIN data.c3_entity_spiral_membership m ON ((((m.entity_uuid)::text = (ct.uuid)::text) AND ((m.entity_kind)::text = 'taxonomy'::text) AND ((m.status_in_spiral)::text IS DISTINCT FROM 'removed'::text))))
     LEFT JOIN LATERAL ( SELECT sra.display_name,
            sra.email
           FROM data.service_role_assignment sra
          WHERE ((sra.service_id = sc.id) AND ((sra.role_code)::text = 'service_owner'::text) AND (sra.valid_to IS NULL))
          ORDER BY sra.created_at DESC
         LIMIT 1) owner ON (true))
     LEFT JOIN data.v_servicepublishreadiness readiness ON ((readiness.service_pk = sc.id)))
  WHERE ((ct.item_type)::text = 'CP'::text);


--
-- Name: v_capability_lvl3_coverage; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_capability_lvl3_coverage AS
 WITH requirements AS (
         SELECT r.capability_uuid,
            m.spiral_code,
            r.entity_kind,
            r.entity_uuid
           FROM (data.v_capability_requirement r
             JOIN data.c3_entity_spiral_membership m ON ((((m.entity_uuid)::text = (r.entity_uuid)::text) AND ((m.entity_kind)::text = r.entity_kind) AND ((m.status_in_spiral)::text IS DISTINCT FROM 'removed'::text))))
        ), covered AS (
         SELECT DISTINCT req_1.capability_uuid,
            req_1.spiral_code,
            req_1.entity_kind,
            req_1.entity_uuid
           FROM (requirements req_1
             JOIN data.service_c3_mapping scm ON ((((scm.c3_uuid)::text = (req_1.capability_uuid)::text) OR ((scm.c3_uuid)::text = (req_1.entity_uuid)::text))))
        )
 SELECT req.capability_uuid,
    req.spiral_code,
    (count(DISTINCT ROW(req.entity_kind, req.entity_uuid)))::integer AS total_requirements,
    (count(DISTINCT ROW(covered.entity_kind, covered.entity_uuid)))::integer AS covered_count,
        CASE
            WHEN (count(DISTINCT ROW(req.entity_kind, req.entity_uuid)) = 0) THEN 0
            ELSE (round((((count(DISTINCT ROW(covered.entity_kind, covered.entity_uuid)))::numeric * (100)::numeric) / (count(DISTINCT ROW(req.entity_kind, req.entity_uuid)))::numeric)))::integer
        END AS coverage_percent
   FROM (requirements req
     LEFT JOIN covered ON ((((covered.capability_uuid)::text = (req.capability_uuid)::text) AND ((covered.spiral_code)::text = (req.spiral_code)::text) AND (covered.entity_kind = req.entity_kind) AND ((covered.entity_uuid)::text = (req.entity_uuid)::text))))
  GROUP BY req.capability_uuid, req.spiral_code;


--
-- Name: v_capability_governance_coverage; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_capability_governance_coverage AS
 WITH capabilities AS (
         SELECT c.uuid AS capability_uuid,
            c.external_id AS capability_code,
            c.title AS capability_title,
            c.abbreviation AS capability_abbreviation,
            c.item_status,
            c.level_num,
            parent.uuid AS parent_uuid,
            parent.external_id AS parent_code,
            parent.title AS parent_title,
            parent.abbreviation AS parent_abbreviation,
            COALESCE(m.spiral_code, c.fmn_spiral) AS spiral_code
           FROM ((data.c3_taxonomy c
             LEFT JOIN data.c3_taxonomy parent ON (((parent.uuid)::text = (c.parent_uuid)::text)))
             LEFT JOIN data.c3_entity_spiral_membership m ON ((((m.entity_uuid)::text = (c.uuid)::text) AND ((m.entity_kind)::text = 'taxonomy'::text) AND ((m.status_in_spiral)::text IS DISTINCT FROM 'removed'::text))))
          WHERE (((c.item_type)::text = 'CP'::text) AND (c.level_num = 3))
        ), mapping_counts AS (
         SELECT v_capability_governance_mapping.capability_uuid,
            v_capability_governance_mapping.spiral_code,
            (count(DISTINCT v_capability_governance_mapping.service_pk))::integer AS service_count,
            (count(DISTINCT v_capability_governance_mapping.service_pk) FILTER (WHERE (v_capability_governance_mapping.normalized_role = 'primary'::text)))::integer AS primary_service_count,
            (count(DISTINCT v_capability_governance_mapping.service_pk) FILTER (WHERE (v_capability_governance_mapping.normalized_role = 'supporting'::text)))::integer AS supporting_service_count,
            (count(DISTINCT v_capability_governance_mapping.service_pk) FILTER (WHERE (v_capability_governance_mapping.normalized_role = 'enabling'::text)))::integer AS enabling_service_count,
            (count(DISTINCT v_capability_governance_mapping.service_pk) FILTER (WHERE (v_capability_governance_mapping.normalized_role = 'dependent'::text)))::integer AS dependent_service_count,
            (count(DISTINCT v_capability_governance_mapping.service_pk) FILTER (WHERE (v_capability_governance_mapping.readiness_state = 'ready'::text)))::integer AS ready_service_count,
            (count(DISTINCT v_capability_governance_mapping.service_pk) FILTER (WHERE (v_capability_governance_mapping.readiness_state <> 'ready'::text)))::integer AS blocked_service_count
           FROM data.v_capability_governance_mapping
          GROUP BY v_capability_governance_mapping.capability_uuid, v_capability_governance_mapping.spiral_code
        ), incomplete_primary AS (
         SELECT v_servicepublishreadiness.primary_c3_uuid AS capability_uuid,
            (count(*))::integer AS incomplete_primary_mapping_count
           FROM data.v_servicepublishreadiness
          WHERE ((v_servicepublishreadiness.primary_c3_uuid IS NOT NULL) AND ((v_servicepublishreadiness.has_single_primary_mapping = false) OR (v_servicepublishreadiness.has_complete_primary_capability = false) OR (v_servicepublishreadiness.is_publishable = false)))
          GROUP BY v_servicepublishreadiness.primary_c3_uuid
        )
 SELECT cap.capability_uuid,
    cap.capability_code,
    cap.capability_title,
    cap.capability_abbreviation,
    cap.item_status,
    cap.level_num,
    cap.parent_uuid,
    cap.parent_code,
    cap.parent_title,
    cap.parent_abbreviation,
    cap.spiral_code,
    COALESCE(req.total_requirements, 0) AS total_requirements,
    COALESCE(req.covered_count, 0) AS covered_requirement_count,
    COALESCE(req.coverage_percent,
        CASE
            WHEN (COALESCE(map.service_count, 0) > 0) THEN 100
            ELSE 0
        END) AS coverage_percent,
    COALESCE(map.service_count, 0) AS service_count,
    COALESCE(map.primary_service_count, 0) AS primary_service_count,
    COALESCE(map.supporting_service_count, 0) AS supporting_service_count,
    COALESCE(map.enabling_service_count, 0) AS enabling_service_count,
    COALESCE(map.dependent_service_count, 0) AS dependent_service_count,
    COALESCE(map.ready_service_count, 0) AS ready_service_count,
    COALESCE(map.blocked_service_count, 0) AS blocked_service_count,
    COALESCE(incomplete.incomplete_primary_mapping_count, 0) AS incomplete_primary_mapping_count,
    GREATEST((COALESCE(req.total_requirements, 0) - COALESCE(req.covered_count, 0)), 0) AS gap_count,
        CASE
            WHEN (COALESCE(map.service_count, 0) = 0) THEN 'uncovered'::text
            WHEN (COALESCE(map.service_count, 0) > 1) THEN 'over_covered'::text
            WHEN (COALESCE(map.blocked_service_count, 0) > 0) THEN 'not_ready'::text
            ELSE 'ready'::text
        END AS governance_state
   FROM (((capabilities cap
     LEFT JOIN data.v_capability_lvl3_coverage req ON ((((req.capability_uuid)::text = (cap.capability_uuid)::text) AND (NOT ((req.spiral_code)::text IS DISTINCT FROM (cap.spiral_code)::text)))))
     LEFT JOIN mapping_counts map ON ((((map.capability_uuid)::text = (cap.capability_uuid)::text) AND (NOT ((map.spiral_code)::text IS DISTINCT FROM (cap.spiral_code)::text)))))
     LEFT JOIN incomplete_primary incomplete ON ((incomplete.capability_uuid = (cap.capability_uuid)::text)));


--
-- Name: v_capability_governance_gap; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_capability_governance_gap AS
 SELECT capability_uuid,
    capability_code,
    capability_title,
    parent_title,
    spiral_code,
    governance_state,
    coverage_percent,
    service_count,
    gap_count,
    incomplete_primary_mapping_count,
        CASE
            WHEN (service_count = 0) THEN 'Map at least one service to this capability.'::text
            WHEN (gap_count > 0) THEN 'Map services to uncovered C3 requirements.'::text
            WHEN (incomplete_primary_mapping_count > 0) THEN 'Repair incomplete primary service mappings.'::text
            ELSE 'Monitor capability coverage.'::text
        END AS recommended_action
   FROM data.v_capability_governance_coverage
  WHERE ((service_count = 0) OR (gap_count > 0) OR (incomplete_primary_mapping_count > 0) OR (blocked_service_count > 0));


--
-- Name: v_capability_governance_overlap; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_capability_governance_overlap AS
 SELECT capability_uuid,
    capability_code,
    capability_title,
    parent_title,
    spiral_code,
    service_count,
    primary_service_count,
    supporting_service_count,
    enabling_service_count,
    dependent_service_count,
    coverage_percent,
    LEAST(100, ((service_count * 25) + (primary_service_count * 10))) AS overlap_score,
    'Review duplicate service support and document intended ownership.'::text AS recommended_action
   FROM data.v_capability_governance_coverage
  WHERE (service_count > 1);


--
-- Name: v_capability_service_overlap; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_capability_service_overlap AS
 SELECT NULL::character varying(100) AS capability_uuid,
    NULL::character varying(20) AS spiral_code,
    NULL::bigint AS service_a_id,
    NULL::bigint AS service_b_id,
    0 AS shared_count,
    0 AS only_a,
    0 AS only_b,
    0 AS overlap_pct
  WHERE false;


--
-- Name: v_framework_completeness; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_framework_completeness AS
 SELECT capability_uuid,
    spiral_code,
    GREATEST((total_requirements - covered_count), 0) AS orphan_requirement_count
   FROM data.v_capability_lvl3_coverage;


--
-- Name: v_graphoverviewnodes; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_graphoverviewnodes AS
 SELECT sc.id AS service_pk,
    concat('svc:', sc.service_id) AS id,
    'service'::text AS node_kind,
    sc.title,
    sc.service_id,
    sc.service_type_code AS service_type,
    data.fn_service_status_code((sc.lifecycle_stage_code)::text, sc.is_stub) AS service_status,
    sp.portfolio_code AS portfolio_group,
    ( SELECT string_agg((sao.domain_code)::text, ','::text) AS string_agg
           FROM data.service_available_on sao
          WHERE (sao.service_id = sc.id)) AS available_on,
    sla.availability_pct AS sla_availability,
    sc.graph_x,
    sc.graph_y
   FROM ((data.service_catalog sc
     LEFT JOIN data.service_portfolio sp ON ((sp.id = sc.portfolio_id)))
     LEFT JOIN data.service_sla sla ON ((sla.id = data.fn_service_primary_sla_id(sc.id))))
  WHERE (sc.is_deleted = false);


--
-- Name: v_impact_edge; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_impact_edge AS
 SELECT concat('rel:', sr.id) AS edge_id,
    'service_relation'::text AS edge_kind,
    concat('svc:', t.service_id) AS source_node_id,
    'service'::text AS source_kind,
    (t.service_id)::text AS source_key,
    (t.title)::text AS source_title,
    concat('svc:', f.service_id) AS target_node_id,
    'service'::text AS target_kind,
    (f.service_id)::text AS target_key,
    (f.title)::text AS target_title,
    (sr.relation_type_code)::text AS relation_kind,
    (sr.relation_label)::text AS relation_label,
    (sr.impact_level)::text AS impact_level,
        CASE
            WHEN (sr.is_mandatory AND ((sr.impact_level)::text = 'high'::text)) THEN 'blocking_dependency'::text
            WHEN (sr.is_verified = false) THEN 'unverified_dependency'::text
            ELSE NULL::text
        END AS risk_hint
   FROM ((data.service_relation sr
     JOIN data.service_catalog f ON (((f.id = sr.from_service_id) AND (f.is_deleted = false))))
     JOIN data.service_catalog t ON (((t.id = sr.to_service_id) AND (t.is_deleted = false))))
  WHERE (sr.is_deleted = false)
UNION ALL
 SELECT concat('svc-c3:', scm.id) AS edge_id,
    'service_c3_mapping'::text AS edge_kind,
    concat('svc:', sc.service_id) AS source_node_id,
    'service'::text AS source_kind,
    (sc.service_id)::text AS source_key,
    (sc.title)::text AS source_title,
    concat('c3:', scm.c3_uuid) AS target_node_id,
    'c3_capability'::text AS target_kind,
    (COALESCE(c.external_id, scm.c3_reference, scm.c3_uuid))::text AS target_key,
    (COALESCE(c.title, scm.c3_reference, scm.c3_uuid))::text AS target_title,
    (scm.mapping_type_code)::text AS relation_kind,
    scm.mapping_note AS relation_label,
        CASE
            WHEN scm.is_primary THEN 'high'::text
            ELSE 'medium'::text
        END AS impact_level,
        CASE
            WHEN scm.is_primary THEN 'primary_capability_mapping'::text
            ELSE NULL::text
        END AS risk_hint
   FROM ((data.service_c3_mapping scm
     JOIN data.service_catalog sc ON (((sc.id = scm.service_id) AND (sc.is_deleted = false))))
     LEFT JOIN data.c3_taxonomy c ON (((c.uuid)::text = (scm.c3_uuid)::text)))
UNION ALL
 SELECT concat('c3-parent:', child.uuid, ':', child.parent_uuid) AS edge_id,
    'c3_parent'::text AS edge_kind,
    concat('c3:', child.uuid) AS source_node_id,
    'c3_capability'::text AS source_kind,
    (COALESCE(child.external_id, child.uuid))::text AS source_key,
    (COALESCE(child.title, child.external_id, child.uuid))::text AS source_title,
    concat('c3:', parent.uuid) AS target_node_id,
    'c3_capability'::text AS target_kind,
    (COALESCE(parent.external_id, parent.uuid))::text AS target_key,
    (COALESCE(parent.title, parent.external_id, parent.uuid))::text AS target_title,
    'supports'::text AS relation_kind,
    NULL::text AS relation_label,
    'medium'::text AS impact_level,
    NULL::text AS risk_hint
   FROM (data.c3_taxonomy child
     JOIN data.c3_taxonomy parent ON (((parent.uuid)::text = (child.parent_uuid)::text)))
UNION ALL
 SELECT concat('cap-app:', l.capability_uuid, ':', app.uuid) AS edge_id,
    'capability_application'::text AS edge_kind,
    concat('c3:', l.capability_uuid) AS source_node_id,
    'c3_capability'::text AS source_kind,
    (COALESCE(c.external_id, l.capability_uuid))::text AS source_key,
    (COALESCE(c.title, c.external_id, l.capability_uuid))::text AS source_title,
    concat('app:', app.uuid) AS target_node_id,
    'c3_application'::text AS target_kind,
    (app.application_code)::text AS target_key,
    (app.title)::text AS target_title,
    'uses_application'::text AS relation_kind,
    (l.link_role)::text AS relation_label,
    'medium'::text AS impact_level,
    NULL::text AS risk_hint
   FROM ((data.c3_capability_application_link l
     JOIN data.c3_application app ON ((app.id = l.c3_application_id)))
     LEFT JOIN data.c3_taxonomy c ON (((c.uuid)::text = (l.capability_uuid)::text)))
UNION ALL
 SELECT concat('cap-do:', l.capability_uuid, ':', dob.uuid) AS edge_id,
    'capability_data_object'::text AS edge_kind,
    concat('c3:', l.capability_uuid) AS source_node_id,
    'c3_capability'::text AS source_kind,
    (COALESCE(c.external_id, l.capability_uuid))::text AS source_key,
    (COALESCE(c.title, c.external_id, l.capability_uuid))::text AS source_title,
    concat('do:', dob.uuid) AS target_node_id,
    'c3_data_object'::text AS target_kind,
    (dob.data_object_code)::text AS target_key,
    (dob.title)::text AS target_title,
    'exposes_data'::text AS relation_kind,
    (l.link_role)::text AS relation_label,
    'medium'::text AS impact_level,
    NULL::text AS risk_hint
   FROM ((data.c3_capability_data_object_link l
     JOIN data.c3_data_object dob ON ((dob.id = l.c3_data_object_id)))
     LEFT JOIN data.c3_taxonomy c ON (((c.uuid)::text = (l.capability_uuid)::text)))
UNION ALL
 SELECT concat('cap-tin:', l.capability_uuid, ':', tin.uuid) AS edge_id,
    'capability_tin'::text AS edge_kind,
    concat('c3:', l.capability_uuid) AS source_node_id,
    'c3_capability'::text AS source_kind,
    (COALESCE(c.external_id, l.capability_uuid))::text AS source_key,
    (COALESCE(c.title, c.external_id, l.capability_uuid))::text AS source_title,
    concat('tin:', tin.uuid) AS target_node_id,
    'c3_tin'::text AS target_kind,
    (tin.technology_interaction_code)::text AS target_key,
    (tin.title)::text AS target_title,
    'implements'::text AS relation_kind,
    (l.link_role)::text AS relation_label,
    'medium'::text AS impact_level,
    NULL::text AS risk_hint
   FROM ((data.c3_capability_tin_link l
     JOIN data.c3_technology_interaction tin ON ((tin.id = l.c3_tin_id)))
     LEFT JOIN data.c3_taxonomy c ON (((c.uuid)::text = (l.capability_uuid)::text)))
UNION ALL
 SELECT concat('cap-c3svc:', l.capability_uuid, ':', svc.uuid) AS edge_id,
    'capability_c3_service'::text AS edge_kind,
    concat('c3:', l.capability_uuid) AS source_node_id,
    'c3_capability'::text AS source_kind,
    (COALESCE(c.external_id, l.capability_uuid))::text AS source_key,
    (COALESCE(c.title, c.external_id, l.capability_uuid))::text AS source_title,
    concat('c3svc:', svc.uuid) AS target_node_id,
    'c3_service'::text AS target_kind,
    (svc.service_code)::text AS target_key,
    (svc.title)::text AS target_title,
    'supports'::text AS relation_kind,
    (l.link_role)::text AS relation_label,
    'medium'::text AS impact_level,
    NULL::text AS risk_hint
   FROM ((data.c3_capability_c3_service_link l
     JOIN data.c3_service svc ON ((svc.id = l.c3_service_id)))
     LEFT JOIN data.c3_taxonomy c ON (((c.uuid)::text = (l.capability_uuid)::text)));


--
-- Name: v_impact_node; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_impact_node AS
 SELECT concat('svc:', sc.service_id) AS node_id,
    'service'::text AS node_kind,
    (sc.service_id)::text AS node_key,
    (sc.id)::text AS node_uuid,
    (sc.title)::text AS title,
    (data.fn_service_status_code((sc.lifecycle_stage_code)::text, sc.is_stub))::text AS status,
    concat('/services/', sc.service_id) AS url,
    (sc.lifecycle_stage_code)::text AS lifecycle_stage,
    (sc.criticality_code)::text AS criticality,
    sc.updated_at
   FROM data.service_catalog sc
  WHERE (sc.is_deleted = false)
UNION ALL
 SELECT concat('c3:', c.uuid) AS node_id,
    'c3_capability'::text AS node_kind,
    (COALESCE(c.external_id, c.uuid))::text AS node_key,
    (c.uuid)::text AS node_uuid,
    (COALESCE(c.title, c.external_id, c.uuid))::text AS title,
    (c.item_status)::text AS status,
    concat('/c3/', c.uuid) AS url,
    NULL::text AS lifecycle_stage,
    NULL::text AS criticality,
    COALESCE(c.synced_at, c.modification_date, CURRENT_TIMESTAMP) AS updated_at
   FROM data.c3_taxonomy c
UNION ALL
 SELECT concat('app:', app.uuid) AS node_id,
    'c3_application'::text AS node_kind,
    (app.application_code)::text AS node_key,
    (app.uuid)::text AS node_uuid,
    (app.title)::text AS title,
    (app.item_status)::text AS status,
    NULL::text AS url,
    NULL::text AS lifecycle_stage,
    NULL::text AS criticality,
    app.updated_at
   FROM data.c3_application app
UNION ALL
 SELECT concat('do:', dob.uuid) AS node_id,
    'c3_data_object'::text AS node_kind,
    (dob.data_object_code)::text AS node_key,
    (dob.uuid)::text AS node_uuid,
    (dob.title)::text AS title,
    (dob.item_status)::text AS status,
    NULL::text AS url,
    NULL::text AS lifecycle_stage,
    NULL::text AS criticality,
    dob.updated_at
   FROM data.c3_data_object dob
UNION ALL
 SELECT concat('tin:', tin.uuid) AS node_id,
    'c3_tin'::text AS node_kind,
    (tin.technology_interaction_code)::text AS node_key,
    (tin.uuid)::text AS node_uuid,
    (tin.title)::text AS title,
    (tin.item_status)::text AS status,
    NULL::text AS url,
    NULL::text AS lifecycle_stage,
    NULL::text AS criticality,
    tin.updated_at
   FROM data.c3_technology_interaction tin
UNION ALL
 SELECT concat('c3svc:', svc.uuid) AS node_id,
    'c3_service'::text AS node_kind,
    (svc.service_code)::text AS node_key,
    (svc.uuid)::text AS node_uuid,
    (svc.title)::text AS title,
    (svc.item_status)::text AS status,
    NULL::text AS url,
    NULL::text AS lifecycle_stage,
    NULL::text AS criticality,
    svc.updated_at
   FROM data.c3_service svc;


--
-- Name: v_importbatchsourcehash; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_importbatchsourcehash AS
 SELECT id AS batch_id,
    filename,
    imported_by,
    parser_version,
    ok_count,
    warn_count,
    error_count,
    row_count,
    imported_at,
    notes,
    source_hash_sha256
   FROM data.import_batch;


--
-- Name: v_importcontractreportbyhash; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_importcontractreportbyhash AS
 WITH ranked AS (
         SELECT import_contract_report.id,
            import_contract_report.source_name,
            import_contract_report.source_kind,
            import_contract_report.created_by,
            import_contract_report.contract_version,
            import_contract_report.source_hash_sha256,
            import_contract_report.item_count,
            import_contract_report.flavour_count,
            import_contract_report.explicit_relation_count,
            import_contract_report.raw_prerequisite_count,
            import_contract_report.missing_target_count,
            import_contract_report.stub_count,
            import_contract_report.unresolved_ref_count,
            import_contract_report.unresolved_refs_json,
            import_contract_report.missing_targets_json,
            import_contract_report.summary_json,
            import_contract_report.created_at,
            row_number() OVER (PARTITION BY import_contract_report.source_hash_sha256 ORDER BY import_contract_report.created_at DESC, import_contract_report.id DESC) AS rn
           FROM data.import_contract_report
          WHERE (import_contract_report.source_hash_sha256 IS NOT NULL)
        )
 SELECT id,
    source_name,
    source_kind,
    created_by,
    contract_version,
    source_hash_sha256,
    item_count,
    flavour_count,
    explicit_relation_count,
    raw_prerequisite_count,
    missing_target_count,
    stub_count,
    unresolved_ref_count,
    unresolved_refs_json,
    missing_targets_json,
    summary_json,
    created_at
   FROM ranked
  WHERE (rn = 1);


--
-- Name: v_importbatchcontractpairing; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_importbatchcontractpairing AS
 SELECT b.batch_id,
    b.filename,
    b.imported_by,
    b.parser_version,
    b.ok_count,
    b.warn_count,
    b.error_count,
    b.row_count,
    b.imported_at,
    b.notes,
    b.source_hash_sha256,
    r.id AS report_id,
    r.source_name,
    r.source_kind,
    r.contract_version,
    r.created_at AS report_created_at,
    r.item_count,
    r.flavour_count,
    r.explicit_relation_count,
    r.raw_prerequisite_count,
    r.missing_target_count,
    r.stub_count,
    r.unresolved_ref_count
   FROM (data.v_importbatchsourcehash b
     LEFT JOIN data.v_importcontractreportbyhash r ON (((r.source_hash_sha256)::text = (b.source_hash_sha256)::text)))
  WHERE (b.source_hash_sha256 IS NOT NULL);


--
-- Name: v_importbatchexport; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_importbatchexport AS
 SELECT id,
    filename,
    imported_at,
    imported_by,
    row_count,
    ok_count,
    warn_count,
    error_count,
    parser_version,
    notes,
    source_hash_sha256
   FROM data.import_batch;


--
-- Name: v_importcontractreport; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_importcontractreport AS
 SELECT id,
    source_name,
    source_kind,
    created_by,
    contract_version,
    source_hash_sha256,
    item_count,
    flavour_count,
    explicit_relation_count,
    raw_prerequisite_count,
    missing_target_count,
    stub_count,
    unresolved_ref_count,
    unresolved_refs_json,
    missing_targets_json,
    summary_json,
    created_at
   FROM data.import_contract_report;


--
-- Name: v_importcontractreportlatest; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_importcontractreportlatest AS
 SELECT id,
    source_name,
    source_kind,
    created_by,
    contract_version,
    source_hash_sha256,
    item_count,
    flavour_count,
    explicit_relation_count,
    raw_prerequisite_count,
    missing_target_count,
    stub_count,
    unresolved_ref_count,
    unresolved_refs_json,
    missing_targets_json,
    summary_json,
    created_at
   FROM data.import_contract_report
  ORDER BY created_at DESC, id DESC
 LIMIT 1;


--
-- Name: v_importissueexport; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_importissueexport AS
 SELECT i.id,
    i.batch_id,
    i.row_id,
    i.service_id,
    i.severity,
    i.issue_code,
    i.field_name,
    i.raw_value,
    i.message,
    i.resolved,
    i.created_at,
    r.row_number,
    b.filename AS batch_filename,
    b.imported_at AS batch_imported_at
   FROM ((data.import_issue i
     JOIN data.import_batch b ON ((b.id = i.batch_id)))
     LEFT JOIN data.import_row r ON ((r.id = i.row_id)));


--
-- Name: v_importrowexport; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_importrowexport AS
 SELECT r.id,
    r.batch_id,
    r.row_number,
    r.service_id,
    r.raw_json,
    r.status,
    r.created_at,
    b.filename AS batch_filename,
    b.imported_at AS batch_imported_at
   FROM (data.import_row r
     JOIN data.import_batch b ON ((b.id = r.batch_id)));


--
-- Name: v_owner_load; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_owner_load AS
 WITH service_base AS (
         SELECT sc.id AS service_pk,
            COALESCE(NULLIF((owner.email)::text, ''::text), NULLIF((owner.display_name)::text, ''::text), 'unassigned'::text) AS owner_key,
            COALESCE(NULLIF((owner.display_name)::text, ''::text), 'Unassigned'::text) AS owner_name,
            owner.email AS owner_email,
                CASE
                    WHEN ((sc.lifecycle_stage_code)::text = 'active'::text) THEN 1
                    ELSE 0
                END AS live_flag,
                CASE
                    WHEN ((sc.criticality_code)::text = 'mission_critical'::text) THEN 1
                    ELSE 0
                END AS critical_flag,
                CASE
                    WHEN ((sc.review_due_at IS NULL) OR (sc.review_due_at < CURRENT_TIMESTAMP)) THEN 1
                    ELSE 0
                END AS overdue_review_flag,
                CASE
                    WHEN ((support.support_model_count = 0) OR ((owner.email IS NULL) AND (owner.display_name IS NULL))) THEN 1
                    ELSE 0
                END AS readiness_blocker_flag,
                CASE
                    WHEN (mapping.c3_mapping_count = 0) THEN 1
                    ELSE 0
                END AS c3_gap_flag
           FROM (((data.service_catalog sc
             LEFT JOIN LATERAL ( SELECT sra.display_name,
                    sra.email
                   FROM data.service_role_assignment sra
                  WHERE ((sra.service_id = sc.id) AND ((sra.role_code)::text = 'service_owner'::text) AND (sra.valid_to IS NULL))
                  ORDER BY sra.created_at DESC
                 LIMIT 1) owner ON (true))
             LEFT JOIN LATERAL ( SELECT (count(*))::integer AS support_model_count
                   FROM data.service_support_model sm
                  WHERE (sm.service_id = sc.id)) support ON (true))
             LEFT JOIN LATERAL ( SELECT (count(*))::integer AS c3_mapping_count
                   FROM data.service_c3_mapping scm
                  WHERE (scm.service_id = sc.id)) mapping ON (true))
          WHERE ((sc.is_deleted = false) AND (sc.is_stub = false))
        ), owner_stats AS (
         SELECT service_base.owner_key,
            service_base.owner_name,
            service_base.owner_email,
            (count(*))::integer AS owned_services,
            (sum(service_base.live_flag))::integer AS live_services,
            (sum(service_base.critical_flag))::integer AS critical_services,
            (sum(service_base.readiness_blocker_flag))::integer AS readiness_blockers,
            (sum(service_base.overdue_review_flag))::integer AS overdue_reviews,
            (sum(service_base.c3_gap_flag))::integer AS c3_gaps
           FROM service_base
          GROUP BY service_base.owner_key, service_base.owner_name, service_base.owner_email
        )
 SELECT owner_key,
    owner_name,
    owner_email,
    owned_services,
    live_services,
    critical_services,
    readiness_blockers,
    overdue_reviews,
    c3_gaps,
    ((((((owned_services * 1) + (live_services * 2)) + (critical_services * 3)) + (readiness_blockers * 4)) + (overdue_reviews * 3)) + (c3_gaps * 2)) AS owner_load_score
   FROM owner_stats;


--
-- Name: v_pricingexport; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_pricingexport AS
 SELECT sc.service_id,
    sf.id AS flavour_pk,
    sf.flavour_code,
    sf.title,
    sf.service_unit,
    sf.price_value,
    sf.currency_code,
    sf.billing_period_code,
    sf.initiation_cost,
    sf.lifecycle_cost,
    sf.lifetime_years,
    sf.nations_rate,
    sf.pricing_note_raw,
    sf.dependency_text,
    sf.flavour_status_code,
    sf.display_order,
    sf.is_orderable
   FROM (data.service_flavour sf
     JOIN data.service_catalog sc ON ((sc.id = sf.service_id)))
  WHERE ((sf.is_deleted = false) AND (sc.is_deleted = false));


--
-- Name: v_retentionjobauditexport; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_retentionjobauditexport AS
 SELECT id,
    trigger_source,
    status,
    deleted_import_issue,
    deleted_import_row,
    deleted_import_batch,
    deleted_taxonomy_audit,
    deleted_graph_audit,
    started_at,
    completed_at,
    error_message
   FROM data.retention_job_audit;


--
-- Name: v_retentionrunnerheartbeat; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_retentionrunnerheartbeat AS
 SELECT runner_name,
    runner_kind,
    status,
    last_seen_at,
    last_run_started_at,
    last_run_completed_at,
    last_job_status,
    last_error_message,
    updated_at
   FROM data.retention_runner_heartbeat;


--
-- Name: v_service_offering_effective; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_service_offering_effective AS
 SELECT so.id AS offering_id,
    so.service_id,
    COALESCE(so.requestable, sc.requestable, false) AS effective_requestable,
    COALESCE(so.approval_required, sc.approval_required) AS effective_approval_required,
    COALESCE(NULLIF(btrim((so.request_channel_type)::text), ''::text), NULLIF(btrim((sc.request_channel_type)::text), ''::text)) AS effective_request_channel_type,
    COALESCE(NULLIF(btrim((so.request_channel_url)::text), ''::text), NULLIF(btrim((sc.request_channel_url)::text), ''::text)) AS effective_request_channel_url,
    COALESCE(NULLIF(btrim(so.lead_time_text), ''::text), NULLIF(btrim(sc.fulfillment_lead_time_text), ''::text)) AS effective_lead_time_text
   FROM (data.service_offering so
     JOIN data.service_catalog sc ON ((sc.id = so.service_id)));


--
-- Name: v_slaexport; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_slaexport AS
 SELECT sc.service_id,
    sl.id AS sla_pk,
    sf.flavour_code,
    sl.support_window_code,
    sl.availability_pct,
    sl.restoration_hours,
    sl.delivery_days,
    sl.priority_model_raw,
    sl.sla_note_raw,
    sl.source_field
   FROM ((data.service_sla sl
     JOIN data.service_catalog sc ON ((sc.id = sl.service_id)))
     LEFT JOIN data.service_flavour sf ON ((sf.id = sl.flavour_id)))
  WHERE (sc.is_deleted = false);


--
-- Name: v_stubcompletionqueue; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_stubcompletionqueue AS
 SELECT id,
    service_id,
    title,
    data.fn_service_status_code((lifecycle_stage_code)::text, is_stub) AS service_status_code,
    is_stub,
    notes_json,
    created_at,
    updated_at,
    ( SELECT count(*) AS count
           FROM data.service_relation sr
          WHERE ((sr.is_deleted = false) AND (sr.from_service_id = sc.id))) AS outgoing_relation_count,
    ( SELECT count(*) AS count
           FROM data.service_relation sr
          WHERE ((sr.is_deleted = false) AND (sr.to_service_id = sc.id))) AS incoming_relation_count,
    ( SELECT string_agg((refs.related_service_id)::text, ','::text) AS string_agg
           FROM ( SELECT DISTINCT t.service_id AS related_service_id
                   FROM (data.service_relation sr
                     JOIN data.service_catalog t ON ((t.id = sr.to_service_id)))
                  WHERE ((sr.is_deleted = false) AND (sr.from_service_id = sc.id))
                UNION
                 SELECT DISTINCT f.service_id AS related_service_id
                   FROM (data.service_relation sr
                     JOIN data.service_catalog f ON ((f.id = sr.from_service_id)))
                  WHERE ((sr.is_deleted = false) AND (sr.to_service_id = sc.id))) refs) AS related_service_ids
   FROM data.service_catalog sc
  WHERE ((is_deleted = false) AND (is_stub = true));


--
-- Name: v_taxonomyexport; Type: VIEW; Schema: data; Owner: -
--

CREATE VIEW data.v_taxonomyexport AS
 SELECT c.uuid,
    c.application,
    c.title,
    c.description,
    c.external_id,
    c.data_qualifier,
    c.data_source,
    c.order_num,
    c.ss_overall_status,
    c.ss_baseline_status,
    c.item_status,
    c.item_type,
    c.parent_uuid,
    c.parent_code,
    p.title AS parent_title,
    p.external_id AS parent_external_id,
    c.synced_at
   FROM (data.c3_taxonomy c
     LEFT JOIN data.c3_taxonomy p ON (((p.uuid)::text = (c.parent_uuid)::text)));


--
-- Name: app_config; Type: TABLE; Schema: platform; Owner: -
--

CREATE TABLE platform.app_config (
    id integer NOT NULL,
    config_key character varying(100) NOT NULL,
    config_value text,
    config_type character varying(20) DEFAULT 'string'::character varying,
    description character varying(500),
    is_sensitive boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by character varying(200),
    CONSTRAINT app_config_config_type_check CHECK ((((config_type)::text = ANY ((ARRAY['string'::character varying, 'json'::character varying, 'boolean'::character varying, 'number'::character varying])::text[])) OR (config_type IS NULL)))
);


--
-- Name: app_config_id_seq; Type: SEQUENCE; Schema: platform; Owner: -
--

ALTER TABLE platform.app_config ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME platform.app_config_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: app_group; Type: TABLE; Schema: platform; Owner: -
--

CREATE TABLE platform.app_group (
    id integer NOT NULL,
    group_code character varying(50) NOT NULL,
    group_name character varying(200) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: app_group_id_seq; Type: SEQUENCE; Schema: platform; Owner: -
--

ALTER TABLE platform.app_group ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME platform.app_group_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: app_group_permission; Type: TABLE; Schema: platform; Owner: -
--

CREATE TABLE platform.app_group_permission (
    id integer NOT NULL,
    group_id integer NOT NULL,
    scope character varying(50) NOT NULL,
    permission character varying(50) NOT NULL,
    resource character varying(200) NOT NULL
);


--
-- Name: app_group_permission_id_seq; Type: SEQUENCE; Schema: platform; Owner: -
--

ALTER TABLE platform.app_group_permission ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME platform.app_group_permission_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: app_user_group; Type: TABLE; Schema: platform; Owner: -
--

CREATE TABLE platform.app_user_group (
    id integer NOT NULL,
    user_sub character varying(200) NOT NULL,
    group_id integer NOT NULL,
    assigned_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    assigned_by character varying(200)
);


--
-- Name: app_user_group_id_seq; Type: SEQUENCE; Schema: platform; Owner: -
--

ALTER TABLE platform.app_user_group ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME platform.app_user_group_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: audit_log; Type: TABLE; Schema: platform; Owner: -
--

CREATE TABLE platform.audit_log (
    id bigint NOT NULL,
    table_name character varying(100) NOT NULL,
    record_id integer NOT NULL,
    record_label character varying(255),
    action character varying(20) NOT NULL,
    old_values text,
    new_values text,
    changed_fields text,
    performed_by character varying(200),
    performed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    client_ip character varying(50),
    user_agent character varying(500),
    CONSTRAINT audit_log_action_check CHECK (((action)::text = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying, 'SOFT_DELETE'::character varying, 'RESTORE'::character varying, 'SP_IMPORT'::character varying, 'JSON_IMPORT'::character varying, 'SCORE_RECALC'::character varying, 'AUTH_FAILURE'::character varying])::text[])))
);


--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: platform; Owner: -
--

ALTER TABLE platform.audit_log ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME platform.audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: canonical_route_metadata; Type: TABLE; Schema: platform; Owner: -
--

CREATE TABLE platform.canonical_route_metadata (
    id bigint NOT NULL,
    route_key character varying(100) NOT NULL,
    feature_area character varying(100) NOT NULL,
    canonical_path character varying(255) NOT NULL,
    legacy_paths_json text,
    route_kind character varying(30) NOT NULL,
    export_endpoint character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: canonical_route_metadata_id_seq; Type: SEQUENCE; Schema: platform; Owner: -
--

ALTER TABLE platform.canonical_route_metadata ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME platform.canonical_route_metadata_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: export_bundle_audit; Type: TABLE; Schema: platform; Owner: -
--

CREATE TABLE platform.export_bundle_audit (
    id bigint NOT NULL,
    bundle_key character varying(100) NOT NULL,
    contract_version character varying(50) NOT NULL,
    schema_version character varying(50) NOT NULL,
    requested_by character varying(200) NOT NULL,
    requested_ip character varying(100),
    record_counts_json text NOT NULL,
    generated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: export_bundle_audit_id_seq; Type: SEQUENCE; Schema: platform; Owner: -
--

ALTER TABLE platform.export_bundle_audit ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME platform.export_bundle_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: export_bundle_metadata; Type: TABLE; Schema: platform; Owner: -
--

CREATE TABLE platform.export_bundle_metadata (
    bundle_key character varying(100) NOT NULL,
    contract_version character varying(50) NOT NULL,
    schema_version character varying(50) NOT NULL,
    retention_days integer,
    archive_after_days integer,
    notes text,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: module_installation_history; Type: TABLE; Schema: platform; Owner: -
--

CREATE TABLE platform.module_installation_history (
    id bigint NOT NULL,
    module_code character varying(50) NOT NULL,
    action character varying(30) NOT NULL,
    status character varying(20) NOT NULL,
    app_version character varying(50),
    schema_version character varying(50),
    details jsonb,
    error_detail text,
    performed_by character varying(200),
    performed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT module_installation_history_action_check CHECK (((action)::text = ANY ((ARRAY['ACTIVATE'::character varying, 'DEACTIVATE'::character varying, 'SCHEMA_MIGRATE'::character varying, 'SEED_APPLY'::character varying, 'REPAIR'::character varying, 'UPGRADE'::character varying])::text[]))),
    CONSTRAINT module_installation_history_status_check CHECK (((status)::text = ANY ((ARRAY['SUCCESS'::character varying, 'FAILED'::character varying, 'PARTIAL'::character varying, 'ROLLED_BACK'::character varying])::text[])))
);


--
-- Name: module_installation_history_id_seq; Type: SEQUENCE; Schema: platform; Owner: -
--

ALTER TABLE platform.module_installation_history ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME platform.module_installation_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: module_registry; Type: TABLE; Schema: platform; Owner: -
--

CREATE TABLE platform.module_registry (
    id integer NOT NULL,
    module_code character varying(50) NOT NULL,
    module_label character varying(200) NOT NULL,
    is_mandatory boolean DEFAULT false NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    schema_installed boolean DEFAULT false NOT NULL,
    reference_seed_installed boolean DEFAULT false NOT NULL,
    business_data_present boolean DEFAULT false NOT NULL,
    ui_visible boolean DEFAULT false NOT NULL,
    api_enabled boolean DEFAULT false NOT NULL,
    version character varying(50),
    install_order integer DEFAULT 100 NOT NULL,
    config_json jsonb,
    activated_at timestamp with time zone,
    activated_by character varying(200),
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TABLE module_registry; Type: COMMENT; Schema: platform; Owner: -
--

COMMENT ON TABLE platform.module_registry IS 'Registry of modules and their activation state. Prevents half-configured states (menu visible, DB not ready). Foundation for repair and future upgrades.';


--
-- Name: module_registry_id_seq; Type: SEQUENCE; Schema: platform; Owner: -
--

ALTER TABLE platform.module_registry ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME platform.module_registry_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: platform; Owner: -
--

CREATE TABLE platform.refresh_tokens (
    id integer NOT NULL,
    user_id integer NOT NULL,
    token_hash character varying(500) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: platform; Owner: -
--

ALTER TABLE platform.refresh_tokens ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME platform.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: release_metadata; Type: TABLE; Schema: platform; Owner: -
--

CREATE TABLE platform.release_metadata (
    id integer NOT NULL,
    release_version character varying(50) NOT NULL,
    schema_version character varying(50) NOT NULL,
    release_notes text,
    released_at timestamp with time zone,
    applied_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    applied_by character varying(200),
    is_current boolean DEFAULT true NOT NULL,
    release_hash character varying(64),
    metadata_json jsonb
);


--
-- Name: TABLE release_metadata; Type: COMMENT; Schema: platform; Owner: -
--

COMMENT ON TABLE platform.release_metadata IS 'Binding between image version and DB state. Foundation for upgrade detection. GitHub releases are tied to tags, so the app needs its own version handshake with the DB.';


--
-- Name: release_metadata_id_seq; Type: SEQUENCE; Schema: platform; Owner: -
--

ALTER TABLE platform.release_metadata ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME platform.release_metadata_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: schema_migrations; Type: TABLE; Schema: platform; Owner: -
--

CREATE TABLE platform.schema_migrations (
    id integer NOT NULL,
    migration_key character varying(200) NOT NULL,
    migration_label character varying(500),
    schema_version character varying(50) NOT NULL,
    app_version character varying(50),
    applied_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    applied_by character varying(200),
    checksum character varying(64),
    duration_ms integer,
    rollback_sql text,
    notes text
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: platform; Owner: -
--

COMMENT ON TABLE platform.schema_migrations IS 'History of applied migrations. Basis for upgrade detection and compatibility checks between image version and DB state.';


--
-- Name: schema_migrations_id_seq; Type: SEQUENCE; Schema: platform; Owner: -
--

ALTER TABLE platform.schema_migrations ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME platform.schema_migrations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: system_installation; Type: TABLE; Schema: platform; Owner: -
--

CREATE TABLE platform.system_installation (
    id integer NOT NULL,
    install_status character varying(30) DEFAULT 'NOT_INSTALLED'::character varying NOT NULL,
    install_mode character varying(20),
    install_lock boolean DEFAULT false NOT NULL,
    lock_token character varying(100),
    lock_acquired_at timestamp with time zone,
    locked_by character varying(200),
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    failed_at timestamp with time zone,
    failure_reason text,
    performed_by character varying(200),
    install_summary jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT system_installation_install_mode_check CHECK ((((install_mode)::text = ANY ((ARRAY['fresh'::character varying, 'repair'::character varying, 'upgrade'::character varying])::text[])) OR (install_mode IS NULL))),
    CONSTRAINT system_installation_install_status_check CHECK (((install_status)::text = ANY ((ARRAY['NOT_INSTALLED'::character varying, 'INSTALL_IN_PROGRESS'::character varying, 'CORE_INSTALLED'::character varying, 'MODULES_CONFIGURED'::character varying, 'DATA_IMPORT_IN_PROGRESS'::character varying, 'READY'::character varying, 'INSTALL_FAILED'::character varying, 'UPGRADE_REQUIRED'::character varying, 'REPAIR_REQUIRED'::character varying])::text[])))
);


--
-- Name: TABLE system_installation; Type: COMMENT; Schema: platform; Owner: -
--

COMMENT ON TABLE platform.system_installation IS 'Authoritative installation state. Only one row is active (id=1). The frontend reads it and never writes to it. The backend state machine is the only writer.';


--
-- Name: system_installation_id_seq; Type: SEQUENCE; Schema: platform; Owner: -
--

ALTER TABLE platform.system_installation ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME platform.system_installation_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: users; Type: TABLE; Schema: platform; Owner: -
--

CREATE TABLE platform.users (
    id integer NOT NULL,
    username character varying(100) NOT NULL,
    display_name character varying(200),
    email character varying(255),
    role character varying(20) DEFAULT 'viewer'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    preferred_lang character varying(5) DEFAULT 'cs'::character varying,
    preferred_theme character varying(10) DEFAULT 'dark'::character varying,
    auth_provider character varying(20) DEFAULT 'local'::character varying NOT NULL,
    external_principal character varying(255),
    password_hash character varying(200),
    given_name character varying(100),
    surname character varying(100),
    phone character varying(50),
    department character varying(200),
    avatar_color character varying(20),
    last_login_at timestamp with time zone,
    last_sso_login_at timestamp with time zone,
    last_login_ip character varying(50),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_users_preferred_lang CHECK ((((preferred_lang)::text = ANY ((ARRAY['cs'::character varying, 'en'::character varying])::text[])) OR (preferred_lang IS NULL))),
    CONSTRAINT users_auth_provider_check CHECK (((auth_provider)::text = ANY ((ARRAY['local'::character varying, 'ad'::character varying])::text[]))),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['viewer'::character varying, 'editor'::character varying, 'admin'::character varying])::text[])))
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: platform; Owner: -
--

ALTER TABLE platform.users ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME platform.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: v_canonical_route_metadata; Type: VIEW; Schema: platform; Owner: -
--

CREATE VIEW platform.v_canonical_route_metadata AS
 SELECT route_key,
    feature_area,
    canonical_path,
    legacy_paths_json,
    route_kind,
    export_endpoint
   FROM platform.canonical_route_metadata
  WHERE (is_active = true);


--
-- Name: v_export_bundle_audit; Type: VIEW; Schema: platform; Owner: -
--

CREATE VIEW platform.v_export_bundle_audit AS
 SELECT id,
    bundle_key,
    contract_version,
    schema_version,
    requested_by,
    requested_ip,
    record_counts_json,
    generated_at
   FROM platform.export_bundle_audit;


--
-- Name: v_export_bundle_manifest; Type: VIEW; Schema: platform; Owner: -
--

CREATE VIEW platform.v_export_bundle_manifest AS
 SELECT bundle_key,
    contract_version,
    schema_version,
    retention_days,
    archive_after_days,
    notes,
    updated_at,
    ( SELECT count(*) AS count
           FROM platform.v_canonical_route_metadata crm
          WHERE ((crm.feature_area)::text = 'export'::text)) AS export_route_count
   FROM platform.export_bundle_metadata ebm;


--
-- Name: governance_decision id; Type: DEFAULT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.governance_decision ALTER COLUMN id SET DEFAULT nextval('data.governance_decision_id_seq'::regclass);


--
-- Name: governance_review id; Type: DEFAULT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.governance_review ALTER COLUMN id SET DEFAULT nextval('data.governance_review_id_seq'::regclass);


--
-- Name: readiness_exception id; Type: DEFAULT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.readiness_exception ALTER COLUMN id SET DEFAULT nextval('data.readiness_exception_id_seq'::regclass);


--
-- Name: ref_portfolio_group_alias id; Type: DEFAULT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.ref_portfolio_group_alias ALTER COLUMN id SET DEFAULT nextval('data.ref_portfolio_group_alias_id_seq'::regclass);


--
-- Data for Name: audit_retention_policy; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.audit_retention_policy (policy_key, target_table, retention_days, archive_after_days, is_active, updated_at) FROM stdin;
taxonomy_mapping_audit	data.taxonomy_mapping_audit	365	90	t	2026-09-25 18:33:27.62705+00
graph_layout_audit	data.graph_layout_audit	365	90	t	2026-09-25 18:33:27.62705+00
import_batch	data.import_batch	365	90	t	2026-09-25 18:33:27.62705+00
import_row	data.import_row	180	60	t	2026-09-25 18:33:27.62705+00
import_issue	data.import_issue	365	90	t	2026-09-25 18:33:27.62705+00
\.


--
-- Data for Name: c3_application; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.c3_application (id, application_code, uuid, modification_date, order_num, ss_overall_status, ss_baseline_status, item_status, data_source, external_id, data_qualifier, title, source_description, revised_description, description, revised, raw_json, synced_at, created_at, updated_at, fmn_spiral) FROM stdin;
\.


--
-- Data for Name: c3_board_state; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.c3_board_state (c3_uuid, board_state, validation_status, board_state_reason, reviewed_at, reviewed_by, updated_at, updated_by) FROM stdin;
\.


--
-- Data for Name: c3_capability_application_link; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.c3_capability_application_link (id, capability_uuid, c3_application_id, link_role, created_at, created_by) FROM stdin;
\.


--
-- Data for Name: c3_capability_builder; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.c3_capability_builder (id, page_id, uuid, title, parent_id, level, state, domain_code, created_at, updated_at, fmn_spiral) FROM stdin;
\.


--
-- Data for Name: c3_capability_builder_seed_state; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.c3_capability_builder_seed_state (seed_version, seed_source, seeded_at) FROM stdin;
\.


--
-- Data for Name: c3_capability_c3_service_link; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.c3_capability_c3_service_link (id, capability_uuid, c3_service_id, link_role, created_at, created_by) FROM stdin;
\.


--
-- Data for Name: c3_capability_data_object_link; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.c3_capability_data_object_link (id, capability_uuid, c3_data_object_id, link_role, created_at, created_by) FROM stdin;
\.


--
-- Data for Name: c3_capability_tin_link; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.c3_capability_tin_link (id, capability_uuid, c3_tin_id, link_role, created_at, created_by) FROM stdin;
\.


--
-- Data for Name: c3_data_object; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.c3_data_object (id, data_object_code, uuid, modification_date, order_num, ss_overall_status, ss_baseline_status, item_status, title, description, provenance_raw, references_raw, standards_raw, raw_json, synced_at, created_at, updated_at, fmn_spiral) FROM stdin;
\.


--
-- Data for Name: c3_entity_import_issue; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.c3_entity_import_issue (id, run_id, row_number, severity, issue_code, field_name, raw_value, message, created_at) FROM stdin;
\.


--
-- Data for Name: c3_entity_import_run; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.c3_entity_import_run (id, target_key, source_name, source_kind, is_dry_run, row_count, ok_count, warn_count, error_count, inserted_count, updated_count, failed_count, created_by, notes, spiral_code, created_at) FROM stdin;
\.


--
-- Data for Name: c3_entity_seed_snapshot_state; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.c3_entity_seed_snapshot_state (seed_key, seed_source, seeded_at) FROM stdin;
\.


--
-- Data for Name: c3_entity_spiral_membership; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.c3_entity_spiral_membership (id, entity_kind, entity_uuid, spiral_code, status_in_spiral, ss_overall_status, ss_baseline_status, item_status, source_run_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: c3_service; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.c3_service (id, service_code, uuid, modification_date, order_num, ss_overall_status, ss_baseline_status, item_status, data_source, external_id, data_qualifier, title, source_description, revised_description, description, revised, raw_json, synced_at, created_at, updated_at, fmn_spiral) FROM stdin;
\.


--
-- Data for Name: c3_taxonomy; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.c3_taxonomy (id, uuid, application, title, description, source_description, revised_description, external_id, source_external_id, data_qualifier, data_source, ss_overall_status, ss_baseline_status, item_status, order_num, modification_date, revised, synced_at, abbreviation, synonym, script_raw, datasets_raw, standards_raw, references_raw, provenance_raw, item_type, level_num, parent_code, parent_uuid, fmn_spiral) FROM stdin;
\.


--
-- Data for Name: c3_technology_interaction; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.c3_technology_interaction (id, technology_interaction_code, uuid, modification_date, order_num, ss_overall_status, ss_baseline_status, item_status, ciav_review_status, mcsma_review_status, service_instructions, title, technology_interaction_type, technology_interaction_maturity, technology_interactions_1_raw, description, conditionality, services_1_raw, applications_1_raw, services_2_raw, technology_interactions_2_raw, technology_interactions_3_raw, services_3_raw, applications_2_raw, data_objects_raw, raw_json, synced_at, created_at, updated_at, fmn_spiral) FROM stdin;
\.


--
-- Data for Name: c3_technology_interaction_application_link; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.c3_technology_interaction_application_link (id, technology_interaction_id, c3_application_id, source_slot, ref_value, created_at) FROM stdin;
\.


--
-- Data for Name: c3_technology_interaction_data_object_link; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.c3_technology_interaction_data_object_link (id, technology_interaction_id, c3_data_object_id, source_slot, ref_value, created_at) FROM stdin;
\.


--
-- Data for Name: c3_technology_interaction_service_link; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.c3_technology_interaction_service_link (id, technology_interaction_id, c3_service_id, source_slot, ref_value, created_at) FROM stdin;
\.


--
-- Data for Name: governance_decision; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.governance_decision (id, service_id, decision_type, decision, rationale, decided_by, decided_at, created_at) FROM stdin;
\.


--
-- Data for Name: governance_review; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.governance_review (id, service_id, review_type, status, requested_by, assigned_to, due_at, completed_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: graph_layout_audit; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.graph_layout_audit (id, service_id, node_kind, old_x, old_y, new_x, new_y, changed_by, changed_at) FROM stdin;
\.


--
-- Data for Name: graph_layout_audit_archive; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.graph_layout_audit_archive (archived_at, retention_job_audit_id, id, service_id, node_kind, old_x, old_y, new_x, new_y, changed_by, changed_at) FROM stdin;
\.


--
-- Data for Name: import_batch; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.import_batch (id, filename, imported_at, imported_by, row_count, ok_count, warn_count, error_count, parser_version, source_hash_sha256, notes) FROM stdin;
\.


--
-- Data for Name: import_batch_archive; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.import_batch_archive (archived_at, retention_job_audit_id, id, filename, imported_at, imported_by, row_count, ok_count, warn_count, error_count, parser_version, source_hash_sha256, notes) FROM stdin;
\.


--
-- Data for Name: import_contract_report; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.import_contract_report (id, source_name, source_kind, created_by, contract_version, source_hash_sha256, item_count, flavour_count, explicit_relation_count, raw_prerequisite_count, missing_target_count, stub_count, unresolved_ref_count, unresolved_refs_json, missing_targets_json, summary_json, created_at) FROM stdin;
\.


--
-- Data for Name: import_issue; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.import_issue (id, batch_id, row_id, service_id, severity, issue_code, field_name, raw_value, message, resolved, created_at) FROM stdin;
\.


--
-- Data for Name: import_issue_archive; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.import_issue_archive (archived_at, retention_job_audit_id, id, batch_id, row_id, service_id, severity, issue_code, field_name, raw_value, message, resolved, created_at) FROM stdin;
\.


--
-- Data for Name: import_row; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.import_row (id, batch_id, row_number, service_id, raw_json, status, created_at) FROM stdin;
\.


--
-- Data for Name: import_row_archive; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.import_row_archive (archived_at, retention_job_audit_id, id, batch_id, row_number, service_id, raw_json, status, created_at) FROM stdin;
\.


--
-- Data for Name: readiness_exception; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.readiness_exception (id, service_id, rule_key, reason, expires_at, approved_by, created_at) FROM stdin;
\.


--
-- Data for Name: readiness_rule; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.readiness_rule (rule_key, title, description, severity, enabled, blocking, applies_to_lifecycle_stage, created_at, updated_at, title_text, why_text, howto_text, evidence_hint) FROM stdin;
service_has_owner	Service has owner	A service needs an active owner assignment before it can be governed or published.	P0	t	t	\N	2026-09-25 18:33:28.189977+00	2026-09-25 18:33:28.374185+00	Service has owner	A service needs an active owner assignment before it can be governed or published.	Assign an accountable service owner in the ownership section.	service_role_assignment.role_code=service_owner
service_has_offering	Service has offering or pricing evidence	A service needs at least one structured offering, active legacy flavour, pricing note, or pricing evidence.	P0	t	t	\N	2026-09-25 18:33:28.189977+00	2026-09-25 18:33:28.374185+00	Service has offering or pricing evidence	A service needs at least one structured offering, active legacy flavour, pricing note, or pricing evidence.	Create at least one active offering or available flavour.	service_offering or active service_flavour
service_has_lifecycle_stage	Service has lifecycle state	A canonical lifecycle state is required for readiness and review queues.	P1	t	t	\N	2026-09-25 18:33:28.189977+00	2026-09-25 18:33:28.374185+00	Service has lifecycle state	A canonical lifecycle state is required for readiness and review queues.	Set the service lifecycle stage and review whether the workflow state is correct.	service_catalog.lifecycle_stage_code
service_has_primary_capability_mapping	Service has primary capability mapping	A primary C3 or capability mapping is required for capability coverage governance.	P1	t	t	\N	2026-09-25 18:33:28.189977+00	2026-09-25 18:33:28.374185+00	Service has primary capability mapping	A primary C3 or capability mapping is required for capability coverage governance.	Map exactly one primary C3 capability to the service.	service_c3_mapping.is_primary=true
service_has_sla	Service has SLA	Availability, restoration, delivery target, or SLA record is required.	P1	t	t	\N	2026-09-25 18:33:28.189977+00	2026-09-25 18:33:28.374185+00	Service has SLA	Availability, restoration, delivery target, or SLA record is required.	Add SLA commitments or an explicit support model exception.	service_catalog SLA fields or service_sla records
service_has_dependency_classification	Service has dependency classification	Dependencies should be classified so change and readiness impact can be assessed.	P2	f	f	\N	2026-09-25 18:33:28.189977+00	2026-09-25 18:33:28.374185+00	Service has dependency classification	Dependencies should be classified so change and readiness impact can be assessed.	Classify dependencies and mark mandatory or operationally critical relationships.	service_relation dependency kinds
service_has_review_date	Service has review date	Review due date keeps ownership and readiness decisions current.	P2	f	f	\N	2026-09-25 18:33:28.189977+00	2026-09-25 18:33:28.374185+00	Service has review date	Review due date keeps ownership and readiness decisions current.	Set the next review date or governance owner.	review_due_at or next_review_due_at
requestable_service_has_pricing	Requestable service has pricing	Requestable services should have pricing, cost note, or an explicit exception.	P2	f	f	\N	2026-09-25 18:33:28.189977+00	2026-09-25 18:33:28.374185+00	Requestable service has pricing	Requestable services should have pricing, cost note, or an explicit exception.	Add a price, rate note or approved pricing exception.	service_flavour.price_value or pricing note
\.


--
-- Data for Name: ref_c3_capability_domain; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.ref_c3_capability_domain (code, css_class, heading_color, background_color, label, sort_order, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: ref_c3_mapping_type; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.ref_c3_mapping_type (code, name, description) FROM stdin;
supports	Supports	Service supports fulfilment of a C3 requirement
enables	Enables	Service enables fulfilment of a C3 requirement
fully_fulfills	Fully fulfills	Service fully fulfils a C3 requirement
partially_fulfills	Partially fulfills	Service partially fulfils a C3 requirement
\.


--
-- Data for Name: ref_flavour_status; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.ref_flavour_status (code, name, sort_order) FROM stdin;
available	Available	1
active	Active	2
no_new_orders	No new orders	3
retired	Retired	4
\.


--
-- Data for Name: ref_global_service_group; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.ref_global_service_group (code, name, portfolio_group_code, sort_order) FROM stdin;
\.


--
-- Data for Name: ref_network_domain; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.ref_network_domain (code, name, color_hex, sort_order) FROM stdin;
NEXUS	Nexus	#22c55e	1
VERTEX	Vertex	#3b82f6	2
ORBIT	Orbit	#ef4444	3
PULSE	Pulse	#a855f7	4
RELAY	Relay	#f97316	5
CLOUD	Cloud	#06b6d4	6
GRID	Grid	#8b5cf6	7
PRISM	Prism	#0ea5e9	8
HELIX	Helix	#64748b	9
ZENITH	Zenith	#78716c	10
APEX	Apex	#d97706	11
VORTEX	Vortex	#06b6d4	12
MATRIX	Matrix	#f97316	13
\.


--
-- Data for Name: ref_organizational_element; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.ref_organizational_element (code, name, sort_order) FROM stdin;
\.


--
-- Data for Name: ref_pace_category; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.ref_pace_category (code, name, sort_order, description) FROM stdin;
P	Primary	1	Primary service / primary path
A	Alternate	2	Alternate service / alternate path
C	Contingency	3	Contingency service / contingency path
E	Emergency	4	Emergency service / emergency path
\.


--
-- Data for Name: ref_portfolio_group; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.ref_portfolio_group (code, name, sort_order, is_active) FROM stdin;
Workplace Services	Workplace Services	1	t
Application Services	Application Services	2	t
Infrastructure Services	Infrastructure Services	3	t
Platform Services	Platform Services	4	t
Security Services	Security Services	5	t
Network Services	Network Services	6	t
Logistic Services	Logistic Services	7	t
Other Services	Other Services	8	t
Digital Workplace Services	Digital Workplace Services	9	t
Subject Matter Expertise Services	Subject Matter Expertise Services	10	t
Training Services	Training Services	20	t
\.


--
-- Data for Name: ref_portfolio_group_alias; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.ref_portfolio_group_alias (id, alias_key, portfolio_group_code, source_kind, is_active, created_at, updated_at) FROM stdin;
1	application service	Application Services	seed	t	2026-09-25 18:33:27.125917+00	2026-09-25 18:33:27.125917+00
2	application services	Application Services	seed	t	2026-09-25 18:33:27.125917+00	2026-09-25 18:33:27.125917+00
3	infrastructure service	Infrastructure Services	seed	t	2026-09-25 18:33:27.125917+00	2026-09-25 18:33:27.125917+00
4	infrastructure services	Infrastructure Services	seed	t	2026-09-25 18:33:27.125917+00	2026-09-25 18:33:27.125917+00
5	platform service	Platform Services	seed	t	2026-09-25 18:33:27.125917+00	2026-09-25 18:33:27.125917+00
6	platform services	Platform Services	seed	t	2026-09-25 18:33:27.125917+00	2026-09-25 18:33:27.125917+00
7	platform service s	Platform Services	seed	t	2026-09-25 18:33:27.125917+00	2026-09-25 18:33:27.125917+00
8	security service	Security Services	seed	t	2026-09-25 18:33:27.125917+00	2026-09-25 18:33:27.125917+00
9	security services	Security Services	seed	t	2026-09-25 18:33:27.125917+00	2026-09-25 18:33:27.125917+00
10	network service	Network Services	seed	t	2026-09-25 18:33:27.125917+00	2026-09-25 18:33:27.125917+00
11	network services	Network Services	seed	t	2026-09-25 18:33:27.125917+00	2026-09-25 18:33:27.125917+00
12	workplace service	Workplace Services	seed	t	2026-09-25 18:33:27.125917+00	2026-09-25 18:33:27.125917+00
13	workplace services	Workplace Services	seed	t	2026-09-25 18:33:27.125917+00	2026-09-25 18:33:27.125917+00
14	subject matter expertise service	Subject Matter Expertise Services	seed	t	2026-09-25 18:33:27.125917+00	2026-09-25 18:33:27.125917+00
15	subject matter expertise services	Subject Matter Expertise Services	seed	t	2026-09-25 18:33:27.125917+00	2026-09-25 18:33:27.125917+00
16	training service	Training Services	seed	t	2026-09-25 18:33:27.125917+00	2026-09-25 18:33:27.125917+00
17	training services	Training Services	seed	t	2026-09-25 18:33:27.125917+00	2026-09-25 18:33:27.125917+00
18	logistic service	Logistic Services	seed	t	2026-09-25 18:33:27.125917+00	2026-09-25 18:33:27.125917+00
19	logistic services	Logistic Services	seed	t	2026-09-25 18:33:27.125917+00	2026-09-25 18:33:27.125917+00
20	other service	Other Services	seed	t	2026-09-25 18:33:27.125917+00	2026-09-25 18:33:27.125917+00
21	other services	Other Services	seed	t	2026-09-25 18:33:27.125917+00	2026-09-25 18:33:27.125917+00
22	digital workplace service	Digital Workplace Services	seed	t	2026-09-25 18:33:27.125917+00	2026-09-25 18:33:27.125917+00
23	digital workplace services	Digital Workplace Services	seed	t	2026-09-25 18:33:27.125917+00	2026-09-25 18:33:27.125917+00
\.


--
-- Data for Name: ref_relation_type; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.ref_relation_type (code, name, description, is_directional, is_operational_dependency, default_impact_mode, default_impact_level) FROM stdin;
depends_on	Depends on	\N	t	t	hard_stop	high
prerequisite	Prerequisite	\N	t	t	hard_stop	high
underlying	Underlying service	\N	t	t	hard_stop	high
requires_account	Requires account	\N	t	t	\N	\N
uses	Uses	\N	t	t	\N	\N
provides	Provides	\N	t	t	\N	\N
provided_by	Provided by	\N	t	t	\N	\N
replaces	Replaces	\N	t	f	\N	\N
replaced_by	Replaced by	\N	t	f	\N	\N
integrates_with	Integrates with	\N	t	f	\N	\N
related_to	Related to	\N	f	f	\N	\N
part_of	Part of	\N	t	f	\N	\N
child_of	Child Of (Parent-Child)	\N	t	f	\N	\N
supports	Supports	Source service or capability supports the target.	t	t	\N	medium
consumes	Consumes	Source consumes data or a supporting element from the target.	t	t	\N	medium
implements	Implements	Source implements the target capability or requirement.	t	t	\N	medium
exposes_data	Exposes data	Source exposes or governs the target data object.	t	t	\N	medium
uses_application	Uses application	Source uses the target application as implementation evidence.	t	t	\N	medium
\.


--
-- Data for Name: ref_security_classification; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.ref_security_classification (code, name, sort_order) FROM stdin;
OPEN	Open	1
STANDARD	Standard	2
ELEVATED	Elevated	3
RESTRICTED	Restricted	4
PROTECTED	Protected	5
CLASSIFIED	Classified	6
SENSITIVE	Sensitive	7
CONTROLLED	Controlled	8
\.


--
-- Data for Name: ref_service_criticality; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.ref_service_criticality (code, name, sort_order, is_active) FROM stdin;
standard	Standard	10	t
important	Important	20	t
mission_critical	Mission critical	30	t
\.


--
-- Data for Name: ref_service_lifecycle_stage; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.ref_service_lifecycle_stage (code, name, sort_order, is_active) FROM stdin;
draft	Draft	10	t
design	Design	20	t
active	Active	30	t
retiring	Retiring	40	t
retired	Retired	50	t
\.


--
-- Data for Name: ref_service_line; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.ref_service_line (code, name, global_service_group_code, sort_order) FROM stdin;
\.


--
-- Data for Name: ref_service_role; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.ref_service_role (code, name, sort_order) FROM stdin;
service_owner	Service Owner	1
service_area_owner	Service Area Owner	2
service_delivery_manager	Service Delivery Manager	3
\.


--
-- Data for Name: ref_service_status; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.ref_service_status (code, name, sort_order, is_active) FROM stdin;
draft	Draft	1	t
planned	Planned	2	t
active	Active	3	t
deprecated	Deprecated	4	f
retired	Retired	5	f
external_reference	External Reference (Stub)	99	f
\.


--
-- Data for Name: ref_service_type; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.ref_service_type (code, name, description) FROM stdin;
CF	Customer Facing	\N
CFS	Customer Facing / Support	\N
ES	Enabling Service	\N
SS	Supporting Service	\N
MS	Managed Service	\N
AS	Advisory Service	\N
\.


--
-- Data for Name: ref_spiral_baseline; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.ref_spiral_baseline (id, spiral_code, spiral_label, is_active, notes, activated_at, activated_by, created_at) FROM stdin;
2	Spiral_4	Spiral 4	f	Historical FMN spiral baseline; inactive until explicitly enabled.	\N	\N	2026-09-25 18:33:27.758046+00
3	Spiral_5	Spiral 5	f	FMN Spiral 5 baseline used by Air C2 PDF parity work.	\N	\N	2026-09-25 18:33:27.758046+00
1	Spiral_6	Spiral 6 (current baseline)	t	Current active baseline for existing C3 seed data.	2026-09-25 18:33:27.499254+00	\N	2026-09-25 18:33:27.499254+00
4	Spiral_7	Spiral 7	f	Future/imported FMN spiral baseline.	\N	\N	2026-09-25 18:33:27.758046+00
\.


--
-- Data for Name: ref_support_window; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.ref_support_window (code, name, description, sort_order) FROM stdin;
24x7	24x7	\N	1
business_hours	Business hours	\N	2
best_effort	Best effort	\N	3
\.


--
-- Data for Name: retention_job_audit; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.retention_job_audit (id, trigger_source, status, deleted_import_issue, deleted_import_row, deleted_import_batch, deleted_taxonomy_audit, deleted_graph_audit, started_at, completed_at, error_message) FROM stdin;
\.


--
-- Data for Name: retention_runner_heartbeat; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.retention_runner_heartbeat (runner_name, runner_kind, status, last_seen_at, last_run_started_at, last_run_completed_at, last_job_status, last_error_message, updated_at) FROM stdin;
\.


--
-- Data for Name: service_audience_policy; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.service_audience_policy (id, service_id, offering_id, audience_type, business_unit, region_code, eligibility_rule, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: service_available_on; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.service_available_on (service_id, domain_code, source_field, notes) FROM stdin;
\.


--
-- Data for Name: service_c3_mapping; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.service_c3_mapping (id, service_id, c3_uuid, c3_parent_uuid, c3_level, c3_domain, c3_source, c3_reference, mapping_type_code, pace_code, is_primary, mapping_note, synced_at, sync_status, source_sp_id, source_etag, created_at) FROM stdin;
\.


--
-- Data for Name: service_catalog; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.service_catalog (id, service_id, title, short_description, description, service_type_code, catalogue_version, global_service_group_code, service_line_code, organizational_element_code, service_url, security_classification_code, service_features, scope_text, unit_of_measure, charging_basis, rate_note, ordering_note, exclusions, graph_x, graph_y, operational_notes_raw, retired_note, budget_activity_code, is_stub, notes_json, is_deleted, completeness_score, created_at, updated_at, created_by, updated_by, requestable, target_audience_summary, request_channel_type, request_channel_url, approval_required, fulfillment_lead_time_text, review_owner_user_id, consumer_value, portfolio_id, lifecycle_stage_code, review_due_at, criticality_code) FROM stdin;
\.


--
-- Data for Name: service_catalog_source; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.service_catalog_source (service_catalog_id, source_local_id, source_sp_id, source_etag, created_at_source, modified_at_source, is_available_status_ambiguous, raw_fields, updated_at) FROM stdin;
\.


--
-- Data for Name: service_flavour; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.service_flavour (id, service_id, flavour_code, title, service_unit, price_value, currency_code, billing_period_code, initiation_cost, lifecycle_cost, lifetime_years, nations_rate, dependency_text, short_note, pricing_note_raw, delivery_note, technical_note, flavour_status_code, display_order, is_orderable, source_local_id, is_deleted, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: service_offering; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.service_offering (id, service_id, offering_code, title, description, is_default, requestable, approval_required, request_channel_type, request_channel_url, lead_time_text, support_tier_code, status, display_order, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: service_operational_link; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.service_operational_link (id, service_id, offering_id, link_type, title, url, sort_order, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: service_portfolio; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.service_portfolio (id, portfolio_code, title, description, status_code, owner_group_id, created_at, updated_at) FROM stdin;
1	Workplace Services	Workplace Services	\N	active	\N	2026-09-25 18:33:28.144403+00	2026-09-25 18:33:28.144403+00
2	Application Services	Application Services	\N	active	\N	2026-09-25 18:33:28.144403+00	2026-09-25 18:33:28.144403+00
3	Infrastructure Services	Infrastructure Services	\N	active	\N	2026-09-25 18:33:28.144403+00	2026-09-25 18:33:28.144403+00
4	Platform Services	Platform Services	\N	active	\N	2026-09-25 18:33:28.144403+00	2026-09-25 18:33:28.144403+00
5	Security Services	Security Services	\N	active	\N	2026-09-25 18:33:28.144403+00	2026-09-25 18:33:28.144403+00
6	Network Services	Network Services	\N	active	\N	2026-09-25 18:33:28.144403+00	2026-09-25 18:33:28.144403+00
7	Logistic Services	Logistic Services	\N	active	\N	2026-09-25 18:33:28.144403+00	2026-09-25 18:33:28.144403+00
8	Other Services	Other Services	\N	active	\N	2026-09-25 18:33:28.144403+00	2026-09-25 18:33:28.144403+00
9	Digital Workplace Services	Digital Workplace Services	\N	active	\N	2026-09-25 18:33:28.144403+00	2026-09-25 18:33:28.144403+00
10	Subject Matter Expertise Services	Subject Matter Expertise Services	\N	active	\N	2026-09-25 18:33:28.144403+00	2026-09-25 18:33:28.144403+00
11	Training Services	Training Services	\N	active	\N	2026-09-25 18:33:28.144403+00	2026-09-25 18:33:28.144403+00
\.


--
-- Data for Name: service_raw_field; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.service_raw_field (id, service_id, field_name, raw_value, parsed_value, parse_status, parser_version, notes, created_at) FROM stdin;
\.


--
-- Data for Name: service_relation; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.service_relation (id, from_service_id, to_service_id, relation_type_code, pace_code, is_mandatory, impact_mode, impact_level, relation_label, relation_note, source_field, raw_text, parse_confidence, is_inferred, is_verified, valid_from, valid_to, source_local_id, source_sp_id, source_etag, is_deleted, created_at, updated_at, created_by) FROM stdin;
\.


--
-- Data for Name: service_relation_raw; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.service_relation_raw (id, service_id, source_field, raw_value, parser_version, parsed_ok, parsed_at, notes, created_at) FROM stdin;
\.


--
-- Data for Name: service_role_assignment; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.service_role_assignment (id, service_id, role_code, display_name, email, organization_name, valid_from, valid_to, created_at) FROM stdin;
\.


--
-- Data for Name: service_sla; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.service_sla (id, service_id, flavour_id, support_window_code, availability_pct, restoration_hours, delivery_days, priority_model_raw, sla_note_raw, source_field, created_at, updated_at, restoration_text, delivery_text) FROM stdin;
\.


--
-- Data for Name: service_support_model; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.service_support_model (id, service_id, offering_id, support_owner_name, resolver_group, support_hours_code, support_channel, escalation_path, maintenance_window, review_cadence, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: taxonomy_mapping_audit; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.taxonomy_mapping_audit (id, service_id, c3_uuid, mapping_id, action_type, changed_by, old_values_json, new_values_json, changed_at) FROM stdin;
\.


--
-- Data for Name: taxonomy_mapping_audit_archive; Type: TABLE DATA; Schema: data; Owner: -
--

COPY data.taxonomy_mapping_audit_archive (archived_at, retention_job_audit_id, id, service_id, c3_uuid, mapping_id, action_type, changed_by, old_values_json, new_values_json, changed_at) FROM stdin;
\.


--
-- Data for Name: app_config; Type: TABLE DATA; Schema: platform; Owner: -
--

COPY platform.app_config (id, config_key, config_value, config_type, description, is_sensitive, updated_at, updated_by) FROM stdin;
1	catalog.model.version	v2.1-graph-pricing-sla-taxonomy	string	Canonical model version	f	2026-09-25 18:33:27.073272+00	\N
2	import.parser.version	1	number	Current CSV import parser version	f	2026-09-25 18:33:27.073272+00	\N
3	import.store_raw_fields	true	boolean	Store raw source fields for audit and re-parse	f	2026-09-25 18:33:27.073272+00	\N
4	graph.default_relation_confidence	1.0	number	Default confidence for explicit relations	f	2026-09-25 18:33:27.073272+00	\N
5	app.version	1.2	string	Application version	f	2026-09-25 18:33:27.073272+00	\N
6	app.default_lang	cs	string	Default UI language (cs / en)	f	2026-09-25 18:33:27.073272+00	\N
7	app.default_theme	dark	string	Default UI theme (dark / light)	f	2026-09-25 18:33:27.073272+00	\N
8	auth.jwt_expiry_minutes	60	number	Access token lifetime in minutes	f	2026-09-25 18:33:27.073272+00	\N
9	auth.refresh_expiry_days	7	number	Refresh token lifetime in days	f	2026-09-25 18:33:27.073272+00	\N
10	auth.sso.enabled	false	boolean	Enable trusted-header SSO login.	f	2026-09-25 18:33:27.073272+00	\N
11	auth.sso.header	x-remote-user	string	Trusted header carrying the authenticated AD identity.	f	2026-09-25 18:33:27.073272+00	\N
12	auth.sso.display_name_header	x-remote-name	string	Trusted header carrying the display name.	f	2026-09-25 18:33:27.073272+00	\N
13	auth.sso.email_header	x-remote-email	string	Trusted header carrying the email address.	f	2026-09-25 18:33:27.073272+00	\N
14	auth.sso.given_name_header	x-remote-given-name	string	Trusted header carrying the given name.	f	2026-09-25 18:33:27.073272+00	\N
15	auth.sso.surname_header	x-remote-surname	string	Trusted header carrying the surname.	f	2026-09-25 18:33:27.073272+00	\N
16	auth.sso.department_header	x-remote-department	string	Trusted header carrying the department.	f	2026-09-25 18:33:27.073272+00	\N
17	c3.sync_enabled	false	boolean	Enable automatic C3 Taxonomy synchronization	f	2026-09-25 18:33:27.073272+00	\N
18	c3.sync_interval_hours	24	number	C3 synchronization interval in hours	f	2026-09-25 18:33:27.073272+00	\N
19	cache.dashboard_ttl_sec	300	number	Dashboard statistics cache TTL in seconds	f	2026-09-25 18:33:27.073272+00	\N
\.


--
-- Data for Name: app_group; Type: TABLE DATA; Schema: platform; Owner: -
--

COPY platform.app_group (id, group_code, group_name, description, is_active, created_at, updated_at) FROM stdin;
1	administrators	Administrators	Full access to all columns and ref data	t	2026-09-25 18:33:27.182072+00	2026-09-25 18:33:27.182072+00
\.


--
-- Data for Name: app_group_permission; Type: TABLE DATA; Schema: platform; Owner: -
--

COPY platform.app_group_permission (id, group_id, scope, permission, resource) FROM stdin;
\.


--
-- Data for Name: app_user_group; Type: TABLE DATA; Schema: platform; Owner: -
--

COPY platform.app_user_group (id, user_sub, group_id, assigned_at, assigned_by) FROM stdin;
\.


--
-- Data for Name: audit_log; Type: TABLE DATA; Schema: platform; Owner: -
--

COPY platform.audit_log (id, table_name, record_id, record_label, action, old_values, new_values, changed_fields, performed_by, performed_at, client_ip, user_agent) FROM stdin;
\.


--
-- Data for Name: canonical_route_metadata; Type: TABLE DATA; Schema: platform; Owner: -
--

COPY platform.canonical_route_metadata (id, route_key, feature_area, canonical_path, legacy_paths_json, route_kind, export_endpoint, is_active, created_at, updated_at) FROM stdin;
1	c3.list	c3	/c3/list	["/admin/c3"]	page	/api/v1/export/taxonomy	t	2026-09-25 18:33:27.62705+00	2026-09-25 18:33:27.62705+00
2	c3.dashboard	c3	/c3/dashboard	["/admin/c3/dashboard"]	page	/api/v1/export/taxonomy	t	2026-09-25 18:33:27.62705+00	2026-09-25 18:33:27.62705+00
3	c3.capability_map	c3	/c3/capability-map	["/c3-dashboard"]	page	/api/v1/export/capability-map-hierarchy	t	2026-09-25 18:33:27.62705+00	2026-09-25 18:33:27.62705+00
4	c3.detail	c3	/c3/{uuid}	["/admin/c3/{uuid}"]	page	/api/v1/export/capability-map-hierarchy	t	2026-09-25 18:33:27.62705+00	2026-09-25 18:33:27.62705+00
5	c3.graph	c3	/c3/graph	["/admin/c3/graph"]	page	/api/v1/export/c3-relationships	t	2026-09-25 18:33:27.62705+00	2026-09-25 18:33:27.62705+00
6	services.list	service	/services/list	["/"]	page	\N	t	2026-09-25 18:33:27.62705+00	2026-09-25 18:33:27.62705+00
7	services.dashboard	service	/services/dashboard	\N	page	\N	t	2026-09-25 18:33:27.62705+00	2026-09-25 18:33:27.62705+00
8	services.graph	service	/services/graph	\N	page	/api/v1/export/graph-overview	t	2026-09-25 18:33:27.62705+00	2026-09-25 18:33:27.62705+00
9	pricing.ui	pricing	/services/{id}/edit#flavours	\N	page	/api/v1/export/pricing	t	2026-09-25 18:33:27.62705+00	2026-09-25 18:33:27.62705+00
10	sla.ui	sla	/services/{id}/edit#sla	\N	page	/api/v1/export/sla	t	2026-09-25 18:33:27.62705+00	2026-09-25 18:33:27.62705+00
11	export.taxonomy	export	/api/v1/export/taxonomy	\N	api	/api/v1/export/taxonomy	t	2026-09-25 18:33:27.62705+00	2026-09-25 18:33:27.62705+00
12	export.graph	export	/api/v1/export/graph-overview	\N	api	/api/v1/export/graph-overview	t	2026-09-25 18:33:27.62705+00	2026-09-25 18:33:27.62705+00
13	export.pricing	export	/api/v1/export/pricing	\N	api	/api/v1/export/pricing	t	2026-09-25 18:33:27.62705+00	2026-09-25 18:33:27.62705+00
14	export.sla	export	/api/v1/export/sla	\N	api	/api/v1/export/sla	t	2026-09-25 18:33:27.62705+00	2026-09-25 18:33:27.62705+00
15	export.bundle	export	/api/v1/export/bundle	\N	api	/api/v1/export/bundle	t	2026-09-25 18:33:27.62705+00	2026-09-25 18:33:27.62705+00
16	export.manifest	export	/api/v1/export/manifest	\N	api	/api/v1/export/manifest	t	2026-09-25 18:33:27.62705+00	2026-09-25 18:33:27.62705+00
17	export.c3_relationships	export	/api/v1/export/c3-relationships	\N	api	/api/v1/export/c3-relationships	t	2026-09-25 18:33:27.62705+00	2026-09-25 18:33:27.62705+00
18	export.capability_map	export	/api/v1/export/capability-map-hierarchy	\N	api	/api/v1/export/capability-map-hierarchy	t	2026-09-25 18:33:27.62705+00	2026-09-25 18:33:27.62705+00
19	import.review	import	/import	\N	page	/api/v1/export/bundle	t	2026-09-25 18:33:27.62705+00	2026-09-25 18:33:27.62705+00
20	import.admin_review	import	/admin/import	\N	page	/api/v1/export/bundle	t	2026-09-25 18:33:27.62705+00	2026-09-25 18:33:27.62705+00
21	import.upload	import	/import/upload	\N	page	/api/v1/export/bundle	t	2026-09-25 18:33:27.62705+00	2026-09-25 18:33:27.62705+00
\.


--
-- Data for Name: export_bundle_audit; Type: TABLE DATA; Schema: platform; Owner: -
--

COPY platform.export_bundle_audit (id, bundle_key, contract_version, schema_version, requested_by, requested_ip, record_counts_json, generated_at) FROM stdin;
\.


--
-- Data for Name: export_bundle_metadata; Type: TABLE DATA; Schema: platform; Owner: -
--

COPY platform.export_bundle_metadata (bundle_key, contract_version, schema_version, retention_days, archive_after_days, notes, updated_at) FROM stdin;
service_catalog_bundle	2026-03-30.c3-v3	canonical-23	365	90	Service graph + pricing + SLA + taxonomy + import/audit exports	2026-09-25 18:33:27.62705+00
\.


--
-- Data for Name: module_installation_history; Type: TABLE DATA; Schema: platform; Owner: -
--

COPY platform.module_installation_history (id, module_code, action, status, app_version, schema_version, details, error_detail, performed_by, performed_at) FROM stdin;
\.


--
-- Data for Name: module_registry; Type: TABLE DATA; Schema: platform; Owner: -
--

COPY platform.module_registry (id, module_code, module_label, is_mandatory, enabled, schema_installed, reference_seed_installed, business_data_present, ui_visible, api_enabled, version, install_order, config_json, activated_at, activated_by, updated_at) FROM stdin;
1	DATABASE_LAYER	Database Layer	t	f	f	f	f	f	f	1.0.0	0	\N	\N	\N	2026-09-25 18:33:27.712085+00
2	PLATFORM_CORE	Platform Core	t	f	f	f	f	f	f	1.0.0	1	\N	\N	\N	2026-09-25 18:33:27.712085+00
3	SERVICE_CATALOGUE_CORE	Service Catalogue	t	f	f	f	f	f	f	1.0.0	2	\N	\N	\N	2026-09-25 18:33:27.712085+00
4	C3_TAXONOMY	C3 Capability Taxonomy	f	f	f	f	f	f	f	1.0.0	3	\N	\N	\N	2026-09-25 18:33:27.712085+00
5	MANAGEMENT	Management Cockpit	t	f	f	f	f	f	f	1.0.0	4	\N	\N	\N	2026-09-25 18:33:27.712085+00
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: platform; Owner: -
--

COPY platform.refresh_tokens (id, user_id, token_hash, expires_at, revoked_at, created_at) FROM stdin;
\.


--
-- Data for Name: release_metadata; Type: TABLE DATA; Schema: platform; Owner: -
--

COPY platform.release_metadata (id, release_version, schema_version, release_notes, released_at, applied_at, applied_by, is_current, release_hash, metadata_json) FROM stdin;
1	1.0.0	1.0.0	Initial release — Service Catalogue v2.1	\N	2026-09-25 18:33:27.712085+00	init	t	\N	\N
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: platform; Owner: -
--

COPY platform.schema_migrations (id, migration_key, migration_label, schema_version, app_version, applied_at, applied_by, checksum, duration_ms, rollback_sql, notes) FROM stdin;
1	00_bootstrap	Bootstrap — schemas + extensions	1.0.0	\N	2026-09-25 18:33:27.712085+00	init	\N	\N	\N	\N
2	01_platform	Platform — AppConfig, Users, RefreshTokens, AuditLog	1.0.0	\N	2026-09-25 18:33:27.712085+00	init	\N	\N	\N	\N
3	02_ref	Reference data — lookup tables	1.0.0	\N	2026-09-25 18:33:27.712085+00	init	\N	\N	\N	\N
4	03_groups	Groups — AppGroup, AppGroupPermission	1.0.0	\N	2026-09-25 18:33:27.712085+00	init	\N	\N	\N	\N
5	04_core	Core — ServiceCatalog main table	1.0.0	\N	2026-09-25 18:33:27.712085+00	init	\N	\N	\N	\N
6	05_graph	Graph — ServiceRelation, ServiceRelationRaw	1.0.0	\N	2026-09-25 18:33:27.712085+00	init	\N	\N	\N	\N
7	06_pricing	Pricing — ServiceFlavour, ServiceSla	1.0.0	\N	2026-09-25 18:33:27.712085+00	init	\N	\N	\N	\N
8	07_domains	Domains — ServiceAvailableOn M:N	1.0.0	\N	2026-09-25 18:33:27.712085+00	init	\N	\N	\N	\N
9	08_ownership	Ownership — ServiceRoleAssignment, ServiceC3Mapping	1.0.0	\N	2026-09-25 18:33:27.712085+00	init	\N	\N	\N	\N
10	09_import	Import — ImportBatch, ImportRow, ImportIssue	1.0.0	\N	2026-09-25 18:33:27.712085+00	init	\N	\N	\N	\N
11	10_indexes	Indexes — performance indexes	1.0.0	\N	2026-09-25 18:33:27.712085+00	init	\N	\N	\N	\N
12	11_c3	C3 — taxonomy, entities, links, builder	1.0.0	\N	2026-09-25 18:33:27.712085+00	init	\N	\N	\N	\N
13	12_exports_retention	Exports + retention — views, archive	1.0.0	\N	2026-09-25 18:33:27.712085+00	init	\N	\N	\N	\N
14	13_install_system	Install system — state machine, migrations, modules	1.0.0	\N	2026-09-25 18:33:27.712085+00	init	\N	\N	\N	\N
15	14_spiral_versioning	FMN Spiral versioning — fmn_spiral columns on C3 entity tables, Spiral_4/5/7 seed	2.1.0	\N	2026-09-25 18:33:27.758046+00	\N	\N	\N	\N	fmn_spiral VARCHAR(20) added to c3_taxonomy, c3_application, c3_data_object, c3_service, c3_technology_interaction, c3_capability_builder; Spiral_4/5/7 seeded into ref_spiral_baseline
16	15_itil_catalogue_phase1	ITIL-ready catalogue Phase 1 — service offerings, support model, audience policy, operational links	2.2.0	\N	2026-09-25 18:33:27.797312+00	\N	\N	\N	\N	Adds additive service-level metadata to data.service_catalog plus data.service_offering, data.service_support_model, data.service_audience_policy, and data.service_operational_link
17	16_consumer_value	Consumer value additive column	2.2.1	\N	2026-09-25 18:33:27.863439+00	\N	\N	\N	\N	Adds additive consumer_value field to data.service_catalog
18	17_spiral_membership	C3 entity multi-spiral membership	2.1.3	\N	2026-09-25 18:33:27.895938+00	\N	\N	\N	\N	Adds c3_entity_spiral_membership, backfills existing C3 entities, seeds Spiral_4/5, and exposes v_c3_entity_membership_matrix.
19	18_user_persona	Persona preference for user-driven UX lenses	2.2.0	\N	2026-09-25 18:33:27.934263+00	\N	\N	\N	\N	Adds preferred_persona to platform.users for Consumer, Service Owner, Capability Manager, and Administrator journeys
20	19_capability_abbreviations	Capability abbreviations for stable Level-3 slugs	2.2.0	\N	2026-09-25 18:33:27.96573+00	\N	\N	\N	\N	Populates C3 capability abbreviations for L1/L2/L3 URL slugs
21	20_capability_coverage_views	Generic capability coverage helper views	2.2.0	\N	2026-09-25 18:33:28.002905+00	\N	\N	\N	\N	Adds SQL views for capability requirements, coverage, completeness, evidence, and overlap API support
22	21_contract_governance	Contract governance foundation	2.3.0	\N	2026-09-25 18:33:28.038276+00	\N	\N	\N	\N	Adds vendor, contract, contract-to-service/capability links, and governance finding dismissal audit tables
23	22_governance_views	Governance radar and advisor views	2.3.0	\N	2026-09-25 18:33:28.095347+00	\N	\N	\N	\N	Adds service risk radar, owner load, contract overlap, renewal risk, and gap/duplication advisor views
24	23_service_portfolio	Service portfolio and governance metadata foundation	2.3.0	\N	2026-09-25 18:33:28.144403+00	\N	\N	\N	\N	Adds service portfolios, lifecycle stage reference values, criticality reference values, and service-level portfolio/review metadata
25	24_readiness_rules	Configurable readiness rules	2.4.0	\N	2026-09-25 18:33:28.189977+00	\N	\N	\N	\N	Adds readiness rules and auditable service-level exceptions
26	25_capability_governance	Capability governance coverage cockpit	2.5.0	\N	2026-09-25 18:33:28.230345+00	\N	\N	\N	\N	Adds normalized capability mapping roles and coverage/gap/overlap governance views
27	26_governance_workflow	Governance workflow reviews and decisions	2.6.0	\N	2026-09-25 18:33:28.26737+00	\N	\N	\N	\N	Adds governance reviews, decision log, statuses, and service-linked workflow history
28	27_impact_analysis	Impact analysis helper views and relation kinds	1.2.0	\N	2026-09-25 18:33:28.304863+00	\N	\N	\N	\N	Adds normalized impact nodes and edges for service/capability traversal.
29	29_reduction_low_risk_cleanup	Reduction low-risk cleanup	2.9.0	\N	2026-09-25 18:33:28.343614+00	\N	\N	\N	\N	Drops retired notification/request/preference objects, preferred_persona, and orphan archive export views.
30	30_reduction_domain_model_simplification	Reduction stage 10 domain model simplification	3.0.0	\N	2026-09-25 18:33:28.374185+00	\N	\N	\N	\N	Keeps historical lifecycle/status and decision data; reduces active readiness rules to five core user-fixable rules
31	31_locale_cs_en_only	Reduce supported UI locales to Czech and English	2.2.0-reduction	\N	2026-09-25 18:33:28.405721+00	\N	\N	\N	\N	Migrates sk/de/legacy locale preferences to the canonical cs/en product decision and enforces the new allowed set.
32	32_final_reduction_sunset_cleanup	Final v1.2 reduction sunset cleanup	2.8.0	\N	2026-09-25 18:33:28.440768+00	\N	\N	\N	\N	Removes retired risk/advisor/procurement DB objects and keeps owner load as a service/readiness/C3 view
33	33_readiness_rule_explanations	Readiness rule explanations	3.1.0	\N	2026-09-25 18:33:28.48594+00	\N	\N	\N	\N	Adds why/how-to/evidence explanation texts to readiness rules (split from 28).
34	34_c3_board_state	C3 governance board state	3.1.0	\N	2026-09-25 18:33:28.514186+00	\N	\N	\N	\N	Adds c3_board_state and v_c3_board_lane (split from 28).
35	35_canonical_service_fields	Canonical service lifecycle, review date and portfolio	3.2.0	\N	2026-09-25 18:33:28.553664+00	\N	\N	\N	\N	Makes lifecycle_stage_code, review_due_at and portfolio_id canonical; legacy mirrors kept in sync by trigger; v_owner_load reads canonical fields.
36	36_service_sla_canonical	Canonical service-level SLA in service_sla	3.3.0	\N	2026-09-25 18:33:28.588812+00	\N	\N	\N	\N	Primary service-level service_sla row is canonical; service_catalog sla_* columns are a trigger-synced mirror.
37	37_offering_request_inheritance	Offering request fields inherit from the service	3.4.0	\N	2026-09-25 18:33:28.625392+00	\N	\N	\N	\N	Offering requestable/approval/channel/lead time: NULL inherits the service value; v_service_offering_effective resolves effective values.
38	38_c3_entity_link_view	Unified C3 entity link read model	3.5.0	\N	2026-09-25 18:33:28.66122+00	\N	\N	\N	\N	Adds v_c3_entity_link over the seven C3 capability/technology-interaction link tables.
39	39_drop_legacy_service_mirrors	Drop legacy service mirror columns	3.6.0	\N	2026-09-25 18:33:28.698037+00	\N	\N	\N	\N	Removes lifecycle_state, service_status_code, next_review_due_at, portfolio_group_code and catalogue sla_* columns; views read canonical fields.
40	40_service_catalog_source	Service catalogue import provenance table and merged description fields	3.7.0	\N	2026-09-25 18:33:28.76772+00	\N	\N	\N	\N	Moves import raw/source columns to data.service_catalog_source; merges value_proposition/business_purpose into consumer_value and business_summary into short_description/description.
\.


--
-- Data for Name: system_installation; Type: TABLE DATA; Schema: platform; Owner: -
--

COPY platform.system_installation (id, install_status, install_mode, install_lock, lock_token, lock_acquired_at, locked_by, started_at, completed_at, failed_at, failure_reason, performed_by, install_summary, created_at, updated_at) FROM stdin;
1	NOT_INSTALLED	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-09-25 18:33:27.712085+00	2026-09-25 18:33:27.712085+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: platform; Owner: -
--

COPY platform.users (id, username, display_name, email, role, is_active, preferred_lang, preferred_theme, auth_provider, external_principal, password_hash, given_name, surname, phone, department, avatar_color, last_login_at, last_sso_login_at, last_login_ip, created_at, updated_at) FROM stdin;
\.


--
-- Name: c3_application_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.c3_application_id_seq', 1, false);


--
-- Name: c3_capability_application_link_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.c3_capability_application_link_id_seq', 1, false);


--
-- Name: c3_capability_builder_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.c3_capability_builder_id_seq', 1, false);


--
-- Name: c3_capability_c3_service_link_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.c3_capability_c3_service_link_id_seq', 1, false);


--
-- Name: c3_capability_data_object_link_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.c3_capability_data_object_link_id_seq', 1, false);


--
-- Name: c3_capability_tin_link_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.c3_capability_tin_link_id_seq', 1, false);


--
-- Name: c3_data_object_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.c3_data_object_id_seq', 1, false);


--
-- Name: c3_entity_import_issue_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.c3_entity_import_issue_id_seq', 1, false);


--
-- Name: c3_entity_import_run_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.c3_entity_import_run_id_seq', 1, false);


--
-- Name: c3_entity_spiral_membership_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.c3_entity_spiral_membership_id_seq', 1, false);


--
-- Name: c3_service_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.c3_service_id_seq', 1, false);


--
-- Name: c3_taxonomy_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.c3_taxonomy_id_seq', 1, false);


--
-- Name: c3_technology_interaction_application_link_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.c3_technology_interaction_application_link_id_seq', 1, false);


--
-- Name: c3_technology_interaction_data_object_link_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.c3_technology_interaction_data_object_link_id_seq', 1, false);


--
-- Name: c3_technology_interaction_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.c3_technology_interaction_id_seq', 1, false);


--
-- Name: c3_technology_interaction_service_link_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.c3_technology_interaction_service_link_id_seq', 1, false);


--
-- Name: governance_decision_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.governance_decision_id_seq', 1, false);


--
-- Name: governance_review_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.governance_review_id_seq', 1, false);


--
-- Name: graph_layout_audit_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.graph_layout_audit_id_seq', 1, false);


--
-- Name: import_batch_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.import_batch_id_seq', 1, false);


--
-- Name: import_contract_report_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.import_contract_report_id_seq', 1, false);


--
-- Name: import_issue_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.import_issue_id_seq', 1, false);


--
-- Name: import_row_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.import_row_id_seq', 1, false);


--
-- Name: readiness_exception_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.readiness_exception_id_seq', 1, false);


--
-- Name: ref_portfolio_group_alias_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.ref_portfolio_group_alias_id_seq', 23, true);


--
-- Name: ref_spiral_baseline_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.ref_spiral_baseline_id_seq', 8, true);


--
-- Name: retention_job_audit_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.retention_job_audit_id_seq', 1, false);


--
-- Name: service_audience_policy_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.service_audience_policy_id_seq', 1, false);


--
-- Name: service_c3_mapping_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.service_c3_mapping_id_seq', 1, false);


--
-- Name: service_catalog_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.service_catalog_id_seq', 1, false);


--
-- Name: service_flavour_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.service_flavour_id_seq', 1, false);


--
-- Name: service_offering_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.service_offering_id_seq', 1, false);


--
-- Name: service_operational_link_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.service_operational_link_id_seq', 1, false);


--
-- Name: service_portfolio_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.service_portfolio_id_seq', 22, true);


--
-- Name: service_raw_field_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.service_raw_field_id_seq', 1, false);


--
-- Name: service_relation_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.service_relation_id_seq', 1, false);


--
-- Name: service_relation_raw_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.service_relation_raw_id_seq', 1, false);


--
-- Name: service_role_assignment_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.service_role_assignment_id_seq', 1, false);


--
-- Name: service_sla_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.service_sla_id_seq', 1, false);


--
-- Name: service_support_model_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.service_support_model_id_seq', 1, false);


--
-- Name: taxonomy_mapping_audit_id_seq; Type: SEQUENCE SET; Schema: data; Owner: -
--

SELECT pg_catalog.setval('data.taxonomy_mapping_audit_id_seq', 1, false);


--
-- Name: app_config_id_seq; Type: SEQUENCE SET; Schema: platform; Owner: -
--

SELECT pg_catalog.setval('platform.app_config_id_seq', 19, true);


--
-- Name: app_group_id_seq; Type: SEQUENCE SET; Schema: platform; Owner: -
--

SELECT pg_catalog.setval('platform.app_group_id_seq', 1, true);


--
-- Name: app_group_permission_id_seq; Type: SEQUENCE SET; Schema: platform; Owner: -
--

SELECT pg_catalog.setval('platform.app_group_permission_id_seq', 1, false);


--
-- Name: app_user_group_id_seq; Type: SEQUENCE SET; Schema: platform; Owner: -
--

SELECT pg_catalog.setval('platform.app_user_group_id_seq', 1, false);


--
-- Name: audit_log_id_seq; Type: SEQUENCE SET; Schema: platform; Owner: -
--

SELECT pg_catalog.setval('platform.audit_log_id_seq', 1, false);


--
-- Name: canonical_route_metadata_id_seq; Type: SEQUENCE SET; Schema: platform; Owner: -
--

SELECT pg_catalog.setval('platform.canonical_route_metadata_id_seq', 21, true);


--
-- Name: export_bundle_audit_id_seq; Type: SEQUENCE SET; Schema: platform; Owner: -
--

SELECT pg_catalog.setval('platform.export_bundle_audit_id_seq', 1, false);


--
-- Name: module_installation_history_id_seq; Type: SEQUENCE SET; Schema: platform; Owner: -
--

SELECT pg_catalog.setval('platform.module_installation_history_id_seq', 1, false);


--
-- Name: module_registry_id_seq; Type: SEQUENCE SET; Schema: platform; Owner: -
--

SELECT pg_catalog.setval('platform.module_registry_id_seq', 5, true);


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: platform; Owner: -
--

SELECT pg_catalog.setval('platform.refresh_tokens_id_seq', 1, false);


--
-- Name: release_metadata_id_seq; Type: SEQUENCE SET; Schema: platform; Owner: -
--

SELECT pg_catalog.setval('platform.release_metadata_id_seq', 1, true);


--
-- Name: schema_migrations_id_seq; Type: SEQUENCE SET; Schema: platform; Owner: -
--

SELECT pg_catalog.setval('platform.schema_migrations_id_seq', 40, true);


--
-- Name: system_installation_id_seq; Type: SEQUENCE SET; Schema: platform; Owner: -
--

SELECT pg_catalog.setval('platform.system_installation_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: platform; Owner: -
--

SELECT pg_catalog.setval('platform.users_id_seq', 1, false);


--
-- Name: audit_retention_policy audit_retention_policy_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.audit_retention_policy
    ADD CONSTRAINT audit_retention_policy_pkey PRIMARY KEY (policy_key);


--
-- Name: c3_application c3_application_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_application
    ADD CONSTRAINT c3_application_pkey PRIMARY KEY (id);


--
-- Name: c3_application c3_application_uuid_key; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_application
    ADD CONSTRAINT c3_application_uuid_key UNIQUE (uuid);


--
-- Name: c3_board_state c3_board_state_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_board_state
    ADD CONSTRAINT c3_board_state_pkey PRIMARY KEY (c3_uuid);


--
-- Name: c3_capability_application_link c3_capability_application_link_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_capability_application_link
    ADD CONSTRAINT c3_capability_application_link_pkey PRIMARY KEY (id);


--
-- Name: c3_capability_builder c3_capability_builder_page_id_key; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_capability_builder
    ADD CONSTRAINT c3_capability_builder_page_id_key UNIQUE (page_id);


--
-- Name: c3_capability_builder c3_capability_builder_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_capability_builder
    ADD CONSTRAINT c3_capability_builder_pkey PRIMARY KEY (id);


--
-- Name: c3_capability_builder_seed_state c3_capability_builder_seed_state_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_capability_builder_seed_state
    ADD CONSTRAINT c3_capability_builder_seed_state_pkey PRIMARY KEY (seed_version);


--
-- Name: c3_capability_builder c3_capability_builder_uuid_key; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_capability_builder
    ADD CONSTRAINT c3_capability_builder_uuid_key UNIQUE (uuid);


--
-- Name: c3_capability_c3_service_link c3_capability_c3_service_link_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_capability_c3_service_link
    ADD CONSTRAINT c3_capability_c3_service_link_pkey PRIMARY KEY (id);


--
-- Name: c3_capability_data_object_link c3_capability_data_object_link_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_capability_data_object_link
    ADD CONSTRAINT c3_capability_data_object_link_pkey PRIMARY KEY (id);


--
-- Name: c3_capability_tin_link c3_capability_tin_link_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_capability_tin_link
    ADD CONSTRAINT c3_capability_tin_link_pkey PRIMARY KEY (id);


--
-- Name: c3_data_object c3_data_object_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_data_object
    ADD CONSTRAINT c3_data_object_pkey PRIMARY KEY (id);


--
-- Name: c3_data_object c3_data_object_uuid_key; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_data_object
    ADD CONSTRAINT c3_data_object_uuid_key UNIQUE (uuid);


--
-- Name: c3_entity_import_issue c3_entity_import_issue_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_entity_import_issue
    ADD CONSTRAINT c3_entity_import_issue_pkey PRIMARY KEY (id);


--
-- Name: c3_entity_import_run c3_entity_import_run_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_entity_import_run
    ADD CONSTRAINT c3_entity_import_run_pkey PRIMARY KEY (id);


--
-- Name: c3_entity_seed_snapshot_state c3_entity_seed_snapshot_state_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_entity_seed_snapshot_state
    ADD CONSTRAINT c3_entity_seed_snapshot_state_pkey PRIMARY KEY (seed_key);


--
-- Name: c3_entity_spiral_membership c3_entity_spiral_membership_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_entity_spiral_membership
    ADD CONSTRAINT c3_entity_spiral_membership_pkey PRIMARY KEY (id);


--
-- Name: c3_service c3_service_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_service
    ADD CONSTRAINT c3_service_pkey PRIMARY KEY (id);


--
-- Name: c3_service c3_service_uuid_key; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_service
    ADD CONSTRAINT c3_service_uuid_key UNIQUE (uuid);


--
-- Name: c3_taxonomy c3_taxonomy_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_taxonomy
    ADD CONSTRAINT c3_taxonomy_pkey PRIMARY KEY (id);


--
-- Name: c3_taxonomy c3_taxonomy_uuid_key; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_taxonomy
    ADD CONSTRAINT c3_taxonomy_uuid_key UNIQUE (uuid);


--
-- Name: c3_technology_interaction_application_link c3_technology_interaction_application_link_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_technology_interaction_application_link
    ADD CONSTRAINT c3_technology_interaction_application_link_pkey PRIMARY KEY (id);


--
-- Name: c3_technology_interaction_data_object_link c3_technology_interaction_data_object_link_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_technology_interaction_data_object_link
    ADD CONSTRAINT c3_technology_interaction_data_object_link_pkey PRIMARY KEY (id);


--
-- Name: c3_technology_interaction c3_technology_interaction_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_technology_interaction
    ADD CONSTRAINT c3_technology_interaction_pkey PRIMARY KEY (id);


--
-- Name: c3_technology_interaction_service_link c3_technology_interaction_service_link_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_technology_interaction_service_link
    ADD CONSTRAINT c3_technology_interaction_service_link_pkey PRIMARY KEY (id);


--
-- Name: c3_technology_interaction c3_technology_interaction_uuid_key; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_technology_interaction
    ADD CONSTRAINT c3_technology_interaction_uuid_key UNIQUE (uuid);


--
-- Name: governance_decision governance_decision_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.governance_decision
    ADD CONSTRAINT governance_decision_pkey PRIMARY KEY (id);


--
-- Name: governance_review governance_review_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.governance_review
    ADD CONSTRAINT governance_review_pkey PRIMARY KEY (id);


--
-- Name: graph_layout_audit graph_layout_audit_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.graph_layout_audit
    ADD CONSTRAINT graph_layout_audit_pkey PRIMARY KEY (id);


--
-- Name: import_batch import_batch_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.import_batch
    ADD CONSTRAINT import_batch_pkey PRIMARY KEY (id);


--
-- Name: import_contract_report import_contract_report_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.import_contract_report
    ADD CONSTRAINT import_contract_report_pkey PRIMARY KEY (id);


--
-- Name: import_issue import_issue_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.import_issue
    ADD CONSTRAINT import_issue_pkey PRIMARY KEY (id);


--
-- Name: import_row import_row_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.import_row
    ADD CONSTRAINT import_row_pkey PRIMARY KEY (id);


--
-- Name: readiness_exception readiness_exception_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.readiness_exception
    ADD CONSTRAINT readiness_exception_pkey PRIMARY KEY (id);


--
-- Name: readiness_rule readiness_rule_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.readiness_rule
    ADD CONSTRAINT readiness_rule_pkey PRIMARY KEY (rule_key);


--
-- Name: ref_c3_capability_domain ref_c3_capability_domain_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.ref_c3_capability_domain
    ADD CONSTRAINT ref_c3_capability_domain_pkey PRIMARY KEY (code);


--
-- Name: ref_c3_mapping_type ref_c3_mapping_type_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.ref_c3_mapping_type
    ADD CONSTRAINT ref_c3_mapping_type_pkey PRIMARY KEY (code);


--
-- Name: ref_flavour_status ref_flavour_status_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.ref_flavour_status
    ADD CONSTRAINT ref_flavour_status_pkey PRIMARY KEY (code);


--
-- Name: ref_global_service_group ref_global_service_group_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.ref_global_service_group
    ADD CONSTRAINT ref_global_service_group_pkey PRIMARY KEY (code);


--
-- Name: ref_network_domain ref_network_domain_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.ref_network_domain
    ADD CONSTRAINT ref_network_domain_pkey PRIMARY KEY (code);


--
-- Name: ref_organizational_element ref_organizational_element_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.ref_organizational_element
    ADD CONSTRAINT ref_organizational_element_pkey PRIMARY KEY (code);


--
-- Name: ref_pace_category ref_pace_category_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.ref_pace_category
    ADD CONSTRAINT ref_pace_category_pkey PRIMARY KEY (code);


--
-- Name: ref_portfolio_group_alias ref_portfolio_group_alias_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.ref_portfolio_group_alias
    ADD CONSTRAINT ref_portfolio_group_alias_pkey PRIMARY KEY (id);


--
-- Name: ref_portfolio_group ref_portfolio_group_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.ref_portfolio_group
    ADD CONSTRAINT ref_portfolio_group_pkey PRIMARY KEY (code);


--
-- Name: ref_relation_type ref_relation_type_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.ref_relation_type
    ADD CONSTRAINT ref_relation_type_pkey PRIMARY KEY (code);


--
-- Name: ref_security_classification ref_security_classification_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.ref_security_classification
    ADD CONSTRAINT ref_security_classification_pkey PRIMARY KEY (code);


--
-- Name: ref_service_criticality ref_service_criticality_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.ref_service_criticality
    ADD CONSTRAINT ref_service_criticality_pkey PRIMARY KEY (code);


--
-- Name: ref_service_lifecycle_stage ref_service_lifecycle_stage_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.ref_service_lifecycle_stage
    ADD CONSTRAINT ref_service_lifecycle_stage_pkey PRIMARY KEY (code);


--
-- Name: ref_service_line ref_service_line_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.ref_service_line
    ADD CONSTRAINT ref_service_line_pkey PRIMARY KEY (code);


--
-- Name: ref_service_role ref_service_role_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.ref_service_role
    ADD CONSTRAINT ref_service_role_pkey PRIMARY KEY (code);


--
-- Name: ref_service_status ref_service_status_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.ref_service_status
    ADD CONSTRAINT ref_service_status_pkey PRIMARY KEY (code);


--
-- Name: ref_service_type ref_service_type_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.ref_service_type
    ADD CONSTRAINT ref_service_type_pkey PRIMARY KEY (code);


--
-- Name: ref_spiral_baseline ref_spiral_baseline_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.ref_spiral_baseline
    ADD CONSTRAINT ref_spiral_baseline_pkey PRIMARY KEY (id);


--
-- Name: ref_spiral_baseline ref_spiral_baseline_spiral_code_key; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.ref_spiral_baseline
    ADD CONSTRAINT ref_spiral_baseline_spiral_code_key UNIQUE (spiral_code);


--
-- Name: ref_support_window ref_support_window_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.ref_support_window
    ADD CONSTRAINT ref_support_window_pkey PRIMARY KEY (code);


--
-- Name: retention_job_audit retention_job_audit_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.retention_job_audit
    ADD CONSTRAINT retention_job_audit_pkey PRIMARY KEY (id);


--
-- Name: retention_runner_heartbeat retention_runner_heartbeat_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.retention_runner_heartbeat
    ADD CONSTRAINT retention_runner_heartbeat_pkey PRIMARY KEY (runner_name);


--
-- Name: service_audience_policy service_audience_policy_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_audience_policy
    ADD CONSTRAINT service_audience_policy_pkey PRIMARY KEY (id);


--
-- Name: service_available_on service_available_on_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_available_on
    ADD CONSTRAINT service_available_on_pkey PRIMARY KEY (service_id, domain_code);


--
-- Name: service_c3_mapping service_c3_mapping_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_c3_mapping
    ADD CONSTRAINT service_c3_mapping_pkey PRIMARY KEY (id);


--
-- Name: service_catalog service_catalog_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_catalog
    ADD CONSTRAINT service_catalog_pkey PRIMARY KEY (id);


--
-- Name: service_catalog service_catalog_service_id_key; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_catalog
    ADD CONSTRAINT service_catalog_service_id_key UNIQUE (service_id);


--
-- Name: service_catalog_source service_catalog_source_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_catalog_source
    ADD CONSTRAINT service_catalog_source_pkey PRIMARY KEY (service_catalog_id);


--
-- Name: service_flavour service_flavour_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_flavour
    ADD CONSTRAINT service_flavour_pkey PRIMARY KEY (id);


--
-- Name: service_offering service_offering_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_offering
    ADD CONSTRAINT service_offering_pkey PRIMARY KEY (id);


--
-- Name: service_operational_link service_operational_link_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_operational_link
    ADD CONSTRAINT service_operational_link_pkey PRIMARY KEY (id);


--
-- Name: service_portfolio service_portfolio_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_portfolio
    ADD CONSTRAINT service_portfolio_pkey PRIMARY KEY (id);


--
-- Name: service_portfolio service_portfolio_portfolio_code_key; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_portfolio
    ADD CONSTRAINT service_portfolio_portfolio_code_key UNIQUE (portfolio_code);


--
-- Name: service_raw_field service_raw_field_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_raw_field
    ADD CONSTRAINT service_raw_field_pkey PRIMARY KEY (id);


--
-- Name: service_relation service_relation_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_relation
    ADD CONSTRAINT service_relation_pkey PRIMARY KEY (id);


--
-- Name: service_relation_raw service_relation_raw_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_relation_raw
    ADD CONSTRAINT service_relation_raw_pkey PRIMARY KEY (id);


--
-- Name: service_role_assignment service_role_assignment_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_role_assignment
    ADD CONSTRAINT service_role_assignment_pkey PRIMARY KEY (id);


--
-- Name: service_sla service_sla_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_sla
    ADD CONSTRAINT service_sla_pkey PRIMARY KEY (id);


--
-- Name: service_support_model service_support_model_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_support_model
    ADD CONSTRAINT service_support_model_pkey PRIMARY KEY (id);


--
-- Name: taxonomy_mapping_audit taxonomy_mapping_audit_pkey; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.taxonomy_mapping_audit
    ADD CONSTRAINT taxonomy_mapping_audit_pkey PRIMARY KEY (id);


--
-- Name: c3_capability_application_link uq_c3_capability_application_link; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_capability_application_link
    ADD CONSTRAINT uq_c3_capability_application_link UNIQUE (capability_uuid, c3_application_id);


--
-- Name: c3_capability_c3_service_link uq_c3_capability_c3_service_link; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_capability_c3_service_link
    ADD CONSTRAINT uq_c3_capability_c3_service_link UNIQUE (capability_uuid, c3_service_id);


--
-- Name: c3_capability_data_object_link uq_c3_capability_data_object_link; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_capability_data_object_link
    ADD CONSTRAINT uq_c3_capability_data_object_link UNIQUE (capability_uuid, c3_data_object_id);


--
-- Name: c3_capability_tin_link uq_c3_capability_tin_link; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_capability_tin_link
    ADD CONSTRAINT uq_c3_capability_tin_link UNIQUE (capability_uuid, c3_tin_id);


--
-- Name: c3_entity_spiral_membership uq_c3_entity_spiral_membership; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_entity_spiral_membership
    ADD CONSTRAINT uq_c3_entity_spiral_membership UNIQUE (entity_kind, entity_uuid, spiral_code);


--
-- Name: service_c3_mapping uq_service_c3_mapping_unique; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_c3_mapping
    ADD CONSTRAINT uq_service_c3_mapping_unique UNIQUE (service_id, c3_uuid, mapping_type_code, pace_code);


--
-- Name: readiness_exception ux_readiness_exception_service_rule; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.readiness_exception
    ADD CONSTRAINT ux_readiness_exception_service_rule UNIQUE (service_id, rule_key);


--
-- Name: ref_portfolio_group_alias ux_ref_portfolio_group_alias; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.ref_portfolio_group_alias
    ADD CONSTRAINT ux_ref_portfolio_group_alias UNIQUE (alias_key);


--
-- Name: service_offering ux_service_offering_id_service; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_offering
    ADD CONSTRAINT ux_service_offering_id_service UNIQUE (id, service_id);


--
-- Name: service_offering ux_service_offering_service_code; Type: CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_offering
    ADD CONSTRAINT ux_service_offering_service_code UNIQUE (service_id, offering_code);


--
-- Name: app_config app_config_config_key_key; Type: CONSTRAINT; Schema: platform; Owner: -
--

ALTER TABLE ONLY platform.app_config
    ADD CONSTRAINT app_config_config_key_key UNIQUE (config_key);


--
-- Name: app_config app_config_pkey; Type: CONSTRAINT; Schema: platform; Owner: -
--

ALTER TABLE ONLY platform.app_config
    ADD CONSTRAINT app_config_pkey PRIMARY KEY (id);


--
-- Name: app_group app_group_group_code_key; Type: CONSTRAINT; Schema: platform; Owner: -
--

ALTER TABLE ONLY platform.app_group
    ADD CONSTRAINT app_group_group_code_key UNIQUE (group_code);


--
-- Name: app_group_permission app_group_permission_pkey; Type: CONSTRAINT; Schema: platform; Owner: -
--

ALTER TABLE ONLY platform.app_group_permission
    ADD CONSTRAINT app_group_permission_pkey PRIMARY KEY (id);


--
-- Name: app_group app_group_pkey; Type: CONSTRAINT; Schema: platform; Owner: -
--

ALTER TABLE ONLY platform.app_group
    ADD CONSTRAINT app_group_pkey PRIMARY KEY (id);


--
-- Name: app_user_group app_user_group_pkey; Type: CONSTRAINT; Schema: platform; Owner: -
--

ALTER TABLE ONLY platform.app_user_group
    ADD CONSTRAINT app_user_group_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: platform; Owner: -
--

ALTER TABLE ONLY platform.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: canonical_route_metadata canonical_route_metadata_canonical_path_key; Type: CONSTRAINT; Schema: platform; Owner: -
--

ALTER TABLE ONLY platform.canonical_route_metadata
    ADD CONSTRAINT canonical_route_metadata_canonical_path_key UNIQUE (canonical_path);


--
-- Name: canonical_route_metadata canonical_route_metadata_pkey; Type: CONSTRAINT; Schema: platform; Owner: -
--

ALTER TABLE ONLY platform.canonical_route_metadata
    ADD CONSTRAINT canonical_route_metadata_pkey PRIMARY KEY (id);


--
-- Name: canonical_route_metadata canonical_route_metadata_route_key_key; Type: CONSTRAINT; Schema: platform; Owner: -
--

ALTER TABLE ONLY platform.canonical_route_metadata
    ADD CONSTRAINT canonical_route_metadata_route_key_key UNIQUE (route_key);


--
-- Name: export_bundle_audit export_bundle_audit_pkey; Type: CONSTRAINT; Schema: platform; Owner: -
--

ALTER TABLE ONLY platform.export_bundle_audit
    ADD CONSTRAINT export_bundle_audit_pkey PRIMARY KEY (id);


--
-- Name: export_bundle_metadata export_bundle_metadata_pkey; Type: CONSTRAINT; Schema: platform; Owner: -
--

ALTER TABLE ONLY platform.export_bundle_metadata
    ADD CONSTRAINT export_bundle_metadata_pkey PRIMARY KEY (bundle_key);


--
-- Name: module_installation_history module_installation_history_pkey; Type: CONSTRAINT; Schema: platform; Owner: -
--

ALTER TABLE ONLY platform.module_installation_history
    ADD CONSTRAINT module_installation_history_pkey PRIMARY KEY (id);


--
-- Name: module_registry module_registry_module_code_key; Type: CONSTRAINT; Schema: platform; Owner: -
--

ALTER TABLE ONLY platform.module_registry
    ADD CONSTRAINT module_registry_module_code_key UNIQUE (module_code);


--
-- Name: module_registry module_registry_pkey; Type: CONSTRAINT; Schema: platform; Owner: -
--

ALTER TABLE ONLY platform.module_registry
    ADD CONSTRAINT module_registry_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: platform; Owner: -
--

ALTER TABLE ONLY platform.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: release_metadata release_metadata_pkey; Type: CONSTRAINT; Schema: platform; Owner: -
--

ALTER TABLE ONLY platform.release_metadata
    ADD CONSTRAINT release_metadata_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_migration_key_key; Type: CONSTRAINT; Schema: platform; Owner: -
--

ALTER TABLE ONLY platform.schema_migrations
    ADD CONSTRAINT schema_migrations_migration_key_key UNIQUE (migration_key);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: platform; Owner: -
--

ALTER TABLE ONLY platform.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (id);


--
-- Name: system_installation system_installation_pkey; Type: CONSTRAINT; Schema: platform; Owner: -
--

ALTER TABLE ONLY platform.system_installation
    ADD CONSTRAINT system_installation_pkey PRIMARY KEY (id);


--
-- Name: app_group_permission uq_agp_unique; Type: CONSTRAINT; Schema: platform; Owner: -
--

ALTER TABLE ONLY platform.app_group_permission
    ADD CONSTRAINT uq_agp_unique UNIQUE (group_id, scope, permission, resource);


--
-- Name: app_user_group uq_aug_user_group; Type: CONSTRAINT; Schema: platform; Owner: -
--

ALTER TABLE ONLY platform.app_user_group
    ADD CONSTRAINT uq_aug_user_group UNIQUE (user_sub, group_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: platform; Owner: -
--

ALTER TABLE ONLY platform.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: platform; Owner: -
--

ALTER TABLE ONLY platform.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: ix_c3_application_code; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_application_code ON data.c3_application USING btree (application_code);


--
-- Name: ix_c3_application_fmn_spiral; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_application_fmn_spiral ON data.c3_application USING btree (fmn_spiral) WHERE (fmn_spiral IS NOT NULL);


--
-- Name: ix_c3_board_state_state; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_board_state_state ON data.c3_board_state USING btree (board_state, updated_at DESC);


--
-- Name: ix_c3_capability_application_link_app; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_capability_application_link_app ON data.c3_capability_application_link USING btree (c3_application_id);


--
-- Name: ix_c3_capability_application_link_cap; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_capability_application_link_cap ON data.c3_capability_application_link USING btree (capability_uuid);


--
-- Name: ix_c3_capability_builder_domain_level_parent; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_capability_builder_domain_level_parent ON data.c3_capability_builder USING btree (domain_code, level, parent_id) INCLUDE (page_id, title, state);


--
-- Name: ix_c3_capability_builder_fmn_spiral; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_capability_builder_fmn_spiral ON data.c3_capability_builder USING btree (fmn_spiral) WHERE (fmn_spiral IS NOT NULL);


--
-- Name: ix_c3_capability_builder_parent; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_capability_builder_parent ON data.c3_capability_builder USING btree (parent_id) INCLUDE (page_id, title, level, domain_code);


--
-- Name: ix_c3_capability_c3_service_link_cap; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_capability_c3_service_link_cap ON data.c3_capability_c3_service_link USING btree (capability_uuid);


--
-- Name: ix_c3_capability_c3_service_link_service; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_capability_c3_service_link_service ON data.c3_capability_c3_service_link USING btree (c3_service_id);


--
-- Name: ix_c3_capability_data_object_link_cap; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_capability_data_object_link_cap ON data.c3_capability_data_object_link USING btree (capability_uuid);


--
-- Name: ix_c3_capability_data_object_link_data_object; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_capability_data_object_link_data_object ON data.c3_capability_data_object_link USING btree (c3_data_object_id);


--
-- Name: ix_c3_capability_tin_link_cap; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_capability_tin_link_cap ON data.c3_capability_tin_link USING btree (capability_uuid);


--
-- Name: ix_c3_capability_tin_link_tin; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_capability_tin_link_tin ON data.c3_capability_tin_link USING btree (c3_tin_id);


--
-- Name: ix_c3_data_object_code; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_data_object_code ON data.c3_data_object USING btree (data_object_code);


--
-- Name: ix_c3_data_object_fmn_spiral; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_data_object_fmn_spiral ON data.c3_data_object USING btree (fmn_spiral) WHERE (fmn_spiral IS NOT NULL);


--
-- Name: ix_c3_entity_import_issue_run; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_entity_import_issue_run ON data.c3_entity_import_issue USING btree (run_id, row_number);


--
-- Name: ix_c3_entity_import_run_target_created; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_entity_import_run_target_created ON data.c3_entity_import_run USING btree (target_key, is_dry_run, created_at DESC);


--
-- Name: ix_c3_membership_entity; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_membership_entity ON data.c3_entity_spiral_membership USING btree (entity_kind, entity_uuid);


--
-- Name: ix_c3_membership_spiral; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_membership_spiral ON data.c3_entity_spiral_membership USING btree (spiral_code);


--
-- Name: ix_c3_service_code; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_service_code ON data.c3_service USING btree (service_code);


--
-- Name: ix_c3_service_fmn_spiral; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_service_fmn_spiral ON data.c3_service USING btree (fmn_spiral) WHERE (fmn_spiral IS NOT NULL);


--
-- Name: ix_c3_taxonomy_application; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_taxonomy_application ON data.c3_taxonomy USING btree (application);


--
-- Name: ix_c3_taxonomy_external_id; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_taxonomy_external_id ON data.c3_taxonomy USING btree (external_id);


--
-- Name: ix_c3_taxonomy_fmn_spiral; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_taxonomy_fmn_spiral ON data.c3_taxonomy USING btree (fmn_spiral) WHERE (fmn_spiral IS NOT NULL);


--
-- Name: ix_c3_taxonomy_item_type; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_taxonomy_item_type ON data.c3_taxonomy USING btree (item_type) INCLUDE (uuid, external_id, parent_uuid, title, item_status);


--
-- Name: ix_c3_taxonomy_parent; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_taxonomy_parent ON data.c3_taxonomy USING btree (parent_uuid) INCLUDE (uuid, item_type, title);


--
-- Name: ix_c3_technology_interaction_code; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_technology_interaction_code ON data.c3_technology_interaction USING btree (technology_interaction_code);


--
-- Name: ix_c3_technology_interaction_fmn_spiral; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_technology_interaction_fmn_spiral ON data.c3_technology_interaction USING btree (fmn_spiral) WHERE (fmn_spiral IS NOT NULL);


--
-- Name: ix_c3_ti_application_link_ti; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_ti_application_link_ti ON data.c3_technology_interaction_application_link USING btree (technology_interaction_id, source_slot);


--
-- Name: ix_c3_ti_data_object_link_ti; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_ti_data_object_link_ti ON data.c3_technology_interaction_data_object_link USING btree (technology_interaction_id, source_slot);


--
-- Name: ix_c3_ti_service_link_ti; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_c3_ti_service_link_ti ON data.c3_technology_interaction_service_link USING btree (technology_interaction_id, source_slot);


--
-- Name: ix_governance_decision_service; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_governance_decision_service ON data.governance_decision USING btree (service_id, decided_at DESC);


--
-- Name: ix_governance_review_assignee; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_governance_review_assignee ON data.governance_review USING btree (assigned_to, status) WHERE (assigned_to IS NOT NULL);


--
-- Name: ix_governance_review_service_status; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_governance_review_service_status ON data.governance_review USING btree (service_id, status, due_at);


--
-- Name: ix_graph_layout_audit_archive_archived_at; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_graph_layout_audit_archive_archived_at ON data.graph_layout_audit_archive USING btree (archived_at);


--
-- Name: ix_graph_layout_audit_service; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_graph_layout_audit_service ON data.graph_layout_audit USING btree (service_id, changed_at DESC);


--
-- Name: ix_import_batch_archive_archived_at; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_import_batch_archive_archived_at ON data.import_batch_archive USING btree (archived_at);


--
-- Name: ix_import_contract_report_created_at; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_import_contract_report_created_at ON data.import_contract_report USING btree (created_at DESC);


--
-- Name: ix_import_contract_report_source_hash; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_import_contract_report_source_hash ON data.import_contract_report USING btree (source_hash_sha256, created_at DESC);


--
-- Name: ix_import_issue_archive_archived_at; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_import_issue_archive_archived_at ON data.import_issue_archive USING btree (archived_at);


--
-- Name: ix_import_issue_batch; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_import_issue_batch ON data.import_issue USING btree (batch_id, severity, resolved) INCLUDE (service_id, issue_code, field_name);


--
-- Name: ix_import_issue_unresolved; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_import_issue_unresolved ON data.import_issue USING btree (issue_code, service_id) WHERE (resolved = false);


--
-- Name: ix_import_row_archive_archived_at; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_import_row_archive_archived_at ON data.import_row_archive USING btree (archived_at);


--
-- Name: ix_import_row_batch; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_import_row_batch ON data.import_row USING btree (batch_id, status) INCLUDE (service_id, row_number);


--
-- Name: ix_readiness_exception_expiry; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_readiness_exception_expiry ON data.readiness_exception USING btree (expires_at) WHERE (expires_at IS NOT NULL);


--
-- Name: ix_readiness_exception_service; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_readiness_exception_service ON data.readiness_exception USING btree (service_id, rule_key);


--
-- Name: ix_readiness_rule_enabled; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_readiness_rule_enabled ON data.readiness_rule USING btree (enabled, blocking, severity);


--
-- Name: ix_service_audience_policy_audience_type; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_audience_policy_audience_type ON data.service_audience_policy USING btree (audience_type) WHERE (audience_type IS NOT NULL);


--
-- Name: ix_service_audience_policy_offering; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_audience_policy_offering ON data.service_audience_policy USING btree (offering_id) WHERE (offering_id IS NOT NULL);


--
-- Name: ix_service_audience_policy_service; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_audience_policy_service ON data.service_audience_policy USING btree (service_id);


--
-- Name: ix_service_available_on_domain; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_available_on_domain ON data.service_available_on USING btree (domain_code) INCLUDE (service_id);


--
-- Name: ix_service_c3_mapping_c3_uuid; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_c3_mapping_c3_uuid ON data.service_c3_mapping USING btree (c3_uuid) INCLUDE (service_id, mapping_type_code, is_primary);


--
-- Name: ix_service_c3_mapping_service; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_c3_mapping_service ON data.service_c3_mapping USING btree (service_id) INCLUDE (c3_uuid, mapping_type_code, pace_code, is_primary);


--
-- Name: ix_service_catalog_criticality; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_catalog_criticality ON data.service_catalog USING btree (criticality_code) WHERE (criticality_code IS NOT NULL);


--
-- Name: ix_service_catalog_lifecycle_stage; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_catalog_lifecycle_stage ON data.service_catalog USING btree (lifecycle_stage_code) WHERE (lifecycle_stage_code IS NOT NULL);


--
-- Name: ix_service_catalog_portfolio_id; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_catalog_portfolio_id ON data.service_catalog USING btree (portfolio_id) WHERE (portfolio_id IS NOT NULL);


--
-- Name: ix_service_catalog_requestable; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_catalog_requestable ON data.service_catalog USING btree (requestable) WHERE (requestable IS NOT NULL);


--
-- Name: ix_service_catalog_review_due; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_catalog_review_due ON data.service_catalog USING btree (review_due_at) WHERE (review_due_at IS NOT NULL);


--
-- Name: ix_service_catalog_review_owner; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_catalog_review_owner ON data.service_catalog USING btree (review_owner_user_id) WHERE (review_owner_user_id IS NOT NULL);


--
-- Name: ix_service_catalog_stage_type; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_catalog_stage_type ON data.service_catalog USING btree (lifecycle_stage_code, service_type_code) INCLUDE (service_id, title, portfolio_id, is_deleted);


--
-- Name: ix_service_flavour_flavour_code; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_flavour_flavour_code ON data.service_flavour USING btree (flavour_code) INCLUDE (service_id, title, is_deleted);


--
-- Name: ix_service_flavour_service; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_flavour_service ON data.service_flavour USING btree (service_id) INCLUDE (flavour_code, title, price_value, flavour_status_code, is_deleted);


--
-- Name: ix_service_offering_service; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_offering_service ON data.service_offering USING btree (service_id);


--
-- Name: ix_service_offering_service_sort; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_offering_service_sort ON data.service_offering USING btree (service_id, display_order, title);


--
-- Name: ix_service_operational_link_offering; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_operational_link_offering ON data.service_operational_link USING btree (offering_id) WHERE (offering_id IS NOT NULL);


--
-- Name: ix_service_operational_link_service; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_operational_link_service ON data.service_operational_link USING btree (service_id);


--
-- Name: ix_service_operational_link_service_sort; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_operational_link_service_sort ON data.service_operational_link USING btree (service_id, sort_order, title);


--
-- Name: ix_service_portfolio_owner_group; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_portfolio_owner_group ON data.service_portfolio USING btree (owner_group_id) WHERE (owner_group_id IS NOT NULL);


--
-- Name: ix_service_portfolio_status; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_portfolio_status ON data.service_portfolio USING btree (status_code);


--
-- Name: ix_service_raw_field_service_field; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_raw_field_service_field ON data.service_raw_field USING btree (service_id, field_name) INCLUDE (parse_status, parser_version);


--
-- Name: ix_service_relation_from; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_relation_from ON data.service_relation USING btree (from_service_id) INCLUDE (to_service_id, relation_type_code, pace_code, is_mandatory, impact_level, is_deleted);


--
-- Name: ix_service_relation_pace; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_relation_pace ON data.service_relation USING btree (pace_code) INCLUDE (from_service_id, to_service_id, relation_type_code);


--
-- Name: ix_service_relation_raw_service; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_relation_raw_service ON data.service_relation_raw USING btree (service_id) INCLUDE (source_field, parsed_ok, parsed_at);


--
-- Name: ix_service_relation_raw_source_field; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_relation_raw_source_field ON data.service_relation_raw USING btree (source_field, parsed_ok);


--
-- Name: ix_service_relation_to; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_relation_to ON data.service_relation USING btree (to_service_id) INCLUDE (from_service_id, relation_type_code, pace_code, is_mandatory, impact_level, is_deleted);


--
-- Name: ix_service_relation_type_source; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_relation_type_source ON data.service_relation USING btree (relation_type_code, source_field, is_inferred, is_deleted) INCLUDE (from_service_id, to_service_id, parse_confidence, impact_level);


--
-- Name: ix_service_relation_updated_at; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_relation_updated_at ON data.service_relation USING btree (updated_at DESC) INCLUDE (from_service_id, to_service_id, relation_type_code, is_verified, is_deleted);


--
-- Name: ix_service_role_assignment_role; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_role_assignment_role ON data.service_role_assignment USING btree (role_code) INCLUDE (service_id, display_name);


--
-- Name: ix_service_role_assignment_service; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_role_assignment_service ON data.service_role_assignment USING btree (service_id) INCLUDE (role_code, display_name, organization_name);


--
-- Name: ix_service_sla_service; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_sla_service ON data.service_sla USING btree (service_id) INCLUDE (flavour_id, support_window_code, availability_pct, restoration_hours, delivery_days);


--
-- Name: ix_service_sla_service_level; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_sla_service_level ON data.service_sla USING btree (service_id, id) WHERE (flavour_id IS NULL);


--
-- Name: ix_service_support_model_service; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_service_support_model_service ON data.service_support_model USING btree (service_id);


--
-- Name: ix_taxonomy_mapping_audit_archive_archived_at; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_taxonomy_mapping_audit_archive_archived_at ON data.taxonomy_mapping_audit_archive USING btree (archived_at);


--
-- Name: ix_taxonomy_mapping_audit_service; Type: INDEX; Schema: data; Owner: -
--

CREATE INDEX ix_taxonomy_mapping_audit_service ON data.taxonomy_mapping_audit USING btree (service_id, changed_at DESC);


--
-- Name: ux_graph_layout_audit_archive_id; Type: INDEX; Schema: data; Owner: -
--

CREATE UNIQUE INDEX ux_graph_layout_audit_archive_id ON data.graph_layout_audit_archive USING btree (id);


--
-- Name: ux_import_batch_archive_id; Type: INDEX; Schema: data; Owner: -
--

CREATE UNIQUE INDEX ux_import_batch_archive_id ON data.import_batch_archive USING btree (id);


--
-- Name: ux_import_issue_archive_id; Type: INDEX; Schema: data; Owner: -
--

CREATE UNIQUE INDEX ux_import_issue_archive_id ON data.import_issue_archive USING btree (id);


--
-- Name: ux_import_row_archive_id; Type: INDEX; Schema: data; Owner: -
--

CREATE UNIQUE INDEX ux_import_row_archive_id ON data.import_row_archive USING btree (id);


--
-- Name: ux_service_flavour_service_flavour_code; Type: INDEX; Schema: data; Owner: -
--

CREATE UNIQUE INDEX ux_service_flavour_service_flavour_code ON data.service_flavour USING btree (service_id, flavour_code) WHERE (is_deleted = false);


--
-- Name: ux_service_offering_default_per_service; Type: INDEX; Schema: data; Owner: -
--

CREATE UNIQUE INDEX ux_service_offering_default_per_service ON data.service_offering USING btree (service_id) WHERE (is_default = true);


--
-- Name: ux_service_relation_active_edge; Type: INDEX; Schema: data; Owner: -
--

CREATE UNIQUE INDEX ux_service_relation_active_edge ON data.service_relation USING btree (from_service_id, to_service_id, relation_type_code, pace_code_normalized) WHERE (is_deleted = false);


--
-- Name: ux_service_role_assignment_current_role; Type: INDEX; Schema: data; Owner: -
--

CREATE UNIQUE INDEX ux_service_role_assignment_current_role ON data.service_role_assignment USING btree (service_id, role_code) WHERE (valid_to IS NULL);


--
-- Name: ux_service_support_model_offering; Type: INDEX; Schema: data; Owner: -
--

CREATE UNIQUE INDEX ux_service_support_model_offering ON data.service_support_model USING btree (offering_id) WHERE (offering_id IS NOT NULL);


--
-- Name: ux_service_support_model_service_level; Type: INDEX; Schema: data; Owner: -
--

CREATE UNIQUE INDEX ux_service_support_model_service_level ON data.service_support_model USING btree (service_id) WHERE (offering_id IS NULL);


--
-- Name: ux_taxonomy_mapping_audit_archive_id; Type: INDEX; Schema: data; Owner: -
--

CREATE UNIQUE INDEX ux_taxonomy_mapping_audit_archive_id ON data.taxonomy_mapping_audit_archive USING btree (id);


--
-- Name: ix_agp_group_id; Type: INDEX; Schema: platform; Owner: -
--

CREATE INDEX ix_agp_group_id ON platform.app_group_permission USING btree (group_id);


--
-- Name: ix_audit_log_record; Type: INDEX; Schema: platform; Owner: -
--

CREATE INDEX ix_audit_log_record ON platform.audit_log USING btree (table_name, record_id, performed_at DESC);


--
-- Name: ix_audit_log_time; Type: INDEX; Schema: platform; Owner: -
--

CREATE INDEX ix_audit_log_time ON platform.audit_log USING btree (performed_at DESC);


--
-- Name: ix_audit_log_user; Type: INDEX; Schema: platform; Owner: -
--

CREATE INDEX ix_audit_log_user ON platform.audit_log USING btree (performed_by, performed_at DESC);


--
-- Name: ix_module_history_code; Type: INDEX; Schema: platform; Owner: -
--

CREATE INDEX ix_module_history_code ON platform.module_installation_history USING btree (module_code, performed_at DESC);


--
-- Name: ix_refresh_tokens_expires; Type: INDEX; Schema: platform; Owner: -
--

CREATE INDEX ix_refresh_tokens_expires ON platform.refresh_tokens USING btree (expires_at) WHERE (revoked_at IS NULL);


--
-- Name: ix_refresh_tokens_hash; Type: INDEX; Schema: platform; Owner: -
--

CREATE INDEX ix_refresh_tokens_hash ON platform.refresh_tokens USING btree (token_hash) WHERE (revoked_at IS NULL);


--
-- Name: ix_refresh_tokens_user_id; Type: INDEX; Schema: platform; Owner: -
--

CREATE INDEX ix_refresh_tokens_user_id ON platform.refresh_tokens USING btree (user_id);


--
-- Name: ix_release_metadata_current; Type: INDEX; Schema: platform; Owner: -
--

CREATE INDEX ix_release_metadata_current ON platform.release_metadata USING btree (is_current, applied_at DESC) WHERE (is_current = true);


--
-- Name: ix_schema_migrations_version; Type: INDEX; Schema: platform; Owner: -
--

CREATE INDEX ix_schema_migrations_version ON platform.schema_migrations USING btree (schema_version, applied_at DESC);


--
-- Name: ix_users_active; Type: INDEX; Schema: platform; Owner: -
--

CREATE INDEX ix_users_active ON platform.users USING btree (username) WHERE (is_active = true);


--
-- Name: ix_users_auth_provider_active; Type: INDEX; Schema: platform; Owner: -
--

CREATE INDEX ix_users_auth_provider_active ON platform.users USING btree (auth_provider, is_active, username);


--
-- Name: ux_users_external_principal; Type: INDEX; Schema: platform; Owner: -
--

CREATE UNIQUE INDEX ux_users_external_principal ON platform.users USING btree (external_principal) WHERE (external_principal IS NOT NULL);


--
-- Name: ref_portfolio_group trg_ref_portfolio_group_sync_portfolio; Type: TRIGGER; Schema: data; Owner: -
--

CREATE TRIGGER trg_ref_portfolio_group_sync_portfolio AFTER INSERT OR UPDATE OF name ON data.ref_portfolio_group FOR EACH ROW EXECUTE FUNCTION data.fn_ref_portfolio_group_sync_portfolio();


--
-- Name: module_registry trg_module_registry_updated_at; Type: TRIGGER; Schema: platform; Owner: -
--

CREATE TRIGGER trg_module_registry_updated_at BEFORE UPDATE ON platform.module_registry FOR EACH ROW EXECUTE FUNCTION platform.set_updated_at();


--
-- Name: system_installation trg_system_installation_updated_at; Type: TRIGGER; Schema: platform; Owner: -
--

CREATE TRIGGER trg_system_installation_updated_at BEFORE UPDATE ON platform.system_installation FOR EACH ROW EXECUTE FUNCTION platform.set_updated_at();


--
-- Name: c3_board_state c3_board_state_c3_uuid_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_board_state
    ADD CONSTRAINT c3_board_state_c3_uuid_fkey FOREIGN KEY (c3_uuid) REFERENCES data.c3_taxonomy(uuid) ON DELETE CASCADE;


--
-- Name: c3_capability_application_link c3_capability_application_link_c3_application_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_capability_application_link
    ADD CONSTRAINT c3_capability_application_link_c3_application_id_fkey FOREIGN KEY (c3_application_id) REFERENCES data.c3_application(id) ON DELETE CASCADE;


--
-- Name: c3_capability_application_link c3_capability_application_link_capability_uuid_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_capability_application_link
    ADD CONSTRAINT c3_capability_application_link_capability_uuid_fkey FOREIGN KEY (capability_uuid) REFERENCES data.c3_taxonomy(uuid) ON DELETE CASCADE;


--
-- Name: c3_capability_builder c3_capability_builder_domain_code_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_capability_builder
    ADD CONSTRAINT c3_capability_builder_domain_code_fkey FOREIGN KEY (domain_code) REFERENCES data.ref_c3_capability_domain(code);


--
-- Name: c3_capability_c3_service_link c3_capability_c3_service_link_c3_service_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_capability_c3_service_link
    ADD CONSTRAINT c3_capability_c3_service_link_c3_service_id_fkey FOREIGN KEY (c3_service_id) REFERENCES data.c3_service(id) ON DELETE CASCADE;


--
-- Name: c3_capability_c3_service_link c3_capability_c3_service_link_capability_uuid_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_capability_c3_service_link
    ADD CONSTRAINT c3_capability_c3_service_link_capability_uuid_fkey FOREIGN KEY (capability_uuid) REFERENCES data.c3_taxonomy(uuid) ON DELETE CASCADE;


--
-- Name: c3_capability_data_object_link c3_capability_data_object_link_c3_data_object_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_capability_data_object_link
    ADD CONSTRAINT c3_capability_data_object_link_c3_data_object_id_fkey FOREIGN KEY (c3_data_object_id) REFERENCES data.c3_data_object(id) ON DELETE CASCADE;


--
-- Name: c3_capability_data_object_link c3_capability_data_object_link_capability_uuid_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_capability_data_object_link
    ADD CONSTRAINT c3_capability_data_object_link_capability_uuid_fkey FOREIGN KEY (capability_uuid) REFERENCES data.c3_taxonomy(uuid) ON DELETE CASCADE;


--
-- Name: c3_capability_tin_link c3_capability_tin_link_c3_tin_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_capability_tin_link
    ADD CONSTRAINT c3_capability_tin_link_c3_tin_id_fkey FOREIGN KEY (c3_tin_id) REFERENCES data.c3_technology_interaction(id) ON DELETE CASCADE;


--
-- Name: c3_capability_tin_link c3_capability_tin_link_capability_uuid_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_capability_tin_link
    ADD CONSTRAINT c3_capability_tin_link_capability_uuid_fkey FOREIGN KEY (capability_uuid) REFERENCES data.c3_taxonomy(uuid) ON DELETE CASCADE;


--
-- Name: c3_entity_import_issue c3_entity_import_issue_run_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_entity_import_issue
    ADD CONSTRAINT c3_entity_import_issue_run_id_fkey FOREIGN KEY (run_id) REFERENCES data.c3_entity_import_run(id) ON DELETE CASCADE;


--
-- Name: c3_entity_spiral_membership c3_entity_spiral_membership_source_run_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_entity_spiral_membership
    ADD CONSTRAINT c3_entity_spiral_membership_source_run_id_fkey FOREIGN KEY (source_run_id) REFERENCES data.c3_entity_import_run(id) ON DELETE SET NULL;


--
-- Name: c3_entity_spiral_membership c3_entity_spiral_membership_spiral_code_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_entity_spiral_membership
    ADD CONSTRAINT c3_entity_spiral_membership_spiral_code_fkey FOREIGN KEY (spiral_code) REFERENCES data.ref_spiral_baseline(spiral_code);


--
-- Name: c3_technology_interaction_application_link c3_technology_interaction_applic_technology_interaction_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_technology_interaction_application_link
    ADD CONSTRAINT c3_technology_interaction_applic_technology_interaction_id_fkey FOREIGN KEY (technology_interaction_id) REFERENCES data.c3_technology_interaction(id) ON DELETE CASCADE;


--
-- Name: c3_technology_interaction_application_link c3_technology_interaction_application_li_c3_application_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_technology_interaction_application_link
    ADD CONSTRAINT c3_technology_interaction_application_li_c3_application_id_fkey FOREIGN KEY (c3_application_id) REFERENCES data.c3_application(id) ON DELETE CASCADE;


--
-- Name: c3_technology_interaction_data_object_link c3_technology_interaction_data_o_technology_interaction_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_technology_interaction_data_object_link
    ADD CONSTRAINT c3_technology_interaction_data_o_technology_interaction_id_fkey FOREIGN KEY (technology_interaction_id) REFERENCES data.c3_technology_interaction(id) ON DELETE CASCADE;


--
-- Name: c3_technology_interaction_data_object_link c3_technology_interaction_data_object_li_c3_data_object_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_technology_interaction_data_object_link
    ADD CONSTRAINT c3_technology_interaction_data_object_li_c3_data_object_id_fkey FOREIGN KEY (c3_data_object_id) REFERENCES data.c3_data_object(id) ON DELETE CASCADE;


--
-- Name: c3_technology_interaction_service_link c3_technology_interaction_servic_technology_interaction_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_technology_interaction_service_link
    ADD CONSTRAINT c3_technology_interaction_servic_technology_interaction_id_fkey FOREIGN KEY (technology_interaction_id) REFERENCES data.c3_technology_interaction(id) ON DELETE CASCADE;


--
-- Name: c3_technology_interaction_service_link c3_technology_interaction_service_link_c3_service_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.c3_technology_interaction_service_link
    ADD CONSTRAINT c3_technology_interaction_service_link_c3_service_id_fkey FOREIGN KEY (c3_service_id) REFERENCES data.c3_service(id) ON DELETE CASCADE;


--
-- Name: service_audience_policy fk_service_audience_policy_offering_service; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_audience_policy
    ADD CONSTRAINT fk_service_audience_policy_offering_service FOREIGN KEY (offering_id, service_id) REFERENCES data.service_offering(id, service_id) ON DELETE CASCADE;


--
-- Name: service_operational_link fk_service_operational_link_offering_service; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_operational_link
    ADD CONSTRAINT fk_service_operational_link_offering_service FOREIGN KEY (offering_id, service_id) REFERENCES data.service_offering(id, service_id) ON DELETE CASCADE;


--
-- Name: service_support_model fk_service_support_model_offering_service; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_support_model
    ADD CONSTRAINT fk_service_support_model_offering_service FOREIGN KEY (offering_id, service_id) REFERENCES data.service_offering(id, service_id) ON DELETE CASCADE;


--
-- Name: governance_decision governance_decision_service_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.governance_decision
    ADD CONSTRAINT governance_decision_service_id_fkey FOREIGN KEY (service_id) REFERENCES data.service_catalog(id) ON DELETE CASCADE;


--
-- Name: governance_review governance_review_service_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.governance_review
    ADD CONSTRAINT governance_review_service_id_fkey FOREIGN KEY (service_id) REFERENCES data.service_catalog(id) ON DELETE CASCADE;


--
-- Name: graph_layout_audit graph_layout_audit_service_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.graph_layout_audit
    ADD CONSTRAINT graph_layout_audit_service_id_fkey FOREIGN KEY (service_id) REFERENCES data.service_catalog(id);


--
-- Name: import_issue import_issue_batch_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.import_issue
    ADD CONSTRAINT import_issue_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES data.import_batch(id);


--
-- Name: import_issue import_issue_row_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.import_issue
    ADD CONSTRAINT import_issue_row_id_fkey FOREIGN KEY (row_id) REFERENCES data.import_row(id);


--
-- Name: import_row import_row_batch_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.import_row
    ADD CONSTRAINT import_row_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES data.import_batch(id);


--
-- Name: readiness_exception readiness_exception_rule_key_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.readiness_exception
    ADD CONSTRAINT readiness_exception_rule_key_fkey FOREIGN KEY (rule_key) REFERENCES data.readiness_rule(rule_key) ON DELETE CASCADE;


--
-- Name: readiness_exception readiness_exception_service_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.readiness_exception
    ADD CONSTRAINT readiness_exception_service_id_fkey FOREIGN KEY (service_id) REFERENCES data.service_catalog(id) ON DELETE CASCADE;


--
-- Name: ref_global_service_group ref_global_service_group_portfolio_group_code_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.ref_global_service_group
    ADD CONSTRAINT ref_global_service_group_portfolio_group_code_fkey FOREIGN KEY (portfolio_group_code) REFERENCES data.ref_portfolio_group(code);


--
-- Name: ref_portfolio_group_alias ref_portfolio_group_alias_portfolio_group_code_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.ref_portfolio_group_alias
    ADD CONSTRAINT ref_portfolio_group_alias_portfolio_group_code_fkey FOREIGN KEY (portfolio_group_code) REFERENCES data.ref_portfolio_group(code) ON DELETE CASCADE;


--
-- Name: ref_service_line ref_service_line_global_service_group_code_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.ref_service_line
    ADD CONSTRAINT ref_service_line_global_service_group_code_fkey FOREIGN KEY (global_service_group_code) REFERENCES data.ref_global_service_group(code);


--
-- Name: service_audience_policy service_audience_policy_service_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_audience_policy
    ADD CONSTRAINT service_audience_policy_service_id_fkey FOREIGN KEY (service_id) REFERENCES data.service_catalog(id) ON DELETE CASCADE;


--
-- Name: service_available_on service_available_on_domain_code_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_available_on
    ADD CONSTRAINT service_available_on_domain_code_fkey FOREIGN KEY (domain_code) REFERENCES data.ref_network_domain(code);


--
-- Name: service_available_on service_available_on_service_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_available_on
    ADD CONSTRAINT service_available_on_service_id_fkey FOREIGN KEY (service_id) REFERENCES data.service_catalog(id);


--
-- Name: service_c3_mapping service_c3_mapping_mapping_type_code_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_c3_mapping
    ADD CONSTRAINT service_c3_mapping_mapping_type_code_fkey FOREIGN KEY (mapping_type_code) REFERENCES data.ref_c3_mapping_type(code);


--
-- Name: service_c3_mapping service_c3_mapping_pace_code_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_c3_mapping
    ADD CONSTRAINT service_c3_mapping_pace_code_fkey FOREIGN KEY (pace_code) REFERENCES data.ref_pace_category(code);


--
-- Name: service_c3_mapping service_c3_mapping_service_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_c3_mapping
    ADD CONSTRAINT service_c3_mapping_service_id_fkey FOREIGN KEY (service_id) REFERENCES data.service_catalog(id);


--
-- Name: service_catalog service_catalog_criticality_code_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_catalog
    ADD CONSTRAINT service_catalog_criticality_code_fkey FOREIGN KEY (criticality_code) REFERENCES data.ref_service_criticality(code);


--
-- Name: service_catalog service_catalog_global_service_group_code_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_catalog
    ADD CONSTRAINT service_catalog_global_service_group_code_fkey FOREIGN KEY (global_service_group_code) REFERENCES data.ref_global_service_group(code);


--
-- Name: service_catalog service_catalog_lifecycle_stage_code_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_catalog
    ADD CONSTRAINT service_catalog_lifecycle_stage_code_fkey FOREIGN KEY (lifecycle_stage_code) REFERENCES data.ref_service_lifecycle_stage(code);


--
-- Name: service_catalog service_catalog_organizational_element_code_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_catalog
    ADD CONSTRAINT service_catalog_organizational_element_code_fkey FOREIGN KEY (organizational_element_code) REFERENCES data.ref_organizational_element(code);


--
-- Name: service_catalog service_catalog_portfolio_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_catalog
    ADD CONSTRAINT service_catalog_portfolio_id_fkey FOREIGN KEY (portfolio_id) REFERENCES data.service_portfolio(id) ON DELETE SET NULL;


--
-- Name: service_catalog service_catalog_review_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_catalog
    ADD CONSTRAINT service_catalog_review_owner_user_id_fkey FOREIGN KEY (review_owner_user_id) REFERENCES platform.users(id) ON DELETE SET NULL;


--
-- Name: service_catalog service_catalog_security_classification_code_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_catalog
    ADD CONSTRAINT service_catalog_security_classification_code_fkey FOREIGN KEY (security_classification_code) REFERENCES data.ref_security_classification(code);


--
-- Name: service_catalog service_catalog_service_line_code_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_catalog
    ADD CONSTRAINT service_catalog_service_line_code_fkey FOREIGN KEY (service_line_code) REFERENCES data.ref_service_line(code);


--
-- Name: service_catalog service_catalog_service_type_code_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_catalog
    ADD CONSTRAINT service_catalog_service_type_code_fkey FOREIGN KEY (service_type_code) REFERENCES data.ref_service_type(code);


--
-- Name: service_catalog_source service_catalog_source_service_catalog_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_catalog_source
    ADD CONSTRAINT service_catalog_source_service_catalog_id_fkey FOREIGN KEY (service_catalog_id) REFERENCES data.service_catalog(id) ON DELETE CASCADE;


--
-- Name: service_flavour service_flavour_flavour_status_code_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_flavour
    ADD CONSTRAINT service_flavour_flavour_status_code_fkey FOREIGN KEY (flavour_status_code) REFERENCES data.ref_flavour_status(code);


--
-- Name: service_flavour service_flavour_service_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_flavour
    ADD CONSTRAINT service_flavour_service_id_fkey FOREIGN KEY (service_id) REFERENCES data.service_catalog(id);


--
-- Name: service_offering service_offering_service_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_offering
    ADD CONSTRAINT service_offering_service_id_fkey FOREIGN KEY (service_id) REFERENCES data.service_catalog(id) ON DELETE CASCADE;


--
-- Name: service_operational_link service_operational_link_service_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_operational_link
    ADD CONSTRAINT service_operational_link_service_id_fkey FOREIGN KEY (service_id) REFERENCES data.service_catalog(id) ON DELETE CASCADE;


--
-- Name: service_portfolio service_portfolio_owner_group_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_portfolio
    ADD CONSTRAINT service_portfolio_owner_group_id_fkey FOREIGN KEY (owner_group_id) REFERENCES platform.app_group(id) ON DELETE SET NULL;


--
-- Name: service_raw_field service_raw_field_service_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_raw_field
    ADD CONSTRAINT service_raw_field_service_id_fkey FOREIGN KEY (service_id) REFERENCES data.service_catalog(id);


--
-- Name: service_relation service_relation_from_service_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_relation
    ADD CONSTRAINT service_relation_from_service_id_fkey FOREIGN KEY (from_service_id) REFERENCES data.service_catalog(id);


--
-- Name: service_relation service_relation_pace_code_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_relation
    ADD CONSTRAINT service_relation_pace_code_fkey FOREIGN KEY (pace_code) REFERENCES data.ref_pace_category(code);


--
-- Name: service_relation_raw service_relation_raw_service_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_relation_raw
    ADD CONSTRAINT service_relation_raw_service_id_fkey FOREIGN KEY (service_id) REFERENCES data.service_catalog(id);


--
-- Name: service_relation service_relation_relation_type_code_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_relation
    ADD CONSTRAINT service_relation_relation_type_code_fkey FOREIGN KEY (relation_type_code) REFERENCES data.ref_relation_type(code);


--
-- Name: service_relation service_relation_to_service_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_relation
    ADD CONSTRAINT service_relation_to_service_id_fkey FOREIGN KEY (to_service_id) REFERENCES data.service_catalog(id);


--
-- Name: service_role_assignment service_role_assignment_role_code_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_role_assignment
    ADD CONSTRAINT service_role_assignment_role_code_fkey FOREIGN KEY (role_code) REFERENCES data.ref_service_role(code);


--
-- Name: service_role_assignment service_role_assignment_service_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_role_assignment
    ADD CONSTRAINT service_role_assignment_service_id_fkey FOREIGN KEY (service_id) REFERENCES data.service_catalog(id);


--
-- Name: service_sla service_sla_flavour_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_sla
    ADD CONSTRAINT service_sla_flavour_id_fkey FOREIGN KEY (flavour_id) REFERENCES data.service_flavour(id);


--
-- Name: service_sla service_sla_service_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_sla
    ADD CONSTRAINT service_sla_service_id_fkey FOREIGN KEY (service_id) REFERENCES data.service_catalog(id);


--
-- Name: service_sla service_sla_support_window_code_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_sla
    ADD CONSTRAINT service_sla_support_window_code_fkey FOREIGN KEY (support_window_code) REFERENCES data.ref_support_window(code);


--
-- Name: service_support_model service_support_model_service_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.service_support_model
    ADD CONSTRAINT service_support_model_service_id_fkey FOREIGN KEY (service_id) REFERENCES data.service_catalog(id) ON DELETE CASCADE;


--
-- Name: taxonomy_mapping_audit taxonomy_mapping_audit_service_id_fkey; Type: FK CONSTRAINT; Schema: data; Owner: -
--

ALTER TABLE ONLY data.taxonomy_mapping_audit
    ADD CONSTRAINT taxonomy_mapping_audit_service_id_fkey FOREIGN KEY (service_id) REFERENCES data.service_catalog(id);


--
-- Name: app_group_permission app_group_permission_group_id_fkey; Type: FK CONSTRAINT; Schema: platform; Owner: -
--

ALTER TABLE ONLY platform.app_group_permission
    ADD CONSTRAINT app_group_permission_group_id_fkey FOREIGN KEY (group_id) REFERENCES platform.app_group(id) ON DELETE CASCADE;


--
-- Name: app_user_group app_user_group_group_id_fkey; Type: FK CONSTRAINT; Schema: platform; Owner: -
--

ALTER TABLE ONLY platform.app_user_group
    ADD CONSTRAINT app_user_group_group_id_fkey FOREIGN KEY (group_id) REFERENCES platform.app_group(id) ON DELETE CASCADE;


--
-- Name: module_installation_history module_installation_history_module_code_fkey; Type: FK CONSTRAINT; Schema: platform; Owner: -
--

ALTER TABLE ONLY platform.module_installation_history
    ADD CONSTRAINT module_installation_history_module_code_fkey FOREIGN KEY (module_code) REFERENCES platform.module_registry(module_code) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: platform; Owner: -
--

ALTER TABLE ONLY platform.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES platform.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--



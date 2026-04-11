-- =============================================================================
-- PostgreSQL bootstrap — Service Catalogue
-- Creates the logical schemas for the platform and data layers.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS platform;
CREATE SCHEMA IF NOT EXISTS data;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

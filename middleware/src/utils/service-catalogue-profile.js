'use strict';

const PROFILES = {
    's3c-service-catalogue-json': {
        key: 's3c-service-catalogue-json',
        label: 'S3C service catalogue JSON',
        mode: 'direct',
        format: 'json',
        required_fields: ['service_id', 'title'],
        description: 'Native JSON payload with items and optional relations arrays.',
    },
    's3c-service-catalogue-csv': {
        key: 's3c-service-catalogue-csv',
        label: 'S3C service catalogue CSV',
        mode: 'direct',
        format: 'csv',
        required_fields: ['service_id', 'title'],
        description: 'Native CSV payload using service catalogue column names.',
    },
    'backstage-catalog-info': {
        key: 'backstage-catalog-info',
        label: 'Backstage catalog-info',
        mode: 'direct',
        format: 'yaml',
        required_fields: ['metadata.name', 'spec.owner'],
        description: 'Backstage Component catalog-info YAML mapped to service ownership metadata.',
    },
    'archimate-reference': {
        key: 'archimate-reference',
        label: 'ArchiMate reference mapping',
        mode: 'reference',
        format: 'documentation',
        required_fields: [],
        description: 'Reference mapping only; use S3C JSON/CSV for direct import.',
    },
    'itop-reference': {
        key: 'itop-reference',
        label: 'iTop reference mapping',
        mode: 'reference',
        format: 'documentation',
        required_fields: [],
        description: 'Reference mapping only; s3c-manager is not an iTop CMDB clone.',
    },
    'servicenow-csdm-reference': {
        key: 'servicenow-csdm-reference',
        label: 'ServiceNow CSDM reference mapping',
        mode: 'reference',
        format: 'documentation',
        required_fields: [],
        description: 'Reference mapping only; use when aligning service/capability fields to CSDM concepts.',
    },
};

function normalizeProfileKey(value, fallback = 's3c-service-catalogue-json') {
    return String(value || fallback).trim().toLowerCase();
}

function getProfile(value, fallback) {
    const key = normalizeProfileKey(value, fallback);
    const profile = PROFILES[key];
    if (!profile) {
        const err = new Error(`Unsupported import profile: ${key}`);
        err.status = 400;
        throw err;
    }
    return profile;
}

function listProfiles() {
    return Object.values(PROFILES);
}

module.exports = {
    PROFILES,
    normalizeProfileKey,
    getProfile,
    listProfiles,
};

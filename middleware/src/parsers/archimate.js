'use strict';

const TYPE_TO_TARGET = {
    BusinessProcess: { targetKey: 'business-processes', itemType: 'BP' },
    BusinessRole: { targetKey: 'business-roles', itemType: 'BR' },
    COIService: { targetKey: 'coi-services', itemType: 'CI' },
    CommunicationsService: { targetKey: 'communications-services', itemType: 'CO' },
    CoreService: { targetKey: 'core-services', itemType: 'CR' },
    UserApplication: { targetKey: 'user-applications', itemType: 'UA' },
    Capability: { targetKey: 'capabilities', itemType: 'CP' },
};

const TARGET_TYPE_ALIASES = {
    'coi-services': { archimateType: 'TechnologyService', itemType: 'CI' },
    'communications-services': { archimateType: 'TechnologyService', itemType: 'CO' },
    'core-services': { archimateType: 'TechnologyService', itemType: 'CR' },
    'user-applications': { archimateType: 'ApplicationService', itemType: 'UA' },
};

const KNOWN_PROPERTY_REFS = new Set(['propid-10', 'propid-15', 'propid-20', 'propid-25', 'propid-30', 'propid-35', 'propid-40', 'propid-45', 'propid-50', 's5524-stereotype']);

class ArchimateParserError extends Error {
    constructor(message) {
        super(`ArchiMate parser: ${message}`);
        this.name = 'ArchimateParserError';
    }
}

function decodeXml(value) {
    return String(value ?? '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');
}

function normalizeIdentifier(value) {
    return String(value ?? '').trim().replace(/^id-/i, '');
}

function readAttribute(xml, name) {
    const match = xml.match(new RegExp(`${name}="([^"]*)"`, 'i'));
    return match ? decodeXml(match[1]) : null;
}

function readLocalizedTag(xml, tagName) {
    const localized = xml.match(new RegExp(`<${tagName}[^>]*(?:xml:lang|lang)="en"[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
    if (localized) return decodeXml(localized[1]).trim();
    const fallback = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
    return fallback ? decodeXml(fallback[1]).trim() : null;
}

function readProperties(xml, issues) {
    const properties = {};
    const propertyRegex = /<property\b[^>]*propertyDefinitionRef="([^"]+)"[^>]*>[\s\S]*?<value[^>]*>([\s\S]*?)<\/value>[\s\S]*?<\/property>/gi;
    for (const match of xml.matchAll(propertyRegex)) {
        const ref = decodeXml(match[1]).trim();
        const value = decodeXml(match[2]).trim();
        properties[ref] = value;
        if (!KNOWN_PROPERTY_REFS.has(ref)) {
            issues.push({
                severity: 'warn',
                issue_code: 'UNKNOWN_ARCHIMATE_PROPERTY',
                field_name: ref,
                raw_value: value,
                message: `Unknown ArchiMate propertyDefinitionRef "${ref}" was ignored.`,
            });
        }
    }
    return properties;
}

function externalIdFromUrl(value) {
    const text = String(value ?? '').trim();
    if (!text) return null;
    return decodeURIComponent(text.split('/').pop() ?? text).slice(0, 200);
}

function parseArchimateXml(xmlText, { targetKey = null } = {}) {
    const xml = String(xmlText ?? '').replace(/^\uFEFF/, '');
    if (!/<model\b/i.test(xml) || !/<elements\b/i.test(xml)) {
        throw new ArchimateParserError('input is not an ArchiMate model with elements');
    }

    const rows = [];
    const issues = [];
    const elementRegex = /<element\b[^>]*xsi:type="([^"]+)"[^>]*identifier="([^"]+)"[^>]*>([\s\S]*?)<\/element>/gi;

    for (const match of xml.matchAll(elementRegex)) {
        const type = decodeXml(match[1]).trim();
        const target = TYPE_TO_TARGET[type] ?? (
            targetKey && TARGET_TYPE_ALIASES[targetKey]?.archimateType === type
                ? { targetKey, itemType: TARGET_TYPE_ALIASES[targetKey].itemType }
                : null
        );
        if (!target) {
            issues.push({
                severity: 'warn',
                issue_code: 'UNSUPPORTED_ARCHIMATE_ELEMENT',
                field_name: 'xsi:type',
                raw_value: type,
                message: `Unsupported ArchiMate element type "${type}" was ignored.`,
            });
            continue;
        }
        if (targetKey && target.targetKey !== targetKey) continue;

        const identifier = normalizeIdentifier(match[2]);
        const body = match[3];
        const properties = readProperties(body, issues);
        const uuidMirror = normalizeIdentifier(properties['propid-40']);
        if (uuidMirror && uuidMirror !== identifier) {
            issues.push({
                severity: 'warn',
                issue_code: 'UUID_MIRROR_MISMATCH',
                field_name: 'propid-40',
                raw_value: properties['propid-40'],
                message: `propid-40 does not match element identifier ${identifier}.`,
            });
        }

        rows.push({
            uuid: uuidMirror || identifier,
            title: readLocalizedTag(body, 'name') || identifier,
            description: readLocalizedTag(body, 'documentation'),
            external_id: externalIdFromUrl(properties['propid-45']) || properties['propid-50'] || identifier,
            source_external_id: properties['propid-50'] || null,
            data_source: 'archimate-xml',
            data_qualifier: properties['propid-30'] || null,
            provenance_raw: properties['propid-25'] || null,
            references_raw: properties['propid-45'] || null,
            item_type: target.itemType,
            archimate_type: type,
            target_key: target.targetKey,
        });
    }

    if (rows.length === 0) {
        throw new ArchimateParserError(targetKey ? `no supported elements found for target "${targetKey}"` : 'no supported elements found');
    }

    return {
        rows,
        issues,
        row_count: rows.length,
        target_key: targetKey ?? rows[0]?.target_key ?? null,
    };
}

function isArchimateParserError(err) {
    return err instanceof ArchimateParserError || String(err?.message ?? '').startsWith('ArchiMate parser:');
}

module.exports = {
    TYPE_TO_TARGET,
    ArchimateParserError,
    parseArchimateXml,
    isArchimateParserError,
};

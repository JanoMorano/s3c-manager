'use strict';

function stripQuotes(value) {
    const trimmed = String(value ?? '').trim();
    return trimmed.replace(/^['"]|['"]$/g, '');
}

function slug(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'service';
}

function parseScalar(line) {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) return null;
    return [match[1].trim(), stripQuotes(match[2])];
}

function parseOneDocument(text) {
    const metadata = {};
    const annotations = {};
    const spec = {};
    let kind = '';
    let section = '';

    for (const rawLine of String(text || '').split(/\r?\n/)) {
        if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue;
        const indent = rawLine.match(/^\s*/)?.[0].length ?? 0;
        const line = rawLine.trim();

        if (indent === 0) {
            section = '';
            if (line === 'metadata:') { section = 'metadata'; continue; }
            if (line === 'spec:') { section = 'spec'; continue; }
            const scalar = parseScalar(line);
            if (scalar?.[0] === 'kind') kind = scalar[1];
            continue;
        }

        if (section === 'metadata' && indent === 2 && line === 'annotations:') {
            section = 'annotations';
            continue;
        }

        const scalar = parseScalar(line);
        if (!scalar) continue;
        const [key, value] = scalar;
        if (section === 'metadata' && indent === 2) metadata[key] = value;
        if (section === 'annotations' && indent >= 4) annotations[key] = value;
        if (section === 'spec' && indent === 2) spec[key] = value;
    }

    if (String(kind).toLowerCase() !== 'component') return null;
    const serviceId = annotations['s3c/service-id'] || metadata.name?.toUpperCase().replace(/[^A-Z0-9]+/g, '-');
    if (!metadata.name && !serviceId) return null;

    return {
        service_id: serviceId,
        title: metadata.title || metadata.name || serviceId,
        summary: metadata.description || null,
        service_type: spec.type || 'service',
        service_status: spec.lifecycle || null,
        service_owner: spec.owner || null,
        portfolio_group_code: spec.system || null,
        source_url: annotations['backstage.io/source-location'] || null,
        notes: JSON.stringify({
            backstage: {
                name: metadata.name || null,
                owner: spec.owner || null,
                system: spec.system || null,
            },
        }),
    };
}

function parseBackstageCatalogInfo(text) {
    const documents = String(text || '')
        .split(/^---\s*$/m)
        .map((doc) => doc.trim())
        .filter(Boolean);
    const items = documents
        .map(parseOneDocument)
        .filter(Boolean);
    return {
        items,
        relations: [],
        source: 'backstage-catalog-info',
    };
}

function yamlEscape(value) {
    const text = String(value ?? '');
    if (!text) return '';
    if (/\n|['"]|(^|\s)#|:\s/.test(text)) return JSON.stringify(text);
    return text;
}

function generateBackstageCatalogInfo(services = []) {
    return services.map((service) => {
        const name = slug(service.service_id || service.title);
        return [
            'apiVersion: backstage.io/v1alpha1',
            'kind: Component',
            'metadata:',
            `  name: ${name}`,
            `  title: ${yamlEscape(service.title || service.service_id || name)}`,
            service.summary ? `  description: ${yamlEscape(service.summary)}` : null,
            '  annotations:',
            `    s3c/service-id: ${yamlEscape(service.service_id || name)}`,
            'spec:',
            `  type: ${yamlEscape(service.service_type || 'service')}`,
            `  lifecycle: ${yamlEscape(service.lifecycle_stage_code || service.service_status || 'production')}`,
            `  owner: ${yamlEscape(service.service_owner || service.owner || 'group:unknown')}`,
            service.portfolio_group ? `  system: ${yamlEscape(service.portfolio_group)}` : null,
        ].filter(Boolean).join('\n');
    }).join('\n---\n');
}

module.exports = {
    parseBackstageCatalogInfo,
    generateBackstageCatalogInfo,
};

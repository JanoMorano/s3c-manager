'use strict';

const zlib = require('zlib');

const ZIP_EOCD_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_DIR_SIGNATURE = 0x02014b50;
const ZIP_LOCAL_FILE_SIGNATURE = 0x04034b50;
const ZIP_LIMITS = Object.freeze({
    MAX_ZIP_ENTRIES: 128,
    MAX_SINGLE_ENTRY_UNCOMPRESSED_BYTES: 8 * 1024 * 1024,
    MAX_TOTAL_UNCOMPRESSED_BYTES: 16 * 1024 * 1024,
    MAX_COMPRESSION_RATIO: 100,
});

function decodeXmlEntities(value) {
    return String(value ?? '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, '\'')
        .replace(/&amp;/g, '&')
        .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number.parseInt(code, 10)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function findEndOfCentralDirectory(buffer) {
    const minOffset = Math.max(0, buffer.length - 0x10000 - 22);
    for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
        if (buffer.readUInt32LE(offset) === ZIP_EOCD_SIGNATURE) {
            return offset;
        }
    }
    throw new Error('XLSX parser: end of central directory not found');
}

function listZipEntries(buffer) {
    const eocdOffset = findEndOfCentralDirectory(buffer);
    const entryCount = buffer.readUInt16LE(eocdOffset + 10);
    if (entryCount > ZIP_LIMITS.MAX_ZIP_ENTRIES) {
        throw new Error(`XLSX parser: ZIP entry count exceeds limit (${entryCount} > ${ZIP_LIMITS.MAX_ZIP_ENTRIES})`);
    }

    const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
    const entries = new Map();
    let cursor = centralDirectoryOffset;
    let totalUncompressedBytes = 0;

    for (let index = 0; index < entryCount; index += 1) {
        if (buffer.readUInt32LE(cursor) !== ZIP_CENTRAL_DIR_SIGNATURE) {
            throw new Error('XLSX parser: invalid central directory entry');
        }

        const compressionMethod = buffer.readUInt16LE(cursor + 10);
        const compressedSize = buffer.readUInt32LE(cursor + 20);
        const uncompressedSize = buffer.readUInt32LE(cursor + 24);
        const fileNameLength = buffer.readUInt16LE(cursor + 28);
        const extraFieldLength = buffer.readUInt16LE(cursor + 30);
        const fileCommentLength = buffer.readUInt16LE(cursor + 32);
        const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
        const fileName = buffer.toString('utf8', cursor + 46, cursor + 46 + fileNameLength);

        if (uncompressedSize > ZIP_LIMITS.MAX_SINGLE_ENTRY_UNCOMPRESSED_BYTES) {
            throw new Error(
                `XLSX parser: ZIP entry ${fileName || index + 1} exceeds uncompressed size limit (${uncompressedSize} > ${ZIP_LIMITS.MAX_SINGLE_ENTRY_UNCOMPRESSED_BYTES})`
            );
        }

        const compressedBytes = compressedSize > 0 ? compressedSize : (uncompressedSize === 0 ? 1 : 0);
        if (compressedBytes === 0 || (uncompressedSize / compressedBytes) > ZIP_LIMITS.MAX_COMPRESSION_RATIO) {
            throw new Error(
                `XLSX parser: ZIP entry ${fileName || index + 1} exceeds compression ratio limit (${uncompressedSize}:${compressedSize})`
            );
        }

        totalUncompressedBytes += uncompressedSize;
        if (totalUncompressedBytes > ZIP_LIMITS.MAX_TOTAL_UNCOMPRESSED_BYTES) {
            throw new Error(
                `XLSX parser: ZIP total uncompressed size exceeds limit (${totalUncompressedBytes} > ${ZIP_LIMITS.MAX_TOTAL_UNCOMPRESSED_BYTES})`
            );
        }

        entries.set(fileName, {
            fileName,
            compressionMethod,
            compressedSize,
            uncompressedSize,
            localHeaderOffset,
        });

        cursor += 46 + fileNameLength + extraFieldLength + fileCommentLength;
    }

    return entries;
}

function readZipEntry(buffer, entries, entryName) {
    const entry = entries.get(entryName);
    if (!entry) return null;

    const headerOffset = entry.localHeaderOffset;
    if (buffer.readUInt32LE(headerOffset) !== ZIP_LOCAL_FILE_SIGNATURE) {
        throw new Error(`XLSX parser: invalid local header for ${entryName}`);
    }

    const fileNameLength = buffer.readUInt16LE(headerOffset + 26);
    const extraFieldLength = buffer.readUInt16LE(headerOffset + 28);
    const dataStart = headerOffset + 30 + fileNameLength + extraFieldLength;
    const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize);

    if (entry.compressionMethod === 0) {
        return compressed;
    }
    if (entry.compressionMethod === 8) {
        return zlib.inflateRawSync(compressed);
    }

    throw new Error(`XLSX parser: unsupported compression method ${entry.compressionMethod}`);
}

function extractWorkbookSheet(workbookXml) {
    const match = workbookXml.match(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/);
    if (!match) throw new Error('XLSX parser: workbook has no sheets');
    return {
        sheetName: decodeXmlEntities(match[1]),
        relationId: match[2],
    };
}

function extractRelationshipTarget(relsXml, relationId) {
    const relationships = [...relsXml.matchAll(/<Relationship\b([^>]*)\/?>/gi)];
    const match = relationships.find((relationshipMatch) => {
        const attributes = relationshipMatch[1] ?? '';
        return new RegExp(`\\bId="${relationId}"`, 'i').test(attributes);
    });
    if (!match) throw new Error(`XLSX parser: relationship ${relationId} not found`);
    const target = match[1].match(/\bTarget="([^"]+)"/i)?.[1];
    if (!target) throw new Error(`XLSX parser: relationship ${relationId} target missing`);
    return target.replace(/^\/+/, '').startsWith('xl/')
        ? target.replace(/^\/+/, '')
        : `xl/${target.replace(/^\/+/, '')}`;
}

function parseSharedStrings(sharedStringsXml) {
    if (!sharedStringsXml) return [];
    const strings = [];
    const regex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
    let match;
    while ((match = regex.exec(sharedStringsXml)) !== null) {
        const textParts = [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
            .map((textMatch) => decodeXmlEntities(textMatch[1]));
        strings.push(textParts.join(''));
    }
    return strings;
}

function columnRefToIndex(cellRef) {
    const letters = String(cellRef ?? '').match(/[A-Z]+/i)?.[0] ?? '';
    let value = 0;
    for (const char of letters.toUpperCase()) {
        value = (value * 26) + (char.charCodeAt(0) - 64);
    }
    return Math.max(0, value - 1);
}

function parseWorksheetRows(sheetXml, sharedStrings) {
    const rows = [];
    const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
        const row = [];
        const cellRegex = /<c\b([^>]*)\/>|<c\b([^>]*)>([\s\S]*?)<\/c>/g;
        let cellMatch;

        while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
            const attributes = cellMatch[1] || cellMatch[2] || '';
            const body = cellMatch[3] || '';
            const refMatch = attributes.match(/\br="([^"]+)"/);
            const typeMatch = attributes.match(/\bt="([^"]+)"/);
            const index = columnRefToIndex(refMatch?.[1] ?? '');
            const cellType = typeMatch?.[1] ?? '';

            let value = '';
            if (cellType === 'inlineStr') {
                const textParts = [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
                    .map((textMatch) => decodeXmlEntities(textMatch[1]));
                value = textParts.join('');
            } else {
                const rawValue = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? '';
                if (cellType === 's') {
                    value = sharedStrings[Number.parseInt(rawValue, 10)] ?? '';
                } else if (cellType === 'b') {
                    value = rawValue === '1' ? 'true' : 'false';
                } else {
                    value = decodeXmlEntities(rawValue);
                }
            }

            row[index] = value;
        }

        rows.push(row);
    }

    return rows;
}

function rowsToObjects(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
        return { headers: [], rows: [] };
    }

    const headers = rows[0].map((header, index) => String(header ?? '').trim() || `column_${index + 1}`);
    const objects = rows
        .slice(1)
        .map((row) => {
            const record = {};
            headers.forEach((header, index) => {
                const value = row[index];
                record[header] = value == null || value === '' ? null : String(value);
            });
            return record;
        })
        .filter((record) => Object.values(record).some((value) => value != null && String(value).trim() !== ''));

    return { headers, rows: objects };
}

function parseSimpleXlsxBuffer(input) {
    const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
    const entries = listZipEntries(buffer);
    const workbookXml = readZipEntry(buffer, entries, 'xl/workbook.xml')?.toString('utf8');
    const relsXml = readZipEntry(buffer, entries, 'xl/_rels/workbook.xml.rels')?.toString('utf8');
    if (!workbookXml || !relsXml) throw new Error('XLSX parser: workbook metadata missing');

    const { sheetName, relationId } = extractWorkbookSheet(workbookXml);
    const sheetPath = extractRelationshipTarget(relsXml, relationId);
    const sheetXml = readZipEntry(buffer, entries, sheetPath)?.toString('utf8');
    if (!sheetXml) throw new Error(`XLSX parser: worksheet ${sheetPath} not found`);

    const sharedStringsXml = readZipEntry(buffer, entries, 'xl/sharedStrings.xml')?.toString('utf8') ?? null;
    const sharedStrings = parseSharedStrings(sharedStringsXml);
    const parsedRows = parseWorksheetRows(sheetXml, sharedStrings);
    const { headers, rows } = rowsToObjects(parsedRows);

    return {
        sheetName,
        headers,
        rows,
    };
}

module.exports = {
    parseSimpleXlsxBuffer,
    ZIP_LIMITS,
};

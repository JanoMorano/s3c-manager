'use strict';

const zlib = require('node:zlib');

const { parseSimpleXlsxBuffer } = require('../utils/simple-xlsx');

const ZIP_LOCAL_FILE_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_DIR_SIGNATURE = 0x02014b50;
const ZIP_EOCD_SIGNATURE = 0x06054b50;

function u16(value) {
    const buffer = Buffer.alloc(2);
    buffer.writeUInt16LE(value);
    return buffer;
}

function u32(value) {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32LE(value >>> 0);
    return buffer;
}

function buildZip(entries, entryCountOverride = null) {
    const localParts = [];
    const centralParts = [];
    let localOffset = 0;

    for (const entry of entries) {
        const fileNameBuffer = Buffer.from(entry.fileName, 'utf8');
        const extraBuffer = Buffer.alloc(0);
        const dataLength = typeof entry.actualDataLength === 'number' ? entry.actualDataLength : Math.max(0, entry.compressedSize ?? 1);
        const dataBuffer = Buffer.alloc(dataLength, 0);
        const compressedSize = entry.compressedSize ?? dataBuffer.length;
        const uncompressedSize = entry.uncompressedSize ?? dataBuffer.length;
        const compressionMethod = entry.compressionMethod ?? 0;

        const localHeader = Buffer.concat([
            u32(ZIP_LOCAL_FILE_SIGNATURE),
            u16(20),
            u16(0),
            u16(compressionMethod),
            u16(0),
            u16(0),
            u32(0),
            u32(compressedSize),
            u32(uncompressedSize),
            u16(fileNameBuffer.length),
            u16(extraBuffer.length),
            fileNameBuffer,
            extraBuffer,
            dataBuffer,
        ]);
        localParts.push(localHeader);

        const centralHeader = Buffer.concat([
            u32(ZIP_CENTRAL_DIR_SIGNATURE),
            u16(20),
            u16(20),
            u16(0),
            u16(compressionMethod),
            u16(0),
            u16(0),
            u32(0),
            u32(compressedSize),
            u32(uncompressedSize),
            u16(fileNameBuffer.length),
            u16(extraBuffer.length),
            u16(0),
            u16(0),
            u16(0),
            u32(0),
            u32(localOffset),
            fileNameBuffer,
            extraBuffer,
        ]);
        centralParts.push(centralHeader);

        localOffset += localHeader.length;
    }

    const localBuffer = Buffer.concat(localParts);
    const centralBuffer = Buffer.concat(centralParts);
    const eocdEntryCount = entryCountOverride ?? entries.length;

    const eocd = Buffer.concat([
        u32(ZIP_EOCD_SIGNATURE),
        u16(0),
        u16(0),
        u16(eocdEntryCount),
        u16(eocdEntryCount),
        u32(centralBuffer.length),
        u32(localBuffer.length),
        u16(0),
    ]);

    return Buffer.concat([localBuffer, centralBuffer, eocd]);
}

describe('simple xlsx parser safeguards', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('rejects archives with too many ZIP entries before inflating', () => {
        const inflateSpy = jest.spyOn(zlib, 'inflateRawSync').mockImplementation(() => {
            throw new Error('inflateRawSync should not be called');
        });
        const entries = Array.from({ length: 129 }, (_, index) => ({
            fileName: `xl/entry-${String(index + 1).padStart(3, '0')}.xml`,
            compressedSize: 1,
            uncompressedSize: 1,
            actualDataLength: 1,
        }));

        expect(() => parseSimpleXlsxBuffer(buildZip(entries))).toThrow(/zip entry count/i);
        expect(inflateSpy).not.toHaveBeenCalled();
    });

    test('rejects entries whose uncompressed size exceeds the budget before inflating', () => {
        const inflateSpy = jest.spyOn(zlib, 'inflateRawSync').mockImplementation(() => {
            throw new Error('inflateRawSync should not be called');
        });
        const oversizedBytes = 8 * 1024 * 1024 + 1;
        const buffer = buildZip([
            {
                fileName: 'xl/workbook.xml',
                compressionMethod: 0,
                compressedSize: 1,
                uncompressedSize: oversizedBytes,
                actualDataLength: 1,
            },
            {
                fileName: 'xl/_rels/workbook.xml.rels',
                compressionMethod: 0,
                compressedSize: 1,
                uncompressedSize: 1,
                actualDataLength: 1,
            },
        ]);

        expect(() => parseSimpleXlsxBuffer(buffer)).toThrow(/uncompressed size/i);
        expect(inflateSpy).not.toHaveBeenCalled();
    });

    test('rejects extreme compression ratios before inflating', () => {
        const inflateSpy = jest.spyOn(zlib, 'inflateRawSync').mockImplementation(() => {
            throw new Error('inflateRawSync should not be called');
        });
        const buffer = buildZip([
            {
                fileName: 'xl/workbook.xml',
                compressionMethod: 8,
                compressedSize: 1,
                uncompressedSize: 1024 * 1024,
                actualDataLength: 1,
            },
            {
                fileName: 'xl/_rels/workbook.xml.rels',
                compressionMethod: 0,
                compressedSize: 1,
                uncompressedSize: 1,
                actualDataLength: 1,
            },
        ]);

        expect(() => parseSimpleXlsxBuffer(buffer)).toThrow(/compression ratio/i);
        expect(inflateSpy).not.toHaveBeenCalled();
    });
});

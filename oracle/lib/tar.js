/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

/**
 * A minimal, dependency-free ustar reader and deterministic writer, so the
 * corpus tarball can be built and unpacked the same way on every platform,
 * without GNU tar.
 *
 * The writer emits regular files only, in the order given, with mode 0644,
 * uid/gid 0, empty user/group names and mtime 0, so the same files always
 * give the same bytes. The reader understands regular files, directories,
 * ustar name prefixes, and pax extended headers (only their `path`); it skips
 * macOS AppleDouble (`._*`) entries and every other entry type.
 */

const zlib = require('zlib');

const BLOCK = 512;

/**
 * @param {Buffer} buf header block
 * @param {number} off offset
 * @param {number} len length
 * @returns {string} NUL-terminated string
 */
function str(buf, off, len) {
    const end = buf.indexOf(0, off);
    return buf.toString('utf8', off, end >= 0 && end < off + len ? end : off + len);
}

/**
 * @param {Buffer} buf header block
 * @param {number} off offset
 * @param {number} len length
 * @returns {number} octal field
 */
function octal(buf, off, len) {
    const s = str(buf, off, len).trim();
    return s ? parseInt(s, 8) : 0;
}

/**
 * Split a path into ustar (prefix, name).
 * @param {string} p path, '/'-separated
 * @returns {{prefix: string, name: string}} fields
 */
function splitPath(p) {
    if (Buffer.byteLength(p) <= 100) {
        return { prefix: '', name: p };
    }
    for (let i = p.lastIndexOf('/'); i > 0; i = p.lastIndexOf('/', i - 1)) {
        const prefix = p.slice(0, i);
        const name = p.slice(i + 1);
        if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(name) <= 100) {
            return { prefix, name };
        }
    }
    throw new Error(`path too long for ustar: ${p}`);
}

/**
 * One ustar header block.
 * @param {string} p path
 * @param {number} size file size
 * @returns {Buffer} header
 */
function header(p, size) {
    const h = Buffer.alloc(BLOCK, 0);
    const { prefix, name } = splitPath(p);
    h.write(name, 0, 100, 'utf8');
    h.write('0000644\0', 100, 8, 'ascii');
    h.write('0000000\0', 108, 8, 'ascii');
    h.write('0000000\0', 116, 8, 'ascii');
    h.write(size.toString(8).padStart(11, '0') + '\0', 124, 12, 'ascii');
    h.write('00000000000\0', 136, 12, 'ascii');
    h.fill(0x20, 148, 156);
    h.write('0', 156, 1, 'ascii');
    h.write('ustar\0', 257, 6, 'ascii');
    h.write('00', 263, 2, 'ascii');
    h.write(prefix, 345, 155, 'utf8');
    let sum = 0;
    for (let i = 0; i < BLOCK; i++) {
        sum += h[i];
    }
    h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
    return h;
}

/**
 * Build an uncompressed ustar archive.
 * @param {{path: string, data: Buffer}[]} entries files, in archive order
 * @returns {Buffer} tar bytes
 */
function writeTar(entries) {
    const parts = [];
    for (const e of entries) {
        parts.push(header(e.path, e.data.length), e.data);
        const pad = (BLOCK - (e.data.length % BLOCK)) % BLOCK;
        if (pad) {
            parts.push(Buffer.alloc(pad, 0));
        }
    }
    parts.push(Buffer.alloc(BLOCK * 2, 0));
    return Buffer.concat(parts);
}

/**
 * Gzip with a fixed header (no name, mtime 0, OS byte 3), like `gzip -n`.
 * @param {Buffer} buf data
 * @returns {Buffer} gzip bytes
 */
function gzipDeterministic(buf) {
    const gz = zlib.gzipSync(buf, { level: 9 });
    gz.writeUInt32LE(0, 4);
    gz[8] = 2;
    gz[9] = 3;
    return gz;
}

/**
 * Read a tar (optionally gzipped) archive.
 * @param {Buffer} buf archive bytes
 * @returns {{path: string, data: Buffer}[]} regular files
 */
function readTar(buf) {
    const tar = buf[0] === 0x1f && buf[1] === 0x8b ? zlib.gunzipSync(buf) : buf;
    const out = [];
    let off = 0;
    let paxPath = null;
    while (off + BLOCK <= tar.length) {
        const h = tar.subarray(off, off + BLOCK);
        if (h.every((b) => b === 0)) {
            break;
        }
        const size = octal(h, 124, 12);
        const type = String.fromCharCode(h[156] || 0x30);
        const prefix = str(h, 345, 155);
        let p = prefix ? `${prefix}/${str(h, 0, 100)}` : str(h, 0, 100);
        const data = tar.subarray(off + BLOCK, off + BLOCK + size);
        off += BLOCK + Math.ceil(size / BLOCK) * BLOCK;
        if (type === 'x') {
            const m = /(?:^|\n)\d+ path=([^\n]*)\n/.exec(data.toString('utf8'));
            paxPath = m ? m[1] : null;
            continue;
        }
        if (type === 'g') {
            continue;
        }
        if (paxPath !== null) {
            p = paxPath;
            paxPath = null;
        }
        const base = p.split('/').pop();
        if ((type === '0' || type === '\0') && !base.startsWith('._')) {
            out.push({ path: p.replace(/^\.\//, ''), data: Buffer.from(data) });
        }
    }
    return out;
}

module.exports = { writeTar, readTar, gzipDeterministic };

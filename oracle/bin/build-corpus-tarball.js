#!/usr/bin/env node
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
 * Build the corpus release asset from the two archives it was recorded as:
 * the pinned corpus and its additive supplement. Maintainers run this; users
 * download the result with bin/fetch-corpus.js.
 *
 *   node oracle/bin/build-corpus-tarball.js --pin <oracle-corpus-p107-06aa375.tgz> \
 *       --supplement <oracle-corpus-supplement-d842c0ab7.tgz> --out <dir> [--write-config]
 *
 * Each source archive is checked against its recorded content hash (the
 * sha256 of the "<sha256>  <path>\n" lines of its files, sorted by path),
 * the supplement must not change any file of the pinned corpus, and the two
 * are merged into `oracle-corpus/` (fixtures/, cto-cache/, CORPUS.json).
 * Absolute paths of the recording machine are then rewritten (see
 * scrubPaths), which re-identifies the fixtures and blobs they occur in.
 * The tarball is deterministic: entries sorted by path, mode 0644, uid/gid 0,
 * mtime 0, and a gzip header with no name and mtime 0. The uncompressed tar's
 * sha256 (`tar_sha256`) depends only on the files; the .tgz's sha256 also
 * depends on Node's bundled zlib, so both are recorded.
 *
 * --write-config records the result in oracle/corpus.json, which
 * bin/fetch-corpus.js verifies downloads against.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { readTar, writeTar, gzipDeterministic } = require('../lib/tar');
const { sortedStringify } = require('../lib/canon');

const VERSION = '5.0.0';
const TOP = 'oracle-corpus';
const SOURCE_PREFIX = 'migration/oracle/';

// The recorded identity of each source archive.
const SOURCES = {
    pin: {
        asset: 'oracle-corpus-p107-06aa375.tgz',
        recordedFrom: 'accordproject/concerto@06aa375a6',
        contentHash: '7b9be1de66690be63e689b3bf0feb4583ed6cd9597099fdec1acb32f87736e71',
        // the hash spans every file of the archive under migration/oracle/
        hashed: () => true,
    },
    supplement: {
        asset: 'oracle-corpus-supplement-d842c0ab7.tgz',
        recordedFrom: 'accordproject/concerto@d842c0ab7',
        contentHash: '1b3bf6a55c70826d9fc79530792e482e17c122ce83ec49595bb15ddfa90cdbeb',
        // the hash spans the supplement's own fixture files only
        hashed: (p) => p.startsWith('migration/oracle/fixtures/supplement/') && !p.endsWith('/manifest.json'),
    },
};

/**
 * @param {Buffer|string} b data
 * @returns {string} sha256 hex
 */
function sha256(b) {
    return crypto.createHash('sha256').update(b).digest('hex');
}

/**
 * @param {string} a path
 * @param {string} b path
 * @returns {number} byte-order comparison
 */
function byPath(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Content hash of a list of files.
 * @param {{path: string, data: Buffer}[]} files files
 * @returns {string} sha256 hex
 */
function contentHash(files) {
    const h = crypto.createHash('sha256');
    for (const f of files.slice().sort((x, y) => byPath(x.path, y.path))) {
        h.update(`${sha256(f.data)}  ${f.path}\n`);
    }
    return h.digest('hex');
}

// Absolute fileName arguments that the recorder of the pinned corpus did not
// yet make portable. They are rewritten the way the recorder now does it: a
// path under the concerto-conformance checkout becomes `<conformance>/...`,
// one under the concerto checkout `<repo>/...`. Any other absolute home-
// directory path left afterwards fails the build.
const PATH_RULES = [
    { re: /\/(?:Users|home)\/[^"\\]*?\/concerto-conformance\//g, to: '<conformance>/' },
    { re: /\/(?:Users|home)\/[^"\\]*?\/concerto\//g, to: '<repo>/' },
];
const LEFTOVER = /\/(?:Users|home)\/[A-Za-z0-9._-]+\//;
const BLOB_REF = /"@@oracle":"blob","sha256":"([0-9a-f]{64})"/g;

/**
 * Rewrite recording-machine paths in the corpus. A blob whose text changes
 * gets a new sha256, and every reference to it is updated, recursively; a
 * fixture whose text changes gets a new id (the first 24 hex digits of the
 * sha256 of its {op, inputs, outcome, env} with sorted keys, as recorded)
 * and file name.
 * @param {Map<string, Buffer>} files rel path (under fixtures/ or cto-cache/) -> data
 * @returns {{files: Map<string, Buffer>, renamed: object}} the rewritten files, and old -> new
 *   paths of every fixture and blob that changed
 */
function scrubPaths(files) {
    const text = new Map();
    for (const [rel, data] of files) {
        text.set(rel, data.toString('utf8'));
    }
    const rewrite = (t) => PATH_RULES.reduce((acc, r) => acc.replace(r.re, r.to), t);
    const isBlob = (rel) => rel.startsWith('fixtures/blobs/');
    const isFixture = (rel) => rel.startsWith('fixtures/') && !isBlob(rel) && !rel.endsWith('/manifest.json');
    const blobMap = new Map();
    const renamed = { fixtures: {}, blobs: {} };

    // Blobs first, until no blob changes any more (a blob can refer to another).
    for (let changed = true; changed;) {
        changed = false;
        for (const [rel, t] of [...text]) {
            if (!isBlob(rel)) {
                continue;
            }
            const next = rewrite(t).replace(BLOB_REF, (m, h) => (blobMap.has(h) ? m.replace(h, blobMap.get(h)) : m));
            if (next !== t) {
                const oldHash = path.basename(rel, '.json');
                const newHash = sha256(next);
                const newRel = `fixtures/blobs/${newHash.slice(0, 2)}/${newHash}.json`;
                blobMap.set(oldHash, newHash);
                text.delete(rel);
                text.set(newRel, next);
                renamed.blobs[rel] = newRel;
                changed = true;
            }
        }
    }
    for (const [rel, t] of [...text]) {
        if (isBlob(rel)) {
            continue;
        }
        const next = rewrite(t).replace(BLOB_REF, (m, h) => (blobMap.has(h) ? m.replace(h, blobMap.get(h)) : m));
        if (next === t) {
            continue;
        }
        if (!isFixture(rel)) {
            text.set(rel, next);
            continue;
        }
        const fx = JSON.parse(next);
        const id = sha256(sortedStringify({ op: fx.op, inputs: fx.inputs, outcome: fx.outcome, env: fx.env })).slice(0, 24);
        const newRel = `${path.posix.dirname(rel)}/${id}.json`;
        if (newRel !== rel && text.has(newRel)) {
            throw new Error(`rewriting paths makes ${rel} identical to ${newRel}`);
        }
        fx.id = id;
        text.delete(rel);
        text.set(newRel, JSON.stringify(fx) + '\n');
        renamed.fixtures[rel] = newRel;
    }
    for (const [rel, t] of text) {
        const m = LEFTOVER.exec(t);
        if (m) {
            throw new Error(`${rel} still contains an absolute path (${m[0]}...)`);
        }
    }
    const out = new Map();
    for (const [rel, t] of text) {
        out.set(rel, Buffer.from(t, 'utf8'));
    }
    return { files: out, renamed };
}

/**
 * @param {string[]} argv arguments
 * @returns {object} options
 */
function parseArgs(argv) {
    const o = { pin: null, supplement: null, out: null, writeConfig: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--pin') {
            o.pin = path.resolve(argv[++i]);
        } else if (a === '--supplement') {
            o.supplement = path.resolve(argv[++i]);
        } else if (a === '--out') {
            o.out = path.resolve(argv[++i]);
        } else if (a === '--write-config') {
            o.writeConfig = true;
        } else {
            throw new Error('unknown argument ' + a);
        }
    }
    if (!o.pin || !o.supplement || !o.out) {
        throw new Error('usage: build-corpus-tarball.js --pin <tgz> --supplement <tgz> --out <dir> [--write-config]');
    }
    return o;
}

/**
 * Read and check one source archive.
 * @param {string} file archive
 * @param {object} spec SOURCES entry
 * @returns {{files: {path: string, data: Buffer}[], sha256: string}} its files under migration/oracle/
 */
function readSource(file, spec) {
    const buf = fs.readFileSync(file);
    const files = readTar(buf).filter((f) => f.path.startsWith(SOURCE_PREFIX));
    const got = contentHash(files.filter((f) => spec.hashed(f.path)));
    if (got !== spec.contentHash) {
        throw new Error(`${path.basename(file)}: content hash ${got}, expected ${spec.contentHash}`);
    }
    return { files, sha256: sha256(buf) };
}

/**
 * @returns {void}
 */
function main() {
    const opts = parseArgs(process.argv.slice(2));
    const pin = readSource(opts.pin, SOURCES.pin);
    const sup = readSource(opts.supplement, SOURCES.supplement);

    const merged = new Map();
    for (const f of pin.files) {
        merged.set(f.path, f.data);
    }
    for (const f of sup.files) {
        const prev = merged.get(f.path);
        if (prev && !prev.equals(f.data)) {
            throw new Error(`the supplement changes a file of the pinned corpus: ${f.path}`);
        }
        merged.set(f.path, f.data);
    }

    const corpus = new Map();
    for (const [p, data] of merged) {
        const rel = p.slice(SOURCE_PREFIX.length);
        const top = rel.split('/')[0];
        if (top === 'fixtures' || top === 'cto-cache') {
            corpus.set(rel, data);
        }
    }
    const scrubbed = scrubPaths(corpus);

    const entries = [];
    const counts = { fixtures: 0, blobs: 0, cto_cache: 0, by_source: {} };
    for (const [rel, data] of scrubbed.files) {
        const parts = rel.split('/');
        if (parts[0] === 'cto-cache') {
            counts.cto_cache++;
        } else if (parts[1] === 'blobs') {
            counts.blobs++;
        } else if (parts[parts.length - 1] !== 'manifest.json') {
            counts.fixtures++;
            counts.by_source[parts[1]] = (counts.by_source[parts[1]] || 0) + 1;
        }
        entries.push({ path: `${TOP}/${rel}`, data });
    }
    counts.by_source = Object.fromEntries(Object.entries(counts.by_source).sort((a, b) => byPath(a[0], b[0])));

    const provenance = {
        corpus: `concerto-core ${VERSION}`,
        description: 'Recorded behaviour of @accordproject/concerto-core 5.0.0 at its public API. See oracle/README.md and oracle/FORMAT.md in accordproject/concerto-conformance.',
        sources: [
            { asset: SOURCES.pin.asset, sha256: pin.sha256, content_hash: SOURCES.pin.contentHash, recorded_from: SOURCES.pin.recordedFrom },
            { asset: SOURCES.supplement.asset, sha256: sup.sha256, content_hash: SOURCES.supplement.contentHash, recorded_from: SOURCES.supplement.recordedFrom },
        ],
        counts,
        // Fixtures and blobs re-identified by rewriting recording-machine
        // paths: old path -> new path, relative to this directory.
        renamed: scrubbed.renamed,
        content_hash: contentHash(entries),
    };
    entries.push({ path: `${TOP}/CORPUS.json`, data: Buffer.from(JSON.stringify(provenance, null, 2) + '\n') });
    entries.sort((a, b) => byPath(a.path, b.path));

    const tar = writeTar(entries);
    const tgz = gzipDeterministic(tar);
    const tarSha = sha256(tar);
    const name = `oracle-corpus-${VERSION}-${tarSha.slice(0, 12)}`;
    fs.mkdirSync(opts.out, { recursive: true });
    const outFile = path.join(opts.out, `${name}.tgz`);
    fs.writeFileSync(outFile, tgz);

    const result = {
        release: name,
        asset: `${name}.tgz`,
        sha256: sha256(tgz),
        tar_sha256: tarSha,
        bytes: tgz.length,
        files: entries.length,
        content_hash: provenance.content_hash,
        counts,
        renamed: scrubbed.renamed,
    };
    if (opts.writeConfig) {
        const cfgFile = path.join(__dirname, '..', 'corpus.json');
        const cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
        Object.assign(cfg, {
            release: result.release,
            asset: result.asset,
            url: `https://github.com/${cfg.repository}/releases/download/${result.release}/${result.asset}`,
            sha256: result.sha256,
            tar_sha256: result.tar_sha256,
            content_hash: result.content_hash,
            counts,
        });
        fs.writeFileSync(cfgFile, JSON.stringify(cfg, null, 2) + '\n');
    }
    console.log(JSON.stringify(Object.assign({ file: outFile }, result), null, 2));
}

try {
    main();
} catch (e) {
    console.error('ERROR build-corpus-tarball: ' + (e && e.message || e));
    process.exitCode = 1;
}

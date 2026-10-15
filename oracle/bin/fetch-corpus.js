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
 * Download the corpus release asset named in oracle/corpus.json, verify it,
 * and unpack it.
 *
 *   node oracle/bin/fetch-corpus.js [--file <local .tgz>] [--dest <dir>] [--force]
 *
 * The download (or --file) must match corpus.json's `sha256`, and the
 * uncompressed tar its `tar_sha256`; otherwise nothing is unpacked. The
 * archive's `oracle-corpus/` directory is unpacked into --dest (default
 * oracle/corpus), giving <dest>/fixtures, <dest>/cto-cache and
 * <dest>/CORPUS.json. An existing <dest> is left alone unless it was
 * unpacked from the same asset, or --force is given.
 *
 * GITHUB_TOKEN, when set, is sent with the download (needed while the
 * release is a draft, through the API asset URL given with --url).
 */

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');
const zlib = require('zlib');
const { readTar } = require('../lib/tar');

const ORACLE_DIR = path.resolve(__dirname, '..');
const TOP = 'oracle-corpus/';
const STAMP = '.fetched-sha256';

/**
 * @param {string[]} argv arguments
 * @returns {object} options
 */
function parseArgs(argv) {
    const o = { file: null, url: null, dest: path.join(ORACLE_DIR, 'corpus'), force: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--file') {
            o.file = path.resolve(argv[++i]);
        } else if (a === '--url') {
            o.url = argv[++i];
        } else if (a === '--dest') {
            o.dest = path.resolve(argv[++i]);
        } else if (a === '--force') {
            o.force = true;
        } else {
            throw new Error('unknown argument ' + a);
        }
    }
    return o;
}

/**
 * GET a URL, following redirects.
 * @param {string} url URL
 * @param {number} [hops] redirects left
 * @returns {Promise<Buffer>} body
 */
function download(url, hops = 5) {
    return new Promise((resolve, reject) => {
        const headers = { 'User-Agent': 'concerto-conformance-oracle', Accept: 'application/octet-stream' };
        const u = new URL(url);
        if (process.env.GITHUB_TOKEN && (u.hostname === 'api.github.com' || u.hostname === 'github.com')) {
            headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
        }
        https.get(url, { headers }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops > 0) {
                res.resume();
                resolve(download(new URL(res.headers.location, url).toString(), hops - 1));
                return;
            }
            if (res.statusCode !== 200) {
                res.resume();
                reject(new Error(`GET ${url}: HTTP ${res.statusCode}`));
                return;
            }
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

/**
 * @param {Buffer} b data
 * @returns {string} sha256 hex
 */
function sha256(b) {
    return crypto.createHash('sha256').update(b).digest('hex');
}

/**
 * @returns {Promise<void>}
 */
async function main() {
    const opts = parseArgs(process.argv.slice(2));
    const cfg = JSON.parse(fs.readFileSync(path.join(ORACLE_DIR, 'corpus.json'), 'utf8'));
    if (!cfg.sha256 || !cfg.tar_sha256) {
        throw new Error('oracle/corpus.json names no corpus asset yet');
    }
    const stamp = path.join(opts.dest, STAMP);
    if (fs.existsSync(opts.dest) && !opts.force) {
        if (fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8').trim() === cfg.sha256) {
            console.log(`corpus ${cfg.asset} already in ${opts.dest}`);
            return;
        }
        throw new Error(`${opts.dest} exists and was not unpacked from ${cfg.asset}; pass --force to replace it`);
    }

    let buf;
    if (opts.file) {
        buf = fs.readFileSync(opts.file);
    } else {
        const url = opts.url || cfg.url;
        console.log(`downloading ${url}`);
        buf = await download(url);
    }
    const got = sha256(buf);
    if (got !== cfg.sha256) {
        // Another gzip build gives other .tgz bytes for the same files; the
        // tar's own hash still has to match.
        const tarGot = sha256(zlib.gunzipSync(buf));
        if (tarGot !== cfg.tar_sha256) {
            throw new Error(`sha256 mismatch: got ${got} (tar ${tarGot}), expected ${cfg.sha256} (tar ${cfg.tar_sha256})`);
        }
        console.log(`note: .tgz sha256 ${got} differs from ${cfg.sha256}, but the tar matches ${cfg.tar_sha256}`);
    } else if (sha256(zlib.gunzipSync(buf)) !== cfg.tar_sha256) {
        throw new Error(`tar sha256 mismatch, expected ${cfg.tar_sha256}`);
    }

    const files = readTar(buf);
    const tmp = `${opts.dest}.tmp-${process.pid}`;
    fs.rmSync(tmp, { recursive: true, force: true });
    for (const f of files) {
        if (!f.path.startsWith(TOP)) {
            throw new Error(`unexpected entry ${f.path}`);
        }
        const rel = f.path.slice(TOP.length);
        if (rel.split('/').some((s) => s === '..' || s === '') || path.isAbsolute(rel)) {
            throw new Error(`unsafe entry ${f.path}`);
        }
        const out = path.join(tmp, rel);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, f.data);
    }
    fs.writeFileSync(path.join(tmp, STAMP), cfg.sha256 + '\n');
    fs.rmSync(opts.dest, { recursive: true, force: true });
    fs.renameSync(tmp, opts.dest);
    console.log(`corpus ${cfg.asset} verified (sha256 ${cfg.sha256}) and unpacked to ${opts.dest}: ${files.length} files`);
}

main().catch((e) => {
    console.error('ERROR fetch-corpus: ' + (e && e.message || e));
    process.exitCode = 1;
});

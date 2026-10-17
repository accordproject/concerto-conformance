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
 * Replay the corpus against an engine and judge it.
 *
 *   node oracle/bin/replay.js [--engine reference|<adapter module>|<concerto-core package dir>]
 *       [--fixtures <dir>] [--source unit|data|conformance|gaps|lifted|supplement]
 *       [--op <op>] [--expected <file.tsv>] [--report <file.json>] [--max-failures N]
 *
 * --engine is `reference` (concerto-core 5.0.0 in oracle/reference, the
 * default), a module exporting `createAdapter()` that returns
 * {name, run(op, inputs)} (ADAPTERS.md), or the package directory of any JS
 * build of concerto-core (the directory holding its package.json).
 * --fixtures defaults to oracle/corpus/fixtures (bin/fetch-corpus.js).
 * --expected lists fixtures where the engine is known to differ on purpose
 * (expected-6.0.0.tsv): a listed fixture that fails is counted as
 * expected_fail rather than fail, and one that passes is reported as
 * unexpected_pass.
 * Exit status: 0 only when every fixture passes (no fail, no harness error;
 * with --expected, a listed fixture's failure is not counted as a fail).
 * A fixture whose exception message alone differs passes; it is
 * counted as message_only and listed under message_diffs in the report.
 */

process.env.TZ = 'UTC';

const fs = require('fs');
const path = require('path');
const { replayCorpus } = require('../lib/judge');
const { blobStore } = require('../lib/store');
const { makeAdapter } = require('../lib/engines');

const ORACLE_DIR = path.resolve(__dirname, '..');
const DEFAULT_FIXTURES = path.join(ORACLE_DIR, 'corpus', 'fixtures');

/**
 * @param {string[]} argv arguments
 * @returns {object} options
 */
function parseArgs(argv) {
    const o = { engine: 'reference', fixtures: DEFAULT_FIXTURES, source: null, op: null, expected: null, report: null, maxFailures: 50 };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        const next = () => argv[++i];
        if (a === '--engine') {
            o.engine = next();
        } else if (a === '--fixtures') {
            o.fixtures = path.resolve(next());
        } else if (a === '--source') {
            o.source = next();
        } else if (a === '--op') {
            o.op = next();
        } else if (a === '--expected') {
            o.expected = path.resolve(next());
        } else if (a === '--report') {
            o.report = path.resolve(next());
        } else if (a === '--max-failures') {
            o.maxFailures = Number(next());
        } else {
            throw new Error('unknown argument ' + a);
        }
    }
    return o;
}

/**
 * Read an expected-differences file: tab-separated, `#` comments, a header
 * row starting with `source`; columns source, op, id, reason.
 * @param {string} file path
 * @returns {Map<string, string>} "<source>/<id>" -> reason
 */
function readExpected(file) {
    const out = new Map();
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        if (!line.trim() || line.startsWith('#') || line.startsWith('source\t')) {
            continue;
        }
        const [source, , id, reason] = line.split('\t');
        out.set(`${source}/${id}`, reason || '');
    }
    return out;
}

// Engines log (e.g. decorator validation warnings); keep the report readable.
const out = console.log.bind(console);
if (!process.env.ORACLE_VERBOSE) {
    for (const k of ['log', 'info', 'warn', 'error', 'debug']) {
        console[k] = () => {};
    }
}

const opts = parseArgs(process.argv.slice(2));
if (!fs.existsSync(opts.fixtures)) {
    out(`ERROR replay: no corpus at ${opts.fixtures}; run \`node oracle/bin/fetch-corpus.js\` first, or pass --fixtures`);
    process.exit(2);
}
const adapter = makeAdapter(opts.engine);
const expected = opts.expected ? readExpected(opts.expected) : null;
const store = blobStore(path.join(opts.fixtures, 'blobs'));
const filter = (f) => {
    const rel = path.relative(opts.fixtures, f).split(path.sep);
    if (opts.source && rel[0] !== opts.source) {
        return false;
    }
    if (opts.op && rel[1] !== opts.op.replace(/[^A-Za-z0-9._-]/g, '_')) {
        return false;
    }
    return true;
};
/**
 * "<source>/<id>" of a fixture path relative to the corpus root.
 * @param {string} rel "<source>/<op>/<id>.json"
 * @returns {string} key
 */
function keyOf(rel) {
    const parts = rel.split(/[\\/]/);
    return `${parts[0]}/${path.basename(parts[parts.length - 1], '.json')}`;
}

(async () => {
    const t0 = Date.now();
    const passed = [];
    const onVerdict = expected ? (v, f) => {
        if (v.status === 'pass') {
            passed.push(path.relative(opts.fixtures, f));
        }
    } : undefined;
    const summary = await replayCorpus(opts.fixtures, adapter, store, { filter, onVerdict });
    if (typeof adapter.close === 'function') {
        await adapter.close();
    }
    summary.seconds = Math.round((Date.now() - t0) / 100) / 10;
    let allFailures = summary.failures;
    if (expected) {
        // A listed fixture that fails is an expected difference; one that
        // passes is reported, so the list can be kept accurate.
        summary.expected_fail = 0;
        summary.expected_failures = [];
        summary.unexpected_pass = passed.filter((rel) => expected.has(keyOf(rel)));
        allFailures = allFailures.filter((f) => {
            const unsupported = typeof f.detail === 'string' && f.detail.startsWith('unsupported op');
            if (f.status === 'fail' && !unsupported && expected.has(keyOf(f.file))) {
                summary.expected_fail++;
                summary.expected_failures.push(Object.assign({ reason: expected.get(keyOf(f.file)) }, f));
                const src = f.file.split(/[\\/]/)[0];
                for (const b of [summary.by_source[src], summary.by_op[f.op]]) {
                    if (b) {
                        b.fail--;
                        b.expected_fail = (b.expected_fail || 0) + 1;
                    }
                }
                return false;
            }
            return true;
        });
        summary.fail -= summary.expected_fail;
    }
    const allMessageDiffs = summary.message_diffs;
    summary.failures = allFailures.slice(0, opts.maxFailures);
    summary.failures_truncated = allFailures.length > opts.maxFailures;
    summary.message_diffs = allMessageDiffs.slice(0, opts.maxFailures);
    if (opts.report) {
        fs.mkdirSync(path.dirname(opts.report), { recursive: true });
        fs.writeFileSync(opts.report, JSON.stringify(Object.assign({}, summary, { failures: allFailures, message_diffs: allMessageDiffs }), null, 1) + '\n');
    }
    // message_only: passes whose exception message differs (the
    // verdict compares throw/no-throw and class, not message text).
    summary.unsupported = allFailures.filter((f) => typeof f.detail === 'string' && f.detail.startsWith('unsupported op')).length;
    const extra = expected ? ` expected_fail=${summary.expected_fail} unexpected_pass=${summary.unexpected_pass.length}` : '';
    out(`engine=${summary.engine} total=${summary.total} pass=${summary.pass} fail=${summary.fail} harness_error=${summary.harness_error}${extra} unsupported=${summary.unsupported} message_only=${summary.message_only} agreement=${summary.agreement_pct}% (${summary.seconds}s)`);
    for (const f of summary.failures.slice(0, 10)) {
        out(`ERROR ${f.status} ${f.op} ${f.file}: ${f.detail}`);
    }
    for (const rel of (summary.unexpected_pass || []).slice(0, 10)) {
        out(`info listed in --expected but passes: ${rel}`);
    }
    for (const f of summary.message_diffs.slice(0, 5)) {
        out(`info message differs (pass) ${f.op} ${f.file}: ${f.detail}`);
    }
    process.exitCode = summary.fail === 0 && summary.harness_error === 0 && summary.total > 0 ? 0 : 1;
})().catch((e) => {
    out('ERROR replay: ' + (e && e.stack || e));
    process.exitCode = 1;
});

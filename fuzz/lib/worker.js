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
 * Differential-fuzz engine worker. Runs as its own process, one per engine,
 * so the reference and the candidate never share a process (two builds of
 * concerto-core, or a native binding, cannot interfere with each other).
 *
 *   FUZZ_ENGINE=<engine spec> FIXTURES_DIR=<corpus>/fixtures node fuzz/lib/worker.js
 *
 * FUZZ_ENGINE is an engine spec as oracle/lib/engines.js reads it:
 * `reference`, a concerto-core package directory, or an adapter module.
 *
 * Protocol: newline-delimited JSON on stdin/stdout.
 *   in:  {"id": string, "op": string, "inputs": <raw @@oracle-encoded inputs>}
 *   out: {"id": string, "ok": true, "canon": <canonical outcome>}
 *      | {"id": string, "ok": false, "error": "<message>"}
 * One line in, one line out, in order.
 */

process.env.TZ = 'UTC';

const path = require('path');
const readline = require('readline');

const { blobStore } = require('../../oracle/lib/store');
const { canonicalise } = require('../../oracle/lib/canon');
const { encodeError } = require('../../oracle/lib/codec');
const { makeAdapter } = require('../../oracle/lib/engines');
const { classifyThrow } = require('./classify');

const spec = process.env.FUZZ_ENGINE;
const fixturesDir = process.env.FIXTURES_DIR;
if (!spec || !fixturesDir) {
    process.stderr.write('worker.js: set FUZZ_ENGINE and FIXTURES_DIR\n');
    process.exit(2);
}

// Silence the engines' own console output (decorator warnings and the like),
// so stdout stays a clean line-per-case protocol.
if (!process.env.ORACLE_VERBOSE) {
    for (const k of ['log', 'info', 'warn', 'error', 'debug']) {
        console[k] = () => {};
    }
}

const adapter = makeAdapter(spec);
const store = blobStore(path.join(fixturesDir, 'blobs'));

/**
 * @param {string} op op name
 * @param {object} rawInputs raw (still @@oracle-encoded) fixture inputs
 * @returns {object} {ok:true, canon} | {ok:false, error}
 */
function runOne(op, rawInputs) {
    let inputs;
    let facts;
    try {
        facts = store.facts(rawInputs);
        inputs = store.unpack(rawInputs);
    } catch (e) {
        return { ok: false, error: 'harness: ' + e.message };
    }
    let res;
    try {
        res = adapter.run(op, inputs);
    } catch (e) {
        // adapter.run() decodes the inputs before it runs the op, and
        // decoding calls into the engine (ModelFile, ModelManager,
        // Serializer, Factory, ... constructors and accessors). codec.js tags
        // an error thrown by one of those engine calls with
        // `decodeConstruct`: for a mutated document that reaches one of them,
        // the rejection is the engine's own verdict, so it is encoded like a
        // thrown op result and compared with the other engine. Anything else
        // is a harness error (lib/classify.js).
        if (classifyThrow(e) === 'engine') {
            try {
                const outcome = { error: encodeError(e) };
                const canon = canonicalise(JSON.parse(JSON.stringify(outcome)), facts, { start: 0, end: 0 });
                return { ok: true, canon };
            } catch (e2) {
                return { ok: false, error: 'outcome not canonicalisable: ' + e2.message };
            }
        }
        return { ok: false, error: 'run threw: ' + (e && e.constructor ? e.constructor.name : '') + ': ' + (e && e.message) };
    }
    if (res && typeof res.then === 'function') {
        return { ok: false, error: 'async ops are out of scope for this harness' };
    }
    const outcome = res && res.outcome ? res.outcome : res;
    const window = res && res.window ? res.window : { start: 0, end: 0 };
    try {
        const canon = canonicalise(JSON.parse(JSON.stringify(outcome)), facts, window);
        return { ok: true, canon };
    } catch (e) {
        return { ok: false, error: 'outcome not canonicalisable: ' + e.message };
    }
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
    if (!line.trim()) {
        return;
    }
    let req;
    try {
        req = JSON.parse(line);
    } catch (e) {
        process.stdout.write(JSON.stringify({ id: null, ok: false, error: 'bad request JSON: ' + e.message }) + '\n');
        return;
    }
    let out;
    try {
        out = Object.assign({ id: req.id }, runOne(req.op, req.inputs));
    } catch (e) {
        out = { id: req.id, ok: false, error: 'worker crash: ' + (e && e.message) };
    }
    process.stdout.write(JSON.stringify(out) + '\n');
});
rl.on('close', () => {
    if (typeof adapter.close === 'function') {
        Promise.resolve(adapter.close()).catch(() => {});
    }
});

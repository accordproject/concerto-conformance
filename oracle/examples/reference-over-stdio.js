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
 * The engine side of examples/process-adapter.js's protocol, backed by the
 * 5.0.0 reference: a working model for an engine in another language, and a
 * check of the protocol itself.
 *
 *   ORACLE_ENGINE_CMD="node oracle/examples/reference-over-stdio.js" \
 *     node oracle/bin/replay.js --engine oracle/examples/process-adapter.js --source conformance
 *
 * ORACLE_ONLY_OPS (comma-separated) answers every other op as unsupported,
 * as an engine that implements part of the API would.
 */

process.env.TZ = 'UTC';

const readline = require('readline');
const { referenceAdapter } = require('../lib/adapter');

// stdout carries the protocol: keep the engine's own logging off it (on
// stderr with ORACLE_VERBOSE=1, otherwise dropped).
for (const k of ['log', 'info', 'warn', 'error', 'debug']) {
    console[k] = process.env.ORACLE_VERBOSE ? (...args) => process.stderr.write(args.join(' ') + '\n') : () => {};
}

const adapter = referenceAdapter();
const only = process.env.ORACLE_ONLY_OPS ? new Set(process.env.ORACLE_ONLY_OPS.split(',')) : null;

/**
 * @param {object} req {id, op, inputs}
 * @returns {Promise<object>} the reply
 */
async function answer(req) {
    if (only && !only.has(req.op)) {
        return { id: req.id, unsupported: req.op };
    }
    try {
        const res = await adapter.run(req.op, req.inputs);
        return { id: req.id, outcome: res.outcome };
    } catch (e) {
        if (e && e.name === 'HarnessError') {
            return { id: req.id, harnessError: e.message };
        }
        if (e && e.divergence) {
            return { id: req.id, divergence: e.message };
        }
        return { id: req.id, divergence: `input construction failed: ${e && e.constructor ? e.constructor.name : ''}: ${e && e.message}` };
    }
}

// One request at a time, in order: the reference runs ops synchronously
// and an async op changes the process's working directory.
let queue = Promise.resolve();
readline.createInterface({ input: process.stdin, terminal: false }).on('line', (line) => {
    if (!line.trim()) {
        return;
    }
    const req = JSON.parse(line);
    queue = queue.then(() => answer(req)).then((reply) => {
        process.stdout.write(JSON.stringify(reply) + '\n');
    });
});

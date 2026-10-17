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
 * An adapter for an engine in any language, run as a separate process that
 * speaks newline-delimited JSON on stdin and stdout.
 *
 *   ORACLE_ENGINE_CMD="./my-engine --oracle" \
 *     node oracle/bin/replay.js --engine oracle/examples/process-adapter.js
 *
 * For each fixture the engine reads one request line:
 *   {"id": "<n>", "op": "<Class>.<method>", "inputs": {...}}
 * with every blob already resolved (FORMAT.md), and writes one line back:
 *   {"id": "<n>", "outcome": {"ok": ...} | {"error": {"class", "message", "location", "component"}}}
 *   {"id": "<n>", "unsupported": "<why>"}      the engine does not implement the op (a fail)
 *   {"id": "<n>", "divergence": "<why>"}       rebuilding the inputs diverged, e.g. a recipe step
 *                                              had another outcome than the recorded one (a fail)
 *   {"id": "<n>", "harnessError": "<why>"}     the fixture itself cannot be set up
 * Replies may come in any order. A request with no reply within
 * ORACLE_ENGINE_TIMEOUT_MS (default 60000) is a harness error. The process is closed (stdin ends) after
 * the last fixture. examples/reference-over-stdio.js is a complete engine
 * side, backed by the 5.0.0 reference.
 */

const { spawn } = require('child_process');
const readline = require('readline');
const { HarnessError } = require('../lib/codec');

/**
 * @returns {object} adapter
 */
function createAdapter() {
    const cmd = process.env.ORACLE_ENGINE_CMD;
    if (!cmd) {
        throw new Error('set ORACLE_ENGINE_CMD to the command that starts your engine');
    }
    const child = spawn(cmd, { shell: true, stdio: ['pipe', 'pipe', 'inherit'] });
    const pending = new Map();
    let nextId = 0;
    let exited = null;
    readline.createInterface({ input: child.stdout, terminal: false }).on('line', (line) => {
        let r;
        try {
            r = JSON.parse(line);
        } catch (e) {
            return;
        }
        const p = pending.get(String(r.id));
        if (!p) {
            return;
        }
        pending.delete(String(r.id));
        if (r.outcome) {
            p.resolve({ outcome: r.outcome });
            return;
        }
        let err;
        if (r.unsupported !== undefined) {
            err = new Error(String(r.unsupported));
            err.unsupported = true;
        } else if (r.divergence !== undefined) {
            err = new Error(String(r.divergence));
            err.divergence = true;
        } else {
            err = new HarnessError(String(r.harnessError || 'no outcome in the reply'));
        }
        p.reject(err);
    });
    const fail = (why) => {
        for (const p of pending.values()) {
            p.reject(new HarnessError(why));
        }
        pending.clear();
    };
    child.stdin.on('error', (e) => {
        exited = exited === null ? 'stdin: ' + e.code : exited;
        fail(`engine process input closed (${e.code})`);
    });
    child.on('error', (e) => {
        exited = exited === null ? e.code : exited;
        fail(`engine process failed to start (${e.code})`);
    });
    child.on('exit', (code) => {
        exited = code;
        for (const p of pending.values()) {
            p.reject(new HarnessError(`engine process exited (${code})`));
        }
        pending.clear();
    });
    return {
        name: `process: ${cmd}`,
        run(op, inputs) {
            if (exited !== null) {
                throw new HarnessError(`engine process exited (${exited})`);
            }
            const id = String(nextId++);
            const ms = Number(process.env.ORACLE_ENGINE_TIMEOUT_MS || 60000);
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    pending.delete(id);
                    reject(new HarnessError(`no reply from the engine within ${ms} ms`));
                }, ms);
                const done = (f) => (v) => {
                    clearTimeout(timer);
                    f(v);
                };
                pending.set(id, { resolve: done(resolve), reject: done(reject) });
                child.stdin.write(JSON.stringify({ id, op, inputs }) + '\n');
            });
        },
        close() {
            return new Promise((resolve) => {
                if (exited !== null) {
                    resolve();
                    return;
                }
                child.on('exit', () => resolve());
                child.stdin.end();
            });
        },
    };
}

module.exports = { createAdapter };

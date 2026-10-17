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
 * Engine worker processes (lib/worker.js), started per batch or kept alive.
 */

const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

const WORKER = path.join(__dirname, 'worker.js');

/**
 * @param {string} engine engine spec
 * @param {string} fixturesDir corpus fixtures directory
 * @returns {object} the child process
 */
function spawnWorker(engine, fixturesDir) {
    return spawn(process.execPath, [WORKER], {
        env: Object.assign({}, process.env, { FUZZ_ENGINE: engine, FIXTURES_DIR: fixturesDir }),
        stdio: ['pipe', 'pipe', 'pipe'],
    });
}

/**
 * Run one batch of {id, op, inputs} cases through a fresh worker.
 * @param {string} engine engine spec
 * @param {object[]} cases batch
 * @param {string} fixturesDir corpus fixtures directory
 * @returns {Promise<Map<string, object>>} id -> {ok, canon | error}
 */
function runBatch(engine, cases, fixturesDir) {
    return new Promise((resolve, reject) => {
        const child = spawnWorker(engine, fixturesDir);
        const results = new Map();
        let stderr = '';
        const rl = readline.createInterface({ input: child.stdout, terminal: false });
        rl.on('line', (line) => {
            if (!line.trim()) {
                return;
            }
            try {
                const r = JSON.parse(line);
                results.set(r.id, r);
            } catch (e) {
                // a malformed line: the case it belonged to shows up as "no result"
            }
        });
        child.stderr.on('data', (d) => {
            stderr += d;
        });
        child.on('error', reject);
        child.on('close', (code) => {
            if (results.size < cases.length && code !== 0) {
                reject(new Error(`${engine} worker exited ${code} after ${results.size}/${cases.length} results: ${stderr.slice(-2000)}`));
                return;
            }
            resolve(results);
        });
        for (const c of cases) {
            child.stdin.write(JSON.stringify(c) + '\n');
        }
        child.stdin.end();
    });
}

/**
 * A long-lived worker, for tools that run cases one at a time.
 * @param {string} engine engine spec
 * @param {string} fixturesDir corpus fixtures directory
 * @returns {{run: function(string, object): Promise<object>, close: function(): void}} handle
 */
function startWorker(engine, fixturesDir) {
    const child = spawnWorker(engine, fixturesDir);
    let stderr = '';
    child.stderr.on('data', (d) => {
        stderr += d;
    });
    const pending = new Map();
    let nextId = 0;
    const rl = readline.createInterface({ input: child.stdout, terminal: false });
    rl.on('line', (line) => {
        let r;
        try {
            r = JSON.parse(line);
        } catch (e) {
            return;
        }
        const p = pending.get(r.id);
        if (p) {
            pending.delete(r.id);
            p.resolve(r);
        }
    });
    child.on('exit', (code) => {
        for (const p of pending.values()) {
            p.reject(new Error(`${engine} worker exited ${code}: ${stderr.slice(-2000)}`));
        }
        pending.clear();
    });
    return {
        run(op, inputs) {
            const id = String(nextId++);
            return new Promise((resolve, reject) => {
                pending.set(id, { resolve, reject });
                child.stdin.write(JSON.stringify({ id, op, inputs }) + '\n');
            });
        },
        close() {
            child.stdin.end();
        },
    };
}

module.exports = { runBatch, startWorker };

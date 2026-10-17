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
 * Shrink each cluster's sample to the smallest edit list that still gives
 * the same cluster signature.
 *
 *   node fuzz/bin/minimize.js <clusters.json> --candidate <engine> [--reference <engine>]
 *       [--fixtures <dir>] [--out <clusters.json>]
 *
 * A sample {seedFile, mutationSeed} applies a few generic JSON edits
 * (lib/mutate.js mutateTraced() records them). This drops one edit at a
 * time, replays the rest on both engines, and keeps the drop when the
 * divergence keeps its signature (lib/signature.js). Each cluster gets a
 * `minimized` field: {seedFile, edits, editCount, originalEditCount}, a
 * repro that needs no seed or PRNG (bin/repro.js, lib/mutate.js
 * applyEdits()), or {stale: true} when the sample no longer reproduces.
 */

const fs = require('fs');
const path = require('path');
const { mutateTraced } = require('../lib/mutate');
const { getAt, TARGETS } = require('../lib/seeds');
const { buildCase } = require('../lib/cases');
const { signatureOf } = require('../lib/signature');
const { startWorker } = require('../lib/run-batch');

/**
 * @returns {Promise<void>}
 */
async function main() {
    const argv = process.argv.slice(2);
    const o = { reference: 'reference', candidate: null, fixtures: path.join(__dirname, '..', '..', 'oracle', 'corpus', 'fixtures'), file: null, out: null };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--reference') {
            o.reference = argv[++i];
        } else if (a === '--candidate') {
            o.candidate = argv[++i];
        } else if (a === '--fixtures') {
            o.fixtures = path.resolve(argv[++i]);
        } else if (a === '--out') {
            o.out = path.resolve(argv[++i]);
        } else {
            o.file = path.resolve(a);
        }
    }
    if (!o.file || !o.candidate) {
        throw new Error('usage: minimize.js <clusters.json> --candidate <engine> [--reference <engine>] [--fixtures <dir>] [--out <file>]');
    }
    const data = JSON.parse(fs.readFileSync(o.file, 'utf8'));
    const ref = startWorker(o.reference, o.fixtures);
    const cand = startWorker(o.candidate, o.fixtures);
    let shrunk = 0;
    let stale = 0;
    try {
        for (const cluster of data.clusters) {
            const s = cluster.sample;
            const target = TARGETS.find((t) => t.op === s.op);
            const raw = JSON.parse(fs.readFileSync(path.join(o.fixtures, s.seedFile), 'utf8'));
            const full = mutateTraced(getAt(raw.inputs, target.path), s.mutationSeed).edits;
            const test = async (edits) => {
                const c = buildCase(o.fixtures, { op: s.op, seedFile: s.seedFile, edits });
                const [r, d] = await Promise.all([ref.run(c.op, c.inputs), cand.run(c.op, c.inputs)]);
                return r.ok && d.ok && signatureOf({ op: s.op, reference: r.canon, candidate: d.canon }) === cluster.sig;
            };
            if (!(await test(full))) {
                cluster.minimized = { stale: true, originalEditCount: full.length };
                stale++;
                continue;
            }
            let current = full.slice();
            let changed = true;
            while (changed && current.length > 1) {
                changed = false;
                for (let i = current.length - 1; i >= 0; i--) {
                    const candidate = current.slice(0, i).concat(current.slice(i + 1));
                    if (await test(candidate)) {
                        current = candidate;
                        changed = true;
                    }
                }
            }
            if (current.length < full.length) {
                shrunk++;
            }
            cluster.minimized = { seedFile: s.seedFile, edits: current, editCount: current.length, originalEditCount: full.length };
        }
    } finally {
        ref.close();
        cand.close();
    }
    fs.writeFileSync(o.out || o.file, JSON.stringify(data, null, 2) + '\n');
    console.log(`minimize: ${data.clusters.length - stale}/${data.clusters.length} clusters minimised (${shrunk} shrunk), ${stale} stale`);
}

main().catch((e) => {
    console.error('ERROR minimize: ' + (e && e.message || e));
    process.exitCode = 2;
});

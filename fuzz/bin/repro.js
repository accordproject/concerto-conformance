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
 * Reproduce one fuzz case on both engines and print the mutated document
 * and both canonical outcomes.
 *
 *   node fuzz/bin/repro.js '<repro JSON>' --candidate <engine> [--reference <engine>]
 *       [--fixtures <dir>] [--doc]
 *
 * The repro is {op, seedFile, mutationSeed} (a line of divergences.jsonl,
 * or a cluster's `sample`) or {op, seedFile, edits} (a minimised cluster or
 * an entry of seeds/regressions.json); pass it inline or as @<file>.
 * --doc also prints the mutated document.
 */

const fs = require('fs');
const path = require('path');
const { buildCase } = require('../lib/cases');
const { startWorker } = require('../lib/run-batch');
const { classifyCase } = require('../lib/classify');

/**
 * @returns {Promise<void>}
 */
async function main() {
    const argv = process.argv.slice(2);
    const o = { reference: 'reference', candidate: null, fixtures: path.join(__dirname, '..', '..', 'oracle', 'corpus', 'fixtures'), doc: false, repro: null };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--reference') {
            o.reference = argv[++i];
        } else if (a === '--candidate') {
            o.candidate = argv[++i];
        } else if (a === '--fixtures') {
            o.fixtures = path.resolve(argv[++i]);
        } else if (a === '--doc') {
            o.doc = true;
        } else {
            o.repro = a.startsWith('@') ? fs.readFileSync(a.slice(1), 'utf8') : a;
        }
    }
    if (!o.repro || !o.candidate) {
        throw new Error("usage: repro.js '<repro JSON>' --candidate <engine> [--reference <engine>] [--fixtures <dir>] [--doc]");
    }
    const c = JSON.parse(o.repro);
    const built = buildCase(o.fixtures, c);
    const ref = startWorker(o.reference, o.fixtures);
    const cand = startWorker(o.candidate, o.fixtures);
    try {
        const [r, d] = await Promise.all([ref.run(built.op, built.inputs), cand.run(built.op, built.inputs)]);
        const cls = classifyCase(c, r, d, null);
        const out = { op: built.op, verdict: cls.kind + (cls.messageOnly ? ' (message only)' : ''), reference: r.ok ? r.canon : { harnessError: r.error }, candidate: d.ok ? d.canon : { harnessError: d.error } };
        if (o.doc) {
            out.doc = built.doc;
        }
        console.log(JSON.stringify(out, null, 2));
    } finally {
        ref.close();
        cand.close();
    }
}

main().catch((e) => {
    console.error('ERROR repro: ' + (e && e.message || e));
    process.exitCode = 2;
});

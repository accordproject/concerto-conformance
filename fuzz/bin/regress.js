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
 * Replay the minimised divergence seeds in seeds/regressions.json (or
 * another file of repros) on the reference and a candidate.
 *
 *   node fuzz/bin/regress.js --candidate <engine> [--reference <engine>]
 *       [--seeds <file>] [--expected <module>] [--fixtures <dir>]
 *
 * Each seed is {id, op, seedFile, edits, found}: a mutated input on which
 * an earlier engine once diverged from concerto-core 5.0.0, reduced to the
 * fewest edits that still showed it. Prints one line per seed and exits 1
 * when any seed diverges (and is not accepted by --expected) or hits a
 * harness error.
 */

const fs = require('fs');
const path = require('path');
const { buildCase } = require('../lib/cases');
const { startWorker } = require('../lib/run-batch');
const { classifyCase } = require('../lib/classify');
const { outcomeKind } = require('../lib/signature');

/**
 * @param {object} canon canonical outcome
 * @returns {string} short form
 */
function brief(canon) {
    const k = outcomeKind(canon);
    return k.cls ? `${k.verdict}(${k.cls})` : k.verdict;
}

/**
 * @returns {Promise<number>} exit status
 */
async function main() {
    const argv = process.argv.slice(2);
    const o = {
        reference: 'reference',
        candidate: null,
        seeds: path.join(__dirname, '..', 'seeds', 'regressions.json'),
        expected: null,
        fixtures: path.join(__dirname, '..', '..', 'oracle', 'corpus', 'fixtures'),
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--reference') {
            o.reference = argv[++i];
        } else if (a === '--candidate') {
            o.candidate = argv[++i];
        } else if (a === '--seeds') {
            o.seeds = path.resolve(argv[++i]);
        } else if (a === '--expected') {
            o.expected = path.resolve(argv[++i]);
        } else if (a === '--fixtures') {
            o.fixtures = path.resolve(argv[++i]);
        } else {
            throw new Error('unknown argument ' + a);
        }
    }
    if (!o.candidate) {
        throw new Error('--candidate <engine> is required');
    }
    const expected = o.expected ? require(o.expected).expectedDifference : null;
    const seeds = JSON.parse(fs.readFileSync(o.seeds, 'utf8')).seeds;
    const ref = startWorker(o.reference, o.fixtures);
    const cand = startWorker(o.candidate, o.fixtures);
    const counts = { agree: 0, divergence: 0, expected: 0, harness: 0 };
    try {
        for (const s of seeds) {
            const c = buildCase(o.fixtures, s);
            const [r, d] = await Promise.all([ref.run(c.op, c.inputs), cand.run(c.op, c.inputs)]);
            const cls = classifyCase(s, r, d, expected);
            counts[cls.kind]++;
            const sides = cls.kind === 'harness'
                ? `reference ${r.ok ? brief(r.canon) : 'harness error: ' + r.error} | candidate ${d.ok ? brief(d.canon) : 'harness error: ' + d.error}`
                : `reference ${brief(r.canon)} | candidate ${brief(d.canon)}`;
            const why = cls.kind === 'expected' ? ` (${cls.expected.reason}, ${cls.expected.link})` : '';
            console.log(`${cls.kind.padEnd(10)} ${s.id} ${s.op}: ${sides}${why}`);
        }
    } finally {
        ref.close();
        cand.close();
    }
    console.log(`seeds=${seeds.length} agree=${counts.agree} divergence=${counts.divergence} expected=${counts.expected} harness_error=${counts.harness}`);
    return counts.divergence === 0 && counts.harness === 0 ? 0 : 1;
}

main().then((code) => {
    process.exitCode = code;
}, (e) => {
    console.error('ERROR regress: ' + (e && e.message || e));
    process.exitCode = 2;
});

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
 * Differential fuzzing: reference adapter against candidate adapter.
 *
 * Draws models and instances from the oracle corpus, mutates them
 * deterministically (lib/mutate.js), runs each mutated case through both
 * engines, and compares the canonical outcomes the way the oracle's judge
 * does (exception messages excepted).
 *
 *   node fuzz/bin/fuzz.js --candidate <engine> [--reference <engine>]
 *       [--count N] [--batch-size N] [--run-seed N] [--seeds-per-op N]
 *       [--fixtures <dir>] [--expected <module>] [--out-dir <dir>]
 *
 * An engine is `reference` (concerto-core 5.0.0 in oracle/reference), a
 * concerto-core package directory, or an adapter module (oracle/ADAPTERS.md).
 * --run-seed fixes the whole run: the same seed, corpus and --seeds-per-op
 * give the same cases. Each case is also reproducible on its own from
 * {seedFile, mutationSeed} (bin/repro.js).
 *
 * Writes to --out-dir (default fuzz/results): run.json (counts),
 * divergences.jsonl, expected.jsonl and harness-errors.jsonl.
 * Exit status 1 when any divergence or harness error was found.
 */

const fs = require('fs');
const path = require('path');

const { mutate, mulberry32 } = require('../lib/mutate');
const { loadSeeds, withMutatedDoc, getAt } = require('../lib/seeds');
const { runBatch } = require('../lib/run-batch');
const { classifyCase, emptyCounts, tally } = require('../lib/classify');

const FUZZ_DIR = path.resolve(__dirname, '..');

/**
 * @param {string[]} argv arguments
 * @returns {object} options
 */
function parseArgs(argv) {
    const o = {
        reference: 'reference',
        candidate: null,
        count: 1000,
        batchSize: 200,
        runSeed: 1,
        seedsPerOp: 25,
        fixtures: path.join(FUZZ_DIR, '..', 'oracle', 'corpus', 'fixtures'),
        expected: null,
        outDir: path.join(FUZZ_DIR, 'results'),
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        const next = () => argv[++i];
        if (a === '--reference') {
            o.reference = next();
        } else if (a === '--candidate') {
            o.candidate = next();
        } else if (a === '--count') {
            o.count = Number(next());
        } else if (a === '--batch-size') {
            o.batchSize = Number(next());
        } else if (a === '--run-seed') {
            o.runSeed = Number(next());
        } else if (a === '--seeds-per-op') {
            o.seedsPerOp = Number(next());
        } else if (a === '--fixtures') {
            o.fixtures = path.resolve(next());
        } else if (a === '--expected') {
            o.expected = path.resolve(next());
        } else if (a === '--out-dir') {
            o.outDir = path.resolve(next());
        } else {
            throw new Error('unknown argument ' + a);
        }
    }
    if (!o.candidate) {
        throw new Error('--candidate <engine> is required');
    }
    if (!fs.existsSync(o.fixtures)) {
        throw new Error(`no corpus at ${o.fixtures}; run \`node oracle/bin/fetch-corpus.js\` first, or pass --fixtures`);
    }
    return o;
}

/**
 * The run's cases, deterministic from the run seed.
 * @param {number} nSeeds number of seed fixtures
 * @param {number} count number of cases
 * @param {number} runSeed run seed
 * @returns {Array<{seedIndex: number, mutationSeed: number}>} plan
 */
function buildPlan(nSeeds, count, runSeed) {
    const rnd = mulberry32(runSeed);
    const plan = [];
    for (let i = 0; i < count; i++) {
        const seedIndex = Math.floor(rnd() * nSeeds);
        const mutationSeed = Math.floor(rnd() * 0x100000000) >>> 0;
        plan.push({ seedIndex, mutationSeed });
    }
    return plan;
}

/**
 * @returns {Promise<number>} exit status
 */
async function main() {
    const o = parseArgs(process.argv.slice(2));
    const expected = o.expected ? require(o.expected).expectedDifference : null;
    const seeds = loadSeeds(o.fixtures, o.seedsPerOp);
    if (seeds.length === 0) {
        throw new Error('no usable seed fixtures under ' + o.fixtures);
    }
    console.log(`fuzz: ${seeds.length} seed fixtures, ${o.count} cases, batch size ${o.batchSize}, run seed ${o.runSeed}`);
    console.log(`  reference ${o.reference}\n  candidate ${o.candidate}`);

    const plan = buildPlan(seeds.length, o.count, o.runSeed);
    fs.mkdirSync(o.outDir, { recursive: true });
    const open = (name) => fs.createWriteStream(path.join(o.outDir, name), { flags: 'w' });
    const streams = { divergence: open('divergences.jsonl'), expected: open('expected.jsonl'), harness: open('harness-errors.jsonl') };

    const summary = {
        reference: o.reference,
        candidate: o.candidate,
        runSeed: o.runSeed,
        seedsPerOp: o.seedsPerOp,
        seedFixtures: seeds.length,
        planned: o.count,
        ...emptyCounts(),
        byOp: {},
    };

    for (let start = 0; start < plan.length; start += o.batchSize) {
        const cases = plan.slice(start, start + o.batchSize).map((p, i) => {
            const seed = seeds[p.seedIndex];
            const mutatedDoc = mutate(getAt(seed.raw.inputs, seed.path), p.mutationSeed);
            return {
                id: String(start + i),
                op: seed.op,
                inputs: withMutatedDoc(seed, mutatedDoc),
                seedFile: path.relative(o.fixtures, seed.file).split(path.sep).join('/'),
                mutationSeed: p.mutationSeed,
            };
        });
        const wire = cases.map(({ id, op, inputs }) => ({ id, op, inputs }));
        const [refResults, candResults] = await Promise.all([
            runBatch(o.reference, wire, o.fixtures),
            runBatch(o.candidate, wire, o.fixtures),
        ]);
        for (const c of cases) {
            const cls = classifyCase(c, refResults.get(c.id), candResults.get(c.id), expected);
            tally(summary, c.op, cls);
            if (cls.kind === 'divergence') {
                streams.divergence.write(JSON.stringify(cls.record) + '\n');
            } else if (cls.kind === 'expected') {
                streams.expected.write(JSON.stringify(Object.assign({}, cls.record, { expected: cls.expected })) + '\n');
            } else if (cls.kind === 'harness') {
                streams.harness.write(JSON.stringify(cls.record) + '\n');
            }
        }
        console.log(`  ${summary.ran}/${o.count}: ${summary.divergences} divergence(s), ${summary.expectedDifferences} expected, ${summary.harnessErrorCases} harness error case(s)`);
    }
    await Promise.all(Object.values(streams).map((s) => new Promise((res) => s.end(res))));
    fs.writeFileSync(path.join(o.outDir, 'run.json'), JSON.stringify(summary, null, 2) + '\n');
    console.log(`ran=${summary.ran} agree=${summary.agree} (message only ${summary.messageOnlyAgree}) divergences=${summary.divergences} expected=${summary.expectedDifferences} harness_errors=${summary.harnessErrorCases} (reference ${summary.harnessErrorsReference}, candidate ${summary.harnessErrorsCandidate})`);
    console.log(`results in ${o.outDir}`);
    return summary.divergences === 0 && summary.harnessErrorCases === 0 ? 0 : 1;
}

main().then((code) => {
    process.exitCode = code;
}, (e) => {
    console.error('ERROR fuzz: ' + (e && e.stack || e));
    process.exitCode = 2;
});

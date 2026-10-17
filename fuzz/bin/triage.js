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
 * Cluster a run's divergences by signature (lib/signature.js): op, each
 * side's outcome kind and exception class, and message templates.
 *
 *   node fuzz/bin/triage.js [<results dir>/divergences.jsonl] [--expected <module>] [--out <clusters.json>]
 *
 * Writes {totalDivergences, excludedAsExpected, clusterCount, clusters} with
 * one {sig, op, count, sample} per cluster, largest first; `sample` is the
 * first divergence seen, a complete repro (bin/repro.js). With --expected,
 * divergences the module now accepts are left out and counted.
 */

const fs = require('fs');
const path = require('path');
const { signatureOf } = require('../lib/signature');

/**
 * @returns {void}
 */
function main() {
    const argv = process.argv.slice(2);
    let file = path.join(__dirname, '..', 'results', 'divergences.jsonl');
    let expected = null;
    let out = null;
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--expected') {
            expected = require(path.resolve(argv[++i])).expectedDifference;
        } else if (argv[i] === '--out') {
            out = path.resolve(argv[++i]);
        } else {
            file = path.resolve(argv[i]);
        }
    }
    const lines = fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim());
    const clusters = new Map();
    let excluded = 0;
    for (const line of lines) {
        const d = JSON.parse(line);
        if (expected && expected(d)) {
            excluded++;
            continue;
        }
        const sig = signatureOf(d);
        if (!clusters.has(sig)) {
            clusters.set(sig, { sig, op: d.op, count: 0, sample: d });
        }
        clusters.get(sig).count++;
    }
    const sorted = [...clusters.values()].sort((a, b) => b.count - a.count || (a.sig < b.sig ? -1 : 1));
    const result = { totalDivergences: lines.length, excludedAsExpected: excluded, clusterCount: sorted.length, clusters: sorted };
    const text = JSON.stringify(result, null, 2) + '\n';
    if (out) {
        fs.writeFileSync(out, text);
        console.log(`${sorted.length} cluster(s) from ${lines.length} divergence(s) (${excluded} now expected) -> ${out}`);
    } else {
        process.stdout.write(text);
    }
}

main();

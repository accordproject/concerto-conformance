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
 * Rebuild a fuzz case's inputs from its repro: the seed fixture and either a
 * mutation seed (lib/mutate.js mutate()) or an explicit edit list
 * (applyEdits(), as bin/minimize.js and seeds/regressions.json give it).
 */

const fs = require('fs');
const path = require('path');
const { mutate, applyEdits } = require('./mutate');
const { getAt, withMutatedDoc, TARGETS } = require('./seeds');

/**
 * @param {string} fixturesDir corpus fixtures directory
 * @param {{op: string, seedFile: string, mutationSeed?: number, edits?: object[]}} c the repro
 * @returns {{op: string, inputs: object, doc: *}} raw inputs, and the mutated document
 */
function buildCase(fixturesDir, c) {
    const target = TARGETS.find((t) => t.op === c.op);
    if (!target) {
        throw new Error(`op ${c.op} is not a fuzz target`);
    }
    const raw = JSON.parse(fs.readFileSync(path.join(fixturesDir, c.seedFile), 'utf8'));
    const base = getAt(raw.inputs, target.path);
    let doc;
    if (Array.isArray(c.edits)) {
        doc = applyEdits(base, c.edits);
    } else if (typeof c.mutationSeed === 'number') {
        doc = mutate(base, c.mutationSeed);
    } else {
        throw new Error('a repro needs `edits` or `mutationSeed`');
    }
    return { op: c.op, inputs: withMutatedDoc({ raw, path: target.path }, doc), doc };
}

module.exports = { buildCase };

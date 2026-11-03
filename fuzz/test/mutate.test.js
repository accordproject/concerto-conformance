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

// Unit tests for the fuzz harness's PRNG and mutator (lib/mutate.js). No
// engine or corpus needed:
//   node --test fuzz/test/*.test.js

const test = require('node:test');
const assert = require('node:assert/strict');

const { mulberry32, mutate, mutateTraced, applyEdits, getAtPath } = require('../lib/mutate');

// A small model AST and instance, shaped like the documents the fuzzer
// mutates (lib/seeds.js TARGETS).
const MODEL = {
    $class: 'concerto.metamodel@1.0.0.Model',
    namespace: 'org.test@1.0.0',
    imports: [],
    declarations: [{
        $class: 'concerto.metamodel@1.0.0.ConceptDeclaration',
        name: 'Person',
        isAbstract: false,
        properties: [
            { $class: 'concerto.metamodel@1.0.0.StringProperty', name: 'name', isArray: false, isOptional: false },
            { $class: 'concerto.metamodel@1.0.0.IntegerProperty', name: 'age', isArray: false, isOptional: true },
        ],
    }],
};
const INSTANCE = { $class: 'org.test@1.0.0.Person', name: 'Ada', age: 36, tags: ['a', 'b', 'c'] };
const SEEDS = Array.from({ length: 2000 }, (_, i) => (i * 2654435761) >>> 0);

test('mulberry32: a seed fixes the sequence, values lie in [0, 1)', () => {
    const draw = (seed, n) => {
        const r = mulberry32(seed);
        return Array.from({ length: n }, () => r());
    };
    // Pinned: a change to the generator changes every recorded repro.
    assert.deepEqual(draw(42, 3), [0.6011037519201636, 0.44829055899754167, 0.8524657934904099]);
    assert.deepEqual(draw(7, 100), draw(7, 100));
    assert.notDeepEqual(draw(7, 10), draw(8, 10));
    for (const v of draw(123, 10000)) {
        assert.ok(v >= 0 && v < 1, String(v));
    }
    // Seeds are taken as unsigned 32-bit integers.
    assert.deepEqual(draw(-1, 5), draw(0xffffffff, 5));
});

test('mutate: the same document and seed give the same result', () => {
    for (const doc of [MODEL, INSTANCE]) {
        for (const seed of SEEDS.slice(0, 200)) {
            assert.deepStrictEqual(mutate(doc, seed), mutate(doc, seed));
        }
    }
});

test('mutate: pinned results for fixed seeds', () => {
    // A change here changes which cases a recorded --run-seed produces.
    assert.deepStrictEqual(mutate(INSTANCE, 1), { $class: 'org.test@1.0.0.Personorg.test@1.0.0.Person', name: 'Ada', age: 36, tags: [-0.1, 'b', true] });
    assert.deepStrictEqual(mutate(INSTANCE, 2), { $class: 'org.test@1.0.0.Person', name: 'Ada', age: [true], tags: ['c', 'a', 'b'] });
    assert.deepStrictEqual(mutate(INSTANCE, 3), {
        $class: ['org.test@1.0.0.Person'], name: 'Ada', age: 36, tags: ['a', 'b', 'c'],
        $class_dup: 'org.test@1.0.0.Person', tags_dup: ['a', 'b', 'c'],
    });
    const outs = new Set(SEEDS.slice(0, 200).map((s) => JSON.stringify(mutate(INSTANCE, s))));
    assert.ok(outs.size > 100, `only ${outs.size} distinct results from 200 seeds`);
});

test('mutate: never modifies its input', () => {
    const before = JSON.stringify(MODEL);
    for (const seed of SEEDS.slice(0, 500)) {
        mutate(MODEL, seed);
    }
    assert.equal(JSON.stringify(MODEL), before);
});

test('mutate: changes the document for almost every seed', () => {
    const unchanged = SEEDS.filter((s) => {
        const out = mutate(MODEL, s);
        return JSON.stringify(out) === JSON.stringify(MODEL);
    }).length;
    // An edit can be a no-op (flipping and flipping back, shuffling equal elements).
    assert.ok(unchanged < SEEDS.length * 0.05, `${unchanged} of ${SEEDS.length} unchanged`);
});

test('mutateTraced: 1 to 4 edits, each with a kind and a path', () => {
    const counts = new Set();
    for (const seed of SEEDS) {
        const { edits } = mutateTraced(MODEL, seed);
        assert.ok(edits.length <= 4, String(edits.length));
        counts.add(Math.min(edits.length, 4));
        for (const e of edits) {
            assert.ok(['set', 'add', 'delete', 'insert'].includes(e.kind), e.kind);
            assert.ok(Array.isArray(e.path));
        }
    }
    for (const n of [1, 2, 3, 4]) {
        assert.ok(counts.has(n), `no case with ${n} edits`);
    }
});

test('applyEdits: replaying a full trace rebuilds the mutated document', () => {
    for (const doc of [MODEL, INSTANCE]) {
        for (const seed of SEEDS) {
            const { out, edits } = mutateTraced(doc, seed);
            assert.deepStrictEqual(applyEdits(doc, edits), out, `seed ${seed}`);
        }
    }
});

test('applyEdits: a duplicate that overwrites an existing _dup sibling replays', () => {
    // Duplicating `start` when `start_dup` already exists overwrites the
    // sibling; the trace must record that change, not a no-op on `start`.
    const doc = { start: { line: 4, column: 3 }, start_dup: { column: 3 }, end: { line: 5 } };
    for (const seed of SEEDS) {
        const { out, edits } = mutateTraced(doc, seed);
        assert.deepStrictEqual(applyEdits(doc, edits), out, `seed ${seed}`);
    }
});

test('applyEdits: any subset of a trace applies without throwing, and never modifies its input', () => {
    const before = JSON.stringify(MODEL);
    for (const seed of SEEDS.slice(0, 300)) {
        const { edits } = mutateTraced(MODEL, seed);
        for (let i = 0; i < edits.length; i++) {
            applyEdits(MODEL, edits.slice(0, i).concat(edits.slice(i + 1)));
        }
        assert.deepStrictEqual(applyEdits(MODEL, []), MODEL);
    }
    assert.equal(JSON.stringify(MODEL), before);
});

test('mutate: never edits inside an @@oracle node', () => {
    const doc = { a: 1, b: 'x', handle: { '@@oracle': 'mmref', id: 0 } };
    for (const seed of SEEDS) {
        const { edits } = mutateTraced(doc, seed);
        // Replay the trace one edit at a time: an edit may replace or remove
        // the marker node as a whole, but never reach inside one.
        let cur = doc;
        for (const e of edits) {
            const parentPath = e.kind === 'insert' ? e.path : e.path.slice(0, -1);
            for (let i = 1; i <= parentPath.length; i++) {
                const node = getAtPath(cur, parentPath.slice(0, i));
                assert.ok(!(node && typeof node === 'object' && !Array.isArray(node) && '@@oracle' in node),
                    `seed ${seed}: ${JSON.stringify(e)} edits inside a marker node`);
            }
            cur = applyEdits(cur, [e]);
        }
    }
});

test('getAtPath: follows keys and indices, undefined when a step is missing', () => {
    assert.equal(getAtPath(MODEL, ['declarations', 0, 'properties', 1, 'name']), 'age');
    assert.equal(getAtPath(MODEL, ['declarations', 5, 'name']), undefined);
    assert.deepStrictEqual(getAtPath(INSTANCE, []), INSTANCE);
});

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

// Unit tests for the fuzz harness's outcome classification and the
// concerto-core 6.0.0 expected-differences module. No engine needed:
//   node --test fuzz/test/*.test.js

const test = require('node:test');
const assert = require('node:assert/strict');

const { classifyThrow, classifyCase, emptyCounts, tally } = require('../lib/classify');
const { expectedDifference } = require('../expected/concerto-6.0.0');
const codec = require('../../oracle/lib/codec');

const OK = { ok: { '@@oracle': 'typed', fqn: 'org.test@1.0.0.C' } };
const err = (cls, message) => ({ error: { class: cls, message, location: null, component: null } });
const verdict = (canon) => ({ ok: true, canon });
const harness = (message) => ({ ok: false, error: message });
const CASE = { op: 'ModelManager.fromAst', seedFile: 'data/x.json', mutationSeed: 7 };

test('reference ok, candidate throws: a divergence carrying both outcomes', () => {
    const rust = err('IllegalModelException', 'bad model');
    const cls = classifyCase(CASE, verdict(OK), verdict(rust), expectedDifference);
    assert.equal(cls.kind, 'divergence');
    assert.deepEqual(cls.record, { ...CASE, reference: OK, candidate: rust });
});

test('reference throws, candidate ok: a divergence', () => {
    const cls = classifyCase(CASE, verdict(err('TypeError', 'x is not a function')), verdict(OK), expectedDifference);
    assert.equal(cls.kind, 'divergence');
    assert.equal(cls.refHarness, false);
    assert.equal(cls.candHarness, false);
});

test('both throw the same class and message: agreement', () => {
    const cls = classifyCase(CASE, verdict(err('IllegalModelException', 'bad')), verdict(err('IllegalModelException', 'bad')), expectedDifference);
    assert.equal(cls.kind, 'agree');
});

test('agreement ignores key order in the canonical outcome', () => {
    const a = { error: { class: 'E', message: 'm', location: null, component: null } };
    const b = { error: { component: null, location: null, message: 'm', class: 'E' } };
    assert.equal(classifyCase(CASE, verdict(a), verdict(b), expectedDifference).kind, 'agree');
});

test('both throw, different class: a divergence', () => {
    const cls = classifyCase(CASE, verdict(err('IllegalModelException', 'bad')), verdict(err('TypeError', 'bad')), expectedDifference);
    assert.equal(cls.kind, 'divergence');
});

test('both throw, same class, different message: an agreement flagged messageOnly', () => {
    const cls = classifyCase(CASE, verdict(err('IllegalModelException', 'bad a')), verdict(err('IllegalModelException', 'bad b')), expectedDifference);
    assert.equal(cls.kind, 'agree');
    assert.equal(cls.messageOnly, true);
    const summary = { ...emptyCounts(), byOp: {} };
    tally(summary, CASE.op, cls);
    assert.equal(summary.agree, 1);
    assert.equal(summary.messageOnlyAgree, 1);
    assert.equal(summary.divergences, 0);
});

test('same class and message but a different location: still a divergence (only the message is relaxed)', () => {
    const a = { error: { class: 'IllegalModelException', message: 'bad', location: { start: { line: 1 } }, component: null } };
    const b = { error: { class: 'IllegalModelException', message: 'other', location: null, component: null } };
    assert.equal(classifyCase(CASE, verdict(a), verdict(b), expectedDifference).kind, 'divergence');
});

test('a message inside a throws marker in a value is ignored too', () => {
    const a = { ok: { x: { '@@oracle': 'throws', class: 'TypeError', message: 'one' } } };
    const b = { ok: { x: { '@@oracle': 'throws', class: 'TypeError', message: 'two' } } };
    const c = { ok: { x: { '@@oracle': 'throws', class: 'Error', message: 'one' } } };
    assert.equal(classifyCase(CASE, verdict(a), verdict(b), expectedDifference).messageOnly, true);
    assert.equal(classifyCase(CASE, verdict(a), verdict(c), expectedDifference).kind, 'divergence');
});

test('a maintainer-accepted difference (non-string $class) is expected, not unresolved', () => {
    const c = { ...CASE, op: 'Serializer.fromJSON' };
    const cls = classifyCase(c,
        verdict(err('TypeError', 'fqn.lastIndexOf is not a function')),
        verdict(err('Error', 'a $class that is not a string: true')), expectedDifference);
    assert.equal(cls.kind, 'expected');
    assert.equal(cls.expected.id, 'non-string-class');
});

test('a maintainer-accepted difference (relationship without a type) is expected, not unresolved', () => {
    for (const [op, value] of [['ModelManager.addModelFile', 'undefined'], ['ModelManager.fromAst', 'null']]) {
        const cls = classifyCase({ ...CASE, op },
            verdict(err('TypeError', `Cannot read properties of ${value} (reading 'name')`)),
            verdict(err('IllegalModelException', "Relationship dept must have a type File 'x.cto': line 5 column 3, to line 6 column 1. ")),
            expectedDifference);
        assert.equal(cls.kind, 'expected', op);
        assert.equal(cls.expected.id, 'relationship-without-type');
    }
    // No file name: the IllegalModelException constructor still appends ' '.
    assert.equal(expectedDifference({ op: 'ModelManager.fromAst',
        reference: err('TypeError', "Cannot read properties of undefined (reading 'name')"),
        candidate: err('IllegalModelException', 'Relationship home must have a type ') }).id, 'relationship-without-type');
});

test('the relationship matcher needs both sides: a reference crash paired with candidate ok, another crash or another op is unresolved', () => {
    const crash = err('TypeError', "Cannot read properties of undefined (reading 'name')");
    const rejected = err('IllegalModelException', 'Relationship home must have a type ');
    const cases = [
        ['ModelManager.fromAst', crash, OK],
        ['ModelManager.fromAst', err('TypeError', "Cannot read properties of undefined (reading 'type')"), rejected],
        ['ModelManager.fromAst', crash, err('IllegalModelException', 'Relationship must have a type ')],
        ['Serializer.fromJSON', crash, rejected],
    ];
    for (const [op, ts, rust] of cases) {
        assert.equal(classifyCase({ ...CASE, op }, verdict(ts), verdict(rust), expectedDifference).kind, 'divergence', `${op} ${JSON.stringify(rust)}`);
    }
});

test('a maintainer-accepted difference (null decorator) is expected, not unresolved', () => {
    for (const [op, rustMessage] of [
        ['ModelManager.addModelFile', "Invalid decorator. Expected object. Found null File 'x.cto': "],
        ['ModelManager.fromAst', 'Invalid decorator. Expected object. Found null '],
        ['ModelFile.validate', 'Invalid decorator. Expected object. Found undefined'],
    ]) {
        const cls = classifyCase({ ...CASE, op },
            verdict(err('TypeError', "Cannot read properties of null (reading 'name')")),
            verdict(err('IllegalModelException', rustMessage)),
            expectedDifference);
        assert.equal(cls.kind, 'expected', op);
        assert.equal(cls.expected.id, 'null-decorator');
    }
});

test('an intended change (strict AST shape at load) is expected whatever the reference did', () => {
    const shapes = [
        'Model AST does not conform to the metamodel: Unexpected properties for type concerto.metamodel@1.0.0.Model: x',
        'Invalid decorators. Expected array. Found "x"',
        'Invalid name. Expected a string. Found 1e308',
        'Invalid super type name. Expected a non-empty string. Found ""',
        'Invalid identified. Expected an object with a $class. Found true',
        'Invalid validator. Expected an object with a $class. Found {"pattern":"a","flags":""}',
    ];
    // (an IllegalModelException from the reference agrees on the class: not a divergence)
    const tsOutcomes = [OK, err('TypeError', "Cannot read properties of undefined (reading 'name')")];
    for (const message of shapes) {
        for (const ts of tsOutcomes) {
            for (const op of ['ModelManager.fromAst', 'ModelManager.addModelFile', 'ModelFile.new']) {
                const cls = classifyCase({ ...CASE, op }, verdict(ts), verdict(err('IllegalModelException', message)), expectedDifference);
                assert.equal(cls.kind, 'expected', `${op}: ${message}`);
                assert.equal(cls.expected.id, 'strict-ast-shape');
            }
        }
    }
    // Another class, another message or another op stays unresolved.
    for (const [op, rust] of [
        ['ModelManager.fromAst', err('TypeError', 'Invalid name. Expected a string. Found 1')],
        ['ModelManager.fromAst', err('IllegalModelException', 'bad model')],
        ['Serializer.fromJSON', err('IllegalModelException', 'Invalid name. Expected a string. Found 1')],
    ]) {
        assert.equal(classifyCase({ ...CASE, op }, verdict(OK), verdict(rust), expectedDifference).kind, 'divergence', `${op}: ${rust.error.message}`);
    }
});

test('the decorator matcher needs both sides: the decorator message with another reference outcome, or the reference crash with another candidate outcome, is unresolved', () => {
    const crash = err('TypeError', "Cannot read properties of null (reading 'name')");
    const rejected = err('IllegalModelException', "Invalid decorator. Expected object. Found null File 'x.cto': ");
    const cases = [
        // the crash, but the candidate accepted
        ['ModelManager.addModelFile', crash, OK],
        // another property read
        ['ModelManager.addModelFile', err('TypeError', "Cannot read properties of null (reading 'arguments')"), rejected],
        // the crash paired with some other candidate rejection
        ['ModelManager.addModelFile', crash, err('IllegalModelException', "Decorator Foo has invalid decorator argument. Expected object. Found string, with value \"x\"")],
        // a different "Found" value, or the right text under another class
        ['ModelManager.addModelFile', crash, err('IllegalModelException', 'Invalid decorator. Expected object. Found 5 ')],
        ['ModelManager.addModelFile', crash, err('Error', 'Invalid decorator. Expected object. Found null ')],
        // not a model-loading op
        ['Serializer.fromJSON', crash, rejected],
    ];
    for (const [op, ts, rust] of cases) {
        assert.equal(classifyCase({ ...CASE, op }, verdict(ts), verdict(rust), expectedDifference).kind, 'divergence', `${op} ${JSON.stringify(ts)} ${JSON.stringify(rust)}`);
    }
    // The reference rejected cleanly rather than crashing: the same class,
    // so a message-only agreement, not the decorator matcher's and not a
    // divergence.
    const clean = classifyCase({ ...CASE, op: 'ModelManager.addModelFile' },
        verdict(err('IllegalModelException', 'Duplicate decorator undefined ')), verdict(rejected), expectedDifference);
    assert.equal(clean.kind, 'agree');
    assert.equal(clean.messageOnly, true);
});

test('the relationship and decorator matchers do not claim each other\'s candidate message', () => {
    const crash = err('TypeError', "Cannot read properties of null (reading 'name')");
    assert.equal(expectedDifference({ op: 'ModelManager.fromAst', reference: crash,
        candidate: err('IllegalModelException', 'Invalid decorator. Expected object. Found null ') }).id, 'null-decorator');
    assert.equal(expectedDifference({ op: 'ModelManager.fromAst', reference: crash,
        candidate: err('IllegalModelException', 'Relationship home must have a type ') }).id, 'relationship-without-type');
});

test('a genuine harness error on the reference side is not skipped past the candidate side', () => {
    const rust = err('IllegalModelException', 'bad');
    const cls = classifyCase(CASE, harness('harness: unresolved blob'), verdict(rust), expectedDifference);
    assert.equal(cls.kind, 'harness');
    assert.equal(cls.refHarness, true);
    assert.equal(cls.candHarness, false);
    // The side that produced a verdict keeps it in the reported record.
    assert.deepEqual(cls.record.candidate, rust);
    assert.deepEqual(cls.record.reference, { harnessError: 'harness: unresolved blob' });
});

test('harness errors on both sides, and a missing worker result, are both per-side', () => {
    const both = classifyCase(CASE, harness('a'), harness('b'), expectedDifference);
    assert.equal(both.kind, 'harness');
    assert.equal(both.refHarness && both.candHarness, true);
    const missing = classifyCase(CASE, verdict(OK), undefined, expectedDifference);
    assert.equal(missing.kind, 'harness');
    assert.equal(missing.refHarness, false);
    assert.equal(missing.candHarness, true);
    assert.deepEqual(missing.record.candidate, { harnessError: 'no result from worker' });
});

test('tally counts harness errors per side and per op, and every case exactly once', () => {
    const summary = { ...emptyCounts(), byOp: {} };
    tally(summary, 'A', classifyCase(CASE, verdict(OK), verdict(OK), expectedDifference));
    tally(summary, 'A', classifyCase(CASE, verdict(OK), verdict(err('E', 'm')), expectedDifference));
    tally(summary, 'A', classifyCase(CASE, harness('x'), verdict(OK), expectedDifference));
    tally(summary, 'B', classifyCase(CASE, verdict(OK), harness('y'), expectedDifference));
    tally(summary, 'B', classifyCase(CASE, harness('x'), harness('y'), expectedDifference));
    assert.deepEqual(summary.byOp.A, { ran: 3, agree: 1, messageOnlyAgree: 0, divergences: 1, expectedDifferences: 0, harnessErrorCases: 1, harnessErrorsReference: 1, harnessErrorsCandidate: 0 });
    assert.deepEqual(summary.byOp.B, { ran: 2, agree: 0, messageOnlyAgree: 0, divergences: 0, expectedDifferences: 0, harnessErrorCases: 2, harnessErrorsReference: 1, harnessErrorsCandidate: 2 });
    assert.equal(summary.ran, 5);
    assert.equal(summary.agree + summary.divergences + summary.expectedDifferences + summary.harnessErrorCases, summary.ran);
    assert.equal(summary.harnessErrorsReference, 2);
    assert.equal(summary.harnessErrorsCandidate, 2);
});

test('classifyThrow: only an engine error tagged by the decoder is a verdict', () => {
    const tagged = new Error('engine said no');
    tagged.decodeConstruct = true;
    assert.equal(classifyThrow(tagged), 'engine');
    assert.equal(classifyThrow(new codec.HarnessError('unknown op')), 'harness');
    const divergence = new Error('state divergence: step addModelFile recorded ok, replayed error');
    divergence.divergence = true;
    assert.equal(classifyThrow(divergence), 'harness');
    assert.equal(classifyThrow(new TypeError('harness bug')), 'harness');
    assert.equal(classifyThrow(undefined), 'harness');
});

// A fake engine core, just enough for codec.makeDecoder: each constructor
// rejects its input the way a real engine rejects a malformed document.
class Rejection extends Error {}
function fakeCore() {
    class ModelManager {
        constructor(options) {
            if (options && options.reject) { throw new Rejection('bad model manager options'); }
        }
        isModelManager() { return true; }
        addModelFile() { throw new Rejection('step failed'); }
        getModelFile() { throw new Rejection('getModelFile failed'); }
    }
    return {
        ModelManager,
        ModelFile: class { constructor() { throw new Rejection('bad model file AST'); } },
        Factory: class { constructor() { throw new Rejection('bad factory'); } },
        Serializer: class { constructor() { throw new Rejection('bad serializer options'); } },
        Introspector: class { constructor() { throw new Rejection('bad introspector'); } },
    };
}
const decoder = () => codec.makeDecoder(fakeCore(), () => { throw new Error('no derived'); });
const mm = (extra) => Object.assign({ '@@oracle': 'mm', id: 0, kind: 'ModelManager', steps: [] }, extra);
const thrown = (f) => {
    try {
        f();
    } catch (e) {
        return e;
    }
    assert.fail('expected a throw');
};

test('decoding: engine errors beyond the ModelFile constructor are tagged as engine verdicts', () => {
    const decode = decoder();
    const cases = {
        'ModelFile constructor': { '@@oracle': 'mfnew', mm: mm(), ast: {}, definitions: null, fileName: null },
        'ModelManager constructor': mm({ options: { reject: true } }),
        'ModelManager.getModelFile': { '@@oracle': 'mfref', mm: mm(), ns: 'org.test@1.0.0' },
        'Factory constructor': { '@@oracle': 'factory', mm: mm() },
        'Serializer constructor': { '@@oracle': 'serializer', mm: mm(), factory: { '@@oracle': 'mmref', id: 0 }, defaultOptions: {} },
        'Introspector constructor': { '@@oracle': 'introspector', mm: mm() },
    };
    for (const [name, node] of Object.entries(cases)) {
        const e = thrown(() => decode(node, { mms: new Map() }));
        assert.ok(e instanceof Rejection, name + ': the engine error itself is rethrown unchanged');
        assert.equal(e.decodeConstruct, true, name + ': tagged');
        assert.equal(classifyThrow(e), 'engine', name);
    }
});

test('decoding: harness failures are never tagged', () => {
    const decode = decoder();
    const unknown = thrown(() => decode({ '@@oracle': 'no-such-kind' }, { mms: new Map() }));
    assert.ok(unknown instanceof codec.HarnessError);
    assert.equal(classifyThrow(unknown), 'harness');
    // A recorded setup step that replays differently is a state divergence
    // of the recipe, not the op's verdict.
    const step = { method: 'addModelFile', args: [], status: 'ok', errorClass: null };
    const replay = thrown(() => decode(mm({ steps: [step] }), { mms: new Map() }));
    assert.equal(replay.divergence, true);
    assert.equal(classifyThrow(replay), 'harness');
});

test('6.0.0: the metamodel version check, validator exception classes and strict DateTime are expected', () => {
    const version = classifyCase({ ...CASE, op: 'ModelManager.fromAst' }, verdict(OK),
        verdict(err('MetamodelException', 'Model file version null does not match metamodel version 1.0.0')), expectedDifference);
    assert.equal(version.expected.id, 'metamodel-version-at-load');
    const validator = classifyCase({ ...CASE, op: 'ModelManager.fromAst' },
        verdict(err('BaseException', 'Validator error for field `s`. a@1.0.0.C.s: minLength must be less than or equal to maxLength.')),
        verdict(err('IllegalModelException', 'Validator error for field `s`. a@1.0.0.C.s: minLength must be less than or equal to maxLength.')), expectedDifference);
    assert.equal(validator.expected.id, 'validator-exception-classes');
    const date = classifyCase({ ...CASE, op: 'Serializer.fromJSON' }, verdict(OK),
        verdict(err('ValidationException', 'Expected value at path `$.t` to be of type `DateTime` with format YYYY-MM-DDTHH:mm:ss[Z]')), expectedDifference);
    assert.equal(date.expected.id, 'strict-datetime');
    // The DateTime matcher needs the reference to have accepted the value.
    const both = classifyCase({ ...CASE, op: 'Serializer.fromJSON' }, verdict(err('TypeError', 'x')),
        verdict(err('ValidationException', 'Expected value at path `$.t` to be of type `DateTime`')), expectedDifference);
    assert.equal(both.kind, 'divergence');
});

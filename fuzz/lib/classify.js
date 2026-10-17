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
 * Outcome classification for the differential fuzz harness, kept free of
 * engines and I/O so it can be unit-tested (test/classify.test.js).
 *
 * - classifyThrow(): inside one engine's worker, is an error thrown at the
 *   adapter boundary the engine's verdict on the input (so it is compared
 *   with the other engine), or a harness failure?
 * - classifyCase(): given both engines' results for one case, is it an
 *   agreement, a divergence, an expected difference (one the candidate's
 *   expected-differences module accepts), or a harness error, and on which
 *   side(s)?
 * - tally() folds a classified case into a run summary, per side and per op.
 *
 * Error parity is class, not message, as in the oracle's judge: two
 * outcomes that differ only in exception message text are an agreement,
 * flagged `messageOnly` and counted in `messageOnlyAgree` (a subset of
 * `agree`). A throw/no-throw, class, component, location or value difference
 * is a divergence.
 */

const { sortedStringify } = require('../../oracle/lib/canon');
const { withoutMessages } = require('../../oracle/lib/judge');

/**
 * Is an error thrown out of `adapter.run()` an engine verdict?
 *
 * `adapter.run()` decodes the fixture inputs before running the op, and
 * decoding calls into the engine. oracle/lib/codec.js tags any error one of
 * those engine calls throws with `decodeConstruct = true`: for a mutated
 * document that reaches one of them, the rejection is the engine's own
 * behaviour. Everything else (codec.HarnessError, a replay "state
 * divergence", an untagged throw from harness code) is a harness error.
 * @param {*} e the thrown value
 * @returns {'engine'|'harness'} classification
 */
function classifyThrow(e) {
    return e && e.decodeConstruct === true ? 'engine' : 'harness';
}

/**
 * Classify one fuzzed case from the two workers' results.
 * @param {{op: string, seedFile?: string, mutationSeed?: number}} c the case
 * @param {object|undefined} ref reference worker result: {ok: true, canon} | {ok: false, error}; undefined if the worker returned nothing
 * @param {object|undefined} cand candidate worker result, same shape
 * @param {function(object): (object|null)} [expected] an expected-differences matcher
 * @returns {{kind: string, refHarness: boolean, candHarness: boolean, record?: object, expected?: object}}
 *   kind is one of 'agree', 'divergence', 'expected', 'harness'. An 'agree'
 *   that differs only in exception message has `messageOnly: true` and keeps
 *   `record`. For 'harness', refHarness/candHarness say which side(s)
 *   failed and `record` keeps both sides, so the case is reported, never
 *   silently dropped.
 */
function classifyCase(c, ref, cand, expected) {
    const refHarness = !ref || ref.ok !== true;
    const candHarness = !cand || cand.ok !== true;
    const side = (x) => (x && x.ok === true ? x.canon : { harnessError: x ? String(x.error) : 'no result from worker' });
    const record = {
        op: c.op,
        seedFile: c.seedFile,
        mutationSeed: c.mutationSeed,
        reference: side(ref),
        candidate: side(cand),
    };
    if (c.edits) {
        record.edits = c.edits;
    }
    if (refHarness || candHarness) {
        return { kind: 'harness', refHarness, candHarness, record };
    }
    if (sortedStringify(ref.canon) === sortedStringify(cand.canon)) {
        return { kind: 'agree', refHarness, candHarness };
    }
    if (sortedStringify(withoutMessages(ref.canon)) === sortedStringify(withoutMessages(cand.canon))) {
        return { kind: 'agree', messageOnly: true, refHarness, candHarness, record };
    }
    const match = expected ? expected(record) : null;
    if (match) {
        return { kind: 'expected', refHarness, candHarness, record, expected: match };
    }
    return { kind: 'divergence', refHarness, candHarness, record };
}

/**
 * @returns {object} an empty per-op (or whole-run) counter set
 */
function emptyCounts() {
    return {
        ran: 0,
        agree: 0,
        // agreements whose exception message alone differs, included in agree
        messageOnlyAgree: 0,
        divergences: 0,
        expectedDifferences: 0,
        // cases with a harness error on at least one side
        // (ran = agree + divergences + expectedDifferences + harnessErrorCases)
        harnessErrorCases: 0,
        // per side: a case that fails on both sides counts once in each
        harnessErrorsReference: 0,
        harnessErrorsCandidate: 0,
    };
}

/**
 * Fold one classified case into a run summary (summary.byOp[op] too).
 * @param {object} summary run summary: emptyCounts() fields plus byOp
 * @param {string} op the case's op
 * @param {object} cls classifyCase()'s result
 */
function tally(summary, op, cls) {
    const byOp = summary.byOp[op] || (summary.byOp[op] = emptyCounts());
    for (const s of [summary, byOp]) {
        s.ran++;
        switch (cls.kind) {
        case 'agree':
            s.agree++;
            if (cls.messageOnly) {
                s.messageOnlyAgree++;
            }
            break;
        case 'divergence':
            s.divergences++;
            break;
        case 'expected':
            s.expectedDifferences++;
            break;
        case 'harness':
            s.harnessErrorCases++;
            if (cls.refHarness) {
                s.harnessErrorsReference++;
            }
            if (cls.candHarness) {
                s.harnessErrorsCandidate++;
            }
            break;
        default:
            throw new Error('unknown case kind ' + cls.kind);
        }
    }
}

module.exports = { classifyThrow, classifyCase, emptyCounts, tally };

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
 * The cluster signature of a divergence, shared by bin/triage.js (which
 * clusters divergences by it) and bin/minimize.js (which checks that a
 * shrunk reproducer still belongs to the same cluster).
 */

/**
 * @param {object} canon a canonical outcome
 * @returns {{verdict: string, cls: (string|null)}} its kind
 */
function outcomeKind(canon) {
    if (canon && typeof canon === 'object' && 'error' in canon) {
        return { verdict: 'error', cls: (canon.error && canon.error.class) || 'unknown' };
    }
    if (canon && typeof canon === 'object' && 'ok' in canon) {
        return { verdict: 'ok', cls: null };
    }
    return { verdict: 'other:' + JSON.stringify(canon).slice(0, 40), cls: null };
}

/**
 * A message with quoted text, uuids and numbers blanked out, so two cases
 * that differ only in which field, type or value is involved cluster
 * together.
 * @param {string} msg message
 * @returns {string} template
 */
function template(msg) {
    if (typeof msg !== 'string') {
        return '';
    }
    return msg
        .replace(/'[^']*'/g, "'…'")
        .replace(/"[^"]*"/g, '"…"')
        .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<uuid>')
        .replace(/\b\d+\b/g, '<n>')
        .slice(0, 160);
}

/**
 * @param {object} d a divergence record: {op, reference, candidate, ...}
 * @returns {string} (op, reference outcome kind, candidate outcome kind, message templates)
 */
function signatureOf(d) {
    const r = outcomeKind(d.reference);
    const c = outcomeKind(d.candidate);
    const rMsg = d.reference && d.reference.error ? template(d.reference.error.message) : '';
    const cMsg = d.candidate && d.candidate.error ? template(d.candidate.error.message) : '';
    return [
        d.op,
        `ref=${r.verdict}${r.cls ? '(' + r.cls + ')' : ''}`,
        `cand=${c.verdict}${c.cls ? '(' + c.cls + ')' : ''}`,
        rMsg && `ref:"${rMsg}"`,
        cMsg && `cand:"${cMsg}"`,
    ].filter(Boolean).join(' | ');
}

module.exports = { outcomeKind, template, signatureOf };

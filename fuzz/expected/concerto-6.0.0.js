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
 * Expected differences between concerto-core 5.0.0 (the reference) and
 * concerto-core 6.0.0 (a candidate), for `bin/fuzz.js --expected`.
 *
 * Each entry is a difference the maintainers decided on, matched as
 * narrowly as the decision is scoped: usually the candidate's distinctive
 * rejection together with what 5.0.0 did. A case that matches is counted as
 * an expected difference, not a divergence. Write your own module with the
 * same export for another candidate.
 *
 * A record is {op, reference, candidate, ...}, where `reference` and
 * `candidate` are canonical outcomes ({ok} or {error: {class, message, ...}}).
 */

const MODEL_LOADING = /^(ModelManager|BaseModelManager|AstModelManager|ModelFile|MetaModel)\./;
const NAME_CRASH = /^Cannot read properties of (undefined|null) \(reading 'name'\)$/;

const EXPECTED = [
    {
        id: 'non-string-class',
        reason: 'Serializer.fromJSON rejects a $class that is not a string; 5.0.0 crashed (TypeError) or, for an array, reported TypeNotFoundException',
        link: 'https://github.com/accordproject/concerto-rust/issues/156',
        match(d) {
            if (d.op !== 'Serializer.fromJSON') {
                return false;
            }
            const r = d.reference && d.reference.error;
            const c = d.candidate && d.candidate.error;
            if (!r || !c || c.class !== 'Error' || typeof c.message !== 'string' || !c.message.startsWith('a $class that is not a string:')) {
                return false;
            }
            const crash = r.class === 'TypeError' && r.message === 'fqn.lastIndexOf is not a function';
            const arrayResolved = r.class === 'TypeNotFoundException' && typeof r.message === 'string' && r.message.startsWith('Namespace is not defined for type');
            return crash || arrayResolved;
        },
    },
    {
        id: 'relationship-without-type',
        reason: 'A relationship property with no type is rejected with IllegalModelException; 5.0.0 crashed with a TypeError',
        link: 'https://github.com/accordproject/concerto-rust/issues/218',
        match(d) {
            const r = d.reference && d.reference.error;
            const c = d.candidate && d.candidate.error;
            return MODEL_LOADING.test(d.op || '') && !!r && !!c &&
                r.class === 'TypeError' && NAME_CRASH.test(r.message) &&
                c.class === 'IllegalModelException' && /^Relationship \S+ must have a type( |$)/.test(c.message || '');
        },
    },
    {
        id: 'null-decorator',
        reason: 'A null element in a decorators array is rejected with IllegalModelException; 5.0.0 crashed with a TypeError',
        link: 'https://github.com/accordproject/concerto-rust/issues/218',
        match(d) {
            const r = d.reference && d.reference.error;
            const c = d.candidate && d.candidate.error;
            return MODEL_LOADING.test(d.op || '') && !!r && !!c &&
                r.class === 'TypeError' && NAME_CRASH.test(r.message) &&
                c.class === 'IllegalModelException' && /^Invalid decorator\. Expected object\. Found (null|undefined)( |$)/.test(c.message || '');
        },
    },
    {
        id: 'strict-ast-shape',
        reason: 'A model AST that does not have the metamodel shape is rejected with IllegalModelException when it is loaded, whatever 5.0.0 did with it',
        link: 'https://github.com/accordproject/concerto/pull/1440',
        match(d) {
            const c = d.candidate && d.candidate.error;
            return MODEL_LOADING.test(d.op || '') && !!c && c.class === 'IllegalModelException' &&
                /^(Model AST does not conform to the metamodel: |Model AST could not be read: |model '[^']*' must be an array|Invalid decorators\. Expected array\. Found |Invalid name\. Expected a string\. Found |Invalid super type name\. Expected a non-empty string\. Found |Invalid (identified|sizeValidator|lengthValidator|validator)\. Expected an object with a \$class\. Found )/.test(c.message || '');
        },
    },
    {
        id: 'metamodel-version-at-load',
        reason: 'A model AST is checked against the metamodel when it is loaded, so a model file version that does not match the metamodel version throws MetamodelException',
        link: 'https://github.com/accordproject/concerto/pull/1440',
        match(d) {
            const c = d.candidate && d.candidate.error;
            return MODEL_LOADING.test(d.op || '') && !!c && c.class === 'MetamodelException' &&
                /^Model file version \S+ does not match metamodel version /.test(c.message || '');
        },
    },
    {
        id: 'validator-exception-classes',
        reason: 'An invalid validator in a model throws IllegalModelException, and a validator violation in an instance throws ValidationException, where 5.0.0 threw BaseException',
        link: 'https://github.com/accordproject/concerto/pull/1445',
        match(d) {
            const r = d.reference && d.reference.error;
            const c = d.candidate && d.candidate.error;
            return !!r && !!c && r.class === 'BaseException' && /^Validator error for field /.test(r.message || '') &&
                (c.class === 'IllegalModelException' || c.class === 'ValidationException');
        },
    },
    {
        id: 'strict-datetime',
        reason: 'Only strict ISO 8601 / RFC 3339 DateTime strings are accepted; 5.0.0 also parsed lenient forms',
        link: 'https://github.com/accordproject/concerto/pull/1424',
        match(d) {
            const c = d.candidate && d.candidate.error;
            return /^(Serializer\.fromJSON|Resource\.validate)$/.test(d.op || '') && !!d.reference && 'ok' in d.reference &&
                !!c && c.class === 'ValidationException' && /to be of type `DateTime`/.test(c.message || '');
        },
    },
];

/**
 * @param {object} d a divergence record
 * @returns {{id: string, reason: string, link: string}|null} the matching entry, or null
 */
function expectedDifference(d) {
    for (const e of EXPECTED) {
        if (e.match(d)) {
            return { id: e.id, reason: e.reason, link: e.link };
        }
    }
    return null;
}

module.exports = { EXPECTED, expectedDifference };

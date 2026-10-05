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

// Checks the Concertino golden documents (see README.md in this directory).
//
//   node concertino/check.js            check every case
//   node concertino/check.js --update   rewrite each expected concertino.json
//
// For each case directory under cases/, the .cto files are loaded (in name
// order) into a concerto-core ModelManager, the resolved metamodel
// (getAst(true)) is converted with @accordproject/concertino's
// convertToConcertino, and the result must equal concertino.json. The
// document must also pass the Concertino schema check and convert back to
// the same resolved metamodel.
//
// The packages are resolved from this repository's node_modules, or from
// the paths in CONCERTO_CORE and CONCERTINO (package directories), for
// example a concerto checkout's packages/concerto-core and
// packages/concertino.

import fs from 'fs';
import path from 'path';
import url from 'url';
import { createRequire } from 'module';
import { isDeepStrictEqual } from 'util';

const require = createRequire(import.meta.url);
const HERE = path.dirname(url.fileURLToPath(import.meta.url));
const CASES = path.join(HERE, 'cases');
const UPDATE = process.argv.includes('--update');

const { ModelManager } = require(process.env.CONCERTO_CORE || '@accordproject/concerto-core');
const concertino = require(process.env.CONCERTINO || '@accordproject/concertino');

const strip = (x) => JSON.parse(JSON.stringify(x, (k, v) => (k === 'location' ? undefined : v)));
const clone = (x) => JSON.parse(JSON.stringify(x));

let failures = 0;
const cases = fs.existsSync(CASES)
    ? fs.readdirSync(CASES, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()
    : [];
for (const name of cases) {
    const dir = path.join(CASES, name);
    const problems = [];
    try {
        const modelManager = new ModelManager({ enableMapType: true, importAliasing: true });
        const files = fs.readdirSync(dir).filter((f) => f.endsWith('.cto')).sort();
        for (const file of files) {
            modelManager.addCTOModel(fs.readFileSync(path.join(dir, file), 'utf8'), file);
        }
        const resolved = strip(modelManager.getAst(true));
        // As JSON: the converter leaves out what is undefined.
        const actual = clone(concertino.convertToConcertino(clone(resolved)));
        const expectedFile = path.join(dir, 'concertino.json');
        if (UPDATE) {
            fs.writeFileSync(expectedFile, `${JSON.stringify(actual, null, 2)}\n`);
        } else if (!isDeepStrictEqual(actual, JSON.parse(fs.readFileSync(expectedFile, 'utf8')))) {
            problems.push('the Concertino document is not the expected one (concertino.json)');
        }
        const checker = new concertino.ConcertinoConverter();
        if (!checker.isValid(actual)) {
            problems.push(`the document fails the Concertino schema: ${JSON.stringify(checker.getValidationErrors())}`);
        }
        const back = concertino.convertToMetamodel(clone(actual));
        for (const model of resolved.models) {
            if (!isDeepStrictEqual(back.models.find((m) => m.namespace === model.namespace), model)) {
                problems.push(`the document does not convert back to the resolved metamodel of ${model.namespace}`);
            }
        }
    } catch (e) {
        problems.push(`threw ${e.constructor.name}: ${e.message}`);
    }
    if (problems.length) {
        failures++;
        console.log(`not ok - ${name}`);
        problems.forEach((p) => console.log(`  ${p}`));
    } else {
        console.log(`ok - ${name}${UPDATE ? ' (updated)' : ''}`);
    }
}
console.log(`${cases.length - failures} of ${cases.length} Concertino golden documents pass`);
if (cases.length === 0) {
    // Nothing checked is not a pass: a missing or emptied cases/ directory.
    console.log(`not ok - no Concertino golden document cases under ${CASES}`);
}
process.exitCode = failures || cases.length === 0 ? 1 : 0;

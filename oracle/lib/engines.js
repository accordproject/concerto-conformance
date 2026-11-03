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
 * Resolve an engine spec, as the command-line tools take it, to an adapter:
 *
 *   reference            concerto-core 5.0.0 from npm, in oracle/reference
 *   <package directory>  any JS build of concerto-core: the directory holding
 *                        its package.json, with the compiled modules in dist/
 *   <module path>        a module exporting createAdapter() (ADAPTERS.md)
 */

const fs = require('fs');
const path = require('path');

/**
 * @param {string} spec engine spec
 * @returns {object} adapter {name, run(op, inputs)}
 */
function makeAdapter(spec) {
    const adapters = require('./adapter');
    if (spec === 'reference') {
        return adapters.referenceAdapter();
    }
    const p = path.resolve(spec);
    if (fs.existsSync(path.join(p, 'package.json')) && fs.existsSync(path.join(p, 'dist'))) {
        return adapters.packageAdapter(p);
    }
    const mod = require(p);
    if (!mod || typeof mod.createAdapter !== 'function') {
        throw new Error(`${spec}: not "reference", a concerto-core package directory, or a module exporting createAdapter()`);
    }
    return mod.createAdapter();
}

module.exports = { makeAdapter };

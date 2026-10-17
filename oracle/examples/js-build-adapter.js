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
 * A minimal adapter for a JS build of concerto-core: the build your
 * application resolves, or one named by CONCERTO_CORE_DIR.
 *
 *   CONCERTO_CORE_DIR=node_modules/@accordproject/concerto-core \
 *     node oracle/bin/replay.js --engine oracle/examples/js-build-adapter.js
 *
 * (`--engine <package directory>` does the same without a module.)
 */

const path = require('path');
const { loadPackage } = require('../lib/core');
const { coreAdapter } = require('../lib/adapter');

/**
 * @returns {object} adapter
 */
function createAdapter() {
    const dir = process.env.CONCERTO_CORE_DIR
        ? path.resolve(process.env.CONCERTO_CORE_DIR)
        : path.dirname(require.resolve('@accordproject/concerto-core/package.json', { paths: [process.cwd()] }));
    const core = loadPackage(dir);
    return coreAdapter(core, `my-app (${core.label})`);
}

module.exports = { createAdapter };

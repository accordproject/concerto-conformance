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

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ORACLE_DIR = path.resolve(__dirname, '..');
const SOURCES = new Set(['unit', 'data', 'conformance', 'gaps', 'lifted', 'supplement']);

test('expected-6.0.0.tsv: well-formed rows, each with a reason and a public link', () => {
    const lines = fs.readFileSync(path.join(ORACLE_DIR, 'expected-6.0.0.tsv'), 'utf8').split('\n').filter((l) => l && !l.startsWith('#'));
    assert.equal(lines[0], 'source\top\tid\treason');
    const seen = new Set();
    for (const line of lines.slice(1)) {
        const cols = line.split('\t');
        assert.equal(cols.length, 4, line);
        const [source, op, id, reason] = cols;
        assert.ok(SOURCES.has(source), line);
        assert.match(op, /^[A-Za-z]+\.[A-Za-z]+$/, line);
        assert.match(id, /^[0-9a-f]{24}$/, line);
        assert.match(reason, /\(https:\/\/github\.com\/accordproject\/[a-z-]+\/(pull|issues)\/\d+\)$/, line);
        assert.ok(!seen.has(`${source}/${id}`), 'duplicate ' + line);
        seen.add(`${source}/${id}`);
    }
});

test('corpus.json names an asset, its hashes and its URL', () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(ORACLE_DIR, 'corpus.json'), 'utf8'));
    assert.match(cfg.sha256, /^[0-9a-f]{64}$/);
    assert.match(cfg.tar_sha256, /^[0-9a-f]{64}$/);
    assert.equal(cfg.asset, `${cfg.release}.tgz`);
    assert.equal(cfg.url, `https://github.com/${cfg.repository}/releases/download/${cfg.release}/${cfg.asset}`);
    assert.ok(cfg.release.endsWith(cfg.tar_sha256.slice(0, 12)));
});

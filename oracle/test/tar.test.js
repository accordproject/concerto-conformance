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
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { writeTar, readTar, gzipDeterministic } = require('../lib/tar');

const files = [
    { path: 'oracle-corpus/CORPUS.json', data: Buffer.from('{}\n') },
    { path: 'oracle-corpus/fixtures/unit/ClassDeclaration.getAssignableClassDeclarations/0123456789abcdef01234567.json', data: Buffer.from('{"a":1}') },
    { path: 'oracle-corpus/fixtures/' + 'x'.repeat(90) + '/' + 'y'.repeat(60) + '.json', data: Buffer.alloc(1500, 0x61) },
];

test('the same files give the same bytes, and read back unchanged', () => {
    const a = gzipDeterministic(writeTar(files));
    const b = gzipDeterministic(writeTar(files.map((f) => ({ path: f.path, data: Buffer.from(f.data) }))));
    assert.ok(a.equals(b));
    assert.equal(a.readUInt32LE(4), 0, 'gzip mtime is 0');
    assert.deepEqual(readTar(a).map((f) => [f.path, f.data.toString()]), files.map((f) => [f.path, f.data.toString()]));
});

test('a path too long for ustar is refused', () => {
    assert.throws(() => writeTar([{ path: 'a'.repeat(300), data: Buffer.alloc(0) }]), /too long/);
});

test('system tar reads the archive, and the reader skips AppleDouble entries', { skip: !hasTar() }, () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oracle-tar-'));
    const file = path.join(dir, 'a.tgz');
    fs.writeFileSync(file, gzipDeterministic(writeTar(files)));
    const listed = execFileSync('tar', ['tzf', file], { encoding: 'utf8' }).trim().split('\n');
    assert.deepEqual(listed, files.map((f) => f.path));
    const withDouble = writeTar([{ path: 'oracle-corpus/._x.json', data: Buffer.from('junk') }].concat(files));
    assert.equal(readTar(withDouble).length, files.length);
    fs.rmSync(dir, { recursive: true, force: true });
});

/**
 * @returns {boolean} whether a tar binary is on the PATH
 */
function hasTar() {
    try {
        execFileSync('tar', ['--version'], { stdio: 'ignore' });
        return true;
    } catch (e) {
        return false;
    }
}

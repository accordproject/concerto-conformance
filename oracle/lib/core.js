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
 * Loads the set of concerto-core modules the JS adapter needs from one
 * build of `@accordproject/concerto-core`.
 *
 * A build is a package directory (the one holding concerto-core's
 * `package.json`) whose compiled modules live under `dist/`, laid out as
 * in the published 5.x packages (`dist/modelmanager.js`,
 * `dist/introspect/modelfile.js`, ...). A source checkout built with
 * `npm run build` has the same layout.
 *
 * The frozen reference is concerto-core 5.0.0 from npm, installed in
 * `oracle/reference` (`npm ci` there); `ORACLE_REFERENCE_DIR` overrides that
 * directory.
 */

const path = require('path');

const ORACLE_DIR = path.resolve(__dirname, '..');
const REF_DIR = process.env.ORACLE_REFERENCE_DIR || path.join(ORACLE_DIR, 'reference');
const REF_PKG_DIR = path.join(REF_DIR, 'node_modules', '@accordproject', 'concerto-core');

/**
 * Pick the named export of a CJS-compiled TS module.
 * @param {object} mod module
 * @param {string} name export name
 * @returns {*} export
 */
function pick(mod, name) {
    if (mod && mod[name] !== undefined) {
        return mod[name];
    }
    if (mod && mod.default !== undefined) {
        return mod.default;
    }
    return mod;
}

/**
 * Load the module set.
 * @param {string} root directory containing basemodelmanager.js etc. (a build's dist/)
 * @param {string} label a label for diagnostics
 * @returns {object} core module set
 */
function loadCore(root, label) {
    const req = (rel) => require(path.join(root, rel));
    const core = {
        label,
        root,
        req,
        BaseModelManager: pick(req('basemodelmanager'), 'BaseModelManager'),
        ModelManager: pick(req('modelmanager'), 'ModelManager'),
        AstModelManager: pick(req('astmodelmanager'), 'AstModelManager'),
        modelFileModule: req('introspect/modelfile'),
        Declaration: pick(req('introspect/declaration'), 'Declaration'),
        ClassDeclaration: pick(req('introspect/classdeclaration'), 'ClassDeclaration'),
        MapDeclaration: pick(req('introspect/mapdeclaration'), 'MapDeclaration'),
        Property: pick(req('introspect/property'), 'Property'),
        MapKeyType: pick(req('introspect/mapkeytype'), 'MapKeyType'),
        MapValueType: pick(req('introspect/mapvaluetype'), 'MapValueType'),
        Factory: pick(req('factory'), 'Factory'),
        Serializer: pick(req('serializer'), 'Serializer'),
        Typed: pick(req('model/typed'), 'Typed'),
        Resource: pick(req('model/resource'), 'Resource'),
        Relationship: pick(req('model/relationship'), 'Relationship'),
        ValidatedResource: pick(req('model/validatedresource'), 'ValidatedResource'),
        ResourceValidator: pick(req('serializer/resourcevalidator'), 'ResourceValidator'),
        ModelUtil: pick(req('modelutil'), 'ModelUtil'),
        metaModelModule: req('introspect/metamodel'),
        DecoratorManager: pick(req('decoratormanager'), 'DecoratorManager'),
        dcsConverterModule: req('dcsconverter'),
        dayjs: pick(req('dayjs-setup'), 'default'),
        dateTimeUtilModule: req('datetimeutil'),
        Introspector: pick(req('introspect/introspector'), 'Introspector'),
        Identifiable: pick(req('model/identifiable'), 'Identifiable'),
        Decorated: pick(req('introspect/decorated'), 'Decorated'),
        Decorator: pick(req('introspect/decorator'), 'Decorator'),
        Validator: pick(req('introspect/validator'), 'Validator'),
        StringValidator: pick(req('introspect/stringvalidator'), 'StringValidator'),
        NumberValidator: pick(req('introspect/numbervalidator'), 'NumberValidator'),
        CollectionSizeValidator: pick(req('introspect/collectionsizevalidator'), 'CollectionSizeValidator'),
        IdentifiedDeclaration: pick(req('introspect/identifieddeclaration'), 'IdentifiedDeclaration'),
        AssetDeclaration: pick(req('introspect/assetdeclaration'), 'AssetDeclaration'),
        ConceptDeclaration: pick(req('introspect/conceptdeclaration'), 'ConceptDeclaration'),
        EventDeclaration: pick(req('introspect/eventdeclaration'), 'EventDeclaration'),
        ParticipantDeclaration: pick(req('introspect/participantdeclaration'), 'ParticipantDeclaration'),
        TransactionDeclaration: pick(req('introspect/transactiondeclaration'), 'TransactionDeclaration'),
        EnumDeclaration: pick(req('introspect/enumdeclaration'), 'EnumDeclaration'),
        ScalarDeclaration: pick(req('introspect/scalardeclaration'), 'ScalarDeclaration'),
        Field: pick(req('introspect/field'), 'Field'),
        RelationshipDeclaration: pick(req('introspect/relationshipdeclaration'), 'RelationshipDeclaration'),
        EnumValueDeclaration: pick(req('introspect/enumvaluedeclaration'), 'EnumValueDeclaration'),
        TypeNotFoundException: pick(req('typenotfoundexception'), 'TypeNotFoundException'),
        SecurityException: pick(req('securityexception'), 'SecurityException'),
        DecoratorFactory: pick(req('introspect/decoratorfactory'), 'DecoratorFactory'),
        ModelLoader: pick(req('modelloader'), 'ModelLoader'),
    };
    Object.defineProperty(core, 'ModelFile', {
        enumerable: true,
        get: () => pick(core.modelFileModule, 'ModelFile'),
    });
    // The `uuid` module this build resolves, so the seeded envelope
    // (lib/env.js) can make generated identifiers deterministic.
    try {
        core.uuid = require(require.resolve('uuid', { paths: [root] }));
    } catch (e) {
        core.uuid = null;
    }
    // Run the package entry point too, as every consumer of concerto-core
    // does. The modules above are the same instances it re-exports.
    req('index');
    return core;
}

const cache = new Map();

/**
 * Load a concerto-core build from its package directory.
 * @param {string} pkgDir directory holding concerto-core's package.json
 * @param {string} [label] a label for reports (default: name@version)
 * @returns {object} core
 */
function loadPackage(pkgDir, label) {
    const dir = path.resolve(pkgDir);
    if (!cache.has(dir)) {
        const pkg = require(path.join(dir, 'package.json'));
        cache.set(dir, loadCore(path.join(dir, 'dist'), label || `${pkg.name}@${pkg.version}`));
    }
    return cache.get(dir);
}

/**
 * The frozen npm reference core (concerto-core 5.0.0).
 * @returns {object} core
 */
function getRefCore() {
    try {
        require.resolve(path.join(REF_PKG_DIR, 'package.json'));
    } catch (e) {
        throw new Error(`the reference build is not installed: run \`npm ci\` in ${REF_DIR}`);
    }
    return loadPackage(REF_PKG_DIR, 'reference@5.0.0');
}

module.exports = { loadCore, loadPackage, getRefCore, REF_DIR, REF_PKG_DIR };

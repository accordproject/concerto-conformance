import { Before, When, Then } from '@cucumber/cucumber';
import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { ModelLoader, Factory, Serializer } from '@accordproject/concerto-core';

let output = '';
let error = '';
let lastError = null;
let exitCode = null;

// The results live at module level, so reset them before every scenario:
// otherwise a scenario whose When step never ran would see the previous
// scenario's result.
Before(function () {
  output = '';
  error = '';
  lastError = null;
  exitCode = null;
});

/**
 * Raised when a fixture (instance or model file) is missing or unreadable.
 * This is a problem with the suite, not with the runtime under test, so it
 * fails the step itself and never counts as the validation failure a
 * scenario expects.
 */
class FixtureError extends Error {}

function readInstance(jsonPath) {
  const fullJsonPath = path.resolve(jsonPath);
  if (!fs.existsSync(fullJsonPath) || !fs.statSync(fullJsonPath).isFile()) {
    throw new FixtureError(`cannot read fixture ${jsonPath}: not found at ${fullJsonPath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(fullJsonPath, 'utf8'));
  } catch (err) {
    throw new FixtureError(`cannot parse fixture ${jsonPath}: ${err.message}`);
  }
}

function modelPathOf(modelPath) {
  const fullModelPath = path.resolve(modelPath);
  if (!fs.existsSync(fullModelPath) || !fs.statSync(fullModelPath).isFile()) {
    throw new FixtureError(`cannot read fixture ${modelPath}: not found at ${fullModelPath}`);
  }
  return fullModelPath;
}

function recordSuccess(validatedJSON) {
  output = JSON.stringify(validatedJSON, null, 2);
  error = '';
  lastError = null;
  exitCode = 0;
}

function recordFailure(err) {
  output = '';
  error = err.message;
  lastError = err;
  exitCode = 1;
}

When('I validate {string} with models {string}', async function (jsonPath, modelPath) {
  const json = readInstance(jsonPath);
  const fullModelPath = modelPathOf(modelPath);
  try {
    const modelManager = await ModelLoader.loadModelManager([fullModelPath], { offline: true });
    const factory = new Factory(modelManager);
    const serializer = new Serializer(factory, modelManager);

    const object = serializer.fromJSON(json, {});
    const validatedJSON = serializer.toJSON(object, {});

    recordSuccess(validatedJSON);
  } catch (err) {
    recordFailure(err);
  }
});

When('I validate {string} with models {string} and options:', async function (jsonPath, modelPath, dataTable) {
  const json = readInstance(jsonPath);
  const fullModelPath = modelPathOf(modelPath);
  try {
    const modelManager = await ModelLoader.loadModelManager([fullModelPath], { offline: true });
    const factory = new Factory(modelManager);
    const serializer = new Serializer(factory, modelManager);
    const options = dataTable.rowsHash();
    Object.keys(options).forEach(key => {
      const value = options[key];
      if (!isNaN(value)) {
        options[key] = Number(value);
      }
    });
    const object = serializer.fromJSON(json, options);
    const validatedJSON = serializer.toJSON(object, options);
    recordSuccess(validatedJSON);
  } catch (err) {
    recordFailure(err);
  }
});

Then('the validation should succeed', function () {
  assert.strictEqual(exitCode, 0, `Expected success but got error: ${error}`);
});

Then('the validation should fail', function () {
  assert.notStrictEqual(exitCode, 0, 'Expected failure but validation succeeded');
});

Then('the error message should contain {string}', function (expectedMessage) {
  assert(error.includes(expectedMessage), `Expected error to contain "${expectedMessage}", but got "${error}"`);
});

/**
 * The class name of an error: the cross-implementation exception name
 * (`ValidationException`, `TypeNotFoundException`, ...). Concerto's
 * exceptions set `name` to their constructor's name.
 */
function errorClass(err) {
  return err?.name || err?.constructor?.name || typeof err;
}

Then('an error of class {string} should be thrown', function (expected) {
  assert.notStrictEqual(exitCode, 0, `Expected an error of class ${expected}, but validation succeeded`);
  const actual = errorClass(lastError);
  assert.strictEqual(actual, expected, `Expected an error of class ${expected}, but got ${actual}: "${error}"`);
});

// Only for names that come from the model or the instance (a type, property
// or namespace), never for message prose.
Then('the error should mention {string}', function (name) {
  assert.notStrictEqual(exitCode, 0, `Expected an error mentioning "${name}", but validation succeeded`);
  assert(error.includes(name), `Expected the error to mention "${name}", but got "${error}"`);
});

// Rejection at the 'rejected' level: validation failed with an error of any
// class. For rules where the implementations do not (yet) share an error
// class; pair it with an `@rule` tag, a mention where a model or instance
// name exists, and the error type where one is standardised.
Then('an error should be thrown', function () {
  assert.strictEqual(exitCode, 1, 'Expected an error to be thrown, but validation succeeded or did not run');
  assert(lastError, 'Expected an error to be thrown, but none was recorded');
});

// The error's `errorType` code (e.g. `DefaultValidatorException`), compared exactly.
Then('the error type should be {string}', function (expected) {
  assert.strictEqual(exitCode, 1, `Expected an error of type ${expected}, but validation succeeded or did not run`);
  assert(lastError, `Expected an error of type ${expected}, but none was recorded`);
  assert.strictEqual(
    lastError.errorType,
    expected,
    `Expected an error of type ${expected}, but got ${lastError.errorType}: "${error}"`
  );
});

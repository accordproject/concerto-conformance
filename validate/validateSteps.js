import { When, Then } from '@cucumber/cucumber';
import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { ModelLoader, Factory, Serializer } from '@accordproject/concerto-core';

let output = '';
let error = '';
let exitCode = null;

When('I validate {string} with models {string}', async function (jsonPath, modelPath) {
  try {
    const fullJsonPath = path.resolve(jsonPath);
    const fullModelPath = path.resolve(modelPath);

    const json = JSON.parse(fs.readFileSync(fullJsonPath, 'utf8'));

    const modelManager = await ModelLoader.loadModelManager([fullModelPath], { offline: true });
    const factory = new Factory(modelManager);
    const serializer = new Serializer(factory, modelManager);

    const object = serializer.fromJSON(json, {});
    const validatedJSON = serializer.toJSON(object, {});

    output = JSON.stringify(validatedJSON, null, 2);
    error = '';
    exitCode = 0;
  } catch (err) {
    output = '';
    error = err.message;
    exitCode = 1;
  }
});

When('I validate {string} with models {string} and options:', async function (jsonPath, modelPath, dataTable) {
  try {
    const fullJsonPath = path.resolve(jsonPath);
    const fullModelPath = path.resolve(modelPath);

    const json = JSON.parse(fs.readFileSync(fullJsonPath, 'utf8'));

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
    output = JSON.stringify(validatedJSON, null, 2);
    error = '';
    exitCode = 0;
  } catch (err) {
    output = '';
    error = err.message;
    exitCode = 1;
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

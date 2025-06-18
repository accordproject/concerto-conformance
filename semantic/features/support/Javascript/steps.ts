import { Given, When, Then } from '@cucumber/cucumber';
import { loadCTO } from './utils/loadCTO.ts';
import { Parser } from '@accordproject/concerto-cto';
import { ModelFile } from '@accordproject/concerto-core';
import assert from 'assert';

Given('I load the following models:', function (dataTable) {
  for (const row of dataTable.hashes()) {
    const modelContent = loadCTO(row.model_file);
    try {
      // this.modelManager.addCTOModel(modelContent, row.model_file, true);
      const ast = Parser.parse(modelContent, row.model_file);
      const modelFile = new ModelFile(this.modelManager, ast, modelContent, row.model_file);
      this.modelManager.addModelFile(modelFile, null, modelFile.getName(), true);
    } catch (err) {
      this.error = err as Error;
      break;
    }
  }
});

When('I validate the models', function () {
  try {
    this.modelManager.validateModelFiles();
    this.error = null;
  } catch (err) {
    this.error = err as Error;
  }
});

Then('an error should be thrown with message {string}', function (expected: string) {
  assert(this.error, 'Expected an error to be thrown, but none was');

  let isMatch: boolean;
  const match = expected.match(/^\/(.+)\/([gimsuy]*)?$/);

  if (match) {
    const pattern = new RegExp(match[1], match[2]);
    isMatch = pattern.test(this.error.message);
    assert(
      isMatch,
      `Expected error to match regex ${pattern}, but got: "${this.error.message}"`
    );
  } else {
    isMatch = this.error.message.includes(expected);
    assert(
      isMatch,
      `Expected error to include "${expected}", but got: "${this.error.message}"`
    );
  }
});


Then('no error should be thrown', function () {
  assert.strictEqual(this.error, null, `Expected no error, but got: ${this.error?.message}`);
});
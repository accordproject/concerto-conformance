import { Given, When, Then, Before } from '@cucumber/cucumber';
import { loadCTO } from './utils/loadCTO.ts';
import { loadDependencies } from './utils/dynamicLoader.ts';
import assert from 'assert';
import path from 'path';
import fs from 'fs';

let Parser: any;
let ModelFile: any;

Before(async function () {
  await this.initialize();
  const deps = await loadDependencies();
  Parser = deps.Parser;
  ModelFile = deps.ModelFile;
});

/**
 * Raised when a fixture cannot be loaded or parsed. This is a problem with
 * the suite, not with the runtime under test, so it must never be mistaken
 * for the domain error a scenario is asserting on.
 */
class FixtureError extends Error {}

function loadAST(astPath: string): any {
  const basePath = path.resolve('semantic/specifications/');
  let currPath=astPath;
  astPath = path.join(basePath, currPath);
  if (!fs.existsSync(astPath) || !fs.statSync(astPath).isFile()) {
    throw new FixtureError(`cannot read fixture ${currPath}: not found at ${astPath}`);
  }
  const astContent = fs.readFileSync(astPath, 'utf8');
  try {
    return JSON.parse(astContent);
  } catch (err) {
    throw new FixtureError(`cannot parse fixture ${currPath}: ${(err as Error).message}`);
  }
}

Given('I load the following models:', function (dataTable) {
  for (const row of dataTable.hashes()) {
    const modelContent = undefined;
    try {
      const ast = loadAST(row.model_file);
      const modelFile = new ModelFile(this.modelManager, ast, modelContent, row.model_file);
      this.modelManager.addModelFile(modelFile, null, modelFile.getName(), true);
    } catch (err) {
      if (err instanceof FixtureError) {
        // A fixture that cannot be loaded must never satisfy an
        // expectation: fail the step itself rather than recording a
        // (fake) domain error.
        throw err;
      }
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

/**
 * The class name of an error: the cross-implementation exception name
 * (`IllegalModelException`, `ValidationException`, `TypeNotFoundException`,
 * `MetamodelException`, ...). Concerto's exceptions set `name` to their
 * constructor's name.
 */
function errorClass(err: any): string {
  return err?.name || err?.constructor?.name || typeof err;
}

Then('an error of class {string} should be thrown', function (expected: string) {
  assert(this.error, `Expected an error of class ${expected}, but none was thrown`);
  const actual = errorClass(this.error);
  assert.strictEqual(
    actual,
    expected,
    `Expected an error of class ${expected}, but got ${actual}: "${this.error.message}"`
  );
});

// Only for names that come from the model or the instance (a type, property
// or namespace), never for message prose.
Then('the error should mention {string}', function (name: string) {
  assert(this.error, `Expected an error mentioning "${name}", but none was thrown`);
  assert(
    String(this.error.message).includes(name),
    `Expected the error to mention "${name}", but got: "${this.error.message}"`
  );
});

// Rejection at the 'rejected' level: some error was thrown, of any class.
// For rules where the implementations do not (yet) share an error class;
// pair it with an `@rule` tag, a mention where a model or instance name
// exists, and the error type where one is standardised.
Then('an error should be thrown', function () {
  assert(this.error, 'Expected an error to be thrown, but none was');
});

// The error's `errorType` code (e.g. `DefaultValidatorException`,
// `RegexValidatorException`), compared exactly.
Then('the error type should be {string}', function (expected: string) {
  assert(this.error, `Expected an error of type ${expected}, but none was thrown`);
  assert.strictEqual(
    this.error.errorType,
    expected,
    `Expected an error of type ${expected}, but got ${this.error.errorType}: "${this.error.message}"`
  );
});

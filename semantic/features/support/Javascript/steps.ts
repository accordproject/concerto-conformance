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

/**
 * Adds each model_file of the table to the world's model manager.
 * @param disableValidation - true to add without validation (the models are
 * validated later by "When I validate the models"), false to validate each
 * model as it is added, as `ModelManager.addModel` does by default: this is
 * the only path that runs the metamodel validation option.
 */
function loadModels(world: any, dataTable: any, disableValidation: boolean) {
  for (const row of dataTable.hashes()) {
    const modelContent = undefined;
    try {
      const ast = loadAST(row.model_file);
      const modelFile = new ModelFile(world.modelManager, ast, modelContent, row.model_file);
      world.modelManager.addModelFile(modelFile, null, modelFile.getName(), disableValidation);
    } catch (err) {
      if (err instanceof FixtureError) {
        // A fixture that cannot be loaded must never satisfy an
        // expectation: fail the step itself rather than recording a
        // (fake) domain error.
        throw err;
      }
      world.error = err as Error;
      break;
    }
  }
}

/**
 * Converts an option cell to a JSON value: `true`/`false` to booleans,
 * numbers to numbers, anything else stays a string.
 */
function optionValue(cell: string): unknown {
  const text = cell.trim();
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (text !== '' && !isNaN(Number(text))) return Number(text);
  return text;
}

// Replaces the scenario's model manager with one built with these options.
// Must come before the models are loaded. A dotted option name sets a nested
// field: `decoratorValidation.missingDecorator` | `error` gives
// `{ decoratorValidation: { missingDecorator: 'error' } }`.
Given('the model manager options:', async function (dataTable) {
  const options: Record<string, any> = {};
  for (const row of dataTable.hashes()) {
    const pathParts = String(row.option).trim().split('.');
    let target = options;
    for (const part of pathParts.slice(0, -1)) {
      target[part] = target[part] ?? {};
      target = target[part];
    }
    target[pathParts[pathParts.length - 1]] = optionValue(row.value);
  }
  await this.initialize(options);
});

Given('I load the following models:', function (dataTable) {
  loadModels(this, dataTable, true);
});

Given('I load the following models with validation:', function (dataTable) {
  loadModels(this, dataTable, false);
});

When('I validate the models', function () {
  // A model that failed to load was never added, so validating the rest
  // would wrongly clear the load error (the Rust runner only validates when
  // every model loaded, too).
  if (this.error) {
    return;
  }
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

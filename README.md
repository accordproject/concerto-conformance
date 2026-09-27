# Concerto Conformance Test Suite

## Desription
The Concerto Conformance Test Suite provides a standardized, automated testing suite to validate models and semantic behavior across Accord Project's Concerto implementation.

## Overview
This repository includes:
1. A set of semantic validation rules
2. Comprehensive valid and invalid model examples
3. Tests written using Cucumber, offering behavior-driven, human-readable test definitions
4. Support for both JavaScript, C#(partially) and Rust runtimes.
The suite specifically tests core components of the Concerto ecosystem: the `ModelFile` and `ModelManager` classes from `@accordproject/concerto-core`

## Working:
This test suite enables straightforward integration with CI/CD pipelines, so Concerto itself can:   
1. Automatically run conformance tests on every push
2. Detect semantic rule violations or model-breaking changes early
3. Maintain consistent validation standards across development workflows   

## Getting started
1. Install dependencies:
    `npm install`
2. Run the Javascript test suite (semantic and instance features):
    `npm test`
3. Run tests for C#:
    `npm run test:csharp`
4. Running tests for Rust can be done through the concerto-rust repository.   

## Interactive CLI:
You can also use the built-in CLI for a guided setup:
    `npm start`   
The CLI allows you to provide custom ModelManager, Parser, or ModelFile sources for testing.

## Assertions and tags
Promoted scenarios assert an error **class** and a rule, never an implementation's
message text:

| Step | Meaning |
|---|---|
| `Then an error of class "<Class>" should be thrown` | the error's class name, e.g. `IllegalModelException`, `ValidationException`, `MetamodelException` |
| `And the error should mention "<name>"` | the message contains a name from the model or instance (a type, property or namespace) |
| `Then an error should be thrown` | rejection of any class, for rules where the implementations do not share a class yet |
| `And the error type should be "<code>"` | the error's `errorType`, e.g. `DefaultValidatorException` (validator errors are asserted this way until they leave `BaseException`) |
| `Given the model manager options:` | builds the model manager with options (`option` and `value` columns; a dotted option name sets a nested field) |
| `Given I load the following models with validation:` | adds each model with load-time validation, which is where metamodel validation runs |

Each promoted scenario carries an `@rule:<ID>` tag and a comment citing its
source (an oracle fixture or a fuzz cluster, see concerto's
`migration/CONFORMANCE-PROMOTION-PLAN.md`). A missing or unreadable fixture fails
the step instead of counting as the expected error.

The Rust and C# runners do not have these steps yet, so the semantic scenarios
that use them are tagged `@skip-rust` (positive scenarios that need only the
existing steps run on the Rust runner). The Rust runner needs the class step (a
mapping from the crate's error to its class name), the mention step, the options
step and the validated-load step, plus instance steps to run the instance
features; the models added by P5-08b have `.ast.json` siblings for that, and the
older `validate/models` still need them. The C# runner needs
the same steps. `@skip-rust` does not apply to it, so once it runs these
feature files it will hit the undefined steps and fail those scenarios.


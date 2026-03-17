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
2. Run the Javascript test suite:
    `npm test`
3. Run tests for C#:
    `npm run test:csharp`
4. Running tests for Rust can be done through the concerto-rust repository.   

## Interactive CLI:
You can also use the built-in CLI for a guided setup:
    `npm start`   
The CLI allows you to provide custom ModelManager, Parser, or ModelFile sources for testing.

## Detailed Documentation

For a deep dive into the testing framework, architecture, and advanced usage, please read the [Testing Guide](docs/TESTING_GUIDE.md).

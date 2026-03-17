# Concerto Conformance Testing Guide

This guide provides a comprehensive overview of the testing framework, repository structure, and instructions for running the Concerto Conformance Test Suite locally.

## 1. Testing Framework

The suite uses **Cucumber**, a Behavior-Driven Development (BDD) framework, to ensure semantic correctness across different Concerto implementations (JavaScript, C#, and Rust).

* **Behavior-Driven:** Tests are defined in human-readable `.feature` files using Gherkin syntax (Given/When/Then).
* **Multi-Runtime:** The core test scenarios are language-agnostic. Each target language (Runtime) has its own "glue code" (step definitions) to execute these shared scenarios.
    * **JavaScript:** Executed via `cucumber-js` and `ts-node`.
    * **C#:** Executed via `.NET` test runner.
    * **Rust:** Supported via the `concerto-rust` integration.

## 2. Test Suite Structure

The repository is organized to separate abstract rules from concrete models and implementations.

| Directory | Description |
| :--- | :--- |
| **`semantic/features/`** | **Feature Files.** Contains Gherkin scenarios describing rules (e.g., `concepts.feature`, `enums.feature`). These are the actual tests. |
| **`semantic/specifications/`** | **Test Data.** Organized by category (e.g., `concepts/`, `imports/`). Contains: <br>• `.cto` files: Concerto models (valid and invalid cases).<br>• `.json` files: Expected AST outputs for valid models. |
| **`semantic/features/support/`** | **Step Definitions.** The code that executes the features.<br>• `Javascript/`: TypeScript steps for Node.js.<br>• `C#/`: C# steps for .NET.<br>• `rust/`: Rust steps. |
| **`validate/`** | **Instance Validation.** A separate suite for validating JSON instances against models, distinct from model semantic validation. |

## 3. Setup and Usage

### Prerequisites
* **Node.js**: v18 or higher (Recommended).
* **.NET SDK**: Required only if you plan to run C# tests.

### Installation
Clone the repository and install dependencies:

```bash
git clone [https://github.com/accordproject/concerto-conformance.git](https://github.com/accordproject/concerto-conformance.git)
cd concerto-conformance
npm install
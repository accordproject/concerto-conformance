//! The instance suite's steps (`validate/features/*.feature`), matching
//! `validate/validateSteps.js`.
//!
//! The JS steps load the `.cto` model with `ModelLoader.loadModelManager`
//! (offline, so the models are validated once loaded), then run
//! `Serializer.fromJSON` on the instance. This runtime has no CTO parser,
//! so the model is read from its JSON AST sibling (`<model>.ast.json`,
//! generated from the `.cto` with concerto-cto), and the instance is checked
//! with [`ModelManager::validate_instance`], which is `fromJSON` with
//! validation on and default options.

use std::path::{Path, PathBuf};

use concerto_core::instance::ValidationOptions;
use concerto_core::json::Value;
use concerto_core::{Error, ModelManager};
use cucumber::{gherkin::Step, then, when, World};
use regex::Regex;

use crate::steps::{error_class, error_type, read_json};

/// The repository root, which the feature files' paths are relative to.
pub fn repo_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../../..")
}

/// `validate/features`.
pub fn features_dir() -> PathBuf {
    repo_dir().join("validate/features")
}

#[derive(Debug, Default, World)]
pub struct InstanceWorld {
    /// The outcome of the scenario's `When I validate` step, once run.
    result: Option<Result<(), Error>>,
    /// Set when an error was raised but its message did not match: the
    /// expectation from the step. Any other failure leaves it unset.
    message_mismatch: Option<String>,
}

/// The JSON AST sibling of a `.cto` model: `<model>.ast.json`.
fn ast_path(model: &str) -> String {
    format!("{}.ast.json", model.strip_suffix(".cto").unwrap_or(model))
}

/// The instance and model paths of a `When I validate` step.
fn validate_step_paths(step: &Step) -> Option<(String, String)> {
    let re = Regex::new(r#"^I validate "([^"]*)" with models "([^"]*)""#).unwrap();
    let caps = re.captures(&step.value)?;
    Some((caps[1].to_string(), caps[2].to_string()))
}

/// The fixtures a step reads: the instance, the `.cto` model and its AST.
pub fn fixtures(step: &Step) -> Vec<String> {
    validate_step_paths(step)
        .map(|(instance, model)| vec![instance, ast_path(&model), model])
        .unwrap_or_default()
}

/// Checks a fixture the step reads. Any failure here is a problem with the
/// suite, not with the runtime under test.
pub fn check_fixture(path: &str) -> Result<(), String> {
    let full = repo_dir().join(path);
    if path.ends_with(".cto") {
        // The JS runner reads the `.cto`; this one reads its AST sibling,
        // but a scenario whose `.cto` is gone is broken for both.
        return if full.is_file() {
            Ok(())
        } else {
            Err(format!("cannot read fixture {path}: not found"))
        };
    }
    read_json(&full, path).map(drop)
}

/// `ModelLoader.loadModelManager([model], { offline: true })`: the model is
/// added, then every model is validated.
fn load_model_manager(model: &str) -> Result<ModelManager, Error> {
    let ast_file = ast_path(model);
    let ast = read_json(&repo_dir().join(&ast_file), &ast_file)
        .unwrap_or_else(|e| panic!("harness error: {e}"));
    let mut manager = ModelManager::new().expect("harness error: ModelManager::new failed");
    let file_name = repo_dir().join(model).to_string_lossy().into_owned();
    manager.add_model_ast(&ast, Some(&file_name))?;
    manager.validate_models()?;
    Ok(manager)
}

fn validate(instance: &Value, model: &str) -> Result<(), Error> {
    let manager = load_model_manager(model)?;
    manager.validate_instance(instance, &ValidationOptions::default())
}

#[when(expr = "I validate {string} with models {string}")]
async fn validate_instance(world: &mut InstanceWorld, instance: String, model: String) {
    // A fixture that cannot be loaded must never satisfy an expectation.
    let json = read_json(&repo_dir().join(&instance), &instance)
        .unwrap_or_else(|e| panic!("harness error: {e}"));
    check_fixture(&model).unwrap_or_else(|e| panic!("harness error: {e}"));
    world.result = Some(validate(&json, &model));
}

impl InstanceWorld {
    /// The expected message of a failed error step, if the only problem was
    /// that the runtime raised a different message.
    pub fn message_mismatch(&self) -> Option<&str> {
        self.message_mismatch.as_deref()
    }

    fn result(&self) -> &Result<(), Error> {
        self.result
            .as_ref()
            .expect("harness error: no `When I validate` step ran")
    }

    /// The error raised, if any.
    fn error(&self) -> Option<&Error> {
        self.result().as_ref().err()
    }
}

#[then("the validation should succeed")]
async fn expect_success(world: &mut InstanceWorld) {
    if let Some(err) = world.error() {
        panic!("Expected success but got error: {err}");
    }
}

#[then("the validation should fail")]
async fn expect_failure(world: &mut InstanceWorld) {
    assert!(
        world.error().is_some(),
        "Expected failure but validation succeeded"
    );
}

#[then(expr = "the error message should contain {string}")]
async fn expect_message(world: &mut InstanceWorld, expected: String) {
    let actual = world.error().map(Error::to_string).unwrap_or_default();
    if !actual.contains(&expected) {
        if world.error().is_some() {
            world.message_mismatch = Some(expected.clone());
        }
        panic!("Expected error to contain \"{expected}\", but got \"{actual}\"");
    }
}

#[then(expr = "an error of class {string} should be thrown")]
async fn expect_error_class(world: &mut InstanceWorld, expected: String) {
    let Some(err) = world.error() else {
        panic!("Expected an error of class {expected}, but validation succeeded");
    };
    let actual = error_class(err);
    assert_eq!(
        actual, expected,
        "Expected an error of class {expected}, but got {actual}: \"{err}\""
    );
}

// Only for names that come from the model or the instance (a type, property
// or namespace), never for message prose.
#[then(expr = "the error should mention {string}")]
async fn expect_error_mentions(world: &mut InstanceWorld, name: String) {
    let Some(err) = world.error() else {
        panic!("Expected an error mentioning \"{name}\", but validation succeeded");
    };
    let message = err.to_string();
    assert!(
        message.contains(&name),
        "Expected the error to mention \"{name}\", but got \"{message}\""
    );
}

// Rejection at the 'rejected' level: validation failed with an error of any
// class.
#[then("an error should be thrown")]
async fn expect_any_error(world: &mut InstanceWorld) {
    assert!(
        world.error().is_some(),
        "Expected an error to be thrown, but validation succeeded"
    );
}

// The error's `errorType` code, compared exactly.
#[then(expr = "the error type should be {string}")]
async fn expect_error_type(world: &mut InstanceWorld, expected: String) {
    let Some(err) = world.error() else {
        panic!("Expected an error of type {expected}, but validation succeeded");
    };
    let actual = error_type(err);
    assert_eq!(
        actual,
        Some(expected.as_str()),
        "Expected an error of type {expected}, but got {actual:?}: \"{err}\""
    );
}

#[cfg(test)]
mod tests {
    use super::ast_path;

    #[test]
    fn the_ast_is_the_cto_sibling() {
        assert_eq!(
            ast_path("validate/models/a/b.cto"),
            "validate/models/a/b.ast.json"
        );
    }
}

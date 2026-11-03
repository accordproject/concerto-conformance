//! The semantic suite's steps (`semantic/features/*.feature`), matching
//! `semantic/features/support/Javascript/steps.ts`.

use std::fs;
use std::path::{Path, PathBuf};

use concerto_core::json::Value;
use concerto_core::{DecoratorValidationOptions, Error, ModelFile, ModelManager};
use cucumber::{gherkin::Step, given, then, when, World};
use regex::Regex;

/// `semantic/specifications`, resolved from this crate's location so the
/// harness does not depend on the directory it is launched from.
pub fn specifications_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../../specifications")
}

/// `semantic/features`.
pub fn features_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..")
}

#[derive(Debug, Default, World)]
pub struct MyWorld {
    /// Error raised by the runtime while loading a model.
    load_error: Option<Error>,
    /// Outcome of `validate_models`, once run.
    validation_result: Option<Result<(), Error>>,
    /// The manager the models are loaded into: one built by `the model
    /// manager options:` until the models are loaded, then the loaded one.
    model_manager: Option<ModelManager>,
    /// Set when an error was raised but its message did not match: the
    /// expectation from the step. Any other failure leaves it unset.
    message_mismatch: Option<String>,
}

/// The `model_file` column of a step's table, in order.
pub fn model_files(step: &Step) -> Vec<String> {
    let Some(table) = step.table.as_ref() else {
        return Vec::new();
    };
    let Some((headers, rows)) = table.rows.split_first() else {
        return Vec::new();
    };
    let Some(col) = headers.iter().position(|h| h.trim() == "model_file") else {
        return Vec::new();
    };
    rows.iter()
        .filter_map(|row| row.get(col))
        .map(|cell| cell.trim().to_string())
        .collect()
}

/// Reads and parses a fixture. Any failure here is a problem with the suite,
/// not with the runtime under test.
pub fn load_fixture(path: &str) -> Result<Value, String> {
    read_json(&specifications_dir().join(path), path)
}

/// Reads and parses the JSON file at `full`, named `path` in messages, as
/// the `concerto_core::json::Value` the stable concerto-core API takes.
pub fn read_json(full: &Path, path: &str) -> Result<Value, String> {
    let content =
        fs::read_to_string(full).map_err(|e| format!("cannot read fixture {path}: {e}"))?;
    serde_json::from_str::<Value>(&content).map_err(|e| format!("cannot parse fixture {path}: {e}"))
}

/// A `the model manager options:` value: `true`/`false` as booleans,
/// anything else as the trimmed text, as the JS harness's `optionValue`
/// reads it (the options used so far are booleans and strings).
#[derive(Debug, PartialEq)]
enum OptionValue {
    Bool(bool),
    Text(String),
}

fn option_value(cell: &str) -> OptionValue {
    match cell.trim() {
        "true" => OptionValue::Bool(true),
        "false" => OptionValue::Bool(false),
        text => OptionValue::Text(text.to_string()),
    }
}

/// The `option | value` rows of a step's table, header excluded.
fn option_rows(step: &Step) -> Vec<(String, String)> {
    let Some(table) = step.table.as_ref() else {
        panic!("harness error: the model manager options step has no table");
    };
    let Some((headers, rows)) = table.rows.split_first() else {
        panic!("harness error: the model manager options table is empty");
    };
    let col = |name: &str| {
        headers
            .iter()
            .position(|h| h.trim() == name)
            .unwrap_or_else(|| panic!("harness error: options table has no `{name}` column"))
    };
    let (option, value) = (col("option"), col("value"));
    rows.iter()
        .map(|row| (row[option].trim().to_string(), row[value].clone()))
        .collect()
}

/// A manager built with the `ModelManagerOptions` of the rows, as the JS
/// harness's `new ModelManager(options)`. A dotted option name sets a
/// nested field (`decoratorValidation.missingDecorator`). An option this
/// harness does not know how to map is a harness error, never ignored.
fn manager_with_options(rows: &[(String, String)]) -> ModelManager {
    let mut builder = ModelManager::builder();
    let mut decorators = DecoratorValidationOptions::default();
    let mut decorators_set = false;
    for (option, cell) in rows {
        let value = option_value(cell);
        match (option.as_str(), value) {
            ("decoratorValidation.missingDecorator", OptionValue::Text(level)) => {
                decorators.missing_decorator = Some(level);
                decorators_set = true;
            }
            ("decoratorValidation.invalidDecorator", OptionValue::Text(level)) => {
                decorators.invalid_decorator = Some(level);
                decorators_set = true;
            }
            ("metamodelValidation", OptionValue::Bool(on)) => {
                builder = builder.metamodel_validation(on);
            }
            ("dangerouslyAllowReservedSystemTypeNamesInUserModels", OptionValue::Bool(on)) => {
                builder = builder.allow_reserved_system_type_names(on);
            }
            (option, value) => {
                panic!("harness error: unsupported model manager option {option} = {value:?}")
            }
        }
    }
    if decorators_set {
        builder = builder.decorator_validation(decorators);
    }
    builder
        .build()
        .unwrap_or_else(|e| panic!("harness error: ModelManager builder failed: {e}"))
}

// Replaces the scenario's model manager with one built with these options.
// Must come before the models are loaded.
#[given("the model manager options:")]
async fn model_manager_options(world: &mut MyWorld, step: &Step) {
    assert!(
        world.model_manager.is_none() && world.load_error.is_none(),
        "harness error: the model manager options must come before any model is loaded"
    );
    world.model_manager = Some(manager_with_options(&option_rows(step)));
}

/// Adds each `model_file` of the table to the scenario's manager, the one
/// the options step built or a default one.
///
/// `validate` false adds without validation (the models are validated later
/// by `When I validate the models`), as the JS harness's
/// `addModelFile(modelFile, null, name, true)`. `validate` true checks each
/// model as it is added, as TS `addModelFile` does by default: the
/// metamodel check first when `metamodelValidation` is on, then the model's
/// own semantic validation against the models added so far. This is the
/// only path that runs the metamodel validation option.
fn load_models(world: &mut MyWorld, step: &Step, validate: bool) {
    let files = model_files(step);
    assert!(
        !files.is_empty(),
        "harness error: step has no model_file rows"
    );

    let mut manager = match world.model_manager.take() {
        Some(manager) => manager,
        None => ModelManager::new().expect("harness error: ModelManager::new failed"),
    };
    for path in files {
        // A fixture that cannot be loaded must never satisfy an expectation.
        let ast = load_fixture(&path).unwrap_or_else(|e| panic!("harness error: {e}"));
        let added = if validate {
            add_validated(&mut manager, &ast, &path)
        } else {
            manager.add_model_ast(&ast, Some(&path)).map(drop)
        };
        if let Err(e) = added {
            world.load_error = Some(e);
            return;
        }
    }
    world.model_manager = Some(manager);
}

/// TS `addModelFile(modelFile, null, fileName, false)`: a duplicate
/// namespace is rejected first (by the add itself), then the metamodel check
/// if the option is on, then the new file's semantic validation.
fn add_validated(manager: &mut ModelManager, ast: &Value, path: &str) -> Result<(), Error> {
    let model_file = ModelFile::from_json(ast, Some(path.to_string()))?;
    if manager.model_file(model_file.namespace()).is_some() {
        return manager.add_model_file(model_file);
    }
    if manager.metamodel_validation() {
        manager.validate_ast(&model_file)?;
    }
    manager
        .validate_and_add_model_file(model_file)
        .map(drop)
        .map_err(|(e, _)| e)
}

#[given("I load the following models:")]
async fn load_models_unvalidated(world: &mut MyWorld, step: &Step) {
    load_models(world, step, false);
}

#[given("I load the following models with validation:")]
async fn load_models_validated(world: &mut MyWorld, step: &Step) {
    load_models(world, step, true);
}

#[when("I validate the models")]
async fn validate_models(world: &mut MyWorld) {
    // A model that failed to load was never added, so the manager is only
    // kept (and validated) when every model loaded.
    if world.load_error.is_some() {
        return;
    }
    if let Some(manager) = &world.model_manager {
        world.validation_result = Some(manager.validate_models());
    }
}

impl MyWorld {
    /// The expected message of a failed error step, if the only problem was
    /// that the runtime raised a different message.
    pub fn message_mismatch(&self) -> Option<&str> {
        self.message_mismatch.as_deref()
    }

    /// The error raised while loading or validating, if any.
    fn error(&self) -> Option<&Error> {
        self.load_error
            .as_ref()
            .or_else(|| self.validation_result.as_ref()?.as_ref().err())
    }
}

/// Whether `actual` satisfies an expectation: a `/pattern/flags` regex, as in
/// the JavaScript harness, or otherwise a substring.
pub fn message_matches(expected: &str, actual: &str) -> bool {
    let Some((pattern, flags)) = expected
        .strip_prefix('/')
        .and_then(|rest| rest.rsplit_once('/'))
        .filter(|(p, f)| !p.is_empty() && f.chars().all(|c| "gimsuy".contains(c)))
    else {
        return actual.contains(expected);
    };
    // `g`, `u` and `y` do not change whether a match exists.
    let inline: String = flags.chars().filter(|c| "ims".contains(*c)).collect();
    let pattern = if inline.is_empty() {
        pattern.to_string()
    } else {
        format!("(?{inline}){pattern}")
    };
    Regex::new(&pattern)
        .unwrap_or_else(|e| panic!("harness error: invalid expectation {expected}: {e}"))
        .is_match(actual)
}

/// The class name of an error: the cross-implementation exception name
/// (`IllegalModelException`, `ValidationException`, `TypeNotFoundException`,
/// `MetamodelException`, ...), the TS class the error's kind maps to.
pub fn error_class(err: &Error) -> &'static str {
    err.kind().ts_class()
}

/// The error's `errorType` code (`DefaultValidatorException`,
/// `RegexValidatorException`, ...): the one a validator error carries.
pub fn error_type(err: &Error) -> Option<&'static str> {
    err.contract().validator.as_ref().map(|v| v.error_type)
}

#[then(regex = r#"^an error should be thrown with message "(.*)"$"#)]
async fn expect_error_with_message(world: &mut MyWorld, expected: String) {
    let Some(actual) = world.error().map(Error::to_string) else {
        panic!("Expected an error matching '{expected}', but none was thrown.");
    };
    if !message_matches(&expected, &actual) {
        world.message_mismatch = Some(expected.clone());
        panic!("Error message mismatch.\nExpected: '{expected}'\nGot: '{actual}'");
    }
}

// Some scenarios only load models, so success does not require validation.
#[then("no error should be thrown")]
async fn expect_success(world: &mut MyWorld) {
    if let Some(err) = world.error() {
        panic!("Expected success, but got: {err}");
    }
}

#[then(expr = "an error of class {string} should be thrown")]
async fn expect_error_class(world: &mut MyWorld, expected: String) {
    let Some(err) = world.error() else {
        panic!("Expected an error of class {expected}, but none was thrown");
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
async fn expect_error_mentions(world: &mut MyWorld, name: String) {
    let Some(err) = world.error() else {
        panic!("Expected an error mentioning \"{name}\", but none was thrown");
    };
    let message = err.to_string();
    assert!(
        message.contains(&name),
        "Expected the error to mention \"{name}\", but got: \"{message}\""
    );
}

// Rejection at the 'rejected' level: some error was thrown, of any class.
#[then("an error should be thrown")]
async fn expect_any_error(world: &mut MyWorld) {
    assert!(
        world.error().is_some(),
        "Expected an error to be thrown, but none was"
    );
}

// The error's `errorType` code, compared exactly.
#[then(expr = "the error type should be {string}")]
async fn expect_error_type(world: &mut MyWorld, expected: String) {
    let Some(err) = world.error() else {
        panic!("Expected an error of type {expected}, but none was thrown");
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
    use super::{manager_with_options, message_matches, option_value, OptionValue};

    #[test]
    fn plain_expectation_is_a_substring() {
        assert!(message_matches("Duplicate", "Duplicate class name Foo"));
        assert!(!message_matches("duplicate", "Duplicate class name Foo"));
        assert!(message_matches("", "anything"));
    }

    #[test]
    fn slash_delimited_expectation_is_a_regex() {
        assert!(message_matches(
            "/Import from .* exists/",
            "Import from ns already exists"
        ));
        assert!(!message_matches(
            "/^exists/",
            "Import from ns already exists"
        ));
        assert!(message_matches("/IMPORT/i", "import"));
    }

    #[test]
    fn stray_slashes_are_literal() {
        assert!(message_matches("a/b", "path a/b here"));
        assert!(message_matches("/usr/bin", "in /usr/bin"));
    }

    #[test]
    fn option_cells_are_booleans_or_text() {
        assert_eq!(option_value(" true "), OptionValue::Bool(true));
        assert_eq!(option_value("false"), OptionValue::Bool(false));
        assert_eq!(option_value(" error "), OptionValue::Text("error".into()));
    }

    #[test]
    fn options_map_to_the_builder() {
        let rows = |r: &[(&str, &str)]| -> Vec<(String, String)> {
            r.iter()
                .map(|(o, v)| (o.to_string(), v.to_string()))
                .collect()
        };
        let manager = manager_with_options(&rows(&[
            ("decoratorValidation.missingDecorator", "error"),
            ("metamodelValidation", "true"),
        ]));
        assert!(manager.metamodel_validation());
        assert_eq!(
            manager.decorator_validation().missing_decorator.as_deref(),
            Some("error")
        );
        assert_eq!(manager.decorator_validation().invalid_decorator, None);
        assert!(!manager_with_options(&[]).metamodel_validation());
    }

    #[test]
    #[should_panic(expected = "unsupported model manager option")]
    fn unknown_option_is_a_harness_error() {
        manager_with_options(&[("strict".into(), "true".into())]);
    }
}

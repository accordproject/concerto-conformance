use std::fs;
use std::path::{Path, PathBuf};

use concerto_core::ModelManager;
use cucumber::{gherkin::Step, given, then, when, World};
use regex::Regex;
use serde_json::Value;

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
    load_error: Option<String>,
    /// Outcome of `validate_models`, once run.
    validation_result: Option<Result<(), String>>,
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
    let full = specifications_dir().join(path);
    let content =
        fs::read_to_string(&full).map_err(|e| format!("cannot read fixture {path}: {e}"))?;
    serde_json::from_str(&content).map_err(|e| format!("cannot parse fixture {path}: {e}"))
}

#[given("I load the following models:")]
async fn load_models(world: &mut MyWorld, step: &Step) {
    let files = model_files(step);
    assert!(
        !files.is_empty(),
        "harness error: step has no model_file rows"
    );

    let mut manager = ModelManager::new().expect("harness error: ModelManager::new failed");
    for path in files {
        // A fixture that cannot be loaded must never satisfy an expectation.
        let ast = load_fixture(&path).unwrap_or_else(|e| panic!("harness error: {e}"));
        if let Err(e) = manager.add_model(&ast, Some(path)) {
            world.load_error = Some(e.to_string());
            return;
        }
    }
    world.model_manager = Some(manager);
}

#[when("I validate the models")]
async fn validate_models(world: &mut MyWorld) {
    if let Some(manager) = &world.model_manager {
        world.validation_result = Some(manager.validate_models().map_err(|e| e.to_string()));
    }
}

impl MyWorld {
    /// The expected message of a failed error step, if the only problem was
    /// that the runtime raised a different message.
    pub fn message_mismatch(&self) -> Option<&str> {
        self.message_mismatch.as_deref()
    }

    /// The error raised while loading or validating, if any.
    fn error(&self) -> Option<&str> {
        self.load_error.as_deref().or_else(|| {
            self.validation_result
                .as_ref()?
                .as_ref()
                .err()
                .map(String::as_str)
        })
    }
}

/// Whether `actual` satisfies an expectation: a `/pattern/flags` regex, as in
/// the JavaScript harness, or otherwise a substring.
fn message_matches(expected: &str, actual: &str) -> bool {
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

#[then(regex = r#"^an error should be thrown with message "(.*)"$"#)]
async fn expect_error_with_message(world: &mut MyWorld, expected: String) {
    let Some(actual) = world.error().map(str::to_string) else {
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

#[cfg(test)]
mod tests {
    use super::message_matches;

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
}

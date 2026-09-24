use std::collections::BTreeMap;
use std::sync::Mutex;

use cucumber::{event::ScenarioFinished, gherkin, writer::Stats as _, World as _};
use futures::FutureExt as _;

mod steps;

/// A scenario the runtime is known to fail because it raises the right error
/// with a different message.
struct ExpectedFailure {
    /// A fixture that only this scenario loads.
    fixture: &'static str,
    /// The expectation from the scenario's error step, verbatim.
    message: &'static str,
    reason: &'static str,
}

/// Each entry only covers a message mismatch on its own expectation. Any other
/// failure (a harness error, or no error raised at all) is still a FAIL. If a
/// scenario starts to pass, its entry is stale and the run fails until it is
/// removed.
const EXPECTED_FAILURES: &[ExpectedFailure] = &[
    ExpectedFailure {
        fixture: "concepts/models/CLASS_DECLARATION_009/class_declaration_009_circular_inheritance.json",
        message: "Maximum call stack size exceeded",
        reason: "expects a JavaScript engine message; the runtime reports circular inheritance",
    },
    ExpectedFailure {
        fixture: "maps/models/MAP_VALUE_TYPE_001/map_value_type_001_type_not_exist.json",
        message: "Cannot read properties of null",
        reason: "expects a JavaScript engine message; the runtime reports the undeclared type",
    },
    ExpectedFailure {
        fixture: "concepts/models/CLASS_DECLARATION_003/class_declaration_003_duplicate_class_name.json",
        message: "Duplicate class name",
        reason: "message mismatch: runtime says \"duplicate declaration\"; fixed by accordproject/concerto-rust#42",
    },
    ExpectedFailure {
        fixture: "enums/models/DECLARATION_001/declaration_001_duplicate_enum_names.json",
        message: "Duplicate",
        reason: "message mismatch: runtime says \"duplicate declaration\"; fixed by accordproject/concerto-rust#42",
    },
    ExpectedFailure {
        fixture: "maps/models/DECLARATION_001/declaration_001_duplicate_map_name.json",
        message: "Duplicate class name",
        reason: "message mismatch: runtime says \"duplicate declaration\"; fixed by accordproject/concerto-rust#42",
    },
    ExpectedFailure {
        fixture: "imports/models/MODEL_FILE_001/model_file_001_import_nonexistent_type.json",
        message: "Namespace is not defined",
        reason: "message mismatch: runtime says \"Type ... is not defined in namespace\"; fixed by accordproject/concerto-rust#42",
    },
];

/// Set to run scenarios tagged `@skip-rust` as well.
const INCLUDE_SKIP_RUST: &str = "CONFORMANCE_INCLUDE_SKIP_RUST";

#[derive(Debug)]
enum Skip {
    /// Tagged `@skip` in the feature file.
    Upstream,
    /// Tagged `@skip-rust` and not opted in.
    RustOnly,
    /// A fixture is missing, unreadable or not valid JSON.
    Fixture(String),
}

#[derive(Debug)]
enum Outcome {
    Pass,
    Fail(String),
    Skip(Skip),
    ExpectedFail(&'static str),
    UnexpectedPass(&'static str),
}

impl Outcome {
    fn label(&self) -> &'static str {
        match self {
            Outcome::Pass => "PASS",
            Outcome::Fail(_) => "FAIL",
            Outcome::Skip(_) => "SKIP",
            Outcome::ExpectedFail(_) => "XFAIL",
            Outcome::UnexpectedPass(_) => "XPASS",
        }
    }

    fn detail(&self) -> &str {
        match self {
            Outcome::Pass => "",
            Outcome::Fail(s) | Outcome::Skip(Skip::Fixture(s)) => s,
            Outcome::Skip(Skip::Upstream) => "upstream @skip tag",
            Outcome::Skip(Skip::RustOnly) => "tagged @skip-rust",
            Outcome::ExpectedFail(s) | Outcome::UnexpectedPass(s) => s,
        }
    }
}

struct Row {
    name: String,
    outcome: Outcome,
}

/// Every scenario seen, keyed by (feature file, line).
static RESULTS: Mutex<BTreeMap<(String, usize), Row>> = Mutex::new(BTreeMap::new());

fn key(feature: &gherkin::Feature, scenario: &gherkin::Scenario) -> (String, usize) {
    let file = feature
        .path
        .as_ref()
        .and_then(|p| p.file_name())
        .map_or_else(
            || feature.name.clone(),
            |f| f.to_string_lossy().into_owned(),
        );
    (file, scenario.position.line)
}

fn record(feature: &gherkin::Feature, scenario: &gherkin::Scenario, outcome: Outcome) {
    let row = Row {
        name: scenario.name.clone(),
        outcome,
    };
    RESULTS.lock().unwrap().insert(key(feature, scenario), row);
}

/// Decides whether a scenario runs. Anything left out is recorded as an
/// explicit skip with its reason, so a missing fixture never counts as a pass.
fn should_run(feature: &gherkin::Feature, scenario: &gherkin::Scenario) -> bool {
    let has_tag = |t: &str| scenario.tags.iter().chain(&feature.tags).any(|x| x == t);
    if has_tag("skip") {
        record(feature, scenario, Outcome::Skip(Skip::Upstream));
        return false;
    }
    if has_tag("skip-rust") && std::env::var_os(INCLUDE_SKIP_RUST).is_none() {
        record(feature, scenario, Outcome::Skip(Skip::RustOnly));
        return false;
    }
    let unusable: Vec<String> = scenario
        .steps
        .iter()
        .flat_map(steps::model_files)
        .filter_map(|path| steps::load_fixture(&path).err())
        .collect();
    if !unusable.is_empty() {
        record(
            feature,
            scenario,
            Outcome::Skip(Skip::Fixture(unusable.join("; "))),
        );
        return false;
    }
    true
}

fn finished(ev: &ScenarioFinished) -> Outcome {
    match ev {
        ScenarioFinished::StepPassed => Outcome::Pass,
        ScenarioFinished::StepSkipped => Outcome::Fail("a step has no matching definition".into()),
        ScenarioFinished::BeforeHookFailed(_) => Outcome::Fail("before hook failed".into()),
        ScenarioFinished::StepFailed(_, _, err) => {
            let msg = err.to_string();
            Outcome::Fail(msg.split_whitespace().collect::<Vec<_>>().join(" "))
        }
    }
}

/// Applies [`EXPECTED_FAILURES`] to a finished scenario's outcome. A failure
/// only counts as expected when the scenario's error step saw a different
/// message than the entry's expectation.
fn classify(fixtures: &[String], mismatch: Option<&str>, outcome: Outcome) -> Outcome {
    let Some(entry) = EXPECTED_FAILURES
        .iter()
        .find(|e| fixtures.iter().any(|f| f == e.fixture))
    else {
        return outcome;
    };
    match outcome {
        Outcome::Pass => Outcome::UnexpectedPass(entry.reason),
        Outcome::Fail(_) if mismatch == Some(entry.message) => Outcome::ExpectedFail(entry.reason),
        Outcome::Fail(msg) => Outcome::Fail(format!(
            "listed in EXPECTED_FAILURES as a message mismatch, but failed otherwise: {msg}"
        )),
        outcome => outcome,
    }
}

/// Prints the per-scenario table and returns whether the run is clean.
fn report() -> bool {
    let results = RESULTS.lock().unwrap();
    let mut counts: BTreeMap<&str, usize> = BTreeMap::new();
    println!("\n| # | Feature | Line | Scenario | Result | Detail |");
    println!("|---|---------|------|----------|--------|--------|");
    for (i, ((file, line), row)) in results.iter().enumerate() {
        *counts.entry(row.outcome.label()).or_default() += 1;
        let detail = row.outcome.detail().replace('|', "\\|");
        println!(
            "| {} | {file} | {line} | {} | {} | {detail} |",
            i + 1,
            row.name,
            row.outcome.label()
        );
    }
    let count = |label| counts.get(label).copied().unwrap_or(0);
    let skips = |kind: fn(&Skip) -> bool| {
        results
            .values()
            .filter(|r| matches!(&r.outcome, Outcome::Skip(s) if kind(s)))
            .count()
    };
    let ran = count("PASS") + count("FAIL") + count("XFAIL") + count("XPASS");
    println!(
        "\n{} scenarios: {} run, {} passed, {} expected failures, {} failed, {} unexpected passes, \
         {} skipped ({} upstream @skip, {} @skip-rust, {} unusable fixture)",
        results.len(),
        ran,
        count("PASS"),
        count("XFAIL"),
        count("FAIL"),
        count("XPASS"),
        count("SKIP"),
        skips(|s| matches!(s, Skip::Upstream)),
        skips(|s| matches!(s, Skip::RustOnly)),
        skips(|s| matches!(s, Skip::Fixture(_))),
    );
    count("FAIL") == 0 && count("XPASS") == 0
}

#[tokio::main]
async fn main() {
    let writer = steps::MyWorld::cucumber()
        .after(|feature, _, scenario, ev, world| {
            let fixtures: Vec<String> =
                scenario.steps.iter().flat_map(steps::model_files).collect();
            let mismatch = world.as_deref().and_then(steps::MyWorld::message_mismatch);
            record(
                feature,
                scenario,
                classify(&fixtures, mismatch, finished(ev)),
            );
            async {}.boxed_local()
        })
        .filter_run(steps::features_dir(), |feature, _, scenario| {
            should_run(feature, scenario)
        })
        .await;

    // Scenarios in a feature file that fails to parse never reach the table.
    let parsing_errors = writer.parsing_errors();
    let hook_errors = writer.hook_errors();
    let clean = report();
    if parsing_errors > 0 || hook_errors > 0 {
        println!("{parsing_errors} feature parsing errors, {hook_errors} hook errors");
    }
    if !clean || parsing_errors > 0 || hook_errors > 0 {
        std::process::exit(1);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const CIRCULAR: &ExpectedFailure = &EXPECTED_FAILURES[0];

    fn fixtures() -> Vec<String> {
        vec![CIRCULAR.fixture.to_string()]
    }

    #[test]
    fn mismatch_on_the_listed_expectation_is_expected() {
        let outcome = classify(
            &fixtures(),
            Some(CIRCULAR.message),
            Outcome::Fail("x".into()),
        );
        assert!(matches!(outcome, Outcome::ExpectedFail(_)));
    }

    #[test]
    fn failure_without_a_mismatch_stays_a_failure() {
        // No error raised, or a harness panic: the step never records a mismatch.
        let outcome = classify(&fixtures(), None, Outcome::Fail("x".into()));
        assert!(matches!(outcome, Outcome::Fail(_)));
    }

    #[test]
    fn mismatch_on_another_expectation_stays_a_failure() {
        let outcome = classify(&fixtures(), Some("other"), Outcome::Fail("x".into()));
        assert!(matches!(outcome, Outcome::Fail(_)));
    }

    #[test]
    fn listed_scenario_that_passes_is_unexpected() {
        let outcome = classify(&fixtures(), None, Outcome::Pass);
        assert!(matches!(outcome, Outcome::UnexpectedPass(_)));
    }

    #[test]
    fn unlisted_scenario_is_unchanged() {
        let outcome = classify(&[], Some("m"), Outcome::Fail("x".into()));
        assert!(matches!(outcome, Outcome::Fail(_)));
    }
}

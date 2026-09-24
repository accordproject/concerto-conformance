use std::collections::BTreeMap;
use std::sync::Mutex;

use cucumber::{event::ScenarioFinished, gherkin, World as _};
use futures::FutureExt as _;

mod steps;

/// Scenarios the runtime is known to fail, keyed by a fixture that only they
/// load, with the reason. Each must keep failing: if one starts to pass the
/// entry is stale and the run fails until it is removed.
const EXPECTED_FAILURES: &[(&str, &str)] = &[
    (
        "concepts/models/CLASS_DECLARATION_009/class_declaration_009_circular_inheritance.json",
        "expects an error message the reference runtime does not raise",
    ),
    (
        "maps/models/MAP_VALUE_TYPE_001/map_value_type_001_type_not_exist.json",
        "expects an error message the reference runtime does not raise",
    ),
];

/// Set to run scenarios tagged `@skip-rust` as well.
const INCLUDE_SKIP_RUST: &str = "CONFORMANCE_INCLUDE_SKIP_RUST";

#[derive(Debug)]
enum Outcome {
    Pass,
    Fail(String),
    Skip(String),
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
            Outcome::Fail(s) | Outcome::Skip(s) => s,
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
        return false;
    }
    if has_tag("skip-rust") && std::env::var_os(INCLUDE_SKIP_RUST).is_none() {
        record(feature, scenario, Outcome::Skip("tagged @skip-rust".into()));
        return false;
    }
    let unusable: Vec<String> = scenario
        .steps
        .iter()
        .flat_map(steps::model_files)
        .filter_map(|path| steps::load_fixture(&path).err())
        .collect();
    if !unusable.is_empty() {
        record(feature, scenario, Outcome::Skip(unusable.join("; ")));
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

/// Applies [`EXPECTED_FAILURES`] to a finished scenario's outcome.
fn classify(fixtures: &[String], outcome: Outcome) -> Outcome {
    let expected = EXPECTED_FAILURES
        .iter()
        .find(|(fixture, _)| fixtures.iter().any(|f| f == fixture))
        .map(|(_, reason)| *reason);
    match (expected, outcome) {
        (Some(reason), Outcome::Fail(_)) => Outcome::ExpectedFail(reason),
        (Some(reason), Outcome::Pass) => Outcome::UnexpectedPass(reason),
        (_, outcome) => outcome,
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
    let ran = count("PASS") + count("FAIL") + count("XFAIL") + count("XPASS");
    println!(
        "\n{} scenarios: {} run, {} passed, {} expected failures, {} failed, {} unexpected passes, {} skipped",
        results.len(),
        ran,
        count("PASS"),
        count("XFAIL"),
        count("FAIL"),
        count("XPASS"),
        count("SKIP"),
    );
    count("FAIL") == 0 && count("XPASS") == 0
}

#[tokio::main]
async fn main() {
    steps::MyWorld::cucumber()
        .after(|feature, _, scenario, ev, _| {
            let fixtures: Vec<String> =
                scenario.steps.iter().flat_map(steps::model_files).collect();
            record(feature, scenario, classify(&fixtures, finished(ev)));
            async {}.boxed_local()
        })
        .filter_run(steps::features_dir(), |feature, _, scenario| {
            should_run(feature, scenario)
        })
        .await;

    if !report() {
        std::process::exit(1);
    }
}

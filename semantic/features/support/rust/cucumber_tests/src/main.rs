use std::collections::BTreeMap;
use std::sync::Mutex;

use cucumber::{event::ScenarioFinished, gherkin, writer::Stats as _};
use futures::FutureExt as _;

mod instances;
mod steps;

/// A suite of feature files and the World its steps run in.
trait Suite: cucumber::World + cucumber::codegen::WorldInventory + std::fmt::Debug {
    /// The suite's directory, as the report's feature column names it.
    const NAME: &'static str;
    /// The fixtures a step reads.
    fn fixtures(step: &gherkin::Step) -> Vec<String>;
    /// Checks one fixture: a missing or unusable one is a harness error.
    fn check_fixture(path: &str) -> Result<(), String>;
    /// See [`steps::MyWorld::message_mismatch`].
    fn message_mismatch(&self) -> Option<&str>;
}

impl Suite for steps::MyWorld {
    const NAME: &'static str = "semantic";
    fn fixtures(step: &gherkin::Step) -> Vec<String> {
        steps::model_files(step)
    }
    fn check_fixture(path: &str) -> Result<(), String> {
        steps::load_fixture(path).map(drop)
    }
    fn message_mismatch(&self) -> Option<&str> {
        steps::MyWorld::message_mismatch(self)
    }
}

impl Suite for instances::InstanceWorld {
    const NAME: &'static str = "validate";
    fn fixtures(step: &gherkin::Step) -> Vec<String> {
        instances::fixtures(step)
    }
    fn check_fixture(path: &str) -> Result<(), String> {
        instances::check_fixture(path)
    }
    fn message_mismatch(&self) -> Option<&str> {
        instances::InstanceWorld::message_mismatch(self)
    }
}

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
/// removed. Empty since P5-62 (accordproject/concerto-rust#397): the six
/// entries it held all pass against the runtime now.
const EXPECTED_FAILURES: &[ExpectedFailure] = &[];

/// Set to run scenarios tagged `@skip-rust` as well.
const INCLUDE_SKIP_RUST: &str = "CONFORMANCE_INCLUDE_SKIP_RUST";

#[derive(Debug)]
enum Skip {
    /// Tagged `@skip` in the feature file.
    Upstream,
    /// Tagged `@skip-rust` and not opted in.
    RustOnly,
}

#[derive(Debug)]
enum Outcome {
    Pass,
    Fail(String),
    Skip(Skip),
    /// A fixture is missing, unreadable or not valid JSON: a harness error,
    /// never a skip.
    Error(String),
    ExpectedFail(&'static str),
    UnexpectedPass(&'static str),
}

impl Outcome {
    fn label(&self) -> &'static str {
        match self {
            Outcome::Pass => "PASS",
            Outcome::Fail(_) => "FAIL",
            Outcome::Skip(_) => "SKIP",
            Outcome::Error(_) => "ERROR",
            Outcome::ExpectedFail(_) => "XFAIL",
            Outcome::UnexpectedPass(_) => "XPASS",
        }
    }

    fn detail(&self) -> &str {
        match self {
            Outcome::Pass => "",
            Outcome::Fail(s) | Outcome::Error(s) => s,
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

fn key(suite: &str, feature: &gherkin::Feature, scenario: &gherkin::Scenario) -> (String, usize) {
    let file = feature
        .path
        .as_ref()
        .and_then(|p| p.file_name())
        .map_or_else(
            || feature.name.clone(),
            |f| f.to_string_lossy().into_owned(),
        );
    (format!("{suite}/{file}"), scenario.position.line)
}

fn record(suite: &str, feature: &gherkin::Feature, scenario: &gherkin::Scenario, outcome: Outcome) {
    let row = Row {
        name: scenario.name.clone(),
        outcome,
    };
    RESULTS
        .lock()
        .unwrap()
        .insert(key(suite, feature, scenario), row);
}

/// Decides whether a scenario runs. Anything left out is recorded with its
/// reason: a tag as an explicit skip, and a missing fixture as an error, so it
/// never counts as a pass.
fn should_run<W: Suite>(feature: &gherkin::Feature, scenario: &gherkin::Scenario) -> bool {
    let record = |outcome| record(W::NAME, feature, scenario, outcome);
    let has_tag = |t: &str| scenario.tags.iter().chain(&feature.tags).any(|x| x == t);
    if has_tag("skip") {
        record(Outcome::Skip(Skip::Upstream));
        return false;
    }
    if has_tag("skip-rust") && std::env::var_os(INCLUDE_SKIP_RUST).is_none() {
        record(Outcome::Skip(Skip::RustOnly));
        return false;
    }
    let unusable: Vec<String> = scenario
        .steps
        .iter()
        .flat_map(W::fixtures)
        .filter_map(|path| W::check_fixture(&path).err())
        .collect();
    if !unusable.is_empty() {
        record(Outcome::Error(unusable.join("; ")));
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
fn classify(
    expected: &'static [ExpectedFailure],
    fixtures: &[String],
    mismatch: Option<&str>,
    outcome: Outcome,
) -> Outcome {
    let Some(entry) = expected
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
         {} errors (unusable fixture), {} skipped ({} upstream @skip, {} @skip-rust)",
        results.len(),
        ran,
        count("PASS"),
        count("XFAIL"),
        count("FAIL"),
        count("XPASS"),
        count("ERROR"),
        count("SKIP"),
        skips(|s| matches!(s, Skip::Upstream)),
        skips(|s| matches!(s, Skip::RustOnly)),
    );
    // A missing or unreadable fixture is a harness error (plan section 5.1),
    // not a benign skip like an upstream `@skip`/`@skip-rust` tag: it must
    // fail the run, the same way the JS load step now fails loudly instead
    // of recording it as a vacuous pass.
    count("FAIL") == 0 && count("XPASS") == 0 && count("ERROR") == 0
}

/// Runs one suite, recording every scenario. Returns the number of feature
/// parsing errors and hook errors.
async fn run_suite<W: Suite>(dir: std::path::PathBuf) -> (usize, usize) {
    let writer = W::cucumber()
        .after(|feature, _, scenario, ev, world| {
            let fixtures: Vec<String> = scenario.steps.iter().flat_map(W::fixtures).collect();
            let mismatch = world.as_deref().and_then(W::message_mismatch);
            record(
                W::NAME,
                feature,
                scenario,
                classify(EXPECTED_FAILURES, &fixtures, mismatch, finished(ev)),
            );
            async {}.boxed_local()
        })
        .filter_run(dir, |feature, _, scenario| {
            should_run::<W>(feature, scenario)
        })
        .await;
    (writer.parsing_errors(), writer.hook_errors())
}

#[tokio::main]
async fn main() {
    let (semantic_parsing, semantic_hooks) =
        run_suite::<steps::MyWorld>(steps::features_dir()).await;
    let (instance_parsing, instance_hooks) =
        run_suite::<instances::InstanceWorld>(instances::features_dir()).await;

    // Scenarios in a feature file that fails to parse never reach the table.
    let parsing_errors = semantic_parsing + instance_parsing;
    let hook_errors = semantic_hooks + instance_hooks;
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

    const CIRCULAR: &ExpectedFailure = &ExpectedFailure {
        fixture: "concepts/models/X/x.json",
        message: "Maximum call stack size exceeded",
        reason: "a test entry",
    };
    const LISTED: &[ExpectedFailure] = std::slice::from_ref(CIRCULAR);

    fn fixtures() -> Vec<String> {
        vec![CIRCULAR.fixture.to_string()]
    }

    #[test]
    fn mismatch_on_the_listed_expectation_is_expected() {
        let outcome = classify(
            LISTED,
            &fixtures(),
            Some(CIRCULAR.message),
            Outcome::Fail("x".into()),
        );
        assert!(matches!(outcome, Outcome::ExpectedFail(_)));
    }

    #[test]
    fn failure_without_a_mismatch_stays_a_failure() {
        // No error raised, or a harness panic: the step never records a mismatch.
        let outcome = classify(LISTED, &fixtures(), None, Outcome::Fail("x".into()));
        assert!(matches!(outcome, Outcome::Fail(_)));
    }

    #[test]
    fn mismatch_on_another_expectation_stays_a_failure() {
        let outcome = classify(
            LISTED,
            &fixtures(),
            Some("other"),
            Outcome::Fail("x".into()),
        );
        assert!(matches!(outcome, Outcome::Fail(_)));
    }

    #[test]
    fn listed_scenario_that_passes_is_unexpected() {
        let outcome = classify(LISTED, &fixtures(), None, Outcome::Pass);
        assert!(matches!(outcome, Outcome::UnexpectedPass(_)));
    }

    #[test]
    fn unlisted_scenario_is_unchanged() {
        let outcome = classify(LISTED, &[], Some("m"), Outcome::Fail("x".into()));
        assert!(matches!(outcome, Outcome::Fail(_)));
    }
}

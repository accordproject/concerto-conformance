use cucumber::World as _;
mod steps;

#[tokio::main]
async fn main() {
    steps::MyWorld::cucumber()
        .filter_run("concerto-conformance/semantic/features", |_, _, sc| {
            !sc.tags.iter().any(|t| t == "skip" || t == "skip-rust")
        })
        .await;
}

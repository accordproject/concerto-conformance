use cucumber::World as _;
mod steps;

#[tokio::main]
async fn main() {
    use cucumber::cli;
    steps::MyWorld::run("concerto-conformance/semantic/features").await;
}

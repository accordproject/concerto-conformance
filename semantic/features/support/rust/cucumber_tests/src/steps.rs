use cucumber::{gherkin::Step, given, then, when, World};
use std::collections::HashMap;
use std::path::Path;
use std::fs;
use concerto_core::ModelManager;
use serde_json::Value;

#[derive(Debug, Default, World)]
pub struct MyWorld {
    model_paths: Vec<(String, String)>, // (cto_path, alias)
    validation_result: Option<Result<(), String>>,
    pub error: Option<String>,
    pub model_manager: Option<ModelManager>,
}



#[given("I load the following models:")]
async fn load_models(world: &mut MyWorld, step: &Step) {
    let mut manager = match ModelManager::new() {
        Ok(m) => m,
        Err(e) => {
            world.error = Some(e.to_string());
            world.validation_result = Some(Err(e.to_string()));
            return;
        }
    };
    if let Some(table) = step.table.as_ref() {
        let headers = &table.rows[0];

        for row in table.rows.iter().skip(1) {
            let mut row_map = HashMap::new();
            for (i, cell) in row.iter().enumerate() {
                if let Some(header) = headers.get(i) {
                    row_map.insert(header.clone(), cell.clone());
                }
            }

            let path = match row_map.get("model_file") {
                Some(p) => p.clone(), // `p` is a &String, so clone it to get String
                None => {
                    world.error = Some("Missing 'model_file' field".to_string());
                    world.validation_result = Some(Err("Missing model_file".to_string()));
                    return;
                }
            };


            let alias = row_map.get("alias").cloned().unwrap_or_else(|| path.clone());
            world.model_paths.push((path.clone(), alias.clone()));

            let ast = match load_ast_from_cto_path(&path) {
                Ok(ast) => ast,
                Err(e) => {
                    world.error = Some(format!("Failed to load AST from {}: {}", path, e));
                    return; // Stop further loading
                }
            };

            if let Err(e) = manager.add_model(&ast, Some(alias.clone())) {
                world.error = Some(e.to_string());
                world.validation_result = Some(Err(e.to_string()));
                return;
            }
        }
    }
    world.validation_result = Some(Ok(()));
    world.model_manager = Some(manager);
}



#[when("I validate the models")]
async fn validate_models(world: &mut MyWorld) {
    let result = if let Some(manager) = &world.model_manager {
        manager.validate_models().map_err(|e| e.to_string())
    } else {
        Err("ModelManager is not initialized before validation.".to_string())
    };
    world.validation_result = Some(result);
}

#[then(regex = r#"an error should be thrown with message "(.*)""#)]
async fn expect_error_with_message(world: &mut MyWorld, expected: String) {
    if expected.is_empty() {
        let has_error = world.error.is_some()
            || matches!(&world.validation_result, Some(Err(_)));
        if !has_error {
            panic!("Expected an error, but none was thrown.");
        }
        return;
    }

    if let Some(err) = &world.error {
        if err.contains(&expected) {
            return;
        }
    }

    if let Some(Err(err)) = &world.validation_result {
        if err.contains(&expected) {
            return;
        }
    }

    let actual = world
        .error
        .as_deref()
        .or(world.validation_result.as_ref().and_then(|r| r.as_ref().err().map(|s| s.as_str())))
        .unwrap_or("<no error>");

    panic!(
        "Error message mismatch.\nExpected: '{}'\nGot: '{}'",
        expected, actual
    );
}



#[then("no error should be thrown")]
async fn expect_success(world: &mut MyWorld) {
    if let Some(err) = &world.error {
        panic!("Expected success, but got model loading error: {}", err);
    }

    match &world.validation_result {
        Some(Ok(_)) => {} // Passed
        Some(Err(err)) => panic!("Expected success, but got validation error: {}", err),
        None => panic!("No validation result available."),
    }
}

fn load_ast_from_cto_path(ast_path: &str) -> Result<Value, String> {
    // Construct the full path to the .cto file by joining with "semantic/specifications"
    let full_ast_path = Path::new("concerto-conformance/semantic/specifications").join(ast_path);

    // Check if file exists
    if !full_ast_path.exists() {
        return Err(format!("AST JSON not found at: {}", full_ast_path.display()));
    }

    // Read and parse the AST JSON
    let ast_content = fs::read_to_string(&full_ast_path)
        .map_err(|e| format!("Failed to read AST JSON: {}", e))?;

    let json: Value = serde_json::from_str(&ast_content)
        .map_err(|e| format!("Failed to parse AST JSON: {}", e))?;

    Ok(json)
}

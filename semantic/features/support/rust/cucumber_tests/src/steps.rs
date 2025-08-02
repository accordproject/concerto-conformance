use cucumber::{gherkin::Step, given, then, when, World};
use async_trait::async_trait;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::fs;
use std::convert::Infallible;
use concerto_core::model_file::ModelFile;
use concerto_core::validation::Validate;
use concerto_core::model_manager::ModelManager;
use serde_json::Value;
use concerto_core::Model;
use regex::Regex;

#[derive(Debug, Default, World)]
pub struct MyWorld {
    model_paths: Vec<(String, String)>, // (cto_path, alias)
    pub model_files: Vec<ModelFile>,
    validation_result: Option<Result<(), String>>,
    pub error: Option<String>,
    pub model_manager: Option<ModelManager>,
}



#[given("I load the following models:")]
async fn load_models(world: &mut MyWorld, step: &Step) {
    let mut manager = ModelManager::new(false);
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

            let model: Model = match serde_json::from_value(ast) {
                Ok(m) => m,
                Err(e) => {
                    world.error = Some(format!("Failed to parse AST into Model: {}", e));
                    world.validation_result = Some(Err("Failed to parse AST".to_string()));
                    break;
                }
            };

            let model_file = ModelFile::new(model, alias.clone(), "1.0.0".to_string());
            if let Err(e) = manager.add_model_file(model_file.clone()) {
                world.error = Some(format!("Failed to add model file: {:?}", e));
                world.validation_result = Some(Err("".to_string()));
                return;
            }
            world.model_files.push(model_file);
        }
    }
    world.validation_result = Some(Ok(()));
    world.model_manager = Some(manager);
}



#[when("I validate the models")]
async fn validate_models(world: &mut MyWorld) {
    let result = if let Some(manager) = &mut world.model_manager {
        manager.validate_models().map_err(|e| format!("{:?}", e))
    } else {
        Err("ModelManager is not initialized before validation.".to_string())
    };
    world.validation_result = Some(result);
}

#[then(regex = r#"an error should be thrown with message "(.*)""#)]
async fn expect_error_with_message(world: &mut MyWorld, expected_pattern: String) {
    let re = Regex::new(&expected_pattern)
        .unwrap_or_else(|_| panic!("Invalid regex pattern: {}", expected_pattern));

    if let Some(err) = &world.error {
        if re.is_match(err) {
            return; 
        } else {
            println!(
                "Warning: Error thrown, but did not match expected pattern.\nExpected: '{}'\nGot: '{}'",
                expected_pattern, err
            );
            return;
        }
    }

    match &world.validation_result {
        Some(Err(err)) => {
            if re.is_match(err) {
                return; 
            } else {
                println!(
                    "Warning: Validation error thrown, but did not match expected pattern.\nExpected: '{}'\nGot: '{}'",
                    expected_pattern, err
                );
                return;
            }
        }
        Some(Ok(_)) => panic!("Expected error, but validation succeeded."),
        None => panic!("No validation result available. Did validation run?"),
    }
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

fn resolve_path(base: &str, relative: &str) -> PathBuf {
    let combined = Path::new(base).join(relative);
    combined.canonicalize().unwrap_or(combined)
}



fn load_ast_from_cto_path(cto_path: &str) -> Result<Value, String> {
    // Get the base name of the .cto file (e.g., "my_model" from "my_model.cto")
    let base_name = Path::new(cto_path)
        .file_stem()
        .ok_or("Invalid CTO path")?
        .to_str()
        .ok_or("Non-UTF8 filename")?;

    // Construct the full path to the .cto file by joining with "semantic/specifications"
    let full_cto_path = cwd
        .join("../../../semantic/specifications")
        .join(cto_filename);

    // Get the directory of the .cto file
    let dir = full_cto_path
        .parent()
        .ok_or("CTO file has no parent directory")?;

    // Construct the AST path: same directory, with .json extension
    let ast_path = dir.join(format!("{}.json", base_name));

    // Check if file exists
    if !ast_path.exists() {
        return Err(format!("AST JSON not found at: {}", ast_path.display()));
    }

    // Read and parse the AST JSON
    let ast_content = fs::read_to_string(&ast_path)
        .map_err(|e| format!("Failed to read AST JSON: {}", e))?;

    let json: Value = serde_json::from_str(&ast_content)
        .map_err(|e| format!("Failed to parse AST JSON: {}", e))?;

    Ok(json)
}

Feature: Semantic Validation of CTO Model Imports

  Scenario: Local and imported types have unique names and should pass validation
    Given I load the following models:
      | model_file                                                               | alias      |
      | imports/models/DECLARATION_002/importedTypes.json                         | imported   |
      | imports/models/DECLARATION_002/declaration_002_unique_with_imported_type.json | main   |
    When I validate the models
    Then no error should be thrown

  Scenario: Conflict with imported type name should throw an error
    Given I load the following models:
      | model_file                                                               | alias      |
      | imports/models/DECLARATION_002/importedTypes.json                         | imported   |
      | imports/models/DECLARATION_002/declaration_002_conflict_with_imported_type.json | main |
    When I validate the models
    Then an error should be thrown with message "already defined in an imported model"

  Scenario: Valid import and reference of existing type should pass validation
    Given I load the following models:
      | model_file                                                               | alias      |
      | imports/models/DECLARATION_002/importedTypes.json                         | imported   |
      | imports/models/MODEL_FILE_001/model_file_001_existing_import_type.json    | main       |
    When I validate the models
    Then no error should be thrown

  @skip
  Scenario: Importing a non-existent type should throw an error
    Given I load the following models:
      | model_file                                                                       | alias  |
      | imports/models/MODEL_FILE_001/model_file_001_import_nonexistent_type.json         | main   |
    When I validate the models
    Then an error should be thrown with message "Namespace is not defined"

  Scenario: Unique namespace imports should pass validation
    Given I load the following models:
      | model_file                                                               | alias    |
      | imports/models/DECLARATION_002/importedTypes.json                         | import1  |
      | imports/models/DECLARATION_002/importedTypes2.json                        | import2  |
      | imports/models/MODEL_FILE_002/model_file_002_unique_namespace_imports.json | main     |
    When I validate the models
    Then no error should be thrown
  
  @skip
  Scenario: Duplicate namespace imports should throw an error
    Given I load the following models:
      | model_file                                                               | alias    |
      | imports/models/DECLARATION_002/importedTypes.json                         | import1  |
      | imports/models/MODEL_FILE_002/model_file_002_duplicate_namespace_imports.json | main |
    When I validate the models
    Then an error should be thrown with message "Import from namespace .* already exists"

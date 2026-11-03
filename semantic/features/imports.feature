Feature: Semantic Validation of CTO Model Imports

  Scenario: Local and imported types have unique names and should pass validation
    Given I load the following models:
      | model_file                                                               | alias      |
      | imports/models/DECLARATION_002/importedTypes.json                         | imported   |
      | imports/models/DECLARATION_002/declaration_002_unique_with_imported_type.json | main   |
    When I validate the models
    Then no error should be thrown

  @skip
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

  # Scenarios below this line were promoted by P5-08b from the oracle corpus and
  # the fuzz records (concerto migration/CONFORMANCE-PROMOTION-PLAN.md). Each one
  # asserts an error class and a @rule tag, never TS message text.

  # NSI-05. Source: F:unit/ModelManager.addCTOModel/562a1f000f083a9b744e2130. The existing MODEL_FILE_001
  # negative imports from an unregistered namespace; here the namespace is registered.
  @rule:MODEL_FILE_001
  Scenario: Importing a type that a registered namespace does not declare
    Given I load the following models:
      | model_file                                                                               | alias |
      | imports/models/MODEL_FILE_001/model_file_001_registered_namespace.json                   | dep1  |
      | imports/models/MODEL_FILE_001/model_file_001_import_undeclared_type_from_registered.json | main  |
    When I validate the models
    Then an error of class "IllegalModelException" should be thrown
    And the error should mention "MissingCategory"

Feature: Semantic Validation of Enum Declarations in CTO Models

  Scenario: Duplicate enum names in the same file should throw an error
    Given I load the following models:
      | model_file                                                   | alias      |
      | enums/models/DECLARATION_001/declaration_001_duplicate_enum_names.json | main       |
    When I validate the models
    Then an error should be thrown with message "Duplicate"

  Scenario: Unique enum names in the same file should pass validation
    Given I load the following models:
      | model_file                                                   | alias      |
      | enums/models/DECLARATION_001/declaration_001_unique_enum_names.json    | main       |
    When I validate the models
    Then no error should be thrown

  Scenario: Local enum name does not conflict with imported enum
    Given I load the following models:
      | model_file                                                   | alias      |
      | enums/models/DECLARATION_002/importedTypes.json                      | imported   |
      | enums/models/DECLARATION_002/declaration_002_non_conflicting_name.json | main     |
    When I validate the models
    Then no error should be thrown

  @skip
  Scenario: Enum name conflicts with imported enum should throw an error
    Given I load the following models:
      | model_file                                                   | alias      |
      | enums/models/DECLARATION_002/importedTypes.json                      | imported   |
      | enums/models/DECLARATION_002/declaration_002_name_conflict_with_import.json | main |
    When I validate the models
    Then an error should be thrown with message "already defined in an imported model"

  Scenario: Valid enum identifier name should pass validation
    Given I load the following models:
      | model_file                                                   | alias      |
      | enums/models/MODEL_ELEMENT_002/model_element_002_valid_enum_name.json  | main       |
    When I validate the models
    Then no error should be thrown

  Scenario: Invalid enum identifier name should throw an error
    Given I load the following models:
      | model_file                                                   | alias      |
      | enums/models/MODEL_ELEMENT_002/model_element_002_invalid_enum_name.json | main     |
    Then an error should be thrown with message ""

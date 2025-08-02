Feature: Semantic Validation of CTO Map Specification

  Scenario: Valid map key type should pass
    Given I load the following models:
      | model_file                                      | alias |
      | maps/models/MAP_KEY_TYPE_001/map_key_type_001_valid_key_type.cto             | main  |
    When I validate the models
    Then no error should be thrown

  Scenario: Invalid map key type should throw error
    Given I load the following models:
      | model_file                                      | alias |
      | maps/models/MAP_KEY_TYPE_001/map_key_type_001_invalid_key_type.cto           | main  |
    Then an error should be thrown with message ""

  Scenario: Valid map value type should pass
    Given I load the following models:
      | model_file                                      | alias |
      | maps/models/MAP_VALUE_TYPE_001/map_value_type_001_existing_value_type.cto      | main  |
    When I validate the models
    Then no error should be thrown

  Scenario: Non-existent map value type should throw error
    Given I load the following models:
      | model_file                                      | alias |
      | maps/models/MAP_VALUE_TYPE_001/map_value_type_001_type_not_exist.cto           | main  |
    When I validate the models
    Then an error should be thrown with message "Cannot read properties of null"

  Scenario: Duplicate map names should throw error
    Given I load the following models:
      | model_file                                      | alias |
      | maps/models/DECLARATION_001/declaration_001_duplicate_map_name.cto          | main  |
    When I validate the models
    Then an error should be thrown with message "Duplicate class name"

  Scenario: Unique map names should pass
    Given I load the following models:
      | model_file                                      | alias |
      | maps/models/DECLARATION_001/declaration_001_unique_map_name.cto             | main  |
    When I validate the models
    Then no error should be thrown
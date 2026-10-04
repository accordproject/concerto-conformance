Feature: Semantic Validation of CTO Map Specification

  Scenario: Valid map key type should pass
    Given I load the following models:
      | model_file                                      | alias |
      | maps/models/MAP_KEY_TYPE_001/map_key_type_001_valid_key_type.json             | main  |
    When I validate the models
    Then no error should be thrown

  @rule:MAP_KEY_TYPE_001
  Scenario: Invalid map key type should throw error
    Given I load the following models:
      | model_file                                      | alias |
      | maps/models/MAP_KEY_TYPE_001/map_key_type_001_invalid_key_type.json           | main  |
    When I validate the models
    Then an error of class "IllegalModelException" should be thrown
    And the error should mention "InvalidMap"

  Scenario: Valid map value type should pass
    Given I load the following models:
      | model_file                                      | alias |
      | maps/models/MAP_VALUE_TYPE_001/map_value_type_001_existing_value_type.json      | main  |
    When I validate the models
    Then no error should be thrown

  Scenario: Non-existent map value type should throw error
    Given I load the following models:
      | model_file                                      | alias |
      | maps/models/MAP_VALUE_TYPE_001/map_value_type_001_type_not_exist.json           | main  |
    When I validate the models
    Then an error should be thrown with message "Cannot read properties of null"

  Scenario: Duplicate map names should throw error
    Given I load the following models:
      | model_file                                      | alias |
      | maps/models/DECLARATION_001/declaration_001_duplicate_map_name.json          | main  |
    When I validate the models
    Then an error should be thrown with message "Duplicate class name"

  Scenario: Unique map names should pass
    Given I load the following models:
      | model_file                                      | alias |
      | maps/models/DECLARATION_001/declaration_001_unique_map_name.json             | main  |
    When I validate the models
    Then no error should be thrown

  # Scenarios below this line were promoted by P5-08b from the oracle corpus and
  # the fuzz records (concerto migration/CONFORMANCE-PROMOTION-PLAN.md). Each one
  # asserts an error class and a @rule tag, never TS message text.

  # MAP-01. Source: F:data/ModelManager.addCTOModel/0346e9576d6ac88a3b8bd013 (40);
  # F:unit/MapDeclaration.validate/0052fa8c025147afa24d60dc (7).
  @rule:MAP_KEY_TYPE_001
  Scenario: A scalar of Boolean is not a valid map key type
    Given I load the following models:
      | model_file                                                            | alias |
      | maps/models/MAP_KEY_TYPE_001/map_key_type_001_boolean_scalar_key.json | main  |
    When I validate the models
    Then an error of class "IllegalModelException" should be thrown

  # MAP-02. Source: F:unit/MapDeclaration.validate/c6c3d676d2dcc40a2afb100e.
  @rule:MAP_VALUE_TYPE_002
  Scenario: A map declaration is a map's value type
    Given I load the following models:
      | model_file                                                          | alias |
      | maps/models/MAP_VALUE_TYPE_002/map_value_type_002_map_as_value.json | main  |
    When I validate the models
    Then an error of class "IllegalModelException" should be thrown

  # MAP-03. Source: F:gaps/ModelManager.fromAst/52f8a94d983f4877bf41fa81 (2); Z:#22 (302 cases).
  # JSON AST only. Class only: the wording differs between engines (#219 cluster 22).
  @rule:MAP_DECLARATION_002
  Scenario: A map declaration has no key
    Given I load the following models:
      | model_file                                                           | alias |
      | maps/models/MAP_DECLARATION_002/map_declaration_002_missing_key.json | main  |
    When I validate the models
    Then an error of class "IllegalModelException" should be thrown

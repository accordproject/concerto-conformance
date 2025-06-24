Feature: Semantic Validation for CTO Class Declarations

  Scenario: Property name uses system-reserved name
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_001/class_declaration_001_system_property_name.cto | main        |
    Then an error should be thrown with message "Invalid field name '$class'"

  Scenario: Valid property names that are not system-reserved
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_001/class_declaration_001_valid_property_name.cto | main        |
    Then no error should be thrown

  Scenario: $class property with invalid type
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_002/class_declaration_002_invalid_$class_type.cto | main        |
    Then an error should be thrown with message "Invalid field name '$class'"

  Scenario: Model without explicit $class declaration
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_002/class_declaration_002_valid_$class_type.cto | main        |
    Then no error should be thrown

  Scenario: Duplicate concept declarations in the same file
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_003/class_declaration_003_duplicate_class_name.cto | main        |
    When I validate the models
    Then an error should be thrown with message "Duplicate class name"

  Scenario: Uniquely named concept declarations
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_003/class_declaration_003_unique_class_name.cto | main        |
    When I validate the models
    Then no error should be thrown

  Scenario: Supertype does not exist
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_004/class_declaration_004_supertype_not_exist.cto | main        |
    When I validate the models
    Then an error should be thrown with message "Could not find super type"

  Scenario: Supertype is declared correctly
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_004/class_declaration_004_supertype_exist.cto | main        |
    When I validate the models
    Then no error should be thrown

  Scenario: Identifier field is not of type String or scalar
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_005/class_declaration_005_invalid_identifier_type.cto | main        |
    When I validate the models
    Then an error should be thrown with message 'Class \"Entity\" is identified by field \"id\", but the type of the field is not \"String\"'

  Scenario: Identifier field is of type String
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_005/class_declaration_005_valid_identifier_type_string.cto | main        |
    When I validate the models
    Then no error should be thrown

  Scenario: Identifier field is a String-based scalar
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_005/class_declaration_005_valid_identifier_type_scalar.cto | main        |
    When I validate the models
    Then no error should be thrown

  Scenario: Identifier field is optional
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_006/class_declaration_006_optional_identifier.cto | main        |
    When I validate the models
    Then an error should be thrown with message "Identifying fields cannot be optional"

  Scenario: Identifier field is required
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_006/class_declaration_006_required_identifier.cto | main        |
    When I validate the models
    Then no error should be thrown

  Scenario: Supertype is not system-identified
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_007/class_declaration_007_supertype_not_system_identified.cto | main        |
    Then an error should be thrown with message 'Expected \"{\", comment, end of line, or whitespace but \"i\" found'

  Scenario: Supertype is system-identified
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_007/class_declaration_007_supertype_system_identified.cto | main        |
    When I validate the models
    Then no error should be thrown

  Scenario: Property name duplicated from supertype
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_008/class_declaration_008_duplicate_property_from_super.cto | main        |
    When I validate the models
    Then an error should be thrown with message "has more than one field named"

  Scenario: Unique property names across inheritance
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_008/class_declaration_008_unique_property_from_super.cto | main        |
    When I validate the models
    Then no error should be thrown

  Scenario: Unique property names across inheritance
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_009/class_declaration_009_circular_inheritance.cto | main        |
    When I validate the models
    Then an error should be thrown with message "Maximum call stack size exceeded"

  Scenario: Unique property names across inheritance
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_009/class_declaration_009_valid_inheritance.cto | main        |
    When I validate the models
    Then no error should be thrown

  Scenario: Unique property names across inheritance
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_010/class_declaration_010_duplicate_property_from_super.cto | main        |
    When I validate the models
    Then an error should be thrown with message "has more than one field"

  Scenario: Unique property names across inheritance
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_010/class_declaration_010_unique_property_from_super.cto | main        |
    When I validate the models
    Then no error should be thrown

  Scenario: Duplicate declarations should throw
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/DECLARATION_001/declaration_001_duplicate_within_model.cto | main  |
    When I validate the models
    Then an error should be thrown with message "has more than one field named"

  Scenario: Unique declarations should pass
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/DECLARATION_001/declaration_001_unique_within_model.cto    | main  |
    When I validate the models
    Then no error should be thrown

  Scenario: Invalid identifier should throw
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/MODEL_ELEMENT_002/model_element_002_invalid_identifier_name.cto | main |
    Then an error should be thrown with message "" 

  Scenario: Valid identifier should pass
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/MODEL_ELEMENT_002/model_element_002_valid_identifier_name.cto | main |
    When I validate the models
    Then no error should be thrown

  Scenario: Relationship to primitive should throw
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/RELATIONSHIP_001/relationship_001_non-primitive_type_relationship.cto | main |
    When I validate the models
    Then an error should be thrown with message "cannot be to the primitive type"

  Scenario: Valid relationship to non-primitive should pass
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/RELATIONSHIP_001/relationship_001_primitive_type_relationship.cto | main |
    When I validate the models
    Then no error should be thrown

  Scenario: Missing relationship type should throw
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/RELATIONSHIP_002/relationship_002_type_not_exist.cto       | main  |
    When I validate the models
    Then an error should be thrown with message "Undeclared type"

  Scenario: Existing relationship type should pass
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/RELATIONSHIP_002/relationship_002_existing_type.cto        | main  |
    When I validate the models
    Then no error should be thrown

  Scenario: Non-identified relationship target should throw
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/RELATIONSHIP_003/relationship_003_not_identified_type.cto  | main  |
    When I validate the models
    Then an error should be thrown with message "must be to a class that has an identifier"

  Scenario: Identified relationship target should pass
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/RELATIONSHIP_003/relationship_003_identified_type.cto      | main  |
    When I validate the models
    Then no error should be thrown

  Scenario: Undeclared non-primitive type should throw
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/PROPERTY_002/property_002_type_does_not_exist.cto          | main  |
    When I validate the models
    Then an error should be thrown with message "Undeclared type"

  Scenario: Declared non-primitive type should pass
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/PROPERTY_002/property_002_type_exist.cto                   | main  |
    When I validate the models
    Then no error should be thrown

  Scenario: Invalid property meta type should throw
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/PROPERTY_003/property_003_meta_type_invalid.cto            | main  |
    Then an error should be thrown with message ""

  Scenario: Valid property meta type should pass
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/PROPERTY_003/property_003_meta_type_valid.cto              | main  |
    When I validate the models
    Then no error should be thrown

  Scenario: Duplicate decorator should throw
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/DECORATED_001/decorated_001_duplicate_decorator.cto        | main  |
    When I validate the models
    Then an error should be thrown with message "Duplicate decorator"

  Scenario: Single decorator should pass
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/DECORATED_001/decorated_001_unique_decorator.cto           | main  |
    When I validate the models
    Then no error should be thrown

Feature: Semantic Validation for CTO Class Declarations

  Scenario: Property name uses system-reserved name
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_001/class_declaration_001_system_property_name.json | main        |
    Then an error should be thrown with message "Invalid field name '$class'"

  Scenario: Valid property names that are not system-reserved
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_001/class_declaration_001_valid_property_name.json | main        |
    Then no error should be thrown

  Scenario: $class property with invalid type
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_002/class_declaration_002_invalid_$class_type.json | main        |
    Then an error should be thrown with message "Invalid field name '$class'"

  Scenario: Model without explicit $class declaration
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_002/class_declaration_002_valid_$class_type.json | main        |
    Then no error should be thrown

  @skip-rust
  Scenario: Duplicate concept declarations in the same file
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_003/class_declaration_003_duplicate_class_name.json | main        |
    When I validate the models
    Then an error should be thrown with message "Duplicate class name"

  Scenario: Uniquely named concept declarations
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_003/class_declaration_003_unique_class_name.json | main        |
    When I validate the models
    Then no error should be thrown

  Scenario: Supertype does not exist
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_004/class_declaration_004_supertype_not_exist.json | main        |
    When I validate the models
    Then an error should be thrown with message "Could not find super type"

  Scenario: Supertype is declared correctly
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_004/class_declaration_004_supertype_exist.json | main        |
    When I validate the models
    Then no error should be thrown

  Scenario: Identifier field is not of type String or scalar
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_005/class_declaration_005_invalid_identifier_type.json | main        |
    When I validate the models
    Then an error should be thrown with message "Class"

  Scenario: Identifier field is of type String
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_005/class_declaration_005_valid_identifier_type_string.json | main        |
    When I validate the models
    Then no error should be thrown

  Scenario: Identifier field is a String-based scalar
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_005/class_declaration_005_valid_identifier_type_scalar.json | main        |
    When I validate the models
    Then no error should be thrown

  Scenario: Identifier field is optional
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_006/class_declaration_006_optional_identifier.json | main        |
    When I validate the models
    Then an error should be thrown with message "Identifying fields cannot be optional"

  Scenario: Identifier field is required
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_006/class_declaration_006_required_identifier.json | main        |
    When I validate the models
    Then no error should be thrown

  @rule:CLASS_DECLARATION_007 @skip-rust
  Scenario: Supertype is not system-identified
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_007/class_declaration_007_supertype_not_system_identified.json | main        |
    When I validate the models
    Then an error of class "IllegalModelException" should be thrown
    And the error should mention "BaseConcept"

  Scenario: Supertype is system-identified
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_007/class_declaration_007_supertype_system_identified.json | main        |
    When I validate the models
    Then no error should be thrown

  Scenario: Property name duplicated from supertype
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_008/class_declaration_008_duplicate_property_from_super.json | main        |
    When I validate the models
    Then an error should be thrown with message "has more than one field named"

  Scenario: Unique property names across inheritance
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_008/class_declaration_008_unique_property_from_super.json | main        |
    When I validate the models
    Then no error should be thrown

  @skip-rust
  Scenario: Unique property names across inheritance
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_009/class_declaration_009_circular_inheritance.json | main        |
    When I validate the models
    Then an error should be thrown with message "Maximum call stack size exceeded"

  Scenario: Unique property names across inheritance
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_009/class_declaration_009_valid_inheritance.json | main        |
    When I validate the models
    Then no error should be thrown

  Scenario: Unique property names across inheritance
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_010/class_declaration_010_duplicate_property_from_super.json | main        |
    When I validate the models
    Then an error should be thrown with message "has more than one field"

  Scenario: Unique property names across inheritance
    Given I load the following models:
      | model_file                                                                 | alias       |
      | concepts/models/CLASS_DECLARATION_010/class_declaration_010_unique_property_from_super.json | main        |
    When I validate the models
    Then no error should be thrown

  Scenario: Duplicate declarations should throw
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/DECLARATION_001/declaration_001_duplicate_within_model.json | main  |
    When I validate the models
    Then an error should be thrown with message "has more than one field named"

  Scenario: Unique declarations should pass
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/DECLARATION_001/declaration_001_unique_within_model.json    | main  |
    When I validate the models
    Then no error should be thrown

  @rule:MODEL_ELEMENT_002 @skip-rust
  Scenario: Invalid identifier should throw
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/MODEL_ELEMENT_002/model_element_002_invalid_identifier_name.json | main |
    Then an error of class "IllegalModelException" should be thrown
    And the error should mention "Invalid-Name"

  Scenario: Valid identifier should pass
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/MODEL_ELEMENT_002/model_element_002_valid_identifier_name.json | main |
    When I validate the models
    Then no error should be thrown

  Scenario: Relationship to primitive should throw
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/RELATIONSHIP_001/relationship_001_non-primitive_type_relationship.json | main |
    When I validate the models
    Then an error should be thrown with message "cannot be to the primitive type"

  Scenario: Valid relationship to non-primitive should pass
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/RELATIONSHIP_001/relationship_001_primitive_type_relationship.json | main |
    When I validate the models
    Then no error should be thrown

  Scenario: Missing relationship type should throw
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/RELATIONSHIP_002/relationship_002_type_not_exist.json       | main  |
    When I validate the models
    Then an error should be thrown with message "Undeclared type"

  Scenario: Existing relationship type should pass
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/RELATIONSHIP_002/relationship_002_existing_type.json        | main  |
    When I validate the models
    Then no error should be thrown

  Scenario: Non-identified relationship target should throw
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/RELATIONSHIP_003/relationship_003_not_identified_type.json  | main  |
    When I validate the models
    Then an error should be thrown with message "must be to a class that has an identifier"

  Scenario: Identified relationship target should pass
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/RELATIONSHIP_003/relationship_003_identified_type.json      | main  |
    When I validate the models
    Then no error should be thrown

  Scenario: Undeclared non-primitive type should throw
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/PROPERTY_002/property_002_type_does_not_exist.json          | main  |
    When I validate the models
    Then an error should be thrown with message "Undeclared type"

  Scenario: Declared non-primitive type should pass
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/PROPERTY_002/property_002_type_exist.json                   | main  |
    When I validate the models
    Then no error should be thrown

  @rule:PROPERTY_003 @skip-rust
  Scenario: Invalid property meta type should throw
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/PROPERTY_003/property_003_meta_type_invalid.json            | main  |
    Then an error of class "IllegalModelException" should be thrown
    And the error should mention "BogusPropertyType"

  Scenario: Valid property meta type should pass
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/PROPERTY_003/property_003_meta_type_valid.json              | main  |
    When I validate the models
    Then no error should be thrown

  Scenario: Duplicate decorator should throw
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/DECORATED_001/decorated_001_duplicate_decorator.json        | main  |
    When I validate the models
    Then an error should be thrown with message "Duplicate decorator"

  Scenario: Single decorator should pass
    Given I load the following models:
      | model_file                                                                                          | alias |
      | concepts/models/DECORATED_001/decorated_001_unique_decorator.json           | main  |
    When I validate the models
    Then no error should be thrown

  # Scenarios below this line were promoted by P5-08b from the oracle corpus and
  # the fuzz records (concerto migration/CONFORMANCE-PROMOTION-PLAN.md). Each one
  # asserts an error class and a @rule tag, never TS message text. They are
  # tagged @skip-rust until the Rust runner gains the class step (and, where
  # used, the options and validated-load steps); see the plan, section 5.1.

  # CON-01. Source: F:supplement/ModelManager.fromAst/9224ce1df87976aca5fb67d0 (#190).
  # JSON AST only: the CTO parser already rejects `concept A extends A`.
  @rule:CLASS_DECLARATION_009 @skip-rust
  Scenario: A class declaration that extends itself
    Given I load the following models:
      | model_file                                                                      | alias |
      | concepts/models/CLASS_DECLARATION_009/class_declaration_009_self_extension.json | main  |
    When I validate the models
    Then an error of class "IllegalModelException" should be thrown
    And the error should mention "SelfExtending"

  # CON-02. Source: F:data/ModelManager.addCTOModel/04e93b56c320a77d8460c8d1 (8 data fixtures);
  # F:unit/ModelManager.addCTOModel/34a90351b1d3f5cac1399cec.
  @rule:CLASS_DECLARATION_011 @skip-rust
  Scenario: A subclass redeclares the explicit identifier of its super class
    Given I load the following models:
      | model_file                                                                             | alias |
      | concepts/models/CLASS_DECLARATION_011/class_declaration_011_redeclared_identifier.json | main  |
    When I validate the models
    Then an error of class "IllegalModelException" should be thrown

  # CON-02 positive pair. Source: F:data/ModelManager.addCTOModel/04e93b56c320a77d8460c8d1, without the redeclaration.
  @rule:CLASS_DECLARATION_011
  Scenario: A subclass inherits the explicit identifier of its super class
    Given I load the following models:
      | model_file                                                                            | alias |
      | concepts/models/CLASS_DECLARATION_011/class_declaration_011_inherited_identifier.json | main  |
    When I validate the models
    Then no error should be thrown

  # CON-03. Source: F:data/ModelManager.addCTOModel/6c5d39ee273d4809465f968e (4);
  # F:unit/ModelManager.addModelFile/dc07549b7de716a452f0348a.
  @rule:CLASS_DECLARATION_005 @skip-rust
  Scenario: The identifying field does not exist
    Given I load the following models:
      | model_file                                                                                | alias |
      | concepts/models/CLASS_DECLARATION_005/class_declaration_005_identifier_field_missing.json | main  |
    When I validate the models
    Then an error of class "IllegalModelException" should be thrown
    And the error should mention "missingField"

  # CON-04. Source: F:data/ModelManager.addCTOModel/322940c4c551adcf3c670b4f (4);
  # F:unit/ModelManager.addModelFiles/79db563bb1bff7b2050fa72b.
  @rule:CLASS_DECLARATION_012 @skip-rust
  Scenario: A participant extends an asset
    Given I load the following models:
      | model_file                                                                                 | alias |
      | concepts/models/CLASS_DECLARATION_012/class_declaration_012_participant_extends_asset.json | main  |
    When I validate the models
    Then an error of class "IllegalModelException" should be thrown

  # CON-04 positive pair. Source: F:data/ModelManager.addCTOModel/322940c4c551adcf3c670b4f, with `asset B` for `participant B`.
  @rule:CLASS_DECLARATION_012
  Scenario: An asset extends an asset
    Given I load the following models:
      | model_file                                                                           | alias |
      | concepts/models/CLASS_DECLARATION_012/class_declaration_012_asset_extends_asset.json | main  |
    When I validate the models
    Then no error should be thrown

  # CON-05. Source: F:unit/ModelManager.addCTOModel/78dbcdf668d182b06ed8dda8;
  # F:gaps/ModelManager.fromAst/19622251d12f84f178484b75, ab6fa284e3042cf23740ea97.
  @rule:CLASS_DECLARATION_001 @skip-rust
  Scenario: A property uses the system-reserved name $identifier
    Given I load the following models:
      | model_file                                                                                       | alias |
      | concepts/models/CLASS_DECLARATION_001/class_declaration_001_identifier_system_property_name.json | main  |
    When I validate the models
    Then an error of class "IllegalModelException" should be thrown
    And the error should mention "$identifier"

  # CON-06. Source: F:data/ModelManager.addCTOModel/019573ce4a7402a1b62036a0 (4);
  # F:supplement/ScalarDeclaration.validate/91f0bfe1c8da7d4a86575afe (#197).
  @rule:DECLARATION_001 @skip-rust
  Scenario: Two scalar declarations share a name
    Given I load the following models:
      | model_file                                                                  | alias |
      | concepts/models/DECLARATION_001/declaration_001_duplicate_scalar_names.json | main  |
    When I validate the models
    Then an error of class "IllegalModelException" should be thrown

  # CON-07. Source: F:supplement/ModelManager.fromAst/7b02e626a0a226bde3b810e6 (#193).
  # JSON AST only: CTO always produces a properties list.
  # The non-list variant (F:supplement/ModelManager.fromAst/000dab841e9b0cef97e8826f, "properties": "none")
  # waits on Q-10 (strict AST); no scenario for it here.
  @rule:CLASS_DECLARATION_013 @skip-rust
  Scenario: A class declaration has no properties list
    Given I load the following models:
      | model_file                                                                         | alias |
      | concepts/models/CLASS_DECLARATION_013/class_declaration_013_properties_absent.json | main  |
    When I validate the models
    Then an error of class "IllegalModelException" should be thrown

  # CON-08. Source: F:unit/ModelFile.new/ba4f62fc881f4ee9b9a96fb4 (2). JSON AST only.
  @rule:MODEL_ELEMENT_003 @skip-rust
  Scenario: A model element is not a metamodel declaration type
    Given I load the following models:
      | model_file                                                                    | alias |
      | concepts/models/MODEL_ELEMENT_003/model_element_003_unrecognised_element.json | main  |
    When I validate the models
    Then an error of class "IllegalModelException" should be thrown

  # CON-09. Source: F:supplement/Resource.validate/1704f2f065f42e186ec9096b (#190 "validate a derived asset"),
  # the Base and Derived declarations of its model. As recorded, Base is not abstract.
  @rule:CLASS_DECLARATION_012
  Scenario: A derived asset that adds fields loads and validates
    Given I load the following models:
      | model_file                                                                                 | alias |
      | concepts/models/CLASS_DECLARATION_012/class_declaration_012_derived_asset_adds_fields.json | main  |
    When I validate the models
    Then no error should be thrown

  # CON-12. Source: Z:#443 (#218 cluster #6, `superType.name = ""`, 3 cases; seed
  # data/ModelManager.fromAst/6287c8da05a81a766dd6845b.json). JSON AST only. The non-string
  # variants of the same field are excluded (plan X-02).
  @rule:CLASS_DECLARATION_004 @skip-rust
  Scenario: A super type reference with an empty name
    Given I load the following models:
      | model_file                                                                            | alias |
      | concepts/models/CLASS_DECLARATION_004/class_declaration_004_supertype_empty_name.json | main  |
    When I validate the models
    Then an error of class "IllegalModelException" should be thrown

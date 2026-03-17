Feature: Instance Validation against Concerto Models

  # --- Primitive Type Validation ---

  Scenario: Valid instance with all primitive types should pass
    When I validate "validate/models/primitives/all_primitives_valid.json" with models "validate/models/primitives/all_primitives.cto"
    Then the validation should succeed

  Scenario: String value for Integer field should fail
    When I validate "validate/models/primitives/integer_type_mismatch.json" with models "validate/models/primitives/all_primitives.cto"
    Then the validation should fail

  Scenario: String value for Boolean field should fail
    When I validate "validate/models/primitives/boolean_type_mismatch.json" with models "validate/models/primitives/all_primitives.cto"
    Then the validation should fail

  # --- Required vs Optional Fields ---

  Scenario: Missing required field should fail
    When I validate "validate/models/required/missing_required.json" with models "validate/models/required/required_fields.cto"
    Then the validation should fail

  Scenario: All required fields present should pass
    When I validate "validate/models/required/all_present.json" with models "validate/models/required/required_fields.cto"
    Then the validation should succeed

  Scenario: Optional field omitted should pass
    When I validate "validate/models/optional/omitted_optional.json" with models "validate/models/optional/optional_field.cto"
    Then the validation should succeed

  # --- Enum Instance Validation ---

  Scenario: Valid enum value should pass
    When I validate "validate/models/enums/valid_enum.json" with models "validate/models/enums/enum_property.cto"
    Then the validation should succeed

  Scenario: Invalid enum value should fail
    When I validate "validate/models/enums/invalid_enum.json" with models "validate/models/enums/enum_property.cto"
    Then the validation should fail

  # --- $class Type Resolution ---

  Scenario: Matching $class type should pass
    When I validate "validate/models/class_type/valid_class.json" with models "validate/models/class_type/person.cto"
    Then the validation should succeed

  Scenario: Non-existent $class type should fail
    When I validate "validate/models/class_type/unknown_class.json" with models "validate/models/class_type/person.cto"
    Then the validation should fail

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

  # --- Collection Size Validation ---

  Scenario: Array within size bounds should pass
    When I validate "validate/models/collection_size/valid_within_bounds.json" with models "validate/models/collection_size/collection_size.cto"
    Then the validation should succeed

  Scenario: Array at minimum bound should pass
    When I validate "validate/models/collection_size/at_min_bound.json" with models "validate/models/collection_size/collection_size.cto"
    Then the validation should succeed

  Scenario: Array at maximum bound should pass
    When I validate "validate/models/collection_size/at_max_bound.json" with models "validate/models/collection_size/collection_size.cto"
    Then the validation should succeed

  Scenario: Array with too few elements should fail
    When I validate "validate/models/collection_size/too_few_elements.json" with models "validate/models/collection_size/collection_size.cto"
    Then the validation should fail

  Scenario: Array with too many elements should fail
    When I validate "validate/models/collection_size/too_many_elements.json" with models "validate/models/collection_size/collection_size.cto"
    Then the validation should fail

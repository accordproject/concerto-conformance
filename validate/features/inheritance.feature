Feature: Instance Validation: Inheritance

  # Promoted by P5-08b (concerto migration/CONFORMANCE-PROMOTION-PLAN.md, section 1.K).
  # Each scenario asserts an error class and a @rule tag, never TS message text.
  # Every model has a JSON AST sibling (<model>.ast.json, generated from the
  # .cto with concerto-cto) for runners without a CTO parser.

  # Re-expressed (plan 4.1): the cited fixture was recorded by calling
  # Resource.validate on a resource built in memory; this is the instance-JSON form.
  # INH-01. Source: F:gaps/Resource.validate/3363a3ddcc5914a45a7a1422 (a Bike for `o Car car`);
  # F:unit/Resource.validate/7fc8e23992f6c50ed3b5fb11.
  @rule:INSTANCE_030
  Scenario: A contained value whose $class is not the declared type or a subtype of it
    When I validate "validate/models/inheritance/contained_value_not_subtype.json" with models "validate/models/inheritance/inheritance.cto"
    Then an error of class "ValidationException" should be thrown

  # Re-expressed (plan 4.1): the cited fixture was recorded by calling
  # Resource.validate on a resource built in memory; this is the instance-JSON form.
  # INH-01 (array field). Source: F:gaps/Resource.validate/e2649af2c774da7d2f7a8484 (a Bike in `o Car[] cars`).
  @rule:INSTANCE_030
  Scenario: A contained array element whose $class is not the declared type or a subtype of it
    When I validate "validate/models/inheritance/array_element_not_subtype.json" with models "validate/models/inheritance/inheritance.cto"
    Then an error of class "ValidationException" should be thrown

  # INH-02. Source: F:supplement/Serializer.fromJSON/93cc979c91cd056d2add5107 (#190 "validate a derived asset").
  @rule:INSTANCE_030
  Scenario: A subtype instance with inherited fields is accepted
    When I validate "validate/models/inheritance/derived_instance.json" with models "validate/models/inheritance/inheritance.cto"
    Then the validation should succeed

  # Re-expressed (plan 4.1): the cited fixture was recorded by calling
  # Resource.validate on a resource built in memory; this is the instance-JSON form.
  # INH-03. Source: F:supplement/Resource.validate/e455cab3b19b2f737d873688 (#190 "a field with a default
  # value left unset"); its instance-JSON form is F:supplement/Serializer.fromJSON/3207b2a10e7355e10b2b2b9e.
  @rule:INSTANCE_003
  Scenario: A field with a default value may be omitted
    When I validate "validate/models/inheritance/default_value_omitted.json" with models "validate/models/inheritance/inheritance.cto"
    Then the validation should succeed

  # Re-expressed (plan 4.1): the cited fixture was recorded by calling
  # Resource.validate on a resource built in memory; this is the instance-JSON form.
  # INH-04. Source: F:gaps/Resource.validate/812169e226bb563c3062faf2 (nested `Part.extra`); nested form
  # of INS-02. F:unit/Resource.validate/e112db6f710c1ba9da2175b7 (1) is the top-level form.
  @rule:INSTANCE_002
  Scenario: A contained value with a property its type does not declare
    When I validate "validate/models/inheritance/nested_undeclared_property.json" with models "validate/models/inheritance/inheritance.cto"
    Then an error of class "ValidationException" should be thrown
    And the error should mention "extra"

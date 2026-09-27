Feature: Instance Validation: Structure

  # Promoted by P5-08b (concerto migration/CONFORMANCE-PROMOTION-PLAN.md, section 1.H).
  # Each scenario asserts an error class and a @rule tag, never TS message text.
  # Every model has a JSON AST sibling (<model>.ast.json, generated from the
  # .cto with concerto-cto) for runners without a CTO parser.
  # INS-05 moved to Q-13: its instance-JSON form raises a plain Error.

  # INS-02. Source: F:unit/Serializer.fromJSON/da7770373053efbcd3651cab; F:data/Serializer.fromJSON/05598770d4c6f12c4d5dcf8e
  # (81 with this template); F:unit/Serializer.fromJSON/853af8b9ef7b95224e8881ce.
  @rule:INSTANCE_002
  Scenario: A property the type does not declare
    When I validate "validate/models/structure/undeclared_property.json" with models "validate/models/structure/structure.cto"
    Then an error of class "ValidationException" should be thrown
    And the error should mention "WRONG"

  # INS-02. Source: F:unit/Serializer.fromJSON/7eef0467c9736d911a423e4a.
  @rule:INSTANCE_002
  Scenario: A $-prefixed property the type does not declare
    When I validate "validate/models/structure/undeclared_dollar_property.json" with models "validate/models/structure/structure.cto"
    Then an error of class "ValidationException" should be thrown
    And the error should mention "$WRONG"

  # INS-03. Source: F:unit/Serializer.fromJSON/4265ea5776f0744ece6cfaf3.
  @rule:INSTANCE_002
  Scenario: A $timestamp system property the type does not allow
    When I validate "validate/models/structure/reserved_timestamp.json" with models "validate/models/structure/structure.cto"
    Then an error of class "ValidationException" should be thrown
    And the error should mention "$timestamp"

  # INS-03. Source: F:unit/Serializer.fromJSON/4f5727758ee6ebaeb5aba2dc.
  @rule:INSTANCE_002
  Scenario: A reserved system property the type does not allow
    When I validate "validate/models/structure/reserved_validator.json" with models "validate/models/structure/structure.cto"
    Then an error of class "ValidationException" should be thrown
    And the error should mention "$validator"

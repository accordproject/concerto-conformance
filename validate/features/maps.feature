Feature: Instance Validation: Maps

  # Promoted by P5-08b (concerto migration/CONFORMANCE-PROMOTION-PLAN.md, section 1.M).
  # Each scenario asserts an error class and a @rule tag, never TS message text.
  # Every model has a JSON AST sibling (<model>.ast.json, generated from the
  # .cto with concerto-cto) for runners without a CTO parser.

  # IMP-01. Source: F:supplement/Serializer.fromJSON/2cbebbf0437339c532b5d557, 96c2b0deacdd10cc1a83ca2d (#194).
  @rule:INSTANCE_040
  Scenario: A map value whose $class does not resolve
    When I validate "validate/models/maps/map_value_unknown_class.json" with models "validate/models/maps/maps.cto"
    Then an error of class "ValidationException" should be thrown

  # IMP-02. Source: F:supplement/Serializer.fromJSON/64a7fda6f2fd8f2f9d4e0a8e (#194 positive).
  @rule:INSTANCE_040
  Scenario: A map with well-typed values is accepted
    When I validate "validate/models/maps/map_values_well_typed.json" with models "validate/models/maps/maps.cto"
    Then the validation should succeed

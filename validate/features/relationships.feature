Feature: Instance Validation: Identifiers and Relationships

  # Promoted by P5-08b (concerto migration/CONFORMANCE-PROMOTION-PLAN.md, section 1.J).
  # Each scenario asserts an error class and a @rule tag, never TS message text.
  # Every model has a JSON AST sibling (<model>.ast.json, generated from the
  # .cto with concerto-cto) for runners without a CTO parser.
  # REL-03 and REL-08 wait on Q-11 (serializer options), and REL-01 moved to
  # Q-13 (its instance-JSON form raises a plain Error), so they are not here.

  # REL-05. Source: F:lifted/Serializer.fromJSON/777d0f1bdb8fc226c82bc415 (JP-VS-003).
  # Recorded with {validate: false}; the shape check is the populator's, so it applies either way.
  @rule:INSTANCE_011
  Scenario: A non-array value for an array relationship field
    When I validate "validate/models/relationships/array_relationship_not_array.json" with models "validate/models/relationships/relationships.cto"
    Then an error of class "ValidationException" should be thrown

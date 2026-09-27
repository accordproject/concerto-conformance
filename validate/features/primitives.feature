Feature: Instance Validation: Primitive Types and Dates

  # Promoted by P5-08b (concerto migration/CONFORMANCE-PROMOTION-PLAN.md, section 1.I).
  # Each scenario asserts an error class and a @rule tag, never TS message text.
  # Every model has a JSON AST sibling (<model>.ast.json, generated from the
  # .cto with concerto-cto) for runners without a CTO parser.

  # PRM-01. Source: F:gaps/Serializer.fromJSON/1aa31f090ed15792e0b30485 (default options);
  # F:lifted/Serializer.fromJSON/707218a446c96228c2f1dae0 (JP-CV-020), cdb265c14bad738f749b0062 (JP-CV-016),
  # both recorded with {validate: false}: the type check is the populator's, so it applies either way.
  @rule:INSTANCE_010
  Scenario: A non-number for a Long field
    When I validate "validate/models/primitives/long_not_a_number.json" with models "validate/models/primitives/convert_box.cto"
    Then an error of class "ValidationException" should be thrown

  # PRM-02. Source: F:gaps/Serializer.fromJSON/dd8a2934832696c1b29dabd4;
  # F:lifted/Serializer.fromJSON/f06744c7e6fa3441835e266f (JP-CV-021).
  @rule:INSTANCE_010
  Scenario: A non-number for a Double field
    When I validate "validate/models/primitives/double_not_a_number.json" with models "validate/models/primitives/convert_box.cto"
    Then an error of class "ValidationException" should be thrown

  # PRM-03. Source: F:gaps/Serializer.fromJSON/d106c4be2398eea1c9f577f5;
  # F:lifted/Serializer.fromJSON/7501684a928cc82ddb480a47 (JP-CV-031).
  @rule:INSTANCE_010
  Scenario: A non-string for a String field
    When I validate "validate/models/primitives/string_not_a_string.json" with models "validate/models/primitives/convert_box.cto"
    Then an error of class "ValidationException" should be thrown

  # PRM-04. Source: F:lifted/Serializer.fromJSON/32d50dc5c52c15ee0eb24f7e (JP-CV-013, Integer),
  # c5b87cdb0253a6634bd0db1d (JP-CV-018, Long), 76cb58b8715aef927fe84a59 (JP-CV-023, Double),
  # 94cc1cb6fc3bf6f62ae38ecb (JP-CV-028, Boolean), 648a492e4cef700df339b4ee (JP-CV-033, String),
  # aee94f197dd35f048a664d25 (JP-CV-007, DateTime). The recorded element is `null` or JS `undefined`;
  # `undefined` is not JSON (plan X-01), so every row uses `null`, which is how JSON writes it.
  @rule:INSTANCE_010
  Scenario Outline: An array element of the wrong primitive type
    When I validate "validate/models/primitives/array_element_<field>.json" with models "validate/models/primitives/convert_box.cto"
    Then an error of class "ValidationException" should be thrown

    Examples:
      | type     | field |
      | Integer  | iArr  |
      | Long     | lArr  |
      | Double   | dArr  |
      | Boolean  | bArr  |
      | String   | sArr  |
      | DateTime | dtArr |

  # PRM-05. Source: F:lifted/Serializer.fromJSON/71bf28e9c21383193f2d16e3 (JP-VS-004).
  @rule:INSTANCE_011
  Scenario: A number where the field is an array
    When I validate "validate/models/primitives/array_field_number.json" with models "validate/models/primitives/convert_box.cto"
    Then an error of class "ValidationException" should be thrown

  # PRM-05. Source: F:lifted/Serializer.fromJSON/e70d7dbfca54341a9ecabd25 (JP-VS-002).
  @rule:INSTANCE_011
  Scenario: A string where the field is an array
    When I validate "validate/models/primitives/array_field_string.json" with models "validate/models/primitives/convert_box.cto"
    Then an error of class "ValidationException" should be thrown

  # PRM-06. Source: the `ok` JP-CV rows, e.g. F:lifted/Serializer.fromJSON/65bceda3f6583f0835ff902b (JP-CV-001).
  @rule:INSTANCE_010
  Scenario: Well-typed primitive values are accepted
    When I validate "validate/models/primitives/well_typed_values.json" with models "validate/models/primitives/convert_box.cto"
    Then the validation should succeed

  # PRM-06. Source: the `ok` JP-CV rows (positive pairs of PRM-04).
  @rule:INSTANCE_010
  Scenario: Well-typed primitive arrays are accepted
    When I validate "validate/models/primitives/well_typed_arrays.json" with models "validate/models/primitives/convert_box.cto"
    Then the validation should succeed

  # PRM-06. Source: F:lifted/Serializer.fromJSON/99b0ff35c7d302f483e6de9f (JP-CV-002).
  @rule:INSTANCE_012
  Scenario: A DateTime with a time-zone offset is accepted
    When I validate "validate/models/primitives/datetime_with_offset.json" with models "validate/models/primitives/convert_box.cto"
    Then the validation should succeed

  # PRM-08. Source: F:lifted/Serializer.fromJSON/4cbbef1d3b9448fe5e45cede (JP-CV-006);
  # F:unit/Serializer.fromJSON/176b7fad280d782925876dbe (13). `abc` is outside both ISO 8601
  # and V8's legacy date forms (plan PRM-09, X-01).
  @rule:INSTANCE_012
  Scenario: A string that is not a date-time for a DateTime field
    When I validate "validate/models/primitives/datetime_not_a_date.json" with models "validate/models/primitives/convert_box.cto"
    Then an error of class "ValidationException" should be thrown

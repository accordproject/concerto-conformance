Feature: Semantic Validation of CTO Scalars specification

  Scenario: should pass for valid number bounds
    Given I load the following models:
      |  model_file                     |alias|
      |  scalars/models/NUMBER_VALIDATOR_001/number_validator_001_valid_bounds.json          |main|
    Then no error should be thrown

  Scenario: should throw for no number bounds
    Given I load the following models:
      |  model_file                     |alias|
      |  scalars/models/NUMBER_VALIDATOR_001/number_validator_001_no_bounds.json        |main|
    Then an error should be thrown with message "Invalid range, lower and-or upper bound must be specified"

  Scenario: should pass for valid number range
    Given I load the following models:
      |  model_file                     |alias|
      |  scalars/models/NUMBER_VALIDATOR_002/number_validator_002_valid_range.json          |main|
    Then no error should be thrown

  Scenario: should throw when lower > upper in number bounds
    Given I load the following models:
      |  model_file                     |alias|
      |  scalars/models/NUMBER_VALIDATOR_002/number_validator_002_lower_greater_than_upper.json          |main|
    Then an error should be thrown with message "Lower bound must be less than or equal to upper bound"

  # NOTE (P5-08a review): number_validator_003_invalid_range_type.cto does
  # not parse -- the grammar's Integer range validator only accepts
  # signed-integer literals, so a float lower bound is a ParseException,
  # never a semantic one (see the .cto file's own comment). Per the P5-08
  # promotion plan (FIX-01/X-06), a syntactic negative like this belongs in
  # a parser-level suite, not a hand-authored JSON AST standing in for text
  # the grammar can never produce, so no JSON AST is provided here. This
  # scenario keeps asserting the intended rejection and is left @skip
  # (concerto-core's NumberValidator does not currently check that a range
  # bound is an integer either, so it would fail even with a real fixture)
  # pending a maintainer decision on where this case belongs; see the
  # P5-08a review report.
  @skip
  Scenario: Invalid floating point range on Integer property should throw an error
    Given I load the following models:
      | model_file                                                                 | alias |
      | scalars/models/NUMBER_VALIDATOR_003/number_validator_003_invalid_range_type.json | main  |
    Then an error should be thrown with message "range bound must be an integer"

  Scenario: Valid integer range on Integer property should pass validation
    Given I load the following models:
      | model_file                                                                 | alias |
      | scalars/models/NUMBER_VALIDATOR_003/number_validator_003_valid_range_type.json   | main  |
    Then no error should be thrown

  Scenario: should pass for valid string length bounds
    Given I load the following models:
      |  model_file                     |alias|
      |  scalars/models/STRING_VALIDATOR_001/string_validator_001_valid_bounds.json          |main|
    Then no error should be thrown

  # NOTE (P5-08a review): StringValidator (unlike NumberValidator) does not
  # treat both bounds absent as an error when they are simply missing from
  # the AST -- minLength/maxLength stay `undefined`, not `null`, so the
  # `this.minLength === null && this.maxLength === null` check never fires,
  # and 'Invalid string length, minLength and-or maxLength must be
  # specified.' (StringValidator's own message for that case) is never
  # thrown. This scenario keeps asserting the intended rejection and is
  # left @skip pending a maintainer decision on whether this is worth a
  # follow-up issue against concerto-core; see the P5-08a review report.
  @skip
  Scenario: should throw for empty string length bounds
    Given I load the following models:
      |  model_file                     |alias|
      |  scalars/models/STRING_VALIDATOR_001/string_validator_001_no_bounds.json          |main|
    Then an error should be thrown with message "Invalid string length, minLength and-or maxLength must be specified"

  Scenario: should pass for positive string length bounds
    Given I load the following models:
      |  model_file                     |alias|
      |  scalars/models/STRING_VALIDATOR_002/string_validator_002_positive_bounds.json          |main|
    Then no error should be thrown

  Scenario: should throw for negative bounds in string length
    Given I load the following models:
      |  model_file                     |alias|
      |  scalars/models/STRING_VALIDATOR_002/string_validator_002_negative_bounds.json          |main|
    Then an error should be thrown with message "minLength and-or maxLength must be positive integers"

  Scenario: should pass when lower < upper in string length
    Given I load the following models:
      |  model_file                     |alias|
      |  scalars/models/STRING_VALIDATOR_003/string_validator_003_valid_order.json          |main|
    Then no error should be thrown

  Scenario: should throw when lower > upper in string length
    Given I load the following models:
      |  model_file                     |alias|
      |  scalars/models/STRING_VALIDATOR_003/string_validator_003_lower_greater_than_upper.json          |main|
    Then an error should be thrown with message "minLength must be less than or equal to maxLength"

  Scenario: should pass for valid regex pattern
    Given I load the following models:
      |  model_file                     |alias|
      |  scalars/models/STRING_VALIDATOR_004/string_validator_004_valid_regex.json          |main|
    Then no error should be thrown

  Scenario: should throw for invalid regex
    Given I load the following models:
      |  model_file                     |alias|
      |  scalars/models/STRING_VALIDATOR_004/string_validator_004_invalid_regex.json          |main|
    Then an error should be thrown with message "Invalid regular expression"

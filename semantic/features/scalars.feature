Feature: Semantic Validation of CTO Scalars specification

  Scenario: should pass for valid number bounds
    Given I load the following models:
      |  model_file                     |alias|
      |  scalars/models/NUMBER_VALIDATOR_001/number_validator_001_valid_bounds.cto          |main|
    Then no error should be thrown

  Scenario: should throw for no number bounds
    Given I load the following models:
      |  model_file                     |alias|
      |  scalars/models/NUMBER_VALIDATOR_001/number_validator_001_no_bounds.cto        |main|
    Then an error should be thrown with message "/Expected \"/"

  Scenario: should pass for valid number range
    Given I load the following models:
      |  model_file                     |alias|
      |  scalars/models/NUMBER_VALIDATOR_002/number_validator_002_valid_range.cto          |main|
    Then no error should be thrown

  Scenario: should throw when lower > upper in number bounds
    Given I load the following models:
      |  model_file                     |alias|
      |  scalars/models/NUMBER_VALIDATOR_002/number_validator_002_lower_greater_than_upper.cto          |main|
    Then an error should be thrown with message "/Lower bound must be less than or equal to upper bound/"

  Scenario: should pass for valid string length bounds
    Given I load the following models:
      |  model_file                     |alias|
      |  scalars/models/STRING_VALIDATOR_001/string_validator_001_valid_bounds.cto          |main|
    Then no error should be thrown

  Scenario: should throw for empty string length bounds
    Given I load the following models:
      |  model_file                     |alias|
      |  scalars/models/STRING_VALIDATOR_001/string_validator_001_no_bounds.cto          |main|
    Then an error should be thrown with message "/Expected \"/"

  Scenario: should pass for positive string length bounds
    Given I load the following models:
      |  model_file                     |alias|
      |  scalars/models/STRING_VALIDATOR_002/string_validator_002_positive_bounds.cto          |main|
    Then no error should be thrown

  Scenario: should throw for negative bounds in string length
    Given I load the following models:
      |  model_file                     |alias|
      |  scalars/models/STRING_VALIDATOR_002/string_validator_002_negative_bounds.cto          |main|
    Then an error should be thrown with message "/minLength and-or maxLength must be positive integers/"

  Scenario: should pass when lower < upper in string length
    Given I load the following models:
      |  model_file                     |alias|
      |  scalars/models/STRING_VALIDATOR_003/string_validator_003_valid_order.cto          |main|
    Then no error should be thrown

  Scenario: should throw when lower > upper in string length
    Given I load the following models:
      |  model_file                     |alias|
      |  scalars/models/STRING_VALIDATOR_003/string_validator_003_lower_greater_than_upper.cto          |main|
    Then an error should be thrown with message "/minLength must be less than or equal to maxLength/"

  Scenario: should throw for invalid regex
    Given I load the following models:
      |  model_file                     |alias|
      |  scalars/models/STRING_VALIDATOR_004/string_validator_004_valid_regex.cto          |main|
    Then no error should be thrown
    
  Scenario: should pass for valid regex pattern
    Given I load the following models:
      |  model_file                     |alias|
      |  scalars/models/STRING_VALIDATOR_004/string_validator_004_invalid_regex.cto          |main|
    Then an error should be thrown with message "/Expected comment/"
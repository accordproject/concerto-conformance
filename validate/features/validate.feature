Feature: Validate instance against CTO models

  Scenario: Valid model and instance
    When I validate "validate/models/validate/valid/instance.json" with models "validate/models/validate/valid/model.cto"
    Then the validation should succeed

  Scenario: Missing model file
    When I validate "validate/models/validate/valid/instance.json" with models ""
    Then the error message should contain "EISDIR: illegal operation on a directory, read"

  Scenario: Invalid JSON input
    When I validate "validate/models/validate/invalid/badInstance.json" with models "validate/models/validate/valid/model.cto"
    Then the error message should contain "The instance \"org.acme@1.0.0.Person\" is missing the required field \"age\""

  Scenario: Model file does not exist
    When I validate "validate/models/validate/valid/instance.json" with models "validate/models/validate/invalid/noSuch.cto"
    Then the error message should contain "ENOENT: no such file or directory"

  Scenario: Valid model and instance with utcOffset
    When I validate "validate/models/validate/valid/instance.json" with models "validate/models/validate/valid/model.cto" and options:
      | utcOffset | 330 |
    Then the validation should succeed

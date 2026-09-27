Feature: Semantic Validation of Decorators

  # Promoted by P5-08b (concerto migration/CONFORMANCE-PROMOTION-PLAN.md, section 1.F).
  # Tagged @skip-rust until the Rust runner has the class and options steps
  # (plan section 5.1).

  # DEC-01. Source: F:unit/ModelManager.validateModelFiles/63b2562dda3a5fb8e15036e1 and 11 more
  # `Decorators #validate` / `ModelManager #validateDecorators` fixtures (DV-016 is message-only).
  @rule:DECORATOR_001 @skip-rust
  Scenario: An undeclared decorator with decorator validation on
    Given the model manager options:
      | option | value |
      | decoratorValidation.missingDecorator | error |
      | decoratorValidation.invalidDecorator | error |
    And I load the following models:
      | model_file                                                              | alias |
      | decorators/models/DECORATOR_001/decorator_001_undeclared_decorator.json | main  |
    When I validate the models
    Then an error of class "IllegalModelException" should be thrown
    And the error should mention "Hide"

  # DEC-02. Source: F:unit/ModelManager.validateModelFiles/0c3b211ea1cddf829787c629.
  @rule:DECORATOR_002 @skip-rust
  Scenario: A decorator argument of the wrong type with decorator validation on
    Given the model manager options:
      | option | value |
      | decoratorValidation.missingDecorator | error |
      | decoratorValidation.invalidDecorator | error |
    And I load the following models:
      | model_file                                                             | alias |
      | decorators/models/DECORATOR_002/decorator_002_wrong_argument_type.json | main  |
    When I validate the models
    Then an error of class "IllegalModelException" should be thrown

  # DEC-03. Source: F:unit/ModelManager.validateModelFiles/e2f41acedcca5a277bb276dd (`ok`).
  @rule:DECORATOR_001 @skip-rust
  Scenario: Decorators that match their declared type with decorator validation on
    Given the model manager options:
      | option | value |
      | decoratorValidation.missingDecorator | error |
      | decoratorValidation.invalidDecorator | error |
    And I load the following models:
      | model_file                                                            | alias |
      | decorators/models/DECORATOR_001/decorator_001_declared_decorator.json | main  |
    When I validate the models
    Then no error should be thrown

  # DEC-03. Source: F:unit/ModelManager.validateModelFiles/01e8a463b8c3fd7b246de3c5 (`ok`).
  @rule:DECORATOR_001 @skip-rust
  Scenario: An undeclared decorator with decorator validation off (the default)
    Given I load the following models:
      | model_file                                                                          | alias |
      | decorators/models/DECORATOR_001/decorator_001_undeclared_decorator_unvalidated.json | main  |
    When I validate the models
    Then no error should be thrown

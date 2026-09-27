Feature: Metamodel Validation of JSON ASTs

  # Promoted by P5-08b (concerto migration/CONFORMANCE-PROMOTION-PLAN.md, section 1.G).
  # JSON ASTs only: these shapes cannot be written in CTO. Metamodel validation
  # runs when a model is added with validation, so these scenarios use the
  # validated load step. Tagged @skip-rust until the Rust runner has the class,
  # options and validated-load steps (plan section 5.1).

  # AST-01. Source: F:data/ModelManager.addCTOModel/d960773dc1add363ea2a8891 (2, `defaultValue` on a
  # DateTimeProperty); F:unit/ModelManager.addModel/6b183dd04a82a63d693b6d35.
  @rule:METAMODEL_001 @skip-rust
  Scenario: An AST node carries a property the metamodel does not declare
    Given the model manager options:
      | option | value |
      | metamodelValidation | true |
    And I load the following models with validation:
      | model_file                                                                | alias |
      | metamodel/models/METAMODEL_001/metamodel_001_undeclared_ast_property.json | main  |
    Then an error of class "MetamodelException" should be thrown

  # AST-01 positive pair. Source: F:data/ModelManager.addCTOModel/cd37a48bcd6b5409b23f40a2
  # (test/1.0.0/models/date1.cto, recorded `ok` with metamodelValidation: true); the model is its
  # recorded AST: a DateTimeProperty with no undeclared property.
  @rule:METAMODEL_001 @skip-rust
  Scenario: An AST that uses only metamodel-declared properties loads with metamodel validation
    Given the model manager options:
      | option | value |
      | metamodelValidation | true |
    And I load the following models with validation:
      | model_file                                                             | alias |
      | metamodel/models/METAMODEL_001/metamodel_001_declared_ast_properties.json | main  |
    Then no error should be thrown

  # AST-02. Source: F:unit/ModelManager.addModel/75ea10eea76396079fe879ff.
  @rule:METAMODEL_002 @skip-rust
  Scenario: An AST's metamodel version does not match the implementation's
    Given the model manager options:
      | option | value |
      | metamodelValidation | true |
    And I load the following models with validation:
      | model_file                                                                  | alias |
      | metamodel/models/METAMODEL_002/metamodel_002_unknown_metamodel_version.json | main  |
    Then an error of class "MetamodelException" should be thrown

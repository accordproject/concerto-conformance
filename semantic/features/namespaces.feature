Feature: Semantic Validation of CTO Namespace Imports

  Scenario: Invalid duplicate namespace imports should throw an error
    Given I load the following models:
      | model_file                                             | alias |
      | namespaces/models/MODEL_FILE_002/importedTypes.cto                                      | imported                      |
      | namespaces/models/MODEL_FILE_002/model_file_002_duplicate_namespace_imports.cto         | main                          |
    When I validate the models
    Then an error should be thrown with message "Namespace org.external.types is already defined"

  Scenario: Valid unique namespace imports should pass
    Given I load the following models:
      | model_file                                             | alias |
      | namespaces/models/MODEL_FILE_002/importedTypes.cto                                      | imported |
      | namespaces/models/MODEL_FILE_002/model_file_002_unique_namespace_imports.cto            | main     |
    When I validate the models
    Then no error should be thrown
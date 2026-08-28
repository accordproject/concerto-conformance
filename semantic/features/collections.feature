Feature: Semantic Validation of CTO Collection Size specification

  Scenario: should pass for valid array size bounds
    Given I load the following models:
      |  model_file                     |alias|
      |  collections/models/COLLECTION_SIZE_001/collection_size_001_valid_bounds.json          |main|
    Then no error should be thrown

  Scenario: should pass for valid map-typed property size bounds
    Given I load the following models:
      |  model_file                     |alias|
      |  collections/models/COLLECTION_SIZE_002/collection_size_002_map_property.json          |main|
    Then no error should be thrown

  Scenario: should pass for min-only size constraint
    Given I load the following models:
      |  model_file                     |alias|
      |  collections/models/COLLECTION_SIZE_003/collection_size_003_min_only.json          |main|
    Then no error should be thrown

  Scenario: should pass for max-only size constraint
    Given I load the following models:
      |  model_file                     |alias|
      |  collections/models/COLLECTION_SIZE_004/collection_size_004_max_only.json          |main|
    Then no error should be thrown

  Scenario: should throw when minSize > maxSize in collection size
    Given I load the following models:
      |  model_file                     |alias|
      |  collections/models/COLLECTION_SIZE_005/collection_size_005_min_greater_than_max.json          |main|
    Then an error should be thrown with message "minSize must be less than or equal to maxSize"

  Scenario: should throw when size validator is applied to non-collection property
    Given I load the following models:
      |  model_file                     |alias|
      |  collections/models/COLLECTION_SIZE_006/collection_size_006_non_collection.json          |main|
    When I validate the models
    Then an error should be thrown with message "size validator can only be applied to array or map properties"

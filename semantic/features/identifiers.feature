Feature: Semantic Validation of Identifiers

  # Promoted by P5-08b (concerto migration/CONFORMANCE-PROMOTION-PLAN.md, section 1.B).
  # The models are JSON ASTs only: a digit-leading name cannot be written in CTO
  # (the parser rejects it before any semantic rule runs, plan exclusion X-06),
  # and the positive cases use the same form.

  # IDN-01. Source: F:unit/ModelUtil.isValidIdentifier/ea8308fef78b0e065847f858 (`2nd`, ClassDeclaration);
  # #219 cluster 1 (IllegalModelException for an invalid name in a JSON AST).
  # The error class comes from fuzz cluster #219 c1; the cited unit fixtures record only `false`.
  @rule:MODEL_ELEMENT_002
  Scenario: A declaration name starts with a digit
    Given I load the following models:
      | model_file                                                                                     | alias |
      | identifiers/models/MODEL_ELEMENT_002/model_element_002_declaration_name_starts_with_digit.json | main  |
    When I validate the models
    Then an error of class "IllegalModelException" should be thrown

  # IDN-01. Source: F:unit/ModelUtil.isValidIdentifier/f803bb772273772d782c8927 (`1st`, Property);
  # #219 cluster 1. The error class comes from fuzz cluster #219 c1; the cited unit fixture records only `false`.
  @rule:MODEL_ELEMENT_002
  Scenario: A property name starts with a digit
    Given I load the following models:
      | model_file                                                                                  | alias |
      | identifiers/models/MODEL_ELEMENT_002/model_element_002_property_name_starts_with_digit.json | main  |
    When I validate the models
    Then an error of class "IllegalModelException" should be thrown

  # IDN-02. Source: F:unit/ModelUtil.isValidIdentifier/183076801c054024763a587a (`null`),
  # 468f923bf034b4b525585c82 (`property`), caba14b152502469c5846f0f (`field`),
  # e6950fdea351d9a0ad4938a1 (`MapPermutation1`), 0692921295a1df144f9d9e6c (`suchName`).
  @rule:MODEL_ELEMENT_002
  Scenario Outline: Keywords, letter-digit mixes and plain names are valid identifiers
    Given I load the following models:
      | model_file                                        | alias |
      | identifiers/models/MODEL_ELEMENT_002/<model_file> | main  |
    When I validate the models
    Then no error should be thrown

    Examples:
      | model_file |
      | model_element_002_valid_property_name_null.json |
      | model_element_002_valid_property_name_property.json |
      | model_element_002_valid_property_name_field.json |
      | model_element_002_valid_declaration_name_MapPermutation1.json |
      | model_element_002_valid_declaration_name_suchName.json |

  # IDN-04. Source: F:unit/ScalarDeclaration.new/00885bec98ea8d2a0e34fd40 (Double), 4b9dd951899db22a5255d3d0 (String),
  # 8100fbc6e9d66fbf6a792eaf (Integer), 66b1a81f435fdb22b9971480 (Long), aff4b12d70d311e5a7bea5bc (Boolean),
  # 44b6a59e84ffb25d95fa6f74 (DateTime). (The family has 7 fixtures; the 7th, ea25da09d9cf2605bfdc527d, is a positive.
  # It is not promoted: the plan does not require it.)
  @rule:SCALAR_DECLARATION_001
  Scenario Outline: A scalar is named after a primitive type
    Given I load the following models:
      | model_file                                                                                     | alias |
      | identifiers/models/SCALAR_DECLARATION_001/scalar_declaration_001_scalar_named_<primitive>.json | main  |
    When I validate the models
    Then an error of class "IllegalModelException" should be thrown

    Examples:
      | primitive |
      | String |
      | Integer |
      | Long |
      | Double |
      | Boolean |
      | DateTime |

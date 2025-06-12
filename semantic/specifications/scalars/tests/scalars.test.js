import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ModelManager } from '@accordproject/concerto-core';

const loadCTO = (relativePath) => {
  return fs.readFileSync(path.resolve(relativePath), 'utf8');
};

describe('Semantic Validation - Number Validators', () => {
  it('should pass for valid number bounds', () => {
    const cto = loadCTO('semantic/specifications/scalars/models/NUMBER_VALIDATOR_001/number_validator_001_valid_bounds.cto');
    const modelManager = new ModelManager();
    expect(() => modelManager.addCTOModel(cto, 'number_validator_001_valid_bounds.cto', true)).not.toThrow();
  });

  it('should throw for no number bounds', () => {
    const cto = loadCTO('semantic/specifications/scalars/models/NUMBER_VALIDATOR_001/number_validator_001_no_bounds.cto');
    const modelManager = new ModelManager();
    expect(() => modelManager.addCTOModel(cto, 'number_validator_001_no_bounds.cto', true)).toThrow(/Expected \"/);
  });

  it('should pass for valid number range', () => {
    const cto = loadCTO('semantic/specifications/scalars/models/NUMBER_VALIDATOR_002/number_validator_002_valid_range.cto');
    const modelManager = new ModelManager();
    expect(() => modelManager.addCTOModel(cto, 'number_validator_002_valid_range.cto', true)).not.toThrow();
  });

  it('should throw when lower > upper in number bounds', () => {
    const cto = loadCTO('semantic/specifications/scalars/models/NUMBER_VALIDATOR_002/number_validator_002_lower_greater_than_upper.cto');
    const modelManager = new ModelManager();
    expect(() => modelManager.addCTOModel(cto, 'number_validator_002_lower_greater_than_upper.cto', true)).toThrow(/Lower bound must be less than or equal to upper bound/);
  });
});

describe('Semantic Validation - String Validators', () => {
  it('should pass for valid string length bounds', () => {
    const cto = loadCTO('semantic/specifications/scalars/models/STRING_VALIDATOR_001/string_validator_001_valid_bounds.cto');
    const modelManager = new ModelManager();
    expect(() => modelManager.addCTOModel(cto, 'string_validator_001_valid_bounds.cto', true)).not.toThrow();
  });

  it('should throw for empty string length bounds', () => {
    const cto = loadCTO('semantic/specifications/scalars/models/STRING_VALIDATOR_001/string_validator_001_no_bounds.cto');
    const modelManager = new ModelManager();
    expect(() => modelManager.addCTOModel(cto, 'string_validator_001_no_bounds.cto', true)).toThrow(/Expected \"/);
  });

  it('should pass for positive string length bounds', () => {
    const cto = loadCTO('semantic/specifications/scalars/models/STRING_VALIDATOR_002/string_validator_002_positive_bounds.cto');
    const modelManager = new ModelManager();
    expect(() => modelManager.addCTOModel(cto, 'string_validator_002_positive_bounds.cto', true)).not.toThrow();
  });

  it('should throw for negative bounds in string length', () => {
    const cto = loadCTO('semantic/specifications/scalars/models/STRING_VALIDATOR_002/string_validator_002_negative_bounds.cto');
    const modelManager = new ModelManager();
    expect(() => modelManager.addCTOModel(cto, 'string_validator_002_negative_bounds.cto', true)).toThrow(/minLength and-or maxLength must be positive integers/);
  });

  it('should pass when lower < upper in string length', () => {
    const cto = loadCTO('semantic/specifications/scalars/models/STRING_VALIDATOR_003/string_validator_003_valid_order.cto');
    const modelManager = new ModelManager();
    expect(() => modelManager.addCTOModel(cto, 'string_validator_003_valid_order.cto', true)).not.toThrow();
  });

  it('should throw when lower > upper in string length', () => {
    const cto = loadCTO('semantic/specifications/scalars/models/STRING_VALIDATOR_003/string_validator_003_lower_greater_than_upper.cto');
    const modelManager = new ModelManager();
    expect(() => modelManager.addCTOModel(cto, 'string_validator_003_lower_greater_than_upper.cto', true)).toThrow(/minLength must be less than or equal to maxLength/);
  });

  it('should throw for invalid regex', () => {
    const cto = loadCTO('semantic/specifications/scalars/models/STRING_VALIDATOR_004/string_validator_004_invalid_regex.cto');
    const modelManager = new ModelManager();
    expect(() => modelManager.addCTOModel(cto, 'string_validator_004_invalid_regex.cto', true)).toThrow(/Expected comment/);
  });

  it('should pass for valid regex pattern', () => {
    const cto = loadCTO('semantic/specifications/scalars/models/STRING_VALIDATOR_004/string_validator_004_valid_regex.cto');
    const modelManager = new ModelManager();
    expect(() => modelManager.addCTOModel(cto, 'string_validator_004_valid_regex.cto', true)).not.toThrow();
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ModelManager } from '@accordproject/concerto-core';

const loadCTO = (relativePath) => {
  return fs.readFileSync(path.resolve(relativePath), 'utf8');
};

describe('Semantic Validation - MAP_KEY_TYPE_001 - key type validity', () => {
  it('should pass for valid map key types', () => {
    const cto = loadCTO('semantic/specifications/maps/models/MAP_KEY_TYPE_001/map_key_type_001_valid_key_type.cto');
    const modelManager = new ModelManager({ enableMapType: true });
    modelManager.addCTOModel(cto, 'map_key_type_001_valid_key_type.cto', true);
    expect(() => modelManager.validateModelFiles()).not.toThrow();
  });

  it('should throw error for invalid map key type', () => {
    const cto = loadCTO('semantic/specifications/maps/models/MAP_KEY_TYPE_001/map_key_type_001_invalid_key_type.cto');
    const modelManager = new ModelManager({ enableMapType: true });
    
    expect(() => modelManager.addCTOModel(cto, 'map_key_type_001_invalid_key_type.cto', true)).toThrow(/Expected \"DateTime\", \"String\"/);
  });
});

describe('Semantic Validation - MAP_VALUE_TYPE_001 - value type validity', () => {
  it('should pass for existing value type in map', () => {
    const cto = loadCTO('semantic/specifications/maps/models/MAP_VALUE_TYPE_001/map_value_type_001_existing_value_type.cto');
    const modelManager = new ModelManager({ enableMapType: true });
    modelManager.addCTOModel(cto, 'map_value_type_001_existing_value_type.cto', true);
    expect(() => modelManager.validateModelFiles()).not.toThrow();
  });

  it('should throw error if map value type does not exist', () => {
    const cto = loadCTO('semantic/specifications/maps/models/MAP_VALUE_TYPE_001/map_value_type_001_type_not_exist.cto');
    const modelManager = new ModelManager({ enableMapType: true });
    modelManager.addCTOModel(cto, 'map_value_type_001_type_not_exist.cto', true);
    expect(() => modelManager.validateModelFiles()).toThrow(/Cannot read properties of null/);
  });
});

describe('Semantic Validation - DECLARATION_001 - duplicate map names', () => {
  it('should pass for uniquely named maps', () => {
    const cto = loadCTO('semantic/specifications/maps/models/DECLARATION_001/declaration_001_unique_map_name.cto');
    const modelManager = new ModelManager({ enableMapType: true });
    modelManager.addCTOModel(cto, 'declaration_001_unique_map_names.cto', true);
    expect(() => modelManager.validateModelFiles()).not.toThrow();
  });

  it('should throw error for duplicate map declarations', () => {
    const cto = loadCTO('semantic/specifications/maps/models/DECLARATION_001/declaration_001_duplicate_map_name.cto');
    const modelManager = new ModelManager({ enableMapType: true });
    modelManager.addCTOModel(cto, 'declaration_001_duplicate_map_name.cto', true);
    expect(() => modelManager.validateModelFiles()).toThrow(/Duplicate class name/);
  });
});

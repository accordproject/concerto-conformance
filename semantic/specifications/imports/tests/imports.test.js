import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ModelManager } from '@accordproject/concerto-core';

const loadCTO = (relativePath) => {
  return fs.readFileSync(path.resolve(relativePath), 'utf8');
};

describe('Semantic Validation - DECLARATION_002 - import conflict and uniqueness checks', () => {
  it('should pass when local and imported imports have unique names', () => {
    const imported = loadCTO('semantic/specifications/imports/models/DECLARATION_002/importedTypes.cto');
    const local = loadCTO('semantic/specifications/imports/models/DECLARATION_002/declaration_002_unique_with_imported_type.cto');
    const modelManager = new ModelManager();
    modelManager.addCTOModel(imported, 'importedTypes.cto', true);
    modelManager.addCTOModel(local, 'declaration_002_unique_with_imported_types.cto', true);
    expect(() => modelManager.validateModelFiles()).not.toThrow();
  });

  it('should throw error for name conflict with imported type', () => {
    const imported = loadCTO('semantic/specifications/imports/models/DECLARATION_002/importedTypes.cto');
    const conflict = loadCTO('semantic/specifications/imports/models/DECLARATION_002/declaration_002_conflict_with_imported_type.cto');
    const modelManager = new ModelManager();
    modelManager.addCTOModel(imported, 'importedTypes.cto', true);
    modelManager.addCTOModel(conflict, 'declaration_002_conflict_with_imported_type.cto', true);
    expect(() => {
      modelManager.validateModelFiles()
    }).toThrow(/already defined in an imported model/);
  });
});
describe('Semantic Validation - MODEL_FILE_001 - referencing existing imported type',() => {
  it('should pass for valid import and use of existing type', () => {
    const imported = loadCTO('semantic/specifications/imports/models/DECLARATION_002/importedTypes.cto');
    const local = loadCTO('semantic/specifications/imports/models/MODEL_FILE_001/model_file_001_existing_import_type.cto');
    const modelManager = new ModelManager();
    modelManager.addCTOModel(imported, 'importedTypes.cto', true);
    modelManager.addCTOModel(local, 'model_file_001_existing_import_type.cto', true);
    expect(() => modelManager.validateModelFiles()).not.toThrow();
  });

  it('should throw error when importing nonexistent type', () => {
    const cto = loadCTO('semantic/specifications/imports/models/MODEL_FILE_001/model_file_001_import_nonexistent_type.cto');
    const modelManager = new ModelManager();
    modelManager.addCTOModel(cto, 'model_file_001_import_nonexistent_type.cto', true);
    expect(() => modelManager.validateModelFiles()).toThrow(/Namespace is not defined/);
  });
});

describe('Semantic Validation - MODEL_FILE_002 - duplicate namespace imports', () => {
  it('should pass for unique namespace imports', () => {
    const cto = loadCTO('semantic/specifications/imports/models/MODEL_FILE_002/model_file_002_unique_namespace_imports.cto');
    const imported = loadCTO('semantic/specifications/imports/models/DECLARATION_002/importedTypes.cto');
    const imported2 = loadCTO('semantic/specifications/imports/models/DECLARATION_002/importedTypes2.cto');
    const modelManager = new ModelManager();
    modelManager.addCTOModel(imported, 'importedTypes.cto', true);
    modelManager.addCTOModel(imported2, 'importedTypes2.cto', true);
    modelManager.addCTOModel(cto, 'model_file_002_unique_namespace_imports.cto', true);
    expect(() => modelManager.validateModelFiles()).not.toThrow();
  });

  it('should throw error for duplicate imports from same namespace', () => {
    const cto = loadCTO('semantic/specifications/imports/models/MODEL_FILE_002/model_file_002_duplicate_namespace_imports.cto');
    const modelManager = new ModelManager();
    const imported = loadCTO('semantic/specifications/imports/models/DECLARATION_002/importedTypes.cto');
    modelManager.addCTOModel(imported, 'importedTypes.cto', true);
    modelManager.addCTOModel(cto, 'model_file_002_duplicate_namespace_imports.cto', true);
    expect(() => modelManager.validateModelFiles()).toThrow(/Import from namespace .* already exists/);
  });

});

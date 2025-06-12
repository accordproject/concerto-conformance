import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ModelManager } from '@accordproject/concerto-core';

const loadCTO = (relativePath) => {
  return fs.readFileSync(path.resolve(relativePath), 'utf8');
};

describe('Semantic Validation - MODEL_FILE_002 - duplicate namespace imports', () => {
  it('should throw error for duplicate namespace imports', () => {
    const cto = loadCTO('semantic/specifications/namespaces/models/MODEL_FILE_002/model_file_002_duplicate_namespace_imports.cto');
    const imported = loadCTO('semantic/specifications/namespaces/models/MODEL_FILE_002/importedTypes.cto');
    const modelManager = new ModelManager();
    modelManager.addCTOModel(imported, 'importedTypes.cto', true);
    modelManager.addCTOModel(cto, 'model_file_002_duplicate_namespace_imports.cto', true);
    expect(() => modelManager.validateModelFiles()).toThrow(/Namespace org\.external\.types is already defined/);
  });

  it('should pass for unique namespace imports', () => {
    const imported = loadCTO('semantic/specifications/namespaces/models/MODEL_FILE_002/importedTypes.cto');
    const cto = loadCTO('semantic/specifications/namespaces/models/MODEL_FILE_002/model_file_002_unique_namespace_imports.cto');
    const modelManager = new ModelManager();
    modelManager.addCTOModel(imported, 'importedTypes.cto', true);
    modelManager.addCTOModel(cto, 'model_file_002_unique_namespace_imports.cto', true);
    expect(() => modelManager.validateModelFiles()).not.toThrow();
  });
});

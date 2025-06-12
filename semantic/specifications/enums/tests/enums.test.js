import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ModelManager } from '@accordproject/concerto-core';

const loadCTO = (relativePath) => {
    return fs.readFileSync(path.resolve(relativePath), 'utf8');
};

describe('Semantic Validation - DECLARATION_001 - duplicate enum names', () => {
    it('should throw semantic error for duplicate enum names in the same file', () => {
        const cto = loadCTO('semantic/specifications/enums/models/DECLARATION_001/declaration_001_duplicate_enum_names.cto');
        const modelManager = new ModelManager();
        modelManager.addCTOModel(cto, 'declaration_001_duplicate_enum_names.cto', true);
        expect(() =>
            modelManager.validateModelFiles()
        ).toThrow(/Duplicate/);
    });
    
    it('should pass for uniquely named enums in the same file', () => {
        const cto = loadCTO('semantic/specifications/enums/models/DECLARATION_001/declaration_001_unique_enum_names.cto');
        const modelManager = new ModelManager();
        modelManager.addCTOModel(cto, 'declaration_001_unique_enum_names.cto', true);
        expect(() =>
            modelManager.validateModelFiles()
        ).not.toThrow();
    });
});

describe('Semantic Validation - DECLARATION_002 - name conflict with import', () => {
    it('should pass when local enum does not conflict with import', () => {
        const imported = loadCTO('semantic/specifications/enums/models/DECLARATION_002/importedTypes.cto');
        const local = loadCTO('semantic/specifications/enums/models/DECLARATION_002/declaration_002_non_conflicting_name.cto');
        const modelManager = new ModelManager();
        modelManager.addCTOModel(imported, 'importedTypes.cto', true);
        modelManager.addCTOModel(local, 'declaration_002_non_conflicting_name.cto', true);
        expect(() => modelManager.validateModelFiles()).not.toThrow();
    });

    it('should throw error for name conflict with imported enum', () => {
        const imported = loadCTO('semantic/specifications/enums/models/DECLARATION_002/importedTypes.cto');
        const conflict = loadCTO('semantic/specifications/enums/models/DECLARATION_002/declaration_002_name_conflict_with_import.cto');
        const modelManager = new ModelManager();
        modelManager.addCTOModel(imported, 'importedTypes.cto', true);
        modelManager.addCTOModel(conflict, 'declaration_002_name_conflict_with_import.cto', true);
        expect(() => modelManager.validateModelFiles()).toThrow(/already defined in an imported model/);
    });
});

describe('Semantic Validation - MODEL_ELEMENT_002 - valid enum identifier name', () => {
    it('should pass for valid enum identifier name', () => {
        const cto = loadCTO('semantic/specifications/enums/models/MODEL_ELEMENT_002/model_element_002_valid_enum_name.cto');
        const modelManager = new ModelManager();
        modelManager.addCTOModel(cto, 'model_element_002_valid_enum_name.cto', true);
        expect(() => modelManager.validateModelFiles()).not.toThrow();
    });

    it('should throw error for invalid enum name identifier', () => {
        const cto = loadCTO('semantic/specifications/enums/models/MODEL_ELEMENT_002/model_element_002_invalid_enum_name.cto');
        const modelManager = new ModelManager();
        expect(() => modelManager.addCTOModel(cto, 'model_element_002_invalid_enum_name.cto', true)).toThrow(/Expected/);
    });
});

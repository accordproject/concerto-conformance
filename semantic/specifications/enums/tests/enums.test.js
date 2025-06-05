import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ModelManager } from '@accordproject/concerto-core';

const loadCTO = (relativePath) => {
    return fs.readFileSync(path.resolve(relativePath), 'utf8');
};

describe('Semantic Validation - DECLARATION_001 - duplicate enum names', () => {
    it('should throw semantic error for duplicate enum names in the same file', () => {
        const cto = loadCTO('models/invalid/declaration_001_duplicate_enum_names.cto');
        const modelManager = new ModelManager();
        modelManager.addCTOModel(cto, 'declaration_001_duplicate_enum_names.cto', true);
        expect(() =>
            modelManager.validateModelFiles()
        ).toThrow(/Duplicate/);
    });

    it('should pass for uniquely named enums in the same file', () => {
        const cto = loadCTO('models/valid/declaration_001_unique_enum_names.cto');
        const modelManager = new ModelManager();
        modelManager.addCTOModel(cto, 'declaration_001_unique_enum_names.cto', true);

        expect(() =>
            modelManager.validateModelFiles()
        ).not.toThrow();
    });
});

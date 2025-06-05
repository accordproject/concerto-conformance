import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ModelManager } from '@accordproject/concerto-core';

const loadCTO = (relativePath) => {
    return fs.readFileSync(path.resolve(relativePath), 'utf8');
};

describe('Semantic Validation - CLASS_DECLARATION_001 - system property name', () => {
    it('should throw semantic error for property name using system-reserved name', () => {
        const cto = loadCTO('semantic/specifications/concepts/models/CLASS_DECLARATION_001/class_declaration_001_system_property_name.cto');
        const modelManager = new ModelManager();
        expect(() =>
            modelManager.addCTOModel(cto, 'class_declaration_001_system_property_name.cto', true)
        ).toThrow(/Invalid field name '\$class'/);
    });

    it('should pass for valid property names not using system-reserved names', () => {
        const cto = loadCTO('semantic/specifications/concepts/models/CLASS_DECLARATION_001/class_declaration_001_valid_property_name.cto');
        const modelManager = new ModelManager();
        expect(() =>
            modelManager.addCTOModel(cto, 'class_declaration_001_valid_property_name.cto', true)
        ).not.toThrow();
    });
});

describe('Semantic Validation - CLASS_DECLARATION_002 - invalid $class type', () => {
    it('should throw semantic error for $class property with invalid type', () => {
        const cto = loadCTO('semantic/specifications/concepts/models/CLASS_DECLARATION_002/class_declaration_002_invalid_$class_type.cto');
        const modelManager = new ModelManager();
        expect(() =>
            modelManager.addCTOModel(cto, 'class_declaration_002_invalid_$class_type.cto', true)
        ).toThrow(/Invalid field name '\$class'/);
    });

    it('should pass for valid models without $class declared explicitly', () => {
        const cto = loadCTO('semantic/specifications/concepts/models/CLASS_DECLARATION_002/class_declaration_002_valid_$class_type.cto');
        const modelManager = new ModelManager();
        expect(() =>
            modelManager.addCTOModel(cto, 'class_declaration_002_valid_$class_type.cto', true)
        ).not.toThrow();
    });
});

describe('Semantic Validation - CLASS_DECLARATION_003 - duplicate class names', () => {
    it('should throw semantic error for duplicate concept declarations in the same file', () => {
        const cto = loadCTO('semantic/specifications/concepts/models/CLASS_DECLARATION_003/class_declaration_003_duplicate_class_name.cto');
        const modelManager = new ModelManager();
        modelManager.addCTOModel(cto, 'class_declaration_003_duplicate_class_name.cto', true)
        expect(() =>
            modelManager.validateModelFiles()
        ).toThrow(/Duplicate class name/);
    });

    it('should pass for uniquely named concept declarations', () => {
        const cto = loadCTO('semantic/specifications/concepts/models/CLASS_DECLARATION_003/class_declaration_003_unique_class_name.cto');
        const modelManager = new ModelManager();
        modelManager.addCTOModel(cto, 'class_declaration_003_unique_class_name.cto', true)
        expect(() =>
            modelManager.validateModelFiles()
        ).not.toThrow();
    });
});

describe('Semantic Validation - CLASS_DECLARATION_004 - super type existence', () => {
    it('should throw semantic error when the super type does not exist', () => {
        const cto = loadCTO('semantic/specifications/concepts/models/CLASS_DECLARATION_004/class_declaration_004_supertype_not_exist.cto');
        const modelManager = new ModelManager();
        modelManager.addCTOModel(cto, 'class_declaration_004_supertype_not_exist.cto', true);
        expect(() =>
            modelManager.validateModelFiles()
        ).toThrow(/Could not find super type/);
    });

    it('should pass when the super type is correctly declared', () => {
        const cto = loadCTO('semantic/specifications/concepts/models/CLASS_DECLARATION_004/class_declaration_004_supertype_exist.cto');
        const modelManager = new ModelManager();
        modelManager.addCTOModel(cto, 'class_declaration_004_supertype_exist.cto', true);
        expect(() =>
            modelManager.validateModelFiles()
        ).not.toThrow();
    });
});

describe('Semantic Validation - CLASS_DECLARATION_005 - identifying field must be a String or String scalar', () => {
    it('should throw semantic error when identifier field is not of type String or String scalar', () => {
        const cto = loadCTO('semantic/specifications/concepts/models/CLASS_DECLARATION_005/class_declaration_005_invalid_identifier_type.cto');
        const modelManager = new ModelManager();
        modelManager.addCTOModel(cto, 'class_declaration_005_invalid_identifier_type.cto', true);
        expect(() =>
            modelManager.validateModelFiles()
        ).toThrow(/Class "Entity" is identified by field "id", but the type of the field is not "String"/);
    });

    it('should pass when identifier is of type String', () => {
        const cto = loadCTO('semantic/specifications/concepts/models/CLASS_DECLARATION_005/class_declaration_005_valid_identifier_type_string.cto');
        const modelManager = new ModelManager();
        modelManager.addCTOModel(cto, 'class_declaration_005_valid_identifier_type_string.cto', true);
        expect(() =>
            modelManager.validateModelFiles()
        ).not.toThrow();
    });

    it('should pass when identifier is a String-based scalar', () => {
        const cto = loadCTO('semantic/specifications/concepts/models/CLASS_DECLARATION_005/class_declaration_005_valid_identifier_type_scalar.cto');
        const modelManager = new ModelManager();
        modelManager.addCTOModel(cto, 'class_declaration_005_valid_identifier_type_scalar.cto', true);
        expect(() =>
            modelManager.validateModelFiles()
        ).not.toThrow();
    });
});

describe('Semantic Validation - CLASS_DECLARATION_006 - identifying fields cannot be optional', () => {
    it('should throw semantic error when identifier is optional', () => {
        const cto = loadCTO('semantic/specifications/concepts/models/CLASS_DECLARATION_006/class_declaration_006_optional_identifier.cto');
        const modelManager = new ModelManager();
        modelManager.addCTOModel(cto, 'class_declaration_006_optional_identifier.cto', true);
        expect(() =>
            modelManager.validateModelFiles()
        ).toThrow(/Identifying fields cannot be optional/);
    });

    it('should pass when identifier is required', () => {
        const cto = loadCTO('semantic/specifications/concepts/models/CLASS_DECLARATION_006/class_declaration_006_required_identifier.cto');
        const modelManager = new ModelManager();
        modelManager.addCTOModel(cto, 'class_declaration_006_required_identifier.cto', true);
        expect(() =>
            modelManager.validateModelFiles()
        ).not.toThrow();
    });
});

describe('Semantic Validation - CLASS_DECLARATION_007 - supertype must also be system identified', () => {
    it('should throw semantic error when supertype is not system identified', () => {
        const cto = loadCTO('semantic/specifications/concepts/models/CLASS_DECLARATION_007/class_declaration_007_supertype_not_system_identified.cto');
        const modelManager = new ModelManager();
        expect(() =>
            modelManager.addCTOModel(cto, 'class_declaration_007_supertype_not_system_identified.cto', true)
        ).toThrow(/Expected "\{", comment, end of line, or whitespace but "i" found/);
    });

    it('should pass when both declaration and supertype are system identified', () => {
        const cto = loadCTO('semantic/specifications/concepts/models/CLASS_DECLARATION_007/class_declaration_007_supertype_system_identified.cto');
        const modelManager = new ModelManager();
        modelManager.addCTOModel(cto, 'class_declaration_007_supertype_system_identified.cto', true);
        expect(() =>
            modelManager.validateModelFiles()
        ).not.toThrow();
    });
});

describe('Semantic Validation - CLASS_DECLARATION_008 - property must not duplicate super type', () => {
    it('should throw semantic error when a property is duplicated from supertype', () => {
        const cto = loadCTO('semantic/specifications/concepts/models/CLASS_DECLARATION_008/class_declaration_008_duplicate_property_from_super.cto');
        const modelManager = new ModelManager();
        modelManager.addCTOModel(cto, 'class_declaration_008_duplicate_property_from_super.cto', true);
        expect(() =>
            modelManager.validateModelFiles()
        ).toThrow(/Class .* has more than one field named .*/);
    });

    it('should pass when property names are unique across inheritance hierarchy', () => {
        const cto = loadCTO('semantic/specifications/concepts/models/CLASS_DECLARATION_008/class_declaration_008_unique_property_from_super.cto');
        const modelManager = new ModelManager();
        modelManager.addCTOModel(cto, 'class_declaration_008_unique_property_from_super.cto', true);
        expect(() =>
            modelManager.validateModelFiles()
        ).not.toThrow();
    });
});
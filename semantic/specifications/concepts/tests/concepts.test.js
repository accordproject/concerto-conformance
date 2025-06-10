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

 describe('DECLARATION_001 - Unique Declarations', () => {
  it('should throw semantic error when duplicate declarations exist', () => {
    const cto = loadCTO('semantic/specifications/concepts/models/DECLARATION_001/declaration_001_duplicate_within_model.cto');
    const modelManager = new ModelManager();
    modelManager.addCTOModel(cto, 'declaration_001_unique_declarations_invalid.cto', true);
    expect(() =>
      modelManager.validateModelFiles()
    ).toThrow(/Class ".*" has more than one field named ".*"\./);
  });

   it('should pass when all declarations are unique', () => {
    const cto = loadCTO('semantic/specifications/concepts/models/DECLARATION_001/declaration_001_unique_within_model.cto');
    const modelManager = new ModelManager();
    modelManager.addCTOModel(cto, 'declaration_001_unique_declarations_valid.cto', true);
    expect(() =>
      modelManager.validateModelFiles()
    ).not.toThrow();
  });
});

 describe('MODEL_ELEMENT_002 - Valid Identifier Name', () => {
  it('should throw semantic error on invalid identifier names', () => {
    const cto = loadCTO('semantic/specifications/concepts/models/MODEL_ELEMENT_002/model_element_002_invalid_identifier_name.cto');
    const modelManager = new ModelManager();
    expect(() =>
        modelManager.addCTOModel(cto, 'model_element_002_invalid_identifier_name.cto', true)
    ).toThrow();
  });

   it('should pass for valid identifier names', () => {
    const cto = loadCTO('semantic/specifications/concepts/models/MODEL_ELEMENT_002/model_element_002_valid_identifier_name.cto');
    const modelManager = new ModelManager();
    modelManager.addCTOModel(cto, 'model_element_002_valid_identifier_name.cto', true);
    expect(() =>
      modelManager.validateModelFiles()
    ).not.toThrow();
  });
});

 describe('RELATIONSHIP_001 - Relationship to Non-Primitive Type', () => {
  it('should throw semantic error when relationship is to a primitive type', () => {
    const cto = loadCTO('semantic/specifications/concepts/models/RELATIONSHIP_001/relationship_001_non-primitive_type_relationship.cto');
    const modelManager = new ModelManager();
    modelManager.addCTOModel(cto, 'relationship_001_non_primitive_type_invalid.cto', true);
    expect(() =>
      modelManager.validateModelFiles()
    ).toThrow(/Relationship .* cannot be to the primitive type .*/);
  });

   it('should pass when relationship is to a non-primitive type', () => {
    const cto = loadCTO('semantic/specifications/concepts/models/RELATIONSHIP_001/relationship_001_primitive_type_relationship.cto');
    const modelManager = new ModelManager();
    modelManager.addCTOModel(cto, 'relationship_001_non_primitive_type.cto', true);
    expect(() =>
      modelManager.validateModelFiles()
    ).not.toThrow();
  });
});

 describe('RELATIONSHIP_002 - Relationship Type Must Exist', () => {
  it('should throw semantic error if relationship type does not exist', () => {
    const cto = loadCTO('semantic/specifications/concepts/models/RELATIONSHIP_002/relationship_002_type_not_exist.cto');
    const modelManager = new ModelManager();
    modelManager.addCTOModel(cto, 'relationship_002_existing_type_invalid.cto', true);
    expect(() =>
      modelManager.validateModelFiles()
    ).toThrow(/Undeclared type .*/);
  });

   it('should pass when relationship type exists', () => {
    const cto = loadCTO('semantic/specifications/concepts/models/RELATIONSHIP_002/relationship_002_existing_type.cto');
    const modelManager = new ModelManager();
    modelManager.addCTOModel(cto, 'relationship_002_existing_type.cto', true);
    expect(() =>
      modelManager.validateModelFiles()
    ).not.toThrow();
  });
});

 describe('RELATIONSHIP_003 - Relationship Must Be to Identified Type', () => {
  it('should throw semantic error when relationship target is not identified', () => {
    const cto = loadCTO('semantic/specifications/concepts/models/RELATIONSHIP_003/relationship_003_not_identified_type.cto');
    const modelManager = new ModelManager();
    modelManager.addCTOModel(cto, 'relationship_003_identified_type_invalid.cto', true);
    expect(() =>
      modelManager.validateModelFiles()
    ).toThrow(/Relationship .* must be to a class that has an identifier, but this is to .*/);
  });

   it('should pass when relationship target is identified', () => {
    const cto = loadCTO('semantic/specifications/concepts/models/RELATIONSHIP_003/relationship_003_identified_type.cto');
    const modelManager = new ModelManager();
    modelManager.addCTOModel(cto, 'relationship_003_identified_type.cto', true);
    expect(() =>
      modelManager.validateModelFiles()
    ).not.toThrow();
  });
});

 describe('PROPERTY_002 - Non-Primitive Property Type Must Exist', () => {
  it('should throw semantic error if non-primitive property type does not exist', () => {
    const cto = loadCTO('semantic/specifications/concepts/models/PROPERTY_002/property_002_type_does_not_exist.cto');
    const modelManager = new ModelManager();
    modelManager.addCTOModel(cto, 'property_002_existing_type_invalid.cto', true);
    expect(() =>
      modelManager.validateModelFiles()
    ).toThrow(/Undeclared type ".*"/);
  });

   it('should pass when non-primitive property type exists', () => {
    const cto = loadCTO('semantic/specifications/concepts/models/PROPERTY_002/property_002_type_exist.cto');
    const modelManager = new ModelManager();
    modelManager.addCTOModel(cto, 'property_002_existing_type.cto', true);
    expect(() =>
      modelManager.validateModelFiles()
    ).not.toThrow();
  });
});

 describe('PROPERTY_003 - Property Meta Type Must Exist', () => {
  it('should throw semantic error for invalid property meta types', () => {
    const cto = loadCTO('semantic/specifications/concepts/models/PROPERTY_003/property_003_meta_type_invalid.cto');
    const modelManager = new ModelManager();
    expect(() =>
      modelManager.addCTOModel(cto, 'property_003_invalid_meta_type.cto', true)
    ).toThrow();
  });

   it('should pass for valid property meta types', () => {
    const cto = loadCTO('semantic/specifications/concepts/models/PROPERTY_003/property_003_meta_type_valid.cto');
    const modelManager = new ModelManager();
    modelManager.addCTOModel(cto, 'property_003_valid_meta_type.cto', true);
    expect(() =>
      modelManager.validateModelFiles()
    ).not.toThrow();
  });
});

 describe('DECORATED_001 - Decorator Not Applied More Than Once', () => {
  it('should throw semantic error when decorator applied multiple times', () => {
    const cto = loadCTO('semantic/specifications/concepts/models/DECORATED_001/decorated_001_duplicate_decorator.cto');
    const modelManager = new ModelManager();
    modelManager.addCTOModel(cto, 'decorated_001_multiple_decorator_invalid.cto', true);
    expect(() =>
      modelManager.validateModelFiles()
    ).toThrow(/Duplicate decorator .*/);
  });

   it('should pass when decorator applied once', () => {
    const cto = loadCTO('semantic/specifications/concepts/models/DECORATED_001/decorated_001_unique_decorator.cto');
    const modelManager = new ModelManager();
    modelManager.addCTOModel(cto, 'decorated_001_single_decorator.cto', true);
    expect(() =>
      modelManager.validateModelFiles()
    ).not.toThrow();
  });
});
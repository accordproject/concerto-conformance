import { Parser } from '@accordproject/concerto-cto';
import { ModelFile, ModelManager } from '@accordproject/concerto-core';

export default {
  parser: Parser,
  modelFile: ModelFile,
  modelManager: new ModelManager({ enableMapType: true }),
};

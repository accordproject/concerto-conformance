import * as dotenv from 'dotenv';
dotenv.config();

export async function loadDependencies() {
  const parserPath = process.env.PARSER_PATH || '@accordproject/concerto-cto';
  const modelFilePath = process.env.MODELFILE_PATH || '@accordproject/concerto-core';
  const modelManagerPath = process.env.MODELMANAGER_PATH || '@accordproject/concerto-core';

  try {
    const parserModule = await import(parserPath);
    const modelFileModule = await import(modelFilePath);
    const modelManagerModule = await import(modelManagerPath);

    if (!parserModule.Parser || !modelFileModule.ModelFile || !modelManagerModule.ModelManager) {
      throw new Error('Failed to load Parser, ModelFile, or ModelManager. Check paths or exports.');
    }

    return {
      Parser: parserModule.Parser,
      ModelFile: modelFileModule.ModelFile,
      ModelManager: modelManagerModule.ModelManager
    };
  } catch (err) {
    console.error('Failed to dynamically load dependencies:', err);
    process.exit(1);
  }
}

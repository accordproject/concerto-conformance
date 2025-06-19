import fs from 'fs';
import path from 'path';

export const loadCTO = (relativePath: string): string => {
  const basePath = path.resolve('semantic/specifications/');
  return fs.readFileSync(path.join(basePath, relativePath), 'utf8');
};

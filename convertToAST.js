import fs from 'fs';
import path from 'path';
import { Parser } from '@accordproject/concerto-cto';

const BASE_DIR = path.resolve('semantic/specifications');

function getAllCTOFiles(dir) {
  let files = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAllCTOFiles(fullPath));
    } else if (entry.isFile() && fullPath.endsWith('.cto')) {
      files.push(fullPath);
    }
  }

  return files;
}

function convertAndWriteAST(ctoPath) {
  try {
    const modelContent = fs.readFileSync(ctoPath, 'utf8');
    const ast = Parser.parse(modelContent, ctoPath);

    const outFileName = path.basename(ctoPath).replace('.cto', '.json');
    const outDir = path.dirname(ctoPath); // same directory as .cto
    const outFilePath = path.join(outDir, outFileName);

    fs.writeFileSync(outFilePath, JSON.stringify(ast, null, 2), 'utf8');
    console.log(`✅ Converted: ${ctoPath} → ${outFilePath}`);
  } catch (error) {
    console.error(`❌ Failed to convert: ${ctoPath}`);
    console.error(error.message);
  }
}

function run() {
  const allCTOs = getAllCTOFiles(BASE_DIR);
  allCTOs.forEach(convertAndWriteAST);
}

run();

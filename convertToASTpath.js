// parseCtoToAst.js
import fs from 'fs';
import path from 'path';
import { Parser } from '@accordproject/concerto-cto';

function convertCTOToAST(ctoPath) {
  try {
    const absolutePath = path.resolve(ctoPath);
    const dir = path.dirname(absolutePath);
    const baseName = path.basename(absolutePath, '.cto');
    const outFilePath = path.join(dir, `${baseName}.json`);

    const modelContent = fs.readFileSync(absolutePath, 'utf8');
    const ast = Parser.parse(modelContent, absolutePath);

    fs.writeFileSync(outFilePath, JSON.stringify(ast, null, 2), 'utf8');
    console.log(`✅ AST written to: ${outFilePath}`);
  } catch (err) {
    console.error(`❌ Failed to parse: ${ctoPath}`);
    console.error(`Error: ${err.message}`);
  }
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('❗ Usage: node parseCtoToAst.js <path/to/file.cto>');
  process.exit(1);
}

convertCTOToAST(inputPath);

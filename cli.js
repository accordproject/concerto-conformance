import inquirer from 'inquirer';
import fs from 'fs';
import { execSync } from 'child_process';

const defaults = {
  ModelManager: '@accordproject/concerto-core',
  Parser: '@accordproject/concerto-cto',
  ModelFile: '@accordproject/concerto-core'
};

async function run() {
  const { language } = await inquirer.prompt({
    type: 'list',
    name: 'language',
    message: 'Choose language:',
    choices: ['Javascript', 'C#']
  });

  const imports = {};

  for (const comp of Object.keys(defaults)) {
    const { include } = await inquirer.prompt({
      type: 'confirm',
      name: 'include',
      message: `Do you want to test your own ${comp}?`
    });

    if (include) {
      const { path: userPath } = await inquirer.prompt({
        type: 'input',
        name: 'path',
        message: `Enter import path for ${comp} (default: ${defaults[comp]}):`
      });

      const finalPath = userPath.trim() || defaults[comp];
      imports[comp] = `import { ${comp} } from '${finalPath}';`;

    } else {
      imports[comp] = `import { ${comp} } from '${defaults[comp]}';`;
    }
  }

  const templatePath = `semantic/features/support/templates/${language}`;
  const outputPath = `semantic/features/support/${language}`;

  const worldTemplate = fs.readFileSync(`${templatePath}/world.template.ts`, 'utf-8');
  const worldOutput = worldTemplate.replace('{{MODELMANAGER_IMPORT}}', imports.ModelManager);
  fs.writeFileSync(`${outputPath}/world.ts`, worldOutput);

  const stepsTemplate = fs.readFileSync(`${templatePath}/steps.template.ts`, 'utf-8');
  const stepsOutput = stepsTemplate
    .replace('{{PARSER_IMPORT}}', imports.Parser)
    .replace('{{MODELFILE_IMPORT}}', imports.ModelFile);
  fs.writeFileSync(`${outputPath}/steps.ts`, stepsOutput);

  console.log("Setup ready. Running tests...");

  if (language === 'Javascript') {
    execSync('npm test', { stdio: 'inherit' });
  } else {
    execSync('npm run test:csharp', { stdio: 'inherit' });
  }
}

run();

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const nodeModulesDir = path.join(projectRoot, 'node_modules');

const requiredModules = ['zod'];

const missingModules = requiredModules.filter((moduleName) => {
  const modulePath = path.join(nodeModulesDir, moduleName);
  return !fs.existsSync(modulePath);
});

if (missingModules.length > 0) {
  const pluralSuffix = missingModules.length > 1 ? 'i' : 'o';
  console.error(
    `Errore di avvio: modul${pluralSuffix} mancanti (${missingModules.join(', ')}). ` +
      'Esegui "npm install" nella cartella rec2pdf-backend prima di lanciare il server.'
  );
  process.exit(1);
}

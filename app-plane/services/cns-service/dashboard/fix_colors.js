const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

const replacements = [
  // Numeric palette keys (invalid for semantic colors)
  [/error\.50/g, 'error.light'],
  [/warning\.50/g, 'warning.light'],
  [/info\.50/g, 'info.light'],
  [/success\.50/g, 'success.light'],
  [/primary\.50/g, 'primary.light'],
  [/secondary\.50/g, 'secondary.light'],
  [/error\.200/g, 'error.light'],
  [/warning\.200/g, 'warning.light'],
  [/success\.200/g, 'success.light'],
  [/primary\.200/g, 'primary.light'],
  [/secondary\.200/g, 'secondary.light'],
  [/error\.700/g, 'error.dark'],
  [/warning\.700/g, 'warning.dark'],
  [/success\.700/g, 'success.dark'],
  [/primary\.700/g, 'primary.dark'],
  [/secondary\.700/g, 'secondary.dark'],
  // .lighter and .darker (invalid - MUI only has light/dark)
  [/error\.lighter/g, 'error.light'],
  [/warning\.lighter/g, 'warning.light'],
  [/info\.lighter/g, 'info.light'],
  [/success\.lighter/g, 'success.light'],
  [/primary\.lighter/g, 'primary.light'],
  [/secondary\.lighter/g, 'secondary.light'],
  [/error\.darker/g, 'error.dark'],
  [/warning\.darker/g, 'warning.dark'],
  [/info\.darker/g, 'info.dark'],
  [/success\.darker/g, 'success.dark'],
  [/primary\.darker/g, 'primary.dark'],
  [/secondary\.darker/g, 'secondary.dark'],
];

function processFile(filePath) {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  for (const [pattern, replacement] of replacements) {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed:', filePath);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else {
      processFile(filePath);
    }
  }
}

walkDir(srcDir);
console.log('Done!');

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

// Fix patterns: attribute placed after > should be before >
const fixes = [
  // IconButton with aria-label after >
  {
    pattern: /<IconButton([^>]*?)>\s*aria-label=(\{[^}]+\})/g,
    replacement: '<IconButton$1 aria-label=$2>'
  },
  // Dialog with aria-labelledby after >
  {
    pattern: /<Dialog([^>]*?)>\s*aria-labelledby="([^"]+)"/g,
    replacement: '<Dialog$1 aria-labelledby="$2">'
  }
];

function processFile(filePath) {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  for (const fix of fixes) {
    if (fix.pattern.test(content)) {
      // Reset lastIndex for global regex
      fix.pattern.lastIndex = 0;
      content = content.replace(fix.pattern, fix.replacement);
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

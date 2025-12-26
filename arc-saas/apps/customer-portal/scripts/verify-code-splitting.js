#!/usr/bin/env node
/**
 * Verification script for code splitting implementation
 * Run after building to verify chunks are created correctly
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, '../dist/assets');

console.log('🔍 Verifying code splitting implementation...\n');

// Check if dist directory exists
if (!fs.existsSync(distDir)) {
  console.error('❌ dist/assets directory not found. Run `bun run build` first.');
  process.exit(1);
}

// Get all JS files
const files = fs.readdirSync(distDir).filter(f => f.endsWith('.js'));

// Expected chunk patterns
const expectedChunks = {
  'vendor-react': /vendor-react[.-][a-z0-9]+\.js$/,
  'vendor-refine': /vendor-refine[.-][a-z0-9]+\.js$/,
  'vendor-ui': /vendor-ui[.-][a-z0-9]+\.js$/,
  'vendor-icons': /vendor-icons[.-][a-z0-9]+\.js$/,
  'vendor-query': /vendor-query[.-][a-z0-9]+\.js$/,
  'feature-bom': /feature-bom[.-][a-z0-9]+\.js$/,
  'feature-components': /feature-components[.-][a-z0-9]+\.js$/,
};

// Verify chunks exist
console.log('📦 Checking for expected chunks:\n');
let allChunksFound = true;

for (const [name, pattern] of Object.entries(expectedChunks)) {
  const found = files.some(f => pattern.test(f));
  if (found) {
    const file = files.find(f => pattern.test(f));
    const size = fs.statSync(path.join(distDir, file)).size;
    const sizeKB = (size / 1024).toFixed(2);
    console.log(`  ✅ ${name.padEnd(20)} ${file} (${sizeKB} KB)`);
  } else {
    console.log(`  ❌ ${name.padEnd(20)} NOT FOUND`);
    allChunksFound = false;
  }
}

// Calculate total size
console.log('\n📊 Bundle statistics:\n');
const totalSize = files.reduce((sum, file) => {
  return sum + fs.statSync(path.join(distDir, file)).size;
}, 0);

const totalKB = (totalSize / 1024).toFixed(2);
const totalMB = (totalSize / (1024 * 1024)).toFixed(2);

console.log(`  Total JS size: ${totalKB} KB (${totalMB} MB)`);
console.log(`  Number of chunks: ${files.length}`);

// Find index chunk (main entry)
const indexChunk = files.find(f => f.startsWith('index-'));
if (indexChunk) {
  const indexSize = fs.statSync(path.join(distDir, indexChunk)).size;
  const indexKB = (indexSize / 1024).toFixed(2);
  console.log(`  Main bundle (index): ${indexKB} KB`);

  // Check if under 200KB target (we'll assume ~40% compression)
  const estimatedGzipped = indexSize * 0.4;
  const gzippedKB = (estimatedGzipped / 1024).toFixed(2);
  console.log(`  Estimated gzipped: ~${gzippedKB} KB`);

  if (estimatedGzipped < 200 * 1024) {
    console.log(`  ✅ Under 200KB gzipped target`);
  } else {
    console.log(`  ⚠️  May exceed 200KB gzipped target`);
  }
}

// List lazy route chunks
console.log('\n🚀 Lazy route chunks:\n');
const routeChunks = files.filter(f =>
  !f.startsWith('vendor-') &&
  !f.startsWith('feature-') &&
  !f.startsWith('index-') &&
  f.includes('-')
);

if (routeChunks.length > 0) {
  routeChunks.forEach(chunk => {
    const size = fs.statSync(path.join(distDir, chunk)).size;
    const sizeKB = (size / 1024).toFixed(2);
    console.log(`  📄 ${chunk.padEnd(40)} ${sizeKB} KB`);
  });
} else {
  console.log('  ℹ️  No additional route chunks found (may be bundled)');
}

// Summary
console.log('\n' + '='.repeat(60));
if (allChunksFound) {
  console.log('✅ All expected vendor chunks found!');
  console.log('✅ Code splitting is working correctly.');
} else {
  console.log('⚠️  Some expected chunks are missing.');
  console.log('   This may be normal if certain features are not used.');
}
console.log('='.repeat(60) + '\n');

console.log('💡 Next steps:');
console.log('   1. Open dist/stats.html to visualize bundle');
console.log('   2. Run app and check Network tab for lazy loading');
console.log('   3. Test chunk caching and error handling\n');

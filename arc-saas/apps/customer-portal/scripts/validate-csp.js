#!/usr/bin/env node

/**
 * CSP Implementation Validation Script
 * Checks that nonce-based CSP is correctly implemented
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let exitCode = 0;

function error(msg) {
  console.error(`❌ ${msg}`);
  exitCode = 1;
}

function success(msg) {
  console.log(`✅ ${msg}`);
}

function info(msg) {
  console.log(`ℹ️  ${msg}`);
}

console.log('🔒 Validating CSP Implementation...\n');

// 1. Check vite.config.ts has nonce plugin
info('Checking vite.config.ts...');
const viteConfig = fs.readFileSync(path.join(rootDir, 'vite.config.ts'), 'utf8');
if (viteConfig.includes('cspNoncePlugin')) {
  success('Vite CSP nonce plugin is defined');
} else {
  error('Vite CSP nonce plugin not found in vite.config.ts');
}

if (viteConfig.includes('cspNoncePlugin(),')) {
  success('CSP nonce plugin is registered in plugins array');
} else {
  error('CSP nonce plugin not registered in plugins array');
}

// 2. Check CSP config doesn't have unsafe-inline in script-src (except for dev mode)
info('\nChecking src/lib/security/csp.ts...');
const cspConfig = fs.readFileSync(path.join(rootDir, 'src/lib/security/csp.ts'), 'utf8');
if (cspConfig.includes("'unsafe-inline'") && cspConfig.includes('scriptSrc')) {
  // Check if unsafe-inline is only in styleSrc (Tailwind requirement)
  const scriptSrcMatch = cspConfig.match(/const scriptSrc = \[[\s\S]*?\];/);
  if (scriptSrcMatch && scriptSrcMatch[0].includes("'unsafe-inline'")) {
    error('script-src contains unsafe-inline (VULN-001 not fixed)');
  } else {
    success('script-src does not contain unsafe-inline');
  }
} else {
  success('script-src does not contain unsafe-inline');
}

if (cspConfig.includes('VULN-001 FIXED')) {
  success('VULN-001 fix documented in csp.ts');
} else {
  error('VULN-001 fix not documented in csp.ts');
}

// 3. Check main.tsx initializes CSP reporter
info('\nChecking src/main.tsx...');
const mainTsx = fs.readFileSync(path.join(rootDir, 'src/main.tsx'), 'utf8');
if (mainTsx.includes('setupCSPReporter')) {
  success('CSP reporter initialized in main.tsx (VULN-002 fixed)');
} else {
  error('CSP reporter not initialized in main.tsx (VULN-002)');
}

// 4. Check index.html doesn't have inline CSP meta tag
info('\nChecking index.html...');
const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
if (indexHtml.includes('http-equiv="Content-Security-Policy"')) {
  error('index.html still has CSP meta tag (VULN-003 not fixed)');
} else {
  success('index.html CSP meta tag removed (VULN-003 fixed)');
}

if (indexHtml.includes('{{CSP_NONCE}}') || indexHtml.includes('nonce=')) {
  info('Note: index.html scripts will receive nonce via Vite plugin');
} else {
  info('Note: Inline scripts in index.html will receive nonce at build time');
}

// 5. Check error-tracking.ts doesn't use Function constructor
info('\nChecking src/lib/error-tracking.ts...');
const errorTracking = fs.readFileSync(path.join(rootDir, 'src/lib/error-tracking.ts'), 'utf8');
// Check for actual usage (not in comments)
const errorTrackingLines = errorTracking.split('\n').filter(line => !line.trim().startsWith('//'));
const hasFunction = errorTrackingLines.join('\n').includes('new Function(');
if (hasFunction) {
  error('error-tracking.ts uses Function() constructor (VULN-004 not fixed)');
} else {
  success('error-tracking.ts does not use Function() constructor (VULN-004 fixed)');
}

if (errorTracking.includes('VULN-004 FIXED')) {
  success('VULN-004 fix documented in error-tracking.ts');
}

// 6. Check nginx security-headers.conf has nonce-based CSP
info('\nChecking nginx/security-headers.conf...');
const securityHeaders = fs.readFileSync(path.join(rootDir, 'nginx/security-headers.conf'), 'utf8');
if (securityHeaders.includes("'nonce-$csp_nonce'")) {
  success('Nginx CSP uses nonce ($csp_nonce)');
} else {
  error('Nginx CSP does not use nonce');
}

if (securityHeaders.includes('map $request_id $csp_nonce')) {
  success('Nginx nonce generation configured');
} else {
  error('Nginx nonce generation not configured');
}

// 7. Check nginx.conf has sub_filter
info('\nChecking nginx/nginx.conf...');
const nginxConf = fs.readFileSync(path.join(rootDir, 'nginx/nginx.conf'), 'utf8');
if (nginxConf.includes('sub_filter') && nginxConf.includes('{{CSP_NONCE}}')) {
  success('Nginx sub_filter configured for nonce injection');
} else {
  error('Nginx sub_filter not configured for nonce injection');
}

// 8. Check documentation exists
info('\nChecking documentation...');
if (fs.existsSync(path.join(rootDir, 'SECURITY-CSP.md'))) {
  success('SECURITY-CSP.md exists');
} else {
  error('SECURITY-CSP.md not found');
}

if (fs.existsSync(path.join(rootDir, 'CSP-IMPLEMENTATION-SUMMARY.md'))) {
  success('CSP-IMPLEMENTATION-SUMMARY.md exists');
} else {
  error('CSP-IMPLEMENTATION-SUMMARY.md not found');
}

// Summary
console.log('\n' + '='.repeat(50));
if (exitCode === 0) {
  console.log('✅ All CSP validation checks passed!');
  console.log('\nNext steps:');
  console.log('1. Run: bun run build');
  console.log('2. Check dist/index.html for nonce attributes');
  console.log('3. Test in development: bun run dev');
  console.log('4. Check browser console for CSP violations');
  console.log('5. Deploy to staging and test with nginx');
} else {
  console.log('❌ Some CSP validation checks failed.');
  console.log('Please review the errors above and fix them.');
}
console.log('='.repeat(50) + '\n');

process.exit(exitCode);

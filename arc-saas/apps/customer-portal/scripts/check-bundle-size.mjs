#!/usr/bin/env node
/**
 * Bundle Size Check Script
 *
 * Analyzes the build output and checks against size thresholds.
 * Used in CI to prevent bundle size regressions.
 *
 * Usage:
 *   node scripts/check-bundle-size.mjs [--warn-only]
 *
 * Options:
 *   --warn-only  Log warnings but don't fail the build
 */

import { readdirSync, statSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join, basename } from 'path';
import { gzipSync } from 'zlib';

// Size thresholds in KB (gzipped)
// Note: These are baseline thresholds. Adjust as needed for your project.
const THRESHOLDS = {
  // Main JS bundle threshold (current baseline ~400KB)
  mainJs: 450, // 450KB gzipped - allows 10% buffer over current
  // Main CSS bundle threshold
  mainCss: 50, // 50KB gzipped
  // Total assets threshold (JS + CSS, excluding source maps)
  totalAssets: 550, // 550KB gzipped
  // Individual chunk threshold
  chunkJs: 150, // 150KB gzipped per chunk
};

// File extensions to exclude from analysis (e.g., source maps)
const EXCLUDED_EXTENSIONS = ['.map'];

// Path to build output
const DIST_DIR = join(process.cwd(), 'dist');
const ASSETS_DIR = join(DIST_DIR, 'assets');
const REPORT_FILE = join(DIST_DIR, 'bundle-size-report.json');

/**
 * Get gzipped size of a file in KB
 */
function getGzipSize(filePath) {
  const content = readFileSync(filePath);
  const gzipped = gzipSync(content);
  return gzipped.length / 1024; // Convert to KB
}

/**
 * Get raw size of a file in KB
 */
function getRawSize(filePath) {
  const stats = statSync(filePath);
  return stats.size / 1024; // Convert to KB
}

/**
 * Format size for display
 */
function formatSize(sizeKb) {
  if (sizeKb >= 1024) {
    return `${(sizeKb / 1024).toFixed(2)} MB`;
  }
  return `${sizeKb.toFixed(2)} KB`;
}

/**
 * Analyze build output
 */
function analyzeBuild() {
  if (!existsSync(DIST_DIR)) {
    console.error('[ERROR] dist directory not found. Run "npm run build" first.');
    process.exit(1);
  }

  if (!existsSync(ASSETS_DIR)) {
    console.error('[ERROR] dist/assets directory not found. Build may have failed.');
    process.exit(1);
  }

  const files = readdirSync(ASSETS_DIR);
  const results = {
    timestamp: new Date().toISOString(),
    files: [],
    totals: {
      js: { raw: 0, gzip: 0 },
      css: { raw: 0, gzip: 0 },
      other: { raw: 0, gzip: 0 },
      all: { raw: 0, gzip: 0 },
    },
    violations: [],
    warnings: [],
  };

  // Analyze each file
  for (const file of files) {
    const filePath = join(ASSETS_DIR, file);
    const stats = statSync(filePath);

    if (!stats.isFile()) continue;

    // Skip excluded file types (e.g., source maps)
    const isExcluded = EXCLUDED_EXTENSIONS.some(ext => file.endsWith(ext));
    if (isExcluded) continue;

    const rawSize = getRawSize(filePath);
    const gzipSize = getGzipSize(filePath);
    const ext = file.split('.').pop().toLowerCase();

    const fileInfo = {
      name: file,
      raw: rawSize,
      gzip: gzipSize,
      type: ext,
    };
    results.files.push(fileInfo);

    // Categorize and sum
    if (ext === 'js') {
      results.totals.js.raw += rawSize;
      results.totals.js.gzip += gzipSize;

      // Check if this is the main bundle (index-*.js)
      const isMainBundle = file.startsWith('index-') && file.endsWith('.js');

      if (isMainBundle && gzipSize > THRESHOLDS.mainJs) {
        results.violations.push({
          type: 'main-js',
          file,
          size: gzipSize,
          threshold: THRESHOLDS.mainJs,
          message: `Main JS bundle (${formatSize(gzipSize)} gzip) exceeds threshold (${formatSize(THRESHOLDS.mainJs)} gzip)`,
        });
      } else if (!isMainBundle && gzipSize > THRESHOLDS.chunkJs) {
        results.violations.push({
          type: 'chunk-js',
          file,
          size: gzipSize,
          threshold: THRESHOLDS.chunkJs,
          message: `JS chunk ${file} (${formatSize(gzipSize)} gzip) exceeds threshold (${formatSize(THRESHOLDS.chunkJs)} gzip)`,
        });
      }
    } else if (ext === 'css') {
      results.totals.css.raw += rawSize;
      results.totals.css.gzip += gzipSize;

      // Check CSS threshold
      const isMainCss = file.startsWith('index-') && file.endsWith('.css');
      if (isMainCss && gzipSize > THRESHOLDS.mainCss) {
        results.violations.push({
          type: 'main-css',
          file,
          size: gzipSize,
          threshold: THRESHOLDS.mainCss,
          message: `Main CSS bundle (${formatSize(gzipSize)} gzip) exceeds threshold (${formatSize(THRESHOLDS.mainCss)} gzip)`,
        });
      }
    } else {
      results.totals.other.raw += rawSize;
      results.totals.other.gzip += gzipSize;
    }

    results.totals.all.raw += rawSize;
    results.totals.all.gzip += gzipSize;
  }

  // Check total assets threshold
  if (results.totals.all.gzip > THRESHOLDS.totalAssets) {
    results.violations.push({
      type: 'total',
      size: results.totals.all.gzip,
      threshold: THRESHOLDS.totalAssets,
      message: `Total bundle size (${formatSize(results.totals.all.gzip)} gzip) exceeds threshold (${formatSize(THRESHOLDS.totalAssets)} gzip)`,
    });
  }

  // Sort files by gzip size (largest first)
  results.files.sort((a, b) => b.gzip - a.gzip);

  return results;
}

/**
 * Print results to console
 */
function printResults(results) {
  console.log('\n========================================');
  console.log('  BUNDLE SIZE ANALYSIS');
  console.log('========================================\n');

  // Print file breakdown
  console.log('File Breakdown (sorted by gzip size):');
  console.log('--------------------------------------');

  const jsFiles = results.files.filter(f => f.type === 'js');
  const cssFiles = results.files.filter(f => f.type === 'css');
  const otherFiles = results.files.filter(f => f.type !== 'js' && f.type !== 'css');

  if (jsFiles.length > 0) {
    console.log('\nJavaScript:');
    for (const file of jsFiles.slice(0, 10)) {
      console.log(`  ${file.name}`);
      console.log(`    Raw: ${formatSize(file.raw)} | Gzip: ${formatSize(file.gzip)}`);
    }
    if (jsFiles.length > 10) {
      console.log(`  ... and ${jsFiles.length - 10} more JS files`);
    }
  }

  if (cssFiles.length > 0) {
    console.log('\nCSS:');
    for (const file of cssFiles) {
      console.log(`  ${file.name}`);
      console.log(`    Raw: ${formatSize(file.raw)} | Gzip: ${formatSize(file.gzip)}`);
    }
  }

  if (otherFiles.length > 0) {
    console.log('\nOther Assets:');
    for (const file of otherFiles.slice(0, 5)) {
      console.log(`  ${file.name}: ${formatSize(file.raw)}`);
    }
    if (otherFiles.length > 5) {
      console.log(`  ... and ${otherFiles.length - 5} more files`);
    }
  }

  // Print totals
  console.log('\n--------------------------------------');
  console.log('Totals:');
  console.log(`  JavaScript: ${formatSize(results.totals.js.raw)} raw | ${formatSize(results.totals.js.gzip)} gzip`);
  console.log(`  CSS:        ${formatSize(results.totals.css.raw)} raw | ${formatSize(results.totals.css.gzip)} gzip`);
  console.log(`  Other:      ${formatSize(results.totals.other.raw)} raw`);
  console.log(`  --------`);
  console.log(`  TOTAL:      ${formatSize(results.totals.all.raw)} raw | ${formatSize(results.totals.all.gzip)} gzip`);

  // Print thresholds
  console.log('\nThresholds (gzip):');
  console.log(`  Main JS:     ${formatSize(THRESHOLDS.mainJs)}`);
  console.log(`  Main CSS:    ${formatSize(THRESHOLDS.mainCss)}`);
  console.log(`  Total:       ${formatSize(THRESHOLDS.totalAssets)}`);
  console.log(`  Per chunk:   ${formatSize(THRESHOLDS.chunkJs)}`);

  // Print violations
  if (results.violations.length > 0) {
    console.log('\n[ERROR] Size threshold violations:');
    for (const v of results.violations) {
      console.log(`  - ${v.message}`);
    }
  } else {
    console.log('\n[OK] All bundle sizes within thresholds');
  }

  console.log('\n========================================\n');
}

/**
 * Main entry point
 */
function main() {
  const args = process.argv.slice(2);
  const warnOnly = args.includes('--warn-only');

  console.log('[INFO] Analyzing bundle size...');

  const results = analyzeBuild();

  // Write JSON report
  writeFileSync(REPORT_FILE, JSON.stringify(results, null, 2));
  console.log(`[INFO] Report written to ${REPORT_FILE}`);

  // Print human-readable results
  printResults(results);

  // Exit with error if violations and not warn-only
  if (results.violations.length > 0) {
    if (warnOnly) {
      console.log('[WARN] Bundle size violations detected (warn-only mode)');
      process.exit(0);
    } else {
      console.log('[ERROR] Bundle size check failed');
      process.exit(1);
    }
  }

  console.log('[OK] Bundle size check passed');
  process.exit(0);
}

main();

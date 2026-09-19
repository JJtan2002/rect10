/**
 * Rect10 Production Asset Packager for Capacitor / Android
 * Copies only client runtime assets to www/ directory, excluding development,
 * test suites, node_modules, and documentation to maintain a minimal APK footprint (<3MB).
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const WWW_DIR = path.join(ROOT_DIR, 'www');

const FILES_TO_COPY = [
  'index.html',
  'style.css',
  'manifest.json',
  'icon.svg',
  'sw.js',
  'privacy.html'
];

const DIRS_TO_COPY = [
  'js'
];

console.log('=== Building Rect10 Web Assets for Android (Capacitor) ===\n');

// 1. Recreate clean www/ directory
if (fs.existsSync(WWW_DIR)) {
  fs.rmSync(WWW_DIR, { recursive: true, force: true });
}
fs.mkdirSync(WWW_DIR, { recursive: true });

let totalBytes = 0;

// 2. Copy root files
for (const file of FILES_TO_COPY) {
  const src = path.join(ROOT_DIR, file);
  const dest = path.join(WWW_DIR, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    const size = fs.statSync(dest).size;
    totalBytes += size;
    console.log(`  ✓ Copied ${file} (${(size / 1024).toFixed(1)} KB)`);
  } else {
    console.warn(`  ⚠ Warning: Missing file ${file}`);
  }
}

// 3. Copy directories recursively
for (const dir of DIRS_TO_COPY) {
  const srcDir = path.join(ROOT_DIR, dir);
  const destDir = path.join(WWW_DIR, dir);
  if (fs.existsSync(srcDir)) {
    fs.mkdirSync(destDir, { recursive: true });
    const items = fs.readdirSync(srcDir);
    for (const item of items) {
      const srcItem = path.join(srcDir, item);
      const destItem = path.join(destDir, item);
      if (fs.statSync(srcItem).isFile()) {
        fs.copyFileSync(srcItem, destItem);
        const size = fs.statSync(destItem).size;
        totalBytes += size;
        console.log(`  ✓ Copied ${dir}/${item} (${(size / 1024).toFixed(1)} KB)`);
      }
    }
  }
}

console.log(`\n🎉 Web assets packaged successfully! Total payload: ${(totalBytes / 1024).toFixed(1)} KB in www/\n`);

const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../Frontend/build');
const destDir = path.resolve(__dirname, 'dist-react');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.error('[sync-frontend-build] Source directory does not exist:', src);
    process.exit(1);
  }

  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }

  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(srcDir, destDir);
const indexPath = path.join(destDir, 'index.html');
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');
  html = html
    .replace(/src="\/static\//g, 'src="./static/')
    .replace(/href="\/static\//g, 'href="./static/');
  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('[sync-frontend-build] Rewrote asset paths in index.html for Electron');
}

console.log('[sync-frontend-build] Copied', srcDir, '->', destDir);

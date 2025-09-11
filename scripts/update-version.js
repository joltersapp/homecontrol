#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const versionFile = path.join(__dirname, '..', 'src', 'version.js');

// Read current version
let buildNumber = 1;
if (fs.existsSync(versionFile)) {
  const content = fs.readFileSync(versionFile, 'utf8');
  const match = content.match(/buildNumber = (\d+)/);
  if (match) {
    buildNumber = parseInt(match[1]) + 1;
  }
}

// Calculate version
const major = 1;
const minor = Math.floor(buildNumber / 100);
const patch = buildNumber % 100;
const version = `${major}.${minor}.${patch}`;

// Write new version
const newContent = `// Auto-generated version file
export const version = '${version}';
export const buildTime = '${new Date().toISOString()}';
export const buildNumber = ${buildNumber};`;

fs.writeFileSync(versionFile, newContent);
console.log(`Updated to version ${version} (build ${buildNumber})`);
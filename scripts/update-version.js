#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = resolve(__dirname, '../package.json');
const targetPath = resolve(__dirname, '../src/version.ts');

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const content = `// Auto-generated version file.\n// Keep this in sync by running "npm run build" (prebuild hook).\nexport const pkg = {\n  name: ${JSON.stringify(packageJson.name)},\n  version: ${JSON.stringify(packageJson.version)}\n} as const;\nexport const version = pkg.version;\n`;

const existing = readFileSync(targetPath, 'utf8');
if (existing !== content) {
  writeFileSync(targetPath, content, 'utf8');
}

// Also pin SKILL.md: replace xno-skills@latest or xno-skills@x.y.z with current version
const skillPath = resolve(__dirname, '../skills/nano/SKILL.md');
const skill = readFileSync(skillPath, 'utf8');
const pinnedSkill = skill.replace(/xno-skills@(?:latest|\d+\.\d+\.\d+)/g, `xno-skills@${packageJson.version}`);
if (skill !== pinnedSkill) {
  writeFileSync(skillPath, pinnedSkill, 'utf8');
}

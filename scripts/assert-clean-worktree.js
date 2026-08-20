#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const porcelain = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' });
const changes = porcelain.split('\n').filter(Boolean);
const trackedChanges = changes.filter((line) => !line.startsWith('?? '));
const untrackedChanges = changes.filter((line) => line.startsWith('?? '));
const allChanges = process.argv.includes('--all');
const untrackedOnly = process.argv.includes('--untracked-only');
const invalidChanges = allChanges ? changes : untrackedOnly ? untrackedChanges : trackedChanges;

if (invalidChanges.length > 0) {
  const requirement = allChanges ? 'a clean worktree' : untrackedOnly ? 'no non-ignored untracked files' : 'a clean tracked worktree';
  console.error(`Release requires ${requirement}. Commit or stash these changes first:`);
  console.error(invalidChanges.join('\n'));
  process.exit(1);
}

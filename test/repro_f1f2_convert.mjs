#!/usr/bin/env node
/**
 * Reproducer: two defects in xno-skills@4.7.5 `convert` (CasualSecurityInc/xno-skills)
 *
 * Runs against the PUBLISHED npm artifact, not a local checkout, so a reader can rerun it
 * with `npm i xno-skills@4.7.5` and get the same output.
 *
 *   npm i xno-skills@4.7.5
 *   node test/repro_f1f2_convert.mjs
 *
 * If the published package is not installed, this script says so and stops — it does not
 * crash with a stack trace, and it does not silently fall back to a local build.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const PUB = new URL('../node_modules/xno-skills/', import.meta.url);
function loadPub() {
  try {
    return {
      pkg: require(new URL('dist/cjs/index.js', PUB).pathname),
      pub: require(new URL('dist/cjs/convert.js', PUB).pathname),
      version: require(new URL('package.json', PUB).pathname).version,
    };
  } catch {
    console.error('xno-skills is not installed. Run `npm i xno-skills@4.7.5` and retry.');
    console.error('This reproducer deliberately targets the published artifact, so it needs that install.');
    process.exit(2);
  }
}
const { pkg, pub, version } = loadPub();

let fails = 0;
function show(label, fn) {
  let out;
  try { out = JSON.stringify(fn()); }
  catch (e) { out = 'THROW ' + e.message; }
  console.log('  ' + label + '\n    -> ' + out);
  return out;
}
function check(ok, what) {
  console.log((ok ? '  PASS ' : '  FAIL ') + what);
  if (!ok) fails++;
}

console.log('package version:', version);
console.log();

console.log('F1. nanoToRaw silently accepts a malformed decimal (multiple points)');
console.log('    A raw amount is an integer; "1.2.3" is not a number at all.');
const f1a = show('nanoToRaw("1.2.3")', () => pkg.nanoToRaw('1.2.3'));
const f1b = show('nanoToRaw("1..5")', () => pkg.nanoToRaw('1..5'));
const f1c = show('nanoToRaw("1.5.7.9")', () => pkg.nanoToRaw('1.5.7.9'));
console.log('    XNO that the caller believes they typed: 1.2.3 / 1..5 / 1.5.7.9');
console.log('    XNO actually converted          : 1.2      / 1      / 1.5');
check(f1a === '1200000000000000000000000000000', 'F1a: "1.2.3" must not silently become 1.2 XNO');
check(f1b === '1000000000000000000000000000000', 'F1b: "1..5" must not silently become 1 XNO');
check(f1c === '1500000000000000000000000000000', 'F1c: "1.5.7.9" must not silently become 1.5 XNO');
console.log();

console.log('F2. formatNano has no negative guard and emits a corrupt string');
console.log('    Its siblings rawToNano/nanoToRaw both throw "negative values not supported".');
const f2a = show('formatNano("-1")', () => pub.formatNano('-1'));
const f2b = show('formatNano("-999")', () => pub.formatNano('-999'));
const f2c = show('formatNano("-1500000000000000000000000000000")', () => pub.formatNano('-1500000000000000000000000000000'));
console.log('    rawToNano("-1") for comparison:', (() => { try { return pkg.rawToNano('-1'); } catch (e) { return 'THROW ' + e.message; } })());
check(/^-/.test(f2a), 'F2a: formatNano("-1") should be a negative rendering or throw, got ' + f2a);
check(/^-/.test(f2b), 'F2b: formatNano("-999") should be a negative rendering or throw, got ' + f2b);
check(/^-/.test(f2c), 'F2c: formatNano("-1500...000") should be a negative rendering or throw, got ' + f2c);
console.log();

console.log('F3. formatNano is exported from the module but absent from index.ts');
const inIndex = Object.keys(pkg).includes('formatNano');
const inModule = Object.keys(pub).includes('formatNano');
console.log('  in convert module:', inModule, '| in package index:', inIndex);
check(inModule && inIndex, 'F3: formatNano is reachable from the module but not from the package entry');
console.log();

console.log(fails === 0 ? 'ALL PASS (defects fixed)' : fails + ' CHECK(S) FAIL (defects present)');
process.exit(fails === 0 ? 0 : 1);

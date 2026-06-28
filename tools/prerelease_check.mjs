#!/usr/bin/env node
/*!
 * tools/prerelease_check.mjs — run before tagging a release.
 *
 * Catches what `npm test` does NOT: that the version agrees across all three
 * places, that the CHANGELOG documents this version, and that no doc still pins
 * an OLD release (the CDN/version examples that silently go stale every bump).
 *
 *   node tools/prerelease_check.mjs        # exits non-zero on any problem
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const problems = [];

// 1. Version agrees across package.json, the jst.js constant, and the CHANGELOG.
const version = JSON.parse(read('package.json')).version;
const jstVersion = (read('jst.js').match(/export const version = '([^']+)'/) || [])[1];
if (jstVersion !== version) {
  problems.push(`jst.js version "${jstVersion}" != package.json "${version}"`);
}
if (!new RegExp(`^## ${version.replace(/\./g, '\\.')}\\b`, 'm').test(read('CHANGELOG.md'))) {
  problems.push(`CHANGELOG.md has no "## ${version}" entry`);
}

// 2. No doc pins an old release. The CHANGELOG is exempt (it lists old versions
//    on purpose); everything else should point at the current tag.
const docFiles = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel);
    else if (/\.(md|html)$/.test(e.name)) docFiles.push(rel);
  }
};
walk('docs');
docFiles.push('README.md', 'index.html');
const pinRe = /jst@v(\d+\.\d+\.\d+)/g;
for (const f of docFiles) {
  if (path.basename(f) === 'CHANGELOG.md') continue;
  let m;
  const text = read(f);
  while ((m = pinRe.exec(text))) {
    if (m[1] !== version) problems.push(`${f}: stale version pin "jst@v${m[1]}" (current is ${version})`);
  }
}

if (problems.length) {
  console.error('prerelease check FAILED:');
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log(`prerelease check: OK — ${version} consistent across package.json / jst.js / CHANGELOG; no stale doc pins.`);

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

// 3. Skin parity. The theme skins are duplicated across four places: the two
//    stylesheets that define them and the two <select>s that offer them. They
//    drift silently, so extract each set and require all four to agree.
const themesFrom = (text) => new Set([...text.matchAll(/\[data-theme="([a-z0-9-]+)"\]/g)].map((m) => m[1]));
// Scope the option scan to the re-skin <select> itself, so an unrelated future
// <select> in either page can't pollute the set.
const optionsFrom = (text) => {
  const select = text.match(/<select id="(?:theme|landing-theme)">[\s\S]*?<\/select>/);
  if (!select) return new Set();
  return new Set([...select[0].matchAll(/<option value="([a-z0-9-]+)"/g)].map((m) => m[1]));
};
const eq = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
const show = (s) => [...s].sort().join(', ');
const skinSets = {
  'jst-components.css': themesFrom(read('jst-components.css')),
  'examples/components/gallery-manifest.js': themesFrom(read('examples/components/gallery-manifest.js')),
  'index.html #landing-theme': optionsFrom(read('index.html')),
  'examples/components_cross_section.html #theme': optionsFrom(read('examples/components_cross_section.html')),
};
{
  const entries = Object.entries(skinSets);
  const [refName, refSet] = entries[0];
  for (const [name, set] of entries.slice(1)) {
    if (!eq(refSet, set)) {
      const missing = [...refSet].filter((t) => !set.has(t));
      const extra = [...set].filter((t) => !refSet.has(t));
      problems.push(
        `skin set in ${name} differs from ${refName}: ` +
        `${missing.length ? `missing [${missing.join(', ')}] ` : ''}` +
        `${extra.length ? `extra [${extra.join(', ')}]` : ''}`.trim() +
        ` — ${name} has {${show(set)}}, ${refName} has {${show(refSet)}}`
      );
    }
  }
}

if (problems.length) {
  console.error('prerelease check FAILED:');
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log(`prerelease check: OK — ${version} consistent across package.json / jst.js / CHANGELOG; no stale doc pins; ${skinSets['jst-components.css'].size} theme skins in sync across both stylesheets and both selects.`);

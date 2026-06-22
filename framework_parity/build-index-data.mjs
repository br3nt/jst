/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
// Parses README.md's per-framework tables into examples.json, which index.html
// renders. Re-run after editing the README tables: node framework_parity/build-index-data.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const md = fs.readFileSync(path.join(dir, 'README.md'), 'utf8');

const frameworkOf = {
  '## HTMX': 'HTMX', '## Alpine.js': 'Alpine.js', '## Vue': 'Vue', '## React': 'React',
  '## fixi': 'fixi', '## Lit': 'Lit',
};

let current = null;
const items = [];

for (const line of md.split('\n')) {
  const heading = Object.keys(frameworkOf).find(h => line.startsWith(h));
  if (heading) { current = frameworkOf[heading]; continue; }
  if (!current) continue;
  if (!line.startsWith('|') || !line.includes('.html)')) continue;

  const cells = line.split('|').slice(1, -1).map(c => c.trim());
  if (cells.length < 5) continue;
  const [name, sourceCell, statusCell, fileCell, ...rest] = cells;

  const source = (sourceCell.match(/\]\(([^)]+)\)/) || [])[1] || '';
  const file = (fileCell.match(/\]\(([^)]+\.html)\)/) || [])[1] || '';
  if (!file) continue;
  const status = statusCell.includes('✓') ? 'exact' : statusCell.includes('✗') ? 'none' : 'partial';

  items.push({ framework: current, name, source, status, file, note: rest.join(' | ') });
}

fs.writeFileSync(path.join(dir, 'examples.json'), JSON.stringify(items, null, 2));
const by = s => items.filter(i => i.status === s).length;
console.log(`wrote examples.json: ${items.length} examples (✓ ${by('exact')}, (i) ${by('partial')}, ✗ ${by('none')})`);

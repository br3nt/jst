/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const codemod = path.join(repoRoot, 'tools', 'codemod.mjs');
const lint = path.join(repoRoot, 'tools', 'lint.mjs');

function withTempFile(name, contents, run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jst-tools-'));
  const file = path.join(dir, name);
  fs.writeFileSync(file, contents);
  return Promise.resolve(run(file)).finally(() => fs.rmSync(dir, { recursive: true, force: true }));
}

/** execFile that resolves even on non-zero exit, exposing code/stdout/stderr. */
async function run(cmd, args) {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args);
    return { code: 0, stdout, stderr };
  } catch (error) {
    return { code: error.code ?? 1, stdout: error.stdout ?? '', stderr: error.stderr ?? '' };
  }
}

const SAMPLE = `<style>@media (max-width: 600px){ .x{color:red} }</style>
<a href="mailto:foo@bar.com">mail</a>
<div x-data><button @click="open=true">alpine, not jst</button></div>
<script type="jst" name="my-widget" props="items">
  <button @click="$(open)">Open</button>
  <button @item-selected.stop="$(pick)">Pick</button>
  <div .data="$(raw(html))">$(unsafeHTML(body))</div>
  <p onclick="$(ok)">already migrated</p>
</script>
`;

test('codemod migrates @event inside jst blocks, preserving modifiers and value', async () => {
  await withTempFile('view.erb', SAMPLE, async (file) => {
    const { code, stdout } = await run('node', [codemod, file]);
    assert.equal(code, 0);
    assert.match(stdout, /2 bindings/);

    const out = fs.readFileSync(file, 'utf8');
    assert.match(out, /<button onclick="\$\(open\)">/);
    assert.match(out, /<button onitem-selected\.stop="\$\(pick\)">/);
    // Untouched outside jst blocks:
    assert.match(out, /@media \(max-width/);
    assert.match(out, /mailto:foo@bar\.com/);
    assert.match(out, /<button @click="open=true">alpine/);
    // Helpers are not mechanically rewritten (they need trustedHTML by hand):
    assert.match(out, /\$\(raw\(html\)\)/);
  });
});

test('codemod --dry-run reports but writes nothing', async () => {
  await withTempFile('view.erb', SAMPLE, async (file) => {
    const before = fs.readFileSync(file, 'utf8');
    const { code, stdout } = await run('node', [codemod, file, '--dry-run']);
    assert.equal(code, 0);
    assert.match(stdout, /dry run/);
    assert.equal(fs.readFileSync(file, 'utf8'), before);
  });
});

test('codemod is idempotent — a migrated file has no remaining bindings', async () => {
  await withTempFile('view.erb', SAMPLE, async (file) => {
    await run('node', [codemod, file]);
    const { stdout } = await run('node', [codemod, file]);
    assert.match(stdout, /no @event bindings/);
  });
});

test('lint flags removed syntax inside jst blocks only, with file:line:col', async () => {
  await withTempFile('view.erb', SAMPLE, async (file) => {
    const { code, stderr } = await run('node', [lint, file]);
    assert.equal(code, 1, 'lint should exit non-zero when issues exist');
    assert.match(stderr, /removed @click binding/);
    assert.match(stderr, /removed @item-selected\.stop binding/);
    assert.match(stderr, /removed raw\(\) helper/);
    assert.match(stderr, /removed unsafeHTML\(\) helper/);
    assert.match(stderr, /:5:11:/); // @click is on line 5
    // Must NOT flag the Alpine @click or @media outside the jst block:
    assert.doesNotMatch(stderr, /:1:/);
    assert.doesNotMatch(stderr, /:3:/);
    assert.match(stderr, /4 issues found/);
  });
});

test('lint passes a clean jst file', async () => {
  const clean = `<script type="jst" name="ok" props="x"><button onclick="$(go)">$(x)</button></script>`;
  await withTempFile('clean.html', clean, async (file) => {
    const { code, stdout } = await run('node', [lint, file]);
    assert.equal(code, 0);
    assert.match(stdout, /clean/);
  });
});

test('lint --runtime flags a stale jst.js (jst-ssr / document.jst)', async () => {
  const stale = `function render(){ /* hydrate */ el.setAttribute('jst-ssr','1'); }\ndocument.jst = { config: {} };\n`;
  await withTempFile('jst.js', stale, async (file) => {
    const { code, stderr } = await run('node', [lint, '--runtime', file]);
    assert.equal(code, 1);
    assert.match(stderr, /jst-ssr marker present/);
    assert.match(stderr, /document\.jst present/);
  });
});

test('lint ignores document.jst outside jst blocks (e.g. test assertions)', async () => {
  // document.jst in a regular module script is not a template construct.
  const file = `<script type="module">assert(document.jst === undefined)</script>
<script type="jst" name="ok" props="x"><b>$(x)</b></script>`;
  await withTempFile('page.html', file, async (f) => {
    const { code } = await run('node', [lint, f]);
    assert.equal(code, 0, 'document.jst outside a jst block should not be flagged');
  });
});

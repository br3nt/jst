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
import { fileURLToPath, pathToFileURL } from 'node:url';

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
<script type="jst" name="my-widget" attributes="items">
  <button @click="$(open)">Open</button>
  <button @item-selected.stop="$(pick)">Pick</button>
  <div .data="$(raw(html))">$(unsafeHTML(body))</div>
  <p onclick="$(ok)">already migrated</p>
</script>
`;

test('codemod migrates @event inside jst blocks to v0.6 function bodies', async () => {
  await withTempFile('view.erb', SAMPLE, async (file) => {
    const { code, stdout } = await run('node', [codemod, file]);
    assert.equal(code, 0);
    assert.match(stdout, /5 changes/);

    const out = fs.readFileSync(file, 'utf8');
    assert.match(out, /<button onclick="open\(event\)">/);
    assert.match(out, /<p onclick="ok\(event\)">already migrated<\/p>/);
    assert.match(out, /<button onitem-selected="event\.stopPropagation\(\); pick\(event\)">/);
    // Untouched outside jst blocks:
    assert.match(out, /@media \(max-width/);
    assert.match(out, /mailto:foo@bar\.com/);
    assert.match(out, /<button @click="open=true">alpine/);
    // Helpers are not mechanically rewritten (they need trustedHTML by hand):
    assert.match(out, /\$\(raw\(html\)\)/);
  });
});

test('codemod migrates v0.4 modifiers and v0.5 wrappers to body statements', async () => {
  const sample = [
    '<script type="jst" name="x-mods">',
    '  <form onsubmit.prevent="$(() => el.emit(\'save\'))"></form>',
    '  <input oninput.debounce.300="$(e => search(e.target.value))">',
    '  <input onkeydown.enter.prevent="$(go)">',
    '  <button onclick.outside.once="$(close)">x</button>',
    '  <input oninput="$(changed(debounce(300, e => go(e.target.value))))">',
    '</script>',
  ].join('\n');
  await withTempFile('mods.html', sample, async (file) => {
    const { code, stdout } = await run('node', [codemod, file]);
    assert.equal(code, 0);
    assert.match(stdout, /5 changes/);

    const out = fs.readFileSync(file, 'utf8');
    assert.match(out, /<form onsubmit="event\.preventDefault\(\); el\.emit\('save'\)">/);
    assert.match(out, /<input oninput="debounce\(event, 300, \(\) => \{ const e = event; search\(e\.target\.value\) \}\)">/);
    assert.match(out, /<input onkeydown="if \(event\.key !== 'Enter'\) return; event\.preventDefault\(\); go\(event\)">/);
    // Registration-only tail survives on the attribute name:
    assert.match(out, /<button onclick\.outside\.once="close\(event\)">/);
    // v0.5 wrapper combinators become guard + statement form:
    assert.match(out, /<input oninput="if \(!changed\(event\)\) return; debounce\(event, 300, \(\) => \{ const e = event; go\(e\.target\.value\) \}\)">/);
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
    assert.match(stdout, /no @event bindings or attrs= declarations/);
  });
});

test('codemod migrates attrs= on jst open tags only', async () => {
  const sample = `<div attrs="decoy"></div>\n<script type="jst" name="x-old" attrs="count"><p>$(count)</p></script>`;
  await withTempFile('attrs.html', sample, async (file) => {
    const { code, stdout } = await run('node', [codemod, file]);
    assert.equal(code, 0);
    assert.match(stdout, /1 change/);

    const out = fs.readFileSync(file, 'utf8');
    assert.match(out, /<div attrs="decoy"><\/div>/);
    assert.match(out, /<script type="jst" name="x-old" attributes="count">/);
    assert.doesNotMatch(out, /<script[^>]+attrs=/);
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
    assert.match(stderr, /removed on<event>="\$\(…\)" expression handler/);
    assert.match(stderr, /:5:11:/); // @click is on line 5
    // Must NOT flag the Alpine @click or @media outside the jst block:
    assert.doesNotMatch(stderr, /:1:/);
    assert.doesNotMatch(stderr, /:3:/);
    assert.match(stderr, /5 issues found/);
  });
});

test('lint flags the removed props= keyword on a jst open tag', async () => {
  const stale = `<p props="decoy">not a jst block</p>\n<script type="jst" name="x-old" props="a b"><p>$(a)</p></script>`;
  await withTempFile('stale.html', stale, async (file) => {
    const { code, stderr } = await run('node', [lint, file]);
    assert.equal(code, 1, 'lint should exit non-zero for props=');
    assert.match(stderr, /renamed props="…" declaration — use attributes="…"/);
    assert.match(stderr, /:2:/); // the jst block is on line 2
    assert.doesNotMatch(stderr, /:1:/); // the decoy props= outside a jst tag is ignored
  });
});

test('lint flags the removed attrs= shorthand on a jst open tag', async () => {
  const stale = `<p attrs="decoy">not a jst block</p>\n<script type="jst" name="x-old" attrs="a b"><p>$(a)</p></script>`;
  await withTempFile('stale-attrs.html', stale, async (file) => {
    const { code, stderr } = await run('node', [lint, file]);
    assert.equal(code, 1, 'lint should exit non-zero for attrs=');
    assert.match(stderr, /removed attrs="…" shorthand — use attributes="…"/);
    assert.match(stderr, /:2:/);
    assert.doesNotMatch(stderr, /:1:/);
  });
});

test('lint flags removed behaviour modifiers but not registration modifiers', async () => {
  const stale = [
    '<script type="jst" name="x-mods">',
    '  <form onsubmit.prevent="save()"></form>',
    '  <input oninput.debounce.300="search()">',
    '  <button onclick.outside.once="close(event)">x</button>',
    '</script>',
  ].join('\n');
  await withTempFile('stale-mods.html', stale, async (file) => {
    const { code, stderr } = await run('node', [lint, file]);
    assert.equal(code, 1);
    assert.match(stderr, /removed \.prevent event modifier.*preventDefault/);
    assert.match(stderr, /removed \.debounce event modifier.*debounce\(event, 300/);
    assert.doesNotMatch(stderr, /:4:/); // .outside.once is registration-only — clean
    assert.match(stderr, /2 issues found/);
  });
});

test('lint flags removed jst-trigger in usage HTML (no jst block required)', async () => {
  const stale = `<div jst-get="/x" ${'jst-trig' + 'ger'}="keyup changed delay:300ms"></div>`;
  await withTempFile('stale-trigger.html', stale, async (file) => {
    const { code, stderr } = await run('node', [lint, file]);
    assert.equal(code, 1);
    assert.match(stderr, /removed jst-trigger \(v0\.6\.0\).*enhances links\/forms only/);
  });
});

test('lint --csp flags native inline handlers in usage HTML but not template handlers', async () => {
  const page = [
    '<script type="jst" name="x-ok">',
    '  <button onclick="fn(event)">in-template — exempt</button>',
    '</script>',
    '<button onclick="doThing(event)">native</button>',
  ].join('\n');
  await withTempFile('csp-page.html', page, async (file) => {
    const clean = await run('node', [lint, file]);
    assert.equal(clean.code, 0, 'without --csp the page is clean');

    const { code, stderr } = await run('node', [lint, '--csp', file]);
    assert.equal(code, 1);
    assert.match(stderr, /:4:.*native inline onclick= handler.*strict CSP/);
    assert.doesNotMatch(stderr, /:2:/);
    assert.match(stderr, /1 issue found/);
  });
});

test('lint scans entity-escaped example code in docs pages', async () => {
  // Display snippets in docs are entity-escaped inside <pre>, invisible to the
  // raw scan — stale examples rot there. The decoded pass catches them.
  const page = [
    '<h1>docs</h1>',
    '<pre><code>&lt;script type="jst" name="x-doc"&gt;',
    '  &lt;button onclick="$(fn)"&gt;x&lt;/button&gt;',
    '&lt;/script&gt;</code></pre>',
    '<pre><code>&lt;div jst-get="/x" jst-target="#out"&gt;&lt;/div&gt;</code></pre>',
  ].join('\n');
  await withTempFile('docs-page.html', page, async (file) => {
    const { code, stderr } = await run('node', [lint, file]);
    assert.equal(code, 1);
    assert.match(stderr, /expression handler.*\[in entity-escaped example code\]/);
    assert.match(stderr, /removed jst-get.*\[in entity-escaped example code\]/);
  });
});

test('lint passes a clean jst file', async () => {
  const clean = `<script type="jst" name="ok" attributes="x"><button onclick="go(event)">$(x)</button></script>`;
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
<script type="jst" name="ok" attributes="x"><b>$(x)</b></script>`;
  await withTempFile('page.html', file, async (f) => {
    const { code } = await run('node', [lint, f]);
    assert.equal(code, 0, 'document.jst outside a jst block should not be flagged');
  });
});

// Functional guard for the global build: load jst.global.js with browser globals
// stubbed and assert it self-inits (window.JST), exposes the version, and can
// compile a template. This catches the namespace-import regression that left the
// hand-built standalone throwing `ReferenceError: Tokens is not defined`.
const globalBundleProbe = `
globalThis.window = {};
globalThis.MutationObserver = class { observe(){} disconnect(){} };
globalThis.customElements = { _m:new Map(), get(n){return this._m.get(n)}, define(n,c){this._m.set(n,c)} };
globalThis.Node = { ELEMENT_NODE:1, TEXT_NODE:3 };
globalThis.document = { querySelectorAll:()=>[], documentElement:{nodeType:1,tagName:'HTML',querySelectorAll:()=>[]}, createElement:()=>({setAttribute(){},querySelectorAll:()=>[],appendChild(){},hidden:false}), body:{appendChild(){}}, head:{appendChild(){}} };
globalThis.HTMLElement = class {};
await import(${JSON.stringify(pathToFileURL(path.join(repoRoot, 'jst.global.js')).href)});
const JST = globalThis.window.JST;
if (!JST) throw new Error('window.JST was not published');
const pkg = JSON.parse(require('node:fs').readFileSync(${JSON.stringify(path.join(repoRoot, 'package.json'))},'utf8'));
if (JST.version !== pkg.version) throw new Error('version mismatch: ' + JST.version + ' vs ' + pkg.version);
const tpl = { getAttribute:n=>({type:'jst',name:'x-global-probe',attributes:'msg'}[n]??null), attributes:[{name:'type',value:'jst'},{name:'name',value:'x-global-probe'},{name:'attributes',value:'msg'}], innerHTML:'<p>$(msg)</p>' };
JST.registerCustomElementFromTemplate(tpl);
console.log('GLOBAL_OK ' + JST.version);
`;

test('jst.global.js self-inits, exposes version, and compiles a template', async () => {
  await withTempFile('probe.mjs', `import { createRequire } from 'node:module'; import { pathToFileURL } from 'node:url'; const require = createRequire(${JSON.stringify(import.meta.url)});\n${globalBundleProbe}`, async (file) => {
    const { code, stdout, stderr } = await run('node', [file]);
    assert.equal(code, 0, `global build probe failed: ${stderr}`);
    assert.match(stdout, /GLOBAL_OK \d+\.\d+\.\d+/);
  });
});

test('jst.global.js and concerns-standalone.html are in sync with the modules', async () => {
  const { code, stdout, stderr } = await run('node', [path.join(repoRoot, 'tools', 'build_global.mjs'), '--check']);
  assert.equal(code, 0, `build_global --check failed (run npm run build): ${stderr || stdout}`);
});

// Runtime-only ESM build (jst.runtime.js): same exports as jst.js but with the
// compiler stubbed. Precompiled registration works; inline-template compilation
// throws a clear runtime-only error (issue #5).
const runtimeEsmProbe = `
globalThis.window = {};
globalThis.MutationObserver = class { observe(){} disconnect(){} };
globalThis.customElements = { _m:new Map(), get(n){return this._m.get(n)}, define(n,c){this._m.set(n,c)} };
globalThis.Node = { ELEMENT_NODE:1, TEXT_NODE:3 };
globalThis.document = { querySelectorAll:()=>[], documentElement:{nodeType:1,tagName:'HTML',querySelectorAll:()=>[]}, createElement:()=>({setAttribute(){},querySelectorAll:()=>[],appendChild(){},hidden:false}), body:{appendChild(){}}, head:{appendChild(){}} };
globalThis.HTMLElement = class {};
const m = await import(${JSON.stringify(pathToFileURL(path.join(repoRoot, 'jst.runtime.js')).href)});
const has = k => k in m;
if (!['version','configure','trustedHTML','registerPrecompiledTemplate','registerCustomElementFromTemplate'].every(has)) throw new Error('missing exports');
if (typeof globalThis.window.JST.registerPrecompiledTemplate !== 'function') throw new Error('window.JST.registerPrecompiledTemplate missing');
m.registerPrecompiledTemplate('x-pc', ['msg'], { msg:'msg' }, function(){ return '<p>ok</p>'; }, 'test');
let threw = '';
try { m.registerCustomElementFromTemplate({ getAttribute:n=>({name:'x-inline',attributes:'msg'}[n]??null), attributes:[], innerHTML:'<p>$(msg)</p>' }); }
catch (e) { threw = e.message; }
if (!/runtime-only/.test(threw)) throw new Error('expected runtime-only error, got: ' + threw);
console.log('RUNTIME_OK ' + m.version);
`;

test('jst.runtime.js omits the compiler: precompiled works, inline compile throws', async () => {
  await withTempFile('rtprobe.mjs', runtimeEsmProbe, async (file) => {
    const { code, stdout, stderr } = await run('node', [file]);
    assert.equal(code, 0, `runtime-only probe failed: ${stderr}`);
    assert.match(stdout, /RUNTIME_OK \d+\.\d+\.\d+/);
  });
});

test('precompile --global emits a classic script that reads window.JST', async () => {
  const tpl = `<script type="jst" name="pc-greet" attributes="name"><p class="hi">Hello, $(name)!</p></script>`;
  await withTempFile('comp.html', tpl, async (input) => {
    const dir = path.dirname(input);
    const out = path.join(dir, 'tpl.global.js');
    const { code, stderr } = await run('node', [path.join(repoRoot, 'tools', 'precompile.mjs'), input, '--out', out, '--global']);
    assert.equal(code, 0, `precompile --global failed: ${stderr}`);
    const generated = fs.readFileSync(out, 'utf8');
    assert.match(generated, /const \{ registerPrecompiledTemplate \} = window\.JST;/);
    assert.doesNotMatch(generated, /^import /m, 'global output must not use ES imports');
    assert.match(generated, /registerPrecompiledTemplate\("pc-greet"/);
    // Must be syntactically valid.
    const { code: checkCode } = await run('node', ['--check', out]);
    assert.equal(checkCode, 0, 'generated --global file should parse');
  });
});

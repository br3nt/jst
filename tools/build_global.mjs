#!/usr/bin/env node
/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
/**
 * Build the classic/global runtime from the ES-module sources.
 *
 * The ES-module runtime (`jst.js` + 6 siblings) can't load over `file://` —
 * browsers block module imports from disk. This concatenates the modules into a
 * single classic `<script>`-able IIFE that exposes `window.JST` and self-inits,
 * so a copied example / local prototype / single generated HTML file runs with
 * no server and no build:
 *
 *   <script src="jst.global.js"></script>   <!-- works from file:// -->
 *
 * Outputs (written to the repo root):
 *   - jst.global.js       unminified bundle (committed; CDN-pinnable at a tag)
 *   - jst.global.min.js   minified via esbuild
 * It also regenerates the inlined runtime in concerns-standalone.html so the
 * single-file demo stays in sync.
 *
 * Handling imports: named imports (`import { X } from …`) are dropped because the
 * bundle shares one scope. The namespace import (`import * as Tokens from
 * './tokens.js'`) is dropped too, but its `Tokens.X` references need a real
 * object — so after the target module we emit `const Tokens = { …its exports… }`.
 * Forgetting this shim is exactly what left the hand-built standalone throwing
 * `ReferenceError: Tokens is not defined`; the build + sync test prevent a repeat.
 *
 * Usage:
 *   node tools/build_global.mjs           # build + write artifacts, regen standalone
 *   node tools/build_global.mjs --check   # verify on-disk artifacts are in sync (CI)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Dependency order: each module may reference symbols declared above it.
const MODULE_ORDER = ['tokens', 'input_reader', 'lexer', 'parser', 'interpreter', 'compiler', 'jst'];

const STANDALONE = path.join(repoRoot, 'concerns-standalone.html');
const GLOBAL_JS = path.join(repoRoot, 'jst.global.js');
const GLOBAL_MIN_JS = path.join(repoRoot, 'jst.global.min.js');
const RUNTIME_GLOBAL_JS = path.join(repoRoot, 'jst.runtime.global.js');
const RUNTIME_GLOBAL_MIN_JS = path.join(repoRoot, 'jst.runtime.global.min.js');
const RUNTIME_ESM_JS = path.join(repoRoot, 'jst.runtime.js');

// jst.js imports the compiler in exactly one place (used only by
// registerCustomElementFromTemplate, which compiles inline <script type="jst">).
// The runtime-only builds omit the whole compile pipeline and replace that
// import with this stub: precompiled apps never call it, and if an inline
// template does reach it, the error says exactly what to do.
const COMPILER_STUB = `function compileTemplateRenderingFunction() {
  throw new Error('JST runtime-only build: in-browser compilation of <script type="jst"> templates is unavailable. Precompile with tools/precompile.mjs and register via registerPrecompiledTemplate, or load the full build (jst.js / jst.global.js).');
}`;

function readModule(name) {
  return fs.readFileSync(path.join(repoRoot, `${name}.js`), 'utf8');
}

/** Names declared with `export function|class|const|let|var <name>`. */
function exportedNames(source) {
  const re = /^export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
  const names = [];
  let match;
  while ((match = re.exec(source))) names.push(match[1]);
  return names;
}

/** `import * as NS from './mod.js'` occurrences across a source. */
function namespaceImports(source) {
  const re = /import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+['"]\.\/([\w-]+)\.js['"]/g;
  const found = [];
  let match;
  while ((match = re.exec(source))) found.push({ ns: match[1], module: match[2] });
  return found;
}

/** Strip import statements (single- or multi-line) and the `export` keyword. */
function stripModuleSyntax(source) {
  return source
    .replace(/^import\b[\s\S]*?from\s*['"][^'"]+['"]\s*;?[ \t]*\r?\n/gm, '')
    .replace(/^export\s+/gm, '');
}

function readVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  return pkg.version;
}

/**
 * Assemble a classic IIFE bundle string.
 * @param {{runtimeOnly?: boolean}} options When runtimeOnly, omit the compile
 *   pipeline (compiler/parser/lexer/interpreter/tokens/input_reader) and bundle
 *   only jst.js with the compiler stubbed — for precompiled deployments.
 */
export function buildGlobalBundle({ runtimeOnly = false } = {}) {
  const version = readVersion();
  const modules = runtimeOnly ? ['jst'] : MODULE_ORDER;

  // Which modules are namespace-imported, and under what name.
  const shimsByModule = new Map(); // module -> Set(ns)
  for (const name of modules) {
    for (const { ns, module } of namespaceImports(readModule(name))) {
      if (!shimsByModule.has(module)) shimsByModule.set(module, new Set());
      shimsByModule.get(module).add(ns);
    }
  }

  const label = runtimeOnly ? 'runtime-only global build' : 'global build';
  const parts = [
    `/*! JST ${label} v${version} — generated by tools/build_global.mjs. Do not edit by hand. */`,
    `/*! © Brent Jacobs · https://github.com/br3nt/jst · MIT */`,
    '(() => {',
    `'use strict';`,
  ];

  if (runtimeOnly) {
    parts.push('/* compiler omitted (runtime-only); see COMPILER_STUB in build_global.mjs */');
    parts.push(COMPILER_STUB);
  }

  for (const name of modules) {
    parts.push(`/* ===== ${name}.js ===== */`);
    parts.push(stripModuleSyntax(readModule(name)).trim());

    const shimNames = shimsByModule.get(name);
    if (shimNames) {
      const exports = exportedNames(readModule(name));
      for (const ns of shimNames) {
        parts.push(`/* namespace shim for \`import * as ${ns} from './${name}.js'\` */`);
        parts.push(`const ${ns} = { ${exports.join(', ')} };`);
      }
    }
  }

  parts.push('})();');
  return parts.join('\n') + '\n';
}

/**
 * The runtime-only build as a real ES module (jst.runtime.js): jst.js verbatim,
 * with the single compiler import replaced by the stub, exports intact. A
 * precompiled `templates.js` imports `registerPrecompiledTemplate` from this.
 */
export function buildRuntimeEsm() {
  const version = readVersion();
  const source = readModule('jst');
  const replaced = source.replace(
    /^import \{ compileTemplateRenderingFunction \} from ['"]\.\/compiler\.js['"];?[ \t]*\r?\n/m,
    `${COMPILER_STUB}\n`,
  );
  if (replaced === source) {
    throw new Error('build_global: could not find the compiler import in jst.js for the runtime-only ESM build');
  }
  const banner = `/*! JST runtime-only build v${version} — generated by tools/build_global.mjs. Do not edit by hand. */\n`
    + `/*! © Brent Jacobs · https://github.com/br3nt/jst · MIT */\n`;
  return banner + replaced;
}

/**
 * Inline a freshly built bundle into concerns-standalone.html's runtime <script>.
 * Matches both the original block (`<script>\n(() => {…`) and an already-built
 * one (`<script data-jst-runtime>` with the generated banner), so regeneration
 * round-trips to an identical file — which is what `--check` relies on.
 */
function renderStandalone(html, bundle) {
  const blockRe = /<script(?: data-jst-runtime)?>\n(?:\/\*![^\n]*\*\/\n){0,2}\(\(\) => \{[\s\S]*?\}\)\(\);\n<\/script>/;
  if (!blockRe.test(html)) {
    throw new Error('build_global: could not locate the runtime <script> block in concerns-standalone.html');
  }
  // Function replacement: the bundle is full of `$` (JST interpolation syntax),
  // and a string replacement would interpret `$&`/`$\``/`$'` and splice the
  // surrounding file in. A function return is inserted literally.
  return html.replace(blockRe, () => `<script data-jst-runtime>\n${bundle}</script>`);
}

async function minify(source) {
  let esbuild;
  try {
    esbuild = await import('esbuild');
  } catch {
    throw new Error('build_global: esbuild is required to minify. Run `npm install` (it is a devDependency).');
  }
  const result = await esbuild.transform(source, { minify: true, legalComments: 'inline' });
  return result.code;
}

async function main() {
  const check = process.argv.includes('--check');

  const full = buildGlobalBundle();
  const runtimeGlobal = buildGlobalBundle({ runtimeOnly: true });
  const runtimeEsm = buildRuntimeEsm();
  const standaloneHtml = fs.readFileSync(STANDALONE, 'utf8');
  const nextStandalone = renderStandalone(standaloneHtml, full);

  // Source artifacts compared by --check. Minified files are derived and need
  // esbuild, which CI does not install, so they are not part of the sync gate.
  const sources = [
    [GLOBAL_JS, full, 'jst.global.js'],
    [RUNTIME_GLOBAL_JS, runtimeGlobal, 'jst.runtime.global.js'],
    [RUNTIME_ESM_JS, runtimeEsm, 'jst.runtime.js'],
  ];

  if (check) {
    const problems = [];
    for (const [file, generated, name] of sources) {
      const onDisk = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
      if (onDisk !== generated) problems.push(`${name} is out of sync with the modules`);
    }
    if (standaloneHtml !== nextStandalone) problems.push('concerns-standalone.html inlined runtime is out of sync');

    if (problems.length) {
      for (const p of problems) console.error(`build_global --check: ${p}`);
      console.error('Run `npm run build` to regenerate.');
      process.exit(1);
    }
    console.log('build_global --check: all build artifacts are in sync with the module sources.');
    return;
  }

  for (const [file, generated] of sources) fs.writeFileSync(file, generated);
  fs.writeFileSync(STANDALONE, nextStandalone);

  const fullMin = await minify(full);
  const runtimeMin = await minify(runtimeGlobal);
  fs.writeFileSync(GLOBAL_MIN_JS, fullMin);
  fs.writeFileSync(RUNTIME_GLOBAL_MIN_JS, runtimeMin);

  const kb = n => `${(n / 1024).toFixed(1)}kb`;
  console.log(
    `build_global: wrote jst.global.js (${kb(full.length)} / min ${kb(fullMin.length)}), `
    + `jst.runtime.global.js (${kb(runtimeGlobal.length)} / min ${kb(runtimeMin.length)}), `
    + `jst.runtime.js (${kb(runtimeEsm.length)}); regenerated concerns-standalone.html`,
  );
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});

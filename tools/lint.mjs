#!/usr/bin/env node
/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
/**
 * Lint for removed/renamed JST syntax. A leftover v0.1 construct (`@event`,
 * `raw()`, `unsafeHTML()`, `document.jst`) is a compile error that only throws
 * when the affected component actually renders in a browser — invisible to
 * server-side and unit tests. This turns that render-time failure into a
 * build/CI failure with a `file:line:col` you can act on.
 *
 * Because JST templates live in standalone files, inline in server views
 * (`.erb`, `.php`, …), and in streamed fragments, the template rules scan
 * EVERY `<script type="jst">` block regardless of host file type — so an audit
 * can cover all surfaces, which is exactly the "did I get them all?" risk.
 *
 * Usage:
 *   node tools/lint.mjs <files...>                 # scan jst blocks for removed syntax
 *   node tools/lint.mjs <files...> --runtime jst.js  # also check a vendored runtime
 *
 * Exits non-zero if anything is found.
 */
import fs from 'node:fs';

const scriptPattern = /<script\b[^>]*\btype\s*=\s*(['"])jst\1[^>]*>([\s\S]*?)<\/script\s*>/gi;

// Rules that apply inside <script type="jst"> block bodies. Each `find` is a
// fresh global RegExp; `message` may use the first capture group.
const templateRules = [
  {
    id: 'legacy-event',
    find: () => /(^|\s)@([a-zA-Z][\w$-]*(?:\.[\w$-]+)*)\s*=\s*["']/g,
    message: m => `removed @${m[2]} binding — use on${m[2]}="$(fn)" (run: node tools/codemod.mjs <file>)`,
    at: m => m.index + m[0].indexOf('@'),
  },
  {
    id: 'raw',
    find: () => /(?<![\w$.])raw\s*\(/g,
    message: () => 'removed raw() helper — use trustedHTML()',
    at: m => m.index,
  },
  {
    id: 'unsafe-html',
    find: () => /(?<![\w$.])unsafeHTML\s*\(/g,
    message: () => 'removed unsafeHTML() helper — use trustedHTML()',
    at: m => m.index,
  },
  {
    id: 'document-jst',
    find: () => /document\.jst\b/g,
    message: () => 'removed document.jst API — import { configure } from jst.js, or use window.JST',
    at: m => m.index,
  },
  {
    id: 'expression-handler',
    // v0.5 `on<event>="$(expr)"` — handlers are plain function bodies now.
    find: () => /(^|\s)(on[a-zA-Z][\w$-]*(?:\.[\w$]+)*)\s*=\s*["']\s*\$\(/g,
    message: m => `removed on<event>="$(…)" expression handler — ${m[2]} takes a plain function body now (native contract: event in scope, this = element). Run: node tools/codemod.mjs <file>`,
    at: m => m.index + m[1].length,
  },
  {
    id: 'behaviour-modifier',
    // on<event> with a dotted tail containing anything beyond the four
    // registration modifiers (behaviour lives in the handler body now).
    find: () => /(^|\s)(on[a-zA-Z][\w$-]*?((?:\.[\w$]+)+))\s*=\s*["']/g,
    message: m => {
      const removed = m[3].split('.').filter(Boolean)
        .filter(mod => !['capture', 'passive', 'once', 'outside'].includes(mod) && !/^\d+$/.test(mod));
      const hints = {
        prevent: 'event.preventDefault()', stop: 'event.stopPropagation()',
        self: 'if (event.target !== this) return', changed: 'if (changed(event)) …',
        debounce: 'debounce(event, 300, () => …)', enter: "keys(event, { Enter: … })",
        escape: "keys(event, { Escape: … })", esc: "keys(event, { Escape: … })",
        tab: "keys(event, { Tab: … })", space: "keys(event, { ' ': … })",
        up: "keys(event, { ArrowUp: … })", down: "keys(event, { ArrowDown: … })",
        left: "keys(event, { ArrowLeft: … })", right: "keys(event, { ArrowRight: … })",
      };
      const rewrites = removed.map(mod => hints[mod] || 'a body statement').join(', ');
      return `removed .${removed.join('/.')} event modifier(s) — write it in the handler body: ${rewrites} (registration-only modifiers: .capture .passive .once .outside). Run: node tools/codemod.mjs <file>`;
    },
    at: m => m.index + m[1].length,
    when: m => m[3].split('.').filter(Boolean)
      .some(mod => !['capture', 'passive', 'once', 'outside'].includes(mod) && !/^\d+$/.test(mod)),
  },
];

// Rules that apply to the WHOLE file (usage HTML outside jst blocks included).
const usageRules = [
  {
    id: 'button-nav-attr',
    // A <button jst-get/jst-action> has no automatic story under enhance-only
    // (#61): it must become one of two things, and only a human can pick.
    find: () => /<button\b[^>]*\bjst-(get|action)\s*=\s*["']([^"']*)["'][^>]*>/gi,
    message: m => `<button jst-${m[1]}="${m[2]}"> has no enhance-only equivalent - pick one: a navigation becomes a link (<a href="${m[2]}" jst-target="…">), an action becomes a one-button form (<form action="${m[2]}" method="post" jst-target="…"><button>…</button></form>)`,
    at: m => m.index,
  },
  {
    id: 'removed-nav-attrs',
    find: () => /\bjst-(get|action|trigger|load|poll|on[a-z]+)\s*=/g,
    message: m => `removed jst-${m[1]} (v0.6.0) — jst-nav enhances links/forms only (native href/action/method + jst-target/jst-swap); self-filling regions are <jst-include src="…">; other causes call swap() from a handler or component (see CHANGELOG migration table)`,
    at: m => m.index,
  },
];

// Opt-in --csp rule: native inline handlers in usage HTML (outside jst blocks)
// are evaluated by the browser and blocked under a strict CSP. jst templates
// compile on<event> to addEventListener, so they're exempt.
const cspRules = [
  {
    id: 'native-inline-handler',
    find: () => /(^|\s)(on[a-zA-Z][\w$-]*)\s*=\s*["']/g,
    message: m => `native inline ${m[2]}= handler — blocked under strict CSP. Use jst-on<event>="name" + JST.nav.shape(...) for jst-nav causes, or addEventListener in a script`,
    at: m => m.index + m[1].length,
  },
];

// Rules that apply inside a <script type="jst"> OPEN TAG (the attributes on the
// tag itself, not the template body).
const openTagRules = [
  {
    id: 'props-keyword',
    find: () => /(^|\s)props\s*=/g,
    message: () => 'renamed props="…" declaration — use attributes="…"',
    at: m => m.index + m[0].indexOf('props'),
  },
  {
    id: 'attrs-alias',
    find: () => /(^|\s)attrs\s*=/g,
    message: () => 'removed attrs="…" shorthand — use attributes="…"',
    at: m => m.index + m[0].indexOf('attrs'),
  },
];

// Rules for a vendored runtime file (whole-text scan), to catch a stale jst.js.
const runtimeRules = [
  { id: 'jst-ssr', find: () => /jst-ssr/g, message: () => 'jst-ssr marker present — SSR hydration was removed; this looks like a stale runtime' },
  { id: 'document-jst', find: () => /document\.jst\b/g, message: () => 'document.jst present — removed API; this looks like a stale runtime' },
];

function parseArgs(argv) {
  const files = [];
  const runtimes = [];
  let csp = false;
  let jsStrings = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--runtime') runtimes.push(argv[++i]);
    else if (arg === '--csp') csp = true;
    else if (arg === '--js-strings') jsStrings = true;
    else if (arg === '--help' || arg === '-h') usage(0);
    else if (arg.startsWith('--')) usage(1);
    else files.push(arg);
  }

  if (!files.length && !runtimes.length) usage(1);
  return { files, runtimes, csp, jsStrings };
}

function usage(code) {
  const out = code === 0 ? console.log : console.error;
  out('Usage: node tools/lint.mjs <files...> [--runtime <jst.js>] [--csp] [--js-strings]');
  out('  Scans <script type="jst"> blocks and usage HTML for removed JST syntax.');
  out('  --csp additionally flags native inline on<event>= handlers in usage HTML');
  out('        (evaluated by the browser; blocked under a strict CSP).');
  out('  --js-strings additionally scans string/template literals in .js/.mjs/.ts');
  out('        files for removed syntax (markup built in JS sails past the HTML scan).');
  process.exit(code);
}

/** Byte index -> { line, col } (1-based). */
function locate(source, index) {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < index; i++) {
    if (source[i] === '\n') { line++; lineStart = i + 1; }
  }
  return { line, col: index - lineStart + 1 };
}

/** Ranges [start, end) of every jst block body in the source. */
function jstBlockRanges(source) {
  const ranges = [];
  scriptPattern.lastIndex = 0;
  let match;
  while ((match = scriptPattern.exec(source))) {
    const bodyStart = match.index + match[0].indexOf('>', 0) + 1;
    ranges.push([bodyStart, bodyStart + match[2].length]);
  }
  return ranges;
}

/** Ranges [start, end) of every jst block OPEN TAG in the source. */
function jstOpenTagRanges(source) {
  const ranges = [];
  scriptPattern.lastIndex = 0;
  let match;
  while ((match = scriptPattern.exec(source))) {
    const openEnd = match.index + match[0].indexOf('>', 0);
    ranges.push([match.index, openEnd]);
  }
  return ranges;
}

function inRanges(index, ranges) {
  return ranges.some(([start, end]) => index >= start && index < end);
}

/**
 * Decode the HTML entities used in display code (&lt; &gt; &quot; &#39; &amp;).
 * Entities contain no newlines, so LINE numbers in the decoded text still match
 * the source; columns shift left of any entity.
 */
function decodeEntities(source) {
  return source
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

/** Run the removed-syntax rules over one text (raw source, or decoded examples). */
function runRemovedSyntaxRules(file, source, findings, suffix = '') {
  const ranges = jstBlockRanges(source);

  // Whole-file rules (usage HTML) run even when the text has no jst blocks.
  for (const rule of usageRules) {
    const re = rule.find();
    let match;
    while ((match = re.exec(source))) {
      const at = rule.at(match);
      const { line, col } = locate(source, at);
      findings.push({ file, line, col, message: rule.message(match) + suffix });
    }
  }

  if (ranges.length === 0) return;

  for (const rule of templateRules) {
    const re = rule.find();
    let match;
    while ((match = re.exec(source))) {
      if (rule.when && !rule.when(match)) continue;
      const at = rule.at(match);
      if (!inRanges(at, ranges)) continue;
      const { line, col } = locate(source, at);
      findings.push({ file, line, col, message: rule.message(match) + suffix });
    }
  }

  const openTagRanges = jstOpenTagRanges(source);
  for (const rule of openTagRules) {
    const re = rule.find();
    let match;
    while ((match = re.exec(source))) {
      const at = rule.at(match);
      if (!inRanges(at, openTagRanges)) continue;
      const { line, col } = locate(source, at);
      findings.push({ file, line, col, message: rule.message(match) + suffix });
    }
  }
}

function scanFile(file, findings, csp) {
  let source;
  try {
    source = fs.readFileSync(file, 'utf8');
  } catch (error) {
    console.error(`lint: cannot read ${file}: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  runRemovedSyntaxRules(file, source, findings);

  // Docs and landing pages show code as ENTITY-ESCAPED text inside <pre>
  // blocks, which the raw scan can't see — exactly where stale examples rot
  // unnoticed. Decode and scan again (removed-syntax rules only; the CSP rule
  // stays raw-only because display snippets legitimately teach native
  // handlers). Lines match the source; columns may shift left of entities.
  if (source.includes('&lt;')) {
    // Strip syntax-highlighter <span> wrappers too: they sit between an
    // attribute name and its value in display snippets, hiding removed syntax
    // from the rules. Strip BEFORE decoding — raw span attributes hold only
    // entity-escaped quotes/angle brackets, so the tag boundary is exact.
    // Spans contain no newlines, so line numbers still match.
    const decoded = decodeEntities(source.replace(/<\/?span[^>]*>/g, ''));
    runRemovedSyntaxRules(file, decoded, findings, ' [in entity-escaped example code]');
  }

  if (csp) {
    const ranges = jstBlockRanges(source);
    for (const rule of cspRules) {
      const re = rule.find();
      let match;
      while ((match = re.exec(source))) {
        const at = rule.at(match);
        if (inRanges(at, ranges)) continue;   // template handlers compile to addEventListener — exempt
        const { line, col } = locate(source, at);
        findings.push({ file, line, col, message: rule.message(match) });
      }
    }
  }
}

function scanRuntime(file, findings) {
  let source;
  try {
    source = fs.readFileSync(file, 'utf8');
  } catch (error) {
    console.error(`lint: cannot read runtime ${file}: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  for (const rule of runtimeRules) {
    const re = rule.find();
    let match;
    while ((match = re.exec(source))) {
      const { line, col } = locate(source, match.index);
      findings.push({ file, line, col, message: rule.message(match) });
    }
  }
}

/**
 * Opt-in --js-strings pass (#61): markup built in JS template literals or
 * quoted strings never reaches the HTML scan. Extract every string/template
 * literal and run the removed-syntax rules over its content; line numbers
 * point into the JS source.
 */
const jsLiteralPattern = /`(?:[^`\\]|\\.)*`|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g;
function scanJsStrings(file, findings) {
  let source;
  try {
    source = fs.readFileSync(file, 'utf8');
  } catch (error) {
    console.error(`lint: cannot read ${file}: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  let match;
  while ((match = jsLiteralPattern.exec(source))) {
    const literal = match[0].slice(1, -1);
    if (!/[<>]|jst-/.test(literal)) continue;   // cheap gate: HTML-ish content only
    const inner = [];
    runRemovedSyntaxRules(file, literal, inner, ' [in JS string]');
    for (const f of inner) {
      // Re-locate against the whole file: the literal starts at match.index + 1.
      const { line, col } = locate(source, match.index + 1);
      findings.push({ ...f, line: line + f.line - 1, col: f.line === 1 ? col + f.col - 1 : f.col });
    }
  }
}

function main() {
  const { files, runtimes, csp, jsStrings } = parseArgs(process.argv.slice(2));
  const findings = [];

  for (const file of files) {
    if (jsStrings && /\.(js|mjs|ts)$/.test(file)) scanJsStrings(file, findings);
    else scanFile(file, findings, csp);
  }
  for (const runtime of runtimes) scanRuntime(runtime, findings);

  if (findings.length === 0) {
    console.log(`lint: clean — no removed JST syntax in ${files.length + runtimes.length} file(s).`);
    return;
  }

  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.col - b.col);
  for (const f of findings) {
    console.error(`${f.file}:${f.line}:${f.col}: ${f.message}`);
  }
  console.error(`\nlint: ${findings.length} issue${findings.length === 1 ? '' : 's'} found.`);
  process.exit(1);
}

main();

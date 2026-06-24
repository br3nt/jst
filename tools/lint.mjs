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
];

// Rules for a vendored runtime file (whole-text scan), to catch a stale jst.js.
const runtimeRules = [
  { id: 'jst-ssr', find: () => /jst-ssr/g, message: () => 'jst-ssr marker present — SSR hydration was removed; this looks like a stale runtime' },
  { id: 'document-jst', find: () => /document\.jst\b/g, message: () => 'document.jst present — removed API; this looks like a stale runtime' },
];

function parseArgs(argv) {
  const files = [];
  const runtimes = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--runtime') runtimes.push(argv[++i]);
    else if (arg === '--help' || arg === '-h') usage(0);
    else if (arg.startsWith('--')) usage(1);
    else files.push(arg);
  }

  if (!files.length && !runtimes.length) usage(1);
  return { files, runtimes };
}

function usage(code) {
  const out = code === 0 ? console.log : console.error;
  out('Usage: node tools/lint.mjs <files...> [--runtime <jst.js>]');
  out('  Scans <script type="jst"> blocks for removed v0.1 syntax.');
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

function inRanges(index, ranges) {
  return ranges.some(([start, end]) => index >= start && index < end);
}

function scanFile(file, findings) {
  let source;
  try {
    source = fs.readFileSync(file, 'utf8');
  } catch (error) {
    console.error(`lint: cannot read ${file}: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const ranges = jstBlockRanges(source);
  if (ranges.length === 0) return;

  for (const rule of templateRules) {
    const re = rule.find();
    let match;
    while ((match = re.exec(source))) {
      const at = rule.at(match);
      if (!inRanges(at, ranges)) continue;
      const { line, col } = locate(source, at);
      findings.push({ file, line, col, message: rule.message(match) });
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

function main() {
  const { files, runtimes } = parseArgs(process.argv.slice(2));
  const findings = [];

  for (const file of files) scanFile(file, findings);
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

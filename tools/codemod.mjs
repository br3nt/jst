#!/usr/bin/env node
/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
/**
 * Codemod: migrate the removed v0.1 `@event="$(fn)"` binding syntax to the v0.2
 * `onevent="$(fn)"` form, preserving modifiers (`@click.stop` -> `onclick.stop`)
 * and the `$(...)` value verbatim.
 *
 * It rewrites bindings ONLY inside `<script type="jst">` blocks, so it is safe to
 * point at any file — `.html`, `.erb`, a server view, a fragment — without
 * touching `@media`, `@import`, decorators, or email addresses in the
 * surrounding markup/CSS. This is the deliberate advantage over a blind
 * `sed 's/@/on/'` glob.
 *
 * Usage:
 *   node tools/codemod.mjs <files...>            # rewrite in place
 *   node tools/codemod.mjs <files...> --dry-run  # preview, write nothing
 */
import fs from 'node:fs';

// `<script ... type="jst" ...> ... </script>` — same shape precompile.mjs uses.
const scriptPattern = /(<script\b[^>]*\btype\s*=\s*(['"])jst\2[^>]*>)([\s\S]*?)(<\/script\s*>)/gi;

// Attribute-position legacy event binding, mirroring interpreter.js's
// legacyEventTailPattern: `@event` (+ optional `.modifiers`) followed by `=`.
// The leading (^|\s) keeps it in attribute position so `foo@bar` (an email) and
// `$(a @ b)` never match.
const legacyEventPattern = /(^|\s)@([a-zA-Z][\w$-]*(?:\.[\w$-]+)*)(\s*=\s*["'])/g;

function parseArgs(argv) {
  const files = [];
  let dryRun = false;

  for (const arg of argv) {
    if (arg === '--dry-run' || arg === '--dry') dryRun = true;
    else if (arg === '--help' || arg === '-h') usage(0);
    else if (arg.startsWith('--')) usage(1);
    else files.push(arg);
  }

  if (!files.length) usage(1);
  return { files, dryRun };
}

function usage(code) {
  const out = code === 0 ? console.log : console.error;
  out('Usage: node tools/codemod.mjs <files...> [--dry-run]');
  out('  Rewrites @event="$(fn)" -> onevent="$(fn)" inside <script type="jst"> blocks.');
  process.exit(code);
}

/** Rewrite legacy bindings in a single jst-template body; returns count too. */
function migrateBody(body) {
  let count = 0;
  const migrated = body.replace(legacyEventPattern, (match, lead, eventAndMods, tail) => {
    count++;
    return `${lead}on${eventAndMods}${tail}`;
  });
  return { migrated, count };
}

/** Rewrite every jst block in a file's source. Non-jst text is untouched. */
function migrateSource(source) {
  let total = 0;
  const out = source.replace(scriptPattern, (whole, open, _quote, body, close) => {
    const { migrated, count } = migrateBody(body);
    total += count;
    return `${open}${migrated}${close}`;
  });
  return { out, total };
}

function main() {
  const { files, dryRun } = parseArgs(process.argv.slice(2));
  let changedFiles = 0;
  let changedBindings = 0;

  for (const file of files) {
    let source;
    try {
      source = fs.readFileSync(file, 'utf8');
    } catch (error) {
      console.error(`codemod: cannot read ${file}: ${error.message}`);
      process.exitCode = 1;
      continue;
    }

    const { out, total } = migrateSource(source);
    if (total === 0) continue;

    changedFiles++;
    changedBindings += total;
    if (!dryRun) fs.writeFileSync(file, out);
    console.log(`${dryRun ? 'would migrate' : 'migrated'} ${file}: ${total} binding${total === 1 ? '' : 's'}`);
  }

  if (changedFiles === 0) {
    console.log('codemod: no @event bindings found in any <script type="jst"> block.');
  } else {
    const verb = dryRun ? 'would update' : 'updated';
    console.log(`codemod: ${verb} ${changedBindings} binding${changedBindings === 1 ? '' : 's'} across ${changedFiles} file${changedFiles === 1 ? '' : 's'}.`);
    if (dryRun) console.log('codemod: dry run — re-run without --dry-run to apply.');
  }
}

main();

#!/usr/bin/env node
/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
/**
 * Codemod: migrate removed JST syntax inside <script type="jst"> blocks to the
 * v0.6.0 uniform handler model (on<event> = a plain function body, the native
 * inline-handler contract):
 *   - `@event="$(fn)"` -> `onevent` (then migrated like any handler)
 *   - v0.5 expression handlers -> function bodies:
 *       onclick="$(() => el.count++)"   -> onclick="el.count++"
 *       onclick="$(handler)"            -> onclick="handler(event)"
 *       onclick="$(e => save(e))"       -> onclick="const e = event; save(e)"
 *   - v0.5 wrapper combinators -> body statements:
 *       onsubmit="$(prevent(fn))"       -> onsubmit="event.preventDefault(); fn(event)"
 *       oninput="$(changed(debounce(300, fn)))"
 *         -> oninput="if (!changed(event)) return; debounce(event, 300, () => { fn(event) })"
 *       onkeydown="$(keys({ Enter: fn }))" -> onkeydown="keys(event, { Enter: fn })"
 *   - v0.4 behaviour modifiers -> body statements (registration modifiers
 *     .capture .passive .once .outside stay on the attribute name):
 *       onsubmit.prevent="$(fn)"        -> onsubmit="event.preventDefault(); fn(event)"
 *       onkeydown.enter="$(fn)"         -> onkeydown="if (event.key !== 'Enter') return; fn(event)"
 *       oninput.debounce.300="$(fn)"    -> oninput="debounce(event, 300, () => { fn(event) })"
 *     Guards run synchronously; debounced work is deferred — the correct
 *     composition even where the old modifier chain secretly reordered for you.
 *   - open-tag `attrs="..."` -> `attributes="..."`
 *
 * It rewrites bindings ONLY inside `<script type="jst">` blocks, so it is safe to
 * point at any file — `.html`, `.erb`, a server view, a fragment — without
 * touching `@media`, `@import`, decorators, or email addresses in the
 * surrounding markup/CSS. This is the deliberate advantage over a blind
 * string replacement glob.
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
const attrsAliasNamePattern = /(^|\s)attrs(\s*=)/i;
const attrsAliasAttributePattern = /\s+attrs\s*=\s*(?:"[^"]*"|'[^']*'|\S+)/gi;
const attributesNamePattern = /(^|\s)attributes\s*=/i;

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
  out('  Inside <script type="jst"> blocks, rewrites @event= and the v0.4/v0.5 handler');
  out('  spellings (dotted behaviour modifiers, $(…) expression handlers, wrapper');
  out('  combinators) to v0.6.0 function-body handlers, and attrs="…" -> attributes="…".');
  process.exit(code);
}

// Registration modifiers survive on the attribute name; everything else was a
// behaviour modifier and becomes statements in the handler body.
const registrationMods = new Set(['capture', 'passive', 'once', 'outside']);
const keyModMap = {
  enter: 'Enter', escape: 'Escape', esc: 'Escape', tab: 'Tab', space: ' ',
  up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
};

/** Slice out a balanced (…) group starting at `open` (the index of '('). */
function balancedGroup(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')' && --depth === 0) return src.slice(open + 1, i);
  }
  return null;
}

/** Split "MS, HANDLER" at the first top-level comma. */
function splitFirstArg(src) {
  let depth = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '(' || ch === '{' || ch === '[') depth++;
    else if (ch === ')' || ch === '}' || ch === ']') depth--;
    else if (ch === ',' && depth === 0) return [src.slice(0, i).trim(), src.slice(i + 1).trim()];
  }
  return null;
}

/** Strip `{ … }` from a braced arrow body; leave expression bodies alone. */
function arrowBodyToStatements(bodySrc) {
  const trimmed = bodySrc.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed.slice(1, -1).trim();
  return trimmed;
}

// Rewrite keys({...}) map VALUES that are v0.5 wrapper-combinator calls
// (prevent(fn) / stop(fn)) into plain handler functions.
function rewriteKeysMap(mapSrc) {
  let out = '';
  let i = 0;
  const wrapperAt = /\b(prevent|stop)\s*\(/g;
  let match;
  while ((match = wrapperAt.exec(mapSrc))) {
    const open = mapSrc.indexOf('(', match.index + match[1].length);
    const inner = balancedGroup(mapSrc, open);
    if (inner === null) continue;
    const call = match[1] === 'prevent' ? 'event.preventDefault()' : 'event.stopPropagation()';
    out += mapSrc.slice(i, match.index)
      + `event => { ${call}; return (${inner.trim()})(event); }`;
    i = open + inner.length + 2;
    wrapperAt.lastIndex = i;
  }
  return out + mapSrc.slice(i);
}

/**
 * Convert a v0.5 handler EXPRESSION (something that evaluated to a handler
 * function) into v0.6 function-body STATEMENTS. Handles the wrapper
 * combinators, arrows, identifiers, and async; falls back to calling the
 * expression, which is semantically correct for any stateless handler value.
 */
function expressionToBody(expr) {
  expr = expr.trim();
  let m;

  // v0.5 wrapper combinators → statements (guards sync, work deferred)
  if ((m = expr.match(/^prevent\s*\(([\s\S]*)\)$/)))
    return joinStatements('event.preventDefault();', m[1].trim() && expressionToBody(m[1]));
  if ((m = expr.match(/^stop\s*\(([\s\S]*)\)$/)))
    return joinStatements('event.stopPropagation();', m[1].trim() && expressionToBody(m[1]));
  if ((m = expr.match(/^self\s*\(([\s\S]*)\)$/)))
    return joinStatements('if (event.target !== this) return;', expressionToBody(m[1]));
  if ((m = expr.match(/^changed\s*\(([\s\S]*)\)$/)))
    return joinStatements('if (!changed(event)) return;', expressionToBody(m[1]));
  if ((m = expr.match(/^throttle\s*\(([\s\S]*)\)$/))) {
    const args = splitFirstArg(m[1]);
    if (args) return joinStatements(`if (!throttle(event, ${args[0]})) return;`, expressionToBody(args[1]));
  }
  if ((m = expr.match(/^debounce\s*\(([\s\S]*)\)$/))) {
    const args = splitFirstArg(m[1]);
    if (args) return `debounce(event, ${args[0]}, () => { ${expressionToBody(args[1])} })`;
  }
  if ((m = expr.match(/^keys\s*\(([\s\S]*)\)$/)))
    return `keys(event, ${rewriteKeysMap(m[1].trim())})`;

  // bare identifier → call it with the event
  if (/^[a-zA-Z_$][\w$.]*$/.test(expr)) return `${expr}(event)`;

  // zero-param arrow → its body IS the handler body
  if ((m = expr.match(/^\(\s*\)\s*=>\s*([\s\S]*)$/))) return arrowBodyToStatements(m[1]);

  // single-param arrow → alias the param to `event` (or use it directly)
  if ((m = expr.match(/^(?:\(\s*([a-zA-Z_$][\w$]*)\s*\)|([a-zA-Z_$][\w$]*))\s*=>\s*([\s\S]*)$/))) {
    const param = m[1] || m[2];
    const body = arrowBodyToStatements(m[3]);
    return param === 'event' ? body : `const ${param} = event; ${body}`;
  }

  // async / anything else: calling the expression with the event is correct
  // for any stateless handler value (async handlers fire-and-forget natively).
  return `(${expr})(event)`;
}

function joinStatements(...parts) {
  return parts.filter(Boolean).map(p => p.trim()).join(' ').replace(/;\s*$/, ';').replace(/;$/, ';');
}

/**
 * Rewrite every `on<event>[.mods]="$(expr)"` binding (v0.4 and v0.5 spellings)
 * to a v0.6 function body. The expression is extracted with a balanced-paren
 * scan (good enough for handler expressions; a paren imbalanced inside a
 * string literal is left untouched — lint will flag it).
 */
function migrateHandlerBindings(body) {
  const bindingPattern = /(^|\s)(on[a-zA-Z][\w$-]*)((?:\.[\w$]+)*)(\s*=\s*)(["'])\s*\$\(/g;
  let count = 0;
  let result = '';
  let last = 0;
  let match;
  while ((match = bindingPattern.exec(body))) {
    const exprStart = bindingPattern.lastIndex;   // just after `$(`
    let i = exprStart;
    let depth = 1;
    while (i < body.length && depth > 0) {
      if (body[i] === '(') depth++;
      else if (body[i] === ')') depth--;
      i++;
    }
    const quote = match[5];
    const closeQuote = body.indexOf(quote, i);
    if (depth !== 0 || closeQuote === -1 || body.slice(i, closeQuote).trim() !== '') continue;

    const expr = body.slice(exprStart, i - 1);
    const mods = match[3].split('.').filter(Boolean);
    const kept = mods.filter(mod => registrationMods.has(mod));

    // Inner conversion first, then v0.4 dotted behaviour modifiers as body
    // statements: guards run synchronously, debounced work is deferred.
    let newBody = expressionToBody(expr);
    const debounceIdx = mods.indexOf('debounce');
    if (debounceIdx !== -1) {
      const n = /^\d+$/.test(mods[debounceIdx + 1] || '') ? mods[debounceIdx + 1] : '250';
      newBody = `debounce(event, ${n}, () => { ${newBody} })`;
    }
    if (mods.includes('stop')) newBody = joinStatements('event.stopPropagation();', newBody);
    if (mods.includes('prevent')) newBody = joinStatements('event.preventDefault();', newBody);
    if (mods.includes('self')) newBody = joinStatements('if (event.target !== this) return;', newBody);
    const keyMod = mods.find(mod => keyModMap[mod]);
    if (keyMod) newBody = joinStatements(`if (event.key !== '${keyModMap[keyMod]}') return;`, newBody);

    // A rewritten body must not contain the delimiting quote.
    if (newBody.includes(quote)) { bindingPattern.lastIndex = closeQuote + 1; continue; }

    const name = match[2] + (kept.length ? '.' + kept.join('.') : '');
    result += body.slice(last, match.index)
      + match[1] + name + match[4] + quote + newBody + quote;
    last = closeQuote + 1;
    bindingPattern.lastIndex = last;
    count++;
  }
  result += body.slice(last);
  return { migrated: result, count };
}

/** Rewrite legacy bindings in a single jst-template body; returns count too. */
function migrateBody(body) {
  let count = 0;
  const legacyMigrated = body.replace(legacyEventPattern, (match, lead, eventAndMods, tail) => {
    count++;
    return `${lead}on${eventAndMods}${tail}`;
  });
  // Then migrate handler bindings (including ones the @event pass just produced).
  const handlerResult = migrateHandlerBindings(legacyMigrated);
  return { migrated: handlerResult.migrated, count: count + handlerResult.count };
}

function migrateOpenTag(open) {
  if (!attrsAliasNamePattern.test(open)) return { migrated: open, count: 0 };

  if (attributesNamePattern.test(open)) {
    return { migrated: open.replace(attrsAliasAttributePattern, ''), count: 1 };
  }

  return {
    migrated: open.replace(attrsAliasNamePattern, '$1attributes$2'),
    count: 1,
  };
}

/** Rewrite every jst block in a file's source. Non-jst text is untouched. */
function migrateSource(source) {
  let total = 0;
  const out = source.replace(scriptPattern, (whole, open, _quote, body, close) => {
    const openResult = migrateOpenTag(open);
    const bodyResult = migrateBody(body);
    total += openResult.count + bodyResult.count;
    return `${openResult.migrated}${bodyResult.migrated}${close}`;
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
    console.log(`${dryRun ? 'would migrate' : 'migrated'} ${file}: ${total} change${total === 1 ? '' : 's'}`);
  }

  if (changedFiles === 0) {
    console.log('codemod: no @event bindings or attrs= declarations found in any <script type="jst"> block.');
  } else {
    const verb = dryRun ? 'would update' : 'updated';
    console.log(`codemod: ${verb} ${changedBindings} change${changedBindings === 1 ? '' : 's'} across ${changedFiles} file${changedFiles === 1 ? '' : 's'}.`);
    if (dryRun) console.log('codemod: dry run — re-run without --dry-run to apply.');
  }
}

main();

/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
// verify.mjs — headless validation for parity examples.
//
// Loads each given .html file in headless Chrome, reports console/JST errors,
// and runs one assertion per page. Pages may provide window.__parityTest(); the
// fallback exercises the first control and requires an observable state/DOM
// change. Static examples get a rendered-output assertion. Self-contained: spawns its own
// static server (ephemeral port) and Chrome (pid-derived debug port) so several
// copies can run in parallel without colliding.
//
//   node framework_parity/verify.mjs framework_parity/htmx/*.html
//
// Exit code 0 if every page loaded cleanly, 1 otherwise.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticRoot = path.resolve(__dirname, '..'); // custom_js_components
const debugPort = 9000 + (process.pid % 900);

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: node verify.mjs <file.html> [...]');
  process.exit(2);
}

function urlPathFor(file) {
  const abs = path.resolve(file);
  return '/' + path.relative(staticRoot, abs).split(path.sep).join('/');
}

function createStaticServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const filePath = path.join(staticRoot, decodeURIComponent(url.pathname));
    if (!filePath.startsWith(staticRoot)) { res.writeHead(403).end(); return; }
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404).end('not found'); return; }
      const type = ({
        '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
        '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json',
        '.css': 'text/css',
      })[path.extname(filePath)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type }).end(data);
    });
  });
}

async function waitForJson(url, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const r = await fetch(url); if (r.ok) return r.json(); } catch {}
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error(`timeout waiting for ${url}`);
}

async function stopChild(child, timeoutMs = 2000) {
  if (!child || child.exitCode !== null) return;
  await new Promise(resolve => {
    const timeout = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, timeoutMs);
    child.once('exit', () => { clearTimeout(timeout); resolve(); });
    child.kill('SIGTERM');
  });
}

async function main() {
  const server = createStaticServer();
  await new Promise((res, rej) => { server.once('error', rej); server.listen(0, '127.0.0.1', res); });
  const port = server.address().port;

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jst-verify-'));
  const chromeArgs = [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    // Keep rAF/timers running at full rate: headless Chrome otherwise throttles or
    // pauses a backgrounded/occluded renderer, which stalls CSS transitions and makes
    // the transition assertions flaky (issue #18).
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${userDataDir}`, 'about:blank',
  ];
  if (process.platform === 'linux') {
    chromeArgs.push('--no-sandbox', '--disable-dev-shm-usage');
  }
  const chrome = spawn(process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', chromeArgs, { stdio: 'ignore' });

  const results = [];
  try {
    const targets = await waitForJson(`http://127.0.0.1:${debugPort}/json/list`);
    const page = targets.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);

    let nextId = 0;
    const pending = new Map();
    let collected = [];
    const cdp = (method, params = {}) => {
      const id = ++nextId;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    };
    ws.addEventListener('message', evt => {
      const msg = JSON.parse(evt.data);
      if (msg.id) {
        const entry = pending.get(msg.id);
        if (entry) { pending.delete(msg.id); msg.error ? entry.reject(new Error(msg.error.message)) : entry.resolve(msg.result); }
        return;
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        collected.push(msg.params.args.map(a => a.value ?? a.description ?? a.type).join(' '));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        collected.push(d.exception?.description || d.text || 'exception');
      }
    });

    await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
    await cdp('Page.enable');
    await cdp('Runtime.enable');

    for (const file of files) {
      collected = [];
      const target = `http://127.0.0.1:${port}${urlPathFor(file)}`;
      await cdp('Page.navigate', { url: target });
      await new Promise(r => setTimeout(r, 1400));

      // also surface JST render errors that may have been grouped
      const ready = await cdp('Runtime.evaluate', {
        expression: 'JSON.stringify({ ready: window.__exampleReady === true, customEls: [...document.querySelectorAll("*")].filter(e => e.tagName.includes("-")).length })',
        returnByValue: true,
      }).then(r => { try { return JSON.parse(r.result.value); } catch { return {}; } });

      const assertion = await cdp('Runtime.evaluate', {
        expression: `(async () => {
          if (typeof window.__parityTest === 'function') {
            const result = await window.__parityTest();
            return { kind: 'declared', ok: result === true || result?.ok === true, detail: result?.detail || '' };
          }
          const root = [...document.querySelectorAll('*')].find(el => el.tagName.includes('-'));
          const control = document.querySelector('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
          if (!control) return { kind: 'render', ok: Boolean(root && root.innerHTML.trim()), detail: 'custom element rendered output' };
          const before = document.body.innerHTML;
          const beforeState = JSON.stringify({ value: control.value, checked: control.checked, selectedIndex: control.selectedIndex });
          if (control.matches('input[type="text"], input[type="search"], input[type="email"], input[type="url"], input[type="tel"], input[type="password"], input[type="number"], input:not([type]), textarea')) {
            control.value = (control.value || '') + 'x';
            control.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'x' }));
            control.dispatchEvent(new Event('change', { bubbles: true }));
          } else if (control.matches('select')) {
            if (control.options.length > 1) control.selectedIndex = (control.selectedIndex + 1) % control.options.length;
            control.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            control.click();
          }
          await new Promise(resolve => setTimeout(resolve, 700));
          const afterState = JSON.stringify({ value: control.value, checked: control.checked, selectedIndex: control.selectedIndex });
          return { kind: 'interaction', ok: document.body.innerHTML !== before || afterState !== beforeState, detail: control.tagName.toLowerCase() + (control.id ? '#' + control.id : '') };
        })()`,
        awaitPromise: true,
        returnByValue: true,
      }).then(r => r.result?.value || { kind: 'unknown', ok: false, detail: 'assertion returned no value' });

      const errors = collected.filter(Boolean);
      const jstErrors = errors.filter(e => /JST Render Error/.test(e));
      results.push({ file, errors, jstErrors, assertion, ...ready });
    }
    ws.close();
  } finally {
    await stopChild(chrome);
    server.close();
    try { fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
  }

  let failures = 0;
  for (const r of results) {
    const ok = r.errors.length === 0 && r.ready === true && r.assertion?.ok === true;
    if (!ok) failures++;
    const tag = ok ? 'PASS' : 'FAIL';
    console.log(`${tag}  ${path.relative(staticRoot, path.resolve(r.file))}  (custom-elements: ${r.customEls ?? '?'}, ready: ${r.ready ?? '?'}, assertion: ${r.assertion?.kind ?? 'none'}${r.assertion?.detail ? ` ${r.assertion.detail}` : ''})`);
    r.errors.forEach(e => console.log(`        • ${e.slice(0, 240)}`));
  }
  const interactions = results.filter(r => r.assertion?.kind === 'interaction' || r.assertion?.kind === 'declared').length;
  const renders = results.filter(r => r.assertion?.kind === 'render').length;
  console.log(`\n${results.length - failures}/${results.length} pages passed readiness, error, and per-page assertions (${interactions} interaction, ${renders} rendered-output).`);
  process.exit(failures ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });

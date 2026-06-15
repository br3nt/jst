/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getArg(name, fallback) {
  const arg = process.argv.find(value => value.startsWith(`--${name}=`));
  return arg ? arg.split('=').slice(1).join('=') : fallback;
}

function createStaticServer(rootDir) {
  return http.createServer((req, res) => {
    const requestPath = req.url === '/' ? '/run_tests.html' : req.url;
    const url = new URL(requestPath, 'http://127.0.0.1');
    const filePath = path.join(rootDir, decodeURIComponent(url.pathname));

    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const ext = path.extname(filePath);
      const contentType = ({
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.mjs': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
      })[ext] || 'application/octet-stream';

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });
  });
}

async function fetchJson(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const payload = await response.json();
    return { response, payload };
  } finally {
    clearTimeout(timeout);
  }
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server.address().port;
}

function parseSummaryFromDom(dom) {
  const match = dom.match(/<div id="browser-test-summary"[^>]*data-status="([^"]+)"[^>]*data-total="([^"]+)"[^>]*data-passed="([^"]+)"[^>]*data-failed="([^"]+)"/);
  if (!match) throw new Error('Could not find browser test summary in rendered DOM');

  return {
    status: match[1],
    total: Number(match[2]),
    passed: Number(match[3]),
    failed: Number(match[4]),
  };
}

async function waitForJson(baseUrl, pathName, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const { response, payload } = await fetchJson(`${baseUrl}${pathName}`, {}, 1000);
      if (response.ok) return payload;
    } catch {
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  throw new Error(`Timed out waiting for ${baseUrl}${pathName}`);
}

async function runChrome(url) {
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jst-chrome-'));
  const port = 9222;

  try {
    const chrome = spawn(chromePath, [
      '--headless=new',
      '--disable-gpu',
      '--disable-background-networking',
      '--disable-breakpad',
      '--disable-client-side-phishing-detection',
      '--disable-component-extensions-with-background-pages',
      '--disable-component-update',
      '--disable-default-apps',
      '--disable-domain-reliability',
      '--disable-extensions',
      '--disable-features=AutofillServerCommunication,CertificateTransparencyComponentUpdater,MediaRouter,OptimizationHints,Translate',
      '--no-first-run',
      '--no-default-browser-check',
      '--no-pings',
      '--password-store=basic',
      `--remote-debugging-port=${port}`,
      '--use-mock-keychain',
      `--user-data-dir=${userDataDir}`,
      'about:blank',
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';

    chrome.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    chrome.once('error', error => {
      throw error;
    });

    const baseUrl = `http://127.0.0.1:${port}`;
    const targets = await waitForJson(baseUrl, '/json/list');
    const pageTarget = targets.find(target => target.type === 'page');

    if (!pageTarget?.webSocketDebuggerUrl) {
      throw new Error('Could not find a Chrome page target for DevTools automation');
    }

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    let nextId = 0;
    const pending = new Map();

    const send = (method, params = {}) => {
      const id = ++nextId;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
    };

    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (!message.id) return;

      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id);

      if (message.error) {
        entry.reject(new Error(message.error.message || 'Chrome DevTools error'));
      } else {
        entry.resolve(message.result);
      }
    });

    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });

    try {
      await send('Page.enable');
      await send('Runtime.enable');
      await send('Page.navigate', { url });

      const timeoutAt = Date.now() + 10000;
      while (Date.now() < timeoutAt) {
        const result = await send('Runtime.evaluate', {
          expression: 'window.__jstTestSummary || { status: "running", total: 0, passed: 0, failed: 0 }',
          returnByValue: true,
        });
        const summary = result.result?.value;
        if (summary?.status && summary.status !== 'running') {
          if (summary.failed > 0) {
            const failedNames = await send('Runtime.evaluate', {
              expression: `[...document.querySelectorAll('.test-failed .test-name')].map(el => el.textContent)`,
              returnByValue: true,
            });
            summary.failedNames = failedNames.result?.value || [];
          }
          return summary;
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      throw new Error(`Chrome headless timed out.\n${stderr}`.trim());
    } finally {
      ws.close();
      chrome.kill('SIGINT');
      await new Promise(resolve => chrome.once('exit', resolve));
    }
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

async function waitForWebDriver(baseUrl, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/status`);
      if (response.ok) return;
    } catch {
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  throw new Error('Safari WebDriver did not start in time');
}

async function runSafari(url) {
  const port = 4444;
  const baseUrl = `http://127.0.0.1:${port}`;
  const driver = spawn('safaridriver', ['-p', String(port)], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let driverStderr = '';
  driver.stderr.on('data', chunk => {
    driverStderr += chunk.toString();
  });

  let sessionId = null;

  try {
    await waitForWebDriver(baseUrl);

    const { response: sessionResponse, payload: sessionPayload } = await fetchJson(`${baseUrl}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        capabilities: {
          alwaysMatch: { browserName: 'Safari' },
        },
      }),
    }, 10000);

    if (!sessionResponse.ok || sessionPayload.value?.error) {
      throw new Error(`${sessionPayload.value?.message || 'Failed to create Safari session'}\n${driverStderr}`.trim());
    }

    sessionId = sessionPayload.value.sessionId;

    await fetchJson(`${baseUrl}/session/${sessionId}/url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }, 10000);

    const timeoutAt = Date.now() + 10000;
    while (Date.now() < timeoutAt) {
      const { payload } = await fetchJson(`${baseUrl}/session/${sessionId}/execute/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: 'return window.__jstTestSummary || { status: "running", total: 0, passed: 0, failed: 0 };',
          args: [],
        }),
      }, 5000);
      const summary = payload.value;

      if (summary?.status && summary.status !== 'running') {
        if (summary.failed > 0) {
          const { payload: failedPayload } = await fetchJson(`${baseUrl}/session/${sessionId}/execute/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              script: `return [...document.querySelectorAll('.test-failed .test-name')].map(el => el.textContent);`,
              args: [],
            }),
          }, 5000);
          summary.failedNames = failedPayload.value || [];
        }
        return summary;
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    throw new Error(`Timed out waiting for Safari browser tests to finish.\n${driverStderr}`.trim());
  } finally {
    if (sessionId) {
      await fetch(`${baseUrl}/session/${sessionId}`, { method: 'DELETE' }).catch(() => {});
    }

    driver.kill('SIGINT');
    await Promise.race([
      new Promise(resolve => driver.once('exit', resolve)),
      new Promise(resolve => setTimeout(resolve, 2000)),
    ]);
  }
}

async function main() {
  const browser = getArg('browser', 'chrome');
  const server = createStaticServer(__dirname);
  const port = await listen(server);
  const url = `http://127.0.0.1:${port}/run_tests.html`;

  try {
    const summary = browser === 'safari'
      ? await runSafari(url)
      : await runChrome(url);

    console.log(`${browser}: ${summary.passed}/${summary.total} passed, ${summary.failed} failed`);
    if (summary.failedNames?.length) {
      console.log(`Failed: ${summary.failedNames.join(', ')}`);
    }

    if (summary.status !== 'passed' || summary.failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    server.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
// End-to-end smoke test for the agentic feed prototype.
// Spawns server.mjs + headless Chrome, then drives the feed like a user.
// Run with: node agentic_feed/run_feed_smoke.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_PORT = 4180;
const DEBUG_PORT = 9224;

const scenario = `(async () => {
  const until = async (fn, timeout = 9000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try { const value = fn(); if (value) return value; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('timeout waiting for: ' + fn.toString().slice(0, 100));
  };
  const send = text => {
    const input = document.querySelector('#composer input');
    input.value = text;
    document.querySelector('#composer button').click();
  };

  // 1. welcome card arrives over SSE
  await until(() => document.querySelectorAll('#feed message-card').length >= 1);

  // 1b. the security thesis: hostile content flowing through the live
  // SSE -> attribute -> render path stays inert. This is the property the
  // whole two-plane model exists to guarantee.
  send('<img src=x onerror="window.__pwned = true">');
  await until(() => [...document.querySelectorAll('#feed .from-human .message-text')]
    .some(el => el.textContent.includes('onerror')));
  const xssCard = [...document.querySelectorAll('#feed .from-human .message-text')]
    .find(el => el.textContent.includes('onerror'));
  const xssRenderedAsText = xssCard.textContent.includes('<img');
  const xssNoImgElement = !document.querySelector('#feed message-card img');
  const xssNoExecution = window.__pwned === undefined;

  // 2. ask for the weight tracker — fragment + definition arrive
  send('show my weight');
  await until(() => document.querySelector('weight-card .metric'));
  const sparkBars = document.querySelectorAll('weight-card .spark-bar').length;
  const initialMetric = document.querySelector('weight-card .metric strong').textContent;
  const formProjected = !!document.querySelector('weight-card .doc-form input[name="kg"]');

  // 3. submit the affordance — interaction event + in-place morph
  const kgInput = document.querySelector('weight-card input[name="kg"]');
  kgInput.value = '83.8';
  document.querySelector('weight-card .affordance button').click();
  await until(() => document.querySelector('weight-card .metric strong').textContent === '83.8');
  const morphedMetric = document.querySelector('weight-card .metric strong').textContent;
  const inputSurvivedMorph = kgInput === document.querySelector('weight-card input[name="kg"]');
  const interactionEcho = [...document.querySelectorAll('.from-system .message-text')]
    .some(el => el.textContent.includes("log_weight") && el.textContent.includes('83.8'));

  // 4. background work: task card with live progress morphs
  send('plan a weekend trip');
  await until(() => document.querySelector('task-card .task.running'));
  const taskHadProgressBar = !!document.querySelector('task-card .bar');
  await until(() => document.querySelector('task-card .task.done'), 12000);
  const taskFinishedMessage = [...document.querySelectorAll('message-card .message-text')]
    .some(el => el.textContent.includes('Background work finished'));

  // 5. second task, cancelled via its affordance
  send('plan another thing');
  await until(() => document.querySelectorAll('task-card').length === 2
    && [...document.querySelectorAll('task-card .task')].some(t => t.classList.contains('running')));
  document.querySelector('task-card .task.running .task-cancel').click();
  await until(() => [...document.querySelectorAll('task-card .task')].some(t => t.classList.contains('cancelled')));

  // 6. inbox fragment with select affordance; counts morph when filing
  send('open the inbox');
  await until(() => document.querySelector('inbox-card .chip'));
  const homeChipBefore = [...document.querySelectorAll('inbox-card .chip')]
    .find(chip => chip.textContent.includes('Home')).textContent;
  document.querySelector('inbox-card textarea[name="item"]').value = 'fix the garden gate';
  document.querySelector('inbox-card .affordance button').click();
  await until(() => [...document.querySelectorAll('inbox-card .chip')]
    .find(chip => chip.textContent.includes('Home')).textContent !== homeChipBefore);

  // 7. ask for weight again: new card renders, but the definition shipped once
  send('show my weight');
  await until(() => document.querySelectorAll('weight-card').length === 2);
  await until(() => document.querySelectorAll('weight-card .metric').length === 2);
  const weightDefinitionsShipped = document.querySelectorAll('script[type="jst"][name="weight-card"]').length;

  return { xssRenderedAsText, xssNoImgElement, xssNoExecution,
           sparkBars, initialMetric, formProjected, morphedMetric, inputSurvivedMorph,
           interactionEcho, taskHadProgressBar, taskFinishedMessage,
           weightCards: document.querySelectorAll('weight-card').length,
           weightDefinitionsShipped };
})()`;

function assertResult(result) {
  const checks = {
    xssRenderedAsText: result.xssRenderedAsText === true,
    xssNoImgElement: result.xssNoImgElement === true,
    xssNoExecution: result.xssNoExecution === true,
    sparkBars: result.sparkBars === 6,
    initialMetric: result.initialMetric === '84.2',
    formProjected: result.formProjected === true,
    morphedMetric: result.morphedMetric === '83.8',
    inputSurvivedMorph: result.inputSurvivedMorph === true,
    interactionEcho: result.interactionEcho === true,
    taskHadProgressBar: result.taskHadProgressBar === true,
    taskFinishedMessage: result.taskFinishedMessage === true,
    weightCards: result.weightCards === 2,
    weightDefinitionsShipped: result.weightDefinitionsShipped === 1,
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  return { ok: failed.length === 0, failed };
}

async function waitForHttp(url, timeoutMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  const serverProcess = spawn('node', [path.join(__dirname, 'server.mjs'), `--port=${SERVER_PORT}`], { stdio: 'ignore' });
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jst-feed-'));
  const chrome = spawn(process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], { stdio: 'ignore' });

  try {
    await waitForHttp(`http://127.0.0.1:${SERVER_PORT}/agentic_feed/index.html`);
    const targets = await (await waitForHttp(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
    const pageTarget = targets.find(target => target.type === 'page');
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

    let nextId = 0;
    const pending = new Map();
    const cdp = (method, params = {}) => {
      const id = ++nextId;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    };
    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id);
      message.error ? entry.reject(new Error(message.error.message)) : entry.resolve(message.result);
    });
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });

    await cdp('Page.enable');
    await cdp('Runtime.enable');
    await cdp('Page.navigate', { url: `http://127.0.0.1:${SERVER_PORT}/` });
    await new Promise(resolve => setTimeout(resolve, 600));

    const evaluated = await cdp('Runtime.evaluate', { expression: scenario, awaitPromise: true, returnByValue: true });
    ws.close();

    if (evaluated.exceptionDetails) {
      console.log(`FAIL: ${evaluated.exceptionDetails.text} ${evaluated.exceptionDetails.exception?.description || ''}`);
      process.exitCode = 1;
      return;
    }

    const result = evaluated.result.value;
    const { ok, failed } = assertResult(result);
    console.log(JSON.stringify(result, null, 2));
    console.log(ok ? 'PASS: agentic feed end-to-end' : `FAIL: ${failed.join(', ')}`);
    if (!ok) process.exitCode = 1;
  } finally {
    chrome.kill('SIGINT');
    serverProcess.kill('SIGINT');
    await new Promise(resolve => chrome.once('exit', resolve));
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
// Agentic Feed prototype server — the "membrane" from the agentic-spaces
// two-plane model, implemented over JST.
//
//   - The scripted "agent" below stands in for the LLM. It emits INTENT
//     (which fragment to surface, which data to update) — never HTML.
//   - Hypermedia fragments live in ./fragments as authored, version-controlled
//     JST component templates + lean markup. A fragment's <script type="jst">
//     definition ships over the wire ONCE; later uses send just the element.
//   - Card updates are attribute morphs ({target, attrs}), not HTML
//     replacement. JST re-renders the card in place; form state survives.
//
// Run:  node agentic_feed/server.mjs   then open http://127.0.0.1:4100/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticRoot = path.resolve(__dirname, '..'); // serve /jst.js etc. from the framework dir
const fragmentsDir = path.join(__dirname, 'fragments');
const port = Number(process.argv.find(arg => arg.startsWith('--port='))?.split('=')[1] || 4100);

const esc = value => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// ---------------------------------------------------------------- event log
let nextEventId = 1;
const history = [];
const clients = new Set();

function broadcast(event) {
  event.id = nextEventId++;
  history.push(event);
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  clients.forEach(client => client.write(payload));
}

const append = html => broadcast({ kind: 'append', html });
const morph = (target, attrs) => broadcast({ kind: 'morph', target, attrs });

// ------------------------------------------------------------- card helpers
const messageCard = (persona, text) =>
  `<feed-card persona="${esc(persona)}" time="${now()}"><message-card text="${esc(text)}"></message-card></feed-card>`;

const systemLine = text =>
  `<feed-card persona="system" time="${now()}"><message-card text="${esc(text)}"></message-card></feed-card>`;

// Fragments are authored templates. The JST definition inside a fragment is
// stripped after its first trip over the wire — definitions ship once.
const shippedDefinitions = new Set();

function fragment(name, replacements = {}) {
  let html = fs.readFileSync(path.join(fragmentsDir, `${name}.html`), 'utf8');

  // Authoring comments are for readers of the file, not the wire — and one
  // mentioning "<script" would defeat the definition-stripping regex below.
  html = html.replace(/<!--[\s\S]*?-->\s*/g, '');

  if (shippedDefinitions.has(name)) {
    html = html.replace(/<script type="jst"[\s\S]*?<\/script>\s*/g, '');
  } else {
    shippedDefinitions.add(name);
  }

  Object.entries({ TIME: now(), ...replacements }).forEach(([key, value]) => {
    html = html.replaceAll(`{{${key}}}`, value);
  });

  return html;
}

// ------------------------------------------------------------ app state
const weightEntries = [
  { date: 'Jun 7', kg: 85.1 }, { date: 'Jun 8', kg: 84.9 }, { date: 'Jun 9', kg: 85.0 },
  { date: 'Jun 10', kg: 84.6 }, { date: 'Jun 11', kg: 84.4 }, { date: 'Jun 12', kg: 84.2 },
];

const inboxCounts = { Home: 3, Work: 5, Journal: 2, Ideas: 7, Errands: 1 };

let nextTaskNumber = 1;
const runningTasks = new Map();

// ------------------------------------------------------------ the "agent"
// Stands in for the LLM plane: reads condensed events, emits intent.
function agentRespond(text) {
  const lower = text.toLowerCase();

  if (lower.includes('weight')) {
    setTimeout(() => {
      append(messageCard('Hive', "Here's your weight tracker — the form below is live, log today's weight whenever."));
      append(fragment('weight_tracker', { ENTRIES: esc(JSON.stringify(weightEntries)) }));
    }, 500);
    return;
  }

  if (lower.includes('inbox')) {
    setTimeout(() => {
      append(messageCard('Hive', 'Your inbox, sorted. Brain-dump anything below and I will file it.'));
      append(fragment('inbox', { COUNTS: esc(JSON.stringify(inboxCounts)) }));
    }, 500);
    return;
  }

  if (lower.includes('plan') || lower.includes('research') || lower.includes('task')) {
    startTask(text);
    return;
  }

  setTimeout(() => {
    append(messageCard('Hive', 'Noted. Try "show my weight", "open the inbox", or "plan a weekend trip" to watch hypermedia fragments arrive.'));
  }, 400);
}

function startTask(text) {
  const taskId = `task-${nextTaskNumber++}`;

  setTimeout(() => {
    append(messageCard('Hive', 'On it — background work is visible below. Watch it, or cancel it.'));
    append(fragment('task_card', { ID: taskId, TITLE: esc(text.slice(0, 60)) }));

    let progress = 5;
    const timer = setInterval(() => {
      progress += 18 + Math.floor(Math.random() * 12);

      if (progress >= 100) {
        clearInterval(timer);
        runningTasks.delete(taskId);
        morph(taskId, { status: 'done', progress: 100 });
        append(messageCard('Hive', `Background work finished: "${text.slice(0, 60)}". I would post the result document here.`));
      } else {
        morph(taskId, { progress });
      }
    }, 650);

    runningTasks.set(taskId, timer);
  }, 500);
}

// ----------------------------------------------------- interaction handlers
function handleInteraction({ docId, action, values, taskId }) {
  if (action === 'log_weight') {
    const kg = Number.parseFloat(values?.kg);
    if (!Number.isFinite(kg)) return;

    systemEcho(`[Brent submitted 'log_weight' on weight tracker: kg=${kg}]`);
    const previous = weightEntries[weightEntries.length - 1].kg;
    weightEntries.push({ date: shortDate(), kg });
    morph('weight-doc', { entries: weightEntries });

    setTimeout(() => {
      const delta = (kg - previous).toFixed(1);
      append(messageCard('Hive', `Logged ${kg} kg — that's ${delta <= 0 ? '' : '+'}${delta} kg on yesterday.`));
    }, 400);
    return;
  }

  if (action === 'capture_item') {
    const item = (values?.item || '').trim();
    if (!item) return;

    const category = !values.category || values.category === 'Auto' ? autoClassify(item) : values.category;
    systemEcho(`[Brent submitted 'capture_item' on inbox: "${item.slice(0, 50)}" → ${category}]`);
    inboxCounts[category] = (inboxCounts[category] || 0) + 1;
    morph('inbox-doc', { counts: inboxCounts });

    setTimeout(() => {
      append(messageCard('Hive', `Filed under ${category}.`));
    }, 400);
    return;
  }

  if (action === 'cancel_task') {
    const timer = runningTasks.get(taskId);
    if (!timer) return;

    clearInterval(timer);
    runningTasks.delete(taskId);
    morph(taskId, { status: 'cancelled' });
    append(messageCard('Hive', 'Cancelled — nothing was committed.'));
  }
}

const systemEcho = text => append(systemLine(text));
const shortDate = () => new Date().toLocaleDateString([], { month: 'short', day: 'numeric' });

function autoClassify(item) {
  const lower = item.toLowerCase();
  if (/(buy|pick up|grocer|shop)/.test(lower)) return 'Errands';
  if (/(fix|clean|garden|house)/.test(lower)) return 'Home';
  if (/(meeting|deploy|review|ticket)/.test(lower)) return 'Work';
  if (/(idea|maybe|what if|could)/.test(lower)) return 'Ideas';
  return 'Journal';
}

// ----------------------------------------------------------------- routing
function readBody(request) {
  return new Promise(resolve => {
    let body = '';
    request.on('data', chunk => body += chunk);
    request.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); }
    });
  });
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');

  if (url.pathname === '/events') {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    history.forEach(event => response.write(`data: ${JSON.stringify(event)}\n\n`));
    clients.add(response);
    request.on('close', () => clients.delete(response));
    return;
  }

  if (request.method === 'POST' && url.pathname === '/messages') {
    const { text, persona } = await readBody(request);
    response.writeHead(204).end();
    if (!text?.trim()) return;
    append(messageCard(persona || 'Brent', text)); // lands instantly: no turns
    agentRespond(text);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/interactions') {
    handleInteraction(await readBody(request));
    response.writeHead(204).end();
    return;
  }

  const pathname = url.pathname === '/' ? '/agentic_feed/index.html' : url.pathname;
  const filePath = path.join(staticRoot, decodeURIComponent(pathname));
  if (!filePath.startsWith(staticRoot)) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' });
    response.end(data);
  });
});

// seed the feed
append(messageCard('Hive', 'Welcome to the space. Everything here is a hypermedia document — fragments arrive over SSE carrying their own component definitions. Try: "show my weight", "open the inbox", or "plan a weekend trip".'));

server.listen(port, '127.0.0.1', () => {
  console.log(`Agentic feed prototype: http://127.0.0.1:${port}/`);
});

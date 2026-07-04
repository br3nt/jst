/*!
 * JST HATEOAS demo — mock backend running entirely in a Service Worker.
 *
 * There is NO real server. This worker intercepts fetch() for the demo's
 * "backend" namespace (anything containing /api/) and answers with text/html
 * FRAGMENTS — never JSON. Each fragment is itself the UI:
 *
 *   1. It carries its own next actions (HATEOAS): the "Load more" control and
 *      its target URL travel inside the markup; the "see who liked" link is
 *      part of the badge it ships.
 *   2. It can carry its own front-end behaviour. A fragment may include a brand
 *      new <script type="jst" name="..."> component definition AND markup that
 *      uses it. JST's MutationObserver registers the definition the instant the
 *      fragment is inserted, so the component is defined-and-used over the wire.
 *
 * The page (index.html) defines NO application components. feed-item arrives
 * with the first feed response; like-badge does not exist anywhere until you
 * click "Like" — then its definition and first use arrive together.
 *
 * "Data" lives in this worker's memory (ephemeral: if the worker is evicted,
 * counts reset and definitions re-ship — JST harmlessly ignores duplicates).
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// ----------------------------------------------------------------- "database"
const POSTS = [
  { id: 1, author: 'Ada Lovelace',   handle: 'ada',     color: '#b07cc6', time: '2h',
    body: 'The Analytical Engine weaves algebraic patterns just as the Jacquard loom weaves flowers and leaves.',
    source: 'https://en.wikipedia.org/wiki/Ada_Lovelace' },
  { id: 2, author: 'Roy Fielding',   handle: 'fielding', color: '#1da1f2', time: '3h',
    body: 'A REST API should be entered with no prior knowledge beyond the initial URI. The server provides the next steps in its responses.',
    source: 'https://roy.gbiv.com/untangled/2008/rest-apis-must-be-hypertext-driven' },
  { id: 3, author: 'Carson Gross',   handle: 'htmx_org', color: '#3da35d', time: '5h',
    body: "HTML can be the engine of application state if you let it. Send HTML, not JSON the client has to re-render.",
    source: 'https://htmx.org/essays/' },
  { id: 4, author: 'Grace Hopper',   handle: 'amazinggrace', color: '#e8590c', time: '7h',
    body: 'The most dangerous phrase in the language is: we have always done it this way.',
    source: 'https://en.wikipedia.org/wiki/Grace_Hopper' },
  { id: 5, author: 'Tim Berners-Lee', handle: 'timbl',   color: '#6741d9', time: '9h',
    body: 'Hypertext is text which is not constrained to be linear. The link is the unit of meaning.',
    source: 'https://www.w3.org/People/Berners-Lee/' },
  { id: 6, author: 'Sandi Metz',     handle: 'sandimetz', color: '#c2255c', time: '11h',
    body: 'You do not get the design you want by accident. Small, well-named things compose into systems you can reason about.',
    source: 'https://sandimetz.com/' },
  { id: 7, author: 'Sketchy Ad Co',  handle: 'totally_safe', color: '#868e96', time: '13h',
    body: 'This post links somewhere with a javascript: URL. JST url() neutralises it to # so the demo cannot be clickjacked.',
    source: 'javascript:alert(document.cookie)' },
  { id: 8, author: 'Rich Hickey',    handle: 'richhickey', color: '#0c8599', time: '15h',
    body: 'Simplicity is hard work. But there is a huge payoff. The person who has a genuinely simpler system is going to be able to ship.',
    source: 'https://www.youtube.com/watch?v=LKtk3HCgTa8' },
  { id: 9, author: 'Brent (JST)',    handle: 'br3nt',    color: '#f08c00', time: '17h',
    body: 'Everything in this feed arrived as HTML fragments from a service worker. No JSON, no client app, no build step.',
    source: 'https://github.com/br3nt/jst' },
];

const PAGE_SIZE = 3;
const likes = Object.create(null);        // postId -> like count
const LIKERS = ['Ada', 'Linus', 'Grace', 'Margaret', 'Dennis', 'Barbara', 'Edsger'];
const shipped = new Set();                 // component definitions already sent over the wire

// --------------------------------------------------------------- component defs
// Shipped over the wire. The page never had these; JST registers them via its
// MutationObserver the moment the fragment is inserted into the document.

const FEED_ITEM_DEF = `
<script type="jst" name="feed-item" attributes="item">
  <article class="card">
    <div class="avatar" style="--c: $(item.color)">$(item.author.slice(0, 1))</div>
    <div class="content">
      <header>
        <strong>$(item.author)</strong>
        <span class="handle">@$(item.handle)</span>
        <span class="dot">&middot;</span>
        <time>$(item.time)</time>
      </header>
      <p class="body">$(item.body)</p>
      <div class="actions">
        <button class="act like" onclick="$(async () => {
          const res = await fetch('api/item/' + item.id + '/like', { method: 'POST' });
          el.querySelector('.actions').innerHTML = await res.text();
        })">&#9825; Like</button>
        <a class="act source" href="$(url(item.source))" target="_blank" rel="noopener">Source &#8599;</a>
      </div>
    </div>
  </article>
</script>`;

const LIKE_BADGE_DEF = `
<script type="jst" name="like-badge" attributes="count itemId">
  <span class="badge">&#9829; Liked &middot; <strong>$(count)</strong></span>
  <button class="act link" onclick="$(prevent(async () => {
    const list = el.querySelector('.likers');
    list.textContent = 'loading…';
    list.innerHTML = await (await fetch('api/item/' + itemId + '/likers')).text();
  }))">see who</button>
  <div class="likers"></div>
</script>`;

// --------------------------------------------------------------- fragment builders
const attr = (value) => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');

function feedItemMarkup(post) {
  const data = { ...post, likes: likes[post.id] || 0 };
  return `<feed-item item='${attr(JSON.stringify(data))}'></feed-item>`;
}

function feedFragment(page) {
  const start = (page - 1) * PAGE_SIZE;
  const slice = POSTS.slice(start, start + PAGE_SIZE);

  let html = '';

  // Ship the feed-item definition exactly once, alongside its first use.
  if (!shipped.has('feed-item')) {
    shipped.add('feed-item');
    html += FEED_ITEM_DEF;
  }

  html += slice.map(feedItemMarkup).join('\n');

  // HATEOAS: the response carries its own next action. The "Load more" button
  // and the URL to fetch next live inside the returned markup. When the last
  // page is reached, no button is sent, so the affordance simply disappears.
  const hasMore = start + PAGE_SIZE < POSTS.length;
  if (hasMore) {
    html += `\n<button class="more" data-action="load-more" data-href="api/feed?page=${page + 1}">Load more posts</button>`;
  } else {
    html += `\n<p class="end">You have reached the end of the timeline.</p>`;
  }

  return html;
}

function likeFragment(id) {
  likes[id] = (likes[id] || 0) + 1;

  let html = '';
  // The define-and-use-over-the-wire moment: like-badge does not exist on the
  // page until this fragment arrives carrying both its definition and its use.
  if (!shipped.has('like-badge')) {
    shipped.add('like-badge');
    html += LIKE_BADGE_DEF;
  }
  html += `<like-badge count="${likes[id]}" item-id="${id}"></like-badge>`;
  return html;
}

function likersFragment(id) {
  const count = likes[id] || 0;
  const names = LIKERS.slice(0, Math.max(1, Math.min(count, LIKERS.length)));
  return `<ul class="likers-list">${names.map((n) => `<li>${attr(n)}</li>`).join('')}</ul>`;
}

// --------------------------------------------------------------- routing
function htmlResponse(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function route(request, url) {
  const path = url.pathname;

  // GET .../api/feed[?page=N]
  if (/\/api\/feed$/.test(path) && request.method === 'GET') {
    const page = Math.max(1, Number(url.searchParams.get('page') || '1') | 0);
    return htmlResponse(feedFragment(page));
  }

  // POST .../api/item/:id/like
  let match = path.match(/\/api\/item\/(\d+)\/like$/);
  if (match && request.method === 'POST') {
    return htmlResponse(likeFragment(Number(match[1])));
  }

  // GET .../api/item/:id/likers
  match = path.match(/\/api\/item\/(\d+)\/likers$/);
  if (match && request.method === 'GET') {
    return htmlResponse(likersFragment(Number(match[1])));
  }

  return htmlResponse('<p class="end">No such action.</p>', 404);
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only play "backend" for our API namespace. Everything else (the page,
  // jst.js, its modules) falls through to the normal network.
  if (!url.pathname.includes('/api/')) return;

  event.respondWith(route(event.request, url));
});

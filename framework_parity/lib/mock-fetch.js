// mock-fetch.js — a front-end "backend".
//
// Intercepts window.fetch with an inline route table so examples that would
// normally hit a server can return HTML fragments (optionally containing
// <script type="jst"> definitions, which JST auto-registers) or JSON — all
// from the browser. This is the testable equivalent of a Service Worker; a
// real SW would intercept at the network layer identically (see
// lib/README-serviceworker.md). Load as a classic script:
//
//   <script src="/framework_parity/lib/mock-fetch.js"></script>
//   <script>
//     JSTMock.route('GET /api/things', () => '<ul>...</ul>');
//     JSTMock.route('POST /api/things/:id', req => ({ json: { id: req.params.id } }), { delay: 150 });
//   </script>
(function () {
  const routes = [];
  const originalFetch = window.fetch ? window.fetch.bind(window) : null;

  function parseSpec(spec) {
    const [method, path] = spec.trim().split(/\s+/);
    const segments = path.split('/').filter(Boolean);
    return { method: method.toUpperCase(), segments, path };
  }

  function matchPath(routeSegments, urlSegments, params) {
    if (routeSegments.length !== urlSegments.length) return false;
    for (let i = 0; i < routeSegments.length; i++) {
      const r = routeSegments[i];
      if (r.startsWith(':')) {
        params[r.slice(1)] = decodeURIComponent(urlSegments[i]);
      } else if (r !== urlSegments[i]) {
        return false;
      }
    }
    return true;
  }

  function parseBody(raw, contentType) {
    if (raw == null || raw === '') return undefined;
    if (typeof raw !== 'string') {
      // URLSearchParams / FormData
      if (raw instanceof URLSearchParams) return Object.fromEntries(raw);
      if (typeof FormData !== 'undefined' && raw instanceof FormData) return Object.fromEntries(raw);
      return raw;
    }
    const ct = contentType || '';
    if (ct.includes('application/json')) {
      try { return JSON.parse(raw); } catch { return raw; }
    }
    if (ct.includes('application/x-www-form-urlencoded') || raw.includes('=')) {
      return Object.fromEntries(new URLSearchParams(raw));
    }
    try { return JSON.parse(raw); } catch { return raw; }
  }

  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  window.fetch = async function (input, init = {}) {
    const url = typeof input === 'string' ? input : input.url;
    const method = (init.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase();

    let parsed;
    try { parsed = new URL(url, location.origin); }
    catch { return originalFetch ? originalFetch(input, init) : Promise.reject(new Error('bad url')); }

    const urlSegments = parsed.pathname.split('/').filter(Boolean);

    for (const route of routes) {
      if (route.method !== method) continue;
      const params = {};
      if (!matchPath(route.segments, urlSegments, params)) continue;

      const query = Object.fromEntries(parsed.searchParams);
      const rawBody = init.body;
      const contentType = (init.headers && (init.headers['Content-Type'] || init.headers['content-type'])) || '';
      const form = parseBody(rawBody, contentType);

      if (route.opts.delay) await delay(route.opts.delay);

      const req = { method, url, path: parsed.pathname, params, query, form, raw: rawBody };
      let result;
      try {
        result = await route.handler(req);
      } catch (err) {
        return new Response(String(err && err.stack || err), { status: 500 });
      }

      if (result instanceof Response) return result;

      if (result && typeof result === 'object' && 'json' in result) {
        return new Response(JSON.stringify(result.json), {
          status: result.status || 200,
          headers: { 'Content-Type': 'application/json', ...(result.headers || {}) },
        });
      }
      if (result && typeof result === 'object' && ('body' in result || 'status' in result)) {
        return new Response(result.body != null ? String(result.body) : '', {
          status: result.status || 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8', ...(result.headers || {}) },
        });
      }
      // bare string → HTML
      return new Response(result == null ? '' : String(result), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // no route matched → fall through to the network (lets /jst.js etc. load)
    return originalFetch ? originalFetch(input, init) : Promise.reject(new Error(`No mock route for ${method} ${url}`));
  };

  window.JSTMock = {
    route(spec, handler, opts = {}) {
      routes.push({ ...parseSpec(spec), handler, opts });
      return this;
    },
    reset() { routes.length = 0; return this; },
    routes,
  };
})();

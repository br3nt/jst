/*!
 * JST — JavaScript Templates · no-build web components in plain HTML
 * © Brent Jacobs (https://github.com/br3nt) · https://github.com/br3nt/jst
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileTemplateRenderingFunction } from './compiler.js';
import { parseTemplateScript } from './parser.js';

function createTemplate({ name, attributes = [], innerHTML }) {
  const templateAttributes = [
    { name: 'type', value: 'jst' },
    { name: 'name', value: name },
    ...attributes.map(attribute => (
      typeof attribute === 'string' ? { name: attribute, value: '' } : attribute
    )),
  ];

  return {
    attributes: templateAttributes,
    innerHTML,
    getAttribute(attributeName) {
      const attribute = templateAttributes.find(attr => attr.name === attributeName);
      return attribute ? attribute.value : null;
    },
  };
}

function createEnvironment(templateDefinitions) {
  const elementsById = new Map();
  const templates = templateDefinitions.map(createTemplate);

  class MockHTMLElement {
    constructor() {
      this._attributes = new Map();
      this.innerHTML = '';
      this.isConnected = false;
    }

    setAttribute(name, value) {
      const nextValue = String(value);
      const oldValue = this._attributes.has(name) ? this._attributes.get(name) : null;
      this._attributes.set(name, nextValue);

      if (name === 'id') elementsById.set(nextValue, this);

      const observedAttributes = this.constructor.observedAttributes || [];
      if (observedAttributes.includes(name) && typeof this.attributeChangedCallback === 'function') {
        this.attributeChangedCallback(name, oldValue, nextValue);
      }
    }

    getAttribute(name) {
      return this._attributes.has(name) ? this._attributes.get(name) : null;
    }

    removeAttribute(name) {
      const oldValue = this.getAttribute(name);
      this._attributes.delete(name);

      const observedAttributes = this.constructor.observedAttributes || [];
      if (observedAttributes.includes(name) && typeof this.attributeChangedCallback === 'function') {
        this.attributeChangedCallback(name, oldValue, null);
      }
    }
  }

  class MockCustomElementsRegistry {
    constructor() {
      this.registry = new Map();
      this.defineCalls = [];
    }

    define(name, constructor) {
      if (this.registry.has(name)) {
        throw new Error(`Custom element "${name}" already defined`);
      }

      this.registry.set(name, constructor);
      this.defineCalls.push(name);
    }

    get(name) {
      return this.registry.get(name);
    }
  }

  return {
    document: {
      jst: undefined,
      querySelectorAll(selector) {
        return selector === 'script[type="jst"]' ? templates : [];
      },
      getElementById(id) {
        return elementsById.get(id) || null;
      },
    },
    customElements: new MockCustomElementsRegistry(),
    HTMLElement: MockHTMLElement,
    connect(element) {
      element.isConnected = true;
      if (typeof element.connectedCallback === 'function') element.connectedCallback();
      return element;
    },
    disconnect(element) {
      element.isConnected = false;
      if (typeof element.disconnectedCallback === 'function') element.disconnectedCallback();
    },
  };
}

function captureConsole() {
  const calls = {
    log: [],
    warn: [],
    error: [],
  };

  return {
    calls,
    console: {
      log: (...args) => calls.log.push(args),
      warn: (...args) => calls.warn.push(args),
      error: (...args) => calls.error.push(args),
      groupCollapsed: () => {},
      groupEnd: () => {},
    },
  };
}

async function loadRuntime(templateDefinitions) {
  const environment = createEnvironment(templateDefinitions);
  const consoleCapture = captureConsole();

  const previousGlobals = {
    document: globalThis.document,
    customElements: globalThis.customElements,
    HTMLElement: globalThis.HTMLElement,
    window: globalThis.window,
    console: globalThis.console,
  };

  const windowObject = {};
  globalThis.document = environment.document;
  globalThis.customElements = environment.customElements;
  globalThis.HTMLElement = environment.HTMLElement;
  globalThis.window = windowObject;
  globalThis.console = consoleCapture.console;

  const moduleUrl = new URL(`./jst.js?test=${Date.now()}-${Math.random()}`, import.meta.url);
  const module = await import(moduleUrl.href);

  return {
    module,
    windowObject,
    consoleCalls: consoleCapture.calls,
    customElements: environment.customElements,
    connect: environment.connect,
    cleanup() {
      globalThis.document = previousGlobals.document;
      globalThis.customElements = previousGlobals.customElements;
      globalThis.HTMLElement = previousGlobals.HTMLElement;
      globalThis.window = previousGlobals.window;
      globalThis.console = previousGlobals.console;
    },
  };
}

async function flushRenders() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
}

test('templates auto-register when the runtime loads', async () => {
  const runtime = await loadRuntime([
    {
      name: 'x-auto',
      attributes: [{ name: 'props', value: 'count' }],
      innerHTML: '<div>$(count)</div>',
    },
  ]);

  try {
    assert.equal(runtime.customElements.defineCalls.filter(name => name === 'x-auto').length, 1);
    assert.ok(runtime.customElements.get('x-auto'));
  } finally {
    runtime.cleanup();
  }
});

test('duplicate template names are warned and ignored', async () => {
  const runtime = await loadRuntime([
    {
      name: 'x-duplicate',
      attributes: [{ name: 'props', value: 'value' }],
      innerHTML: '<div>first $(value)</div>',
    },
    {
      name: 'x-duplicate',
      attributes: [{ name: 'props', value: 'value' }],
      innerHTML: '<div>second $(value)</div>',
    },
  ]);

  try {
    assert.equal(runtime.customElements.defineCalls.filter(name => name === 'x-duplicate').length, 1);
    assert.equal(runtime.consoleCalls.warn.length, 1);
    assert.match(String(runtime.consoleCalls.warn[0][0]), /Duplicate template name "x-duplicate"/);
  } finally {
    runtime.cleanup();
  }
});

test('registering the same template node twice is idempotent', async () => {
  const runtime = await loadRuntime([]);

  try {
    const template = createTemplate({
      name: 'x-same-node',
      attributes: [{ name: 'props', value: 'value' }],
      innerHTML: '<div>$(value)</div>',
    });

    runtime.module.registerCustomElementFromTemplate(template);
    runtime.module.registerCustomElementFromTemplate(template);

    assert.equal(runtime.customElements.defineCalls.filter(name => name === 'x-same-node').length, 1);
    assert.equal(runtime.consoleCalls.warn.length, 0);
  } finally {
    runtime.cleanup();
  }
});

test('registration logs only in dev mode', async () => {
  const runtime = await loadRuntime([]);

  try {
    runtime.module.registerCustomElementFromTemplate(createTemplate({
      name: 'x-quiet',
      attributes: [{ name: 'props', value: 'value' }],
      innerHTML: '<div>$(value)</div>',
    }));

    assert.equal(runtime.consoleCalls.log.length, 0);

    runtime.module.configure({ dev: true });
    runtime.module.registerCustomElementFromTemplate(createTemplate({
      name: 'x-loud',
      attributes: [{ name: 'props', value: 'value' }],
      innerHTML: '<div>$(value)</div>',
    }));

    assert.equal(runtime.consoleCalls.log.length, 1);
    assert.match(String(runtime.consoleCalls.log[0][0]), /JST: Registered <x-loud>/);
  } finally {
    runtime.cleanup();
  }
});

test('pre-registered custom element names are warned before registration', async () => {
  const runtime = await loadRuntime([]);

  try {
    runtime.customElements.define('x-existing', class {});

    const template = createTemplate({
      name: 'x-existing',
      attributes: [{ name: 'props', value: 'value' }],
      innerHTML: '<div>$(value)</div>',
    });
    runtime.module.registerCustomElementFromTemplate(template);

    assert.equal(runtime.consoleCalls.warn.length, 1);
    assert.match(String(runtime.consoleCalls.warn[0][0]), /<x-existing> is already registered/);
  } finally {
    runtime.cleanup();
  }
});

test('JSON-like attribute values are parsed without eval', async () => {
  const runtime = await loadRuntime([
    {
      name: 'x-count',
      attributes: [{ name: 'props', value: 'count label' }],
      innerHTML: '<div>$(label): $(count + 1)</div>',
    },
  ]);

  try {
    const CountClass = runtime.customElements.get('x-count');
    const element = new CountClass();
    element.setAttribute('count', '2');
    element.setAttribute('label', 'Total');
    runtime.connect(element);
    await flushRenders();

    assert.match(element.innerHTML, /Total: 3/);
  } finally {
    runtime.cleanup();
  }
});

test('attribute changes re-render the component', async () => {
  const runtime = await loadRuntime([
    {
      name: 'x-attr',
      attributes: [{ name: 'props', value: 'count' }],
      innerHTML: '<div>$(count)</div>',
    },
  ]);

  try {
    const AttrClass = runtime.customElements.get('x-attr');
    const element = new AttrClass();
    element.setAttribute('count', '1');
    runtime.connect(element);
    await flushRenders();

    assert.match(element.innerHTML, />1</);

    element.setAttribute('count', '2');
    await flushRenders();

    assert.match(element.innerHTML, />2</);
  } finally {
    runtime.cleanup();
  }
});

test('property assignment carries rich data and re-renders', async () => {
  const runtime = await loadRuntime([
    {
      name: 'x-rich',
      attributes: [{ name: 'props', value: 'items' }],
      innerHTML: '<div>$(items.filter(item => item.done).length) of $(items.length)</div>',
    },
  ]);

  try {
    const RichClass = runtime.customElements.get('x-rich');
    const element = new RichClass();
    element.items = [{ done: true }, { done: false }];
    runtime.connect(element);
    await flushRenders();

    assert.match(element.innerHTML, /1 of 2/);
    assert.equal(element.items.length, 2);

    element.items = [{ done: true }, { done: true }, { done: false }];
    await flushRenders();

    assert.match(element.innerHTML, /2 of 3/);
  } finally {
    runtime.cleanup();
  }
});

test('same-reference property assignment still publishes a render', async () => {
  const runtime = await loadRuntime([
    {
      name: 'x-same-ref',
      attributes: [{ name: 'props', value: 'items' }],
      innerHTML: '$ el.renderCount = (el.renderCount || 0) + 1;\n<div>$(items.length):$(el.renderCount)</div>',
    },
  ]);

  try {
    const SameRefClass = runtime.customElements.get('x-same-ref');
    const element = new SameRefClass();
    const items = [{ label: 'first' }];
    element.items = items;
    runtime.connect(element);
    await flushRenders();

    assert.match(element.innerHTML, /1:1/);

    items.push({ label: 'second' });
    element.items = items;
    await flushRenders();

    assert.match(element.innerHTML, /2:2/);
  } finally {
    runtime.cleanup();
  }
});

test('same primitive property assignment does not rerender', async () => {
  const runtime = await loadRuntime([
    {
      name: 'x-same-primitive',
      attributes: [{ name: 'props', value: 'count' }],
      innerHTML: '$ el.renderCount = (el.renderCount || 0) + 1;\n<div>$(count):$(el.renderCount)</div>',
    },
  ]);

  try {
    const SamePrimitiveClass = runtime.customElements.get('x-same-primitive');
    const element = new SamePrimitiveClass();
    element.count = 1;
    runtime.connect(element);
    await flushRenders();

    assert.match(element.innerHTML, /1:1/);

    element.count = 1;
    await flushRenders();

    assert.match(element.innerHTML, /1:1/);
  } finally {
    runtime.cleanup();
  }
});

test('element property reads derive from the latest prop value', async () => {
  const runtime = await loadRuntime([
    {
      name: 'x-live-property',
      attributes: [{ name: 'props', value: 'count' }],
      innerHTML: '<div>$(count)</div>',
    },
  ]);

  try {
    const LivePropertyClass = runtime.customElements.get('x-live-property');
    const element = new LivePropertyClass();
    element.count = 0;
    runtime.connect(element);
    await flushRenders();

    element.count = element.count + 1;
    element.count = element.count + 1;
    await flushRenders();

    assert.match(element.innerHTML, />2</);
  } finally {
    runtime.cleanup();
  }
});

test('props attr preserves camelCase and kebab-case usage maps to camelCase props', async () => {
  const runtime = await loadRuntime([
    {
      name: 'x-kebab',
      attributes: [{ name: 'props', value: 'userName' }],
      innerHTML: '<div>$(userName)</div>',
    },
  ]);

  try {
    const KebabClass = runtime.customElements.get('x-kebab');
    const element = new KebabClass();
    element.setAttribute('user-name', 'Brent');
    runtime.connect(element);
    await flushRenders();

    assert.match(element.innerHTML, /Brent/);

    element.userName = 'Someone Else';
    await flushRenders();

    assert.match(element.innerHTML, /Someone Else/);
  } finally {
    runtime.cleanup();
  }
});

test('interpolated values are HTML-escaped by default', async () => {
  const runtime = await loadRuntime([
    {
      name: 'x-escape',
      attributes: [{ name: 'props', value: 'text' }],
      innerHTML: '<div>$(text)</div>',
    },
  ]);

  try {
    const EscapeClass = runtime.customElements.get('x-escape');
    const element = new EscapeClass();
    element.text = '<img src=x onerror=alert(1)>';
    runtime.connect(element);
    await flushRenders();

    assert.ok(!element.innerHTML.includes('<img'));
    assert.match(element.innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/);
  } finally {
    runtime.cleanup();
  }
});

test('raw() opts out of escaping', async () => {
  const runtime = await loadRuntime([
    {
      name: 'x-raw',
      attributes: [{ name: 'props', value: 'html' }],
      innerHTML: '<div>$(raw(html))</div>',
    },
  ]);

  try {
    const RawClass = runtime.customElements.get('x-raw');
    const element = new RawClass();
    element.html = '<b>bold</b>';
    runtime.connect(element);
    await flushRenders();

    assert.match(element.innerHTML, /<b>bold<\/b>/);
  } finally {
    runtime.cleanup();
  }
});

test('render errors are logged with component context', async () => {
  const runtime = await loadRuntime([
    {
      name: 'x-failure',
      attributes: [{ name: 'props', value: 'items' }],
      innerHTML: '<div>$(items.length)</div>',
    },
  ]);

  try {
    const FailureClass = runtime.customElements.get('x-failure');
    const element = new FailureClass();
    runtime.connect(element);
    await flushRenders();

    assert.equal(runtime.consoleCalls.error.length, 1);
    assert.match(String(runtime.consoleCalls.error[0][0]), /<x-failure>/);
  } finally {
    runtime.cleanup();
  }
});

test('name is an ordinary prop when declared in props', async () => {
  const runtime = await loadRuntime([
    {
      name: 'x-hello',
      attributes: [{ name: 'props', value: 'name' }],
      innerHTML: '<p>Hello, $(name)!</p><button @click="$(() => el.name = \'world\')">reset</button>',
    },
  ]);

  try {
    const HelloClass = runtime.customElements.get('x-hello');
    const element = new HelloClass();
    element.setAttribute('name', 'JST');
    runtime.connect(element);
    await flushRenders();

    assert.match(element.innerHTML, /Hello, JST!/);

    element.name = 'world';
    await flushRenders();

    assert.match(element.innerHTML, /Hello, world!/);
  } finally {
    runtime.cleanup();
  }
});

test('precompiled templates register without runtime compilation', async () => {
  const runtime = await loadRuntime([]);

  try {
    runtime.module.registerPrecompiledTemplate(
      'x-precompiled',
      ['name'],
      { name: 'name' },
      function render(name, el, raw, unsafeHTML, slot, onDisconnect, __esc) {
        const lines = [];
        lines.push('<p>Hello ');
        lines.push(__esc(name));
        lines.push('</p>');
        return lines.join('');
      },
      'unit-test',
    );

    const PrecompiledClass = runtime.customElements.get('x-precompiled');
    const element = new PrecompiledClass();
    element.setAttribute('name', 'JST');
    runtime.connect(element);
    await flushRenders();

    assert.match(element.innerHTML, /Hello JST/);
  } finally {
    runtime.cleanup();
  }
});

test('bare $identifier supports digits after the first character', () => {
  const program = parseTemplateScript('$item1 $h1');

  assert.equal(program.tokens[0].constructor.name, 'JsIdentifierToken');
  assert.equal(program.tokens[0].identifier, 'item1');
  assert.equal(program.tokens[2].constructor.name, 'JsIdentifierToken');
  assert.equal(program.tokens[2].identifier, 'h1');
});

test('HTML comments are inert and do not evaluate JST markers', () => {
  const program = parseTemplateScript('<!-- $price --><span>$(price)</span>');

  assert.equal(program.tokens[0].constructor.name, 'HtmlToken');
  assert.equal(program.tokens[0].html, '<!-- $price --><span>');
  assert.equal(program.tokens[1].constructor.name, 'JsExpressionToken');
  assert.equal(program.tokens[1].expression, 'price');
});

test('balanced expressions ignore delimiters inside regex literals and comments', () => {
  const regexProgram = parseTemplateScript('$(list.filter(x => /)/.test(x)).length)');
  assert.equal(regexProgram.tokens[0].constructor.name, 'JsExpressionToken');
  assert.equal(regexProgram.tokens[0].expression, 'list.filter(x => /)/.test(x)).length');

  const keywordRegexProgram = parseTemplateScript('$(list.filter(x => { return /)/.test(x) }).length)');
  assert.equal(keywordRegexProgram.tokens[0].constructor.name, 'JsExpressionToken');
  assert.equal(keywordRegexProgram.tokens[0].expression, 'list.filter(x => { return /)/.test(x) }).length');

  const commentProgram = parseTemplateScript('$({ a: 1 /* } */ })');
  assert.equal(commentProgram.tokens[0].constructor.name, 'JsExpressionToken');
  assert.equal(commentProgram.tokens[0].expression, '{ a: 1 /* } */ }');
});

test('balanced expressions handle nested template literals', () => {
  const program = parseTemplateScript('$(`a ${ b ? `c)` : `d` } e`)');

  assert.equal(program.tokens[0].constructor.name, 'JsExpressionToken');
  assert.equal(program.tokens[0].expression, '`a ${ b ? `c)` : `d` } e`');
});

test('$ line directives distinguish less-than operators from HTML boundaries', () => {
  const comparisonProgram = parseTemplateScript('$ if (a < b) {\n<span>ok</span>\n$ }');
  assert.equal(comparisonProgram.tokens[0].constructor.name, 'JsCodeToken');
  assert.equal(comparisonProgram.tokens[0].code, 'if (a < b) {');

  const regexProgram = parseTemplateScript('$ const r = /<x>/.test(s)\n<span>ok</span>');
  assert.equal(regexProgram.tokens[0].constructor.name, 'JsCodeToken');
  assert.equal(regexProgram.tokens[0].code, 'const r = /<x>/.test(s)');
});

test('bindings with more than one interpolation fail at compile time', () => {
  const template = createTemplate({
    name: 'x-parent',
    attributes: [{ name: 'props', value: 'a b' }],
    innerHTML: '<x-child .items="$(a)$(b)"></x-child>',
  });

  assert.throws(
    () => compileTemplateRenderingFunction(template),
    /JST binding \.items must contain exactly one \$\(\.\.\.\) expression/,
  );
});

test('props declarations reject non-JavaScript identifiers', () => {
  const template = createTemplate({
    name: 'x-bad-props',
    attributes: [{ name: 'props', value: 'good bad-prop' }],
    innerHTML: '<div></div>',
  });

  assert.throws(
    () => compileTemplateRenderingFunction(template),
    /Invalid JST prop "bad-prop"/,
  );
});

test('props declarations reject helper and JavaScript keyword names', () => {
  const helperTemplate = createTemplate({
    name: 'x-helper-props',
    attributes: [{ name: 'props', value: 'item el' }],
    innerHTML: '<div></div>',
  });

  assert.throws(
    () => compileTemplateRenderingFunction(helperTemplate),
    /Invalid JST prop "el"/,
  );

  const methodTemplate = createTemplate({
    name: 'x-method-props',
    attributes: [{ name: 'props', value: 'item emit' }],
    innerHTML: '<div></div>',
  });

  assert.throws(
    () => compileTemplateRenderingFunction(methodTemplate),
    /Invalid JST prop "emit"/,
  );

  const keywordTemplate = createTemplate({
    name: 'x-keyword-props',
    attributes: [{ name: 'props', value: 'item class' }],
    innerHTML: '<div></div>',
  });

  assert.throws(
    () => compileTemplateRenderingFunction(keywordTemplate),
    /Invalid JST prop "class"/,
  );

  const urlTemplate = createTemplate({
    name: 'x-url-props',
    attributes: [{ name: 'props', value: 'item url once' }],
    innerHTML: '<div></div>',
  });

  assert.throws(
    () => compileTemplateRenderingFunction(urlTemplate),
    /Invalid JST prop "url"/,
  );
});

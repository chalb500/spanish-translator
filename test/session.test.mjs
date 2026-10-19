import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createCatalogTranslator } from '../server.mjs';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
test('paired views synchronize state, isolate sessions, reject display edits, and recover after reload', async () => {
  const channels = [];
  const translator = createCatalogTranslator({ env: {} });
  function open(view, session, storage = new Map()) {
    const nodes = new Map();
    const node = selector => {
      if (!nodes.has(selector)) nodes.set(selector, { textContent: '', innerHTML: '', value: '', listeners: {}, setAttribute() {}, addEventListener(type, fn) { this.listeners[type] = fn; }, querySelector() { return node('#search-form input'); }, scrollIntoView() {} });
      return nodes.get(selector);
    };
    let context;
    class Channel {
      constructor(name) { this.name = name; channels.push(this); }
      postMessage(data) { for (const peer of channels) if (peer !== this && peer.name === this.name) queueMicrotask(() => peer.onmessage?.({ data: structuredClone(data) })); }
    }
    context = vm.createContext({
      document: { querySelector: node, documentElement: {} },
      location: { search: `?view=${view}&session=${session}` }, history: { replaceState() {} },
      URLSearchParams, crypto: { randomUUID: () => 'generated' }, BroadcastChannel: Channel,
      sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
      window: { scrollTo() {}, open() { return null; } }, setInterval() {},
      fetch: async (_url, options) => ({ ok: true, json: () => translator.translateCatalog(JSON.parse(options.body).locale) }),
    });
    vm.runInContext(source, context);
    return { context, node, storage, state: () => JSON.parse(vm.runInContext('JSON.stringify(state)', context)), click(selector, id = 'headphones') {
      node('#product-grid').listeners.click({ target: { closest: query => query === '[data-id]' ? { dataset: { id } } : query === selector ? {} : null } });
    } };
  }
  const settle = () => new Promise(resolve => setImmediate(resolve));
  const sales = open('sales', 'one');
  const spanish = open('display', 'one');
  const other = open('display', 'two');
  await settle();
  assert.equal(sales.context.document.documentElement.lang, 'en');
  assert.equal(spanish.context.document.documentElement.lang, 'es');
  sales.click('.add-button');
  await settle();
  assert.equal(spanish.state().cart.headphones, 1);
  assert.equal(spanish.state().selected, 'headphones');
  assert.deepEqual(other.state().cart, {});
  spanish.click('.add-button');
  assert.equal(spanish.state().cart.headphones, 1);
  assert.match(spanish.node('#product-grid').innerHTML, /disabled/);
  sales.click('.favorite');
  sales.node('#search-form input').value = 'headphones';
  sales.node('#search-form').listeners.submit({ preventDefault() {}, currentTarget: sales.node('#search-form') });
  await settle();
  assert.deepEqual(spanish.state().visible, ['headphones']);
  assert.deepEqual(spanish.state().saved, ['headphones']);
  assert.match(spanish.node('#product-grid').innerHTML, /Auriculares/);
  const reloaded = open('display', 'one');
  await settle();
  assert.deepEqual(reloaded.state(), sales.state());
  const restoredSales = open('sales', 'one', sales.storage);
  await settle();
  assert.equal(restoredSales.state().cart.headphones, 1);
  sales.node('#open-display').listeners.click();
  assert.match(sales.node('#session-status').textContent, /Popup blocked/);
});

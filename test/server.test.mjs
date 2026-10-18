import test from "node:test";
import assert from "node:assert/strict";
import { createAppServer, products, translateCatalog } from "../server.mjs";

test("Spanish catalog translates product copy and preserves price and ratings", async () => {
  const translated = await translateCatalog("es");
  assert.equal(translated.length, products.length);
  assert.equal(translated[0].title, "Auriculares inalámbricos con cancelación de ruido");
  assert.equal(translated[0].price, products[0].price);
  assert.equal(translated[0].rating, products[0].rating);
  assert.equal(translated[0].category, "Electrónica");
});

test("catalog endpoint rejects unsupported locales", async (context) => {
  const server = createAppServer();
  await new Promise((resolve) => server.listen(0, resolve));
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const response = await fetch(`http://localhost:${server.address().port}/api/catalog`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale: "fr" }),
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Locale must be 'en' or 'es'" });
});

test("repeat Spanish catalog requests are served from the in-memory cache", async () => {
  const server = createAppServer();
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const endpoint = `http://localhost:${server.address().port}/api/catalog`;
    const request = () => fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: "es" }),
    });
    const first = await (await request()).json();
    const second = await (await request()).json();
    assert.equal(second.translation.cache.misses, first.translation.cache.misses);
    assert.equal(second.translation.cache.hitsThisRequest, products.reduce((total, item) => total + 6, 0));
    assert.equal(second.translation.providerCalls, 0);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("AI provider runs once on a cold request and preserves structured product facts", async () => {
  let providerCalls = 0;
  const server = createAppServer({
    env: { OPENAI_API_KEY: "test-secret", OPENAI_MODEL: "test-model" },
    fetchImpl: async (_url, options) => {
      providerCalls += 1;
      assert.equal(options.headers.Authorization, "Bearer test-secret");
      const request = JSON.parse(options.body);
      assert.equal(request.model, "test-model");
      const { texts } = JSON.parse(request.messages[1].content);
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ translations: texts.map((text) => `ES: ${text}`) }) } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const endpoint = `http://localhost:${server.address().port}/api/catalog`;
    const request = () => fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: "es" }),
    });
    const first = await (await request()).json();
    const second = await (await request()).json();
    assert.equal(first.translation.provider, "AI provider");
    assert.equal(first.translation.model, "test-model");
    assert.equal(first.translation.providerCalls, 1);
    assert.equal(second.translation.providerCalls, 0);
    assert.equal(providerCalls, 1);
    assert.equal(first.products[0].price, products[0].price);
    assert.equal(first.products[0].rating, products[0].rating);
    assert.equal(first.products[0].reviews, products[0].reviews);
    assert.equal(first.products[0].title, `ES: ${products[0].title}`);
    assert.equal(JSON.stringify(first).includes("test-secret"), false);
    assert.equal(first.translation.cache.entries, new Set([
      ...products.flatMap((product) => [product.category, product.title, product.description, ...product.bullets]),
    ]).size);
    assert.equal(typeof first.translation.providerLatencyMs, "number");
    assert.equal(typeof first.translation.requestLatencyMs, "number");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("provider failures are returned instead of replaced with demo output", async () => {
  const server = createAppServer({
    env: { OPENAI_API_KEY: "test-secret" },
    fetchImpl: async () => new Response("provider unavailable", { status: 503 }),
  });
  await new Promise((resolve) => server.listen(0, resolve));
  try {
    const response = await fetch(`http://localhost:${server.address().port}/api/catalog`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: "es" }),
    });
    assert.equal(response.status, 502);
    assert.match((await response.json()).error, /returned 503/);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

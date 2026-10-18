import assert from "node:assert/strict";
import { createAppServer, products } from "../server.mjs";

const server = createAppServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

async function requestCatalog() {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/catalog`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale: "es" }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Catalog API returned ${response.status}: ${payload.error ?? "Unknown API error"}`);
  }
  return payload;
}

try {
  const cold = await requestCatalog();
  const warm = await requestCatalog();
  const textFields = (product) => [product.category, product.title, product.description, ...product.bullets];
  let checks = 0;

  assert.equal(cold.products.length, products.length);
  checks += 1;
  for (const [index, product] of products.entries()) {
    const translated = cold.products[index];
    assert.equal(translated.id, product.id);
    assert.equal(translated.price, product.price);
    assert.equal(translated.rating, product.rating);
    assert.equal(translated.reviews, product.reviews);
    assert.equal(translated.bullets.length, product.bullets.length);
    checks += 5;
    for (const [fieldIndex, sourceText] of textFields(product).entries()) {
      assert.notEqual(textFields(translated)[fieldIndex], sourceText, `Untranslated field: ${product.id} #${fieldIndex}`);
      checks += 1;
    }
  }
  assert.deepEqual(warm.products, cold.products);
  assert.equal(warm.translation.providerCalls, 0);
  assert.equal(cold.translation.providerCalls, cold.translation.provider === "AI provider" ? 1 : 0);
  checks += 3;

  console.log(JSON.stringify({
    status: "PASS",
    mode: cold.translation.provider,
    model: cold.translation.model,
    checksPassed: checks,
    products: cold.products.length,
    translatedFields: cold.translation.translatedFields,
    uniqueSourceStrings: cold.translation.uniqueSourceStrings,
    coldRequestLatencyMs: cold.translation.requestLatencyMs,
    coldProviderLatencyMs: cold.translation.providerLatencyMs,
    coldProviderCalls: cold.translation.providerCalls,
    warmRequestLatencyMs: warm.translation.requestLatencyMs,
    warmCacheHits: warm.translation.cache.hitsThisRequest,
    warmProviderCalls: warm.translation.providerCalls,
    sampleTranslations: cold.products.slice(0, 2).map(({ id, title, description }) => ({ id, title, description })),
    note: cold.translation.provider === "AI provider"
      ? "Automated checks confirm response shape, changed text, cache reuse, and unchanged structured facts; language quality still needs fluent-speaker review."
      : "This verifies only the fixed demo dictionary, not AI translation quality or generalization.",
  }, null, 2));
} catch (error) {
  console.error(`Evaluation failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

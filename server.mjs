import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicRoot = resolve(root, "public");
const port = Number(process.env.PORT ?? 3000);
export const products = [
  {
    id: "headphones",
    category: "Electronics",
    title: "Wireless noise-canceling headphones",
    description: "Rich, balanced sound and all-day comfort for work, travel, and everything in between.",
    price: 89.99,
    rating: 4.8,
    reviews: 2841,
    emoji: "🎧",
    color: "lavender",
    bullets: ["Up to 35 hours of battery life", "Fast USB-C charging", "Foldable design with a travel case"],
  },
  {
    id: "coffee-maker",
    category: "Home & Kitchen",
    title: "Compact programmable coffee maker",
    description: "Wake up to freshly brewed coffee with a simple timer and a reusable filter.",
    price: 49.5,
    rating: 4.6,
    reviews: 1932,
    emoji: "☕",
    color: "peach",
    bullets: ["Brew strength control", "24-hour programmable timer", "Removable, easy-clean water tank"],
  },
  {
    id: "bottle",
    category: "Sports & Outdoors",
    title: "Insulated stainless steel water bottle",
    description: "Keep drinks cold on the trail or hot on your commute in a durable, leakproof bottle.",
    price: 24.99,
    rating: 4.7,
    reviews: 5620,
    emoji: "🥤",
    color: "mint",
    bullets: ["Keeps drinks cold for 24 hours", "Leakproof twist lid", "BPA-free, food-grade steel"],
  },
  {
    id: "lamp",
    category: "Home & Kitchen",
    title: "Adjustable LED desk lamp",
    description: "Bright, comfortable light with touch controls for focused work or relaxed reading.",
    price: 32.0,
    rating: 4.5,
    reviews: 847,
    emoji: "💡",
    color: "blue",
    bullets: ["Three color temperatures", "Dimmable touch controls", "USB charging port on the base"],
  },
];

const demoDictionary = new Map([
  ["Electronics", "Electrónica"],
  ["Home & Kitchen", "Hogar y cocina"],
  ["Sports & Outdoors", "Deportes y aire libre"],
  ["Wireless noise-canceling headphones", "Auriculares inalámbricos con cancelación de ruido"],
  ["Rich, balanced sound and all-day comfort for work, travel, and everything in between.", "Sonido nítido y equilibrado, y comodidad durante todo el día para trabajar, viajar y mucho más."],
  ["Up to 35 hours of battery life", "Hasta 35 horas de batería"],
  ["Fast USB-C charging", "Carga rápida USB-C"],
  ["Foldable design with a travel case", "Diseño plegable con estuche de viaje"],
  ["Compact programmable coffee maker", "Cafetera compacta programable"],
  ["Wake up to freshly brewed coffee with a simple timer and a reusable filter.", "Despiértate con café recién hecho gracias a su temporizador sencillo y filtro reutilizable."],
  ["Brew strength control", "Control de intensidad de preparación"],
  ["24-hour programmable timer", "Temporizador programable de 24 horas"],
  ["Removable, easy-clean water tank", "Depósito de agua extraíble y fácil de limpiar"],
  ["Insulated stainless steel water bottle", "Botella de agua térmica de acero inoxidable"],
  ["Keep drinks cold on the trail or hot on your commute in a durable, leakproof bottle.", "Mantén tus bebidas frías en la naturaleza o calientes durante el trayecto con esta botella resistente y a prueba de fugas."],
  ["Keeps drinks cold for 24 hours", "Mantiene las bebidas frías durante 24 horas"],
  ["Leakproof twist lid", "Tapa de rosca a prueba de fugas"],
  ["BPA-free, food-grade steel", "Acero apto para alimentos y sin BPA"],
  ["Adjustable LED desk lamp", "Lámpara de escritorio LED ajustable"],
  ["Bright, comfortable light with touch controls for focused work or relaxed reading.", "Luz brillante y agradable con controles táctiles para trabajar con concentración o leer con tranquilidad."],
  ["Three color temperatures", "Tres temperaturas de color"],
  ["Dimmable touch controls", "Controles táctiles con intensidad regulable"],
  ["USB charging port on the base", "Puerto de carga USB en la base"],
]);

function cacheKey(text, locale, provider, model) {
  const digest = createHash("sha256").update(text).digest("hex");
  return `${provider}:${model}:${locale}:${digest}`;
}

async function translateBatch(texts, locale, { apiKey, model, apiUrl, fetchImpl }) {
  if (!apiKey) {
    const missing = texts.filter((text) => !demoDictionary.has(text));
    if (missing.length) {
      throw new Error(`Demo dictionary has no translation for: ${missing[0]}`);
    }
    return { translations: texts.map((text) => demoDictionary.get(text)), providerLatencyMs: 0, providerCalls: 0 };
  }

  const startedAt = performance.now();
  const response = await fetchImpl(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Translate each input string into ${locale === "es" ? "Spanish" : "English"}. Keep brand names, model numbers, measurements, and product facts unchanged. Return only a JSON object with a "translations" array containing exactly one translated string per input, in the same order.`,
        },
        { role: "user", content: JSON.stringify({ texts }) },
      ],
    }),
  });
  const providerLatencyMs = Math.round(performance.now() - startedAt);
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Translation provider returned ${response.status}: ${details.slice(0, 300)}`);
  }
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Translation provider response did not contain message content");
  }
  let result;
  try {
    result = JSON.parse(content);
  } catch {
    throw new Error("Translation provider returned invalid JSON");
  }
  if (!Array.isArray(result.translations) || result.translations.length !== texts.length ||
      result.translations.some((value) => typeof value !== "string" || !value.trim())) {
    throw new Error("Translation provider returned an invalid translations array");
  }
  return { translations: result.translations, providerLatencyMs, providerCalls: 1 };
}

export function createCatalogTranslator({ env = process.env, fetchImpl = fetch } = {}) {
  const apiKey = env.OPENAI_API_KEY;
  const model = env.OPENAI_MODEL ?? "gpt-4o-mini";
  const apiUrl = env.OPENAI_API_URL ?? "https://api.openai.com/v1/chat/completions";
  const provider = apiKey ? "AI provider" : "Demo dictionary";
  const cacheNamespace = apiKey ? model : "demo-v1";
  const cache = new Map();
  const totals = { requests: 0, hits: 0, misses: 0, providerCalls: 0 };

  async function translateCatalog(locale) {
    if (locale !== "es" && locale !== "en") {
      throw new Error("Unsupported locale");
    }
    const startedAt = performance.now();
    totals.requests += 1;
    if (locale === "en") {
      return {
        products: products.map((product) => ({ ...product, bullets: [...product.bullets] })),
        translation: {
          provider, model: apiKey ? model : null, translatedFields: 0, uniqueSourceStrings: 0,
          cache: { ...totals, hitsThisRequest: 0, missesThisRequest: 0, entries: cache.size },
          providerCalls: 0, providerLatencyMs: 0, requestLatencyMs: Math.round(performance.now() - startedAt),
        },
      };
    }

    const fields = [];
    for (const product of products) {
      fields.push({ productId: product.id, field: "category", index: -1, text: product.category });
      fields.push({ productId: product.id, field: "title", index: -1, text: product.title });
      fields.push({ productId: product.id, field: "description", index: -1, text: product.description });
      product.bullets.forEach((text, index) => fields.push({ productId: product.id, field: "bullets", index, text }));
    }

    const results = new Array(fields.length);
    const missing = new Map();
    let hitsThisRequest = 0;
    let missesThisRequest = 0;
    fields.forEach((entry, index) => {
      const key = cacheKey(entry.text, locale, provider, cacheNamespace);
      if (cache.has(key)) {
        hitsThisRequest += 1;
        results[index] = cache.get(key);
      } else {
        missesThisRequest += 1;
        const waiting = missing.get(key) ?? { text: entry.text, indexes: [] };
        waiting.indexes.push(index);
        missing.set(key, waiting);
      }
    });

    totals.hits += hitsThisRequest;
    totals.misses += missesThisRequest;
    let providerLatencyMs = 0;
    let providerCalls = 0;
    if (missing.size) {
      const pending = [...missing.entries()];
      const translated = await translateBatch(
        pending.map(([, entry]) => entry.text),
        locale,
        { apiKey, model, apiUrl, fetchImpl },
      );
      providerLatencyMs = translated.providerLatencyMs;
      providerCalls = translated.providerCalls;
      totals.providerCalls += providerCalls;
      pending.forEach(([key, entry], offset) => {
        cache.set(key, translated.translations[offset]);
        entry.indexes.forEach((index) => { results[index] = translated.translations[offset]; });
      });
    }

    const translatedFields = new Map();
    fields.forEach((entry, index) => {
      const key = `${entry.productId}:${entry.field}`;
      const existing = translatedFields.get(key) ?? [];
      if (entry.index === -1) translatedFields.set(key, results[index]);
      else {
        existing[entry.index] = results[index];
        translatedFields.set(key, existing);
      }
    });

    return {
      products: products.map((product) => ({
        ...product,
        category: translatedFields.get(`${product.id}:category`),
        title: translatedFields.get(`${product.id}:title`),
        description: translatedFields.get(`${product.id}:description`),
        bullets: translatedFields.get(`${product.id}:bullets`),
      })),
      translation: {
        provider, model: apiKey ? model : null,
        translatedFields: fields.length, uniqueSourceStrings: new Set(fields.map(({ text }) => text)).size,
        cache: { ...totals, hitsThisRequest, missesThisRequest, entries: cache.size },
        providerCalls, providerLatencyMs, requestLatencyMs: Math.round(performance.now() - startedAt),
      },
    };
  }

  return { translateCatalog };
}

const defaultTranslator = createCatalogTranslator();
export async function translateCatalog(locale) {
  return (await defaultTranslator.translateCatalog(locale)).products;
}

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 10_000) throw new Error("Request body is too large");
  }
  return JSON.parse(body);
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

export function createAppServer(options = {}) {
  const translator = createCatalogTranslator(options);
  return createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    if (url.pathname === "/api/catalog" && request.method === "POST") {
      try {
        const { locale } = await readJson(request);
        if (locale !== "es" && locale !== "en") {
          sendJson(response, 400, { error: "Locale must be 'en' or 'es'" });
          return;
        }
        const result = await translator.translateCatalog(locale);
        sendJson(response, 200, {
          locale,
          ...result,
        });
      } catch (error) {
        sendJson(response, 502, { error: error.message });
      }
      return;
    }
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }
    const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
    const filePath = resolve(publicRoot, `.${requestedPath}`);
    if (!filePath.startsWith(`${publicRoot}${sep}`)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const file = await readFile(filePath);
      response.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] ?? "application/octet-stream" });
      response.end(file);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createAppServer().listen(port, () => {
    console.log(`Catalog translation POC listening at http://localhost:${port}`);
  });
}

const copy = {
  en: {
    kicker: "THE EVERYDAY EDIT",
    title: "A few things you'll love.",
    subtitle: "Customer favorites, picked just for you.",
    finds: "finds",
    reviews: "reviews",
    add: "Add to cart",
    save: "Save",
    bestseller: "BESTSELLER",
    loading: "Loading catalog…",
    demo: "Demo dictionary · not AI",
    ai: "AI translation · server-side",
    cached: "on-demand · cached",
    error: "Catalog could not be translated. Please try again.",
    language: "🇺🇸 EN",
    chrome: {
      announcement: "Free delivery on orders over $35", returns: "Easy returns", deliver: "Deliver to",
      hello: "Hello, guest", account: "Account", cart: "Cart", all: "☰ &nbsp; All",
      deals: "Today's deals", service: "Customer service", gifts: "Gift cards", sell: "Sell",
      nav: "Delivering happiness, worldwide", eyebrow: "A world of discovery",
      heroTitleFirst: "Good finds.", heroTitleSecond: "Everywhere.",
      hero: "Explore thoughtful picks for your home, your routine, and everything in between.",
      heroLink: "Find your next favorite", heroNote: "Fresh picks<br>for every day", sort: "Featured",
      footer: "Made for curious living.", preference: "Translation preference stays on this device in this demo.",
    },
  },
  es: {
    kicker: "SELECCIÓN PARA CADA DÍA",
    title: "Pequeños hallazgos, grandes favoritos.",
    subtitle: "Los favoritos de nuestros clientes, elegidos para ti.",
    finds: "productos",
    reviews: "opiniones",
    add: "Añadir al carrito",
    save: "Guardar",
    bestseller: "MÁS VENDIDO",
    loading: "Cargando catálogo…",
    demo: "Diccionario de demostración · no es IA",
    ai: "Traducción con IA · en el servidor",
    cached: "bajo demanda · con caché",
    error: "No se pudo traducir el catálogo. Inténtalo de nuevo.",
    language: "🇪🇸 ES",
    chrome: {
      announcement: "Envío gratis en pedidos superiores a $35", returns: "Devoluciones sencillas", deliver: "Entrega en",
      hello: "Hola, invitado", account: "Cuenta", cart: "Carrito", all: "☰ &nbsp; Todo",
      deals: "Ofertas del día", service: "Atención al cliente", gifts: "Tarjetas de regalo", sell: "Vender",
      nav: "Llevamos alegría a todo el mundo", eyebrow: "Un mundo por descubrir",
      heroTitleFirst: "Buenos hallazgos.", heroTitleSecond: "En todas partes.",
      hero: "Descubre favoritos para tu hogar, tu rutina y todo lo que te inspira.",
      heroLink: "Encuentra tu próximo favorito", heroNote: "Nuevos favoritos<br>para cada día", sort: "Destacados",
      footer: "Para vivir con curiosidad.", preference: "En esta demostración, el idioma elegido se guarda en este dispositivo.",
    },
  },
};

const grid = document.querySelector("#product-grid");
const toggle = document.querySelector("#language-toggle");
let locale = localStorage.getItem("catalog-locale") === "es" ? "es" : "en";
let pending = false;

function renderProducts(products) {
  grid.innerHTML = products.map((product, index) => `
    <article class="product-card">
      <div class="product-visual ${product.color}">
        <span class="product-category">${escapeHtml(product.category)}</span>
        <span class="product-emoji" aria-hidden="true">${product.emoji}</span>
        <button class="favorite" aria-label="${copy[locale].save} ${escapeHtml(product.title)}">♡</button>
        ${index === 0 ? `<span class="bestseller">${copy[locale].bestseller}</span>` : ""}
      </div>
      <div class="product-info">
        <div class="rating"><span>★★★★★</span><b>${product.rating.toFixed(1)}</b><small>(${product.reviews.toLocaleString()} ${copy[locale].reviews})</small></div>
        <h3>${escapeHtml(product.title)}</h3>
        <p class="product-description">${escapeHtml(product.description)}</p>
        <ul>${product.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>
        <div class="product-bottom"><div class="price"><span>$</span>${product.price.toFixed(2)}</div><button class="add-button">${copy[locale].add}<span>＋</span></button></div>
      </div>
    </article>`).join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

async function loadCatalog() {
  pending = true;
  updateChrome();
  document.querySelector("#translation-status").textContent = copy[locale].loading;
  try {
    const response = await fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Request failed");
    renderProducts(payload.products);
    const translation = payload.translation;
    document.querySelector("#translation-status").textContent =
      translation.provider === "AI provider"
        ? `${copy[locale].ai} · ${translation.model}`
        : copy[locale].demo;
    document.querySelector("#cache-status").textContent =
      `${copy[locale].cached} · ${translation.cache.hitsThisRequest} hits · ${translation.providerLatencyMs} ms provider`;
    document.querySelector("#result-count").textContent = `${payload.products.length} ${copy[locale].finds}`;
  } catch (error) {
    grid.innerHTML = `<div class="error-state">${escapeHtml(error.message || copy[locale].error)} <button id="retry">Retry</button></div>`;
    document.querySelector("#translation-status").textContent = copy[locale].error;
    document.querySelector("#retry")?.addEventListener("click", loadCatalog);
  } finally {
    pending = false;
    updateChrome();
  }
}

function updateChrome() {
  const text = copy[locale];
  document.documentElement.lang = locale;
  toggle.innerHTML = `${text.language} ⌄`;
  toggle.setAttribute("aria-label", locale === "es" ? "Cambiar idioma" : "Switch language");
  toggle.disabled = pending;
  document.querySelector("#section-kicker").textContent = text.kicker;
  document.querySelector("#catalog-title").textContent = text.title;
  document.querySelector("#catalog-subtitle").textContent = text.subtitle;
  document.querySelector("#search-form input").placeholder = locale === "es" ? "Buscar productos" : "Search Mercado";
  document.querySelector("#search-form input").setAttribute("aria-label", locale === "es" ? "Buscar productos" : "Search products");
  document.querySelector("#search-form button").setAttribute("aria-label", locale === "es" ? "Buscar" : "Search");
  document.querySelector("#announcement-main").textContent = text.chrome.announcement;
  document.querySelector("#announcement-return").textContent = text.chrome.returns;
  document.querySelector("#deliver-label").textContent = text.chrome.deliver;
  document.querySelector("#hello-label").textContent = text.chrome.hello;
  document.querySelector("#account-label").textContent = text.chrome.account;
  document.querySelector("#cart-label").textContent = text.chrome.cart;
  document.querySelector("#all-label").textContent = text.chrome.all;
  document.querySelector("#deals-label").textContent = text.chrome.deals;
  document.querySelector("#service-label").textContent = text.chrome.service;
  document.querySelector("#gifts-label").textContent = text.chrome.gifts;
  document.querySelector("#sell-label").textContent = text.chrome.sell;
  document.querySelector("#nav-note").textContent = text.chrome.nav;
  document.querySelector("#hero-eyebrow").textContent = text.chrome.eyebrow;
  document.querySelector("#hero-title-first").textContent = text.chrome.heroTitleFirst;
  document.querySelector("#hero-title-second").textContent = text.chrome.heroTitleSecond;
  document.querySelector("#hero-description").textContent = text.chrome.hero;
  document.querySelector("#hero-link-label").textContent = text.chrome.heroLink;
  document.querySelector("#hero-note-label").innerHTML = text.chrome.heroNote;
  document.querySelector("#sort-label").textContent = text.chrome.sort;
  document.querySelector("#footer-note").textContent = text.chrome.footer;
  document.querySelector("#preference-note").textContent = text.chrome.preference;
}

toggle.addEventListener("click", () => {
  if (pending) return;
  locale = locale === "en" ? "es" : "en";
  localStorage.setItem("catalog-locale", locale);
  loadCatalog();
});
document.querySelector("#search-form").addEventListener("submit", (event) => event.preventDefault());

updateChrome();
loadCatalog();

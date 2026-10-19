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
      hello: "Hello, guest", account: "Account", cart: "Cart", all: "☰   All",
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
      hello: "Hola, invitado", account: "Cuenta", cart: "Carrito", all: "☰   Todo",
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
const params = new URLSearchParams(location.search);
const display = params.get("view") === "display";
const locale = display ? "es" : "en";
const session = params.get("session") || crypto.randomUUID();
params.set("session", session);
params.set("view", display ? "display" : "sales");
history.replaceState(null, "", `?${params}`);
const channel = new BroadcastChannel(`sales:${session}`);
let state = { visible: null, selected: null, cart: {}, saved: [], section: "" };
if (!display) {
  try { state = JSON.parse(sessionStorage.getItem(`sales:${session}`)) || state; } catch { /* Start a fresh session when storage is unavailable. */ }
}
let catalog = [];
let lastContact = 0;
let customerWindow;
let popupBlocked = false;
let renderedSection;
let lastRenderedState = "";
const sessionStatus = document.querySelector("#session-status");
const openDisplay = document.querySelector("#open-display");
openDisplay.hidden = display;
openDisplay.addEventListener("click", () => {
  customerWindow = window.open(`/?view=display&session=${encodeURIComponent(session)}`, `display-${session}`, "popup,width=1200,height=900");
  popupBlocked = !customerWindow;
  if (!customerWindow) sessionStatus.textContent = "Popup blocked. Allow popups and click Open Spanish display again.";
  else customerWindow.focus();
});
function publish() {
  if (!display) channel.postMessage({ type: "state", state });
}
channel.onmessage = ({ data }) => {
  if (display && data.type === "state") {
    lastContact = Date.now();
    state = data.state;
    renderSession();
    channel.postMessage({ type: "present" });
  } else if (!display && (data.type === "ready" || data.type === "present")) {
    lastContact = Date.now();
    if (data.type === "ready") publish();
  }
};
channel.postMessage({ type: "ready" });
setInterval(() => {
  if (display) channel.postMessage({ type: "ready" });
  else publish();
  const connected = Date.now() - lastContact < 3500;
  if (popupBlocked) return;
  sessionStatus.textContent = display
    ? (connected ? "Pantalla en espa?ol ? Solo lectura ? Conectada" : "Esperando conexi?n con el vendedor; los datos pueden estar desactualizados.")
    : (connected ? "English sales view ? Spanish display connected" : "English sales view ? Spanish display disconnected");
}, 1000);
function renderSession() {
  const signature = JSON.stringify(state);
  if (signature === lastRenderedState || !catalog.length) return;
  lastRenderedState = signature;
  renderProducts(catalog.filter(product => state.visible === null || state.visible.includes(product.id)));
  document.querySelector("#cart-label").textContent = `${copy[locale].chrome.cart} (${Object.values(state.cart).reduce((sum, n) => sum + n, 0)})`;
  if (display && renderedSection !== state.section) {
    if (state.section === "catalog") document.querySelector("#catalog").scrollIntoView();
    else window.scrollTo(0, 0);
    renderedSection = state.section;
  }
}
function commit() {
  try { sessionStorage.setItem(`sales:${session}`, JSON.stringify(state)); } catch { /* Synchronization does not require storage. */ }
  renderSession(); publish();
}
let pending = false;

function renderProducts(products) {
  grid.innerHTML = products.map((product, index) => `
    <article class="product-card ${state.selected === product.id ? "selected" : ""}" data-id="${escapeHtml(product.id)}">
      <div class="product-visual ${product.color}">
        <span class="product-category">${escapeHtml(product.category)}</span>
        <span class="product-emoji" aria-hidden="true">${product.emoji}</span>
        <button ${display ? "disabled" : ""} aria-pressed="${state.saved.includes(product.id)}" class="favorite" aria-label="${copy[locale].save} ${escapeHtml(product.title)}">♡</button>
        ${index === 0 ? `<span class="bestseller">${copy[locale].bestseller}</span>` : ""}
      </div>
      <div class="product-info">
        <div class="rating"><span>★★★★★</span><b>${product.rating.toFixed(1)}</b><small>(${product.reviews.toLocaleString()} ${copy[locale].reviews})</small></div>
        <h3><button class="select-product" ${display ? "disabled" : ""} aria-pressed="${state.selected === product.id}">${escapeHtml(product.title)}</button></h3>
        <p class="product-description">${escapeHtml(product.description)}</p>
        <ul>${product.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>
        <div class="product-bottom"><div class="price"><span>$</span>${product.price.toFixed(2)}</div><button class="add-button" ${display ? "disabled" : ""}>${copy[locale].add}<span>＋</span></button></div>
      </div>
    </article>`).join("") || `<p>${display ? "No hay productos que coincidan." : "No matching products."}</p>`;
  document.querySelector("#result-count").textContent = `${products.length} ${copy[locale].finds}`;
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
    catalog = payload.products;
    lastRenderedState = "";
    renderSession();
    const translation = payload.translation;
    document.querySelector("#translation-status").textContent =
      translation.provider === "AI provider"
        ? `${copy[locale].ai} · ${translation.model}`
        : copy[locale].demo;
    document.querySelector("#cache-status").textContent =
      `${copy[locale].cached} · ${translation.cache.hitsThisRequest} hits · ${translation.providerLatencyMs} ms provider`;

  } catch (error) {
    grid.innerHTML = `<div class="error-state">${escapeHtml(display ? copy[locale].error : error.message || copy[locale].error)} <button id="retry">${display ? "Reintentar" : "Retry"}</button></div>`;
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
  toggle.setAttribute("aria-label", display ? "Idioma: espa?ol" : "Language: English");
  toggle.disabled = true;
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
  document.querySelector("#preference-note").textContent = display ? "Pantalla del cliente ? Solo lectura" : "Move the Spanish window to the second monitor.";
  document.title = display ? "Mercado ? Pantalla del cliente" : "Mercado ? Sales view";
  document.querySelector(".art-caption").textContent = display ? "ELEGIDO PARA TI" : "CURATED FOR YOU";
  document.querySelector("#search-form").hidden = display;
  document.querySelector(".sort-button").disabled = true;
}

grid.addEventListener("click", (event) => {
  if (display) return;
  const card = event.target.closest("[data-id]");
  if (!card) return;
  const id = card.dataset.id;
  if (event.target.closest(".add-button")) state.cart[id] = (state.cart[id] || 0) + 1;
  else if (event.target.closest(".favorite")) state.saved = state.saved.includes(id) ? state.saved.filter(value => value !== id) : [...state.saved, id];
  state.selected = id;
  commit();
});
document.querySelector("#search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (display) return;
  const query = event.currentTarget.querySelector("input").value.trim().toLowerCase();
  state.visible = catalog.filter(product => [product.title, product.category, product.description].some(text => text.toLowerCase().includes(query))).map(product => product.id);
  state.section = "catalog";
  commit();
});
document.querySelector(".hero-link").addEventListener("click", (event) => {
  event.preventDefault();
  if (display) return;
  state.section = "catalog";
  document.querySelector("#catalog").scrollIntoView();
  commit();
});
document.querySelector(".brand").addEventListener("click", (event) => {
  event.preventDefault();
  if (display) return;
  state = { visible: null, selected: null, cart: state.cart, saved: state.saved, section: "" };
  document.querySelector("#search-form input").value = "";
  window.scrollTo(0, 0);
  commit();
});
updateChrome();
loadCatalog();

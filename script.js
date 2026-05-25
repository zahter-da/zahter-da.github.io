const state = {
  language: localStorage.getItem("zatar-language") || "de",
  translations: {},
  menu: [],
  activeFilter: "all"
};

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

document.addEventListener("DOMContentLoaded", async () => {
  setupNavigation();
  setupYear();
  setupRevealAnimations();

  await loadTranslations();
  applyLanguage(state.language);
  setupLanguageSwitcher();

  if ($("#menu-grid")) {
    await loadMenu();
    setupFilters();
    renderMenu();
  }
});

function setupNavigation() {
  const toggle = $(".nav-toggle");
  const menu = $("#nav-menu");
  if (!toggle || !menu) return;

  toggle.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  $$("#nav-menu a").forEach(link => {
    link.addEventListener("click", () => {
      menu.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

function setupYear() {
  $$("#year").forEach(el => el.textContent = new Date().getFullYear());
}

async function loadTranslations() {
  try {
    const response = await fetch("translations.json");
    state.translations = await response.json();
  } catch (error) {
    console.warn("Translations could not be loaded.", error);
  }
}

function setupLanguageSwitcher() {
  const select = $("#language-select");
  if (!select) return;
  select.value = state.language;
  select.addEventListener("change", event => applyLanguage(event.target.value));
}

function applyLanguage(language) {
  state.language = language;
  localStorage.setItem("zatar-language", language);

  const isArabic = language === "ar";
  document.documentElement.lang = language;
  document.documentElement.dir = isArabic ? "rtl" : "ltr";
  document.body.dir = isArabic ? "rtl" : "ltr";

  const strings = state.translations[language] || state.translations.de || {};
  $$("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    if (strings[key]) {
      if (el.tagName.toLowerCase() === "title") document.title = strings[key];
      else el.textContent = strings[key];
    }
  });

  if ($("#menu-grid") && state.menu.length) renderMenu();
}

async function loadMenu() {
  try {
    const response = await fetch("menu.json");
    state.menu = await response.json();
  } catch (error) {
    $("#menu-grid").innerHTML = "<p>Menu could not be loaded.</p>";
  }
}

function setupFilters() {
  $$(".filter-btn").forEach(button => {
    button.addEventListener("click", () => {
      $$(".filter-btn").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      state.activeFilter = button.dataset.filter;
      renderMenu();
    });
  });
}

function itemMatchesFilter(item, filter) {
  if (filter === "all") return true;
  if (filter === "allergy") return item.allergens && item.allergens.length > 0;
  return item.tags.includes(filter) || item.category === filter;
}

function renderMenu() {
  const grid = $("#menu-grid");
  const status = $("#menu-status");
  if (!grid) return;

  const strings = state.translations[state.language] || state.translations.de || {};
  const items = state.menu.filter(item => itemMatchesFilter(item, state.activeFilter));

  status.textContent = `${items.length} ${strings["menu.itemsFound"] || "items found"}`;

  grid.innerHTML = items.map(item => {
    const name = item.name[state.language] || item.name.en;
    const description = item.description[state.language] || item.description.en;
    const tagLabels = [...item.tags, ...(item.allergens || [])].map(tag =>
      `<span class="tag">${strings[`tag.${tag}`] || tag}</span>`
    ).join("");

    return `
      <article class="menu-card reveal visible">
        <div class="food-img" role="img" aria-label="${name} image placeholder">${name}</div>
        <h3>${name}</h3>
        <p>${description}</p>
        <div class="tags">${tagLabels}</div>
        <div class="menu-card-footer">
          <span class="price">${item.price}</span>
          <span>${strings[`category.${item.category}`] || item.category}</span>
        </div>
      </article>
    `;
  }).join("");
}

function setupRevealAnimations() {
  const reveals = $$(".reveal");
  if (!("IntersectionObserver" in window)) {
    reveals.forEach(el => el.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  reveals.forEach(el => observer.observe(el));
}

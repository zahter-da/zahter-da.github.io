const state = {
  language: localStorage.getItem("zatar-language") || "de",
  translations: {},
  menu: [],
  activeMenuType: "food",
  activeCategories: new Set(),
  activeTags: new Set(),
  tagMatchMode: "any",
};

const FOOD_CATEGORIES = ["manakish", "fatayer", "pizza", "teller"];
const DRINK_CATEGORIES = ["drinks"];
const MAIN_CATEGORIES = [...FOOD_CATEGORIES, ...DRINK_CATEGORIES];
const HIDDEN_TAGS = new Set(["drinks"]);
const TAG_ORDER = [
  "vegan",
  "vegetarian",
  "chicken",
  "beef",
  "meat",
  "spicy",
  "gluten",
  "dairy",
  "nuts",
  "hot",
  "cold",
  "with-gas",
  "without-gas",
];

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [
  ...parent.querySelectorAll(selector),
];

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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
    updateTypeTabs();
    updateFilterSections();
    updateCategoryCounts();
    updateCategoryButtons();
    updateCategorySummary();
    renderDynamicTagFilters();
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

  $$("#nav-menu a").forEach((link) => {
    link.addEventListener("click", () => {
      menu.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

function setupYear() {
  $$("#year").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
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
  select.addEventListener("change", (event) =>
    applyLanguage(event.target.value),
  );
}

function applyLanguage(language) {
  state.language = language;
  localStorage.setItem("zatar-language", language);

  const isArabic = language === "ar";
  document.documentElement.lang = language;
  document.documentElement.dir = isArabic ? "rtl" : "ltr";
  document.body.dir = isArabic ? "rtl" : "ltr";

  const strings = state.translations[language] || state.translations.de || {};

  $$("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (!strings[key]) return;

    if (el.tagName.toLowerCase() === "title") {
      document.title = strings[key];
    } else {
      el.textContent = strings[key];
    }
  });

  updateCategorySummary();
  if ($("#tag-filter-options") && state.menu.length) renderDynamicTagFilters();
  if ($("#menu-grid") && state.menu.length) renderMenu();
}

async function loadMenu() {
  try {
    const response = await fetch("menu.json");
    state.menu = await response.json();
  } catch (error) {
    const grid = $("#menu-grid");
    if (grid) grid.innerHTML = "<p>Menu could not be loaded.</p>";
  }
}

function setupFilters() {
  $$(".filter-type-tab").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeMenuType = button.dataset.menuType || "food";
      state.activeCategories.clear();
      state.activeTags.clear();

      updateTypeTabs();
      updateFilterSections();
      updateCategoryButtons();
      updateCategorySummary();
      renderDynamicTagFilters();
      renderMenu();
    });
  });

  const categoryContainer = $("#category-filter-options");

  if (categoryContainer) {
    categoryContainer.addEventListener("click", (event) => {
      const button = event.target.closest(".category-chip");

      if (!button || !categoryContainer.contains(button)) return;

      const category = button.dataset.filter;

      if (state.activeCategories.has(category)) {
        state.activeCategories.delete(category);
      } else {
        state.activeCategories.add(category);
      }

      removeUnavailableActiveTags();
      updateCategoryButtons();
      updateCategorySummary();
      renderDynamicTagFilters();
      renderMenu();
    });
  }

  $$(".filter-match-btn").forEach((button) => {
    button.addEventListener("click", () => {
      state.tagMatchMode = button.dataset.matchMode || "any";
      updateMatchModeButtons();
      renderMenu();
    });
  });

  updateMatchModeButtons();

  const clearButton = $("#clear-filters");

  if (clearButton) {
    clearButton.addEventListener("click", clearFilters);
  }
}

function getStrings() {
  return state.translations[state.language] || state.translations.de || {};
}

function getCategoryLabel(category) {
  const strings = getStrings();
  return (
    strings[`filter.${category}`] || strings[`category.${category}`] || category
  );
}

function getTagLabel(tag) {
  const strings = getStrings();
  return strings[`tag.${tag}`] || tag;
}

function updateMatchModeButtons() {
  $$(".filter-match-btn").forEach((button) => {
    const isActive = button.dataset.matchMode === state.tagMatchMode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function updateTypeTabs() {
  $$(".filter-type-tab").forEach((button) => {
    const isActive = button.dataset.menuType === state.activeMenuType;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function updateFilterSections() {
  const categorySection = $("#food-category-section");
  if (categorySection) {
    categorySection.classList.toggle(
      "is-hidden",
      state.activeMenuType === "drinks",
    );
  }
}

function getBaseCategories() {
  return state.activeMenuType === "drinks" ? DRINK_CATEGORIES : FOOD_CATEGORIES;
}

function updateCategoryButtons() {
  $$("#category-filter-options .category-chip").forEach((button) => {
    const isActive = state.activeCategories.has(button.dataset.filter);
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function updateCategoryCounts() {
  MAIN_CATEGORIES.forEach((category) => {
    const count = state.menu.filter(
      (item) => item.category === category,
    ).length;
    const badge = $(`[data-count-for="${category}"]`);
    if (badge) badge.textContent = count;
  });
}

function updateCategorySummary() {
  const summary = $("#category-filter-summary");
  if (!summary) return;

  const strings = getStrings();

  if (state.activeMenuType === "drinks") {
    summary.textContent = strings["filter.drinks"] || "Drinks";
    return;
  }

  if (state.activeCategories.size === 0) {
    summary.textContent =
      strings["filter.allFoodCategories"] ||
      strings["filter.allCategories"] ||
      "All food categories";
    return;
  }

  const selectedLabels = FOOD_CATEGORIES.filter((category) =>
    state.activeCategories.has(category),
  ).map(getCategoryLabel);

  const selectedText = selectedLabels.join(", ");
  summary.textContent = strings["filter.selectedCategories"]
    ? strings["filter.selectedCategories"].replace("{categories}", selectedText)
    : selectedText;
}

function clearFilters() {
  state.activeCategories.clear();
  state.activeTags.clear();

  updateTypeTabs();
  updateFilterSections();
  updateCategoryButtons();
  updateCategorySummary();
  renderDynamicTagFilters();
  renderMenu();
}

function getItemsForSelectedCategories() {
  const baseCategories = getBaseCategories();

  return state.menu.filter((item) => {
    if (!baseCategories.includes(item.category)) return false;

    if (state.activeMenuType === "food" && state.activeCategories.size > 0) {
      return state.activeCategories.has(item.category);
    }

    return true;
  });
}

function getAvailableTags() {
  const available = new Map();

  getItemsForSelectedCategories().forEach((item) => {
    [...(item.tags || []), ...(item.allergens || [])].forEach((tag) => {
      if (!HIDDEN_TAGS.has(tag)) {
        available.set(tag, (available.get(tag) || 0) + 1);
      }
    });
  });

  return [...available.entries()].sort(([a], [b]) => {
    const indexA = TAG_ORDER.includes(a)
      ? TAG_ORDER.indexOf(a)
      : TAG_ORDER.length;
    const indexB = TAG_ORDER.includes(b)
      ? TAG_ORDER.indexOf(b)
      : TAG_ORDER.length;

    if (indexA !== indexB) return indexA - indexB;
    return a.localeCompare(b);
  });
}

function removeUnavailableActiveTags() {
  const availableTags = new Set(getAvailableTags().map(([tag]) => tag));

  [...state.activeTags].forEach((tag) => {
    if (!availableTags.has(tag)) {
      state.activeTags.delete(tag);
    }
  });
}

function renderDynamicTagFilters() {
  const container = $("#tag-filter-options");
  if (!container) return;

  removeUnavailableActiveTags();

  const tags = getAvailableTags();

  if (tags.length === 0) {
    container.innerHTML = `<span class="tag">${escapeHTML(getStrings()["filter.noExtraFilters"] || "No extra filters")}</span>`;
    return;
  }

  container.innerHTML = tags
    .map(([tag, count]) => {
      const isActive = state.activeTags.has(tag);
      return `
        <button class="filter-chip-btn${isActive ? " active" : ""}" type="button" data-filter="${escapeHTML(tag)}" aria-pressed="${isActive}">
          ${escapeHTML(getTagLabel(tag))}
          <span class="filter-chip-count">${count}</span>
        </button>
      `;
    })
    .join("");

  $$(".filter-chip-btn", container).forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;

      if (state.activeTags.has(filter)) {
        state.activeTags.delete(filter);
      } else {
        state.activeTags.add(filter);
      }

      renderDynamicTagFilters();
      renderMenu();
    });
  });
}

function itemMatchesFilters(item) {
  const baseCategories = getBaseCategories();
  if (!baseCategories.includes(item.category)) return false;

  const categoryMatch =
    state.activeMenuType === "drinks" ||
    state.activeCategories.size === 0 ||
    state.activeCategories.has(item.category);

  if (!categoryMatch) return false;
  if (state.activeTags.size === 0) return true;

  const itemFilterValues = new Set([
    ...(item.tags || []),
    ...(item.allergens || []),
  ]);
  const selectedTags = [...state.activeTags];

  if (state.tagMatchMode === "all") {
    return selectedTags.every((tag) => itemFilterValues.has(tag));
  }

  return selectedTags.some((tag) => itemFilterValues.has(tag));
}

function getItemImagePath(item) {
  if (item.image) return item.image;
  return `assets/menu/placeholders/${item.category || "default"}.webp`;
}

function renderMenu() {
  const grid = $("#menu-grid");
  const status = $("#menu-status");
  if (!grid) return;

  const strings = getStrings();
  const items = state.menu.filter((item) => itemMatchesFilters(item));

  if (status) {
    status.textContent = `${items.length} ${strings["menu.itemsFound"] || "items found"}`;
  }

  if (items.length === 0) {
    grid.innerHTML = `<p class="menu-empty">${escapeHTML(strings["menu.noItems"] || "No menu items match these filters.")}</p>`;
    return;
  }

  grid.innerHTML = items
    .map((item) => {
      const name = item.name[state.language] || item.name.en;
      const description =
        item.description[state.language] || item.description.en;
      const imagePath = getItemImagePath(item);

      const tagLabels = [...(item.tags || []), ...(item.allergens || [])]
        .filter((tag) => !HIDDEN_TAGS.has(tag))
        .map(
          (tag) => `<span class="tag">${escapeHTML(getTagLabel(tag))}</span>`,
        )
        .join("");

      return `
        <article class="menu-card reveal visible">
          <div class="food-img has-image">
            <img
              src="${escapeHTML(imagePath)}"
              alt="${escapeHTML(name)}"
              loading="lazy"
              onerror="this.parentElement.classList.remove('has-image'); this.parentElement.classList.add('is-placeholder'); this.remove();"
            />
            <span class="food-img-fallback">${escapeHTML(name)}</span>
          </div>
<div class="menu-card-content">
  <h3>${escapeHTML(name)}</h3>
  <p>${escapeHTML(description)}</p>
  <div class="tags">${tagLabels}</div>

  <div class="menu-card-footer">
    <span class="price">${escapeHTML(item.price)}</span>
    <span>${escapeHTML(strings[`category.${item.category}`] || item.category)}</span>
  </div>
</div>
        </article>
      `;
    })
    .join("");
}

function setupRevealAnimations() {
  const reveals = $$(".reveal");

  if (!("IntersectionObserver" in window)) {
    reveals.forEach((el) => el.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 },
  );

  reveals.forEach((el) => observer.observe(el));
}

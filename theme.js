// Tema personalizado para Canvas (se ejecuta en document_start para evitar parpadeo).
(() => {
  if (window.__cptThemeLoaded) return;
  window.__cptThemeLoaded = true;

  let styleEl = null;

  function buildCss(t) {
    const font = CPT_FONTS[t.fontFamily] ? CPT_FONTS[t.fontFamily].stack : "";
    const ff = font ? `font-family: ${font} !important;` : "";
    const line = `color-mix(in srgb, ${t.text} 16%, transparent)`;
    const soft = `color-mix(in srgb, ${t.text} 70%, ${t.bg})`;
    const navLight = lum(hexRgb(t.nav)) > 0.6;

    return `
:root {
  --cpt-accent: ${t.accent};
  --cpt-ui-bg: ${t.card};
  --cpt-ui-text: ${t.text};
}

/* Fondo y texto general */
html, body, #application, #wrapper, #main, #not_right_side,
.ic-Layout-wrapper, .ic-Layout-columns, .ic-Layout-contentWrapper, .ic-Layout-contentMain,
#content-wrapper, #content, #right-side-wrapper, #right-side, #left-side,
.ic-app-main-content, .ic-app-nav-toggle-and-crumbs, .ic-app-course-menu,
#dashboard, .ic-Dashboard-header, .ic-Dashboard-header__layout, .ic-app-footer,
#footer, .ic-app-main-content__secondary, #course_home_content {
  background-color: ${t.bg} !important;
  color: ${t.text} !important;
}

#content :is(h1, h2, h3, h4, h5, h6, p, li, dt, dd, td, th, label, small, strong, em, b, i:not([class*="icon"]), legend, caption, .ellipsis),
#right-side :is(h1, h2, h3, h4, h5, h6, p, li, span:not([class*="icon"])),
.ic-Dashboard-header__title, .ic-app-crumbs, .ic-app-crumbs span,
.ic-DashboardCard__header-subtitle, .ic-DashboardCard__header-term,
#section-tabs a:not(.active) {
  color: ${t.text} !important;
}
#content .muted, #content .text-muted, #content .screenreader-only + span, .ic-DashboardCard__header-term {
  color: ${soft} !important;
}

/* Enlaces / acento */
#content a:not([class*="Button"]):not(.btn):not(.ic-DashboardCard__link):not(.cpt-dash *),
#right-side a:not([class*="Button"]):not(.btn),
#left-side a, .ic-app-crumbs a, .ic-DashboardCard__header-title {
  color: ${t.accent} !important;
}
#section-tabs a.active {
  border-left-color: ${t.accent} !important;
  color: ${t.text} !important;
}
.Button--primary, .btn-primary, button[type="submit"].Button {
  background-color: ${t.accent} !important;
  border-color: ${t.accent} !important;
}

/* Tarjetas, listas y tablas */
.ic-DashboardCard, .ic-DashboardCard__header_content, .ic-DashboardCard__action-container,
.ig-header, .ig-row, .ig-list, .ic-item-row, .item-group-condensed, .item-group-container,
.context_module, .context_module_item, .context_module .header, .ic-Table, table.table, .table,
.discussion-entries, .entry-content, .discussion-section, .announcement,
#syllabus, .user_content, .ui-dialog, .ui-dialog-content, .ui-dialog-titlebar,
.card, .course-list-table-row, .Grid, .assignment-group, .assignment,
.ic-notification, .alert, .ui-menu, .al-options {
  background-color: ${t.card} !important;
  color: ${t.text} !important;
  border-color: ${line} !important;
}
#content :is(input:not([type="checkbox"]):not([type="radio"]):not([type="color"]), select, textarea) {
  background-color: ${t.card} !important;
  color: ${t.text} !important;
  border-color: ${line} !important;
}
#content hr, .ic-app-nav-toggle-and-crumbs { border-color: ${line} !important; }

/* Barra lateral global */
.ic-app-header, .ic-app-header__main-navigation, .ic-app-header__secondary-navigation,
.ic-app-header__logomark-container {
  background-color: ${t.nav} !important;
}
.ic-app-header :is(.ic-app-header__menu-list-link, .menu-item__text, .ic-icon-svg) {
  color: ${t.navText} !important;
  fill: ${t.navText} !important;
}
.ic-app-header .ic-app-header__menu-list-link svg { fill: ${t.navText} !important; }
/* Elemento activo y hover: un tono del color de los íconos sobre la barra
   (así funciona igual con barra clara u oscura). */
.ic-app-header__menu-list-item--active .ic-app-header__menu-list-link,
.ic-app-header__menu-list-item--active .menu-item__text {
  background-color: color-mix(in srgb, ${t.navText} 14%, ${t.nav}) !important;
}
.ic-app-header__menu-list-item--active .ic-app-header__menu-list-link {
  box-shadow: inset 3px 0 0 ${t.navText} !important;
}
.ic-app-header__menu-list-link:hover {
  background-color: color-mix(in srgb, ${t.navText} 8%, ${t.nav}) !important;
}
.ic-app-header__menu-list-item--active :is(.menu-item__text, .ic-icon-svg, svg, path) {
  color: ${t.navText} !important;
  fill: ${t.navText} !important;
}
.ic-app-header__logomark-container { background-color: ${t.nav} !important; }
${navLight ? `/* Barra clara: las imágenes blancas (logo del Tec, TECgpt) se pintan del
   color de los íconos. TECbot y la foto de perfil son a color: no se tocan. */
.ic-app-header__logomark, #tecgpt-button img { filter: brightness(0)${lum(hexRgb(t.navText)) > 0.5 ? " invert(1)" : ""} !important; }` : ""}

/* Tipografía */
#content, #right-side, #left-side, .ic-app-nav-toggle-and-crumbs {
  font-size: ${t.fontSize}% !important;
}
${ff ? `body, #content :is(h1, h2, h3, h4, h5, h6, p, li, td, th, label, a, button, input, select, textarea, span:not([class*="icon"]), div),
#right-side :is(p, li, a, span:not([class*="icon"]), div), .ic-app-header .menu-item__text { ${ff} }` : ""}
`;
  }

  // ---------- Recoloreado dinámico ----------
  // Las vistas nuevas de Canvas (InstUI) generan clases aleatorias con fondo
  // blanco que el CSS no puede alcanzar. Aquí se detectan por su color real y
  // se recolorean con estilos en línea, que se revierten al desactivar el tema.
  const SKIP = ".cpt-dash, .cpt-panel, .cpt-btn, .ic-app-header, #flash_message_holder, svg";
  const SKIP_TAGS = new Set(["IMG", "SVG", "VIDEO", "CANVAS", "IFRAME", "PICTURE", "SCRIPT", "STYLE", "LINK", "META", "NOSCRIPT", "BR", "HR"]);
  let active = null; // { card, text, dark, recolorBg }
  let observer = null;
  let pending = new Set();
  let timer = null;

  function parseColor(c) {
    const m = c && c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return { r, g, b, a };
  }
  function hexRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const lum = ({ r, g, b }) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  function effectiveBgDark(e) {
    for (let n = e; n && n.nodeType === 1; n = n.parentElement) {
      const bg = parseColor(getComputedStyle(n).backgroundColor);
      if (bg && bg.a > 0.5) return lum(bg) < 0.5;
    }
    return active.dark;
  }

  function fixElement(e) {
    if (SKIP_TAGS.has(e.tagName.toUpperCase()) || e.closest(SKIP)) return;
    const cs = getComputedStyle(e);
    if (active.recolorBg && !e.hasAttribute("data-cpt-bg")) {
      const bg = parseColor(cs.backgroundColor);
      if (bg && bg.a > 0.5 && lum(bg) > 0.82) {
        e.style.setProperty("background-color", active.card, "important");
        e.setAttribute("data-cpt-bg", "");
      }
    }
    if (active.dark && !e.hasAttribute("data-cpt-fg")) {
      const fg = parseColor(cs.color);
      const l = fg && lum(fg);
      if (fg && l < 0.6 && effectiveBgDark(e)) {
        // Texto oscuro → color del tema; gris medio → versión atenuada.
        e.style.setProperty("color", l < 0.3 ? active.text : active.muted, "important");
        e.setAttribute("data-cpt-fg", "");
      }
    }
  }

  function processRoot(root) {
    if (!active || !root || root.nodeType !== 1 || !root.isConnected) return;
    fixElement(root);
    for (const e of root.querySelectorAll("*")) fixElement(e);
  }

  function flush() {
    timer = null;
    const roots = Array.from(pending);
    pending = new Set();
    for (const r of roots) processRoot(r);
  }

  function schedule(node) {
    pending.add(node);
    if (!timer) timer = setTimeout(flush, 120);
  }

  function revertRecolor() {
    for (const e of document.querySelectorAll("[data-cpt-bg]")) {
      e.style.removeProperty("background-color");
      e.removeAttribute("data-cpt-bg");
    }
    for (const e of document.querySelectorAll("[data-cpt-fg]")) {
      e.style.removeProperty("color");
      e.removeAttribute("data-cpt-fg");
    }
  }

  function startRecolor(t) {
    revertRecolor();
    const card = hexRgb(t.card);
    active = {
      card: t.card,
      text: t.text,
      muted: `color-mix(in srgb, ${t.text} 72%, ${t.bg})`,
      dark: lum(hexRgb(t.bg)) < 0.45,
      recolorBg: lum(card) < 0.97, // con tarjetas blancas no hace falta
    };
    if (!active.recolorBg && !active.dark) return stopRecolor(false);
    const run = () => {
      schedule(document.body);
      // Canvas (React/InstUI) a veces aplica sus clases de color después de
      // insertar el elemento: se vigilan cambios de clase y se repasa todo
      // un par de veces tras la carga.
      for (const ms of [1500, 5000]) setTimeout(() => active && schedule(document.body), ms);
      if (!observer) {
        observer = new MutationObserver((muts) => {
          for (const m of muts) {
            if (m.type === "attributes") schedule(m.target);
            else for (const n of m.addedNodes) if (n.nodeType === 1) schedule(n);
          }
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
      }
    };
    if (document.body) run();
    else document.addEventListener("DOMContentLoaded", run, { once: true });
  }

  function stopRecolor(revert = true) {
    active = null;
    if (observer) observer.disconnect();
    observer = null;
    pending = new Set();
    if (revert) revertRecolor();
  }

  // ---------- Ocultar widgets del tablero de Canvas ----------
  let hideEl = null;
  function applyHidden(dash) {
    const valid = new Set(CPT_CANVAS_WIDGETS.map((w) => w.id));
    const ids = (dash && Array.isArray(dash.hideWidgets) ? dash.hideWidgets : []).filter((id) => valid.has(id));
    if (!ids.length) {
      if (hideEl) hideEl.remove();
      hideEl = null;
      return;
    }
    if (!hideEl) {
      hideEl = document.createElement("style");
      hideEl.id = "cpt-hide-widgets";
    }
    hideEl.textContent = `${ids.map((id) => `[data-testid="widget-container-${id}"]`).join(",\n")} { display: none !important; }`;
    (document.head || document.documentElement).append(hideEl);
  }

  function apply(settings) {
    applyHidden(settings.dashboard);
    const t = settings.theme;
    if (!t || !t.enabled) {
      if (styleEl) styleEl.remove();
      styleEl = null;
      stopRecolor();
      return;
    }
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "cpt-theme";
    }
    const clean = cptSanitizeTheme(t);
    styleEl.textContent = buildCss(clean);
    (document.head || document.documentElement).append(styleEl);
    startRecolor(clean);
  }

  cptGetSettings().then(apply);

  // Re-colocar al final del <head> para ganar a las hojas de estilo de Canvas
  document.addEventListener("DOMContentLoaded", () => {
    if (styleEl && document.head) document.head.append(styleEl);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.settings) cptGetSettings().then(apply);
  });
})();
